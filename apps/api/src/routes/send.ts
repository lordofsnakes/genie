import { Hono } from 'hono';
import { isAddress } from 'viem';
import { db, transactions, users, eq, and } from '@genie/db';
import { prepareOnChainTransfer } from '../chain/transfer';
import { CCTP_DOMAIN_IDS } from '../chain/bridge';
import { inferCategory } from '../tools/categorize';
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';
import { parseSuiToMist } from '../chain/sui';
import { SUI_NETWORK, SUI_PACKAGE_ID } from '../config/env';

export const sendRoute = new Hono();

const PENDING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

function truncateUtf8(value: string, maxBytes: number): string {
  let result = '';
  for (const char of value) {
    if (Buffer.byteLength(result + char, 'utf8') > maxBytes) break;
    result += char;
  }
  return result;
}

/**
 * Chain name mapping — normalizes frontend chain names to CCTP_DOMAIN_IDS keys.
 * null = World Chain (same-chain transfer via prepared wallet transaction bundle).
 * string = cross-chain destination (bridge path still disabled).
 */
const CHAIN_MAP: Record<string, string | null> = {
  Sui: 'sui',
  sui: 'sui',
  'World Chain': null,
  worldchain: null,
  Base: 'base',
  base: 'base',
  Arbitrum: 'arbitrum',
  arbitrum: 'arbitrum',
  Ethereum: 'ethereum',
  ethereum: 'ethereum',
  Optimism: 'optimism',
  optimism: 'optimism',
};

sendRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, recipient, sender, amount, chain: chainName, description } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return c.json({ error: 'userId is required' }, 400);
    }
    const isSui = chainName === 'Sui' || chainName === 'sui';
    const isZeroSuiAddress =
      isSui &&
      typeof recipient === 'string' &&
      isValidSuiAddress(recipient) &&
      normalizeSuiAddress(recipient) === normalizeSuiAddress('0x0');
    if (!recipient || isZeroSuiAddress || (isSui ? !isValidSuiAddress(recipient) : !isAddress(recipient))) {
      return c.json(
        {
          error: isSui ? 'Invalid Sui recipient address' : 'Invalid recipient address',
        },
        400,
      );
    }
    if ((typeof amount !== 'number' && typeof amount !== 'string') || Number(amount) <= 0) {
      return c.json({ error: 'amount must be a positive number' }, 400);
    }
    const amountNumber = Number(amount);
    if (!chainName || !(chainName in CHAIN_MAP)) {
      return c.json({ error: 'Unsupported chain' }, 400);
    }

    // Load user from DB
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verification gate
    if (user.worldId === null) {
      return c.json(
        {
          error: 'VERIFICATION_REQUIRED',
          message: 'World ID verification required to send',
        },
        403,
      );
    }

    const autoApproveUsd = parseFloat(user.autoApproveUsd);
    const destinationChain = CHAIN_MAP[chainName];

    if (destinationChain === 'sui') {
      if (!sender || typeof sender !== 'string' || !isValidSuiAddress(sender)) {
        return c.json({ error: 'A connected Sui sender address is required' }, 400);
      }

      let amountMist: bigint;
      try {
        amountMist = parseSuiToMist(amount);
      } catch (error) {
        return c.json(
          {
            error: error instanceof Error ? error.message : 'Invalid SUI amount',
          },
          400,
        );
      }

      await db
        .update(transactions)
        .set({ status: 'expired' })
        .where(and(eq(transactions.senderUserId, userId), eq(transactions.status, 'pending')));

      const [pending] = await db
        .insert(transactions)
        .values({
          senderUserId: userId,
          senderWallet: normalizeSuiAddress(sender),
          recipientWallet: normalizeSuiAddress(recipient),
          amountUsd: amountNumber.toFixed(2),
          amountRaw: amountMist.toString(),
          asset: 'SUI',
          network: 'sui:testnet',
          status: 'pending',
          expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
          category: inferCategory(description),
          source: 'genie_sui_send',
        })
        .returning();

      return c.json({
        type: 'sui_transaction_required',
        network: SUI_NETWORK,
        txId: pending.id,
        sender: normalizeSuiAddress(sender),
        recipient: normalizeSuiAddress(recipient),
        amount: String(amount),
        amountMist: amountMist.toString(),
        memo: typeof description === 'string' ? truncateUtf8(description, 280) : '',
        packageId: SUI_PACKAGE_ID,
        expiresInMinutes: 15,
      });
    }

    if (destinationChain === null) {
      // World Chain (same-chain) send
      await db
        .update(transactions)
        .set({ status: 'expired' })
        .where(and(eq(transactions.senderUserId, userId), eq(transactions.status, 'pending')));

      if (amountNumber <= autoApproveUsd) {
        const [pending] = await db
          .insert(transactions)
          .values({
            senderUserId: userId,
            recipientWallet: recipient,
            amountUsd: amountNumber.toFixed(2),
            status: 'pending',
            expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
            category: inferCategory(description),
            source: 'genie_send',
          })
          .returning();

        return c.json({
          type: 'wallet_transaction_required',
          txId: pending.id,
          amount: amountNumber,
          recipient,
          expiresInMinutes: 15,
          requiresExplicitConfirmation: false,
          txPlan: prepareOnChainTransfer(recipient as `0x${string}`, amountNumber),
        });
      } else {
        // Explicit in-app confirmation still required for higher amounts
        const [pending] = await db
          .insert(transactions)
          .values({
            senderUserId: userId,
            recipientWallet: recipient,
            amountUsd: amountNumber.toFixed(2),
            status: 'pending',
            expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
            category: inferCategory(description),
            source: 'genie_send',
          })
          .returning();

        return c.json({
          type: 'confirmation_required',
          txId: pending.id,
          amount: amountNumber,
          recipient,
          expiresInMinutes: 15,
        });
      }
    } else {
      // Cross-chain send via CCTP bridge
      if (!(destinationChain in CCTP_DOMAIN_IDS)) {
        return c.json({ error: 'Unsupported chain' }, 400);
      }

      return c.json(
        {
          error: 'PERMIT2_BRIDGE_NOT_READY',
          message: 'Cross-chain sends are temporarily disabled until the Permit2 migration reaches the bridge flow.',
        },
        501,
      );
    }
  } catch (err) {
    console.error('[route:send] error:', err);
    return c.json(
      {
        error: 'SEND_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  }
});
