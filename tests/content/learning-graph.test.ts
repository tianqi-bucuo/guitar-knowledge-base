import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import yaml from "js-yaml"
import type { PageRecord } from "../../scripts/content/parsePage"
import { validateContent } from "../../scripts/content/validateContent"
import { validateLearningGraph } from "../../scripts/content/validateLearningGraph"
import {
  analyzeInternalLinks,
  resolveInternalLinks,
  validateLinks,
} from "../../scripts/content/validateLinks"
import { MODULE_IDS, type Manifest } from "../../scripts/content/types"

function fixture(): { pages: PageRecord[]; manifest: Manifest } {
  const entries: Manifest["pages"] = [
    { id: "home", title: "Home", file: "index.md", permalink: "/" },
    {
      id: "learning-path",
      title: "Route",
      file: "start/route.md",
      permalink: "/start/learning-path",
    },
    { id: "first", title: "First", file: "lessons/first.md", permalink: "/first" },
    { id: "second", title: "Second", file: "lessons/second.md", permalink: "/second" },
  ].map((entry) => ({ ...entry, module: "start", type: "index", required: true }))
  const pages = entries.map(
    (entry): PageRecord => ({
      file: `content/${entry.file}`,
      contentPath: entry.file,
      body: "",
      headings: ["Overview"],
      links: [],
      embeds: [],
      frontmatter: {
        title: entry.title,
        permalink: entry.permalink,
        aliases: entry.id === "first" ? ["first-alias"] : [],
        prerequisites: entry.id === "second" ? ["First"] : [],
      },
    }),
  )
  pages[0].links = ["first-alias#Overview"]
  pages[1].links = ["/second#overview"]
  return {
    pages,
    manifest: { version: 1, release: { minPages: 60, maxPages: 80 }, modules: [], pages: entries },
  }
}

function graph(pages: PageRecord[], manifest: Manifest) {
  return validateLearningGraph(pages, manifest, resolveInternalLinks(pages, "content"))
}

test("reaches pages from the union of manifest roots through resolved aliases and fragments", () => {
  const { pages, manifest } = fixture()
  assert.deepEqual(graph(pages, manifest), [])
})

test("reports unreachable pages including reference pages without navigation edges", () => {
  const { pages, manifest } = fixture()
  pages[1].links = []
  manifest.pages[3].module = "reference"
  manifest.pages[3].type = "glossary"
  assert.deepEqual(
    graph(pages, manifest).map(({ code, file, severity }) => ({ code, file, severity })),
    [{ code: "UNREACHABLE_PAGE", file: "lessons/second.md", severity: "error" }],
  )
})

test("follows transitive page navigation while prerequisite edges do not grant reachability", () => {
  const { pages, manifest } = fixture()
  pages[1].links = []
  assert.ok(graph(pages, manifest).some((d) => d.file === "lessons/second.md"))
  pages[2].links = ["/second"]
  assert.deepEqual(graph(pages, manifest), [])
})

test("asset edges cannot make an otherwise unreachable page reachable", () => {
  const { pages, manifest } = fixture()
  pages[1].links = []
  const links = resolveInternalLinks(pages, "content")
  links.push({ source: "start/route.md", target: "assets/second.svg", raw: "assets/second.svg" })
  assert.ok(
    validateLearningGraph(pages, manifest, links).some((d) => d.code === "UNREACHABLE_PAGE"),
  )
})

test("prerequisites resolve by manifest title rather than id, alias or page title", () => {
  const { pages, manifest } = fixture()
  pages[2].frontmatter.title = "Different title"
  assert.deepEqual(graph(pages, manifest), [])
  for (const title of ["first", "first-alias", "Unknown"]) {
    pages[3].frontmatter.prerequisites = [title]
    assert.ok(graph(pages, manifest).some((d) => d.code === "PREREQUISITE_MISSING"))
  }
})

test("ambiguous manifest titles cannot pick a prerequisite arbitrarily", () => {
  const { pages, manifest } = fixture()
  manifest.pages[0].title = "First"
  assert.ok(graph(pages, manifest).some((d) => d.code === "PREREQUISITE_AMBIGUOUS"))
})

test("self and forward prerequisites are errors in manifest curriculum order", () => {
  const { pages, manifest } = fixture()
  pages[2].frontmatter.prerequisites = ["First", "Second"]
  assert.deepEqual(
    graph(pages, manifest)
      .map(({ code }) => code)
      .sort(),
    ["PREREQUISITE_CYCLE", "PREREQUISITE_POINTS_FORWARD", "PREREQUISITE_SELF"],
  )
})

test("cycles produce one stable diagnostic per component regardless of traversal or duplicates", () => {
  const { pages, manifest } = fixture()
  pages[2].frontmatter.prerequisites = ["Second", "Second"]
  const diagnostics = graph(pages, manifest)
  assert.equal(diagnostics.filter((d) => d.code === "PREREQUISITE_CYCLE").length, 1)
  assert.ok(diagnostics.some((d) => d.code === "PREREQUISITE_POINTS_FORWARD"))
  assert.deepEqual(graph([...pages].reverse(), manifest), diagnostics)
})

test("a prerequisite whose manifest page is absent fails instead of creating a phantom node", () => {
  const { pages, manifest } = fixture()
  assert.ok(
    graph(
      pages.filter((p) => p.contentPath !== "lessons/first.md"),
      manifest,
    ).some((d) => d.code === "PREREQUISITE_PAGE_MISSING"),
  )
})

test("missing root identities and absent root files are explicit errors", () => {
  const { pages, manifest } = fixture()
  manifest.pages[0].id = "renamed"
  assert.ok(graph(pages, manifest).some((d) => d.code === "LEARNING_ROOT_MISSING"))
  manifest.pages[0].id = "home"
  assert.ok(graph(pages.slice(1), manifest).some((d) => d.code === "LEARNING_ROOT_PAGE_MISSING"))
})

test("a supplied page without a manifest identity fails", () => {
  const { pages, manifest } = fixture()
  manifest.pages.pop()
  assert.ok(graph(pages, manifest).some((d) => d.code === "LEARNING_PAGE_NOT_IN_MANIFEST"))
})

test("shared link analysis retains strict diagnostics and wrapper results", () => {
  const { pages } = fixture()
  pages[0].links.push("missing-page")
  const analysis = analyzeInternalLinks(pages, "content")
  assert.deepEqual(analysis.resolved, resolveInternalLinks(pages, "content"))
  assert.deepEqual(analysis.diagnostics, validateLinks(pages, "content"))
  assert.equal(analysis.diagnostics[0].code, "BROKEN_INTERNAL_LINK")
})

test("validateContent gates graph errors on release and preserves link failures in both modes", async () => {
  const { pages, manifest } = fixture()
  const root = mkdtempSync(join(tmpdir(), "guitar-learning-graph-"))
  const contentRoot = join(root, "content")
  const manifestPath = join(root, "manifest.yml")
  manifest.modules = MODULE_IDS.map((id, index) => ({
    id,
    directory: `module-${index}`,
    target: 1,
  }))
  pages[0].links = ["/first", "/missing"]
  pages[1].links = []
  try {
    for (const [index, page] of pages.entries()) {
      const file = join(contentRoot, manifest.pages[index].file)
      mkdirSync(join(file, ".."), { recursive: true })
      writeFileSync(
        file,
        `---\n${yaml.dump({ ...page.frontmatter, description: "Graph fixture", type: "index", tags: ["导航"], draft: false })}---\n\n## 适用对象\n\n## 导航方法\n\n## 有序链接\n\n${page.links.map((link) => `[Link](${link})`).join("\n")}\n\n## 完成标准\n\n## 更新策略\n`,
      )
    }
    writeFileSync(manifestPath, yaml.dump(manifest))
    const author = await validateContent({ contentRoot, manifestPath, mode: "author" })
    const release = await validateContent({ contentRoot, manifestPath, mode: "release" })
    assert.ok(!author.some((d) => d.code === "UNREACHABLE_PAGE"))
    assert.ok(
      release.some(
        (d) =>
          d.code === "UNREACHABLE_PAGE" && d.file === "lessons/second.md" && d.severity === "error",
      ),
    )
    for (const diagnostics of [author, release]) {
      assert.equal(diagnostics.filter((d) => d.code === "BROKEN_INTERNAL_LINK").length, 1)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
