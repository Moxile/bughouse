import React from 'react';

type Props = { onBack: () => void };

export function RulesPage({ onBack }: Props) {
  return (
    <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#2563eb', fontSize: 14, padding: 0, marginBottom: 24,
        }}
      >
        ← Back
      </button>

      <h1 style={{ marginBottom: 8 }}>Bughouse Chess — Rules</h1>
      <p style={{ color: '#555', marginBottom: 32, fontSize: 14 }}>
        The core concept is the same as in chess.com bughouse. Here are the points that differ:
      </p>

      <Section title="No drop-mate">
        <p>You cannot deliver checkmate by dropping a piece from your hand. Checkmate via a normal move is still allowed.</p>
      </Section>

      <Section title="Promotion">
        <ul>
          <li>When a pawn reaches the last rank, you must pick any non-king, non-pawn piece that is currently on your <em>diagonal opponent's</em> board to promote into.</li>
          <li>That piece is removed from the diagonal opponent's board and placed on your board as the promoted pawn. Your original pawn goes to the diagonal opponent's hand.</li>
          <li>If there is no eligible piece on the diagonal opponent's board, the pawn <strong>cannot</strong> advance to the last rank — the move is illegal.</li>
          <li>You cannot select a piece that is <em>pinned</em> on the diagonal opponent's board — a piece whose removal would leave that player's king exposed to immediate capture. If all eligible pieces are pinned, the pawn cannot advance to the last rank either.</li>
          <li>If a promoted piece is later captured, it keeps its promoted type and goes to the capturer's partner's hand.</li>
        </ul>
      </Section>

      <button
        onClick={onBack}
        style={{
          marginTop: 40, padding: '10px 24px', background: '#2563eb',
          color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 15, cursor: 'pointer', fontWeight: 'bold',
        }}
      >
        Back to home
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 17, marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}
