'use client';

import { useState } from 'react';

export interface AiInsight {
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  insights?: AiInsight[];
}

interface ChatInterfaceProps {
  userAvatarSrc?: string;
  mascotSrc?: string;
  onInsightsClick?: () => void;
}

const DEFAULT_AVATAR = '';
const DEFAULT_MASCOT = '';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    type: 'ai',
    content: 'Hi! How can I help you?',
  },
];

export const ChatInterface = ({
  userAvatarSrc = DEFAULT_AVATAR,
  mascotSrc = DEFAULT_MASCOT,
  onInsightsClick,
}: ChatInterfaceProps) => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), type: 'user', content: trimmed },
    ]);
    setInputValue('');
    // API integration goes here
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-white font-body">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-background flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex-shrink-0 bg-[#171717] border border-white/10 flex items-center justify-center overflow-hidden">
            {userAvatarSrc ? (
              <img src={userAvatarSrc} alt="User Profile" className="w-full h-full object-cover" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" opacity={0.6}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>
          <h1 className="font-headline text-xl font-extrabold tracking-tighter text-white">
            The Neon Ledger
          </h1>
        </div>
        <button
          onClick={onInsightsClick}
          className="text-accent flex items-center justify-center p-2 active:scale-95 transition-transform duration-200"
          aria-label="Insights"
        >
          <span className="material-symbols-outlined">insights</span>
        </button>
      </header>

      {/* Main Content Canvas */}
      <main className="min-h-screen pt-24 pb-56 px-6 flex flex-col gap-8 max-w-md mx-auto">
        {/* Chat Messages */}
        <div className="flex flex-col gap-10">
          {messages.map((message) =>
            message.type === 'user' ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AiMessage
                key={message.id}
                content={message.content}
                insights={message.insights}
                mascotSrc={mascotSrc}
              />
            ),
          )}
        </div>
      </main>

      {/* Sticky Chat Input — sits above the layout BottomNav */}
      <div className="fixed bottom-[108px] left-0 w-full px-6 pointer-events-none z-40">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-surface p-2 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the Ledger..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 placeholder:text-white/30 text-white outline-none"
            />
            <button
              onClick={handleSend}
              className="w-10 h-10 bg-accent text-black flex items-center justify-center active:scale-90 transition-transform"
              aria-label="Send"
            >
              <span className="material-symbols-outlined">north</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end pl-12">
      <div className="bg-surface border border-white/10 p-4 rounded-t-2xl rounded-bl-2xl text-white">
        <p className="text-sm font-medium">{content}</p>
      </div>
    </div>
  );
}

function AiMessage({
  content,
  insights,
  mascotSrc,
}: {
  content: string;
  insights?: AiInsight[];
  mascotSrc: string;
}) {
  return (
    <div className="flex items-end gap-4">
      {/* Mascot */}
      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-[#171717] border border-[#CCFF00]/30">
        {mascotSrc ? (
          <img src={mascotSrc} alt="AI Mascot" className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#CCFF00">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        )}
      </div>

      {/* Bubble */}
      <div className="relative flex-1 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white">
        <div className="chat-bubble-tail" />
        <div className="flex items-center gap-2 mb-3">
          <span
            className="material-symbols-outlined text-accent text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <span className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
            Curator AI
          </span>
        </div>
        <p className="text-sm leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: content }} />
        {insights && insights.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {insights.map((insight) => (
              <div key={insight.label} className="bg-background p-3 border-l-2 border-accent/50">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                  {insight.label}
                </p>
                <p className="text-md font-bold text-accent">{insight.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
