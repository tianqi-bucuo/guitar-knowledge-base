import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import matter from "gray-matter"
import yaml from "js-yaml"
import { loadManifest } from "../../scripts/content/loadManifest"
import { TAGS } from "../../scripts/content/types"

const validFixture = "tests/content/fixtures/valid-manifest.yml"

function withManifest(
  mutate: (manifest: Record<string, unknown>) => void,
  run: (path: string) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "guitar-manifest-"))

  try {
    const manifest = yaml.load(readFileSync(validFixture, "utf8")) as Record<string, unknown>
    mutate(manifest)
    const path = join(directory, "manifest.yml")
    writeFileSync(path, yaml.dump(manifest), "utf8")
    run(path)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function expectManifestError(
  code: string,
  mutate: (manifest: Record<string, unknown>) => void,
): void {
  withManifest(mutate, (path) => {
    assert.throws(() => loadManifest(path), new RegExp(`${code}\\b`))
  })
}

test("loads a complete valid manifest", () => {
  const manifest = loadManifest(validFixture)

  assert.equal(manifest.release.minPages, 60)
  assert.equal(manifest.release.maxPages, 80)
  assert.deepEqual(
    manifest.modules.map((module) => module.id),
    [
      "start",
      "basics",
      "chords",
      "rhythm",
      "technique",
      "accompaniment",
      "theory",
      "practice",
      "care",
      "reference",
    ],
  )
  assert.deepEqual(
    manifest.pages.map((page) => page.id),
    ["home", "how-to-use", "learning-roadmap"],
  )
})

test("loads the canonical curriculum manifest", () => {
  const manifest = loadManifest("data/content-manifest.yml")

  assert.equal(manifest.version, 1)
  assert.equal(manifest.release.minPages, 60)
  assert.equal(manifest.release.maxPages, 80)
  assert.ok(manifest.modules.length > 0)
  assert.ok(manifest.pages.length > 0)
})

test("rejects duplicate page ids", () => {
  assert.throws(
    () => loadManifest("tests/content/fixtures/invalid-manifest.yml"),
    /MANIFEST_DUPLICATE_ID\b.*how-to-use/,
  )
})

test("rejects a manifest version other than 1", () => {
  expectManifestError("MANIFEST_INVALID_VERSION", (manifest) => {
    manifest.version = 2
  })
})

test("rejects release page bounds that cannot describe a release", () => {
  expectManifestError("MANIFEST_INVALID_RELEASE_BOUNDS", (manifest) => {
    ;(manifest.release as Record<string, unknown>).minPages = 0
  })
})

test("rejects release bounds outside the fixed 60-to-80 contract", () => {
  const mutations: Array<(release: Record<string, unknown>) => void> = [
    (release) => (release.minPages = 59),
    (release) => (release.maxPages = 81),
  ]

  for (const mutate of mutations) {
    expectManifestError("MANIFEST_INVALID_RELEASE_BOUNDS", (manifest) => {
      mutate(manifest.release as Record<string, unknown>)
    })
  }
})

test("rejects a missing approved module", () => {
  expectManifestError("MANIFEST_MISSING_MODULE", (manifest) => {
    ;(manifest.modules as unknown[]).pop()
  })
})

test("rejects duplicate modules and non-positive module targets", () => {
  expectManifestError("MANIFEST_DUPLICATE_MODULE", (manifest) => {
    ;(manifest.modules as Array<Record<string, unknown>>)[1].id = "start"
  })

  expectManifestError("MANIFEST_INVALID_MODULE_TARGET", (manifest) => {
    ;(manifest.modules as Array<Record<string, unknown>>)[0].target = 0
  })
})

test("rejects invalid page fields instead of accepting unsafe paths", () => {
  const cases: Array<{
    code: string
    mutate: (page: Record<string, unknown>) => void
  }> = [
    { code: "MANIFEST_INVALID_TITLE", mutate: (page) => (page.title = "   ") },
    { code: "MANIFEST_INVALID_PAGE_TYPE", mutate: (page) => (page.type = "article") },
    { code: "MANIFEST_INVALID_FILE", mutate: (page) => (page.file = "/tmp/page.md") },
    { code: "MANIFEST_INVALID_FILE", mutate: (page) => (page.file = "../escape.md") },
    { code: "MANIFEST_INVALID_FILE", mutate: (page) => (page.file = "start/page.txt") },
    { code: "MANIFEST_INVALID_PERMALINK", mutate: (page) => (page.permalink = "start/page") },
    { code: "MANIFEST_INVALID_PERMALINK", mutate: (page) => (page.permalink = "/Start/page") },
    { code: "MANIFEST_INVALID_PERMALINK", mutate: (page) => (page.permalink = "/start/page_name") },
  ]

  for (const { code, mutate } of cases) {
    expectManifestError(code, (manifest) => {
      mutate((manifest.pages as Array<Record<string, unknown>>)[1])
    })
  }
})

test("rejects every duplicate page identity", () => {
  const fields = [
    ["title", "MANIFEST_DUPLICATE_TITLE"],
    ["file", "MANIFEST_DUPLICATE_FILE"],
    ["permalink", "MANIFEST_DUPLICATE_PERMALINK"],
  ] as const

  for (const [field, code] of fields) {
    expectManifestError(code, (manifest) => {
      const pages = manifest.pages as Array<Record<string, unknown>>
      pages[2][field] = pages[1][field]
    })
  }
})

test("publishes controlled tags without empty, padded, or canonical duplicates", () => {
  const canonicalTags = TAGS.map((tag) => tag.trim().toLocaleLowerCase("en-US"))

  assert.ok(TAGS.length > 0)
  assert.ok(TAGS.every((tag) => tag.length > 0 && tag === tag.trim()))
  assert.equal(new Set(canonicalTags).size, TAGS.length)
})

test("keeps normalized tags of every published seed page in the controlled vocabulary", () => {
  const normalizeTag = (tag: string) => tag.trim().toLocaleLowerCase("en-US")
  const controlledTagKeys = new Set(TAGS.map(normalizeTag))
  const seedPages = [
    "content/index.md",
    "content/00-从这里开始/如何使用知识库.md",
    "content/00-从这里开始/学习路线总览.md",
  ]

  for (const pagePath of seedPages) {
    const { data } = matter(readFileSync(pagePath, "utf8"))
    assert.ok(Array.isArray(data.tags), `${pagePath} must declare tag array`)

    for (const tag of data.tags) {
      assert.equal(typeof tag, "string", `${pagePath} tags must be strings`)
      assert.ok(controlledTagKeys.has(normalizeTag(tag)), `${pagePath} has unknown tag ${tag}`)
    }
  }
})
