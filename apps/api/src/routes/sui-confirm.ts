import { Hono } from 'hono';
import { and, db, eq, transactions } from '@genie/db';
import { verifySuiPayment } from '../chain/sui';

export const suiConfirmRoute = new Hono();

suiConfirmRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { txId, userId, digest } = body;

    if (!txId || typeof txId !== 'string') {
      return c.json({ error: 'txId is required' }, 400);
    }
    if (!userId || typeof userId !== 'string') {
      return c.json({ error: 'userId is required' }, 400);
    }
    if (!digest || typeof digest !== 'string') {
      return c.json({ error: 'digest is required' }, 400);
    }

    const [tx] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, txId), eq(transactions.senderUserId, userId)))
      .limit(1);

    if (!tx) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    if (tx.network !== 'sui:testnet' || tx.asset !== 'SUI' || !tx.amountRaw || !tx.senderWallet) {
      return c.json({ error: 'Transaction is not a Sui testnet payment' }, 400);
    }
    if (tx.status === 'confirmed') {
      return c.json({ error: 'Transaction already confirmed', digest: tx.txHash }, 409);
    }
    if (tx.status === 'expired' || tx.status === 'failed') {
      return c.json({ error: `Transaction is ${tx.status}` }, 410);
    }
    if (tx.expiresAt && new Date(tx.expiresAt) < new Date()) {
      await db.update(transactions).set({ status: 'expired' }).where(eq(transactions.id, txId));
      return c.json({ error: 'Transaction expired' }, 410);
    }

    const verified = await verifySuiPayment({
      digest,
      paymentId: tx.id,
      sender: tx.senderWallet,
      recipient: tx.recipientWallet,
      amountMist: tx.amountRaw,
    });

    await db
      .update(transactions)
      .set({
        status: 'confirmed',
        txHash: verified.digest,
        executedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    return c.json({
      success: true,
      network: 'sui:testnet',
      digest: verified.digest,
      receiptId: verified.receiptId,
      timestampMs: verified.timestampMs,
    });
  } catch (error) {
    console.error('[route:sui-confirm] verification failed:', error);
    return c.json(
      {
        error: 'SUI_PAYMENT_VERIFICATION_FAILED',
        message: error instanceof Error ? error.message : 'Could not verify Sui payment',
      },
      422,
    );
  }
});
