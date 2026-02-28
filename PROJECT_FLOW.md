# MonHard — Project Flow

Flow is similar to “Can I Bet On?” but **X-only** (no Telegram). Detection and creation run in the **same Next.js app**; we use the **X API** for fetching mentions and tweet details.

---

## 1. Pool creation

- **User** mentions your bot account (e.g. **@MonHard**) on X.
- **Next.js** (cron or manual):
  - **Cron**: `GET /api/x/mentions` runs every 10 minutes (Vercel Cron).
  - **X API** (read): Bearer token → `GET /2/users/:id/mentions` to fetch new mentions.
  - For each **new** mention (not in `ProcessedMention`):
    - Parse question from tweet text (strip @mentions, trim).
    - Build `closeTime` (e.g. now + 7 days).
    - **Server** calls `createPoolOnChain(question, closeTime)` using `OWNER_PRIVATE_KEY` → `MonHard.createPool(question, closeTime)`.
  - **Contract**: validates, stores pool, emits `PoolCreated`.
  - **Next.js**: calls `POST /api/pools/sync` with `txHash` to upsert pool in DB (mirror on-chain state).
  - **Next.js**: inserts `ProcessedMention { tweetId, poolId }` so the same tweet is not processed again.
  - **X API** (write): OAuth 1.0a client posts a **reply** to the tweet with the pool link: `{APP_URL}/bet/{poolId}`.

**Data:** All detection and creation logic lives in this repo; no separate agent service. X API is used for both **fetching** (mentions, tweet details) and **posting** (reply with link).

---

## 2. Placing a bet

- **User** opens the app, connects via **Reown AppKit** (Wagmi).
- **Frontend** (e.g. `/bet/[id]`):
  - Uses `useReadContract` for pool data and `useWriteContract` for `bet(poolId, side)` with `msg.value`.
  - User sends **native token** (MON) with the bet; no USDC/permit.
- **Contract** (`MonHard.bet`): checks pool open and not resolved, updates `bets[poolId][user]` and `totalYes`/`totalNo`.
- **DB**: Optional; you can refetch from chain or keep a local mirror. On-chain is source of truth.

---

## 3. Resolving and settling

- **Resolution**: Manual. **Creator** (owner) calls `resolve(poolId, winningSide)` from the app when the bet outcome is known (after `closeTime`).
- **Contract** (`MonHard.resolve`): only `pool.creator` can call; sets `resolved = true` and `winningSide`.
- **No Chainlink / no grading cron**: Unlike the reference flow, there is no automated grading agent or Redis; resolution is done by the pool creator in the UI.

---

## 4. Payouts (claim)

- **User** (winner) clicks **Claim** on the pool page.
- **Frontend** calls `claim(poolId)` via wagmi.
- **Contract** (`MonHard.claim`): checks resolved, winner, not already claimed; sends winnings in native token and marks `bets[poolId][user].claimed = true`.

---

## 5. Data flow (summary)

```
User (X) → @MonHard mention
              ↓
Vercel Cron → GET /api/x/mentions
              ↓
X API (Bearer) → get user mentions
              ↓
Next.js: parse question, createPoolOnChain() → MonHard.createPool()
              ↓
Next.js: POST /api/pools/sync (txHash) → DB upsert
              ↓
Next.js: ProcessedMention.create(tweetId, poolId)
              ↓
X API (OAuth) → reply tweet with link to /bet/{poolId}

User (Web) → Reown → bet(poolId, side) payable → MonHard
User (Web) → Creator → resolve(poolId, winningSide) → MonHard
User (Web) → Winner → claim(poolId) → MonHard
```

---

## 6. Repos and components

| Component | Location | Role |
|-----------|----------|------|
| **Next.js app** | This repo | X mention detection, pool creation, sync to DB, X reply, frontend (bet / resolve / claim) |
| **Contract** | `contracts/MonHard.sol` | createPool, bet, resolve, claim (native token) |
| **DB** | Prisma + Supabase | Mirror of pools (and processed mentions); on-chain is truth |

Single repo; no separate agent or cron service.

---

## 7. X API usage

- **Read** (fetch details): **Bearer token** (`X_API_BEARER_TOKEN` or `BEARER_TOKEN`).
  - `GET /2/users/:id/mentions` — cron for new mentions.
  - `GET /2/tweets/:id` — optional: fetch tweet details for a pool (e.g. if you store `sourceTweetId`).
- **Write** (post reply): **OAuth 1.0a** (`X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`).
  - Post reply with pool link after creation.

---

## 8. Networks

- **Monad testnet**: native token (MON) for bets and payouts.

---

## 9. Env and cron

- **Cron**: `vercel.json` → `GET /api/x/mentions` every 10 min; optional `CRON_SECRET` for auth.
- **Env**: `OWNER_PRIVATE_KEY`, `X_BOT_USER_ID`, `NEXT_PUBLIC_APP_URL`, X API keys (Bearer + OAuth), `DATABASE_URL`, `NEXT_PUBLIC_MONHARD_CONTRACT_ADDRESS`, etc. See `.env.example`.
