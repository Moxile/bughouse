import React, { useEffect, useRef, useState } from 'react';
import { S_Chat } from '@bughouse/shared';

type Props = {
  messages: S_Chat[];
  onSend: (text: string) => void;
  canSend: boolean;
};

const PIECES: { key: string; symbol: string }[] = [
  { key: 'P', symbol: '♟' },
  { key: 'N', symbol: '♞' },
  { key: 'B', symbol: '♝' },
  { key: 'R', symbol: '♜' },
  { key: 'Q', symbol: '♛' },
];

const quickBtnStyle = (color: string): React.CSSProperties => ({
  padding: '3px 8px',
  fontSize: 11,
  border: `1px solid ${color}`,
  borderRadius: 4,
  background: '#fff',
  color,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  lineHeight: 1.4,
});

const pieceQuickBtnStyle = (color: string): React.CSSProperties => ({
  width: 28,
  height: 24,
  fontSize: 15,
  border: `1px solid ${color}`,
  borderRadius: 4,
  background: '#fff',
  color,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

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

  const quick = (msg: string) => {
    if (canSend) onSend(msg);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 280, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '4px 8px', background: '#f3f4f6', fontSize: 12, fontWeight: 'bold', borderBottom: '1px solid #e5e7eb' }}>
        Team Chat
      </div>

      {/* Message history */}
      <div style={{ overflowY: 'auto', padding: 6, height: 180, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{m.fromName}: </span>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick-send buttons */}
      <div style={{ padding: '6px 6px 4px', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 5, background: '#fafafa' }}>
        {/* General buttons */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button style={quickBtnStyle('#2563eb')} disabled={!canSend} onClick={() => quick('I sit')}>I sit</button>
          <button style={quickBtnStyle('#7c3aed')} disabled={!canSend} onClick={() => quick('Please sit')}>Please sit</button>
          <button style={quickBtnStyle('#d97706')} disabled={!canSend} onClick={() => quick('Play quick')}>Play quick</button>
          <button style={quickBtnStyle('#dc2626')} disabled={!canSend} onClick={() => quick('I have mate')}>I have mate</button>
        </div>

        {/* I need piece */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#374151', whiteSpace: 'nowrap', width: 54 }}>I need:</span>
          {PIECES.map(({ key, symbol }) => (
            <button
              key={key}
              title={`I need ${key}`}
              style={pieceQuickBtnStyle('#16a34a')}
              disabled={!canSend}
              onClick={() => quick(`I need ${key}`)}
            >
              {symbol}
            </button>
          ))}
        </div>

        {/* Don't give piece */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#374151', whiteSpace: 'nowrap', width: 54 }}>Don't give:</span>
          {PIECES.map(({ key, symbol }) => (
            <button
              key={key}
              title={`Don't give ${key}`}
              style={pieceQuickBtnStyle('#dc2626')}
              disabled={!canSend}
              onClick={() => quick(`Don't give ${key}`)}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Text input */}
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
