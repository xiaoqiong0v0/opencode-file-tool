import { tool } from "@opencode-ai/plugin"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import stringArgv from "string-argv"
import { parseArgs } from "node:util"
import { T, LANG, DESC } from "../i18n.js"
import type { ModelType, CacheType } from "../config.js"
import { CONFIG_PATH, MODEL_TYPES, CACHE_TYPES, DEFAULT_CFG, getCfg, getProviderNames, readJsonc, ENABLED, setEnabled, saveCfg, requireModelCfg } from "../config.js"
import { readTypeStore, getRootSession, findFileInChain, readFileData, registerGeneratedFile, fetchToBuffer, buildGenFilename, extForMime } from "../cache.js"
import { generateVideo } from "../providers.js"
import { genError } from "../utils.js"
import { localModelList, listModelsApi, currentModelSummary } from "./file_tool_helpers.js"

const GEN_TIMEOUT = 300000

interface Ctx { sessionID: string; messageID: string; directory: string; metadata?: (m: { title: string; metadata?: Record<string, string> }) => void }

// 形如图片路径：含路径分隔符，或以常见图片扩展名结尾
function looksLikeImagePath(s: string): boolean {
  return /[/\\]/.test(s) || /\.(png|jpe?g|bmp|gif|webp)$/i.test(s)
}

function isDataUri(s: string): boolean {
  return s.startsWith("data:")
}

// 粗略判断是否为 base64（严格字符集 + 长度下限，避免把短标识误判为 base64）
function looksLikeBase64(s: string): boolean {
  return s.length >= 64 && /^[A-Za-z0-9+/\r\n]+={0,2}$/.test(s)
}

function helpText(): string {
  if (LANG === "zh") {
    return `用法: file_tool <子命令> [参数]
子命令:
  analyze <入参> [提示语]                          分析图片，入参三选一: file_id:类型:id | 图片路径 | base64
  imagine <提示词> [--size 1024x1024]            文生图
  video <提示词> [--duration 5]                  文生视频(异步)
  tts <文本> [--voice alloy]                     文生语音
  list [类型] [数量]                              缓存列表 (input=用户图/image/video/tts=生成)
  providers                                       列出可用模型
  set [类型:]模型名                                切换模型
  status                                          查看状态
  enable|disable|enable-save|disable-save         缓存开关
  help                                            此帮助
示例:
  file_tool analyze file_id:input:1
  file_tool imagine "一只橘猫" --size 512x512
  file_tool list input
  file_tool set image:agnes/agnes-image-2.1-flash`
  }
  return `Usage: file_tool <subcommand> [args]
Subcommands:
  analyze <input> [prompt]                        analyze image; input: file_id:type:id | image path | base64
  imagine <prompt> [--size 1024x1024]             text-to-image
  video <prompt> [--duration 5]                   text-to-video (async)
  tts <text> [--voice alloy]                      text-to-speech
  list [type] [count]                             list cache (input=user image/image/video/tts=generated)
  providers                                       list available models
  set [type:]model                                switch model
  status                                          show state
  enable|disable|enable-save|disable-save         cache toggle
  help                                            this help
Examples:
  file_tool analyze file_id:input:1
  file_tool imagine "an orange cat" --size 512x512
  file_tool list input
  file_tool set image:agnes/agnes-image-2.1-flash`
}

async function analyzeCmd(args: string[], context: Ctx): Promise<string> {
  const { positionals } = parseArgs({ args, allowPositionals: true })
  let data = positionals[0] || ""
  let prompt = positionals.slice(1).join(" ") || ""
  if (!data) return `${T("specify_model")}\n\n${helpText()}`
  let imageUrl: string, fileName = ""
  if (data.startsWith("file_id:")) {
    const segs = data.slice(8).split(":")
    let type: CacheType = "input"
    let fid: number
    if (segs.length === 2 && CACHE_TYPES.includes(segs[0] as CacheType)) {
      type = segs[0] as CacheType
      fid = parseInt(segs[1], 10)
    } else {
      fid = parseInt(segs[0], 10)
    }
    if (isNaN(fid)) { context.metadata?.({ title: T("meta_error") }); return T("analyze_bad_input", { input: data }) }
    const found = findFileInChain(context.sessionID, type, fid)
    if (!found) {
      const avail = Object.keys(readTypeStore(context.sessionID, type).files)
      context.metadata?.({ title: T("meta_failed") })
      return T("file_id_not_found", { id: data, hint: avail.length ? `\n${T("available_ids", { type, ids: avail.join(", ") })}` : "" })
    }
    const file = found.file
    if (!file.cached) { context.metadata?.({ title: T("meta_skip") }); return T("uncached_hint", { id: data }) }
    if (!file.mime.startsWith("image/")) { context.metadata?.({ title: T("meta_skip") }); return T("not_an_image", { name: file.filename, mime: file.mime }) }
    fileName = file.filename
    imageUrl = readFileData(context.sessionID, type, fid) || ""
    if (!imageUrl) { context.metadata?.({ title: T("meta_failed") }); return T("file_data_not_found", { id: data }) }
    prompt = prompt || T("describe_image", { name: fileName })
  } else if (existsSync(data) || existsSync(join(context.directory, data))) {
    if (!existsSync(data)) data = join(context.directory, data)
    const ext = data.split(".").pop()?.toLowerCase() || ""
    const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", bmp: "image/bmp", gif: "image/gif", webp: "image/webp" }
    const mime = mimeMap[ext] || "image/png"
    fileName = data.split(/[/\\]/).pop() || ""
    imageUrl = `data:${mime};base64,${readFileSync(data).toString("base64")}`
  } else if (looksLikeImagePath(data)) {
    // 像路径但不存在 → 明确报错，避免被误当 base64 发给 API
    context.metadata?.({ title: T("meta_not_found") })
    return T("file_not_found", { path: data })
  } else if (isDataUri(data) || looksLikeBase64(data)) {
    imageUrl = `data:image/png;base64,${data.replace(/^data:image\/\w+;base64,/, "")}`
  } else {
    // 既不是 file_id、也不是路径、也不是 base64 → 本地拦截
    context.metadata?.({ title: T("meta_error") })
    return T("analyze_bad_input", { input: data })
  }
  try {
    const cfg = requireModelCfg("vision")
    const resp = await fetch(`${cfg.baseURL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.modelId, messages: [{ role: "user", content: [{ type: "text", text: prompt || T("vision_prompt_default") }, { type: "image_url" as const, image_url: { url: imageUrl } }] }], max_tokens: getCfg().maxTokens }),
      signal: AbortSignal.timeout(getCfg().timeout || 60000),
    })
    if (!resp.ok) throw new Error(T("err_api", { status: String(resp.status), msg: (await resp.text().catch(() => "unknown")).slice(0, 200) }))
    const d = await resp.json()
    const msg = d.choices?.[0]?.message
    const result = msg?.content || msg?.reasoning_content || T("empty_response")
    context.metadata?.({ title: `[Vision] ${fileName || T("meta_image")}`, metadata: { sessionID: context.sessionID, messageID: context.messageID } })
    return "[Vision] " + result
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    context.metadata?.({ title: T("meta_error") })
    return `[Vision Error] ${msg}`
  }
}

async function imagineCmd(args: string[], context: Ctx): Promise<string> {
  try {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { size: { type: "string" } } })
    const prompt = positionals.join(" ")
    const size = values.size as string | undefined
    const cfg = requireModelCfg("image")
    const body: Record<string, unknown> = { model: cfg.modelId, prompt }
    if (size) body.size = size
    const resp = await fetch(`${cfg.baseURL}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEN_TIMEOUT),
    })
    if (!resp.ok) throw new Error(T("err_api", { status: String(resp.status), msg: (await resp.text().catch(() => "unknown")).slice(0, 200) }))
    const data = await resp.json()
    const item = data?.data?.[0]
    if (!item) throw new Error(T("gen_no_result"))
    let buffer: Buffer, mime = "image/png"
    if (item.b64_json) buffer = Buffer.from(item.b64_json, "base64")
    else if (item.url) { const d = await fetchToBuffer(item.url); buffer = d.buffer; mime = d.mime }
    else throw new Error(T("gen_no_result"))
    const store = readTypeStore(context.sessionID, "image")
    const r = registerGeneratedFile(context.sessionID, "image", buildGenFilename("image", mime, store.nextId), mime, context.messageID, buffer)
    context.metadata?.({ title: "[ImageGen]", metadata: { sessionID: context.sessionID, messageID: context.messageID } })
    return T("image_generated", { name: `image_${r.id}.${extForMime(mime)}`, id: `image:${r.id}`, path: r.path })
  } catch (e: unknown) {
    context.metadata?.({ title: T("meta_error") })
    return genError(e)
  }
}

async function videoCmd(args: string[], context: Ctx): Promise<string> {
  try {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { duration: { type: "string" } } })
    const prompt = positionals.join(" ")
    const duration = values.duration ? parseInt(values.duration as string, 10) : undefined
    const cfg = requireModelCfg("video")
    const url = await generateVideo(cfg, prompt, duration)
    const d = await fetchToBuffer(url)
    const store = readTypeStore(context.sessionID, "video")
    const r = registerGeneratedFile(context.sessionID, "video", buildGenFilename("video", d.mime, store.nextId), d.mime, context.messageID, d.buffer)
    context.metadata?.({ title: "[VideoGen]", metadata: { sessionID: context.sessionID, messageID: context.messageID } })
    return T("video_generated", { name: `video_${r.id}.${extForMime(d.mime)}`, id: `video:${r.id}`, path: r.path })
  } catch (e: unknown) {
    context.metadata?.({ title: T("meta_error") })
    return genError(e)
  }
}

async function ttsCmd(args: string[], context: Ctx): Promise<string> {
  try {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { voice: { type: "string" } } })
    const text = positionals.join(" ")
    const voice = values.voice as string | undefined
    const cfg = requireModelCfg("tts")
    const body: Record<string, unknown> = { model: cfg.modelId, input: text }
    if (voice) body.voice = voice
    const resp = await fetch(`${cfg.baseURL}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEN_TIMEOUT),
    })
    if (!resp.ok) throw new Error(T("err_api", { status: String(resp.status), msg: (await resp.text().catch(() => "unknown")).slice(0, 200) }))
    const buf = Buffer.from(await resp.arrayBuffer())
    const mime = resp.headers.get("content-type")?.split(";")[0] || "audio/mpeg"
    const store = readTypeStore(context.sessionID, "tts")
    const r = registerGeneratedFile(context.sessionID, "tts", buildGenFilename("tts", mime, store.nextId), mime, context.messageID, buf)
    context.metadata?.({ title: "[TTS]", metadata: { sessionID: context.sessionID, messageID: context.messageID } })
    return T("tts_generated", { name: `tts_${r.id}.${extForMime(mime)}`, id: `tts:${r.id}`, path: r.path })
  } catch (e: unknown) {
    context.metadata?.({ title: T("meta_error") })
    return genError(e)
  }
}

async function providersCmd(): Promise<string> {
  const providerNames = getProviderNames()
  const models = await listModelsApi(providerNames)
  const fallbackModels = localModelList()
  for (const m of fallbackModels) if (!models.includes(m)) models.push(m)
  const modelLines = models.map(m => "  " + m).join("\n")
  return T("current_model", { model: currentModelSummary(), list: modelLines })
}

function setCmd(args: string[]): string {
  const { positionals } = parseArgs({ args, allowPositionals: true })
  const arg = positionals.join(":") || positionals[0] || ""
  if (!arg) return T("specify_model")
  let type: ModelType = "vision"
  let model = arg
  const colon = arg.indexOf(":")
  if (colon > 0 && MODEL_TYPES.includes(arg.slice(0, colon) as ModelType)) {
    type = arg.slice(0, colon) as ModelType
    model = arg.slice(colon + 1).trim()
  }
  if (!model) return T("specify_model")
  const cfg = existsSync(CONFIG_PATH) ? readJsonc(CONFIG_PATH) : {}
  const models = { ...(DEFAULT_CFG.models as Record<string, unknown>), ...((cfg.models && typeof cfg.models === "object") ? cfg.models as Record<string, unknown> : {}) }
  models[type] = model
  saveCfg({ models })
  return T("model_switched", { type, model })
}

function statusCmd(): string {
  const c = getCfg()
  const fmt = (t: ModelType) => c.models[t]?.model || T("model_not_set")
  return T("status", { s: ENABLED ? T("enabled") : T("disabled"), m: fmt("vision"), i: fmt("image"), v: fmt("video"), t: fmt("tts") })
}

function listCmd(args: string[], sessionID: string): string {
  const arg = args.join(" ")
  let targetSid = sessionID
  let rest = arg
  if (arg === "main" || arg.startsWith("main ")) {
    targetSid = getRootSession(sessionID)
    rest = arg === "main" ? "" : arg.slice(5).trim()
  }
  const tokens = rest.split(/\s+/).filter(Boolean)
  let filter: CacheType | null = null
  let countStr = "1"
  if (tokens[0] && CACHE_TYPES.includes(tokens[0] as CacheType)) {
    filter = tokens[0] as CacheType
    countStr = tokens[1] || "all"
  } else if (tokens[0]) {
    countStr = tokens[0]
  }
  const types = filter ? [filter] : CACHE_TYPES
  const lines: string[] = []
  for (const type of types) {
    const store = readTypeStore(targetSid, type)
    const entries = Object.values(store.files)
    if (entries.length === 0) continue
    let show = entries
    if (countStr !== "all") {
      const n = parseInt(countStr, 10)
      if (!isNaN(n) && n > 0) show = entries.slice(-n)
    }
    lines.push(`  ${type}:`)
    for (const f of show) {
      const src = f.msgId ? `msg_${f.msgId.slice(-8)}` : type === "input" ? "input" : "generated"
      lines.push(`    ${f.filename} (file_id:${type}:${f.id}) [${src}]`)
    }
  }
  if (lines.length === 0) return `${targetSid}: ${T("no_cache")}`
  return `${targetSid}:\n${lines.join("\n")}`
}

async function handleCommand(raw: string, context: Ctx): Promise<string> {
  const tokens = stringArgv(raw)
  const [cmd, ...rest] = tokens
  if (!cmd) return helpText()
  switch (cmd) {
    case "help": case "h": case "-h": case "--help": return helpText()
    case "analyze": case "a": return analyzeCmd(rest, context)
    case "imagine": case "i": return imagineCmd(rest, context)
    case "video": case "v": return videoCmd(rest, context)
    case "tts": case "t": return ttsCmd(rest, context)
    case "list": case "l": return listCmd(rest, context.sessionID)
    case "providers": case "list-provider": case "p": return providersCmd()
    case "set": case "set-provider": case "s": return setCmd(rest)
    case "status": return statusCmd()
    case "enable": setEnabled(true); return T("enabled")
    case "disable": setEnabled(false); return T("disabled")
    case "enable-save": saveCfg({ enabled: true }); return T("enabled")
    case "disable-save": saveCfg({ enabled: false }); return T("disabled")
    default:
      return T("unknown_cmd", { cmd: cmd.slice(0, 50) }) + "\n\n" + helpText()
  }
}

export const fileToolCli = tool({
  description: DESC.file_tool[LANG],
  args: { command: tool.schema.string().optional().describe(DESC.file_tool_args[LANG]) },
  execute: async ({ command }, context) => {
    return handleCommand(command ?? "help", context as Ctx)
  },
})