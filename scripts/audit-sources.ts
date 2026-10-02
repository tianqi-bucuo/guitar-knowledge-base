import { lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { auditSources, markdownCell, renderSourceAudit } from "./content/auditSources"
import { loadManifest } from "./content/loadManifest"
import { parsePage, type PageRecord } from "./content/parsePage"
import type { Diagnostic } from "./content/types"

function usage(message: string): never {
  process.stderr.write(message + "\n")
  process.exit(2)
}

function argumentsFor(args: string[]) {
  const modes = ["--write", "--check", "--online"]
  const values = new Map<string, string>()
  let mode = ""
  const seen = new Set<string>()
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (seen.has(argument)) usage(`Duplicate argument: ${argument}`)
    seen.add(argument)
    if (modes.includes(argument)) {
      if (mode) usage("Exactly one mode is required.")
      mode = argument
    } else {
      if (!["--output", "--manifest", "--content-root"].includes(argument))
        usage(`Unknown argument: ${argument}`)
      const value = args[++index]?.trim()
      if (!value || value.startsWith("--")) usage(`Missing value: ${argument}`)
      values.set(argument, value)
    }
  }
  if (!mode) usage("Exactly one mode is required: --write, --check, --online.")
  const onlinePath = resolve("reports/source-audit-online.md")
  const output = resolve(
    values.get("--output") ?? (mode === "--online" ? onlinePath : "reports/source-audit.md"),
  )
  if (mode === "--online" && output !== onlinePath)
    usage("Online output must be reports/source-audit-online.md.")
  if (mode === "--online") {
    const directory = lstatSync(dirname(output), { throwIfNoEntry: false })
    const file = lstatSync(output, { throwIfNoEntry: false })
    if (
      (directory && (!directory.isDirectory() || directory.isSymbolicLink())) ||
      (file && (!file.isFile() || file.isSymbolicLink()))
    )
      usage("Online output must use a regular report path, not a symlink.")
  }
  if (mode !== "--online" && output === onlinePath)
    usage("Structural output must not use the online report path.")
  return {
    mode,
    output,
    manifest: resolve(values.get("--manifest") ?? "data/content-manifest.yml"),
    root: resolve(values.get("--content-root") ?? "content"),
  }
}

function inside(root: string, file: string): boolean {
  const path = relative(root, file)
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
}

async function main(): Promise<void> {
  const options = argumentsFor(process.argv.slice(2))
  const manifest = loadManifest(options.manifest)
  const pages: PageRecord[] = []
  const reads: Diagnostic[] = []
  const root = realpathSync(options.root)
  for (const entry of manifest.pages) {
    try {
      if (["templates", ".obsidian"].includes(entry.file.split("/")[0]))
        throw new Error("Reserved content directory")
      const path = resolve(options.root, entry.file)
      if (
        !inside(options.root, path) ||
        !inside(root, realpathSync(path)) ||
        !statSync(path).isFile()
      )
        throw new Error("Page must be a regular file inside content root")
      const page = parsePage(path)
      page.contentPath = entry.file
      pages.push(page)
    } catch {
      reads.push({
        severity: "error",
        code: "SOURCE_PAGE_READ_ERROR",
        file: entry.file,
        message: "Cannot safely read manifest publication page.",
      })
    }
  }
  const audit = auditSources(pages, manifest)
  audit.diagnostics.push(...reads)
  let report = renderSourceAudit(pages, manifest, audit)
  if (options.mode === "--online") {
    const { probeSources } = await import("./content/probeSource")
    const probes = await probeSources(audit.sources.map((source) => source.url))
    report +=
      "\n## Optional network health (not factual verification)\n\n| URL | Status | Final destination / warning |\n| --- | --- | --- |\n"
    for (const probe of probes)
      report += `| ${markdownCell(probe.url)} | ${probe.status ?? "warning"} | ${markdownCell(probe.warning ?? probe.finalUrl ?? "")} |\n`
  }
  const errors = audit.diagnostics.filter((d) => d.severity === "error").length
  if (options.mode === "--check") {
    let current: string | undefined
    try {
      current = readFileSync(options.output, "utf8")
    } catch {
      /* missing report is stale */
    }
    if (current !== report) {
      process.stderr.write("Source audit report is missing or stale. Run audit:sources:write.\n")
      process.exitCode = 1
    }
  } else {
    mkdirSync(dirname(options.output), { recursive: true })
    writeFileSync(options.output, report, "utf8")
  }
  process.stdout.write(
    `Source audit: ${pages.length} pages, ${audit.sources.length} sources, ${errors} structural error(s).\n`,
  )
  if (errors) process.exitCode = 1
}

try {
  await main()
} catch (error) {
  // Avoid leaking absolute filesystem paths into deterministic report/startup diagnostics.
  const code = error instanceof Error ? /^[A-Z][A-Z0-9_]+:/.exec(error.message)?.[0] : undefined
  process.stderr.write(
    `Source audit startup failed${code ? `: ${code.slice(0, -1)}` : " (manifest, content root, or report I/O)"}.\n`,
  )
  process.exitCode = 1
}
