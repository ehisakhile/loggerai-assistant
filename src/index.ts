import { buildEvidence, mask } from "./evidence.ts"
import { SAMPLES } from "./sample.ts"
import type { Conversation } from "./conversation.ts"

export { Conversation } from "./conversation.ts"
export { BriefWorkflow } from "./brief.ts"

export type Env = {
  AI: Ai
  ASSETS: Fetcher
  BRIEF: Workflow<{ conversation: string }>
  CONVERSATION: DurableObjectNamespace<Conversation>
  LIMIT: RateLimit
  LOGGERAI_API: string
  ALLOWED_ORIGINS: string
}

const MAX_MESSAGE = 1000
const PROJECT = /^[A-Za-z0-9_-]{1,80}$/
const INCIDENT = /^\d{1,18}$/
const DEMO_ID = /^[0-9a-f-]{36}$/

class Refused extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } })
}

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("origin") || ""
  if (!env.ALLOWED_ORIGINS.split(",").includes(origin)) return {}
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  }
}

// The dashboard's token goes to the LoggerAI API, which decides what this
// person can see. It's never stored and never reaches the workflow.
async function loggerai(env: Env, req: Request, path: string) {
  const auth = req.headers.get("authorization")
  if (!auth) throw new Refused(401, "Sign in to LoggerAI")
  const res = await fetch(env.LOGGERAI_API + path, { headers: { authorization: auth, accept: "application/json" } })
  if (res.status === 401) throw new Refused(401, "Sign in to LoggerAI")
  if (res.status === 403 || res.status === 404) throw new Refused(404, "Incident not found")
  if (!res.ok) throw new Refused(502, "LoggerAI didn't answer. Try again.")
  return (await res.json()) as Record<string, any>
}

async function sha(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function limit(env: Env, key: string) {
  const { success } = await env.LIMIT.limit({ key })
  if (!success) throw new Refused(429, "Too many requests. Wait a minute and try again.")
}

function target(url: URL, body: Record<string, unknown>) {
  const project = String(body.project ?? url.searchParams.get("project") ?? "")
  const incident = String(body.incident ?? url.searchParams.get("incident") ?? "")
  if (!PROJECT.test(project) || !INCIDENT.test(incident)) throw new Refused(400, "Unknown incident")
  return { project, incident }
}

function stubFor(env: Env, name: string) {
  const id = env.CONVERSATION.idFromName(name)
  return { id, stub: env.CONVERSATION.get(id) }
}

async function open(env: Env, name: string, evidence: string, title: string) {
  const { id, stub } = stubFor(env, name)
  if (await stub.open(evidence, title)) {
    try {
      await env.BRIEF.create({ id: `brief-${id.toString().slice(0, 32)}-${Date.now()}`, params: { conversation: id.toString() } })
    } catch (e) {
      await stub.fail()
      throw e
    }
  }
  return stub.view()
}

function message(body: Record<string, unknown>) {
  const text = typeof body.message === "string" ? body.message.trim() : ""
  if (!text || text.length > MAX_MESSAGE) throw new Refused(400, `Write a message of up to ${MAX_MESSAGE} characters`)
  return mask(text)
}

async function live(env: Env, req: Request, url: URL, body: Record<string, unknown>) {
  const { project, incident } = target(url, body)
  const me = await loggerai(env, req, "/auth/me")
  const name = await sha(`user:${me.id}:${project}:${incident}`)
  if (req.method === "GET") return json(await stubFor(env, name).stub.view())
  if (req.method === "DELETE") {
    await stubFor(env, name).stub.clear()
    return json({ ok: true })
  }
  await limit(env, `user:${me.id}`)
  const data = await loggerai(env, req, `/projects/${project}/obs/incidents/${incident}`)
  const evidence = buildEvidence(data)
  if (url.pathname === "/api/session") return json(await open(env, name, evidence, String(data.name ?? "Incident")))
  const text = message(body)
  await open(env, name, evidence, String(data.name ?? "Incident"))
  return json({ reply: await stubFor(env, name).stub.chat(text) })
}

async function demo(env: Env, req: Request, url: URL, body: Record<string, unknown>) {
  if (url.pathname === "/api/demo/samples") return json(Object.entries(SAMPLES).map(([key, s]) => ({ key, ...(s.card as object) })))
  const id = String(body.id ?? url.searchParams.get("id") ?? "")
  if (!DEMO_ID.test(id)) throw new Refused(400, "Unknown demo")
  const key = String(body.sample ?? url.searchParams.get("sample") ?? "checkout")
  if (!Object.hasOwn(SAMPLES, key)) throw new Refused(400, "Unknown sample")
  const sample = SAMPLES[key]
  const name = key === "checkout" ? `demo:${id}` : `demo:${id}:${key}`
  if (req.method === "GET") return json(await stubFor(env, name).stub.view())
  await limit(env, `ip:${req.headers.get("cf-connecting-ip") ?? "unknown"}`)
  if (url.pathname === "/api/demo/session") return json(await open(env, name, buildEvidence(sample), sample.name))
  const text = message(body)
  await open(env, name, buildEvidence(sample), sample.name)
  return json({ reply: await stubFor(env, name).stub.chat(text) })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req)
    const headers = cors(req, env)
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers })
    try {
      const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
      const res = url.pathname.startsWith("/api/demo/") ? await demo(env, req, url, body)
        : url.pathname === "/api/session" || url.pathname === "/api/chat" ? await live(env, req, url, body)
        : json({ error: "Not found" }, 404)
      Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v))
      return res
    } catch (e) {
      if (e instanceof Refused) return json({ error: e.message }, e.status, headers)
      console.error("assistant failed", e instanceof Error ? e.message : "unknown")
      return json({ error: "The assistant couldn't answer. Try again." }, 500, headers)
    }
  },
} satisfies ExportedHandler<Env>
