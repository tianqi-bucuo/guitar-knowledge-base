import assert from "node:assert/strict"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { transform } from "lightningcss"
import { loadManifest } from "../../scripts/content/loadManifest"
import type { ManifestEntry } from "../../scripts/content/types"
import { slugifyFilePath, type FilePath } from "../../quartz/util/path"

const publicDir = path.resolve("public")
const manifest = loadManifest("data/content-manifest.yml")
const required = manifest.pages.filter((page) => page.required)
const read = (file: string) => readFileSync(file, "utf8")
const approvedSearchAssertions = [
  { query: "横按", canonicalPermalink: "/chords/barre-and-movable", maxRank: 5 },
  { query: "六八拍", canonicalPermalink: "/rhythm/six-eight", maxRank: 5 },
  { query: "手腕", canonicalPermalink: "/basics/fretting-hand", maxRank: 5 },
  { query: "变调夹", canonicalPermalink: "/accompaniment/capo", maxRank: 5 },
  { query: "顺阶和弦", canonicalPermalink: "/theory/diatonic-chords", maxRank: 5 },
]

function attributes(tag: string): Map<string, string> {
  return new Map(
    [...tag.matchAll(/([^\s=]+)\s*=\s*(["'])(.*?)\2/gu)].map((match) => [match[1], match[3]]),
  )
}

function articleFor(page: ManifestEntry): string {
  const slug = slugifyFilePath(page.file as FilePath)
  return read(path.join(publicDir, `${slug}.html`))
}

function verifyPageCoverage(
  directory: string,
  pages: ManifestEntry[],
  index: Record<string, { title: string; content: string }>,
): void {
  for (const page of pages) {
    const slug = slugifyFilePath(page.file as FilePath)
    const canonicalFile = page.permalink === "/" ? "index.html" : `${page.permalink.slice(1)}.html`
    const canonicalPath = path.join(directory, canonicalFile)
    assert.ok(existsSync(canonicalPath), `missing required canonical output: ${page.permalink}`)
    const actualPath = path.join(directory, `${slug}.html`)
    assert.ok(existsSync(actualPath), `missing real article: ${page.file}`)
    const actual = read(actualPath)
    const article = actual.match(/<article\b[^>]*>([\s\S]*?)<\/article>/u)?.[1]
    assert.ok(article, `${page.id}: real article absent`)
    assert.ok(article.includes(page.title), `${page.id}: real article title absent`)
    assert.match(article, /<h[12]\b/u, `${page.id}: real article headings absent`)
    if (canonicalPath !== actualPath) {
      const redirect = (read(canonicalPath).match(/<meta\b[^>]*>/gu) ?? []).find(
        (tag) => attributes(tag).get("http-equiv") === "refresh",
      )
      assert.ok(redirect, `${page.id}: canonical alias must redirect to its actual article`)
      const target = attributes(redirect)
        .get("content")
        ?.match(/url=(.+)$/u)?.[1]
      assert.ok(target, `${page.id}: canonical redirect target missing`)
      const url = new URL(target, `https://local.test/${canonicalFile}`)
      assert.equal(
        url.origin,
        "https://local.test",
        `${page.id}: canonical redirect must remain on the local origin`,
      )
      assert.equal(
        decodeURIComponent(url.pathname),
        `/${slug}`,
        `${page.id}: canonical redirect target mismatch`,
      )
    }
    const entry = index[slug]
    assert.ok(entry, `missing search index member: ${page.file}`)
    assert.equal(entry.title, page.title, `${page.id}: indexed title mismatch`)
    assert.ok(
      typeof entry.content === "string" && entry.content.includes(page.title),
      `${page.id}: indexed article content missing`,
    )
  }
}

test("coverage acceptance rejects a missing required canonical page without touching public", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "guitar-missing-coverage-"))
  try {
    writeFileSync(
      path.join(directory, "index.html"),
      "<!doctype html><article><h1>民谣吉他知识库</h1></article>",
    )
    assert.throws(() => verifyPageCoverage(directory, required, {}), /missing search index member/u)
    assert.throws(
      () => verifyPageCoverage(directory, [required[1]], {}),
      /missing required canonical output/u,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("canonical alias coverage accepts local redirects and rejects external origins at the same path", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "guitar-alias-origin-"))
  try {
    const page: ManifestEntry = {
      id: "lesson",
      file: "lesson.md",
      title: "Lesson",
      module: "start",
      type: "lesson",
      permalink: "/canonical",
      required: true,
    }
    const index = { lesson: { title: "Lesson", content: "Lesson content" } }
    writeFileSync(
      path.join(directory, "lesson.html"),
      "<!doctype html><article><h1>Lesson</h1></article>",
    )
    const alias = path.join(directory, "canonical.html")
    writeFileSync(alias, '<meta http-equiv="refresh" content="0; url=./lesson">')
    assert.doesNotThrow(() => verifyPageCoverage(directory, [page], index))
    writeFileSync(
      alias,
      '<meta http-equiv="refresh" content="0; url=https://external.test/lesson">',
    )
    assert.throws(
      () => verifyPageCoverage(directory, [page], index),
      /canonical redirect must remain on the local origin/u,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("production output covers all 75 canonical aliases, real articles, and exact search index", () => {
  assert.equal(required.length, 75)
  assert.match(read(path.join(publicDir, "index.html")), /民谣吉他知识库/u)
  const index = JSON.parse(read(path.join(publicDir, "static/contentIndex.json")))
  assert.match(read(path.join(publicDir, "static/contentIndex.json")), /开放和弦/u)
  verifyPageCoverage(publicDir, required, index)
})

test("production manifest has exactly the five approved first-five search assertions", () => {
  assert.deepEqual(manifest.searchAssertions, approvedSearchAssertions)
  const index = JSON.parse(read(path.join(publicDir, "static/contentIndex.json")))
  for (const assertion of approvedSearchAssertions) {
    const page = required.find((entry) => entry.permalink === assertion.canonicalPermalink)!
    const entry = index[slugifyFilePath(page.file as FilePath)]
    assert.ok(entry, `search target missing: ${assertion.query}`)
    assert.ok(
      `${entry.title} ${entry.content}`.includes(assertion.query),
      `query absent from target: ${assertion.query}`,
    )
  }
  // Actual rendered result ranking is recorded by root's browser QA, not simulated here.
})

test("each real article renders one source H1 and named mobile Explorer controls", () => {
  for (const page of required) {
    const html = articleFor(page)
    assert.equal((html.match(/<h1\b/gu) ?? []).length, 1, `${page.id}: duplicate article titles`)
    const mobile = (html.match(/<button\b[^>]*>/gu) ?? []).find((tag) =>
      attributes(tag).get("class")?.split(" ").includes("mobile-explorer"),
    )
    assert.ok(mobile, `${page.id}: missing mobile Explorer toggle`)
    const attrs = attributes(mobile)
    assert.ok(attrs.get("aria-label")?.trim(), `${page.id}: unnamed mobile Explorer toggle`)
    assert.equal(attrs.get("aria-expanded"), "false", `${page.id}: mobile initial state`)
    assert.ok(attrs.get("aria-controls"), `${page.id}: controlled Explorer missing`)
    assert.ok(
      html.includes(`id="${attrs.get("aria-controls")}"`),
      `${page.id}: controlled Explorer target missing`,
    )
  }
  for (const generated of ["tags/和弦.html", "02-和弦系统/index.html"]) {
    assert.match(
      read(path.join(publicDir, generated)),
      /<h1\b[^>]*class="article-title"/u,
      `${generated}: generated title must survive`,
    )
  }
})

test("article images retain meaningful alternatives and linked local SVG titles", () => {
  let images = 0
  for (const page of required) {
    const html = articleFor(page)
    const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/u)?.[1]
    assert.ok(article, `${page.id}: article missing`)
    for (const tag of article.match(/<img\b[^>]*>/gu) ?? []) {
      const attrs = attributes(tag)
      const alt = attrs.get("alt")?.trim() ?? ""
      assert.ok(
        alt.length >= 4 &&
          !/^(?:image|img|svg|diagram|图片|图示|示意图|[^ ]+\.(?:svg|png|jpg))$/iu.test(alt),
        `${page.id}: meaningless image alternative`,
      )
      const src = attrs.get("src") ?? ""
      const url = new URL(src, `https://local.test/${slugifyFilePath(page.file as FilePath)}`)
      assert.equal(url.host, "local.test", `${page.id}: image must be local`)
      const imagePath = path.join(publicDir, decodeURIComponent(url.pathname))
      assert.ok(existsSync(imagePath), `${page.id}: missing image ${src}`)
      if (url.pathname.endsWith(".svg")) {
        assert.match(
          read(imagePath),
          /<title\b[^>]*>[^<\s][^<]*<\/title>/u,
          `${page.id}: SVG accessible title missing`,
        )
      }
      images++
    }
  }
  assert.ok(images > 0, "image coverage must inspect actual article illustrations")
})

test("built mobile search excerpts are limited to three lines without clamping desktop preview", () => {
  let mobileClamp = false
  transform({
    filename: "index.css",
    code: readFileSync(path.join(publicDir, "index.css")),
    visitor: {
      Rule: {
        media(rule) {
          const media = JSON.stringify(rule.value.query)
          if (!media.includes('"name":"width"') || !media.includes('"value":800')) return
          if (!media.includes('"operator":"less-than-equal"')) return
          for (const child of rule.value.rules) {
            if (child.type !== "style") continue
            const selector = JSON.stringify(child.value.selectors)
            if (
              !selector.includes('"name":"result-card"') ||
              !selector.includes('"name":"card-description"')
            )
              continue
            const declarations = child.value.declarations?.declarations ?? []
            const clamp = declarations.find(
              (declaration) =>
                declaration.property === "custom" &&
                declaration.value.name === "-webkit-line-clamp",
            )
            if (!clamp || clamp.property !== "custom") continue
            assert.deepEqual(clamp.value.value, [
              { type: "token", value: { type: "number", value: 3 } },
            ])
            assert.ok(
              declarations.some(
                (declaration) =>
                  declaration.property === "display" &&
                  declaration.value.type === "pair" &&
                  declaration.value.inside.type === "box",
              ),
            )
            assert.ok(
              declarations.some(
                (declaration) =>
                  declaration.property === "box-orient" && declaration.value === "vertical",
              ),
            )
            assert.ok(
              declarations.some(
                (declaration) =>
                  declaration.property === "overflow" &&
                  declaration.value.x === "hidden" &&
                  declaration.value.y === "hidden",
              ),
            )
            assert.ok(!selector.includes('"name":"preview-container"'))
            mobileClamp = true
          }
        },
      },
    },
  })
  assert.ok(mobileClamp, "built mobile result descriptions must have a three-line excerpt clamp")
})

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  })
}

test("fresh production output stays within the approved file-byte budgets", () => {
  const files = filesIn(publicDir)
  const bytes = (file: string) => statSync(file).size
  const sum = (extension: string) =>
    files.filter((file) => file.endsWith(extension)).reduce((total, file) => total + bytes(file), 0)
  const metrics = {
    css: sum(".css"),
    js: sum(".js"),
    largestSvg: Math.max(...files.filter((file) => file.endsWith(".svg")).map(bytes)),
    contentIndex: bytes(path.join(publicDir, "static/contentIndex.json")),
    total: files.reduce((total, file) => total + bytes(file), 0),
  }
  const ceilings = {
    css: 56320,
    js: 890880,
    largestSvg: 16384,
    contentIndex: 505856,
    total: 7668736,
  }
  for (const key of Object.keys(ceilings) as Array<keyof typeof ceilings>) {
    assert.ok(
      metrics[key] > 0 && metrics[key] <= ceilings[key],
      `${key}: ${metrics[key]} exceeds ${ceilings[key]}`,
    )
  }
  console.log(`Static output bytes (not a runtime benchmark): ${JSON.stringify(metrics)}`)
})
