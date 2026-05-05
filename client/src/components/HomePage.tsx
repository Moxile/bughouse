import React, { useState } from 'react';

type Props = { onJoin: (code: string) => void };

export function HomePage({ onJoin }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const createGame = async () => {
    setLoading(true);
    const res = await fetch('/api/games', { method: 'POST' });
    const { code } = await res.json();
    onJoin(code as string);
    setLoading(false);
  };

  const joinGame = () => {
    const c = code.trim().toUpperCase();
    if (c.length === 6) onJoin(c);
  };

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', fontFamily: 'sans-serif', padding: '0 16px', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 8 }}>Bughouse Chess</h1>
      <p style={{ color: '#555', marginBottom: 32, fontSize: 14 }}>
        4-player variant · 5 minutes · custom promotion rules
      </p>

      <button
        onClick={createGame}
        disabled={loading}
        style={{
          display: 'block', width: '100%', padding: '12px 0',
          background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 16, cursor: loading ? 'default' : 'pointer',
          marginBottom: 16, fontWeight: 'bold',
        }}
      >
        {loading ? 'Creating…' : '+ Create game'}
      </button>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && joinGame()}
          placeholder="Game code"
          style={{
            flex: 1, padding: '10px 12px', border: '1px solid #d1d5db',
            borderRadius: 8, fontSize: 15, letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        />
        <button
          onClick={joinGame}
          disabled={code.trim().length !== 6}
          style={{
            padding: '10px 20px', background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold',
          }}
        >
          Join
        </button>
      </div>
    </div>
  );
}
