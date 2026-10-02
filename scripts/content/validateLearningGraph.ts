import type { PageRecord } from "./parsePage"
import type { Diagnostic, Manifest, ManifestEntry } from "./types"
import type { ResolvedLink } from "./validateLinks"

function pageFile(page: PageRecord): string {
  return page.contentPath ?? page.file.replace(/^content\//u, "")
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function reachableFrom(roots: Iterable<string>, edges: Map<string, Set<string>>): Set<string> {
  const reached = new Set<string>()
  const pending = [...roots]
  while (pending.length > 0) {
    const file = pending.pop()!
    if (reached.has(file)) continue
    reached.add(file)
    pending.push(...(edges.get(file) ?? []))
  }
  return reached
}

function cycleComponents(edges: Map<string, Set<string>>): string[][] {
  let nextIndex = 0
  const indexes = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const cycles: string[][] = []

  function visit(file: string): void {
    const index = nextIndex++
    indexes.set(file, index)
    lowLinks.set(file, index)
    stack.push(file)
    onStack.add(file)
    for (const target of edges.get(file) ?? []) {
      if (!indexes.has(target)) {
        visit(target)
        lowLinks.set(file, Math.min(lowLinks.get(file)!, lowLinks.get(target)!))
      } else if (onStack.has(target)) {
        lowLinks.set(file, Math.min(lowLinks.get(file)!, indexes.get(target)!))
      }
    }
    if (lowLinks.get(file) !== index) return
    const component: string[] = []
    let member: string
    do {
      member = stack.pop()!
      onStack.delete(member)
      component.push(member)
    } while (member !== file)
    // Self prerequisites have their own diagnostic, rather than a second cycle error.
    if (component.length > 1) cycles.push(component.sort(compareText))
  }

  for (const file of edges.keys()) {
    if (!indexes.has(file)) visit(file)
  }
  return cycles
}

export function validateLearningGraph(
  pages: PageRecord[],
  manifest: Manifest,
  links: ResolvedLink[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const add = (code: string, file: string, message: string): void => {
    diagnostics.push({ severity: "error", code, file, message })
  }
  const entriesByFile = new Map(manifest.pages.map((entry) => [entry.file, entry]))
  const order = new Map(manifest.pages.map((entry, index) => [entry.file, index]))
  const entriesByTitle = new Map<string, ManifestEntry[]>()
  for (const entry of manifest.pages) {
    const matches = entriesByTitle.get(entry.title) ?? []
    matches.push(entry)
    entriesByTitle.set(entry.title, matches)
  }

  const pagesByFile = new Map(pages.map((page) => [pageFile(page), page]))
  const prerequisites = new Map<string, Set<string>>()
  const navigation = new Map<string, Set<string>>()
  for (const [file, page] of pagesByFile) {
    prerequisites.set(file, new Set())
    navigation.set(file, new Set())
    if (!entriesByFile.has(file)) {
      add("LEARNING_PAGE_NOT_IN_MANIFEST", file, "学习图页面缺少 manifest 身份")
      continue
    }
    const titles = page.frontmatter.prerequisites
    if (!Array.isArray(titles)) continue // Metadata validation handles malformed lists.
    for (const title of new Set(titles)) {
      if (typeof title !== "string" || title.trim() === "") continue
      const matches = entriesByTitle.get(title.trim()) ?? []
      if (matches.length === 0) {
        add("PREREQUISITE_MISSING", file, `先修知识不匹配 manifest 标题: ${title}`)
        continue
      }
      if (matches.length > 1) {
        add("PREREQUISITE_AMBIGUOUS", file, `先修知识匹配多个 manifest 页面: ${title}`)
        continue
      }
      const target = matches[0].file
      if (!pagesByFile.has(target)) {
        add("PREREQUISITE_PAGE_MISSING", file, `先修知识页面尚不存在: ${target}`)
        continue
      }
      if (target === file) {
        add("PREREQUISITE_SELF", file, `页面不能以自身为先修知识: ${title}`)
        continue
      }
      prerequisites.get(file)!.add(target)
      if (order.get(target)! > order.get(file)!) {
        add("PREREQUISITE_POINTS_FORWARD", file, `先修知识位于 manifest 后方: ${target}`)
      }
    }
  }

  for (const component of cycleComponents(prerequisites)) {
    add("PREREQUISITE_CYCLE", component[0], `先修知识形成循环: ${component.join("、")}`)
  }

  for (const link of links) {
    const target = link.target.split("#", 1)[0]
    if (pagesByFile.has(target)) navigation.get(link.source)?.add(target)
  }
  const roots: string[] = []
  for (const id of ["home", "learning-path"]) {
    const entry = manifest.pages.find((candidate) => candidate.id === id)
    if (!entry) {
      add("LEARNING_ROOT_MISSING", "", `manifest 缺少学习图入口: ${id}`)
    } else if (!pagesByFile.has(entry.file)) {
      add("LEARNING_ROOT_PAGE_MISSING", entry.file, `学习图入口页面尚不存在: ${id}`)
    } else {
      roots.push(entry.file)
    }
  }
  const reachable = reachableFrom(roots, navigation)
  for (const file of pagesByFile.keys()) {
    if (entriesByFile.has(file) && !reachable.has(file)) {
      add("UNREACHABLE_PAGE", file, "页面无法从首页或学习路线通过内部链接到达")
    }
  }

  return [...new Map(diagnostics.map((item) => [JSON.stringify(item), item])).values()].sort(
    (left, right) =>
      compareText(left.file, right.file) ||
      compareText(left.code, right.code) ||
      compareText(left.message, right.message),
  )
}
