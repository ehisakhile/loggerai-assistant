// A made-up incident for the public demo. It isn't customer data.
export const SAMPLE_INCIDENT = {
  name: "Checkout latency", label: "p95 latency", scope: "POST /api/checkout", status: "resolved",
  fired_at: "2026-11-02T14:06:00Z", ended_at: "2026-11-02T14:41:00Z", minutes: 35,
  value_text: "5.0 s", threshold_text: "1.5 s", peak_text: "5.0 s",
  summary: "POST /api/checkout slowed to the 5.0 s payment timeout minutes after release v2.14.0.",
  message: "p95 latency on POST /api/checkout is above 1.5 s",
  findings: [
    { severity: "critical", title: "Payment provider calls hit the 5.0 s timeout", detail: "p95 for api.payments.example went from 240 ms to 5.0 s." },
    { severity: "warning", title: "Release v2.14.0 went out 4 minutes before the alert", detail: "It's the only release in the window." },
    { severity: "info", title: "Server CPU and memory stayed normal", detail: "CPU 38%, memory 61%." },
  ],
  endpoints: [
    { method: "POST", route: "/api/checkout", base: { count: 4120, p95: 310, errors: 3 }, bad: { count: 3980, p95: 5010, errors: 412 } },
    { method: "GET", route: "/api/cart", base: { count: 9800, p95: 85, errors: 0 }, bad: { count: 9650, p95: 91, errors: 1 } },
  ],
  dependencies: [{ name: "api.payments.example", base_p95: 240, bad_p95: 5000, failures: 398 }],
  errors: [{ type: "TimeoutError", message: "payment request timed out after 5000 ms", route: "/api/checkout", count: 398, users: 61, first_seen_in_window: true }],
  releases: [{ version: "v2.14.0", deployed_at: "2026-11-02T14:02:00Z", changes: "Payment client moved to a new connection pool" }],
  checks: [{ name: "database", status: "ok" }, { name: "redis", status: "ok" }],
  servers: [{ host: "web-1", cpu: 38, memory: 61 }, { host: "web-2", cpu: 36, memory: 60 }],
  logs: [
    { level: "error", message: "payment request timed out after 5000 ms", count: 398 },
    { level: "warning", message: "payment pool exhausted: 10 of 10 connections in use", count: 276 },
  ],
  related: [],
}
