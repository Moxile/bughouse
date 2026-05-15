import React from 'react';
import { BughouseIcon } from './BughouseIcon';

type Props = {
  onHome: () => void;
  onProfile?: () => void;
  username?: string | null;
  actions?: React.ReactNode;
};

export function TopBar({ onHome, onProfile, username, actions }: Props) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.01)',
      backdropFilter: 'blur(10px)',
      position: 'relative', zIndex: 5,
      flexShrink: 0,
    }}>
      <button
        onClick={onHome}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, color: 'inherit',
        }}
      >
        <BughouseIcon size={26} />
        <span style={{
          fontFamily: "'Geist', 'Inter', sans-serif",
          fontSize: 14, fontWeight: 700, letterSpacing: 0.3,
        }}>BUGHOUSE</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}
        {username ? (
          <button
            onClick={onProfile}
            title={username}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #56dbd3 0%, #a78bfa 100%)',
              border: 'none', cursor: onProfile ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#0a0c10',
              boxShadow: '0 2px 8px rgba(86,219,211,0.25)',
              transition: 'transform 120ms, box-shadow 120ms',
            }}
            onMouseEnter={(e) => {
              if (!onProfile) return;
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(86,219,211,0.4)';
            }}
            onMouseLeave={(e) => {
              if (!onProfile) return;
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(86,219,211,0.25)';
            }}
          >
            {username.charAt(0).toUpperCase()}
          </button>
        ) : null}
      </div>
    </header>
  );
}
