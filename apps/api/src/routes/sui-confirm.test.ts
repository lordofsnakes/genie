import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mockSelect = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockVerify = vi.fn();

vi.mock('@genie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genie/db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({ where: () => ({ limit: mockSelect }) }),
      }),
      update: () => ({
        set: (values: unknown) => {
          mockUpdateSet(values);
          return { where: mockUpdateWhere };
        },
      }),
    },
    transactions: {},
    eq: actual.eq,
    and: actual.and,
  };
});

vi.mock('../chain/sui', () => ({
  verifySuiPayment: (...args: unknown[]) => mockVerify(...args),
}));

const { suiConfirmRoute } = await import('./sui-confirm');
const app = new Hono();
app.route('/', suiConfirmRoute);

const pending = {
  id: 'payment-123',
  senderUserId: 'user-123',
  senderWallet: `0x${'2'.repeat(64)}`,
  recipientWallet: `0x${'3'.repeat(64)}`,
  amountRaw: '125000000',
  amountUsd: '0.13',
  network: 'sui:testnet',
  asset: 'SUI',
  status: 'pending',
  txHash: null,
  expiresAt: new Date(Date.now() + 60_000),
};

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockResolvedValue([pending]);
  mockUpdateWhere.mockResolvedValue(undefined);
  mockVerify.mockResolvedValue({
    digest: '5fakedigest',
    receiptId: '0xreceipt',
    timestampMs: '123456',
  });
});

describe('POST /sui/confirm', () => {
  it('verifies all prepared payment fields before confirming', async () => {
    const res = await app.fetch(
      request({
        txId: pending.id,
        userId: pending.senderUserId,
        digest: '5fakedigest',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockVerify).toHaveBeenCalledWith({
      digest: '5fakedigest',
      paymentId: pending.id,
      sender: pending.senderWallet,
      recipient: pending.recipientWallet,
      amountMist: pending.amountRaw,
    });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'confirmed',
        txHash: '5fakedigest',
        executedAt: expect.any(Date),
      }),
    );
  });

  it('does not confirm when on-chain verification fails', async () => {
    mockVerify.mockRejectedValue(new Error('Payment event amount does not match'));
    const res = await app.fetch(
      request({
        txId: pending.id,
        userId: pending.senderUserId,
        digest: 'wrong-digest',
      }),
    );
    expect(res.status).toBe(422);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('rejects a record that is not explicitly on Sui testnet', async () => {
    mockSelect.mockResolvedValue([{ ...pending, network: 'worldchain' }]);
    const res = await app.fetch(
      request({
        txId: pending.id,
        userId: pending.senderUserId,
        digest: '5fakedigest',
      }),
    );
    expect(res.status).toBe(400);
    expect(mockVerify).not.toHaveBeenCalled();
  });
});
