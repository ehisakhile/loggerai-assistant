import test from "node:test"
import assert from "node:assert/strict"
import { buildEvidence, mask } from "../src/evidence.ts"
import { parseQuestions } from "../src/llm.ts"
import { SAMPLES } from "../src/sample.ts"

test("every sample gives the model its evidence, and not the page's card", () => {
  for (const [key, sample] of Object.entries(SAMPLES)) {
    const out = buildEvidence(sample)
    assert.ok(out.includes(sample.name), key)
    assert.ok(!out.includes("timeline") && !out.includes('"card"'), key)
  }
  assert.ok(buildEvidence(SAMPLES["client-secret"]).includes("PaymentStep.tsx:118"))
})

test("secrets and emails are masked", () => {
  const out = mask("user a.b@example.com sent Bearer abc.def and sk_live_abc123")
  assert.ok(!out.includes("example.com") && !out.includes("abc.def") && !out.includes("sk_live_abc123"))
})

test("request samples and unknown fields stay out", () => {
  const out = buildEvidence({ name: "x", samples: [{ user: "secret-user" }], new_field: "secret-new" })
  assert.ok(!out.includes("secret-user") && !out.includes("secret-new"))
})

test("nested values are masked", () => {
  assert.ok(!buildEvidence({ logs: [{ message: "failed for me@example.com" }] }).includes("example.com"))
})

test("evidence stays within the limit however large the incident is", () => {
  const big = Array.from({ length: 200 }, () => ({ message: "x".repeat(2000) }))
  assert.ok(buildEvidence({ name: "x", logs: big, errors: big, findings: big, endpoints: big }).length <= 12000)
})

test("questions lose their bullets and non-questions are dropped", () => {
  assert.deepEqual(parseQuestions("1. Why was it slow?\n- What changed then?\n* Who was hit here?\n4) One more thing?"), ["Why was it slow?", "What changed then?", "Who was hit here?"])
})

test("questions run together on one line are split", () => {
  assert.equal(parseQuestions('"What changed first? Which route was slowest? Did users notice?"').length, 3)
})

test("questions without question marks are kept, and intro lines dropped", () => {
  assert.deepEqual(parseQuestions("Here are three:\nWhat was the duration \nWhich release shipped"), ["What was the duration?", "Which release shipped?"])
})

test("the model sees what served an incident, and which containers restarted", () => {
  const out = buildEvidence({ name: "Slow", served_by: [{ server: "web-1", container: "api" }], containers: [{ name: "api", restarts: 3 }] })
  assert.ok(out.includes('"served_by"') && out.includes('"restarts":3'))
})
