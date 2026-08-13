# Research: IBKR data ingestion feasibility (Client Portal API vs Flex Query)

> Resolves issue #79. Question: can IBKR position/trade data be pulled into a
> **static single-file web app** like HyperWheel (HTML/JS/CSS on Vercel, with
> optional Vercel serverless proxy functions like the existing `/api/chain-sync`
> CORS proxy)?

**Date:** 2026-08-13
**Sources:** Interactive Brokers first-party docs (IBKR Campus, IBKR Guides
reporting reference, IBKR OAuth spec PDF). Cited inline.

---

## TL;DR — bottom line

| Path | Runs on static+serverless? | Verdict |
|------|:--:|---------|
| **Flex Web Service** (Activity Flex / Trade Confirmation Flex) | ✅ Yes | **Viable — recommended.** Token-based, no gateway, no persistent process. Fits a Vercel serverless proxy exactly like `/api/chain-sync`. |
| **CP Web API via CP Gateway** (retail default) | ❌ No | **Not viable.** Requires a persistent local Java gateway process + interactive login. Cannot live in a stateless serverless function. |
| **CP Web API via OAuth 1.0a** (gatewayless) | ⚠️ Partly | Gatewayless and serverless-compatible in principle, but **institutional / approved-third-party gated** (multi-week compliance onboarding) and needs RSA request-signing. Overkill for a personal tracker. |
| **TWS API** (mention only) | ❌ No | Heaviest. Requires desktop **TWS or IB Gateway** running locally with an open socket. Not a serverless/static option. |

**Recommendation:** ingest via the **Flex Web Service** behind a Vercel serverless
proxy. The token lives in a server-side env var; the proxy performs the two-step
`SendRequest` → poll → `GetStatement` and returns parsed data to the static app.
Accept **T+1 (prior-day, end-of-day) latency** for the Activity Flex statement
(positions, assignments, expirations, cost basis); use a **Trade Confirmation
Flex** query if you want same-day executions.

---

## 1. Client Portal Web API (Web API)

### Auth model — the critical finding

IBKR offers several auth modes, but access to them is **segmented by client type**:

- **Retail / individual clients are currently only approved to use the Client
  Portal Gateway**, "a small java program used to route local web requests with
  appropriate authentication," and must "complete a manual login with their IBKR
  username and password."
  (IBKR Campus — Web API Documentation / What is the Client Portal API)
- **OAuth 1.0a** is the gatewayless, direct, server-to-server mode — but "OAuth
  access allows for direct connection, [and] it's available only for
  institutional users." Third-party vendors "may currently only seek approval
  for the use of OAuth 1.0a," which "is expected to firmly stay in the
  Institutional space."
  (IBKR Campus — Web API Documentation; OAuth 1.0a Extended)
- **OAuth 2.0** (`private_key_jwt`, RFC 7521/7523) is the direction IBKR is
  unifying toward, "being considered for individual access in the future" —
  i.e. not generally available to individuals today.
  (IBKR Campus — Web API Documentation)

### Does it require a persistent running gateway?

**Yes, for the only mode a retail user can use today.** The CP Gateway is a Java
process that must be **running and interactively authenticated**; all API
requests are routed through it. This is fundamentally incompatible with a
**stateless Vercel serverless function** (which spins up per-request and cannot
host a long-lived authenticated Java process) and with a static browser app.
(IBKR Campus — Launching and Authenticating the Gateway)

### Session lifetime / re-auth cadence

- A session "can remain authenticated for up to **24 hours**, resetting at
  midnight" (NY / Zug / HK time).
- Sessions "**time out after approximately 6 minutes** without sending new
  requests or maintaining the `/tickle` endpoint **at least every 5 minutes**."
  (IBKR Campus — Web API Documentation)

This keepalive requirement (`/tickle` every <5 min, hard daily re-auth) is a
second reason it doesn't fit serverless — something must persistently ping the
session, and re-auth requires a human login (retail) or a signed OAuth handshake
(institutional).

### OAuth 1.0a as a gatewayless escape hatch

OAuth 1.0a **is** gatewayless and serverless-friendly at the protocol level:
credentials (consumer key, access token + secret) are provisioned via the
**OAuth Self-Service Portal**; a **live session token** is derived via a
Diffie-Hellman exchange and used to **RSA-sign** each request — no gateway, no
interactive login.
(IBKR OAuth spec PDF, interactivebrokers.com/webtradingapi/oauth.pdf; OAuth 1.0a
Extended)

**But** the practical friction is large for a personal tracker:
1. Direct/OAuth connection is **institutional-only** today; third-party vendor
   approval takes a "**3–6 week**" compliance review plus a Web API legal
   agreement, public keys, and a callback URL.
   (IBKR Campus — Web API Documentation / third-party onboarding)
2. Request signing needs RSA private-key crypto that **cannot live in client-side
   JS** (the key would be exposed). It would have to run in the serverless proxy.
3. Even if a first-party (own-account) OAuth 1.0a registration is available via
   the Self-Service Portal, it is materially heavier than a Flex token for the
   same end result (read-only positions/trades).

---

## 2. Flex Web Service — the viable path

A "feature that allows you to access your saved Flex Queries using HTTPS...
**without logging into the account management Portal**," designed for
"automated client software... to request previously defined Flex Queries."
**No gateway, no persistent process, no interactive login.**
(IBKR Campus — Flex Web Service)

### Setup

1. In Client Portal, define a **Flex Query** (Activity or Trade Confirmation),
   pick the sections/fields, and set format to **XML** (CSV also available).
2. Enable the **Flex Web Service** and generate a **Flex token** — a numerical
   code. "Flex tokens are valid for **six hours by default**, but... can be
   specified to remain active anywhere between **6 hours and 1 year**."
   (IBKR Campus — Flex Token glossary; Enable and Create Access Token)

### API workflow (two-step, poll)

```
1. GET  https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest?t=TOKEN&q=QUERY_ID&v=3
        → returns a ReferenceCode
2. GET  https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?t=TOKEN&q=REFERENCE_CODE&v=3
        → returns the generated statement (XML/CSV); poll until ready
```
- `t` = Flex token, `q` = query id (SendRequest) or reference code
  (GetStatement), `v` = version (current = **3**).
- **Rate limit: "Limited to one request per second, 10 requests per minute
  (per token)"** (Flex Web Service v3 error 1018). Legacy Flex is deprecated —
  "convert over to Activity Flex" (error 1010).
  (IBKR Guides — Flex Web Service Version 3 error reference; ibkrguides.com/clientportal/flex3.htm)

### Latency

- **Activity Flex Query** data "is only updated **once daily at close of
  business**," and IBKR recommends retrieving "the **prior day's** Activity
  Statements at the start of the following day." → effectively **T+1 / EOD**.
  (IBKR Campus — Activity Flex Query glossary)
- **Trade Confirmation Flex Query** provides **same-day trade confirmations**
  (executions as they're confirmed intraday) — use this if you need faster
  fills than the once-daily Activity statement.

### Data exposed (relevant to a wheel tracker)

Activity Flex sections include everything HyperWheel needs:
- **Open Positions** — open option positions with cost basis fields
  (IBKR Guides — Open Positions Flex Statement).
- **Trades** — executions/fills.
- **Options, Exercises, Assignments and Expirations** — "any exercise,
  assignment and expiration activity for stocks, options, futures, futures
  options and structured products," grouped by Assignments / Exercises /
  Expirations. This directly maps to HyperWheel's ASSIGNED / CALLED / EXPIRED
  outcomes.
  (IBKR Guides — Option Exercises/Assignments/Expirations Flex Statement)
- **Cost basis** — available on Open Positions and Trades sections (net cost /
  cost basis fields), matching HyperWheel's per-lot net-cost model.

---

## 3. TWS API (mention only)

The TWS API connects over a local socket to a **running desktop TWS or IB
Gateway** instance the user has logged into. It is the **heaviest** option:
it requires a persistent local application, is not HTTP/serverless, and is out
of scope for a static + serverless app. Noted for completeness; not a candidate.

---

## 4. How this maps onto HyperWheel's architecture

HyperWheel already proxies CORS-blocked upstreams (Rysk, Hypersurface) through
`api/chain-sync.js` on Vercel. IBKR Flex fits the **identical pattern**:

- Add e.g. `api/ibkr-flex.js` (Vercel serverless): reads `IBKR_FLEX_TOKEN` and a
  query id from env, runs `SendRequest` → polls `GetStatement`, parses the XML,
  and returns normalized JSON. The **token never touches the browser** and CORS
  is sidestepped server-side (same rationale as `hasProxy()` in chain-sync).
- The static app fetches `/api/ibkr-flex` and maps rows into the existing trade
  shape (`asset/type/strike/size/premium/outcome/…`). Assignments→`ASSIGNED`,
  called-away→`CALLED`, expirations→`EXPIRED` come straight from the Options
  Exercises/Assignments/Expirations section.

### Key friction per path

- **Flex (recommended):** T+1 / EOD latency on Activity Flex (positions,
  assignments, expirations, cost basis); use Trade Confirmation Flex for
  same-day executions. XML parsing + field-mapping work. 1 req/s, 10/min per
  token. Token rotation (6h–1yr) is a light ops task. Positions are not live
  intraday.
- **CP Web API + Gateway:** disqualified — persistent Java process + interactive
  login + `/tickle` keepalive can't run on stateless serverless.
- **CP Web API + OAuth 1.0a:** gatewayless but institutional/third-party gated
  (3–6 week onboarding), needs RSA signing in the proxy; disproportionate for a
  personal read-only tracker.
- **TWS API:** requires desktop TWS/IB Gateway; not serverless.

---

## Sources

- IBKR Campus — Web API Documentation: https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/
- IBKR Campus — What is IBKR's Client Portal API?: https://www.interactivebrokers.com/campus/trading-lessons/what-is-ibkrs-client-portal-api/
- IBKR Campus — Launching and Authenticating the Gateway: https://www.interactivebrokers.com/campus/trading-lessons/launching-and-authenticating-the-gateway/
- IBKR Campus — OAuth 1.0a Extended: https://www.interactivebrokers.com/campus/ibkr-api-page/oauth-1-0a-extended/
- IBKR OAuth spec (PDF): https://www.interactivebrokers.com/webtradingapi/oauth.pdf
- IBKR Campus — Flex Web Service: https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/
- IBKR Campus — Flex Token glossary: https://www.interactivebrokers.com/campus/glossary-terms/flex-token/
- IBKR Campus — Activity Flex Query glossary: https://www.interactivebrokers.com/campus/glossary-terms/activity-flex-query/
- IBKR Docs — Enable and Create Access Token: https://www.interactivebrokers.com/docs/web-api/flex-web-service/client-portal-configuration/enable-and-create-access-token
- IBKR Guides — Flex Web Service Version 3 (error/rate-limit reference): https://www.ibkrguides.com/clientportal/flex3.htm
- IBKR Guides — Activity Flex Query Reference: https://www.ibkrguides.com/reportingreference/reportguide/activity%20flex%20query%20reference.htm
- IBKR Guides — Option Exercises/Assignments/Expirations Flex Statement: https://www.ibkrguides.com/reportingreference/reportguide/options_exercises_expirations_fq.htm
- IBKR Guides — Open Positions Flex Statement: https://www.ibkrguides.com/reportingreference/reportguide/open%20positionsfq.htm
