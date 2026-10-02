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
  links: Record<string, string>
  tables: string[][][]
  orderedSteps: string[]
}

const contentRoot = "content"
const accompanimentDirectory = "content/05-弹唱与伴奏"
const safetyBlock =
  "安全边界：本页只提供一般性弹奏与发声练习信息，不用于诊断或治疗。弹奏出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降或明显不适时立即停止；发声出现嘶哑或粗糙、喉部疼痛或紧张、音域突然变化或发声费力时也应停止。症状持续、反复或加重时，请向合格医疗专业人士求助。"
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

const exactSourceDefinitions: Record<string, string> = {
  "voice-nidcd":
    "[^voice-nidcd]: [Taking Care of Your Voice](https://www.nidcd.nih.gov/health/taking-care-your-voice) — National Institute on Deafness and Other Communication Disorders, National Institutes of Health；访问日期：2026-10-01。",
  "safety-bapam":
    "[^safety-bapam]: [Returning to Playing and Performance for Instrumental Musicians](https://www.bapam.org.uk/return-to-play/) — British Association for Performing Arts Medicine；访问日期：2026-10-01。",
  "capo-fender":
    "[^capo-fender]: [What Is a Capo?](https://www.fender.com/articles/parts-and-accessories/what-is-a-capo) — Jeff Owens，Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "capo-daddario":
    "[^capo-daddario]: [How to Put a Capo on a Guitar](https://www.daddario.com/blogs/guitar/how-to-put-a-capo-on-a-guitar) — D'Addario Team，D'Addario & Co.；访问日期：2026-10-01。",
  "roman-libretexts":
    "[^roman-libretexts]: [7.1: Roman Numeral Chord Symbols](https://human.libretexts.org/Bookshelves/Music/Music_Theory/Music_Theory_for_the_21st-Century_Classroom_%28Hutchinson%29/07%3A_Roman_Numerals_and_Cadences/7.01%3A_Roman_Numeral_Chord_Symbols) — Robert Hutchinson，Humanities LibreTexts；访问日期：2026-10-01。",
  "form-omt":
    "[^form-omt]: [Introduction to Form in Popular Music](https://viva.pressbooks.pub/openmusictheory/chapter/intro-to-form-in-popular-music/) — Bryn Hughes、Megan Lavengood，Open Music Theory；访问日期：2026-10-01。",
  "form-openlearn":
    "[^form-openlearn]: [Introduction to music theory 1: form: 1 Indicators of form](https://www.open.edu/openlearn/history-the-arts/introduction-music-theory-1-form/content-section-3) — Byron Dueck，The Open University；访问日期：2026-10-01。",
  "dynamics-fender":
    "[^dynamics-fender]: [How to Use Dynamics to Improve Your Guitar Playing](https://www.fender.com/articles/techniques/how-to-use-dynamics-to-improve-guitar-playing) — Nick Stoubis，Fender Musical Instruments Corporation；访问日期：2026-10-01。",
  "sing-play-fender":
    "[^sing-play-fender]: [Double Duty: Learning How to Sing and Play](https://www.fender.com/articles/techniques/double-duty-learning-how-to-sing-and-play) — Jeff Owens，Fender Musical Instruments Corporation；访问日期：2026-10-01。",
}

const expectedLessons: ExpectedLesson[] = [
  {
    file: "content/05-弹唱与伴奏/根据人声选择调.md",
    frontmatter: {
      title: "根据人声选择调",
      description: "通过同一段材料的试唱观察人声舒适度，并把结果转成可执行的选调方向",
      permalink: "/accompaniment/choose-key",
      type: "lesson",
      level: "基础",
      prerequisites: ["自然泛音与打板", "C-Am-F-G和弦进行"],
      tags: ["弹唱", "调性", "和弦进行", "安全"],
      draft: false,
    },
    sources: ["voice-nidcd", "safety-bapam"],
    claimAnchors: {
      "voice-nidcd": "人的声音在音高、音量和音色上会有差异",
      "safety-bapam": safetyBlock,
    },
    links: {
      "04-演奏技巧/自然泛音与打板": "自然泛音与打板",
      "02-和弦系统/C-Am-F-G和弦进行": "C-Am-F-G和弦进行",
      "03-节奏系统/六八拍伴奏": "六八拍伴奏",
      "05-弹唱与伴奏/变调夹原理与用法": "变调夹原理与用法",
    },
    tables: [[["候选版本", "最低处", "最高处", "整段后声音", "吉他可执行性", "结论"]]],
    orderedSteps: [
      "先用学习者原创、公版或合法取得的短材料单独试唱。",
      "再加入轻量吉他，只检查伴奏是否影响原来的声音状态。",
      "记录最低处与最高处，不用一次状态给自己贴永久音域标签。",
      "比较各候选版本的整段状态与吉他可执行性。",
      "出现声音或弹奏警讯时停止，并把结论记为“今日停止”。",
    ],
  },
  {
    file: "content/05-弹唱与伴奏/变调夹原理与用法.md",
    frontmatter: {
      title: "变调夹原理与用法",
      description: "理解变调夹如何升高实响音高，并用正确位置、适量压力与逐弦检查完成安装",
      permalink: "/accompaniment/capo",
      type: "lesson",
      level: "基础",
      prerequisites: ["根据人声选择调", "吉他调音与标准音"],
      tags: ["变调夹", "弹唱", "调音", "练习"],
      draft: false,
    },
    sources: ["capo-fender", "capo-daddario", "voice-nidcd", "safety-bapam"],
    claimAnchors: {
      "capo-fender": "变调夹像可移动上弦枕",
      "capo-daddario": "D'Addario 直接支持",
      "voice-nidcd": "变调夹不会替你判断人声",
      "safety-bapam": safetyBlock,
    },
    links: {
      "05-弹唱与伴奏/根据人声选择调": "根据人声选择调",
      "00-从这里开始/吉他调音与标准音": "吉他调音与标准音",
      "02-和弦系统/F大横按与移动和弦": "F大横按与移动和弦",
      "05-弹唱与伴奏/和弦级数与移调": "和弦级数与移调",
    },
    tables: [
      [
        ["按法名称", "C", "G", "Am", "F"],
        ["实响和弦", "D", "A", "Bm", "G"],
      ],
    ],
    orderedSteps: [
      "先完成调音。",
      "确认目标品位。",
      "把夹具放在目标品丝后方，不压在品丝上。",
      "只用足以让琴弦清楚发声的最小需要压力。",
      "按本站保守操作步骤，从六弦到一弦逐根检查杂音与音准。",
      "最后复核调音。",
    ],
  },
  {
    file: "content/05-弹唱与伴奏/和弦级数与移调.md",
    frontmatter: {
      title: "和弦级数与移调",
      description: "用罗马数字保存和弦关系，并把原创八小节进行移到 C 大调、G 大调与夹二品版本",
      permalink: "/accompaniment/transposition",
      type: "lesson",
      level: "基础",
      prerequisites: ["变调夹原理与用法", "C-Am-F-G和弦进行"],
      tags: ["移调", "乐理", "和弦进行", "编配"],
      draft: false,
    },
    sources: ["roman-libretexts", "capo-fender", "voice-nidcd", "safety-bapam"],
    claimAnchors: {
      "roman-libretexts": "罗马数字对应当前调中的和弦根音级数",
      "capo-fender": "夹二品保留按法形状",
      "voice-nidcd": "旋律整体移动后仍要重新试唱",
      "safety-bapam": safetyBlock,
    },
    links: {
      "05-弹唱与伴奏/根据人声选择调": "根据人声选择调",
      "05-弹唱与伴奏/变调夹原理与用法": "变调夹原理与用法",
      "02-和弦系统/C-Am-F-G和弦进行": "C-Am-F-G和弦进行",
      "02-和弦系统/C-G-Am-Em和弦进行": "C-G-Am-Em和弦进行",
      "05-弹唱与伴奏/听辨歌曲结构": "听辨歌曲结构",
    },
    tables: [
      [
        ["小节", "1", "2", "3", "4", "5", "6", "7", "8"],
        ["级数", "I", "V", "vi", "IV", "I", "V", "IV", "I"],
        ["C 大调和弦", "C", "G", "Am", "F", "C", "G", "F", "C"],
        ["G 大调和弦", "G", "D", "Em", "C", "G", "D", "C", "G"],
      ],
      [
        ["按法名称", "C", "G", "Am", "F"],
        ["夹二品实响", "D", "A", "Bm", "G"],
      ],
    ],
    orderedSteps: [],
  },
  {
    file: "content/05-弹唱与伴奏/听辨歌曲结构.md",
    frontmatter: {
      title: "听辨歌曲结构",
      description: "用重复、对比与多项边界线索标记歌曲段落，不依赖歌词抄录",
      permalink: "/accompaniment/song-form",
      type: "lesson",
      level: "基础",
      prerequisites: ["根据人声选择调", "重音与强弱层次"],
      tags: ["编配", "弹唱", "节奏", "练习"],
      draft: false,
    },
    sources: ["form-omt", "form-openlearn", "voice-nidcd", "safety-bapam"],
    claimAnchors: {
      "form-omt": "段落边界可以由多项线索",
      "form-openlearn": "听辨曲式可以从重复、对比与变化开始",
      "voice-nidcd": safetyBlock,
      "safety-bapam": safetyBlock,
    },
    links: {
      "03-节奏系统/重音与强弱层次": "重音与强弱层次",
      "03-节奏系统/切分节奏入门": "切分节奏入门",
      "00-从这里开始/学习路线总览": "学习路线总览",
      "05-弹唱与伴奏/主歌与副歌的伴奏对比": "主歌与副歌的伴奏对比",
    },
    tables: [[["段落序号", "开始线索", "结束线索", "重复或对比", "暂记标签", "再出现位置"]]],
    orderedSteps: [],
  },
  {
    file: "content/05-弹唱与伴奏/主歌与副歌的伴奏对比.md",
    frontmatter: {
      title: "主歌与副歌的伴奏对比",
      description: "用密度、重音与相对音量为同一进行设计可辨认的主歌和副歌伴奏",
      permalink: "/accompaniment/verse-chorus",
      type: "lesson",
      level: "基础",
      prerequisites: ["听辨歌曲结构", "重音与强弱层次"],
      tags: ["编配", "弹唱", "节奏", "扫弦"],
      draft: false,
    },
    sources: ["form-omt", "form-openlearn", "dynamics-fender", "voice-nidcd", "safety-bapam"],
    claimAnchors: {
      "form-omt": "段落边界与功能需要多项证据",
      "form-openlearn": "主歌与副歌可由重复和对比辨认",
      "dynamics-fender": "dynamics 是相对音量变化",
      "voice-nidcd": safetyBlock,
      "safety-bapam": safetyBlock,
    },
    links: {
      "05-弹唱与伴奏/听辨歌曲结构": "听辨歌曲结构",
      "03-节奏系统/重音与强弱层次": "重音与强弱层次",
      "03-节奏系统/基础八分音符扫弦": "基础八分音符扫弦",
      "04-演奏技巧/常用分解和弦型": "常用分解和弦型",
      "05-弹唱与伴奏/前奏间奏与尾奏": "前奏间奏与尾奏",
    },
    tables: [
      [
        ["口数", "1", "&", "2", "&", "3", "&", "4", "&"],
        ["A 动作", "↓", "↑", "↓", "↑", "↓", "↑", "↓", "↑"],
        ["A 发声", "响", "空", "响", "空", "响", "空", "响", "空"],
        ["B 动作", "↓", "↑", "↓", "↑", "↓", "↑", "↓", "↑"],
        ["B 发声", "响", "响", "响", "响", "响", "响", "响", "响"],
        ["B 重音", ">", "·", "·", "·", ">", "·", "·", "·"],
      ],
    ],
    orderedSteps: [],
  },
  {
    file: "content/05-弹唱与伴奏/前奏间奏与尾奏.md",
    frontmatter: {
      title: "前奏间奏与尾奏",
      description: "分别设计前奏、器乐间奏与尾奏，理解它们和桥段的功能差异",
      permalink: "/accompaniment/intro-bridge-ending",
      type: "lesson",
      level: "基础",
      prerequisites: ["听辨歌曲结构", "主歌与副歌的伴奏对比"],
      tags: ["编配", "弹唱", "节奏", "练习"],
      draft: false,
    },
    sources: ["form-omt", "form-openlearn", "voice-nidcd", "safety-bapam"],
    claimAnchors: {
      "form-omt": "核心段落与辅助段落承担不同功能",
      "form-openlearn": "器乐间奏位于核心段落之间",
      "voice-nidcd": safetyBlock,
      "safety-bapam": safetyBlock,
    },
    links: {
      "05-弹唱与伴奏/听辨歌曲结构": "听辨歌曲结构",
      "05-弹唱与伴奏/主歌与副歌的伴奏对比": "主歌与副歌的伴奏对比",
      "03-节奏系统/四拍全下扫": "四拍全下扫",
      "05-弹唱与伴奏/弹唱协调训练": "弹唱协调训练",
    },
    tables: [
      [
        ["位置", "候选级数", "试听目的"],
        ["前奏", "I | V", "建立调与脉冲后进入主歌"],
        ["间奏", "vi | IV", "在两段核心内容之间连接并制造对比"],
        ["尾奏", "IV | I", "让最后一段回到清楚的结束点"],
      ],
    ],
    orderedSteps: [],
  },
  {
    file: "content/05-弹唱与伴奏/弹唱协调训练.md",
    frontmatter: {
      title: "弹唱协调训练",
      description: "把吉他动作与说唱事件分层对齐，再合并为稳定且可退阶的弹唱",
      permalink: "/accompaniment/sing-and-play",
      type: "lesson",
      level: "基础",
      prerequisites: ["根据人声选择调", "主歌与副歌的伴奏对比", "基础八分音符扫弦"],
      tags: ["弹唱", "练习", "节奏", "安全"],
      draft: false,
    },
    sources: ["sing-play-fender", "voice-nidcd", "safety-bapam"],
    claimAnchors: {
      "sing-play-fender": "弹唱会分配注意力",
      "voice-nidcd": safetyBlock,
      "safety-bapam": safetyBlock,
    },
    links: {
      "05-弹唱与伴奏/根据人声选择调": "根据人声选择调",
      "05-弹唱与伴奏/主歌与副歌的伴奏对比": "主歌与副歌的伴奏对比",
      "03-节奏系统/第一次使用节拍器": "第一次使用节拍器",
      "03-节奏系统/基础八分音符扫弦": "基础八分音符扫弦",
      "05-弹唱与伴奏/完整歌曲编配流程": "完整歌曲编配流程",
    },
    tables: [
      [
        ["口数", "1", "&", "2", "&", "3", "&", "4", "&"],
        ["吉他", "↓", "↑", "↓", "↑", "↓", "↑", "↓", "↑"],
        ["发声", "啦", "—", "—", "啦", "—", "—", "啦", "—"],
      ],
    ],
    orderedSteps: [
      "吉他单独稳定。",
      "说出声音事件。",
      "合并吉他与说话。",
      "换成舒适单音或学习者自有旋律。",
    ],
  },
  {
    file: "content/05-弹唱与伴奏/完整歌曲编配流程.md",
    frontmatter: {
      title: "完整歌曲编配流程",
      description: "把选调、和弦、结构、层次、段落连接和弹唱检查整合为可复核的编配流程",
      permalink: "/accompaniment/arrangement-workflow",
      type: "lesson",
      level: "进阶",
      prerequisites: ["和弦级数与移调", "前奏间奏与尾奏", "弹唱协调训练"],
      tags: ["编配", "弹唱", "移调", "复盘"],
      draft: false,
    },
    sources: ["roman-libretexts", "form-omt", "form-openlearn", "voice-nidcd", "safety-bapam"],
    claimAnchors: {
      "roman-libretexts": "级数表保存跨调关系",
      "form-omt": "多项边界线索共同标段落",
      "form-openlearn": "重复与对比建立段落地图",
      "voice-nidcd": safetyBlock,
      "safety-bapam": safetyBlock,
    },
    links: {
      "05-弹唱与伴奏/根据人声选择调": "根据人声选择调",
      "05-弹唱与伴奏/变调夹原理与用法": "变调夹原理与用法",
      "05-弹唱与伴奏/和弦级数与移调": "和弦级数与移调",
      "05-弹唱与伴奏/听辨歌曲结构": "听辨歌曲结构",
      "05-弹唱与伴奏/主歌与副歌的伴奏对比": "主歌与副歌的伴奏对比",
      "05-弹唱与伴奏/前奏间奏与尾奏": "前奏间奏与尾奏",
      "05-弹唱与伴奏/弹唱协调训练": "弹唱协调训练",
      "03-节奏系统/重音与强弱层次": "重音与强弱层次",
      "03-节奏系统/基础八分音符扫弦": "基础八分音符扫弦",
      "03-节奏系统/第一次使用节拍器": "第一次使用节拍器",
      "06-基础乐理与指板/音高音名与唱名": "音高音名与唱名",
      "07-练习与复盘/练习日志模板": "练习日志模板",
    },
    tables: [[["步骤", "当前选择", "可观察证据", "下一次只改一项"]]],
    orderedSteps: [
      "确认目标与合法材料",
      "选择候选调",
      "写级数/和弦表",
      "标段落地图",
      "设计主副歌对比",
      "安排前/间/尾奏",
      "标记弹唱冲突",
      "录音复核并只改一项",
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

function orderedSteps(body: string): string[] {
  return [...body.matchAll(/^\d+\.\s+(.+)$/gmu)].map((match) => match[1].trim())
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

const copyrightBoundaryPatterns = [
  /\bTAB\b/giu,
  /Bohemian Rhapsody|Pride \(In the Name of Love\)|In My Lonely Room/giu,
  /\b\d{1,2}:\d{2}\b/gu,
  /《[^》\r\n]+》/gu,
  /(?:来源|外部)?(?:歌曲(?:名|标题|例|示例)?|歌名|曲名)\s*[：:]\s*\S[^\r\n]*/giu,
  /(?:可照|照着|仿照|采用|使用)\s*[“"'‘][^”"'’\r\n]+[”"'’]\s*(?:编配|伴奏|改编)/giu,
  /(?:^|[。！？；\n])\s*(?:(?:主歌|副歌)\s*)?歌词(?:摘录|行|片段)?\s*[：:]\s*\S[^\r\n]*/gimu,
]

function copyrightBoundaryMatches(body: string): string[] {
  return copyrightBoundaryPatterns.flatMap((pattern) =>
    [...body.matchAll(pattern)].map((match) => match[0]),
  )
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

test("fixed practice quota detection rejects Arabic and Chinese dosages without rejecting musical coordinates", () => {
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
    "第 2 品",
    "六弦到一弦",
    "八小节",
    "第 1、3 拍",
    "口数 1 & 2 & 3 & 4 &",
    "两个三格组",
  ]
  for (const sample of musicalCoordinates)
    assert.deepEqual(fixedPracticeQuotaMatches(sample), [], `must allow: ${sample}`)
})

test("copyright boundary detection rejects external-song, lyric, TAB, and timestamp fixtures", () => {
  const forbidden = [
    "歌词：Let it be, let it be。",
    "副歌歌词行: Hello from the other side.",
    "例如可照《Let It Be》编配。",
    "例如可照“Let It Be”编配。",
    "歌曲示例：“Imagine”。",
    "来源歌曲例：In My Lonely Room。",
    "来源歌曲例：Pride (In the Name of Love)。",
    "外部歌名：Bohemian Rhapsody。",
    "附 TAB 片段。",
    "来源分析时间点 01:23。",
  ]
  for (const sample of forbidden)
    assert.notDeepEqual(copyrightBoundaryMatches(sample), [], `must reject: ${sample}`)
})

test("copyright boundary detection allows abstract curriculum and legal-boundary prose", () => {
  const allowed = [
    "课程页标题：根据人声选择调。",
    "可回看“听辨歌曲结构”与“前奏间奏与尾奏”。",
    "结构示例：“前奏 → 主歌 → 副歌 → 间奏 → 主歌 → 副歌 → 尾奏”。",
    "页面不抄歌词、旋律或完整和弦谱。",
    "记录歌词或诗行结束这一结构线索。",
    "本站原创八小节练习，不对应任何歌曲。",
    "歌曲结构可以由重复和对比听辨。",
  ]
  for (const sample of allowed)
    assert.deepEqual(copyrightBoundaryMatches(sample), [], `must allow: ${sample}`)
})

test("all protected diagram definitions and assets remain byte-for-byte unchanged", () => {
  assert.equal(
    readdirSync("content/assets/diagrams").filter((file) => file.endsWith(".svg")).length,
    17,
  )
  for (const [file, digest] of Object.entries(protectedFileDigests))
    assert.equal(sha256(file), digest, `${file} must remain byte-for-byte unchanged`)
})

test("all eight exact accompaniment lesson files exist with no extra formal page", () => {
  assert.deepEqual(
    missingLessonFiles,
    [],
    `missing Task 6 accompaniment pages (${missingLessonFiles.length}/8):\n${missingLessonFiles.join("\n")}`,
  )
  const actual = existsSync(accompanimentDirectory)
    ? readdirSync(accompanimentDirectory)
        .filter((file) => file.endsWith(".md"))
        .sort((left, right) => left.localeCompare(right, "zh-CN"))
    : []
  const expected = expectedLessons
    .map(({ file }) => file.split("/").at(-1)!)
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
  assert.deepEqual(actual, expected)
})

test(
  "frontmatter, headings, manifest order, and backward prerequisites match the exact DAG",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const manifestIndex = new Map(manifest.pages.map((entry, index) => [entry.title, index]))
    assert.deepEqual(
      manifest.pages
        .filter((entry) => entry.module === "accompaniment")
        .map((entry) => entry.title),
      expectedLessons.map(({ frontmatter }) => String(frontmatter.title)),
    )
    assert.deepEqual(
      manifest.pages.filter((entry) => entry.module === "accompaniment").map((entry) => entry.file),
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
  "claim-level source references, exact definitions, and unified safety blocks match the contract",
  { skip: missingLessonFiles.length > 0 },
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
      assert.ok(
        paragraphsBeforeReferences(body).some(
          (paragraph) =>
            paragraph.includes(safetyBlock) && paragraph.includes("[^safety-bapam][^voice-nidcd]"),
        ),
        `${expected.file} adjacent safety citations`,
      )
      assert.doesNotMatch(
        body,
        /(?<!不)用于(?:诊断|治疗)|治愈|判定为.*声部|永久音域(?:是|为)|忍耐(?:疼痛|嘶哑|疲劳)/u,
        expected.file,
      )
      assert.deepEqual(fixedPracticeQuotaMatches(body), [], `${expected.file} fixed practice quota`)
    }
  },
)

test(
  "all instructional tables and required ordered procedures are exact",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const body = pageByFile.get(expected.file)!.body
      assert.deepEqual(tableCells(body), expected.tables, `${expected.file} exact tables`)
      assert.deepEqual(
        orderedSteps(section(body, "图示与操作步骤")),
        expected.orderedSteps,
        `${expected.file} exact ordered steps`,
      )
    }
  },
)

test(
  "key selection stays non-diagnostic and returns only the approved observable conclusions",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const body = pageByFile.get("content/05-弹唱与伴奏/根据人声选择调.md")!.body
    for (const observation of ["最低处", "最高处", "整段后声音", "挤压", "喊叫", "吉他可执行性"])
      assert.ok(body.includes(observation), observation)
    assert.deepEqual(
      [...body.matchAll(/结论只写“([^”]+)”/gu)].map((match) => match[1]),
      ["保留、待升高、待降低、今日停止"],
    )
    assert.match(body, /调不是.*固定属性/u)
    assert.match(body, /原创、公版或合法取得/u)
  },
)

test(
  "capo placement, inference attribution, and shape-to-sounding mapping stay distinct",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const body = pageByFile.get("content/05-弹唱与伴奏/变调夹原理与用法.md")!.body
    assert.match(body, /可移动上弦枕/u)
    assert.match(body, /缩短.*有效弦长|有效弦长.*缩短/u)
    assert.match(body, /整体升高/u)
    assert.match(body, /保留.*开放和弦.*形/u)
    assert.match(body, /品丝后方/u)
    assert.match(body, /不压在品丝上/u)
    assert.match(body, /压力不足.*杂音|杂音.*压力不足/u)
    assert.match(body, /压力过大.*(?:跑音|音准)|(?:跑音|音准).*压力过大/u)
    assert.match(body, /本站.*保守操作.*六弦到一弦逐根检查/u)
    assert.match(body, /不是 D'Addario 的逐字规定/u)
    assert.match(body, /C 形.*手上按法.*D.*实响和弦/u)
    assert.match(body, /本批只用全六弦常规夹法/u)
  },
)

test(
  "Roman-numeral transposition preserves the exact original eight-bar relationships",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const body = pageByFile.get("content/05-弹唱与伴奏/和弦级数与移调.md")!.body
    assert.match(body, /本站原创八小节练习，不对应任何歌曲。/u)
    assert.match(body, /大写.*大和弦.*小写.*小和弦/u)
    assert.match(body, /保留.*(?:音程|级数)关系/u)
    assert.match(body, /旋律.*整体移动/u)
    assert.match(body, /节奏、音色和唱法.*不会.*自动/u)
    assert.doesNotMatch(body, /Nashville Number System|顺阶七和弦|转调\/离调/u)
  },
)

test(
  "form listening uses multiple boundary clues and a bounded cultural frame",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const body = pageByFile.get("content/05-弹唱与伴奏/听辨歌曲结构.md")!.body
    for (const clue of ["歌词或诗行结束", "节奏、和声或旋律到达", "配器或音量变化", "已听材料回归"])
      assert.ok(body.includes(clue), clue)
    assert.match(body, /单个线索不足/u)
    assert.match(body, /许多西方流行歌曲/u)
    assert.match(body, /不是所有音乐的唯一结构/u)
    assert.match(body, /前奏 → 主歌 → 副歌 → 间奏 → 主歌 → 副歌 → 尾奏/u)
    assert.match(body, /仅为练习结构，不是标准模板/u)
  },
)

test(
  "verse and chorus comparison changes controlled variables without making a universal loudness rule",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const body = pageByFile.get("content/05-弹唱与伴奏/主歌与副歌的伴奏对比.md")!.body
    assert.match(body, /共同项.*调、和弦、拍号、基本脉冲/u)
    assert.match(body, /密度、重音、相对音量或音色.*一至两项/u)
    assert.match(body, /副歌较突出.*不是所有歌曲法则/u)
    assert.match(body, /可以反向或不用/u)
    assert.match(body, /`空`.*不接触弦/u)
    assert.match(body, /不是闷音/u)
    assert.match(body, /第 `1`、`3` 拍.*课程版本/u)
    assert.match(body, /拨弦手.*相对.*按弦手.*不.*挤压/u)
    assert.match(body, /不要求猛扫/u)
  },
)

test(
  "intro, instrumental interlude, bridge, and ending remain functionally distinct",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const body = pageByFile.get("content/05-弹唱与伴奏/前奏间奏与尾奏.md")!.body
    assert.match(body, /前奏.*首个核心段落前/u)
    assert.match(body, /间奏.*核心段落之间.*器乐/u)
    assert.match(body, /尾奏.*最后段落.*结束/u)
    assert.ok(
      body.includes(
        "本页的间奏不是 bridge（桥段）的同义词；桥段通常是核心或对比段落，间奏在这里限定为器乐连接段。",
      ),
    )
    assert.equal(
      pageByFile.get("content/05-弹唱与伴奏/前奏间奏与尾奏.md")!.frontmatter.permalink,
      "/accompaniment/intro-bridge-ending",
    )
    assert.match(body, /三项.*本站原创候选/u)
  },
)

test(
  "sing-and-play coordination keeps four reversible layers and exact event semantics",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const body = pageByFile.get("content/05-弹唱与伴奏/弹唱协调训练.md")!.body
    assert.match(body, /`—`.*不新起声音/u)
    assert.match(body, /不表示停止呼吸、屏气或闷弦/u)
    assert.match(body, /第一阶段可以说 `啦`，不是必须歌唱/u)
    assert.match(body, /和弦转换丢拍.*一个和弦/u)
    assert.match(body, /发声抢拍.*只说网格/u)
    assert.match(body, /两线都乱.*口数与一条动作线/u)
    assert.match(body, /任何一层.*掉拍或紧张.*退回/u)
    assert.doesNotMatch(body, /自动化|肌肉记忆|不用想/u)
  },
)

test(
  "the arrangement workflow integrates the original exercise and preserves future text handoffs",
  { skip: missingLessonFiles.length > 0 },
  () => {
    const body = pageByFile.get("content/05-弹唱与伴奏/完整歌曲编配流程.md")!.body
    assert.match(body, /本站原创八小节练习，不对应任何歌曲。/u)
    for (const check of [
      "人声是否有警讯",
      "和弦与节拍是否稳定",
      "段落边界是否能听出",
      "强弱是否不靠按弦手挤压",
      "夹位与实响和弦是否记录一致",
    ])
      assert.ok(body.includes(check), check)
    assert.match(body, /下一步进入 \[\[06-基础乐理与指板\/音高音名与唱名\|音高音名与唱名\]\]/u)
    assert.ok(
      body.includes(
        "把本页的选调、和弦、段落与弹唱决定转记到 [[07-练习与复盘/练习日志模板|练习日志模板]]，保留当时条件、错误证据与下一次行动。",
      ),
    )
  },
)

test(
  "originality, copyright, zero-embed, and practice-ladder boundaries hold on all eight pages",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)!
      const body = page.body
      assert.deepEqual(page.embeds, [], `${expected.file} embeds`)
      assert.match(body, /原创练习|本站原创/u, `${expected.file} originality`)
      assert.deepEqual(copyrightBoundaryMatches(body), [], `${expected.file} copyright boundary`)
      assert.match(body, /原创、公版或合法取得/u, `${expected.file} legal material boundary`)
      const practice = section(body, "分级练习")
      assert.match(practice, /一级/u, `${expected.file} level one`)
      assert.match(practice, /二级/u, `${expected.file} level two`)
      assert.match(practice, /三级/u, `${expected.file} level three`)
      assert.match(practice, /退回/u, `${expected.file} regression gate`)
      assert.doesNotMatch(section(body, "自我检查标准"), /理解|熟练|唱得好/u, expected.file)
    }
  },
)

test(
  "content-root full-path links and the two earlier-page handoffs match the published boundary",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)!
      assert.deepEqual(
        normalizedInternalTargets(page),
        sorted(Object.keys(expected.links)),
        `${expected.file} link targets`,
      )
      assert.deepEqual(
        sorted(new Set(internalCurriculumLinks(page))),
        sorted(Object.entries(expected.links).map(([target, alias]) => `${target}|${alias}`)),
        `${expected.file} exact link target and alias pairs`,
      )
      for (const raw of internalCurriculumLinks(page)) {
        assert.match(raw, /^[^|/]+\/.+\|.+$/u, `${expected.file}: ${raw}`)
        assert.doesNotMatch(raw, /^content\//u, `${expected.file}: content-root relative ${raw}`)
        assert.doesNotMatch(raw, /\.md(?:\||$)/iu, `${expected.file}: no .md ${raw}`)
      }
    }

    const route = parsePage("content/00-从这里开始/学习路线总览.md")
    const items = [...section(route.body, "有序链接").matchAll(/^\d+\.\s+.*$/gmu)].map(
      (match) => match[0],
    )
    assert.equal(items.length, 10)
    assert.match(items[5], /\[\[05-弹唱与伴奏\/根据人声选择调\|根据人声选择调\]\]/u)
    assert.match(items[6], /\[\[06-基础乐理与指板\/音高音名与唱名\|音高音名与唱名\]\]/u)
    assert.equal(
      items[7],
      "8. 练习与复盘：从 [[07-练习与复盘/有效练习流程|有效练习流程]] 进入，建立节拍器、速度、日志、错误修正与阶段测验闭环。",
    )
    for (const item of items.slice(8)) assert.doesNotMatch(item, /\[\[/u)

    const techniqueHandoff = parsePage("content/04-演奏技巧/自然泛音与打板.md")
    assert.match(
      section(techniqueHandoff.body, "下一步与相关词条"),
      /下一步.*\[\[05-弹唱与伴奏\/根据人声选择调\|根据人声选择调\]\]/u,
    )
  },
)

test(
  "the existing validators accept all sixty-five current pages with only twelve author warnings",
  { skip: missingLessonFiles.length > 0 },
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
