export const SVG_TOKENS = {
  surface: "#fffdf9",
  ink: "#2b2b2b",
  mutedInk: "#4e4e4e",
  grid: "#b8b8b8",
  root: "#8A4B2A",
  tone: "#2F6B5F",
  inverse: "#fffdf9",
} as const

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("SVG_NUMBER: value must be finite")
  }

  const decimal = value.toString()
  if (!/[eE]/.test(decimal)) {
    return decimal
  }

  const [coefficient, exponentText] = decimal.toLowerCase().split("e")
  const exponent = Number(exponentText)
  const negative = coefficient.startsWith("-")
  const unsigned = negative ? coefficient.slice(1) : coefficient
  const [whole, fraction = ""] = unsigned.split(".")
  const digits = `${whole}${fraction}`
  const decimalIndex = whole.length + exponent
  let result: string

  if (decimalIndex <= 0) {
    result = `0.${"0".repeat(-decimalIndex)}${digits}`
  } else if (decimalIndex >= digits.length) {
    result = `${digits}${"0".repeat(decimalIndex - digits.length)}`
  } else {
    result = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
  }

  return negative ? `-${result}` : result
}

export interface SvgWrapperOptions {
  id: string
  kind: "chord" | "fretboard" | "rhythm"
  title: string
  description: string
  width: number
  height: number
  body: string
}

export function wrapSvg(options: SvgWrapperOptions): string {
  const { id, kind, title, description, width, height, body } = options
  if (!ID_PATTERN.test(id)) {
    throw new Error("SVG_ID: id must be lowercase ASCII kebab-case")
  }
  if (title.trim() === "" || description.trim() === "") {
    throw new Error("SVG_A11Y: title and description must be non-empty")
  }

  const titleId = `${kind}-${id}-title`
  const descriptionId = `${kind}-${id}-desc`
  const escapedId = escapeXml(id)
  const escapedKind = escapeXml(kind)
  const formattedWidth = formatNumber(width)
  const formattedHeight = formatNumber(height)

  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${titleId} ${descriptionId}" width="${formattedWidth}" height="${formattedHeight}" viewBox="0 0 ${formattedWidth} ${formattedHeight}" data-diagram-id="${escapedId}" data-diagram-kind="${escapedKind}"><title id="${titleId}">${escapeXml(title)}</title><desc id="${descriptionId}">${escapeXml(description)}</desc>${body}</svg>`
}
