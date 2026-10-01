import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join, resolve } from "node:path"
import { load } from "js-yaml"
import { renderChord } from "./renderChord"
import { renderFretboard } from "./renderFretboard"
import { renderRhythm } from "./renderRhythm"
import { validateChord, validateFretboard, validateRhythm } from "./validateDefinitions"

export interface GenerateDiagramOptions {
  dataRoot: string
  outputRoot: string
}

export interface GeneratedDiagram {
  id: string
  kind: "chord" | "fretboard" | "rhythm"
  file: string
  path: string
}

interface PreparedDiagram extends GeneratedDiagram {
  bytes: string
}

interface Family {
  dataFile: string
  kind: GeneratedDiagram["kind"]
  prefix: string
}

const FAMILIES: readonly Family[] = [
  { dataFile: "chords.yml", kind: "chord", prefix: "chord" },
  { dataFile: "fretboards.yml", kind: "fretboard", prefix: "fretboard" },
  { dataFile: "rhythms.yml", kind: "rhythm", prefix: "rhythm" },
]

function validateAndRender(
  kind: GeneratedDiagram["kind"],
  value: unknown,
): { id: string; bytes: string } {
  switch (kind) {
    case "chord": {
      const definition = validateChord(value)
      return { id: definition.id, bytes: renderChord(definition) }
    }
    case "fretboard": {
      const definition = validateFretboard(value)
      return { id: definition.id, bytes: renderFretboard(definition) }
    }
    case "rhythm": {
      const definition = validateRhythm(value)
      return { id: definition.id, bytes: renderRhythm(definition) }
    }
  }
}

function asNonEmptyArray(value: unknown, family: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`DIAGRAM_ROOT_ARRAY [${family}]: YAML root must be a non-empty array`)
  }
  return value
}

async function prepareDiagrams(options: GenerateDiagramOptions): Promise<PreparedDiagram[]> {
  const roots = await Promise.all(
    FAMILIES.map(async (family) => {
      const source = await readFile(join(options.dataRoot, family.dataFile), "utf8")
      return asNonEmptyArray(load(source), family.dataFile)
    }),
  )
  const ids = new Set<string>()
  const prepared: PreparedDiagram[] = []

  for (let familyIndex = 0; familyIndex < FAMILIES.length; familyIndex += 1) {
    const family = FAMILIES[familyIndex]
    for (const rawDefinition of roots[familyIndex]) {
      const definition = validateAndRender(family.kind, rawDefinition)
      if (ids.has(definition.id)) {
        throw new Error(`DIAGRAM_DUPLICATE_ID [${definition.id}]: ids must be globally unique`)
      }
      ids.add(definition.id)
      const file = `${family.prefix}-${definition.id}.svg`
      prepared.push({
        id: definition.id,
        kind: family.kind,
        file,
        path: join(options.outputRoot, file),
        bytes: definition.bytes,
      })
    }
  }

  return prepared
}

function publicResults(prepared: PreparedDiagram[]): GeneratedDiagram[] {
  return prepared.map(({ bytes: _bytes, ...result }) => result)
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

async function replaceOutput(outputRoot: string, prepared: PreparedDiagram[]): Promise<void> {
  const absoluteOutput = resolve(outputRoot)
  const outputName = basename(absoluteOutput)
  if (outputName.length === 0) {
    throw new Error("DIAGRAM_OUTPUT_ROOT: outputRoot must name a directory")
  }
  const outputParent = dirname(absoluteOutput)
  await mkdir(outputParent, { recursive: true })
  const stagingRoot = await mkdtemp(join(outputParent, `.${outputName}.tmp-`))
  const previousRoot = `${stagingRoot}.previous`
  let previousMoved = false

  try {
    await Promise.all(
      prepared.map((diagram) => writeFile(join(stagingRoot, diagram.file), diagram.bytes, "utf8")),
    )

    try {
      await rename(absoluteOutput, previousRoot)
      previousMoved = true
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        throw error
      }
    }

    try {
      await rename(stagingRoot, absoluteOutput)
    } catch (error) {
      if (previousMoved) {
        try {
          await rename(previousRoot, absoluteOutput)
          previousMoved = false
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], "DIAGRAM_OUTPUT_ROLLBACK_FAILED")
        }
      }
      throw error
    }

    if (previousMoved) {
      await rm(previousRoot, { recursive: true, force: true })
      previousMoved = false
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true })
  }
}

export async function generateDiagrams(
  options: GenerateDiagramOptions,
): Promise<GeneratedDiagram[]> {
  const prepared = await prepareDiagrams(options)
  await replaceOutput(options.outputRoot, prepared)
  return publicResults(prepared)
}

export async function checkDiagrams(options: GenerateDiagramOptions): Promise<GeneratedDiagram[]> {
  const prepared = await prepareDiagrams(options)
  const expectedNames = new Set(prepared.map(({ file }) => file))
  let actualNames: string[] = []
  try {
    actualNames = (await readdir(options.outputRoot)).filter(
      (name) => extname(name).toLocaleLowerCase("en-US") === ".svg",
    )
  } catch (error) {
    if (errorCode(error) !== "ENOENT") {
      throw error
    }
  }

  const diagnostics: string[] = []
  for (const diagram of prepared) {
    let actual: string | undefined
    try {
      actual = await readFile(diagram.path, "utf8")
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        throw error
      }
    }
    if (actual !== diagram.bytes) {
      diagnostics.push(`DIAGRAM_OUT_OF_DATE ${diagram.file}`)
    }
  }
  for (const name of actualNames.sort()) {
    if (!expectedNames.has(name)) {
      diagnostics.push(`DIAGRAM_UNEXPECTED_FILE ${name}`)
    }
  }

  if (diagnostics.length > 0) {
    throw new Error(diagnostics.join("\n"))
  }
  return publicResults(prepared)
}
