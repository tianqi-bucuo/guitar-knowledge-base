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
      "00-从这里开始/01-如何使用知识库",
      "00-从这里开始/02-学习路线总览",
      "00-从这里开始/03-开始前自测",
      "01-持琴与基础动作/01-认识民谣吉他",
      "09-术语与参考资料/01-吉他术语表",
      "09-术语与参考资料/02-和弦索引",
      "09-术语与参考资料/03-节奏型索引",
      "09-术语与参考资料/04-常见问题索引",
      "09-术语与参考资料/05-参考来源总表",
    ],
  },
  {
    file: "content/00-从这里开始/01-如何使用知识库.md",
    frontmatter: {
      title: "如何使用知识库",
      description: "在本地 Obsidian 与网站中按路线学习或按主题查阅民谣吉他知识",
      permalink: "/start/how-to-use",
      type: "index",
      tags: ["导航", "使用说明"],
      draft: false,
    },
    sourceIds: [],
    primaryLinks: ["index", "00-从这里开始/02-学习路线总览", "00-从这里开始/03-开始前自测"],
  },
  {
    file: "content/00-从这里开始/02-学习路线总览.md",
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
      "00-从这里开始/03-开始前自测",
      "00-从这里开始/04-吉他调音与标准音",
      "01-持琴与基础动作/01-认识民谣吉他",
    ],
  },
  {
    file: "content/00-从这里开始/03-开始前自测.md",
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
      "00-从这里开始/04-吉他调音与标准音",
      "01-持琴与基础动作/02-坐姿与站姿",
      "01-持琴与基础动作/05-正确按弦",
      "01-持琴与基础动作/06-拨片握法与上下拨",
      "01-持琴与基础动作/07-空弦与单音练习",
    ],
  },
  {
    file: "content/00-从这里开始/04-吉他调音与标准音.md",
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
      "01-持琴与基础动作/01-认识民谣吉他",
      "00-从这里开始/03-开始前自测",
      "01-持琴与基础动作/07-空弦与单音练习",
    ],
  },
  {
    file: "content/01-持琴与基础动作/01-认识民谣吉他.md",
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
      "01-持琴与基础动作/02-坐姿与站姿",
      "00-从这里开始/04-吉他调音与标准音",
      "01-持琴与基础动作/07-空弦与单音练习",
    ],
  },
  {
    file: "content/01-持琴与基础动作/02-坐姿与站姿.md",
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
      "01-持琴与基础动作/03-左手拇指与手腕",
      "01-持琴与基础动作/04-右手位置与发力",
      "00-从这里开始/03-开始前自测",
    ],
  },
  {
    file: "content/01-持琴与基础动作/03-左手拇指与手腕.md",
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
      "01-持琴与基础动作/04-右手位置与发力",
      "01-持琴与基础动作/02-坐姿与站姿",
      "01-持琴与基础动作/05-正确按弦",
    ],
  },
  {
    file: "content/01-持琴与基础动作/04-右手位置与发力.md",
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
      "01-持琴与基础动作/05-正确按弦",
      "01-持琴与基础动作/02-坐姿与站姿",
      "01-持琴与基础动作/06-拨片握法与上下拨",
    ],
  },
  {
    file: "content/01-持琴与基础动作/05-正确按弦.md",
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
      "01-持琴与基础动作/06-拨片握法与上下拨",
      "01-持琴与基础动作/03-左手拇指与手腕",
      "01-持琴与基础动作/07-空弦与单音练习",
    ],
  },
  {
    file: "content/01-持琴与基础动作/06-拨片握法与上下拨.md",
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
      "01-持琴与基础动作/07-空弦与单音练习",
      "01-持琴与基础动作/04-右手位置与发力",
      "01-持琴与基础动作/08-相邻弦与跨弦",
    ],
  },
  {
    file: "content/01-持琴与基础动作/07-空弦与单音练习.md",
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
      "01-持琴与基础动作/08-相邻弦与跨弦",
      "00-从这里开始/04-吉他调音与标准音",
      "01-持琴与基础动作/05-正确按弦",
      "01-持琴与基础动作/06-拨片握法与上下拨",
    ],
  },
  {
    file: "content/01-持琴与基础动作/08-相邻弦与跨弦.md",
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
      "00-从这里开始/02-学习路线总览",
      "01-持琴与基础动作/07-空弦与单音练习",
      "01-持琴与基础动作/06-拨片握法与上下拨",
      "01-持琴与基础动作/01-认识民谣吉他",
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
  "content/02-和弦系统/01-和弦图读法.md",
  "content/02-和弦系统/02-Em与E和弦.md",
  "content/02-和弦系统/03-Am与A和弦.md",
  "content/02-和弦系统/04-C和弦.md",
  "content/02-和弦系统/05-G和弦.md",
  "content/02-和弦系统/06-D与Dm和弦.md",
  "content/02-和弦系统/07-常用七和弦.md",
  "content/02-和弦系统/08-和弦转换方法.md",
  "content/02-和弦系统/09-C-G-Am-Em和弦进行.md",
  "content/02-和弦系统/10-C-Am-F-G和弦进行.md",
  "content/02-和弦系统/11-F简化指法与横按准备.md",
  "content/02-和弦系统/12-F大横按与移动和弦.md",
  "content/03-节奏系统/01-节拍拍号与小节.md",
  "content/03-节奏系统/02-第一次使用节拍器.md",
  "content/03-节奏系统/03-四分八分与十六分音符.md",
  "content/03-节奏系统/04-放松而稳定的扫弦动作.md",
  "content/03-节奏系统/05-四拍全下扫.md",
  "content/03-节奏系统/06-基础八分音符扫弦.md",
  "content/03-节奏系统/07-重音与强弱层次.md",
  "content/03-节奏系统/11-切分节奏入门.md",
  "content/03-节奏系统/08-三拍子伴奏.md",
  "content/03-节奏系统/09-六八拍伴奏.md",
  "content/04-演奏技巧/01-分解和弦基础.md",
  "content/04-演奏技巧/02-常用分解和弦型.md",
  "content/04-演奏技巧/03-交替低音.md",
  "content/04-演奏技巧/04-左手制音.md",
  "content/04-演奏技巧/05-右手制音.md",
  "content/04-演奏技巧/06-击弦与勾弦.md",
  "content/04-演奏技巧/07-滑音.md",
  "content/04-演奏技巧/08-自然泛音与打板.md",
  "content/05-弹唱与伴奏/01-根据人声选择调.md",
  "content/05-弹唱与伴奏/02-变调夹原理与用法.md",
  "content/05-弹唱与伴奏/03-和弦级数与移调.md",
  "content/05-弹唱与伴奏/04-听辨歌曲结构.md",
  "content/05-弹唱与伴奏/05-主歌与副歌的伴奏对比.md",
  "content/05-弹唱与伴奏/06-前奏间奏与尾奏.md",
  "content/05-弹唱与伴奏/07-弹唱协调训练.md",
  "content/05-弹唱与伴奏/08-完整歌曲编配流程.md",
  "content/06-基础乐理与指板/01-音高音名与唱名.md",
  "content/06-基础乐理与指板/02-指板上的音名.md",
  "content/06-基础乐理与指板/03-全音与半音.md",
  "content/06-基础乐理与指板/05-音程入门.md",
  "content/06-基础乐理与指板/06-大调音阶.md",
  "content/06-基础乐理与指板/07-调与调号.md",
  "content/06-基础乐理与指板/08-三和弦构成.md",
  "content/06-基础乐理与指板/09-顺阶和弦与级数.md",
  "content/07-练习与复盘/01-有效练习流程.md",
  "content/07-练习与复盘/02-节拍器进阶用法.md",
  "content/07-练习与复盘/03-慢练与逐级提速.md",
  "content/07-练习与复盘/04-练习日志模板.md",
  "content/07-练习与复盘/05-错误诊断与修正.md",
  "content/07-练习与复盘/06-阶段测验.md",
  "content/08-保养安全与排错/01-疼痛疲劳与停止练习边界.md",
  "content/08-保养安全与排错/02-闷音与杂音排查.md",
  "content/08-保养安全与排错/03-更换琴弦.md",
  "content/08-保养安全与排错/04-弦距琴颈与品丝基础.md",
  "content/08-保养安全与排错/05-清洁湿度与存放.md",
  "content/09-术语与参考资料/01-吉他术语表.md",
  "content/09-术语与参考资料/02-和弦索引.md",
  "content/09-术语与参考资料/03-节奏型索引.md",
  "content/09-术语与参考资料/04-常见问题索引.md",
  "content/09-术语与参考资料/05-参考来源总表.md",
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
      pageByFile.get("content/00-从这里开始/03-开始前自测.md")?.body.includes(fullSafetyBlock),
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
    const allPages = manifest.pages
      .filter((entry) => existsSync(`${contentRoot}/${entry.file}`))
      .map((entry) => parsePage(`${contentRoot}/${entry.file}`))
    const allFiles = new Set(allPages.map((page) => page.file))
    assert.ok(task3LinkContext.every((page) => allFiles.has(page.file)))
    assert.deepEqual(validateMetadata(pages, manifest), [])
    assert.deepEqual(validateStructure(pages), [])
    assert.deepEqual(validateLinks(allPages, contentRoot), [])
  },
)

test(
  "route previews and primary links connect all ten published modules",
  {
    skip: missingFiles.length > 0,
  },
  () => {
    const routeFile = "content/00-从这里开始/02-学习路线总览.md"
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
    assert.match(routeItems[3], /\[\[03-节奏系统\/01-节拍拍号与小节\|节拍拍号与小节\]\]/u)
    assert.match(routeItems[4], /\[\[04-演奏技巧\/01-分解和弦基础\|分解和弦基础\]\]/u)
    assert.match(routeItems[5], /\[\[05-弹唱与伴奏\/01-根据人声选择调\|根据人声选择调\]\]/u)
    assert.match(routeItems[6], /\[\[06-基础乐理与指板\/01-音高音名与唱名\|音高音名与唱名\]\]/u)
    assert.equal(
      routeItems[7],
      "8. 练习与复盘：从 [[07-练习与复盘/01-有效练习流程|有效练习流程]] 进入，建立节拍器、速度、日志、错误修正与阶段测验闭环。",
    )
    assert.equal(
      routeItems[8],
      "9. 保养、安全与排错：从 [[08-保养安全与排错/01-疼痛疲劳与停止练习边界|疼痛疲劳与停止练习边界]] 进入，区分停止练习、可逆排查、基础换弦与需要专业人士处理的边界。",
    )
    assert.match(routeItems[9], /\[\[09-术语与参考资料\/01-吉他术语表\|吉他术语表\]\]/u)

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
