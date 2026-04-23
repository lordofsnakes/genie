'use client';

import { AddFundsModal } from '@/components/AddFundsModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { SendModal } from '@/components/SendModal';
import { useBalance } from '@/hooks/useBalance';
import { useDebts } from '@/hooks/useDebts';
import { useTransactions } from '@/hooks/useTransactions';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function formatWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatExpectedCollectionDate(dateStr: string): string {
  const expected = new Date(dateStr);
  expected.setDate(expected.getDate() + 30);

  return expected.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export const DashboardInterface = () => {
  const { data: session } = useSession();

  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showYieldPreview, setShowYieldPreview] = useState(false);
  const walletAddress = session?.user?.walletAddress ?? '';
  const userId = session?.user?.id ?? '';
  const { balance, loading: balanceLoading, error: balanceError, refetch: refetchBalance } = useBalance(walletAddress);
  const { transactions, loading: txLoading } = useTransactions(userId);
  const { debts, loading: debtLoading, error: debtError } = useDebts(userId);
  const recentTransactions = transactions.slice(0, 5);
  const numericBalance = balance ? parseFloat(balance) : null;
  const hasUsdcToDeposit = !balanceLoading && !balanceError && numericBalance !== null && !Number.isNaN(numericBalance) && numericBalance > 0;
  const genieSummary = balanceLoading
    ? 'Checking how much USDC you have available for a yield strategy.'
    : balanceError || numericBalance === null || Number.isNaN(numericBalance)
      ? 'I can suggest a World Chain USDC yield vault as soon as I can read your wallet balance.'
      : numericBalance <= 0
        ? 'Once you have USDC in your wallet, I can suggest a World Chain yield vault for it.'
        : `I see you have $${numericBalance.toFixed(2)} in USDC. Let’s put that into a World Chain yield fund.`;
  const genieSummarySubtext = hasUsdcToDeposit
    ? 'Phase 2 POC: tap to preview one USDC vault on World Chain.'
    : 'Phase 2 POC: this card now reacts to the live balance in your wallet.';

  return (
    <>
    <div className="flex flex-col bg-background text-white font-body overflow-hidden h-full">
    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }}>

      {/* ── Header ── */}
      <div className="px-6 pt-10 pb-4">
        <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-white">
          Home
        </h1>
      </div>

      {/* ── Genie finance summary ── */}
      <div className="px-6 mb-8">
        <button
          type="button"
          onClick={() => {
            if (hasUsdcToDeposit) setShowYieldPreview(true);
          }}
          disabled={!hasUsdcToDeposit}
          className="flex items-end gap-2 w-full text-left disabled:cursor-default"
        >
          <div className="flex-shrink-0 w-20 h-24 self-end">
            <img
              src="/genie.png"
              alt="Genie"
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'screen' }}
            />
          </div>
          <div className="relative flex-1 min-w-0 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white break-words">
            <span
              className="absolute bottom-5 -left-[9px] w-0 h-0"
              style={{
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '10px solid #171717',
              }}
            />
            <div className="flex items-center gap-2 mb-3">
              <span
                className="material-symbols-outlined text-accent text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <span className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
                Genie
              </span>
            </div>
            <p className="text-sm leading-relaxed">{genieSummary}</p>
            <p className="mt-3 text-[11px] uppercase tracking-widest text-white/35">
              {genieSummarySubtext}
            </p>
          </div>
        </button>
      </div>

      {/* ── Total Balance ── */}
      <div className="px-6 mb-6">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
          Total Balance
        </p>
        {balanceLoading ? (
          <div className="h-12 w-32 bg-white/10 animate-pulse rounded" />
        ) : balanceError ? (
          <p className="font-headline text-5xl font-extrabold tracking-tighter text-white/30">$--.--</p>
        ) : (
          <p className="font-headline text-5xl font-extrabold tracking-tighter text-white">
            ${balance ?? '0.00'}
          </p>
        )}
      </div>

      {/* ── Quick actions ── */}
      <div className="px-6 mb-8 grid grid-cols-3 gap-3">
        {[
          { label: 'Send', icon: 'north_east', onClick: () => setShowSend(true) },
          { label: 'Receive', icon: 'south_west', onClick: () => setShowReceive(true) },
          { label: 'Add Funds', icon: 'add', onClick: () => setShowAddFunds(true) },
        ].map(({ label, icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex flex-col items-center gap-2 bg-surface py-4 active:scale-95 transition-transform duration-150"
          >
            <span className="material-symbols-outlined text-accent text-xl">{icon}</span>
            <span className="font-headline text-[10px] uppercase tracking-widest text-white/60 font-bold">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Recent Transactions ── */}
      <div className="px-6">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
          Recent Transactions
        </p>
        <div className="flex flex-col divide-y divide-white/5">
          {txLoading ? (
            <div className="py-4 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-white/5 animate-pulse rounded" />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <p className="py-4 text-sm text-white/40">No transactions yet</p>
          ) : (
            recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-surface flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-white/40 text-base">
                      arrow_upward
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Sent to {formatWallet(tx.recipientWallet)}
                    </p>
                    <p className="text-[11px] text-white/40">{formatRelativeTime(tx.createdAt)}</p>
                  </div>
                </div>
                <p className="font-headline font-bold text-sm text-white/60">
                  -{parseFloat(tx.amountUsd).toFixed(2)} USDC
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Money Lent ── */}
      <div className="px-6 mt-8">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
          Money Lent
        </p>
        <div className="flex flex-col divide-y divide-white/5">
          {debtLoading ? (
            <div className="py-4 flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-white/5 animate-pulse rounded" />
              ))}
            </div>
          ) : debtError ? (
            <p className="py-4 text-sm text-red-400">Could not load money lent.</p>
          ) : debts.length === 0 ? (
            <p className="py-4 text-sm text-white/40">No open loans to collect.</p>
          ) : (
            debts.map((debt) => (
              <div key={debt.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-surface flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-accent text-base">
                      payments
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Lent to {formatWallet(debt.counterpartyWallet)}
                    </p>
                    <p className="text-[11px] text-white/40">
                      Expected by {formatExpectedCollectionDate(debt.createdAt)}
                    </p>
                  </div>
                </div>
                <p className="font-headline font-bold text-sm text-accent">
                  +{parseFloat(debt.amountUsd).toFixed(2)} USDC
                </p>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
    </div>
      {showSend && (
        <SendModal
          onClose={() => { setShowSend(false); refetchBalance(); }}
          userId={session?.user?.id ?? ''}
          refetchBalance={refetchBalance}
        />
      )}
      {showReceive && walletAddress && (
        <ReceiveModal address={walletAddress} onClose={() => setShowReceive(false)} />
      )}
      {showAddFunds && walletAddress && (
        <AddFundsModal address={walletAddress} onClose={() => setShowAddFunds(false)} />
      )}
      {showYieldPreview && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm px-4 py-6 flex items-end">
          <div className="w-full max-w-md mx-auto bg-background border border-white/10 rounded-[28px] p-6 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
                  Yield Preview
                </p>
                <h2 className="font-headline text-2xl font-extrabold tracking-tighter">
                  Morpho USDC Vault
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowYieldPreview(false)}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Close yield preview"
              >
                <span className="material-symbols-outlined text-white/60 text-lg">close</span>
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Available to deposit</span>
                <span className="font-headline text-xl font-bold">
                  ${numericBalance?.toFixed(2) ?? '0.00'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-white/40 text-[11px] uppercase tracking-widest">Asset</p>
                  <p className="mt-2 font-medium">USDC</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-white/40 text-[11px] uppercase tracking-widest">Chain</p>
                  <p className="mt-2 font-medium">World Chain</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-white/60 leading-relaxed">
                For the proof of concept, Genie will route your USDC into one curated vault. The next phase wires this preview into the wallet transaction you can sign.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowYieldPreview(false)}
                className="rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-white/80"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => setShowYieldPreview(false)}
                className="rounded-full bg-accent px-4 py-3 text-sm font-bold text-black"
              >
                Deposit next
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
