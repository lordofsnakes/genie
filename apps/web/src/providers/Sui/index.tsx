'use client';

import { DAppKitProvider } from '@mysten/dapp-kit-react';
import type { ReactNode } from 'react';
import { suiDAppKit } from '@/lib/sui';

export function SuiClientProvider({ children }: { children: ReactNode }) {
  return <DAppKitProvider dAppKit={suiDAppKit}>{children}</DAppKitProvider>;
}
