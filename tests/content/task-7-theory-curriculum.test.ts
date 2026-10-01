import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
  prerequisiteLinks: Record<string, string>
  links: Record<string, string>
  table: string[][]
  embeds: string[]
}

const contentRoot = "content"
const theoryDirectory = "content/06-基础乐理与指板"
const safetyBlock =
  "安全边界：本页只提供一般性乐理与吉他练习信息，不用于诊断或治疗。弹奏出现疼痛、麻木或针刺感、无力、肿胀、动作控制下降或明显不适时立即停止；症状持续、反复或加重时，请向合格医疗专业人士求助。"
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
const fretboardPath = "../assets/diagrams/fretboard-c-major-scale.svg"
const exactSourceDefinitions: Record<string, string> = {
  "octave-puget":
    "[^octave-puget]: [Octave Registers](https://musictheory.pugetsound.edu/mt21c/OctaveRegisters.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "solfege-libretexts":
    "[^solfege-libretexts]: [1.12: Major Scales, Scale Degrees, and Key Signatures](https://human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_2e_%28Gotham_et_al.%29/01%3A_Fundamentals/1.12%3A_Major_Scales_Scale_Degrees_and_Key_Signatures) — Chelsey Hamm、Bryn Hughes，Open Music Theory 2e / Humanities LibreTexts；访问日期：2026-10-01。",
  "fretboard-yamaha":
    "[^fretboard-yamaha]: [Eight Great Tips for Learning Guitar](https://hub.yamaha.com/guitars/g-how-to/eight-great-tips-for-learning-guitar/) — Robbie Calvo，Yamaha Corporation of America；访问日期：2026-10-01。",
  "circle-yamaha":
    "[^circle-yamaha]: [Understanding the Circle of Fifths and Circle of Fourths](https://hub.yamaha.com/guitars/g-how-to/understanding-the-circle-of-fifths-and-circle-of-fourths/) — Robbie Calvo，Yamaha Corporation of America；访问日期：2026-10-01。",
  "steps-puget":
    "[^steps-puget]: [Half Steps and Whole Steps](https://musictheory.pugetsound.edu/mt21c/HalfStepsAndWholeSteps.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "accidentals-puget":
    "[^accidentals-puget]: [Accidentals](https://musictheory.pugetsound.edu/mt21c/Accidentals.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "enharmonic-puget":
    "[^enharmonic-puget]: [Enharmonic Notes](https://musictheory.pugetsound.edu/mt21c/EnharmonicNotes.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "intervals-puget":
    "[^intervals-puget]: [Introduction to Intervals](https://musictheory.pugetsound.edu/mt21c/IntervalsIntroduction.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "identify-intervals-puget":
    "[^identify-intervals-puget]: [How to Identify Intervals](https://musictheory.pugetsound.edu/mt21c/HowToIdentifyIntervals.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "major-scale-puget":
    "[^major-scale-puget]: [The Major Scale](https://musictheory.pugetsound.edu/mt21c/TheMajorScale.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "key-signatures-puget":
    "[^key-signatures-puget]: [Major Key Signatures](https://musictheory.pugetsound.edu/mt21c/MajorKeySignatures.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "triads-puget":
    "[^triads-puget]: [Introduction to Triads](https://musictheory.pugetsound.edu/mt21c/TriadsIntroduction.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "diatonic-puget":
    "[^diatonic-puget]: [Diatonic Chords in Major](https://musictheory.pugetsound.edu/mt21c/DiatonicChordsInMajor.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "roman-puget":
    "[^roman-puget]: [Roman Numeral Chord Symbols](https://musictheory.pugetsound.edu/mt21c/RomanNumeralChordSymbols.html) — Robert Hutchinson，Music Theory for the 21st-Century Classroom，University of Puget Sound；访问日期：2026-10-01。",
  "safety-bapam":
    "[^safety-bapam]: [Returning to Playing and Performance for Instrumental Musicians](https://www.bapam.org.uk/return-to-play/) — British Association for Performing Arts Medicine；访问日期：2026-10-01。",
}

const expectedLessons: ExpectedLesson[] = [
  {
    file: "content/06-基础乐理与指板/音高音名与唱名.md",
    frontmatter: {
      title: "音高音名与唱名",
      description: "区分音高、音名、八度音区、音级与首调唱名，并用标准定弦核对具体音高",
      permalink: "/theory/pitch-note-solfege",
      type: "lesson",
      level: "基础",
      prerequisites: ["完整歌曲编配流程", "吉他调音与标准音"],
      tags: ["乐理", "音名", "调性", "练习"],
      draft: false,
    },
    sources: ["octave-puget", "solfege-libretexts", "fretboard-yamaha", "safety-bapam"],
    claimAnchors: {
      "octave-puget": "A–G 七个字母循环",
      "solfege-libretexts": "本站采用首调唱名",
      "fretboard-yamaha": "标准定弦从六弦到一弦",
      "safety-bapam": safetyBlock,
    },
    prerequisiteLinks: {
      "05-弹唱与伴奏/完整歌曲编配流程": "完整歌曲编配流程",
      "00-从这里开始/吉他调音与标准音": "吉他调音与标准音",
    },
    links: {
      "05-弹唱与伴奏/完整歌曲编配流程": "完整歌曲编配流程",
      "00-从这里开始/吉他调音与标准音": "吉他调音与标准音",
      "06-基础乐理与指板/指板上的音名": "指板上的音名",
      "00-从这里开始/学习路线总览": "学习路线总览",
    },
    table: [
      ["回答的问题", "记号类别", "示例", "本页解释"],
      ["这个声音高还是低？", "音高关系", "后一个声音更高", "比较听觉/振动结果，不是名字"],
      ["它属于哪个字母？", "音名", "E", "A–G 循环"],
      ["是哪个音区的 E？", "科学音高记号", "E2、E4", "同名但不是同一具体音高"],
      ["在当前调里排第几？", "音级", "1、3、5", "依当前主音变化"],
      ["如何唱读音级？", "首调唱名", "do、mi、sol", "本站约定 1=do"],
    ],
    embeds: [],
  },
  {
    file: "content/06-基础乐理与指板/指板上的音名.md",
    frontmatter: {
      title: "指板上的音名",
      description: "从标准定弦和相邻品半音关系推导零到五品的自然音位置",
      permalink: "/theory/fretboard-notes",
      type: "lesson",
      level: "基础",
      prerequisites: ["音高音名与唱名", "吉他调音与标准音"],
      tags: ["乐理", "音名", "指板", "练习"],
      draft: false,
    },
    sources: ["fretboard-yamaha", "circle-yamaha", "steps-puget", "safety-bapam"],
    claimAnchors: {
      "fretboard-yamaha": "标准定弦低到高",
      "circle-yamaha": "向琴身方向移动一品",
      "steps-puget": "E–F、B–C",
      "safety-bapam": safetyBlock,
    },
    prerequisiteLinks: {
      "06-基础乐理与指板/音高音名与唱名": "音高音名与唱名",
      "00-从这里开始/吉他调音与标准音": "吉他调音与标准音",
    },
    links: {
      "06-基础乐理与指板/音高音名与唱名": "音高音名与唱名",
      "00-从这里开始/吉他调音与标准音": "吉他调音与标准音",
      "06-基础乐理与指板/全音与半音": "全音与半音",
      "01-持琴与基础动作/相邻弦与跨弦": "相邻弦与跨弦",
    },
    table: [
      ["弦", "0–5 品自然音位置"],
      ["6", "E0、F1、G3、A5"],
      ["5", "A0、B2、C3、D5"],
      ["4", "D0、E2、F3、G5"],
      ["3", "G0、A2、B4、C5"],
      ["2", "B0、C1、D3、E5"],
      ["1", "E0、F1、G3、A5"],
    ],
    embeds: [fretboardPath],
  },
  {
    file: "content/06-基础乐理与指板/全音与半音.md",
    frontmatter: {
      title: "全音与半音",
      description: "用单弦品格辨认全音、半音、自然音间距、临时记号与等音拼写",
      permalink: "/theory/whole-half-step",
      type: "lesson",
      level: "基础",
      prerequisites: ["指板上的音名"],
      tags: ["乐理", "音名", "指板", "音程"],
      draft: false,
    },
    sources: [
      "steps-puget",
      "accidentals-puget",
      "enharmonic-puget",
      "circle-yamaha",
      "safety-bapam",
    ],
    claimAnchors: {
      "steps-puget": "E–F、B–C 是相邻自然音中的半音",
      "accidentals-puget": "升号把音升高半音",
      "enharmonic-puget": "当前等温吉他品位语境",
      "circle-yamaha": "两品相差一个全音",
      "safety-bapam": safetyBlock,
    },
    prerequisiteLinks: { "06-基础乐理与指板/指板上的音名": "指板上的音名" },
    links: {
      "06-基础乐理与指板/指板上的音名": "指板上的音名",
      "06-基础乐理与指板/音程入门": "音程入门",
      "06-基础乐理与指板/音高音名与唱名": "音高音名与唱名",
    },
    table: [
      ["起点", "半音目标", "全音目标", "单弦位移"],
      ["E", "F", "F♯", "+1 / +2 品"],
      ["B", "C", "C♯", "+1 / +2 品"],
      ["C", "C♯ 或 D♭", "D", "+1 / +2 品"],
      ["G", "G♯ 或 A♭", "A", "+1 / +2 品"],
    ],
    embeds: [],
  },
  {
    file: "content/06-基础乐理与指板/音程入门.md",
    frontmatter: {
      title: "音程入门",
      description: "用字母跨度与半音数共同辨认常用旋律音程和和声音程",
      permalink: "/theory/intervals",
      type: "lesson",
      level: "基础",
      prerequisites: ["全音与半音"],
      tags: ["乐理", "音程", "指板", "练习"],
      draft: false,
    },
    sources: ["intervals-puget", "identify-intervals-puget", "enharmonic-puget", "safety-bapam"],
    claimAnchors: {
      "intervals-puget": "旋律音程先后发声",
      "identify-intervals-puget": "先数包含首尾的音名字母",
      "enharmonic-puget": "相同半音数也不能跳过拼写",
      "safety-bapam": safetyBlock,
    },
    prerequisiteLinks: { "06-基础乐理与指板/全音与半音": "全音与半音" },
    links: {
      "06-基础乐理与指板/全音与半音": "全音与半音",
      "06-基础乐理与指板/大调音阶": "大调音阶",
      "06-基础乐理与指板/指板上的音名": "指板上的音名",
    },
    table: [
      ["音名", "字母跨度", "半音数", "音程名"],
      ["C–C", "1", "0", "纯一度"],
      ["C–D♭", "2", "1", "小二度"],
      ["C–D", "2", "2", "大二度"],
      ["C–E♭", "3", "3", "小三度"],
      ["C–E", "3", "4", "大三度"],
      ["C–F", "4", "5", "纯四度"],
      ["C–G", "5", "7", "纯五度"],
      ["C–高八度 C", "8", "12", "纯八度"],
    ],
    embeds: [],
  },
  {
    file: "content/06-基础乐理与指板/大调音阶.md",
    frontmatter: {
      title: "大调音阶",
      description: "用全全半全全全半构造 C 大调与 G 大调，并在指板上核对音级",
      permalink: "/theory/major-scale",
      type: "lesson",
      level: "基础",
      prerequisites: ["音程入门", "指板上的音名"],
      tags: ["乐理", "音阶", "指板", "调性"],
      draft: false,
    },
    sources: ["major-scale-puget", "solfege-libretexts", "circle-yamaha", "safety-bapam"],
    claimAnchors: {
      "major-scale-puget": "七个不同字母依次出现",
      "solfege-libretexts": "相邻音的公式是全–全–半–全–全–全–半",
      "circle-yamaha": "G 大调写作 F♯",
      "safety-bapam": safetyBlock,
    },
    prerequisiteLinks: {
      "06-基础乐理与指板/音程入门": "音程入门",
      "06-基础乐理与指板/指板上的音名": "指板上的音名",
    },
    links: {
      "06-基础乐理与指板/音程入门": "音程入门",
      "06-基础乐理与指板/指板上的音名": "指板上的音名",
      "06-基础乐理与指板/调与调号": "调与调号",
      "06-基础乐理与指板/全音与半音": "全音与半音",
    },
    table: [
      ["音级", "首调唱名", "C 大调", "G 大调", "到下一级"],
      ["1", "do", "C", "G", "全音"],
      ["2", "re", "D", "A", "全音"],
      ["3", "mi", "E", "B", "半音"],
      ["4", "fa", "F", "C", "全音"],
      ["5", "sol", "G", "D", "全音"],
      ["6", "la", "A", "E", "全音"],
      ["7", "ti", "B", "F♯", "半音"],
      ["8", "do", "C", "G", "—"],
    ],
    embeds: [fretboardPath],
  },
  {
    file: "content/06-基础乐理与指板/调与调号.md",
    frontmatter: {
      title: "调与调号",
      description: "区分主音中心、调内音集合与调号，并比较 C、G、D、F 大调的升降音",
      permalink: "/theory/keys-signatures",
      type: "lesson",
      level: "基础",
      prerequisites: ["大调音阶", "和弦级数与移调"],
      tags: ["乐理", "调性", "音阶", "移调"],
      draft: false,
    },
    sources: ["key-signatures-puget", "solfege-libretexts", "accidentals-puget", "safety-bapam"],
    claimAnchors: {
      "key-signatures-puget": "调号是在谱首记录反复升降音的书写简记",
      "solfege-libretexts": "相对大小调可以共享调号",
      "accidentals-puget": "临时记号写在具体音符附近",
      "safety-bapam": safetyBlock,
    },
    prerequisiteLinks: {
      "06-基础乐理与指板/大调音阶": "大调音阶",
      "05-弹唱与伴奏/和弦级数与移调": "和弦级数与移调",
    },
    links: {
      "06-基础乐理与指板/大调音阶": "大调音阶",
      "05-弹唱与伴奏/和弦级数与移调": "和弦级数与移调",
      "06-基础乐理与指板/三和弦构成": "三和弦构成",
      "05-弹唱与伴奏/变调夹原理与用法": "变调夹原理与用法",
    },
    table: [
      ["大调", "音阶拼写", "调号升降音"],
      ["C 大调", "C D E F G A B", "无"],
      ["G 大调", "G A B C D E F♯", "F♯"],
      ["D 大调", "D E F♯ G A B C♯", "F♯、C♯"],
      ["F 大调", "F G A B♭ C D E", "B♭"],
    ],
    embeds: [],
  },
  {
    file: "content/06-基础乐理与指板/三和弦构成.md",
    frontmatter: {
      title: "三和弦构成",
      description: "从根音、三音与五音的音程关系构造大、小、减、增三和弦",
      permalink: "/theory/triads",
      type: "lesson",
      level: "基础",
      prerequisites: ["音程入门", "大调音阶", "和弦图读法"],
      tags: ["乐理", "和弦", "音程", "和弦进行"],
      draft: false,
    },
    sources: ["triads-puget", "identify-intervals-puget", "safety-bapam"],
    claimAnchors: {
      "triads-puget": "三个不同音高类别",
      "identify-intervals-puget": "从根音量半音",
      "safety-bapam": safetyBlock,
    },
    prerequisiteLinks: {
      "06-基础乐理与指板/音程入门": "音程入门",
      "06-基础乐理与指板/大调音阶": "大调音阶",
      "02-和弦系统/和弦图读法": "和弦图读法",
    },
    links: {
      "06-基础乐理与指板/音程入门": "音程入门",
      "06-基础乐理与指板/大调音阶": "大调音阶",
      "02-和弦系统/和弦图读法": "和弦图读法",
      "06-基础乐理与指板/顺阶和弦与级数": "顺阶和弦与级数",
      "02-和弦系统/C和弦": "C和弦",
      "02-和弦系统/Am与A和弦": "Am与A和弦",
    },
    table: [
      ["类型", "从根音算半音", "音程构成", "示例"],
      ["大三和弦", "0–4–7", "大三度 + 纯五度", "C–E–G"],
      ["小三和弦", "0–3–7", "小三度 + 纯五度", "A–C–E"],
      ["减三和弦", "0–3–6", "小三度 + 减五度", "B–D–F"],
      ["增三和弦", "0–4–8", "大三度 + 增五度", "C–E–G♯"],
    ],
    embeds: [],
  },
  {
    file: "content/06-基础乐理与指板/顺阶和弦与级数.md",
    frontmatter: {
      title: "顺阶和弦与级数",
      description: "在大调各音级上叠置三和弦，并把 C 大调和弦映射为罗马数字级数",
      permalink: "/theory/diatonic-chords",
      type: "lesson",
      level: "进阶",
      prerequisites: ["三和弦构成", "调与调号", "和弦级数与移调"],
      tags: ["乐理", "和弦", "和弦进行", "调性"],
      draft: false,
    },
    sources: ["diatonic-puget", "roman-puget", "safety-bapam"],
    claimAnchors: {
      "diatonic-puget": "隔一个音叠置出三和弦",
      "roman-puget": "I–ii–iii–IV–V–vi–vii°",
      "safety-bapam": safetyBlock,
    },
    prerequisiteLinks: {
      "06-基础乐理与指板/三和弦构成": "三和弦构成",
      "06-基础乐理与指板/调与调号": "调与调号",
      "05-弹唱与伴奏/和弦级数与移调": "和弦级数与移调",
    },
    links: {
      "06-基础乐理与指板/三和弦构成": "三和弦构成",
      "06-基础乐理与指板/调与调号": "调与调号",
      "05-弹唱与伴奏/和弦级数与移调": "和弦级数与移调",
      "02-和弦系统/C-G-Am-Em和弦进行": "C-G-Am-Em和弦进行",
      "02-和弦系统/C-Am-F-G和弦进行": "C-Am-F-G和弦进行",
      "00-从这里开始/学习路线总览": "学习路线总览",
    },
    table: [
      ["级数", "音名构成", "质量", "C 大调和弦"],
      ["I", "C–E–G", "大三和弦", "C"],
      ["ii", "D–F–A", "小三和弦", "Dm"],
      ["iii", "E–G–B", "小三和弦", "Em"],
      ["IV", "F–A–C", "大三和弦", "F"],
      ["V", "G–B–D", "大三和弦", "G"],
      ["vi", "A–C–E", "小三和弦", "Am"],
      ["vii°", "B–D–F", "减三和弦", "Bdim"],
    ],
    embeds: [],
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

function section(body: string, heading: string): string {
  return body.split(`## ${heading}\n`, 2)[1]?.split("\n## ", 1)[0] ?? ""
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

function assertTheorySnapshot(root: string): void {
  const pages = expectedLessons.map((expected) => ({
    expected,
    page: parsePage(join(root, expected.file)),
  }))
  for (const { expected, page } of pages) {
    const body = page.body
    assert.deepEqual(page.frontmatter, expected.frontmatter, `${expected.file} frontmatter`)
    assert.deepEqual(headingsAtDepth(body, 1), [expected.frontmatter.title], expected.file)
    assert.deepEqual(headingsAtDepth(body, 2), lessonSections, `${expected.file} H2`)
    assert.deepEqual(tableCells(body), [expected.table], `${expected.file} table`)
    assert.deepEqual(page.embeds, expected.embeds, `${expected.file} embeds`)
    assert.deepEqual(
      normalizedInternalTargets(page),
      sorted(Object.keys(expected.links)),
      `${expected.file} links`,
    )
    assert.deepEqual(
      sorted(new Set(internalCurriculumLinks(page))),
      sorted(Object.entries(expected.links).map(([target, alias]) => `${target}|${alias}`)),
      `${expected.file} target-alias pairs`,
    )
    const ids = footnoteIds(body)
    assert.deepEqual(ids.definitions, sorted(expected.sources), `${expected.file} definitions`)
    assert.deepEqual(ids.references, ids.definitions, `${expected.file} references`)
    const claimReferences = sorted(
      new Set(
        [...body.split("## 参考来源与延伸阅读", 1)[0].matchAll(/\[\^([a-z0-9-]+)\]/gu)].map(
          (match) => match[1],
        ),
      ),
    )
    assert.deepEqual(claimReferences, sorted(expected.sources), `${expected.file} claims`)
    const paragraphs = paragraphsBeforeReferences(body)
    for (const [id, anchor] of Object.entries(expected.claimAnchors)) {
      const matches = paragraphs.filter((paragraph) => paragraph.includes(anchor))
      assert.equal(matches.length, 1, `${expected.file} unique ${id}`)
      assert.ok(matches[0].includes(`[^${id}]`), `${expected.file} adjacent ${id}`)
    }
    const definitions = footnoteDefinitionLines(body)
    for (const id of expected.sources)
      assert.equal(definitions.get(id), exactSourceDefinitions[id], `${expected.file} ${id}`)
    assert.equal(body.split(safetyBlock).length - 1, 1, `${expected.file} safety`)
    assert.deepEqual(fixedPracticeQuotaMatches(body), [], `${expected.file} quota`)
  }

  const pitch = pages.find(({ expected }) => expected.file.endsWith("音高音名与唱名.md"))!.page.body
  assert.ok(pitch.includes("6→1弦：E2 | A2 | D3 | G3 | B3 | E4"))
  const finalPage = pages.find(({ expected }) => expected.file.endsWith("顺阶和弦与级数.md"))!.page
    .body
  assert.ok(finalPage.includes("下一步是有效练习流程；该页属于后续批次，当前保持纯文字。"))
  assert.doesNotMatch(finalPage, /\[\[[^\]]*有效练习流程/u)
}

function replaceTempText(root: string, relativeFile: string, from: string, to: string): void {
  const file = join(root, relativeFile)
  const body = readFileSync(file, "utf8")
  assert.ok(body.includes(from), `${relativeFile} mutation fixture: ${from}`)
  writeFileSync(file, body.replace(from, to))
}

const missingLessonFiles = expectedLessons
  .map(({ file }) => file)
  .filter((file) => !existsSync(file))
const lessonPages =
  missingLessonFiles.length === 0 ? expectedLessons.map(({ file }) => parsePage(file)) : []
const pageByFile = new Map(lessonPages.map((page) => [page.file, page]))

test("all eight exact theory lesson files exist with no extra formal page", () => {
  assert.deepEqual(
    missingLessonFiles,
    [],
    `missing Task 7 theory pages (${missingLessonFiles.length}/8):\n${missingLessonFiles.join("\n")}`,
  )
  const actual = existsSync(theoryDirectory)
    ? readdirSync(theoryDirectory)
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
      manifest.pages.filter((entry) => entry.module === "theory").map((entry) => entry.title),
      expectedLessons.map(({ frontmatter }) => String(frontmatter.title)),
    )
    assert.deepEqual(
      manifest.pages.filter((entry) => entry.module === "theory").map((entry) => entry.file),
      expectedLessons.map(({ file }) => file.replace(/^content\//u, "")),
    )
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)!
      assert.deepEqual(page.frontmatter, expected.frontmatter, `${expected.file} frontmatter`)
      assert.deepEqual(headingsAtDepth(page.body, 1), [expected.frontmatter.title], expected.file)
      assert.deepEqual(headingsAtDepth(page.body, 2), lessonSections, `${expected.file} H2`)
      const position = manifestIndex.get(String(expected.frontmatter.title))!
      for (const prerequisite of expected.frontmatter.prerequisites as string[]) {
        const prerequisitePosition = manifestIndex.get(prerequisite)
        assert.notEqual(prerequisitePosition, undefined, `${expected.file}: ${prerequisite}`)
        assert.ok(prerequisitePosition! < position, `${expected.file}: forward ${prerequisite}`)
      }
      const firstSection = section(page.body, "学习目标与先修知识")
      for (const [target, alias] of Object.entries(expected.prerequisiteLinks))
        assert.ok(
          firstSection.includes(`[[${target}|${alias}]]`),
          `${expected.file}: prerequisite link ${target}|${alias}`,
        )
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
      assert.deepEqual(claimReferences, sorted(expected.sources), `${expected.file} claims`)
      const paragraphs = paragraphsBeforeReferences(body)
      for (const [id, anchor] of Object.entries(expected.claimAnchors)) {
        const matches = paragraphs.filter((paragraph) => paragraph.includes(anchor))
        assert.equal(matches.length, 1, `${expected.file} unique ${id} anchor`)
        assert.ok(matches[0].includes(`[^${id}]`), `${expected.file} adjacent ${id}`)
      }
      const definitions = footnoteDefinitionLines(body)
      for (const id of expected.sources)
        assert.equal(definitions.get(id), exactSourceDefinitions[id], `${expected.file} ${id}`)
      assert.equal(body.split(safetyBlock).length - 1, 1, `${expected.file} safety block`)
      assert.deepEqual(fixedPracticeQuotaMatches(body), [], `${expected.file} fixed quota`)
      assert.doesNotMatch(body, /(?<!不)用于(?:诊断|治疗)|治愈|保证防伤|忍耐疼痛/u, expected.file)
    }
  },
)

test(
  "theory tables lock pitch, fretboard, interval, scale, key, triad, and diatonic facts",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons)
      assert.deepEqual(
        tableCells(pageByFile.get(expected.file)!.body),
        [expected.table],
        expected.file,
      )

    const pitch = pageByFile.get("content/06-基础乐理与指板/音高音名与唱名.md")!.body
    assert.ok(pitch.includes("6→1弦：E2 | A2 | D3 | G3 | B3 | E4"))
    assert.match(pitch, /两根 E 弦.*相差两个八度/u)
    assert.match(pitch, /只有在 C 大调.*C.*do/u)

    const intervals = pageByFile.get("content/06-基础乐理与指板/音程入门.md")!.body
    assert.match(intervals, /C–C.*机械计数/u)
    assert.match(intervals, /C–D♯.*不能.*小三度/u)

    const triads = pageByFile.get("content/06-基础乐理与指板/三和弦构成.md")!.body
    assert.match(triads, /三个不同音高类别/u)
    assert.match(triads, /六根弦.*三和弦/u)

    const diatonic = pageByFile.get("content/06-基础乐理与指板/顺阶和弦与级数.md")!.body
    assert.ok(diatonic.includes("C–G–Am–Em = I–V–vi–iii"))
    assert.ok(diatonic.includes("C–Am–F–G = I–vi–IV–V"))
  },
)

test(
  "only the two approved pages reuse the accessible fretboard asset and all diagrams stay unchanged",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)!
      assert.deepEqual(page.embeds, expected.embeds, `${expected.file} embeds`)
      if (expected.embeds.length > 0) {
        assert.match(
          page.body,
          /!\[[^\]]*(?:零到五品|0–5 品)[^\]]*C[^\]]*根音[^\]]*\]\(\.\.\/assets\/diagrams\/fretboard-c-major-scale\.svg\)/u,
        )
        assert.ok(
          page.body.includes(
            "[打开〈C 大调零到五品指板音位图〉原图（移动端可放大）](../assets/diagrams/fretboard-c-major-scale.svg)",
          ),
          `${expected.file} original diagram link`,
        )
        assert.match(
          page.body,
          /位置集合.*不.*(?:弹奏路线|指法顺序)|不.*(?:弹奏路线|指法顺序).*位置集合/u,
        )
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
  "full-path target-alias pairs, route handoff, and plain future handoffs match the boundary",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const page = pageByFile.get(expected.file)!
      assert.deepEqual(
        normalizedInternalTargets(page),
        sorted(Object.keys(expected.links)),
        expected.file,
      )
      assert.deepEqual(
        sorted(new Set(internalCurriculumLinks(page))),
        sorted(Object.entries(expected.links).map(([target, alias]) => `${target}|${alias}`)),
        `${expected.file} target-alias pairs`,
      )
      for (const raw of internalCurriculumLinks(page)) {
        assert.match(raw, /^[^|/]+\/.+\|.+$/u, `${expected.file}: ${raw}`)
        assert.doesNotMatch(raw, /^content\//u)
        assert.doesNotMatch(raw, /\.md(?:\||$)/iu)
      }
    }

    const route = parsePage("content/00-从这里开始/学习路线总览.md")
    const items = [...section(route.body, "有序链接").matchAll(/^\d+\.\s+.*$/gmu)].map(
      (match) => match[0],
    )
    assert.equal(items.length, 10)
    assert.equal(
      items[6],
      "7. 基础乐理与指板：从 [[06-基础乐理与指板/音高音名与唱名|音高音名与唱名]] 进入，连接音名、指板、音程、音阶、调号、三和弦与级数。",
    )
    for (const item of items.slice(7)) assert.doesNotMatch(item, /\[\[/u)

    const arrangement = parsePage("content/05-弹唱与伴奏/完整歌曲编配流程.md")
    const next = section(arrangement.body, "下一步与相关词条")
    assert.ok(
      next.includes(
        "下一步进入 [[06-基础乐理与指板/音高音名与唱名|音高音名与唱名]]，把编配时已经使用的音名、调与级数拆开验证。",
      ),
    )
    assert.match(next, /未来可转记到练习日志模板/u)
    assert.doesNotMatch(next, /\[\[[^\]]*练习日志模板/u)

    const finalPage = pageByFile.get("content/06-基础乐理与指板/顺阶和弦与级数.md")!.body
    assert.ok(finalPage.includes("下一步是有效练习流程；该页属于后续批次，当前保持纯文字。"))
    assert.doesNotMatch(finalPage, /\[\[[^\]]*有效练习流程/u)
  },
)

test(
  "original exercises, three-stage ladders, observable checks, and scope boundaries hold",
  { skip: missingLessonFiles.length > 0 },
  () => {
    for (const expected of expectedLessons) {
      const body = pageByFile.get(expected.file)!.body
      assert.match(body, /原创练习|本站原创/u, `${expected.file} originality`)
      const practice = section(body, "分级练习")
      assert.match(practice, /### 第一级：辨认/u)
      assert.match(practice, /### 第二级：映射/u)
      assert.match(practice, /### 第三级：整合/u)
      assert.match(practice, /退回/u)
      const checks = section(body, "自我检查标准")
      assert.ok([...checks.matchAll(/^-/gmu)].length >= 3, `${expected.file} checks`)
      assert.doesNotMatch(checks, /我理解了|我熟练了/u)
      assert.doesNotMatch(body, /歌词|\bTAB\b|《[^》]+》|Bohemian Rhapsody/iu)
      assert.doesNotMatch(
        body,
        /(?:^|\n)#{2,3}\s*(?:调式|七和弦|小调和声|次属和弦|借用和弦|功能和声)/u,
      )
    }
  },
)

test("temporary mutation copies reject every high-risk theory boundary break", () => {
  const mutations: Array<{
    name: string
    file: string
    from: string
    to: string
  }> = [
    {
      name: "standard-tuning octave",
      file: "content/06-基础乐理与指板/音高音名与唱名.md",
      from: "6→1弦：E2 | A2 | D3 | G3 | B3 | E4",
      to: "6→1弦：E3 | A2 | D3 | G3 | B3 | E4",
    },
    {
      name: "G-major spelling",
      file: "content/06-基础乐理与指板/大调音阶.md",
      from: "|    7 | ti       | B      | F♯     | 半音     |",
      to: "|    7 | ti       | B      | G♭     | 半音     |",
    },
    {
      name: "major-third semitones",
      file: "content/06-基础乐理与指板/音程入门.md",
      from: "| C–E        |        3 |      4 | 大三度 |",
      to: "| C–E        |        3 |      3 | 大三度 |",
    },
    {
      name: "major-triad formula",
      file: "content/06-基础乐理与指板/三和弦构成.md",
      from: "| 大三和弦 | 0–4–7        | 大三度 + 纯五度 | C–E–G  |",
      to: "| 大三和弦 | 0–3–7        | 大三度 + 纯五度 | C–E–G  |",
    },
    {
      name: "leading-tone diminished chord",
      file: "content/06-基础乐理与指板/顺阶和弦与级数.md",
      from: "| vii° | B–D–F    | 减三和弦 | Bdim       |",
      to: "| VII  | B–D♯–F♯  | 大三和弦 | B          |",
    },
    {
      name: "safety block",
      file: "content/06-基础乐理与指板/全音与半音.md",
      from: `> ${safetyBlock}[^safety-bapam]`,
      to: "",
    },
    {
      name: "claim citation adjacency",
      file: "content/06-基础乐理与指板/大调音阶.md",
      from: "七个不同字母依次出现，第八级回到高八度主音；字母不应跳过或重复。[^major-scale-puget]",
      to: "七个不同字母依次出现，第八级回到高八度主音；字母不应跳过或重复。",
    },
    {
      name: "approved source URL",
      file: "content/06-基础乐理与指板/全音与半音.md",
      from: "https://musictheory.pugetsound.edu/mt21c/EnharmonicNotes.html",
      to: "https://example.com/wrong-source",
    },
    {
      name: "full-path wikilink",
      file: "content/06-基础乐理与指板/大调音阶.md",
      from: "[[06-基础乐理与指板/音程入门|音程入门]]",
      to: "[[音程入门|音程入门]]",
    },
    {
      name: "future handoff",
      file: "content/06-基础乐理与指板/顺阶和弦与级数.md",
      from: "下一步是有效练习流程；该页属于后续批次，当前保持纯文字。",
      to: "下一步进入 [[07-练习与复盘/有效练习流程|有效练习流程]]。",
    },
    {
      name: "fixed practice quota",
      file: "content/06-基础乐理与指板/指板上的音名.md",
      from: "以下是本站原创练习，正确性由音名与品位对应关系判断。",
      to: "以下是本站原创练习，正确性由音名与品位对应关系判断。练习 10 分钟。",
    },
  ]

  for (const mutation of mutations) {
    const root = mkdtempSync(join(tmpdir(), "guitar-task7-mutation-"))
    try {
      mkdirSync(join(root, "content"), { recursive: true })
      cpSync(theoryDirectory, join(root, theoryDirectory), { recursive: true })
      replaceTempText(root, mutation.file, mutation.from, mutation.to)
      assert.throws(() => assertTheorySnapshot(root), mutation.name)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test(
  "the existing validators accept all fifty-nine pages with only twenty author warnings",
  { skip: missingLessonFiles.length > 0 },
  async () => {
    const manifest = loadManifest("data/content-manifest.yml")
    const pages = manifest.pages
      .filter((entry) => existsSync(`${contentRoot}/${entry.file}`))
      .map((entry) => parsePage(`${contentRoot}/${entry.file}`))
    assert.equal(pages.length, 59)
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
    assert.equal(diagnostics.filter(({ severity }) => severity === "warning").length, 20)
  },
)
