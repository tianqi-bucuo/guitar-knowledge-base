import { existsSync, readFileSync, statSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { posix } from "node:path"
import { DOMParser } from "@xmldom/xmldom"
import Slugger from "github-slugger"
import type { PageRecord } from "./parsePage"
import type { Diagnostic } from "./types"

export interface ResolvedLink {
  source: string
  target: string
  raw: string
}

interface IndexedPage {
  page: PageRecord
  file: string
  key: string
  headings: Set<string>
}

interface PageIndexes {
  files: Map<string, IndexedPage[]>
  permalinks: Map<string, IndexedPage[]>
  aliases: Map<string, IndexedPage[]>
  basenames: Map<string, IndexedPage[]>
}

interface Analysis {
  resolved: ResolvedLink[]
  diagnostics: Diagnostic[]
}

type Resolution =
  | { kind: "external" }
  | { kind: "resolved"; target: string }
  | { kind: "error"; code: string; message: string }

function canonicalKey(value: string): string {
  return value
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.md$/i, "")
    .toLocaleLowerCase("en-US")
}

function decodeTarget(value: string): string | undefined {
  try {
    return value
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/")
  } catch {
    return undefined
  }
}

function contentRelativeFile(pageFile: string, contentRoot: string): string {
  const root = resolve(contentRoot)
  const absolutePage = isAbsolute(pageFile) ? resolve(pageFile) : resolve(pageFile)
  const result = relative(root, absolutePage).split(sep).join("/")
  return posix.normalize(result)
}

function addIndex(map: Map<string, IndexedPage[]>, key: string, page: IndexedPage): void {
  const entries = map.get(key) ?? []
  entries.push(page)
  map.set(key, entries)
}

function safeAlias(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const alias = value.trim()
  if (
    alias.length === 0 ||
    alias.includes("?") ||
    alias.includes("#") ||
    alias.includes("\\") ||
    /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(alias)
  ) {
    return undefined
  }

  const decoded = decodeTarget(alias)
  if (!decoded) {
    return undefined
  }
  const normalized = posix.normalize(decoded.replace(/^\/+/, ""))
  if (normalized === ".." || normalized.startsWith("../")) {
    return undefined
  }
  return canonicalKey(normalized)
}

function safePermalink(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.includes("?") ||
    value.includes("#") ||
    value.includes("\\")
  ) {
    return undefined
  }
  const decoded = decodeTarget(value)
  return decoded === undefined ? undefined : canonicalKey(decoded)
}

function headingSlugs(headings: string[]): Set<string> {
  const slugger = new Slugger()
  return new Set(headings.map((heading) => slugger.slug(heading.trim())))
}

function buildIndexes(pages: PageRecord[], contentRoot: string): PageIndexes {
  const indexes: PageIndexes = {
    files: new Map(),
    permalinks: new Map(),
    aliases: new Map(),
    basenames: new Map(),
  }

  for (const page of pages) {
    const file = contentRelativeFile(page.file, contentRoot)
    const key = canonicalKey(file)
    const indexed: IndexedPage = { page, file, key, headings: headingSlugs(page.headings) }
    addIndex(indexes.files, key, indexed)
    addIndex(indexes.basenames, canonicalKey(posix.basename(file)), indexed)

    const permalink = safePermalink(page.frontmatter.permalink)
    if (permalink !== undefined) {
      addIndex(indexes.permalinks, permalink, indexed)
    }

    const aliases = page.frontmatter.aliases
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        const key = safeAlias(alias)
        if (key !== undefined) {
          addIndex(indexes.aliases, key, indexed)
        }
      }
    }
  }

  return indexes
}

function isExternalTarget(target: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(target)
}

function normalizedPathTarget(
  target: string,
  sourceFile: string,
): { path: string; key: string } | Resolution {
  if (target.includes("?") || target.includes("\\") || target.includes("\0")) {
    return {
      kind: "error",
      code: "INVALID_INTERNAL_TARGET",
      message: `内部目标不允许 query、反斜线或 NUL: ${target}`,
    }
  }

  const decoded = decodeTarget(target)
  if (decoded === undefined) {
    return { kind: "error", code: "INVALID_INTERNAL_TARGET", message: `URI 编码无效: ${target}` }
  }

  const fromRoot = decoded.startsWith("/")
  const withoutRoot = decoded.replace(/^\/+/, "")
  const base = fromRoot ? "" : posix.dirname(sourceFile)
  const path = posix.normalize(posix.join(base, withoutRoot))
  if (path === ".." || path.startsWith("../")) {
    return {
      kind: "error",
      code: "PATH_TRAVERSAL_TARGET",
      message: `内部目标越出 content root: ${target}`,
    }
  }

  return { path, key: canonicalKey(path) }
}

function selectIndexed(
  candidates: IndexedPage[] | undefined,
  raw: string,
): IndexedPage | Resolution | undefined {
  if (!candidates || candidates.length === 0) {
    return undefined
  }
  if (candidates.length > 1) {
    return {
      kind: "error",
      code: "AMBIGUOUS_INTERNAL_LINK",
      message: `内部目标对应多个页面: ${raw}`,
    }
  }
  return candidates[0]
}

function resolvePageTarget(
  rawPath: string,
  fragment: string | undefined,
  source: IndexedPage,
  indexes: PageIndexes,
): Resolution {
  if (rawPath.length === 0) {
    return resolvePageFragment(source, fragment)
  }

  const normalized = normalizedPathTarget(rawPath, source.file)
  if ("kind" in normalized) {
    return normalized
  }

  const decodedRootKey = canonicalKey(decodeTarget(rawPath) ?? rawPath)
  const basenameKey = canonicalKey(posix.basename(normalized.path))
  const lookups: Array<IndexedPage[] | undefined> = [
    indexes.files.get(normalized.key),
    indexes.files.get(decodedRootKey),
    indexes.permalinks.get(decodedRootKey),
    indexes.aliases.get(decodedRootKey),
  ]
  if (!rawPath.includes("/")) {
    lookups.push(indexes.basenames.get(basenameKey))
  }

  for (const candidates of lookups) {
    const selected = selectIndexed(candidates, rawPath)
    if (selected && "kind" in selected) {
      return selected
    }
    if (selected) {
      return resolvePageFragment(selected, fragment)
    }
  }

  return {
    kind: "error",
    code: "BROKEN_INTERNAL_LINK",
    message: `找不到内部页面: ${rawPath}`,
  }
}

function resolvePageFragment(page: IndexedPage, fragment: string | undefined): Resolution {
  if (fragment === undefined || fragment.length === 0) {
    return { kind: "resolved", target: page.file }
  }
  if (fragment.startsWith("^")) {
    return {
      kind: "error",
      code: "UNSUPPORTED_FRAGMENT",
      message: `v1 不支持 block reference: #${fragment}`,
    }
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(fragment)
  } catch {
    return {
      kind: "error",
      code: "INVALID_INTERNAL_TARGET",
      message: `fragment URI 编码无效: #${fragment}`,
    }
  }
  const slug = new Slugger().slug(decoded)
  if (!page.headings.has(slug)) {
    return {
      kind: "error",
      code: "BROKEN_FRAGMENT",
      message: `目标页不存在 heading fragment: #${slug}`,
    }
  }
  return { kind: "resolved", target: `${page.file}#${slug}` }
}

function validateSvg(path: string, displayPath: string): Resolution | undefined {
  const source = readFileSync(path, "utf8")
  if (/<!DOCTYPE\b/iu.test(source)) {
    return {
      kind: "error",
      code: "INVALID_SVG_ASSET",
      message: `SVG 不得包含 DOCTYPE: ${displayPath}`,
    }
  }

  let parseError = false
  const document = new DOMParser({
    errorHandler: {
      warning: () => {
        parseError = true
      },
      error: () => {
        parseError = true
      },
      fatalError: () => {
        parseError = true
      },
    },
  }).parseFromString(source, "image/svg+xml")
  if (parseError || document.documentElement?.tagName !== "svg") {
    return {
      kind: "error",
      code: "INVALID_SVG_ASSET",
      message: `SVG 无法解析或根元素不是 <svg>: ${displayPath}`,
    }
  }

  const titles = Array.from(document.getElementsByTagName("title"))
  if (!titles.some((title) => (title.textContent ?? "").trim().length > 0)) {
    return {
      kind: "error",
      code: "SVG_MISSING_TITLE",
      message: `SVG 必须包含非空 <title>: ${displayPath}`,
    }
  }

  return undefined
}

function resolveAssetTarget(rawPath: string, source: IndexedPage, contentRoot: string): Resolution {
  const normalized = normalizedPathTarget(rawPath, source.file)
  if ("kind" in normalized) {
    return normalized
  }

  const absolute = resolve(contentRoot, ...normalized.path.split("/"))
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    return {
      kind: "error",
      code: "MISSING_LOCAL_ASSET",
      message: `找不到本地附件: ${normalized.path}`,
    }
  }

  if (posix.extname(normalized.path).toLocaleLowerCase("en-US") === ".svg") {
    const svgError = validateSvg(absolute, normalized.path)
    if (svgError) {
      return svgError
    }
  }

  return { kind: "resolved", target: normalized.path }
}

function resolveOne(
  raw: string,
  source: IndexedPage,
  indexes: PageIndexes,
  contentRoot: string,
): Resolution {
  const trimmed = raw.trim().replace(/^<|>$/g, "")
  const targetWithFragment = trimmed.split("|", 1)[0].trim()
  if (isExternalTarget(targetWithFragment)) {
    return { kind: "external" }
  }

  const fragmentIndex = targetWithFragment.indexOf("#")
  const rawPath =
    fragmentIndex === -1 ? targetWithFragment : targetWithFragment.slice(0, fragmentIndex)
  const fragment = fragmentIndex === -1 ? undefined : targetWithFragment.slice(fragmentIndex + 1)
  const extension = posix.extname(rawPath).toLocaleLowerCase("en-US")
  const isPage = extension.length === 0 || extension === ".md"

  if (isPage) {
    return resolvePageTarget(rawPath, fragment, source, indexes)
  }

  return resolveAssetTarget(rawPath, source, contentRoot)
}

function analyzeLinks(pages: PageRecord[], contentRoot: string): Analysis {
  const indexes = buildIndexes(pages, contentRoot)
  const resolved: ResolvedLink[] = []
  const diagnostics: Diagnostic[] = []

  for (const page of pages) {
    const sourceFile = contentRelativeFile(page.file, contentRoot)
    const source = indexes.files.get(canonicalKey(sourceFile))?.[0]
    if (!source) {
      continue
    }

    for (const raw of [...page.links, ...page.embeds]) {
      const result = resolveOne(raw, source, indexes, contentRoot)
      if (result.kind === "resolved") {
        resolved.push({ source: sourceFile, target: result.target, raw })
      } else if (result.kind === "error") {
        diagnostics.push({
          severity: "error",
          code: result.code,
          file: sourceFile,
          message: result.message,
        })
      }
    }
  }

  diagnostics.sort((left, right) =>
    left.file === right.file
      ? left.code === right.code
        ? left.message.localeCompare(right.message, "zh-CN")
        : left.code.localeCompare(right.code, "en-US")
      : left.file.localeCompare(right.file, "zh-CN"),
  )
  return { resolved, diagnostics }
}

export function resolveInternalLinks(pages: PageRecord[], contentRoot: string): ResolvedLink[] {
  return analyzeLinks(pages, contentRoot).resolved
}

export function validateLinks(pages: PageRecord[], contentRoot: string): Diagnostic[] {
  return analyzeLinks(pages, contentRoot).diagnostics
}
