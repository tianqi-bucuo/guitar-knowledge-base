import assert from "node:assert/strict"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

test("resolves full, collapsed, and shortcut reference links and images in source order", () => {
  const source = parsePage(`${contentRoot}/nested/reference-source.md`)
  const pages = [source, parsePage(`${contentRoot}/notes/目标页面.md`)]
  const resolved = resolveInternalLinks(pages, contentRoot)

  assert.deepEqual(source.linkTargets, [
    { raw: "../notes/目标页面.md#目标-标题", kind: "markdown-link" },
    { raw: "../assets/valid.svg", kind: "markdown-image" },
    { raw: "../notes/目标页面.md", kind: "markdown-link" },
    { raw: "../assets/valid.svg", kind: "markdown-image" },
    { raw: "../notes/目标页面.md", kind: "markdown-link" },
    { raw: "../assets/valid.svg", kind: "markdown-image" },
  ])
  assert.deepEqual(
    resolved.map(({ target }) => target),
    [
      "notes/目标页面.md#目标-标题",
      "assets/valid.svg",
      "notes/目标页面.md",
      "assets/valid.svg",
      "notes/目标页面.md",
      "assets/valid.svg",
    ],
  )
  assert.deepEqual(validateLinks(pages, contentRoot), [])
})

test("validates broken reference targets without fabricating undefined definitions", () => {
  const source = parsePage(`${contentRoot}/nested/broken-reference-source.md`)

  assert.deepEqual(source.linkTargets, [
    { raw: "../notes/不存在.md", kind: "markdown-link" },
    { raw: "../assets/不存在.png", kind: "markdown-image" },
  ])
  assert.deepEqual(
    validateLinks([source], contentRoot).map(({ code }) => code),
    ["BROKEN_INTERNAL_LINK", "MISSING_LOCAL_ASSET"],
  )
})

test("keeps Markdown relative paths distinct from wikilink shortest paths", () => {
  const source = parsePage(`${contentRoot}/nested/source.md`)
  const rootTarget = parsePage(`${contentRoot}/root-only.md`)
  const pages = [source, rootTarget]
  const resolved = resolveInternalLinks(pages, contentRoot)
  const diagnostics = validateLinks(pages, contentRoot)

  assert.deepEqual(
    source.linkTargets?.map((target) => target.kind),
    ["markdown-link", "wikilink"],
  )
  assert.equal(targetFor(resolved, "root-only.md"), undefined)
  assert.equal(targetFor(resolved, "root-only"), "root-only.md")
  assert.ok(
    diagnostics.some(
      (item) => item.code === "BROKEN_INTERNAL_LINK" && item.message.includes("root-only.md"),
    ),
  )
})

test("keeps Markdown images in the asset branch while wiki embeds transclude pages", () => {
  const source = parsePage(`${contentRoot}/image-source.md`)
  const rootTarget = parsePage(`${contentRoot}/root-only.md`)
  const permalinkTarget = parsePage(`${contentRoot}/permalink-page.md`)
  const pages = [source, rootTarget, permalinkTarget]
  const resolved = resolveInternalLinks(pages, contentRoot)
  const diagnostics = validateLinks(pages, contentRoot)

  assert.deepEqual(source.linkTargets, [
    { raw: "root-only", kind: "markdown-image" },
    { raw: "/virtual-page.md", kind: "markdown-image" },
    { raw: "root-only|普通页面链接", kind: "wikilink" },
    { raw: "root-only|页面嵌入", kind: "wiki-embed" },
  ])
  assert.deepEqual(
    resolved.map(({ raw, target }) => ({ raw, target })),
    [
      { raw: "root-only|普通页面链接", target: "root-only.md" },
      { raw: "root-only|页面嵌入", target: "root-only.md" },
    ],
  )
  assert.deepEqual(
    diagnostics.map(({ code, message }) => ({ code, message })),
    [
      { code: "MISSING_LOCAL_ASSET", message: "找不到本地附件: root-only" },
      { code: "MISSING_LOCAL_ASSET", message: "找不到本地附件: virtual-page.md" },
    ],
  )
})

test("reports missing pages, missing assets, and duplicate basename ambiguity separately", () => {
  const codes = validateLinks(fixturePages(), contentRoot).map((item) => item.code)

  assert.ok(codes.includes("BROKEN_INTERNAL_LINK"))
  assert.ok(codes.includes("MISSING_LOCAL_ASSET"))
  assert.ok(codes.includes("AMBIGUOUS_INTERNAL_LINK"))
})

test("deduplicates exact diagnostics from repeated targets", () => {
  const page = pageWithTargets(
    ["不存在页面", "不存在页面"],
    ["assets/missing.svg", "assets/missing.svg"],
  )

  assert.deepEqual(
    validateLinks([page], contentRoot).map((item) => item.code),
    ["BROKEN_INTERNAL_LINK", "MISSING_LOCAL_ASSET"],
  )
})

test("reports ambiguity across file, permalink, and alias namespaces", () => {
  const source = pageWithTargets(["collision"])
  const page = (file: string, permalink: string, aliases: string[] = []): PageRecord => ({
    ...pageWithTargets([]),
    file: `${contentRoot}/${file}`,
    frontmatter: { permalink, aliases },
  })
  const pages = [
    source,
    page("collision.md", "/tests/file-owner"),
    page("permalink-owner.md", "/collision"),
    page("alias-owner.md", "/tests/alias-owner", ["collision"]),
  ]

  assert.equal(targetFor(resolveInternalLinks(pages, contentRoot), "collision"), undefined)
  assert.deepEqual(
    validateLinks(pages, contentRoot).map((item) => item.code),
    ["AMBIGUOUS_INTERNAL_LINK"],
  )
})

test("rejects invalid encoding, internal queries, traversal, missing fragments, and blocks", () => {
  const codes = validateLinks(fixturePages(), contentRoot).map((item) => item.code)

  assert.ok(codes.includes("INVALID_INTERNAL_TARGET"))
  assert.ok(codes.includes("PATH_TRAVERSAL_TARGET"))
  assert.ok(codes.includes("BROKEN_FRAGMENT"))
  assert.ok(codes.includes("UNSUPPORTED_FRAGMENT"))
})

test("decodes paths before rejecting reserved characters and classifying extensions", () => {
  const page = pageWithTargets([
    "assets/valid%2Esvg",
    "notes/目标页面%3Fview=1.md",
    "notes/目标页面%5Cother.md",
    "assets/valid%00.svg",
    "%2E%2E/outside.md",
  ])
  const pages = [page, parsePage(`${contentRoot}/notes/目标页面.md`)]
  const resolved = resolveInternalLinks(pages, contentRoot)
  const codes = validateLinks(pages, contentRoot).map((item) => item.code)

  assert.equal(targetFor(resolved, "assets/valid%2Esvg"), "assets/valid.svg")
  assert.deepEqual(codes, [
    "INVALID_INTERNAL_TARGET",
    "INVALID_INTERNAL_TARGET",
    "INVALID_INTERNAL_TARGET",
    "PATH_TRAVERSAL_TARGET",
  ])
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

test("requires the SVG namespace on the root and every descendant element", () => {
  const page = pageWithTargets([
    "assets/wrong-namespace.svg",
    "assets/missing-namespace.svg",
    "assets/wrong-descendant-namespace.svg",
  ])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET", "INVALID_SVG_ASSET", "INVALID_SVG_ASSET"],
  )
})

test("rejects script and foreignObject elements case-insensitively", () => {
  const page = pageWithTargets(["assets/unsafe-script.svg", "assets/unsafe-foreign-object.svg"])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET", "INVALID_SVG_ASSET"],
  )
})

test("rejects event-handler attributes case-insensitively", () => {
  const page = pageWithTargets(["assets/unsafe-event.svg"])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET"],
  )
})

test("rejects network, protocol-relative, and data SVG references", () => {
  const page = pageWithTargets([
    "assets/unsafe-http-href.svg",
    "assets/unsafe-https-href.svg",
    "assets/unsafe-protocol-relative-href.svg",
    "assets/unsafe-data-href.svg",
  ])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET", "INVALID_SVG_ASSET", "INVALID_SVG_ASSET", "INVALID_SVG_ASSET"],
  )
})

test("rejects SVG href protocols hidden by XML character references", () => {
  const page = pageWithTargets([
    "assets/unsafe-https-character-reference.svg",
    "assets/unsafe-protocol-relative-character-reference.svg",
    "assets/unsafe-data-character-reference.svg",
  ])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET", "INVALID_SVG_ASSET", "INVALID_SVG_ASSET"],
  )
})

test("rejects every empty or non-fragment SVG href", () => {
  const page = pageWithTargets([
    "assets/unsafe-javascript-href.svg",
    "assets/unsafe-relative-href.svg",
    "assets/unsafe-empty-href.svg",
  ])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET", "INVALID_SVG_ASSET", "INVALID_SVG_ASSET"],
  )
})

test("accepts generated-style SVG with a local fragment reference", () => {
  const page = pageWithTargets([
    "assets/valid.svg",
    "assets/safe-generated.svg",
    "assets/safe-local-paint.svg",
  ])

  assert.deepEqual(validateLinks([page], contentRoot), [])

  const diagrams = readdirSync("content/assets/diagrams")
    .filter((file) => file.endsWith(".svg"))
    .sort()
  const productionPage: PageRecord = {
    ...pageWithTargets(
      [],
      diagrams.map((file) => `assets/diagrams/${file}`),
    ),
    file: "content/diagram-validator-probe.md",
  }
  assert.equal(diagrams.length, 14)
  assert.deepEqual(validateLinks([productionPage], "content"), [])
})

test("rejects xml:base that redirects a local-looking fragment", () => {
  const page = pageWithTargets(["assets/unsafe-xml-base.svg"])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET"],
  )
})

test("rejects elements and processing instructions outside the generated SVG vocabulary", () => {
  const page = pageWithTargets([
    "assets/unsafe-style-element.svg",
    "assets/unsafe-image-element.svg",
    "assets/unsafe-fe-image-element.svg",
    "assets/unsafe-namespaced-element.svg",
    "assets/unsafe-stylesheet-pi.svg",
    "assets/unsafe-other-pi.svg",
  ])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    Array.from({ length: 6 }, () => "INVALID_SVG_ASSET"),
  )
})

test("rejects a malformed lowercase XML declaration processing instruction", () => {
  const page = pageWithTargets(["assets/unsafe-malformed-xml-declaration.svg"])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET"],
  )
})

test("rejects a case-invalid XML declaration processing instruction", () => {
  const page = pageWithTargets(["assets/unsafe-uppercase-xml-declaration.svg"])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET"],
  )
})

test("rejects UTF-8 bytes whose XML declaration claims UTF-16", () => {
  const page = pageWithTargets(["assets/unsafe-utf16-declaration-on-utf8.svg"])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    ["INVALID_SVG_ASSET"],
  )
})

test("accepts a valid XML declaration after one UTF-8 BOM", () => {
  const page = pageWithTargets(["assets/safe-utf8-bom-declaration.svg"])

  assert.deepEqual(validateLinks([page], contentRoot), [])
})

test("rejects invalid UTF-8 bytes instead of decoding replacement characters", () => {
  const root = mkdtempSync(join(tmpdir(), "guitar-svg-invalid-utf8-"))
  const assets = join(root, "assets")
  try {
    mkdirSync(assets, { recursive: true })
    writeFileSync(
      join(assets, "invalid.svg"),
      Buffer.concat([
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><title>', "utf8"),
        Buffer.from([0xc3, 0x28]),
        Buffer.from("</title></svg>", "utf8"),
      ]),
    )
    const page: PageRecord = {
      ...pageWithTargets([], ["assets/invalid.svg"]),
      file: join(root, "source.md"),
    }

    assert.deepEqual(
      validateLinks([page], root).map(({ code }) => code),
      ["INVALID_SVG_ASSET"],
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("accepts only one first-node XML declaration with complete ordered grammar", () => {
  const root = mkdtempSync(join(tmpdir(), "guitar-svg-declaration-"))
  const assets = join(root, "assets")
  const svg = (prefix: string, nested = "") =>
    `${prefix}<svg xmlns="http://www.w3.org/2000/svg"><title>XML declaration probe</title>${nested}</svg>`
  const valid = [
    ["minimal", svg('<?xml version="1.0"?>')],
    ["complete", svg("<?xml version = '1.1' encoding = 'UTF-8' standalone = 'no'?>")],
    ["lowercase-encoding", svg('<?xml version="1.0" encoding="utf-8"?>')],
  ] as const
  const invalid = [
    ["missing-version", svg('<?xml encoding="UTF-8"?>')],
    ["unsupported-version", svg('<?xml version="1.2"?>')],
    ["unquoted-version", svg("<?xml version=1.0?>")],
    ["reordered-version", svg('<?xml encoding="UTF-8" version="1.0"?>')],
    ["invalid-encoding", svg('<?xml version="1.0" encoding="8BIT"?>')],
    ["invalid-standalone", svg('<?xml version="1.0" standalone="maybe"?>')],
    ["reordered-standalone", svg('<?xml version="1.0" standalone="yes" encoding="UTF-8"?>')],
    ["extra-pseudo-attribute", svg('<?xml version="1.0" extra="x"?>')],
    ["extra-text", svg('<?xml version="1.0" trailing?>')],
    ["not-first-node", svg('<!--before--><?xml version="1.0"?>')],
    ["multiple", svg('<?xml version="1.0"?><?xml version="1.0"?>')],
    ["nested", svg("", '<?xml version="1.0"?>')],
  ] as const

  try {
    mkdirSync(assets, { recursive: true })
    for (const [name, source] of [...valid, ...invalid]) {
      writeFileSync(join(assets, `${name}.svg`), source, "utf8")
    }
    const probe = (names: readonly (readonly [string, string])[]) => ({
      ...pageWithTargets(
        [],
        names.map(([name]) => `assets/${name}.svg`),
      ),
      file: join(root, "source.md"),
    })

    assert.deepEqual(validateLinks([probe(valid)], root), [])
    assert.deepEqual(
      validateLinks([probe(invalid)], root).map(({ code }) => code),
      Array.from({ length: 12 }, () => "INVALID_SVG_ASSET"),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("rejects style attributes and unsafe CSS URL values after XML decoding", () => {
  const page = pageWithTargets([
    "assets/unsafe-style-attribute.svg",
    "assets/unsafe-external-paint.svg",
    "assets/unsafe-external-paint-character-reference.svg",
    "assets/unsafe-backslash-paint.svg",
  ])

  assert.deepEqual(
    validateLinks([page], contentRoot).map(({ code }) => code),
    Array.from({ length: 4 }, () => "INVALID_SVG_ASSET"),
  )
})

test("rejects SVG and non-SVG asset symlinks whose real paths escape the content root", () => {
  const root = mkdtempSync(join(tmpdir(), "guitar-assets-"))
  const temporaryContentRoot = join(root, "content")
  const assets = join(temporaryContentRoot, "assets")
  try {
    mkdirSync(assets, { recursive: true })
    writeFileSync(join(root, "outside.svg"), "<svg><title>外部图示</title></svg>", "utf8")
    writeFileSync(join(root, "outside.png"), "not really a png", "utf8")
    symlinkSync(join(root, "outside.svg"), join(assets, "escape.svg"))
    symlinkSync(join(root, "outside.png"), join(assets, "escape.png"))
    const page: PageRecord = {
      ...pageWithTargets(["assets/escape.svg", "assets/escape.png"]),
      file: join(temporaryContentRoot, "source.md"),
    }

    assert.deepEqual(
      validateLinks([page], temporaryContentRoot).map(({ code }) => code),
      ["PATH_TRAVERSAL_TARGET", "PATH_TRAVERSAL_TARGET"],
    )
    assert.deepEqual(resolveInternalLinks([page], temporaryContentRoot), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("stabilizes broken, cyclic, and non-file assets while accepting an in-root symlink", () => {
  const root = mkdtempSync(join(tmpdir(), "guitar-assets-"))
  const temporaryContentRoot = join(root, "content")
  const assets = join(temporaryContentRoot, "assets")
  try {
    mkdirSync(join(assets, "directory.bin"), { recursive: true })
    writeFileSync(
      join(assets, "valid.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"><title>站内图示</title></svg>',
      "utf8",
    )
    writeFileSync(join(assets, "unreadable.png"), "private", "utf8")
    chmodSync(join(assets, "unreadable.png"), 0o000)
    symlinkSync("valid.svg", join(assets, "in-root.svg"))
    symlinkSync("missing.svg", join(assets, "broken.svg"))
    symlinkSync("cycle-b.svg", join(assets, "cycle-a.svg"))
    symlinkSync("cycle-a.svg", join(assets, "cycle-b.svg"))
    const page: PageRecord = {
      ...pageWithTargets([
        "assets/in-root.svg",
        "assets/broken.svg",
        "assets/cycle-a.svg",
        "assets/directory.bin",
        "assets/unreadable.png",
      ]),
      file: join(temporaryContentRoot, "source.md"),
    }

    const diagnostics = validateLinks([page], temporaryContentRoot)
    assert.equal(diagnostics.filter(({ code }) => code === "MISSING_LOCAL_ASSET").length, 2)
    assert.equal(diagnostics.filter(({ code }) => code === "INVALID_LOCAL_ASSET").length, 2)
    assert.equal(
      targetFor(resolveInternalLinks([page], temporaryContentRoot), "assets/in-root.svg"),
      "assets/in-root.svg",
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the three published seed pages have no link diagnostics", () => {
  const pages = [
    parsePage("content/index.md"),
    parsePage("content/00-从这里开始/如何使用知识库.md"),
    parsePage("content/00-从这里开始/学习路线总览.md"),
  ]

  assert.deepEqual(validateLinks(pages, "content"), [])
})

test("roadmap preserves three exact previews and links both wide diagrams to their originals", () => {
  const roadmap = parsePage("content/00-从这里开始/学习路线总览.md")

  assert.deepEqual(roadmap.embeds, [
    "../assets/diagrams/chord-c-major.svg",
    "../assets/diagrams/fretboard-c-major-scale.svg",
    "../assets/diagrams/rhythm-basic-eighth-strum.svg",
  ])
  assert.match(
    roadmap.body,
    /!\[C 大三和弦图：六弦到一弦为 x-3-2-0-1-0\]\(\.\.\/assets\/diagrams\/chord-c-major\.svg\)/,
  )
  assert.match(
    roadmap.body,
    /!\[C 大调 0–5 品指板音位图，根音 C 另有文字和粗轮廓标记\]\(\.\.\/assets\/diagrams\/fretboard-c-major-scale\.svg\)/,
  )
  assert.match(
    roadmap.body,
    /!\[4\/4 基础八分音符交替扫弦图，重音在第 1 与第 3 拍\]\(\.\.\/assets\/diagrams\/rhythm-basic-eighth-strum\.svg\)/,
  )
  assert.deepEqual(
    roadmap.linkTargets?.filter(({ raw }) => raw.startsWith("../assets/diagrams/")),
    [
      { raw: "../assets/diagrams/chord-c-major.svg", kind: "markdown-image" },
      { raw: "../assets/diagrams/fretboard-c-major-scale.svg", kind: "markdown-image" },
      { raw: "../assets/diagrams/fretboard-c-major-scale.svg", kind: "markdown-link" },
      { raw: "../assets/diagrams/rhythm-basic-eighth-strum.svg", kind: "markdown-image" },
      { raw: "../assets/diagrams/rhythm-basic-eighth-strum.svg", kind: "markdown-link" },
    ],
  )
  assert.equal((roadmap.body.match(/打开原图（移动端可放大）/gu) ?? []).length, 2)
})
