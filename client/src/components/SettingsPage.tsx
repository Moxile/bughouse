import React, { useState } from 'react';
import { updateUsername, type AuthUser } from '../lib/auth.js';
import { TopBar } from './TopBar.js';

type Props = {
  user: AuthUser;
  onHome: () => void;
  onProfile: () => void;
  onUsernameChanged: (newUsername: string) => void;
};

export function SettingsPage({ user, onHome, onProfile, onUsernameChanged }: Props) {
  const [value, setValue] = useState(user.username);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isValid = /^[a-zA-Z0-9_-]{3,20}$/.test(value);
  const unchanged = value === user.username;

  const handleSave = async () => {
    if (!isValid || unchanged) return;
    setStatus('saving');
    setErrorMsg('');
    const res = await updateUsername(value);
    if (res.ok) {
      setStatus('saved');
      onUsernameChanged(value);
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
      flexDirection: 'column',
      fontFamily: "'Geist', 'Inter', sans-serif",
    }}>
      <TopBar onHome={onHome} onProfile={onProfile} username={user.username} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{
        background: '#1a1a20',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '36px 40px',
        width: '100%',
        maxWidth: 360,
      }}>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
          Settings
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: '0 0 32px' }}>
          Signed in as {user.username}
        </p>

        <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Username
        </label>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setStatus('idle'); setErrorMsg(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="your_username"
          maxLength={20}
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
          fontSize: 12, margin: '0 0 20px',
          color: status === 'error' ? '#f87171'
            : status === 'saved' ? '#34d399'
            : 'rgba(255,255,255,0.25)',
          minHeight: 16,
        }}>
          {status === 'error' ? errorMsg
            : status === 'saved' ? 'Username updated!'
            : '3–20 characters · letters, numbers, _ or -'}
        </p>

        <button
          onClick={() => history.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)',
            border: 'none',
            color: '#0a0c10',
            borderRadius: 8, padding: '9px 18px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(86,219,211,0.2)',
            fontFamily: "'Geist', 'Inter', sans-serif",
          }}
        >
          ← Back to profile
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid || unchanged || status === 'saving'}
          style={{
            display: 'block', width: '100%', padding: '12px 0',
            background: isValid && !unchanged ? 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)' : 'rgba(86,219,211,0.1)',
            color: isValid && !unchanged ? '#0a0c10' : 'rgba(86,219,211,0.3)',
            border: 'none', borderRadius: 9,
            fontSize: 14, fontWeight: 700,
            cursor: isValid && !unchanged ? 'pointer' : 'default',
            transition: 'all 120ms',
          }}
        >
          {status === 'saving' ? 'Saving…' : 'Save username'}
        </button>
      </div>
      </div>
    </div>
  );
}
