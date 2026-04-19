/**
 * CCTP domain IDs for supported destination chains.
 * Cross-chain execution remains disabled until the Permit2 migration reaches the bridge flow.
 */
export const CCTP_DOMAIN_IDS: Record<string, number> = {
  ethereum: 0,
  optimism: 2,
  arbitrum: 3,
  base: 6,
};

export async function bridgeUsdc(_: {
  senderWallet: `0x${string}`;
  amountUsd: number;
  destinationChain: string;
  recipientWallet: string;
}): Promise<{ routeTxHash: string; approveTxHash: string; bridgeTxHash: string }> {
  throw new Error('Cross-chain bridging is temporarily disabled until the Permit2 migration reaches the bridge flow');
}
