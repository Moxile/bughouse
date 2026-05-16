import React, { useState } from 'react';
import { updateUsername } from '../lib/auth.js';
import { SplitBoardLogo } from './SplitBoardLogo.js';

type Props = {
  onDone: (username: string) => void;
};

export function PickUsernamePage({ onDone }: Props) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isValid = /^[a-zA-Z0-9_-]{3,20}$/.test(value);

  const handleSave = async () => {
    if (!isValid || status === 'saving') return;
    setStatus('saving');
    setErrorMsg('');
    const res = await updateUsername(value);
    if (res.ok) {
      onDone(value);
    } else {
      setStatus('error');
      setErrorMsg(res.error === 'taken' ? 'That username is already taken.' : 'Username must be 3–20 characters: letters, numbers, _ or -');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: "'Geist', 'Inter', sans-serif",
    }}>
      <div style={{
        background: '#1a1a20',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '40px 44px',
        width: '100%',
        maxWidth: 380,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <SplitBoardLogo width={52} />
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '16px 0 6px', textAlign: 'center' }}>
            Choose a username
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0, textAlign: 'center' }}>
            Pick a public name for your profile. You can change it later in settings.
          </p>
        </div>

        <label style={{
          display: 'block',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 12, letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          Username
        </label>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setStatus('idle'); setErrorMsg(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="your_username"
          maxLength={20}
          autoFocus
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            padding: '11px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${status === 'error' ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 9, fontSize: 15,
            color: '#fff', outline: 'none',
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 6,
          }}
        />

        <p style={{
          fontSize: 12, margin: '0 0 24px',
          color: status === 'error' ? '#f87171' : 'rgba(255,255,255,0.25)',
          minHeight: 16,
        }}>
          {status === 'error' ? errorMsg : '3–20 characters · letters, numbers, _ or -'}
        </p>

        <button
          onClick={handleSave}
          disabled={!isValid || status === 'saving'}
          style={{
            display: 'block', width: '100%', padding: '12px 0',
            background: isValid ? 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)' : 'rgba(86,219,211,0.1)',
            color: isValid ? '#0a0c10' : 'rgba(86,219,211,0.3)',
            border: 'none', borderRadius: 9,
            fontSize: 14, fontWeight: 700,
            cursor: isValid && status !== 'saving' ? 'pointer' : 'default',
            transition: 'all 120ms',
          }}
        >
          {status === 'saving' ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
