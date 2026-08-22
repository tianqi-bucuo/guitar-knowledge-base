import assert from "node:assert/strict"
import test from "node:test"
import { parsePage, type PageRecord } from "../../scripts/content/parsePage"
import {
  resolveInternalLinks,
  validateLinks,
  type ResolvedLink,
} from "../../scripts/content/validateLinks"

const contentRoot = "tests/content/fixtures/link-site"

function fixturePages(): PageRecord[] {
  return [
    parsePage(`${contentRoot}/source.md`),
    parsePage(`${contentRoot}/notes/目标页面.md`),
    parsePage(`${contentRoot}/a/重复.md`),
    parsePage(`${contentRoot}/b/重复.md`),
  ]
}

function targetFor(resolved: ResolvedLink[], raw: string): string | undefined {
  return resolved.find((link) => link.raw === raw)?.target
}

function pageWithTargets(links: string[], embeds: string[] = []): PageRecord {
  return {
    file: `${contentRoot}/source.md`,
    body: "",
    headings: [],
    links,
    embeds,
    frontmatter: {},
    hasFrontmatter: true,
  }
}

test("resolves wikilink display aliases and GitHub heading fragments", () => {
  const resolved = resolveInternalLinks(fixturePages(), contentRoot)

  assert.equal(
    targetFor(resolved, "notes/目标页面#目标 标题|章节别名"),
    "notes/目标页面.md#目标-标题",
  )
  assert.equal(targetFor(resolved, "target-alias|别名显示"), "notes/目标页面.md")
})

test("resolves relative Markdown, URL-encoded, permalink, and page embed targets", () => {
  const resolved = resolveInternalLinks(fixturePages(), contentRoot)

  assert.equal(targetFor(resolved, "notes/目标页面.md"), "notes/目标页面.md")
  assert.equal(
    targetFor(resolved, "notes/%E7%9B%AE%E6%A0%87%E9%A1%B5%E9%9D%A2.md"),
    "notes/目标页面.md",
  )
  assert.equal(targetFor(resolved, "/guide/target"), "notes/目标页面.md")
  assert.equal(
    resolved.filter((link) => link.raw === "notes/目标页面").at(0)?.target,
    "notes/目标页面.md",
  )
})

test("reports missing pages, missing assets, and duplicate basename ambiguity separately", () => {
  const codes = validateLinks(fixturePages(), contentRoot).map((item) => item.code)

  assert.ok(codes.includes("BROKEN_INTERNAL_LINK"))
  assert.ok(codes.includes("MISSING_LOCAL_ASSET"))
  assert.ok(codes.includes("AMBIGUOUS_INTERNAL_LINK"))
})

test("rejects invalid encoding, internal queries, traversal, missing fragments, and blocks", () => {
  const codes = validateLinks(fixturePages(), contentRoot).map((item) => item.code)

  assert.ok(codes.includes("INVALID_INTERNAL_TARGET"))
  assert.ok(codes.includes("PATH_TRAVERSAL_TARGET"))
  assert.ok(codes.includes("BROKEN_FRAGMENT"))
  assert.ok(codes.includes("UNSUPPORTED_FRAGMENT"))
})

test("ignores every external protocol without fetching it", () => {
  const page = pageWithTargets(
    [
      "http://example.test/page",
      "https://example.test/page",
      "mailto:learner@example.test",
      "tel:+886123456",
      "//example.test/asset.svg",
    ],
    ["data:image/svg+xml;base64,PHN2Zy8+"],
  )

  assert.deepEqual(validateLinks([page], contentRoot), [])
  assert.deepEqual(resolveInternalLinks([page], contentRoot), [])
})

test("accepts titled SVG and rejects untitled, DOCTYPE, malformed, and non-SVG assets", () => {
  const page = pageWithTargets([
    "assets/valid.svg",
    "assets/untitled.svg",
    "assets/doctype.svg",
    "assets/malformed.svg",
    "assets/not-svg.svg",
  ])
  const diagnostics = validateLinks([page], contentRoot)
  const resolved = resolveInternalLinks([page], contentRoot)

  assert.equal(targetFor(resolved, "assets/valid.svg"), "assets/valid.svg")
  assert.ok(diagnostics.some((item) => item.code === "SVG_MISSING_TITLE"))
  assert.equal(diagnostics.filter((item) => item.code === "INVALID_SVG_ASSET").length, 3)
  assert.ok(!diagnostics.some((item) => item.message.includes("valid.svg")))
})

test("the three published seed pages have no link diagnostics", () => {
  const pages = [
    parsePage("content/index.md"),
    parsePage("content/00-从这里开始/如何使用知识库.md"),
    parsePage("content/00-从这里开始/学习路线总览.md"),
  ]

  assert.deepEqual(validateLinks(pages, "content"), [])
})
