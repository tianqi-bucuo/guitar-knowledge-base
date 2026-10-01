import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
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

const contentRoot = "content"
const navigationSections = ["适用对象", "导航方法", "有序链接", "完成标准", "更新策略"]
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

interface ExpectedPage {
  file: string
  frontmatter: Record<string, unknown>
  sourceIds: string[]
  primaryLinks: string[]
}

const expectedPages: ExpectedPage[] = [
  {
    file: "content/index.md",
    frontmatter: {
      title: "民谣吉他知识库",
      description: "从零基础到进阶核心阶段的民谣吉他学习路线与百科",
      permalink: "/",
      type: "index",
      tags: ["导航"],
      draft: false,
    },
    sourceIds: [],
    primaryLinks: [
      "00-从这里开始/如何使用知识库",
      "00-从这里开始/学习路线总览",
      "00-从这里开始/开始前自测",
      "01-持琴与基础动作/认识民谣吉他",
    ],
  },
  {
    file: "content/00-从这里开始/如何使用知识库.md",
    frontmatter: {
      title: "如何使用知识库",
      description: "在本地 Obsidian 与网站中按路线学习或按主题查阅民谣吉他知识",
      permalink: "/start/how-to-use",
      type: "index",
      tags: ["导航", "使用说明"],
      draft: false,
    },
    sourceIds: [],
    primaryLinks: ["index", "00-从这里开始/学习路线总览", "00-从这里开始/开始前自测"],
  },
  {
    file: "content/00-从这里开始/学习路线总览.md",
    frontmatter: {
      title: "学习路线总览",
      description: "从持琴、和弦与节奏开始，逐步进入弹唱、乐理与复盘的十个学习模块",
      permalink: "/start/learning-path",
      type: "path",
      tags: ["导航", "学习路线"],
      draft: false,
    },
    sourceIds: [],
    primaryLinks: [
      "00-从这里开始/开始前自测",
      "00-从这里开始/吉他调音与标准音",
      "01-持琴与基础动作/认识民谣吉他",
    ],
  },
  {
    file: "content/00-从这里开始/开始前自测.md",
    frontmatter: {
      title: "开始前自测",
      description: "用非评分自测选择调音、姿势或单音控制的合适学习入口",
      permalink: "/start/readiness-check",
      type: "path",
      tags: ["导航", "测验", "安全"],
      draft: false,
    },
    sourceIds: ["safety-bapam", "safety-nhs-rsi", "safety-nhs-finger"],
    primaryLinks: [
      "00-从这里开始/吉他调音与标准音",
      "01-持琴与基础动作/坐姿与站姿",
      "01-持琴与基础动作/正确按弦",
      "01-持琴与基础动作/拨片握法与上下拨",
      "01-持琴与基础动作/空弦与单音练习",
    ],
  },
  {
    file: "content/00-从这里开始/吉他调音与标准音.md",
    frontmatter: {
      title: "吉他调音与标准音",
      description: "认识六根空弦的标准调弦顺序，并用调音器安全完成逐弦校准",
      permalink: "/start/tuning",
      type: "lesson",
      level: "零基础",
      prerequisites: ["如何使用知识库"],
      tags: ["入门", "调音", "音名"],
      draft: false,
    },
    sourceIds: ["tuning-yamaha", "tuning-fender", "strings-fender", "safety-bapam"],
    primaryLinks: [
      "01-持琴与基础动作/认识民谣吉他",
      "00-从这里开始/开始前自测",
      "01-持琴与基础动作/空弦与单音练习",
    ],
  },
  {
    file: "content/01-持琴与基础动作/认识民谣吉他.md",
    frontmatter: {
      title: "认识民谣吉他",
      description: "认识民谣吉他的常见部件、弦序和基本发声路径",
      permalink: "/basics/guitar-anatomy",
      type: "lesson",
      level: "零基础",
      prerequisites: ["吉他调音与标准音"],
      tags: ["入门", "基础动作"],
      draft: false,
    },
    sourceIds: ["anatomy-yamaha", "strings-fender", "safety-bapam"],
    primaryLinks: [
      "01-持琴与基础动作/坐姿与站姿",
      "00-从这里开始/吉他调音与标准音",
      "01-持琴与基础动作/空弦与单音练习",
    ],
  },
  {
    file: "content/01-持琴与基础动作/坐姿与站姿.md",
    frontmatter: {
      title: "坐姿与站姿",
      description: "建立坐姿与站姿下稳定、可调整且不过度紧张的持琴起点",
      permalink: "/basics/posture",
      type: "lesson",
      level: "零基础",
      prerequisites: ["认识民谣吉他"],
      tags: ["入门", "持琴", "安全"],
      draft: false,
    },
    sourceIds: ["posture-berklee", "technique-fender", "wrist-iowa", "safety-bapam"],
    primaryLinks: [
      "01-持琴与基础动作/左手拇指与手腕",
      "01-持琴与基础动作/右手位置与发力",
      "00-从这里开始/开始前自测",
    ],
  },
  {
    file: "content/01-持琴与基础动作/左手拇指与手腕.md",
    frontmatter: {
      title: "左手拇指与手腕",
      description: "用按弦手拇指和手腕的可调整位置建立低负担按弦起点",
      permalink: "/basics/fretting-hand",
      type: "lesson",
      level: "零基础",
      prerequisites: ["坐姿与站姿"],
      tags: ["入门", "基础动作", "左手", "安全"],
      draft: false,
    },
    sourceIds: [
      "technique-fender",
      "posture-berklee",
      "wrist-iowa",
      "safety-bapam",
      "safety-nhs-rsi",
    ],
    primaryLinks: [
      "01-持琴与基础动作/右手位置与发力",
      "01-持琴与基础动作/坐姿与站姿",
      "01-持琴与基础动作/正确按弦",
    ],
  },
  {
    file: "content/01-持琴与基础动作/右手位置与发力.md",
    frontmatter: {
      title: "右手位置与发力",
      description: "建立拨弦手的基准位置，并在放松状态下控制轻重音量",
      permalink: "/basics/picking-hand",
      type: "lesson",
      level: "零基础",
      prerequisites: ["坐姿与站姿"],
      tags: ["入门", "基础动作", "右手", "安全"],
      draft: false,
    },
    sourceIds: ["technique-fender", "dynamics-fender", "posture-berklee", "safety-bapam"],
    primaryLinks: [
      "01-持琴与基础动作/正确按弦",
      "01-持琴与基础动作/坐姿与站姿",
      "01-持琴与基础动作/拨片握法与上下拨",
    ],
  },
  {
    file: "content/01-持琴与基础动作/正确按弦.md",
    frontmatter: {
      title: "正确按弦",
      description: "在品丝后方用最小有效压力按出清晰单音并排查常见杂音",
      permalink: "/basics/fretting",
      type: "lesson",
      level: "零基础",
      prerequisites: ["左手拇指与手腕"],
      tags: ["入门", "基础动作", "左手", "练习"],
      draft: false,
    },
    sourceIds: ["fretting-fender", "dynamics-fender", "safety-bapam", "safety-nhs-finger"],
    primaryLinks: [
      "01-持琴与基础动作/拨片握法与上下拨",
      "01-持琴与基础动作/左手拇指与手腕",
      "01-持琴与基础动作/空弦与单音练习",
    ],
  },
  {
    file: "content/01-持琴与基础动作/拨片握法与上下拨.md",
    frontmatter: {
      title: "拨片握法与上下拨",
      description: "用稳定不过紧的拨片握法练习下拨、上拨与交替拨弦",
      permalink: "/basics/using-a-pick",
      type: "lesson",
      level: "零基础",
      prerequisites: ["右手位置与发力"],
      tags: ["入门", "基础动作", "右手", "拨片"],
      draft: false,
    },
    sourceIds: ["pick-fender", "picking-fender", "safety-bapam"],
    primaryLinks: [
      "01-持琴与基础动作/空弦与单音练习",
      "01-持琴与基础动作/右手位置与发力",
      "01-持琴与基础动作/相邻弦与跨弦",
    ],
  },
  {
    file: "content/01-持琴与基础动作/空弦与单音练习.md",
    frontmatter: {
      title: "空弦与单音练习",
      description: "用六根空弦和简单单音练习建立弦序、目标弦与音色控制",
      permalink: "/basics/open-strings",
      type: "lesson",
      level: "零基础",
      prerequisites: ["吉他调音与标准音", "正确按弦", "拨片握法与上下拨"],
      tags: ["入门", "基础动作", "音名", "练习"],
      draft: false,
    },
    sourceIds: ["strings-fender", "tabs-fender", "picking-fender", "safety-bapam"],
    primaryLinks: [
      "01-持琴与基础动作/相邻弦与跨弦",
      "00-从这里开始/吉他调音与标准音",
      "01-持琴与基础动作/正确按弦",
      "01-持琴与基础动作/拨片握法与上下拨",
    ],
  },
  {
    file: "content/01-持琴与基础动作/相邻弦与跨弦.md",
    frontmatter: {
      title: "相邻弦与跨弦",
      description: "从相邻弦到跨弦练习准确命中目标弦并保持动作可控",
      permalink: "/basics/string-crossing",
      type: "lesson",
      level: "零基础",
      prerequisites: ["空弦与单音练习"],
      tags: ["入门", "基础动作", "右手", "练习"],
      draft: false,
    },
    sourceIds: ["picking-fender", "strings-fender", "safety-bapam"],
    primaryLinks: [
      "00-从这里开始/学习路线总览",
      "01-持琴与基础动作/空弦与单音练习",
      "01-持琴与基础动作/拨片握法与上下拨",
      "01-持琴与基础动作/认识民谣吉他",
    ],
  },
]

const fullSafetyBlock =
  "本页只提供一般性练习与安全信息，不用于诊断或治疗。出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降或明显不适时，立即停止本项练习。症状持续、反复或加重，或已影响日常活动或握持能力时，请向合格医疗专业人士求助；严重疼痛、外伤后失去感觉或无法活动时，按所在地急诊指引及时就医。"
const shortSafetyBlock =
  "安全边界：本页不用于诊断或治疗。出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降或明显不适时，立即停止；症状持续、反复或加重时，请向合格医疗专业人士求助。"

const missingFiles = expectedPages.map(({ file }) => file).filter((file) => !existsSync(file))
const pages = missingFiles.length === 0 ? expectedPages.map(({ file }) => parsePage(file)) : []
const pageByFile = new Map(pages.map((page) => [page.file, page]))
const task3LinkContextFiles = [
  "content/02-和弦系统/和弦图读法.md",
  "content/02-和弦系统/Em与E和弦.md",
  "content/02-和弦系统/Am与A和弦.md",
  "content/02-和弦系统/C和弦.md",
  "content/02-和弦系统/G和弦.md",
  "content/02-和弦系统/D与Dm和弦.md",
  "content/02-和弦系统/常用七和弦.md",
  "content/02-和弦系统/和弦转换方法.md",
  "content/02-和弦系统/C-G-Am-Em和弦进行.md",
  "content/02-和弦系统/C-Am-F-G和弦进行.md",
  "content/02-和弦系统/F简化指法与横按准备.md",
  "content/02-和弦系统/F大横按与移动和弦.md",
  "content/03-节奏系统/节拍拍号与小节.md",
  "content/03-节奏系统/第一次使用节拍器.md",
  "content/03-节奏系统/四分八分与十六分音符.md",
  "content/03-节奏系统/放松而稳定的扫弦动作.md",
  "content/03-节奏系统/四拍全下扫.md",
  "content/03-节奏系统/基础八分音符扫弦.md",
  "content/03-节奏系统/重音与强弱层次.md",
  "content/03-节奏系统/切分节奏入门.md",
  "content/03-节奏系统/三拍子伴奏.md",
  "content/03-节奏系统/六八拍伴奏.md",
]
const task3LinkContext = task3LinkContextFiles.filter(existsSync).map((file) => parsePage(file))

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

test("all thirteen Task 2 entry pages exist", () => {
  assert.deepEqual(missingFiles, [], `missing Task 2 pages:\n${missingFiles.join("\n")}`)
})

test(
  "frontmatter, headings, draft state, and backward prerequisites match the contract",
  {
    skip: missingFiles.length > 0,
  },
  () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const manifestIndex = new Map(manifest.pages.map((entry, index) => [entry.title, index]))

    for (const expected of expectedPages) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      assert.deepEqual(page.frontmatter, expected.frontmatter, `${expected.file} frontmatter`)
      assert.deepEqual(
        headingsAtDepth(page.body, 1),
        [expected.frontmatter.title],
        `${expected.file} H1`,
      )
      assert.deepEqual(
        headingsAtDepth(page.body, 2),
        expected.frontmatter.type === "lesson" ? lessonSections : navigationSections,
        `${expected.file} H2`,
      )
      assert.equal(page.frontmatter.draft, false, `${expected.file} draft`)

      if (expected.frontmatter.type === "lesson") {
        assert.equal(page.frontmatter.level, "零基础", `${expected.file} level`)
        const pagePosition = manifestIndex.get(String(expected.frontmatter.title))
        assert.notEqual(pagePosition, undefined, `${expected.file} manifest title`)
        for (const prerequisite of expected.frontmatter.prerequisites as string[]) {
          const prerequisitePosition = manifestIndex.get(prerequisite)
          assert.notEqual(prerequisitePosition, undefined, `${expected.file}: ${prerequisite}`)
          assert.ok(
            prerequisitePosition! < pagePosition!,
            `${expected.file}: prerequisite must precede page: ${prerequisite}`,
          )
        }
      } else {
        assert.equal("level" in page.frontmatter, false, `${expected.file} omits level`)
        assert.equal(
          "prerequisites" in page.frontmatter,
          false,
          `${expected.file} omits prerequisites`,
        )
      }
    }
  },
)

test(
  "page-local source definitions, references, and safety blocks match the contract",
  {
    skip: missingFiles.length > 0,
  },
  () => {
    for (const expected of expectedPages) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      const ids = footnoteIds(page.body)
      assert.deepEqual(
        ids.definitions,
        sorted(expected.sourceIds),
        `${expected.file} source definitions`,
      )
      assert.deepEqual(ids.references, ids.definitions, `${expected.file} source references`)
      assert.doesNotMatch(page.body, /tuning-gsu|hyperphysics/iu, expected.file)
      assert.doesNotMatch(page.body, /\b(?:E2|A2|D3|G3|B3|E4)\b/u, expected.file)
    }

    assert.ok(
      pageByFile.get("content/00-从这里开始/开始前自测.md")?.body.includes(fullSafetyBlock),
      "开始前自测 full safety block",
    )
    for (const expected of expectedPages.filter(
      ({ frontmatter }) => frontmatter.type === "lesson",
    )) {
      assert.ok(pageByFile.get(expected.file)?.body.includes(shortSafetyBlock), expected.file)
    }
  },
)

test(
  "the existing validators accept Task 2 pages with current link-resolution context",
  {
    skip: missingFiles.length > 0,
  },
  () => {
    const manifest = loadManifest("data/content-manifest.yml")
    assert.deepEqual(validateMetadata(pages, manifest), [])
    assert.deepEqual(validateStructure(pages), [])
    assert.deepEqual(validateLinks([...pages, ...task3LinkContext], contentRoot), [])
  },
)

test(
  "route previews and primary links stay inside the current Task 2 batch",
  {
    skip: missingFiles.length > 0,
  },
  () => {
    const routeFile = "content/00-从这里开始/学习路线总览.md"
    const route = pageByFile.get(routeFile)
    assert.ok(route, routeFile)
    assert.deepEqual(route.embeds, [
      "../assets/diagrams/chord-c-major.svg",
      "../assets/diagrams/fretboard-c-major-scale.svg",
      "../assets/diagrams/rhythm-basic-eighth-strum.svg",
    ])

    for (const page of pages) {
      if (page.file !== routeFile) assert.deepEqual(page.embeds, [], `${page.file} local embeds`)
    }

    const orderedLinkSection = route.body.split("## 有序链接\n", 2)[1]?.split("\n## ", 1)[0] ?? ""
    assert.equal(
      [...orderedLinkSection.matchAll(/^\d+\.\s+/gmu)].length,
      10,
      "学习路线总览 must keep ten ordered module items",
    )
    const routeItems = [...orderedLinkSection.matchAll(/^\d+\.\s+.*$/gmu)].map((match) => match[0])
    assert.match(routeItems[3], /\[\[03-节奏系统\/节拍拍号与小节\|节拍拍号与小节\]\]/u)
    for (const item of routeItems.slice(4)) assert.doesNotMatch(item, /\[\[/u)

    for (const expected of expectedPages) {
      const page = pageByFile.get(expected.file)
      assert.ok(page, expected.file)
      const actualTargets = normalizedInternalTargets(page)
      for (const target of expected.primaryLinks) {
        assert.ok(actualTargets.has(target), `${expected.file} must link ${target}`)
      }
    }
  },
)
