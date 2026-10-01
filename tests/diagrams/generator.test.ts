import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"
import { dump, load } from "js-yaml"
import { checkDiagrams, generateDiagrams } from "../../scripts/diagrams/generateDiagrams"
import { renderChord } from "../../scripts/diagrams/renderChord"
import { renderFretboard } from "../../scripts/diagrams/renderFretboard"
import { renderRhythm } from "../../scripts/diagrams/renderRhythm"
import type {
  ChordDefinition,
  FretboardDefinition,
  RhythmDefinition,
} from "../../scripts/diagrams/types"

const cli = resolve("scripts/generate-diagrams.ts")
const tsx = resolve("node_modules/.bin/tsx")

const cMajor: ChordDefinition = {
  id: "c-major",
  title: "C 大三和弦",
  baseFret: 1,
  frets: ["x", 3, 2, 0, 1, 0],
  fingers: [null, 3, 2, null, 1, null],
  barres: [],
}

const gMajor: ChordDefinition = {
  id: "g-major",
  title: "G 大三和弦",
  baseFret: 1,
  frets: [3, 2, 0, 0, 3, 3],
  fingers: [2, 1, null, null, 3, 4],
  barres: [],
}

const cMajorScale: FretboardDefinition = {
  id: "c-major-scale",
  title: "C 大调 0–5 品指板音位",
  startFret: 0,
  endFret: 5,
  positions: [
    { string: 6, fret: 0, label: "E", role: "tone" },
    { string: 6, fret: 1, label: "F", role: "tone" },
  ],
}

const basicStrum: RhythmDefinition = {
  id: "basic-strum",
  title: "4/4 基础扫弦",
  meter: "4/4",
  subdivision: 4,
  cells: [
    { label: "1", stroke: "down", accent: true },
    { label: "2", stroke: "down", accent: false },
    { label: "3", stroke: "down", accent: false },
    { label: "4", stroke: "down", accent: false },
  ],
}

function testData() {
  return {
    chords: [cMajor],
    fretboards: [cMajorScale],
    rhythms: [basicStrum],
  }
}

async function makeWorkspace(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), "guitar-diagrams-"))
  t.after(async () => rm(root, { recursive: true, force: true }))
  const dataRoot = join(root, "data", "diagrams")
  const outputRoot = join(root, "content", "assets", "diagrams")
  await mkdir(dataRoot, { recursive: true })
  return { root, dataRoot, outputRoot }
}

async function writeData(
  dataRoot: string,
  data: ReturnType<typeof testData> = testData(),
): Promise<void> {
  await Promise.all(
    (["chords", "fretboards", "rhythms"] as const).map((family) =>
      writeFile(join(dataRoot, `${family}.yml`), dump(data[family]), "utf8"),
    ),
  )
}

async function bytesByName(outputRoot: string): Promise<Record<string, string>> {
  const names = (await readdir(outputRoot)).sort()
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, await readFile(join(outputRoot, name), "utf8")]),
    ),
  )
}

test("generates each family in declaration order with direct-renderer bytes", async (t) => {
  const { dataRoot, outputRoot } = await makeWorkspace(t)
  await writeData(dataRoot, { ...testData(), chords: [gMajor, cMajor] })

  const generated = await generateDiagrams({ dataRoot, outputRoot })

  assert.deepEqual(
    generated.map(({ file }) => file),
    [
      "chord-g-major.svg",
      "chord-c-major.svg",
      "fretboard-c-major-scale.svg",
      "rhythm-basic-strum.svg",
    ],
  )
  assert.equal(await readFile(generated[0].path, "utf8"), renderChord(gMajor))
  assert.equal(await readFile(generated[1].path, "utf8"), renderChord(cMajor))
  assert.equal(await readFile(generated[2].path, "utf8"), renderFretboard(cMajorScale))
  assert.equal(await readFile(generated[3].path, "utf8"), renderRhythm(basicStrum))
})

test("produces byte-identical output on consecutive runs", async (t) => {
  const { dataRoot, outputRoot } = await makeWorkspace(t)
  await writeData(dataRoot)

  await generateDiagrams({ dataRoot, outputRoot })
  const first = await bytesByName(outputRoot)
  await generateDiagrams({ dataRoot, outputRoot })

  assert.deepEqual(await bytesByName(outputRoot), first)
})

test("rejects non-array and empty YAML roots before touching old output", async (t) => {
  const invalidRoots = ["{}\n", "null\n", "scalar\n", "[]\n"]
  for (const invalidRoot of invalidRoots) {
    const { dataRoot, outputRoot } = await makeWorkspace(t)
    await writeData(dataRoot)
    await mkdir(outputRoot, { recursive: true })
    await writeFile(join(outputRoot, "old.svg"), "old bytes", "utf8")
    await writeFile(join(dataRoot, "chords.yml"), invalidRoot, "utf8")

    await assert.rejects(generateDiagrams({ dataRoot, outputRoot }), /DIAGRAM_ROOT_ARRAY/)
    assert.deepEqual(await bytesByName(outputRoot), { "old.svg": "old bytes" })
  }
})

test("rejects identical data and output roots without changing source bytes", async (t) => {
  const { dataRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  await writeFile(join(dataRoot, "old.svg"), "old output bytes", "utf8")
  const before = await bytesByName(dataRoot)

  await assert.rejects(
    generateDiagrams({ dataRoot, outputRoot: dataRoot }),
    (error: Error) =>
      error.message === "DIAGRAM_ROOT_OVERLAP: dataRoot and outputRoot must not overlap",
  )
  assert.deepEqual(await bytesByName(dataRoot), before)
})

test("rejects an output ancestor without changing inputs or old output", async (t) => {
  const { root, dataRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  await writeFile(join(root, "old.svg"), "ancestor output bytes", "utf8")
  const beforeData = await bytesByName(dataRoot)

  await assert.rejects(
    generateDiagrams({ dataRoot, outputRoot: root }),
    (error: Error) =>
      error.message === "DIAGRAM_ROOT_OVERLAP: dataRoot and outputRoot must not overlap",
  )
  assert.deepEqual(await bytesByName(dataRoot), beforeData)
  assert.equal(await readFile(join(root, "old.svg"), "utf8"), "ancestor output bytes")
})

test("rejects a symlink alias of dataRoot without changing the alias target", async (t) => {
  const { root, dataRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  await writeFile(join(dataRoot, "old.svg"), "aliased output bytes", "utf8")
  const aliasRoot = join(root, "alias-diagrams")
  await symlink(dataRoot, aliasRoot)
  const before = await bytesByName(dataRoot)

  await assert.rejects(
    generateDiagrams({ dataRoot, outputRoot: aliasRoot }),
    (error: Error) =>
      error.message === "DIAGRAM_ROOT_OVERLAP: dataRoot and outputRoot must not overlap",
  )
  assert.equal((await lstat(aliasRoot)).isSymbolicLink(), true)
  assert.deepEqual(await bytesByName(dataRoot), before)
})

test("rejects duplicate ids within one family and across families", async (t) => {
  const within = await makeWorkspace(t)
  await writeData(within.dataRoot, { ...testData(), chords: [cMajor, cMajor] })
  await assert.rejects(
    generateDiagrams({ dataRoot: within.dataRoot, outputRoot: within.outputRoot }),
    /DIAGRAM_DUPLICATE_ID.*c-major/,
  )

  const across = await makeWorkspace(t)
  await writeData(across.dataRoot, {
    ...testData(),
    rhythms: [{ ...basicStrum, id: "c-major" }],
  })
  await assert.rejects(
    generateDiagrams({ dataRoot: across.dataRoot, outputRoot: across.outputRoot }),
    /DIAGRAM_DUPLICATE_ID.*c-major/,
  )
})

test("removes stale SVGs only after a successful complete write", async (t) => {
  const { dataRoot, outputRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  await mkdir(outputRoot, { recursive: true })
  await writeFile(join(outputRoot, "stale.svg"), "stale", "utf8")

  await generateDiagrams({ dataRoot, outputRoot })

  assert.deepEqual((await readdir(outputRoot)).sort(), [
    "chord-c-major.svg",
    "fretboard-c-major-scale.svg",
    "rhythm-basic-strum.svg",
  ])
})

test("check reports missing and changed expected files without mutating output", async (t) => {
  const { dataRoot, outputRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  await generateDiagrams({ dataRoot, outputRoot })
  await rm(join(outputRoot, "chord-c-major.svg"))
  await writeFile(join(outputRoot, "rhythm-basic-strum.svg"), "changed", "utf8")
  const before = await bytesByName(outputRoot)

  await assert.rejects(
    checkDiagrams({ dataRoot, outputRoot }),
    (error: Error) =>
      error.message.includes("DIAGRAM_OUT_OF_DATE chord-c-major.svg") &&
      error.message.includes("DIAGRAM_OUT_OF_DATE rhythm-basic-strum.svg"),
  )
  assert.deepEqual(await bytesByName(outputRoot), before)
})

test("check reports a directory at an expected SVG path as out of date", async (t) => {
  const { dataRoot, outputRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  await generateDiagrams({ dataRoot, outputRoot })
  const expectedPath = join(outputRoot, "chord-c-major.svg")
  await rm(expectedPath)
  await mkdir(expectedPath)

  await assert.rejects(
    checkDiagrams({ dataRoot, outputRoot }),
    (error: Error) => error.message === "DIAGRAM_OUT_OF_DATE chord-c-major.svg",
  )
  assert.equal((await lstat(expectedPath)).isDirectory(), true)
})

test("check reports unexpected SVG files without mutating output", async (t) => {
  const { dataRoot, outputRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  await generateDiagrams({ dataRoot, outputRoot })
  await writeFile(join(outputRoot, "unexpected.svg"), "unexpected", "utf8")
  const before = await bytesByName(outputRoot)

  await assert.rejects(
    checkDiagrams({ dataRoot, outputRoot }),
    /DIAGRAM_UNEXPECTED_FILE unexpected\.svg/,
  )
  assert.deepEqual(await bytesByName(outputRoot), before)
})

test("check reports nested unexpected SVGs without mutating the nested tree", async (t) => {
  const { dataRoot, outputRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  await generateDiagrams({ dataRoot, outputRoot })
  const nestedRoot = join(outputRoot, "nested")
  await mkdir(nestedRoot)
  await writeFile(join(nestedRoot, "stale.svg"), "nested stale bytes", "utf8")
  await writeFile(join(nestedRoot, "notes.txt"), "ignored non-SVG bytes", "utf8")
  const beforeRoot = (await readdir(outputRoot)).sort()
  const beforeNested = (await readdir(nestedRoot)).sort()

  await assert.rejects(
    checkDiagrams({ dataRoot, outputRoot }),
    (error: Error) => error.message === "DIAGRAM_UNEXPECTED_FILE nested/stale.svg",
  )
  assert.deepEqual((await readdir(outputRoot)).sort(), beforeRoot)
  assert.deepEqual((await readdir(nestedRoot)).sort(), beforeNested)
  assert.equal(await readFile(join(nestedRoot, "stale.svg"), "utf8"), "nested stale bytes")
  assert.equal(await readFile(join(nestedRoot, "notes.txt"), "utf8"), "ignored non-SVG bytes")
})

test("CLI returns 0 for write/check, 1 for generation errors, and 2 for usage errors", async (t) => {
  const { root, dataRoot } = await makeWorkspace(t)
  await writeData(dataRoot)
  const run = (args: string[]) => spawnSync(tsx, [cli, ...args], { cwd: root, encoding: "utf8" })

  const write = run(["--write"])
  assert.equal(write.status, 0, write.stderr)
  assert.match(write.stdout, /chord-c-major\.svg/)
  assert.equal(run(["--check"]).status, 0)

  await writeFile(join(dataRoot, "chords.yml"), "{}\n", "utf8")
  const generationError = run(["--check"])
  assert.equal(generationError.status, 1)
  assert.match(generationError.stderr, /DIAGRAM_ROOT_ARRAY/)

  for (const args of [[], ["--write", "--check"], ["--write", "--write"], ["--unknown"]]) {
    const usageError = run(args)
    assert.equal(usageError.status, 2, `${args.join(" ")}: ${usageError.stderr}`)
  }
})

test("approved YAML records all ten chord fingerings and barres exactly", async () => {
  const source = await readFile("data/diagrams/chords.yml", "utf8")
  const chords = load(source) as ChordDefinition[]

  assert.deepEqual(
    chords.map(({ id, baseFret, frets, fingers, barres }) => ({
      id,
      baseFret,
      frets,
      fingers,
      barres,
    })),
    [
      {
        id: "c-major",
        baseFret: 1,
        frets: ["x", 3, 2, 0, 1, 0],
        fingers: [null, 3, 2, null, 1, null],
        barres: [],
      },
      {
        id: "g-major",
        baseFret: 1,
        frets: [3, 2, 0, 0, 3, 3],
        fingers: [2, 1, null, null, 3, 4],
        barres: [],
      },
      {
        id: "d-major",
        baseFret: 1,
        frets: ["x", "x", 0, 2, 3, 2],
        fingers: [null, null, null, 1, 3, 2],
        barres: [],
      },
      {
        id: "d-minor",
        baseFret: 1,
        frets: ["x", "x", 0, 2, 3, 1],
        fingers: [null, null, null, 2, 3, 1],
        barres: [],
      },
      {
        id: "a-major",
        baseFret: 1,
        frets: ["x", 0, 2, 2, 2, 0],
        fingers: [null, null, 1, 2, 3, null],
        barres: [],
      },
      {
        id: "a-minor",
        baseFret: 1,
        frets: ["x", 0, 2, 2, 1, 0],
        fingers: [null, null, 2, 3, 1, null],
        barres: [],
      },
      {
        id: "e-major",
        baseFret: 1,
        frets: [0, 2, 2, 1, 0, 0],
        fingers: [null, 2, 3, 1, null, null],
        barres: [],
      },
      {
        id: "e-minor",
        baseFret: 1,
        frets: [0, 2, 2, 0, 0, 0],
        fingers: [null, 2, 3, null, null, null],
        barres: [],
      },
      {
        id: "f-major-simplified",
        baseFret: 1,
        frets: ["x", "x", 3, 2, 1, 1],
        fingers: [null, null, 3, 2, 1, 1],
        barres: [{ fret: 1, fromString: 1, toString: 2, finger: 1 }],
      },
      {
        id: "f-major-barre",
        baseFret: 1,
        frets: [1, 3, 3, 2, 1, 1],
        fingers: [1, 3, 4, 2, 1, 1],
        barres: [{ fret: 1, fromString: 1, toString: 6, finger: 1 }],
      },
    ],
  )
  assert.ok(chords.every(({ title }) => /\p{Script=Han}/u.test(title)))
  assert.equal(chords[8].title, "F 大三和弦简化按法（F/C）")
})

test("approved fretboard records all 24 C-major positions and only three roots", async () => {
  const source = await readFile("data/diagrams/fretboards.yml", "utf8")
  const fretboards = load(source) as FretboardDefinition[]

  assert.deepEqual(fretboards, [
    {
      id: "c-major-scale",
      title: "C 大调 0–5 品指板音位图",
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
    },
  ])
})

test("approved rhythms match the meter/subdivision cell formula and exact teaching cells", async () => {
  const source = await readFile("data/diagrams/rhythms.yml", "utf8")
  const rhythms = load(source) as RhythmDefinition[]

  assert.deepEqual(rhythms, [
    {
      id: "basic-eighth-strum",
      title: "4/4 基础八分音符交替扫弦",
      meter: "4/4",
      subdivision: 8,
      cells: [
        { label: "1", stroke: "down", accent: true },
        { label: "&", stroke: "up", accent: false },
        { label: "2", stroke: "down", accent: false },
        { label: "&", stroke: "up", accent: false },
        { label: "3", stroke: "down", accent: true },
        { label: "&", stroke: "up", accent: false },
        { label: "4", stroke: "down", accent: false },
        { label: "&", stroke: "up", accent: false },
      ],
    },
    {
      id: "four-downstrokes",
      title: "4/4 四拍下扫练习",
      meter: "4/4",
      subdivision: 4,
      cells: [
        { label: "1", stroke: "down", accent: true },
        { label: "2", stroke: "down", accent: false },
        { label: "3", stroke: "down", accent: false },
        { label: "4", stroke: "down", accent: false },
      ],
    },
    {
      id: "six-eight-arpeggio-pulse",
      title: "6/8 分解和弦律动练习",
      meter: "6/8",
      subdivision: 8,
      cells: [
        { label: "1·低音", stroke: "down", accent: true },
        { label: "2·3弦", stroke: "down", accent: false },
        { label: "3·2弦", stroke: "down", accent: false },
        { label: "4·低音", stroke: "down", accent: true },
        { label: "5·3弦", stroke: "down", accent: false },
        { label: "6·2弦", stroke: "down", accent: false },
      ],
    },
  ])
  for (const rhythm of rhythms) {
    const [numerator, denominator] = rhythm.meter.split("/").map(Number)
    assert.equal(rhythm.cells.length, (numerator * rhythm.subdivision) / denominator)
  }
})
