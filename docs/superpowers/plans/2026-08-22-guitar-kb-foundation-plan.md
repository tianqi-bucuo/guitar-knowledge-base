# 民谣吉他知识库基础平台与内容校验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立固定版本的 Quartz 4 中文知识库骨架、可直接打开的 Obsidian 内容目录，以及能在创作和发布模式下检查 Markdown 的内容校验系统。

**Architecture:** 将 Quartz 4.5.2 框架导入现有仓库根目录，保持 `content/` 为唯一内容源。TypeScript 校验工具读取 `data/content-manifest.yml` 和页面 frontmatter，产生结构化诊断；创作模式允许清单页面尚未完成但阻断现有内容错误，发布模式同时强制 60–80 页和全部必需页面完成。

**Tech Stack:** Quartz 4.5.2、Node.js 22+、npm 10.9.2+、TypeScript、tsx test runner、js-yaml、gray-matter、Obsidian Markdown

**Spec:** `docs/superpowers/specs/2026-08-22-guitar-knowledge-base-design.md`

## Global Constraints

- Quartz 必须固定为官方 `v4.5.2` 标签；不得静默升级到 Quartz 5。
- Node.js 必须为 22 或更高版本，npm 必须为 10.9.2 或更高版本；当前环境为 Node.js 25.8.0、npm 11.11.0。
- `content/` 是唯一内容源；构建输出不得手工编辑或提交。
- 正文使用简体中文和国际音名/和弦记法。
- 中文文件名必须配稳定英文 `permalink`。
- 内部断链、缺失附件、无效元数据、重复永久链接和占位文本必须阻断检查。
- 外部链接网络故障不得阻断离线构建；外链可用性属于发布计划的独立报告。
- 首版不加入托管、账号、评论、云同步、数据库、本站音视频或互动式节拍器。

---

## File Map

- Vendor import: `quartz/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `globals.d.ts`, `.node-version`, `.npmrc`, `.prettierignore`
- Modify: `quartz.config.ts`, `quartz.layout.ts`, `quartz/styles/custom.scss`, `.gitignore`, `package.json`
- Create: `content/index.md`, `content/00-从这里开始/01-如何使用知识库.md`, `content/00-从这里开始/02-学习路线总览.md`
- Create: `content/.obsidian/.gitignore`
- Create: `data/content-manifest.yml`
- Create: `scripts/content/types.ts`, `scripts/content/loadManifest.ts`, `scripts/content/parsePage.ts`, `scripts/content/validateMetadata.ts`, `scripts/content/validateLinks.ts`, `scripts/content/validateStructure.ts`, `scripts/content/validateContent.ts`, `scripts/check-content.ts`
- Create: `tests/content/manifest.test.ts`, `tests/content/metadata.test.ts`, `tests/content/links.test.ts`, `tests/content/structure.test.ts`, `tests/content/cli.test.ts`
- Create: `tests/content/fixtures/**`

### Task 1: Import and pin Quartz 4.5.2

**Files:**
- Create: `quartz/**`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `globals.d.ts`
- Create: `.node-version`
- Create: `.npmrc`
- Create: `.prettierignore`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: official Quartz Git tag `v4.5.2`
- Produces: `npx quartz build` and `npm test` commands; framework configuration files used by every later task

- [ ] **Step 1: Verify local runtime satisfies the pinned Quartz engine**

Run:

```bash
node --version
npm --version
```

Expected: Node reports `v22` or newer and npm reports `10.9.2` or newer.

- [ ] **Step 2: Fetch the exact Quartz source into an isolated temporary directory**

Run:

Use a task-specific explicit path and refuse to overwrite an existing directory:

```bash
test ! -e /private/tmp/guitar-kb-quartz-v4.5.2-source
git clone --depth 1 --branch v4.5.2 https://github.com/jackyzha0/quartz.git /private/tmp/guitar-kb-quartz-v4.5.2-source
```

Expected: the safety check exits 0 and clone output states that tag `v4.5.2` was checked out. If the safety check fails, stop and choose another explicit unused path; do not delete an unknown directory.

- [ ] **Step 3: Import the framework without overwriting the approved docs or creating sample content**

Run from the repository root:

```bash
rsync -a --exclude .git --exclude content --exclude docs /private/tmp/guitar-kb-quartz-v4.5.2-source/ ./
```

Expected: `quartz/`, root configuration files and package lock appear; the existing `docs/superpowers/` files remain unchanged.

- [ ] **Step 4: Pin the engine provenance in package metadata**

Add these root keys to `package.json` without changing Quartz dependencies:

```json
{
  "kb": {
    "quartzVersion": "4.5.2",
    "quartzSource": "https://github.com/jackyzha0/quartz/tree/v4.5.2"
  }
}
```

- [ ] **Step 5: Install exactly the locked dependencies**

Run:

```bash
npm ci
```

Expected: exit 0 and `package-lock.json` remains unchanged.

- [ ] **Step 6: Verify the untouched framework before customization**

Run:

```bash
npm test
npm run check
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the pinned framework import**

```bash
git add .gitignore .node-version .npmrc .prettierignore globals.d.ts package.json package-lock.json tsconfig.json quartz quartz.config.ts quartz.layout.ts
git commit -m "build: import Quartz 4.5.2"
```

### Task 2: Configure the Chinese site, Obsidian vault, and seed pages

**Files:**
- Create: `tests/config/quartz-config.test.ts`
- Modify: `quartz.config.ts`
- Modify: `quartz.layout.ts`
- Modify: `quartz/styles/custom.scss`
- Modify: `.gitignore`
- Create: `content/.obsidian/.gitignore`
- Create: `content/index.md`
- Create: `content/00-从这里开始/01-如何使用知识库.md`
- Create: `content/00-从这里开始/02-学习路线总览.md`

**Interfaces:**
- Consumes: Quartz `QuartzConfig`, `PageLayout`, and built-in Search/Explorer/Graph/Backlinks components
- Produces: Chinese site configuration and three valid seed pages consumed by the content validator and later content plans

- [ ] **Step 1: Write the failing configuration test**

Create `tests/config/quartz-config.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import config from "../../quartz.config"

test("uses the approved Chinese knowledge-base settings", () => {
  assert.equal(config.configuration.pageTitle, "民谣吉他知识库")
  assert.equal(config.configuration.locale, "zh-CN")
  assert.equal(config.configuration.enableSPA, true)
  assert.equal(config.configuration.enablePopovers, true)
  assert.ok(config.configuration.ignorePatterns.includes(".obsidian"))
})
```

- [ ] **Step 2: Run the test and observe the expected failure**

Run:

```bash
npx tsx --test tests/config/quartz-config.test.ts
```

Expected: FAIL because the imported Quartz default still uses `Quartz 4` and `en-US`.

- [ ] **Step 3: Apply the approved Quartz configuration**

In `quartz.config.ts`, keep the existing plugin pipeline but set these configuration values:

```ts
configuration: {
  pageTitle: "民谣吉他知识库",
  pageTitleSuffix: "",
  enableSPA: true,
  enablePopovers: true,
  analytics: null,
  locale: "zh-CN",
  baseUrl: undefined,
  ignorePatterns: ["private", "templates", ".obsidian"],
  defaultDateType: "modified",
  // keep the Quartz theme object; change only colors and cdnCaching below
}
```

Set `cdnCaching: false`. Use an acoustic-guitar palette with light-mode `secondary: "#8A4B2A"`, `tertiary: "#2F6B5F"` and dark-mode `secondary: "#E1A46F"`, `tertiary: "#75B8A7"`. Keep ObsidianFlavoredMarkdown, RemoveDrafts, ContentIndex, Assets, Search, Graph and Backlinks enabled.

Because the approved scope is local generation rather than hosting, configure the emitter as `Plugin.ContentIndex({ enableSiteMap: false, enableRSS: false })`; full-text search still consumes the generated content index without publishing invalid host-dependent RSS URLs.

- [ ] **Step 4: Simplify site furniture and add readable Chinese typography**

In `quartz.layout.ts`, retain Search, Explorer, Graph, TableOfContents and Backlinks. Replace the upstream footer links with:

```ts
footer: Component.Footer({ links: {} }),
```

Append to `quartz/styles/custom.scss`:

```scss
:root {
  --bodyFont: "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --headerFont: "Noto Serif CJK SC", "Songti SC", serif;
}

.page article img[src$=".svg"] {
  max-width: min(100%, 42rem);
}
```

- [ ] **Step 5: Create a minimal, portable Obsidian boundary**

Create `content/.obsidian/.gitignore`:

```gitignore
workspace.json
workspace-mobile.json
cache
```

Add `public/`, `.quartz-cache/`, `node_modules/`, and the same machine-specific Obsidian files to the root `.gitignore`. Do not commit personal plugin state or recent-file history.

- [ ] **Step 6: Create three publishable seed pages**

Use this complete frontmatter shape for `content/index.md` and adapt title, description, permalink, type and tags for the other two pages:

```yaml
---
title: 民谣吉他知识库
description: 从零基础到进阶核心阶段的民谣吉他学习路线与百科
permalink: /
type: index
tags:
  - 导航
draft: false
---
```

`content/index.md` must link to `[[00-从这里开始/01-如何使用知识库]]` and `[[00-从这里开始/02-学习路线总览]]`. The usage page explains local Obsidian and website navigation. The route page describes the ten approved modules without duplicating lesson bodies.

- [ ] **Step 7: Run focused tests and a production build**

Run:

```bash
npx tsx --test tests/config/quartz-config.test.ts
npx quartz build
```

Expected: test PASS; build exits 0; `public/index.html` exists.

- [ ] **Step 8: Commit the configured seed site**

```bash
git add .gitignore quartz.config.ts quartz.layout.ts quartz/styles/custom.scss content tests/config
git commit -m "feat: configure Chinese guitar knowledge base"
```

### Task 3: Define and load the content manifest

**Files:**
- Create: `data/content-manifest.yml`
- Create: `scripts/content/types.ts`
- Create: `scripts/content/loadManifest.ts`
- Create: `tests/content/manifest.test.ts`
- Create: `tests/content/fixtures/valid-manifest.yml`
- Create: `tests/content/fixtures/invalid-manifest.yml`

**Interfaces:**
- Consumes: YAML files read with `js-yaml`
- Produces: `loadManifest(path: string): Manifest`; `Manifest`, `ManifestEntry`, `ModuleId`, `PageType`, `Diagnostic`, and `ValidationMode` types

- [ ] **Step 1: Write the manifest fixtures**

`tests/content/fixtures/valid-manifest.yml`:

```yaml
version: 1
release:
  minPages: 60
  maxPages: 80
modules:
  - id: start
    directory: 00-从这里开始
    target: 5
pages:
- id: how-to-use
    title: 如何使用知识库
    module: start
    type: lesson
    file: 00-从这里开始/01-如何使用知识库.md
    permalink: /start/how-to-use
    required: true
```

`invalid-manifest.yml` repeats the same page `id` twice so the error is deterministic.

- [ ] **Step 2: Write failing manifest tests**

Create `tests/content/manifest.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import { loadManifest } from "../../scripts/content/loadManifest"

test("loads a valid manifest", () => {
  const manifest = loadManifest("tests/content/fixtures/valid-manifest.yml")
  assert.equal(manifest.release.minPages, 60)
  assert.equal(manifest.pages[0].id, "how-to-use")
})

test("rejects duplicate page ids", () => {
  assert.throws(
    () => loadManifest("tests/content/fixtures/invalid-manifest.yml"),
    /MANIFEST_DUPLICATE_ID.*how-to-use/,
  )
})
```

- [ ] **Step 3: Verify the tests fail before implementation**

Run:

```bash
npx tsx --test tests/content/manifest.test.ts
```

Expected: FAIL with module-not-found for `loadManifest`.

- [ ] **Step 4: Define the shared types**

Create `scripts/content/types.ts` with these exact exports:

```ts
export const PAGE_TYPES = ["lesson", "path", "index", "glossary"] as const
export const LEVELS = ["零基础", "入门", "基础", "进阶"] as const
export const MODULE_IDS = [
  "start", "basics", "chords", "rhythm", "technique",
  "accompaniment", "theory", "practice", "care", "reference",
] as const
export type PageType = (typeof PAGE_TYPES)[number]
export type Level = (typeof LEVELS)[number]
export type ModuleId = (typeof MODULE_IDS)[number]
export type ValidationMode = "author" | "release"
export type Severity = "error" | "warning"

export interface ManifestEntry {
  id: string
  title: string
  module: ModuleId
  type: PageType
  file: string
  permalink: string
  required: boolean
}

export interface Manifest {
  version: 1
  release: { minPages: number; maxPages: number }
  modules: Array<{ id: ModuleId; directory: string; target: number }>
  pages: ManifestEntry[]
}

export interface Diagnostic {
  severity: Severity
  code: string
  file: string
  message: string
}
```

- [ ] **Step 5: Implement strict manifest loading**

Create `scripts/content/loadManifest.ts` exporting:

```ts
export function loadManifest(path: string): Manifest
```

Parse YAML with `js-yaml`, verify version `1`, page bounds, all ten module ids, non-empty titles, known page types, relative `.md` file paths, root-relative permalinks, and uniqueness of page ids/titles/files/permalinks. Throw `Error` messages prefixed with stable codes such as `MANIFEST_DUPLICATE_ID`.

- [ ] **Step 6: Add the real initial manifest**

`data/content-manifest.yml` must define all ten approved modules and the three existing seed pages; use `minPages: 60` and `maxPages: 80` so release mode cannot pass prematurely. `PAGE_TYPES`, `LEVELS` and `MODULE_IDS` in `types.ts` are the centralized enum source used by the loader and validators.

- [ ] **Step 7: Run manifest tests and type checking**

Run:

```bash
npx tsx --test tests/content/manifest.test.ts
npm run check
```

Expected: both exit 0.

- [ ] **Step 8: Commit the manifest domain model**

```bash
git add data scripts/content/types.ts scripts/content/loadManifest.ts tests/content
git commit -m "feat: define content manifest schema"
```

### Task 4: Parse pages and validate metadata and uniqueness

**Files:**
- Create: `scripts/content/parsePage.ts`
- Create: `scripts/content/validateMetadata.ts`
- Create: `tests/content/metadata.test.ts`
- Create: `tests/content/fixtures/metadata-manifest.yml`
- Create: `tests/content/fixtures/content-valid/开放和弦.md`
- Create: `tests/content/fixtures/content-invalid/重复链接.md`

**Interfaces:**
- Consumes: `Manifest`, `ManifestEntry`, `PAGE_TYPES`, `LEVELS`
- Produces: `parsePage(path: string): PageRecord`; `validateMetadata(pages: PageRecord[], manifest: Manifest): Diagnostic[]`

- [ ] **Step 1: Define a valid lesson fixture**

Create a fixture with `type: lesson`, `level: 入门`, a prerequisites list, tags, `draft: false`, and the eight required Markdown sections from the spec. Create an invalid second fixture that shares its permalink.

- [ ] **Step 2: Write the failing metadata tests**

Test these exact behaviors:

```ts
test("lesson metadata accepts the approved fields", () => {
  const manifest = loadManifest("tests/content/fixtures/metadata-manifest.yml")
  const page = parsePage("tests/content/fixtures/content-valid/开放和弦.md")
  assert.equal(page.frontmatter.level, "入门")
  assert.deepEqual(validateMetadata([page], manifest), [])
})

test("duplicate permalinks return a stable diagnostic", () => {
  const manifest = loadManifest("tests/content/fixtures/metadata-manifest.yml")
  const first = parsePage("tests/content/fixtures/content-valid/开放和弦.md")
  const duplicate = parsePage("tests/content/fixtures/content-invalid/重复链接.md")
  const diagnostics = validateMetadata([first, duplicate], manifest)
  assert.ok(diagnostics.some((item) => item.code === "DUPLICATE_PERMALINK"))
})
```

Also assert `MISSING_FRONTMATTER`, `INVALID_PAGE_TYPE`, `INVALID_LEVEL`, `LESSON_PREREQUISITES_REQUIRED`, `DUPLICATE_TITLE`, and `DUPLICATE_ALIAS` for targeted fixtures constructed in the test.

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
npx tsx --test tests/content/metadata.test.ts
```

Expected: FAIL because `parsePage` and `validateMetadata` do not exist.

- [ ] **Step 4: Implement page parsing**

Create `PageRecord` and `parsePage` in `scripts/content/parsePage.ts`:

```ts
export interface PageRecord {
  file: string
  body: string
  headings: string[]
  links: string[]
  embeds: string[]
  frontmatter: Record<string, unknown>
}

export function parsePage(path: string): PageRecord
```

Use `gray-matter`; extract headings, `[[wikilinks]]`, `![[embeds]]`, standard Markdown links and images without resolving them yet.

- [ ] **Step 5: Implement metadata validation**

Create `validateMetadata` with the exact signature:

```ts
export function validateMetadata(pages: PageRecord[], manifest: Manifest): Diagnostic[]
```

All page types require `title`, `description`, `permalink`, `type`, non-empty `tags`, and boolean `draft`. Lessons additionally require an approved `level` and a `prerequisites` array. Validate manifest/frontmatter agreement for file, type and permalink, plus title, alias and permalink uniqueness.

- [ ] **Step 6: Run the focused and full tests**

Run:

```bash
npx tsx --test tests/content/metadata.test.ts
npm test
```

Expected: both exit 0.

- [ ] **Step 7: Commit metadata validation**

```bash
git add scripts/content tests/content
git commit -m "feat: validate knowledge page metadata"
```

### Task 5: Validate internal links, local resources, article structure, and placeholders

**Files:**
- Create: `scripts/content/validateLinks.ts`
- Create: `scripts/content/validateStructure.ts`
- Create: `tests/content/links.test.ts`
- Create: `tests/content/structure.test.ts`
- Create: `tests/content/fixtures/link-site/**`

**Interfaces:**
- Consumes: `PageRecord[]`, knowledge-base content root, manifest
- Produces: `resolveInternalLinks(pages: PageRecord[], contentRoot: string): ResolvedLink[]`; `validateLinks(pages: PageRecord[], contentRoot: string): Diagnostic[]`; `validateStructure(pages: PageRecord[]): Diagnostic[]`

- [ ] **Step 1: Write a miniature linked-site fixture**

Create two valid linked Markdown pages, one broken `[[不存在页面]]` link, one missing `![[assets/diagrams/missing.svg]]` embed, and one lesson missing `## 自我检查标准`.

- [ ] **Step 2: Write failing link and structure tests**

Assert these exact codes:

```ts
assert.ok(diagnostics.some((item) => item.code === "BROKEN_INTERNAL_LINK"))
assert.ok(diagnostics.some((item) => item.code === "MISSING_LOCAL_ASSET"))
assert.ok(diagnostics.some((item) => item.code === "MISSING_REQUIRED_SECTION"))
assert.ok(diagnostics.some((item) => item.code === "PLACEHOLDER_TEXT"))
```

Also test wikilink aliases, heading fragments, relative Markdown links, URL-encoded paths, duplicate filename ambiguity and SVG `<title>` presence.

- [ ] **Step 3: Verify tests fail before implementation**

Run:

```bash
npx tsx --test tests/content/links.test.ts tests/content/structure.test.ts
```

Expected: FAIL with module-not-found for both validators.

- [ ] **Step 4: Implement Obsidian-aware link resolution**

Export this shared result type and resolver from `validateLinks.ts`:

```ts
export interface ResolvedLink {
  source: string
  target: string
  raw: string
}

export function resolveInternalLinks(
  pages: PageRecord[],
  contentRoot: string,
): ResolvedLink[]
```

`validateLinks` must call the same resolver for shortest-path wikilinks, explicit relative paths, aliases and heading fragments against parsed pages. Standard `http:` and `https:` links are recorded but never fetched. Images and embeds must resolve under `content/`; reject path traversal outside that root.

- [ ] **Step 5: Implement structural and placeholder rules**

For `type: lesson`, require headings equivalent to the eight approved template sections. Detect standalone `TODO`, `TBD`, `XXX`, empty headings and template markers such as `<!-- fill -->`; do not flag those strings inside fenced code examples. Parse SVG files and require an `<svg>` root plus a non-empty `<title>`.

- [ ] **Step 6: Run focused tests and the production build**

Run:

```bash
npx tsx --test tests/content/links.test.ts tests/content/structure.test.ts
npx quartz build
```

Expected: tests PASS; the three seed pages build successfully.

- [ ] **Step 7: Commit link and structure validation**

```bash
git add scripts/content tests/content
git commit -m "feat: validate links and lesson structure"
```

### Task 6: Add author/release CLI modes and verification scripts

**Files:**
- Create: `scripts/content/validateContent.ts`
- Create: `scripts/check-content.ts`
- Create: `tests/content/cli.test.ts`
- Modify: `package.json`
- Create: `README.md`

**Interfaces:**
- Consumes: all manifest, parsing and validator functions from Tasks 3–5
- Produces: `validateContent(options: ValidationOptions): Promise<Diagnostic[]>`; CLI commands `npm run check:content`, `npm run check:release`, and `npm run verify`

- [ ] **Step 1: Write failing orchestration tests**

Use a temporary content root and assert:

```ts
const author = await validateContent({ contentRoot, manifestPath, mode: "author" })
assert.ok(author.some((item) => item.code === "PLANNED_PAGE_MISSING" && item.severity === "warning"))

const release = await validateContent({ contentRoot, manifestPath, mode: "release" })
assert.ok(release.some((item) => item.code === "CONTENT_COUNT_OUT_OF_RANGE"))
assert.ok(release.some((item) => item.code === "REQUIRED_PAGE_MISSING"))
```

Add a CLI test that checks exit code 1 when any error diagnostic exists and exit code 0 when only warnings exist.

- [ ] **Step 2: Verify orchestration tests fail**

Run:

```bash
npx tsx --test tests/content/cli.test.ts
```

Expected: FAIL because `validateContent` and the CLI are absent.

- [ ] **Step 3: Implement deterministic orchestration and output**

Create:

```ts
export interface ValidationOptions {
  contentRoot: string
  manifestPath: string
  mode: ValidationMode
}

export async function validateContent(options: ValidationOptions): Promise<Diagnostic[]>
```

Sort diagnostics by file, severity and code. CLI output format must be one diagnostic per line:

```text
ERROR BROKEN_INTERNAL_LINK content/02-和弦系统/开放和弦.md: 找不到“按弦基础”
```

Print a final count and exit 1 if errors exist.

- [ ] **Step 4: Wire stable package commands**

Add to `package.json` scripts:

```json
{
  "check:content": "tsx scripts/check-content.ts --mode author",
  "check:release": "tsx scripts/check-content.ts --mode release",
  "build:site": "npx quartz build",
  "verify": "npm test && npm run check && npm run check:content && npm run build:site"
}
```

Keep the upstream `test`, `check`, and `quartz` scripts.

- [ ] **Step 5: Document the local workflow**

Create `README.md` with exact prerequisites, `npm ci`, `npm run verify`, `npx quartz build --serve`, instructions to open `content/` as an Obsidian vault, and the distinction between author and release checks. State that release check is expected to fail until the content plan completes.

- [ ] **Step 6: Run foundation acceptance checks**

Run:

```bash
npm run verify
npm run check:release
git status --short
```

Expected: `npm run verify` exits 0; `check:release` exits 1 only with missing-page/count diagnostics; Git status lists only the intended Task 6 changes before commit.

- [ ] **Step 7: Commit the foundation verification layer**

```bash
git add package.json scripts README.md tests/content
git commit -m "feat: add content verification commands"
```

- [ ] **Step 8: Record the phase checkpoint**

Run:

```bash
npm run verify
git log --oneline -6
git status --short --branch
```

Expected: verification exits 0; six focused implementation commits are visible; working tree is clean. Do not proceed to the diagram plan if this checkpoint fails.
