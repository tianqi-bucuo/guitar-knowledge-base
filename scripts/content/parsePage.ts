import { readFileSync } from "node:fs"
import matter from "gray-matter"
import toml from "toml"

export interface PageRecord {
  file: string
  body: string
  headings: string[]
  links: string[]
  embeds: string[]
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

function withoutFencedCode(body: string): string {
  const lines = body.split(/\r?\n/)
  const visible: string[] = []
  let fence: { marker: "`" | "~"; length: number } | undefined

  for (const line of lines) {
    const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (match && match[1][0] === fence.marker && match[1].length >= fence.length) {
        fence = undefined
      }
      continue
    }

    if (match) {
      fence = { marker: match[1][0] as "`" | "~", length: match[1].length }
      continue
    }

    visible.push(line)
  }

  return visible.join("\n")
}

function withoutInlineCode(text: string): string {
  return text.replace(/`+[^`]*`+/g, "")
}

export function parsePage(path: string): PageRecord {
  const source = readFileSync(path, "utf8")
  const parsed = matter(source, { engines: { toml: toml.parse } })
  const body = parsed.content
  const visibleBody = withoutInlineCode(withoutFencedCode(body))
  const headings = visibleBody
    .split(/\r?\n/)
    .map((line) => /^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/.exec(line)?.[1]?.trim())
    .filter((heading): heading is string => heading !== undefined && heading.length > 0)
  const links: string[] = []
  const embeds: string[] = []

  for (const match of visibleBody.matchAll(/!\[\[([^\]\r\n]+)\]\]/g)) {
    embeds.push(match[1].trim())
  }
  for (const match of visibleBody.matchAll(/(?<!!)\[\[([^\]\r\n]+)\]\]/g)) {
    links.push(match[1].trim())
  }
  for (const match of visibleBody.matchAll(
    /(!)?\[[^\]\r\n]*\]\(\s*(?:<([^>\r\n]*)>|([^\s)\r\n]+))[^)]*\)/g,
  )) {
    const target = (match[2] ?? match[3]).trim()
    if (match[1] === "!") {
      embeds.push(target)
    } else {
      links.push(target)
    }
  }

  return {
    file: path,
    body,
    headings,
    links,
    embeds,
    frontmatter: normalizeFrontmatter(parsed.data),
    hasFrontmatter: /^\uFEFF?\s*---(?:toml)?(?:\r?\n|$)/.test(source),
  }
}
