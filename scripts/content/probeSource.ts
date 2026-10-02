import { lookup } from "node:dns/promises"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { BlockList, isIP } from "node:net"

export interface SourceProbe {
  url: string
  status?: number
  finalUrl?: string
  warning?: string
}

export interface PinnedRequest {
  url: URL
  address: string
  family: number
  method: "HEAD" | "GET"
  signal: AbortSignal
}

export interface ProbeDependencies {
  resolve: (hostname: string) => Promise<Array<{ address: string; family: number }>>
  request: (request: PinnedRequest) => Promise<{ status: number; location?: string }>
}

const denied = new BlockList()
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  denied.addSubnet(address, prefix, "ipv4")
denied.addSubnet("2001::", 23, "ipv6")
denied.addSubnet("2001:db8::", 32, "ipv6")
denied.addSubnet("2002::", 16, "ipv6")
const globalV6 = new BlockList()
globalV6.addSubnet("2000::", 3, "ipv6")

function publicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !denied.check(address, "ipv4")
  if (family === 6) return globalV6.check(address, "ipv6") && !denied.check(address, "ipv6")
  return false
}

function hostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "")
}

function safeTarget(url: URL): void {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Unsafe protocol or credentials")
  const host = hostname(url)
  if (isIP(host)) {
    if (!publicAddress(host)) throw new Error("Unsafe destination address")
  } else if (
    !host.includes(".") ||
    /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example)$/i.test(host)
  ) {
    throw new Error("Unsafe local hostname")
  }
}

const defaults: ProbeDependencies = {
  resolve: (host) => lookup(host, { all: true, verbatim: true }),
  request: ({ url, address, family, method, signal }) =>
    new Promise((resolve, reject) => {
      const host = hostname(url)
      const transport = url.protocol === "https:" ? httpsRequest : httpRequest
      const request = transport(
        url,
        {
          method,
          signal,
          agent: false,
          ...{ family, autoSelectFamily: false },
          // Connect only to the approved address; URL hostname still controls Host and TLS identity.
          servername: isIP(host) ? undefined : host,
          lookup: (_hostname, _options, callback) => callback(null, address, family),
          headers: { "User-Agent": "Guitar-KB-source-health/1.0", Accept: "*/*" },
        },
        (response) => {
          const status = response.statusCode ?? 0
          const location = response.headers.location
          // Health requires headers only, including GET fallback. Retain zero body bytes.
          response.destroy()
          request.destroy()
          resolve({ status, location })
        },
      )
      request.on("error", reject)
      request.end()
    }),
}

export async function probeSource(
  url: string,
  dependencies: Partial<ProbeDependencies> = {},
  deadlineMs = 10_000,
): Promise<SourceProbe> {
  const transport = { ...defaults, ...dependencies }
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error("Source deadline exceeded"))
    }, deadlineMs)
  })
  const bounded = <T>(promise: Promise<T>): Promise<T> => Promise.race([promise, deadline])
  try {
    let target = new URL(url)
    let redirects = 0
    let method: "HEAD" | "GET" = "HEAD"
    while (true) {
      safeTarget(target)
      const host = hostname(target)
      let addresses
      try {
        addresses = isIP(host)
          ? [{ address: host, family: isIP(host) }]
          : await bounded(transport.resolve(host))
      } catch {
        throw new Error(
          controller.signal.aborted ? "Source deadline exceeded" : "DNS resolution failed",
        )
      }
      if (
        !addresses.length ||
        addresses.some(({ address, family }) => !publicAddress(address) || family !== isIP(address))
      )
        throw new Error("Unsafe resolved destination")
      const destination = addresses[0]
      let response
      try {
        response = await bounded(
          transport.request({ url: target, ...destination, method, signal: controller.signal }),
        )
      } catch {
        throw new Error(
          controller.signal.aborted ? "Source deadline exceeded" : "Network request failed",
        )
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.location) throw new Error("Redirect missing destination")
        if (redirects++ >= 3) throw new Error("Source redirect limit exceeded")
        target = new URL(response.location, target)
        continue
      }
      if (method === "HEAD" && [405, 501].includes(response.status)) {
        method = "GET"
        continue
      }
      return {
        url,
        status: response.status,
        finalUrl: target.href,
        ...(response.status >= 400 ? { warning: `HTTP ${response.status}` } : {}),
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source health probe failed"
    const warning = /^(Unsafe|DNS|Network|Source|Redirect)/.test(message)
      ? message
      : "Invalid source health target"
    return { url, warning }
  } finally {
    if (timer) clearTimeout(timer)
    controller.abort()
  }
}

export async function probeSources(
  urls: string[],
  dependencies: ProbeDependencies = defaults,
): Promise<SourceProbe[]> {
  const unique = [...new Set(urls)].sort()
  const results: SourceProbe[] = new Array(unique.length)
  let next = 0
  async function worker() {
    while (next < unique.length) {
      const index = next++
      results[index] = await probeSource(unique[index], dependencies)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, () => worker()))
  return results
}
