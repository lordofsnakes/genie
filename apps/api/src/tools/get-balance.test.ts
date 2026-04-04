import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the chain clients module so we don't need a real RPC connection
vi.mock('../chain/clients', () => ({
  publicClient: {
    readContract: vi.fn(),
  },
  USDC_ADDRESS: '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88',
}));

import { createGetBalanceTool } from './get-balance';
import { publicClient } from '../chain/clients';

const mockReadContract = publicClient.readContract as ReturnType<typeof vi.fn>;

const baseContext = {
  walletAddress: '0xUserWallet000000000000000000000000000000',
  displayName: 'Alice',
  autoApproveUsd: 25,
  isVerified: true,
  isHumanBacked: true,
};

describe('createGetBalanceTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns balance object with correct shape when readContract succeeds (100 USDC)', async () => {
    mockReadContract.mockResolvedValue(100000000n); // 100.0 USDC (6 decimals)
    const tool = createGetBalanceTool(baseContext);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({
      balance: '100',
      currency: 'USDC',
      chain: 'World Chain',
    });
  });

  it('returns error object when readContract throws', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC error'));
    const tool = createGetBalanceTool(baseContext);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      error: 'FETCH_FAILED',
      message: expect.any(String),
    });
  });

  it('correctly formats 6-decimal USDC: 1500000n → "1.5"', async () => {
    mockReadContract.mockResolvedValue(1500000n);
    const tool = createGetBalanceTool(baseContext);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({ balance: '1.5' });
  });
});
