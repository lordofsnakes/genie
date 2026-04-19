import { tool } from 'ai';
import { z } from 'zod';
import { requireVerified } from './require-verified';
import { prepareOnChainTransfer } from '../chain/transfer';
import { inferCategory } from './categorize';
import { db, transactions, eq, and } from '@genie/db';
import type { UserContext } from '../agent/context';

const PENDING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes (D-13)

/**
 * send_usdc tool factory — orchestrates USDC send flow with verification gating
 * and threshold-based auto-approve vs confirmation (FOPS-02, FOPS-04, FOPS-05).
 *
 * Under autoApproveUsd threshold: prepares a wallet transaction bundle and records a pending tx.
 * Over threshold: creates pending tx in DB, returns confirmation_required (D-11).
 *
 * Factory pattern binds userId + userContext per request (same as update_memory).
 * CRITICAL: Uses inputSchema (not parameters) per Vercel AI SDK v6 (Pitfall 2).
 */
export function createSendUsdcTool(userId: string, userContext: UserContext) {
  return tool({
    description:
      'Send USDC to a resolved wallet address. Use resolve_contact first to get the address.',
    inputSchema: z.object({
      recipientAddress: z.string().describe('Resolved 0x wallet address of recipient'),
      amountUsd: z.number().positive().describe('Amount in USD to send'),
      description: z.string().optional().describe('Transaction context from conversation, e.g. "dinner", "rent". Used for spending categorization.'),
    }),
    execute: async ({ recipientAddress, amountUsd, description }) => {
      // Gate: require World ID verification (per Phase 3 guard)
      const gateError = requireVerified(userContext);
      if (gateError) return gateError;

      try {
        await db
          .update(transactions)
          .set({ status: 'expired' })
          .where(
            and(eq(transactions.senderUserId, userId), eq(transactions.status, 'pending')),
          );

        if (amountUsd <= userContext.autoApproveUsd) {
          const [pending] = await db
            .insert(transactions)
            .values({
              senderUserId: userId,
              recipientWallet: recipientAddress,
              amountUsd: amountUsd.toFixed(2),
              status: 'pending',
              expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
              category: inferCategory(description),
              source: 'genie_send',
            })
            .returning();

          return {
            type: 'wallet_transaction_required',
            txId: pending.id,
            amount: amountUsd,
            recipient: recipientAddress,
            expiresInMinutes: 15,
            requiresExplicitConfirmation: false,
            txPlan: prepareOnChainTransfer(recipientAddress as `0x${string}`, amountUsd),
          };
        } else {
          const [pending] = await db
            .insert(transactions)
            .values({
              senderUserId: userId,
              recipientWallet: recipientAddress,
              amountUsd: amountUsd.toFixed(2),
              status: 'pending',
              expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
              category: inferCategory(description),  // categorize even pending txs
              source: 'genie_send',
            })
            .returning();

          return {
            type: 'confirmation_required',
            txId: pending.id,
            amount: amountUsd,
            recipient: recipientAddress,
            expiresInMinutes: 15,
          };
        }
      } catch (err) {
        console.error('[tool:send_usdc] error:', err);
        return {
          error: 'TRANSFER_FAILED',
          message: `Transfer failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}
