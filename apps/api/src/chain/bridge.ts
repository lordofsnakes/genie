import { erc20Abi, parseUnits, pad } from 'viem';
import { getWalletClient, relayerAccount, chain, GENIE_ROUTER_ADDRESS, USDC_ADDRESS } from './clients';
import { GenieRouterAbi } from '../contracts/abis';

const TOKEN_MESSENGER_WORLD_CHAIN = '0x1682bd6a475003921322496e952627702f7823f9';

const TokenMessengerAbi = [
  {
    type: 'function',
    name: 'depositForBurn',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * CCTP domain IDs for supported destination chains.
 * Only chains supported by Circle CCTP on World Chain testnet.
 */
export const CCTP_DOMAIN_IDS: Record<string, number> = {
  ethereum: 0,
  optimism: 2,
  arbitrum: 3,
  base: 6,
};

/**
 * bridgeUsdc — Shared CCTP bridge utility (extracted from settle_crosschain_debt).
 *
 * Executes 3 on-chain steps:
 * 1. GenieRouter.route(sender, amount, relayer) — pull USDC from user to relayer
 * 2. USDC.approve(TokenMessenger, amount) — approve TokenMessenger to spend relayer's USDC
 * 3. TokenMessenger.depositForBurn(...) — initiate CCTP bridge to destination chain
 *
 * Per viem 2.45 requirement: explicit `account` and `chain` passed to every writeContract call.
 */
export async function bridgeUsdc(params: {
  senderWallet: `0x${string}`;
  amountUsd: number;
  destinationChain: string;
  recipientWallet: string;
}): Promise<{ routeTxHash: string; approveTxHash: string; bridgeTxHash: string }> {
  const { senderWallet, amountUsd, destinationChain, recipientWallet } = params;

  if (!(destinationChain in CCTP_DOMAIN_IDS)) {
    throw new Error(`Unknown destination chain: ${destinationChain}`);
  }

  const walletClient = getWalletClient();
  const relayer = relayerAccount();
  const amountUnits = parseUnits(amountUsd.toString(), 6); // USDC 6 decimals

  // Step 1: Pull funds from User to Relayer via GenieRouter
  const routeTxHash = await walletClient.writeContract({
    account: relayer,
    chain,
    address: GENIE_ROUTER_ADDRESS,
    abi: GenieRouterAbi,
    functionName: 'route',
    args: [senderWallet, amountUnits, relayer.address],
  });

  console.log(`[bridge:bridgeUsdc] Pull TX: ${routeTxHash}`);

  // Step 2: Approve TokenMessenger to spend relayer's USDC
  const approveTxHash = await walletClient.writeContract({
    account: relayer,
    chain,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [TOKEN_MESSENGER_WORLD_CHAIN as `0x${string}`, amountUnits],
  });

  console.log(`[bridge:bridgeUsdc] Approve Messenger TX: ${approveTxHash}`);

  // Step 3: Trigger CCTP Bridge (depositForBurn)
  const destinationDomain = CCTP_DOMAIN_IDS[destinationChain];
  const mintRecipient = pad(recipientWallet as `0x${string}`, { size: 32 });

  const bridgeTxHash = await walletClient.writeContract({
    account: relayer,
    chain,
    address: TOKEN_MESSENGER_WORLD_CHAIN as `0x${string}`,
    abi: TokenMessengerAbi,
    functionName: 'depositForBurn',
    args: [amountUnits, destinationDomain, mintRecipient, USDC_ADDRESS],
  });

  console.log(`[bridge:bridgeUsdc] Bridge TX: ${bridgeTxHash}`);

  return { routeTxHash, approveTxHash, bridgeTxHash };
}
