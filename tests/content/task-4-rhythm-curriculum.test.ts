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

interface RhythmCell {
  label: string
  stroke: "down" | "up" | "rest" | "mute"
  accent: boolean
}

interface RhythmDefinition {
  id: string
  title: string
  meter: "3/4" | "4/4" | "6/8"
  subdivision: 4 | 8 | 16
  cells: RhythmCell[]
}

interface DiagramContract {
  path: string
  alt: string
  label: string
  visiblePattern: string
}

interface ExpectedLesson {
  file: string
  frontmatter: Record<string, unknown>
  sources: string[]
  links: string[]
  diagrams: DiagramContract[]
  visiblePatterns: string[]
}

const contentRoot = "content"
const rhythmDirectory = "content/03-节奏系统"
const safetyBlock =
  "安全边界：本页不用于诊断或治疗。出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降或明显不适时，立即停止；症状持续、反复或加重时，请向合格医疗专业人士求助。"
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

const migratedLessonFiles = new Set([
  "content/03-节奏系统/节拍拍号与小节.md",
  "content/03-节奏系统/四分八分与十六分音符.md",
  "content/03-节奏系统/切分节奏入门.md",
  "content/03-节奏系统/六八拍伴奏.md",
])

const expectedRhythmLessonFiles = [
  "节拍拍号与小节.md",
  "第一次使用节拍器.md",
  "四分八分与十六分音符.md",
  "放松而稳定的扫弦动作.md",
  "四拍全下扫.md",
  "基础八分音符扫弦.md",
  "重音与强弱层次.md",
  "切分节奏入门.md",
  "三拍子伴奏.md",
  "六八拍伴奏.md",
  "休止附点与延音线.md",
  "连音与节奏分组.md",
]

const expectedRhythmManifestTitles = [
  "节拍拍号与小节",
  "第一次使用节拍器",
  "四分八分与十六分音符",
  "放松而稳定的扫弦动作",
  "四拍全下扫",
  "基础八分音符扫弦",
  "重音与强弱层次",
  "三拍子伴奏",
  "六八拍伴奏",
  "休止附点与延音线",
  "切分节奏入门",
  "连音与节奏分组",
]

const exactSourceDefinitions: Record<string, string> = {
  "omt-notating":
    "[^omt-notating]: [Notating Rhythm](https://viva.pressbooks.pub/openmusictheory/chapter/notating-rhythm/) — Mark Gotham、Chelsey Hamm、Bryn Hughes，Open Music Theory；访问日期：2026-10-01。",
  "omt-simple":
    "[^omt-simple]: [Simple Meter and Time Signatures](https://viva.pressbooks.pub/openmusictheory/chapter/simple-meter-and-time-signatures/) — Mark Gotham、Chelsey Hamm、Kris Shaffer，Open Music Theory；访问日期：2026-10-01。",
  "omt-compound":
    "[^omt-compound]: [Compound Meter and Time Signatures](https://viva.pressbooks.pub/openmusictheory/chapter/compound-meters-and-time-signatures/) — Mark Gotham、Chelsey Hamm，Open Music Theory；访问日期：2026-10-01。",
  "omt-syncopation":
    "[^omt-syncopation]: [Other Rhythmic Essentials](https://viva.pressbooks.pub/openmusictheory/chapter/other-rhythmic-essentials/) — Mark Gotham、Chelsey Hamm、Bryn Hughes，Open Music Theory；访问日期：2026-10-01。",
  "metronome-fender":
    "[^metronome-fender]: [How to Improve Your Timing with a Metronome](https://www.fender.com/articles/techniques/how-to-improve-your-timing-with-a-metronome) — Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "tabs-fender":
    "[^tabs-fender]: [How to Read Tabs](https://www.fender.com/articles/techniques/how-to-read-tabs) — Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "strum-fender":
    "[^strum-fender]: [6 Ways to Strum Like a Pro](https://www.fender.com/articles/techniques/how-to-strum-beginner-guitar-tips) — Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "dynamics-fender":
    "[^dynamics-fender]: [How to Use Dynamics to Improve Your Guitar Playing](https://www.fender.com/articles/techniques/how-to-use-dynamics-to-improve-guitar-playing) — Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "safety-bapam":
    "[^safety-bapam]: [Returning to Playing and Performance for Instrumental Musicians](https://www.bapam.org.uk/return-to-play/) — British Association for Performing Arts Medicine；访问日期：2026-10-01。",
  "safety-nhs-rsi":
    "[^safety-nhs-rsi]: [Repetitive strain injury (RSI)](https://www.nhs.uk/conditions/repetitive-strain-injury-rsi/) — UK National Health Service；访问日期：2026-10-01。",
}

const quarterNoteGrid = ["四分音符", "口数  1  2  3  4", "动作  拍 拍 拍 拍"].join("\n")
const eighthNoteGrid = [
  "八分音符",
  "口数  1  &  2  &  3  &  4  &",
  "动作  拍 移 拍 移 拍 移 拍 移",
].join("\n")
const sixteenthNoteGrid = [
  "十六分音符",
  "口数  1 e & a  2 e & a  3 e & a  4 e & a",
  "动作  拍 移 移 移  拍 移 移 移  拍 移 移 移  拍 移 移 移",
].join("\n")

const fourDownstrokesPattern = ["口数  1  2  3  4", "动作  ↓  ↓  ↓  ↓", "重音  >  ·  ·  ·"].join(
  "\n",
)
const eighthStrumPattern = [
  "口数  1  &  2  &  3  &  4  &",
  "动作  ↓  ↑  ↓  ↑  ↓  ↑  ↓  ↑",
  "重音  >  ·  ·  ·  >  ·  ·  ·",
].join("\n")
const syncopationPattern = [
  "口数  1  &  2  &  3  &  4  &",
  "动作  ↓  ↑  ↓  ↑  ↓  ↑  ↓  ↑",
  "发声  响  空  空  响  响  空  空  响",
].join("\n")
const threeFourPattern = ["口数  1  2  3", "动作  ↓  ↓  ↓", "重音  >  ·  ·"].join("\n")
const sixEightPattern = [
  "口数  1       2      3      | 4       5      6",
  "动作  低音↓   3弦↓   2弦↓   | 低音↓   3弦↓   2弦↓",
  "重音  >       ·      ·      | >       ·      ·",
].join("\n")

const fourDownstrokesDiagram: DiagramContract = {
  path: "../assets/diagrams/rhythm-four-downstrokes.svg",
  alt: "4/4 四拍全下扫图：口数 1 2 3 4，动作 ↓ ↓ ↓ ↓，第 1 拍重音",
  label: "打开〈4/4 四拍全下扫〉原图（移动端可放大）",
  visiblePattern: fourDownstrokesPattern,
}
const eighthStrumDiagram: DiagramContract = {
  path: "../assets/diagrams/rhythm-basic-eighth-strum.svg",
  alt: "4/4 基础八分音符扫弦图：口数 1 & 2 & 3 & 4 &，动作 ↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑，第 1 与第 3 拍重音",
  label: "打开〈4/4 基础八分音符扫弦〉原图（移动端可放大）",
  visiblePattern: eighthStrumPattern,
}
const sixEightDiagram: DiagramContract = {
  path: "../assets/diagrams/rhythm-six-eight-arpeggio-pulse.svg",
  alt: "6/8 分解式伴奏脉冲图：六个八分音符分为 1-2-3 与 4-5-6，两组首格重音",
  label: "打开〈6/8 分解式伴奏脉冲〉原图（移动端可放大）",
  visiblePattern: sixEightPattern,
}

const expectedLessons: ExpectedLesson[] = [
  {
    file: "content/03-节奏系统/节拍拍号与小节.md",
    frontmatter: {
      title: "节拍拍号与小节",
      description: "区分脉冲、节拍、拍号与小节，并用分组理解 4/4、3/4 和 6/8",
      permalink: "/rhythm/beat-meter-bar",
      type: "lesson",
      level: "入门",
      prerequisites: ["F大横按与移动和弦"],
      tags: ["入门", "节奏", "拍号"],
      draft: false,
    },
    sources: ["omt-simple", "omt-compound", "safety-bapam"],
    links: [
      "02-和弦系统/F大横按与移动和弦",
      "03-节奏系统/第一次使用节拍器",
      "00-从这里开始/学习路线总览",
    ],
    diagrams: [],
    visiblePatterns: [],
  },
  {
    file: "content/03-节奏系统/第一次使用节拍器.md",
    frontmatter: {
      title: "第一次使用节拍器",
      description: "认识 BPM 与拍号设置，用点击声建立可跟随且不过度追速的稳定脉冲",
      permalink: "/rhythm/metronome-basics",
      type: "lesson",
      level: "入门",
      prerequisites: ["节拍拍号与小节"],
      tags: ["入门", "节奏", "节拍器", "练习"],
      draft: false,
    },
    sources: ["tabs-fender", "metronome-fender", "safety-bapam"],
    links: ["03-节奏系统/节拍拍号与小节", "03-节奏系统/四分八分与十六分音符"],
    diagrams: [],
    visiblePatterns: [],
  },
  {
    file: "content/03-节奏系统/四分八分与十六分音符.md",
    frontmatter: {
      title: "四分八分与十六分音符",
      description: "比较四分、八分与十六分音符在四四拍中的相对时值和口数",
      permalink: "/rhythm/note-values",
      type: "lesson",
      level: "入门",
      prerequisites: ["节拍拍号与小节"],
      tags: ["入门", "节奏", "乐理"],
      draft: false,
    },
    sources: ["omt-notating", "omt-simple", "safety-bapam"],
    links: [
      "03-节奏系统/节拍拍号与小节",
      "03-节奏系统/第一次使用节拍器",
      "03-节奏系统/放松而稳定的扫弦动作",
    ],
    diagrams: [],
    visiblePatterns: [quarterNoteGrid, eighthNoteGrid, sixteenthNoteGrid],
  },
  {
    file: "content/03-节奏系统/放松而稳定的扫弦动作.md",
    frontmatter: {
      title: "放松而稳定的扫弦动作",
      description: "用可调整、不过度紧张的拨弦手路径保持连续上下扫弦动作",
      permalink: "/rhythm/strumming-motion",
      type: "lesson",
      level: "入门",
      prerequisites: ["拨片握法与上下拨", "第一次使用节拍器", "四分八分与十六分音符"],
      tags: ["入门", "节奏", "扫弦", "右手", "安全"],
      draft: false,
    },
    sources: ["strum-fender", "safety-bapam", "safety-nhs-rsi"],
    links: [
      "01-持琴与基础动作/拨片握法与上下拨",
      "03-节奏系统/第一次使用节拍器",
      "03-节奏系统/四分八分与十六分音符",
      "03-节奏系统/四拍全下扫",
      "01-持琴与基础动作/右手位置与发力",
    ],
    diagrams: [],
    visiblePatterns: [],
  },
  {
    file: "content/03-节奏系统/四拍全下扫.md",
    frontmatter: {
      title: "四拍全下扫",
      description: "按 1 2 3 4 的口数完成四四拍全下扫并保持每拍落点清楚",
      permalink: "/rhythm/four-downstrokes",
      type: "lesson",
      level: "入门",
      prerequisites: ["放松而稳定的扫弦动作"],
      tags: ["入门", "节奏", "扫弦", "练习"],
      draft: false,
    },
    sources: ["omt-simple", "metronome-fender", "safety-bapam"],
    links: [
      "03-节奏系统/第一次使用节拍器",
      "03-节奏系统/放松而稳定的扫弦动作",
      "03-节奏系统/基础八分音符扫弦",
    ],
    diagrams: [fourDownstrokesDiagram],
    visiblePatterns: [fourDownstrokesPattern],
  },
  {
    file: "content/03-节奏系统/基础八分音符扫弦.md",
    frontmatter: {
      title: "基础八分音符扫弦",
      description: "按 1 & 2 & 3 & 4 & 完成交替上下扫并保持八分音符间隔",
      permalink: "/rhythm/eighth-note-strum",
      type: "lesson",
      level: "基础",
      prerequisites: ["四分八分与十六分音符", "四拍全下扫"],
      tags: ["节奏", "扫弦", "练习"],
      draft: false,
    },
    sources: ["omt-simple", "strum-fender", "safety-bapam"],
    links: [
      "03-节奏系统/四分八分与十六分音符",
      "03-节奏系统/四拍全下扫",
      "03-节奏系统/重音与强弱层次",
    ],
    diagrams: [eighthStrumDiagram],
    visiblePatterns: [eighthStrumPattern],
  },
  {
    file: "content/03-节奏系统/重音与强弱层次.md",
    frontmatter: {
      title: "重音与强弱层次",
      description: "在不改变节拍位置的前提下控制重音与非重音的相对层次",
      permalink: "/rhythm/accents",
      type: "lesson",
      level: "基础",
      prerequisites: ["基础八分音符扫弦"],
      tags: ["节奏", "扫弦", "演奏技巧"],
      draft: false,
    },
    sources: ["omt-simple", "dynamics-fender", "safety-bapam"],
    links: ["03-节奏系统/基础八分音符扫弦", "03-节奏系统/切分节奏入门"],
    diagrams: [eighthStrumDiagram],
    visiblePatterns: [eighthStrumPattern],
  },
  {
    file: "content/03-节奏系统/切分节奏入门.md",
    frontmatter: {
      title: "切分节奏入门",
      description: "用连续八分音符动作体验弱位发声与重音形成的基础切分",
      permalink: "/rhythm/syncopation",
      type: "lesson",
      level: "基础",
      prerequisites: ["重音与强弱层次"],
      tags: ["节奏", "扫弦", "乐理"],
      draft: false,
    },
    sources: ["omt-syncopation", "omt-simple", "safety-bapam"],
    links: ["03-节奏系统/重音与强弱层次", "03-节奏系统/三拍子伴奏"],
    diagrams: [],
    visiblePatterns: [syncopationPattern],
  },
  {
    file: "content/03-节奏系统/三拍子伴奏.md",
    frontmatter: {
      title: "三拍子伴奏",
      description: "按三拍一组建立四分音符为拍的三四拍原创伴奏型",
      permalink: "/rhythm/three-four",
      type: "lesson",
      level: "基础",
      prerequisites: ["重音与强弱层次"],
      tags: ["节奏", "拍号", "扫弦"],
      draft: false,
    },
    sources: ["omt-simple", "safety-bapam"],
    links: ["03-节奏系统/重音与强弱层次", "03-节奏系统/六八拍伴奏", "03-节奏系统/节拍拍号与小节"],
    diagrams: [],
    visiblePatterns: [threeFourPattern],
  },
  {
    file: "content/03-节奏系统/六八拍伴奏.md",
    frontmatter: {
      title: "六八拍伴奏",
      description: "按两个三连分组建立六八拍脉冲，并与三四拍的三拍分组区分",
      permalink: "/rhythm/six-eight",
      type: "lesson",
      level: "基础",
      prerequisites: ["三拍子伴奏"],
      tags: ["节奏", "拍号", "扫弦"],
      draft: false,
    },
    sources: ["omt-compound", "omt-simple", "safety-bapam"],
    links: [
      "03-节奏系统/三拍子伴奏",
      "03-节奏系统/节拍拍号与小节",
      "00-从这里开始/学习路线总览",
      "04-演奏技巧/分解和弦基础",
    ],
    diagrams: [sixEightDiagram],
    visiblePatterns: [sixEightPattern],
  },
]

const expectedRhythms: RhythmDefinition[] = [
  {
    id: "basic-eighth-strum",
    title: "4/4 基础八分音符交替扫弦",
    meter: "4/4",
    subdivision: 8,
    cells: [
      { label: "1", stroke: "down", accent: true },
      { label: "&", stroke: "up", accent: false },
      { label: "2", stroke: "down", accent: false },
      { label: "&", stroke: "up", accent: false },
      { label: "3", stroke: "down", accent: true },
      { label: "&", stroke: "up", accent: false },
      { label: "4", stroke: "down", accent: false },
      { label: "&", stroke: "up", accent: false },
    ],
  },
  {
    id: "four-downstrokes",
    title: "4/4 四拍下扫练习",
    meter: "4/4",
    subdivision: 4,
    cells: [
      { label: "1", stroke: "down", accent: true },
      { label: "2", stroke: "down", accent: false },
      { label: "3", stroke: "down", accent: false },
      { label: "4", stroke: "down", accent: false },
    ],
  },
  {
    id: "six-eight-arpeggio-pulse",
    title: "6/8 分解和弦律动练习",
    meter: "6/8",
    subdivision: 8,
    cells: [
      { label: "1·低音", stroke: "down", accent: true },
      { label: "2·3弦", stroke: "down", accent: false },
      { label: "3·2弦", stroke: "down", accent: false },
      { label: "4·低音", stroke: "down", accent: true },
      { label: "5·3弦", stroke: "down", accent: false },
      { label: "6·2弦", stroke: "down", accent: false },
    ],
  },
]

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

function footnoteDefinitionLines(body: string): Map<string, string> {
  return new Map(
    [...body.matchAll(/^(\[\^([a-z0-9-]+)\]:.*)$/gmu)].map((match) => [match[2], match[1]]),
  )
}

function tableCells(body: string): string[][][] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body)
  const tables: string[][][] = []
  visit(tree, "table", (node) => {
    tables.push(node.children.map((row) => row.children.map((cell) => toString(cell).trim())))
  })
  return tables
}

function normalizedInternalTargets(page: PageRecord): Set<string> {
  return new Set(
    page.links
      .filter((raw) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(raw))
      .map((raw) => raw.split("|", 1)[0].split("#", 1)[0].replace(/\.md$/iu, "")),
  )
}

function meterCellCount(definition: RhythmDefinition): number {
  const [numerator, denominator] = definition.meter.split("/").map(Number)
  return (numerator * definition.subdivision) / denominator
}

const missingLessonFiles = expectedLessons
  .map(({ file }) => file)
  .filter((file) => !existsSync(file))
const lessonPages =
  missingLessonFiles.length === 0 ? expectedLessons.map(({ file }) => parsePage(file)) : []
const pageByFile = new Map(lessonPages.map((page) => [page.file, page]))

test("keeps the three accepted rhythm definitions and generated assets unchanged", () => {
  const definitions = yaml.load(
    readFileSync("data/diagrams/rhythms.yml", "utf8"),
  ) as RhythmDefinition[]
  assert.deepEqual(definitions, expectedRhythms)
  for (const definition of definitions) {
    assert.equal(definition.cells.length, meterCellCount(definition), definition.id)
    assert.ok(
      existsSync(`content/assets/diagrams/rhythm-${definition.id}.svg`),
      `rhythm-${definition.id}.svg`,
    )
  }
})

test("all twelve rhythm lesson files exist with no extra formal page", () => {
  assert.deepEqual(
    missingLessonFiles,
    [],
    `missing Task 4 rhythm pages:\n${missingLessonFiles.join("\n")}`,
  )
  const actual = existsSync(rhythmDirectory)
    ? readdirSync(rhythmDirectory)
        .filter((file) => file.endsWith(".md"))
        .sort((left, right) => left.localeCompare(right, "zh-CN"))
    : []
  const expected = expectedRhythmLessonFiles.sort((left, right) =>
    left.localeCompare(right, "zh-CN"),
  )
  assert.deepEqual(actual, expected)
})

test(
  "frontmatter, headings, manifest order, and backward prerequisites match the contract",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const manifestIndex = new Map(manifest.pages.map((entry, index) => [entry.title, index]))
    assert.deepEqual(
      manifest.pages.filter((entry) => entry.module === "rhythm").map((entry) => entry.title),
      expectedRhythmManifestTitles,
    )
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      if (migratedLessonFiles.has(expected.file)) {
        for (const key of ["title", "permalink", "type", "draft"])
          assert.deepEqual(
            page.frontmatter[key],
            expected.frontmatter[key],
            `${expected.file} stable ${key}`,
          )
      } else {
        assert.deepEqual(page.frontmatter, expected.frontmatter, `${expected.file} frontmatter`)
      }
      assert.deepEqual(
        headingsAtDepth(page.body, 1),
        [expected.frontmatter.title],
        `${expected.file} H1`,
      )
      assert.deepEqual(headingsAtDepth(page.body, 2), lessonSections, `${expected.file} H2`)
      const position = manifestIndex.get(String(expected.frontmatter.title))
      assert.notEqual(position, undefined, `${expected.file} manifest title`)
      for (const prerequisite of page.frontmatter.prerequisites as string[]) {
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
  "page-local sources, access dates, and exact safety blocks match the contract",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      const ids = footnoteIds(page.body)
      assert.deepEqual(ids.references, ids.definitions, `${expected.file} references`)
      if (!migratedLessonFiles.has(expected.file)) {
        assert.deepEqual(ids.definitions, sorted(expected.sources), `${expected.file} definitions`)
        const definitions = footnoteDefinitionLines(page.body)
        for (const id of expected.sources)
          assert.equal(
            definitions.get(id),
            exactSourceDefinitions[id],
            `${expected.file} exact source ${id}`,
          )
      }
      for (const definition of page.body.match(/^\[\^[a-z0-9-]+\]:.*$/gmu) ?? [])
        assert.match(definition, /访问日期：2026-10-0[12]。/u, `${expected.file}: ${definition}`)
      assert.equal(
        page.body.split(safetyBlock).length - 1,
        1,
        `${expected.file} exact safety block`,
      )
    }
    assert.ok(
      pageByFile
        .get("content/03-节奏系统/放松而稳定的扫弦动作.md")
        ?.body.includes("[^safety-nhs-rsi]"),
    )
  },
)

test(
  "diagram embeds, adjacent original links, and redundant visible patterns are exact",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      assert.deepEqual(
        page.embeds,
        expected.diagrams.map(({ path }) => path),
        `${expected.file} embeds`,
      )
      for (const diagram of expected.diagrams) {
        assert.ok(
          page.body.includes(
            `![${diagram.alt}](${diagram.path})\n\n[${diagram.label}](${diagram.path})`,
          ),
          `${expected.file} adjacent accessible diagram`,
        )
        assert.ok(
          page.body.includes(diagram.visiblePattern),
          `${expected.file} visible diagram data`,
        )
      }
      for (const pattern of expected.visiblePatterns)
        assert.ok(page.body.includes(pattern), `${expected.file} visible rhythm pattern`)
    }
  },
)

test(
  "meter, accent, syncopation, originality, and practice boundaries stay explicit",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const body = pageByFile.get(expected.file)!.body
      assert.match(body, /原创练习/u, `${expected.file} originality`)
      assert.doesNotMatch(body, /(?:\d+\s*BPM|BPM\s*\d+)/iu, `${expected.file} fixed BPM`)
      assert.doesNotMatch(
        body,
        /(?:\d+|[一二三四五六七八九十]+)\s*(?:分钟|小时)|每天/u,
        `${expected.file} fixed duration`,
      )
      assert.doesNotMatch(body, /\d+\s*(?:度|°|毫米|mm\b)/iu, `${expected.file} anatomy metric`)
      assert.doesNotMatch(
        body,
        /(?:可以|能够|(?<!不)用于)(?:诊断|治疗)|治愈|保证防伤/u,
        expected.file,
      )
      assert.doesNotMatch(body, /歌词|riff|复制.*歌曲|歌曲.*编配/iu, expected.file)
    }

    const meter = pageByFile.get("content/03-节奏系统/节拍拍号与小节.md")!.body
    const sixEight = pageByFile.get("content/03-节奏系统/六八拍伴奏.md")!.body
    assert.deepEqual(
      tableCells(meter).at(-1),
      [
        ["拍号", "分组", "口数", "拍手动作"],
        ["4/4", "4×2", "1 & 2 & 3 & 4 &", "在 1 2 3 4 拍手，& 继续默数"],
        ["3/4", "3×2", "1 & 2 & 3 &", "在 1 2 3 拍手，& 继续默数"],
        ["6/8", "2×3、即 3+3", "1 2 3 | 4 5 6", "在第 1、4 格拍手，其余格继续口数"],
      ],
      "exact meter comparison table",
    )
    for (const body of [meter, sixEight]) {
      assert.match(body, /3×2/u)
      assert.match(body, /2×3/u)
      assert.match(body, /3\+3/u)
      assert.match(body, /两个.*(?:主拍|感受拍)|两.*(?:主拍|感受拍)/u)
      assert.match(body, /(?:不是|不能|不可).*六.*主拍/u)
    }
    assert.match(sixEight, /第 `1`、第 `4` 格.*(?:主拍|开始)/u)
    assert.match(sixEight, /分解式.*脉冲/u)
    assert.match(sixEight, /`x`.*(?:不弹|排除)|(?:不弹|排除).*`x`/u)

    const eighth = pageByFile.get("content/03-节奏系统/基础八分音符扫弦.md")!.body
    assert.match(eighth, /本页.*(?:映射|练习).*不是.*(?:定律|规则)|不是.*普遍.*规则/u)
    const accents = pageByFile.get("content/03-节奏系统/重音与强弱层次.md")!.body
    assert.match(accents, /相对.*突出|相对.*显著/u)
    assert.match(accents, /不等于.*(?:最大|最用力)|不是.*(?:最大|最用力)/u)
    assert.match(accents, /按弦手.*(?:稳定|不需|不要).*夹|夹.*按弦手/u)
    const syncopation = pageByFile.get("content/03-节奏系统/切分节奏入门.md")!.body
    assert.match(syncopation, /`空`.*不接触.*琴弦/u)
    assert.match(syncopation, /不是.*(?:制音|闷音|打击)/u)
    assert.match(syncopation, /2.*&.*4.*&.*(?:弱位|拍间|反拍)/u)
  },
)

test(
  "full-path navigation links and the two earlier-page handoffs match the published boundary",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      const targets = normalizedInternalTargets(page)
      if (!migratedLessonFiles.has(expected.file))
        for (const target of expected.links)
          assert.ok(targets.has(target), `${expected.file} must link ${target}`)
      for (const raw of page.links.filter((link) => link.startsWith("03-节奏系统")))
        assert.match(raw, /^03-节奏系统\/.+\|.+$/u, `${expected.file}: ${raw}`)
    }

    const route = parsePage("content/00-从这里开始/学习路线总览.md")
    const ordered = route.body.split("## 有序链接\n", 2)[1]?.split("\n## ", 1)[0] ?? ""
    const items = [...ordered.matchAll(/^\d+\.\s+.*$/gmu)].map((match) => match[0])
    assert.equal(items.length, 10)
    assert.match(items[3], /\[\[03-节奏系统\/节拍拍号与小节\|节拍拍号与小节\]\]/u)
    assert.match(items[4], /\[\[04-演奏技巧\/分解和弦基础\|分解和弦基础\]\]/u)
    assert.match(items[5], /\[\[05-弹唱与伴奏\/根据人声选择调\|根据人声选择调\]\]/u)
    assert.match(items[6], /\[\[06-基础乐理与指板\/音高音名与唱名\|音高音名与唱名\]\]/u)
    assert.equal(
      items[7],
      "8. 练习与复盘：从 [[07-练习与复盘/有效练习流程|有效练习流程]] 进入，建立节拍器、速度、日志、错误修正与阶段测验闭环。",
    )
    assert.equal(
      items[8],
      "9. 保养、安全与排错：从 [[08-保养安全与排错/疼痛疲劳与停止练习边界|疼痛疲劳与停止练习边界]] 进入，区分停止练习、可逆排查、基础换弦与需要专业人士处理的边界。",
    )
    assert.match(items[9], /\[\[09-术语与参考资料\/吉他术语表\|吉他术语表\]\]/u)

    const fullF = parsePage("content/02-和弦系统/F大横按与移动和弦.md")
    const nextSection = fullF.body.split("## 下一步与相关词条\n", 2)[1]?.split("\n## ", 1)[0] ?? ""
    assert.match(nextSection, /下一步.*\[\[03-节奏系统\/节拍拍号与小节\|节拍拍号与小节\]\]/u)

    const finalPage = pageByFile.get("content/03-节奏系统/六八拍伴奏.md")!
    assert.match(finalPage.body, /下一步.*\[\[04-演奏技巧\/分解和弦基础\|分解和弦基础\]\]/u)
  },
)

test(
  "the existing validators accept all ninety-seven published pages",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const pages = manifest.pages
      .filter((entry) => existsSync(`${contentRoot}/${entry.file}`))
      .map((entry) => parsePage(`${contentRoot}/${entry.file}`))
    assert.equal(pages.length, 97)
    assert.deepEqual(validateMetadata(pages, manifest), [])
    assert.deepEqual(validateStructure(pages), [])
    assert.deepEqual(validateLinks(pages, contentRoot), [])
  },
)
