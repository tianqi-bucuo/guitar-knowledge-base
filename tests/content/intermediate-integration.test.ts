import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { loadManifest } from "../../scripts/content/loadManifest"
import { parsePage } from "../../scripts/content/parsePage"

const newIdentities = [
  ["rests-dots-ties", "03-节奏系统/10-休止附点与延音线.md", "/rhythm/rests-dots-ties"],
  ["tuplets-grouping", "03-节奏系统/12-连音与节奏分组.md", "/rhythm/tuplets-grouping"],
  ["fretboard-memory", "06-基础乐理与指板/04-指板记忆方法与训练.md", "/theory/fretboard-memory"],
  ["reading-notation", "06-基础乐理与指板/10-五线谱简谱与六线谱.md", "/theory/reading-notation"],
  ["interval-inversion", "06-基础乐理与指板/11-音程转位与复音程.md", "/theory/interval-inversion"],
  ["minor-scales", "06-基础乐理与指板/12-小调音阶.md", "/theory/minor-scales"],
  [
    "key-relationships",
    "06-基础乐理与指板/13-关系调同主音调与五度圈.md",
    "/theory/key-relationships",
  ],
  ["pentatonic-scales", "06-基础乐理与指板/14-五声音阶.md", "/theory/pentatonic-scales"],
  ["modes", "06-基础乐理与指板/15-调式入门.md", "/theory/modes"],
  ["seventh-chord-theory", "06-基础乐理与指板/16-七和弦构成.md", "/theory/seventh-chord-theory"],
  ["inversions-bass", "06-基础乐理与指板/17-和弦转位与低音.md", "/theory/inversions-bass"],
  ["sus-add-chords", "06-基础乐理与指板/18-挂留和弦与附加音和弦.md", "/theory/sus-add-chords"],
  ["harmonic-function", "06-基础乐理与指板/19-和声功能.md", "/theory/harmonic-function"],
  ["cadences-phrases", "06-基础乐理与指板/20-终止式与乐句.md", "/theory/cadences-phrases"],
  ["minor-harmony", "06-基础乐理与指板/21-小调和声.md", "/theory/minor-harmony"],
  ["secondary-dominants", "06-基础乐理与指板/22-副属和弦.md", "/theory/secondary-dominants"],
  ["modal-mixture", "06-基础乐理与指板/23-调式借用.md", "/theory/modal-mixture"],
  ["modulation", "06-基础乐理与指板/24-转调入门.md", "/theory/modulation"],
  ["voice-leading", "05-弹唱与伴奏/09-声部连接与和弦配置.md", "/accompaniment/voice-leading"],
  [
    "melody-harmonization",
    "05-弹唱与伴奏/10-旋律配和弦与非和弦音.md",
    "/accompaniment/melody-harmonization",
  ],
  [
    "phrase-arrangement",
    "05-弹唱与伴奏/11-乐句分析与编配实战.md",
    "/accompaniment/phrase-arrangement",
  ],
  [
    "intermediate-theory-path",
    "00-从这里开始/05-中级乐理学习路线.md",
    "/start/intermediate-theory",
  ],
  [
    "intermediate-theory-assessment",
    "07-练习与复盘/07-中级乐理综合测验.md",
    "/practice/intermediate-theory-assessment",
  ],
] as const

const coreFiles = [
  "03-节奏系统/01-节拍拍号与小节.md",
  "03-节奏系统/03-四分八分与十六分音符.md",
  "03-节奏系统/09-六八拍伴奏.md",
  "03-节奏系统/11-切分节奏入门.md",
  "06-基础乐理与指板/01-音高音名与唱名.md",
  "06-基础乐理与指板/02-指板上的音名.md",
  "06-基础乐理与指板/03-全音与半音.md",
  "06-基础乐理与指板/05-音程入门.md",
  "06-基础乐理与指板/06-大调音阶.md",
  "06-基础乐理与指板/07-调与调号.md",
  "06-基础乐理与指板/08-三和弦构成.md",
  "02-和弦系统/07-常用七和弦.md",
  "06-基础乐理与指板/09-顺阶和弦与级数.md",
  "05-弹唱与伴奏/03-和弦级数与移调.md",
  "05-弹唱与伴奏/08-完整歌曲编配流程.md",
  ...newIdentities.slice(0, 21).map(([, file]) => file),
  "07-练习与复盘/07-中级乐理综合测验.md",
]

function ids(section: string): string[] {
  return [...section.matchAll(/^[-*]?\s*((?:[A-Z]{2,4}-)?(?:R1|D1|A1))\s*[.：]/gmu)].map(
    (match) => match[1],
  )
}

function exerciseContract(body: string): void {
  const split = body.split(/^### 答案与解析\s*$/mu)
  assert.equal(split.length, 2, "exactly one answer section")
  const questions = ids(split[0]).sort()
  const answers = ids(split[1]).sort()
  assert.ok(questions.length >= 3, "at least recognition derivation application")
  assert.equal(new Set(questions).size, questions.length, "question ids unique")
  assert.deepEqual(answers, questions, "every question has one matching answer")
}

test("canonical manifest integrates the exact 98-page intermediate curriculum", () => {
  const manifest = loadManifest("data/content-manifest.yml")
  assert.deepEqual(manifest.release, { minPages: 98, maxPages: 98 })
  assert.equal(manifest.pages.length, 98)
  assert.deepEqual(
    manifest.modules.map((module) => module.target),
    [6, 8, 12, 12, 8, 11, 24, 7, 5, 5],
  )
  const typeCounts = Object.fromEntries(
    ["lesson", "index", "path", "glossary"].map((type) => [
      type,
      manifest.pages.filter((page) => page.type === type).length,
    ]),
  )
  assert.deepEqual(typeCounts, { lesson: 88, index: 6, path: 3, glossary: 1 })
  for (const [id, file, permalink] of newIdentities) {
    const page = manifest.pages.find((candidate) => candidate.id === id)
    assert.deepEqual(page && [page.file, page.permalink, page.required], [file, permalink, true])
  }
})

test("intermediate route exposes six explicit stages and all new pages have incoming links", () => {
  const route = parsePage("content/00-从这里开始/05-中级乐理学习路线.md").body
  for (const stage of [
    "阶段一：读谱与节奏",
    "阶段二：音高、指板与音程",
    "阶段三：音阶与调性",
    "阶段四：和弦体系",
    "阶段五：功能和声",
    "阶段六：分析与编配",
  ]) {
    assert.match(route, new RegExp(`^## ${stage}$`, "mu"))
  }
  for (const [, file] of newIdentities.slice(0, 21)) {
    assert.match(
      route,
      new RegExp(
        `\\[\\[${file.replace(/\.md$/u, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\||\\])`,
      ),
    )
  }
  const broken = route.replace(/^## 阶段三：音阶与调性$[\s\S]*?(?=^## )/mu, "")
  assert.doesNotMatch(broken, /^## 阶段三：音阶与调性$/mu)
})

test("all 37 core lessons have unique question ids and one matching answer per question", () => {
  assert.equal(coreFiles.length, 37)
  for (const file of coreFiles) exerciseContract(parsePage(`content/${file}`).body)
  const assessment = parsePage("content/07-练习与复盘/07-中级乐理综合测验.md").body
  const answerId = ids(assessment.split(/^### 答案与解析\s*$/mu)[1])[0]
  assert.throws(() =>
    exerciseContract(assessment.replace(new RegExp(`^- ${answerId}[.：].*$`, "mu"), "")),
  )
})

test("intermediate assessment covers six domains at recognition derivation and application levels", () => {
  const body = readFileSync("content/07-练习与复盘/07-中级乐理综合测验.md", "utf8")
  for (const domain of [
    "读谱与节奏",
    "音程与指板",
    "音阶与调性",
    "和弦体系",
    "功能和声",
    "综合应用",
  ]) {
    assert.match(body, new RegExp(`^#### ${domain}$`, "mu"))
  }
  assert.match(body, /评价标准/u)
  assert.match(body, /参考过程/u)
  assert.match(body, /回退/u)
})
