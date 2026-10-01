import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { DOMParser } from "@xmldom/xmldom"
import { renderFretboard } from "../../scripts/diagrams/renderFretboard"
import type { FretboardDefinition } from "../../scripts/diagrams/types"

const cMajorScale: FretboardDefinition = {
  id: "c-major-scale",
  title: "C 大调音阶指板",
  startFret: 0,
  endFret: 5,
  positions: [
    { string: 6, fret: 0, label: "E", role: "tone" },
    { string: 6, fret: 1, label: "F", role: "tone" },
    { string: 6, fret: 3, label: "G", role: "tone" },
    { string: 6, fret: 5, label: "A", role: "tone" },
    { string: 5, fret: 0, label: "A", role: "tone" },
    { string: 5, fret: 2, label: "B", role: "tone" },
    { string: 5, fret: 3, label: "C", role: "root" },
    { string: 5, fret: 5, label: "D", role: "tone" },
    { string: 4, fret: 0, label: "D", role: "tone" },
    { string: 4, fret: 2, label: "E", role: "tone" },
    { string: 4, fret: 3, label: "F", role: "tone" },
    { string: 4, fret: 5, label: "G", role: "tone" },
    { string: 3, fret: 0, label: "G", role: "tone" },
    { string: 3, fret: 2, label: "A", role: "tone" },
    { string: 3, fret: 4, label: "B", role: "tone" },
    { string: 3, fret: 5, label: "C", role: "root" },
    { string: 2, fret: 0, label: "B", role: "tone" },
    { string: 2, fret: 1, label: "C", role: "root" },
    { string: 2, fret: 3, label: "D", role: "tone" },
    { string: 2, fret: 5, label: "E", role: "tone" },
    { string: 1, fret: 0, label: "E", role: "tone" },
    { string: 1, fret: 1, label: "F", role: "tone" },
    { string: 1, fret: 3, label: "G", role: "tone" },
    { string: 1, fret: 5, label: "A", role: "tone" },
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

test("renders C-major positions with fixed open-fret geometry and redundant root semantics", () => {
  const first = renderFretboard(cMajorScale)
  const second = renderFretboard(cMajorScale)
  const positionGroups = [
    ...first.matchAll(
      /<g data-string="(\d)" data-fret="(\d)" data-label="([^"]+)" data-role="(root|tone)">/g,
    ),
  ]

  assert.equal(first, second)
  assert.match(
    first,
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img" aria-labelledby="fretboard-c-major-scale-title fretboard-c-major-scale-desc" width="720" height="220" viewBox="0 0 720 220" data-diagram-id="c-major-scale" data-diagram-kind="fretboard">/,
  )
  assert.match(first, /<rect x="0" y="0" width="720" height="220" fill="#fffdf9"\/>/)
  assert.match(first, /font-family="Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif"/)
  assert.match(
    first,
    /<line x1="120" y1="52" x2="660" y2="52" stroke="#2b2b2b" stroke-width="2"\/>/,
  )
  assert.match(
    first,
    /<line x1="120" y1="172" x2="660" y2="172" stroke="#2b2b2b" stroke-width="2"\/>/,
  )
  assert.match(
    first,
    /<line data-role="fret-boundary" x1="228" y1="52" x2="228" y2="172" stroke="#b8b8b8" stroke-width="1"\/>/,
  )
  assert.match(
    first,
    /<line data-role="fret-boundary" x1="660" y1="52" x2="660" y2="172" stroke="#b8b8b8" stroke-width="1"\/>/,
  )
  assert.match(
    first,
    /<line data-role="nut" x1="120" y1="52" x2="120" y2="172" stroke="#2b2b2b" stroke-width="8"\/>/,
  )
  assert.match(first, /<text x="84" y="172"[^>]*>E<\/text>/)
  assert.match(
    first,
    /<circle cx="390" cy="148" r="12" fill="#fffdf9" stroke="#8A4B2A" stroke-width="4"\/>/,
  )
  assert.match(
    first,
    /<text x="174" y="196" font-family="Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif" font-size="11" text-anchor="middle" fill="#4e4e4e">1 品<\/text>/,
  )
  assert.doesNotMatch(first, /<text x="174" y="44"[^>]*>1 品<\/text>/)
  assert.match(
    first,
    /<text x="406" y="151" font-family="Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif" font-size="9" font-weight="700" text-anchor="start" fill="#8A4B2A">根音<\/text>/,
  )
  assert.match(first, /<g data-role="legend"><circle cx="48" cy="210" r="8"/)
  assert.match(first, />根音<\/text>/)
  assert.doesNotMatch(first, /根音（C）/)
  assert.equal(positionGroups.length, 24)
  assert.equal((first.match(/data-role="root"/g) ?? []).length, 3)
  assert.equal((first.match(/data-role="tone"/g) ?? []).length, 21)
  assert.deepEqual(
    positionGroups.map((group) => `${group[1]}:${group[2]}:${group[3]}:${group[4]}`),
    cMajorScale.positions.map(
      (position) => `${position.string}:${position.fret}:${position.label}:${position.role}`,
    ),
  )
  assert.equal(
    first.trim(),
    readFileSync(resolve("tests/diagrams/__snapshots__/c-major-scale.svg"), "utf8").trim(),
  )
  parseXml(first)
})

test("uses actual fret labels below a positive position and never draws a false nut", () => {
  const svg = renderFretboard({
    id: "d-high-position",
    title: "D 高把位音阶",
    startFret: 7,
    endFret: 11,
    positions: [{ string: 1, fret: 7, label: "D", role: "root" }],
  })

  assert.match(svg, />7 品<\/text>/)
  assert.match(svg, />11 品<\/text>/)
  assert.match(
    svg,
    /<circle cx="174" cy="52" r="12" fill="#fffdf9" stroke="#8A4B2A" stroke-width="4"\/>/,
  )
  assert.match(
    svg,
    /<g data-role="legend"><circle cx="48" cy="210" r="8"[^>]*\/><text x="62" y="214"[^>]*>根音<\/text>/,
  )
  assert.doesNotMatch(svg, /根音（C）/)
  assert.doesNotMatch(svg, /data-role="nut"/)
  parseXml(svg)
})

test("centers every fretted marker in its open-position cell outside the reviewed zero-to-five range", () => {
  const svg = renderFretboard({
    id: "open-short-range",
    title: "短开放把位",
    startFret: 0,
    endFret: 1,
    positions: [
      { string: 1, fret: 0, label: "E", role: "tone" },
      { string: 1, fret: 1, label: "F", role: "tone" },
    ],
  })

  assert.match(
    svg,
    /<line data-role="fret-boundary" x1="120" y1="52" x2="120" y2="172" stroke="#b8b8b8" stroke-width="1"\/>/,
  )
  assert.match(
    svg,
    /<line data-role="fret-boundary" x1="660" y1="52" x2="660" y2="172" stroke="#b8b8b8" stroke-width="1"\/>/,
  )
  assert.match(
    svg,
    /<circle cx="390" cy="52" r="12" fill="#fffdf9" stroke="#2F6B5F" stroke-width="2"\/>/,
  )
  assert.doesNotMatch(svg, /<circle cx="174" cy="52" r="12"/)
  parseXml(svg)
})

test("escapes fretboard labels while preserving valid, safe XML", () => {
  const svg = renderFretboard({
    id: "safe-fretboard",
    title: "安全音阶",
    startFret: 0,
    endFret: 1,
    positions: [{ string: 1, fret: 0, label: `A & B < C > D " '`, role: "tone" }],
  })

  assert.match(svg, /data-label="A &amp; B &lt; C &gt; D &quot; &apos;"/)
  assert.doesNotMatch(svg, /&amp;amp;|<script|foreignObject|\son\w+=|\shref=|url\(/)
  parseXml(svg)
})
