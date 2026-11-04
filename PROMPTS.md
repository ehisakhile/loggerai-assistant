# Prompt history

This project was built with AI assistance, using Claude Code (Claude Opus 5.5). Below are the prompts from the person directing the work, in order, followed by the prompts the app sends to the model.

## Prompts to the coding assistant

1. "I want to apply for this job https://job-boards.greenhouse.io/cloudflare/jobs/8324908 ... update my resume to match the cloudflare opening."
   This produced the suggestion to build the optional assignment as a LoggerAI feature.
2. "Add that feature to loggerai and ship it and also update the resume likewise"

## What the assistant did with them

- Read the LoggerAI API and dashboard, then proposed a separate Worker so the production API needed no changes.
- Wrote the Worker, Durable Object, Workflow, demo page, dashboard card and tests.
- Deployed it and tested it live. Testing found three problems, all fixed:
  - A chat sent before a brief started left the brief waiting forever.
  - Suggested questions came back empty when the model ran them together on one line.
  - The brief invented a percentage for its confidence, so it now uses low, medium or high.

## Prompts the app sends to Llama 3.3

The system prompt is in `src/llm.ts`. The brief and question prompts are in `src/brief.ts`.
