import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"

async function helpers() {
  const path = "./helpers/lessonAssertions.ts"
  assert.ok(existsSync(new URL(path, import.meta.url)), "lesson section helpers must exist")
  return import(path)
}

test("sectionText includes nested sections but excludes the next peer section", async () => {
  const { sectionText } = await helpers()
  assert.equal(sectionText("## A\n甲\n### B\n乙\n## C\n丙", "A").trim(), "甲\n### B\n乙")
  assert.equal(sectionText("## **A** 与 `B`\n正文", "A 与 B").trim(), "正文")
})

test("sectionText rejects missing and duplicate visible headings", async () => {
  const { sectionText } = await helpers()
  assert.throws(() => sectionText("## A\n正文", "B"), /heading/)
  assert.throws(() => sectionText("## A\n甲\n### **A**\n乙", "A"), /heading/)
  assert.equal(sectionText("## A\n```md\n## A\n```\n## B", "A").trim(), "```md\n## A\n```")
})

test("tableRows extracts visible cells without the table header", async () => {
  const { tableRows } = await helpers()
  assert.deepEqual(tableRows("### 核对\n|音|值|\n|---|---|\n|C|0|", "核对"), [["C", "0"]])
  assert.deepEqual(
    tableRows("## A\n|音|值|\n|---|---|\n|**D**|`2`|\n## B\n|音|值|\n|---|---|\n|E|4|", "A"),
    [["D", "2"]],
  )
})

test("tableRows rejects absent and ambiguous tables", async () => {
  const { tableRows } = await helpers()
  assert.throws(() => tableRows("## A\n正文", "A"), /table/)
  assert.throws(
    () => tableRows("## A\n|音|值|\n|---|---|\n|C|0|\n\n段落\n\n|音|值|\n|---|---|\n|D|2|", "A"),
    /table/,
  )
})
