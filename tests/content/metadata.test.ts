import assert from "node:assert/strict"
import test from "node:test"
import { loadManifest } from "../../scripts/content/loadManifest"
import { parsePage, type PageRecord } from "../../scripts/content/parsePage"
import { validateMetadata } from "../../scripts/content/validateMetadata"

const fixtureManifest = "tests/content/fixtures/metadata-manifest.yml"
const validFixture = "tests/content/fixtures/content-valid/开放和弦.md"
const duplicateFixture = "tests/content/fixtures/content-invalid/重复链接.md"

function record(file: string, frontmatter: Record<string, unknown>): PageRecord {
  return { file, body: "", headings: [], links: [], embeds: [], frontmatter, hasFrontmatter: true }
}

function lesson(file: string, overrides: Record<string, unknown> = {}): PageRecord {
  return record(file, {
    title: "开放和弦入门",
    description: "认识并正确按响首组常用开放和弦",
    permalink: "/chords/open-chords",
    type: "lesson",
    level: "入门",
    prerequisites: ["正确持琴与按弦"],
    tags: ["和弦"],
    draft: false,
    ...overrides,
  })
}

function codes(pages: PageRecord[]): string[] {
  return validateMetadata(pages, loadManifest(fixtureManifest)).map((diagnostic) => diagnostic.code)
}

test("lesson metadata accepts the approved fields", () => {
  const manifest = loadManifest(fixtureManifest)
  const page = parsePage(validFixture)

  assert.equal(page.frontmatter.level, "入门")
  assert.deepEqual(validateMetadata([page], manifest), [])
})

test("parsePage normalizes frontmatter and ignores code syntax", () => {
  const page = parsePage(validFixture)

  assert.deepEqual(page.frontmatter.tags, ["和弦", "左手"])
  assert.deepEqual(page.frontmatter.aliases, ["开放和弦.md", "Open-Chords"])
  assert.deepEqual(page.frontmatter.prerequisites, ["正确持琴与按弦"])
  assert.ok(page.headings.includes("图示与操作步骤"))
  assert.ok(!page.headings.includes("不应成为标题"))
  assert.deepEqual(page.links, ["相关页面", "notes/target.md"])
  assert.deepEqual(page.embeds, ["assets/chord.svg", "assets/chord.png"])
})

test("parsePage recognizes TOML frontmatter as present and normalizes it", () => {
  const page = parsePage("tests/content/fixtures/content-valid/toml-frontmatter.md")

  assert.equal(page.hasFrontmatter, true)
  assert.equal(page.frontmatter.title, "TOML 页面")
  assert.deepEqual(page.frontmatter.tags, ["和弦", "左手"])
})

test("duplicate permalinks return a stable diagnostic", () => {
  const manifest = loadManifest(fixtureManifest)
  const first = parsePage(validFixture)
  const duplicate = parsePage(duplicateFixture)
  const diagnostics = validateMetadata([first, duplicate], manifest)

  assert.ok(diagnostics.some((item) => item.code === "DUPLICATE_PERMALINK"))
})

test("missing frontmatter is reported instead of inferred from a filename", () => {
  const page = {
    ...lesson("content/no-frontmatter.md"),
    frontmatter: {},
    hasFrontmatter: false,
  }

  assert.ok(codes([page]).includes("MISSING_FRONTMATTER"))
})

test("invalid page type and lesson level are rejected by centralized enums", () => {
  const invalidType = lesson("content/invalid-type.md", { type: "article" })
  const invalidLevel = lesson("content/invalid-level.md", { level: "专家" })

  assert.ok(codes([invalidType]).includes("INVALID_PAGE_TYPE"))
  assert.ok(codes([invalidLevel]).includes("INVALID_LEVEL"))
})

test("lessons require a non-empty prerequisites string array", () => {
  const missing = lesson("content/missing-prerequisites.md", { prerequisites: [] })
  const malformed = lesson("content/malformed-prerequisites.md", { prerequisites: ["  "] })

  assert.ok(codes([missing]).includes("LESSON_PREREQUISITES_REQUIRED"))
  assert.ok(codes([malformed]).includes("INVALID_PREREQUISITES"))
})

test("draft must be a real boolean", () => {
  assert.ok(
    codes([lesson("content/string-draft.md", { draft: "false" })]).includes("INVALID_DRAFT"),
  )
})

test("controlled tags reject unknown, blank, and normalized duplicates", () => {
  const unknown = lesson("content/unknown-tag.md", { tags: ["不存在"] })
  const blank = lesson("content/blank-tag.md", { tags: [" "] })
  const duplicate = lesson("content/duplicate-tag.md", { tags: ["和弦", " 和弦 "] })

  assert.ok(codes([unknown]).includes("INVALID_TAG"))
  assert.ok(codes([blank]).includes("INVALID_TAG"))
  assert.ok(codes([duplicate]).includes("DUPLICATE_TAG"))
})

test("duplicate titles and canonical aliases are rejected", () => {
  const first = lesson("content/first.md", { permalink: "/chords/first", aliases: ["Chord.md"] })
  const second = lesson("content/second.md", { permalink: "/chords/second", aliases: [" chord "] })

  const diagnostics = codes([first, second])
  assert.ok(diagnostics.includes("DUPLICATE_TITLE"))
  assert.ok(diagnostics.includes("DUPLICATE_ALIAS"))
})

test("invalid aliases reject unsafe targets", () => {
  const page = lesson("content/unsafe-alias.md", {
    aliases: ["../outside", "https://example.test"],
  })

  assert.ok(codes([page]).includes("INVALID_ALIAS"))
})

test("manifest agreement compares only the explicit content prefix", () => {
  const matching = lesson("content/tests/content/fixtures/content-valid/开放和弦.md", {
    aliases: [],
    tags: ["和弦"],
  })
  const mismatched = lesson("outside/开放和弦.md", {
    type: "path",
    permalink: "/chords/other",
  })

  assert.deepEqual(
    codes([matching, mismatched]).filter((code) => code.startsWith("MANIFEST_")),
    ["MANIFEST_FILE_MISMATCH", "MANIFEST_PERMALINK_MISMATCH", "MANIFEST_TYPE_MISMATCH"],
  )
})

test("the three published seed pages satisfy metadata validation", () => {
  const manifest = loadManifest("data/content-manifest.yml")
  const pages = [
    parsePage("content/index.md"),
    parsePage("content/00-从这里开始/如何使用知识库.md"),
    parsePage("content/00-从这里开始/学习路线总览.md"),
  ]

  assert.deepEqual(validateMetadata(pages, manifest), [])
})
