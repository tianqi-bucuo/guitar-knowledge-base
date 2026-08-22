# 民谣吉他知识库 75 篇正文建设 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 研究、撰写、引用并交叉链接 75 篇简体中文民谣吉他页面，使学习路线与主题百科共用同一批完整内容。

**Architecture:** `data/content-manifest.yml` 先固定全部页面及模块配额，正文再按学习依赖顺序分五批完成。每批使用统一模板、权威来源、自制练习和已生成 SVG，通过创作模式校验和 Quartz 构建后独立提交；最后一批完成后发布模式必须通过。

**Tech Stack:** Markdown、Obsidian 风格 wikilinks、Quartz 4.5.2、YAML manifest、SVG 图示、TypeScript 内容校验 CLI

**Spec:** `docs/superpowers/specs/2026-08-22-guitar-knowledge-base-design.md`

## Global Constraints

- 先完成基础平台计划和 SVG 图示计划；开始前 `npm run verify` 与 `npm run diagrams:check` 必须通过。
- 正式 Markdown 页面必须恰好为本计划定义的 75 篇；包含路线和索引，不含模板、README、附件或设计文档。
- 正文使用简体中文和国际记法；弦序描述必须明确低音六弦到高音一弦。
- 教学页正文目标为 900–1,800 个中文字符；索引、清单和术语页可以为 500–1,200 个中文字符。字数只用于防止空洞页面，不鼓励填充重复内容。
- 每篇教学页必须有八个规定章节、至少一项分级练习、可观察的自检标准、下一步链接和至少一个权威来源。
- 关键事实通过脚注记录来源标题、机构或作者、链接和访问日期；来源优先采用官方教学机构、正规音乐教育资源、制造商技术支持和医疗机构。
- 不能复制受版权保护的完整歌词、完整曲谱、完整编曲或教材大段内容。曲目应用统一使用原创四小节练习并标注“原创练习”。
- 所有外部资料只用于核实和改写，不把网页原文拼接进正文。
- 每批完成后必须运行 `npm run check:content`、`npm run diagrams:check` 和 `npm run build:site`。

---

## Shared Article Contract

每个 `type: lesson` 页面使用以下章节，标题文字保持一致以便自动检查：

```markdown
## 学习目标与先修知识
## 核心概念
## 图示与操作步骤
## 常见错误及修正
## 分级练习
## 自我检查标准
## 下一步与相关词条
## 参考来源与延伸阅读
```

所有页面 frontmatter 至少包含：

```yaml
---
title: 页面中文标题
description: 一句话说明读者能学到什么
permalink: /stable/english-path
type: lesson
level: 入门
prerequisites:
  - 先修页面中文标题
tags:
  - 受控标签
draft: true
---
```

完成正文、链接、图示和来源检查后才把 `draft` 改为 `false`。

页面脚注来源统一使用这一可解析格式：

```markdown
[^source-id]: [来源标题](https://example.org/source) — 发布机构或作者；访问日期：2026-08-22。
```

其中 `source-id` 在单个页面内唯一，访问日期使用实际查阅日期。正文中的关键结论通过 `[^source-id]` 引用。

## File Map

- Modify: `data/content-manifest.yml`
- Create: `content/templates/教学文章模板.md`, `content/templates/路线页模板.md`, `content/templates/索引页模板.md`
- Create/Modify: `content/00-从这里开始/*.md` through `content/09-术语与参考资料/*.md`
- Modify: `data/diagrams/*.yml` and `content/assets/diagrams/*.svg` only when an approved page requires a missing diagram
- Create: `tests/content/inventory.test.ts`

### Task 1: Lock the 75-page inventory and authoring templates

**Files:**
- Modify: `data/content-manifest.yml`
- Create: `content/templates/教学文章模板.md`
- Create: `content/templates/路线页模板.md`
- Create: `content/templates/索引页模板.md`
- Create: `tests/content/inventory.test.ts`

**Interfaces:**
- Consumes: `Manifest` and `loadManifest` from the foundation plan
- Produces: the authoritative 75-entry manifest and three non-published authoring templates

- [ ] **Step 1: Write the failing inventory test**

Create `tests/content/inventory.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import { loadManifest } from "../../scripts/content/loadManifest"

test("locks the approved 75-page distribution", () => {
  const manifest = loadManifest("data/content-manifest.yml")
  assert.equal(manifest.pages.length, 75)
  assert.deepEqual(
    Object.fromEntries(manifest.modules.map((module) => [module.id, module.target])),
    { start: 5, basics: 8, chords: 12, rhythm: 10, technique: 8,
      accompaniment: 8, theory: 8, practice: 6, care: 5, reference: 5 },
  )
})
```

Also assert 75 unique ids/titles/files/permalinks and all ten directories. Prerequisite order belongs to page frontmatter and is validated after pages exist by the release plan’s learning-graph task.

- [ ] **Step 2: Run the test and observe the expected count failure**

Run:

```bash
npx tsx --test tests/content/inventory.test.ts
```

Expected: FAIL because the foundation manifest contains only seed entries.

- [ ] **Step 3: Replace the seed manifest with this exact inventory**

Add the following pages with unique kebab-case ids, the shown files and permalinks, and `required: true`. Type rules are exact: root home and `如何使用知识库` are `index`; `学习路线总览` and `开始前自测` are `path`; `吉他术语表` is `glossary`; the four other reference pages are `index`; every remaining page is `lesson`.

| 模块 | 文件（`.md`） | permalink |
|---|---|---|
| start | `index`（仓库 `content/index.md`） | `/` |
| start | `如何使用知识库` | `/start/how-to-use` |
| start | `学习路线总览` | `/start/learning-path` |
| start | `开始前自测` | `/start/readiness-check` |
| start | `吉他调音与标准音` | `/start/tuning` |
| basics | `认识民谣吉他` | `/basics/guitar-anatomy` |
| basics | `坐姿与站姿` | `/basics/posture` |
| basics | `左手拇指与手腕` | `/basics/fretting-hand` |
| basics | `右手位置与发力` | `/basics/picking-hand` |
| basics | `正确按弦` | `/basics/fretting` |
| basics | `拨片握法与上下拨` | `/basics/using-a-pick` |
| basics | `空弦与单音练习` | `/basics/open-strings` |
| basics | `相邻弦与跨弦` | `/basics/string-crossing` |
| chords | `和弦图读法` | `/chords/reading-diagrams` |
| chords | `Em与E和弦` | `/chords/em-and-e` |
| chords | `Am与A和弦` | `/chords/am-and-a` |
| chords | `C和弦` | `/chords/c-major` |
| chords | `G和弦` | `/chords/g-major` |
| chords | `D与Dm和弦` | `/chords/d-and-dm` |
| chords | `常用七和弦` | `/chords/common-sevenths` |
| chords | `和弦转换方法` | `/chords/changing-chords` |
| chords | `C-G-Am-Em和弦进行` | `/chords/c-g-am-em` |
| chords | `C-Am-F-G和弦进行` | `/chords/c-am-f-g` |
| chords | `F简化指法与横按准备` | `/chords/f-preparation` |
| chords | `F大横按与移动和弦` | `/chords/barre-and-movable` |
| rhythm | `节拍拍号与小节` | `/rhythm/beat-meter-bar` |
| rhythm | `第一次使用节拍器` | `/rhythm/metronome-basics` |
| rhythm | `四分八分与十六分音符` | `/rhythm/note-values` |
| rhythm | `放松而稳定的扫弦动作` | `/rhythm/strumming-motion` |
| rhythm | `四拍全下扫` | `/rhythm/four-downstrokes` |
| rhythm | `基础八分音符扫弦` | `/rhythm/eighth-note-strum` |
| rhythm | `重音与强弱层次` | `/rhythm/accents` |
| rhythm | `切分节奏入门` | `/rhythm/syncopation` |
| rhythm | `三拍子伴奏` | `/rhythm/three-four` |
| rhythm | `六八拍伴奏` | `/rhythm/six-eight` |
| technique | `分解和弦基础` | `/technique/arpeggio-basics` |
| technique | `常用分解和弦型` | `/technique/arpeggio-patterns` |
| technique | `交替低音` | `/technique/alternating-bass` |
| technique | `左手制音` | `/technique/fretting-mute` |
| technique | `右手制音` | `/technique/palm-mute` |
| technique | `击弦与勾弦` | `/technique/hammer-pull` |
| technique | `滑音` | `/technique/slide` |
| technique | `自然泛音与打板` | `/technique/harmonics-percussion` |
| accompaniment | `根据人声选择调` | `/accompaniment/choose-key` |
| accompaniment | `变调夹原理与用法` | `/accompaniment/capo` |
| accompaniment | `和弦级数与移调` | `/accompaniment/transposition` |
| accompaniment | `听辨歌曲结构` | `/accompaniment/song-form` |
| accompaniment | `主歌与副歌的伴奏对比` | `/accompaniment/verse-chorus` |
| accompaniment | `前奏间奏与尾奏` | `/accompaniment/intro-bridge-ending` |
| accompaniment | `弹唱协调训练` | `/accompaniment/sing-and-play` |
| accompaniment | `完整歌曲编配流程` | `/accompaniment/arrangement-workflow` |
| theory | `音高音名与唱名` | `/theory/pitch-note-solfege` |
| theory | `指板上的音名` | `/theory/fretboard-notes` |
| theory | `全音与半音` | `/theory/whole-half-step` |
| theory | `音程入门` | `/theory/intervals` |
| theory | `大调音阶` | `/theory/major-scale` |
| theory | `调与调号` | `/theory/keys-signatures` |
| theory | `三和弦构成` | `/theory/triads` |
| theory | `顺阶和弦与级数` | `/theory/diatonic-chords` |
| practice | `有效练习流程` | `/practice/effective-session` |
| practice | `节拍器进阶用法` | `/practice/metronome-progressions` |
| practice | `慢练与逐级提速` | `/practice/slow-to-fast` |
| practice | `练习日志模板` | `/practice/log-template` |
| practice | `错误诊断与修正` | `/practice/error-diagnosis` |
| practice | `阶段测验` | `/practice/stage-assessment` |
| care | `疼痛疲劳与停止练习边界` | `/care/pain-fatigue` |
| care | `闷音与杂音排查` | `/care/buzz-muted-notes` |
| care | `更换琴弦` | `/care/change-strings` |
| care | `弦距琴颈与品丝基础` | `/care/action-neck-frets` |
| care | `清洁湿度与存放` | `/care/cleaning-humidity-storage` |
| reference | `吉他术语表` | `/reference/glossary` |
| reference | `和弦索引` | `/reference/chords` |
| reference | `节奏型索引` | `/reference/rhythms` |
| reference | `常见问题索引` | `/reference/faq` |
| reference | `参考来源总表` | `/reference/sources` |

- [ ] **Step 4: Create complete authoring templates**

The lesson template contains the shared frontmatter and all eight headings, each followed by an HTML comment that explains what belongs there. Because Quartz ignores `templates/`, these instructional comments never publish. Path and index templates contain their own explicit required sections: audience, navigation method, ordered links, completion criteria, and update policy.

- [ ] **Step 5: Run manifest and author-mode checks**

Run:

```bash
npx tsx --test tests/content/inventory.test.ts
npm run check:content
npm run check:release
```

Expected: inventory PASS; author mode exits 0 with missing planned pages as warnings; release mode exits 1 with required-page diagnostics.

- [ ] **Step 6: Commit the locked inventory**

```bash
git add data/content-manifest.yml content/templates tests/content/inventory.test.ts
git commit -m "docs: lock 75-page curriculum inventory"
```

### Task 2: Author “从这里开始” and “持琴与基础动作” (13 pages)

**Files:**
- Modify: `content/index.md`
- Create/Modify: all four manifest files under `content/00-从这里开始/`
- Create: all eight files under `content/01-持琴与基础动作/`

**Interfaces:**
- Consumes: approved templates, manifest entries, content validators, diagram assets
- Produces: a complete entry path through tuning, posture, fretting and single-note control; prerequisites used by the chord module

- [ ] **Step 1: Build a source matrix before drafting**

Record primary/authoritative sources for standard tuning, instrument anatomy, posture, pick use and general practice safety. Use manufacturer technical documentation for hardware facts, established music-education sources for technique, and medical/health institutions only for safety boundaries. Store citations directly in the pages they support and add each source to `参考来源总表` only when that page is authored in Task 6.

- [ ] **Step 2: Complete the five start pages**

Complete `content/index.md`, `如何使用知识库`, `学习路线总览`, `开始前自测`, and `吉他调音与标准音`. The home page gives the two entry points—按路线学习 and 按主题查阅. The route must link all ten modules but not duplicate lesson bodies. The self-test produces a recommendation, not a score implying certification. Tuning must state E2–A2–D3–G3–B3–E4 from sixth to first string and cite an authoritative source.

- [ ] **Step 3: Complete the four body-position pages**

Write `认识民谣吉他`, `坐姿与站姿`, `左手拇指与手腕`, and `右手位置与发力`. Distinguish comfort guidance from medical advice. Include observable checks such as shoulder relaxation, wrist angle range described without false precision, and whether the instrument remains stable when either hand briefly relaxes.

- [ ] **Step 4: Complete the four first-control pages**

Write `正确按弦`, `拨片握法与上下拨`, `空弦与单音练习`, and `相邻弦与跨弦`. Each page has a beginner, consolidation and challenge exercise; use metronome ranges only when the movement is first correct without tempo pressure.

- [ ] **Step 5: Cross-link and validate the entry path**

Every prerequisite must point backward. Each page links one next page and at least two related pages where meaningful. Run:

```bash
npm run check:content
npm run diagrams:check
npm run build:site
```

Expected: all exit 0; release mode still fails only for later missing pages.

- [ ] **Step 6: Commit the entry curriculum**

```bash
git add content/index.md content/00-从这里开始 content/01-持琴与基础动作
git commit -m "docs: add beginner guitar foundations"
```

### Task 3: Author “和弦系统” and “节奏系统” (22 pages)

**Files:**
- Create: all twelve files under `content/02-和弦系统/`
- Create: all ten files under `content/03-节奏系统/`
- Modify: `data/diagrams/chords.yml`, `data/diagrams/rhythms.yml` only if the existing approved set lacks a required example
- Modify: generated SVGs corresponding to changed diagram data

**Interfaces:**
- Consumes: fretting/pick prerequisites and SVG generators
- Produces: the complete open-chord, barre, chord-change and core strumming vocabulary used by later accompaniment pages

- [ ] **Step 1: Research and verify fingering and rhythm facts**

Create a source matrix covering chord-diagram conventions, common open-chord fingerings, metre, note values, syncopation and metronome practice. Verify every six-string fingering against at least two reliable references or one authoritative chord reference plus direct pitch calculation.

- [ ] **Step 2: Write the six chord-reading and fingering pages**

Complete `和弦图读法`, `Em与E和弦`, `Am与A和弦`, `C和弦`, `G和弦`, and `D与Dm和弦`. Embed the matching SVG and repeat the fingering in accessible text such as `x-3-2-0-1-0`; explain that the sequence is sixth to first string.

- [ ] **Step 3: Write the six chord-application pages**

Complete `常用七和弦`, `和弦转换方法`, both named chord progressions, `F简化指法与横按准备`, and `F大横按与移动和弦`. Use only original progressions and practice loops; no song lyrics or copied arrangements. Horizontal pressure advice must emphasize minimum effective force and rest on pain.

- [ ] **Step 4: Write the first five rhythm pages**

Complete `节拍拍号与小节`, `第一次使用节拍器`, `四分八分与十六分音符`, `放松而稳定的扫弦动作`, and `四拍全下扫`. Every rhythm pattern must show spoken counts as text in addition to arrows.

- [ ] **Step 5: Write the remaining five rhythm pages**

Complete `基础八分音符扫弦`, `重音与强弱层次`, `切分节奏入门`, `三拍子伴奏`, and `六八拍伴奏`. Explain `3/4` versus `6/8` by beat grouping and felt pulse, not only by the two numbers in the time signature.

- [ ] **Step 6: Regenerate diagrams and run the module checkpoint**

Run:

```bash
npm run diagrams:generate
npm run diagrams:check
npm run check:content
npm run build:site
```

Expected: all exit 0; every page’s fingering text agrees with its SVG data.

- [ ] **Step 7: Commit chords and rhythm**

```bash
git add content/02-和弦系统 content/03-节奏系统 data/diagrams content/assets/diagrams
git commit -m "docs: add chords and rhythm curriculum"
```

### Task 4: Author “演奏技巧” and “弹唱与伴奏” (16 pages)

**Files:**
- Create: all eight files under `content/04-演奏技巧/`
- Create: all eight files under `content/05-弹唱与伴奏/`

**Interfaces:**
- Consumes: chord and rhythm vocabulary
- Produces: reusable technique references and an original-song arrangement workflow

- [ ] **Step 1: Build the technique and accompaniment source matrix**

Research terminology and safe execution for arpeggios, muting, slurs, slides, harmonics, capo use, transposition and song form. Treat manufacturer capo instructions as hardware guidance, not a source for all theory claims.

- [ ] **Step 2: Write the four picking and muting pages**

Complete `分解和弦基础`, `常用分解和弦型`, `交替低音`, and `左手制音`. Each pattern includes string numbers, count syllables and a slow-to-target practice ladder.

- [ ] **Step 3: Write the four articulation pages**

Complete `右手制音`, `击弦与勾弦`, `滑音`, and `自然泛音与打板`. Separate optional percussive effects from core timing skills and include stop conditions for discomfort.

- [ ] **Step 4: Write the four key/form pages**

Complete `根据人声选择调`, `变调夹原理与用法`, `和弦级数与移调`, and `听辨歌曲结构`. Use a single original eight-bar exercise to demonstrate transposition without invoking a protected song.

- [ ] **Step 5: Write the four arrangement pages**

Complete `主歌与副歌的伴奏对比`, `前奏间奏与尾奏`, `弹唱协调训练`, and `完整歌曲编配流程`. The final workflow must link back to key choice, rhythm, dynamics and practice logging rather than repeat those articles.

- [ ] **Step 6: Run checks and commit**

```bash
npm run check:content
npm run diagrams:check
npm run build:site
git add content/04-演奏技巧 content/05-弹唱与伴奏
git commit -m "docs: add technique and accompaniment curriculum"
```

Expected: checks and build exit 0 before commit.

### Task 5: Author “基础乐理与指板” and “练习与复盘” (14 pages)

**Files:**
- Create: all eight files under `content/06-基础乐理与指板/`
- Create: all six files under `content/07-练习与复盘/`
- Modify: fretboard diagram YAML and generated SVGs when needed

**Interfaces:**
- Consumes: practical chord and accompaniment examples
- Produces: theory explanations connected to played examples, plus measurable practice and assessment tools

- [ ] **Step 1: Verify music-theory definitions**

Use established theory/education sources to verify pitch naming, semitones, interval naming, major-scale formula, triad construction and diatonic chord qualities. Keep notation consistent: use C–D–E for pitch names and do–re–mi only when explicitly explaining solfège.

- [ ] **Step 2: Write the four note-system pages**

Complete `音高音名与唱名`, `指板上的音名`, `全音与半音`, and `音程入门`. Use keyboard-like linear examples only as secondary explanation; guitar string/fret examples remain primary.

- [ ] **Step 3: Write the four tonal-system pages**

Complete `大调音阶`, `调与调号`, `三和弦构成`, and `顺阶和弦与级数`. Connect Roman/Arabic scale degrees to the chord-progressions already taught; do not introduce modes, secondary dominants or advanced harmony.

- [ ] **Step 4: Write the six practice pages**

Complete `有效练习流程`, `节拍器进阶用法`, `慢练与逐级提速`, `练习日志模板`, `错误诊断与修正`, and `阶段测验`. The log template must be directly copyable and contain date, goal, starting tempo, clean tempo, observed error, correction and next session fields.

- [ ] **Step 5: Regenerate any fretboard assets and validate**

Run:

```bash
npm run diagrams:generate
npm run diagrams:check
npm run check:content
npm run build:site
```

Expected: all exit 0; theory terminology is identical across all fourteen pages.

- [ ] **Step 6: Commit theory and practice**

```bash
git add content/06-基础乐理与指板 content/07-练习与复盘 data/diagrams content/assets/diagrams
git commit -m "docs: add theory and practice curriculum"
```

### Task 6: Author care, safety, troubleshooting, and reference pages (10 pages)

**Files:**
- Create: all five files under `content/08-保养安全与排错/`
- Create: all five files under `content/09-术语与参考资料/`
- Modify: all existing pages that need final backlinks to indexes

**Interfaces:**
- Consumes: all 65 earlier pages, their tags, aliases, sources and diagram ids
- Produces: the final ten pages, complete indexes, source catalog and a release-mode-valid 75-page content set

- [ ] **Step 1: Research safety and maintenance from the specified authority classes**

Use medical/health institutions for pain, numbness and stop-practice guidance; use guitar manufacturers or qualified repair resources for strings, humidity, action and neck explanations. Clearly separate user-safe observation/cleaning/string changes from adjustments that should be referred to a technician.

- [ ] **Step 2: Write the five care and troubleshooting pages**

Complete `疼痛疲劳与停止练习边界`, `闷音与杂音排查`, `更换琴弦`, `弦距琴颈与品丝基础`, and `清洁湿度与存放`. Do not prescribe treatment. Each troubleshooting page uses a reversible, least-invasive-first decision order.

- [ ] **Step 3: Build the glossary and three navigational indexes**

`吉他术语表` defines every specialized Chinese term used by at least two pages and gives the common English term where helpful. `和弦索引` and `节奏型索引` link every matching page and diagram. `常见问题索引` answers by linking to canonical pages instead of duplicating explanations.

- [ ] **Step 4: Build the source catalog**

`参考来源总表` groups every cited source by music education, instrument manufacturers/maintenance, health/safety and external media. Each catalog item uses exactly `- [来源标题](URL) — 发布机构或作者；访问日期：YYYY-MM-DD` so the release audit can parse it. Remove uncited entries and fix page citations that do not appear in the catalog.

- [ ] **Step 5: Complete release links and remove draft flags**

Ensure every page is reachable from a module index or learning route, every prerequisite resolves backward, and all 75 manifest pages have `draft: false`. Do not change templates from draft examples because templates are ignored and excluded from the count.

- [ ] **Step 6: Run the content completion checkpoint**

Run:

```bash
npm run check:content
npm run check:release
npm run diagrams:check
npm run build:site
```

Expected: every command exits 0; release output reports exactly 75 pages and zero errors.

- [ ] **Step 7: Commit the completed content corpus**

```bash
git add content data/content-manifest.yml data/diagrams
git commit -m "docs: complete guitar knowledge base content"
```

- [ ] **Step 8: Record the content phase checkpoint**

Run:

```bash
npm run check:release
git status --short --branch
```

Expected: release check exits 0 and working tree is clean. Proceed to the release plan for semantic, copyright and visual review rather than declaring the project complete here.
