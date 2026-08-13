# Research: equity/ETF live price feed for spot marks

Resolves issue [#80](https://github.com/heyitsStylez/hyperwheel/issues/80) (child of map #78).

> **Note on convention:** there was no `docs/research/` directory before this file.
> ADRs live in `docs/adr/`. This is a research note, not a decision, so it goes in a
> new `docs/research/` folder. Promote a chosen source to an ADR when the TradFi
> feature is actually built.

## Question

HyperWheel marks unrealized P&L against a live spot price. For crypto it fetches
CoinGecko directly from the browser, with `/api/chain-sync` (Vercel serverless)
available for CORS-blocked sources. The TradFi version needs live-ish US equity/ETF
quotes for tickers like IBIT, PURR (a Hyperliquid DAT stock), and other equities/ETFs
— callable from a **static single-file web app**.

## TL;DR / Bottom line

**Recommended: Finnhub (primary) + Twelve Data (fallback / richer quote object).**

Both send `Access-Control-Allow-Origin: *`, so they work **directly from the browser
with no proxy** — same pattern as the existing CoinGecko call. Finnhub's free tier is
the most generous (60 req/min, real-time US equities/ETFs). Twelve Data's `/quote`
returns an explicit `is_market_open` flag plus `timestamp`/`last_quote_at`, which
solves the "live vs last close" display problem cleanly.

The only real caveats: (1) an API key is exposed in client-side JS on either — mitigate
by routing through `/api/chain-sync` if that ever matters (see "Key exposure" below);
(2) niche/DAT tickers (e.g. PURR) must be spot-checked for coverage per provider.

**Avoid:** Yahoo Finance unofficial (no CORS header, 429s, crumb/cookie auth churn),
IEX Cloud (**shut down Aug 31 2024**), Alpha Vantage free (**end-of-day only** for
quotes), Polygon free (15-min delayed + 5 req/min).

---

## CORS — empirical test (most authoritative)

Web write-ups disagree on CORS, so I tested the actual response headers with
`curl -H "Origin: https://example.com"` on 2026-08-13. This is the primary signal for a
static app: if `Access-Control-Allow-Origin` is present, the browser can call it directly.

| Provider | `Access-Control-Allow-Origin` | Direct-from-browser? |
|----------|-------------------------------|----------------------|
| Finnhub (`finnhub.io/api/v1/quote`) | `*` | ✅ Yes |
| Twelve Data (`api.twelvedata.com/quote`) | `*` | ✅ Yes |
| Financial Modeling Prep (`/api/v3/quote`) | `*` | ✅ Yes |
| Alpha Vantage (`/query`) | `*` | ✅ Yes |
| Yahoo (`query1.../v8/finance/chart`) | *(none; returned HTTP 429)* | ❌ No |

> Note: published secondary sources (and AI search summaries) claim Finnhub and
> Twelve Data "do not support CORS." **This is wrong as of 2026-08-13** — both return
> `Access-Control-Allow-Origin: *`. Trust the header test, not the write-ups.

---

## Provider-by-provider

### Finnhub — ✅ recommended primary
- **Endpoint:** `GET https://finnhub.io/api/v1/quote?symbol=AAPL&token=KEY`
- **Free / key:** free key, no credit card, personal/non-commercial use. Auth via
  `token` query param or `X-Finnhub-Token` header. ([pricing](https://finnhub.io/pricing))
- **Rate limit:** 60 API calls/min on free tier (plus a 30 calls/sec internal cap);
  429 on exceed. ([apicostcalc](https://apicostcalc.com/finnhub.html), [GH issue #2](https://github.com/Finnhub-Stock-API/finnhub-js/issues/2))
- **Real-time vs delayed:** **real-time** US equity/ETF quotes on the free tier.
- **CORS:** `Access-Control-Allow-Origin: *` (tested). Callable directly.
- **Quote fields:** `c` current, `d` change, `dp` %change, `h` high, `l` low, `o` open,
  `pc` previous close, `t` UNIX timestamp of the quote. ([API repo](https://github.com/finnhubio/Finnhub-API))
- **Market-hours:** `c` holds the last trade; `t` is the trade timestamp. Detect stale
  by comparing `t` to now (or `c === pc` overnight). No explicit market-open flag —
  derive it from `t`.

### Twelve Data — ✅ recommended fallback
- **Endpoint:** `GET https://api.twelvedata.com/quote?symbol=AAPL&apikey=KEY`
- **Free / key:** free Basic plan, key required. **800 API credits/day, 8 req/min.**
  Basic plan advertises "Real-time US equities and ETFs." ([pricing](https://twelvedata.com/pricing), [credits](https://support.twelvedata.com/en/articles/5615854-credits))
- **Real-time vs delayed:** real-time US equities/ETFs on Basic (subject to their data
  agreement; verify grade for your exact tickers).
- **CORS:** `Access-Control-Allow-Origin: *` (tested). Callable directly.
- **Market-hours:** the quote object is the best of the bunch for display —
  live sample (demo key) returned:
  `is_market_open: true`, `timestamp`, `last_quote_at`, `close`, `previous_close`,
  `datetime`. Use `is_market_open` to render "LIVE" vs "at close", and
  `last_quote_at`/`timestamp` to show the as-of time. No proxy needed.
- **Tradeoff vs Finnhub:** far tighter rate limit (8/min vs 60/min) — batch symbols in
  one call (`symbol=AAPL,MSFT,IBIT`) to conserve credits.

### Financial Modeling Prep (FMP) — ⚠️ viable but weaker free tier
- **Endpoint:** `GET https://financialmodelingprep.com/api/v3/quote/AAPL?apikey=KEY`
- **Free:** ~250 requests/day, key required. Real-time/intraday US quotes advertised on
  paid; free tier is limited (250/day, 5yr history). ([pricing](https://site.financialmodelingprep.com/developer/docs/pricing))
- **CORS:** `Access-Control-Allow-Origin: *` (tested). Callable directly.
- **Verdict:** usable, but 250/day is stingy versus Finnhub's 60/min. Keep as a third option.

### Alpha Vantage — ❌ not for live marks
- **Endpoint:** `GET https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=KEY`
- **Free:** key required; historically 25 req/day, 5 req/min. CORS `*` (tested).
- **Blocker:** GLOBAL_QUOTE is **end-of-day for free users** by their own docs — real-time
  or 15-min delayed needs a premium plan. ([docs](https://www.alphavantage.co/documentation/))
  Unusable for a "live spot" mark on free tier.

### Polygon.io — ❌ free tier too limited
- **Free:** 5 API calls/min, **end-of-day / 15-min delayed** only; real-time needs paid
  (~$29/mo Stocks plan). ([apicostcalc](https://apicostcalc.com/polygon.html))
- **Verdict:** delayed data + 5/min makes it a poor fit for free live marks.

### Yahoo Finance (unofficial) — ❌ avoid
- **No CORS** (tested: 429, no `Access-Control-Allow-Origin`). The v7 `/quote` endpoint
  now returns 401 and requires a cookie + **crumb** that expires within minutes and is
  tied to user-agent/IP; anti-scraping tightened since mid-2023. Even via a proxy it's
  fragile. ([yfinance #2404](https://github.com/ranaroussi/yfinance/issues/2404), [codestudy writeup](https://www.codestudy.net/blog/yahoo-finance-api-get-quotes-returns-invalid-cookie/))

### IEX Cloud — ❌ dead
- IEX Group **retired all IEX Cloud API products on Aug 31 2024.** Do not design around it.
  ([alphavantage migration note](https://www.alphavantage.co/iexcloud_shutdown_analysis_and_migration/))

---

## Market-hours behaviour & "live vs last close" display

US equities trade ~09:30–16:00 ET, Mon–Fri (plus holidays). Overnight/weekends a quote
endpoint returns the **last trade**, which is stale. Two ways to detect and display it:

1. **Twelve Data:** read `is_market_open` directly; show "LIVE" when true, else "at close"
   with the `last_quote_at`/`timestamp` as-of time. Cleanest.
2. **Finnhub:** no flag — compare `t` (quote timestamp) to `Date.now()`. If it's more than
   ~a few minutes old, render "last close" and show the `t` time. `c === pc` is a secondary
   overnight hint.

Mirror the crypto path: fetch on load + light polling, and label the mark with an as-of
timestamp so a weekend value is never mistaken for live.

## Key exposure (static-app consideration)

Any of these keys embedded in client JS is visible to users. Options, cheapest first:
- Accept it for a free, rate-limited, read-only quote key (lowest effort; matches the
  current CoinGecko approach).
- Route through the existing `/api/chain-sync` Vercel proxy (or a sibling `/api/quote`)
  and keep the key in an env var — same pattern already used for CORS-blocked chain data.
  This also sidesteps any future CORS regression on the provider side.

## Coverage caveat for niche tickers (PURR, DAT stocks)

IBIT (iShares Bitcoin Trust ETF) is a mainstream listing — well covered everywhere.
PURR and other Hyperliquid DAT / thinly-traded names are **not guaranteed** to be in every
provider's universe. Before committing, spot-check each candidate ticker against the chosen
provider's `/quote` (a 200 with a price vs an empty/`404` tells you immediately).

## Recommendation recap

1. **Finnhub** as the default live-quote source — 60 req/min real-time, direct CORS.
2. **Twelve Data** as fallback and for the market-state UI (`is_market_open` + timestamps),
   batching symbols to stay under 8 req/min.
3. Skip Alpha Vantage/Polygon (delayed on free), Yahoo (no CORS, crumb churn), IEX (dead).
4. If key exposure or CORS regressions become a concern, proxy via a serverless
   `/api/quote` endpoint reusing the `/api/chain-sync` pattern.

---

*Researched 2026-08-13. CORS/response-field claims verified empirically via `curl`;
plan/rate-limit claims cited to provider pricing/docs pages above.*
