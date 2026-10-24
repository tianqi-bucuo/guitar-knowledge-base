import assert from "node:assert/strict"
import test from "node:test"
import { parsePage } from "../../scripts/content/parsePage"
import { contentFile } from "./helpers/curriculumFiles"
import { sectionText, tableRows } from "./helpers/lessonAssertions"

const body = (name: string, _module = "06-基础乐理与指板") => parsePage(contentFile(name)).body
function sevenths(text: string) {
  const rows = tableRows(text, "七和弦核对")
  assert.deepEqual(rows, [
    ["大七", "maj7", "0 4 7 11", "C E G B", "D F♯ A C♯"],
    ["属七", "7", "0 4 7 10", "C E G B♭", "D F♯ A C"],
    ["小七", "m7", "0 3 7 10", "C E♭ G B♭", "D F A C"],
    ["半减七", "m7♭5／ø7", "0 3 6 10", "C E♭ G♭ B♭", "D F A♭ C"],
    ["减七", "dim7／°7", "0 3 6 9", "C E♭ G♭ B♭♭", "D F A♭ C♭"],
  ])
}
function symbols(text: string) {
  assert.deepEqual(tableRows(text, "符号核对"), [
    ["Csus2", "C D G", "无", "无"],
    ["Csus4", "C F G", "无", "无"],
    ["Cadd9", "C E G D", "E", "无"],
    ["C9", "C E G B♭ D", "E", "B♭"],
    ["Cmaj9", "C E G B D", "E", "B"],
  ])
}
function midi(pitch: string) {
  const m = /^([A-G])([♯♭]*)(\d)$/.exec(pitch)
  assert.ok(m, pitch)
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]!
  return (
    12 * (Number(m[3]) + 1) + base + [...m[2]].reduce((sum, a) => sum + (a === "♯" ? 1 : -1), 0)
  )
}
function inversion(text: string) {
  const rows = tableRows(text, "最低音核对")
  assert.deepEqual(rows[0], ["C/E", "C4 G3 E3", "C E G", "E3", "第一转位"])
  for (const row of rows) assert.equal(Math.min(...row[1].split(" ").map(midi)), midi(row[3]))
}
test("five seventh qualities have exact independent C and D spellings", () =>
  sevenths(body("七和弦构成")))
test("inversion depends on sounding bass rather than array or string order", () =>
  inversion(body("和弦转位与低音")))
test("sus, added ninth and extended ninth distinguish thirds and sevenths", () =>
  symbols(body("挂留和弦与附加音和弦")))
test("real guitar voicings match standard tuning including duplicates and omissions", () => {
  const tuning = [40, 45, 50, 55, 59, 64]
  for (const [name, module, heading] of [
    ["常用七和弦", "02-和弦系统", "逐弦实响核对"],
    ["挂留和弦与附加音和弦", "06-基础乐理与指板", "吉他配置核对"],
  ]) {
    for (const [label, tuple, pitches] of tableRows(body(name, module), heading)) {
      const actual = tuple.split("-").flatMap((f, i) => (f === "x" ? [] : [tuning[i] + Number(f)]))
      assert.deepEqual(actual, pitches.split(" ").map(midi), label)
    }
  }
})
test("wrong diminished seventh sus thirds and register mutations are rejected", () => {
  const seventh = body("七和弦构成")
  const s = sectionText(seventh, "七和弦核对")
  assert.throws(() => sevenths(seventh.replace(s, s.replace("C E♭ G♭ B♭♭", "C E♭ G♭ B♭"))))
  const sus = body("挂留和弦与附加音和弦")
  const t = sectionText(sus, "符号核对")
  assert.throws(() => symbols(sus.replace(t, t.replace("C D G", "C E G D"))))
  const inv = body("和弦转位与低音")
  const i = sectionText(inv, "最低音核对")
  assert.throws(() => inversion(inv.replace(i, i.replace("C4 G3 E3", "C2 G3 E3"))))
})
test("five chord lessons contain matched recognition derivation and application answers", () => {
  for (const name of [
    "三和弦构成",
    "七和弦构成",
    "和弦转位与低音",
    "挂留和弦与附加音和弦",
    "常用七和弦",
  ]) {
    const text = body(name, name === "常用七和弦" ? "02-和弦系统" : "06-基础乐理与指板")
    for (const [heading, id] of [
      ["一级：辨认", "R1"],
      ["二级：推导", "D1"],
      ["三级：应用", "A1"],
    ]) {
      assert.match(sectionText(text, heading), new RegExp(`${id}[.：]`))
      assert.match(sectionText(text, "答案与解析"), new RegExp(`${id}[.：]`))
    }
  }
})
