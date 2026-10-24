import assert from "node:assert/strict"
import test from "node:test"
import { parsePage } from "../../scripts/content/parsePage"
import { contentFile } from "./helpers/curriculumFiles"
import { sectionText, tableRows } from "./helpers/lessonAssertions"
const body = (name: string) => parsePage(contentFile(name)).body
function midi(pitch: string) {
  const m = /^([A-G])([♯♭]?)(\d)$/.exec(pitch)
  assert.ok(m, pitch)
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]!
  return 12 * (Number(m[3]) + 1) + base + (m[2] === "♯" ? 1 : m[2] === "♭" ? -1 : 0)
}
function events(cell: string) {
  return cell.split(" ").map((token) => {
    const m = /^([A-G][♯♭]?\d|休止)@(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(token)
    assert.ok(m, token)
    return { pitch: m[1] === "休止" ? null : m[1], onset: Number(m[2]), duration: Number(m[3]) }
  })
}
function phrase(text: string, heading: string, total: number) {
  const rows = tableRows(text, heading)
  assert.equal(rows.length, 8)
  rows.forEach((r, i) => {
    assert.equal(Number(r[0]), i + 1)
    const list = events(r[1])
    assert.ok(list.length > 0)
    assert.equal(
      list.reduce((sum, e) => sum + e.duration, 0),
      total,
    )
    let next = 0
    for (const e of list) {
      assert.equal(e.onset, next)
      assert.ok(e.duration > 0)
      next += e.duration
      if (e.pitch) midi(e.pitch)
    }
    assert.equal(next, total)
    assert.ok(r[2] && r[3] && r[4] && r[5], "chord bass degree and explanation")
    midi(r[3])
  })
  return rows
}
test("two original eight-bar melodies have complete nonoverlapping sounding events", () => {
  const text = body("乐句分析与编配实战")
  const major = phrase(text, "G大调旋律与和声", 4),
    minor = phrase(text, "E小调旋律与和声", 6)
  assert.deepEqual(events(major[0][1]), [
    { pitch: "B3", onset: 0, duration: 1 },
    { pitch: "D4", onset: 1, duration: 1 },
    { pitch: "G4", onset: 2, duration: 2 },
  ])
  assert.equal(major[3][2], "D")
  assert.equal(minor[6][2], "B7")
  assert.ok(events(minor[6][1]).some((e) => e.pitch === "D♯4"))
})
test("the complete A-major answer preserves event timing intervals and spelling", () => {
  const text = body("乐句分析与编配实战"),
    source = tableRows(text, "G大调旋律与和声"),
    target = tableRows(text, "A大调移调答案")
  assert.equal(target.length, 8)
  const names: Record<string, string> = {
    G: "A",
    A: "B",
    B: "C♯",
    C: "D",
    D: "E",
    E: "F♯",
    "F♯": "G♯",
  }
  source.forEach((r, i) => {
    const a = events(r[1]),
      b = events(target[i][1])
    assert.equal(a.length, b.length)
    a.forEach((e, j) => {
      assert.equal(b[j].onset, e.onset)
      assert.equal(b[j].duration, e.duration)
      if (e.pitch === null) assert.equal(b[j].pitch, null)
      else {
        assert.ok(b[j].pitch)
        assert.equal(midi(b[j].pitch!), midi(e.pitch) + 2)
        assert.equal(b[j].pitch!.slice(0, -1), names[e.pitch.slice(0, -1)])
      }
    })
  })
})
test("voice-leading examples preserve actual standard-tuning pitches", () => {
  const tuning = [40, 45, 50, 55, 59, 64]
  for (const [label, tuple, pitches] of tableRows(body("声部连接与和弦配置"), "吉他配置核对")) {
    assert.deepEqual(
      tuple.split("-").flatMap((f, i) => (f === "x" ? [] : [tuning[i] + Number(f)])),
      pitches.split(" ").map(midi),
      label,
    )
  }
})
test("both harmonizations expose chord tones bass and complete measure durations", () => {
  const text = body("旋律配和弦与非和弦音")
  const expected: Record<string, string> = {
    C: "C E G",
    Am: "A C E",
    G7: "G B D F",
    Am7: "A C E G",
    F: "F A C",
    Dm7: "D F A C",
  }
  for (const heading of ["配法甲核对", "配法乙核对"]) {
    const rows = tableRows(text, heading)
    const ends = new Map<number, number>()
    for (const [bar, onset, duration, chord, notes, bass] of rows) {
      assert.equal(notes, expected[chord])
      assert.equal(Number(onset), ends.get(Number(bar)) ?? 0)
      assert.ok(Number(duration) > 0)
      ends.set(Number(bar), Number(onset) + Number(duration))
      assert.equal(bass.slice(0, -1), notes.split(" ")[0])
      midi(bass)
    }
    assert.deepEqual(
      [...ends.entries()],
      [
        [1, 4],
        [2, 4],
        [3, 4],
        [4, 4],
      ],
    )
  }
  assert.notDeepEqual(tableRows(text, "配法甲核对"), tableRows(text, "配法乙核对"))
})
test("mutated durations and missing event intervals are rejected", () => {
  const text = body("乐句分析与编配实战"),
    section = sectionText(text, "G大调旋律与和声")
  assert.throws(() =>
    phrase(text.replace(section, section.replace("B3@0:1", "B3@0:0.5")), "G大调旋律与和声", 4),
  )
  assert.throws(() =>
    phrase(text.replace(section, section.replace("D4@1:1", "D4@1.5:1")), "G大调旋律与和声", 4),
  )
})
test("application lessons retain original material and matched exercise levels", () => {
  assert.match(body("和弦级数与移调"), /I–V–vi–IV–I–V–IV–I/)
  for (const name of [
    "和弦级数与移调",
    "完整歌曲编配流程",
    "声部连接与和弦配置",
    "旋律配和弦与非和弦音",
    "乐句分析与编配实战",
  ]) {
    const text = body(name)
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
