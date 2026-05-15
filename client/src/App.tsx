import React, { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage.js';
import { RulesPage } from './components/RulesPage.js';
import { LobbyView } from './components/LobbyView.js';
import { GameView } from './components/GameView.js';
import { LeaderboardPage } from './components/LeaderboardPage.js';
import { ProfilePage } from './components/ProfilePage.js';
import { SettingsPage } from './components/SettingsPage.js';
import { useGame } from './hooks/useGame.js';
import { useAuth } from './hooks/useAuth.js';

function parseCode(): string | null {
  const m = location.pathname.match(/^\/g\/([A-Z0-9]{6})$/i);
  return m ? m[1]!.toUpperCase() : null;
}

function parsePage(): 'rules' | 'leaderboard' | 'profile' | 'settings' | null {
  if (location.pathname === '/rules') return 'rules';
  if (location.pathname === '/leaderboard') return 'leaderboard';
  if (location.pathname === '/profile') return 'profile';
  if (location.pathname === '/settings') return 'settings';
  return null;
}

function GamePage({ code, onHome, onProfile, auth }: { code: string; onHome: () => void; onProfile: () => void; auth: ReturnType<typeof useAuth> }) {
  const { store, send } = useGame(code);

  if (!store.game || store.game.status === 'lobby') {
    return <LobbyView store={store} code={code} send={send} onHome={onHome} onProfile={onProfile} username={auth.user?.username} />;
  }

  return <GameView store={store} send={send} onHome={onHome} onProfile={onProfile} auth={auth} />;
}

export function App() {
  const auth = useAuth();
  const [code, setCode] = useState<string | null>(() => parseCode());
  const [page, setPage] = useState<'rules' | 'leaderboard' | 'profile' | 'settings' | null>(() => parsePage());

  const navigate = (path: string) => {
    history.pushState(null, '', path);
    setCode(parseCode());
    setPage(parsePage());
  };

  useEffect(() => {
    const onPop = () => {
      setCode(parseCode());
      setPage(parsePage());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleHome = () => navigate('/');
  const handleRules = () => navigate('/rules');
  const handleLeaderboard = () => navigate('/leaderboard');
  const handleProfile = () => navigate('/profile');
  const handleSettings = () => navigate('/settings');
  const handleJoin = (c: string) => { history.pushState(null, '', `/g/${c}`); setCode(c); setPage(null); };

  if (code) return <GamePage code={code} onHome={handleHome} onProfile={handleProfile} auth={auth} />;
  if (page === 'rules') return <RulesPage onHome={handleHome} onProfile={handleProfile} username={auth.user?.username} />;
  if (page === 'leaderboard') return <LeaderboardPage onHome={handleHome} onProfile={handleProfile} username={auth.user?.username} />;
  if (page === 'profile' && auth.user) {
    return (
      <ProfilePage
        user={auth.user}
        onHome={handleHome}
        onSettings={handleSettings}
        onLogout={async () => { await auth.logout(); handleHome(); }}
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

  return (
    <HomePage
      onJoin={handleJoin}
      onRules={handleRules}
      onProfile={handleProfile}
      onLeaderboard={handleLeaderboard}
      auth={auth}
    />
  );
}
