import React, { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage.js';
import { RulesPage } from './components/RulesPage.js';
import { LobbyView } from './components/LobbyView.js';
import { GameView } from './components/GameView.js';
import { LeaderboardPage } from './components/LeaderboardPage.js';
import { ProfilePage } from './components/ProfilePage.js';
import { SettingsPage } from './components/SettingsPage.js';
import { PickUsernamePage } from './components/PickUsernamePage.js';
import { CreateGamePage } from './components/CreateGamePage.js';
import { GameReplayPage } from './components/GameReplayPage.js';
import { useGame } from './hooks/useGame.js';
import { useAuth } from './hooks/useAuth.js';

function parseCode(): string | null {
  const m = location.pathname.match(/^\/g\/([A-Z0-9]{6})$/i);
  return m ? m[1]!.toUpperCase() : null;
}

function parsePage(): 'rules' | 'leaderboard' | 'profile' | 'settings' | 'create' | null {
  if (location.pathname === '/rules') return 'rules';
  if (location.pathname === '/leaderboard') return 'leaderboard';
  if (location.pathname === '/profile') return 'profile';
  if (location.pathname === '/settings') return 'settings';
  if (location.pathname === '/create') return 'create';
  return null;
}

function parseMember(): string | null {
  const m = location.pathname.match(/^\/member\/([a-zA-Z0-9_-]+)$/);
  return m ? m[1]! : null;
}

function parseGameId(): string | null {
  const m = location.pathname.match(/^\/game\/([0-9a-f-]{36})$/i);
  return m ? m[1]! : null;
}

// ── Public member profile ───────────────────────────────────────────────────

type PublicUser = { id: string; username: string; rating: number; ratingGamesPlayed: number };

function MemberPage({
  username,
  auth,
  onHome,
  onBack,
  onSettings,
  onOpenGame,
}: {
  username: string;
  auth: ReturnType<typeof useAuth>;
  onHome: () => void;
  onBack: () => void;
  onSettings: () => void;
  onOpenGame: (gameId: string) => void;
}) {
  const [state, setState] = useState<PublicUser | 'loading' | 'not-found'>('loading');

  useEffect(() => {
    setState('loading');
    fetch(`/api/users/by-username/${encodeURIComponent(username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setState(data ? (data as PublicUser) : 'not-found'))
      .catch(() => setState('not-found'));
  }, [username]);

  if (state === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)', fontFamily: "'Geist', 'Inter', sans-serif",
      }}>
        Loading…
      </div>
    );
  }

  if (state === 'not-found') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        fontFamily: "'Geist', 'Inter', sans-serif",
      }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>♟</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
          Player not found
        </div>
        <button
          onClick={onBack}
          style={{
            background: 'linear-gradient(135deg, #56dbd3 0%, #3bb8b0 100%)',
            border: 'none', color: '#0a0c10', borderRadius: 8,
            padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Geist', 'Inter', sans-serif",
          }}
        >← Back</button>
      </div>
    );
  }

  // Determine if the viewer is looking at their own profile
  const isOwnProfile = auth.user !== null && auth.user.id === state.id;

  // For own profile, use auth data (includes displayName) merged with fetched data
  const profileUser = isOwnProfile && auth.user
    ? { ...state, displayName: auth.user.displayName }
    : state;

  return (
    <ProfilePage
      user={profileUser}
      isOwnProfile={isOwnProfile}
      onBack={onBack}
      onHome={onHome}
      onSettings={isOwnProfile ? onSettings : undefined}
      onLogout={isOwnProfile && auth.user ? async () => { await auth.logout(); onHome(); } : undefined}
      onOpenGame={onOpenGame}
    />
  );
}

// ── Game page ───────────────────────────────────────────────────────────────

function GamePage({
  code, onHome, onProfile, auth,
}: { code: string; onHome: () => void; onProfile: () => void; auth: ReturnType<typeof useAuth> }) {
  const { store, send } = useGame(code);

  if (!store.game || store.game.status === 'lobby') {
    return <LobbyView store={store} code={code} send={send} onHome={onHome} onProfile={onProfile} username={auth.user?.username} />;
  }

  return <GameView store={store} send={send} onHome={onHome} onProfile={onProfile} auth={auth} />;
}

// ── Root ────────────────────────────────────────────────────────────────────

export function App() {
  const auth = useAuth();
  const [code, setCode] = useState<string | null>(() => parseCode());
  const [page, setPage] = useState<'rules' | 'leaderboard' | 'profile' | 'settings' | 'create' | null>(() => parsePage());
  const [member, setMember] = useState<string | null>(() => parseMember());
  const [replayGameId, setReplayGameId] = useState<string | null>(() => parseGameId());

  const navigate = (path: string) => {
    history.pushState(null, '', path);
    setCode(parseCode());
    setPage(parsePage());
    setMember(parseMember());
    setReplayGameId(parseGameId());
  };

  useEffect(() => {
    const onPop = () => {
      setCode(parseCode());
      setPage(parsePage());
      setMember(parseMember());
      setReplayGameId(parseGameId());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleHome     = () => navigate('/');
  const handleRules    = () => navigate('/rules');
  const handleLeaderboard = () => navigate('/leaderboard');
  const handleProfile  = () => navigate('/profile');
  const handleSettings = () => navigate('/settings');
  const handleCreate   = () => navigate('/create');
  const handleJoin     = (c: string) => { history.pushState(null, '', `/g/${c}`); setCode(c); setPage(null); setMember(null); setReplayGameId(null); };
  const handleOpenGame = (gameId: string) => navigate(`/game/${gameId}`);

  if (auth.user && !auth.user.usernameSet) {
    return <PickUsernamePage onDone={(username) => auth.updateUser({ username, usernameSet: true })} />;
  }

  if (replayGameId) {
    return (
      <GameReplayPage
        gameId={replayGameId}
        onHome={handleHome}
        onBack={() => history.back()}
      />
    );
  }

  if (code) return <GamePage code={code} onHome={handleHome} onProfile={handleProfile} auth={auth} />;

  if (member) {
    return (
      <MemberPage
        username={member}
        auth={auth}
        onHome={handleHome}
        onBack={() => history.back()}
        onSettings={handleSettings}
        onOpenGame={handleOpenGame}
      />
    );
  }

  if (page === 'rules') return <RulesPage onHome={handleHome} onProfile={handleProfile} username={auth.user?.username} />;
  if (page === 'leaderboard') return <LeaderboardPage onHome={handleHome} onProfile={handleProfile} username={auth.user?.username} />;

  if (page === 'profile' && auth.user) {
    return (
      <ProfilePage
        user={auth.user}
        isOwnProfile
        onBack={() => history.back()}
        onHome={handleHome}
        onSettings={handleSettings}
        onLogout={async () => { await auth.logout(); handleHome(); }}
        onOpenGame={handleOpenGame}
      />
    );
  }

  if (page === 'settings' && auth.user) {
    return (
      <SettingsPage
        user={auth.user}
        onHome={handleHome}
        onProfile={handleProfile}
        onUsernameChanged={(username) => { auth.updateUser({ username }); navigate('/profile'); }}
      />
    );
  }

  if (page === 'create') {
    return (
      <CreateGamePage
        onJoin={handleJoin}
        onBack={handleHome}
        onProfile={handleProfile}
        username={auth.user?.username}
        userRating={auth.user?.rating}
      />
    );
  }

  return (
    <HomePage
      onJoin={handleJoin}
      onRules={handleRules}
      onProfile={handleProfile}
      onLeaderboard={handleLeaderboard}
      onCreateGame={handleCreate}
      auth={auth}
    />
  );
}
