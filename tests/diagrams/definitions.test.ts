import assert from "node:assert/strict"
import test from "node:test"
import {
  validateChord,
  validateFretboard,
  validateRhythm,
} from "../../scripts/diagrams/validateDefinitions"

const cMajor = {
  id: "c-major",
  title: " C 大三和弦 ",
  baseFret: 1,
  frets: ["x", 3, 2, 0, 1, 0],
  fingers: [null, 3, 2, null, 1, null],
  barres: [],
}

const openCMajor = {
  id: "c-major-open-position",
  title: " 开放位 C 大调 ",
  startFret: 0,
  endFret: 5,
  positions: [
    { string: 5, fret: 3, label: "C", role: "root" },
    { string: 2, fret: 1, label: "C", role: "root" },
    { string: 1, fret: 0, label: "E", role: "tone" },
  ],
}

function rhythm(meter: "3/4" | "4/4" | "6/8", subdivision: 4 | 8 | 16) {
  const [numerator, denominator] = meter.split("/").map(Number)
  const expectedCount = (numerator * subdivision) / denominator

  return {
    id: `pattern-${meter.replace("/", "-")}-${subdivision}`,
    title: ` ${meter} 节奏 `,
    meter,
    subdivision,
    cells: Array.from({ length: expectedCount }, (_, index) => ({
      label: index === 0 ? "1" : "&",
      stroke: index === 0 ? "down" : "rest",
      accent: index === 0,
    })),
  }
}

test("validates and trims a conventional six-to-one C chord", () => {
  const definition = validateChord(cMajor)

  assert.equal(definition.id, "c-major")
  assert.equal(definition.title, "C 大三和弦")
  assert.deepEqual(definition.frets, ["x", 3, 2, 0, 1, 0])
})

test("rejects chord tuple length, invalid identifiers, and blank titles with stable codes", () => {
  assert.throws(() => validateChord({ ...cMajor, frets: [0, 1] }), /CHORD_STRING_COUNT.*c-major/)
  assert.throws(() => validateChord({ ...cMajor, id: "C major" }), /CHORD_ID/)
  assert.throws(() => validateChord({ ...cMajor, title: "  " }), /CHORD_TITLE.*c-major/)
})

test("enforces chord finger ranges and fret agreement without coercing values", () => {
  assert.throws(
    () => validateChord({ ...cMajor, fingers: [null, 5, 2, null, 1, null] }),
    /CHORD_FINGER_RANGE.*c-major/,
  )
  assert.throws(
    () => validateChord({ ...cMajor, fingers: [1, 3, 2, null, 1, null] }),
    /CHORD_FINGER_AGREEMENT.*c-major/,
  )
  assert.throws(
    () => validateChord({ ...cMajor, frets: ["x", "3", 2, 0, 1, 0] }),
    /CHORD_FRET_STATE.*c-major/,
  )
})

test("accepts a coherent F barre and rejects reversed, out-of-range, duplicate, and incoherent barres", () => {
  const fMajor = {
    ...cMajor,
    id: "f-major-barre",
    title: "F 大横按和弦",
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barres: [{ fret: 1, fromString: 1, toString: 6, finger: 1 }],
  }

  assert.equal(validateChord(fMajor).barres[0]?.fret, 1)
  assert.throws(
    () =>
      validateChord({ ...fMajor, barres: [{ fret: 1, fromString: 6, toString: 1, finger: 1 }] }),
    /CHORD_BARRE_ORDER.*f-major-barre/,
  )
  assert.throws(
    () =>
      validateChord({ ...fMajor, barres: [{ fret: 1, fromString: 0, toString: 6, finger: 1 }] }),
    /CHORD_BARRE_RANGE.*f-major-barre/,
  )
  assert.throws(
    () => validateChord({ ...fMajor, barres: [...fMajor.barres, ...fMajor.barres] }),
    /CHORD_BARRE_DUPLICATE.*f-major-barre/,
  )
  assert.throws(
    () =>
      validateChord({
        ...fMajor,
        frets: [1, 3, 3, 2, 2, 1],
        barres: [{ fret: 1, fromString: 1, toString: 2, finger: 1 }],
      }),
    /CHORD_BARRE_AGREEMENT.*f-major-barre/,
  )
})

test("requires own barre fields instead of accepting inherited property names", () => {
  assert.throws(
    () => validateChord({ ...cMajor, barres: [{ fret: 1, fromString: 1, finger: 1 }] }),
    /CHORD_BARRE_SHAPE.*c-major/,
  )
})

test("rejects barres below or above the five-fret chord display", () => {
  const fMajor = {
    ...cMajor,
    id: "f-major-barre",
    title: "F 大横按和弦",
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barres: [{ fret: 1, fromString: 1, toString: 6, finger: 1 }],
  }

  assert.throws(
    () => validateChord({ ...fMajor, baseFret: 2 }),
    /CHORD_BARRE_DISPLAY.*f-major-barre/,
  )
  assert.throws(
    () =>
      validateChord({
        ...fMajor,
        frets: [9, 11, 11, 10, 9, 9],
        barres: [{ fret: 9, fromString: 1, toString: 6, finger: 1 }],
      }),
    /CHORD_BARRE_DISPLAY.*f-major-barre/,
  )
})

test("requires every barre-covered string to be fretted consistently", () => {
  const fMajor = {
    ...cMajor,
    id: "f-major-barre",
    title: "F 大横按和弦",
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barres: [{ fret: 1, fromString: 1, toString: 6, finger: 1 }],
  }

  assert.doesNotThrow(() => validateChord(fMajor))
  assert.throws(
    () => validateChord({ ...fMajor, frets: [1, 3, 0, 2, 1, 1], fingers: [1, 3, null, 2, 1, 1] }),
    /CHORD_BARRE_AGREEMENT.*f-major-barre/,
  )
  assert.throws(
    () => validateChord({ ...fMajor, frets: [1, 3, "x", 2, 1, 1], fingers: [1, 3, null, 2, 1, 1] }),
    /CHORD_BARRE_AGREEMENT.*f-major-barre/,
  )
  assert.throws(
    () => validateChord({ ...fMajor, frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 2, 2, 1, 1] }),
    /CHORD_BARRE_AGREEMENT.*f-major-barre/,
  )
  assert.throws(
    () => validateChord({ ...fMajor, fingers: [1, 3, 1, 2, 1, 1] }),
    /CHORD_BARRE_AGREEMENT.*f-major-barre/,
  )
})

test("rejects overlapping barres that repeat the same fret and finger", () => {
  assert.throws(
    () =>
      validateChord({
        ...cMajor,
        id: "overlapping-barres",
        title: "重叠横按",
        frets: [1, 1, 1, 1, 1, 1],
        fingers: [1, 1, 1, 1, 1, 1],
        barres: [
          { fret: 1, fromString: 1, toString: 4, finger: 1 },
          { fret: 1, fromString: 3, toString: 6, finger: 1 },
        ],
      }),
    /CHORD_BARRE_DUPLICATE.*overlapping-barres/,
  )
})

test("accepts open-position fretboards and trims all human labels", () => {
  const definition = validateFretboard(openCMajor)

  assert.equal(definition.startFret, 0)
  assert.equal(definition.positions[0]?.label, "C")
  assert.equal(definition.title, "开放位 C 大调")
})

test("rejects invalid fretboard ranges, positions, duplicate locations, and labels", () => {
  assert.throws(
    () => validateFretboard({ ...openCMajor, startFret: 5, endFret: 3 }),
    /FRETBOARD_RANGE.*c-major-open-position/,
  )
  assert.throws(
    () =>
      validateFretboard({
        ...openCMajor,
        positions: [{ string: 0, fret: 0, label: "E", role: "tone" }],
      }),
    /FRETBOARD_POSITION_STRING.*c-major-open-position/,
  )
  assert.throws(
    () =>
      validateFretboard({
        ...openCMajor,
        positions: [{ string: 1, fret: 6, label: "F", role: "tone" }],
      }),
    /FRETBOARD_POSITION_FRET.*c-major-open-position/,
  )
  assert.throws(
    () =>
      validateFretboard({
        ...openCMajor,
        positions: [openCMajor.positions[0], openCMajor.positions[0]],
      }),
    /FRETBOARD_POSITION_DUPLICATE.*c-major-open-position/,
  )
  assert.throws(
    () =>
      validateFretboard({
        ...openCMajor,
        positions: [{ string: 1, fret: 0, label: " ", role: "tone" }],
      }),
    /FRETBOARD_POSITION_LABEL.*c-major-open-position/,
  )
})

test("accepts every supported rhythm cell-count boundary, including quarter-note subdivision", () => {
  for (const [meter, subdivision, cells] of [
    ["4/4", 4, 4],
    ["3/4", 8, 6],
    ["4/4", 8, 8],
    ["6/8", 8, 6],
    ["6/8", 16, 12],
  ] as const) {
    assert.equal(validateRhythm(rhythm(meter, subdivision)).cells.length, cells)
  }
})

test("rejects rhythm cell mismatch and malformed cells without coercion", () => {
  const basic = rhythm("4/4", 8)
  const withInvalidCell = (cell: Record<string, unknown>) => ({
    ...basic,
    cells: [cell, ...basic.cells.slice(1)],
  })

  assert.throws(
    () => validateRhythm({ ...basic, cells: basic.cells.slice(1) }),
    /RHYTHM_CELL_COUNT.*pattern-4-4-8/,
  )
  assert.throws(
    () => validateRhythm(withInvalidCell({ label: "1", stroke: "sideways", accent: true })),
    /RHYTHM_CELL_STROKE.*pattern-4-4-8/,
  )
  assert.throws(
    () => validateRhythm(withInvalidCell({ label: "1", stroke: "down", accent: "true" })),
    /RHYTHM_CELL_ACCENT.*pattern-4-4-8/,
  )
  assert.throws(
    () => validateRhythm(withInvalidCell({ label: " ", stroke: "down", accent: true })),
    /RHYTHM_CELL_LABEL.*pattern-4-4-8/,
  )
})

test("rejects extra definition fields and non-object rhythm values with coded errors", () => {
  assert.throws(() => validateRhythm({ ...rhythm("3/4", 8), unexpected: true }), /RHYTHM_SHAPE/)
  assert.throws(() => validateRhythm("not a rhythm"), /RHYTHM_SHAPE/)
})
