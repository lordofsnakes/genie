import { isAddress, isHex } from 'viem';
import { z } from 'zod';
import { USDC_ADDRESS } from './clients';

const uintString = z.string().regex(/^\d+$/);

export const permit2PayloadSchema = z.object({
  permit: z.object({
    permitted: z.object({
      token: z.string(),
      amount: uintString,
    }),
    nonce: uintString,
    deadline: uintString,
  }),
  signature: z.string(),
});

export type Permit2TransferPayload = {
  permit: {
    permitted: {
      token: `0x${string}`;
      amount: bigint;
    };
    nonce: bigint;
    deadline: bigint;
  };
  signature: `0x${string}`;
};

export function parsePermit2Payload(input: unknown): Permit2TransferPayload {
  const parsed = permit2PayloadSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error('Invalid Permit2 payload');
  }

  const token = parsed.data.permit.permitted.token;
  const signature = parsed.data.signature;

  if (!isAddress(token)) {
    throw new Error('Permit2 payload token must be a valid address');
  }
  if (!isHex(signature)) {
    throw new Error('Permit2 payload signature must be a valid hex string');
  }

  return {
    permit: {
      permitted: {
        token,
        amount: BigInt(parsed.data.permit.permitted.amount),
      },
      nonce: BigInt(parsed.data.permit.nonce),
      deadline: BigInt(parsed.data.permit.deadline),
    },
    signature,
  };
}

export function validatePermit2Transfer(params: {
  payload: Permit2TransferPayload;
  expectedAmount: bigint;
}) {
  const { payload, expectedAmount } = params;

  if (payload.permit.permitted.token.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
    throw new Error(`Permit2 payload token must be USDC (${USDC_ADDRESS})`);
  }

  if (payload.permit.permitted.amount !== expectedAmount) {
    throw new Error(
      `Permit2 payload amount mismatch. Expected ${expectedAmount.toString()}, got ${payload.permit.permitted.amount.toString()}.`,
    );
  }
}
