import React, { useEffect, useRef, useState } from 'react';
import { S_Chat } from '@bughouse/shared';

type Props = {
  messages: S_Chat[];
  onSend: (text: string) => void;
  canSend: boolean;
};

const PIECE_SYMBOLS: Record<string, string> = {
  P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛',
};

const QUICK_BTNS = [
  { id: 'sit',  label: 'SIT',         msg: 'Please sit' },
  { id: 'go',   label: 'GO',          msg: 'Go!' },
  { id: 'isit', label: 'I SIT',       msg: 'I sit' },
  { id: 'mate', label: 'I HAVE MATE', msg: 'I have mate!', urgent: true },
];

export function ChatPanel({ messages, onSend, canSend }: Props) {
  const [text, setText] = useState('');
  const [requestMode, setRequestMode] = useState<'need' | 'dontgive'>('need');
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

  const requestPiece = (piece: string) => {
    if (!canSend) return;
    const label = requestMode === 'need' ? `I need ${piece}` : `Don't give ${piece}`;
    onSend(label);
  };

  const modeIsCyan = requestMode === 'need';

  return (
    <div style={{
      background: 'rgba(15,17,21,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(86,219,211,0.07)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '11px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 4,
            background: '#34d399',
            boxShadow: '0 0 8px rgba(52,211,153,0.55)',
            flexShrink: 0,
          }} />
          <div>
            <div style={{
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize: 12, fontWeight: 600,
              color: '#fff',
            }}>PARTNER CHAT</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, color: 'rgba(255,255,255,0.38)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>online · same team</div>
          </div>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9, color: 'rgba(255,255,255,0.3)',
          letterSpacing: 1, textTransform: 'uppercase',
        }}>team chat</span>
      </div>

      {/* Message history */}
      <div style={{
        overflowY: 'auto',
        padding: '10px 12px',
        minHeight: 90,
        maxHeight: 190,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        {messages.length === 0 && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: 'rgba(255,255,255,0.2)',
            textAlign: 'center',
            paddingTop: 20,
          }}>No messages yet</div>
        )}
        {messages.map((m, i) => (
          <ChatMsg key={i} msg={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick buttons */}
      <div style={{
        padding: '8px 12px 0 12px',
        display: 'flex', flexWrap: 'wrap', gap: 5,
      }}>
        {QUICK_BTNS.map((b) => (
          <button
            key={b.id}
            onClick={() => quick(b.msg)}
            disabled={!canSend}
            style={{
              padding: '5px 9px',
              borderRadius: 6,
              background: b.urgent ? 'rgba(239,68,68,0.1)' : 'rgba(86,219,211,0.08)',
              border: b.urgent ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(86,219,211,0.2)',
              color: b.urgent ? '#ff7070' : '#56dbd3',
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
              cursor: canSend ? 'pointer' : 'default',
              opacity: canSend ? 1 : 0.4,
              transition: 'all 120ms',
            }}
          >{b.label}</button>
        ))}
      </div>

      {/* Piece request mode toggle */}
      <div style={{
        padding: '8px 12px 0 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 7,
          padding: 2,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button
            onClick={() => setRequestMode('need')}
            style={{
              padding: '4px 10px', borderRadius: 5, border: 'none',
              background: requestMode === 'need' ? '#56dbd3' : 'transparent',
              color: requestMode === 'need' ? '#0a0a0a' : 'rgba(255,255,255,0.55)',
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              cursor: 'pointer', transition: 'all 120ms',
            }}
          >NEED</button>
          <button
            onClick={() => setRequestMode('dontgive')}
            style={{
              padding: '4px 10px', borderRadius: 5, border: 'none',
              background: requestMode === 'dontgive' ? '#ff5757' : 'transparent',
              color: requestMode === 'dontgive' ? '#0a0a0a' : 'rgba(255,255,255,0.55)',
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              cursor: 'pointer', transition: 'all 120ms',
            }}
          >DON'T GIVE</button>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9, color: 'rgba(255,255,255,0.3)',
          letterSpacing: 0.5, textTransform: 'uppercase',
        }}>tap a piece →</span>
      </div>

      {/* Piece icons */}
      <div style={{ padding: '6px 12px 10px 12px', display: 'flex', gap: 5 }}>
        {['Q', 'R', 'B', 'N', 'P'].map((p) => (
          <button
            key={p}
            onClick={() => requestPiece(p)}
            disabled={!canSend}
            style={{
              flex: 1, padding: 3, borderRadius: 6,
              background: 'rgba(255,255,255,0.03)',
              border: modeIsCyan
                ? '1px solid rgba(86,219,211,0.22)'
                : '1px solid rgba(239,68,68,0.28)',
              cursor: canSend ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 36,
              fontSize: 18,
              opacity: canSend ? 1 : 0.4,
              transition: 'all 120ms',
              color: '#ddd',
            }}
            title={requestMode === 'need' ? `I need ${p}` : `Don't give ${p}`}
          >
            {PIECE_SYMBOLS[p]}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 10px 10px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 6,
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={!canSend}
          placeholder={canSend ? 'Message your partner…' : ''}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '7px 10px',
            color: '#fff',
            fontSize: 12,
            outline: 'none',
            opacity: canSend ? 1 : 0.5,
          }}
        />
        <button
          onClick={submit}
          disabled={!canSend || !text.trim()}
          style={{
            background: canSend && text.trim() ? '#56dbd3' : 'rgba(86,219,211,0.2)',
            color: canSend && text.trim() ? '#0a0a0a' : 'rgba(86,219,211,0.5)',
            border: 'none', borderRadius: 6,
            padding: '0 12px', cursor: canSend && text.trim() ? 'pointer' : 'default',
            fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
            transition: 'all 120ms',
          }}
        >SEND</button>
      </div>
    </div>
  );
}

function ChatMsg({ msg }: { msg: S_Chat }) {
  return (
    <div style={{
      maxWidth: '80%',
      padding: '6px 10px',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.07)',
      color: '#fff',
      fontSize: 12,
      lineHeight: 1.4,
      alignSelf: 'flex-start',
    }}>
      <div style={{
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 2,
      }}>{msg.fromName}</div>
      {msg.text}
    </div>
  );
}
