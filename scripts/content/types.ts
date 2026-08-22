export const PAGE_TYPES = ["lesson", "path", "index", "glossary"] as const
export const LEVELS = ["零基础", "入门", "基础", "进阶"] as const
export const MODULE_IDS = [
  "start",
  "basics",
  "chords",
  "rhythm",
  "technique",
  "accompaniment",
  "theory",
  "practice",
  "care",
  "reference",
] as const
export const TAGS = [
  "导航",
  "使用说明",
  "学习路线",
  "入门",
  "基础动作",
  "调音",
  "持琴",
  "左手",
  "右手",
  "拨片",
  "和弦",
  "和弦转换",
  "横按和弦",
  "和弦进行",
  "节奏",
  "拍号",
  "节拍器",
  "扫弦",
  "分解和弦",
  "制音",
  "演奏技巧",
  "弹唱",
  "变调夹",
  "移调",
  "编配",
  "乐理",
  "音名",
  "指板",
  "音程",
  "音阶",
  "调性",
  "练习",
  "复盘",
  "测验",
  "安全",
  "保养",
  "排错",
  "术语",
  "索引",
  "来源",
] as const

export type PageType = (typeof PAGE_TYPES)[number]
export type Level = (typeof LEVELS)[number]
export type ModuleId = (typeof MODULE_IDS)[number]
export type Tag = (typeof TAGS)[number]
export type ValidationMode = "author" | "release"
export type Severity = "error" | "warning"

export interface ManifestEntry {
  id: string
  title: string
  module: ModuleId
  type: PageType
  file: string
  permalink: string
  required: boolean
}

export interface Manifest {
  version: 1
  release: { minPages: number; maxPages: number }
  modules: Array<{ id: ModuleId; directory: string; target: number }>
  pages: ManifestEntry[]
}

export interface Diagnostic {
  severity: Severity
  code: string
  file: string
  message: string
}
