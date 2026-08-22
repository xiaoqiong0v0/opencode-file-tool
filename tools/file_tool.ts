import { tool } from "@opencode-ai/plugin"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { DESC, T, LANG } from "../i18n.js"
import type { ModelType, CacheType } from "../config.js"
import { CONFIG_PATH, MODEL_TYPES, CACHE_TYPES, DEFAULT_CFG, getCfg, getProviderCreds, getProviderNames, readJsonc, log, ENABLED, setEnabled, saveCfg } from "../config.js"
import { readTypeStore, getRootSession } from "../cache.js"
import { localModelList, listModelsApi, currentModelSummary } from "./file_tool_helpers.js"

export const fileTool = tool({
  description: DESC.file_tool[LANG],
  args: { command: tool.schema.string().describe(DESC.file_tool_args[LANG]) },
  execute: async ({ command }, context) => {
    const cmd = command.trim()
    if (cmd === "list-provider") {
      const providerNames = getProviderNames()
      const models = await listModelsApi(providerNames)
      const fallbackModels = localModelList()
      for (const m of fallbackModels) if (!models.includes(m)) models.push(m)
      const modelLines = models.map(m => "  " + m).join("\n")
      return T("current_model", { model: currentModelSummary(), list: modelLines })
    }
    if (cmd.startsWith("set-provider ")) {
      const arg = cmd.slice(13).trim()
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
    if (cmd === "disable") { setEnabled(false); return T("disabled") }
    if (cmd === "enable") { setEnabled(true); return T("enabled") }
    if (cmd === "disable-save") { saveCfg({ enabled: false }); return T("disabled") }
    if (cmd === "enable-save") { saveCfg({ enabled: true }); return T("enabled") }
    if (cmd === "status") {
      const c = getCfg()
      const fmt = (t: ModelType) => c.models[t]?.model || T("model_not_set")
      return T("status", { s: ENABLED ? T("enabled") : T("disabled"), m: fmt("vision"), i: fmt("image"), v: fmt("video"), t: fmt("tts") })
    }
    if (cmd === "list-cache" || cmd.startsWith("list-cache ")) {
      const rest = cmd === "list-cache" ? "" : cmd.slice(11).trim()
      let targetSid = context.sessionID
      let arg = rest
      if (arg === "main" || arg.startsWith("main ")) {
        targetSid = getRootSession(context.sessionID)
        arg = arg === "main" ? "" : arg.slice(5).trim()
      }
      const tokens = arg.split(/\s+/).filter(Boolean)
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
          lines.push(`    ${f.filename} (${type}:${f.id}) [${src}]`)
        }
      }
      if (lines.length === 0) return `${targetSid}: ${T("no_cache")}`
      return `${targetSid}:\n${lines.join("\n")}`
    }
    return T("unknown_cmd", { cmd })
  },
})