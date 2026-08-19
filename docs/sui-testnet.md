# Genie payments on Sui testnet

Genie's default send rail uses real Sui testnet transactions. It is intentionally pinned to
`testnet`; there is no mainnet network option in the wallet provider or API configuration.

## Live deployment

- Network: Sui testnet (`4c78adac`)
- Current package (v2): [`0xdd3d…bf9b`](https://suiscan.xyz/testnet/object/0xdd3d4ae5128ac7337b2858622eb89e8dbd1b342f9112e3be1964e110f834bf9b)
- Original package ID: `0x0bdcff4a0db53de157c9549d1ebd69689a2498e3a3edb2a8e54be010df35867f`
- Publish transaction: `HWKG8hvrC3bonPUSKBDhfpijKBtAG8kcywQ28a8Ls59L`
- Upgrade transaction: `AeBUiwKooWFWQutCEexjdUPPVoEkPUPNmcnaeLn9htm1`
- Verified v2 payment transaction: [`2Zajvr…UX6Gp`](https://suiscan.xyz/testnet/tx/2ZajvrkoqEF5PSvXw42iwX5Y9UvtLg5bZSJ96g2UX6Gp)
- Verified v2 receipt object: [`0x54d2…7880`](https://suiscan.xyz/testnet/object/0x54d256e196e4e87b48e30df9135696ac0fa1dcf9f9868ee986bcdf2890347880)

The canonical publication metadata, including the upgrade capability, is committed in
`apps/sui/Published.toml`.

## Payment flow

1. The user connects a Sui wallet. The provider exposes only `testnet`.
2. `POST /api/send` validates the Sui sender/recipient, converts decimal SUI to MIST without
   floating-point arithmetic, and records an expiring pending payment.
3. The browser constructs one programmable transaction block (PTB):
   - split the exact SUI amount from the gas coin;
   - call `payments::pay_sui` with the Genie payment ID and memo;
   - transfer the returned `PaymentReceipt` object to the sender.
4. The wallet signs and executes the PTB on Sui testnet.
5. `POST /api/sui/confirm` retrieves the finalized transaction from the testnet full node. It
   verifies successful execution plus package ID, sender, recipient, amount, and payment ID from
   the emitted `PaymentSent` event before confirming the database row.

The Move call atomically transfers the coin to the recipient, emits the event, and creates the
receipt object. A failed call cannot produce a partial payment.

## Local verification

Install the Sui CLI and set its active environment to testnet, then run:

```bash
pnpm --filter @genie/sui-contracts test
pnpm --filter @genie/api exec vitest run chain/sui.test.ts routes/send.test.ts routes/sui-confirm.test.ts
pnpm --filter @worldcoin/next-15-template build
```

For a deployment, use a dedicated testnet key and never commit its keystore or recovery phrase:

```bash
sui client switch --env testnet
sui client publish apps/sui --gas-budget 200000000
```

After publishing, set `SUI_PACKAGE_ID` for the API. The browser receives that package ID from the
prepared payment response, and the committed package is also the API's testnet fallback.

## Configuration

```dotenv
SUI_GRPC_URL=https://fullnode.testnet.sui.io:443
SUI_PACKAGE_ID=0xdd3d4ae5128ac7337b2858622eb89e8dbd1b342f9112e3be1964e110f834bf9b
NEXT_PUBLIC_SUI_GRPC_URL=https://fullnode.testnet.sui.io:443
```

Apply `apps/db/drizzle/0002_add_payment_network.sql` before deploying the API. It adds the exact
raw amount, asset, network, and chain sender fields used by testnet verification.
