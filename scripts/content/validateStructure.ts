import { toString } from "mdast-util-to-string"
import type { Heading, Root, RootContent } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { SKIP, visit } from "unist-util-visit"
import type { PageRecord } from "./parsePage"
import { PAGE_TYPES, REQUIRED_SECTIONS, type Diagnostic, type PageType } from "./types"

const PLACEHOLDER_PATTERN = /(?:^|[^\p{L}\p{N}_])(?:TODO|TBD|XXX)(?=$|[^\p{L}\p{N}_])/iu
const FILL_MARKER_PATTERN = /<!--\s*fill\s*-->/iu

function deduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...new Map(diagnostics.map((item) => [JSON.stringify(item), item])).values()]
}

function addDiagnostic(
  diagnostics: Diagnostic[],
  page: PageRecord,
  code: string,
  message: string,
): void {
  diagnostics.push({ severity: "error", code, file: page.file, message })
}

function isPageType(value: unknown): value is PageType {
  return typeof value === "string" && (PAGE_TYPES as readonly string[]).includes(value)
}

interface RequiredSection {
  heading: Heading
  content: RootContent[]
}

function findRequiredSection(tree: Root, name: string): RequiredSection | undefined {
  const children = tree.children

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]
    if (node.type !== "heading" || toString(node).trim() !== name) {
      continue
    }

    const content: RootContent[] = []
    for (let cursor = index + 1; cursor < children.length; cursor += 1) {
      const candidate = children[cursor]
      if (candidate.type === "heading" && candidate.depth <= node.depth) {
        break
      }
      content.push(candidate)
    }

    return { heading: node, content }
  }

  return undefined
}

function hasMeaningfulContent(nodes: RootContent[]): boolean {
  return nodes.some((node) => {
    if (node.type === "paragraph" || node.type === "table") {
      return toString(node).trim().length > 0
    }
    if (node.type === "code") {
      return node.value.trim().length > 0
    }
    if (node.type === "list") {
      return node.children.some((item) => toString(item).trim().length > 0)
    }
    if (node.type === "blockquote") {
      return hasMeaningfulContent(node.children)
    }
    return false
  })
}

function hasNonEmptyOrderedLinks(section: RequiredSection | undefined): boolean {
  return (
    section?.content.some(
      (node) =>
        node.type === "list" &&
        node.ordered === true &&
        node.children.some((item) => toString(item).trim().length > 0),
    ) ?? false
  )
}

function validatePlaceholders(page: PageRecord, diagnostics: Diagnostic[], tree: Root): void {
  visit(tree, (node) => {
    if (node.type === "blockquote") {
      return SKIP
    }
    if (node.type === "heading" && toString(node).trim().length === 0) {
      addDiagnostic(diagnostics, page, "PLACEHOLDER_TEXT", "存在空标题")
    } else if (node.type === "html" && FILL_MARKER_PATTERN.test(node.value)) {
      addDiagnostic(diagnostics, page, "PLACEHOLDER_TEXT", "存在未填写的 HTML 模板标记")
    } else if (node.type === "text" && PLACEHOLDER_PATTERN.test(node.value)) {
      addDiagnostic(diagnostics, page, "PLACEHOLDER_TEXT", "存在独立的 TODO、TBD 或 XXX 占位文本")
    }
  })
}

export function validateStructure(pages: PageRecord[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const page of pages) {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(page.body)
    const pageType = page.frontmatter.type
    if (isPageType(pageType)) {
      for (const required of REQUIRED_SECTIONS[pageType]) {
        const section = findRequiredSection(tree, required)
        if (section === undefined) {
          addDiagnostic(
            diagnostics,
            page,
            "MISSING_REQUIRED_SECTION",
            `type: ${pageType} 缺少必需章节“${required}”`,
          )
        } else if (!hasMeaningfulContent(section.content)) {
          addDiagnostic(
            diagnostics,
            page,
            "EMPTY_REQUIRED_SECTION",
            `type: ${pageType} 必需章节“${required}”没有有效内容`,
          )
        }
      }

      if (
        (pageType === "path" || pageType === "index") &&
        !hasNonEmptyOrderedLinks(findRequiredSection(tree, "有序链接"))
      ) {
        addDiagnostic(
          diagnostics,
          page,
          "MISSING_REQUIRED_SECTION",
          "有序链接章节必须包含非空有序列表",
        )
      }
    }

    validatePlaceholders(page, diagnostics, tree)
  }

  return deduplicateDiagnostics(diagnostics).sort((left, right) =>
    left.file === right.file
      ? left.code === right.code
        ? left.message.localeCompare(right.message, "zh-CN")
        : left.code.localeCompare(right.code, "en-US")
      : left.file.localeCompare(right.file, "zh-CN"),
  )
}
