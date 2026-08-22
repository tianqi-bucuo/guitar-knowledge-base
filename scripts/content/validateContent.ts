import { lstatSync, readdirSync, realpathSync, type Stats } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { posix } from "node:path"
import { loadManifest } from "./loadManifest"
import { parsePage, type PageRecord } from "./parsePage"
import { validateLinks } from "./validateLinks"
import { validateMetadata } from "./validateMetadata"
import { validateStructure } from "./validateStructure"
import type { Diagnostic, Manifest, ValidationMode } from "./types"

export const EXCLUDED_CONTENT_DIRS = [".obsidian", "templates"] as const

export interface ValidationOptions {
  contentRoot: string
  manifestPath: string
  mode: ValidationMode
}

function diagnostic(
  severity: Diagnostic["severity"],
  code: string,
  file: string,
  message: string,
): Diagnostic {
  return { severity, code, file, message }
}

function manifestFailure(error: unknown, manifestPath: string): Diagnostic {
  const message = error instanceof Error ? error.message : String(error)
  const match = /^([A-Z][A-Z0-9_]+):\s*(.*)$/s.exec(message)
  const absolutePath = resolve(manifestPath)
  const file = isInside(process.cwd(), absolutePath)
    ? relative(process.cwd(), absolutePath).split(sep).join("/")
    : absolutePath.split(sep).join("/")
  return {
    ...diagnostic("error", match?.[1] ?? "MANIFEST_READ_ERROR", file, match?.[2] ?? message),
    namespace: "manifest",
  }
}

function isInside(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
}

function normalizeManifestFile(file: string): string | undefined {
  if (isAbsolute(file) || file.includes("\\") || !file.endsWith(".md")) {
    return undefined
  }
  const normalized = posix.normalize(file)
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return undefined
  }
  return normalized
}

function isExcludedContentPath(file: string): boolean {
  const firstSegment = file.split("/", 1)[0]
  return (EXCLUDED_CONTENT_DIRS as readonly string[]).includes(firstSegment)
}

function scanMarkdown(root: string): string[] {
  const files: string[] = []

  function visit(directory: string, prefix: string): void {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (isExcludedContentPath(relativePath)) {
        continue
      }
      const absolutePath = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath)
      } else if ((entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith(".md")) {
        files.push(posix.normalize(relativePath))
      }
    }
  }

  visit(root, "")
  return files.sort()
}

interface Collection {
  pages: PageRecord[]
  diagnostics: Diagnostic[]
  actualCount: number
}

function collectPages(manifest: Manifest, options: ValidationOptions): Collection {
  const diagnostics: Diagnostic[] = []
  const pages: PageRecord[] = []
  const root = resolve(options.contentRoot)
  let realRoot: string
  try {
    realRoot = realpathSync(root)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      pages,
      actualCount: 0,
      diagnostics: [
        diagnostic("error", "CONTENT_PARSE_ERROR", "", `无法读取 content root: ${message}`),
      ],
    }
  }

  const manifestFiles = new Set<string>()
  for (const entry of manifest.pages) {
    const file = normalizeManifestFile(entry.file)
    if (file === undefined) {
      diagnostics.push(
        diagnostic("error", "CONTENT_PARSE_ERROR", entry.file, "manifest 页面路径不安全"),
      )
      continue
    }
    if (isExcludedContentPath(file)) {
      diagnostics.push(
        diagnostic("error", "MANIFEST_EXCLUDED_FILE", file, "manifest 页面不能位于保留的内容目录"),
      )
      continue
    }
    manifestFiles.add(file)
    const absolutePath = resolve(root, ...file.split("/"))
    if (!isInside(root, absolutePath)) {
      diagnostics.push(
        diagnostic("error", "CONTENT_PARSE_ERROR", file, "页面路径越出 content root"),
      )
      continue
    }

    let stats: Stats | undefined
    try {
      stats = lstatSync(absolutePath, { throwIfNoEntry: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      diagnostics.push(
        diagnostic("error", "CONTENT_PARSE_ERROR", file, `无法检查正式页面: ${message}`),
      )
      continue
    }

    if (stats === undefined) {
      const isRequiredRelease = options.mode === "release" && entry.required
      diagnostics.push(
        diagnostic(
          isRequiredRelease ? "error" : "warning",
          isRequiredRelease ? "REQUIRED_PAGE_MISSING" : "PLANNED_PAGE_MISSING",
          file,
          `manifest 页面尚不存在: ${entry.title}`,
        ),
      )
      continue
    }

    try {
      const realFile = realpathSync(absolutePath)
      if (!isInside(realRoot, realFile) || (!stats.isFile() && !stats.isSymbolicLink())) {
        diagnostics.push(
          diagnostic("error", "CONTENT_PARSE_ERROR", file, "页面不是 content root 内的普通文件"),
        )
        continue
      }
      const page = parsePage(absolutePath)
      page.contentPath = file
      pages.push(page)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      diagnostics.push(
        diagnostic("error", "CONTENT_PARSE_ERROR", file, `无法解析正式页面: ${message}`),
      )
    }
  }

  try {
    for (const file of scanMarkdown(root)) {
      if (!manifestFiles.has(file)) {
        diagnostics.push(
          diagnostic("error", "UNLISTED_CONTENT_PAGE", file, "Markdown 页面未列入 manifest"),
        )
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    diagnostics.push(
      diagnostic("error", "CONTENT_PARSE_ERROR", "", `无法扫描 content root: ${message}`),
    )
  }

  return { pages, diagnostics, actualCount: pages.length }
}

function normalizeDiagnosticFile(
  item: Diagnostic,
  pages: PageRecord[],
  contentRoot: string,
): Diagnostic {
  if (item.file === "" || item.file === "content" || item.file === "content/") {
    return { ...item, file: "" }
  }
  const page = pages.find((candidate) => candidate.file === item.file)
  if (page?.contentPath !== undefined) {
    return { ...item, file: page.contentPath }
  }
  if (item.file.startsWith("content/")) {
    return { ...item, file: posix.normalize(item.file.slice("content/".length)) }
  }

  const absoluteRoot = resolve(contentRoot)
  if (isAbsolute(item.file) && isInside(absoluteRoot, resolve(item.file))) {
    return { ...item, file: relative(absoluteRoot, item.file).split(sep).join("/") }
  }
  return { ...item, file: item.file.split(sep).join("/") }
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  if (left.file !== right.file) return left.file < right.file ? -1 : 1
  if (left.severity !== right.severity) return left.severity === "error" ? -1 : 1
  if (left.code !== right.code) return left.code < right.code ? -1 : 1
  return left.message < right.message ? -1 : left.message > right.message ? 1 : 0
}

function stableDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const unique = new Map<string, Diagnostic>()
  for (const item of diagnostics) {
    const key = `${item.namespace ?? "content"}\0${item.file}\0${item.severity}\0${item.code}\0${item.message}`
    if (!unique.has(key)) unique.set(key, item)
  }
  return [...unique.values()].sort(compareDiagnostics)
}

export async function validateContent(options: ValidationOptions): Promise<Diagnostic[]> {
  let manifest: Manifest
  try {
    manifest = loadManifest(options.manifestPath)
  } catch (error) {
    return [manifestFailure(error, options.manifestPath)]
  }

  const collection = collectPages(manifest, options)
  const diagnostics = [
    ...collection.diagnostics,
    ...validateMetadata(collection.pages, manifest),
    ...validateStructure(collection.pages),
    ...validateLinks(collection.pages, options.contentRoot),
  ]

  if (options.mode === "release") {
    for (const page of collection.pages) {
      if (page.frontmatter.draft === true) {
        diagnostics.push(
          diagnostic(
            "error",
            "DRAFT_PAGE_IN_RELEASE",
            page.contentPath ?? page.file,
            "release 模式不允许 draft: true",
          ),
        )
      }
    }
  }

  if (
    collection.actualCount < manifest.release.minPages ||
    collection.actualCount > manifest.release.maxPages
  ) {
    diagnostics.push(
      diagnostic(
        options.mode === "release" ? "error" : "warning",
        "CONTENT_COUNT_OUT_OF_RANGE",
        "",
        `正式页面数量 ${collection.actualCount} 不在 ${manifest.release.minPages}–${manifest.release.maxPages} 范围内`,
      ),
    )
  }

  return stableDiagnostics(
    diagnostics.map((item) => normalizeDiagnosticFile(item, collection.pages, options.contentRoot)),
  )
}
