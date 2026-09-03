import type { Plugin } from "@opencode-ai/plugin"
import { log, ENABLED, loadCfg } from "./config.js"
import { registerInputFile, migrateLegacyCache, knownSessions, sessionParents, deleteSession, removeMsgCache, extForMime } from "./cache.js"
import { fileToolCli } from "./tools/cli.js"

try { loadCfg() } catch (e) { log.error("初始化失败", e instanceof Error ? e : Error(String(e))) }

export const fileToolPlugin: Plugin = async () => {
  log.loaded()
  return {
    event: async ({ event }) => {
      const props = event.properties as Record<string, unknown> | undefined
      const sid = props?.sessionID as string | undefined
      if (event.type === "session.created" && sid) {
        knownSessions.add(sid)
        if (props?.parentID) sessionParents.set(sid, props.parentID as string)
        migrateLegacyCache(sid)
      }
      if (event.type === "session.updated" && sid) {
        if (!knownSessions.has(sid)) knownSessions.add(sid)
      }
      if (event.type === "session.deleted" && sid) {
        deleteSession(sid)
        knownSessions.delete(sid)
        sessionParents.delete(sid)
        for (const [child, parent] of sessionParents) {
          if (parent === sid) sessionParents.delete(child)
        }
      }
      if (event.type === "message.part.updated") {
        const part = props?.part as Record<string, unknown> | undefined
        if (part?.type === "file" && ((part?.mime as string) || "").startsWith("image/")) {
          const fn = (part.filename || part.name || "") as string
          if (fn && sid) {
            const msgId = (part.messageID || "") as string
            if (ENABLED) {
              const ext = extForMime((part.mime as string) || "image/png")
              const r = registerInputFile(sid, `input_${Date.now() % 100000}.${ext}`, (part.mime as string) || "image/png", msgId, (part.url || "") as string)
              log.info(`${sid}: cached ${fn} as input:${r.id}`)
            } else {
              log.info(`${sid}: skip cache ${fn} (disabled)`)
            }
          }
        }
      }
      if (event.type === "message.removed" && sid) {
        const msgId = (props?.messageID as string) || ""
        log.info(`${sid}: message.removed msgId=${msgId.slice(-8) || "(empty)"}`)
        if (msgId) removeMsgCache(sid, msgId)
      }
      if (event.type === "message.part.removed" && sid) {
        const msgId = (props?.messageID as string) || ((props?.info as Record<string, unknown>)?.id as string) || ""
        log.info(`${sid}: message.part.removed msgId=${msgId.slice(-8) || "(empty)"}`)
        if (msgId) removeMsgCache(sid, msgId)
      }
    },
    tool: {
      file_tool: fileToolCli,
    },
  }
}

export default fileToolPlugin