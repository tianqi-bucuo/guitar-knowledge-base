import assert from "node:assert/strict"
import test from "node:test"
import { parsePage, type PageRecord } from "../../scripts/content/parsePage"
import { validateStructure } from "../../scripts/content/validateStructure"

const lessonSections = [
  "学习目标与先修知识",
  "核心概念",
  "图示与操作步骤",
  "常见错误及修正",
  "分级练习",
  "自我检查标准",
  "下一步与相关词条",
  "参考来源与延伸阅读",
]
const navigationSections = ["适用对象", "导航方法", "有序链接", "完成标准", "更新策略"]

function sectionBody(
  headings: readonly string[],
  contentFor: (heading: string, index: number) => string = () => "说明。",
): string {
  return headings
    .map((heading, index) => `## ${heading}\n\n${contentFor(heading, index)}\n`)
    .join("\n")
}

function record(
  type: "lesson" | "path" | "index" | "glossary",
  headings: string[],
  body = sectionBody(headings),
): PageRecord {
  return {
    file: `content/${type}.md`,
    body,
    headings,
    links: [],
    embeds: [],
    frontmatter: { type },
    hasFrontmatter: true,
  }
}

test("reports a missing lesson section and a standalone placeholder", () => {
  const page = parsePage("tests/content/fixtures/link-site/missing-section.md")
  const codes = validateStructure([page]).map((item) => item.code)

  assert.ok(codes.includes("MISSING_REQUIRED_SECTION"))
  assert.ok(codes.includes("PLACEHOLDER_TEXT"))
})

test("ignores placeholders inside fenced and inline code and inside larger words", () => {
  const page = record(
    "lesson",
    lessonSections,
    `${sectionBody(lessonSections)}\n\n\`TODO\` and METHODTBDVALUE\n\n\`\`\`text\nXXX\n\`\`\`\n`,
  )

  assert.deepEqual(validateStructure([page]), [])
})

test("ignores placeholder words inside blockquotes", () => {
  const page = record(
    "lesson",
    lessonSections,
    `${sectionBody(lessonSections)}\n\n> TODO 是本引用讨论的术语，不是页面占位符。\n\n正文已完成。\n`,
  )

  assert.deepEqual(validateStructure([page]), [])
})

test("detects HTML fill markers and empty headings from the Markdown AST", () => {
  const page = record(
    "lesson",
    lessonSections,
    `${sectionBody(lessonSections)}\n\n<!-- fill -->\n\n##   \n`,
  )
  const placeholders = validateStructure([page]).filter((item) => item.code === "PLACEHOLDER_TEXT")

  assert.equal(placeholders.length, 2)
})

test("deduplicates exact diagnostics from repeated placeholders", () => {
  const page = record("lesson", lessonSections, `${sectionBody(lessonSections)}\n\nTODO\n\nTODO\n`)

  assert.deepEqual(
    validateStructure([page]).map((item) => item.code),
    ["PLACEHOLDER_TEXT"],
  )
})

test("rejects empty, comment-only, and thematic-break-only required sections for every page type", () => {
  const cases = [
    ["lesson", lessonSections],
    ["path", navigationSections],
    ["index", navigationSections],
    ["glossary", ["术语条目", "参考来源与延伸阅读"]],
  ] as const

  for (const [type, headings] of cases) {
    const body = sectionBody(headings, (_heading, index) => ["", "<!-- note -->", "---"][index % 3])
    const diagnostics = validateStructure([record(type, [...headings], body)])

    assert.equal(
      diagnostics.filter(({ code }) => code === "EMPTY_REQUIRED_SECTION").length,
      headings.length,
      type,
    )
  }
})

test("reports empty exercise, self-check, and reference lesson sections individually", () => {
  for (const emptyHeading of ["分级练习", "自我检查标准", "参考来源与延伸阅读"]) {
    const body = sectionBody(lessonSections, (heading) =>
      heading === emptyHeading ? "<!-- still empty -->" : "已完成内容。",
    )
    const diagnostics = validateStructure([record("lesson", lessonSections, body)]).filter(
      ({ code }) => code === "EMPTY_REQUIRED_SECTION",
    )

    assert.equal(diagnostics.length, 1, emptyHeading)
    assert.match(diagnostics[0].message, new RegExp(emptyHeading))
  }
})

test("accepts meaningful paragraphs, lists, links, code, image alt, and blockquotes", () => {
  const meaningful = [
    "学习目标。",
    "- 核心条目",
    "[操作说明](https://example.test)",
    "```text\n修正示例\n```",
    "![练习节拍图](https://example.test/exercise.png)",
    "> 连续四次清晰发声。",
    "1. 下一步词条",
    "参考来源。",
  ]
  const body = sectionBody(lessonSections, (_heading, index) => meaningful[index])

  assert.deepEqual(validateStructure([record("lesson", lessonSections, body)]), [])
})

test("requires exact type-specific sections for path, index, and glossary pages", () => {
  const path = record("path", navigationSections.slice(1))
  const index = record("index", navigationSections.slice(0, -1))
  const glossary = record("glossary", ["术语条目"])

  for (const page of [path, index, glossary]) {
    assert.ok(validateStructure([page]).some((item) => item.code === "MISSING_REQUIRED_SECTION"))
  }
})

test("requires a non-empty ordered list in the ordered-links section", () => {
  const emptyListPage = record(
    "path",
    navigationSections,
    navigationSections.map((heading) => `## ${heading}\n`).join("\n"),
  )
  const unorderedListPage = record(
    "index",
    navigationSections,
    "## 适用对象\n\n说明\n\n## 导航方法\n\n说明\n\n## 有序链接\n\n- [[page]]\n\n## 完成标准\n\n说明\n\n## 更新策略\n\n说明\n",
  )

  assert.ok(
    validateStructure([emptyListPage]).some((item) => item.code === "MISSING_REQUIRED_SECTION"),
  )
  assert.ok(
    validateStructure([unorderedListPage]).some((item) => item.code === "MISSING_REQUIRED_SECTION"),
  )
})

test("rejects ordered lists whose items have no content", () => {
  const page = record(
    "path",
    navigationSections,
    "## 适用对象\n\n说明\n\n## 导航方法\n\n说明\n\n## 有序链接\n\n1.\n\n## 完成标准\n\n说明\n\n## 更新策略\n\n说明\n",
  )

  assert.ok(validateStructure([page]).some((item) => item.code === "MISSING_REQUIRED_SECTION"))
})

test("accepts complete path, index, and glossary structures", () => {
  const navigationBody =
    "## 适用对象\n\n说明\n\n## 导航方法\n\n说明\n\n## 有序链接\n\n1. [[page]]\n\n## 完成标准\n\n说明\n\n## 更新策略\n\n说明\n"
  const glossary = record(
    "glossary",
    ["术语条目", "参考来源与延伸阅读"],
    "## 术语条目\n\n和弦：三个或以上的音。\n\n## 参考来源与延伸阅读\n\n参考。\n",
  )

  assert.deepEqual(validateStructure([record("path", navigationSections, navigationBody)]), [])
  assert.deepEqual(validateStructure([record("index", navigationSections, navigationBody)]), [])
  assert.deepEqual(validateStructure([glossary]), [])
})

test("the three published seed pages have no structure diagnostics", () => {
  const pages = [
    parsePage("content/index.md"),
    parsePage("content/00-从这里开始/01-如何使用知识库.md"),
    parsePage("content/00-从这里开始/02-学习路线总览.md"),
  ]

  assert.deepEqual(validateStructure(pages), [])
})
