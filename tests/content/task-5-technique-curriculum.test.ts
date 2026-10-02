import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import { toString } from "mdast-util-to-string"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { loadManifest } from "../../scripts/content/loadManifest"
import { parsePage, type PageRecord } from "../../scripts/content/parsePage"
import { validateContent } from "../../scripts/content/validateContent"
import { validateLinks } from "../../scripts/content/validateLinks"
import { validateMetadata } from "../../scripts/content/validateMetadata"
import { validateStructure } from "../../scripts/content/validateStructure"

interface ExpectedLesson {
  file: string
  frontmatter: Record<string, unknown>
  sources: string[]
  claimAnchors: Record<string, string>
  links: string[]
  tables: string[][][]
}

const contentRoot = "content"
const techniqueDirectory = "content/04-演奏技巧"
const safetyBlock =
  "安全边界：本页不用于诊断或治疗。出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降或明显不适时，立即停止；症状持续、反复或加重时，请向合格医疗专业人士求助。"
const instrumentSafetyBlock =
  "乐器边界：打板是可选音色，不以增加冲击力换取音量。取下戒指等硬物；如果不清楚具体琴体或涂装是否适合接触式敲击，先查阅制造商说明或向合格维修技师确认。出现裂纹、松动、异响或可见损伤时立即停止并检查。"
const roleMirrorNotice = "本站标题按常见右手拨弦方式命名；左手演奏者请按动作角色镜像理解。"
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
const diagramPath = "../assets/diagrams/rhythm-six-eight-arpeggio-pulse.svg"
const diagramAlt = "6/8 分解式伴奏脉冲图：六个八分音符分为 1-2-3 与 4-5-6，两组首格重音"
const diagramLabel = "打开〈6/8 分解式伴奏脉冲〉原图（移动端可放大）"

const exactSourceDefinitions: Record<string, string> = {
  "arpeggio-fender":
    "[^arpeggio-fender]: [Everything You Need to Know About Arpeggios](https://www.fender.com/articles/scales/playing-arpeggios-everything-you-need-to-know) — Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "travis-fender":
    "[^travis-fender]: [Learn the Travis Picking Guitar Technique](https://www.fender.com/articles/techniques/travis-picking-on-guitar) — Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "muting-yamaha":
    "[^muting-yamaha]: [Tone and Sound on Your Guitar, Part 1](https://hub.yamaha.com/music-educators/instruments/guitars-education/tone-and-sound-on-your-guitar-part-1/) — Bob Habersat，Yamaha Corporation of America / Yamaha Corporation；访问日期：2026-10-01。",
  "palm-mute-fender":
    "[^palm-mute-fender]: [3 Keys to Ace Your Palm Muting](https://www.fender.com/articles/techniques/3-keys-to-ace-your-palm-muting) — Nick Stoubis，Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "hammer-pull-fender":
    "[^hammer-pull-fender]: [Master Hammer-Ons and Pull-Offs](https://www.fender.com/articles/techniques/master-hammer-ons-and-pull-offs) — Jeff Owens，Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "solo-fender":
    "[^solo-fender]: [How to Solo on Guitar - Techniques, Tips & Tricks](https://www.fender.com/articles/techniques/how-to-guitar-solo) — Ben Nemeroff，Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "fretting-fender":
    "[^fretting-fender]: [5 Ways to Cut the Buzz](https://www.fender.com/articles/techniques/5-ways-to-stop-fret-buzz) — Dan Macy，Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "harmonics-yamaha":
    "[^harmonics-yamaha]: [How to Play Bass Guitar Harmonics](https://hub.yamaha.com/guitars/bass/how-to-play-bass-guitar-harmonics/) — E.E. Bradman，Yamaha Corporation of America / Yamaha Corporation；访问日期：2026-10-01。",
  "percussion-yamaha":
    "[^percussion-yamaha]: [How To Play Latin Percussive Guitar](https://hub.yamaha.com/guitars/g-how-to/how-to-play-latin-percussive-guitar/) — Rich Tozzoli，Yamaha Corporation of America / Yamaha Corporation；访问日期：2026-10-01。",
  "impact-taylor":
    "[^impact-taylor]: [Inspect & Treat Impact Damage](https://www.taylorguitars.com/support/inspect-treat-impact-damage) — Taylor Guitars；访问日期：2026-10-01。",
  "safety-bapam":
    "[^safety-bapam]: [Returning to Playing and Performance for Instrumental Musicians](https://www.bapam.org.uk/return-to-play/) — British Association for Performing Arts Medicine；访问日期：2026-10-01。",
  "safety-nhs-rsi":
    "[^safety-nhs-rsi]: [Repetitive strain injury (RSI)](https://www.nhs.uk/conditions/repetitive-strain-injury-rsi/) — NHS；访问日期：2026-10-01。",
}

const expectedLessons: ExpectedLesson[] = [
  {
    file: "content/04-演奏技巧/分解和弦基础.md",
    frontmatter: {
      title: "分解和弦基础",
      description: "把和弦音按弦号与口数依次拨出，建立分解和弦的基础控制",
      permalink: "/technique/arpeggio-basics",
      type: "lesson",
      level: "基础",
      prerequisites: ["六八拍伴奏"],
      tags: ["分解和弦", "演奏技巧", "右手", "练习"],
      draft: false,
    },
    sources: ["arpeggio-fender", "safety-bapam"],
    claimAnchors: {
      "arpeggio-fender": "后者就是本页所说的分解和弦",
      "safety-bapam": "不适或疲劳时暂停",
    },
    links: [
      "03-节奏系统/六八拍伴奏",
      "04-演奏技巧/常用分解和弦型",
      "02-和弦系统/C和弦",
      "01-持琴与基础动作/右手位置与发力",
    ],
    tables: [
      [
        ["项目", "内容"],
        ["口数", "1 2 3 4"],
        ["琴弦", "5 3 2 1"],
        ["拨弦手", "拇 食 中 无名"],
      ],
    ],
  },
  {
    file: "content/04-演奏技巧/常用分解和弦型.md",
    frontmatter: {
      title: "常用分解和弦型",
      description: "用四四拍与六八拍原创弦序练习常用分解和弦型，并保持和弦音连续",
      permalink: "/technique/arpeggio-patterns",
      type: "lesson",
      level: "基础",
      prerequisites: ["分解和弦基础"],
      tags: ["分解和弦", "演奏技巧", "节奏", "练习"],
      draft: false,
    },
    sources: ["arpeggio-fender", "travis-fender", "safety-bapam"],
    claimAnchors: {
      "arpeggio-fender": "分解和弦的核心仍是让和弦音依次出现",
      "travis-fender": "拇指可以负责低音",
      "safety-bapam": "不适或控制下降时暂停",
    },
    links: [
      "04-演奏技巧/分解和弦基础",
      "04-演奏技巧/交替低音",
      "03-节奏系统/六八拍伴奏",
      "02-和弦系统/C和弦",
      "02-和弦系统/G和弦",
    ],
    tables: [
      [
        ["型", "口数", "琴弦", "拨弦手"],
        ["4/4 C", "1 & 2 & 3 & 4 &", "5 3 2 1 2 3 2 3", "拇 食 中 无名 中 食 中 食"],
        ["4/4 G", "1 & 2 & 3 & 4 &", "6 3 2 1 2 3 2 3", "拇 食 中 无名 中 食 中 食"],
        ["6/8 C", "1 2 3 | 4 5 6", "5 3 2 | 4 3 2", "拇 食 中 | 拇 食 中"],
      ],
    ],
  },
  {
    file: "content/04-演奏技巧/交替低音.md",
    frontmatter: {
      title: "交替低音",
      description: "用拇指交替弹奏和弦低音，并与高音弦保持稳定分工",
      permalink: "/technique/alternating-bass",
      type: "lesson",
      level: "基础",
      prerequisites: ["常用分解和弦型"],
      tags: ["分解和弦", "演奏技巧", "节奏", "右手"],
      draft: false,
    },
    sources: ["travis-fender", "arpeggio-fender", "safety-bapam"],
    claimAnchors: {
      "travis-fender": "Travis picking 教学常让拇指维持交替低音",
      "arpeggio-fender": "高音仍按分解和弦方式依次出现",
      "safety-bapam": "不适、疲劳或动作控制下降时暂停",
    },
    links: [
      "04-演奏技巧/常用分解和弦型",
      "04-演奏技巧/左手制音",
      "02-和弦系统/C和弦",
      "02-和弦系统/和弦转换方法",
    ],
    tables: [
      [
        ["项目", "内容"],
        ["口数", "1 & 2 & 3 & 4 &"],
        ["琴弦", "5 3 4 2 5 3 4 2"],
        ["拨弦手", "拇 食 拇 中 拇 食 拇 中"],
      ],
    ],
  },
  {
    file: "content/04-演奏技巧/左手制音.md",
    frontmatter: {
      title: "左手制音",
      description: "用按弦手停止延音并控制非目标弦，区分清晰停音与意外闷音",
      permalink: "/technique/fretting-mute",
      type: "lesson",
      level: "基础",
      prerequisites: ["和弦转换方法", "重音与强弱层次"],
      tags: ["制音", "演奏技巧", "左手", "练习"],
      draft: false,
    },
    sources: ["muting-yamaha", "safety-bapam"],
    claimAnchors: {
      "muting-yamaha": "按弦手可以有意控制不需要继续发声的弦",
      "safety-bapam": "不适或控制下降时暂停",
    },
    links: [
      "02-和弦系统/和弦转换方法",
      "03-节奏系统/重音与强弱层次",
      "04-演奏技巧/右手制音",
      "01-持琴与基础动作/正确按弦",
    ],
    tables: [
      [
        ["项目", "内容"],
        ["口数", "1 & 2 & 3 & 4 &"],
        ["动作", "响 停 响 停 响 停 响 停"],
      ],
    ],
  },
  {
    file: "content/04-演奏技巧/右手制音.md",
    frontmatter: {
      title: "右手制音",
      description: "在琴桥附近用拨弦手控制延音与音色，并比较开放音和掌根制音",
      permalink: "/technique/palm-mute",
      type: "lesson",
      level: "基础",
      prerequisites: ["左手制音", "放松而稳定的扫弦动作"],
      tags: ["制音", "演奏技巧", "右手", "节奏"],
      draft: false,
    },
    sources: ["palm-mute-fender", "safety-bapam"],
    claimAnchors: {
      "palm-mute-fender": "拨弦手在琴桥附近接触琴弦",
      "safety-bapam": "不适或控制下降时暂停",
    },
    links: [
      "04-演奏技巧/左手制音",
      "03-节奏系统/放松而稳定的扫弦动作",
      "04-演奏技巧/击弦与勾弦",
      "03-节奏系统/四拍全下扫",
    ],
    tables: [
      [
        ["小节", "口数", "动作", "声音"],
        ["第一小节", "1 2 3 4", "↓ ↓ ↓ ↓", "开放"],
        ["第二小节", "1 2 3 4", "↓ ↓ ↓ ↓", "轻掌根制音"],
      ],
    ],
  },
  {
    file: "content/04-演奏技巧/击弦与勾弦.md",
    frontmatter: {
      title: "击弦与勾弦",
      description: "用一次拨弦连接击弦与勾弦音，并控制音量、节拍与多余弦声",
      permalink: "/technique/hammer-pull",
      type: "lesson",
      level: "基础",
      prerequisites: ["正确按弦", "左手制音"],
      tags: ["演奏技巧", "左手", "练习", "安全"],
      draft: false,
    },
    sources: ["hammer-pull-fender", "fretting-fender", "safety-bapam", "safety-nhs-rsi"],
    claimAnchors: {
      "hammer-pull-fender": "击弦与勾弦都能在只拨第一音后",
      "fretting-fender": "手指靠近目标品丝有助于获得清楚发声",
      "safety-bapam": "一般停止边界见 BAPAM",
      "safety-nhs-rsi": "疼痛、无力、肿胀、麻木或针刺等警讯见 NHS",
    },
    links: [
      "01-持琴与基础动作/正确按弦",
      "04-演奏技巧/左手制音",
      "04-演奏技巧/滑音",
      "01-持琴与基础动作/相邻弦与跨弦",
    ],
    tables: [
      [
        ["动作", "口数", "品位", "拨弦"],
        ["击弦", "1 &", "二弦 1→3", "只拨第一音"],
        ["勾弦", "1 &", "二弦 3→1", "只拨第一音"],
      ],
    ],
  },
  {
    file: "content/04-演奏技巧/滑音.md",
    frontmatter: {
      title: "滑音",
      description: "在同一根弦上保持有效接触完成指上滑音，并准确落到目标品位",
      permalink: "/technique/slide",
      type: "lesson",
      level: "基础",
      prerequisites: ["击弦与勾弦"],
      tags: ["演奏技巧", "左手", "练习", "安全"],
      draft: false,
    },
    sources: ["solo-fender", "fretting-fender", "safety-bapam", "safety-nhs-rsi"],
    claimAnchors: {
      "solo-fender": "指上滑音先让起始音发声",
      "fretting-fender": "目标音若杂乱",
      "safety-bapam": "一般停止边界见 BAPAM",
      "safety-nhs-rsi": "症状持续或加重时的求助边界见 NHS",
    },
    links: [
      "04-演奏技巧/击弦与勾弦",
      "04-演奏技巧/自然泛音与打板",
      "01-持琴与基础动作/正确按弦",
      "01-持琴与基础动作/左手拇指与手腕",
    ],
    tables: [
      [
        ["动作", "口数", "品位", "拨弦与移动"],
        ["上滑", "1 &", "二弦 1→3", "只拨第一音，同一手指移动"],
        ["下滑", "1 &", "二弦 3→1", "只拨第一音，同一手指移动"],
      ],
    ],
  },
  {
    file: "content/04-演奏技巧/自然泛音与打板.md",
    frontmatter: {
      title: "自然泛音与打板",
      description: "分别体验十二品自然泛音与可选轻触打板，并守住手部和琴体安全边界",
      permalink: "/technique/harmonics-percussion",
      type: "lesson",
      level: "进阶",
      prerequisites: ["滑音", "重音与强弱层次"],
      tags: ["演奏技巧", "右手", "节奏", "安全"],
      draft: false,
    },
    sources: [
      "harmonics-yamaha",
      "percussion-yamaha",
      "impact-taylor",
      "safety-bapam",
      "safety-nhs-rsi",
    ],
    claimAnchors: {
      "harmonics-yamaha": "弦的节点可产生自然泛音",
      "percussion-yamaha": "吉他面板或侧板可以用来产生打击音色",
      "impact-taylor": "明显撞击或可见损伤需要检查",
      "safety-bapam": "一般停止边界见 BAPAM",
      "safety-nhs-rsi": "持续或加重时求助的边界见 NHS",
    },
    links: [
      "04-演奏技巧/滑音",
      "03-节奏系统/重音与强弱层次",
      "03-节奏系统/六八拍伴奏",
      "00-从这里开始/学习路线总览",
      "01-持琴与基础动作/认识民谣吉他",
      "05-弹唱与伴奏/根据人声选择调",
    ],
    tables: [
      [
        ["步骤", "操作"],
        ["触点", "一弦或六弦第 12 品品丝上方轻触"],
        ["发声", "拨弦"],
        ["离开", "移开触弦手"],
      ],
      [
        ["口数", "1", "2", "3", "4"],
        ["拍点", "拍手", "停", "拍手", "停"],
      ],
    ],
  },
]

const protectedFileDigests: Record<string, string> = {
  "data/diagrams/chords.yml": "2e9b58bb74e628dee736bf062c6dc379a80571a8215ecc9a8d359a5b94ec4594",
  "data/diagrams/fretboards.yml":
    "15a06129aa087b75181d53260007dfd0da8539e103729798ddc5425cd0b1ad73",
  "data/diagrams/rhythms.yml": "28b9a2d6b5ea31149625f5044f72c7b35e723371b5ee472132e58eee1ef36aff",
  "content/assets/diagrams/chord-a-major.svg":
    "a73378d4b2537fc15063993cf2c655f49f109ff9eecad4f3b4efa99da9ea45ae",
  "content/assets/diagrams/chord-a-minor.svg":
    "7817b20c5d1e4724065e78a0e421acd8d34b4c31a0c9ddb3920977c3751c2414",
  "content/assets/diagrams/chord-a7-open.svg":
    "733f338a7de5e61bffdb276ebc28260d15cf77a3defe592781d96076b689c712",
  "content/assets/diagrams/chord-c-major.svg":
    "5e38ebf3987a3b89a3264533af32e3eeb255d8142b7750dce11376b65ff38647",
  "content/assets/diagrams/chord-d-major.svg":
    "c847a3f2b330026459fdbf07d77da0633fb6a54f26b71c0b7ab95f118f711164",
  "content/assets/diagrams/chord-d-minor.svg":
    "2bc2ddc33fc1ae142cdb21bf77055cb7dff79cf9efeaf54e1928b36430b2864d",
  "content/assets/diagrams/chord-d7-open.svg":
    "4715cae726fca6735ad8498e433b917c6b4f81b793d5096ea57ea9e1512a622d",
  "content/assets/diagrams/chord-e-major.svg":
    "b831b142b62524572260601f560bb408b8c49c845a52e5843a04205d7100ac53",
  "content/assets/diagrams/chord-e-minor.svg":
    "65f8572876b74fcc5e72b62d9aee7adced19946a9db0541a6d2d26d96e5107d6",
  "content/assets/diagrams/chord-e7-open.svg":
    "859e88ac2d9eb841a5373fc469a5a9553d3614865cde7b87f44c094e99df4938",
  "content/assets/diagrams/chord-f-major-barre.svg":
    "825afe5f1343d00a573e5705818b704b5dc41249398ee144b5f9a2918a7cb64a",
  "content/assets/diagrams/chord-f-major-simplified.svg":
    "74208dad63e7638982084a2922e13c1de9c5703c6a421c16bd0310ae3069743d",
  "content/assets/diagrams/chord-g-major.svg":
    "a65ad2bac67360f211e9d568023f8b95dcc2fefa9f9d28d145d76530d7ba52f5",
  "content/assets/diagrams/fretboard-c-major-scale.svg":
    "8f25ab884e2f3f122062909a2e4e465881641ce676e74d3cec769a0f4acf0404",
  "content/assets/diagrams/rhythm-basic-eighth-strum.svg":
    "2de77615d3652cdde5529d2e72cc25e31a0b2a8c16092372c950dc83b7bd54f3",
  "content/assets/diagrams/rhythm-four-downstrokes.svg":
    "b3810fe8a39d4fd860762a5c74d8860a14a2e8ca9de5244cdb4082a819f1ed2d",
  "content/assets/diagrams/rhythm-six-eight-arpeggio-pulse.svg":
    "452d9b566403edca776a0be0510dfd23a7cfccdf30ae24b5d252ecbf74b2505a",
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

function tableCells(body: string): string[][][] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body)
  const tables: string[][][] = []
  visit(tree, "table", (node) => {
    tables.push(node.children.map((row) => row.children.map((cell) => toString(cell).trim())))
  })
  return tables
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

function paragraphsBeforeReferences(body: string): string[] {
  return body
    .split("## 参考来源与延伸阅读", 1)[0]
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function internalCurriculumLinks(page: PageRecord): string[] {
  return page.links.filter(
    (raw) =>
      !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(raw) &&
      !/(?:^|\/)assets\//u.test(raw) &&
      !/\.svg(?:$|[#?])/iu.test(raw),
  )
}

function normalizedInternalTargets(page: PageRecord): string[] {
  return sorted(
    new Set(
      internalCurriculumLinks(page).map((raw) =>
        raw.split("|", 1)[0].split("#", 1)[0].replace(/\.md$/iu, ""),
      ),
    ),
  )
}

function section(body: string, heading: string): string {
  return body.split(`## ${heading}\n`, 2)[1]?.split("\n## ", 1)[0] ?? ""
}

const arabicFixedQuotaPattern =
  /(?:\d+\s*(?:BPM|秒钟?|分钟|小时|次|遍|回|组|轮|天|日|周|星期)|BPM\s*\d+)/giu
const chineseQuotaNumber = "[零〇一二两三四五六七八九十百千万]+"
const chineseFixedQuotaPatterns = [
  new RegExp(`${chineseQuotaNumber}\\s*BPM`, "giu"),
  new RegExp(
    `(?:每天|每日|每周|每星期)\\s*(?:练习|练|做|重复)?\\s*${chineseQuotaNumber}\\s*(?:BPM|秒钟?|分钟|小时|次|遍|回|组|轮)`,
    "gu",
  ),
  new RegExp(
    `(?:练习|练|做|重复|持续|坚持)\\s*${chineseQuotaNumber}\\s*(?:BPM|秒钟?|分钟|小时|次|遍|回|组|轮|天|日|周|星期)`,
    "gu",
  ),
]

function fixedPracticeQuotaMatches(body: string): string[] {
  return [
    ...body.matchAll(arabicFixedQuotaPattern),
    ...chineseFixedQuotaPatterns.flatMap((pattern) => [...body.matchAll(pattern)]),
  ].map((match) => match[0])
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex")
}

const missingLessonFiles = expectedLessons
  .map(({ file }) => file)
  .filter((file) => !existsSync(file))
const lessonPages =
  missingLessonFiles.length === 0 ? expectedLessons.map(({ file }) => parsePage(file)) : []
const pageByFile = new Map(lessonPages.map((page) => [page.file, page]))

test("fixed practice quota detection covers Chinese numerals without rejecting musical coordinates", () => {
  const forbidden = [
    "每天练十分钟",
    "每周三次",
    "练习三遍后继续",
    "重复两组",
    "坚持二十秒",
    "练六十 BPM",
    "速度设为六十 BPM",
    "六十 BPM",
    "节拍器设为六十 BPM",
    "每天练 10 分钟",
  ]
  for (const sample of forbidden)
    assert.notDeepEqual(fixedPracticeQuotaMatches(sample), [], `must reject: ${sample}`)

  const musicalCoordinates = [
    "二弦 1→3",
    "第十二品品丝上方",
    "第一小节",
    "口数 1 2 3 | 4 5 6",
    "6/8 C",
    "两个三格组",
  ]
  for (const sample of musicalCoordinates)
    assert.deepEqual(fixedPracticeQuotaMatches(sample), [], `must allow: ${sample}`)
})

test("all eight exact technique lesson files exist with no extra formal page", () => {
  assert.deepEqual(
    missingLessonFiles,
    [],
    `missing Task 5 technique pages (${missingLessonFiles.length}/8):\n${missingLessonFiles.join("\n")}`,
  )
  const actual = existsSync(techniqueDirectory)
    ? readdirSync(techniqueDirectory)
        .filter((file) => file.endsWith(".md"))
        .sort((left, right) => left.localeCompare(right, "zh-CN"))
    : []
  const expected = expectedLessons
    .map(({ file }) => file.split("/").at(-1)!)
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
  assert.deepEqual(actual, expected)
})

test(
  "frontmatter, headings, manifest order, and backward prerequisites match the contract",
  {
    skip: missingLessonFiles.length > 0,
  },
  () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const manifestIndex = new Map(manifest.pages.map((entry, index) => [entry.title, index]))
    assert.deepEqual(
      manifest.pages.filter((entry) => entry.module === "technique").map((entry) => entry.title),
      expectedLessons.map(({ frontmatter }) => String(frontmatter.title)),
    )
    assert.deepEqual(
      manifest.pages.filter((entry) => entry.module === "technique").map((entry) => entry.file),
      expectedLessons.map(({ file }) => file.replace(/^content\//u, "")),
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
      assert.notEqual(position, undefined, `${expected.file} manifest title`)
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
  "every action table is exact, original, and accompanied by the three-stage practice ladder",
  {
    skip: missingLessonFiles.length > 0,
  },
  () => {
    for (const expected of expectedLessons) {
      const body = pageByFile.get(expected.file)!.body
      assert.deepEqual(tableCells(body), expected.tables, `${expected.file} exact action tables`)
      assert.ok(
        (body.match(/原创练习/gu) ?? []).length >= expected.tables.length,
        `${expected.file} originality labels`,
      )
      const practice = section(body, "分级练习")
      assert.match(practice, /不开节拍器/u, `${expected.file} isolated practice`)
      assert.match(practice, /舒适脉冲/u, `${expected.file} comfortable pulse`)
      assert.match(
        practice,
        /学习者自选的目标脉冲/u,
        `${expected.file} learner-selected target pulse`,
      )
      assert.match(practice, /音色、拍点和放松动作.*稳定/u, `${expected.file} progression gate`)
      assert.match(practice, /任一项.*退回/u, `${expected.file} regression gate`)
      assert.doesNotMatch(body, /练到熟|坚持(?:若干|一些)(?:分钟|小时)/u, expected.file)
    }
  },
)

test(
  "claim-level source references, exact definitions, and safety boundaries match the contract",
  {
    skip: missingLessonFiles.length > 0,
  },
  () => {
    for (const expected of expectedLessons) {
      const body = pageByFile.get(expected.file)!.body
      const ids = footnoteIds(body)
      assert.deepEqual(ids.definitions, sorted(expected.sources), `${expected.file} definitions`)
      assert.deepEqual(ids.references, ids.definitions, `${expected.file} references`)
      const claimBody = body.split("## 参考来源与延伸阅读", 1)[0]
      const claimReferences = sorted(
        new Set([...claimBody.matchAll(/\[\^([a-z0-9-]+)\]/gu)].map((match) => match[1])),
      )
      assert.deepEqual(
        claimReferences,
        sorted(expected.sources),
        `${expected.file} claim-level sources`,
      )
      assert.deepEqual(
        sorted(Object.keys(expected.claimAnchors)),
        sorted(expected.sources),
        `${expected.file} source-to-claim anchor coverage`,
      )
      const claimParagraphs = paragraphsBeforeReferences(body)
      for (const [id, anchor] of Object.entries(expected.claimAnchors)) {
        const anchoredParagraphs = claimParagraphs.filter((paragraph) => paragraph.includes(anchor))
        assert.equal(
          anchoredParagraphs.length,
          1,
          `${expected.file} unique claim anchor for ${id}: ${anchor}`,
        )
        assert.ok(
          anchoredParagraphs[0].includes(`[^${id}]`),
          `${expected.file} ${id} citation must share the claim paragraph: ${anchor}`,
        )
      }
      const definitions = footnoteDefinitionLines(body)
      for (const id of expected.sources)
        assert.equal(
          definitions.get(id),
          exactSourceDefinitions[id],
          `${expected.file} exact source ${id}`,
        )
      assert.equal(body.split(safetyBlock).length - 1, 1, `${expected.file} exact safety block`)
      assert.deepEqual(fixedPracticeQuotaMatches(body), [], `${expected.file} fixed practice quota`)
      assert.doesNotMatch(body, /(?<!不)用于(?:诊断|治疗)|治愈|保证防伤|忍耐疼痛/u, expected.file)
    }
    const finalBody = pageByFile.get("content/04-演奏技巧/自然泛音与打板.md")!.body
    assert.equal(finalBody.split(instrumentSafetyBlock).length - 1, 1)
    for (const expected of expectedLessons.slice(0, -1))
      assert.equal(pageByFile.get(expected.file)!.body.includes(instrumentSafetyBlock), false)
  },
)

test(
  "role mirroring and technique-specific factual boundaries remain explicit",
  {
    skip: missingLessonFiles.length > 0,
  },
  () => {
    for (const file of ["content/04-演奏技巧/左手制音.md", "content/04-演奏技巧/右手制音.md"]) {
      const body = pageByFile.get(file)!.body
      assert.ok(body.includes(roleMirrorNotice), file)
      assert.match(body, /按弦手/u, file)
      assert.match(body, /拨弦手/u, file)
    }

    const patterns = pageByFile.get("content/04-演奏技巧/常用分解和弦型.md")!.body
    assert.match(patterns, /常用.*本站.*(?:课程|选取)|本站.*(?:课程|选取).*常用/u)
    const alternating = pageByFile.get("content/04-演奏技巧/交替低音.md")!.body
    assert.match(
      alternating,
      /交替低音.*(?:不等于|不统称).*Travis picking|不把.*交替低音.*Travis picking/iu,
    )

    const frettingMute = pageByFile.get("content/04-演奏技巧/左手制音.md")!.body
    assert.match(frettingMute, /停止有效按压.*仍.*轻触/u)
    assert.match(frettingMute, /完全离弦.*杂声/u)
    assert.match(frettingMute, /持续按压.*延音/u)
    const palmMute = pageByFile.get("content/04-演奏技巧/右手制音.md")!.body
    assert.match(palmMute, /琴桥附近/u)
    assert.match(palmMute, /音色.*延音|延音.*音色/u)
    assert.match(palmMute, /不.*固定.*(?:位置|毫米|角度|压力)|没有.*唯一.*(?:位置|压力)/u)

    const hammerPull = pageByFile.get("content/04-演奏技巧/击弦与勾弦.md")!.body
    assert.match(hammerPull, /第二音.*(?:击弦|勾弦).*(?:产生|发声)/u)
    assert.match(hammerPull, /轻微拨过/u)
    assert.match(hammerPull, /邻弦/u)
    const slide = pageByFile.get("content/04-演奏技巧/滑音.md")!.body
    assert.match(slide, /指上滑音/u)
    assert.match(slide, /同一.*手指.*同一根弦/u)
    assert.match(slide, /不是.*(?:金属|瓶颈).*滑棒|不.*(?:金属|瓶颈).*滑棒/u)

    const harmonics = pageByFile.get("content/04-演奏技巧/自然泛音与打板.md")!.body
    const h3 = headingsAtDepth(harmonics, 3)
    assert.ok(h3.some((heading) => heading.includes("自然泛音")))
    assert.ok(h3.some((heading) => heading.includes("打板")))
    assert.match(harmonics, /第 `?12`? 品品丝上方.*轻触/u)
    assert.match(harmonics, /一弦或六弦/u)
    assert.match(harmonics, /轻触.*拨弦.*移开/u)
    assert.match(harmonics, /拍手|膝上/u)
    assert.match(harmonics, /打板.*可选/u)
  },
)

test(
  "the one reused diagram and all protected diagram sources and assets stay exact",
  {
    skip: missingLessonFiles.length > 0,
  },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)!
      const isPatternPage = expected.file.endsWith("/常用分解和弦型.md")
      assert.deepEqual(page.embeds, isPatternPage ? [diagramPath] : [], `${expected.file} embeds`)
      if (isPatternPage) {
        assert.ok(
          page.body.includes(
            `![${diagramAlt}](${diagramPath})\n\n[${diagramLabel}](${diagramPath})`,
          ),
          "adjacent accessible 6/8 diagram",
        )
        assert.ok(page.body.includes("1 2 3 | 4 5 6"))
        assert.ok(page.body.includes("5 3 2 | 4 3 2"))
        assert.ok(page.body.includes("拇 食 中 | 拇 食 中"))
      }
    }
    assert.equal(
      readdirSync("content/assets/diagrams").filter((file) => file.endsWith(".svg")).length,
      17,
    )
    for (const [file, digest] of Object.entries(protectedFileDigests))
      assert.equal(sha256(file), digest, `${file} must remain byte-for-byte unchanged`)
  },
)

test(
  "content-root full-path links and both handoffs match the published boundary",
  {
    skip: missingLessonFiles.length > 0,
  },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)!
      assert.deepEqual(
        normalizedInternalTargets(page),
        sorted(expected.links),
        `${expected.file} links`,
      )
      for (const raw of internalCurriculumLinks(page)) {
        assert.match(raw, /^[^|/]+\/.+\|.+$/u, `${expected.file}: ${raw}`)
        assert.doesNotMatch(raw, /^content\//u, `${expected.file}: content-root relative ${raw}`)
        assert.doesNotMatch(raw, /\.md(?:\||$)/iu, `${expected.file}: no .md ${raw}`)
      }
    }

    const route = parsePage("content/00-从这里开始/学习路线总览.md")
    const ordered = section(route.body, "有序链接")
    const items = [...ordered.matchAll(/^\d+\.\s+.*$/gmu)].map((match) => match[0])
    assert.equal(items.length, 10)
    assert.match(items[4], /\[\[04-演奏技巧\/分解和弦基础\|分解和弦基础\]\]/u)
    assert.match(items[5], /\[\[05-弹唱与伴奏\/根据人声选择调\|根据人声选择调\]\]/u)
    assert.match(items[6], /\[\[06-基础乐理与指板\/音高音名与唱名\|音高音名与唱名\]\]/u)
    assert.equal(
      items[7],
      "8. 练习与复盘：从 [[07-练习与复盘/有效练习流程|有效练习流程]] 进入，建立节拍器、速度、日志、错误修正与阶段测验闭环。",
    )
    for (const item of items.slice(8)) assert.doesNotMatch(item, /\[\[/u)

    const sixEight = parsePage("content/03-节奏系统/六八拍伴奏.md")
    const nextSection = section(sixEight.body, "下一步与相关词条")
    assert.match(nextSection, /下一步.*\[\[04-演奏技巧\/分解和弦基础\|分解和弦基础\]\]/u)

    const finalPage = pageByFile.get("content/04-演奏技巧/自然泛音与打板.md")!
    assert.match(
      section(finalPage.body, "下一步与相关词条"),
      /下一步.*\[\[05-弹唱与伴奏\/根据人声选择调\|根据人声选择调\]\]/u,
    )
  },
)

test(
  "the existing validators accept all sixty-five current pages without error diagnostics",
  {
    skip: missingLessonFiles.length > 0,
  },
  async () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const pages = manifest.pages
      .filter((entry) => existsSync(`${contentRoot}/${entry.file}`))
      .map((entry) => parsePage(`${contentRoot}/${entry.file}`))
    assert.equal(pages.length, 65)
    assert.deepEqual(validateMetadata(pages, manifest), [])
    assert.deepEqual(validateStructure(pages), [])
    assert.deepEqual(validateLinks(pages, contentRoot), [])
    const diagnostics = await validateContent({
      contentRoot,
      manifestPath: "data/content-manifest.yml",
      mode: "author",
    })
    assert.deepEqual(
      diagnostics.filter(({ severity }) => severity === "error"),
      [],
    )
    assert.equal(diagnostics.filter(({ severity }) => severity === "warning").length, 12)
  },
)
