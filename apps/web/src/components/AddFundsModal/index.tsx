'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

interface AddFundsModalProps {
  address: string;
  onClose: () => void;
}

export function AddFundsModal({ address, onClose }: AddFundsModalProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 touch-none"
      style={{
        touchAction: 'none',
        backgroundColor: `rgba(0,0,0,${visible ? 0.7 : 0})`,
        transition: 'background-color 220ms ease',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm bg-surface px-5 pt-5 pb-6 flex flex-col items-center gap-4"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(12px)',
          transition: 'opacity 220ms ease, transform 220ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <span className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
            Add Funds
          </span>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center text-white/40 active:text-white"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Instruction */}
        <p className="text-xs text-white/40 text-center leading-relaxed w-full">
          Send USDC to your wallet address below to add funds.
        </p>

        {/* QR code */}
        <div className="bg-white p-3">
          <QRCode value={address} size={160} />
        </div>

        {/* Address + copy */}
        <div className="w-full flex items-center gap-3 bg-background px-4 py-3">
          <p className="flex-1 text-sm text-white/80 font-mono truncate">{short}</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-accent active:scale-95 transition-transform flex-shrink-0"
            aria-label="Copy address"
          >
            <span className="material-symbols-outlined text-base">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span className="font-headline text-[10px] uppercase tracking-widest font-bold">
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
        </div>

        <p className="text-xs text-white/25 text-center">
          Only send USDC or compatible tokens to this address.
        </p>
      </div>
    </div>
  );
}
