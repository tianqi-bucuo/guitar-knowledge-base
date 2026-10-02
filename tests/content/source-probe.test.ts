import assert from "node:assert/strict"
import test, { mock } from "node:test"
import https from "node:https"
import http from "node:http"
import { EventEmitter } from "node:events"
import { syncBuiltinESMExports } from "node:module"
import type { IncomingMessage, RequestOptions } from "node:http"
import {
  probeSource,
  probeSources,
  type ProbeDependencies,
  type PinnedRequest,
} from "../../scripts/content/probeSource"

const publicAddress = { address: "93.184.216.34", family: 4 }
const dependencies = (
  responses: Array<{ status: number; location?: string }> = [{ status: 200 }],
) => {
  const calls: PinnedRequest[] = []
  const deps: ProbeDependencies = {
    resolve: async () => [publicAddress],
    request: async (request) => {
      calls.push(request)
      return responses.shift()!
    },
  }
  return { deps, calls }
}

test("rejects credentials, local names and every nonpublic literal/resolved destination before connection", async () => {
  const addresses = [
    "0.0.0.0",
    "10.1.2.3",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "192.0.2.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "2002:7f00:1::1",
  ]
  for (const address of addresses) {
    const { deps, calls } = dependencies()
    const literal = address.includes(":") ? `[${address}]` : address
    assert.ok((await probeSource(`http://${literal}/`, deps)).warning, address)
    assert.equal(calls.length, 0)
    deps.resolve = async () => [publicAddress, { address, family: address.includes(":") ? 6 : 4 }]
    assert.ok((await probeSource("https://example.com/", deps)).warning, address)
    assert.equal(calls.length, 0)
  }
  for (const url of [
    "file:///etc/passwd",
    "https://user:pass@example.com/",
    "http://localhost/",
    "http://machine/",
    "http://machine.local/",
    "http://localhost./",
    "http://127.1/",
    "http://0x7f000001/",
  ]) {
    const { deps, calls } = dependencies()
    assert.ok((await probeSource(url, deps)).warning, url)
    assert.equal(calls.length, 0)
  }
})

test("pins verified DNS address while preserving hostname and TLS identity", async () => {
  const { deps, calls } = dependencies()
  const result = await probeSource("https://example.com/a?x=1#part", deps)
  assert.deepEqual(result, {
    url: "https://example.com/a?x=1#part",
    status: 200,
    finalUrl: "https://example.com/a?x=1#part",
  })
  assert.equal(calls[0].address, "93.184.216.34")
  assert.equal(calls[0].family, 4)
  assert.equal(calls[0].url.hostname, "example.com")
  assert.equal(calls[0].method, "HEAD")
  const ipv6 = dependencies()
  ipv6.deps.resolve = async () => [{ address: "2001:4860:4860::8888", family: 6 }]
  assert.equal((await probeSource("https://example.com/", ipv6.deps)).status, 200)
})

test("HEAD unsupported alone enables GET; redirects are manually revalidated and bounded", async () => {
  const fallback = dependencies([{ status: 405 }, { status: 200 }])
  assert.equal((await probeSource("https://example.com/", fallback.deps)).status, 200)
  assert.deepEqual(
    fallback.calls.map((call) => call.method),
    ["HEAD", "GET"],
  )
  const denied = dependencies([{ status: 403 }])
  assert.equal((await probeSource("https://example.com/", denied.deps)).status, 403)
  assert.equal(denied.calls.length, 1)
  const redirect = dependencies([{ status: 302, location: "/safe" }, { status: 200 }])
  assert.equal(
    (await probeSource("https://example.com/", redirect.deps)).finalUrl,
    "https://example.com/safe",
  )
  const unsafe = dependencies([{ status: 302, location: "http://169.254.169.254/latest" }])
  assert.match((await probeSource("https://example.com/", unsafe.deps)).warning!, /Unsafe/)
  assert.equal(unsafe.calls.length, 1)
  const rebound = dependencies([{ status: 302, location: "/next" }])
  let resolutions = 0
  rebound.deps.resolve = async () =>
    ++resolutions === 1 ? [publicAddress] : [{ address: "127.0.0.1", family: 4 }]
  assert.ok((await probeSource("https://example.com/", rebound.deps)).warning)
  assert.equal(rebound.calls.length, 1)
  const excessive = dependencies(
    Array.from({ length: 4 }, () => ({ status: 302, location: "/again" })),
  )
  assert.match(
    (await probeSource("https://example.com/", excessive.deps)).warning!,
    /redirect limit/,
  )
  assert.equal(excessive.calls.length, 4)
})

test("one deadline covers DNS, redirects and fallback, and failures remain concise warnings", async () => {
  const slow = dependencies()
  slow.deps.resolve = async () => new Promise(() => {})
  assert.match((await probeSource("https://example.com/", slow.deps, 20)).warning!, /deadline/)
  const fallback = dependencies([{ status: 501 }])
  fallback.deps.request = async (request) => {
    if (request.method === "HEAD") return { status: 501 }
    return new Promise((_resolve, reject) =>
      request.signal.addEventListener("abort", () => reject(new Error("abort")), { once: true }),
    )
  }
  assert.match((await probeSource("https://example.com/", fallback.deps, 20)).warning!, /deadline/)
  const failure = dependencies()
  failure.deps.resolve = async () => {
    throw new Error("secret /absolute/path")
  }
  assert.match((await probeSource("https://example.com/", failure.deps)).warning!, /DNS/)
  assert.ok(!(await probeSource("https://example.com/", failure.deps)).warning!.includes("secret"))
})

test("unique source health probes use at most four workers and return sorted results", async () => {
  let active = 0
  let maximum = 0
  let count = 0
  const deps: ProbeDependencies = {
    resolve: async () => [publicAddress],
    request: async () => {
      active++
      count++
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return { status: 200 }
    },
  }
  const results = await probeSources(
    [
      "https://example.com/e",
      "https://example.com/d",
      "https://example.com/c",
      "https://example.com/b",
      "https://example.com/a",
      "https://example.com/a",
    ],
    deps,
  )
  assert.equal(count, 5)
  assert.equal(maximum, 4)
  assert.deepEqual(
    results.map((result) => result.url),
    [
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
      "https://example.com/d",
      "https://example.com/e",
    ],
  )
})

test("built-in HTTP(S) adapter pins lookup, preserves TLS and discards the GET body at headers", async () => {
  let destroyedResponses = 0
  const methods: string[] = []
  function intercept(
    url: URL,
    options: RequestOptions & { servername?: string; autoSelectFamily?: boolean },
    callback: (response: IncomingMessage) => void,
  ) {
    assert.equal(url.hostname, "example.com")
    assert.equal(options.family, 4)
    assert.equal(options.autoSelectFamily, false)
    assert.equal(options.agent, false)
    assert.equal(options.servername, "example.com")
    assert.equal(options.method === "HEAD" || options.method === "GET", true)
    methods.push(options.method!)
    const resolveAddress = options.lookup as Function
    resolveAddress(
      "example.com",
      { all: false },
      (error: unknown, address: string, family: number) => {
        assert.equal(error, null)
        assert.equal(address, "93.184.216.34")
        assert.equal(family, 4)
      },
    )
    const request = Object.assign(new EventEmitter(), {
      destroy() {},
      end() {
        queueMicrotask(() =>
          callback({
            statusCode: options.method === "HEAD" ? 405 : 200,
            headers: {},
            destroy() {
              destroyedResponses++
            },
          } as unknown as IncomingMessage),
        )
      },
    })
    return request
  }
  mock.method(http, "request", intercept)
  mock.method(https, "request", intercept)
  syncBuiltinESMExports()
  try {
    for (const protocol of ["http", "https"]) {
      assert.equal(
        (await probeSource(`${protocol}://example.com/`, { resolve: async () => [publicAddress] }))
          .status,
        200,
      )
    }
    assert.deepEqual(methods, ["HEAD", "GET", "HEAD", "GET"])
    assert.equal(destroyedResponses, 4)
  } finally {
    mock.restoreAll()
    syncBuiltinESMExports()
  }
})
