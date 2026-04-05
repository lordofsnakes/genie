---
phase: 12-send-crosschain
plan: "02"
subsystem: send-modal
tags: [frontend, send, confirm, cross-chain, usdc, react]
dependency_graph:
  requires: [balance-endpoint, useBalance-hook]
  provides: [send-modal-api-wired, confirm-card-url-fixed, cross-chain-chain-picker]
  affects: [SendModal, ConfirmCard, DashboardInterface]
tech_stack:
  added: []
  patterns: [fetch-post-api, inline-confirm-card, chain-picker-select]
key_files:
  created: []
  modified:
    - apps/web/src/components/ConfirmCard/index.tsx
    - apps/web/src/components/SendModal/index.tsx
    - apps/web/src/components/DashboardInterface/index.tsx
decisions:
  - "SendModal calls POST /api/send instead of triggerMiniKitPay — real backend integration"
  - "ConfirmCard URL fixed /confirm -> /api/confirm — one-line fix for silent over-threshold failure"
  - "ConfirmCard renders inline inside SendModal on confirmation_required response — per D-07"
  - "World Chain is default chain; cross-chain options show ~15 min time estimate"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-05"
  tasks_completed: 2
  files_changed: 3
---

# Phase 12 Plan 02: Send Integration + Cross-Chain (Frontend) Summary

**One-liner:** SendModal rewritten to call POST /api/send with chain picker, inline ConfirmCard for over-threshold sends, and /confirm URL bug fixed.

## What Was Built

### Task 1: Fix ConfirmCard URL bug and rewrite SendModal

**ConfirmCard fix (D-09):**
- Changed `fetch(…/confirm` to `fetch(…/api/confirm` in `ConfirmCard/index.tsx` line 51
- One-line fix that was silently breaking all over-threshold confirmations

**SendModal rewrite:**
- Removed `triggerMiniKitPay` import entirely
- New `SendModalProps`: `{ onClose, userId: string, refetchBalance?: () => void }`
- Chain type narrowed to `ChainOption = 'World Chain' | 'Base' | 'Arbitrum' | 'Ethereum' | 'Optimism'`
- Default chain is now `'World Chain'` (was `'Base'`)
- `CHAIN_OPTIONS` array with proper labels: "World Chain (instant)", "Base (~15 min)", etc.
- `handleSend` calls `POST /api/send` with `{ userId, recipient, amount, chain }`
- Handles three response types:
  - `transfer_complete` → success state + refetchBalance + auto-close after 1.5s
  - `bridge_initiated` → success state + refetchBalance + auto-close after 2s
  - `confirmation_required` → sets `confirmData`, renders ConfirmCard inline
- When `confirmData` is set, modal content replaced with ConfirmCard component
- Chain-specific success messages: "Sent successfully!" vs "Bridge initiated! ~15 min to arrive."

### Task 2: Wire DashboardInterface to pass userId and refetchBalance to SendModal

- Updated `SendModal` usage from single-prop to multi-prop:
  - `userId={session?.user?.id ?? ''}`
  - `refetchBalance={refetchBalance}`
- `session` already from `useSession()` on line 25
- `refetchBalance` already from `useBalance()` on line 32

## Verification

1. `grep -n "/api/confirm" apps/web/src/components/ConfirmCard/index.tsx` — line 51 has `/api/confirm`
2. `grep -c "triggerMiniKitPay" apps/web/src/components/SendModal/index.tsx` — returns 0
3. `grep -n "api/send" apps/web/src/components/SendModal/index.tsx` — line 49 has `/api/send`
4. `grep -n "userId=" apps/web/src/components/DashboardInterface/index.tsx` — line 159 passes userId
5. `tsc --noEmit` in apps/web — no type errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `MOCK_TRANSACTIONS` amounts | `apps/web/src/components/DashboardInterface/index.tsx:15-17` | Transaction history API not yet implemented — Phase 13 will wire live transactions |

## Commits

- `3b629b4` — `feat(12-02): fix ConfirmCard URL bug and rewrite SendModal with real API calls`
- `5316f8e` — `feat(12-02): wire DashboardInterface to pass userId and refetchBalance to SendModal`

## Self-Check: PASSED

All modified files verified to exist on disk. All commits verified in git log.
