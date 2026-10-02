import assert from "node:assert/strict"
import test from "node:test"
import { parsePage } from "../../scripts/content/parsePage"
import { sectionText, tableRows } from "./helpers/lessonAssertions"
const body = (name: string) => parsePage(`content/06-基础乐理与指板/${name}.md`).body
function minor(text: string) {
  assert.deepEqual(tableRows(text, "小调属和弦核对"), [
    ["v", "E G B", "G", "自然小调"],
    ["V", "E G♯ B", "G♯", "升高七级"],
    ["V7", "E G♯ B D", "G♯", "升高七级"],
  ])
}
function secondary(text: string) {
  assert.deepEqual(tableRows(text, "副属目标核对"), [
    ["C大调", "D7", "D F♯ A C", "G", "V7/V"],
    ["C大调", "E7", "E G♯ B D", "Am", "V7/vi"],
    ["G大调", "A7", "A C♯ E G", "D", "V7/V"],
  ])
}
function cadences(text: string) {
  assert.deepEqual(tableRows(text, "句末终止核对"), [
    ["甲第4小节结束", "G→C", "G2→C3", "B3→C4", "完全正格"],
    ["乙第4小节结束", "G/B→C", "B2→C3", "D4→C4", "不完全正格"],
    ["丙第4小节结束", "G→C", "G2→C3", "D4→E4", "不完全正格"],
    ["丁第4小节结束", "Dm→G", "D3→G2", "F4→D4", "半终止"],
    ["戊第4小节结束", "F→C", "F2→C3", "A3→G3", "变格"],
    ["己第4小节结束", "G→Am", "G2→A2", "B3→C4", "阻碍"],
  ])
}
test("G major diatonic chords are derived with correct spellings and qualities", () => {
  assert.deepEqual(tableRows(body("顺阶和弦与级数"), "大调级数核对"), [
    ["I", "G B D", "G"],
    ["ii", "A C E", "Am"],
    ["iii", "B D F♯", "Bm"],
    ["IV", "C E G", "C"],
    ["V", "D F♯ A", "D"],
    ["vi", "E G B", "Em"],
    ["vii°", "F♯ A C", "F♯dim"],
  ])
})
test("minor dominant raising and secondary targets are explicit", () => {
  minor(body("小调和声"))
  secondary(body("副属和弦"))
})
test("borrowed iv has a parallel-minor source not a secondary target", () => {
  assert.deepEqual(tableRows(body("调式借用"), "借用核对"), [
    ["C大调", "Fm", "F A♭ C", "C小调", "iv"],
    ["C大调", "A♭", "A♭ C E♭", "C小调", "♭VI"],
    ["C大调", "B♭", "B♭ D F", "C小调", "♭VII"],
  ])
})
test("cadence judgments preserve phrase location bass and top-voice conditions", () =>
  cadences(body("终止式与乐句")))
test("tonicization and modulation conclusions use different written contexts", () => {
  const text = body("转调入门")
  assert.deepEqual(tableRows(text, "上下文核对"), [
    ["甲", "C→D7→G→G7→C", "C3 D3 G2 G2 C3", "E4 F♯4 G4 F4 E4", "G短暂主音化后回C"],
    [
      "乙",
      "C→Am→D7→G；Am→D7→G",
      "C3 A2 D3 G2；A2 D3 G2",
      "E4 E4 F♯4 G4；E4 F♯4 G4",
      "转入G并在新句维持",
    ],
  ])
  assert.match(sectionText(text, "两例为何不同"), /F自然/)
  assert.match(sectionText(text, "两例为何不同"), /句末/)
})
test("wrong target leading tone or cadence bass cannot pass", () => {
  for (const [name, heading, from, to, check] of [
    ["副属和弦", "副属目标核对", "V7/V", "V7/vi", secondary],
    ["小调和声", "小调属和弦核对", "E G♯ B D", "E G B D", minor],
    ["终止式与乐句", "句末终止核对", "G2→C3", "B2→C3", cadences],
  ] as const) {
    const text = body(name),
      section = sectionText(text, heading)
    assert.throws(() => check(text.replace(section, section.replace(from, to))))
  }
})
test("every harmony lesson includes all exercise levels and answers", () => {
  for (const name of [
    "顺阶和弦与级数",
    "和声功能",
    "终止式与乐句",
    "小调和声",
    "副属和弦",
    "调式借用",
    "转调入门",
  ])
    for (const [heading, id] of [
      ["一级：辨认", "R1"],
      ["二级：推导", "D1"],
      ["三级：应用", "A1"],
    ]) {
      assert.match(sectionText(body(name), heading), new RegExp(`${id}[.：]`))
      assert.match(sectionText(body(name), "答案与解析"), new RegExp(`${id}[.：]`))
    }
})
