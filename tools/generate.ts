import { tool } from "@opencode-ai/plugin"
import { DESC, T, LANG } from "../i18n.js"
import { requireModelCfg, getCfg } from "../config.js"
import { readTypeStore, registerGeneratedFile, fetchToBuffer, buildGenFilename, extForMime } from "../cache.js"
import { generateVideo } from "../providers.js"
import { genError } from "../utils.js"

const GEN_TIMEOUT = 300000

export const textToImageTool = tool({
  description: DESC.text_to_image[LANG],
  args: {
    prompt: tool.schema.string().describe(DESC.gen_args_prompt[LANG]),
    size: tool.schema.string().optional().describe(DESC.gen_args_size[LANG]),
  },
  execute: async ({ prompt, size }, context) => {
    try {
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
  },
})

export const textToVideoTool = tool({
  description: DESC.text_to_video[LANG],
  args: {
    prompt: tool.schema.string().describe(DESC.gen_args_prompt[LANG]),
    duration: tool.schema.number().optional().describe(DESC.gen_args_duration[LANG]),
  },
  execute: async ({ prompt, duration }, context) => {
    try {
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
  },
})

export const textToSpeechTool = tool({
  description: DESC.text_to_speech[LANG],
  args: {
    text: tool.schema.string().describe(DESC.gen_args_prompt[LANG]),
    voice: tool.schema.string().optional().describe(DESC.gen_args_voice[LANG]),
  },
  execute: async ({ text, voice }, context) => {
    try {
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
  },
})