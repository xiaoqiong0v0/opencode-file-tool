import { tool } from "@opencode-ai/plugin"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { DESC, T, LANG } from "../i18n.js"
import type { CacheType } from "../config.js"
import { requireModelCfg, getCfg } from "../config.js"
import { findFileInChain, readFileData } from "../cache.js"

const CACHE_TYPES_LIST: CacheType[] = ["input", "image", "video", "tts"]

export const analyzeImageTool = tool({
  description: DESC.analyze_image[LANG],
  args: {
    source: tool.schema.enum(["file_path", "base64"]).describe(DESC.analyze_args_source[LANG]),
    data: tool.schema.string().describe(DESC.analyze_args_data[LANG]),
    prompt: tool.schema.string().optional().describe(DESC.analyze_args_prompt[LANG]),
  },
  execute: async ({ source, data, prompt }, context) => {
    let imageUrl: string, fileName = ""
    if (source === "file_path" && data.startsWith("file_id:")) {
      const segs = data.slice(8).split(":")
      let type: CacheType = "input"
      let fid: number
      if (segs.length === 2 && CACHE_TYPES_LIST.includes(segs[0] as CacheType)) {
        type = segs[0] as CacheType
        fid = parseInt(segs[1], 10)
      } else {
        fid = parseInt(segs[0], 10)
      }
      const found = findFileInChain(context.sessionID, type, fid)
      if (!found) { context.metadata?.({ title: T("meta_failed") }); return T("file_id_not_found", { id: `${type}:${fid}` }) }
      const file = found.file
      if (!file.cached) { context.metadata?.({ title: T("meta_skip") }); return T("uncached_hint", { id: `${type}:${fid}` }) }
      if (!file.mime.startsWith("image/")) { context.metadata?.({ title: T("meta_skip") }); return T("not_an_image", { name: file.filename, mime: file.mime }) }
      fileName = file.filename
      imageUrl = readFileData(context.sessionID, type, fid) || ""
      if (!imageUrl) { context.metadata?.({ title: T("meta_failed") }); return T("file_data_not_found", { id: `${type}:${fid}` }) }
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
      const cfg = requireModelCfg("vision")
      const resp = await fetch(`${cfg.baseURL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: cfg.modelId, messages: [{ role: "user", content: [{ type: "text", text: prompt || T("vision_prompt_default") }, { type: "image_url" as const, image_url: { url: imageUrl } }] }], max_tokens: getCfg().maxTokens }),
        signal: AbortSignal.timeout(getCfg().timeout || 60000),
      })
      if (!resp.ok) throw new Error(T("err_api", { status: String(resp.status), msg: (await resp.text().catch(() => "unknown")).slice(0, 200) }))
      const data = await resp.json()
      const msg = data.choices?.[0]?.message
      const result = msg?.content || msg?.reasoning_content || T("empty_response")
      context.metadata?.({ title: `[Vision] ${fileName || T("meta_image")}`, metadata: { sessionID: context.sessionID, messageID: context.messageID } })
      return "[Vision] " + result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      context.metadata?.({ title: T("meta_error") })
      return `[Vision Error] ${msg}`
    }
  },
})