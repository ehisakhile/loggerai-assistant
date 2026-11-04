import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers"
import { ask, parseQuestions, system } from "./llm.ts"
import type { Env } from "./index.ts"

// Writes an incident's brief in two retried steps. Only the conversation's id
// passes through the workflow: evidence stays in the Durable Object, so no
// customer data lands in workflow state.

const RETRY = { retries: { limit: 3, delay: "5 seconds", backoff: "exponential" }, timeout: "2 minutes" } as const

const FALLBACK = ["What should I check first?", "What changed just before this started?", "Which users or routes were affected?"]

export class BriefWorkflow extends WorkflowEntrypoint<Env, { conversation: string }> {
  async run(event: WorkflowEvent<{ conversation: string }>, step: WorkflowStep) {
    const stub = this.env.CONVERSATION.get(this.env.CONVERSATION.idFromString(event.payload.conversation))
    try {
      await step.do("write the brief", RETRY, async () => {
        const evidence = await stub.evidence()
        const brief = await ask(this.env.AI, [system(evidence), {
          role: "user",
          content: "Write a brief for the on-call engineer, under 120 words, in three parts labelled What happened, Likely cause, and Check next. Rate your confidence in the cause as low, medium or high, without percentages.",
        }])
        await stub.saveBrief(brief)
      })
      await step.do("suggest questions", RETRY, async () => {
        const evidence = await stub.evidence()
        const text = await ask(this.env.AI, [system(evidence), {
          role: "user",
          content: "Suggest three short questions an on-call engineer should ask about this incident that the evidence can answer. One per line, each ending in a question mark, nothing else.",
        }], 120)
        await stub.finish(parseQuestions(text).length ? parseQuestions(text) : FALLBACK)
      })
    } catch (e) {
      await step.do("mark as failed", async () => {
        await stub.fail()
      })
      throw e
    }
  }
}
