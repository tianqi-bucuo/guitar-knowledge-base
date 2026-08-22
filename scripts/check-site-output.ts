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
const html = (
  await Promise.all(
    files
      .filter((file) => path.extname(file).toLowerCase() === ".html")
      .map((file) => readFile(file, "utf8")),
  )
).join("\n")

function metaAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>()
  for (const match of tag.matchAll(/([^\s=]+)\s*=\s*(["'])(.*?)\2/gu)) {
    attributes.set(match[1].toLowerCase(), match[3])
  }
  return attributes
}

function isPlaceholderHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/u, "")
  return (
    normalized === "undefined" ||
    normalized === "null" ||
    /(?:^|\.)example\.(?:com|org|net)$/u.test(normalized)
  )
}

function isValidSocialUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      (url.protocol === "http:" || url.protocol === "https:") && !isPlaceholderHost(url.hostname)
    )
  } catch {
    return false
  }
}

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
  html,
  /https?:\/\/(?:undefined|null|(?:[^/"'\s]+\.)?example\.(?:com|org|net))(?=[/:"'\s]|$)/iu,
  "generated HTML must not contain undefined or placeholder hosts",
)
for (const tag of html.match(/<meta\b[^>]*>/giu) ?? []) {
  const attributes = metaAttributes(tag)
  const name = (attributes.get("property") ?? attributes.get("name"))?.toLowerCase()
  if (["og:image", "og:image:url", "twitter:image", "og:url", "twitter:url"].includes(name ?? "")) {
    const content = attributes.get("content") ?? ""
    assert.ok(isValidSocialUrl(content), `invalid social URL metadata: ${name}=${content}`)
  } else if (name === "twitter:domain") {
    const content = attributes.get("content") ?? ""
    assert.ok(
      content.length > 0 && !isPlaceholderHost(content),
      `invalid host metadata: ${content}`,
    )
  }
}
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
