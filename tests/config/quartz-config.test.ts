import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { QuartzConfig } from "../../quartz/cfg"

const configPath = fileURLToPath(new URL("../../quartz.config.ts", import.meta.url))
const bundledConfigPath = fileURLToPath(
  new URL("../../.quartz-cache/quartz-config.test.mjs", import.meta.url),
)

async function loadConfig(): Promise<QuartzConfig> {
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

  return (await import(`${pathToFileURL(bundledConfigPath).href}?test`)).default as QuartzConfig
}

test("configures the approved offline Chinese knowledge-base contract", async () => {
  // This fails if a production change restores hosted fonts, analytics, host-dependent outputs,
  // the approved palette, or a required Quartz processing component.
  const config = await loadConfig()

  assert.equal(config.configuration.pageTitle, "民谣吉他知识库")
  assert.equal(config.configuration.locale, "zh-CN")
  assert.equal(config.configuration.enableSPA, true)
  assert.equal(config.configuration.enablePopovers, true)
  assert.equal(config.configuration.analytics, null)
  assert.equal(config.configuration.baseUrl, undefined)
  assert.ok(config.configuration.ignorePatterns.includes(".obsidian"))
  assert.equal(config.configuration.theme.fontOrigin, "local")
  assert.equal(config.configuration.theme.cdnCaching, false)
  assert.equal(config.configuration.theme.typography.header, "Noto Serif CJK SC")
  assert.equal(config.configuration.theme.typography.body, "Noto Sans CJK SC")
  assert.equal(config.configuration.theme.colors.lightMode.secondary, "#8A4B2A")
  assert.equal(config.configuration.theme.colors.lightMode.tertiary, "#2F6B5F")
  assert.equal(config.configuration.theme.colors.darkMode.secondary, "#E1A46F")
  assert.equal(config.configuration.theme.colors.darkMode.tertiary, "#75B8A7")

  assert.ok(
    config.plugins.transformers.some((plugin) => plugin.name === "ObsidianFlavoredMarkdown"),
  )
  assert.ok(config.plugins.filters.some((plugin) => plugin.name === "RemoveDrafts"))
  assert.ok(config.plugins.emitters.some((plugin) => plugin.name === "ContentIndex"))
  assert.ok(config.plugins.emitters.some((plugin) => plugin.name === "Assets"))
  assert.ok(!config.plugins.emitters.some((plugin) => plugin.name === "CustomOgImages"))
})
