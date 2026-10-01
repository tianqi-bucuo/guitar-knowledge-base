import { accessSync, constants, lstatSync, readFileSync, realpathSync, statSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { posix } from "node:path"
import { DOMParser } from "@xmldom/xmldom"
import Slugger from "github-slugger"
import type { LinkTarget, LinkTargetKind, PageRecord } from "./parsePage"
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

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/"
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"
const ALLOWED_SVG_ELEMENTS = new Set([
  "svg",
  "title",
  "desc",
  "g",
  "defs",
  "use",
  "rect",
  "line",
  "circle",
  "text",
])
const ALLOWED_SVG_ATTRIBUTES = new Set([
  "role",
  "aria-labelledby",
  "id",
  "width",
  "height",
  "viewBox",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "textLength",
  "lengthAdjust",
  "href",
])
const XML_DECLARATION_DATA =
  /^version[\t\n\r ]*=[\t\n\r ]*(?:"1\.[01]"|'1\.[01]')(?:[\t\n\r ]+encoding[\t\n\r ]*=[\t\n\r ]*(?:"([A-Za-z][A-Za-z0-9._-]*)"|'([A-Za-z][A-Za-z0-9._-]*)'))?(?:[\t\n\r ]+standalone[\t\n\r ]*=[\t\n\r ]*(?:"(?:yes|no)"|'(?:yes|no)'))?$/u
const UTF8_ENCODING = /^UTF-8$/iu

function deduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...new Map(diagnostics.map((item) => [JSON.stringify(item), item])).values()]
}

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

function isInside(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
}

function fileSystemError(path: string, error: unknown): Resolution {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined
  if (code === "ENOENT" || code === "ELOOP") {
    return {
      kind: "error",
      code: "MISSING_LOCAL_ASSET",
      message: `找不到本地附件: ${path}`,
    }
  }
  return {
    kind: "error",
    code: "INVALID_LOCAL_ASSET",
    message: `无法检查本地附件: ${path}`,
  }
}

function containsUnsafeCssUrl(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x1f || code === 0x7f || character === "\\") {
      return true
    }
  }

  const lower = value.toLocaleLowerCase("en-US")
  let cursor = 0
  while (cursor < lower.length) {
    const start = lower.indexOf("url", cursor)
    if (start === -1) {
      return false
    }
    const previous = start === 0 ? "" : lower[start - 1]
    if (previous !== "" && /[a-z0-9_-]/u.test(previous)) {
      cursor = start + 3
      continue
    }

    let opening = start + 3
    while (opening < lower.length && /[ \t\n\r\f]/u.test(lower[opening])) {
      opening += 1
    }
    if (lower[opening] !== "(") {
      cursor = start + 3
      continue
    }

    const closing = lower.indexOf(")", opening + 1)
    if (closing === -1) {
      return true
    }
    let reference = value.slice(opening + 1, closing).trim()
    if (
      reference.length >= 2 &&
      (reference[0] === '"' || reference[0] === "'") &&
      reference.at(-1) === reference[0]
    ) {
      reference = reference.slice(1, -1).trim()
    }
    if (
      !reference.startsWith("#") ||
      reference.length === 1 ||
      [...reference].some((character) => /[\s"'()\\]/u.test(character))
    ) {
      return true
    }
    cursor = closing + 1
  }

  return false
}

function isAllowedSvgAttribute(attribute: {
  name: string
  namespaceURI?: string | null
  value: string
}): boolean {
  if (attribute.name === "xmlns") {
    return attribute.namespaceURI === XMLNS_NAMESPACE && attribute.value === SVG_NAMESPACE
  }
  if (attribute.name === "xmlns:xlink") {
    return attribute.namespaceURI === XMLNS_NAMESPACE && attribute.value === XLINK_NAMESPACE
  }
  if (attribute.name === "xlink:href") {
    return attribute.namespaceURI === XLINK_NAMESPACE
  }
  if (attribute.name.startsWith("data-") && attribute.name.length > "data-".length) {
    return attribute.namespaceURI == null
  }
  return ALLOWED_SVG_ATTRIBUTES.has(attribute.name) && attribute.namespaceURI == null
}

function decodeUtf8Svg(bytes: Uint8Array): string | undefined {
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      hasBom ? bytes.subarray(3) : bytes,
    )
  } catch {
    return undefined
  }
}

function isValidXmlDeclaration(node: Node, document: Document): boolean {
  const declaration = XML_DECLARATION_DATA.exec(node.nodeValue ?? "")
  const encoding = declaration?.[1] ?? declaration?.[2]
  return (
    node.parentNode?.nodeType === 9 &&
    document.childNodes.item(0) === node &&
    node.nodeName === "xml" &&
    declaration !== null &&
    (encoding === undefined || UTF8_ENCODING.test(encoding))
  )
}

function hasForbiddenProcessingInstruction(document: Document): boolean {
  const nodes = [
    ...Array.from(document.childNodes ?? []),
    ...Array.from(document.getElementsByTagName("*")).flatMap((element) =>
      Array.from(element.childNodes ?? []),
    ),
  ]
  const processingInstructions = nodes.filter((node) => node.nodeType === 7)
  return (
    processingInstructions.length > 0 &&
    (processingInstructions.length !== 1 ||
      !isValidXmlDeclaration(processingInstructions[0], document))
  )
}

function contentRelativeFile(page: PageRecord, contentRoot: string): string {
  if (page.contentPath !== undefined) {
    return posix.normalize(page.contentPath)
  }

  const pageFile = page.file
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
    const file = contentRelativeFile(page, contentRoot)
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
  decoded: string,
  sourceFile: string,
): { path: string; key: string } | Resolution {
  if (decoded.includes("?") || decoded.includes("\\") || decoded.includes("\0")) {
    return {
      kind: "error",
      code: "INVALID_INTERNAL_TARGET",
      message: `内部目标不允许 query、反斜线或 NUL: ${decoded}`,
    }
  }

  const fromRoot = decoded.startsWith("/")
  const withoutRoot = decoded.replace(/^\/+/, "")
  const base = fromRoot ? "" : posix.dirname(sourceFile)
  const path = posix.normalize(posix.join(base, withoutRoot))
  if (path === ".." || path.startsWith("../")) {
    return {
      kind: "error",
      code: "PATH_TRAVERSAL_TARGET",
      message: `内部目标越出 content root: ${decoded}`,
    }
  }

  return { path, key: canonicalKey(path) }
}

function selectAcrossIndexes(
  lookups: Array<IndexedPage[] | undefined>,
  raw: string,
): IndexedPage | Resolution | undefined {
  const candidates = new Map<string, IndexedPage>()
  for (const entries of lookups) {
    for (const entry of entries ?? []) {
      candidates.set(entry.file, entry)
    }
  }

  if (candidates.size === 0) {
    return undefined
  }
  if (candidates.size > 1) {
    return {
      kind: "error",
      code: "AMBIGUOUS_INTERNAL_LINK",
      message: `内部目标对应多个页面: ${raw}`,
    }
  }
  return candidates.values().next().value
}

function resolvePageTarget(
  rawPath: string,
  fragment: string | undefined,
  source: IndexedPage,
  indexes: PageIndexes,
  kind: LinkTargetKind,
): Resolution {
  if (rawPath.length === 0) {
    return resolvePageFragment(source, fragment)
  }

  const normalized = normalizedPathTarget(rawPath, source.file)
  if ("kind" in normalized) {
    return normalized
  }

  const decodedRootKey = canonicalKey(rawPath)
  const basenameKey = canonicalKey(posix.basename(normalized.path))
  const isMarkdown = kind === "markdown-link" || kind === "markdown-image"
  const lookups: Array<IndexedPage[] | undefined> = [indexes.files.get(normalized.key)]
  if (isMarkdown) {
    if (rawPath.startsWith("/")) {
      lookups.push(indexes.permalinks.get(decodedRootKey))
    }
  } else {
    lookups.push(
      indexes.files.get(decodedRootKey),
      indexes.permalinks.get(decodedRootKey),
      indexes.aliases.get(decodedRootKey),
    )
    if (!rawPath.includes("/")) {
      lookups.push(indexes.basenames.get(basenameKey))
    }
  }

  const selected = selectAcrossIndexes(lookups, rawPath)
  if (selected && "kind" in selected) {
    return selected
  }
  if (selected) {
    return resolvePageFragment(selected, fragment)
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
  const invalid = (message: string): Resolution => ({
    kind: "error",
    code: "INVALID_SVG_ASSET",
    message: `${message}: ${displayPath}`,
  })
  let bytes: Uint8Array
  try {
    bytes = readFileSync(path)
  } catch {
    return invalid("SVG 无法读取")
  }
  const source = decodeUtf8Svg(bytes)
  if (source === undefined) {
    return invalid("SVG 必须使用有效 UTF-8 编码")
  }
  if (/<!DOCTYPE\b/iu.test(source)) {
    return invalid("SVG 不得包含 DOCTYPE")
  }

  let parseError = false
  let document
  try {
    document = new DOMParser({
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
  } catch {
    return invalid("SVG 无法解析")
  }
  const root = document.documentElement
  if (
    parseError ||
    root?.localName !== "svg" ||
    root.namespaceURI !== SVG_NAMESPACE ||
    hasForbiddenProcessingInstruction(document)
  ) {
    return invalid("SVG 无法解析或根元素不是 <svg>")
  }

  for (const element of Array.from(document.getElementsByTagName("*"))) {
    const elementName = element.localName || element.tagName
    if (element.namespaceURI !== SVG_NAMESPACE) {
      return invalid(`SVG 元素必须使用 SVG namespace <${element.tagName}>`)
    }
    if (!ALLOWED_SVG_ELEMENTS.has(elementName)) {
      return invalid(`SVG 不得包含 <${elementName}>`)
    }
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = (attribute.localName || attribute.name).toLocaleLowerCase("en-US")
      const qualifiedName = attribute.name.toLocaleLowerCase("en-US")
      if (attributeName.startsWith("on") || qualifiedName.startsWith("on")) {
        return invalid(`SVG 不得包含事件属性 ${attribute.name}`)
      }
      if (attributeName === "style" || qualifiedName === "style") {
        return invalid("SVG 不得包含 style 属性")
      }
      if (!isAllowedSvgAttribute(attribute)) {
        return invalid(`SVG 不得包含未允许的属性 ${attribute.name}`)
      }
      if (attributeName === "href" || qualifiedName === "xlink:href") {
        const reference = attribute.value.trim()
        if (!reference.startsWith("#") || reference.length === 1) {
          return invalid(`SVG 引用必须是非空本地 fragment ${attribute.name}`)
        }
      }
      if (containsUnsafeCssUrl(attribute.value)) {
        return invalid(`SVG 属性只允许非空本地 fragment URL ${attribute.name}`)
      }
    }
  }

  const titles = Array.from(document.getElementsByTagNameNS(SVG_NAMESPACE, "title"))
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
  let entryStats
  try {
    entryStats = lstatSync(absolute, { throwIfNoEntry: false })
  } catch (error) {
    return fileSystemError(normalized.path, error)
  }
  if (entryStats === undefined) {
    return {
      kind: "error",
      code: "MISSING_LOCAL_ASSET",
      message: `找不到本地附件: ${normalized.path}`,
    }
  }

  let realRoot: string
  let realAsset: string
  try {
    realRoot = realpathSync(resolve(contentRoot))
    realAsset = realpathSync(absolute)
  } catch (error) {
    return fileSystemError(normalized.path, error)
  }
  if (!isInside(realRoot, realAsset)) {
    return {
      kind: "error",
      code: "PATH_TRAVERSAL_TARGET",
      message: `本地附件 realpath 越出 content root: ${normalized.path}`,
    }
  }

  try {
    if (!statSync(realAsset).isFile()) {
      return {
        kind: "error",
        code: "INVALID_LOCAL_ASSET",
        message: `本地附件不是普通文件: ${normalized.path}`,
      }
    }
    accessSync(realAsset, constants.R_OK)
  } catch (error) {
    return fileSystemError(normalized.path, error)
  }

  if (posix.extname(normalized.path).toLocaleLowerCase("en-US") === ".svg") {
    let svgError: Resolution | undefined
    try {
      svgError = validateSvg(realAsset, normalized.path)
    } catch (error) {
      return fileSystemError(normalized.path, error)
    }
    if (svgError) {
      return svgError
    }
  }

  return { kind: "resolved", target: normalized.path }
}

function resolveOne(
  raw: string,
  targetKind: LinkTargetKind,
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
  const decodedPath = decodeTarget(rawPath)
  if (decodedPath === undefined) {
    return { kind: "error", code: "INVALID_INTERNAL_TARGET", message: `URI 编码无效: ${rawPath}` }
  }
  if (decodedPath.includes("?") || decodedPath.includes("\\") || decodedPath.includes("\0")) {
    return {
      kind: "error",
      code: "INVALID_INTERNAL_TARGET",
      message: `内部目标不允许 query、反斜线或 NUL: ${rawPath}`,
    }
  }
  if (targetKind === "markdown-image") {
    return resolveAssetTarget(decodedPath, source, contentRoot)
  }

  const extension = posix.extname(decodedPath).toLocaleLowerCase("en-US")
  const isPage = extension.length === 0 || extension === ".md"

  if (isPage) {
    return resolvePageTarget(decodedPath, fragment, source, indexes, targetKind)
  }

  return resolveAssetTarget(decodedPath, source, contentRoot)
}

function analyzeLinks(pages: PageRecord[], contentRoot: string): Analysis {
  const indexes = buildIndexes(pages, contentRoot)
  const resolved: ResolvedLink[] = []
  const diagnostics: Diagnostic[] = []

  for (const page of pages) {
    const sourceFile = contentRelativeFile(page, contentRoot)
    const source = indexes.files.get(canonicalKey(sourceFile))?.[0]
    if (!source) {
      continue
    }

    const linkTargets: LinkTarget[] = page.linkTargets ?? [
      ...page.links.map((raw) => ({ raw, kind: "wikilink" as const })),
      ...page.embeds.map((raw) => ({ raw, kind: "wiki-embed" as const })),
    ]
    for (const { raw, kind } of linkTargets) {
      const result = resolveOne(raw, kind, source, indexes, contentRoot)
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

  const uniqueDiagnostics = deduplicateDiagnostics(diagnostics)
  uniqueDiagnostics.sort((left, right) =>
    left.file === right.file
      ? left.code === right.code
        ? left.message.localeCompare(right.message, "zh-CN")
        : left.code.localeCompare(right.code, "en-US")
      : left.file.localeCompare(right.file, "zh-CN"),
  )
  return { resolved, diagnostics: uniqueDiagnostics }
}

export function resolveInternalLinks(pages: PageRecord[], contentRoot: string): ResolvedLink[] {
  return analyzeLinks(pages, contentRoot).resolved
}

export function validateLinks(pages: PageRecord[], contentRoot: string): Diagnostic[] {
  return analyzeLinks(pages, contentRoot).diagnostics
}
