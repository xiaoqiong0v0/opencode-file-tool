export let LANG: "zh" | "en" = "en"
export function setLang(lang: string) { LANG = lang === "zh" ? "zh" : "en" }

export const TX: Record<string, { zh: string; en: string }> = {
  file_not_found: { zh: "文件不存在: {path}", en: "File not found: {path}" },
  file_id_not_found: { zh: "文件ID不存在: {id}；格式应为 file_id:类型:id（如 file_id:input:1）{hint}", en: "File ID not found: {id}; expected format file_id:type:id (e.g. file_id:input:1){hint}" },
  available_ids: { zh: "可用 {type}: {ids}", en: "Available {type}: {ids}" },
  analyze_bad_input: { zh: "无法识别的图片入参: {input}\n入参三选一: file_id:类型:id（如 file_id:input:1）/ 存在的图片路径 / base64", en: "Unrecognized image input: {input}\nProvide one of: file_id:type:id (e.g. file_id:input:1) / existing image path / base64" },
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
  uncached_hint: { zh: "文件未缓存（{id}），请先启用缓存再操作", en: "File not cached ({id}), enable cache first" },
}

export const DESC: Record<string, { zh: string; en: string }> = {
  file_tool: { zh: "统一命令行工具。子命令: analyze 分析图 / imagine 文生图 / video 文生视频 / tts 文生语音 / list 缓存列表 / providers 模型列表 / set 切换模型 / status / enable-disable。空参数或 help 看用法。", en: "Single CLI tool. Subcommands: analyze image / imagine t2i / video t2v / tts / list cache / providers models / set model / status / enable-disable. Empty or help for usage." },
  file_tool_args: { zh: "完整命令行字符串，如 'list input'、'imagine 一只橘猫'、'analyze file_id:input:1'；空时默认 help。类型: input=用户图片, image/video/tts=生成产物。", en: "Full command string, e.g. 'list input', 'imagine a cat', 'analyze file_id:input:1'; empty defaults to help. Types: input=user image, image/video/tts=generated." },
}

export function T(key: string, params?: Record<string, string>): string {
  const entry = TX[key] || { zh: key, en: key }
  const t = LANG === "zh" ? entry.zh : entry.en
  if (!params) return t
  return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t)
}