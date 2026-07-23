import { tool } from "@opencode-ai/plugin"
import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import createLogger from "@xiaoqiong0v0/opencode-plugin-logger"
import type { Logger } from "@xiaoqiong0v0/opencode-plugin-logger"
import { rm } from "node:fs/promises"
import { join } from "node:path"

const CONFIG_DIR = process.env.HOME || process.env.USERPROFILE || ""
const CONFIG_PATH = join(CONFIG_DIR, ".config/opencode/file-tool.jsonc")
const OPENCODE_CONFIG = join(CONFIG_DIR, ".config/opencode/opencode.json")
const CACHE_DIR = join(CONFIG_DIR, ".opencode/plugins-cache")

interface FileEntry { id: number; filename: string; mime: string; msgId: string }
interface MessageGroup { msgId: string; fileIds: number[] }
interface SessionData { nextId: number; files: Record<number, FileEntry>; messages: MessageGroup[] }
interface Cfg { model?: string; apiKey?: string; apiBaseUrl?: string; baseURL?: string; modelId?: string; maxTokens?: number; timeout?: number; maxCacheMessages?: number; lang?: string }
interface FindResult { store: SessionData; file: FileEntry }

const log: Logger = createLogger("file-tool")

let _cfg: Cfg | null = null
const FILE_TOOL_CFG_SAMPLE = `{
  // 视觉分析模型（provider/modelId），file_tool set-provider 切换
  "model": "",
  "maxTokens": 4096,
  "timeout": 60000,
  "maxFileSizeMB": 20,
  // 缓存消息数量上限，超过则删除最早的
  "maxCacheMessages": 3,
  // 工具提示语言：zh=中文, en=English
  "lang": "en"
}
`

let MAX_CACHE_MSGS = 3
let LANG: "zh" | "en" = "en"

const TX: Record<string, { zh: string; en: string }> = {
  file_not_found:           { zh: "文件不存在: {path}", en: "File not found: {path}" },
  file_id_not_found:        { zh: "文件ID不存在: {id}", en: "File ID not found: {id}" },
  file_data_not_found:      { zh: "文件数据不存在: {id}", en: "File data not found: {id}" },
  not_an_image:             { zh: "不是图片文件: {name} ({mime})", en: "Not an image: {name} ({mime})" },
  unsupported_source:       { zh: "不支持的图片来源: {source}", en: "Unsupported source: {source}" },
  describe_image:           { zh: "请详细描述这张图片（{name}）的内容", en: "Describe this image ({name})" },
  current_model:            { zh: "当前模型: {model}\n可用模型:\n{list}", en: "Current model: {model}\nAvailable models:\n{list}" },
  model_not_set:            { zh: "未设置", en: "not set" },
  model_switched:           { zh: "视觉模型已切换为: {model}", en: "Vision model set to: {model}" },
  specify_model:            { zh: "请指定模型名", en: "Specify a model name" },
  unknown_cmd:              { zh: "未知命令: {cmd}\n可用: list-provider, set-provider <model>, list-cache [all|N|main|main N]", en: "Unknown command: {cmd}\nAvailable: list-provider, set-provider <model>, list-cache [all|N|main|main N]" },
  config_error:             { zh: "请在 file-tool.jsonc 中配置 model (provider/modelId) 或 apiKey+apiBaseUrl+model", en: "Set model (provider/modelId) or apiKey+apiBaseUrl+model in file-tool.jsonc" },
  meta_failed:              { zh: "分析失败", en: "Failed" },
  meta_skip:                { zh: "跳过", en: "Skip" },
  meta_not_found:           { zh: "文件不存在", en: "Not found" },
  meta_image:               { zh: "图片", en: "Image" },
  meta_error:               { zh: "分析出错", en: "Error" },
  no_cache:                 { zh: "[] (无缓存)", en: "[] (no cache)" },
  vision_prompt_default:    { zh: "请详细描述这张图片的内容，返回格式: [文件名] 描述", en: "Describe this image in detail, format: [filename] description" },
  err_resolve_config:       { zh: "无法解析模型配置: {model}。请在 file-tool.jsonc 中配置 model (provider/modelId) 或 apiKey+apiBaseUrl+model", en: "Cannot resolve model config: {model}. Set model (provider/modelId) or apiKey+apiBaseUrl+model in file-tool.jsonc" },
  err_api:                  { zh: "API {status}: {msg}", en: "API {status}: {msg}" },
  empty_response:           { zh: "(空)", en: "(empty)" },
  cmd_desc:                 { zh: "切换视觉分析模型", en: "Switch vision analysis model" },
  cmd_template:             { zh: "直接调用 file_tool 工具。默认 `list-provider`，`set-provider <模型名>` 切换模型，`list-cache` 查看缓存。", en: "Call file_tool tool directly. Default: `list-provider`. Use `set-provider <model>` to switch. Use `list-cache` to view cached files." },
}

const T = (key: string, params?: Record<string, string>): string => {
  const entry = TX[key] || { zh: key, en: key }
  const t = LANG === "zh" ? entry.zh : entry.en
  if (!params) return t
  return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t)
}

function loadCfg() {
  if (!existsSync(CONFIG_PATH)) {
    try { writeFileSync(CONFIG_PATH, FILE_TOOL_CFG_SAMPLE, "utf-8") } catch {}
  }
  const raw: Record<string, unknown> = existsSync(CONFIG_PATH) ? readJsonc(CONFIG_PATH) : {}
  _cfg = resolveConfig(raw)
  MAX_CACHE_MSGS = (raw.maxCacheMessages as number > 0) ? (raw.maxCacheMessages as number) : 3
  LANG = ((raw.lang as string) === "zh" ? "zh" : "en")
  return _cfg
}

function reloadCfg() { loadCfg() }

try { loadCfg() } catch (e) { log.error("初始化失败", e instanceof Error ? e : Error(String(e))) }

const DESC: Record<string, { zh: string; en: string }> = {
  analyze_image: {
    zh: "用多模态模型分析图片。先调 file_tool list-cache 拿到文件ID，再用 file_id:N 分析。",
    en: "Analyze images with multimodal model. Call file_tool list-cache first to get file IDs, then use file_id:N.",
  },
  file_tool: {
    zh: "文件缓存管理。当你在上下文中看到 [Image N] 或收到 Cannot read 图片错误时，立即调 list-cache 获取文件ID，再用 analyze_image file_id:N 分析。",
    en: "File cache manager. When you see [Image N] or a Cannot read image error, call list-cache to get file IDs, then use analyze_image file_id:N.",
  },
  file_tool_args: {
    zh: "list-cache, list-cache main, list-provider, set-provider <model>",
    en: "list-cache, list-cache main, list-provider, set-provider <model>",
  },
  analyze_args_source: { zh: "file_path=file_id:N", en: "file_path=file_id:N" },
  analyze_args_data: { zh: "file_id:N 或 base64", en: "file_id:N or base64" },
  analyze_args_prompt: { zh: "分析提示", en: "prompt" },
}

function getCfg(): Cfg {
  if (_cfg) return _cfg
  const raw = existsSync(CONFIG_PATH) ? readJsonc(CONFIG_PATH) : {}
  _cfg = resolveConfig(raw)
  return _cfg
}

function resolveConfig(fileConfig: Record<string, unknown>): Cfg {
  const model = fileConfig.model as string | undefined
  if (!model) throw new Error(T("config_error"))
  if (fileConfig.apiKey && fileConfig.apiBaseUrl) {
    const mId = model.includes("/") ? model.split("/").pop() : model
    return { model, apiKey: fileConfig.apiKey as string, baseURL: fileConfig.apiBaseUrl as string, modelId: mId, maxTokens: (fileConfig.maxTokens as number) || 4096, timeout: (fileConfig.timeout as number) || 60000 }
  }
  if (model.includes("/")) {
    const [provider, modelId] = model.split("/")
    try {
      const raw = readFileSync(OPENCODE_CONFIG, "utf-8")
      const oc = JSON.parse(raw)
      const prov = oc.provider?.[provider]
      if (prov?.options?.apiKey && prov?.options?.baseURL)
        return { model, apiKey: prov.options.apiKey, baseURL: prov.options.baseURL, modelId, maxTokens: (fileConfig.maxTokens as number) || 4096, timeout: (fileConfig.timeout as number) || 60000 }
    } catch {}
  }
  throw new Error(T("err_resolve_config", { model }))
}

function readJsonc(path: string): Record<string, unknown> {
  const raw = readFileSync(path, "utf-8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
  return JSON.parse(raw)
}

async function callVisionApi(imageUrl: string, prompt: string): Promise<string> {
  const cfg = getCfg()
  const resp = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.modelId, messages: [{ role: "user", content: [{ type: "text", text: prompt || T("vision_prompt_default") }, { type: "image_url" as const, image_url: { url: imageUrl } }] }], max_tokens: cfg.maxTokens }),
    signal: AbortSignal.timeout(cfg.timeout || 60000),
  })
  if (!resp.ok) throw new Error(T("err_api", { status: String(resp.status), msg: (await resp.text().catch(() => "unknown")).slice(0, 200) }))
  const data = await resp.json()
  const msg = data.choices?.[0]?.message
  return msg?.content || msg?.reasoning_content || T("empty_response")
}

const sessionParents = new Map<string, string>()
const knownSessions = new Set<string>()

function getRootSession(sid: string): string {
  let current = sid
  while (sessionParents.has(current)) current = sessionParents.get(current)!
  return current
}

function findFileInChain(sid: string, fid: number): FindResult | null {
  const store = readSession(sid)
  const file = store.files[fid]
  if (file) return { store, file }
  const parentSid = sessionParents.get(sid)
  if (parentSid) return findFileInChain(parentSid, fid)
  return null
}

function sessionDir(sid: string): string { return join(CACHE_DIR, sid) }

function filesDir(sid: string): string {
  const d = join(sessionDir(sid), "files")
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function readSession(sid: string): SessionData {
  try { return JSON.parse(readFileSync(join(sessionDir(sid), "files.json"), "utf-8")) }
  catch { return { nextId: 1, files: {}, messages: [] } }
}

function writeSession(sid: string, data: SessionData): void {
  const dir = sessionDir(sid)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const msgs = data.messages || []
  if (msgs.length > MAX_CACHE_MSGS) {
    const expired = msgs.splice(0, msgs.length - MAX_CACHE_MSGS)
    for (const msg of expired) {
      for (const fid of (msg.fileIds || [])) {
        delete data.files[fid]
        const path = join(dir, "files", fid + ".b64")
        rm(path, { force: true }).then(() => {
          log.info(`${sid}: Deleted file ${path}`)
        }).catch((err: Error) => {
          log.error(`${sid}: Failed to delete file ${path}`, err)
        })
      }
    }
  }
  writeFileSync(join(dir, "files.json"), JSON.stringify(data, null, 2))
}

function writeFileData(sid: string, fid: number, url: string): void {
  const b64 = url.replace(/^data:\w+\/\w+;base64,/, "")
  writeFileSync(join(filesDir(sid), fid + ".b64"), b64, "utf-8")
}

function readFileData(sid: string, fid: number): string | null {
  try {
    const b64 = readFileSync(join(filesDir(sid), fid + ".b64"), "utf-8")
    const meta = readSession(sid).files[fid]
    return `data:${meta?.mime || "image/png"};base64,${b64}`
  } catch {
    const parentSid = sessionParents.get(sid)
    if (parentSid) return readFileData(parentSid, fid)
    return null
  }
}

function deleteSession(sid: string): void {
  const dir = sessionDir(sid)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

// V1 export：工具 + 事件
export const FileTool: Plugin = async () => {
  log.loaded()
  return {
    config: async (config) => {
      const commands = config.command ?? {}
      commands["file-tool"] = { template: T("cmd_template"), description: T("cmd_desc") }
      config.command = commands
    },
    event: async ({ event }) => {
      const props = event.properties as Record<string, unknown> | undefined
      const sid = props?.sessionID as string | undefined
      if (event.type === "session.created" && sid) {
        knownSessions.add(sid)
        if (props?.parentID) sessionParents.set(sid, props.parentID as string)
      }
      if (event.type === "session.updated" && sid) {
        if (!knownSessions.has(sid)) knownSessions.add(sid)
      }
      if (event.type === "session.deleted" && sid) {
        deleteSession(sid)
        knownSessions.delete(sid)
        sessionParents.delete(sid)
        for (const [child, parent] of sessionParents) {
          if (parent === sid) sessionParents.delete(child)
        }
      }
      if (event.type === "message.part.updated") {
        const part = props?.part as Record<string, unknown> | undefined
        if (part?.type === "file" && ((part?.mime as string) || "").startsWith("image/")) {
          const fn = (part.filename || part.name || "") as string
          if (fn) {
            const data = readSession(sid || "")
            if (!sid) return
            const fid = data.nextId++
            const msgId = (part.messageID || "") as string
            data.files[fid] = { id: fid, filename: fn, mime: part.mime as string, msgId }
            writeFileData(sid, fid, (part.url || "") as string)
            const msgs = data.messages
            const last = msgs[msgs.length - 1]
            if (last && last.msgId === msgId) {
              last.fileIds.push(fid)
            } else {
              msgs.push({ msgId, fileIds: [fid] })
            }
            writeSession(sid, data)
          }
        }
      }
    },
    tool: {
      analyze_image: tool({
        description: DESC.analyze_image[LANG],
        args: {
          source: tool.schema.enum(["file_path", "base64"]).describe(DESC.analyze_args_source[LANG]),
          data: tool.schema.string().describe(DESC.analyze_args_data[LANG]),
          prompt: tool.schema.string().optional().describe(DESC.analyze_args_prompt[LANG]),
        },
        execute: async ({ source, data, prompt }, context) => {
          let imageUrl: string, fileName = ""
          if (source === "file_path" && data.startsWith("file_id:")) {
            const fid = parseInt(data.slice(8), 10)
            const found = findFileInChain(context.sessionID, fid)
            if (!found) { context.metadata?.({ title: T("meta_failed") }); return T("file_id_not_found", { id: String(fid) }) }
            const file = found.file
            if (!file.mime.startsWith("image/")) { context.metadata?.({ title: T("meta_skip") }); return T("not_an_image", { name: file.filename, mime: file.mime }) }
            fileName = file.filename
            imageUrl = readFileData(context.sessionID, fid) || ""
            if (!imageUrl) { context.metadata?.({ title: T("meta_failed") }); return T("file_data_not_found", { id: String(fid) }) }
            prompt = prompt || T("describe_image", { name: fileName })
          } else if (source === "file_path") {
            if (!existsSync(data)) {
              const tryPath = join(context.directory, data)
              if (existsSync(tryPath)) data = tryPath
            }
            if (!existsSync(data)) { context.metadata?.({ title: T("meta_not_found") }); return T("file_not_found", { path: data }) }
            const ext = data.split(".").pop()?.toLowerCase() || ""
            const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", bmp: "image/bmp", gif: "image/gif", webp: "image/webp" }
            const mime = mimeMap[ext] || "image/png"
            fileName = data.split(/[/\\]/).pop() || ""
            imageUrl = `data:${mime};base64,${readFileSync(data).toString("base64")}`
          } else if (source === "base64") {
            imageUrl = `data:image/png;base64,${data.replace(/^data:image\/\w+;base64,/, "")}`
          } else { return T("unsupported_source", { source }) }
          try {
            const result = await callVisionApi(imageUrl, prompt || "")
            context.metadata?.({ title: `[Vision] ${fileName || T("meta_image")}`, metadata: { sessionID: context.sessionID, messageID: context.messageID } })
            return "[Vision] " + result
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            context.metadata?.({ title: T("meta_error") })
            return `[Vision Error] ${msg}`
          }
        },
      }),
      file_tool: tool({
        description: DESC.file_tool[LANG],
        args: { command: tool.schema.string().describe(DESC.file_tool_args[LANG]) },
        execute: async ({ command }, context) => {
          const cmd = command.trim()
          if (cmd === "list-provider") {
            const cfg = existsSync(CONFIG_PATH) ? readJsonc(CONFIG_PATH) : {}
            const models: string[] = []
            const oc = JSON.parse(readFileSync(OPENCODE_CONFIG, "utf-8"))
            for (const [pName, pVal] of Object.entries(oc.provider || {}))
              for (const mId of Object.keys((pVal as Record<string, unknown>).models || {}))
                models.push(`${pName}/${mId}`)
            return T("current_model", {
              model: (cfg.model as string) || T("model_not_set"),
              list: models.map(m => "  " + m).join("\n"),
            })
          }
          if (cmd.startsWith("set-provider ")) {
            const model = cmd.slice(13).trim()
            if (!model) return T("specify_model")
            const cfg = existsSync(CONFIG_PATH) ? readJsonc(CONFIG_PATH) : {}
            cfg.model = model; delete cfg.apiKey; delete cfg.apiBaseUrl
            writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
            reloadCfg()
            return T("model_switched", { model })
          }
          if (cmd === "list-cache" || cmd.startsWith("list-cache ")) {
            const arg = cmd === "list-cache" ? "1" : cmd.slice(11).trim()
            let targetSid = context.sessionID
            let limit = arg
            if (arg === "main") { targetSid = getRootSession(context.sessionID); limit = "1" }
            if (arg.startsWith("main ")) { targetSid = getRootSession(context.sessionID); limit = arg.slice(5).trim() }
            const data = readSession(targetSid)
            const msgs = data.messages || []
            if (msgs.length === 0) return `${targetSid}: ${T("no_cache")}`
            let count = msgs.length
            if (limit !== "all") {
              const n = parseInt(limit, 10)
              if (!isNaN(n) && n > 0) count = Math.min(n, count)
            }
            const show = msgs.slice(-count)
            let out = `${targetSid}:\n`
            for (const msg of show) {
              out += `  msg_${msg.msgId.slice(-8)}:\n`
              for (const fid of msg.fileIds) {
                const f = data.files[fid]
                if (f) out += `    ${f.filename}: ${f.id}\n`
              }
            }
            return out.trim()
          }
          return T("unknown_cmd", { cmd })
        },
      }),
    },
  }
}
