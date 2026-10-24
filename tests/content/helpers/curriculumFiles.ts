import path from "node:path"
import { loadManifest } from "../../../scripts/content/loadManifest"

const manifest = loadManifest("data/content-manifest.yml")

export function curriculumFile(title: string): string {
  const matches = manifest.pages.filter((page) => page.title === title)
  if (matches.length !== 1) {
    throw new Error(`expected one curriculum page titled ${title}, found ${matches.length}`)
  }
  return matches[0].file
}

export function curriculumStem(title: string): string {
  return curriculumFile(title).replace(/\.md$/u, "")
}

export function contentFile(title: string, root = "content"): string {
  return path.join(root, curriculumFile(title))
}
