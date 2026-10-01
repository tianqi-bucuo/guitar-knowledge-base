import { escapeXml, formatNumber, SVG_TOKENS, wrapSvg } from "./svg"
import type { RhythmCell, RhythmDefinition } from "./types"

const CJK_FONT = "Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif"
const WIDTH = 720
const HEIGHT = 220
const TRACK_LEFT = 48
const TRACK_RIGHT = 672
const CELL_TOP = 76
const CELL_HEIGHT = 96
const RULE_Y = 164

const ACTIONS: Record<RhythmCell["stroke"], string> = {
  down: "↓",
  up: "↑",
  rest: "—",
  mute: "×",
}

const ACTION_NAMES: Record<RhythmCell["stroke"], string> = {
  down: "下扫",
  up: "上扫",
  rest: "休止",
  mute: "闷音",
}

function rhythmDescription(definition: RhythmDefinition): string {
  const actions = definition.cells
    .map(
      (cell, index) =>
        `第 ${index + 1} 格${cell.label}${ACTION_NAMES[cell.stroke]}${cell.accent ? "重音" : ""}`,
    )
    .join("；")
  return `${definition.title}，${definition.meter} 拍、每拍 ${definition.subdivision} 等分，共 ${definition.cells.length} 格：${actions}。`
}

export function renderRhythm(definition: RhythmDefinition): string {
  const cellWidth = (TRACK_RIGHT - TRACK_LEFT) / definition.cells.length
  const muteLegend = definition.cells.some((cell) => cell.stroke === "mute") ? "　× 闷音" : ""
  const cells = definition.cells
    .map((cell, index) => {
      const x = TRACK_LEFT + index * cellWidth
      const center = x + cellWidth / 2
      const accent = cell.accent
        ? `<text x="${formatNumber(center)}" y="122" font-family="${CJK_FONT}" font-size="16" font-weight="700" text-anchor="middle" fill="${SVG_TOKENS.root}">&gt;</text>`
        : ""
      const rule = cell.accent
        ? `<line data-role="accent-rule" x1="${formatNumber(x)}" y1="${RULE_Y}" x2="${formatNumber(x + cellWidth)}" y2="${RULE_Y}" stroke="${SVG_TOKENS.root}" stroke-width="4"/>`
        : `<line data-role="grid-rule" x1="${formatNumber(x)}" y1="${RULE_Y}" x2="${formatNumber(x + cellWidth)}" y2="${RULE_Y}" stroke="${SVG_TOKENS.grid}" stroke-width="1"/>`

      return `<g data-cell-index="${index}" data-label="${escapeXml(cell.label)}" data-stroke="${cell.stroke}" data-accent="${cell.accent}"><rect x="${formatNumber(x)}" y="${CELL_TOP}" width="${formatNumber(cellWidth)}" height="${CELL_HEIGHT}" fill="${SVG_TOKENS.surface}" stroke="${SVG_TOKENS.grid}"/> <text x="${formatNumber(center)}" y="100" font-family="${CJK_FONT}" font-size="13" text-anchor="middle" fill="${SVG_TOKENS.mutedInk}">${escapeXml(cell.label)}</text>${accent}<text x="${formatNumber(center)}" y="150" font-family="${CJK_FONT}" font-size="24" font-weight="700" text-anchor="middle" fill="${SVG_TOKENS.ink}">${ACTIONS[cell.stroke]}</text>${rule}</g>`
    })
    .join("")
  const body = `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${SVG_TOKENS.surface}"/><text x="48" y="28" font-family="${CJK_FONT}" font-size="18" font-weight="700" fill="${SVG_TOKENS.ink}">${escapeXml(definition.title)}</text><text x="48" y="52" font-family="${CJK_FONT}" font-size="12" fill="${SVG_TOKENS.mutedInk}">${definition.meter} 拍 · 每拍 ${definition.subdivision} 等分</text>${cells}<text x="48" y="200" font-family="${CJK_FONT}" font-size="12" fill="${SVG_TOKENS.mutedInk}">图例：↓ 下扫　↑ 上扫　— 休止${muteLegend}　&gt; 重音</text>`

  return wrapSvg({
    id: definition.id,
    kind: "rhythm",
    title: definition.title,
    description: rhythmDescription(definition),
    width: WIDTH,
    height: HEIGHT,
    body,
  })
}
