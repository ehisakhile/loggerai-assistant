// What the model is allowed to see of an incident. Fields are picked one by
// one, so anything new in the API stays out until it's added here. Request
// samples are left out on purpose: they can hold user ids.

const MAX_CHARS = 12000

const MASKS: [RegExp, string][] = [
  [/\b(sk|pk)_live_[A-Za-z0-9]+/g, "[key]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [token]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, "[token]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
]

export function mask(text: string): string {
  return MASKS.reduce((t, [re, to]) => t.replace(re, to), text)
}

function clean<T>(v: T): T {
  if (typeof v === "string") return mask(v).slice(0, 600) as T
  if (Array.isArray(v)) return v.map(clean) as T
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) as T
  return v
}

type Raw = Record<string, any>
const list = (v: unknown, n: number): any[] => (Array.isArray(v) ? v.slice(0, n) : [])

export function buildEvidence(i: Raw): string {
  const pick = (logs: number, errors: number) => ({
    name: i.name, metric: i.label, scope: i.scope, status: i.status,
    fired_at: i.fired_at, ended_at: i.ended_at, minutes: i.minutes,
    value: i.value_text, threshold: i.threshold_text, peak: i.peak_text,
    summary: i.summary, message: i.message,
    findings: list(i.findings, 10),
    endpoints: list(i.endpoints, 8),
    dependencies: list(i.dependencies, 8),
    errors: list(i.errors, errors),
    releases: list(i.releases, 5),
    checks: list(i.checks, 5),
    servers: list(i.servers, 5),
    logs: list(i.logs, logs),
    related: list(i.related, 5),
  })
  for (const [logs, errors] of [[15, 10], [5, 5], [0, 3]]) {
    const out = JSON.stringify(clean(pick(logs, errors)))
    if (out.length <= MAX_CHARS) return out
  }
  return JSON.stringify(clean({ name: i.name, metric: i.label, scope: i.scope, status: i.status, summary: i.summary, findings: list(i.findings, 5) })).slice(0, MAX_CHARS)
}
