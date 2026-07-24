# opencode-file-tool

OpenCode 文件缓存与图片分析插件。自动缓存用户粘贴的图片，通过多模态模型分析，绕过主模型不支持视觉的限制。

## 安装

在 `opencode.json` 的 `plugin` 数组添加包名：

```json
"plugin": ["@xiaoqiong0v0/opencode-file-tool"]
```

重启 OpenCode 后自动安装。首次使用 `file_tool set-provider <模型名>` 配置视觉模型。

## 功能

- **文件缓存** — 粘贴图片时自动缓存到 `~/.opencode/plugins-cache/`
- **图片分析** — 通过 `analyze_image file_id:N` 调用视觉模型分析
- **会话父子链** — 子 agent 会话可通过 parent 链回退读取祖先会话的缓存
- **多语言** — 支持中/英文提示

## 工具

| 工具 | 说明 |
|------|------|
| `file_tool list-provider` | 列出可用模型 |
| `file_tool set-provider <model>` | 切换视觉模型 |
| `file_tool list-cache [all\|N\|main\|main N]` | 查看缓存文件 |
| `analyze_image file_id:N` | 分析指定图片 |

## 命令

| 命令 | 说明 |
|------|------|
| `/file-tool` | 触发 file_tool 工具 |

## 配置

`~/.config/opencode/file-tool.jsonc` 在首次启动时自动生成。

## GitHub

https://github.com/xiaoqiong0v0/opencode-file-tool
