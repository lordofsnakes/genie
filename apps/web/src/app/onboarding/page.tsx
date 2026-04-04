'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const GOALS = [
  'Financial planning',
  'Investing',
  'Financial accountability',
  'Lending',
  'Other',
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [budget, setBudget] = useState('100');
  const dirRef = useRef<'forward' | 'back'>('forward');
  const touchStartX = useRef<number | null>(null);

  const goTo = (next: number) => {
    if (next < 0 || next > 2) return;
    dirRef.current = next > step ? 'forward' : 'back';
    setStep(next);
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  };

  const finish = () => {
    localStorage.setItem('genie_onboarding_done', '1');
    router.push('/home');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 60) return; // too short — ignore
    if (dx < 0) {
      // swipe left → forward (only if there's a valid next step)
      goTo(step + 1);
    } else {
      // swipe right → back
      goTo(step - 1);
    }
  };

  const animClass =
    dirRef.current === 'forward'
      ? 'onboarding-enter-forward'
      : 'onboarding-enter-back';

  return (
    <div
      className="h-dvh bg-background text-white flex flex-col overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar — fully centered */}
      <div className="px-6 pt-10 pb-0 flex-shrink-0">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full transition-colors duration-300"
              style={{ backgroundColor: i <= step ? '#ccff00' : '#2a2a2a' }}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div key={step} className={`flex-1 min-h-0 flex flex-col ${animClass}`}>
        {step === 0 && <StepWelcome onNext={() => goTo(1)} />}
        {step === 1 && (
          <StepGoals
            selected={selectedGoals}
            onToggle={toggleGoal}
            onNext={() => goTo(2)}
          />
        )}
        {step === 2 && (
          <StepBudget budget={budget} onChange={setBudget} onFinish={finish} />
        )}
      </div>

      {/* Back button — bottom, only on steps > 0 */}
      {step > 0 && (
        <div className="flex-shrink-0 px-6 pb-8 flex justify-center">
          <button
            onClick={() => goTo(step - 1)}
            aria-label="Back"
            className="flex items-center gap-1.5 text-white/30 active:text-white/60 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
            <span className="font-headline text-xs uppercase tracking-widest font-bold">Back</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Shared CTA button ── */
function CtaButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-transparent py-5 font-headline font-extrabold text-xl uppercase tracking-widest active:opacity-60 transition-opacity duration-150 disabled:opacity-20 disabled:pointer-events-none"
      style={{ color: '#ccff00' }}
    >
      {children}
    </button>
  );
}

/* ── Step 1: Welcome ── */
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex-1 flex flex-col px-6 pb-4">
      <div className="pt-10 mb-8">
        <p className="font-headline text-[11px] uppercase tracking-[0.25em] text-accent font-bold mb-3">
          Welcome
        </p>
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter leading-tight text-white">
          Take control of your financial habits.
        </h1>
        <p className="font-headline text-4xl font-extrabold tracking-tighter text-accent mt-1">
          Meet Genie.
        </p>
      </div>

      <div className="flex items-center justify-center h-64">
        <img
          src="/genie.png"
          alt="Genie"
          className="w-64 h-full object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      <div className="mt-6 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-14 h-16 -mt-2">
            <img
              src="/genie.png"
              alt=""
              aria-hidden
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'screen' }}
            />
          </div>
          <div className="relative flex-1 bg-surface p-4 rounded-t-2xl rounded-br-2xl">
            <span
              className="absolute bottom-4 -left-[9px] w-0 h-0"
              style={{
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '10px solid #171717',
              }}
            />
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="material-symbols-outlined text-accent text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <span className="font-headline text-[9px] uppercase tracking-widest text-accent font-bold">
                Genie
              </span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">
              Let&apos;s get going with Genie!
            </p>
          </div>
        </div>

        <CtaButton onClick={onNext}>Get Started</CtaButton>
      </div>
    </div>
  );
}

/* ── Step 2: Goals ── */
function StepGoals({
  selected,
  onToggle,
  onNext,
}: {
  selected: string[];
  onToggle: (g: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col px-6 pb-4">
      <div className="pt-10 mb-10">
        <p className="font-headline text-[11px] uppercase tracking-[0.25em] text-accent font-bold mb-3">
          Your Goals
        </p>
        <h1 className="font-headline text-3xl font-extrabold tracking-tighter leading-tight text-white">
          Why do you want to use Genie?
        </h1>
        <p className="text-sm text-white/40 mt-2">Select all that apply.</p>
      </div>

      <div className="flex flex-col gap-6 flex-1">
        {GOALS.map((goal) => {
          const active = selected.includes(goal);
          return (
            <button
              key={goal}
              onClick={() => onToggle(goal)}
              className="w-full flex items-center justify-between px-5 py-5 border rounded-xl transition-colors duration-150 active:scale-[0.98]"
              style={{
                borderColor: active ? '#ccff00' : '#2a2a2a',
                backgroundColor: active ? 'rgba(204,255,0,0.06)' : '#171717',
              }}
            >
              <span
                className="font-body font-semibold text-base"
                style={{ color: active ? '#ccff00' : '#ffffff' }}
              >
                {goal}
              </span>
              <span
                className="material-symbols-outlined text-base"
                style={{ color: active ? '#ccff00' : '#444' }}
              >
                {active ? 'check_circle' : 'radio_button_unchecked'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2">
        <CtaButton onClick={onNext} disabled={selected.length === 0}>
          Next
        </CtaButton>
      </div>
    </div>
  );
}

/* ── Step 3: Budget ── */
function StepBudget({
  budget,
  onChange,
  onFinish,
}: {
  budget: string;
  onChange: (v: string) => void;
  onFinish: () => void;
}) {
  const handleInput = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    onChange(digits);
  };

  return (
    <div className="flex-1 flex flex-col px-6 pb-4">
      <div className="pt-10 mb-10">
        <p className="font-headline text-[11px] uppercase tracking-[0.25em] text-accent font-bold mb-3">
          Spending Limit
        </p>
        <h1 className="font-headline text-3xl font-extrabold tracking-tighter leading-tight text-white">
          How much can Genie spend on your behalf?
        </h1>
        <p className="text-sm text-white/40 mt-2">
          Set a monthly limit. You can change this anytime.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-surface border border-white/10 flex items-center px-5 py-5">
            <span className="font-headline text-3xl font-extrabold text-white/20 mr-1 select-none">
              $
            </span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={budget}
              onChange={(e) => handleInput(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none font-headline text-3xl font-extrabold text-white placeholder:text-white/20 focus:ring-0"
              style={{ fontSize: '16px' }}
            />
            <span className="font-headline text-sm text-white/30 uppercase tracking-widest ml-2">
              USD / mo
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {['100', '250', '500', '1000'].map((amt) => (
              <button
                key={amt}
                onClick={() => onChange(amt)}
                className="py-2.5 rounded-lg text-center font-headline font-bold text-xs uppercase tracking-wider transition-colors duration-150 active:scale-95"
                style={{
                  backgroundColor: budget === amt ? '#ccff00' : '#171717',
                  color: budget === amt ? '#000' : '#fff',
                }}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/25 leading-relaxed text-center px-4">
          Genie will never exceed this limit without your approval. This is a
          safeguard, not a commitment.
        </p>
      </div>

      <div className="mt-2">
        <CtaButton onClick={onFinish} disabled={!budget || budget === '0'}>
          Let&apos;s Go
        </CtaButton>
      </div>
    </div>
  );
}
