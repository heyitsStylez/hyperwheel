# ADR 0005: Outcome resolution uses on-chain oracle prices, not CoinGecko

- **Status:** Accepted
- **Date:** 2026-05-16
- **Supersedes:** none
- **Related:** `src/js/18-chain-sync.js` (`resolveRyskOutcomes`, `resolveHsfcOutcomes`)

## Context

After a synced PUT or CALL expired, the app needed to decide whether it was
ASSIGNED/CALLED (ITM) or simply EXPIRED (OTM). Two bugs compounded this:

**Bug 1 — HSFC correction loop missing.** When a Hypersurface trade was synced
while OPEN and later expired, subsequent syncs skipped it entirely (already in
the `synced` set, `continue`d past the import loop). `autoDetectOutcomes` was
never called again, so the trade stayed OPEN indefinitely.

**Bug 2 — CoinGecko as settlement oracle.** `autoDetectOutcomes` fetched the
CoinGecko historical daily-close price for the expiry date and compared it to
the strike. This approach has three failure modes:

1. **Price mismatch.** CoinGecko returns the UTC 00:00 or end-of-day close;
   Rysk settles at 8:00 UTC using a Chainlink oracle price. For volatile
   underlyings these differ enough to misclassify ITM vs OTM.
2. **Rate-limiting.** The CoinGecko free tier rate-limits aggressively. On a
   failed fetch the outcome stayed EXPIRED with no scheduled retry — it was
   permanently misclassified unless the user manually triggered a re-sync.
3. **No retry.** `autoDetectOutcomes` was not wired into any periodic retry
   path; a single failure was final.

## Decision

Replace CoinGecko outcome inference with authoritative on-chain data, separately
for each platform.

### Rysk — expiry-prices endpoint

`GET https://v12.rysk.finance/api/expiry-prices/999/{underlyingAddress}`

Returns `{ expiryTimestamp: rawPriceAt1e8 }` — the exact Chainlink oracle price
the Rysk protocol used to settle each expiry. One call per unique underlying
token covers all strikes and expiries for that asset.

Resolution logic (in `resolveRyskOutcomes`):
- Filter positions to `status='SETTLED'` and `expiry < now`.
- For each: `settlementPrice = parseInt(rawPrice) / 1e8`, `strikePrice = parseInt(strike) / 1e18`.
- PUT: `settlementPrice ≤ strikePrice` → `ASSIGNED`; else → `EXPIRED`.
- CALL: `settlementPrice ≥ strikePrice` → `CALLED`; else → `EXPIRED`.
- Match to local trade by `txHash` (authoritative, one-to-one). Skip `CLOSED` trades.
- Runs on every sync — overwrites any prior CoinGecko misclassification.

The proxy at `/api/chain-sync?source=rysk&type=expiry-prices&underlying=0x...`
validates the address is a 40-hex Ethereum address before forwarding.

### Hypersurface — positions + redeemActions

A second Goldsky subgraph query fetches the user's short positions:

```graphql
positions(where:{account:"0x...", amount_lt:"0"}, first:200) {
  oToken { symbol strikePrice expiryTimestamp isPut underlyingAsset { symbol } }
  redeemActions { id }
}
```

`amount_lt:"0"` = short (sold) positions. `redeemActions` is non-empty if and
only if the option buyer exercised against the seller's vault — no price
comparison required.

Resolution logic (in `resolveHsfcOutcomes`):
- Skip positions where `expiryTimestamp > now` (not yet expired).
- `redeemActions` empty → expired worthless → leave/set `EXPIRED`.
- `redeemActions` non-empty → exercised → `ASSIGNED` (PUT) or `CALLED` (CALL).
- Match to local trade by `platform=HSFC`, `asset`, `expiry`, `strike` (within $0.01), `type`.
  Only updates trades with `outcome=OPEN` or `EXPIRED`; `CLOSED` trades are never touched.
- Runs on every sync — self-correcting.

### autoDetectOutcomes retained for stale-detection only

`autoDetectOutcomes` (CoinGecko) is still called from `autoLoadChain`'s
stale-detection loop at boot, for any locally-known OPEN trades whose expiry
date has passed. This catches trades that lapsed while the app was closed. For
Rysk and HSFC trades, `resolveRysk/HsfcOutcomes` will correct whatever
CoinGecko guessed once the sync runs. For `platform='SPOT'` trades (manual
entries with no chain data), CoinGecko remains the only resolution mechanism.

## Alternatives considered

### Keep CoinGecko, fix retry

Add an exponential-backoff retry loop inside `autoDetectOutcomes`.

- ✓ Simpler change — no new API surface.
- ✗ Doesn't fix the price-mismatch problem. A correctly-retried wrong price
  still misclassifies the trade.
- ✗ Adds retry complexity that disappears as a concern under the chosen approach.

### Use Rysk `/api/user/settlement` endpoint

A `settlement` endpoint also exists on the Rysk API and includes a `status`
field. Investigated but found it doesn't return the settlement *price* — only
whether the position was settled. Outcome still requires a price comparison.
`expiry-prices` is the correct endpoint.

### Ask user to confirm outcome manually

Surface a modal asking the user to confirm ASSIGNED vs EXPIRED for each expired
trade.

- ✓ No API dependency.
- ✗ Friction on every expiry. The point of chain sync is to remove manual steps.
- ✗ User may not remember or may not know the exact settlement price.

### On-chain oracle prices (chosen)

- ✓ Uses the same price the protocol used — no misclassification is possible.
- ✓ Runs on every sync — self-healing if a previous sync failed or guessed wrong.
- ✓ No rate-limit risk (Rysk and Goldsky are not metered the way CoinGecko is).
- ✓ HSFC approach needs no price at all — redeemActions is a binary signal.
- ✗ Adds a second network call per sync for each platform. Acceptable: both calls
  are fast and the data is not available any other way.

## Consequences

- `resolveRyskOutcomes(positions)` added to `src/js/18-chain-sync.js`. Called at
  the end of `syncRysk` after new trades are imported.
- `resolveHsfcOutcomes(positions)` added to `src/js/18-chain-sync.js`. Called at
  the end of `syncHypersurface` after the positions GQL query.
- `fetchRyskExpiryPrices(underlying)` added; proxied via `/api/chain-sync` with
  address validation.
- `api/chain-sync.js` updated to handle `type=expiry-prices` for the Rysk source.
- `fetchHsfcGoldsky` refactored from `(url, address)` to `(url, gqlBody)` to
  support arbitrary GQL queries (trades query and positions query reuse the same
  transport).
- `autoDetectOutcomes` is no longer called from `syncRysk` or `syncHypersurface`.
  It remains in `autoLoadChain`'s boot-time stale-detection path for SPOT trades.
- If `resolveRyskOutcomes` fails (network error), outcomes stay as EXPIRED and
  the next sync retries automatically. No toast — silent degradation.
- Integration tests covering all four PUT/CALL × OTM/ITM combinations, plus
  CLOSED-not-touched and fetch-failure, live in
  `test/integration/chain-sync-outcomes.test.js`.
