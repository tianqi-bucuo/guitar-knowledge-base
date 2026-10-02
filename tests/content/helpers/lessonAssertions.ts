import type { Heading, Table } from "mdast"
import { toString } from "mdast-util-to-string"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"

const parser = unified().use(remarkParse).use(remarkGfm)

/** Match rendered heading text, while preserving the original Markdown section. */
export function sectionText(body: string, heading: string): string {
  const tree = parser.parse(body)
  const headings: Heading[] = []
  visit(tree, "heading", (node) => {
    headings.push(node)
  })
  const matches = headings.filter((node) => toString(node) === heading)
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one heading ${JSON.stringify(heading)}, found ${matches.length}`,
    )
  }
  const selected = matches[0]
  const next = headings
    .slice(headings.indexOf(selected) + 1)
    .find((node) => node.depth <= selected.depth)
  return body.slice(selected.position!.end.offset, next?.position?.start.offset)
}

/** Return visible data cells from the one GFM table in a selected section. */
export function tableRows(body: string, heading: string): string[][] {
  const tree = parser.parse(sectionText(body, heading))
  const tables: Table[] = []
  visit(tree, "table", (node) => {
    tables.push(node)
  })
  if (tables.length !== 1) {
    throw new Error(
      `Expected exactly one table under ${JSON.stringify(heading)}, found ${tables.length}`,
    )
  }
  return tables[0].children.slice(1).map((row) => row.children.map((cell) => toString(cell)))
}
