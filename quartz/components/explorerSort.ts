export interface ExplorerSortableNode {
  isFolder: boolean
  displayName: string
  data: null | { order?: number }
}

export function compareExplorerNodes(a: ExplorerSortableNode, b: ExplorerSortableNode): number {
  if (a.isFolder !== b.isFolder) {
    return a.isFolder ? -1 : 1
  }

  if (!a.isFolder && !b.isFolder) {
    const aOrder = a.data?.order
    const bOrder = b.data?.order
    const aHasOrder = typeof aOrder === "number" && Number.isFinite(aOrder)
    const bHasOrder = typeof bOrder === "number" && Number.isFinite(bOrder)

    if (aHasOrder !== bHasOrder) {
      return aHasOrder ? -1 : 1
    }
    if (aHasOrder && bHasOrder && aOrder !== bOrder) {
      return aOrder - bOrder
    }
  }

  return a.displayName.localeCompare(b.displayName, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}
