# opencode-file-tool

OpenCode 文件缓存与多模态生成插件。自动缓存用户粘贴的图片，通过视觉模型分析；提供文生图、文生视频、文生语音能力，绕过主模型不支持视觉/生成的限制。

## 安装

在 `opencode.json` 的 `plugin` 数组添加包名：

```json
"plugin": ["@xiaoqiong0v0/opencode-file-tool"]
```

重启 OpenCode 后自动安装。首次使用 `file_tool set vision:<模型名>` 配置视觉模型。

## 功能

- **文件缓存** — 粘贴图片时自动缓存到 `~/.opencode/plugins-cache/file-tool/<session>/files/`
- **图片分析** — `file_tool analyze file_id:input:1` 调用视觉模型分析
- **文生图** — `file_tool imagine <提示词>` 生成图片并缓存
- **文生视频** — `file_tool video <提示词>` 异步生成视频（自动按 provider 适配接口）
- **文生语音** — `file_tool tts <文本>` 生成语音
- **会话父子链** — 子 agent 会话可通过 parent 链回退读取祖先会话的缓存
- **开关控制** — 主模型支持视觉时可用 `disable` 关闭缓存
- **多语言** — 工具描述/提示支持中/英文（配置 `lang` 字段）

## 工具

插件仅暴露**一个** `file_tool` 命令行工具，所有操作通过子命令完成（空参数或 `help` 查看完整用法）：

| 子命令 | 说明 |
|--------|------|
| `analyze <file_id:类型:id\|路径\|base64> [提示语]` | 分析图片 |
| `imagine <提示词> [--size 1024x1024]` | 文生图 |
| `video <提示词> [--duration 5]` | 文生视频（异步提交+轮询） |
| `tts <文本> [--voice alloy]` | 文生语音 |
| `list [类型] [数量]` | 查看缓存（input=用户图片 / image/video/tts=生成产物） |
| `providers` | 列出可用模型（优先查各 provider 的 /models 接口） |
| `set [类型:]模型名` | 切换模型（类型: vision/image/video/tts，默认 vision） |
| `status` | 查看缓存开关和各类型模型 |
| `enable` / `disable` | 临时开关缓存 |
| `enable-save` / `disable-save` | 持久化开关缓存（写入配置） |

示例：

```
file_tool analyze file_id:input:1
file_tool imagine "一只橘猫" --size 512x512
file_tool video "日出延时摄影" --duration 5
file_tool tts "你好，欢迎" --voice alloy
file_tool list input
file_tool set image:agnes/agnes-image-2.1-flash
```

### file_id 格式

`file_id:类型:id`，类型与缓存分组对应：

- `input` — 用户粘贴/上传的图片（`list input` 查看）
- `image` / `video` / `tts` — 插件生成的产物（`list image|video|tts` 查看）

各类型 id 独立计数，文件名带类型前缀（如 `input_1.png`、`image_2.png`、`video_1.mp4`）。

## 缓存与淘汰

- 存储目录：`~/.opencode/plugins-cache/file-tool/<session>/`，每类型一个 json（input/image/video/tts）+ `messages.json` 消息关联
- **input 类型**：按消息数量淘汰（`maxCacheMessages`，默认 3）
- **生成类型**：按各自数量上限淘汰（`maxGenerated`，默认 5；0=无限制需手动清理）
- 生成工具返回信息包含缓存文件**绝对路径**，可直接引用/拷贝

## 配置

`~/.config/opencode/file-tool.jsonc` 首次启动自动生成：

```jsonc
{
  "models": {
    "vision": "opencode-go/minimax-m3",  // 图像分析
    "image": "agnes/agnes-image-2.0-flash",  // 文生图
    "video": "agnes/agnes-video-v2.0",   // 文生视频
    "tts": ""                            // 文生语音
  },
  "maxTokens": 4096,
  "timeout": 60000,
  "maxCacheMessages": 3,
  "maxGenerated": 5,
  "lang": "en",
  "enabled": true
}
```

- 模型值支持 `provider/modelId`（引用 opencode.json 的 provider）或 `{ model, apiKey, baseURL }` 内联对象
- 兼容旧顶层 `model`/`apiKey`/`apiBaseUrl` 字段（等价 `models.vision`）
- 保存配置时按模板键清洗，不会残留多余字段

## 视频生成适配

默认按 OpenAI 标准接口（`POST /videos/generations` + 轮询）。按 baseURL 域名自动路由到私有接口：

- `agnes` — `POST /videos` + 轮询 `GET /agnesapi?video_id=`，结果在 `metadata.url`

新增 provider 只需在 `providers.ts` 加适配函数并在 `generateVideo` 路由。

## GitHub

https://github.com/xiaoqiong0v0/opencode-file-tool
