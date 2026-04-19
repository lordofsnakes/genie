import { Hono } from 'hono';
import { isAddress } from 'viem';
import { db, transactions, users, eq, and } from '@genie/db';
import { prepareOnChainTransfer } from '../chain/transfer';
import { CCTP_DOMAIN_IDS } from '../chain/bridge';
import { inferCategory } from '../tools/categorize';

export const sendRoute = new Hono();

const PENDING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Chain name mapping — normalizes frontend chain names to CCTP_DOMAIN_IDS keys.
 * null = World Chain (same-chain transfer via prepared wallet transaction bundle).
 * string = cross-chain destination (bridge path still disabled).
 */
const CHAIN_MAP: Record<string, string | null> = {
  'World Chain': null,
  'worldchain': null,
  'Base': 'base',
  'base': 'base',
  'Arbitrum': 'arbitrum',
  'arbitrum': 'arbitrum',
  'Ethereum': 'ethereum',
  'ethereum': 'ethereum',
  'Optimism': 'optimism',
  'optimism': 'optimism',
};

sendRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, recipient, amount, chain: chainName, description } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return c.json({ error: 'userId is required' }, 400);
    }
    if (!recipient || !isAddress(recipient)) {
      return c.json({ error: 'Invalid recipient address' }, 400);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return c.json({ error: 'amount must be a positive number' }, 400);
    }
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
        { error: 'VERIFICATION_REQUIRED', message: 'World ID verification required to send' },
        403,
      );
    }

    const autoApproveUsd = parseFloat(user.autoApproveUsd);
    const destinationChain = CHAIN_MAP[chainName];

    if (destinationChain === null) {
      // World Chain (same-chain) send
      await db
        .update(transactions)
        .set({ status: 'expired' })
        .where(and(eq(transactions.senderUserId, userId), eq(transactions.status, 'pending')));

      if (amount <= autoApproveUsd) {
        const [pending] = await db
          .insert(transactions)
          .values({
            senderUserId: userId,
            recipientWallet: recipient,
            amountUsd: amount.toFixed(2),
            status: 'pending',
            expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
            category: inferCategory(description),
            source: 'genie_send',
          })
          .returning();

        return c.json({
          type: 'wallet_transaction_required',
          txId: pending.id,
          amount,
          recipient,
          expiresInMinutes: 15,
          requiresExplicitConfirmation: false,
          txPlan: prepareOnChainTransfer(recipient as `0x${string}`, amount),
        });
      } else {
        // Explicit in-app confirmation still required for higher amounts
        const [pending] = await db
          .insert(transactions)
          .values({
            senderUserId: userId,
            recipientWallet: recipient,
            amountUsd: amount.toFixed(2),
            status: 'pending',
            expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
            category: inferCategory(description),
            source: 'genie_send',
          })
          .returning();

        return c.json({
          type: 'confirmation_required',
          txId: pending.id,
          amount,
          recipient,
          expiresInMinutes: 15,
        });
      }
    } else {
      // Cross-chain send via CCTP bridge
      if (!(destinationChain in CCTP_DOMAIN_IDS)) {
        return c.json({ error: 'Unsupported chain' }, 400);
      }

      return c.json({
        error: 'PERMIT2_BRIDGE_NOT_READY',
        message: 'Cross-chain sends are temporarily disabled until the Permit2 migration reaches the bridge flow.',
      }, 501);
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
