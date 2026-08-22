import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import yaml from "js-yaml"
import { validateContent } from "../../scripts/content/validateContent"

const modules = [
  ["start", "00-从这里开始", 5],
  ["basics", "01-持琴与基础动作", 8],
  ["chords", "02-和弦系统", 12],
  ["rhythm", "03-节奏系统", 10],
  ["technique", "04-演奏技巧", 8],
  ["accompaniment", "05-弹唱与伴奏", 8],
  ["theory", "06-基础乐理与指板", 8],
  ["practice", "07-练习与复盘", 6],
  ["care", "08-保养安全与排错", 5],
  ["reference", "09-术语与参考资料", 5],
].map(([id, directory, target]) => ({ id, directory, target }))

interface Fixture {
  root: string
  contentRoot: string
  manifestPath: string
}

function indexPage(options: { draft?: boolean; body?: string } = {}): string {
  const body =
    options.body ??
    "## 适用对象\n\n初学者。\n\n## 导航方法\n\n依序学习。\n\n## 有序链接\n\n1. [使用说明](https://example.test)\n\n## 完成标准\n\n完成阅读。\n\n## 更新策略\n\n定期复核。\n"
  return `---
title: 测试知识库
description: 用于验证内容编排的页面
permalink: /
type: index
tags:
  - 导航
draft: ${options.draft ?? false}
---

${body}`
}

function manifestPages(): Array<Record<string, unknown>> {
  return [
    {
      id: "home",
      title: "测试知识库",
      module: "start",
      type: "index",
      file: "index.md",
      permalink: "/",
      required: true,
    },
    {
      id: "required-missing",
      title: "必需缺失页",
      module: "start",
      type: "lesson",
      file: "00-从这里开始/必需缺失页.md",
      permalink: "/start/required-missing",
      required: true,
    },
    {
      id: "optional-missing",
      title: "可选缺失页",
      module: "start",
      type: "lesson",
      file: "00-从这里开始/可选缺失页.md",
      permalink: "/start/optional-missing",
      required: false,
    },
  ]
}

function createFixture(options: { draft?: boolean; body?: string } = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "guitar-cli-"))
  const contentRoot = join(root, "content")
  const manifestPath = join(root, "manifest.yml")
  mkdirSync(contentRoot, { recursive: true })
  writeFileSync(join(contentRoot, "index.md"), indexPage(options), "utf8")
  writeFileSync(
    manifestPath,
    yaml.dump({
      version: 1,
      release: { minPages: 60, maxPages: 80 },
      modules,
      pages: manifestPages(),
    }),
    "utf8",
  )
  return { root, contentRoot, manifestPath }
}

function replaceManifestPages(fixture: Fixture, pages: Array<Record<string, unknown>>): void {
  const manifest = yaml.load(readFileSync(fixture.manifestPath, "utf8")) as Record<string, unknown>
  manifest.pages = pages
  writeFileSync(fixture.manifestPath, yaml.dump(manifest), "utf8")
}

function runCli(...args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/check-content.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

function codes(diagnostics: Awaited<ReturnType<typeof validateContent>>): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code)
}

test("author mode treats missing planned pages and page count as warnings", async () => {
  const fixture = createFixture()
  try {
    const diagnostics = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "author",
    })

    assert.deepEqual(
      diagnostics.map(({ code, severity }) => [code, severity]),
      [
        ["CONTENT_COUNT_OUT_OF_RANGE", "warning"],
        ["PLANNED_PAGE_MISSING", "warning"],
        ["PLANNED_PAGE_MISSING", "warning"],
      ],
    )
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("release mode blocks required missing pages, page count, and published drafts", async () => {
  const fixture = createFixture({ draft: true })
  try {
    const diagnostics = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "release",
    })

    assert.ok(codes(diagnostics).includes("REQUIRED_PAGE_MISSING"))
    assert.ok(codes(diagnostics).includes("CONTENT_COUNT_OUT_OF_RANGE"))
    assert.ok(codes(diagnostics).includes("DRAFT_PAGE_IN_RELEASE"))
    assert.ok(
      diagnostics.some(
        ({ code, severity }) => code === "PLANNED_PAGE_MISSING" && severity === "warning",
      ),
    )
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("excluded directories are ignored while unlisted pages cannot satisfy links", async () => {
  const fixture = createFixture({
    body: "## 适用对象\n\n初学者。\n\n## 导航方法\n\n依序学习。\n\n## 有序链接\n\n1. [[unlisted]]\n\n## 完成标准\n\n完成阅读。\n\n## 更新策略\n\n定期复核。\n",
  })
  try {
    mkdirSync(join(fixture.contentRoot, "templates"), { recursive: true })
    mkdirSync(join(fixture.contentRoot, ".obsidian"), { recursive: true })
    writeFileSync(join(fixture.contentRoot, "templates", "模板.md"), "<!-- fill -->", "utf8")
    writeFileSync(join(fixture.contentRoot, ".obsidian", "README.md"), "TODO", "utf8")
    writeFileSync(join(fixture.contentRoot, "unlisted.md"), "# unlisted", "utf8")

    const diagnostics = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "author",
    })

    assert.ok(codes(diagnostics).includes("UNLISTED_CONTENT_PAGE"))
    assert.ok(codes(diagnostics).includes("BROKEN_INTERNAL_LINK"))
    assert.ok(!diagnostics.some(({ file }) => /templates|\.obsidian/.test(file)))
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("manifest entries cannot promote excluded directories into formal pages", async () => {
  for (const reservedDirectory of ["templates", ".obsidian"]) {
    const fixture = createFixture()
    try {
      rmSync(join(fixture.contentRoot, "index.md"))
      mkdirSync(join(fixture.contentRoot, reservedDirectory), { recursive: true })
      writeFileSync(
        join(fixture.contentRoot, reservedDirectory, "hidden.md"),
        indexPage({ body: "TODO" }),
        "utf8",
      )
      replaceManifestPages(fixture, [
        {
          ...manifestPages()[0],
          file: `${reservedDirectory}/hidden.md`,
        },
      ])

      const diagnostics = await validateContent({
        contentRoot: fixture.contentRoot,
        manifestPath: fixture.manifestPath,
        mode: "author",
      })

      assert.ok(codes(diagnostics).includes("MANIFEST_EXCLUDED_FILE"))
      assert.match(
        diagnostics.find(({ code }) => code === "CONTENT_COUNT_OUT_OF_RANGE")?.message ?? "",
        /正式页面数量 0\b/,
      )
      assert.ok(!codes(diagnostics).includes("PLACEHOLDER_TEXT"))
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  }
})

test("parse failures and manifest failures become stable diagnostics", async () => {
  const fixture = createFixture()
  try {
    writeFileSync(join(fixture.contentRoot, "index.md"), "---\ntitle: [\n---\n", "utf8")
    const parseDiagnostics = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "author",
    })
    assert.ok(codes(parseDiagnostics).includes("CONTENT_PARSE_ERROR"))

    writeFileSync(fixture.manifestPath, "version: [", "utf8")
    const manifestDiagnostics = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "author",
    })
    assert.equal(manifestDiagnostics.length, 1)
    assert.match(manifestDiagnostics[0].code, /^MANIFEST_/)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("symlinked manifest pages cannot escape the content root", async () => {
  const fixture = createFixture()
  try {
    const outside = join(fixture.root, "outside.md")
    writeFileSync(outside, indexPage(), "utf8")
    rmSync(join(fixture.contentRoot, "index.md"))
    symlinkSync(outside, join(fixture.contentRoot, "index.md"))

    const diagnostics = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "author",
    })
    assert.ok(codes(diagnostics).includes("CONTENT_PARSE_ERROR"))
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("broken manifest-page symlinks are errors rather than planned missing warnings", async () => {
  const fixture = createFixture()
  try {
    rmSync(join(fixture.contentRoot, "index.md"))
    symlinkSync(join(fixture.root, "missing.md"), join(fixture.contentRoot, "index.md"))

    const diagnostics = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "author",
    })

    assert.ok(
      diagnostics.some(
        ({ code, file, severity }) =>
          code === "CONTENT_PARSE_ERROR" && file === "index.md" && severity === "error",
      ),
    )
    assert.ok(
      !diagnostics.some(({ code, file }) => code === "PLANNED_PAGE_MISSING" && file === "index.md"),
    )
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("diagnostics are deduplicated and sorted deterministically", async () => {
  const fixture = createFixture({
    body: "## 适用对象\n\n初学者。\n\n## 导航方法\n\n依序学习。\n\n## 有序链接\n\n1. [[不存在]]\n2. [[不存在]]\n\n## 完成标准\n\n完成阅读。\n\n## 更新策略\n\n定期复核。\n",
  })
  try {
    const first = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "author",
    })
    const second = await validateContent({
      contentRoot: fixture.contentRoot,
      manifestPath: fixture.manifestPath,
      mode: "author",
    })

    assert.deepEqual(first, second)
    assert.equal(first.filter(({ code }) => code === "BROKEN_INTERNAL_LINK").length, 1)
    assert.deepEqual(
      first,
      [...first].sort((left, right) => {
        if (left.file !== right.file) return left.file < right.file ? -1 : 1
        if (left.severity !== right.severity) return left.severity === "error" ? -1 : 1
        if (left.code !== right.code) return left.code < right.code ? -1 : 1
        return left.message < right.message ? -1 : left.message > right.message ? 1 : 0
      }),
    )
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("CLI exits 0 for warnings, 1 for validation errors, and repeats stdout byte-for-byte", () => {
  const authorFixture = createFixture()
  const releaseFixture = createFixture({ draft: true })
  try {
    const args = [
      "--mode",
      "author",
      "--content-root",
      authorFixture.contentRoot,
      "--manifest",
      authorFixture.manifestPath,
    ]
    const first = runCli(...args)
    const second = runCli(...args)
    const release = runCli(
      "--mode",
      "release",
      "--content-root",
      releaseFixture.contentRoot,
      "--manifest",
      releaseFixture.manifestPath,
    )

    assert.equal(first.status, 0, first.stderr)
    assert.equal(second.status, 0, second.stderr)
    assert.equal(first.stdout, second.stdout)
    assert.match(first.stdout, /WARNING CONTENT_COUNT_OUT_OF_RANGE content\/:/)
    assert.match(first.stdout, /Summary: 0 error\(s\), 3 warning\(s\)/)
    assert.equal(release.status, 1, release.stderr)
    assert.match(release.stdout, /ERROR DRAFT_PAGE_IN_RELEASE content\/index\.md:/)
  } finally {
    rmSync(authorFixture.root, { recursive: true, force: true })
    rmSync(releaseFixture.root, { recursive: true, force: true })
  }
})

test("CLI keeps malformed custom manifests in one manifest-namespaced diagnostic line", () => {
  const fixture = createFixture()
  try {
    const customManifest = join(fixture.root, "custom.yml")
    writeFileSync(customManifest, "version: [", "utf8")
    const result = runCli(
      "--mode",
      "author",
      "--content-root",
      fixture.contentRoot,
      "--manifest",
      customManifest,
    )
    const lines = result.stdout.trimEnd().split(/\r?\n/)

    assert.equal(result.status, 1, result.stderr)
    assert.equal(lines.length, 2)
    assert.match(lines[0], /^ERROR MANIFEST_READ_ERROR /)
    assert.ok(lines[0].includes(`${customManifest}:`))
    assert.ok(!lines[0].includes(`content/${customManifest}`))
    assert.match(lines[1], /^Summary: 1 error\(s\), 0 warning\(s\)$/)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("CLI rejects invalid, unknown, or incomplete arguments with exit 2", () => {
  const fixture = createFixture()
  try {
    const invalidMode = runCli("--mode", "preview")
    const unknown = runCli("--unknown")
    const missingValue = runCli("--manifest")

    assert.equal(invalidMode.status, 2)
    assert.equal(unknown.status, 2)
    assert.equal(missingValue.status, 2)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test("CLI rejects empty or whitespace-only option values with exit 2", () => {
  for (const [flag, value] of [
    ["--manifest", ""],
    ["--manifest", "   "],
    ["--content-root", ""],
    ["--content-root", "\t"],
    ["--mode", ""],
    ["--mode", "   "],
  ]) {
    assert.equal(runCli(flag, value).status, 2, `${flag} ${JSON.stringify(value)}`)
  }
})

test("CLI rejects every repeated option flag with exit 2", () => {
  const fixture = createFixture()
  try {
    const cases = [
      ["--mode", "author", "--mode", "release"],
      ["--content-root", fixture.contentRoot, "--content-root", fixture.contentRoot],
      ["--manifest", fixture.manifestPath, "--manifest", fixture.manifestPath],
    ]

    for (const args of cases) {
      assert.equal(runCli(...args).status, 2, args.join(" "))
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})
