import React, { useState, useRef, useCallback } from 'react';
import { SplitBoardLogo } from './SplitBoardLogo.js';
import { TopBar } from './TopBar.js';

type RatingRange = { min: number; max: number } | null;

type Props = {
  onJoin: (code: string) => void;
  onBack: () => void;
  onProfile?: () => void;
  username?: string | null;
  userRating?: number | null;
};

const RATING_SLIDER_MIN = 400;
const RATING_SLIDER_MAX = 3000;

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: 3,
      gap: 3,
      opacity: disabled ? 0.45 : 1,
    }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => !disabled && onChange(opt.value)}
            style={{
              padding: '7px 20px',
              borderRadius: 6,
              border: 'none',
              background: active ? 'rgba(86,219,211,0.18)' : 'transparent',
              color: active ? '#56dbd3' : 'rgba(255,255,255,0.5)',
              fontSize: 13,
              fontWeight: active ? 700 : 400,
              fontFamily: "'Geist', 'Inter', sans-serif",
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 150ms',
              letterSpacing: 0.2,
              boxShadow: active ? 'inset 0 0 0 1px rgba(86,219,211,0.35)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DualRangeSlider({
  min,
  max,
  sliderMin,
  sliderMax,
  onMinChange,
  onMaxChange,
}: {
  min: number;
  max: number;
  sliderMin: number;
  sliderMax: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  const toPercent = (v: number) => ((v - sliderMin) / (sliderMax - sliderMin)) * 100;

  return (
    <div style={{ position: 'relative', height: 28, marginTop: 8 }}>
      {/* Track background */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 4,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        transform: 'translateY(-50%)',
      }} />
      {/* Active track */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: `${toPercent(min)}%`,
        width: `${toPercent(max) - toPercent(min)}%`,
        height: 4,
        background: '#56dbd3',
        borderRadius: 2,
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
      }} />
      {/* Min thumb */}
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={25}
        value={min}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v < max - 50) onMinChange(v);
        }}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          margin: 0,
          zIndex: min > sliderMax - 100 ? 5 : 3,
        }}
      />
      {/* Max thumb */}
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={25}
        value={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v > min + 50) onMaxChange(v);
        }}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          margin: 0,
          zIndex: 4,
        }}
      />
      {/* Visual thumbs */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: `${toPercent(min)}%`,
        width: 16, height: 16,
        background: '#56dbd3',
        border: '2px solid #0a0c10',
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        boxShadow: '0 0 8px rgba(86,219,211,0.5)',
      }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: `${toPercent(max)}%`,
        width: 16, height: 16,
        background: '#56dbd3',
        border: '2px solid #0a0c10',
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        boxShadow: '0 0 8px rgba(86,219,211,0.5)',
      }} />
    </div>
  );
}

export function CreateGamePage({ onJoin, onBack, onProfile, username, userRating }: Props) {
  const [minutes, setMinutes] = useState(5);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [mode, setMode] = useState<'casual' | 'rated'>(username ? 'rated' : 'casual');
  const [useRatingRange, setUseRatingRange] = useState(false);
  const [rangeMin, setRangeMin] = useState(1000);
  const [rangeMax, setRangeMax] = useState(2000);
  const [allowSimul, setAllowSimul] = useState(false);
  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!username;
  const effectiveMode = isAuthenticated ? mode : 'casual';

  const handleCreate = async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        minutes,
        isPrivate: visibility === 'private',
        isRated: effectiveMode === 'rated',
        allowSimul,
        ratingRange: useRatingRange ? { min: rangeMin, max: rangeMax } : null,
      };
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { code: string; ownerPlayerId: string };
      // Store ownerPlayerId so the WebSocket join uses it as playerId,
      // which tells the server this connection is the room owner.
      sessionStorage.setItem('playerId', data.ownerPlayerId);
      onJoin(data.code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 38% 32%, rgba(86,219,211,0.08) 0%, transparent 50%), radial-gradient(ellipse at 62% 68%, rgba(167,139,250,0.06) 0%, transparent 50%)',
      }} />

      <TopBar onHome={onBack} onProfile={onProfile} username={username ?? null} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <button
              onClick={onBack}
              style={{
                background: 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)',
                border: 'none',
                color: '#0a0c10', borderRadius: 7,
                padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Geist', 'Inter', sans-serif",
                boxShadow: '0 2px 12px rgba(86,219,211,0.2)',
              }}
            >← Back</button>
            <h2 style={{
              fontFamily: "'Geist', 'Inter', sans-serif",
              fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: 0.3,
            }}>New Game</h2>
          </div>

          {/* Time control */}
          <div style={{ marginBottom: 28 }}>
            <div style={labelStyle}>Time control</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((m) => {
                const active = minutes === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMinutes(m)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: active ? 'rgba(86,219,211,0.15)' : 'rgba(255,255,255,0.04)',
                      color: active ? '#56dbd3' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${active ? 'rgba(86,219,211,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: active ? 700 : 400,
                      fontFamily: "'JetBrains Mono', monospace",
                      transition: 'all 150ms',
                      boxShadow: active ? '0 0 12px rgba(86,219,211,0.15)' : 'none',
                    }}
                  >{m}+0</button>
                );
              })}
            </div>
          </div>

          {/* Visibility */}
          <div style={{ marginBottom: 24 }}>
            <div style={labelStyle}>Visibility</div>
            <SegmentedControl
              options={[
                { value: 'public', label: '🌐 Public' },
                { value: 'private', label: '🔒 Private' },
              ]}
              value={visibility}
              onChange={setVisibility}
            />
            <div style={hintStyle}>
              {visibility === 'public'
                ? 'Anyone can find and join from the home page'
                : 'Only players with the link can join'}
            </div>
          </div>

          {/* Mode */}
          <div style={{ marginBottom: 24 }}>
            <div style={labelStyle}>Game mode</div>
            <SegmentedControl
              options={[
                { value: 'casual', label: 'Casual' },
                { value: 'rated', label: '⭐ Rated' },
              ]}
              value={effectiveMode}
              onChange={(v) => setMode(v as 'casual' | 'rated')}
              disabled={!isAuthenticated}
            />
            <div style={hintStyle}>
              {!isAuthenticated
                ? 'Sign in to play rated games'
                : effectiveMode === 'rated'
                ? 'Affects everyone\'s rating — guests cannot join'
                : 'No rating changes'}
            </div>
          </div>

          {/* Allow simul */}
          <div style={{
            marginBottom: 24,
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${allowSimul ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 10,
            padding: '16px',
            transition: 'border-color 200ms',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ ...labelStyle, marginBottom: 2 }}>Simul mode</div>
                <div style={{ ...hintStyle, marginTop: 0 }}>
                  {allowSimul
                    ? 'Each team can be controlled by one player on both boards'
                    : 'Standard 4-player game'}
                </div>
              </div>
              <button
                onClick={() => setAllowSimul((v) => !v)}
                style={{
                  position: 'relative',
                  width: 40, height: 22,
                  background: allowSimul ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)',
                  border: `1px solid ${allowSimul ? 'rgba(167,139,250,0.8)' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 11,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 200ms, border-color 200ms',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: allowSimul ? 20 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 200ms',
                  display: 'block',
                }} />
              </button>
            </div>
          </div>

          {/* Rating range */}
          <div style={{
            marginBottom: 32,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useRatingRange ? 16 : 0 }}>
              <div>
                <div style={{ ...labelStyle, marginBottom: 2 }}>Rating range</div>
                {!useRatingRange && (
                  <div style={{ ...hintStyle, marginTop: 0 }}>Any rating can join</div>
                )}
              </div>
              <button
                onClick={() => setUseRatingRange((v) => !v)}
                style={{
                  position: 'relative',
                  width: 40, height: 22,
                  background: useRatingRange ? 'rgba(86,219,211,0.6)' : 'rgba(255,255,255,0.1)',
                  border: `1px solid ${useRatingRange ? 'rgba(86,219,211,0.8)' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 11,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 200ms, border-color 200ms',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: useRatingRange ? 20 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 200ms',
                  display: 'block',
                }} />
              </button>
            </div>

            {useRatingRange && (
              <>
                <DualRangeSlider
                  min={rangeMin}
                  max={rangeMax}
                  sliderMin={RATING_SLIDER_MIN}
                  sliderMax={RATING_SLIDER_MAX}
                  onMinChange={setRangeMin}
                  onMaxChange={setRangeMax}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <input
                    type="number"
                    value={rangeMin}
                    min={RATING_SLIDER_MIN}
                    max={rangeMax - 50}
                    step={25}
                    onChange={(e) => {
                      const v = Math.max(RATING_SLIDER_MIN, Math.min(rangeMax - 50, Number(e.target.value)));
                      setRangeMin(v);
                    }}
                    style={numInputStyle}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>to</span>
                  <input
                    type="number"
                    value={rangeMax}
                    min={rangeMin + 50}
                    max={RATING_SLIDER_MAX}
                    step={25}
                    onChange={(e) => {
                      const v = Math.max(rangeMin + 50, Math.min(RATING_SLIDER_MAX, Number(e.target.value)));
                      setRangeMax(v);
                    }}
                    style={numInputStyle}
                  />
                  {userRating !== null && userRating !== undefined && (
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11, color: 'rgba(255,255,255,0.3)',
                      whiteSpace: 'nowrap',
                    }}>
                      your rating: {userRating}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={loading}
            style={{
              display: 'block', width: '100%', padding: '15px 0',
              background: loading ? 'rgba(86,219,211,0.4)' : 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)',
              color: '#0a0c10',
              border: 'none',
              borderRadius: 10, fontSize: 15,
              cursor: loading ? 'default' : 'pointer',
              fontWeight: 700,
              fontFamily: "'Geist', 'Inter', sans-serif",
              letterSpacing: 0.3,
              boxShadow: loading ? 'none' : '0 4px 24px rgba(86,219,211,0.3)',
              transition: 'opacity 120ms, box-shadow 120ms',
            }}
          >
            {loading ? 'Creating…' : 'Create Game'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10, color: 'rgba(255,255,255,0.4)',
  letterSpacing: 1, textTransform: 'uppercase',
  marginBottom: 10,
};

const hintStyle: React.CSSProperties = {
  fontFamily: "'Geist', 'Inter', sans-serif",
  fontSize: 12, color: 'rgba(255,255,255,0.3)',
  marginTop: 8,
};

const numInputStyle: React.CSSProperties = {
  width: 80,
  padding: '7px 10px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7,
  color: '#fff',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 600,
  textAlign: 'center',
  outline: 'none',
};
