import type { Root, RootContent, FootnoteDefinition, Link } from "mdast"
import { toString } from "mdast-util-to-string"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import type { PageRecord } from "./parsePage"
import type { Diagnostic, Manifest } from "./types"

interface SourceRecord {
  url: string
  title: string
  publisher: string
  accessDate: string
}

export interface SourceAudit {
  diagnostics: Diagnostic[]
  sources: Array<SourceRecord & { citedBy: string[] }>
}

const parse = (body: string): Root => unified().use(remarkParse).use(remarkGfm).parse(body)
const identifier = (id: string) => id.trim().replace(/\s+/gu, " ").toLowerCase()
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function error(code: string, file: string, message: string): Diagnostic {
  return { severity: "error", code, file, message }
}

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split("-").map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}

// URL parses syntax, but its reserialization must not merge case/encoding/query identities.
function normalizeUrl(value: string): string | undefined {
  const raw = value.trim()
  try {
    const parsed = new URL(raw)
    if (!["http:", "https:"].includes(parsed.protocol) || !/^https?:\/\//i.test(raw)) return
    const match = /^(https?:\/\/[^/?#]+)([^?#]*)([?#].*)?$/i.exec(raw)
    if (!match) return
    return match[1] + match[2].replace(/\/$/, "") + (match[3] ?? "")
  } catch {
    return undefined
  }
}

type AstNode = Root | RootContent | FootnoteDefinition | Link

function walk(node: AstNode, action: (node: AstNode) => void): void {
  action(node)
  if ("children" in node) for (const child of node.children) walk(child as AstNode, action)
}

interface Footnotes {
  definitions: FootnoteDefinition[]
  references: string[]
}

function footnotes(body: string, tree: Root): Footnotes {
  const definitions: FootnoteDefinition[] = []
  const references: string[] = []
  function inspect(node: AstNode): void {
    if (node.type === "footnoteDefinition") {
      definitions.push(node)
      return
    }
    if (node.type === "code" || node.type === "inlineCode") return
    if (node.type === "footnoteReference") references.push(identifier(node.identifier))
    if (node.type === "text") {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start !== undefined && end !== undefined) {
        const source = body.slice(start, end)
        for (const match of source.matchAll(/\[\^([^\]\r\n]+)\]/g)) {
          let backslashes = 0
          for (let i = start + match.index - 1; i >= 0 && body[i] === "\\"; i--) backslashes++
          if (backslashes % 2 === 0) references.push(identifier(match[1]))
        }
      }
    }
    if ("children" in node) for (const child of node.children) inspect(child as AstNode)
  }
  inspect(tree)
  return { definitions, references }
}

function bibliography(
  node: AstNode,
  file: string,
  catalog: boolean,
  diagnostics: Diagnostic[],
): SourceRecord | undefined {
  const links: Link[] = []
  walk(node, (child) => {
    if (child.type === "link") links.push(child)
  })
  const malformedCode = catalog ? "MALFORMED_CATALOG_ENTRY" : "MALFORMED_SOURCE_DEFINITION"
  if (links.length !== 1) {
    diagnostics.push(
      error(malformedCode, file, "Bibliographic record requires exactly one titled source link."),
    )
    return
  }
  const link = links[0]
  const title = toString(link).trim()
  let before = ""
  let after = ""
  let foundLink = false
  function surrounding(child: AstNode): void {
    if (child === link) {
      foundLink = true
      return
    }
    if ("children" in child) for (const nested of child.children) surrounding(nested as AstNode)
    else if (foundLink) after += toString(child)
    else before += toString(child)
  }
  surrounding(node)
  const suffix = /^\s+—\s+(.+?)；访问日期：([^\s。]+)(。?)$/u.exec(after.trimEnd())
  const prefix = catalog ? null : /^(.+?)，\s*$/u.exec(before.trim())
  const historicDate = prefix && /^，\s*访问日期：([^\s。]+)(。?)$/u.exec(after.trim())
  const publisher =
    !before.trim() && suffix ? suffix[1].trim() : prefix && historicDate ? prefix[1].trim() : ""
  const accessDate = suffix?.[2] ?? historicDate?.[1] ?? ""
  if (!title || !publisher || !accessDate || (catalog && suffix?.[3])) {
    diagnostics.push(
      error(
        malformedCode,
        file,
        "Expected a titled source link, attribution and access date; catalog requires title link — publisher；访问日期：YYYY-MM-DD.",
      ),
    )
    return
  }
  const url = normalizeUrl(link.url)
  if (!url)
    diagnostics.push(error("INVALID_SOURCE_URL", file, `Invalid HTTP(S) source URL: ${link.url}`))
  if (!validDate(accessDate))
    diagnostics.push(
      error("INVALID_ACCESS_DATE", file, `Invalid Gregorian access date: ${accessDate}`),
    )
  if (!url || !validDate(accessDate)) return
  return { url, title, publisher, accessDate }
}

function catalogRecords(page: PageRecord, diagnostics: Diagnostic[]): SourceRecord[] {
  const records: SourceRecord[] = []
  let sourceSection = false
  let category = false
  for (const node of parse(page.body).children) {
    if (node.type === "heading") {
      if (node.depth <= 2) {
        sourceSection = node.depth === 2 && toString(node).trim() === "有序链接"
        category = false
      } else if (sourceSection) category = true
    } else if (sourceSection && category && node.type === "list" && !node.ordered) {
      for (const item of node.children) {
        const start = item.position?.start.offset
        const end = item.position?.end.offset
        const raw = start !== undefined && end !== undefined ? page.body.slice(start, end) : ""
        if (
          !raw.startsWith("- [") ||
          item.children.length !== 1 ||
          item.children[0].type !== "paragraph"
        ) {
          diagnostics.push(
            error(
              "MALFORMED_CATALOG_ENTRY",
              page.contentPath!,
              "Catalog row must be one - [title](URL) bibliographic paragraph.",
            ),
          )
          continue
        }
        const record = bibliography(item, page.contentPath!, true, diagnostics)
        if (record) records.push(record)
      }
    }
  }
  return records
}

export function auditSources(pages: PageRecord[], manifest: Manifest): SourceAudit {
  const diagnostics: Diagnostic[] = []
  const entries = new Map(manifest.pages.map((entry) => [entry.file, entry]))
  const publication = new Map<string, PageRecord>()
  for (const page of pages) {
    const file = page.contentPath ?? ""
    if (!entries.has(file))
      diagnostics.push(
        error(
          "SOURCE_PAGE_NOT_IN_MANIFEST",
          file,
          "Page requires a canonical manifest contentPath.",
        ),
      )
    else if (publication.has(file))
      diagnostics.push(error("DUPLICATE_SOURCE_PAGE", file, "Duplicate published page record."))
    else publication.set(file, page)
  }
  for (const entry of manifest.pages)
    if (!publication.has(entry.file))
      diagnostics.push(
        error("SOURCE_PAGE_MISSING", entry.file, "Manifest publication page is missing."),
      )
  const catalogEntries = manifest.pages.filter((entry) => entry.id === "sources")
  const catalog = catalogEntries.length === 1 ? publication.get(catalogEntries[0].file) : undefined
  if (!catalog)
    diagnostics.push(
      error(
        "SOURCE_CATALOG_MISSING",
        catalogEntries[0]?.file ?? "",
        "One manifest sources catalog and its page are required.",
      ),
    )
  const catalogMap = new Map<string, SourceRecord>()
  if (catalog)
    for (const record of catalogRecords(catalog, diagnostics)) {
      const existing = catalogMap.get(record.url)
      if (
        existing &&
        (existing.title !== record.title ||
          existing.publisher !== record.publisher ||
          existing.accessDate !== record.accessDate)
      ) {
        diagnostics.push(
          error(
            "CONFLICTING_CATALOG_METADATA",
            catalog.contentPath!,
            `Conflicting catalog metadata for ${record.url}`,
          ),
        )
      } else catalogMap.set(record.url, record)
    }
  const citations = new Map<string, { pages: Set<string>; newest: string }>()
  for (const [file, page] of [...publication].sort(([a], [b]) => compare(a, b))) {
    if (page === catalog) continue
    const { definitions, references } = footnotes(page.body, parse(page.body))
    const referenceIds = new Set(references)
    const byId = new Map<string, FootnoteDefinition[]>()
    for (const definition of definitions) {
      const id = identifier(definition.identifier)
      byId.set(id, [...(byId.get(id) ?? []), definition])
    }
    for (const id of referenceIds)
      if (!byId.has(id))
        diagnostics.push(
          error("FOOTNOTE_DEFINITION_MISSING", file, `Undefined source footnote: ${id}`),
        )
    let resolved = 0
    for (const [id, definitions] of byId) {
      if (definitions.length > 1)
        diagnostics.push(
          error("DUPLICATE_FOOTNOTE_DEFINITION", file, `Duplicate source footnote: ${id}`),
        )
      if (!referenceIds.has(id))
        diagnostics.push(
          error("ORPHAN_FOOTNOTE_DEFINITION", file, `Uncited source footnote: ${id}`),
        )
      for (const definition of definitions) {
        const record = bibliography(definition, file, false, diagnostics)
        if (!record || definitions.length !== 1 || !referenceIds.has(id)) continue
        resolved++
        const citation = citations.get(record.url) ?? {
          pages: new Set<string>(),
          newest: record.accessDate,
        }
        citation.pages.add(file)
        if (record.accessDate > citation.newest) citation.newest = record.accessDate
        citations.set(record.url, citation)
      }
    }
    if (entries.get(file)!.type === "lesson" && !resolved)
      diagnostics.push(
        error(
          "LESSON_SOURCE_REQUIRED",
          file,
          "Lesson requires a successfully resolved source footnote.",
        ),
      )
  }
  for (const [url, citation] of citations) {
    const record = catalogMap.get(url)
    if (!record)
      for (const file of citation.pages)
        diagnostics.push(
          error("SOURCE_NOT_IN_CATALOG", file, `Cited source is missing from catalog: ${url}`),
        )
    else if (record.accessDate !== citation.newest)
      diagnostics.push(
        error(
          "STALE_CATALOG_ACCESS_DATE",
          catalog!.contentPath!,
          `Catalog date for ${url} must match newest actual citation ${citation.newest}.`,
        ),
      )
  }
  for (const url of catalogMap.keys())
    if (!citations.has(url))
      diagnostics.push(
        error(
          "UNCITED_CATALOG_ENTRY",
          catalog!.contentPath!,
          `Catalog source has no published citation: ${url}`,
        ),
      )
  return {
    diagnostics: diagnostics.sort(
      (a, b) => compare(a.file, b.file) || compare(a.code, b.code) || compare(a.message, b.message),
    ),
    sources: [...catalogMap.values()]
      .sort((a, b) => compare(a.url, b.url))
      .map((record) => ({
        ...record,
        citedBy: [...(citations.get(record.url)?.pages ?? [])].sort(compare),
      })),
  }
}

export function markdownCell(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\|/g, "&#124;")
    .replace(/[\r\n]+/g, " ")
    .replace(/`/g, "&#96;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/\\/g, "&#92;")
}

export function renderSourceAudit(
  pages: PageRecord[],
  manifest: Manifest,
  audit: SourceAudit,
): string {
  const catalogPath = manifest.pages.find((entry) => entry.id === "sources")?.file
  let definitions = 0
  let references = 0
  let definitionIds = 0
  for (const page of pages)
    if (page.contentPath !== catalogPath) {
      const notes = footnotes(page.body, parse(page.body))
      definitions += notes.definitions.length
      references += notes.references.length
      definitionIds += new Set(notes.definitions.map((node) => identifier(node.identifier))).size
    }
  const lines = [
    "# Source audit",
    "",
    "Deterministic offline structural audit. Citation/catalog integrity is not factual source verification or network availability.",
    "",
    `Published pages: ${pages.length}`,
    `Unique cited sources: ${audit.sources.filter((source) => source.citedBy.length).length}`,
    `Catalog sources: ${audit.sources.length}`,
    `Footnote reference occurrences: ${references}`,
    `Footnote definitions: ${definitions}`,
    `Page-local unique definition IDs: ${definitionIds}`,
    `Structural errors: ${audit.diagnostics.filter((d) => d.severity === "error").length}`,
    "",
    "## Sources",
    "",
    "<!-- prettier-ignore -->",
    "| URL | Title | Publisher / author | Access date | Cited by |",
    "| --- | --- | --- | --- | --- |",
  ]
  for (const source of audit.sources)
    lines.push(
      `| ${[source.url, source.title, source.publisher, source.accessDate, source.citedBy.join("; ")].map(markdownCell).join(" | ")} |`,
    )
  lines.push(
    "",
    "## Diagnostics",
    "",
    "<!-- prettier-ignore -->",
    "| Severity | Code | Page | Finding |",
    "| --- | --- | --- | --- |",
  )
  for (const d of [...audit.diagnostics].sort(
    (a, b) => compare(a.file, b.file) || compare(a.code, b.code) || compare(a.message, b.message),
  ))
    lines.push(`| ${[d.severity, d.code, d.file, d.message].map(markdownCell).join(" | ")} |`)
  if (!audit.diagnostics.length) lines.push("| — | — | — | None |")
  return lines.join("\n") + "\n"
}
