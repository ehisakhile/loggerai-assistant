import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers"
import { ask, BRIEF_PROMPT, parseQuestions, QUESTIONS_PROMPT, system } from "./llm.ts"
import type { Env } from "./index.ts"

// Writes an incident's brief in two retried steps. Only the conversation's id
// passes through the workflow: evidence stays in the Durable Object, so no
// customer data lands in workflow state.

const RETRY = { retries: { limit: 3, delay: "5 seconds", backoff: "exponential" }, timeout: "2 minutes" } as const

const FALLBACK = ["What should I check first?", "What can the evidence rule out?", "What would confirm the likely cause?"]

export class BriefWorkflow extends WorkflowEntrypoint<Env, { conversation: string }> {
  async run(event: WorkflowEvent<{ conversation: string }>, step: WorkflowStep) {
    const stub = this.env.CONVERSATION.get(this.env.CONVERSATION.idFromString(event.payload.conversation))
    try {
      await step.do("write the brief", RETRY, async () => {
        const evidence = await stub.evidence()
        const brief = await ask(this.env.AI, [system(evidence), { role: "user", content: BRIEF_PROMPT }])
        await stub.saveBrief(brief)
      })
      await step.do("suggest questions", RETRY, async () => {
        const evidence = await stub.evidence()
        const { brief } = await stub.view()
        const text = await ask(this.env.AI, [system(evidence), { role: "assistant", content: brief }, { role: "user", content: QUESTIONS_PROMPT }], 120)
        const questions = parseQuestions(text)
        await stub.finish(questions.length ? questions : FALLBACK)
      })
    } catch (e) {
      await step.do("mark as failed", async () => {
        await stub.fail()
      })
      throw e
    }
  }
}
