# opencode-file-tool

OpenCode 文件缓存与图片分析插件。自动缓存用户粘贴的文件，通过多模态模型分析图片，绕过主模型不支持视觉的限制。

## 安装

```bash
# 在 opencode 配置目录安装依赖
cd ~/.config/opencode
npm install @xiaoqiong0v0/opencode-file-tool @xiaoqiong0v0/opencode-plugin-logger
```

然后在 `opencode.json` 的 `plugin` 数组添加：

```json
"plugin": ["@xiaoqiong0v0/opencode-file-tool"]
```

重启 OpenCode 后，首次使用 `file_tool set-provider <模型名>` 配置视觉模型。

## 功能

- **文件缓存** — 粘贴图片时自动缓存到 `~/.opencode/plugins-cache/{sessionId}/`
- **图片分析** — 通过 `analyze_image file_id:N` 用视觉模型分析
- **主/子会话隔离** — 缓存按会话独立存储，子会话完成自动清理
- **主会话回退** — 子会话可通过 `list-cache main` 读取主会话缓存

## 工具

| 工具 | 说明 |
|------|------|
| `file_tool list-provider` | 列出可用模型提供者 |
| `file_tool set-provider <model>` | 切换视觉分析模型 |
| `file_tool list-cache [all\|N\|main\|main N]` | 查看缓存文件列表 |
| `analyze_image file_id:N` | 用视觉模型分析指定图片 |

## 配置

`~/.config/opencode/file-tool.jsonc` 在首次启动时自动生成，也可手动编辑。

## 依赖

- `@xiaoqiong0v0/opencode-plugin-logger` — 文件日志库

## GitHub

https://github.com/xiaoqiong0v0/opencode-file-tool
