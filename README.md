# LoggerAI Incident Assistant

An AI assistant for production incidents, built on Cloudflare. It writes a brief for the on-call engineer and answers questions about the incident, using only the evidence LoggerAI collected.

**Try it, no account needed:** https://loggerai-assistant.akhileehis.workers.dev

In [LoggerAI](https://loggerai.uk), it's the "Explain this incident" card on each incident page.

## How it meets the assignment

| Component | What's used | Where |
|---|---|---|
| LLM | Llama 3.3 70B on Workers AI | `src/llm.ts` |
| Workflow and coordination | Cloudflare Workflows write the brief and suggest questions in two retried steps | `src/brief.ts` |
| User input | Chat on Workers static assets, and in the LoggerAI dashboard | `public/index.html` |
| Memory and state | One Durable Object per person and incident holds the evidence, brief and chat | `src/conversation.ts` |

```
Browser ──> Worker ──> LoggerAI API   (checks the person can see this incident)
              │
              ├──> Durable Object     (evidence, brief, chat)
              │         └──> Workers AI
              └──> Workflow ──> Durable Object ──> Workers AI
```

## Design decisions

- **The LoggerAI API stays in charge of access.** The Worker forwards the signed-in person's token and stores nothing it could use later. A conversation's id comes from the user, project and incident, so nobody can reach someone else's.
- **Customer data stays out of workflow state.** Only the Durable Object's id passes through the workflow.
- **The model sees an allow-list of fields.** New API fields stay out until they're added, request samples are never sent, and secrets and emails are masked again before use.
- **Logs are untrusted.** Anyone can put text in a log, so evidence is marked as data. The assistant has no tools and its output is shown as plain text, so a prompt injection can't take any action.
- **Nothing goes to the AI until someone asks.** The dashboard card waits for a click.
- **Conversations expire.** Each deletes itself 7 days after its last use, and people can clear one sooner.
- **Requests are limited** to about 10 a minute per person or IP address. The limit is approximate, because it's counted per Cloudflare location.

## Run it

```sh
npm install
npm test
npm run dev
npm run deploy
```

Prompt history is in [PROMPTS.md](PROMPTS.md).
