import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { parsePage } from "../../scripts/content/parsePage"
import { validateLinks } from "../../scripts/content/validateLinks"
import { sectionText, tableRows } from "./helpers/lessonAssertions"

const names = [
  "节拍拍号与小节",
  "四分八分与十六分音符",
  "六八拍伴奏",
  "切分节奏入门",
  "休止附点与延音线",
  "连音与节奏分组",
]
function page(name: string) {
  const file = `content/03-节奏系统/${name}.md`
  assert.ok(existsSync(file), `${name} must be a real lesson`)
  return parsePage(file)
}
function checkMeters(body: string) {
  assert.deepEqual(tableRows(body, "复拍子核对"), [
    ["6/8", "2", "附点四分", "3"],
    ["9/8", "3", "附点四分", "3"],
    ["12/8", "4", "附点四分", "3"],
  ])
  assert.deepEqual(tableRows(body, "简单拍核对"), [
    ["2/4", "2", "四分", "2"],
    ["3/4", "3", "四分", "2"],
    ["4/4", "4", "四分", "2"],
  ])
}
function checkEvents(body: string) {
  const rows = tableRows(body, "四四拍事件核对")
  assert.deepEqual(rows, [
    ["附点四分音符", "0", "1.5", "1"],
    ["八分音符", "1.5", "0.5", "1"],
    ["四分休止", "2", "1", "0"],
    ["八分音符", "3", "0.5", "1"],
    ["八分音符", "3.5", "0.5", "1"],
  ])
  assert.equal(
    rows.reduce((sum, row) => sum + Number(row[2]), 0),
    4,
  )
  rows
    .slice(1)
    .forEach((row, index) =>
      assert.equal(Number(row[1]), Number(rows[index][1]) + Number(rows[index][2])),
    )
  assert.deepEqual(tableRows(body, "延音与重奏核对"), [
    ["C4四分延音至C4四分", "2", "1"],
    ["C4四分后重奏C4四分", "2", "2"],
    ["C4四分连奏至D4四分", "2", "2"],
  ])
}
test("rhythm pages specify actual main beats and duration events", () => {
  checkMeters(page(names[0]).body)
  checkEvents(page("休止附点与延音线").body)
})
test("triplet proportions distinguish a borrowed division from normal compound division", () => {
  const body = page("连音与节奏分组").body
  assert.deepEqual(tableRows(body, "连音比例核对"), [
    ["4/4八分三连音", "3", "2", "0.5", "1"],
    ["6/8普通八分组", "3", "3", "0.5", "1.5"],
    ["6/8八分二连音", "2", "3", "0.5", "1.5"],
  ])
  for (const row of tableRows(body, "连音比例核对")) {
    const [count, ordinary, value, total] = row.slice(1).map(Number)
    assert.equal(count * ((ordinary * value) / count), total)
  }
  assert.match(sectionText(body, "核心概念"), /普通三等分不是三连音/)
})
test("wrong beat counts and duration mutations are rejected", () => {
  const meters = page(names[0]).body
  const events = page("休止附点与延音线").body
  assert.throws(() => checkMeters(meters.replace(/6\/8\s*\|\s*2/, "6/8 | 6")))
  const eventSection = sectionText(events, "四四拍事件核对")
  const badEvents = events.replace(eventSection, eventSection.replace(/1\.5/, "1.25"))
  assert.notDeepEqual(tableRows(badEvents, "四四拍事件核对"), tableRows(events, "四四拍事件核对"))
  assert.throws(() => checkEvents(badEvents))
})
test("all six rhythm lessons have answerable recognition derivation and application tasks", () => {
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
test("the real original rhythm SVG is safe local content with a text equivalent", () => {
  const lesson = page("休止附点与延音线")
  const path = "content/assets/examples/rhythm-reading.svg"
  assert.ok(existsSync(path))
  const svg = readFileSync(path, "utf8")
  assert.ok(Buffer.byteLength(svg) <= 16384)
  assert.match(svg, /<title[^>]*>[^<]+<\/title>/)
  assert.match(lesson.body, /!\[原创4\/4节奏.*\]\(\.\.\/assets\/examples\/rhythm-reading\.svg\)/)
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
  checkEvents(lesson.body)
})
