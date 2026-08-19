'use client';

import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { useCallback, useEffect, useState } from 'react';
import { formatSuiBalance } from '@/lib/sui';

export function useSuiBalance() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    if (!account?.address) {
      setBalance(null);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const result = await client.getBalance({ owner: account.address });
      setBalance(formatSuiBalance(result.balance.balance));
    } catch (err) {
      console.error('[useSuiBalance] fetch failed:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [account?.address, client]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const refresh = () => {
      void refetch();
    };
    window.addEventListener('genie:sui-payment', refresh);
    return () => window.removeEventListener('genie:sui-payment', refresh);
  }, [refetch]);

  return { account, balance, loading, error, refetch };
}
