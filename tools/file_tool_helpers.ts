import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { T } from "../i18n.js"
import { OPENCODE_CONFIG, CONFIG_DIR, MODEL_TYPES, getProviderCreds, getCfg, log } from "../config.js"

export function localModelList(): string[] {
  const models: string[] = []
  try {
    const oc = JSON.parse(readFileSync(OPENCODE_CONFIG, "utf-8"))
    for (const [pName, pVal] of Object.entries(oc.provider || {}))
      for (const mId of Object.keys((pVal as Record<string, unknown>).models || {}))
        models.push(`${pName}/${mId}`)
  } catch { }
  const modelsJsonPath = join(CONFIG_DIR, ".cache/opencode/models.json")
  if (existsSync(modelsJsonPath)) {
    try {
      const mc = JSON.parse(readFileSync(modelsJsonPath, "utf-8"))
      for (const [pName, pVal] of Object.entries(mc)) {
        const entry = pVal as Record<string, unknown>
        if (entry && typeof entry === "object" && entry.models && typeof entry.models === "object")
          for (const mId of Object.keys(entry.models))
            models.push(`${pName}/${mId}`)
      }
    } catch (e) {
      log.error(`Failed to read model cache ${modelsJsonPath}`, e instanceof Error ? e : Error(String(e)))
    }
  }
  return models
}

export async function listModelsApi(providerNames: Set<string>): Promise<string[]> {
  const results = await Promise.allSettled([...providerNames].map(async (pName) => {
    const creds = getProviderCreds(pName)
    if (!creds) return []
    const base = creds.baseURL.replace(/\/+$/, "")
    const resp = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return []
    const data = await resp.json()
    const list = Array.isArray(data?.data) ? data.data.map((m: { id?: string }) => m?.id).filter(Boolean) : []
    return list.map((m: string) => `${pName}/${m}`)
  }))
  const models: string[] = []
  for (const r of results) if (r.status === "fulfilled") for (const m of r.value) if (!models.includes(m)) models.push(m)
  return models
}

export function currentModelSummary(): string {
  const c = getCfg()
  const lines = MODEL_TYPES.map(t => `  ${t}: ${c.models[t]?.model || T("model_not_set")}`)
  return lines.join("\n")
}