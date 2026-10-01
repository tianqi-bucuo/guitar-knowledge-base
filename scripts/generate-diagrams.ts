import { checkDiagrams, generateDiagrams } from "./diagrams/generateDiagrams"

const args = process.argv.slice(2)
const validMode = args.length === 1 && (args[0] === "--write" || args[0] === "--check")

if (!validMode) {
  console.error("Usage: tsx scripts/generate-diagrams.ts (--write|--check)")
  process.exitCode = 2
} else {
  const mode = args[0]
  try {
    const diagrams = await (mode === "--write" ? generateDiagrams : checkDiagrams)({
      dataRoot: "data/diagrams",
      outputRoot: "content/assets/diagrams",
    })
    for (const diagram of diagrams) {
      console.log(`${mode === "--write" ? "WRITE" : "CHECK"} ${diagram.file}`)
    }
    console.log(`DIAGRAMS_${mode === "--write" ? "WRITTEN" : "CURRENT"} ${diagrams.length}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
