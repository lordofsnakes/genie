import { Hono } from 'hono';
import { db, transactions, users, eq, and } from '@genie/db';
import { prepareOnChainTransfer } from '../chain/transfer';

export const confirmRoute = new Hono();

confirmRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { txId, userId, txHash, routeTxHash } = body;

    console.log('[route:confirm] request received', {
      txId,
      userId,
      hasTxHash: Boolean(txHash),
    });

    if (!txId || typeof txId !== 'string') {
      return c.json({ error: 'txId is required' }, 400);
    }
    if (!userId || typeof userId !== 'string') {
      return c.json({ error: 'userId is required' }, 400);
    }

    // Load the pending transaction — must belong to this user
    const [tx] = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.id, txId),
        eq(transactions.senderUserId, userId),
      ))
      .limit(1);

    if (!tx) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    if (tx.status === 'confirmed') {
      return c.json({ error: 'Transaction already confirmed', txHash: tx.txHash }, 409);
    }

    if (tx.status === 'expired' || tx.status === 'failed') {
      return c.json({ error: `Transaction is ${tx.status}` }, 410);
    }

    // Check time-based expiry even if status is still 'pending'
    if (tx.expiresAt && new Date(tx.expiresAt) < new Date()) {
      // Mark as expired in DB
      await db.update(transactions)
        .set({ status: 'expired' })
        .where(eq(transactions.id, txId));
      return c.json({ error: 'Transaction expired' }, 410);
    }

    if (txHash) {
      await db.update(transactions)
        .set({ status: 'confirmed', txHash, executedAt: new Date() })
        .where(eq(transactions.id, txId));

      return c.json({
        success: true,
        routeTxHash,
        txHash,
        amount: tx.amountUsd,
        recipient: tx.recipientWallet,
      });
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      type: 'wallet_transaction_required',
      txId: tx.id,
      amount: parseFloat(tx.amountUsd),
      recipient: tx.recipientWallet,
      expiresInMinutes: 15,
      requiresExplicitConfirmation: true,
      txPlan: prepareOnChainTransfer(tx.recipientWallet as `0x${string}`, parseFloat(tx.amountUsd)),
    });
  } catch (err) {
    console.error('[route:confirm] error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
