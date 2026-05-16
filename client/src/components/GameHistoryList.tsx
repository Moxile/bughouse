import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameHistoryRow, Seat } from '@bughouse/shared';
import { relativeTime } from '../util/relativeTime.js';

type Props = {
  username: string;
  isOwnProfile: boolean;
  onOpenGame: (gameId: string) => void;
  ratedOnly?: boolean;
  sinceDays?: number;
};

// Seat groupings: team 0 = {0,2}, team 1 = {1,3}
const TEAM_0: Seat[] = [0, 2];
const TEAM_1: Seat[] = [1, 3];

function rowColors(row: GameHistoryRow): { bg: string; border: string; accent: string } {
  if (!row.rated) {
    return {
      bg: 'rgba(86,219,211,0.07)',
      border: '1px solid rgba(86,219,211,0.18)',
      accent: '#56dbd3',
    };
  }
  const selfTeam = row.selfSeat === 0 || row.selfSeat === 2 ? 0 : 1;
  const won = row.result.winningTeam === selfTeam;
  if (won) {
    return {
      bg: 'rgba(52,211,153,0.10)',
      border: '1px solid rgba(52,211,153,0.30)',
      accent: '#34d399',
    };
  }
  return {
    bg: 'rgba(239,87,87,0.10)',
    border: '1px solid rgba(239,87,87,0.30)',
    accent: '#ff5757',
  };
}

function outcomeLabel(row: GameHistoryRow): string {
  if (!row.rated) return 'Unrated';
  const selfTeam = row.selfSeat === 0 || row.selfSeat === 2 ? 0 : 1;
  const won = row.result.winningTeam === selfTeam;
  return won ? 'Win' : 'Loss';
}

function deltaLabel(delta: number | null): string {
  if (delta === null) return '';
  return delta >= 0 ? `+${delta}` : String(delta);
}

function teamNames(row: GameHistoryRow, team: Seat[]): string {
  return team.map((s) => row.playerNames[s]).join(' & ');
}

function GameRow({ row, onOpen }: { row: GameHistoryRow; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  const { bg, border, accent } = rowColors(row);
  const selfTeam = row.selfSeat === 0 || row.selfSeat === 2 ? 0 : 1;
  const myTeam = selfTeam === 0 ? TEAM_0 : TEAM_1;
  const oppTeam = selfTeam === 0 ? TEAM_1 : TEAM_0;
  const outcome = outcomeLabel(row);
  const delta = deltaLabel(row.selfDelta);
  const duration = Math.round((row.endedAt - row.startedAt) / 1000);
  const durationStr = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: hovered ? bg.replace('0.10', '0.16').replace('0.07', '0.12') : bg,
        border,
        borderRadius: 10, padding: '10px 14px',
        cursor: 'pointer', transition: 'background 0.15s',
        userSelect: 'none',
      }}
    >
      {/* Outcome + delta */}
      <div style={{ width: 52, flexShrink: 0, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Geist', 'Inter', sans-serif",
          fontSize: 12, fontWeight: 700, color: accent,
        }}>{outcome}</div>
        {delta && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, color: accent, opacity: 0.75,
          }}>{delta}</div>
        )}
      </div>

      {/* Players */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: "'Geist', 'Inter', sans-serif",
          fontSize: 12, color: '#fff',
        }}>
          <span style={{ fontWeight: 600 }}>{teamNames(row, myTeam)}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>vs</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{teamNames(row, oppTeam)}</span>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span>{row.result.reason} · {durationStr}</span>
          {((row as any).simulTeams?.[0] || (row as any).simulTeams?.[1]) && (
            <span style={{
              background: 'rgba(167,139,250,0.15)',
              color: 'rgba(167,139,250,0.8)',
              border: '1px solid rgba(167,139,250,0.3)',
              borderRadius: 3, padding: '1px 4px', fontSize: 9, letterSpacing: 0.5,
            }}>SIMUL</span>
          )}
        </div>
      </div>

      {/* Date */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, color: 'rgba(255,255,255,0.35)',
        flexShrink: 0, textAlign: 'right',
      }}>
        {relativeTime(row.startedAt)}
      </div>
    </div>
  );
}

export function GameHistoryList({ username, isOwnProfile, onOpenGame, ratedOnly, sinceDays }: Props) {
  const [games, setGames] = useState<GameHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasFetchedRef = useRef(false);

  const buildUrl = useCallback((before?: number) => {
    const params = new URLSearchParams({ limit: '20' });
    if (before != null) params.set('before', String(before));
    if (ratedOnly) params.set('rated', 'true');
    if (sinceDays != null) params.set('sinceDays', String(sinceDays));
    return `/api/users/${encodeURIComponent(username)}/games?${params}`;
  }, [username, ratedOnly, sinceDays]);

  useEffect(() => {
    hasFetchedRef.current = false;
    setGames([]);
    setHasMore(false);
    setLoading(true);
    fetch(buildUrl())
      .then((r) => r.ok ? r.json() : null)
      .then((data: { games: GameHistoryRow[]; hasMore: boolean } | null) => {
        if (data) {
          setGames(data.games);
          setHasMore(data.hasMore);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [buildUrl]);

  const loadMore = () => {
    if (loadingMore || games.length === 0) return;
    const oldest = games[games.length - 1]!.startedAt;
    setLoadingMore(true);
    fetch(buildUrl(oldest))
      .then((r) => r.ok ? r.json() : null)
      .then((data: { games: GameHistoryRow[]; hasMore: boolean } | null) => {
        if (data) {
          setGames((prev) => [...prev, ...data.games]);
          setHasMore(data.hasMore);
        }
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 0',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12, color: 'rgba(255,255,255,0.3)',
      }}>
        Loading…
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 14, padding: '60px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, opacity: 0.4 }}>♟</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
          {ratedOnly ? 'No rated games yet' : 'No games yet'}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, color: 'rgba(255,255,255,0.25)', maxWidth: 260,
        }}>
          {isOwnProfile
            ? 'Play a game to see your history here.'
            : `${username}'s game history will appear here.`}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {games.map((g) => (
        <GameRow key={g.gameId} row={g} onOpen={() => onOpenGame(g.gameId)} />
      ))}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          style={{
            marginTop: 4,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '9px 0',
            color: 'rgba(255,255,255,0.45)',
            fontFamily: "'Geist', 'Inter', sans-serif",
            fontSize: 13, cursor: loadingMore ? 'default' : 'pointer',
            width: '100%',
            transition: 'background 0.15s',
          }}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
