# Permit2 Migration Plan

This document tracks the migration from the broken ERC-20 approval flow to a World-supported Permit2 architecture.

## Context

The original allowance-based design depended on raw ERC-20 `approve(router, amount)` and relayer-side `transferFrom`. That path was already invalid for Genie.

We then built an intermediate Permit2 `SignatureTransfer` architecture across:

- contracts
- backend
- frontend signing prototype

That prototype is now also blocked for the live World App flow.

On April 19, 2026, phone validation of Phase 3 showed:

- `MiniKit.signTypedData(...)` returned `disallowed_operation`

So the new target architecture is no longer `SignatureTransfer`. The new target is the World-supported Permit2 allowance-transfer transaction path described in [`permit2-flow-design.md`](./permit2-flow-design.md).

## Checkpoints

- rollback checkpoint before Permit2 work:
  - commit `4bddc76`
  - tag `pre-permit2-approval-checkpoint-2026-04-19`
- migration plan commit:
  - commit `a4e6b85`

## Current State

### Completed

- Phase 0 freeze of raw approval UX
- contract/backend work for a Permit2 `SignatureTransfer` model
- frontend proof-of-concept for `MiniKit.signTypedData(...)`

### Validated Blocker

- World App rejects the `SignatureTransfer` signing path with `disallowed_operation`

### Consequence

- Phase 3 cannot complete on the current `signTypedData + SignatureTransfer` design
- Phase 1 and Phase 2 are now considered transitional work, not the final architecture

## Updated Target Outcome

Replace the broken approval flow with a MiniKit-supported bundled transaction where:

- the frontend uses `MiniKit.sendTransaction(...)`
- Permit2 `approve(token, spender, amount, 0)` is executed first
- Genie contract logic consumes that Permit2 approval immediately in the same transaction
- Genie sends exactly the intended USDC amount to the intended recipient
- backend records execution outcome and confirmation state

## Revised Phases

## Phase A: Stop The Broken Signature Path

Goal:
- prevent vague user-facing failures while the architecture pivots

Work:
- surface `disallowed_operation` and related World App errors explicitly in the UI
- document that `MiniKit.signTypedData(...)` is not viable for Genie’s live flow
- keep the current frontend signing code only as diagnostic scaffolding until the pivot lands

Exit criteria:
- users no longer see generic “something went wrong” messaging for the blocked signing flow
- docs reflect the actual platform constraint

## Phase B: Redesign Contracts For Permit2 Allowance Transfer

Goal:
- replace the transitional `SignatureTransfer` router flow with a contract surface compatible with bundled `sendTransaction(...)`

Work:
- redesign `GenieRouter` around Permit2 allowance transfer consumption
- remove dependence on frontend-signed `PermitTransferFrom` payloads
- bind recipient and amount in the contract execution path
- update or replace tests that currently assume `SignatureTransfer`

Exit criteria:
- contracts can consume a Permit2 approval in the same transaction and route exact USDC safely

## Phase C: Refactor Backend For Bundled Transaction Recording

Goal:
- align backend responsibilities with the new frontend-executed transaction model

Work:
- remove backend assumptions that it will receive `SignatureTransfer` payloads
- redefine `/api/send` and `/api/confirm` around:
  - transaction preparation metadata
  - pending transaction bookkeeping
  - post-execution recording
- keep exact amount and recipient consistency checks in backend state transitions

Exit criteria:
- backend no longer requires `permitPayload`
- backend cleanly supports pending and executed Genie transfers under the new transaction model

## Phase D: Implement Frontend Bundled Transaction Flow

Goal:
- replace blocked typed-data signing with the World-supported MiniKit transaction path

Work:
- build a new execution flow using `MiniKit.sendTransaction(...)`
- bundle:
  - Permit2 `approve(token, spender, amount, 0)`
  - Genie contract call
- confirm all required contracts and tokens are allowlisted in Developer Portal
- surface platform errors directly:
  - `invalid_contract`
  - `disallowed_operation`
  - `simulation_failed`
  - `user_rejected`

Exit criteria:
- same-chain Genie send works end to end in World App with no `signTypedData` dependency

## Phase E: Reconnect Threshold And Confirmation UX

Goal:
- preserve product behavior while using the new transaction primitive

Work:
- under threshold:
  - execute with a single bundled World App confirmation
- over threshold:
  - create pending tx
  - require explicit user confirmation in-product
  - then trigger the bundled World App transaction
- ensure pending records still bind:
  - sender
  - recipient
  - amount

Exit criteria:
- threshold behavior works again on top of the supported transaction architecture

## Phase F: Cleanup Transitional SignatureTransfer Work

Goal:
- remove the dead-end architecture once the new path is verified

Work:
- delete frontend typed-data Permit2 signing helpers
- remove backend `permitPayload` parsing/validation
- replace or delete contract code built around `SignatureTransfer`
- update tests and operator docs

Exit criteria:
- no active code path depends on the blocked `SignatureTransfer` model

## Recommended Build Order

1. Phase A
2. Phase B
3. Phase C
4. Phase D
5. Phase E
6. Phase F

## Working Recommendation

Do not spend more implementation time on `MiniKit.signTypedData(...)` for Genie’s live send flow.

The next real build step is Phase B: redesign the contract surface for a bundled `MiniKit.sendTransaction(...)` path that uses Permit2 allowance transfer mechanics.
