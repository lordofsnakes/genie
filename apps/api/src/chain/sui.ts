import { SuiGrpcClient } from '@mysten/sui/grpc';
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';
import { SUI_GRPC_URL, SUI_NETWORK, SUI_PACKAGE_ID } from '../config/env';

export const MIST_PER_SUI = 1_000_000_000n;
const PAYMENT_EVENT = '::payments::PaymentSent';

export const suiClient = new SuiGrpcClient({
  network: SUI_NETWORK,
  baseUrl: SUI_GRPC_URL,
});

export function parseSuiToMist(value: string | number): bigint {
  const raw = typeof value === 'number' ? value.toString() : value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/.test(raw)) {
    throw new Error('amount must be a positive SUI value with at most 9 decimal places');
  }

  const [whole, fraction = ''] = raw.split('.');
  const mist = BigInt(whole) * MIST_PER_SUI + BigInt(fraction.padEnd(9, '0'));
  if (mist <= 0n) {
    throw new Error('amount must be greater than 0 SUI');
  }
  return mist;
}

export interface ExpectedSuiPayment {
  digest: string;
  paymentId: string;
  sender: string;
  recipient: string;
  amountMist: string;
  packageId?: string;
}

export interface VerifiedSuiPayment {
  digest: string;
  receiptId: string;
  timestampMs: string;
}

type VerificationClient = Pick<SuiGrpcClient, 'waitForTransaction'>;

function eventString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'bytes' in value) {
    return eventString((value as { bytes: unknown }).bytes);
  }
  throw new Error('Payment event contains an invalid string field');
}

export async function verifySuiPayment(
  expected: ExpectedSuiPayment,
  client: VerificationClient = suiClient,
): Promise<VerifiedSuiPayment> {
  const packageId = normalizeSuiAddress(expected.packageId ?? SUI_PACKAGE_ID);
  if (packageId === normalizeSuiAddress('0x0')) {
    throw new Error('SUI_PACKAGE_ID is not configured');
  }
  if (!isValidSuiAddress(expected.sender) || !isValidSuiAddress(expected.recipient)) {
    throw new Error('Expected Sui payment addresses are invalid');
  }

  const result = await client.waitForTransaction({
    digest: expected.digest,
    timeout: 60_000,
    include: { effects: true, events: true, transaction: true },
  });

  if (result.FailedTransaction) {
    throw new Error(`Sui transaction failed: ${result.FailedTransaction.status.error?.message ?? 'unknown error'}`);
  }

  const transaction = result.Transaction;
  if (!transaction.status.success) {
    throw new Error('Sui transaction was not successful');
  }

  const sender = normalizeSuiAddress(expected.sender);
  const recipient = normalizeSuiAddress(expected.recipient);
  if (!transaction.transaction?.sender || normalizeSuiAddress(transaction.transaction.sender) !== sender) {
    throw new Error('Sui transaction sender does not match the prepared payment');
  }

  const event = transaction.events?.find(
    (candidate) =>
      normalizeSuiAddress(candidate.packageId) === packageId && candidate.eventType.endsWith(PAYMENT_EVENT),
  );
  if (!event?.json) {
    throw new Error('Genie payment event was not found in the Sui transaction');
  }

  const json = event.json;
  if (normalizeSuiAddress(String(json.sender)) !== sender) {
    throw new Error('Payment event sender does not match');
  }
  if (normalizeSuiAddress(String(json.recipient)) !== recipient) {
    throw new Error('Payment event recipient does not match');
  }
  if (String(json.amount_mist) !== expected.amountMist) {
    throw new Error('Payment event amount does not match');
  }
  if (eventString(json.payment_id) !== expected.paymentId) {
    throw new Error('Payment event ID does not match');
  }

  return {
    digest: transaction.digest,
    receiptId: String(json.receipt_id),
    timestampMs: String(json.timestamp_ms),
  };
}
