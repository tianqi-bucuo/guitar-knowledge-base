import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { loadManifest } from "../../scripts/content/loadManifest"

const manifest = loadManifest("data/content-manifest.yml")
const snippetPath = "content/.obsidian/snippets/curriculum-order.css"

function declaredOrders(css: string): Map<string, number> {
  return new Map(
    [...css.matchAll(/data-path="([^"]+\.md)"\]\) \{\s*order: (\d+);\s*\}/gu)].map((match) => [
      match[1],
      Number(match[2]),
    ]),
  )
}

test("Obsidian file explorer follows each module's manifest reading order", () => {
  const css = readFileSync(snippetPath, "utf8")
  const orders = declaredOrders(css)
  const expectedFiles = new Set<string>()

  for (const module of manifest.modules) {
    const pages = manifest.pages.filter(
      (page) => page.module === module.id && page.file.startsWith(`${module.directory}/`),
    )
    pages.forEach((page, index) => {
      expectedFiles.add(page.file)
      assert.equal(orders.get(page.file), index + 1, `${page.id}: Obsidian order drifted`)
    })
  }

  assert.deepEqual(new Set(orders.keys()), expectedFiles)
  assert.match(
    css,
    /\.nav-folder-children:has\(> \.nav-file\) \{\s*display: flex;\s*flex-direction: column;/u,
    "ordered files need a flex parent for CSS order values to affect the Obsidian UI",
  )
})

test("the curriculum-order snippet is enabled in the shared vault appearance", () => {
  const appearance = JSON.parse(readFileSync("content/.obsidian/appearance.json", "utf8"))
  assert.ok(appearance.enabledCssSnippets.includes("curriculum-order"))
})
