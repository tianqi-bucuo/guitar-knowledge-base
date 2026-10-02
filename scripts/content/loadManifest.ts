import { readFileSync } from "node:fs"
import yaml from "js-yaml"
import {
  MODULE_IDS,
  PAGE_TYPES,
  type Manifest,
  type ManifestEntry,
  type ModuleId,
  type PageType,
} from "./types"

type UnknownRecord = Record<string, unknown>

function fail(code: string, message: string): never {
  throw new Error(`${code}: ${message}`)
}

function asRecord(value: unknown, code: string, field: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(code, `${field} must be an object`)
  }

  return value as UnknownRecord
}

function asArray(value: unknown, code: string, field: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(code, `${field} must be an array`)
  }

  return value
}

function nonEmptyString(value: unknown, code: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(code, `${field} must be a non-empty string`)
  }

  return value
}

function isKnownModuleId(value: string): value is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(value)
}

function isKnownPageType(value: string): value is PageType {
  return (PAGE_TYPES as readonly string[]).includes(value)
}

function validateFile(value: unknown, pageId: string): string {
  const file = nonEmptyString(value, "MANIFEST_INVALID_FILE", `page ${pageId} file`)
  const segments = file.split("/")

  if (
    file.startsWith("/") ||
    file.includes("\\") ||
    !file.endsWith(".md") ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    fail("MANIFEST_INVALID_FILE", `page ${pageId} file must be a content-root-relative .md path`)
  }

  return file
}

function validatePermalink(value: unknown, pageId: string): string {
  const permalink = nonEmptyString(value, "MANIFEST_INVALID_PERMALINK", `page ${pageId} permalink`)

  if (
    permalink !== "/" &&
    !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*$/.test(permalink)
  ) {
    fail(
      "MANIFEST_INVALID_PERMALINK",
      `page ${pageId} permalink must be / or lower-case ASCII kebab-case`,
    )
  }

  return permalink
}

function validateUnique(value: string, values: Set<string>, code: string): void {
  if (values.has(value)) {
    fail(code, value)
  }

  values.add(value)
}

function parseModules(value: unknown): Manifest["modules"] {
  const modules = asArray(value, "MANIFEST_MISSING_MODULE", "modules")
  const moduleIds = new Set<string>()
  const result: Manifest["modules"] = []

  for (const moduleValue of modules) {
    const module = asRecord(moduleValue, "MANIFEST_INVALID_MODULE", "module")
    const id = nonEmptyString(module.id, "MANIFEST_INVALID_MODULE", "module id")

    if (!isKnownModuleId(id)) {
      fail("MANIFEST_INVALID_MODULE", `unknown module ${id}`)
    }
    if (moduleIds.has(id)) {
      fail("MANIFEST_DUPLICATE_MODULE", id)
    }

    const directory = nonEmptyString(
      module.directory,
      "MANIFEST_INVALID_MODULE_DIRECTORY",
      `module ${id} directory`,
    )
    const target = module.target
    if (typeof target !== "number" || !Number.isInteger(target) || target <= 0) {
      fail("MANIFEST_INVALID_MODULE_TARGET", `module ${id} target must be a positive integer`)
    }

    moduleIds.add(id)
    result.push({ id, directory, target })
  }

  for (const id of MODULE_IDS) {
    if (!moduleIds.has(id)) {
      fail("MANIFEST_MISSING_MODULE", id)
    }
  }
  if (result.length !== MODULE_IDS.length) {
    fail("MANIFEST_INVALID_MODULE", "modules must contain exactly the approved module ids")
  }

  return result
}

function parsePages(value: unknown): ManifestEntry[] {
  const pages = asArray(value, "MANIFEST_INVALID_PAGES", "pages")
  const ids = new Set<string>()
  const titles = new Set<string>()
  const files = new Set<string>()
  const permalinks = new Set<string>()

  return pages.map((pageValue) => {
    const page = asRecord(pageValue, "MANIFEST_INVALID_PAGE", "page")
    const id = nonEmptyString(page.id, "MANIFEST_INVALID_ID", "page id")
    const title = nonEmptyString(page.title, "MANIFEST_INVALID_TITLE", `page ${id} title`)
    const module = nonEmptyString(page.module, "MANIFEST_INVALID_PAGE_MODULE", `page ${id} module`)
    const type = nonEmptyString(page.type, "MANIFEST_INVALID_PAGE_TYPE", `page ${id} type`)
    const file = validateFile(page.file, id)
    const permalink = validatePermalink(page.permalink, id)

    if (!isKnownModuleId(module)) {
      fail("MANIFEST_INVALID_PAGE_MODULE", `page ${id} module ${module}`)
    }
    if (!isKnownPageType(type)) {
      fail("MANIFEST_INVALID_PAGE_TYPE", `page ${id} type ${type}`)
    }
    if (typeof page.required !== "boolean") {
      fail("MANIFEST_INVALID_REQUIRED", `page ${id} required must be a boolean`)
    }

    validateUnique(id, ids, "MANIFEST_DUPLICATE_ID")
    validateUnique(title, titles, "MANIFEST_DUPLICATE_TITLE")
    validateUnique(file, files, "MANIFEST_DUPLICATE_FILE")
    validateUnique(permalink, permalinks, "MANIFEST_DUPLICATE_PERMALINK")

    return { id, title, module, type, file, permalink, required: page.required }
  })
}

function parseSearchAssertions(
  value: unknown,
  pages: ManifestEntry[],
): Manifest["searchAssertions"] {
  if (value === undefined) return undefined
  const assertions = asArray(value, "MANIFEST_INVALID_SEARCH_ASSERTION", "searchAssertions")
  const queries = new Set<string>()
  const permalinks = new Set(pages.map((page) => page.permalink))
  return assertions.map((item) => {
    const assertion = asRecord(item, "MANIFEST_INVALID_SEARCH_ASSERTION", "search assertion")
    const query = nonEmptyString(assertion.query, "MANIFEST_INVALID_SEARCH_ASSERTION", "query")
    if (
      query !== query.trim() ||
      typeof assertion.canonicalPermalink !== "string" ||
      !permalinks.has(assertion.canonicalPermalink) ||
      assertion.maxRank !== 5
    ) {
      fail(
        "MANIFEST_INVALID_SEARCH_ASSERTION",
        "query must be trimmed, canonicalPermalink must name a known page, and maxRank must be integer 5",
      )
    }
    validateUnique(query, queries, "MANIFEST_DUPLICATE_SEARCH_QUERY")
    return { query, canonicalPermalink: assertion.canonicalPermalink, maxRank: 5 }
  })
}

export function loadManifest(path: string): Manifest {
  let raw: unknown
  try {
    raw = yaml.load(readFileSync(path, "utf8"))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail("MANIFEST_READ_ERROR", `${path}: ${message}`)
  }

  const document = asRecord(raw, "MANIFEST_INVALID_DOCUMENT", "manifest")
  if (document.version !== 1) {
    fail("MANIFEST_INVALID_VERSION", "version must be 1")
  }

  const release = asRecord(document.release, "MANIFEST_INVALID_RELEASE_BOUNDS", "release")
  const minPages = release.minPages
  const maxPages = release.maxPages
  if (
    typeof minPages !== "number" ||
    !Number.isInteger(minPages) ||
    minPages <= 0 ||
    typeof maxPages !== "number" ||
    !Number.isInteger(maxPages) ||
    maxPages <= 0 ||
    minPages > maxPages ||
    minPages !== 60 ||
    maxPages !== 80
  ) {
    fail(
      "MANIFEST_INVALID_RELEASE_BOUNDS",
      "release minPages and maxPages must be fixed at 60 and 80",
    )
  }

  const pages = parsePages(document.pages)
  const searchAssertions = parseSearchAssertions(document.searchAssertions, pages)
  return {
    version: 1,
    release: { minPages, maxPages },
    modules: parseModules(document.modules),
    pages,
    ...(searchAssertions === undefined ? {} : { searchAssertions }),
  }
}
