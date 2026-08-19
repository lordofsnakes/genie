import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';

export const SUI_NETWORK = 'testnet' as const;
export const SUI_GRPC_URL = process.env.NEXT_PUBLIC_SUI_GRPC_URL ?? 'https://fullnode.testnet.sui.io:443';

export const suiDAppKit = createDAppKit({
  networks: [SUI_NETWORK],
  defaultNetwork: SUI_NETWORK,
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: SUI_GRPC_URL }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof suiDAppKit;
  }
}

export interface SuiPaymentPlan {
  type: 'sui_transaction_required';
  network: 'testnet';
  txId: string;
  sender: string;
  recipient: string;
  amount: string;
  amountMist: string;
  memo: string;
  packageId: string;
  expiresInMinutes: number;
}

export function isSuiPaymentPlan(value: unknown): value is SuiPaymentPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<SuiPaymentPlan>;
  return (
    plan.type === 'sui_transaction_required' &&
    plan.network === SUI_NETWORK &&
    typeof plan.txId === 'string' &&
    typeof plan.packageId === 'string' &&
    typeof plan.amountMist === 'string'
  );
}

export function buildSuiPaymentTransaction(plan: SuiPaymentPlan): Transaction {
  const transaction = new Transaction();
  const [paymentCoin] = transaction.splitCoins(transaction.gas, [transaction.pure.u64(BigInt(plan.amountMist))]);
  const receipt = transaction.moveCall({
    target: `${plan.packageId}::payments::pay_sui`,
    arguments: [
      paymentCoin,
      transaction.pure.address(plan.recipient),
      transaction.pure.string(plan.txId),
      transaction.pure.string(plan.memo),
      transaction.object.clock(),
    ],
  });
  transaction.transferObjects([receipt], plan.sender);
  return transaction;
}

export function formatSuiBalance(balanceMist: string): string {
  const mist = BigInt(balanceMist);
  const mistPerSui = BigInt(1_000_000_000);
  const whole = mist / mistPerSui;
  const fraction = (mist % mistPerSui).toString().padStart(9, '0').slice(0, 4);
  return `${whole}.${fraction}`;
}
