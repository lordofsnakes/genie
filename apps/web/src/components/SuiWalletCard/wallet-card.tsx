'use client';

import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useSuiBalance } from '@/hooks/useSuiBalance';

function shorten(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function SuiWalletCardClient() {
  const { account, balance, loading, error } = useSuiBalance();

  return (
    <section className="rounded-2xl border border-[#6fbcf0]/35 bg-[#101b24] p-5 shadow-[0_0_28px_rgba(111,188,240,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#6fbcf0] shadow-[0_0_10px_#6fbcf0]" />
            <p className="font-headline text-[10px] font-bold uppercase tracking-[0.22em] text-[#9ed8ff]">
              Sui Testnet
            </p>
          </div>
          <p className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-white">
            {account ? (loading ? '…' : error ? '--' : `${balance ?? '0.0000'} SUI`) : 'Connect wallet'}
          </p>
          <p className="mt-1 font-mono text-[11px] text-white/45">
            {account ? shorten(account.address) : 'Wallet-signed on-chain payments'}
          </p>
        </div>
        <div className="shrink-0 rounded-xl bg-white/5 p-1">
          <ConnectButton>Connect Sui</ConnectButton>
        </div>
      </div>
      <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/45">
        Every Genie payment transfers real testnet SUI and creates an owned receipt object.
      </p>
    </section>
  );
}
