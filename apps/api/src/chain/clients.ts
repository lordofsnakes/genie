import { createPublicClient, createWalletClient, http } from 'viem';
import { worldchain, worldchainSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  WORLD_CHAIN_RPC_URL,
  WORLD_CHAIN_TESTNET,
  RELAYER_PRIVATE_KEY,
  GENIE_ROUTER_ADDRESS,
  PAY_HANDLER_ADDRESS,
  PERMIT2_ADDRESS,
  USDC_ADDRESS_TESTNET,
  USDC_ADDRESS_MAINNET,
} from '../config/env';

export { GENIE_ROUTER_ADDRESS, PAY_HANDLER_ADDRESS, PERMIT2_ADDRESS };

export const chain = WORLD_CHAIN_TESTNET ? worldchainSepolia : worldchain;

export const publicClient = createPublicClient({
  chain,
  transport: http(WORLD_CHAIN_RPC_URL),
});

// Lazy-init wallet client to avoid crash when RELAYER_PRIVATE_KEY not set (e.g., in tests importing this module indirectly)
let _walletClient: ReturnType<typeof createWalletClient> | null = null;
let _relayerAccount: ReturnType<typeof privateKeyToAccount> | null = null;

function getRelayerAccountInstance() {
  if (!_relayerAccount) {
    const key = RELAYER_PRIVATE_KEY;
    if (!key) throw new Error('RELAYER_PRIVATE_KEY env var is required for wallet operations');
    _relayerAccount = privateKeyToAccount(key as `0x${string}`);
  }
  return _relayerAccount;
}

export function getWalletClient() {
  if (!_walletClient) {
    _walletClient = createWalletClient({
      account: getRelayerAccountInstance(),
      chain,
      transport: http(WORLD_CHAIN_RPC_URL),
    });
  }
  return _walletClient;
}

export function relayerAccount() {
  return getRelayerAccountInstance();
}

// USDC contract addresses (verified from WorldScan and docs.world.org)
export const USDC_ADDRESS: `0x${string}` = (
  WORLD_CHAIN_TESTNET ? USDC_ADDRESS_TESTNET : USDC_ADDRESS_MAINNET
) as `0x${string}`;
