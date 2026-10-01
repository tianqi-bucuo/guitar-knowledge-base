import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build } from "esbuild"
import { h } from "preact"
import { render } from "preact-render-to-string"
import type { QuartzComponent } from "./types"

const explorerPath = fileURLToPath(new URL("./Explorer.tsx", import.meta.url))
const bundledExplorerPath = fileURLToPath(
  new URL("../../.quartz-cache/explorer.test.mjs", import.meta.url),
)

async function loadExplorer(): Promise<(opts?: never) => QuartzComponent> {
  await build({
    entryPoints: [explorerPath],
    bundle: true,
    format: "esm",
    loader: { ".scss": "text" },
    outfile: bundledExplorerPath,
    packages: "external",
    platform: "node",
    plugins: [
      {
        name: "quartz-inline-scripts",
        setup(build) {
          build.onLoad({ filter: /\.inline\.(ts|js)$/ }, async (args) => ({
            contents: `export default ${JSON.stringify(await readFile(args.path, "utf8"))}`,
            loader: "js",
          }))
        },
      },
    ],
    target: "node22",
    write: true,
  })

  return (await import(`${pathToFileURL(bundledExplorerPath).href}?test`)).default
}

const Explorer = (await loadExplorer())()
const explorerProps = {
  cfg: { locale: "en-US" },
  ctx: {},
  externalResources: { css: [], js: [] },
  fileData: { slug: "test-page", frontmatter: {} },
  children: [],
  tree: { type: "root", children: [] },
  allFiles: [],
} as never

function renderExplorers(count: number): string {
  return render(
    h(
      "main",
      null,
      Array.from({ length: count }, () => h(Explorer, explorerProps)),
    ),
  )
}

function explorerContentIds(html: string): string[] {
  return [...html.matchAll(/id="([^"]+)" class="explorer-content"/g)].map((match) => match[1])
}

function explorerControlIds(html: string): string[] {
  return [...html.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1])
}

test("keeps Explorer ids stable across independent renders with interleaved work", () => {
  const firstPageIds = explorerContentIds(renderExplorers(1))

  renderExplorers(2)

  const repeatedPageIds = explorerContentIds(renderExplorers(1))
  assert.deepEqual(repeatedPageIds, firstPageIds)
})

test("keeps multiple Explorers unique and pairs each mobile control with its content", () => {
  const html = renderExplorers(2)
  const contentIds = explorerContentIds(html)
  const controlIds = explorerControlIds(html)

  assert.equal(contentIds.length, 2)
  assert.equal(new Set(contentIds).size, 2)
  assert.deepEqual(controlIds, contentIds)
})
