import { readFileSync } from "node:fs"
import matter from "gray-matter"
import { toString } from "mdast-util-to-string"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import toml from "toml"
import { unified } from "unified"
import { visit } from "unist-util-visit"

export type LinkTargetKind = "markdown-link" | "wikilink" | "markdown-image" | "wiki-embed"

export interface LinkTarget {
  raw: string
  kind: LinkTargetKind
}

export interface PageRecord {
  file: string
  contentPath?: string
  body: string
  headings: string[]
  links: string[]
  embeds: string[]
  linkTargets?: LinkTarget[]
  frontmatter: Record<string, unknown>
  hasFrontmatter?: boolean
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue)
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]),
    )
  }

  return value
}

function normalizeCommaSeparatedList(value: unknown): unknown {
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim())
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue)
  }

  return value
}

function normalizeFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
  const frontmatter = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, normalizeValue(value)]),
  )

  for (const field of ["tags", "aliases"]) {
    if (field in frontmatter) {
      frontmatter[field] = normalizeCommaSeparatedList(frontmatter[field])
    }
  }

  return frontmatter
}

function hasFrontmatterDelimiter(source: string): boolean {
  const withoutBom = source.startsWith("\uFEFF") ? source.slice(1) : source
  return withoutBom.startsWith("---") && withoutBom.charAt(3) !== "-"
}

function hasEscapedOpener(source: string, index: number): boolean {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

export function parsePage(path: string): PageRecord {
  const source = readFileSync(path, "utf8")
  const parsed = matter(source, { engines: { toml: toml.parse } })
  const body = parsed.content
  const links: string[] = []
  const embeds: string[] = []
  const linkTargets: LinkTarget[] = []
  const headings: string[] = []
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body)

  visit(tree, (node) => {
    if (node.type === "heading") {
      const heading = toString(node).trim()
      if (heading) {
        headings.push(heading)
      }
    } else if (node.type === "link") {
      const target = node.url.trim()
      links.push(target)
      linkTargets.push({ raw: target, kind: "markdown-link" })
    } else if (node.type === "image") {
      const target = node.url.trim()
      embeds.push(target)
      linkTargets.push({ raw: target, kind: "markdown-image" })
    } else if (node.type === "text") {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      const hasSourceSlice = start !== undefined && end !== undefined
      const text = hasSourceSlice ? body.slice(start, end) : node.value

      for (const match of text.matchAll(/(!)?\[\[([^\]\r\n]+)\]\]/g)) {
        const opener = match.index
        if (hasEscapedOpener(hasSourceSlice ? body : text, (hasSourceSlice ? start : 0) + opener)) {
          continue
        }

        const target = match[2].trim()
        if (match[1] === "!") {
          embeds.push(target)
          linkTargets.push({ raw: target, kind: "wiki-embed" })
        } else {
          links.push(target)
          linkTargets.push({ raw: target, kind: "wikilink" })
        }
      }
    }
  })

  return {
    file: path,
    body,
    headings,
    links,
    embeds,
    linkTargets,
    frontmatter: normalizeFrontmatter(parsed.data),
    hasFrontmatter: hasFrontmatterDelimiter(source),
  }
}
