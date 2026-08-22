import { resolve } from "node:path"
import { validateContent, type ValidationOptions } from "./content/validateContent"
import type { Diagnostic, ValidationMode } from "./content/types"

interface CliOptions extends ValidationOptions {}

function usageError(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}

function parseArguments(args: string[]): CliOptions {
  let mode: ValidationMode = "author"
  let contentRoot = "content"
  let manifestPath = "data/content-manifest.yml"
  const seen = new Set<string>()

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (!["--mode", "--content-root", "--manifest"].includes(argument)) {
      usageError(`未知参数: ${argument}`)
    }
    if (seen.has(argument)) {
      usageError(`参数不能重复: ${argument}`)
    }
    seen.add(argument)
    const rawValue = args[index + 1]
    const value = rawValue?.trim()
    if (value === undefined || value.length === 0 || value.startsWith("--")) {
      usageError(`参数缺少值: ${argument}`)
    }
    index += 1
    if (argument === "--mode") {
      if (value !== "author" && value !== "release") {
        usageError(`无效 mode: ${value}`)
      }
      mode = value
    } else if (argument === "--content-root") {
      contentRoot = value
    } else {
      manifestPath = value
    }
  }

  return { mode, contentRoot: resolve(contentRoot), manifestPath: resolve(manifestPath) }
}

function displayFile(item: Diagnostic): string {
  const file = item.file.replace(/[\r\n]+/g, " ")
  if (item.namespace === "manifest") return file
  if (file === "") return "content/"
  return file.startsWith("content/") ? file : `content/${file}`
}

function singleLine(message: string): string {
  return message.replace(/[\r\n]+/g, " ")
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2))
  let diagnostics
  try {
    diagnostics = await validateContent(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    usageError(`无法启动内容校验: ${message}`)
  }

  for (const item of diagnostics) {
    process.stdout.write(
      `${item.severity.toUpperCase()} ${item.code} ${displayFile(item)}: ${singleLine(item.message)}\n`,
    )
  }
  const errors = diagnostics.filter((item) => item.severity === "error").length
  const warnings = diagnostics.length - errors
  process.stdout.write(`Summary: ${errors} error(s), ${warnings} warning(s)\n`)
  process.exitCode = errors > 0 ? 1 : 0
}

await main()
