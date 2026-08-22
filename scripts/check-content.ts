import { resolve } from "node:path"
import { validateContent, type ValidationOptions } from "./content/validateContent"
import type { ValidationMode } from "./content/types"

interface CliOptions extends ValidationOptions {}

function usageError(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}

function parseArguments(args: string[]): CliOptions {
  let mode: ValidationMode = "author"
  let contentRoot = "content"
  let manifestPath = "data/content-manifest.yml"

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (!["--mode", "--content-root", "--manifest"].includes(argument)) {
      usageError(`未知参数: ${argument}`)
    }
    const value = args[index + 1]
    if (value === undefined || value.startsWith("--")) {
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

function displayFile(file: string): string {
  if (file === "") return "content/"
  if (file.startsWith("data/")) return file
  if (file.includes("/data/") || file.endsWith("content-manifest.yml")) return file
  return file.startsWith("content/") ? file : `content/${file}`
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
      `${item.severity.toUpperCase()} ${item.code} ${displayFile(item.file)}: ${item.message}\n`,
    )
  }
  const errors = diagnostics.filter((item) => item.severity === "error").length
  const warnings = diagnostics.length - errors
  process.stdout.write(`Summary: ${errors} error(s), ${warnings} warning(s)\n`)
  process.exitCode = errors > 0 ? 1 : 0
}

await main()
