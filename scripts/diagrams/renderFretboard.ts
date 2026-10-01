import { escapeXml, formatNumber, SVG_TOKENS, wrapSvg } from "./svg"
import type { FretboardDefinition, FretPosition } from "./types"

const CJK_FONT = "Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif"
const WIDTH = 720
const HEIGHT = 220
const LEFT = 120
const RIGHT = 660
const OPEN_X = 84
const TOP = 52
const STRING_PITCH = 24

function stringY(string: number): number {
  return TOP + STRING_PITCH * (string - 1)
}

function displayedFretCount(definition: FretboardDefinition): number {
  return definition.startFret === 0
    ? definition.endFret
    : definition.endFret - definition.startFret + 1
}

function displayedFretPitch(definition: FretboardDefinition): number {
  return (RIGHT - LEFT) / displayedFretCount(definition)
}

function fretCenter(definition: FretboardDefinition, fret: number): number {
  if (fret === 0) {
    return OPEN_X
  }

  if (definition.startFret === 0) {
    return LEFT + (fret - 0.5) * displayedFretPitch(definition)
  }

  return LEFT + (fret - definition.startFret + 0.5) * displayedFretPitch(definition)
}

function positionSvg(definition: FretboardDefinition, position: FretPosition): string {
  const positionX = fretCenter(definition, position.fret)
  const x = formatNumber(positionX)
  const y = formatNumber(stringY(position.string))
  const label = escapeXml(position.label)
  const isRoot = position.role === "root"
  const stroke = isRoot ? SVG_TOKENS.root : SVG_TOKENS.tone
  const strokeWidth = isRoot ? 4 : 2
  const rootText = (() => {
    if (!isRoot) return ""

    const placeOnLeft = positionX > RIGHT - 40
    const rootLabelX = formatNumber(positionX + (placeOnLeft ? -16 : 16))
    const anchor = placeOnLeft ? "end" : "start"
    return `<text x="${rootLabelX}" y="${formatNumber(stringY(position.string) + 3)}" font-family="${CJK_FONT}" font-size="9" font-weight="700" text-anchor="${anchor}" fill="${SVG_TOKENS.root}">根音</text>`
  })()

  return `<g data-string="${position.string}" data-fret="${position.fret}" data-label="${label}" data-role="${position.role}"><circle cx="${x}" cy="${y}" r="12" fill="${SVG_TOKENS.surface}" stroke="${stroke}" stroke-width="${strokeWidth}"/><text x="${x}" y="${y}" font-family="${CJK_FONT}" font-size="12" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${SVG_TOKENS.ink}">${label}</text>${rootText}</g>`
}

function description(definition: FretboardDefinition): string {
  const positions = definition.positions
    .map(
      (position) =>
        `第 ${position.string} 弦 ${position.fret} 品 ${position.label}${position.role === "root" ? "根音" : "音"}`,
    )
    .join("；")

  return `${definition.title}，显示第 ${definition.startFret} 至 ${definition.endFret} 品，共 ${definition.positions.length} 个音位：${positions}。`
}

export function renderFretboard(definition: FretboardDefinition): string {
  const count = definition.endFret - definition.startFret + 1
  const pitch = displayedFretPitch(definition)
  const fretLabels = Array.from({ length: count }, (_, index) => definition.startFret + index)
    .filter((fret) => fret > 0)
    .map((fret) => {
      const x = fretCenter(definition, fret)
      return `<text x="${formatNumber(x)}" y="196" font-family="${CJK_FONT}" font-size="11" text-anchor="middle" fill="${SVG_TOKENS.mutedInk}">${fret} 品</text>`
    })
    .join("")
  const boundaryXs = Array.from(
    { length: displayedFretCount(definition) + 1 },
    (_, index) => LEFT + index * pitch,
  )
  const boundaries = boundaryXs
    .map(
      (x) =>
        `<line data-role="fret-boundary" x1="${formatNumber(x)}" y1="${TOP}" x2="${formatNumber(x)}" y2="${stringY(6)}" stroke="${SVG_TOKENS.grid}" stroke-width="1"/>`,
    )
    .join("")
  const strings = [1, 2, 3, 4, 5, 6]
    .map(
      (string) =>
        `<line x1="${LEFT}" y1="${stringY(string)}" x2="${RIGHT}" y2="${stringY(string)}" stroke="${SVG_TOKENS.ink}" stroke-width="2"/>`,
    )
    .join("")
  const nut =
    definition.startFret === 0
      ? `<line data-role="nut" x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${stringY(6)}" stroke="${SVG_TOKENS.ink}" stroke-width="8"/>`
      : ""
  const legend = `<g data-role="legend"><circle cx="48" cy="210" r="8" fill="${SVG_TOKENS.surface}" stroke="${SVG_TOKENS.root}" stroke-width="4"/><text x="62" y="214" font-family="${CJK_FONT}" font-size="12" font-weight="700" fill="${SVG_TOKENS.root}">根音</text><circle cx="150" cy="210" r="8" fill="${SVG_TOKENS.surface}" stroke="${SVG_TOKENS.tone}" stroke-width="2"/><text x="164" y="214" font-family="${CJK_FONT}" font-size="12" fill="${SVG_TOKENS.mutedInk}">音</text></g>`
  const body = `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${SVG_TOKENS.surface}"/><text x="48" y="28" font-family="${CJK_FONT}" font-size="18" font-weight="700" fill="${SVG_TOKENS.ink}">${escapeXml(definition.title)}</text>${fretLabels}${boundaries}${strings}${nut}${definition.positions.map((position) => positionSvg(definition, position)).join("")}${legend}`

  return wrapSvg({
    id: definition.id,
    kind: "fretboard",
    title: definition.title,
    description: description(definition),
    width: WIDTH,
    height: HEIGHT,
    body,
  })
}
