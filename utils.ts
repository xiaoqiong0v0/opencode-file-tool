import { T } from "./i18n.js"
import type { CacheType } from "./config.js"
import { fetchToBuffer, registerGeneratedFile, buildGenFilename, readTypeStore } from "./cache.js"

export function isAgnesProvider(baseURL: string): boolean {
  return /agnes/i.test(baseURL)
}

export async function postJson(url: string, apiKey: string, body: Record<string, unknown>, timeout = 300000): Promise<any> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  if (!resp.ok) throw new Error(T("err_api", { status: String(resp.status), msg: (await resp.text().catch(() => "unknown")).slice(0, 200) }))
  return resp.json()
}

export async function getJson(url: string, apiKey: string, timeout = 30000): Promise<any> {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(timeout) })
  if (!resp.ok) throw new Error(T("err_api", { status: String(resp.status), msg: (await resp.text().catch(() => "unknown")).slice(0, 200) }))
  return resp.json()
}

export async function downloadAndRegister(context: { sessionID: string; messageID: string }, type: Exclude<CacheType, "input">, url: string): Promise<{ id: number; path: string; mime: string }> {
  const d = await fetchToBuffer(url)
  const store = readTypeStore(context.sessionID, type)
  const r = registerGeneratedFile(context.sessionID, type, buildGenFilename(type, d.mime, store.nextId), d.mime, context.messageID, d.buffer)
  return { id: r.id, path: r.path, mime: d.mime }
}

export function genError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return `[Gen Error] ${msg}`
}