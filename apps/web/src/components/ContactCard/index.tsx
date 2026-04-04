'use client';
import { MiniKit } from '@worldcoin/minikit-js';

export interface ContactData {
  name: string;
  walletAddress: string;
  username?: string;
}

interface ContactCardProps {
  contact: ContactData;
  onSelect: (contact: ContactData) => void;
}

export const ContactCard = ({ contact, onSelect }: ContactCardProps) => {
  const handleTap = async () => {
    if (MiniKit.isInstalled()) {
      await MiniKit.sendHapticFeedback({ hapticsType: 'selection-changed' });
    }
    onSelect(contact);
  };

  return (
    <button
      onClick={handleTap}
      className="flex items-center gap-3 w-full bg-background p-3 border border-white/10 active:border-accent/50 active:scale-[0.98] transition-all"
    >
      <div className="w-9 h-9 bg-accent/20 flex items-center justify-center flex-shrink-0 rounded-full">
        <span className="material-symbols-outlined text-accent text-base">person</span>
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-white">{contact.name}</p>
        <p className="text-[11px] text-white/40 font-mono truncate">
          {contact.username ? `@${contact.username}` : `${contact.walletAddress.slice(0, 6)}...${contact.walletAddress.slice(-4)}`}
        </p>
      </div>
      <span className="material-symbols-outlined text-white/30 text-base">chevron_right</span>
    </button>
  );
};

export interface ContactListData {
  type: 'contact_list';
  contacts: ContactData[];
  prompt?: string;
}

export const ContactList = ({ data, onSelect }: { data: ContactListData; onSelect: (c: ContactData) => void }) => (
  <div className="flex flex-col gap-2">
    {data.prompt && <p className="text-xs text-white/50 mb-1">{data.prompt}</p>}
    {data.contacts.map((c) => (
      <ContactCard key={c.walletAddress} contact={c} onSelect={onSelect} />
    ))}
  </div>
);

export function parseContactList(text: string): ContactListData | null {
  // Detect ```json fenced block with type: "contact_list"
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.type === 'contact_list' && Array.isArray(parsed.contacts)) {
      return parsed as ContactListData;
    }
  } catch { /* not valid JSON, render as markdown */ }
  return null;
}
