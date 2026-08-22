import type {
  Barre,
  ChordDefinition,
  Finger,
  FretPosition,
  FretboardDefinition,
  GuitarString,
  RhythmCell,
  RhythmDefinition,
  StringState,
} from "./types"

type DefinitionRecord = Record<string, unknown>

const CHORD_KEYS = ["id", "title", "baseFret", "frets", "fingers", "barres"]
const FRETBOARD_KEYS = ["id", "title", "startFret", "endFret", "positions"]
const RHYTHM_KEYS = ["id", "title", "meter", "subdivision", "cells"]
const BARRE_KEYS = ["fret", "fromString", "toString", "finger"]
const POSITION_KEYS = ["string", "fret", "label", "role"]
const CELL_KEYS = ["label", "stroke", "accent"]
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const GUITAR_STRINGS = new Set([1, 2, 3, 4, 5, 6])
const FINGERS = new Set([1, 2, 3, 4])
const METERS = new Set(["3/4", "4/4", "6/8"])
const SUBDIVISIONS = new Set([4, 8, 16])
const STROKES = new Set(["down", "up", "rest", "mute"])
const ROLES = new Set(["root", "tone"])

function fail(code: string, id: string, message: string): never {
  throw new Error(`${code} [${id}]: ${message}`)
}

function asRecord(value: unknown, prefix: string): DefinitionRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${prefix}_SHAPE`, "unknown", "definition must be an object")
  }

  return value as DefinitionRecord
}

function availableId(record: DefinitionRecord): string {
  return typeof record.id === "string" && record.id.trim() !== "" ? record.id.trim() : "unknown"
}

function requireKnownKeys(
  record: DefinitionRecord,
  keys: readonly string[],
  prefix: string,
  id: string,
) {
  if (
    Object.keys(record).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(record, key))
  ) {
    fail(`${prefix}_SHAPE`, id, "definition has missing or unexpected fields")
  }
}

function requireId(record: DefinitionRecord, prefix: string): string {
  const id = availableId(record)
  if (typeof record.id !== "string" || !ID_PATTERN.test(id)) {
    fail(`${prefix}_ID`, id, "id must be lowercase ASCII kebab-case")
  }

  return id
}

function requireHumanText(value: unknown, code: string, id: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(code, id, "text must be non-empty")
  }

  return value.trim()
}

function isIntegerInRange(value: unknown, minimum: number, maximum?: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    (maximum === undefined || value <= maximum)
  )
}

function isGuitarString(value: unknown): value is GuitarString {
  return typeof value === "number" && GUITAR_STRINGS.has(value)
}

function requireArray(value: unknown, code: string, id: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(code, id, "value must be an array")
  }

  return value
}

function validateBarre(value: unknown, id: string): Barre {
  const record = asRecord(value, "CHORD_BARRE")
  requireKnownKeys(record, BARRE_KEYS, "CHORD_BARRE", id)
  const fromString = record.fromString
  const toString = record.toString

  if (!isIntegerInRange(record.fret, 1)) {
    fail("CHORD_BARRE_FRET", id, "barre fret must be a positive integer")
  }
  if (!isGuitarString(fromString) || !isGuitarString(toString)) {
    fail("CHORD_BARRE_RANGE", id, "barre strings must be within 1 through 6")
  }
  if (fromString > toString) {
    fail("CHORD_BARRE_ORDER", id, "barre fromString must not exceed toString")
  }
  if (!isIntegerInRange(record.finger, 1, 4)) {
    fail("CHORD_BARRE_FINGER", id, "barre finger must be 1 through 4")
  }

  return {
    fret: record.fret,
    fromString,
    toString,
    finger: record.finger as Exclude<Finger, null>,
  }
}

function stringIndex(string: GuitarString): number {
  return 6 - string
}

function coveredByBarre(barres: Barre[], string: GuitarString, fret: number): Barre | undefined {
  return barres.find(
    (barre) => barre.fret === fret && string >= barre.fromString && string <= barre.toString,
  )
}

export function validateChord(value: unknown): ChordDefinition {
  const record = asRecord(value, "CHORD")
  const id = availableId(record)
  requireKnownKeys(record, CHORD_KEYS, "CHORD", id)
  const normalizedId = requireId(record, "CHORD")
  const title = requireHumanText(record.title, "CHORD_TITLE", normalizedId)

  if (!isIntegerInRange(record.baseFret, 1)) {
    fail("CHORD_BASE_FRET", normalizedId, "baseFret must be a positive integer")
  }

  const rawFrets = requireArray(record.frets, "CHORD_STRING_COUNT", normalizedId)
  const rawFingers = requireArray(record.fingers, "CHORD_STRING_COUNT", normalizedId)
  if (rawFrets.length !== 6 || rawFingers.length !== 6) {
    fail("CHORD_STRING_COUNT", normalizedId, "frets and fingers must each have six values")
  }

  const barres = requireArray(record.barres, "CHORD_BARRE_SHAPE", normalizedId).map((barre) =>
    validateBarre(barre, normalizedId),
  )
  const barreKeys = new Set<string>()
  for (const barre of barres) {
    const key = `${barre.fret}:${barre.fromString}:${barre.toString}:${barre.finger}`
    if (barreKeys.has(key)) {
      fail("CHORD_BARRE_DUPLICATE", normalizedId, "duplicate barre")
    }
    barreKeys.add(key)
  }

  const frets = rawFrets.map((fret) => {
    if (fret !== "x" && !isIntegerInRange(fret, 0)) {
      fail("CHORD_FRET_STATE", normalizedId, "fret must be x, 0, or a positive integer")
    }
    return fret as StringState
  }) as ChordDefinition["frets"]
  const fingers = rawFingers.map((finger) => {
    if (finger !== null && !FINGERS.has(finger as number)) {
      fail("CHORD_FINGER_RANGE", normalizedId, "finger must be null or 1 through 4")
    }
    return finger as Finger
  }) as ChordDefinition["fingers"]

  for (let index = 0; index < frets.length; index += 1) {
    const fret = frets[index]
    const finger = fingers[index]
    const string = (6 - index) as GuitarString
    if (fret === "x" || fret === 0) {
      if (finger !== null) {
        fail("CHORD_FINGER_AGREEMENT", normalizedId, "open or muted strings require null fingers")
      }
      continue
    }

    const barre = coveredByBarre(barres, string, fret)
    if (barre) {
      if (finger !== barre.finger) {
        fail("CHORD_BARRE_AGREEMENT", normalizedId, "barre-covered fret must use the barre finger")
      }
    } else if (finger === null) {
      fail("CHORD_FINGER_AGREEMENT", normalizedId, "fretted strings require a finger")
    }
  }

  for (const barre of barres) {
    const fromIndex = stringIndex(barre.fromString)
    const toIndex = stringIndex(barre.toString)
    const endpoints = [fromIndex, toIndex]
    for (const index of endpoints) {
      if (frets[index] !== barre.fret || fingers[index] !== barre.finger) {
        fail("CHORD_BARRE_AGREEMENT", normalizedId, "barre endpoints must be fretted by its finger")
      }
    }
  }

  return { id: normalizedId, title, baseFret: record.baseFret, frets, fingers, barres }
}

function validatePosition(
  value: unknown,
  id: string,
  startFret: number,
  endFret: number,
): FretPosition {
  const record = asRecord(value, "FRETBOARD_POSITION")
  requireKnownKeys(record, POSITION_KEYS, "FRETBOARD_POSITION", id)
  const string = record.string
  if (!isGuitarString(string)) {
    fail("FRETBOARD_POSITION_STRING", id, "position string must be within 1 through 6")
  }
  if (!isIntegerInRange(record.fret, startFret, endFret)) {
    fail("FRETBOARD_POSITION_FRET", id, "position fret must be within the displayed range")
  }
  const label = requireHumanText(record.label, "FRETBOARD_POSITION_LABEL", id)
  if (typeof record.role !== "string" || !ROLES.has(record.role)) {
    fail("FRETBOARD_POSITION_ROLE", id, "position role must be root or tone")
  }

  return {
    string,
    fret: record.fret,
    label,
    role: record.role as FretPosition["role"],
  }
}

export function validateFretboard(value: unknown): FretboardDefinition {
  const record = asRecord(value, "FRETBOARD")
  const id = availableId(record)
  requireKnownKeys(record, FRETBOARD_KEYS, "FRETBOARD", id)
  const normalizedId = requireId(record, "FRETBOARD")
  const title = requireHumanText(record.title, "FRETBOARD_TITLE", normalizedId)
  if (
    !isIntegerInRange(record.startFret, 0) ||
    !isIntegerInRange(record.endFret, 0) ||
    record.endFret <= record.startFret
  ) {
    fail("FRETBOARD_RANGE", normalizedId, "endFret must be greater than startFret")
  }

  const positions = requireArray(record.positions, "FRETBOARD_POSITIONS", normalizedId).map(
    (position) =>
      validatePosition(
        position,
        normalizedId,
        record.startFret as number,
        record.endFret as number,
      ),
  )
  const locations = new Set<string>()
  for (const position of positions) {
    const key = `${position.string}:${position.fret}`
    if (locations.has(key)) {
      fail("FRETBOARD_POSITION_DUPLICATE", normalizedId, "duplicate string and fret position")
    }
    locations.add(key)
  }

  return {
    id: normalizedId,
    title,
    startFret: record.startFret,
    endFret: record.endFret,
    positions,
  }
}

function validateCell(value: unknown, id: string): RhythmCell {
  const record = asRecord(value, "RHYTHM_CELL")
  requireKnownKeys(record, CELL_KEYS, "RHYTHM_CELL", id)
  const label = requireHumanText(record.label, "RHYTHM_CELL_LABEL", id)
  if (typeof record.stroke !== "string" || !STROKES.has(record.stroke)) {
    fail("RHYTHM_CELL_STROKE", id, "stroke must be down, up, rest, or mute")
  }
  if (typeof record.accent !== "boolean") {
    fail("RHYTHM_CELL_ACCENT", id, "accent must be a boolean")
  }

  return { label, stroke: record.stroke as RhythmCell["stroke"], accent: record.accent }
}

export function validateRhythm(value: unknown): RhythmDefinition {
  const record = asRecord(value, "RHYTHM")
  const id = availableId(record)
  requireKnownKeys(record, RHYTHM_KEYS, "RHYTHM", id)
  const normalizedId = requireId(record, "RHYTHM")
  const title = requireHumanText(record.title, "RHYTHM_TITLE", normalizedId)
  if (typeof record.meter !== "string" || !METERS.has(record.meter)) {
    fail("RHYTHM_METER", normalizedId, "meter must be 3/4, 4/4, or 6/8")
  }
  if (!isIntegerInRange(record.subdivision, 1) || !SUBDIVISIONS.has(record.subdivision)) {
    fail("RHYTHM_SUBDIVISION", normalizedId, "subdivision must be 4, 8, or 16")
  }

  const rawCells = requireArray(record.cells, "RHYTHM_CELLS", normalizedId)
  const [numerator, denominator] = record.meter.split("/").map(Number)
  const expectedCellCount = (numerator * record.subdivision) / denominator
  if (rawCells.length !== expectedCellCount) {
    fail("RHYTHM_CELL_COUNT", normalizedId, `expected ${expectedCellCount} cells`)
  }
  const cells = rawCells.map((cell) => validateCell(cell, normalizedId))

  return {
    id: normalizedId,
    title,
    meter: record.meter as RhythmDefinition["meter"],
    subdivision: record.subdivision as RhythmDefinition["subdivision"],
    cells,
  }
}
