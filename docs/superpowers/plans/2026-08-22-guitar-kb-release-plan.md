# 民谣吉他知识库发布与质量验收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对已完成的 75 篇知识库执行学习依赖、来源、版权、安全、搜索、响应式页面和 Obsidian 离线验收，交付可重复构建的首版静态网站。

**Architecture:** 自动校验负责依赖图、孤立页面、来源清单、构建输出和确定性资产；独立外链审计只生成报告，不改变离线构建结果。人工验收使用固定页面与桌面/手机视口，所有发现必须形成可复现修复并重新通过 `verify:release`。

**Tech Stack:** TypeScript、tsx test runner、Quartz 4.5.2、静态 HTML、内置浏览器、Obsidian、Markdown QA 报告

**Spec:** `docs/superpowers/specs/2026-08-22-guitar-knowledge-base-design.md`

## Global Constraints

- 开始前基础平台、SVG 图示和 75 篇正文计划必须完成，且 `npm run check:release` 已通过。
- 最终正式页面总数保持 75；修复应更新既有页面，除非同时修改清单且仍保持设计规定的 60–80 边界。
- 自动发布验收不得依赖外网；外链可用性只生成警告报告。
- 任何内容修正继续遵守简体中文、国际记法、权威来源、版权和安全边界。
- 不执行线上部署，不创建托管账号，不添加分析、评论、云同步或后端服务。
- 不能通过删除失败测试、降低规则严重度、把页面重新标为草稿或从清单移除页面来“修复”发布检查。

---

## File Map

- Create: `scripts/content/validateLearningGraph.ts`, `tests/content/learning-graph.test.ts`
- Create: `scripts/content/auditSources.ts`, `scripts/audit-sources.ts`, `tests/content/sources.test.ts`
- Create: `tests/site/build-output.test.ts`
- Create: `reports/source-audit.md`, `reports/content-review.md`, `reports/visual-qa.md`
- Modify: `scripts/content/validateContent.ts`, `scripts/check-content.ts`, `package.json`, `README.md`
- Modify: content, diagram data, generated SVG, Quartz config/layout/styles only when a named audit finding requires it

### Task 1: Validate learning dependencies and page reachability

**Files:**
- Create: `scripts/content/validateLearningGraph.ts`
- Create: `tests/content/learning-graph.test.ts`
- Modify: `scripts/content/validateContent.ts`

**Interfaces:**
- Consumes: `PageRecord[]`, `Manifest`, `resolveInternalLinks(...)` results and page prerequisites
- Produces: `validateLearningGraph(pages: PageRecord[], manifest: Manifest, links: ResolvedLink[]): Diagnostic[]`; release diagnostics for cycles, forward prerequisites and unreachable pages

- [ ] **Step 1: Write failing graph tests**

Construct small in-memory manifests and pages, then assert:

```ts
assert.ok(validateLearningGraph(cyclePages, manifest, []).some((d) => d.code === "PREREQUISITE_CYCLE"))
assert.ok(validateLearningGraph(forwardPages, manifest, []).some((d) => d.code === "PREREQUISITE_POINTS_FORWARD"))
assert.ok(validateLearningGraph(orphanPages, manifest, orphanLinks).some((d) => d.code === "UNREACHABLE_PAGE"))
assert.deepEqual(validateLearningGraph(validPages, manifest, validLinks), [])
```

The valid fixture starts at `/` and `/start/learning-path`, reaches every required page through Markdown links, and uses prerequisite edges only to earlier manifest entries.

- [ ] **Step 2: Verify tests fail before implementation**

Run:

```bash
npx tsx --test tests/content/learning-graph.test.ts
```

Expected: FAIL because `validateLearningGraph` is missing.

- [ ] **Step 3: Implement graph construction and deterministic diagnostics**

Build two directed graphs: prerequisite edges and resolved internal-link edges. Use manifest order as the curriculum order. Detect missing prerequisites, forward edges, cycles, and pages unreachable from the home page or learning-route page. Reference/glossary pages count as reachable through their module indexes.

Export exactly:

```ts
export function validateLearningGraph(
  pages: PageRecord[],
  manifest: Manifest,
  links: ResolvedLink[],
): Diagnostic[]
```

- [ ] **Step 4: Add graph checks only to release mode**

Call `resolveInternalLinks(pages, options.contentRoot)` once in `validateContent`, then pass the returned links to `validateLearningGraph` when `mode === "release"`. Author mode may report incomplete reachability as warnings while modules are being drafted; release mode returns errors.

- [ ] **Step 5: Run focused and release checks**

Run:

```bash
npx tsx --test tests/content/learning-graph.test.ts
npm run check:release
```

Expected: both exit 0. Fix content links or prerequisite lists, not the validator, for any real-corpus findings.

- [ ] **Step 6: Commit learning graph validation**

```bash
git add scripts/content tests/content content data/content-manifest.yml
git commit -m "feat: validate curriculum learning graph"
```

### Task 2: Audit sources, safety pages, and copyright boundaries

**Files:**
- Create: `scripts/content/auditSources.ts`
- Create: `scripts/audit-sources.ts`
- Create: `tests/content/sources.test.ts`
- Create: `reports/source-audit.md`
- Create: `reports/content-review.md`
- Modify: content pages with documented findings
- Modify: `package.json`

**Interfaces:**
- Consumes: page bodies, footnote definitions and `参考来源总表`
- Produces: `auditSources(pages: PageRecord[]): SourceAudit`; `npm run audit:sources`; non-blocking external-link status report

- [ ] **Step 1: Write failing source-audit tests**

Use fixtures to assert duplicate normalized URLs collapse into one catalog entry, cited URLs missing from the catalog produce `SOURCE_NOT_IN_CATALOG`, catalog URLs with no citation produce `UNCITED_CATALOG_ENTRY`, lesson pages with no source produce `LESSON_SOURCE_REQUIRED`, and access dates outside `YYYY-MM-DD` produce `INVALID_ACCESS_DATE`.

Define the result type in the test expectation:

```ts
export interface SourceAudit {
  diagnostics: Diagnostic[]
  sources: Array<{ url: string; title: string; publisher: string; accessDate: string; citedBy: string[] }>
}
```

- [ ] **Step 2: Run tests and confirm the failure**

Run:

```bash
npx tsx --test tests/content/sources.test.ts
```

Expected: FAIL because `auditSources` does not exist.

- [ ] **Step 3: Implement source extraction and catalog comparison**

Parse Markdown footnote definitions and the source catalog’s structured list. Normalize only safe URL differences such as trailing slash; do not merge distinct paths or strip meaningful query parameters. Sort all output by normalized URL and page path.

Export the `SourceAudit` interface shown in Step 1 and this exact function:

```ts
export function auditSources(pages: PageRecord[]): SourceAudit
```

- [ ] **Step 4: Implement the optional external status reporter**

`scripts/audit-sources.ts` accepts `--online` and `--output reports/source-audit.md`. Without `--online`, it produces the structural report only. Online mode uses `fetch` with a 10-second timeout, at most four concurrent requests, HEAD followed by GET when HEAD is unsupported, and reports status without returning failure solely for network errors.

Add:

```json
{
  "audit:sources": "tsx scripts/audit-sources.ts --output reports/source-audit.md",
  "audit:sources:online": "tsx scripts/audit-sources.ts --online --output reports/source-audit.md"
}
```

- [ ] **Step 5: Produce and resolve the structural source audit**

Run:

```bash
npm run audit:sources
```

Expected: report lists 75 pages, source counts and zero structural source errors. Repair every missing/uncited/malformed source finding in the relevant Markdown page or catalog.

- [ ] **Step 6: Perform the named safety and copyright review**

Create `reports/content-review.md` with one checked row for each of these pages: `疼痛疲劳与停止练习边界`, `左手拇指与手腕`, `坐姿与站姿`, `F大横按与移动和弦`, `更换琴弦`, `弦距琴颈与品丝基础`, and `清洁湿度与存放`. Columns must record medical-disclaimer present, stop condition present, source verified, reversible-first advice, and technician referral where relevant.

Add a second table listing every page containing “歌曲”“歌词”“曲谱”“编曲” or an external video embed, with a conclusion of original exercise, public-domain material, short attributed quotation, or link-only. Any other conclusion is a blocking finding and must be rewritten.

- [ ] **Step 7: Run tests and commit the audit layer**

```bash
npx tsx --test tests/content/sources.test.ts
npm run check:release
git add scripts/content scripts/audit-sources.ts tests/content package.json reports content
git commit -m "docs: audit sources safety and copyright"
```

Expected: tests and release check exit 0 before commit.

### Task 3: Verify build output, Chinese search, and responsive presentation

**Files:**
- Create: `tests/site/build-output.test.ts`
- Create: `reports/visual-qa.md`
- Modify: `quartz.config.ts`, `quartz.layout.ts`, `quartz/styles/custom.scss`, SVG data or content only for reproduced findings

**Interfaces:**
- Consumes: `public/` from `npx quartz build`
- Produces: deterministic static-output tests and a completed visual QA matrix

- [ ] **Step 1: Write failing static-output tests**

Create `tests/site/build-output.test.ts` that expects a prior build and asserts:

```ts
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const read = (path: string) => readFileSync(path, "utf8")
const exists = (path: string) => existsSync(path)

assert.match(read("public/index.html"), /民谣吉他知识库/)
assert.match(read("public/static/contentIndex.json"), /开放和弦/)
assert.ok(exists("public/chords/c-major.html"))
assert.ok(exists("public/start/learning-path.html"))
assert.ok(exists("public/reference/glossary.html"))
```

Use the exact Quartz 4 content-index path `public/static/contentIndex.json`; do not replace it with a glob.

- [ ] **Step 2: Run the test before building and observe failure**

Run:

```bash
npx tsx --test tests/site/build-output.test.ts
```

Expected: FAIL if no fresh `public/` exists or the expected output assertions are not yet wired.

- [ ] **Step 3: Build and make the output test pass**

Run:

```bash
npx quartz build
npx tsx --test tests/site/build-output.test.ts
```

Expected: PASS after using Quartz 4’s exact generated paths. Do not weaken title or page-presence assertions.

- [ ] **Step 4: Start a local preview for fixed visual checks**

Run:

```bash
npx quartz build --serve
```

Use the local URL printed by Quartz. Inspect these pages at 1440×900 and 390×844: home, learning route, `正确按弦`, `C和弦`, `基础八分音符扫弦`, `指板上的音名`, `疼痛疲劳与停止练习边界`, and `吉他术语表`.

- [ ] **Step 5: Complete the visual QA matrix**

In `reports/visual-qa.md`, record pass/fail for each page and viewport across: no horizontal overflow, readable navigation, visible search, legible SVG labels, non-overlapping table of contents, usable backlinks, dark-mode contrast, and meaningful image alt text. Also record one Chinese search query each for `横按`, `六八拍`, `手腕`, `变调夹`, and `顺阶和弦`; each must return its canonical page in the first five results.

- [ ] **Step 6: Fix only reproduced presentation findings**

Prefer local rules in `quartz/styles/custom.scss`; modify layout/config only when a component causes the failure. If an SVG is unreadable, fix its renderer/data and regenerate rather than editing output. Re-run the exact failed viewport/query and mark the row passed with a short fix note.

- [ ] **Step 7: Run automated checks and commit visual QA**

```bash
npm run build:site
npx tsx --test tests/site/build-output.test.ts
npm run check:release
git add tests/site reports/visual-qa.md quartz.config.ts quartz.layout.ts quartz/styles/custom.scss content data scripts/diagrams
git commit -m "fix: polish knowledge base presentation"
```

Expected: all commands exit 0 before commit.

### Task 4: Create the final release command and offline handoff

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.gitignore`
- Create: `reports/release-checklist.md`

**Interfaces:**
- Consumes: every automated test, release validator, diagram check, source audit and Quartz build
- Produces: `npm run verify:release`; complete local/Obsidian/build handoff; clean static-site release candidate

- [ ] **Step 1: Add one deterministic release command**

Add to `package.json`:

```json
{
  "verify:release": "npm test && npm run check && npm run check:release && npm run diagrams:check && npm run audit:sources && npm run build:site && npx tsx --test tests/site/build-output.test.ts"
}
```

Do not include the online source audit in this command.

- [ ] **Step 2: Complete the README handoff**

README must include: project purpose, Node/npm floors, `npm ci`, Obsidian instructions for opening `content/`, page-template workflow, diagram generation, author/release checks, local preview, production build location, source audit commands, and explicit non-goal of online deployment. Link the design spec, roadmap and four implementation plans.

- [ ] **Step 3: Verify Obsidian offline behavior**

Disconnect network access or disable network for the check, open `content/` as an Obsidian vault, and verify these exact files: `学习路线总览`, `C和弦`, `基础八分音符扫弦`, `指板上的音名`, and `吉他术语表`. Confirm wikilinks, backlinks and committed SVGs render without `node_modules`, the Quartz dev server or external media.

Record results in `reports/release-checklist.md` with date, Obsidian version, tested pages and pass/fail. External video links are allowed to remain unavailable offline as long as no core instruction depends on them.

- [ ] **Step 4: Run final release verification from a clean build state**

Move any existing `public/` to a recoverable temporary backup outside the repository, then run:

```bash
guitar_kb_release_backup="$(mktemp -d /private/tmp/guitar-kb-public.XXXXXX)"
if [ -d public ]; then mv public "$guitar_kb_release_backup/public"; fi
npm run verify:release
```

Expected: exit 0; output confirms 75 pages, current SVGs, zero content errors, successful source structure audit and successful Quartz build-output tests.

- [ ] **Step 5: Inspect the release diff and commit**

Run:

```bash
git diff --check
git status --short
```

Expected: only `package.json`, `README.md`, `.gitignore` and `reports/release-checklist.md` remain unless Step 3 found a documented content issue.

Commit:

```bash
git add package.json README.md .gitignore reports/release-checklist.md
git commit -m "docs: finalize knowledge base release workflow"
```

- [ ] **Step 6: Record final evidence**

Run:

```bash
npm run verify:release
git status --short --branch
git log -5 --oneline
```

Expected: release verification exits 0, working tree is clean, and the final five commits show learning-graph, audit, visual QA and handoff milestones. The static site is ready to deploy, but this plan does not deploy it.
