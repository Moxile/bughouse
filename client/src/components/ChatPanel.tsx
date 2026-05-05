import React, { useEffect, useRef, useState } from 'react';
import { S_Chat } from '@bughouse/shared';

type Props = {
  messages: S_Chat[];
  onSend: (text: string) => void;
  canSend: boolean;
};

export function ChatPanel({ messages, onSend, canSend }: Props) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    const t = text.trim();
    if (t) { onSend(t); setText(''); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 200, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '4px 6px', background: '#f3f4f6', fontSize: 12, fontWeight: 'bold', borderBottom: '1px solid #e5e7eb' }}>
        Team Chat
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 6, maxHeight: 120, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{m.fromName}: </span>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid #e5e7eb' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={!canSend}
          placeholder={canSend ? 'Message...' : ''}
          style={{ flex: 1, border: 'none', padding: '4px 6px', fontSize: 12, outline: 'none' }}
        />
        <button
          onClick={submit}
          disabled={!canSend || !text.trim()}
          style={{ padding: '2px 8px', fontSize: 12, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
        >
          ▶
        </button>
      </div>
    </div>
  );
}
