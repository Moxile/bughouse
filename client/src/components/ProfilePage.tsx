import React from 'react';
import type { AuthUser } from '../lib/auth.js';
import { TopBar } from './TopBar.js';

type Props = {
  user: AuthUser;
  onHome: () => void;
  onSettings: () => void;
  onLogout: () => Promise<void>;
};

export function ProfilePage({ user, onHome, onSettings, onLogout }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0f',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Geist', 'Inter', sans-serif",
    }}>
      <TopBar onHome={onHome} username={user.username} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{
        background: '#1a1a20',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '36px 40px',
        width: '100%',
        maxWidth: 360,
      }}>
        {/* Avatar placeholder */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #56dbd3 0%, #a78bfa 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, color: '#0a0c10',
          margin: '0 auto 20px',
        }}>
          {user.username.charAt(0).toUpperCase()}
        </div>

        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 4px', textAlign: 'center' }}>
          {user.username}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: '0 0 28px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
          {user.displayName}
        </p>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 12, marginBottom: 28,
        }}>
          <StatBox label="Rating" value={String(user.rating)} accent="#56dbd3" />
          <StatBox label="Games" value={String(user.ratingGamesPlayed)} accent="#a78bfa" />
        </div>

        {/* Actions */}
        <button
          onClick={onSettings}
          style={{
            display: 'block', width: '100%', padding: '11px 0',
            background: 'rgba(86,219,211,0.08)',
            border: '1px solid rgba(86,219,211,0.2)',
            color: '#56dbd3', borderRadius: 9,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          Settings
        </button>
        <button
          onClick={onLogout}
          style={{
            display: 'block', width: '100%', padding: '11px 0',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.35)', borderRadius: 9,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '14px 12px', textAlign: 'center',
    }}>
      <div style={{ color: accent, fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}
