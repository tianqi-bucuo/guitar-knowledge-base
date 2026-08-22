import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const checker = fileURLToPath(new URL("../../scripts/check-site-output.ts", import.meta.url))
const tsxImport = import.meta.resolve("tsx")
const stylesheet =
  'html:root{--bodyFont:"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif;--headerFont:"Noto Serif CJK SC","Songti SC",serif;}'

function createOutputFixture(nestedMeta = ""): string {
  const root = mkdtempSync(join(tmpdir(), "guitar-site-output-"))
  const publicDir = join(root, "public")
  mkdirSync(join(publicDir, "static"), { recursive: true })
  mkdirSync(join(publicDir, "guide"), { recursive: true })
  writeFileSync(join(publicDir, "index.html"), "<!doctype html><title>首页</title>", "utf8")
  writeFileSync(join(publicDir, "guide", "index.html"), `<!doctype html>${nestedMeta}`, "utf8")
  writeFileSync(join(publicDir, "index.css"), stylesheet, "utf8")
  writeFileSync(join(publicDir, "static", "contentIndex.json"), "{}", "utf8")
  return root
}

function runChecker(root: string) {
  return spawnSync(process.execPath, ["--import", tsxImport, checker], {
    cwd: root,
    encoding: "utf8",
  })
}

test("site output checker rejects invalid social metadata in every generated HTML page", () => {
  for (const content of [
    "https://undefined/static/og-image.png",
    "https://example.com/static/og-image.png",
    "/static/og-image.png",
  ]) {
    const root = createOutputFixture(`<meta property="og:image" content="${content}">`)
    try {
      const result = runChecker(root)
      assert.equal(result.status, 1, `${content}\n${result.stdout}\n${result.stderr}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test("site output checker accepts a valid absolute social image URL", () => {
  const root = createOutputFixture(
    '<meta property="og:image" content="https://kb.example.test/static/og-image.png">',
  )
  try {
    const result = runChecker(root)
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
