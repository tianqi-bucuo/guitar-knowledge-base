import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { DOMParser } from "@xmldom/xmldom"
import { renderChord } from "../../scripts/diagrams/renderChord"
import { escapeXml, formatNumber, wrapSvg } from "../../scripts/diagrams/svg"
import type { ChordDefinition } from "../../scripts/diagrams/types"

const cMajor: ChordDefinition = {
  id: "c-major",
  title: "C 大三和弦",
  baseFret: 1,
  frets: ["x", 3, 2, 0, 1, 0],
  fingers: [null, 3, 2, null, 1, null],
  barres: [],
}

const fMajorBarre: ChordDefinition = {
  id: "f-major-barre",
  title: "F 大横按和弦",
  baseFret: 1,
  frets: [1, 3, 3, 2, 1, 1],
  fingers: [1, 3, 4, 2, 1, 1],
  barres: [{ fret: 1, fromString: 1, toString: 6, finger: 1 }],
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

test("renders the C chord with fixed geometry, accessible Chinese semantics, and deterministic bytes", () => {
  const first = renderChord(cMajor)
  const second = renderChord(cMajor)
  const groups = [...first.matchAll(/<g data-string="(\d)" data-state="(\w+)">/g)]

  assert.equal(first, second)
  assert.match(
    first,
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img" aria-labelledby="chord-c-major-title chord-c-major-desc" width="240" height="320" viewBox="0 0 240 320" data-diagram-id="c-major" data-diagram-kind="chord">/,
  )
  assert.match(first, /<title id="chord-c-major-title">C 大三和弦<\/title>/)
  assert.match(
    first,
    /<desc id="chord-c-major-desc">C 大三和弦；从第六弦到第一弦为闷弦、3 品 3 指、2 品 2 指、空弦、1 品 1 指、空弦。<\/desc>/,
  )
  assert.match(first, /<rect x="0" y="0" width="240" height="320" fill="#fffdf9"\/>/)
  assert.match(first, /font-family="Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif"/)
  assert.equal((first.match(/data-string=/g) ?? []).length, 6)
  assert.deepEqual(
    groups.map((group) => group[1]),
    ["6", "5", "4", "3", "2", "1"],
  )
  assert.deepEqual(
    groups.map((group) => group[2]),
    ["muted", "fretted", "fretted", "open", "fretted", "open"],
  )
  assert.match(first, /<text x="40" y="72"[^>]*>×<\/text>/)
  assert.match(first, /<text x="136" y="72"[^>]*>O<\/text>/)
  assert.match(
    first,
    /<circle cx="72" cy="192" r="13" fill="#2F6B5F" data-fret="3" data-finger="3"\/>/,
  )
  assert.match(
    first,
    /<circle cx="104" cy="152" r="13" fill="#2F6B5F" data-fret="2" data-finger="2"\/>/,
  )
  assert.match(
    first,
    /<circle cx="168" cy="112" r="13" fill="#2F6B5F" data-fret="1" data-finger="1"\/>/,
  )
  assert.match(first, /<line x1="40" y1="92" x2="200" y2="92" stroke="#2b2b2b" stroke-width="8"\/>/)
  assert.match(first, /fill="#2b2b2b"/)
  assert.match(first, /fill="#4e4e4e"/)
  assert.match(first, /stroke="#b8b8b8"/)
  assert.equal(
    first.trim(),
    readFileSync(resolve("tests/diagrams/__snapshots__/c-major.svg"), "utf8").trim(),
  )
  parseXml(first)
})

test("escapes text and attributes once while preserving parseable safe SVG", () => {
  const value = `A & B < C > D " '`
  const escaped = "A &amp; B &lt; C &gt; D &quot; &apos;"
  const svg = renderChord({ ...cMajor, id: "safe-title", title: value })

  assert.equal(escapeXml(value), escaped)
  assert.match(svg, new RegExp(`<title id="chord-safe-title-title">${escaped}<\\/title>`))
  assert.match(svg, /data-diagram-id="safe-title"/)
  assert.doesNotMatch(svg, /&amp;amp;|<script|foreignObject|\son\w+=|\shref=|url\(/)
  parseXml(svg)
})

test("formats SVG numbers without locale drift and wraps fixed root attributes", () => {
  const svg = wrapSvg({
    id: "numeric-test",
    kind: "chord",
    title: "数字测试",
    description: "数字测试描述。",
    width: 240,
    height: 320,
    body: '<rect x="0" y="0" width="240" height="320" fill="#fffdf9"/>',
  })

  assert.equal(formatNumber(120), "120")
  assert.equal(formatNumber(1.5), "1.5")
  assert.match(
    svg,
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img" aria-labelledby="chord-numeric-test-title chord-numeric-test-desc" width="240" height="320" viewBox="0 0 240 320" data-diagram-id="numeric-test" data-diagram-kind="chord">/,
  )
  parseXml(svg)
})

test("renders a full F barre before ordinary dots with actual six-string endpoints", () => {
  const svg = renderChord(fMajorBarre)
  const barreIndex = svg.indexOf('data-role="barre"')
  const dotIndex = svg.indexOf("<circle")

  assert.ok(barreIndex >= 0)
  assert.ok(barreIndex < dotIndex)
  assert.match(
    svg,
    /<line data-role="barre" data-fret="1" data-from-string="1" data-to-string="6" data-finger="1" x1="40" y1="112" x2="200" y2="112" stroke="#8A4B2A" stroke-width="20" stroke-linecap="round"\/>/,
  )
  assert.match(svg, />横按 1 指<\/text>/)
})

test("labels a higher position without drawing a false nut", () => {
  const svg = renderChord({
    ...cMajor,
    id: "d-major-seven",
    title: "D 高把位和弦",
    baseFret: 7,
    frets: ["x", 9, 8, 7, 7, "x"],
    fingers: [null, 3, 2, 1, 1, null],
  })

  assert.match(svg, />7 品<\/text>/)
  assert.doesNotMatch(svg, /y1="92" x2="200" y2="92" stroke="#2b2b2b" stroke-width="8"/)
  assert.match(svg, /<line x1="40" y1="92" x2="200" y2="92" stroke="#b8b8b8" stroke-width="2"\/>/)
})
