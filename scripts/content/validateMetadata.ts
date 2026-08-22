import { LEVELS, PAGE_TYPES, TAGS, type Diagnostic, type Manifest } from "./types"
import type { PageRecord } from "./parsePage"

const PERMALINK_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*$/

function addDiagnostic(
  diagnostics: Diagnostic[],
  page: PageRecord,
  code: string,
  message: string,
): void {
  diagnostics.push({ severity: "error", code, file: page.file, message })
}

function normalizedString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined
}

function canonicalText(value: string): string {
  return value.toLocaleLowerCase("en-US")
}

function canonicalAlias(value: string): string | undefined {
  const alias = value.trim()
  if (
    alias.length === 0 ||
    alias.includes("?") ||
    alias.includes("#") ||
    alias.includes("\\") ||
    /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(alias)
  ) {
    return undefined
  }

  const withoutEdges = alias.replace(/^\/+|\/+$/g, "")
  if (
    withoutEdges.length === 0 ||
    withoutEdges.split("/").some((segment) => segment === "." || segment === ".." || !segment)
  ) {
    return undefined
  }

  return withoutEdges.replace(/\.md$/i, "").toLocaleLowerCase("en-US")
}

function canonicalPermalink(value: string): string | undefined {
  if (value === "/") {
    return value
  }

  if (
    value.includes("?") ||
    value.includes("#") ||
    value.includes("\\") ||
    value.includes(".md") ||
    value.includes(".html") ||
    !PERMALINK_PATTERN.test(value)
  ) {
    return undefined
  }

  return value
}

function manifestFileFor(page: PageRecord): string {
  return page.file.startsWith("content/") ? page.file.slice("content/".length) : page.file
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  if (left.file !== right.file) {
    return left.file < right.file ? -1 : 1
  }
  if (left.severity !== right.severity) {
    return left.severity === "error" ? -1 : 1
  }
  if (left.code !== right.code) {
    return left.code < right.code ? -1 : 1
  }
  return left.message < right.message ? -1 : left.message > right.message ? 1 : 0
}

export function validateMetadata(pages: PageRecord[], manifest: Manifest): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const titles = new Map<string, PageRecord>()
  const permalinks = new Map<string, PageRecord>()
  const aliases = new Map<string, PageRecord>()
  const knownTags = new Set(TAGS.map(canonicalText))

  for (const page of pages) {
    const { frontmatter } = page
    if (page.hasFrontmatter === false) {
      addDiagnostic(diagnostics, page, "MISSING_FRONTMATTER", "页面必须包含 frontmatter")
    }

    const title = normalizedString(frontmatter.title)
    if (!title) {
      addDiagnostic(diagnostics, page, "MISSING_TITLE", "title 必须是非空字符串")
    } else {
      const key = canonicalText(title)
      if (titles.has(key)) {
        addDiagnostic(diagnostics, page, "DUPLICATE_TITLE", `重复的 title: ${title}`)
      } else {
        titles.set(key, page)
      }
    }

    const description = normalizedString(frontmatter.description)
    if (!description) {
      addDiagnostic(diagnostics, page, "MISSING_DESCRIPTION", "description 必须是非空字符串")
    }

    const permalink = normalizedString(frontmatter.permalink)
    const permalinkKey = permalink ? canonicalPermalink(permalink) : undefined
    if (!permalink) {
      addDiagnostic(diagnostics, page, "MISSING_PERMALINK", "permalink 必须是非空字符串")
    } else if (!permalinkKey) {
      addDiagnostic(
        diagnostics,
        page,
        "INVALID_PERMALINK",
        "permalink 必须是根相对英文 kebab-case 路径",
      )
    } else if (permalinks.has(permalinkKey)) {
      addDiagnostic(diagnostics, page, "DUPLICATE_PERMALINK", `重复的 permalink: ${permalink}`)
    } else {
      permalinks.set(permalinkKey, page)
    }

    const type = normalizedString(frontmatter.type)
    if (!type || !(PAGE_TYPES as readonly string[]).includes(type)) {
      addDiagnostic(diagnostics, page, "INVALID_PAGE_TYPE", "type 必须是批准的页面类型")
    }

    if (typeof frontmatter.draft !== "boolean") {
      addDiagnostic(diagnostics, page, "INVALID_DRAFT", "draft 必须是 boolean")
    }

    const tags = frontmatter.tags
    if (!Array.isArray(tags) || tags.length === 0) {
      addDiagnostic(diagnostics, page, "INVALID_TAG", "tags 必须是非空字符串数组")
    } else {
      const pageTags = new Set<string>()
      for (const value of tags) {
        const tag = normalizedString(value)
        const key = tag ? canonicalText(tag) : undefined
        if (!tag || tag.startsWith("#") || !key || !knownTags.has(key)) {
          addDiagnostic(diagnostics, page, "INVALID_TAG", "tags 包含无效或未知标签")
        } else if (pageTags.has(key)) {
          addDiagnostic(diagnostics, page, "DUPLICATE_TAG", `重复的 tag: ${tag}`)
        } else {
          pageTags.add(key)
        }
      }
    }

    if (type === "lesson") {
      const level = normalizedString(frontmatter.level)
      if (!level || !(LEVELS as readonly string[]).includes(level)) {
        addDiagnostic(diagnostics, page, "INVALID_LEVEL", "lesson 的 level 必须是批准的难度")
      }

      const prerequisites = frontmatter.prerequisites
      if (!Array.isArray(prerequisites) || prerequisites.length === 0) {
        addDiagnostic(
          diagnostics,
          page,
          "LESSON_PREREQUISITES_REQUIRED",
          "lesson 必须有非空 prerequisites 数组",
        )
      } else if (prerequisites.some((item) => !normalizedString(item))) {
        addDiagnostic(
          diagnostics,
          page,
          "INVALID_PREREQUISITES",
          "prerequisites 必须只包含非空字符串",
        )
      }
    }

    const rawAliases = frontmatter.aliases
    if (rawAliases !== undefined) {
      if (!Array.isArray(rawAliases)) {
        addDiagnostic(diagnostics, page, "INVALID_ALIAS", "aliases 必须是字符串数组")
      } else {
        for (const value of rawAliases) {
          const alias = normalizedString(value)
          const key = alias ? canonicalAlias(alias) : undefined
          if (!key) {
            addDiagnostic(diagnostics, page, "INVALID_ALIAS", "aliases 包含不安全或空白的别名")
          } else if (aliases.has(key)) {
            addDiagnostic(diagnostics, page, "DUPLICATE_ALIAS", `重复的 alias: ${alias}`)
          } else {
            aliases.set(key, page)
          }
        }
      }
    }

    const file = manifestFileFor(page)
    const manifestEntry =
      manifest.pages.find((entry) => entry.file === file) ??
      (permalink ? manifest.pages.find((entry) => entry.permalink === permalink) : undefined) ??
      (title ? manifest.pages.find((entry) => entry.title === title) : undefined)

    if (manifestEntry) {
      if (manifestEntry.file !== file) {
        addDiagnostic(diagnostics, page, "MANIFEST_FILE_MISMATCH", "页面文件与 manifest 不一致")
      }
      if (manifestEntry.type !== type) {
        addDiagnostic(diagnostics, page, "MANIFEST_TYPE_MISMATCH", "页面 type 与 manifest 不一致")
      }
      if (manifestEntry.permalink !== permalink) {
        addDiagnostic(
          diagnostics,
          page,
          "MANIFEST_PERMALINK_MISMATCH",
          "页面 permalink 与 manifest 不一致",
        )
      }
    }
  }

  return diagnostics.sort(compareDiagnostics)
}
