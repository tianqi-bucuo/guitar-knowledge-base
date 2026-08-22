import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const publicDir = "public"

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const children = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    }),
  )

  return children.flat()
}

const files = await listFiles(publicDir)
const relativeFiles = files.map((file) => path.relative(publicDir, file))
const homePage = await readFile(path.join(publicDir, "index.html"), "utf8")
const stylesheet = await readFile(path.join(publicDir, "index.css"), "utf8")

assert.ok(relativeFiles.includes("index.html"), "the production homepage must exist")
assert.ok(
  relativeFiles.includes(path.join("static", "contentIndex.json")),
  "the search content index must exist",
)
assert.ok(
  !relativeFiles.some((file) => /(^|\/)(sitemap|rss)(\.|-|\/)/i.test(file)),
  "RSS and sitemap outputs must stay disabled",
)
assert.ok(
  !relativeFiles.some((file) => /-og-image\.webp$/i.test(file)),
  "offline builds must not generate font-fetching OG images",
)
assert.doesNotMatch(
  `${homePage}\n${stylesheet}`,
  /https:\/\/fonts\.(googleapis|gstatic)\.com/i,
  "the generated site must not reference Google Fonts",
)
assert.match(
  stylesheet,
  /html:root\{[^}]*--bodyFont:"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif;[^}]*--headerFont:"Noto Serif CJK SC","Songti SC",serif;?\}/,
  "the final CSS must give the CJK font stacks higher cascade priority than Quartz's generated theme",
)

console.log("Verified offline Quartz build output in public/")
