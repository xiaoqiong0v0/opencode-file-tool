export let LANG: "zh" | "en" = "en"
export function setLang(lang: string) { LANG = lang === "zh" ? "zh" : "en" }

export const TX: Record<string, { zh: string; en: string }> = {
  file_not_found: { zh: "文件不存在: {path}", en: "File not found: {path}" },
  file_id_not_found: { zh: "文件ID不存在: {id}", en: "File ID not found: {id}" },
  file_data_not_found: { zh: "文件数据不存在: {id}", en: "File data not found: {id}" },
  not_an_image: { zh: "不是图片文件: {name} ({mime})", en: "Not an image: {name} ({mime})" },
  unsupported_source: { zh: "不支持的图片来源: {source}", en: "Unsupported source: {source}" },
  describe_image: { zh: "请详细描述这张图片（{name}）的内容", en: "Describe this image ({name})" },
  current_model: { zh: "当前模型:\n{model}\n可用模型:\n{list}", en: "Current models:\n{model}\nAvailable models:\n{list}" },
  model_not_set: { zh: "未设置", en: "not set" },
  model_switched: { zh: "{type} 模型已切换为: {model}", en: "{type} model set to: {model}" },
  model_types: { zh: "vision: 图像分析, image: 文生图, video: 文生视频, tts: 文生语音", en: "vision: analyze image, image: text-to-image, video: text-to-video, tts: text-to-speech" },
  model_usage: { zh: "用法: set-provider <模型名>（vision，默认）或 set-provider <类型>:<模型名>，如 set-provider image:xxx/yyy", en: "Usage: set-provider <model> (vision, default) or set-provider <type>:<model>, e.g. set-provider image:xxx/yyy" },
  specify_model: { zh: "请指定模型名", en: "Specify a model name" },
  model_not_configured: { zh: "{type} 模型未配置，请在 file-tool.jsonc 的 models 中设置（可用 set-provider 切换）", en: "{type} model not configured, set it in models of file-tool.jsonc (use set-provider)" },
  image_generated: { zh: "图片已生成并缓存: {name} (file_id:{id})\n路径: {path}\n用 analyze_image file_id:{id} 查看", en: "Image generated & cached: {name} (file_id:{id})\nPath: {path}\nuse analyze_image file_id:{id}" },
  video_generated: { zh: "视频已生成并缓存: {name} (file_id:{id})\n路径: {path}", en: "Video generated & cached: {name} (file_id:{id})\nPath: {path}" },
  video_pending: { zh: "视频生成中（任务 {id}），已提交，稍后可查", en: "Video generating (task {id}), submitted, check later" },
  video_failed: { zh: "视频生成失败: {msg}", en: "Video generation failed: {msg}" },
  tts_generated: { zh: "语音已生成并缓存: {name} (file_id:{id})\n路径: {path}", en: "Audio generated & cached: {name} (file_id:{id})\nPath: {path}" },
  gen_failed: { zh: "生成失败: {msg}", en: "Generation failed: {msg}" },
  gen_no_result: { zh: "接口未返回生成结果", en: "No generation result from API" },
  gen_download_failed: { zh: "下载生成结果失败: {url}", en: "Failed to download result: {url}" },
  unknown_cmd: { zh: "未知命令: {cmd}\n可用: list-provider, set-provider [<类型>:]<模型名>, list-cache [类型] [数量], enable, disable, enable-save, disable-save, status", en: "Unknown command: {cmd}\nAvailable: list-provider, set-provider [<type>:]<model>, list-cache [type] [count], enable, disable, enable-save, disable-save, status" },
  config_error: { zh: "请在 file-tool.jsonc 中配置 models.{type}（provider/modelId）或 apiKey+apiBaseUrl+model", en: "Set models.{type} (provider/modelId) or apiKey+apiBaseUrl+model in file-tool.jsonc" },
  meta_failed: { zh: "分析失败", en: "Failed" },
  meta_skip: { zh: "跳过", en: "Skip" },
  meta_not_found: { zh: "文件不存在", en: "Not found" },
  meta_image: { zh: "图片", en: "Image" },
  meta_error: { zh: "分析出错", en: "Error" },
  no_cache: { zh: "[] (无缓存)", en: "[] (no cache)" },
  enabled: { zh: "已启用", en: "Enabled" },
  disabled: { zh: "已禁用", en: "Disabled" },
  status: { zh: "图片缓存: {s}\n视觉模型: {m}\n文生图: {i}\n文生视频: {v}\n文生语音: {t}", en: "Image cache: {s}\nVision: {m}\nImage gen: {i}\nVideo gen: {v}\nTTS: {t}" },
  status_cmd: { zh: "查看缓存开关状态", en: "Show cache status" },
  vision_prompt_default: { zh: "请详细描述这张图片的内容，返回格式: [文件名] 描述", en: "Describe this image in detail, format: [filename] description" },
  err_resolve_config: { zh: "无法解析模型配置: {model}。请在 file-tool.jsonc 中配置 models.{type} (provider/modelId) 或 apiKey+apiBaseUrl+model", en: "Cannot resolve model config: {model}. Set models.{type} (provider/modelId) or apiKey+apiBaseUrl+model in file-tool.jsonc" },
  err_api: { zh: "API {status}: {msg}", en: "API {status}: {msg}" },
  empty_response: { zh: "(空)", en: "(empty)" },
  uncached: { zh: "未缓存", en: "uncached" },
  uncached_hint: { zh: "文件未缓存（id={id}），请先启用缓存再操作", en: "File not cached (id={id}), enable cache first" },
  cmd_desc: { zh: "文件缓存管理 + 多模型配置（视觉/文生图/文生视频/文生语音）", en: "File cache manager + multi-model config (vision/image/video/tts)" },
  cmd_template: { zh: "直接调用 file_tool 工具。`list-provider` 列出模型（优先 API 查询），`set-provider [类型:]模型名` 切换模型（类型: vision/image/video/tts），`list-cache [类型] [数量]` 查看缓存，`enable/disable` 临时开关，`enable-save/disable-save` 持久化开关，`status` 查看状态。", en: "Call file_tool tool directly. `list-provider` list models (API-first), `set-provider [type:]model` switch (type: vision/image/video/tts), `list-cache [type] [count]` view cache, `enable/disable` temp toggle, `enable-save/disable-save` persist toggle, `status` show state." },
}

export const DESC: Record<string, { zh: string; en: string }> = {
  analyze_image: { zh: "用多模态模型分析图片。先调 file_tool list-cache 拿到文件ID，再用 file_id:类型:id 分析。", en: "Analyze images with multimodal model. Call file_tool list-cache first to get file IDs, then use file_id:type:id." },
  text_to_image: { zh: "文生图：根据文本提示生成图片，结果缓存并返回 file_id:类型:id，可用 analyze_image 查看。", en: "Text-to-image: generate an image from a prompt, cached and returned as file_id:type:id." },
  text_to_video: { zh: "文生视频：根据文本提示生成视频（异步提交+轮询），结果缓存并返回 file_id:类型:id。", en: "Text-to-video: generate a video from a prompt (async submit+poll), cached and returned as file_id:type:id." },
  text_to_speech: { zh: "文生语音：将文本转为语音（TTS），结果缓存并返回 file_id:类型:id。", en: "Text-to-speech: convert text to audio, cached and returned as file_id:type:id." },
  file_tool: { zh: "文件缓存管理。当你在上下文中看到 [Image N] 或收到 Cannot read 图片错误时，立即调 list-cache 获取文件ID，再用 analyze_image file_id:类型:id 分析。主模型能直接读取图片时建议用 `disable` 关闭缓存。", en: "File cache manager. When you see [Image N] or a Cannot read image error, call list-cache to get file IDs, then use analyze_image file_id:type:id. If the main model can read images directly, use `disable` to turn off caching." },
  file_tool_args: { zh: "list-cache [类型] [数量]（类型: input/image/video/tts，如 list-cache image 3），list-provider, set-provider [<类型>:]<模型名>, enable/disable（临时）, enable-save/disable-save（持久化）, status — main 前缀查主会话（list-cache main [类型] [数量]）", en: "list-cache [type] [count] (type: input/image/video/tts, e.g. list-cache image 3), list-provider, set-provider [<type>:]<model>, enable/disable (temp), enable-save/disable-save (persist), status — main prefix for root session (list-cache main [type] [count])" },
  analyze_args_source: { zh: "file_path=file_id:类型:id（如 file_id:image:2）", en: "file_path=file_id:type:id (e.g. file_id:image:2)" },
  analyze_args_data: { zh: "file_id:类型:id 或 base64", en: "file_id:type:id or base64" },
  analyze_args_prompt: { zh: "分析提示", en: "prompt" },
  gen_args_prompt: { zh: "生成提示词", en: "generation prompt" },
  gen_args_size: { zh: "图片尺寸（如 1024x1024）", en: "image size (e.g. 1024x1024)" },
  gen_args_duration: { zh: "视频时长（秒）", en: "video duration (seconds)" },
  gen_args_voice: { zh: "音色（如 alloy）", en: "voice (e.g. alloy)" },
}

export function T(key: string, params?: Record<string, string>): string {
  const entry = TX[key] || { zh: key, en: key }
  const t = LANG === "zh" ? entry.zh : entry.en
  if (!params) return t
  return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t)
}