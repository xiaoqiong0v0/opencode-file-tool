import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { rm } from "node:fs/promises"
import { join } from "node:path"
import { T } from "./i18n.js"
import type { CacheType, FileEntry, FindResult, MessageGroup, TypeStore } from "./config.js"
import { CACHE_DIR, CACHE_EXT, CACHE_TYPES, log, MAX_CACHE_MSGS, MAX_GENERATED } from "./config.js"

export const sessionParents = new Map<string, string>()
export const knownSessions = new Set<string>()

export function getRootSession(sid: string): string {
  let current = sid
  while (sessionParents.has(current)) current = sessionParents.get(current)!
  return current
}

export function findFileInChain(sid: string, type: CacheType, fid: number): FindResult | null {
  const store = readTypeStore(sid, type)
  const file = store.files[fid]
  if (file) return { store, type, file }
  const parentSid = sessionParents.get(sid)
  if (parentSid) return findFileInChain(parentSid, type, fid)
  return null
}

function sessionDir(sid: string): string { return join(CACHE_DIR, sid) }

function filesDir(sid: string): string {
  const d = join(sessionDir(sid), "files")
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

export function readTypeStore(sid: string, type: CacheType): TypeStore {
  try { return JSON.parse(readFileSync(join(sessionDir(sid), `${type}.json`), "utf-8")) }
  catch { return { nextId: 1, files: {} } }
}

export function writeTypeStore(sid: string, type: CacheType, data: TypeStore): void {
  const dir = sessionDir(sid)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${type}.json`), JSON.stringify(data, null, 2))
}

export function readMessages(sid: string): MessageGroup[] {
  try { return JSON.parse(readFileSync(join(sessionDir(sid), "messages.json"), "utf-8")) || [] }
  catch { return [] }
}

export function writeMessages(sid: string, msgs: MessageGroup[]): void {
  const dir = sessionDir(sid)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "messages.json"), JSON.stringify(msgs, null, 2))
}

function removeRefs(sid: string, refs: string[]): number {
  let removed = 0
  for (const ref of refs) {
    const [typeStr, idStr] = ref.split(":")
    const type = typeStr as CacheType
    const fid = parseInt(idStr, 10)
    if (!CACHE_TYPES.includes(type) || isNaN(fid)) continue
    const store = readTypeStore(sid, type)
    if (!store.files[fid]) continue
    delete store.files[fid]
    writeTypeStore(sid, type, store)
    const path = join(filesDir(sid), typeFilepath(type, store, fid))
    rm(path, { force: true }).catch(() => {})
    removed++
  }
  return removed
}

function typeFilepath(type: CacheType, store: TypeStore, fid: number): string {
  const f = store.files[fid]
  return f ? f.filename : `${type}_${fid}.${CACHE_EXT[type]}`
}

export function deleteSession(sid: string): void {
  const dir = join(CACHE_DIR, sid)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

export function removeMsgCache(sid: string, msgId: string): void {
  const msgs = readMessages(sid)
  const idx = msgs.findIndex(m => m.msgId === msgId)
  if (idx < 0) { log.info(`${sid}: msg ${msgId.slice(-8)} not in cache, skip`); return }
  const [msg] = msgs.splice(idx, 1)
  removeRefs(sid, msg.refs)
  writeMessages(sid, msgs)
  log.info(`${sid}: removed msg ${msgId.slice(-8)} (${msg.refs.length} files: ${msg.refs.join(", ")})`)
}

function evictOldMessages(sid: string): void {
  const msgs = readMessages(sid)
  if (msgs.length <= MAX_CACHE_MSGS) return
  const expired = msgs.splice(0, msgs.length - MAX_CACHE_MSGS)
  for (const msg of expired) removeRefs(sid, msg.refs)
  writeMessages(sid, msgs)
}

function evictGenerated(sid: string, type: Exclude<CacheType, "input">): void {
  if (MAX_GENERATED <= 0) return
  const store = readTypeStore(sid, type)
  const ids = Object.keys(store.files).map(Number).sort((a, b) => a - b)
  const overflow = ids.length - MAX_GENERATED
  if (overflow <= 0) return
  for (const fid of ids.slice(0, overflow)) {
    delete store.files[fid]
    const path = join(filesDir(sid), typeFilepath(type, store, fid))
    rm(path, { force: true }).catch(() => {})
    const msgs = readMessages(sid)
    for (const m of msgs) {
      const i = m.refs.indexOf(`${type}:${fid}`)
      if (i >= 0) m.refs.splice(i, 1)
    }
    writeMessages(sid, msgs)
  }
  writeTypeStore(sid, type, store)
}

export function registerFile(sid: string, type: CacheType, filename: string, mime: string, msgId: string, buffer: Buffer): { id: number; path: string } {
  const store = readTypeStore(sid, type)
  const fid = store.nextId++
  store.files[fid] = { id: fid, filename, mime, msgId, cached: true }
  writeTypeStore(sid, type, store)
  const path = join(filesDir(sid), filename)
  writeFileSync(path, buffer)
  const msgs = readMessages(sid)
  const last = msgs[msgs.length - 1]
  const ref = `${type}:${fid}`
  if (last && last.msgId === msgId) {
    last.refs.push(ref)
  } else {
    msgs.push({ msgId, refs: [ref] })
  }
  writeMessages(sid, msgs)
  if (type === "input") evictOldMessages(sid)
  else evictGenerated(sid, type)
  log.info(`${sid}: registered ${type} file ${filename} as ${ref}`)
  return { id: fid, path }
}

export function registerInputFile(sid: string, filename: string, mime: string, msgId: string, dataUrl: string): { id: number; path: string } {
  const b64 = dataUrl.replace(/^data:\w+\/\w+;base64,/, "")
  return registerFile(sid, "input", filename, mime, msgId, Buffer.from(b64, "base64"))
}

export function registerGeneratedFile(sid: string, type: Exclude<CacheType, "input">, filename: string, mime: string, msgId: string, buffer: Buffer): { id: number; path: string } {
  return registerFile(sid, type, filename, mime, msgId, buffer)
}

export function readFileData(sid: string, type: CacheType, fid: number): string | null {
  const found = findFileInChain(sid, type, fid)
  if (!found) return null
  try {
    const buf = readFileSync(join(filesDir(sid), typeFilepath(type, found.store, fid)))
    return `data:${found.file.mime || "image/png"};base64,${buf.toString("base64")}`
  } catch { return null }
}

export async function fetchToBuffer(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!resp.ok) throw new Error(T("err_api", { status: String(resp.status), msg: (await resp.text().catch(() => "unknown")).slice(0, 200) }))
  const buffer = Buffer.from(await resp.arrayBuffer())
  const mime = resp.headers.get("content-type")?.split(";")[0] || "application/octet-stream"
  return { buffer, mime }
}

export function extForMime(mime: string): string {
  const map: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" }
  return map[mime] || "bin"
}

export function buildGenFilename(prefix: string, mime: string, id: number): string {
  return `${prefix}_${id}.${extForMime(mime)}`
}

export function migrateLegacyCache(sid: string): void {
  const oldPath = join(CACHE_DIR, sid, "files.json")
  if (!existsSync(oldPath)) return
  interface LegacyMsg { msgId: string; fileIds: number[] }
  interface LegacyData { nextId: number; files: Record<number, FileEntry>; messages: LegacyMsg[] }
  try {
    const old = JSON.parse(readFileSync(oldPath, "utf-8")) as LegacyData
    const store: TypeStore = { nextId: old.nextId || 1, files: {} }
    const msgs: MessageGroup[] = []
    for (const m of old.messages || []) {
      const refs: string[] = []
      for (const fid of m.fileIds || []) {
        const f = old.files[fid]
        if (!f) continue
        const ext = extForMime(f.mime || "image/png")
        const filename = `input_${fid}.${ext}`
        const src = join(filesDir(sid), fid + ".b64")
        if (existsSync(src)) {
          const b64 = readFileSync(src, "utf-8")
          writeFileSync(join(filesDir(sid), filename), Buffer.from(b64, "base64"))
          rm(src, { force: true }).catch(() => {})
        }
        store.files[fid] = { id: fid, filename, mime: f.mime || "image/png", msgId: f.msgId || m.msgId, cached: f.cached !== false }
        refs.push(`input:${fid}`)
      }
      msgs.push({ msgId: m.msgId, refs })
    }
    writeTypeStore(sid, "input", store)
    writeMessages(sid, msgs)
    rm(oldPath, { force: true }).then(() => log.info(`${sid}: migrated legacy cache`)).catch(() => {})
  } catch (e) {
    log.error(`${sid}: migrate failed`, e instanceof Error ? e : Error(String(e)))
  }
}