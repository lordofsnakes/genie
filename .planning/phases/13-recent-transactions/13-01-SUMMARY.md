---
phase: 13-recent-transactions
plan: "01"
subsystem: recent-transactions
tags: [api, frontend, transactions, dashboard]
dependency_graph:
  requires: [12-02]
  provides: [GET /api/transactions, useTransactions hook, live dashboard transactions]
  affects: [DashboardInterface, apps/api/src/index.ts]
tech_stack:
  added: []
  patterns: [Hono route, useCallback hook, fetch with loading/error states]
key_files:
  created:
    - apps/api/src/routes/transactions.ts
    - apps/api/src/routes/transactions.test.ts
    - apps/web/src/hooks/useTransactions.ts
  modified:
    - apps/api/src/index.ts
    - apps/web/src/components/DashboardInterface/index.tsx
decisions:
  - "GET /api/transactions uses orderBy desc createdAt limit 20 — matches most-recent-first dashboard display"
  - "useTransactions follows identical pattern to useBalance — userId as param, useState/useCallback/useEffect"
  - "DashboardInterface shows all transactions as sends (arrow_upward) — received funds not tracked in transactions table"
metrics:
  duration: "12 minutes"
  completed: "2026-04-05"
  tasks: 2
  files: 5
---

# Phase 13 Plan 01: Recent Transactions Summary

## One-liner

GET /api/transactions endpoint reading from DB with limit 20 + useTransactions hook + DashboardInterface wired to live data replacing mock constants.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GET /api/transactions route with tests and mount it | f33f192 | transactions.ts, transactions.test.ts, index.ts |
| 2 | Create useTransactions hook and wire DashboardInterface | 733123f | useTransactions.ts, DashboardInterface/index.tsx |

## What Was Built

**Backend (Task 1):**
- `apps/api/src/routes/transactions.ts` — Hono GET route accepting `?userId=` query param, queries `transactions` table via Drizzle with `eq(senderUserId, userId)`, orders by `createdAt desc`, returns `{ transactions: [...] }` with limit 20
- `apps/api/src/routes/transactions.test.ts` — 3 unit tests: 200 with data, 400 missing userId, 500 DB error
- `apps/api/src/index.ts` — mounted as `app.route('/api/transactions', transactionsRoute)` after balanceRoute

**Frontend (Task 2):**
- `apps/web/src/hooks/useTransactions.ts` — React hook following useBalance pattern, fetches from `/api/transactions?userId=`, returns `{ transactions, loading, error, refetch }`
- `apps/web/src/components/DashboardInterface/index.tsx` — replaced MOCK_TRANSACTIONS constant with live data from useTransactions; added loading skeleton (3 pulse rows), empty state ("No transactions yet"), relative time formatting (Today/Yesterday/N days ago)

## Decisions Made

- GET /api/transactions uses `orderBy(desc(transactions.createdAt)).limit(20)` — most-recent-first, bounded to 20 rows
- useTransactions follows identical pattern to useBalance — `userId` as param, `useState`/`useCallback`/`useEffect`, returns `refetch`
- DashboardInterface shows all transactions as sent (arrow_upward icon) — the transactions table only tracks sent transactions (`senderUserId`), not received funds

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — transactions display real data from the DB. The only caveat: received funds (incoming transfers) are not shown since the transactions table only tracks senders. This is intentional per schema design.

## Self-Check: PASSED

- [x] apps/api/src/routes/transactions.ts exists
- [x] apps/api/src/routes/transactions.test.ts exists
- [x] apps/web/src/hooks/useTransactions.ts exists
- [x] apps/web/src/components/DashboardInterface/index.tsx modified (no MOCK_TRANSACTIONS)
- [x] apps/api/src/index.ts contains transactionsRoute
- [x] Commit f33f192 exists
- [x] Commit 733123f exists
