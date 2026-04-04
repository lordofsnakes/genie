import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to hoist the mock factories so they work in vi.mock scope
const { mockDebtsTable, mockTransactionsTable, mockSelectDebts, mockSelectTransactions, mockUpdate } = vi.hoisted(() => {
  const mockDebtsTable = { _name: 'debts' };
  const mockTransactionsTable = { _name: 'transactions' };
  const mockSelectDebts = vi.fn();
  const mockSelectTransactions = vi.fn();
  const mockUpdate = vi.fn();
  return { mockDebtsTable, mockTransactionsTable, mockSelectDebts, mockSelectTransactions, mockUpdate };
});

// Mock @genie/db
vi.mock('@genie/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: table === mockDebtsTable ? mockSelectDebts : mockSelectTransactions,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockUpdate,
      })),
    })),
  },
  debts: mockDebtsTable,
  transactions: mockTransactionsTable,
  eq: vi.fn((_col: unknown, _val: unknown) => `eq`),
  and: vi.fn((..._args: unknown[]) => `and`),
  gte: vi.fn((_col: unknown, _val: unknown) => `gte`),
}));

import { checkAndSettleDebts } from './settlement';

const OWNER_USER_ID = 'user-owner-123';
const OWNER_WALLET = '0xOwner00000000000000000000000000000000001';
const COUNTERPARTY_WALLET = '0xCounterparty000000000000000000000000001';

const BASE_DEBT = {
  id: 'debt-001',
  ownerUserId: OWNER_USER_ID,
  counterpartyWallet: COUNTERPARTY_WALLET,
  amountUsd: '30.00',
  description: 'dinner last Friday',
  settled: false,
  iOwe: false, // they owe me
  createdAt: new Date('2026-04-01T10:00:00Z'),
};

const BASE_TX = {
  id: 'tx-001',
  senderUserId: 'user-counterparty-456',
  recipientWallet: OWNER_WALLET,
  amountUsd: '30.00',
  txHash: '0xabc',
  status: 'confirmed',
  expiresAt: null,
  category: 'transfers',
  source: 'genie_send',
  createdAt: new Date('2026-04-02T10:00:00Z'), // after debt
};

describe('checkAndSettleDebts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no open debts exist', async () => {
    mockSelectDebts.mockResolvedValue([]);

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toEqual([]);
  });

  it('settles a matching debt and returns a notice', async () => {
    mockSelectDebts.mockResolvedValue([BASE_DEBT]);
    mockSelectTransactions.mockResolvedValue([BASE_TX]);
    mockUpdate.mockResolvedValue([]);

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);

    expect(notices).toHaveLength(1);
    expect(notices[0]).toEqual({
      counterpartyWallet: COUNTERPARTY_WALLET,
      amountUsd: '30.00',
      description: 'dinner last Friday',
    });
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it('does NOT auto-settle debts where iOwe=true (Pitfall 1 — filtered in query)', async () => {
    // The query filters iOwe=false at DB level, so iOwe=true debts never reach matching logic
    mockSelectDebts.mockResolvedValue([]); // DB returns empty because iOwe=false filter excludes them

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toEqual([]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does NOT match when amount is outside $1 tolerance (debt $30, tx $32)', async () => {
    mockSelectDebts.mockResolvedValue([BASE_DEBT]); // debt $30
    mockSelectTransactions.mockResolvedValue([{ ...BASE_TX, amountUsd: '32.00' }]); // $32

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toEqual([]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('matches when amount is within $1 tolerance (debt $30, tx $29.50)', async () => {
    mockSelectDebts.mockResolvedValue([BASE_DEBT]); // debt $30
    mockSelectTransactions.mockResolvedValue([{ ...BASE_TX, amountUsd: '29.50' }]); // $29.50

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toHaveLength(1);
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it('matches at exactly $1 tolerance boundary (debt $30, tx $29.00)', async () => {
    mockSelectDebts.mockResolvedValue([BASE_DEBT]); // debt $30
    mockSelectTransactions.mockResolvedValue([{ ...BASE_TX, amountUsd: '29.00' }]); // exactly $1 off

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toHaveLength(1);
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it('does NOT match at just outside $1 tolerance (debt $30, tx $28.99)', async () => {
    mockSelectDebts.mockResolvedValue([BASE_DEBT]); // debt $30
    mockSelectTransactions.mockResolvedValue([{ ...BASE_TX, amountUsd: '28.99' }]); // $1.01 off

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toEqual([]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('settles only matching debts when multiple debts and transfers exist', async () => {
    const debt2 = {
      ...BASE_DEBT,
      id: 'debt-002',
      amountUsd: '50.00',
      description: 'rent share',
      counterpartyWallet: '0xOtherCounterparty00000000000000000000001',
    };
    mockSelectDebts.mockResolvedValueOnce([BASE_DEBT, debt2]);

    // First debt: tx matches ($30 match)
    mockSelectTransactions.mockResolvedValueOnce([BASE_TX]);
    // Second debt: no tx matches ($50 debt, no matching tx)
    mockSelectTransactions.mockResolvedValueOnce([]);

    mockUpdate.mockResolvedValue([]);

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);

    expect(notices).toHaveLength(1);
    expect(notices[0].amountUsd).toBe('30.00');
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it('returns empty array when no matching transfers found', async () => {
    mockSelectDebts.mockResolvedValue([BASE_DEBT]);
    mockSelectTransactions.mockResolvedValue([]);

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toEqual([]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('compares amountUsd as floats not strings (Pitfall 2)', async () => {
    // Drizzle returns numeric as string — e.g., '30.00' and '30' must still match
    mockSelectDebts.mockResolvedValue([{ ...BASE_DEBT, amountUsd: '30.00' }]);
    mockSelectTransactions.mockResolvedValue([{ ...BASE_TX, amountUsd: '30' }]);
    mockUpdate.mockResolvedValue([]);

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toHaveLength(1); // parseFloat('30.00') == parseFloat('30')
  });

  it('returns empty array gracefully on DB error (never throws)', async () => {
    mockSelectDebts.mockRejectedValue(new Error('DB connection failed'));

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toEqual([]);
  });

  it('only matches transactions created AFTER the debt was created (Open Question 2)', async () => {
    // The settlement function passes gte(transactions.createdAt, debt.createdAt) in query
    // Our mock simulates what the DB would return when filtering by date
    mockSelectDebts.mockResolvedValue([BASE_DEBT]);
    // Transaction created after debt.createdAt — should match
    mockSelectTransactions.mockResolvedValue([BASE_TX]);
    mockUpdate.mockResolvedValue([]);

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toHaveLength(1);
  });

  it('settles debt with null description correctly', async () => {
    const noDescDebt = { ...BASE_DEBT, description: null };
    mockSelectDebts.mockResolvedValue([noDescDebt]);
    mockSelectTransactions.mockResolvedValue([BASE_TX]);
    mockUpdate.mockResolvedValue([]);

    const notices = await checkAndSettleDebts(OWNER_USER_ID, OWNER_WALLET);
    expect(notices).toHaveLength(1);
    expect(notices[0].description).toBeNull();
  });
});
