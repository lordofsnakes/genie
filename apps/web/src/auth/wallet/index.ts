import { MiniKit } from '@worldcoin/minikit-js';
import { signIn } from 'next-auth/react';
import { getNewNonces } from './server-helpers';

/**
 * Authenticates a user via their wallet using a nonce-based challenge-response mechanism.
 *
 * This function generates a unique `nonce` and requests the user to sign it with their wallet,
 * producing a `signedNonce`. The `signedNonce` ensures the response we receive from wallet auth
 * is authentic and matches our session creation.
 *
 * @returns {Promise<SignInResponse>} The result of the sign-in attempt.
 * @throws {Error} If wallet authentication fails at any step.
 */
export const walletAuth = async () => {
  const { nonce, signedNonce } = await getNewNonces();

  const result = await MiniKit.walletAuth({
    nonce,
    expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
    statement: `Authenticate (${crypto.randomUUID().replace(/-/g, '')}).`,
  });

  // Guard: if MiniKit did not return a successful payload, abort cleanly
  const payload = result.data;
  if (!payload || !payload.address) {
    console.warn('[walletAuth] MiniKit did not return a success payload:', result);
    throw new Error('wallet_auth_failed');
  }

  const signInResult = await signIn('credentials', {
    redirect: false,
    nonce,
    signedNonce,
    finalPayloadJson: JSON.stringify({
      status: 'success',
      address: payload.address,
      message: payload.message,
      signature: payload.signature,
    }),
  });

  if (signInResult?.error) {
    console.error('[walletAuth] signIn failed:', signInResult.error);
    throw new Error(signInResult.error);
  }
};
