import React, { useEffect, useMemo, useRef } from 'react';
import { AnnotatedEvent, BoardId, GameEvent, buildSanList } from '@bughouse/shared';

type Props = {
  events: GameEvent[];
  ownBoardId: BoardId;
  initialClockMs: number;
  highlightedSeq: number | null;
  height?: number;
};

function pairUp(items: AnnotatedEvent[]): { w: AnnotatedEvent | null; b: AnnotatedEvent | null }[] {
  const rows: { w: AnnotatedEvent | null; b: AnnotatedEvent | null }[] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push({ w: items[i] ?? null, b: items[i + 1] ?? null });
  }
  return rows;
}

export function NotationPanel({ events, ownBoardId, initialClockMs, highlightedSeq, height }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const annotated = useMemo(
    () => buildSanList(events, initialClockMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events.length, initialClockMs],
  );

  const own = annotated.filter((a) => a.event.boardId === ownBoardId);
  const rows = pairUp(own);

  // Scroll to bottom when new moves arrive and we're in live mode.
  useEffect(() => {
    if (highlightedSeq === null) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [annotated.length, highlightedSeq]);

  // Scroll to highlighted move when cursor changes.
  useEffect(() => {
    if (highlightedSeq !== null) {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedSeq]);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      padding: '10px 12px',
      height: height ?? 200,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {rows.length === 0 ? (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, color: 'rgba(255,255,255,0.25)',
          padding: '4px 0',
        }}>—</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 1fr',
          rowGap: 2, columnGap: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
        }}>
          {rows.map((r, i) => {
            const wHighlighted = r.w !== null && r.w.event.seq === highlightedSeq;
            const bHighlighted = r.b !== null && r.b.event.seq === highlightedSeq;
            return (
              <React.Fragment key={i}>
                <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>{i + 1}.</div>
                <div
                  ref={wHighlighted ? highlightRef : undefined}
                  style={{
                    color: wHighlighted ? '#0a0c10' : 'rgba(255,255,255,0.85)',
                    background: wHighlighted ? '#56dbd3' : 'transparent',
                    borderRadius: wHighlighted ? 3 : 0,
                    padding: wHighlighted ? '0 3px' : 0,
                  }}
                >
                  {r.w?.san ?? ''}
                </div>
                <div
                  ref={bHighlighted ? highlightRef : undefined}
                  style={{
                    color: bHighlighted ? '#0a0c10' : 'rgba(255,255,255,0.6)',
                    background: bHighlighted ? '#56dbd3' : 'transparent',
                    borderRadius: bHighlighted ? 3 : 0,
                    padding: bHighlighted ? '0 3px' : 0,
                  }}
                >
                  {r.b?.san ?? ''}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
