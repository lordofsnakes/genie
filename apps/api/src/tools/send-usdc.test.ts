import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockInsert,
  mockUpdate,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

// Mock chain/transfer module
vi.mock('../chain/transfer', () => ({
  prepareOnChainTransfer: vi.fn(),
}));

// Mock @genie/db
vi.mock('@genie/db', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
  },
  transactions: {},
  eq: vi.fn(),
  and: vi.fn(),
}));

// Mock categorize module
vi.mock('./categorize', () => ({
  inferCategory: vi.fn((desc: string | null | undefined) => {
    if (!desc) return 'transfers';
    if (desc.toLowerCase().includes('dinner')) return 'food';
    return 'transfers';
  }),
}));

// Mock require-verified
vi.mock('./require-verified', () => ({
  requireVerified: vi.fn(),
}));

import { createSendUsdcTool } from './send-usdc';
import { prepareOnChainTransfer } from '../chain/transfer';
import { db } from '@genie/db';
import { requireVerified } from './require-verified';
import { inferCategory } from './categorize';

const mockPrepareOnChainTransfer = prepareOnChainTransfer as ReturnType<typeof vi.fn>;
const mockRequireVerified = requireVerified as ReturnType<typeof vi.fn>;

const BASE_USER_ID = 'user-abc-123';
const BASE_USER_CONTEXT = {
  walletAddress: '0xSender00000000000000000000000000000000001',
  displayName: 'Alice',
  autoApproveUsd: 25,
  isVerified: true,
  isHumanBacked: true,
};
const RECIPIENT = '0xRecipient0000000000000000000000000000001';

describe('createSendUsdcTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: pass verification
    mockRequireVerified.mockReturnValue(null);
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'tx-pending-id-1' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    mockInsert.mockReturnValue({ values: insertValues });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockPrepareOnChainTransfer.mockReturnValue({
      chainId: 480,
      permit2: {
        address: '0xPermit2',
        token: '0xUSDC',
        spender: '0xRouter',
        amount: '10000000',
        expiration: 0,
      },
      transactions: [
        { to: '0xPermit2', data: '0xapprove' },
        { to: '0xRouter', data: '0xroute' },
      ],
      amountRaw: '10000000',
      recipient: RECIPIENT,
    });
  });

  it('returns VERIFICATION_REQUIRED error when userContext.isVerified is false', async () => {
    mockRequireVerified.mockReturnValue({
      error: 'VERIFICATION_REQUIRED',
      message: 'This action requires World ID verification. Please verify to continue.',
    });
    const tool = createSendUsdcTool(BASE_USER_ID, { ...BASE_USER_CONTEXT, isVerified: false });
    const result = await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10 },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({ error: 'VERIFICATION_REQUIRED' });
    expect(mockPrepareOnChainTransfer).not.toHaveBeenCalled();
  });

  it('creates a pending tx and returns wallet_transaction_required when amountUsd <= autoApproveUsd', async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'auto-pending-1' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    const result = await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10 }, // 10 <= 25
      { messages: [], toolCallId: 'test' },
    );

    expect(mockPrepareOnChainTransfer).toHaveBeenCalledWith(RECIPIENT, 10);
    expect(result).toMatchObject({
      type: 'wallet_transaction_required',
      txId: 'auto-pending-1',
      amount: 10,
      recipient: RECIPIENT,
      requiresExplicitConfirmation: false,
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('creates pending transaction and returns confirmation_required when amountUsd > autoApproveUsd', async () => {
    const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: updateSet });
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'pending-tx-999' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    const result = await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 100 }, // 100 > 25
      { messages: [], toolCallId: 'test' },
    );

    expect(mockPrepareOnChainTransfer).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: 'confirmation_required',
      txId: 'pending-tx-999',
      amount: 100,
      recipient: RECIPIENT,
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('cancels existing pending transactions before creating a new one', async () => {
    const whereUpdate = vi.fn().mockResolvedValue([]);
    const setUpdate = vi.fn().mockReturnValue({ where: whereUpdate });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setUpdate });
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'new-pending' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 100 },
      { messages: [], toolCallId: 'test' },
    );

    // db.update should be called to expire existing pending transactions
    expect(db.update).toHaveBeenCalled();
    expect(setUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
  });

  it('returns TRANSFER_FAILED error when on-chain transfer throws', async () => {
    mockPrepareOnChainTransfer.mockImplementation(() => {
      throw new Error('Blockchain rejected tx');
    });
    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    const result = await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10 },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({
      error: 'TRANSFER_FAILED',
      message: expect.stringContaining('Blockchain rejected tx'),
    });
  });

  it('stores category "food" when description is "dinner" on auto-approved pending transaction', async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'pending-auto-cat' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10, description: 'dinner' },
      { messages: [], toolCallId: 'test' },
    );

    expect(inferCategory).toHaveBeenCalledWith('dinner');
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'food', source: 'genie_send' }),
    );
  });

  it('stores category "transfers" when no description provided on auto-approved pending transaction', async () => {
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'pending-auto-default' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10 },
      { messages: [], toolCallId: 'test' },
    );

    expect(inferCategory).toHaveBeenCalledWith(undefined);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'transfers', source: 'genie_send' }),
    );
  });

  it('stores category and source on pending transaction too', async () => {
    const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: updateSet });
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'pending-cat-test' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 100, description: 'dinner' }, // 100 > 25 → pending
      { messages: [], toolCallId: 'test' },
    );

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'food', source: 'genie_send', status: 'pending' }),
    );
  });
});
