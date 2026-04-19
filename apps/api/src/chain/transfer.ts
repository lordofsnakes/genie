import { encodeFunctionData, isAddress, parseUnits } from 'viem';
import {
  chain,
  GENIE_ROUTER_ADDRESS,
  PERMIT2_ADDRESS,
  USDC_ADDRESS,
} from './clients';
import { GenieRouterAbi } from '../contracts/abis';

const Permit2AllowanceAbi = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export type PreparedWalletTransaction = {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: `0x${string}`;
};

export type PreparedTransferPlan = {
  chainId: number;
  permit2: {
    address: `0x${string}`;
    token: `0x${string}`;
    spender: `0x${string}`;
    amount: string;
    expiration: number;
  };
  transactions: PreparedWalletTransaction[];
  amountRaw: string;
  recipient: `0x${string}`;
};

export function prepareOnChainTransfer(
  recipientWallet: `0x${string}`,
  amountUsd: number,
): PreparedTransferPlan {
  if (!isAddress(recipientWallet)) {
    throw new Error('Recipient wallet must be a valid address');
  }
  if (typeof amountUsd !== 'number' || Number.isNaN(amountUsd) || amountUsd <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const amount = parseUnits(amountUsd.toString(), 6);
  const amountUint160Max = (1n << 160n) - 1n;
  if (amount > amountUint160Max) {
    throw new Error('Amount exceeds Permit2 uint160 limit');
  }
  const expiration = 0;

  const permit2ApproveData = encodeFunctionData({
    abi: Permit2AllowanceAbi,
    functionName: 'approve',
    args: [USDC_ADDRESS, GENIE_ROUTER_ADDRESS, amount, expiration],
  });

  const routerCallData = encodeFunctionData({
    abi: GenieRouterAbi,
    functionName: 'route',
    args: [recipientWallet, amount],
  });

  return {
    chainId: chain.id,
    permit2: {
      address: PERMIT2_ADDRESS,
      token: USDC_ADDRESS,
      spender: GENIE_ROUTER_ADDRESS,
      amount: amount.toString(),
      expiration,
    },
    transactions: [
      {
        to: PERMIT2_ADDRESS,
        data: permit2ApproveData,
      },
      {
        to: GENIE_ROUTER_ADDRESS,
        data: routerCallData,
      },
    ],
    amountRaw: amount.toString(),
    recipient: recipientWallet,
  };
}
