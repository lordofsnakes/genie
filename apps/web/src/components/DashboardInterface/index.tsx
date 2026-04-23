'use client';

import { AddFundsModal } from '@/components/AddFundsModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { SendModal } from '@/components/SendModal';
import { useBalance } from '@/hooks/useBalance';
import { useDebts } from '@/hooks/useDebts';
import { useYieldPosition } from '@/hooks/useYieldPosition';
import { useTransactions } from '@/hooks/useTransactions';
import {
  executeMiniKitTransactionBundle,
  extractMiniKitTransactionHash,
  worldChainReceiptClient,
} from '@/lib/minikit';
import { useUserOperationReceipt } from '@worldcoin/minikit-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { encodeFunctionData, parseUnits } from 'viem';

const WORLD_CHAIN_ID = 480;
const WORLD_USDC_ADDRESS = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' as const;
const RE7_USDC_VAULT_ADDRESS = '0xb1E80387EbE53Ff75a89736097D34dC8D9E9045B' as const;
const RE7_USDC_VAULT_APR = '5.16%';
const RE7_USDC_VAULT_PROVIDER = 'Re7 USDC';

const erc20ApproveAbi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const erc4626DepositAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const;

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
  const [yieldDepositAmount, setYieldDepositAmount] = useState('');
  const [yieldStatus, setYieldStatus] = useState<'idle' | 'signing' | 'success' | 'error'>('idle');
  const [yieldError, setYieldError] = useState('');
  const walletAddress = session?.user?.walletAddress ?? '';
  const userId = session?.user?.id ?? '';
  const { balance, loading: balanceLoading, error: balanceError, refetch: refetchBalance } = useBalance(walletAddress);
  const { transactions, loading: txLoading } = useTransactions(userId);
  const { debts, loading: debtLoading, error: debtError } = useDebts(userId);
  const {
    positionUsd: yieldPositionUsd,
    shares: yieldShares,
    loading: yieldPositionLoading,
    error: yieldPositionError,
    refetch: refetchYieldPosition,
  } = useYieldPosition(walletAddress, RE7_USDC_VAULT_ADDRESS);
  const { poll, isLoading: isPollingYieldReceipt } = useUserOperationReceipt({ client: worldChainReceiptClient });
  const recentTransactions = transactions.slice(0, 5);
  const numericBalance = balance ? parseFloat(balance) : null;
  const hasUsdcToDeposit = !balanceLoading && !balanceError && numericBalance !== null && !Number.isNaN(numericBalance) && numericBalance > 0;
  const suggestedDepositAmount = numericBalance !== null && !Number.isNaN(numericBalance)
    ? Math.max(Math.floor((numericBalance * 0.6) * 100) / 100, 0)
    : 0;
  const parsedYieldDepositAmount = parseFloat(yieldDepositAmount);
  const hasValidYieldDepositAmount = hasUsdcToDeposit
    && !Number.isNaN(parsedYieldDepositAmount)
    && parsedYieldDepositAmount > 0
    && numericBalance !== null
    && parsedYieldDepositAmount <= numericBalance;
  const genieSummary = balanceLoading
    ? 'Checking how much USDC you have available for a yield strategy.'
    : balanceError || numericBalance === null || Number.isNaN(numericBalance)
      ? 'I can suggest a World Chain USDC yield vault as soon as I can read your wallet balance.'
      : numericBalance <= 0
        ? 'Once you have USDC in your wallet, I can suggest a World Chain yield vault for it.'
        : `I see you have $${numericBalance.toFixed(2)} in USDC. Let’s put about $${suggestedDepositAmount.toFixed(2)} of that into a World Chain yield fund. Tap here to make a deposit.`;
  const depositAmountDisplay = hasValidYieldDepositAmount
    ? parsedYieldDepositAmount.toFixed(2)
    : yieldDepositAmount;

  const handleCloseYieldPreview = () => {
    if (yieldStatus === 'signing') return;
    setShowYieldPreview(false);
    setYieldStatus('idle');
    setYieldError('');
  };

  const handleYieldDeposit = async () => {
    if (!walletAddress || !hasValidYieldDepositAmount || numericBalance === null) return;

    setYieldError('');
    setYieldStatus('signing');

    try {
      const amountRaw = parseUnits(parsedYieldDepositAmount.toFixed(2), 6);
      const approveData = encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: 'approve',
        args: [RE7_USDC_VAULT_ADDRESS, amountRaw],
      });
      const depositData = encodeFunctionData({
        abi: erc4626DepositAbi,
        functionName: 'deposit',
        args: [amountRaw, walletAddress as `0x${string}`],
      });

      const { userOpHash } = await executeMiniKitTransactionBundle({
        chainId: WORLD_CHAIN_ID,
        transactions: [
          { to: WORLD_USDC_ADDRESS, data: approveData },
          { to: RE7_USDC_VAULT_ADDRESS, data: depositData },
        ],
      });

      const receipt = await poll(userOpHash);
      const finalHash = extractMiniKitTransactionHash(receipt) ?? userOpHash;
      console.log('[yield] deposit completed', {
        userOpHash,
        finalHash,
        vault: RE7_USDC_VAULT_ADDRESS,
        amountRaw: amountRaw.toString(),
      });

      setYieldStatus('success');
      refetchBalance();
      refetchYieldPosition();
    } catch (err) {
      console.error('[yield] deposit failed', err);
      setYieldError(err instanceof Error ? err.message : 'Vault deposit failed. Try again.');
      setYieldStatus('error');
    }
  };

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
            if (hasUsdcToDeposit) {
              setYieldDepositAmount(suggestedDepositAmount.toFixed(2));
              setYieldStatus('idle');
              setYieldError('');
              setShowYieldPreview(true);
            }
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

      {/* ── Yield Position ── */}
      <div className="px-6 mb-8">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
          Yield Position
        </p>
        <div className="bg-surface rounded-[24px] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
                {RE7_USDC_VAULT_PROVIDER}
              </p>
              <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tighter text-white">
                {yieldPositionLoading
                  ? 'Loading...'
                  : yieldPositionError
                    ? '$--.--'
                    : `$${yieldPositionUsd ?? '0.00'}`}
              </h3>
              <p className="mt-2 text-sm text-white/55">
                {yieldPositionError
                  ? 'Could not load your current vault position.'
                  : yieldPositionUsd === '0.00'
                    ? 'No funds are currently parked in this USDC vault.'
                    : 'Current estimated asset value in the vault.'}
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-right min-w-[110px]">
              <p className="text-[11px] uppercase tracking-widest text-white/35">APR</p>
              <p className="mt-2 font-headline text-lg font-bold text-white">{RE7_USDC_VAULT_APR}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-white/55">
            <span>Vault shares</span>
            <span>{yieldShares ? Number(yieldShares).toFixed(2) : '0.00'}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (hasUsdcToDeposit) {
                setYieldDepositAmount(suggestedDepositAmount.toFixed(2));
                setYieldStatus('idle');
                setYieldError('');
                setShowYieldPreview(true);
              }
            }}
            disabled={!hasUsdcToDeposit}
            className="mt-5 w-full rounded-full bg-accent px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
          >
            Add to yield position
          </button>
        </div>
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
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm px-4 py-6 flex items-center justify-center">
          <div className="w-full max-w-sm mx-auto bg-background border border-white/10 rounded-[28px] p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
                  Yield Preview
                </p>
                <h2 className="font-headline text-2xl font-extrabold tracking-tighter">
                  {RE7_USDC_VAULT_PROVIDER}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseYieldPreview}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Close yield preview"
              >
                <span className="material-symbols-outlined text-white/60 text-lg">close</span>
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Available in wallet</span>
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
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-white/40 text-[11px] uppercase tracking-widest">Protocol</p>
                  <p className="mt-2 font-medium">Morpho</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-white/40 text-[11px] uppercase tracking-widest">APR</p>
                  <p className="mt-2 font-medium">{RE7_USDC_VAULT_APR}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white/40 text-[11px] uppercase tracking-widest">Suggested deposit</p>
                    <p className="mt-2 text-sm text-white/60">
                      Genie suggests parking 60% of your idle USDC in yield.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setYieldDepositAmount(suggestedDepositAmount.toFixed(2))}
                    className="rounded-full border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white/70"
                  >
                    Use 60%
                  </button>
                </div>
                <label className="mt-4 block">
                  <span className="text-white/40 text-[11px] uppercase tracking-widest">Deposit amount</span>
                  <div className="mt-2 flex items-center rounded-2xl bg-background px-4 py-3">
                    <span className="font-headline text-lg font-bold text-white mr-2">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      max={numericBalance?.toFixed(2) ?? undefined}
                      value={yieldDepositAmount}
                      onChange={(e) => {
                        setYieldDepositAmount(e.target.value);
                        if (yieldStatus !== 'idle') setYieldStatus('idle');
                        if (yieldError) setYieldError('');
                      }}
                      className="w-full bg-transparent text-white text-lg outline-none"
                    />
                  </div>
                </label>
                <p className="mt-2 text-[11px] text-white/40">
                  Available: ${numericBalance?.toFixed(2) ?? '0.00'}
                </p>
                {!hasValidYieldDepositAmount && yieldDepositAmount.trim().length > 0 && (
                  <p className="mt-2 text-[11px] text-red-300">
                    Enter an amount above 0 and no more than your current USDC balance.
                  </p>
                )}
              </div>
              <p className="mt-4 text-sm text-white/60 leading-relaxed">
                Tapping deposit opens one bundled wallet transaction to approve USDC and deposit it into this vault.
              </p>
            </div>

            {yieldStatus === 'success' && (
              <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                Deposit submitted successfully. Your balance should refresh in a moment.
              </div>
            )}
            {yieldStatus === 'error' && yieldError && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {yieldError}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCloseYieldPreview}
                disabled={yieldStatus === 'signing'}
                className="rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-white/80"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleYieldDeposit}
                disabled={yieldStatus === 'signing' || isPollingYieldReceipt || !hasValidYieldDepositAmount}
                className="rounded-full bg-accent px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
              >
                {yieldStatus === 'signing' || isPollingYieldReceipt
                  ? 'Opening wallet...'
                  : `Deposit $${depositAmountDisplay}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
