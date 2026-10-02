import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { parsePage } from "../../scripts/content/parsePage"
import { validateLinks } from "../../scripts/content/validateLinks"
import { sectionText, tableRows } from "./helpers/lessonAssertions"

const names = [
  "音高音名与唱名",
  "指板上的音名",
  "全音与半音",
  "音程入门",
  "五线谱简谱与六线谱",
  "音程转位与复音程",
]
function page(name: string) {
  const file = `content/06-基础乐理与指板/${name}.md`
  assert.ok(existsSync(file), `${name} must exist`)
  return parsePage(file)
}
function intervals(body: string) {
  const rows = tableRows(body, "音程对照")
  for (const row of [
    ["C4–C4", "纯一度", "0"],
    ["C4–D♭4", "小二度", "1"],
    ["C4–D4", "大二度", "2"],
    ["C4–D♯4", "增二度", "3"],
    ["C4–E♭4", "小三度", "3"],
    ["C4–E4", "大三度", "4"],
    ["C4–F4", "纯四度", "5"],
    ["C4–F♯4", "增四度", "6"],
    ["C4–G♭4", "减五度", "6"],
    ["C4–G4", "纯五度", "7"],
    ["C4–A♭4", "小六度", "8"],
    ["C4–A4", "大六度", "9"],
    ["C4–B♭♭4", "减七度", "9"],
    ["C4–B♭4", "小七度", "10"],
    ["C4–B4", "大七度", "11"],
    ["C4–C5", "纯八度", "12"],
  ])
    assert.ok(
      rows.some((r) => r.join("|") === row.join("|")),
      `missing interval ${row}`,
    )
}
function positions(body: string) {
  assert.deepEqual(tableRows(body, "同音与八度核对"), [
    ["3弦4品", "2弦0品", "B3", "同音"],
    ["3弦5品", "2弦1品", "C4", "同音"],
    ["6弦12品", "4弦2品", "E3", "同音"],
    ["6弦0品", "6弦12品", "E2→E3", "八度"],
  ])
}
test("real interval examples retain spelling number and semitone count", () =>
  intervals(page("音程入门").body))
test("guitar coordinates retain actual registers at the second-third-string boundary", () =>
  positions(page("指板上的音名").body))
test("interval inversion and compound intervals preserve actual registers", () => {
  const body = page("音程转位与复音程").body
  assert.deepEqual(tableRows(body, "转位核对"), [
    ["C4–E4", "E4–C5", "大三度", "小六度", "4+8=12"],
    ["D4–F4", "F4–D5", "小三度", "大六度", "3+9=12"],
    ["F4–B4", "B4–F5", "增四度", "减五度", "6+6=12"],
  ])
  assert.deepEqual(tableRows(body, "复音程核对"), [
    ["C4–D5", "大九度", "14", "大二度"],
    ["G3–B4", "大十度", "16", "大三度"],
    ["D3–G4", "纯十一度", "17", "纯四度"],
  ])
})
test("notation comparison maps the same sounding phrase to three representations", () => {
  assert.deepEqual(tableRows(page("五线谱简谱与六线谱").body, "三谱事件核对"), [
    ["1", "0", "1", "G3", "G4", "5下点", "3弦0品"],
    ["2", "1", "1", "C4", "C5", "1", "2弦1品"],
    ["3", "2", "1", "D4", "D5", "2", "2弦3品"],
    ["4", "3", "1", "E4", "E5", "3", "1弦0品"],
  ])
})
test("wrong enharmonic spellings and octave mutations cannot pass", () => {
  const body = page("音程入门").body
  const section = sectionText(body, "音程对照")
  assert.throws(() => intervals(body.replace(section, section.replace("C4–D♯4", "C4–E♭4"))))
  const fretboard = page("指板上的音名").body
  const coordinates = sectionText(fretboard, "同音与八度核对")
  assert.throws(() => positions(fretboard.replace(coordinates, coordinates.replace("B3", "B4"))))
})
test("all pitch lessons provide recognition derivation and application answers", () => {
  for (const name of names) {
    const body = page(name).body
    for (const [heading, id] of [
      ["一级：辨认", "R1"],
      ["二级：推导", "D1"],
      ["三级：应用", "A1"],
    ]) {
      assert.match(sectionText(body, heading), new RegExp(`${id}[.：]`))
      assert.match(sectionText(body, "答案与解析"), new RegExp(`${id}[.：]`))
    }
  }
})
test("notation SVG is a real safe local attachment with an equivalent event table", () => {
  const lesson = page("五线谱简谱与六线谱")
  const file = "content/assets/examples/notation-comparison.svg"
  assert.ok(existsSync(file))
  const svg = readFileSync(file, "utf8")
  assert.ok(Buffer.byteLength(svg) <= 16384)
  assert.match(svg, /<title[^>]*>[^<]+<\/title>/)
  assert.match(
    lesson.body,
    /!\[原创三谱对照.*\]\(\.\.\/assets\/examples\/notation-comparison\.svg\)/,
  )
  assert.deepEqual(
    validateLinks(
      [
        {
          ...lesson,
          linkTargets: lesson.linkTargets?.filter((link) => link.kind === "markdown-image"),
        },
      ],
      resolve("content"),
    ),
    [],
  )
})
