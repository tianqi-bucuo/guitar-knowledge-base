import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import yaml from "js-yaml"
import { toString } from "mdast-util-to-string"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { loadManifest } from "../../scripts/content/loadManifest"
import { parsePage, type PageRecord } from "../../scripts/content/parsePage"
import { validateLinks } from "../../scripts/content/validateLinks"
import { validateMetadata } from "../../scripts/content/validateMetadata"
import { validateStructure } from "../../scripts/content/validateStructure"

interface ChordDefinition {
  id: string
  title: string
  baseFret: number
  frets: Array<number | "x">
  fingers: Array<number | null>
  barres: Array<{
    fret: number
    fromString: number
    toString: number
    finger: number
  }>
}

const loadChords = (): ChordDefinition[] =>
  yaml.load(readFileSync("data/diagrams/chords.yml", "utf8")) as ChordDefinition[]

const contentRoot = "content"
const lessonSections = [
  "学习目标与先修知识",
  "核心概念",
  "图示与操作步骤",
  "常见错误及修正",
  "分级练习",
  "自我检查标准",
  "下一步与相关词条",
  "参考来源与延伸阅读",
]
const tupleNotice = "本页所有指法数字均按六弦到一弦书写；`x` 表示不弹/制音，`0` 表示空弦。"
const shortSafetyBlock =
  "安全边界：本页不用于诊断或治疗。出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降或明显不适时，立即停止；症状持续、反复或加重时，请向合格医疗专业人士求助。"
const fullSafetyBlock =
  "本页只提供一般性练习与安全信息，不用于诊断或治疗。出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降或明显不适时，立即停止本项练习。症状持续、反复或加重，或已影响日常活动或握持能力时，请向合格医疗专业人士求助；严重疼痛、外伤后失去感觉或无法活动时，按所在地急诊指引及时就医。"
const forbiddenFixedPracticeQuotaPattern =
  /(?:[0-9]+\s*(?:秒钟?|分钟|小时|次|遍|回|组|轮|天|日|周|星期)|[0-9]+\s*BPM|BPM\s*[0-9]+)/iu

interface ExpectedLesson {
  file: string
  frontmatter: Record<string, unknown>
  sources: string[]
  diagrams: string[]
  links: string[]
}

const expectedLessons: ExpectedLesson[] = [
  {
    file: "content/02-和弦系统/和弦图读法.md",
    frontmatter: {
      title: "和弦图读法",
      description: "认识和弦图中的琴弦、品位、指号与开弦制音标记，并按六弦到一弦读出指法",
      permalink: "/chords/reading-diagrams",
      type: "lesson",
      level: "入门",
      prerequisites: ["相邻弦与跨弦"],
      tags: ["入门", "和弦"],
      draft: false,
    },
    sources: ["chart-fender", "c-fender"],
    diagrams: ["c-major"],
    links: [
      "01-持琴与基础动作/相邻弦与跨弦",
      "02-和弦系统/Em与E和弦",
      "01-持琴与基础动作/正确按弦",
    ],
  },
  {
    file: "content/02-和弦系统/Em与E和弦.md",
    frontmatter: {
      title: "Em与E和弦",
      description: "比较开放把位 Em 与 E 的按法和音高差异，并逐弦检查发声",
      permalink: "/chords/em-and-e",
      type: "lesson",
      level: "入门",
      prerequisites: ["和弦图读法"],
      tags: ["入门", "和弦", "左手"],
      draft: false,
    },
    sources: ["em-fender", "e-fender", "fretting-fender", "dynamics-fender", "safety-bapam"],
    diagrams: ["e-minor", "e-major"],
    links: ["02-和弦系统/和弦图读法", "02-和弦系统/Am与A和弦", "01-持琴与基础动作/正确按弦"],
  },
  {
    file: "content/02-和弦系统/Am与A和弦.md",
    frontmatter: {
      title: "Am与A和弦",
      description: "比较开放把位 Am 与 A 的按法和音高差异，并逐弦检查发声",
      permalink: "/chords/am-and-a",
      type: "lesson",
      level: "入门",
      prerequisites: ["Em与E和弦"],
      tags: ["入门", "和弦", "左手"],
      draft: false,
    },
    sources: ["am-fender", "a-fender", "fretting-fender", "dynamics-fender", "safety-bapam"],
    diagrams: ["a-minor", "a-major"],
    links: ["02-和弦系统/Em与E和弦", "02-和弦系统/C和弦", "01-持琴与基础动作/正确按弦"],
  },
  {
    file: "content/02-和弦系统/C和弦.md",
    frontmatter: {
      title: "C和弦",
      description: "学习开放把位 C 和弦的六弦到一弦指法，并排查闷音与误触弦",
      permalink: "/chords/c-major",
      type: "lesson",
      level: "入门",
      prerequisites: ["Am与A和弦"],
      tags: ["入门", "和弦", "左手"],
      draft: false,
    },
    sources: ["c-fender", "fretting-fender", "dynamics-fender", "safety-bapam"],
    diagrams: ["c-major"],
    links: ["02-和弦系统/Am与A和弦", "02-和弦系统/G和弦", "02-和弦系统/和弦图读法"],
  },
  {
    file: "content/02-和弦系统/G和弦.md",
    frontmatter: {
      title: "G和弦",
      description: "学习本库采用的四指开放 G 变体，并逐弦核对清晰度",
      permalink: "/chords/g-major",
      type: "lesson",
      level: "入门",
      prerequisites: ["C和弦"],
      tags: ["入门", "和弦", "左手"],
      draft: false,
    },
    sources: ["g-fender", "fretting-fender", "dynamics-fender", "safety-bapam"],
    diagrams: ["g-major"],
    links: ["02-和弦系统/C和弦", "02-和弦系统/D与Dm和弦", "02-和弦系统/和弦转换方法"],
  },
  {
    file: "content/02-和弦系统/D与Dm和弦.md",
    frontmatter: {
      title: "D与Dm和弦",
      description: "比较开放把位 D 与 Dm 的高音弦变化，并从四弦准确起奏",
      permalink: "/chords/d-and-dm",
      type: "lesson",
      level: "入门",
      prerequisites: ["G和弦"],
      tags: ["入门", "和弦", "左手"],
      draft: false,
    },
    sources: ["d-fender", "dm-fender", "fretting-fender", "dynamics-fender", "safety-bapam"],
    diagrams: ["d-major", "d-minor"],
    links: ["02-和弦系统/G和弦", "02-和弦系统/常用七和弦", "02-和弦系统/和弦转换方法"],
  },
  {
    file: "content/02-和弦系统/常用七和弦.md",
    frontmatter: {
      title: "常用七和弦",
      description: "认识 E7、A7 与 D7 的开放把位，并核对各自的七和弦音组成",
      permalink: "/chords/common-sevenths",
      type: "lesson",
      level: "基础",
      prerequisites: ["D与Dm和弦"],
      tags: ["和弦", "乐理", "练习"],
      draft: false,
    },
    sources: [
      "e7-fender",
      "a7-fender",
      "d7-fender",
      "fretting-fender",
      "dynamics-fender",
      "safety-bapam",
    ],
    diagrams: ["e7-open", "a7-open", "d7-open"],
    links: [
      "02-和弦系统/D与Dm和弦",
      "02-和弦系统/和弦转换方法",
      "02-和弦系统/Em与E和弦",
      "02-和弦系统/Am与A和弦",
    ],
  },
  {
    file: "content/02-和弦系统/和弦转换方法.md",
    frontmatter: {
      title: "和弦转换方法",
      description: "用提前预想、最小移动与可用保留指提高和弦转换的可控性",
      permalink: "/chords/changing-chords",
      type: "lesson",
      level: "基础",
      prerequisites: ["D与Dm和弦"],
      tags: ["和弦", "和弦转换", "练习"],
      draft: false,
    },
    sources: ["changes-fender", "visualization-fender", "dynamics-fender", "safety-bapam"],
    diagrams: ["c-major", "g-major"],
    links: ["02-和弦系统/D与Dm和弦", "02-和弦系统/C-G-Am-Em和弦进行", "02-和弦系统/和弦图读法"],
  },
  {
    file: "content/02-和弦系统/C-G-Am-Em和弦进行.md",
    frontmatter: {
      title: "C-G-Am-Em和弦进行",
      description: "用原创 C-G-Am-Em 循环练习四个开放和弦的连续转换",
      permalink: "/chords/c-g-am-em",
      type: "lesson",
      level: "基础",
      prerequisites: ["和弦转换方法"],
      tags: ["和弦", "和弦转换", "和弦进行", "练习"],
      draft: false,
    },
    sources: ["c-fender", "g-fender", "am-fender", "em-fender", "changes-fender", "safety-bapam"],
    diagrams: ["c-major", "g-major", "a-minor", "e-minor"],
    links: [
      "02-和弦系统/和弦转换方法",
      "02-和弦系统/C-Am-F-G和弦进行",
      "02-和弦系统/C和弦",
      "02-和弦系统/G和弦",
      "02-和弦系统/Am与A和弦",
      "02-和弦系统/Em与E和弦",
    ],
  },
  {
    file: "content/02-和弦系统/C-Am-F-G和弦进行.md",
    frontmatter: {
      title: "C-Am-F-G和弦进行",
      description: "用简化 F 形完成原创 C-Am-F-G 循环并保持逐弦清晰",
      permalink: "/chords/c-am-f-g",
      type: "lesson",
      level: "基础",
      prerequisites: ["C-G-Am-Em和弦进行"],
      tags: ["和弦", "和弦转换", "和弦进行", "横按和弦"],
      draft: false,
    },
    sources: [
      "c-fender",
      "am-fender",
      "f-fender",
      "g-fender",
      "changes-fender",
      "dynamics-fender",
      "safety-bapam",
    ],
    diagrams: ["c-major", "a-minor", "f-major-simplified", "g-major"],
    links: [
      "02-和弦系统/C-G-Am-Em和弦进行",
      "02-和弦系统/F简化指法与横按准备",
      "02-和弦系统/和弦转换方法",
      "02-和弦系统/C和弦",
      "02-和弦系统/Am与A和弦",
      "02-和弦系统/G和弦",
    ],
  },
  {
    file: "content/02-和弦系统/F简化指法与横按准备.md",
    frontmatter: {
      title: "F简化指法与横按准备",
      description: "用四弦简化 F 与两弦小横按建立低负担的横按准备",
      permalink: "/chords/f-preparation",
      type: "lesson",
      level: "基础",
      prerequisites: ["C-Am-F-G和弦进行"],
      tags: ["和弦", "横按和弦", "左手", "安全"],
      draft: false,
    },
    sources: [
      "f-fender",
      "fretting-fender",
      "dynamics-fender",
      "safety-bapam",
      "safety-nhs-rsi",
      "safety-nhs-finger",
    ],
    diagrams: ["f-major-simplified"],
    links: [
      "02-和弦系统/C-Am-F-G和弦进行",
      "02-和弦系统/F大横按与移动和弦",
      "01-持琴与基础动作/正确按弦",
    ],
  },
  {
    file: "content/02-和弦系统/F大横按与移动和弦.md",
    frontmatter: {
      title: "F大横按与移动和弦",
      description: "从完整 F 大横按认识六弦根音可移动和弦的基本逻辑",
      permalink: "/chords/barre-and-movable",
      type: "lesson",
      level: "基础",
      prerequisites: ["F简化指法与横按准备"],
      tags: ["和弦", "横按和弦", "指板", "安全"],
      draft: false,
    },
    sources: [
      "f-fender",
      "d-fender",
      "barre-fender",
      "dynamics-fender",
      "safety-bapam",
      "safety-nhs-rsi",
      "safety-nhs-finger",
    ],
    diagrams: ["f-major-simplified", "f-major-barre"],
    links: [
      "02-和弦系统/F简化指法与横按准备",
      "02-和弦系统/C-Am-F-G和弦进行",
      "01-持琴与基础动作/正确按弦",
      "00-从这里开始/学习路线总览",
      "03-节奏系统/节拍拍号与小节",
    ],
  },
]

const diagramContract: Record<string, { path: string; alt: string; tuple: string; label: string }> =
  {
    "c-major": {
      path: "../assets/diagrams/chord-c-major.svg",
      alt: "C 大三和弦图：六弦到一弦 x-3-2-0-1-0",
      tuple: "x-3-2-0-1-0",
      label: "C 大三和弦",
    },
    "g-major": {
      path: "../assets/diagrams/chord-g-major.svg",
      alt: "G 大三和弦四指变体图：六弦到一弦 3-2-0-0-3-3",
      tuple: "3-2-0-0-3-3",
      label: "G 大三和弦四指变体",
    },
    "d-major": {
      path: "../assets/diagrams/chord-d-major.svg",
      alt: "D 大三和弦图：六弦到一弦 x-x-0-2-3-2",
      tuple: "x-x-0-2-3-2",
      label: "D 大三和弦",
    },
    "d-minor": {
      path: "../assets/diagrams/chord-d-minor.svg",
      alt: "D 小三和弦图：六弦到一弦 x-x-0-2-3-1",
      tuple: "x-x-0-2-3-1",
      label: "D 小三和弦",
    },
    "a-major": {
      path: "../assets/diagrams/chord-a-major.svg",
      alt: "A 大三和弦图：六弦到一弦 x-0-2-2-2-0",
      tuple: "x-0-2-2-2-0",
      label: "A 大三和弦",
    },
    "a-minor": {
      path: "../assets/diagrams/chord-a-minor.svg",
      alt: "A 小三和弦图：六弦到一弦 x-0-2-2-1-0",
      tuple: "x-0-2-2-1-0",
      label: "A 小三和弦",
    },
    "e-major": {
      path: "../assets/diagrams/chord-e-major.svg",
      alt: "E 大三和弦图：六弦到一弦 0-2-2-1-0-0",
      tuple: "0-2-2-1-0-0",
      label: "E 大三和弦",
    },
    "e-minor": {
      path: "../assets/diagrams/chord-e-minor.svg",
      alt: "E 小三和弦图：六弦到一弦 0-2-2-0-0-0",
      tuple: "0-2-2-0-0-0",
      label: "E 小三和弦",
    },
    "e7-open": {
      path: "../assets/diagrams/chord-e7-open.svg",
      alt: "E7 属七和弦开放把位图：六弦到一弦 0-2-0-1-0-0",
      tuple: "0-2-0-1-0-0",
      label: "E7 属七和弦",
    },
    "a7-open": {
      path: "../assets/diagrams/chord-a7-open.svg",
      alt: "A7 属七和弦开放把位图：六弦到一弦 x-0-2-0-2-0",
      tuple: "x-0-2-0-2-0",
      label: "A7 属七和弦",
    },
    "d7-open": {
      path: "../assets/diagrams/chord-d7-open.svg",
      alt: "D7 属七和弦开放把位图：六弦到一弦 x-x-0-2-1-2",
      tuple: "x-x-0-2-1-2",
      label: "D7 属七和弦",
    },
    "f-major-simplified": {
      path: "../assets/diagrams/chord-f-major-simplified.svg",
      alt: "F 大三和弦简化按法图：六弦到一弦 x-x-3-2-1-1",
      tuple: "x-x-3-2-1-1",
      label: "F 大三和弦简化按法",
    },
    "f-major-barre": {
      path: "../assets/diagrams/chord-f-major-barre.svg",
      alt: "F 大三和弦大横按图：六弦到一弦 1-3-3-2-1-1",
      tuple: "1-3-3-2-1-1",
      label: "F 大三和弦大横按",
    },
  }

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "en-US"))
}

function headingsAtDepth(body: string, depth: number): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body)
  const headings: string[] = []
  visit(tree, "heading", (node) => {
    if (node.depth === depth) headings.push(toString(node).trim())
  })
  return headings
}

function footnoteIds(body: string): { definitions: string[]; references: string[] } {
  const definitions = [...body.matchAll(/^\[\^([a-z0-9-]+)\]:/gmu)].map((match) => match[1])
  const withoutDefinitions = body.replace(/^\[\^[a-z0-9-]+\]:.*$/gmu, "")
  const references = [...withoutDefinitions.matchAll(/\[\^([a-z0-9-]+)\]/gu)].map(
    (match) => match[1],
  )
  return { definitions: sorted(new Set(definitions)), references: sorted(new Set(references)) }
}

function normalizedInternalTargets(page: PageRecord): Set<string> {
  return new Set(
    page.links
      .filter((raw) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(raw))
      .map((raw) => raw.split("|", 1)[0].split("#", 1)[0].replace(/\.md$/iu, "")),
  )
}

const missingLessonFiles = expectedLessons
  .map(({ file }) => file)
  .filter((file) => !existsSync(file))
const lessonPages =
  missingLessonFiles.length === 0 ? expectedLessons.map(({ file }) => parsePage(file)) : []
const pageByFile = new Map(lessonPages.map((page) => [page.file, page]))

test("uses the factual simplified F title and three verified seventh definitions", () => {
  const chords = loadChords()
  const simplifiedF = chords.find((chord) => chord.id === "f-major-simplified")

  assert.ok(simplifiedF)
  assert.equal(simplifiedF.title, "F 大三和弦简化按法")
  assert.deepEqual(simplifiedF.frets, ["x", "x", 3, 2, 1, 1])
  assert.deepEqual(simplifiedF.fingers, [null, null, 3, 2, 1, 1])
  assert.deepEqual(simplifiedF.barres, [{ fret: 1, fromString: 1, toString: 2, finger: 1 }])

  const expectedSevenths: ChordDefinition[] = [
    {
      id: "e7-open",
      title: "E7 属七和弦（开放把位）",
      baseFret: 1,
      frets: [0, 2, 0, 1, 0, 0],
      fingers: [null, 2, null, 1, null, null],
      barres: [],
    },
    {
      id: "a7-open",
      title: "A7 属七和弦（开放把位）",
      baseFret: 1,
      frets: ["x", 0, 2, 0, 2, 0],
      fingers: [null, null, 2, null, 3, null],
      barres: [],
    },
    {
      id: "d7-open",
      title: "D7 属七和弦（开放把位）",
      baseFret: 1,
      frets: ["x", "x", 0, 2, 1, 2],
      fingers: [null, null, null, 2, 1, 3],
      barres: [],
    },
  ]

  for (const expected of expectedSevenths) {
    assert.deepEqual(
      chords.find((chord) => chord.id === expected.id),
      expected,
    )
  }

  const ids = chords.map((chord) => chord.id)
  assert.deepEqual(ids.slice(ids.indexOf("e-minor"), ids.indexOf("f-major-barre") + 1), [
    "e-minor",
    "e7-open",
    "a7-open",
    "d7-open",
    "f-major-simplified",
    "f-major-barre",
  ])
})

test("all twelve exact chord lesson files exist with no extra formal page", () => {
  assert.deepEqual(
    missingLessonFiles,
    [],
    `missing Task 3 pages:\n${missingLessonFiles.join("\n")}`,
  )
  const actual = existsSync("content/02-和弦系统")
    ? readdirSync("content/02-和弦系统")
        .filter((file) => file.endsWith(".md"))
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
    : []
  const expected = expectedLessons
    .map(({ file }) => file.split("/").at(-1)!)
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
  assert.deepEqual(actual, expected)
})

test(
  "frontmatter, headings, manifest order, and backward prerequisites match the contract",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const manifestIndex = new Map(manifest.pages.map((entry, index) => [entry.title, index]))
    assert.deepEqual(
      manifest.pages.filter((entry) => entry.module === "chords").map((entry) => entry.title),
      expectedLessons.map(({ frontmatter }) => String(frontmatter.title)),
    )
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      assert.deepEqual(page.frontmatter, expected.frontmatter, `${expected.file} frontmatter`)
      assert.deepEqual(
        headingsAtDepth(page.body, 1),
        [expected.frontmatter.title],
        `${expected.file} H1`,
      )
      assert.deepEqual(headingsAtDepth(page.body, 2), lessonSections, `${expected.file} H2`)
      const position = manifestIndex.get(String(expected.frontmatter.title))
      assert.notEqual(position, undefined)
      for (const prerequisite of expected.frontmatter.prerequisites as string[]) {
        const prerequisitePosition = manifestIndex.get(prerequisite)
        assert.notEqual(prerequisitePosition, undefined, `${expected.file}: ${prerequisite}`)
        assert.ok(
          prerequisitePosition! < position!,
          `${expected.file}: forward prerequisite ${prerequisite}`,
        )
      }
    }
  },
)

test(
  "page-local sources and exact safety blocks match the contract",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const [index, expected] of expectedLessons.entries()) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      const ids = footnoteIds(page.body)
      assert.deepEqual(
        ids.definitions,
        sorted(expected.sources),
        `${expected.file} source definitions`,
      )
      assert.deepEqual(ids.references, ids.definitions, `${expected.file} source references`)
      for (const definition of page.body.match(/^\[\^[a-z0-9-]+\]:.*$/gmu) ?? []) {
        assert.match(definition, /访问日期：2026-10-01。$/u, `${expected.file}: ${definition}`)
      }
      if (index >= 1 && index <= 9) assert.ok(page.body.includes(shortSafetyBlock), expected.file)
      if (index >= 10) assert.ok(page.body.includes(fullSafetyBlock), expected.file)
    }
  },
)

test(
  "diagram embeds, alt text, original links, and prose tuples are exact",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      assert.ok(page.body.includes(tupleNotice), `${expected.file} tuple notice`)
      assert.deepEqual(
        page.embeds,
        expected.diagrams.map((id) => diagramContract[id].path),
        `${expected.file} embed order`,
      )
      const imageAlts = [
        ...page.body.matchAll(/!\[([^\]]+)\]\((\.\.\/assets\/diagrams\/chord-[^)]+\.svg)\)/gu),
      ].map((match) => ({ alt: match[1], path: match[2] }))
      assert.deepEqual(
        imageAlts,
        expected.diagrams.map((id) => ({
          alt: diagramContract[id].alt,
          path: diagramContract[id].path,
        })),
        `${expected.file} image alt`,
      )
      for (const id of expected.diagrams) {
        const diagram = diagramContract[id]
        assert.ok(
          page.body.includes(`\`${diagram.tuple}\``),
          `${expected.file} prose tuple ${diagram.tuple}`,
        )
        assert.ok(
          page.body.includes(`[打开${diagram.label}原图（移动端可放大）](${diagram.path})`),
          `${expected.file} original link ${id}`,
        )
      }
    }
  },
)

test(
  "navigation handoffs, required links, and curriculum boundaries are present",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      const targets = normalizedInternalTargets(page)
      for (const target of expected.links)
        assert.ok(targets.has(target), `${expected.file} must link ${target}`)
      assert.doesNotMatch(page.body, /F\/C/iu, expected.file)
      assert.doesNotMatch(page.body, forbiddenFixedPracticeQuotaPattern, expected.file)
    }

    const gPage = pageByFile.get("content/02-和弦系统/G和弦.md")!
    assert.match(gPage.body, /本批采用.*四指变体|四指变体.*本批采用/u)
    assert.match(gPage.body, /其他.*G.*按法|G.*其他.*形/u)
    const aPage = pageByFile.get("content/02-和弦系统/Am与A和弦.md")!
    assert.match(aPage.body, /指号.*一种.*选项|一种.*可行.*指/u)
    for (const file of [
      "content/02-和弦系统/C-G-Am-Em和弦进行.md",
      "content/02-和弦系统/C-Am-F-G和弦进行.md",
    ]) {
      const body = pageByFile.get(file)!.body
      assert.match(body, /原创/u)
      assert.match(body, /不对应歌曲|不来自歌曲|非歌曲/u)
    }
    const laterF = pageByFile.get("content/02-和弦系统/C-Am-F-G和弦进行.md")!
    assert.ok(laterF.body.includes("`x-x-3-2-1-1`"))
    assert.deepEqual(laterF.frontmatter.prerequisites, ["C-G-Am-Em和弦进行"])

    const route = parsePage("content/00-从这里开始/学习路线总览.md")
    const ordered = route.body.split("## 有序链接\n", 2)[1]?.split("\n## ", 1)[0] ?? ""
    const items = [...ordered.matchAll(/^\d+\.\s+.*$/gmu)].map((match) => match[0])
    assert.equal(items.length, 10)
    assert.match(items[2], /\[\[02-和弦系统\/和弦图读法\|和弦图读法\]\]/u)
    assert.match(items[3], /\[\[03-节奏系统\/节拍拍号与小节\|节拍拍号与小节\]\]/u)
    assert.match(items[4], /\[\[04-演奏技巧\/分解和弦基础\|分解和弦基础\]\]/u)
    assert.match(items[5], /\[\[05-弹唱与伴奏\/根据人声选择调\|根据人声选择调\]\]/u)
    assert.match(items[6], /\[\[06-基础乐理与指板\/音高音名与唱名\|音高音名与唱名\]\]/u)
    assert.equal(
      items[7],
      "8. 练习与复盘：从 [[07-练习与复盘/有效练习流程|有效练习流程]] 进入，建立节拍器、速度、日志、错误修正与阶段测验闭环。",
    )
    for (const item of items.slice(8)) assert.doesNotMatch(item, /\[\[/u)

    const crossing = parsePage("content/01-持琴与基础动作/相邻弦与跨弦.md")
    const section = crossing.body.split("## 下一步与相关词条\n", 2)[1]?.split("\n## ", 1)[0] ?? ""
    assert.match(section, /下一步.*\[\[02-和弦系统\/和弦图读法\|和弦图读法\]\]/u)
    assert.match(section, /\[\[00-从这里开始\/学习路线总览\|学习路线总览\]\]/u)
  },
)

test(
  "the existing validators accept the expanded content set",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const pages = manifest.pages
      .filter((entry) => existsSync(`${contentRoot}/${entry.file}`))
      .map((entry) => parsePage(`${contentRoot}/${entry.file}`))
    assert.deepEqual(validateMetadata(pages, manifest), [])
    assert.deepEqual(validateStructure(pages), [])
    assert.deepEqual(validateLinks(pages, contentRoot), [])
  },
)
