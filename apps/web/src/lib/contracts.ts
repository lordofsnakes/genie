export const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1'
) as `0x${string}`;

export const GENIE_ROUTER_ADDRESS = (
  process.env.NEXT_PUBLIC_GENIE_ROUTER_ADDRESS ?? '0x24079Ecda5eEd48a052Bbf795A54b05233B17102'
) as `0x${string}`;
