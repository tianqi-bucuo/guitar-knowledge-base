import assert from "node:assert/strict"
import test from "node:test"
import { parsePage } from "../../scripts/content/parsePage"
import { sectionText, tableRows } from "./helpers/lessonAssertions"

const names = ["大调音阶", "调与调号", "小调音阶", "关系调同主音调与五度圈", "五声音阶", "调式入门"]
const body = (name: string) => parsePage(`content/06-基础乐理与指板/${name}.md`).body
function minor(text: string) {
  assert.deepEqual(tableRows(text, "小调对照"), [
    ["A自然", "A B C D E F G A"],
    ["A和声", "A B C D E F G♯ A"],
    ["A旋律上行（古典练习）", "A B C D E F♯ G♯ A"],
    ["A旋律下行（古典练习）", "A G F E D C B A"],
    ["E自然", "E F♯ G A B C D E"],
    ["E和声", "E F♯ G A B C D♯ E"],
    ["E旋律上行（古典练习）", "E F♯ G A B C♯ D♯ E"],
    ["E旋律下行（古典练习）", "E D C B A G F♯ E"],
  ])
  const context = sectionText(text, "不是一条包办所有旋律的法则")
  assert.match(context, /爵士/)
  assert.match(context, /上下行.*升高.*六.*七/s)
  assert.match(context, /实际.*和声/s)
}
function modes(text: string) {
  assert.deepEqual(tableRows(text, "同主音调式核对"), [
    ["D Dorian", "D E F G A B C D", "大六度B"],
    ["D Aeolian", "D E F G A B♭ C D", "小六度B♭"],
    ["G Mixolydian", "G A B C D E F G", "小七度F"],
    ["G Ionian", "G A B C D E F♯ G", "大七度F♯"],
  ])
}
test("minor variants retain exact spelling in A and E and contextual boundaries", () =>
  minor(body("小调音阶")))
test("major scale derivation transfers beyond C and G", () => {
  assert.deepEqual(tableRows(body("大调音阶"), "四调推导核对"), [
    ["C", "C D E F G A B C", "0 2 4 5 7 9 11 12"],
    ["G", "G A B C D E F♯ G", "0 2 4 5 7 9 11 12"],
    ["F", "F G A B♭ C D E F", "0 2 4 5 7 9 11 12"],
    ["D", "D E F♯ G A B C♯ D", "0 2 4 5 7 9 11 12"],
  ])
})
test("relative keys share a signature not a tonal center", () => {
  assert.deepEqual(tableRows(body("关系调同主音调与五度圈"), "关系核对"), [
    ["C大调", "A小调", "关系调", "无", "C／A"],
    ["G大调", "E小调", "关系调", "F♯", "G／E"],
    ["C大调", "C小调", "同主音调", "无／B♭ E♭ A♭", "C／C"],
  ])
})
test("pentatonic choices and parallel modes retain characteristic degrees", () => {
  assert.deepEqual(tableRows(body("五声音阶"), "五声音阶核对"), [
    ["C大调", "1 2 3 5 6", "C D E G A"],
    ["A小调", "1 ♭3 4 5 ♭7", "A C D E G"],
    ["G大调", "1 2 3 5 6", "G A B D E"],
    ["E小调", "1 ♭3 4 5 ♭7", "E G A B D"],
  ])
  modes(body("调式入门"))
})
test("wrong context, characteristic notes and non-C accidentals are rejected", () => {
  const m = body("小调音阶")
  assert.throws(() => minor(m.replace(sectionText(m, "不是一条包办所有旋律的法则"), "被删去")))
  const table = sectionText(m, "小调对照")
  assert.throws(() =>
    minor(m.replace(table, table.replace("E F♯ G A B C D♯ E", "E F♯ G A B C D E"))),
  )
  const modal = body("调式入门")
  const comparison = sectionText(modal, "同主音调式核对")
  assert.throws(() =>
    modes(modal.replace(comparison, comparison.replace("D E F G A B C D", "D E F G A B♭ C D"))),
  )
})
test("all scale lessons provide three levels and reasoned answers", () => {
  for (const name of names)
    for (const [heading, id] of [
      ["一级：辨认", "R1"],
      ["二级：推导", "D1"],
      ["三级：应用", "A1"],
    ]) {
      assert.match(sectionText(body(name), heading), new RegExp(`${id}[.：]`))
      assert.match(sectionText(body(name), "答案与解析"), new RegExp(`${id}[.：]`))
    }
})
