import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chain/clients before importing bridge module
const mockWriteContract = vi.fn();

vi.mock('./clients', () => ({
  getWalletClient: () => ({ writeContract: mockWriteContract }),
  relayerAccount: () => ({ address: '0xrelayer0000000000000000000000000000000001' }),
  chain: { id: 480 },
  GENIE_ROUTER_ADDRESS: '0xRouter0000000000000000000000000000000001' as `0x${string}`,
  USDC_ADDRESS: '0xUSDC00000000000000000000000000000000001' as `0x${string}`,
}));

// Import after mocks
const { bridgeUsdc, CCTP_DOMAIN_IDS } = await import('./bridge');

const SENDER_WALLET = '0xSender0000000000000000000000000000000001' as `0x${string}`;
const RECIPIENT_WALLET = '0xRecipient000000000000000000000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteContract
    .mockResolvedValueOnce('0xrouteTxHash')
    .mockResolvedValueOnce('0xapproveTxHash')
    .mockResolvedValueOnce('0xbridgeTxHash');
});

describe('bridgeUsdc', () => {
  it('Test 1: calls writeContract 3 times and returns routeTxHash, approveTxHash, bridgeTxHash', async () => {
    const result = await bridgeUsdc({
      senderWallet: SENDER_WALLET,
      amountUsd: 50,
      destinationChain: 'base',
      recipientWallet: RECIPIENT_WALLET,
    });

    expect(mockWriteContract).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      routeTxHash: '0xrouteTxHash',
      approveTxHash: '0xapproveTxHash',
      bridgeTxHash: '0xbridgeTxHash',
    });
  });

  it('Test 2: throws error for unknown destination chain', async () => {
    await expect(
      bridgeUsdc({
        senderWallet: SENDER_WALLET,
        amountUsd: 50,
        destinationChain: 'solana',
        recipientWallet: RECIPIENT_WALLET,
      }),
    ).rejects.toThrow('Unknown destination chain: solana');
  });

  it('Test 3: CCTP_DOMAIN_IDS maps ethereum=0, optimism=2, arbitrum=3, base=6', () => {
    expect(CCTP_DOMAIN_IDS.ethereum).toBe(0);
    expect(CCTP_DOMAIN_IDS.optimism).toBe(2);
    expect(CCTP_DOMAIN_IDS.arbitrum).toBe(3);
    expect(CCTP_DOMAIN_IDS.base).toBe(6);
  });
});
