import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath, pathToFileURL } from "node:url"

const configPath = fileURLToPath(new URL("../../quartz.config.ts", import.meta.url))
const bundledConfigPath = fileURLToPath(
  new URL("../../.quartz-cache/quartz-config.test.mjs", import.meta.url),
)

async function loadConfig() {
  await build({
    entryPoints: [configPath],
    bundle: true,
    format: "esm",
    loader: { ".scss": "text" },
    outfile: bundledConfigPath,
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

  return (await import(`${pathToFileURL(bundledConfigPath).href}?test`)).default
}

test("uses the approved Chinese knowledge-base settings", async () => {
  // This fails if the site configuration falls back to Quartz's default title or locale.
  const config = await loadConfig()

  assert.equal(config.configuration.pageTitle, "民谣吉他知识库")
  assert.equal(config.configuration.locale, "zh-CN")
  assert.equal(config.configuration.enableSPA, true)
  assert.equal(config.configuration.enablePopovers, true)
  assert.ok(config.configuration.ignorePatterns.includes(".obsidian"))
})
