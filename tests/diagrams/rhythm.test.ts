import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { DOMParser } from "@xmldom/xmldom"
import { renderRhythm } from "../../scripts/diagrams/renderRhythm"
import type { RhythmDefinition } from "../../scripts/diagrams/types"

const basicStrum: RhythmDefinition = {
  id: "basic-strum",
  title: "基础扫弦教学／测试节奏",
  meter: "4/4",
  subdivision: 4,
  cells: [
    { label: "1", stroke: "down", accent: true },
    { label: "2", stroke: "up", accent: false },
    { label: "3", stroke: "rest", accent: false },
    { label: "4", stroke: "mute", accent: false },
  ],
}

function parseXml(svg: string) {
  const errors: string[] = []
  const document = new DOMParser({
    errorHandler: {
      error: (message) => errors.push(message),
      fatalError: (message) => errors.push(message),
    },
  }).parseFromString(svg, "image/svg+xml")

  assert.deepEqual(errors, [])
  return document
}

function definition(
  meter: RhythmDefinition["meter"],
  subdivision: RhythmDefinition["subdivision"],
): RhythmDefinition {
  const [numerator, denominator] = meter.split("/").map(Number)
  const count = (numerator * subdivision) / denominator
  return {
    id: `meter-${meter.replace("/", "-")}-${subdivision}`,
    title: `${meter} 节奏`,
    meter,
    subdivision,
    cells: Array.from({ length: count }, (_, index) => ({
      label: String(index + 1),
      stroke: "down",
      accent: false,
    })),
  }
}

test("renders the reviewed teaching/test strum with fixed geometry, ordered cells, and redundant accents", () => {
  const first = renderRhythm(basicStrum)
  const second = renderRhythm(basicStrum)
  const groups = [
    ...first.matchAll(
      /<g data-cell-index="(\d+)" data-label="([^"]+)" data-stroke="(down|up|rest|mute)" data-accent="(true|false)">/g,
    ),
  ]

  assert.equal(first, second)
  assert.match(
    first,
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img" aria-labelledby="rhythm-basic-strum-title rhythm-basic-strum-desc" width="720" height="220" viewBox="0 0 720 220" data-diagram-id="basic-strum" data-diagram-kind="rhythm">/,
  )
  assert.match(first, /<rect x="0" y="0" width="720" height="220" fill="#fffdf9"\/>/)
  assert.match(first, /font-family="Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif"/)
  assert.match(first, /<text x="48" y="28"[^>]*>基础扫弦教学／测试节奏<\/text>/)
  assert.match(first, /<text x="48" y="52"[^>]*>4\/4 拍号 · 四分音符细分<\/text>/)
  assert.match(
    first,
    /<rect x="48" y="76" width="156" height="96" fill="#fffdf9" stroke="#b8b8b8"\/>/,
  )
  assert.match(
    first,
    /<rect x="516" y="76" width="156" height="96" fill="#fffdf9" stroke="#b8b8b8"\/>/,
  )
  assert.match(first, /<text x="126" y="100"[^>]*>1<\/text>/)
  assert.match(first, /<text x="126" y="122"[^>]*>&gt;<\/text>/)
  assert.match(
    first,
    /<line data-role="accent-rule" x1="48" y1="164" x2="204" y2="164" stroke="#8A4B2A" stroke-width="4"\/>/,
  )
  assert.match(
    first,
    /<line data-role="grid-rule" x1="204" y1="164" x2="360" y2="164" stroke="#b8b8b8" stroke-width="1"\/>/,
  )
  assert.match(first, />↓<\/text>/)
  assert.match(first, />↑<\/text>/)
  assert.match(first, />—<\/text>/)
  assert.match(first, />×<\/text>/)
  assert.match(first, /× 闷音/)
  assert.deepEqual(
    groups.map((group) => `${group[1]}:${group[2]}:${group[3]}:${group[4]}`),
    basicStrum.cells.map((cell, index) => `${index}:${cell.label}:${cell.stroke}:${cell.accent}`),
  )
  assert.equal(
    first.trim(),
    readFileSync(resolve("tests/diagrams/__snapshots__/basic-strum.svg"), "utf8").trim(),
  )
  parseXml(first)
})

test("preserves each supported meter and subdivision count, including readable 16th cells", () => {
  for (const [meter, subdivision, expectedCount] of [
    ["4/4", 4, 4],
    ["4/4", 8, 8],
    ["6/8", 8, 6],
    ["6/8", 16, 12],
  ] as const) {
    const svg = renderRhythm(definition(meter, subdivision))
    assert.equal((svg.match(/data-cell-index=/g) ?? []).length, expectedCount)
    assert.equal((svg.match(/<rect x="/g) ?? []).length, expectedCount + 1)
    parseXml(svg)
  }
})

test("names subdivision denominators as note values in visible and accessible text", () => {
  for (const [subdivision, noteValue] of [
    [4, "四分音符"],
    [8, "八分音符"],
    [16, "十六分音符"],
  ] as const) {
    const svg = renderRhythm(definition("4/4", subdivision))

    assert.match(svg, new RegExp(`>4/4 拍号 · ${noteValue}细分<\\/text>`))
    assert.match(svg, new RegExp(`<desc[^>]*>[^<]*4/4 拍号，${noteValue}细分，共`))
    assert.doesNotMatch(svg, /每拍 \d+ 等分/)
  }
})

test("escapes rhythm labels and does not invent a mute symbol", () => {
  const svg = renderRhythm({
    id: "safe-rhythm",
    title: "安全节奏",
    meter: "4/4",
    subdivision: 4,
    cells: [
      { label: `A & B < C > D " '`, stroke: "down", accent: false },
      { label: "2", stroke: "up", accent: false },
      { label: "3", stroke: "rest", accent: false },
      { label: "4", stroke: "down", accent: false },
    ],
  })

  assert.match(svg, /data-label="A &amp; B &lt; C &gt; D &quot; &apos;"/)
  assert.doesNotMatch(svg, /×|闷音/)
  assert.doesNotMatch(svg, /&amp;amp;|<script|foreignObject|\son\w+=|\shref=|url\(/)
  parseXml(svg)
})
