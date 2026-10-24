import assert from "node:assert/strict"
import test from "node:test"
import { compareExplorerNodes } from "../../quartz/components/explorerSort"

type TestNode = {
  isFolder: boolean
  displayName: string
  data: null | { order?: number }
}

const file = (displayName: string, order?: number): TestNode => ({
  isFolder: false,
  displayName,
  data: order === undefined ? {} : { order },
})

const folder = (displayName: string): TestNode => ({
  isFolder: true,
  displayName,
  data: null,
})

test("Explorer puts folders first and files in curriculum order", () => {
  const nodes = [file("常用七和弦", 6), file("和弦图读法", 0), folder("03-节奏系统")]

  nodes.sort(compareExplorerNodes)

  assert.deepEqual(
    nodes.map((node) => node.displayName),
    ["03-节奏系统", "和弦图读法", "常用七和弦"],
  )
})

test("Explorer falls back to numeric title order when curriculum order is absent or tied", () => {
  const nodes = [file("第10课"), file("第2课"), file("B", 4), file("A", 4)]

  nodes.sort(compareExplorerNodes)

  assert.deepEqual(
    nodes.map((node) => node.displayName),
    ["A", "B", "第2课", "第10课"],
  )
})

test("Explorer comparator remains self-contained when serialized for the browser", () => {
  const revived = Function(
    `return (${compareExplorerNodes.toString()})`,
  )() as typeof compareExplorerNodes
  const nodes = [file("常用七和弦", 6), file("和弦图读法", 0)]

  nodes.sort(revived)

  assert.deepEqual(
    nodes.map((node) => node.displayName),
    ["和弦图读法", "常用七和弦"],
  )
})
