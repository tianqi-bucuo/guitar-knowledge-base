import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { loadManifest } from "../../scripts/content/loadManifest"
import { parsePage, type PageRecord } from "../../scripts/content/parsePage"
import { resolveInternalLinks, validateLinks } from "../../scripts/content/validateLinks"
import { validateContent } from "../../scripts/content/validateContent"

const directory = "09-术语与参考资料"
const titles = ["吉他术语表", "和弦索引", "节奏型索引", "常见问题索引", "参考来源总表"]
const slugs = ["glossary", "chords", "rhythms", "faq", "sources"]
const descriptions = [
  "术语查阅与 canonical 课程入口",
  "按学习顺序查找和弦课程与既有指法图",
  "按节拍与演奏模式查找节奏课程和既有图示",
  "从常见学习与维护问题进入对应 canonical 页面",
  "按权威类别汇总本站实际引用的来源",
]
const tags = [["术语"], ["索引", "和弦"], ["索引", "节奏"], ["索引", "排错"], ["索引", "来源"]]
const returnPaths = ["index", "00-从这里开始/如何使用知识库", "00-从这里开始/学习路线总览"]
const referencePaths = titles.map((title) => `${directory}/${title}`)
const chords = [
  "02-和弦系统/和弦图读法",
  "02-和弦系统/Em与E和弦",
  "02-和弦系统/Am与A和弦",
  "02-和弦系统/C和弦",
  "02-和弦系统/G和弦",
  "02-和弦系统/D与Dm和弦",
  "02-和弦系统/常用七和弦",
  "02-和弦系统/和弦转换方法",
  "02-和弦系统/C-G-Am-Em和弦进行",
  "02-和弦系统/C-Am-F-G和弦进行",
  "02-和弦系统/F简化指法与横按准备",
  "02-和弦系统/F大横按与移动和弦",
  "04-演奏技巧/分解和弦基础",
  "04-演奏技巧/常用分解和弦型",
  "05-弹唱与伴奏/变调夹原理与用法",
  "05-弹唱与伴奏/和弦级数与移调",
  "06-基础乐理与指板/三和弦构成",
  "06-基础乐理与指板/顺阶和弦与级数",
]
const rhythms = [
  "03-节奏系统/节拍拍号与小节",
  "03-节奏系统/第一次使用节拍器",
  "03-节奏系统/四分八分与十六分音符",
  "03-节奏系统/放松而稳定的扫弦动作",
  "03-节奏系统/四拍全下扫",
  "03-节奏系统/基础八分音符扫弦",
  "03-节奏系统/重音与强弱层次",
  "03-节奏系统/切分节奏入门",
  "03-节奏系统/三拍子伴奏",
  "03-节奏系统/六八拍伴奏",
  "04-演奏技巧/分解和弦基础",
  "04-演奏技巧/常用分解和弦型",
  "04-演奏技巧/交替低音",
  "05-弹唱与伴奏/弹唱协调训练",
  "05-弹唱与伴奏/主歌与副歌的伴奏对比",
  "05-弹唱与伴奏/完整歌曲编配流程",
  "07-练习与复盘/节拍器进阶用法",
  "07-练习与复盘/慢练与逐级提速",
]
const faq = [
  "00-从这里开始/开始前自测",
  "00-从这里开始/吉他调音与标准音",
  "01-持琴与基础动作/坐姿与站姿",
  "01-持琴与基础动作/左手拇指与手腕",
  "01-持琴与基础动作/正确按弦",
  "01-持琴与基础动作/拨片握法与上下拨",
  "01-持琴与基础动作/相邻弦与跨弦",
  "02-和弦系统/和弦图读法",
  "02-和弦系统/和弦转换方法",
  "02-和弦系统/F简化指法与横按准备",
  "02-和弦系统/G和弦",
  "03-节奏系统/第一次使用节拍器",
  "03-节奏系统/放松而稳定的扫弦动作",
  "03-节奏系统/切分节奏入门",
  "03-节奏系统/六八拍伴奏",
  "04-演奏技巧/左手制音",
  "04-演奏技巧/右手制音",
  "04-演奏技巧/击弦与勾弦",
  "04-演奏技巧/自然泛音与打板",
  "05-弹唱与伴奏/根据人声选择调",
  "05-弹唱与伴奏/变调夹原理与用法",
  "05-弹唱与伴奏/前奏间奏与尾奏",
  "05-弹唱与伴奏/弹唱协调训练",
  "06-基础乐理与指板/音高音名与唱名",
  "06-基础乐理与指板/全音与半音",
  "06-基础乐理与指板/调与调号",
  "06-基础乐理与指板/顺阶和弦与级数",
  "07-练习与复盘/有效练习流程",
  "07-练习与复盘/节拍器进阶用法",
  "07-练习与复盘/慢练与逐级提速",
  "07-练习与复盘/练习日志模板",
  "07-练习与复盘/错误诊断与修正",
  "07-练习与复盘/阶段测验",
  "08-保养安全与排错/疼痛疲劳与停止练习边界",
  "08-保养安全与排错/闷音与杂音排查",
  "08-保养安全与排错/更换琴弦",
  "08-保养安全与排错/弦距琴颈与品丝基础",
  "08-保养安全与排错/清洁湿度与存放",
]
const chordDiagrams = [
  "e-minor",
  "e-major",
  "a-minor",
  "a-major",
  "c-major",
  "g-major",
  "d-major",
  "d-minor",
  "e7-open",
  "a7-open",
  "d7-open",
  "f-major-simplified",
  "f-major-barre",
].map((name) => `../assets/diagrams/chord-${name}.svg`)
const rhythmDiagrams = ["four-downstrokes", "basic-eighth-strum", "six-eight-arpeggio-pulse"].map(
  (name) => `../assets/diagrams/rhythm-${name}.svg`,
)
const manifest = loadManifest("data/content-manifest.yml")
function pages(): PageRecord[] {
  return manifest.pages
    .filter((entry) => existsSync(join("content", entry.file)))
    .map((entry) => ({ ...parsePage(join("content", entry.file)), contentPath: entry.file }))
}
function wikiPaths(page: PageRecord): string[] {
  return (page.linkTargets ?? [])
    .filter((link) => link.kind === "wikilink")
    .map((link) => link.raw.split("|")[0])
}
function assertDiagrams(links: string[], expected: string[]): void {
  assert.deepEqual(
    links.filter((link) => link.endsWith(".svg")),
    expected,
    "DIAGRAM_COVERAGE",
  )
}
function reachable(
  all: PageRecord[],
  edges: Array<{ source: string; target: string }>,
): Set<string> {
  const reached = new Set(["index.md", "00-从这里开始/学习路线总览.md"])
  const queue = [...reached]
  for (let i = 0; i < queue.length; i += 1)
    for (const edge of edges.filter((edge) => edge.source === queue[i]))
      if (!reached.has(edge.target)) {
        reached.add(edge.target)
        queue.push(edge.target)
      }
  return new Set(
    all.filter((page) => reached.has(page.contentPath!)).map((page) => page.contentPath!),
  )
}
const normalize = (url: string) => url.replace(/\/$/u, "")
interface Citation {
  url: string
  date: string
}
function citations(body: string): Citation[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body)
  const definitions = new Map<string, Citation>()
  const references = new Set<string>()
  visit(tree, "footnoteDefinition", (node) => {
    assert.ok(!definitions.has(node.identifier), "SOURCE_DUPLICATE_DEFINITION")
    const urls: string[] = []
    visit(node, "link", (link) => {
      urls.push(link.url)
    })
    assert.equal(urls.length, 1, "SOURCE_DEFINITION_URL")
    const raw = body.slice(node.position!.start.offset!, node.position!.end.offset!)
    const date = raw.match(/访问日期：(\d{4}-\d{2}-\d{2})/u)?.[1]
    assert.ok(date, "SOURCE_DATE")
    definitions.set(node.identifier, { url: normalize(urls[0]), date })
  })
  visit(tree, "footnoteReference", (node) => {
    references.add(node.identifier)
  })
  assert.deepEqual([...references].sort(), [...definitions.keys()].sort(), "SOURCE_PAIRING")
  // remark retains unknown footnotes as text, so separately reject an undefined marker.
  const prose = body.replace(/^\[\^.+$/gmu, "")
  for (const match of prose.matchAll(/\[\^([^\]]+)\]/gu))
    assert.ok(definitions.has(match[1]), "SOURCE_PAIRING")
  return [...definitions.values()]
}
function assertCatalog(body: string, cited: Citation[]): void {
  const rows = body.split("\n").filter((line) => line.startsWith("- ["))
  const records = rows.map((line) => {
    const match = /^- \[(.+)\]\((https?:\/\/\S+)\) — (.+)；访问日期：(\d{4}-\d{2}-\d{2})$/u.exec(
      line,
    )
    assert.ok(match, "SOURCE_CATALOG_FORMAT")
    return { url: normalize(match[2]), date: match[4] }
  })
  assert.equal(
    new Set(records.map((record) => record.url)).size,
    records.length,
    "SOURCE_CATALOG_DUPLICATE",
  )
  const latest = new Map<string, string>()
  for (const citation of cited)
    if (!latest.has(citation.url) || latest.get(citation.url)! < citation.date)
      latest.set(citation.url, citation.date)
  assert.deepEqual(
    records.map((record) => record.url).sort(),
    [...latest.keys()].sort(),
    "SOURCE_CATALOG_COVERAGE",
  )
  for (const record of records)
    assert.equal(record.date, latest.get(record.url), "SOURCE_LATEST_DATE")
}

test("five reference pages supply exact metadata, structure, canonical returns and ordered navigation", () => {
  for (let i = 0; i < titles.length; i += 1) {
    const file = join("content", `${referencePaths[i]}.md`)
    assert.ok(existsSync(file), `missing reference page: ${titles[i]}`)
    const page = parsePage(file)
    assert.deepEqual(page.frontmatter, {
      title: titles[i],
      description: descriptions[i],
      permalink: `/reference/${slugs[i]}`,
      type: i === 0 ? "glossary" : "index",
      tags: tags[i],
      draft: false,
    })
    assert.equal(page.body.match(/^# (.+)$/mu)?.[1], titles[i])
    assert.deepEqual(
      [...page.body.matchAll(/^## (.+)$/gmu)].map((match) => match[1]),
      i === 0
        ? ["术语条目", "参考来源与延伸阅读"]
        : ["适用对象", "导航方法", "有序链接", "完成标准", "更新策略"],
    )
    const paths = wikiPaths(page)
    const navigation = [
      ...returnPaths,
      ...referencePaths.filter((path) => path !== referencePaths[i]),
    ]
    assert.deepEqual(
      paths.filter((path) => navigation.includes(path)),
      navigation,
    )
    for (const link of page.linkTargets ?? [])
      if (link.kind === "wikilink") {
        const entry = manifest.pages.find(
          (entry) => entry.file.slice(0, -3) === link.raw.split("|")[0],
        )
        assert.ok(entry, `canonical path: ${link.raw}`)
        assert.equal(link.raw, `${entry.file.slice(0, -3)}|${entry.title}`)
      }
    assert.deepEqual(page.embeds, [])
    if (i > 0) {
      const lists: boolean[] = []
      visit(
        unified()
          .use(remarkParse)
          .use(remarkGfm)
          .parse(page.body.split("## 有序链接")[1].split("## 完成标准")[0]),
        "list",
        (node) => {
          lists.push(Boolean(node.ordered && node.children.length))
        },
      )
      assert.ok(lists.includes(true), "missing ordered navigation")
    }
  }
})
test("topic indexes cover the prescribed course order and original diagram links", () => {
  for (const [i, expected] of [
    [1, chords],
    [2, rhythms],
    [3, faq],
  ] as const) {
    const page = parsePage(join("content", `${referencePaths[i]}.md`))
    assert.deepEqual(
      wikiPaths(page).filter(
        (path) => !returnPaths.includes(path) && !referencePaths.includes(path),
      ),
      expected,
    )
    if (i < 3) assertDiagrams(page.links, i === 1 ? chordDiagrams : rhythmDiagrams)
  }
})
test("glossary defines representative concepts and final practice/care increments with course provenance", () => {
  const page = parsePage(join("content", `${referencePaths[0]}.md`))
  for (const [term, target, concept] of [
    ["品位", "01-持琴与基础动作/正确按弦", "位置"],
    ["品丝", "01-持琴与基础动作/认识民谣吉他", "金属"],
    ["小调", "06-基础乐理与指板/调与调号", "共享调号"],
    ["清晰速度", "07-练习与复盘/慢练与逐级提速", "自填"],
    ["弦距", "08-保养安全与排错/弦距琴颈与品丝基础", "距离"],
    ["打品", "08-保养安全与排错/闷音与杂音排查", "品丝"],
  ]) {
    const row = page.body.split("\n").find((line) => line.startsWith(`- **${term}`))
    assert.ok(row, `${term}: definition missing`)
    assert.ok(row.includes(target), `${term}: canonical definition missing`)
    assert.ok(row.includes(concept), `${term}: defining distinction missing`)
  }
  for (const term of [
    "基线",
    "复盘",
    "慢练",
    "换弦",
    "琴颈调节杆",
    "弦枕",
    "琴颈角度",
    "杂音",
    "拍点",
    "TAB",
    "调音",
  ])
    assert.ok(page.body.includes(`**${term}`), `missing final inventory: ${term}`)
})
test("source catalog equals actual cited URLs, deduplicates identity and uses latest real citation dates", () => {
  const all = pages()
  const cited = all
    .filter((page) => page.contentPath !== `${referencePaths[4]}.md`)
    .flatMap((page) => citations(page.body))
  assert.equal(new Set(cited.map((citation) => citation.url)).size, 81)
  assertCatalog(parsePage(join("content", `${referencePaths[4]}.md`)).body, cited)
})
test("catalog rejects uncited and conflicting duplicate entries while accepting historical title/date variants", () => {
  const cited = citations(
    "A[^old] B[^new]\n\n[^old]: [Old](https://example.org/source/) — Author；访问日期：2026-10-01\n\n[^new]: [New](https://example.org/source) — Author full；访问日期：2026-10-02",
  )
  const row = "- [New](https://example.org/source/) — Author full；访问日期：2026-10-02"
  assertCatalog(row, cited)
  assert.throws(
    () =>
      assertCatalog(
        row + "\n- [Other](https://example.org/uncited) — Author；访问日期：2026-10-02",
        cited,
      ),
    /SOURCE_CATALOG_COVERAGE/u,
  )
  assert.throws(
    () =>
      assertCatalog(
        row + "\n- [Conflict](https://example.org/source) — Other；访问日期：2026-10-01",
        cited,
      ),
    /SOURCE_CATALOG_DUPLICATE/u,
  )
  assert.throws(() => citations("A[^absent]"), /SOURCE_PAIRING/u)
  assert.throws(() => assertDiagrams(chordDiagrams.slice(1), chordDiagrams), /DIAGRAM_COVERAGE/u)
})
test("all 75 pages are reachable and validators accept publication without errors or warnings", async () => {
  const all = pages()
  assert.equal(all.length, 75)
  assert.deepEqual(
    Object.fromEntries(
      ["lesson", "index", "path", "glossary"].map((type) => [
        type,
        all.filter((page) => page.frontmatter.type === type).length,
      ]),
    ),
    { lesson: 66, index: 6, path: 2, glossary: 1 },
  )
  assert.equal(
    new Set(
      manifest.pages
        .filter((entry) => all.some((page) => page.contentPath === entry.file))
        .map((entry) => entry.module),
    ).size,
    10,
  )
  assert.deepEqual(validateLinks(all, "content"), [])
  assert.equal(reachable(all, resolveInternalLinks(all, "content")).size, 75)
  for (const mode of ["author", "release"] as const)
    assert.deepEqual(
      await validateContent({
        contentRoot: "content",
        manifestPath: "data/content-manifest.yml",
        mode,
      }),
      [],
    )
  const position = new Map(manifest.pages.map((entry, index) => [entry.title, index]))
  for (const page of all)
    for (const prerequisite of (page.frontmatter.prerequisites ?? []) as string[])
      assert.ok(
        position.get(prerequisite)! < position.get(page.frontmatter.title as string)!,
        "forward prerequisite",
      )
  const home = readFileSync("content/index.md", "utf8")
  for (const path of referencePaths) assert.ok(home.includes(`[[${path}|`), "home reference entry")
  assert.ok(
    readFileSync("content/00-从这里开始/学习路线总览.md", "utf8").match(
      /^10\. .*\[\[09-术语与参考资料\/吉他术语表\|吉他术语表\]\]/mu,
    ),
  )
})
test("real link resolver rejects an unknown canonical target and reachability exposes an isolated page", () => {
  const all = pages()
  const source = all[0]
  const mutation = {
    ...source,
    links: ["09-术语与参考资料/不存在|不存在"],
    linkTargets: [{ raw: "09-术语与参考资料/不存在|不存在", kind: "wikilink" as const }],
  }
  assert.ok(
    validateLinks([mutation, ...all.slice(1)], "content").some(
      (item) => item.code === "BROKEN_INTERNAL_LINK",
    ),
  )
  const isolated = { ...source, contentPath: "isolated.md" }
  assert.ok(!reachable([...all, isolated], resolveInternalLinks(all, "content")).has("isolated.md"))
})
