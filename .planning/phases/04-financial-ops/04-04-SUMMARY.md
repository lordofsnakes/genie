---
phase: 04-financial-ops
plan: 04
subsystem: chain/transfer
tags: [typescript-fix, env-config, writeContract, viem]
dependency_graph:
  requires: [04-03]
  provides: [transfer-ts-compilation, env-var-placeholders]
  affects: [apps/api/src/chain/transfer.ts, apps/api/src/chain/clients.ts, .env.example]
tech_stack:
  added: []
  patterns: [explicit-account-chain-in-writeContract]
key_files:
  created: []
  modified:
    - apps/api/src/chain/transfer.ts
    - apps/api/src/chain/clients.ts
    - .env.example
decisions:
  - "Export chain const from clients.ts instead of duplicating ternary in transfer.ts"
  - "Pass explicit account via relayerAccount() to writeContract — viem 2.45 requires account when wallet client type is not narrowed"
metrics:
  duration_minutes: 2
  completed: "2026-04-04T15:07:00Z"
---

# Phase 04 Plan 04: Gap Closure -- transfer.ts TS Fix and Env Config Summary

Fix writeContract TS2345 errors by adding explicit account + chain properties, export chain from clients.ts, add Phase 4 env var placeholders to .env.example.

## What Was Done

### Task 1: Fix TypeScript errors in transfer.ts and add Phase 4 env var placeholders

**Commit:** 8368520

The plan identified missing `chain` property as the TS error cause. During execution, the actual error was **Property 'account' is missing** -- viem 2.45's `writeContract` requires explicit `account` when the wallet client's return type is not narrowed (due to lazy-init pattern with `ReturnType<typeof createWalletClient>`).

**Changes:**
1. **apps/api/src/chain/transfer.ts** -- Added `account: relayerAccount()` and `chain` to both `writeContract` calls. Imported `relayerAccount` and `chain` from `./clients`.
2. **apps/api/src/chain/clients.ts** -- Exported the module-level `chain` const (was previously internal).
3. **.env.example** -- Appended World Chain / Financial Ops section with placeholder values for `WORLD_CHAIN_RPC_URL`, `WORLD_CHAIN_TESTNET`, `RELAYER_PRIVATE_KEY`, `GENIE_ROUTER_ADDRESS`, `PAY_HANDLER_ADDRESS`.
4. **apps/api/.env** -- Appended same env var placeholders (empty values for user to fill).

**Verification:**
- `pnpm tsc --noEmit` reports zero errors in transfer.ts
- All 82 tests pass (13 test files)

### Task 2: Deploy contracts to World Chain and configure env vars

**Status:** BLOCKED -- requires human action (checkpoint:human-action)

This task requires the user to:
1. Obtain a World Chain Sepolia RPC URL
2. Fund a relayer wallet with Sepolia ETH
3. Deploy GenieRouter and PayHandler contracts via `forge script`
4. Set contract addresses and relayer key in `apps/api/.env`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added explicit account parameter to writeContract calls**
- **Found during:** Task 1, Step 4 verification
- **Issue:** Plan specified only missing `chain` property, but actual TS error was "Property 'account' is missing" -- viem 2.45 requires `account` in writeContract params when wallet client type is generic
- **Fix:** Added `account: relayerAccount()` to both writeContract calls, imported `relayerAccount` from clients.ts
- **Files modified:** apps/api/src/chain/transfer.ts

**2. [Rule 3 - Blocking] Exported chain from clients.ts**
- **Found during:** Task 1
- **Issue:** Plan suggested duplicating chain logic in transfer.ts, but importing from clients.ts is cleaner and avoids duplication
- **Fix:** Changed `const chain` to `export const chain` in clients.ts, imported in transfer.ts
- **Files modified:** apps/api/src/chain/clients.ts, apps/api/src/chain/transfer.ts

## Known Stubs

None -- all code changes are functional.

## Commits

| Task | Commit  | Description                                              |
|------|---------|----------------------------------------------------------|
| 1    | 8368520 | Fix writeContract TS errors, add env var placeholders    |

## Self-Check: PASSED
