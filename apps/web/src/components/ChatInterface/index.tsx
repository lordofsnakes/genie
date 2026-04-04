'use client';

import { useEffect, useRef, useState } from 'react';

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
  onInsightsClick?: () => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: '1', type: 'ai', content: 'Hi! How can I help you?' },
];

const PLACEHOLDERS = [
  'Go off.',
  "What's the move?",
  'Hit me with it.',
  'Speak your truth.',
  "Let's cook.",
];

const NAV_HEIGHT = 108;

export const ChatInterface = ({
  userAvatarSrc = '',
  onInsightsClick,
}: ChatInterfaceProps) => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputBottom, setInputBottom] = useState(NAV_HEIGHT);
  const [placeholder] = useState(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)],
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      setInputBottom(Math.max(NAV_HEIGHT, keyboardHeight + 8));
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div
      className="relative flex flex-col bg-background text-white font-body overflow-hidden touch-none"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      {/* Scrollable messages */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain pt-6 pb-6 px-6"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="flex flex-col gap-10 max-w-md mx-auto">
          {messages.map((message) =>
            message.type === 'user' ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AiMessage key={message.id} content={message.content} insights={message.insights} />
            ),
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat input */}
      <div
        className="fixed left-0 w-full px-6 z-40 transition-[bottom] duration-75"
        style={{ bottom: inputBottom }}
      >
        <div className="max-w-md mx-auto">
          <div className="bg-surface p-2 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
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

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end pl-12">
      <div className="bg-surface border border-white/10 p-4 rounded-t-2xl rounded-bl-2xl text-white">
        <p className="text-sm font-medium">{content}</p>
      </div>
    </div>
  );
}

function AiMessage({ content, insights }: { content: string; insights?: AiInsight[] }) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-shrink-0 w-20 h-24 self-end">
        <img
          src="/genie.png"
          alt="Genie"
          className="w-full h-full object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      <div className="relative flex-1 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white">
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
        <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
        {insights && insights.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {insights.map((insight) => (
              <div key={insight.label} className="bg-background p-3 border-l-2 border-accent/50">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{insight.label}</p>
                <p className="text-md font-bold text-accent">{insight.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
