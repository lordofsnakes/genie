import { describe, expect, it } from 'vitest';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { parseSuiToMist, verifySuiPayment } from './sui';

const PACKAGE = `0x${'1'.repeat(64)}`;
const SENDER = `0x${'2'.repeat(64)}`;
const RECIPIENT = `0x${'3'.repeat(64)}`;

function clientWithEvent(overrides: Record<string, unknown> = {}) {
  return {
    waitForTransaction: async () => ({
      $kind: 'Transaction' as const,
      Transaction: {
        digest: 'digest-123',
        signatures: [],
        epoch: '1',
        status: { success: true as const, error: null },
        effects: {},
        transaction: { sender: normalizeSuiAddress(SENDER) },
        events: [
          {
            packageId: PACKAGE,
            module: 'payments',
            sender: SENDER,
            eventType: `${PACKAGE}::payments::PaymentSent`,
            bcs: new Uint8Array(),
            json: {
              receipt_id: '0xreceipt',
              payment_id: 'payment-123',
              sender: SENDER,
              recipient: RECIPIENT,
              amount_mist: '1250000000',
              timestamp_ms: '123456',
              ...overrides,
            },
          },
        ],
        balanceChanges: undefined,
        objectTypes: undefined,
        bcs: undefined,
      },
      protoJson: undefined,
    }),
  };
}

describe('parseSuiToMist', () => {
  it('converts exact decimal SUI values without floating point math', () => {
    expect(parseSuiToMist('1.25')).toBe(1_250_000_000n);
    expect(parseSuiToMist('0.000000001')).toBe(1n);
  });

  it('rejects zero and values with more than 9 decimal places', () => {
    expect(() => parseSuiToMist('0')).toThrow();
    expect(() => parseSuiToMist('1.0000000001')).toThrow();
  });
});

describe('verifySuiPayment', () => {
  const expected = {
    digest: 'digest-123',
    paymentId: 'payment-123',
    sender: SENDER,
    recipient: RECIPIENT,
    amountMist: '1250000000',
    packageId: PACKAGE,
  };

  it('accepts a finalized matching payment event', async () => {
    await expect(verifySuiPayment(expected, clientWithEvent() as never)).resolves.toEqual({
      digest: 'digest-123',
      receiptId: '0xreceipt',
      timestampMs: '123456',
    });
  });

  it('rejects a digest whose event amount differs', async () => {
    await expect(verifySuiPayment(expected, clientWithEvent({ amount_mist: '1' }) as never)).rejects.toThrow(
      'amount does not match',
    );
  });

  it('rejects a digest whose payment ID differs', async () => {
    await expect(verifySuiPayment(expected, clientWithEvent({ payment_id: 'other' }) as never)).rejects.toThrow(
      'ID does not match',
    );
  });
});
