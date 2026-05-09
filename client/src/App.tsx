import React, { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage.js';
import { RulesPage } from './components/RulesPage.js';
import { LobbyView } from './components/LobbyView.js';
import { GameView } from './components/GameView.js';
import { useGame } from './hooks/useGame.js';

function parseCode(): string | null {
  const m = location.pathname.match(/^\/g\/([A-Z0-9]{6})$/i);
  return m ? m[1]!.toUpperCase() : null;
}

function isRules(): boolean {
  return location.pathname === '/rules';
}

function GamePage({ code, onHome }: { code: string; onHome: () => void }) {
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem('playerName') ?? 'Player',
  );
  const { store, send } = useGame(code);

  const handleSetName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('playerName', name);
  };

  if (!store.game || store.game.status === 'lobby') {
    return (
      <LobbyView
        store={store}
        code={code}
        send={send}
        onSetName={handleSetName}
        playerName={playerName}
      />
    );
  }

  return <GameView store={store} send={send} onHome={onHome} />;
}

export function App() {
  const [code, setCode] = useState<string | null>(() => parseCode());
  const [rules, setRules] = useState(() => isRules());

  const handleJoin = (c: string) => {
    history.pushState(null, '', `/g/${c}`);
    setCode(c);
  };

  const handleRules = () => {
    history.pushState(null, '', '/rules');
    setRules(true);
  };

  const handleBack = () => {
    history.pushState(null, '', '/');
    setRules(false);
  };

  useEffect(() => {
    const onPop = () => {
      setCode(parseCode());
      setRules(isRules());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleHome = () => { history.pushState(null, '', '/'); setCode(null); };
  if (code) return <GamePage code={code} onHome={handleHome} />;
  if (rules) return <RulesPage onBack={handleBack} />;
  return <HomePage onJoin={handleJoin} onRules={handleRules} />;
}
