# Permit2 Transaction Flow Design

This note defines the updated target flow after validating the Phase 3 prototype on April 19, 2026.

## Status

The original Permit2 `SignatureTransfer` design is no longer the target architecture for this app.

During phone validation, World App rejected the `MiniKit.signTypedData(...)` authorization request with:

- `disallowed_operation`

That means the current frontend-typed-signature path is not viable in the World App environment for Genie.

## Updated Goal

Allow Genie to move a specific amount of user USDC through a World-supported MiniKit transaction flow without relying on a long-lived raw ERC-20 approval.

## Updated Model

Use MiniKit `sendTransaction(...)` with Permit2 `AllowanceTransfer` semantics in a bundled World Chain transaction:

1. Permit2 `approve(token, spender, amount, expiration=0)`
2. Genie contract call that immediately consumes the Permit2 approval in the same transaction

This follows the current World Mini Apps guidance:

- `sendTransaction` recommends Permit2 Allowance Transfers
- SignatureTransfer is no longer supported in that transaction path
- standard ERC-20 approval is not the intended architecture for Genie

## Target Flow

1. The user initiates a Genie action that may move USDC.
2. The frontend determines whether the send is same-chain and executable now.
3. For same-chain execution, the frontend calls `MiniKit.sendTransaction(...)` with a bundled transaction:
   - first call Permit2 `approve(token, spender, amount, 0)`
   - then call Genie’s router/entry contract
4. The Genie contract uses Permit2 allowance transfer mechanics to pull exactly the approved amount in the same transaction.
5. The handler forwards USDC to the final recipient.
6. The backend records the final executed transaction and associated receipts.

## Contract Responsibilities

### Genie Router

- accept direct execution from the World-supported bundled transaction path
- consume Permit2 allowance transfer for exact USDC amount semantics
- bind execution to the intended recipient and amount
- minimize or eliminate any relayer-only assumptions that no longer fit the bundled transaction model

### Pay Handler

- receive routed USDC
- transfer USDC to the final recipient
- remain simple and auditable

## Backend Responsibilities

- stop expecting a frontend-signed `SignatureTransfer` payload
- accept final transaction identifiers and record resulting state
- keep pending/confirmation bookkeeping for product UX
- validate receipts and execution outcomes after the bundled transaction settles

## Frontend Responsibilities

- clearly explain that the user is confirming a one-time spend for this transfer
- use `MiniKit.sendTransaction(...)`, not `MiniKit.signTypedData(...)`, for the live World App flow
- surface World App error codes directly when the platform blocks a request

## Security Properties Required

- exact token binding
- exact amount binding
- intended recipient binding in contract execution
- same-transaction consumption of the Permit2 approval
- no standing Genie-controlled token approval left behind
- explicit handling for World App rejections and allowlist issues
