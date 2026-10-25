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
import { validateContent } from "../../scripts/content/validateContent"
import { contentFile, curriculumFile } from "./helpers/curriculumFiles"

const directory = "07-练习与复盘"
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
  "> 安全边界：本页只提供一般性音乐练习与复盘信息，不用于诊断、治疗或康复。弹奏出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降、过度疲劳或明显不适时立即停止；症状持续、反复或加重时，请向合格医疗专业人士求助。[^safety-bapam]"
const definitions: Record<string, string> = {
  "ommp-frontiers":
    "[^ommp-frontiers]: [Using a music microanalysis protocol to enhance instrumental practice](https://pmc.ncbi.nlm.nih.gov/articles/PMC11020086/) — Guadalupe López-Íñiguez、Gary E. McPherson，Frontiers in Psychology；访问日期：2026-10-01。",
  "practice-abrsm":
    "[^practice-abrsm]: [How to develop new approaches to music practice](https://teacherhub.abrsm.org/mod/page/view.php?id=1397) — Paul Harris，ABRSM Teacher Hub；访问日期：2026-10-01。",
  "rhythm-berklee":
    "[^rhythm-berklee]: [Time and Rhythm 1](https://online.berklee.edu/courses/time-and-rhythm-1) — Matt Sharrock，Boston Conservatory at Berklee / Berklee Online；访问日期：2026-10-01。",
  "slow-practice-sage":
    "[^slow-practice-sage]: [Slow practice and tempo-management strategies in instrumental music learning: Investigating prevalence and cognitive functions](https://journals.sagepub.com/doi/10.1177/03057356211073481) — Emma Allingham、Clemens Wöllner，Psychology of Music；访问日期：2026-10-01。",
  "variability-plos":
    "[^variability-plos]: [Dissociable effects of practice variability on learning motor and timing skills](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0193580) — Baptiste Caramiaux、Frédéric Bevilacqua、Marcelo M. Wanderley、Caroline Palmer，PLOS ONE；访问日期：2026-10-01。",
  "error-frontiers":
    "[^error-frontiers]: [Error management for musicians: an interdisciplinary conceptual framework](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00777/full) — Silke Kruse-Weber、Richard Parncutt，Frontiers in Psychology；访问日期：2026-10-01。",
  "assessment-abrsm":
    "[^assessment-abrsm]: [How does the Marking Criteria work?](https://teacherhub.abrsm.org/mod/page/view.php?id=2019) — ABRSM Teacher Hub；访问日期：2026-10-01。",
  "audio-feedback-frontiers":
    "[^audio-feedback-frontiers]: [Effects of audio feedback interventions with the Disklavier on the performance of piano students](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1568021/full) — Manfred Nusseck、Friederike Wild、Christoph Sischka、Claudia Spahn，Frontiers in Psychology；访问日期：2026-10-01。",
  "safety-bapam":
    "[^safety-bapam]: [Returning to Playing and Performance for Instrumental Musicians](https://www.bapam.org.uk/return-to-play/) — British Association for Performing Arts Medicine；访问日期：2026-10-01。",
}
const titles = [
  "有效练习流程",
  "节拍器进阶用法",
  "慢练与逐级提速",
  "练习日志模板",
  "错误诊断与修正",
  "阶段测验",
]
const descriptions = [
  "用可观察目标、单一策略、即时证据与复盘下一步组成可重复的练习闭环",
  "从每拍点击进到隔拍、反拍与有声静默交替，并用退阶规则保持内部脉冲",
  "以节拍、音色、动作和恢复能力为门槛选择慢练起点并逐级测试速度",
  "用可直接复制的最小日志记录目标、速度、错误、修正证据与下一次练习",
  "把错误写成可观察现象，逐项检验音乐任务假设并保留有效修正证据",
  "用原创材料和多维观察表复核当前能力，并把结果转成下一阶段学习建议",
]
const slugs = [
  "effective-session",
  "metronome-progressions",
  "slow-to-fast",
  "log-template",
  "error-diagnosis",
  "stage-assessment",
]
const prerequisites = [
  ["顺阶和弦与级数", "开始前自测"],
  ["有效练习流程", "第一次使用节拍器", "四分八分与十六分音符"],
  ["节拍器进阶用法", "有效练习流程"],
  ["慢练与逐级提速", "有效练习流程"],
  ["练习日志模板", "有效练习流程"],
  ["错误诊断与修正", "完整歌曲编配流程", "顺阶和弦与级数"],
]
const tags = [
  ["练习", "复盘", "学习路线", "安全"],
  ["节拍器", "节奏", "练习", "复盘"],
  ["练习", "节拍器", "复盘", "安全"],
  ["练习", "复盘", "节拍器", "安全"],
  ["排错", "练习", "复盘", "安全"],
  ["测验", "复盘", "练习", "学习路线"],
]
const sources = [
  ["ommp-frontiers", "practice-abrsm", "safety-bapam"],
  ["rhythm-berklee", "practice-abrsm", "safety-bapam"],
  ["slow-practice-sage", "variability-plos", "safety-bapam"],
  ["ommp-frontiers", "practice-abrsm", "error-frontiers", "safety-bapam"],
  ["error-frontiers", "audio-feedback-frontiers", "safety-bapam"],
  ["assessment-abrsm", "audio-feedback-frontiers", "ommp-frontiers", "safety-bapam"],
]
const claimAnchors: Array<Record<string, string>> = [
  { "ommp-frontiers": "练前、练中、练后", "practice-abrsm": "活动", "safety-bapam": "安全边界" },
  {
    "rhythm-berklee": "four beats on/off",
    "practice-abrsm": "活动后的反思",
    "safety-bapam": "安全边界",
  },
  {
    "slow-practice-sage": "调查不证明因果",
    "variability-plos": "钢琴序列实验",
    "safety-bapam": "安全边界",
  },
  {
    "ommp-frontiers": "不复制 OMMP",
    "practice-abrsm": "速度记录",
    "error-frontiers": "错误的信息价值",
    "safety-bapam": "安全边界",
  },
  {
    "error-frontiers": "概念综述",
    "audio-feedback-frontiers": "外部专家评分无显著效果",
    "safety-bapam": "安全边界",
  },
  {
    "assessment-abrsm": "不复制官方分数",
    "audio-feedback-frontiers": "外部专家评分无显著效果",
    "ommp-frontiers": "练前、练中、练后",
    "safety-bapam": "安全边界",
  },
]
const expectedLinks = [
  [
    "06-基础乐理与指板/09-顺阶和弦与级数",
    "00-从这里开始/03-开始前自测",
    "07-练习与复盘/02-节拍器进阶用法",
    "00-从这里开始/02-学习路线总览",
    "05-弹唱与伴奏/08-完整歌曲编配流程",
  ],
  [
    "07-练习与复盘/01-有效练习流程",
    "03-节奏系统/02-第一次使用节拍器",
    "03-节奏系统/03-四分八分与十六分音符",
    "07-练习与复盘/03-慢练与逐级提速",
    "03-节奏系统/06-基础八分音符扫弦",
  ],
  [
    "07-练习与复盘/02-节拍器进阶用法",
    "07-练习与复盘/01-有效练习流程",
    "07-练习与复盘/04-练习日志模板",
    "04-演奏技巧/06-击弦与勾弦",
    "02-和弦系统/08-和弦转换方法",
  ],
  [
    "07-练习与复盘/03-慢练与逐级提速",
    "07-练习与复盘/01-有效练习流程",
    "07-练习与复盘/05-错误诊断与修正",
    "05-弹唱与伴奏/08-完整歌曲编配流程",
  ],
  [
    "07-练习与复盘/04-练习日志模板",
    "07-练习与复盘/01-有效练习流程",
    "07-练习与复盘/06-阶段测验",
    "03-节奏系统/02-第一次使用节拍器",
    "02-和弦系统/08-和弦转换方法",
    "08-保养安全与排错/01-疼痛疲劳与停止练习边界",
  ],
  [
    "07-练习与复盘/05-错误诊断与修正",
    "05-弹唱与伴奏/08-完整歌曲编配流程",
    "06-基础乐理与指板/09-顺阶和弦与级数",
    "00-从这里开始/02-学习路线总览",
    "00-从这里开始/04-吉他调音与标准音",
    "01-持琴与基础动作/02-坐姿与站姿",
    "02-和弦系统/10-C-Am-F-G和弦进行",
    "03-节奏系统/01-节拍拍号与小节",
    "03-节奏系统/09-六八拍伴奏",
    "04-演奏技巧/01-分解和弦基础",
    "04-演奏技巧/06-击弦与勾弦",
    "07-练习与复盘/07-中级乐理综合测验",
    "07-练习与复盘/04-练习日志模板",
    "08-保养安全与排错/01-疼痛疲劳与停止练习边界",
  ],
]
const tables: string[][][] = [
  [
    ["阶段", "必须回答", "可记录证据", "未达成时"],
    ["练前", "本轮只解决哪个可观察问题？", "材料、位置、起始状态", "缩小材料或重写目标"],
    ["练中", "我用了什么策略，哪项证据改变？", "节拍、音色、动作或结构", "换一个主要变量再比较"],
    [
      "练后",
      "证据比基线好在哪里，下一步是什么？",
      "保留项、未解决项、下一次起点",
      "退阶、求助或停止",
    ],
  ],
  [
    ["模式", "点击位置（4/4）", "持续口数", "玩家承担", "退阶动作"],
    ["每拍点击", "1、2、3、4", "1 & 2 & 3 & 4 &", "对齐基本脉冲", "先拍手或只说口数"],
    ["隔拍点击", "1、3 或 2、4，一轮只选一种", "1 & 2 & 3 & 4 &", "补出未点击的拍", "回到每拍点击"],
    ["反拍点击", "每个 &", "1 & 2 & 3 & 4 &", "保持数字拍不被 click 拉走", "先口数并拍手数字拍"],
    [
      "有声/静默交替",
      "一小节有声、一小节静默",
      "1 & 2 & 3 & 4 &",
      "静默小节维持同一脉冲",
      "缩回每拍或隔拍点击",
    ],
  ],
  [
    [
      "材料",
      "起始速度（自填 / 不适用）",
      "当前测试速度（自填 / 不适用）",
      "节拍",
      "音色",
      "动作",
      "恢复",
      "决策",
    ],
    [
      "",
      "",
      "",
      "稳定 / 退化",
      "清楚 / 退化",
      "舒适 / 变形",
      "可恢复 / 失控",
      "保持 / 微调 / 回退 / 停止",
    ],
  ],
  [],
  [
    ["现象", "出现位置或条件", "暂定错误域", "可检验假设", "单一改动", "观察结果", "决策"],
    [
      "",
      "",
      "节拍 / 音高和弦 / 音色杂音 / 转换协调 / 结构记忆 / 器材身体边界",
      "",
      "",
      "",
      "保留 / 换假设 / 求助 / 停止",
    ],
  ],
  [
    ["测验站", "材料", "主要观察"],
    ["准备与安全", "标准调音、持琴与自选起点", "调音、姿势、无警讯、能说明停止边界"],
    ["和弦与转换", "本站原创 C–Am–F–G 进行", "和弦清楚、转换不丢当前脉冲"],
    ["节奏", "已学四四拍与六八拍原创口数/动作", "拍号分组、细分、重音与 click 相位"],
    ["演奏技巧", "已学分解和弦加一项自选技巧", "音色、非目标弦控制、动作舒适"],
    ["编配呈现", "本站原创八小节编配", "调/和弦记录、段落对比、完整呈现与失误恢复"],
    [
      "乐理与复盘",
      "把上述材料写成音名、和弦构成或级数并填写日志",
      "理论映射、错误证据、下一步选择",
    ],
  ],
]
const assessmentTable = [
  ["观察维度", "当前项稳定", "带条件继续", "回到专项"],
  ["音高与和弦", "目标音/和弦可辨，错误能定位", "偶发错误可恢复并记录", "反复错位且无法定位"],
  [
    "时间",
    "脉冲与分组保持，click 回来能核对",
    "某段漂移但可退阶恢复",
    "口数、动作与 click 持续分离",
  ],
  [
    "音色与控制",
    "目标弦清楚，力度变化不靠挤压",
    "某技巧音色不稳但基本任务可保留",
    "杂音/闷音遮蔽主要结果",
  ],
  ["结构与表达", "段落、重音或伴奏差异可听辨", "结构正确但对比不足", "无法说明或保持段落结构"],
  [
    "完整呈现与恢复",
    "失误后能回到脉冲并完成",
    "需降低复杂度才可完成",
    "失误后无法恢复或身体警讯出现",
  ],
]
const logTemplate =
  "# 练习日志\n\n- 日期：\n- 材料：\n- 本次目标：\n- 起始速度（BPM / 不适用）：\n- 清晰速度（BPM / 不适用）：\n- 观察到的错误：\n- 出现位置或条件：\n- 推测原因（待验证）：\n- 采用的修正：\n- 修正后证据：\n- 下一次练习：\n- 身体或声音警讯："
const routeHandoff =
  "8. 练习与复盘：从 [[07-练习与复盘/01-有效练习流程|有效练习流程]] 进入，建立节拍器、速度、日志、错误修正与阶段测验闭环。"
const theoryHandoff =
  "用 [[07-练习与复盘/01-有效练习流程|有效练习流程]] 把推导与演奏组织成可观察的练习循环。"
const arrangementHandoff =
  "把本页的选调、和弦、段落与弹唱决定转记到 [[07-练习与复盘/04-练习日志模板|练习日志模板]]，保留当时条件、错误证据与下一次行动。"
const careHandoff =
  "下一步进入 [[08-保养安全与排错/01-疼痛疲劳与停止练习边界|疼痛疲劳与停止练习边界]]，把自我复盘中的身体警讯与器材问题分流到安全处理边界。"

function rejectsQuota(body: string): boolean {
  const number = "(?:[0-9]+|[零〇一二两三四五六七八九十百千万]+)"
  return new RegExp(
    `${number}\\s*BPM|(?:练习|重复|连续正确|坚持|每天练|每次增加|每周)\\s*${number}\\s*(?:分钟|小时|次|遍|组|天|周)|${number}\\s*(?:天|周)通关`,
    "iu",
  ).test(body)
}
function rejectsCopyright(body: string): boolean {
  return /《[^》]+》|歌词\s*[:：]|(?:^|\n)[eBGDAE][|｜][-0-9]+|(?:以下|照搬|(?<!不)复制)(?:来源|课程|实验)(?:练习|序列|作业)|https?:\/\/[^\s)]+\.(?:mp3|mp4|png|jpg)/iu.test(
    body,
  )
}
function readTables(body: string): string[][][] {
  const found: string[][][] = []
  visit(unified().use(remarkParse).use(remarkGfm).parse(body), "table", (node) => {
    found.push(node.children.map((row) => row.children.map((cell) => toString(cell).trim())))
  })
  return found
}
function assertLesson(root: string, index: number): void {
  const file = join(root, curriculumFile(titles[index]))
  assert.ok(existsSync(file), `missing practice page: ${file}`)
  const page = parsePage(file)
  const body = page.body
  assert.deepEqual(page.frontmatter, {
    title: titles[index],
    description: descriptions[index],
    permalink: `/practice/${slugs[index]}`,
    type: "lesson",
    level: index === 5 ? "进阶" : "基础",
    prerequisites: prerequisites[index],
    tags: tags[index],
    draft: false,
  })
  assert.equal(body.match(/^# (.+)$/mu)?.[1], titles[index])
  assert.deepEqual(
    [...body.matchAll(/^## (.+)$/gmu)].map((match) => match[1]),
    sections,
  )
  const manifest = loadManifest("data/content-manifest.yml")
  const entryIndex = manifest.pages.findIndex((entry) => entry.title === titles[index])
  assert.equal(manifest.pages[entryIndex].file, curriculumFile(titles[index]))
  assert.equal(manifest.pages[entryIndex].permalink, page.frontmatter.permalink)
  assert.equal(manifest.pages[entryIndex].type, "lesson")
  const firstSection = body.split("## 学习目标与先修知识")[1].split("## 核心概念")[0]
  for (const title of prerequisites[index]) {
    const previous = manifest.pages.findIndex((entry) => entry.title === title)
    assert.ok(previous >= 0 && previous < entryIndex)
    assert.ok(
      firstSection.includes(`[[${manifest.pages[previous].file.slice(0, -3)}|${title}]]`),
      `first-section prerequisite: ${title}`,
    )
  }
  const wiki = (page.linkTargets ?? [])
    .filter((target) => target.kind === "wikilink")
    .map((target) => target.raw)
  assert.deepEqual(
    [...new Set(wiki)].sort(),
    expectedLinks[index]
      .map((path) => {
        const entry = manifest.pages.find((page) => page.file.slice(0, -3) === path)
        assert.ok(entry, `missing manifest entry for ${path}`)
        return `${path}|${entry.title}`
      })
      .sort(),
  )
  assert.deepEqual(page.embeds, [])
  assert.ok(body.includes(safety), "exact safety block")
  assert.equal(rejectsQuota(body), false, "fixed practice quota")
  assert.equal(rejectsCopyright(body), false, "copyright material")
  assert.doesNotMatch(body, /<img|<svg|总分\s*[:：]\s*\d|及格线|颁发证书/u)
  const prose = body.split("## 参考来源与延伸阅读")[0]
  const actualSources = [...body.matchAll(/^\[\^([^\]]+)\]:/gmu)].map((match) => match[1])
  assert.deepEqual(actualSources.sort(), [...sources[index]].sort())
  for (const source of sources[index]) {
    assert.ok(body.includes(definitions[source]), `exact definition: ${source}`)
    assert.ok(prose.includes(`[^${source}]`), `claim marker: ${source}`)
    assert.ok(
      prose
        .split(/\n{2,}/u)
        .some(
          (paragraph) =>
            paragraph.includes(claimAnchors[index][source]) && paragraph.includes(`[^${source}]`),
        ),
      `claim-local attribution: ${source}`,
    )
  }
  assert.match(prose, /一次只改一个主要变量.*因果比较/u)
  assert.match(prose, /真实演奏.*多(?:个|项)?(?:因素|变量)/u)
  for (const level of ["第一级", "第二级", "第三级"])
    assert.match(prose, new RegExp(`^### ${level}：.+$`, "mu"))
  assert.match(prose, /退阶|回退/u)
  assert.match(prose, /原创/u)
  const checks = body.split("## 自我检查标准")[1].split("## 下一步与相关词条")[0]
  assert.ok((checks.match(/^- /gmu) ?? []).length >= 3, "observable checks")
  const chineseCount = (prose.match(/\p{Script=Han}/gu) ?? []).length
  assert.ok(chineseCount >= 900 && chineseCount <= 1800, `Chinese body count: ${chineseCount}`)
  if (index === 3) {
    assert.ok(
      body
        .split("## 图示与操作步骤")[1]
        .split("## 常见错误及修正")[0]
        .includes(`\u0060\u0060\u0060markdown\n${logTemplate}\n\u0060\u0060\u0060`),
      "copyable twelve-field log",
    )
  } else {
    assert.deepEqual(readTables(body)[0], tables[index])
  }
  if (index === 0) {
    assert.match(body, /因果比较/u)
    assert.match(body, /真实演奏.*多变量/u)
    const steps = body.split("## 图示与操作步骤")[1].split("## 常见错误及修正")[0]
    assert.equal((steps.match(/^\d+\. /gmu) ?? []).length, 7)
  }
  if (index === 1) assert.match(body, /on beat.*off beat.*every other beat.*four beats on\/off/u)
  if (index === 2) {
    assert.match(body, /调查不证明因果/u)
    assert.match(body, /不证明.*所有人.*最有效/u)
    assert.match(body, /过慢动作与目标速度动作可能不同/u)
    assert.match(body, /清晰速度.*材料.*日期.*观察条件/u)
    assert.doesNotMatch(body, /慢练对所有人最佳/u)
  }
  if (index === 4) {
    assert.match(body, /“诊断”只指音乐任务排错，不是医学诊断/u)
    assert.match(
      body,
      /捕捉现象 → 定位位置\/条件 → 归入暂定错误域 → 写可检验假设 → 只改一个主要变量 → 比较证据并保留\/换假设\/求助/u,
    )
    assert.match(body, /外部专家评分无显著效果/u)
    assert.match(body, /身体警讯不进入复现实验/u)
  }
  if (index === 5) {
    assert.deepEqual(readTables(body)[1], assessmentTable)
    assert.match(
      body,
      /自我复盘 checkpoint，不是等级考试、资格认证、医疗\/职业能力判断；没有总分和证书/u,
    )
    assert.ok(body.includes(careHandoff))
    for (const result of ["当前项稳定", "带条件继续", "回到专项", "停止并求助"])
      assert.ok(body.includes(`\u0060${result}\u0060：`), result)
    assert.match(body, /录音.*可选/u)
    assert.match(body, /外部专家评分无显著效果/u)
  }
}

test("all seven practice pages exist with exact published inventory", () => {
  const missing = titles.filter((title) => !existsSync(contentFile(title)))
  assert.deepEqual(missing, [], `six missing practice pages: ${missing.join("、")}`)
  assert.deepEqual(
    readdirSync(join("content", directory))
      .filter((file) => file.endsWith(".md"))
      .sort(),
    [...titles, "中级乐理综合测验"].map((title) => basename(curriculumFile(title))).sort(),
  )
})
for (let index = 0; index < titles.length; index += 1) {
  test(`${titles[index]} preserves curriculum, safety, evidence and accessible tables`, () =>
    assertLesson("content", index))
}
test("route and the two earlier lessons hand off to published practice pages", () => {
  const route = readFileSync("content/00-从这里开始/02-学习路线总览.md", "utf8")
  assert.ok(route.includes(routeHandoff), "practice route handoff is missing")
  const items = route.match(/^\d+\. .+$/gmu) ?? []
  assert.equal(items.length, 10)
  assert.equal(
    items[8],
    "9. 保养、安全与排错：从 [[08-保养安全与排错/01-疼痛疲劳与停止练习边界|疼痛疲劳与停止练习边界]] 进入，区分停止练习、可逆排查、基础换弦与需要专业人士处理的边界。",
  )
  assert.match(items[9], /\[\[09-术语与参考资料\/01-吉他术语表\|吉他术语表\]\]/u)
  assert.ok(
    readFileSync("content/06-基础乐理与指板/09-顺阶和弦与级数.md", "utf8").includes(theoryHandoff),
  )
  assert.ok(
    readFileSync("content/05-弹唱与伴奏/08-完整歌曲编配流程.md", "utf8").includes(
      arrangementHandoff,
    ),
  )
})
test("quota detector rejects doses while allowing musical coordinates and blank fields", () => {
  for (const body of [
    "120 BPM",
    "六十 BPM",
    "每次增加 5 BPM",
    "练习 10 分钟",
    "每天练十分钟",
    "每周三次",
    "重复 20 次",
    "练习三遍",
    "连续正确五次",
    "坚持两周",
    "三天通关",
  ])
    assert.equal(rejectsQuota(body), true, body)
  for (const body of [
    "4/4",
    "1 & 2 & 3 & 4 &",
    "第 1、3 拍",
    "一小节有声、一小节静默",
    "八小节原创练习",
    "起始速度（BPM / 不适用）：",
    "当前测试速度（自填 / 不适用）",
    "一次只改一个主要变量",
  ])
    assert.equal(rejectsQuota(body), false, body)
})
test("copyright detector rejects copied materials while allowing explicit legal boundaries", () => {
  for (const body of [
    "《外部歌曲》",
    "歌词：复制内容",
    "e|--0-1-2--",
    "以下来源练习",
    "复制实验序列",
    "照搬课程作业",
  ])
    assert.equal(rejectsCopyright(body), true, body)
  for (const body of [
    "不复制实验序列、速度或训练剂量",
    "不列真实歌曲、歌词、旋律、TAB",
    "使用原创、公版或合法取得材料",
  ])
    assert.equal(rejectsCopyright(body), false, body)
})
test("all protected diagram files remain byte-for-byte at the accepted baseline", () => {
  const files = execFileSync(
    "git",
    [
      "ls-tree",
      "-r",
      "--name-only",
      "5871bef",
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
    assert.deepEqual(readFileSync(file), execFileSync("git", ["show", `5871bef:${file}`]), file)
})
test("temporary practice mutations reject every required high-risk boundary break", () => {
  if (!titles.every((title) => existsSync(contentFile(title)))) return
  const mutations: Array<[number, string, string]> = [
    ...logTemplate
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((field): [number, string, string] => [3, field, ""]),
    [1, "每个 `&`", "每个 `1`"],
    [1, "`1、2、3、4`", "`1、2、3`"],
    [1, "`1、3` 或 `2、4`", "`1、2` 或 `3、4`"],
    [1, "一小节有声、一小节静默", "一小节有声、两小节静默"],
    [1, "回到每拍点击", "继续追拍"],
    [2, "保持 / 微调 / 回退 / 停止", "保持 / 微调 / 回退 / 继续加速"],
    ...["节拍", "音色", "动作", "恢复"].map((gate): [number, string, string] => [
      2,
      `| ${gate}`,
      "| 速度",
    ]),
    [2, "调查不证明因果", "调查已经证明因果"],
    [2, "不证明它对所有人最有效", "慢练对所有人最佳"],
    [0, "https://pmc.ncbi.nlm.nih.gov/articles/PMC11020086/", "https://example.com/wrong-source"],
    [0, "量表。[^ommp-frontiers]", "量表。"],
    [0, "[^practice-abrsm] 一次", "一次"],
    ...["120 BPM", "练习 10 分钟", "重复 20 次", "连续正确五次", "坚持两周"].map(
      (dose): [number, string, string] => [0, "## 核心概念", `## 核心概念\n\n${dose}`],
    ),
    [1, "[[07-练习与复盘/01-有效练习流程|有效练习流程]]", "[[有效练习流程]]"],
    [5, careHandoff, "[[09-术语与参考资料/01-吉他术语表|吉他术语表]]"],
    [5, "## 核心概念", "## 核心概念\n\n总分：100，及格线：60，颁发证书。"],
    ...["当前项稳定", "带条件继续", "回到专项", "停止并求助"].map(
      (result): [number, string, string] => [5, `\u0060${result}\u0060：`, "失败："],
    ),
    [0, "## 核心概念", "## 核心概念\n\n![图](../assets/diagrams/chord-c-major.svg)"],
    ...["《外部歌曲》", "歌词：外部歌词", "e|--0-1-2--", "以下来源练习"].map(
      (material): [number, string, string] => [0, "## 核心概念", `## 核心概念\n\n${material}`],
    ),
  ]
  for (const [index, from, to] of mutations) {
    const temporary = mkdtempSync(join(tmpdir(), "task8-practice-"))
    try {
      cpSync(join("content", directory), join(temporary, directory), { recursive: true })
      const file = join(temporary, curriculumFile(titles[index]))
      const original = readFileSync(file, "utf8")
      assert.ok(original.includes(from), `mutation anchor missing: ${from}`)
      writeFileSync(file, original.replace(from, to))
      assert.throws(
        () => assertLesson(temporary, index),
        assert.AssertionError,
        `mutation survived: ${from}`,
      )
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  }
})
test("author and release modes accept all 98 published pages without diagnostics", async () => {
  if (!titles.every((title) => existsSync(contentFile(title)))) return
  const manifest = loadManifest("data/content-manifest.yml")
  assert.equal(
    manifest.pages.filter(
      (entry) =>
        existsSync(join("content", entry.file)) &&
        parsePage(join("content", entry.file)).frontmatter.draft === false,
    ).length,
    98,
  )
  const author = await validateContent({
    contentRoot: "content",
    manifestPath: "data/content-manifest.yml",
    mode: "author",
  })
  const release = await validateContent({
    contentRoot: "content",
    manifestPath: "data/content-manifest.yml",
    mode: "release",
  })
  assert.equal(author.filter((item) => item.severity === "error").length, 0)
  assert.equal(author.filter((item) => item.severity === "warning").length, 0)
  assert.equal(release.filter((item) => item.severity === "error").length, 0)
  assert.equal(release.filter((item) => item.severity === "warning").length, 0)
})
