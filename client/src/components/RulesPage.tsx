import React from 'react';

type Props = { onBack: () => void };

export function RulesPage({ onBack }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c10',
      color: 'rgba(255,255,255,0.88)',
      fontFamily: "'Geist', 'Inter', sans-serif",
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 20%, rgba(86,219,211,0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(167,139,250,0.05) 0%, transparent 50%)',
      }} />

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '48px 20px 64px', position: 'relative', zIndex: 1 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#56dbd3', fontSize: 13, padding: 0, marginBottom: 40,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: 0.5,
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: 0.85,
          }}
        >
          ← back
        </button>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: 0.5,
            margin: 0, marginBottom: 10,
          }}>
            Bughouse Chess{' '}
            <span style={{ color: '#56dbd3' }}>Rules</span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.38)',
            fontSize: 13, margin: 0,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>
            Same as chess.com bughouse — except for the points below
          </p>
        </div>

        <Section title="No drop-mate" accent="#a78bfa">
          <p style={{ margin: 0 }}>
            You <Hl color="#a78bfa">cannot deliver checkmate</Hl> by dropping a piece from your hand.
            Checkmate via a normal move is still allowed.
          </p>
        </Section>

        <Section title="Promotion" accent="#56dbd3">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Rule>
              When a pawn reaches the last rank, you must pick any{' '}
              <Hl color="#56dbd3">non-king, non-pawn</Hl> piece currently on your{' '}
              <Hl color="#56dbd3">diagonal opponent's</Hl> board to promote into.
            </Rule>
            <Rule>
              That piece is removed from the diagonal opponent's board and placed on yours as the promoted pawn.
              Your original pawn goes to the <Hl color="#56dbd3">diagonal opponent's hand</Hl>.
            </Rule>
            <Rule warn>
              If there is <strong>no eligible piece</strong> on the diagonal opponent's board, the pawn{' '}
              <Hl color="#f87171">cannot advance</Hl> to the last rank — the move is illegal.
            </Rule>
            <Rule warn>
              You <Hl color="#f87171">cannot select a pinned piece</Hl> — one whose removal would leave the diagonal
              opponent's king exposed to immediate capture. If all eligible pieces are pinned, the pawn cannot
              advance to the last rank either.
            </Rule>
            <Rule>
              If a promoted piece is later captured, it keeps its promoted type and goes to the{' '}
              <Hl color="#56dbd3">capturer's partner's hand</Hl>.
            </Rule>
          </ul>
        </Section>

        <button
          onClick={onBack}
          style={{
            marginTop: 48, padding: '11px 28px',
            background: 'linear-gradient(135deg, #56dbd3 0%, #a78bfa 100%)',
            color: '#0a0c10', border: 'none', borderRadius: 8,
            fontSize: 14, cursor: 'pointer', fontWeight: 800,
            letterSpacing: 0.3,
          }}
        >
          Back to home
        </button>
      </div>
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section style={{
      marginBottom: 24,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderTop: `2px solid ${accent}`,
      borderRadius: 10,
      padding: '20px 22px',
    }}>
      <h2 style={{
        fontSize: 13, fontWeight: 700, marginBottom: 14, marginTop: 0,
        color: accent,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}

function Rule({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{
        marginTop: 6, flexShrink: 0,
        width: 6, height: 6, borderRadius: '50%',
        background: warn ? '#f87171' : 'rgba(86,219,211,0.6)',
      }} />
      <span>{children}</span>
    </li>
  );
}

function Hl({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ color, fontWeight: 600 }}>{children}</span>;
}
