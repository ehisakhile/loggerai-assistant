// Made-up incidents and errors for the public demo, and for the LoggerAI demo project's Errors page
// (these are that project's errors). None of it is customer data. `card` is what the page shows;
// the model only ever sees what buildEvidence picks.
export const SAMPLE_INCIDENT = {
  card: {
    kind: "Incident", title: "Checkout latency", scope: "POST /api/checkout", state: "Resolved", chart: true,
    facts: [["5.0 s", "p95, alert at 1.5 s"], ["35 min", "Duration"], ["61", "Users affected"], ["398", "Timeouts"]],
    timeline: [["14:02", "Release v2.14.0 moved the payment client to a new connection pool", "blue"], ["14:06", "Alert fired: p95 passed 1.5 s", "red"], ["14:41", "Back to normal", "brand"]],
    findings: [["red", "Payment provider calls hit the 5.0 s timeout", "p95 for api.payments.example went from 240 ms to 5.0 s."], ["amber", "The connection pool ran out", "All 10 connections in use, logged 276 times."], ["muted", "Servers stayed healthy", "CPU 38%, memory 61%, database and Redis fine."]],
  },
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

const STRIPE_TIMEOUT = {
  card: {
    kind: "Error", title: "StripeTimeoutError", scope: "POST /api/payments/confirm", state: "Open",
    facts: [["214", "Times"], ["61", "Users affected"], ["503", "Status"], ["v2.14.0", "First release"]],
    timeline: [["13:58", "Release v2.14.0 cut the Stripe timeout from 15 s to 5 s", "blue"], ["14:01", "First seen", "red"], ["Now", "Still happening", "amber"]],
    findings: [["red", "Stripe confirms take 7.4 s at p95", "The new 5 s timeout ends them early."], ["amber", "It started with v2.14.0", "No timeouts in the 7 days before."], ["muted", "Stripe's status page is clear", "No outage reported."]],
  },
  name: "StripeTimeoutError", label: "Error group", scope: "POST /api/payments/confirm", status: "open",
  summary: "Payment confirmation has timed out 214 times, for 61 users, since release v2.14.0.",
  message: "Request to api.stripe.com timed out after 5000 ms (POST /v1/payment_intents/{id}/confirm)",
  findings: [
    { severity: "critical", title: "Stripe confirms are slower than the new timeout", detail: "p95 for api.stripe.com is 7.4 s. v2.14.0 lowered the timeout from 15 s to 5 s." },
    { severity: "warning", title: "It started with release v2.14.0", detail: "No StripeTimeoutError in the 7 days before it." },
    { severity: "info", title: "Stripe reports no outage", detail: "Its status page is clear for this period." },
  ],
  endpoints: [{ method: "POST", route: "/api/payments/confirm", base: { count: 5320, p95: 2200, errors: 11 }, bad: { count: 2380, p95: 9200, errors: 214 } }],
  dependencies: [{ name: "api.stripe.com", base_p95: 2100, bad_p95: 7400, failures: 214 }],
  errors: [{
    type: "StripeTimeoutError", message: "Request to api.stripe.com timed out after 5000 ms", route: "/api/payments/confirm", count: 214, users: 61, first_release: "v2.14.0",
    stack: ["app/api/payments.py:88 confirm_payment: intent = stripe.PaymentIntent.confirm(intent_id, timeout=5)", "stripe/_api_requestor.py:197 request (library)"],
  }],
  releases: [{ version: "v2.14.0", changes: "Lowered the Stripe timeout from 15 s to 5 s to fail faster" }],
  logs: [{ level: "error", message: "Stripe confirm timed out; retrying once", count: 201 }, { level: "error", message: "Payment confirmation failed after retry; answering 503", count: 96 }],
}

const CLIENT_SECRET = {
  card: {
    kind: "Error", title: "TypeError", scope: "Browser /checkout", state: "Open",
    facts: [["58", "Times"], ["41", "Users affected"], ["Browser", "Where"], ["web-2.14.0", "First release"]],
    timeline: [["14:01", "The payments API began answering 503", "blue"], ["14:03", "First seen in the browser", "red"], ["Now", "Still happening", "amber"]],
    findings: [["red", "The page reads client_secret from a failed answer", "A 503 has no client_secret, so it's undefined."], ["amber", "It follows the payment timeouts", "Every case comes after a 503."], ["muted", "Only the payment step", "Other pages are clean."]],
  },
  name: "TypeError in the checkout page", label: "Error group", scope: "Browser /checkout", status: "open",
  summary: "The checkout page crashes reading client_secret. 58 times, for 41 users.",
  message: "Cannot read properties of undefined (reading 'client_secret')",
  findings: [
    { severity: "critical", title: "The page uses client_secret without checking the answer", detail: "After POST /api/payments/confirm answers 503, the body has no client_secret." },
    { severity: "warning", title: "Every case follows a failed payment call", detail: "All 58 sessions show the 503 just before the crash." },
    { severity: "info", title: "The page gives no message", detail: "Users see the spinner stop, then 'try again'." },
  ],
  endpoints: [{ method: "POST", route: "/api/payments/confirm", base: { count: 5320, p95: 2200, errors: 11 }, bad: { count: 2380, p95: 9200, errors: 214 } }],
  errors: [{
    type: "TypeError", message: "Cannot read properties of undefined (reading 'client_secret')", route: "/checkout", count: 58, users: 41, first_release: "web-2.14.0",
    stack: ["checkout/PaymentStep.tsx:118 confirmPayment", "checkout/PaymentStep.tsx:74 onSubmit"],
  }],
  releases: [{ version: "web-2.14.0", changes: "No change to PaymentStep in this release" }],
}

const ORDERS_TIMEOUT = {
  card: {
    kind: "Error", title: "OperationalError", scope: "GET /api/orders", state: "Open",
    facts: [["9", "Times"], ["7", "Users affected"], ["500", "Status"], ["v2.13.2", "First release"]],
    timeline: [["Yesterday", "First seen", "red"], ["48 min ago", "Last seen", "amber"]],
    findings: [["red", "orders_by_user hits the 3 s statement timeout", "Only for customers with many orders."], ["amber", "31 queries per request", "One query per item in the list, a likely N+1."], ["muted", "The database is healthy", "CPU 41%, no lock waits."]],
  },
  name: "OperationalError in orders", label: "Error group", scope: "GET /api/orders", status: "open",
  summary: "The order list query hits the 3 s database timeout for customers with many orders. 9 times, for 7 users.",
  message: "canceling statement due to statement timeout (orders_by_user)",
  findings: [
    { severity: "critical", title: "orders_by_user passes the 3 s statement timeout", detail: "All 9 cases are customers with over 400 orders." },
    { severity: "warning", title: "GET /api/orders runs 31 database queries per request", detail: "Usually one query per item in a list (N+1)." },
    { severity: "info", title: "The database itself is healthy", detail: "CPU 41%, no lock waits." },
  ],
  endpoints: [{ method: "GET", route: "/api/orders", base: { count: 8100, p95: 620, errors: 0 }, bad: { count: 8040, p95: 2900, errors: 9 } }],
  errors: [{
    type: "OperationalError", message: "canceling statement due to statement timeout", route: "/api/orders", count: 9, users: 7, first_release: "v2.13.2",
    stack: ["app/api/orders.py:41 list_orders: rows = db.execute(ORDERS_BY_USER, {'user': user_id})", "sqlalchemy/engine/base.py:1418 execute (library)"],
  }],
  logs: [{ level: "warning", message: "Slow query (2.4 s): SELECT ... FROM orders WHERE user_id = $1 ORDER BY created_at DESC", count: 44 }],
  releases: [{ version: "v2.13.2", changes: "Order list now loads each item's shipment" }],
}

const RATE_LIMIT = {
  card: {
    kind: "Error", title: "RateLimitError", scope: "GET /api/recommendations", state: "Open",
    facts: [["17", "Times"], ["15", "Users affected"], ["502", "Status"], ["v2.13.2", "First release"]],
    timeline: [["9 hours ago", "First seen, during the morning peak", "red"], ["2 hours ago", "Last seen", "amber"]],
    findings: [["red", "The OpenAI tokens-per-minute limit was reached", "Only at the busiest times."], ["amber", "71% of the endpoint's time is this call", "820 ms each."], ["muted", "A cached answer exists", "Used on some paths, not all."]],
  },
  name: "RateLimitError from OpenAI", label: "Error group", scope: "GET /api/recommendations", status: "open",
  summary: "Recommendations fail when the OpenAI rate limit is reached at peak times. 17 times, for 15 users.",
  message: "OpenAI: Rate limit reached for gpt-4o-mini (tokens per min)",
  findings: [
    { severity: "critical", title: "The tokens-per-minute limit is reached at peak", detail: "All 17 failures fall in the two busiest hours." },
    { severity: "warning", title: "The endpoint mostly waits on api.openai.com", detail: "71% of its time, 820 ms a call. Results aren't cached per product." },
    { severity: "info", title: "Some paths already fall back to cached results", detail: "The log shows 62 cached answers served." },
  ],
  dependencies: [{ name: "api.openai.com", base_p95: 900, bad_p95: 1400, failures: 17 }],
  errors: [{
    type: "RateLimitError", message: "Rate limit reached for gpt-4o-mini (tokens per min)", route: "/api/recommendations", count: 17, users: 15, first_release: "v2.13.2",
    stack: ["app/api/recommendations.py:57 suggest: reply = client.chat.completions.create(model=MODEL, messages=prompt)", "openai/_base_client.py:1047 request (library)"],
  }],
  logs: [{ level: "warning", message: "OpenAI rate limit hit; serving cached recommendations", count: 62 }],
}

const POSTCODE = {
  card: {
    kind: "Error", title: "ValidationError", scope: "GET /api/shipping/rates", state: "Resolved",
    facts: [["3", "Times"], ["3", "Users affected"], ["500", "Status"], ["v2.12.0", "First release"]],
    timeline: [["3 days ago", "First seen", "red"], ["2 days ago", "Marked resolved", "brand"]],
    findings: [["amber", "A bad postcode answered 500, not 400", "The user's mistake looked like a server fault."], ["muted", "All three had a space missing", "e.g. SW1A1AA."], ["muted", "Not seen since", "Resolved two days ago."]],
  },
  name: "ValidationError in shipping rates", label: "Error group", scope: "GET /api/shipping/rates", status: "resolved",
  summary: "Postcodes with no space failed validation and answered 500. 3 times, for 3 users, and not seen since it was resolved.",
  message: "postcode: value is not a valid UK postcode",
  findings: [
    { severity: "warning", title: "Bad input answered 500 instead of 400", detail: "The validation error wasn't caught, so it counted as a server error." },
    { severity: "info", title: "All three postcodes had no space", detail: "For example SW1A1AA." },
  ],
  errors: [{
    type: "ValidationError", message: "postcode: value is not a valid UK postcode", route: "/api/shipping/rates", count: 3, users: 3, first_release: "v2.12.0",
    stack: ["app/api/shipping.py:23 rates: address = Address(postcode=request.query['postcode'])"],
  }],
}

export const SAMPLES: Record<string, { card: unknown; name: string }> = {
  checkout: SAMPLE_INCIDENT,
  "stripe-timeout": STRIPE_TIMEOUT,
  "client-secret": CLIENT_SECRET,
  "orders-timeout": ORDERS_TIMEOUT,
  "rate-limit": RATE_LIMIT,
  postcode: POSTCODE,
}
