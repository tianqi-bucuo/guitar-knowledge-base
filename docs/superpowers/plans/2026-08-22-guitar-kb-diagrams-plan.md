# 民谣吉他知识库 SVG 图示系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用经过校验的结构化数据生成风格一致、可离线、带无障碍标题的和弦图、指板图与节奏示意图，并把生成过程接入知识库验证命令。

**Architecture:** YAML 文件只描述音乐数据，纯 TypeScript 渲染函数把已校验对象转换为确定性 SVG 字符串。CLI 负责读取数据、原子写入 `content/assets/diagrams/` 并报告生成清单；快照测试锁定弦序、品位、符号、文字和 SVG 结构。

**Tech Stack:** Node.js 22+、TypeScript、tsx test runner、js-yaml、原生 SVG

**Spec:** `docs/superpowers/specs/2026-08-22-guitar-knowledge-base-design.md`

## Global Constraints

- 先完成 `2026-08-22-guitar-kb-foundation-plan.md`，并保持 `npm run verify` 通过。
- Quartz 固定为 4.5.2；不得引入图形框架、Canvas、浏览器截图或新的运行时依赖。
- 生成后的 SVG 必须提交到 `content/assets/diagrams/`，使 Obsidian 离线可见。
- 结构化数据是图示事实来源；不得手改已生成 SVG。
- SVG 必须包含非空 `<title>`，不能只依赖颜色传达按弦、根音、重音或休止。
- 和弦数据中的弦顺序固定为六弦到一弦，即低音 E 到高音 e。
- 所有生成器必须确定性输出；相同输入在不同运行中不得产生时间戳、随机 id 或属性乱序。

---

## File Map

- Create: `data/diagrams/chords.yml`, `data/diagrams/fretboards.yml`, `data/diagrams/rhythms.yml`
- Create: `scripts/diagrams/types.ts`, `scripts/diagrams/validateDefinitions.ts`, `scripts/diagrams/svg.ts`, `scripts/diagrams/renderChord.ts`, `scripts/diagrams/renderFretboard.ts`, `scripts/diagrams/renderRhythm.ts`, `scripts/diagrams/generateDiagrams.ts`
- Create: `scripts/generate-diagrams.ts`
- Create: `tests/diagrams/definitions.test.ts`, `tests/diagrams/chord.test.ts`, `tests/diagrams/fretboard.test.ts`, `tests/diagrams/rhythm.test.ts`, `tests/diagrams/generator.test.ts`
- Create: `tests/diagrams/__snapshots__/c-major.svg`, `tests/diagrams/__snapshots__/c-major-scale.svg`, `tests/diagrams/__snapshots__/basic-strum.svg`
- Create: `content/assets/diagrams/*.svg`
- Modify: `package.json`, `scripts/content/validateLinks.ts`, seed content pages that demonstrate the three diagram families

### Task 1: Define and validate diagram data contracts

**Files:**
- Create: `scripts/diagrams/types.ts`
- Create: `scripts/diagrams/validateDefinitions.ts`
- Create: `tests/diagrams/definitions.test.ts`

**Interfaces:**
- Consumes: unknown YAML values
- Produces: `ChordDefinition`, `FretboardDefinition`, `RhythmDefinition`; validation functions that return typed values or throw stable coded errors

- [ ] **Step 1: Write failing contract tests**

Create tests for a valid C chord and three invalid cases:

```ts
const cMajor = {
  id: "c-major",
  title: "C 大三和弦",
  baseFret: 1,
  frets: ["x", 3, 2, 0, 1, 0],
  fingers: [null, 3, 2, null, 1, null],
  barres: [],
}

assert.equal(validateChord(cMajor).id, "c-major")
assert.throws(() => validateChord({ ...cMajor, frets: [0, 1] }), /CHORD_STRING_COUNT/)
assert.throws(() => validateChord({ ...cMajor, fingers: [null, 5, 2, null, 1, null] }), /CHORD_FINGER_RANGE/)
assert.throws(() => validateFretboard({ startFret: 5, endFret: 3 }), /FRETBOARD_RANGE/)
```

Add a rhythm test rejecting a `6/8` pattern whose cell count does not match its declared subdivisions.

- [ ] **Step 2: Run tests and confirm the missing-module failure**

Run:

```bash
npx tsx --test tests/diagrams/definitions.test.ts
```

Expected: FAIL because the diagram type and validation modules do not exist.

- [ ] **Step 3: Define exact data types**

Create `scripts/diagrams/types.ts`:

```ts
export type StringState = number | "x"
export type Finger = 1 | 2 | 3 | 4 | null

export interface Barre {
  fret: number
  fromString: 1 | 2 | 3 | 4 | 5 | 6
  toString: 1 | 2 | 3 | 4 | 5 | 6
  finger: 1 | 2 | 3 | 4
}

export interface ChordDefinition {
  id: string
  title: string
  baseFret: number
  frets: [StringState, StringState, StringState, StringState, StringState, StringState]
  fingers: [Finger, Finger, Finger, Finger, Finger, Finger]
  barres: Barre[]
}

export interface FretPosition {
  string: 1 | 2 | 3 | 4 | 5 | 6
  fret: number
  label: string
  role: "root" | "tone"
}

export interface FretboardDefinition {
  id: string
  title: string
  startFret: number
  endFret: number
  positions: FretPosition[]
}

export interface RhythmCell {
  label: string
  stroke: "down" | "up" | "rest" | "mute"
  accent: boolean
}

export interface RhythmDefinition {
  id: string
  title: string
  meter: "3/4" | "4/4" | "6/8"
  subdivision: 8 | 16
  cells: RhythmCell[]
}
```

- [ ] **Step 4: Implement coded validators**

Export these functions from `validateDefinitions.ts`:

```ts
export function validateChord(value: unknown): ChordDefinition
export function validateFretboard(value: unknown): FretboardDefinition
export function validateRhythm(value: unknown): RhythmDefinition
```

Validate ids as lowercase kebab-case, positive fret ranges, exact six-element tuples, finger/fret agreement, barre string order, unique fretboard positions, supported meters, and non-empty human labels. Throw errors with stable prefixes such as `CHORD_STRING_COUNT` and include the diagram id when available.

- [ ] **Step 5: Run contract tests and repository checks**

Run:

```bash
npx tsx --test tests/diagrams/definitions.test.ts
npm run check
```

Expected: both exit 0.

- [ ] **Step 6: Commit data contracts**

```bash
git add scripts/diagrams tests/diagrams
git commit -m "feat: define guitar diagram data contracts"
```

### Task 2: Implement shared SVG primitives and chord rendering

**Files:**
- Create: `scripts/diagrams/svg.ts`
- Create: `scripts/diagrams/renderChord.ts`
- Create: `tests/diagrams/chord.test.ts`
- Create: `tests/diagrams/__snapshots__/c-major.svg`

**Interfaces:**
- Consumes: validated `ChordDefinition`
- Produces: `escapeXml(value: string): string`; `renderChord(definition: ChordDefinition): string`

- [ ] **Step 1: Write chord rendering tests before implementation**

Use the C definition from Task 1 and assert:

```ts
const svg = renderChord(cMajor)
assert.match(svg, /^<svg[^>]+viewBox="0 0 240 320"/)
assert.match(svg, /<title>C 大三和弦<\/title>/)
assert.equal((svg.match(/data-string=/g) ?? []).length, 6)
assert.match(svg, /data-state="muted"/)
assert.match(svg, /data-state="open"/)
assert.equal(svg.trim(), readFileSync(snapshotPath, "utf8").trim())
```

Add an escaping test using a title containing `&` and `<`.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx tsx --test tests/diagrams/chord.test.ts
```

Expected: FAIL because `renderChord` is missing.

- [ ] **Step 3: Implement deterministic XML helpers**

`svg.ts` must export `escapeXml`, numeric formatting without locale dependence, and a `wrapSvg({ title, width, height, body })` helper that always emits attributes in the same order. Use a fixed `viewBox`; do not emit XML timestamps or generated ids.

- [ ] **Step 4: Implement the chord diagram geometry**

Use `viewBox="0 0 240 320"`, six vertical string lines, five visible fret spaces, a thicker nut when `baseFret === 1`, explicit `O` and `×` text above open/muted strings, numbered finger circles, and a labeled barre. Add `data-string`, `data-fret`, and `data-state` attributes so tests and assistive descriptions can identify marks.

- [ ] **Step 5: Generate and inspect the first approved snapshot**

Run the focused test once to capture the actual output shown in the assertion failure, save that exact reviewed SVG as `tests/diagrams/__snapshots__/c-major.svg`, then rerun:

```bash
npx tsx --test tests/diagrams/chord.test.ts
```

Expected: PASS after the snapshot is deliberately reviewed for six-to-one string order and correct C fingering `x-3-2-0-1-0`.

- [ ] **Step 6: Commit the chord renderer**

```bash
git add scripts/diagrams tests/diagrams
git commit -m "feat: render accessible chord diagrams"
```

### Task 3: Implement fretboard and rhythm rendering

**Files:**
- Create: `scripts/diagrams/renderFretboard.ts`
- Create: `scripts/diagrams/renderRhythm.ts`
- Create: `tests/diagrams/fretboard.test.ts`
- Create: `tests/diagrams/rhythm.test.ts`
- Create: `tests/diagrams/__snapshots__/c-major-scale.svg`
- Create: `tests/diagrams/__snapshots__/basic-strum.svg`

**Interfaces:**
- Consumes: validated `FretboardDefinition` and `RhythmDefinition`
- Produces: `renderFretboard(definition: FretboardDefinition): string`; `renderRhythm(definition: RhythmDefinition): string`

- [ ] **Step 1: Write failing fretboard tests**

Define C major notes from open position through fret 5. Assert the SVG has six string lines, the expected fret numbers, separate `data-role="root"` and `data-role="tone"` markers, a non-empty title, and exact snapshot equality.

- [ ] **Step 2: Write failing rhythm tests**

Define an eighth-note `4/4` pattern with labels `1 & 2 & 3 & 4 &` and strokes `down, rest, down, up, rest, up, down, up`. Assert eight cells, Unicode down/up arrows, explicit rest and mute symbols, text labels for accents, and exact snapshot equality.

- [ ] **Step 3: Verify both test files fail**

Run:

```bash
npx tsx --test tests/diagrams/fretboard.test.ts tests/diagrams/rhythm.test.ts
```

Expected: FAIL because both renderers are absent.

- [ ] **Step 4: Implement fretboard rendering**

Use a horizontal `viewBox="0 0 720 220"`. Render fret numbers and six strings; root notes use both a thicker outline and label `根音`, while other tones use a thinner outline and note label. Every note marker must include `data-string`, `data-fret`, `data-label`, and `data-role`.

- [ ] **Step 5: Implement rhythm rendering**

Use one fixed-width cell per subdivision. Display beat labels above and the symbols `↓`, `↑`, `—`, `×` below. Accents must use both a `>` text mark and heavier stroke weight. Include meter and subdivision in a text description inside the SVG.

- [ ] **Step 6: Review and save deterministic snapshots**

Save the exact reviewed outputs to the two snapshot files, then run:

```bash
npx tsx --test tests/diagrams/fretboard.test.ts tests/diagrams/rhythm.test.ts
npm test
```

Expected: all tests exit 0.

- [ ] **Step 7: Commit both renderers**

```bash
git add scripts/diagrams tests/diagrams
git commit -m "feat: render fretboard and rhythm diagrams"
```

### Task 4: Generate diagrams from YAML and integrate them with content checks

**Files:**
- Create: `data/diagrams/chords.yml`
- Create: `data/diagrams/fretboards.yml`
- Create: `data/diagrams/rhythms.yml`
- Create: `scripts/diagrams/generateDiagrams.ts`
- Create: `scripts/generate-diagrams.ts`
- Create: `tests/diagrams/generator.test.ts`
- Create: `content/assets/diagrams/*.svg`
- Modify: `content/00-从这里开始/学习路线总览.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: YAML arrays of diagram definitions and the three render functions
- Produces: `generateDiagrams(options: GenerateDiagramOptions): Promise<GeneratedDiagram[]>`; `npm run diagrams:generate`; `npm run diagrams:check`

- [ ] **Step 1: Write failing generator tests**

In a temporary directory, write one YAML item from each family and assert:

```ts
const generated = await generateDiagrams({ dataRoot, outputRoot })
assert.deepEqual(generated.map((item) => item.file), [
  "chord-c-major.svg",
  "fretboard-c-major-scale.svg",
  "rhythm-basic-strum.svg",
])
assert.equal(await readFile(generated[0].path, "utf8"), renderChord(cMajor))
```

Run the generator twice and assert the second run produces byte-identical files.

- [ ] **Step 2: Verify the generator test fails**

Run:

```bash
npx tsx --test tests/diagrams/generator.test.ts
```

Expected: FAIL because `generateDiagrams` is missing.

- [ ] **Step 3: Implement safe generation**

Load all three YAML files, validate every definition before writing, reject duplicate ids across families, write to temporary sibling files and rename only after all inputs validate. Export these exact interfaces:

```ts
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

export async function generateDiagrams(
  options: GenerateDiagramOptions,
): Promise<GeneratedDiagram[]>
```

- [ ] **Step 4: Seed the approved data sets**

Add chord definitions for C, G, D, Dm, A, Am, E, Em, F simplified and F barre. Add one open-position C-major fretboard and three rhythm patterns: basic eighth-note strum, four-beat down strum, and `6/8` arpeggio pulse. Each title must be Chinese and each fingering must be independently checked before acceptance.

- [ ] **Step 5: Add generator commands**

Add scripts:

```json
{
  "diagrams:generate": "tsx scripts/generate-diagrams.ts --write",
  "diagrams:check": "tsx scripts/generate-diagrams.ts --check"
}
```

`--check` regenerates in memory and fails with `DIAGRAM_OUT_OF_DATE {file}` when a committed SVG differs or is missing. Insert `npm run diagrams:check` into `verify` before the Quartz build.

- [ ] **Step 6: Generate committed SVGs and embed representative examples**

Run:

```bash
npm run diagrams:generate
```

Embed one chord, fretboard and rhythm SVG in `学习路线总览.md`, each with meaningful Markdown alt text. Do not embed test snapshots.

- [ ] **Step 7: Run the full diagram phase checkpoint**

Run:

```bash
npm run diagrams:check
npm run verify
git status --short
```

Expected: both commands exit 0; status lists only intended YAML, SVG, generator, test, package and seed-page changes.

- [ ] **Step 8: Commit and confirm a clean phase**

```bash
git add data/diagrams scripts/diagrams scripts/generate-diagrams.ts tests/diagrams content/assets/diagrams content/00-从这里开始/学习路线总览.md package.json
git commit -m "feat: generate guitar teaching diagrams"
npm run verify
git status --short --branch
```

Expected: verification exits 0 and working tree is clean. Continue only to the content plan.
