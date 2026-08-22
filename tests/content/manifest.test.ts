import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
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

test("loads the initial manifest for the three published seed pages", () => {
  const manifest = loadManifest("data/content-manifest.yml")

  assert.equal(manifest.release.minPages, 60)
  assert.equal(manifest.release.maxPages, 80)
  assert.equal(manifest.modules.length, 10)
  assert.deepEqual(
    manifest.pages.map((page) => [page.id, page.type]),
    [
      ["home", "index"],
      ["how-to-use", "lesson"],
      ["learning-roadmap", "path"],
    ],
  )
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
