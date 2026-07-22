# opencode-file-tool

OpenCode 文件缓存与图片分析插件。

## 功能

- **文件缓存** — 用户粘贴文件（如图片）时自动缓存到 `~/.opencode/plugins-cache/{sessionId}/`
- **图片分析** — 通过多模态模型分析图片，绕过主模型不支持视觉的限制
- **主/子会话隔离** — 缓存按会话独立存储，子会话完成自动清理
- **主会话回退** — 子会话可通过 `list-cache main` 读取主会话缓存

## 文件结构

```
opencode-file-tool/
├── file-tool.js         # 插件主文件 → 放入 ~/.config/opencode/plugins/
├── command/
│   └── file-tool.md     # 命令定义 → 放入 ~/.config/opencode/command/
└── README.md
```

## 依赖

```bash
npm install -g @xiaoqiong0v0/opencode-plugin-logger
```

## 安装

1. `npm install -g @xiaoqiong0v0/opencode-plugin-logger`
2. 复制 `file-tool.js` 到 `~/.config/opencode/plugins/`
3. （可选）复制 `command/file-tool.md` 到 `~/.config/opencode/command/`
4. 重启 OpenCode
5. 首次使用 `file_tool set-provider <模型名>` 配置视觉模型

## 工具

| 工具 | 说明 |
|------|------|
| `file_tool list-provider` | 列出可用模型提供者 |
| `file_tool set-provider <model>` | 切换视觉分析模型 |
| `file_tool list-cache [all\|N\|main\|main N]` | 查看缓存文件列表 |
| `analyze_image file_id:N` | 用视觉模型分析指定图片 |

## 配置

`~/.config/opencode/plugin-logger.jsonc`:

```jsonc
{
  "enabled": true,             // 启用文件日志
  "timeFormat": "yyyy-MM-dd HH:mm:ss.SSS",
  "retentionDays": 7
}
```
