import { DurableObject } from "cloudflare:workers"
import { ask, system, type Turn } from "./llm.ts"
import type { Env } from "./index.ts"

// One conversation: a person and an incident. Holds the evidence, the brief
// and the chat, and deletes itself a week after it was last used.

const KEEP_MS = 7 * 24 * 3600 * 1000
const STUCK_MS = 5 * 60 * 1000
const STORED_TURNS = 40
const SENT_TURNS = 12

type Status = "none" | "pending" | "ready" | "failed"

export class Conversation extends DurableObject<Env> {
  private get<T>(key: string, fallback: T): Promise<T> {
    return this.ctx.storage.get<T>(key).then((v) => v ?? fallback)
  }

  private touch() {
    return this.ctx.storage.setAlarm(Date.now() + KEEP_MS)
  }

  async alarm() {
    await this.ctx.storage.deleteAll()
  }

  /** Keeps the latest evidence. True when a brief needs writing. */
  async open(evidence: string, title: string): Promise<boolean> {
    await this.ctx.storage.put({ evidence, title })
    await this.touch()
    const status = await this.get<Status>("status", "none")
    const started = await this.get("started", 0)
    if (status === "ready" || (status === "pending" && Date.now() - started < STUCK_MS)) return false
    await this.ctx.storage.put({ status: "pending", started: Date.now() })
    return true
  }

  async view() {
    return {
      title: await this.get("title", ""),
      status: await this.get<Status>("status", "none"),
      brief: await this.get("brief", ""),
      questions: await this.get<string[]>("questions", []),
      messages: await this.get<Turn[]>("messages", []),
    }
  }

  evidence() {
    return this.get("evidence", "")
  }

  async saveBrief(brief: string) {
    await this.ctx.storage.put("brief", brief)
  }

  async finish(questions: string[]) {
    await this.ctx.storage.put({ questions, status: "ready" })
  }

  async fail() {
    await this.ctx.storage.put("status", "failed")
  }

  async chat(message: string): Promise<string> {
    const evidence = await this.evidence()
    if (!evidence) throw new Error("Open the incident first")
    const brief = await this.get("brief", "")
    const past = await this.get<Turn[]>("messages", [])
    const user: Turn = { role: "user", content: message }
    const first: Turn[] = brief ? [{ role: "assistant", content: brief }] : []
    const reply = await ask(this.env.AI, [system(evidence), ...first, ...past.slice(-SENT_TURNS), user])
    await this.ctx.storage.put("messages", [...past, user, { role: "assistant", content: reply }].slice(-STORED_TURNS))
    await this.touch()
    return reply
  }

  async clear() {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
  }
}
