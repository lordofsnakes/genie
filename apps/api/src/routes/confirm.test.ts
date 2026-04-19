import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
const mockDbSelectReturn = vi.fn();
const mockDbUpdateSet = vi.fn();
const mockDbUpdateWhere = vi.fn();

// We need to track multiple select calls (one for tx, one for user)
let selectCallCount = 0;
const mockSelectResults: unknown[][] = [];

vi.mock('@genie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genie/db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => {
              const result = mockSelectResults[selectCallCount] ?? [];
              selectCallCount++;
              return Promise.resolve(result);
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: unknown) => {
          mockDbUpdateSet(values);
          return {
            where: (cond: unknown) => {
              mockDbUpdateWhere(cond);
              return Promise.resolve();
            },
          };
        },
      }),
    },
    transactions: {},
    users: {},
    eq: actual.eq,
    and: actual.and,
  };
});

// Mock prepareOnChainTransfer
const mockPrepareTransfer = vi.fn();
vi.mock('../chain/transfer', () => ({
  prepareOnChainTransfer: (...args: unknown[]) => mockPrepareTransfer(...args),
}));

// Import after mocks
const { confirmRoute } = await import('./confirm');

const app = new Hono();
app.route('/', confirmRoute);

const validPendingTx = {
  id: 'tx-uuid-001',
  senderUserId: 'user-uuid-001',
  recipientWallet: '0xRecipient000000000000000000000000000001',
  amountUsd: '50.00',
  txHash: null,
  status: 'pending',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min from now
  createdAt: new Date(),
};

const validUser = {
  id: 'user-uuid-001',
  walletAddress: '0xSender0000000000000000000000000000000001',
  worldId: '0xnull',
  displayName: 'Test User',
  autoApproveUsd: '25',
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  selectCallCount = 0;
  mockSelectResults.length = 0;
  mockDbUpdateSet.mockReturnValue(undefined);
  mockDbUpdateWhere.mockReturnValue(undefined);
  mockPrepareTransfer.mockReturnValue({
    chainId: 480,
    permit2: {
      address: '0xPermit2',
      token: '0xUSDC',
      spender: '0xRouter',
      amount: '50000000',
      expiration: 0,
    },
    transactions: [
      { to: '0xPermit2', data: '0xapprove' },
      { to: '0xRouter', data: '0xroute' },
    ],
    amountRaw: '50000000',
    recipient: validPendingTx.recipientWallet,
  });
});

describe('POST /confirm', () => {
  it('Test 1: returns 400 when txId is missing', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('txId');
  });

  it('Test 2: returns 400 when userId is missing', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('userId');
  });

  it('Test 3: returns 404 when transaction not found', async () => {
    mockSelectResults[0] = []; // No transaction found
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('Transaction not found');
  });

  it('Test 4: returns 410 when transaction status is expired', async () => {
    mockSelectResults[0] = [{ ...validPendingTx, status: 'expired' }];
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(410);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('expired');
  });

  it('Test 5: returns 409 when transaction is already confirmed', async () => {
    mockSelectResults[0] = [{ ...validPendingTx, status: 'confirmed', txHash: '0xexistinghash' }];
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(409);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('already confirmed');
  });

  it('Test 6: returns 410 when transaction expiresAt is in the past', async () => {
    mockSelectResults[0] = [{
      ...validPendingTx,
      status: 'pending',
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    }];
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(410);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('expired');
    // Should update DB to mark as expired
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ status: 'expired' });
  });

  it('Test 7: returns 200 wallet_transaction_required for a pending transaction before final wallet execution', async () => {
    mockSelectResults[0] = [validPendingTx]; // tx found
    mockSelectResults[1] = [validUser];       // user found
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { type: string; txPlan: unknown; requiresExplicitConfirmation: boolean };
    expect(json.type).toBe('wallet_transaction_required');
    expect(json.requiresExplicitConfirmation).toBe(true);
    expect(json.txPlan).toBeDefined();
    expect(mockPrepareTransfer).toHaveBeenCalledWith(validPendingTx.recipientWallet, 50);
  });

  it('Test 8: returns 200 and marks tx confirmed when txHash is supplied after wallet execution', async () => {
    mockSelectResults[0] = [validPendingTx]; // tx found
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txId: 'tx-uuid-001',
        userId: 'user-uuid-001',
        txHash: '0xwalletHash',
        routeTxHash: '0xrouteHash',
      }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; txHash: string };
    expect(json.success).toBe(true);
    expect(json.txHash).toBe('0xwalletHash');
    expect(mockDbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: 'confirmed',
      txHash: '0xwalletHash',
      executedAt: expect.any(Date),
    }));
  });

  it('Test 9: returns 404 when user is missing while preparing the wallet transaction plan', async () => {
    mockSelectResults[0] = [validPendingTx];
    mockSelectResults[1] = [];
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('User not found');
  });
});
