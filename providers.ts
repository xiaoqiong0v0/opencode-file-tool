import { T } from "./i18n.js"
import type { ModelCfg } from "./config.js"
import { isAgnesProvider, postJson, getJson } from "./utils.js"

// 视频生成 - agnes 私有接口
export async function generateVideoAgnes(cfg: ModelCfg, prompt: string, duration?: number): Promise<string> {
  const dur = duration || 5
  const fps = 24
  const frames = dur * fps + 1
  const data = await postJson(`${cfg.baseURL}/videos`, cfg.apiKey, {
    model: cfg.modelId, prompt, num_frames: Math.min(frames, 441), frame_rate: fps,
  })
  const taskId = data?.id || data?.task_id || data?.video_id
  if (!taskId) throw new Error(T("gen_no_result"))
  const deadline = Date.now() + 600000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 10000))
    const pd = await getJson(`https://apihub.agnes-ai.com/agnesapi?video_id=${taskId}&model_name=${cfg.modelId}`, cfg.apiKey)
    const st = pd?.status || pd?.state || ""
    if (st === "completed") {
      const url = pd?.metadata?.url || pd?.url || ""
      if (url) return url
    } else if (st === "failed" || st === "error") {
      throw new Error(T("video_failed", { msg: pd?.error || st }))
    }
  }
  throw new Error(T("video_failed", { msg: "timeout" }))
}

// 视频生成 - OpenAI 标准接口
export async function generateVideoOpenAI(cfg: ModelCfg, prompt: string, duration?: number): Promise<string> {
  const body: Record<string, unknown> = { model: cfg.modelId, prompt }
  if (duration) body.duration = duration
  const data = await postJson(`${cfg.baseURL}/videos/generations`, cfg.apiKey, body)
  const taskId = data?.id || data?.task_id || data?.data?.[0]?.id
  if (!taskId) throw new Error(T("gen_no_result"))
  const deadline = Date.now() + 600000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 10000))
    const pd = await getJson(`${cfg.baseURL}/videos/generations/${taskId}`, cfg.apiKey)
    const st = pd?.status || pd?.state || ""
    if (st === "completed" || st === "succeeded") {
      const out = pd?.output?.[0] || pd?.output
      const url = typeof out === "string" ? out : out?.url || ""
      if (url) return url
    } else if (st === "failed" || st === "error") {
      throw new Error(T("video_failed", { msg: pd?.error || st }))
    }
  }
  throw new Error(T("video_failed", { msg: "timeout" }))
}

// 视频生成 - 路由：按域名选择适配器
export async function generateVideo(cfg: ModelCfg, prompt: string, duration?: number): Promise<string> {
  if (isAgnesProvider(cfg.baseURL)) return generateVideoAgnes(cfg, prompt, duration)
  return generateVideoOpenAI(cfg, prompt, duration)
}