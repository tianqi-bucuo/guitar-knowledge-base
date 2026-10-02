import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"
import yaml from "js-yaml"
import { format } from "prettier"
import { auditSources, renderSourceAudit } from "../../scripts/content/auditSources"
import type { PageRecord } from "../../scripts/content/parsePage"
import type { Manifest } from "../../scripts/content/types"

const record = (url = "https://example.com/a", date = "2026-10-01", title = "Title") =>
  `[${title}](${url}) — Publisher；访问日期：${date}`

function fixture(body = `Text[^one].\n\n[^one]: ${record()}。`, rows = `- ${record()}`) {
  const manifest: Manifest = {
    version: 1,
    release: { minPages: 1, maxPages: 80 },
    modules: [],
    pages: [
      {
        id: "lesson",
        file: "lesson.md",
        title: "Lesson",
        module: "start",
        type: "lesson",
        permalink: "/lesson",
        required: true,
      },
      {
        id: "sources",
        file: "refs/catalog.md",
        title: "Anything",
        module: "reference",
        type: "index",
        permalink: "/catalog",
        required: true,
      },
    ],
  }
  const pages: PageRecord[] = manifest.pages.map((entry, index) => ({
    file: `/irrelevant/${entry.file}`,
    contentPath: entry.file,
    body: index
      ? `## 有序链接\n\n1. Navigation\n\n### Category\n\n${rows}\n\n## 完成标准\n\n- [Explanation](https://example.com/ignored)`
      : body,
    frontmatter: {},
    headings: [],
    links: [],
    embeds: [],
  }))
  return { pages, manifest }
}

function codes(body: string, rows?: string) {
  const { pages, manifest } = fixture(body, rows)
  return auditSources(pages, manifest).diagnostics.map((d) => d.code)
}

test("canonical catalog metadata collapses equivalent terminal slashes and repeated markers", () => {
  const { pages, manifest } = fixture(
    `A[^ONE] B[^one].\n\n[^one]: ${record("https://example.com/a/", "2026-09-01", "Historic")}。`,
    `- ${record()}\n- ${record("https://example.com/a/")}`,
  )
  // Catalog date must equal newest real citation, rather than today.
  pages[0].body += `\n\nC[^new].\n\n[^new]: ${record()}`
  const audit = auditSources(pages, manifest)
  assert.deepEqual(audit, {
    diagnostics: [],
    sources: [
      {
        url: "https://example.com/a",
        title: "Title",
        publisher: "Publisher",
        accessDate: "2026-10-01",
        citedBy: ["lesson.md"],
      },
    ],
  })
  const report = renderSourceAudit(pages, manifest, audit)
  assert.match(report, /Footnote reference occurrences: 3/)
  assert.match(report, /Footnote definitions: 2/)
  assert.equal(renderSourceAudit([...pages].reverse(), manifest, audit), report)
})

test("compares cited-only and catalog-only identities without ordinary outbound links", () => {
  assert.ok(
    codes(
      `Text[^one]. [Recommendation](https://example.com/ordinary)\n\n[^one]: ${record("https://example.com/b")}`,
    ).includes("SOURCE_NOT_IN_CATALOG"),
  )
  assert.ok(
    codes(`Text[^one].\n\n[^one]: ${record("https://example.com/b")}`).includes(
      "UNCITED_CATALOG_ENTRY",
    ),
  )
  assert.deepEqual(
    codes(`Text[^one]. [Recommendation](https://example.com/ordinary)\n\n[^one]: ${record()}`),
    [],
  )
})

test("report counts resolved uncatalogued citations while excluding outbound and invalid notes", () => {
  const { pages, manifest } = fixture(
    `A[^one] B[^two] C[^again] Missing[^missing] Duplicate[^duplicate] Invalid[^invalid].
[Recommendation](https://example.com/ordinary)

[^one]: ${record()}
[^two]: ${record("https://example.com/b")}
[^again]: ${record("https://example.com/b/")}
[^duplicate]: ${record("https://example.com/duplicate")}
[^DUPLICATE]: ${record("https://example.com/duplicate")}
[^invalid]: ${record("https://example.com/invalid", "2026-02-30")}
[^orphan]: ${record("https://example.com/orphan")}`,
  )
  const audit = auditSources(pages, manifest)
  assert.deepEqual(
    audit.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "DUPLICATE_FOOTNOTE_DEFINITION",
      "FOOTNOTE_DEFINITION_MISSING",
      "INVALID_ACCESS_DATE",
      "ORPHAN_FOOTNOTE_DEFINITION",
      "SOURCE_NOT_IN_CATALOG",
    ],
  )
  assert.deepEqual(audit.sources, [
    {
      url: "https://example.com/a",
      title: "Title",
      publisher: "Publisher",
      accessDate: "2026-10-01",
      citedBy: ["lesson.md"],
    },
  ])
  const report = renderSourceAudit(pages, manifest, audit)
  assert.ok(report.split("\n").includes("Unique cited sources: 2"))
  assert.ok(report.split("\n").includes("Catalog sources: 1"))
  assert.equal(renderSourceAudit([...pages].reverse(), manifest, audit), report)
})

test("accepts historical publisher-first bibliography while catalog remains strict", () => {
  const { pages, manifest } = fixture(
    "Text[^one].\n\n[^one]: Publisher，[Title](https://example.com/a)，访问日期：2026-10-01。",
  )
  assert.deepEqual(auditSources(pages, manifest).diagnostics, [])
  pages[0].body =
    "Text[^one].\n\n[^one]: C. F. Martin & Co., Inc.，[Title](https://example.com/a)，访问日期：2026-10-01。"
  assert.deepEqual(auditSources(pages, manifest).diagnostics, [])
  pages[1].body =
    "## 有序链接\n\n### Category\n\n- Publisher，[Title](https://example.com/a)，访问日期：2026-10-01。"
  assert.ok(
    auditSources(pages, manifest).diagnostics.some((d) => d.code === "MALFORMED_CATALOG_ENTRY"),
  )
})

test("lessons require resolved bibliographic footnotes rather than outbound recommendations", () => {
  assert.ok(codes("[Link](https://example.com/a)").includes("LESSON_SOURCE_REQUIRED"))
  assert.ok(codes(`Missing[^absent].\n\n[^one]: ${record()}`).includes("LESSON_SOURCE_REQUIRED"))
})

test("rejects malformed Gregorian access dates in both footnotes and catalog", () => {
  for (const date of ["2026/10/01", "2026-02-30", "2025-02-29", "2026-13-01", "0000-01-01"]) {
    assert.ok(
      codes(`Text[^one].\n\n[^one]: ${record(undefined, date)}`).includes("INVALID_ACCESS_DATE"),
      date,
    )
    assert.ok(
      codes(`Text[^one].\n\n[^one]: ${record()}`, `- ${record(undefined, date)}`).includes(
        "INVALID_ACCESS_DATE",
      ),
      date,
    )
  }
  assert.deepEqual(
    codes(
      `Text[^one].\n\n[^one]: ${record(undefined, "2024-02-29")}`,
      `- ${record(undefined, "2024-02-29")}`,
    ),
    [],
  )
})

test("diagnoses missing, orphan, duplicate and malformed definitions", () => {
  assert.ok(codes("Missing[^absent]").includes("FOOTNOTE_DEFINITION_MISSING"))
  assert.ok(codes(`No marker\n\n[^one]: ${record()}`).includes("ORPHAN_FOOTNOTE_DEFINITION"))
  assert.ok(
    codes(`Text[^one].\n\n[^one]: ${record()}\n\n[^ONE]: ${record()}`).includes(
      "DUPLICATE_FOOTNOTE_DEFINITION",
    ),
  )
  assert.ok(
    codes("Text[^one].\n\n[^one]: Nonbibliographic text").includes("MALFORMED_SOURCE_DEFINITION"),
  )
  assert.ok(
    codes(`Text[^one].\n\n[^one]: ${record("ftp://example.com/a")}`).includes("INVALID_SOURCE_URL"),
  )
})

test("code, escaped markers and markers nested in definitions do not supply body citations", () => {
  const body = `Valid[^one] \\[^escaped] \`[^inline]\`\n\n\`\`\`\n[^fenced]\n\`\`\`\n\n[^one]: ${record()} [^nested]`
  assert.ok(!codes(body).includes("FOOTNOTE_DEFINITION_MISSING"))
  assert.ok(
    codes("\\[^one] `[^one]`\n\n[^one]: " + record()).includes("ORPHAN_FOOTNOTE_DEFINITION"),
  )
})

test("normalization retains query, fragment, encoded path, chapter and mirror identities", () => {
  for (const url of [
    "https://example.com/a?x=1",
    "https://example.com/a#part",
    "https://example.com/%61",
    "https://example.com/b",
    "https://mirror.example.com/a",
    "https://EXAMPLE.com/a",
  ]) {
    assert.ok(codes(`Text[^one].\n\n[^one]: ${record(url)}`).includes("SOURCE_NOT_IN_CATALOG"), url)
  }
  assert.deepEqual(
    codes(
      `Text[^one].\n\n[^one]: ${record("https://example.com/a/?x=1#part")}`,
      `- ${record("https://example.com/a?x=1#part")}`,
    ),
    [],
  )
})

test("conflicting catalog metadata and stale newest access date are structural findings", () => {
  assert.ok(
    codes(
      `Text[^one].\n\n[^one]: ${record()}`,
      `- ${record()}\n- ${record(undefined, undefined, "Other")}`,
    ).includes("CONFLICTING_CATALOG_METADATA"),
  )
  assert.ok(
    codes(`Text[^one].\n\n[^one]: ${record(undefined, "2026-10-02")}`).includes(
      "STALE_CATALOG_ACCESS_DATE",
    ),
  )
  assert.ok(
    codes(`Text[^one].\n\n[^one]: ${record()}`, `- ${record()} extra status`).includes(
      "MALFORMED_CATALOG_ENTRY",
    ),
  )
})

test("catalog source rows require the exact structured bullet shape", () => {
  for (const rows of [
    `* ${record()}`,
    `- Prefix ${record()}`,
    `- ${record()}\n\n  Extra paragraph`,
  ]) {
    const { pages, manifest } = fixture(undefined, rows)
    assert.ok(
      auditSources(pages, manifest).diagnostics.some((d) => d.code === "MALFORMED_CATALOG_ENTRY"),
      rows,
    )
  }
})

test("rejects ordered catalog source rows while preserving navigation outside categories", () => {
  const { pages, manifest } = fixture(
    undefined,
    `- ${record()}\n\n1. ${record("https://example.com/unexpected", undefined, "Extra")}`,
  )
  const audit = auditSources(pages, manifest)
  assert.deepEqual(
    audit.diagnostics.map(({ code, file }) => ({ code, file })),
    [{ code: "MALFORMED_CATALOG_ENTRY", file: "refs/catalog.md" }],
  )
  assert.deepEqual(
    audit.sources.map(({ url }) => url),
    ["https://example.com/a"],
  )
})

test("deterministic report is formatter-stable and escapes Markdown cell payloads", async () => {
  const { pages, manifest } = fixture(
    undefined,
    `- ${record(undefined, undefined, "Title | [nested]")}`,
  )
  const report = renderSourceAudit(pages, manifest, auditSources(pages, manifest))
  assert.equal(await format(report, { parser: "markdown" }), report)
  assert.match(report, /Title &#124; &#91;nested&#93;/)
})

test("catalog identity and publication membership cannot be inferred from headings or absolute files", () => {
  const { pages, manifest } = fixture()
  const missing = auditSources(pages.slice(0, 1), manifest)
  assert.ok(missing.diagnostics.some((d) => d.code === "SOURCE_PAGE_MISSING"))
  assert.ok(
    auditSources([...pages, pages[0]], manifest).diagnostics.some(
      (d) => d.code === "DUPLICATE_SOURCE_PAGE",
    ),
  )
  assert.ok(
    auditSources(
      [...pages, { ...pages[0], contentPath: "unpublished.md" }],
      manifest,
    ).diagnostics.some((d) => d.code === "SOURCE_PAGE_NOT_IN_MANIFEST"),
  )
  manifest.pages[1].id = "renamed"
  assert.ok(
    auditSources(pages, manifest).diagnostics.some((d) => d.code === "SOURCE_CATALOG_MISSING"),
  )
})

test("source CLI writes deterministic bytes, checks without mutation, rejects arguments and confines loading", () => {
  const root = mkdtempSync(join(tmpdir(), "source-cli-"))
  try {
    const { pages, manifest } = fixture()
    const base = yaml.load(readFileSync("data/content-manifest.yml", "utf8")) as Manifest
    base.pages = manifest.pages
    delete base.searchAssertions
    mkdirSync(join(root, "content", "refs"), { recursive: true })
    for (const page of pages) writeFileSync(join(root, "content", page.contentPath!), page.body)
    writeFileSync(join(root, "manifest.yml"), yaml.dump(base))
    const output = join(root, "audit.md")
    const cli = (args: string[]) =>
      spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          resolve("scripts/audit-sources.ts"),
          ...args,
          "--manifest",
          join(root, "manifest.yml"),
          "--content-root",
          join(root, "content"),
          "--output",
          output,
        ],
        { encoding: "utf8" },
      )
    assert.equal(cli(["--write"]).status, 0)
    const bytes = readFileSync(output, "utf8")
    assert.match(bytes, /Published pages: 2/)
    assert.match(bytes, /Unique cited sources: 1/)
    assert.ok(!bytes.includes(root))
    assert.equal(cli(["--check"]).status, 0)
    writeFileSync(output, "stale\n")
    assert.equal(cli(["--check"]).status, 1)
    assert.equal(readFileSync(output, "utf8"), "stale\n")
    for (const args of [
      [],
      ["--write", "--check"],
      ["--write", "--write"],
      ["--bogus"],
      ["--output"],
    ])
      assert.equal(cli(args).status, 2)
    assert.equal(cli(["--online"]).status, 2)
    rmSync(join(root, "content", "lesson.md"))
    writeFileSync(join(root, "outside.md"), pages[0].body)
    symlinkSync(join(root, "outside.md"), join(root, "content", "lesson.md"))
    assert.equal(cli(["--write"]).status, 1)
    assert.match(readFileSync(output, "utf8"), /SOURCE_PAGE_READ_ERROR/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("online CLI keeps health warnings non-blocking and cannot follow an output symlink", () => {
  const root = mkdtempSync(join(tmpdir(), "source-online-"))
  try {
    const { pages, manifest } = fixture(
      `Text[^one].\n\n[^one]: ${record("http://localhost/source")}`,
      `- ${record("http://localhost/source")}`,
    )
    const base = yaml.load(readFileSync("data/content-manifest.yml", "utf8")) as Manifest
    base.pages = manifest.pages
    delete base.searchAssertions
    mkdirSync(join(root, "content", "refs"), { recursive: true })
    mkdirSync(join(root, "reports"))
    for (const page of pages) writeFileSync(join(root, "content", page.contentPath!), page.body)
    writeFileSync(join(root, "manifest.yml"), yaml.dump(base))
    const run = () =>
      spawnSync(
        process.execPath,
        [
          "--import",
          import.meta.resolve("tsx"),
          resolve("scripts/audit-sources.ts"),
          "--online",
          "--manifest",
          "manifest.yml",
          "--content-root",
          "content",
          "--output",
          "reports/source-audit-online.md",
        ],
        { encoding: "utf8", cwd: root },
      )
    assert.equal(run().status, 0)
    const online = join(root, "reports", "source-audit-online.md")
    assert.match(readFileSync(online, "utf8"), /Unsafe local hostname/)
    const target = join(root, "do-not-overwrite.md")
    writeFileSync(target, "protected\n")
    rmSync(online)
    symlinkSync(target, online)
    assert.equal(run().status, 2)
    assert.equal(readFileSync(target, "utf8"), "protected\n")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
