import type { Barre, ChordDefinition, GuitarString } from "./types"
import { escapeXml, formatNumber, SVG_TOKENS, wrapSvg } from "./svg"

const WIDTH = 240
const HEIGHT = 320
const STRING_X = [40, 72, 104, 136, 168, 200] as const
const STRING_NUMBERS = [6, 5, 4, 3, 2, 1] as const
const GRID_Y = [92, 132, 172, 212, 252, 292] as const
const CJK_FONT = "Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif"

function fretY(fret: number, baseFret: number): number {
  return 112 + 40 * (fret - baseFret)
}

function stringX(string: GuitarString): number {
  return STRING_X[6 - string]
}

function describeString(
  fret: ChordDefinition["frets"][number],
  finger: ChordDefinition["fingers"][number],
): string {
  if (fret === "x") {
    return "闷弦"
  }
  if (fret === 0) {
    return "空弦"
  }
  return `${fret} 品 ${finger} 指`
}

function describeChord(definition: ChordDefinition): string {
  const strings = definition.frets.map((fret, index) =>
    describeString(fret, definition.fingers[index]),
  )
  const barres = definition.barres.map(
    (barre) =>
      `横按 ${barre.finger} 指，第 ${barre.fret} 品第 ${barre.fromString} 弦至第 ${barre.toString} 弦`,
  )
  const suffix = barres.length === 0 ? "" : `；${barres.join("；")}`

  return `${definition.title}；从第六弦到第一弦为${strings.join("、")}。${suffix}`
}

function renderGrid(baseFret: number): string {
  return GRID_Y.map((y, index) => {
    const nut = baseFret === 1 && index === 0
    return `<line x1="40" y1="${y}" x2="200" y2="${y}" stroke="${nut ? SVG_TOKENS.ink : SVG_TOKENS.grid}" stroke-width="${nut ? 8 : 2}"/>`
  }).join("")
}

function renderBarre(barre: Barre, baseFret: number): string {
  const x1 = Math.min(stringX(barre.fromString), stringX(barre.toString))
  const x2 = Math.max(stringX(barre.fromString), stringX(barre.toString))
  const y = fretY(barre.fret, baseFret)

  return `<line data-role="barre" data-fret="${barre.fret}" data-from-string="${barre.fromString}" data-to-string="${barre.toString}" data-finger="${barre.finger}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${SVG_TOKENS.root}" stroke-width="20" stroke-linecap="round"/><text x="120" y="306" font-family="${CJK_FONT}" font-size="12" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${SVG_TOKENS.root}">横按 ${barre.finger} 指</text>`
}

function renderStringGroup(definition: ChordDefinition, index: number): string {
  const string = STRING_NUMBERS[index]
  const x = STRING_X[index]
  const fret = definition.frets[index]
  const finger = definition.fingers[index]
  const state = fret === "x" ? "muted" : fret === 0 ? "open" : "fretted"
  const stringLine = `<line x1="${x}" y1="92" x2="${x}" y2="292" stroke="${SVG_TOKENS.ink}" stroke-width="2"/>`

  if (fret === "x" || fret === 0) {
    const symbol = fret === "x" ? "×" : "O"
    return `<g data-string="${string}" data-state="${state}">${stringLine}<text x="${x}" y="72" font-family="${CJK_FONT}" font-size="20" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${SVG_TOKENS.mutedInk}">${symbol}</text></g>`
  }

  const y = fretY(fret, definition.baseFret)
  return `<g data-string="${string}" data-state="fretted">${stringLine}<circle cx="${x}" cy="${y}" r="13" fill="${SVG_TOKENS.tone}" data-fret="${fret}" data-finger="${finger}"/><text x="${x}" y="${y}" font-family="${CJK_FONT}" font-size="13" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${SVG_TOKENS.inverse}">${finger}</text></g>`
}

export function renderChord(definition: ChordDefinition): string {
  const baseFretLabel =
    definition.baseFret === 1
      ? ""
      : `<text x="24" y="116" font-family="${CJK_FONT}" font-size="12" font-weight="400" text-anchor="middle" dominant-baseline="middle" fill="${SVG_TOKENS.mutedInk}">${formatNumber(definition.baseFret)} 品</text>`
  const body = [
    `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${SVG_TOKENS.surface}"/>`,
    `<text x="120" y="30" font-family="${CJK_FONT}" font-size="20" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${SVG_TOKENS.ink}">${escapeXml(definition.title)}</text>`,
    baseFretLabel,
    renderGrid(definition.baseFret),
    ...definition.barres.map((barre) => renderBarre(barre, definition.baseFret)),
    ...STRING_X.map((_, index) => renderStringGroup(definition, index)),
  ].join("")

  return wrapSvg({
    id: definition.id,
    kind: "chord",
    title: definition.title,
    description: describeChord(definition),
    width: WIDTH,
    height: HEIGHT,
    body,
  })
}
