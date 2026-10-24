import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { loadManifest } from "../../scripts/content/loadManifest"

const manifest = loadManifest("data/content-manifest.yml")

test("Obsidian's native alphabetical order matches each module's reading order", () => {
  for (const module of manifest.modules) {
    const pages = manifest.pages.filter(
      (page) => page.module === module.id && page.file.startsWith(`${module.directory}/`),
    )
    const manifestFiles = pages.map((page) => path.basename(page.file))
    const diskFiles = readdirSync(path.join("content", module.directory))
      .filter((file) => file.endsWith(".md"))
      .sort()

    pages.forEach((page, index) => {
      const expectedPrefix = `${String(index + 1).padStart(2, "0")}-`
      assert.ok(
        path.basename(page.file).startsWith(expectedPrefix),
        `${page.id}: expected filename prefix ${expectedPrefix}`,
      )
    })

    assert.deepEqual(
      diskFiles,
      manifestFiles,
      `${module.id}: native filename order drifted from the curriculum manifest`,
    )
  }
})

test("native ordering does not depend on the removed CSS sorting snippet", () => {
  assert.equal(existsSync("content/.obsidian/snippets/curriculum-order.css"), false)

  const rootIgnore = readFileSync(".gitignore", "utf8")
  const vaultIgnore = readFileSync("content/.obsidian/.gitignore", "utf8")
  assert.match(rootIgnore, /^\/content\/\.obsidian\/appearance\.json$/mu)
  assert.match(vaultIgnore, /^appearance\.json$/mu)
})
