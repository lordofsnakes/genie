'use client';

import dynamic from 'next/dynamic';

export const SuiWalletCard = dynamic(() => import('./wallet-card').then((module) => module.SuiWalletCardClient), {
  ssr: false,
  loading: () => <div className="h-[162px] animate-pulse rounded-2xl bg-[#101b24]" />,
});
