import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import createLogger from "@xiaoqiong0v0/opencode-plugin-logger"
import type { Logger } from "@xiaoqiong0v0/opencode-plugin-logger"
import { T, setLang } from "./i18n.js"

export type ModelType = "vision" | "image" | "video" | "tts"
export const MODEL_TYPES: ModelType[] = ["vision", "image", "video", "tts"]
export type CacheType = "input" | "image" | "video" | "tts"
export const CACHE_TYPES: CacheType[] = ["input", "image", "video", "tts"]
export const CACHE_EXT: Record<CacheType, string> = { input: "bin", image: "png", video: "mp4", tts: "mp3" }

export interface FileEntry { id: number; filename: string; mime: string; msgId: string; cached: boolean }
export interface TypeStore { nextId: number; files: Record<number, FileEntry> }
export interface MessageGroup { msgId: string; refs: string[] }
export interface ModelCfg { model: string; provider: string; modelId: string; apiKey: string; baseURL: string }
export interface Cfg { models: Partial<Record<ModelType, ModelCfg>>; maxTokens: number; timeout: number; maxCacheMessages: number; maxGenerated: number; lang: "zh" | "en"; enabled: boolean }
export interface FindResult { store: TypeStore; type: CacheType; file: FileEntry }

export const log: Logger = createLogger("file-tool")

export const CONFIG_DIR = process.env.HOME || process.env.USERPROFILE || ""
export const CONFIG_PATH = join(CONFIG_DIR, ".config/opencode/file-tool.jsonc")
// opencode 配置文件候选（按加载顺序排列，后者覆盖前者），可能同时存在
const OPENCODE_CONFIG_FILES = ["config.json", "config.jsonc", "opencode.json", "opencode.jsonc"]
export const CACHE_DIR = join(CONFIG_DIR, ".opencode/plugins-cache", "file-tool")

export let _cfg: Cfg | null = null
export let MAX_CACHE_MSGS = 3
export let MAX_GENERATED = 5
export let ENABLED = true
export function setEnabled(v: boolean) { ENABLED = v }

export const FILE_TOOL_CFG_SAMPLE = `{
  "models": {
    "vision": "",
    "image": "",
    "video": "",
    "tts": ""
  },
  "maxTokens": 4096,
  "timeout": 60000,
  "maxCacheMessages": 3,
  "maxGenerated": 5,
  "lang": "en",
  "enabled": true
}
`

export const DEFAULT_CFG: Record<string, unknown> = {
  models: { vision: "", image: "", video: "", tts: "" },
  maxTokens: 4096,
  timeout: 60000,
  maxCacheMessages: 3,
  maxGenerated: 5,
  lang: "en",
  enabled: true,
}

// 去除 JSONC 注释与尾逗号（字符串感知，避免误伤字符串内的 // 如 URL）
function stripJsonc(raw: string): string {
  let out = ""
  let inStr = false
  let escaped = false
  let lineComment = false
  let blockComment = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    const n = raw[i + 1]
    if (lineComment) { if (c === "\n") { lineComment = false; out += c } continue }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++ } continue }
    if (inStr) {
      out += c
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; out += c; continue }
    if (c === "/" && n === "/") { lineComment = true; i++; continue }
    if (c === "/" && n === "*") { blockComment = true; i++; continue }
    out += c
  }
  // 去尾逗号（对象/数组结尾前的逗号）
  return out.replace(/,(\s*[}\]])/g, "$1")
}

export function readJsonc(path: string): Record<string, unknown> {
  return JSON.parse(stripJsonc(readFileSync(path, "utf-8")))
}

// 递归深合并（对象合并，数组/标量覆盖）
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(source)) {
    const cur = target[key]
    if (val && typeof val === "object" && !Array.isArray(val) && cur && typeof cur === "object" && !Array.isArray(cur)) {
      deepMerge(cur as Record<string, unknown>, val as Record<string, unknown>)
    } else {
      target[key] = val
    }
  }
}

let _ocCfg: Record<string, unknown> | null = null

// 统一读取 opencode 配置：按候选顺序（config.json → config.jsonc → opencode.json → opencode.jsonc）
// 逐个读取并深合并，后者覆盖前者；文件不存在或解析失败则跳过，不报错
export function loadOpencodeConfig(): Record<string, unknown> {
  if (_ocCfg) return _ocCfg
  const merged: Record<string, unknown> = {}
  for (const name of OPENCODE_CONFIG_FILES) {
    const path = join(CONFIG_DIR, ".config/opencode", name)
    if (!existsSync(path)) continue
    try { deepMerge(merged, readJsonc(path)) }
    catch (e) { log.error(`Failed to read opencode config ${path}`, e instanceof Error ? e : Error(String(e))) }
  }
  _ocCfg = merged
  return merged
}

// 清空 opencode 配置缓存（配置变更后调用）
export function invalidateOpencodeConfig(): void { _ocCfg = null }

export function splitModel(model: string): { provider: string; modelId: string } {
  const idx = model.indexOf("/")
  return idx >= 0 ? { provider: model.slice(0, idx), modelId: model.slice(idx + 1) } : { provider: "", modelId: model }
}

export function getProviderCreds(provider: string): { apiKey: string; baseURL: string } | null {
  const prov = (loadOpencodeConfig().provider as Record<string, any>)?.[provider]
  if (prov?.options?.apiKey && prov?.options?.baseURL) return { apiKey: prov.options.apiKey, baseURL: prov.options.baseURL }
  return null
}

export function getProviderNames(): Set<string> {
  const names = new Set<string>()
  const providers = (loadOpencodeConfig().provider as Record<string, unknown>) || {}
  for (const [pName, pVal] of Object.entries(providers)) {
    const p = (pVal as Record<string, unknown>).options as Record<string, unknown> | undefined
    if (p?.apiKey && p?.baseURL) names.add(pName)
  }
  return names
}

export function resolveModelRef(ref: unknown, fallbackCreds?: { apiKey: string; baseURL: string }): ModelCfg | undefined {
  let model = ""
  let creds = fallbackCreds
  if (typeof ref === "string" && ref.trim()) {
    model = ref.trim()
  } else if (ref && typeof ref === "object") {
    const o = ref as Record<string, unknown>
    model = (o.model as string) || ""
    const k = (o.apiKey as string) || fallbackCreds?.apiKey
    const u = (o.baseURL as string) || (o.apiBaseUrl as string) || fallbackCreds?.baseURL
    if (k && u) creds = { apiKey: k, baseURL: u }
  }
  if (!model) return undefined
  const { provider, modelId } = splitModel(model)
  if (provider && modelId) {
    const pc = getProviderCreds(provider)
    if (pc) return { model, provider, modelId, ...pc }
  }
  if (creds?.apiKey && creds?.baseURL && modelId) return { model, provider, modelId, ...creds }
  return undefined
}

export function resolveConfig(raw: Record<string, unknown>): Cfg {
  const models: Partial<Record<ModelType, ModelCfg>> = {}
  const fallbackCreds = (raw.apiKey as string) && ((raw.apiBaseUrl as string) || (raw.baseURL as string))
    ? { apiKey: raw.apiKey as string, baseURL: (raw.apiBaseUrl as string) || (raw.baseURL as string) }
    : undefined
  const rawModels = (raw.models && typeof raw.models === "object") ? raw.models as Record<string, unknown> : {}
  for (const type of MODEL_TYPES) {
    const ref = rawModels[type] ?? (type === "vision" ? raw.model : undefined)
    const mc = resolveModelRef(ref, fallbackCreds)
    if (mc) models[type] = mc
  }
  return { models, maxTokens: (raw.maxTokens as number) || 4096, timeout: (raw.timeout as number) || 60000, maxCacheMessages: 3, maxGenerated: (raw.maxGenerated as number) >= 0 ? (raw.maxGenerated as number) : 5, lang: (raw.lang as string) === "zh" ? "zh" : "en", enabled: raw.enabled !== false }
}

export function loadCfg(): Cfg {
  if (!existsSync(CONFIG_PATH)) {
    try { writeFileSync(CONFIG_PATH, FILE_TOOL_CFG_SAMPLE, "utf-8") } catch { }
  }
  const raw: Record<string, unknown> = existsSync(CONFIG_PATH) ? readJsonc(CONFIG_PATH) : {}
  _cfg = resolveConfig(raw)
  MAX_CACHE_MSGS = (raw.maxCacheMessages as number > 0) ? (raw.maxCacheMessages as number) : 3
  MAX_GENERATED = (raw.maxGenerated as number) >= 0 ? (raw.maxGenerated as number) : 5
  ENABLED = raw.enabled !== false
  setLang((raw.lang as string) || "en")
  return _cfg
}

export function reloadCfg() { loadCfg() }

export function getCfg(): Cfg {
  if (_cfg) return _cfg
  const raw = existsSync(CONFIG_PATH) ? readJsonc(CONFIG_PATH) : {}
  _cfg = resolveConfig(raw)
  return _cfg
}

export function getModelCfg(type: ModelType): ModelCfg | undefined {
  return getCfg().models[type]
}

export function requireModelCfg(type: ModelType): ModelCfg {
  const cfg = getModelCfg(type)
  if (!cfg) throw new Error(T("model_not_configured", { type }))
  return cfg
}

export function saveCfg(updates: Record<string, unknown>): void {
  const existing = existsSync(CONFIG_PATH) ? readJsonc(CONFIG_PATH) : {}
  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(DEFAULT_CFG)) {
    if (key in existing) merged[key] = existing[key]
  }
  Object.assign(merged, updates)
  for (const key of Object.keys(DEFAULT_CFG)) {
    if (!(key in merged)) merged[key] = DEFAULT_CFG[key]
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2))
  reloadCfg()
}

export function writeCfgField(key: string, value: unknown): void {
  saveCfg({ [key]: value })
}

try { loadCfg() } catch (e) { log.error("初始化失败", e instanceof Error ? e : Error(String(e))) }