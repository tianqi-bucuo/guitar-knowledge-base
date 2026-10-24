import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import test from "node:test"
import { toString } from "mdast-util-to-string"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { loadManifest } from "../../scripts/content/loadManifest"
import { parsePage } from "../../scripts/content/parsePage"
import { curriculumFile } from "./helpers/curriculumFiles"

const directory = "08-保养安全与排错"
const titles = [
  "疼痛疲劳与停止练习边界",
  "闷音与杂音排查",
  "更换琴弦",
  "弦距琴颈与品丝基础",
  "清洁湿度与存放",
]
const descriptions = [
  "识别身体警讯并区分停止弹奏、记录现象与寻求合格医疗专业人士帮助的边界",
  "先排除身体与结构警讯再以单一变量比较目标弦的闷音、打品与非目标声音",
  "遵循具体琴型与制造商说明完成基础换弦并在阻力、异常张力或结构警讯前停止",
  "区分弦距、琴颈曲度与品丝问题并记录可观察现象交由合格维修人员评估",
  "以干软布、实测环境记录和具体制造商说明管理清洁与存放而不自行修复结构损伤",
]
const slugs = [
  "pain-fatigue",
  "buzz-muted-notes",
  "change-strings",
  "action-neck-frets",
  "cleaning-humidity-storage",
]
const prerequisites = [
  ["有效练习流程", "坐姿与站姿"],
  ["疼痛疲劳与停止练习边界", "正确按弦"],
  ["疼痛疲劳与停止练习边界", "吉他调音与标准音", "认识民谣吉他"],
  ["闷音与杂音排查", "更换琴弦"],
  ["弦距琴颈与品丝基础", "认识民谣吉他"],
]
const tags = [
  ["安全", "左手", "练习", "复盘"],
  ["排错", "左手", "右手", "保养"],
  ["保养", "调音", "安全"],
  ["保养", "排错", "指板"],
  ["保养", "安全", "复盘"],
]
const sections = [
  "学习目标与先修知识",
  "核心概念",
  "图示与操作步骤",
  "常见错误及修正",
  "分级练习",
  "自我检查标准",
  "下一步与相关词条",
  "参考来源与延伸阅读",
]
const safety =
  "> 安全边界：本页只提供一般性吉他保养与练习安全信息，不用于诊断、治疗或康复。弹奏或维护出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降、过度疲劳或明显不适时立即停止；症状持续、反复或加重时，请向合格医疗专业人士求助。[^safety-bapam]"
const equipment =
  "> 器材边界：仅做本页明确允许的观察和基础维护。琴颈调节杆、弦枕加工、品丝打磨、琴颈角度与结构修复交给合格维修人员；出现阻力、异常张力、结构裂缝或琴桥翘起时停止操作，不强扭、撬拔或继续上弦。[^care-yamaha-booklet][^care-yamaha-storage]"
const urls: Record<string, string> = {
  "safety-bapam": "https://www.bapam.org.uk/return-to-play/",
  "safety-nhs-rsi": "https://www.nhs.uk/conditions/repetitive-strain-injury-rsi/",
  "safety-nhs-finger": "https://www.nhs.uk/symptoms/hand-pain/finger-pain/",
  "fretting-fender": "https://www.fender.com/articles/techniques/5-ways-to-stop-fret-buzz",
  "care-yamaha-booklet": "https://download.yamaha.com/files/tcm%3A39-455550",
  "care-yamaha-owner":
    "https://usa.yamaha.com/files/download/other_assets/0/335660/AG%20General%20Owner%27s%20Manual_1407.pdf",
  "care-yamaha-basic":
    "https://www.yamaha.com/en/musical_instrument_guide/acoustic_guitar/maintenance/",
  "care-yamaha-storage":
    "https://www.yamaha.com/en/musical_instrument_guide/acoustic_guitar/maintenance/maintenance002.html",
  "care-martin-faq": "https://www.martinguitar.com/faqs.html",
  "neck-taylor": "https://blog.taylorguitars.com/buyers-resources/what-does-a-guitars-truss-rod-do",
  "humidity-taylor": "https://www.taylorguitars.com/support/maintenance/using-guitar-humidifier",
}
const sources = [
  ["safety-bapam", "safety-nhs-rsi", "safety-nhs-finger"],
  ["safety-bapam", "care-yamaha-booklet", "care-yamaha-storage", "fretting-fender"],
  ["safety-bapam", "care-yamaha-booklet", "care-yamaha-storage", "care-yamaha-owner"],
  ["safety-bapam", "care-yamaha-booklet", "care-yamaha-storage", "care-martin-faq", "neck-taylor"],
  [
    "safety-bapam",
    "care-yamaha-booklet",
    "care-yamaha-storage",
    "care-yamaha-owner",
    "care-yamaha-basic",
    "care-martin-faq",
    "humidity-taylor",
  ],
]
const related = [
  ["闷音与杂音排查", "左手拇指与手腕", "练习日志模板", "学习路线总览"],
  ["更换琴弦", "左手制音", "右手制音", "练习日志模板"],
  ["弦距琴颈与品丝基础", "清洁湿度与存放", "闷音与杂音排查"],
  ["清洁湿度与存放", "认识民谣吉他", "吉他调音与标准音", "练习日志模板"],
  ["更换琴弦", "疼痛疲劳与停止练习边界", "练习日志模板", "学习路线总览", "吉他术语表"],
]
const headers = [
  ["可观察现象", "当下行动", "可记录的信息", "求助边界"],
  ["顺序", "观察问题", "允许的比较", "停止或转交"],
  ["阶段", "操作门槛", "允许的动作", "停止条件"],
  ["概念", "一般含义", "用户可记录", "专业处理边界"],
  ["情境", "型号无关默认", "记录或核对", "停止或求助"],
]
const rowLabels = [
  [
    "注意力下降或疲劳",
    "疼痛、麻木或针刺感、无力、肿胀、控制下降或明显不适",
    "症状持续、反复或加重",
    "严重疼痛、不能活动或握物、形状颜色改变、伤后感觉丧失",
  ],
  ["安全入口", "目标声音", "调音状态", "按弦接触", "拨弦输入", "持续现象"],
  [
    "查型号",
    "查结构与环境",
    "松旧弦",
    "取固定件",
    "固定新弦",
    "绕弦与弦端",
    "调音检查",
    "完成收纳",
  ],
  ["弦距 action", "琴颈曲度 relief", "上下弦枕 nut / saddle", "品丝 frets", "琴颈角度与结构"],
  ["弹奏后汗污", "材料或漆面不明", "环境湿度", "目标范围", "存放与可见损伤"],
]
// These cells protect the actionable gates; explanatory prose is reviewed as content.
const criticalCells: Array<Array<[number, number, string]>> = [
  [
    [2, 1, "立即停止弹奏或维护"],
    [3, 3, "寻求合格医疗专业人士帮助[^safety-nhs-rsi][^safety-nhs-finger]"],
    [4, 1, "停止活动并尽快取得当地医疗帮助"],
  ],
  [
    [3, 2, "依调音页面确认 E2–A2–D3–G3–B3–E4"],
    [4, 2, "保持舒适，以最小有效接触比较[^fretting-fender]"],
  ],
  [
    [2, 3, "裂缝或琴桥翘起先维修，不上新弦[^care-yamaha-storage]"],
    [3, 2, "依型号说明松弦后才拆除；不剪受张力的弦[^care-yamaha-booklet]"],
    [7, 2, "逐弦确认 6→1 弦 E2–A2–D3–G3–B3–E4"],
  ],
  [
    [2, 3, "调节杆交维修师，不给方向或圈数[^care-martin-faq]"],
    [5, 3, "结构和角度修复交维修师"],
  ],
  [
    [1, 1, "用适合乐器的干软布轻擦[^care-yamaha-basic]"],
    [4, 2, "Martin 与 Taylor 的 45–55% RH 仅为品牌建议例[^care-martin-faq][^humidity-taylor]"],
    [5, 3, "裂缝或琴桥翘起交维修师，不继续上弦[^care-yamaha-storage]"],
  ],
]

function assertCareSnapshot(root: string): void {
  assert.ok(existsSync(join(root, directory)), "missing five care lessons")
  assert.deepEqual(
    readdirSync(join(root, directory))
      .filter((file) => file.endsWith(".md"))
      .sort(),
    titles.map((title) => basename(curriculumFile(title))).sort(),
  )
  const manifest = loadManifest("data/content-manifest.yml")
  for (let index = 0; index < titles.length; index += 1) {
    const page = parsePage(join(root, curriculumFile(titles[index])))
    const body = page.body
    assert.deepEqual(page.frontmatter, {
      title: titles[index],
      description: descriptions[index],
      permalink: `/care/${slugs[index]}`,
      type: "lesson",
      level: "基础",
      prerequisites: prerequisites[index],
      tags: tags[index],
      draft: false,
    })
    assert.equal(body.match(/^# (.+)$/mu)?.[1], titles[index])
    assert.deepEqual(
      [...body.matchAll(/^## (.+)$/gmu)].map((match) => match[1]),
      sections,
    )
    const position = manifest.pages.findIndex((entry) => entry.title === titles[index])
    assert.equal(manifest.pages[position].file, curriculumFile(titles[index]))
    const first = body.split("## 学习目标与先修知识")[1].split("## 核心概念")[0]
    for (const title of prerequisites[index]) {
      const previous = manifest.pages.findIndex((entry) => entry.title === title)
      assert.ok(previous >= 0 && previous < position)
      assert.ok(first.includes(`[[${manifest.pages[previous].file.slice(0, -3)}|${title}]]`))
      assert.ok(existsSync(join("content", manifest.pages[previous].file)))
    }
    const expected = [...prerequisites[index], ...related[index]].map((title) => {
      const entry = manifest.pages.find((item) => item.title === title)!
      return `${entry.file.slice(0, -3)}|${title}`
    })
    assert.deepEqual(
      [
        ...new Set(
          page.linkTargets
            ?.filter((target) => target.kind === "wikilink")
            .map((target) => target.raw),
        ),
      ].sort(),
      expected.sort(),
    )
    assert.deepEqual(page.embeds, [])
    const core = body.split("## 核心概念")[1].split("## 图示与操作步骤")[0]
    assert.equal(body.split(safety).length - 1, 1)
    assert.ok(core.includes(safety))
    const steps = body.split("## 图示与操作步骤")[1].split("## 常见错误及修正")[0]
    if (index === 1 || index === 2)
      assert.ok(
        steps.includes("按低音六弦到高音一弦排列"),
        `${titles[index]} explicit string order`,
      )
    if (index > 0) {
      assert.equal(body.split(equipment).length - 1, 1)
      assert.ok(steps.trimStart().startsWith(equipment))
    }
    const tree = unified().use(remarkParse).use(remarkGfm).parse(body)
    const tables: string[][][] = []
    const refs = new Set<string>()
    const defs: string[] = []
    visit(tree, "table", (node) => {
      tables.push(
        node.children.map((row) =>
          row.children.map((cell) =>
            body
              .slice(cell.position!.start.offset, cell.position!.end.offset)
              .trim()
              .replace(/^\|\s*|\s*\|$/gu, "")
              .trim(),
          ),
        ),
      )
    })
    visit(tree, "footnoteReference", (node) => {
      refs.add(node.identifier)
    })
    visit(tree, "footnoteDefinition", (node) => {
      defs.push(node.identifier)
      const definition = body.slice(node.position!.start.offset, node.position!.end.offset)
      assert.ok(definition.includes(`](${urls[node.identifier]})`), node.identifier)
      assert.ok(definition.endsWith("访问日期：2026-10-02。"))
      assert.ok(node.position!.start.offset! > body.indexOf("## 参考来源与延伸阅读"))
    })
    assert.equal(tables.length, 1)
    assert.deepEqual(tables[0][0], headers[index])
    assert.deepEqual(
      tables[0].slice(1).map((row) => row[0]),
      rowLabels[index],
    )
    for (const [row, column, expectedCell] of criticalCells[index])
      assert.equal(tables[0][row][column], expectedCell)
    assert.deepEqual(defs.sort(), [...sources[index]].sort())
    assert.deepEqual([...refs].sort(), [...sources[index]].sort())
    const prose = body.split("## 参考来源与延伸阅读")[0]
    for (const source of sources[index]) {
      assert.ok(
        prose
          .split(/\n{2,}/u)
          .some((paragraph) => paragraph.includes(`[^${source}]`) && !paragraph.startsWith("[^")),
        `claim reference: ${source}`,
      )
    }
    for (const level of ["第一级", "第二级", "第三级"])
      assert.match(prose, new RegExp(`^### ${level}：.+$`, "mu"))
    assert.match(prose, /原创/u)
    const exercise = body.split("## 分级练习")[1].split("## 自我检查标准")[0]
    assert.match(exercise, /退回|停止/u)
    const checks = body.split("## 自我检查标准")[1].split("## 下一步与相关词条")[0]
    assert.ok((checks.match(/^- /gmu) ?? []).length >= 3)
    const count = (
      toString(unified().use(remarkParse).use(remarkGfm).parse(prose)).match(/\p{Script=Han}/gu) ??
      []
    ).length
    assert.ok(count >= 900 && count <= 1800, `${titles[index]} Chinese count: ${count}`)
    if (index === 4)
      assert.ok(
        body.includes(
          "下一步进入 [[09-术语与参考资料/01-吉他术语表|吉他术语表]]，查阅本库术语与相关课程。",
        ),
      )
  }
}

test("five care lessons publish the required safety, evidence and curriculum contracts", () =>
  assertCareSnapshot("content"))
test("care entry is linked from route item nine and stage assessment", () => {
  const route = readFileSync("content/00-从这里开始/02-学习路线总览.md", "utf8")
  assert.ok(
    route.includes(
      "9. 保养、安全与排错：从 [[08-保养安全与排错/01-疼痛疲劳与停止练习边界|疼痛疲劳与停止练习边界]] 进入，区分停止练习、可逆排查、基础换弦与需要专业人士处理的边界。",
    ),
  )
  assert.match(
    (route.match(/^10\. .+$/mu) ?? [""])[0],
    /\[\[09-术语与参考资料\/01-吉他术语表\|吉他术语表\]\]/u,
  )
  assert.ok(
    readFileSync("content/07-练习与复盘/06-阶段测验.md", "utf8").includes(
      "下一步进入 [[08-保养安全与排错/01-疼痛疲劳与停止练习边界|疼痛疲劳与停止练习边界]]，把自我复盘中的身体警讯与器材问题分流到安全处理边界。",
    ),
  )
})
test("snapshot rejects representative missing safety, unsafe string order, wrong source and extra links", () => {
  if (!existsSync(join("content", directory))) return
  assertCareSnapshot("content")
  const mutations: Array<[number, string, string]> = [
    [0, safety, ""],
    [
      2,
      "依型号说明松弦后才拆除；不剪受张力的弦[^care-yamaha-booklet]",
      "先剪断受张力的弦再拆除[^care-yamaha-booklet]",
    ],
    [4, urls["humidity-taylor"], "https://example.com/wrong"],
    [4, "## 核心概念", "## 核心概念\n\n[[09-术语与参考资料/不存在|不存在]]"],
  ]
  for (const [index, from, to] of mutations) {
    const temporary = mkdtempSync(join(tmpdir(), "task9-care-"))
    try {
      cpSync(join("content", directory), join(temporary, directory), { recursive: true })
      const file = join(temporary, curriculumFile(titles[index]))
      const original = readFileSync(file, "utf8")
      assert.ok(original.includes(from), `mutation anchor: ${from}`)
      writeFileSync(file, original.replace(from, to))
      assert.throws(
        () => assertCareSnapshot(temporary),
        assert.AssertionError,
        `mutation survived: ${from}`,
      )
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  }
})
test("care leaves the 17 accepted diagrams and generator files unchanged", () => {
  const files = execFileSync(
    "git",
    [
      "ls-tree",
      "-r",
      "--name-only",
      "603b1f5",
      "data/diagrams",
      "scripts/diagrams",
      "scripts/generate-diagrams.ts",
      "content/assets/diagrams",
    ],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
  assert.equal(files.filter((file) => file.endsWith(".svg")).length, 17)
  for (const file of files)
    assert.deepEqual(readFileSync(file), execFileSync("git", ["show", `603b1f5:${file}`]), file)
})
