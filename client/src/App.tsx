import React, { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage.js';
import { LobbyView } from './components/LobbyView.js';
import { GameView } from './components/GameView.js';
import { useGame } from './hooks/useGame.js';

function parseCode(): string | null {
  const m = location.pathname.match(/^\/g\/([A-Z0-9]{6})$/i);
  return m ? m[1]!.toUpperCase() : null;
}

function GamePage({ code }: { code: string }) {
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

  return <GameView store={store} send={send} />;
}

export function App() {
  const [code, setCode] = useState<string | null>(() => parseCode());

  const handleJoin = (c: string) => {
    history.pushState(null, '', `/g/${c}`);
    setCode(c);
  };

  useEffect(() => {
    const onPop = () => setCode(parseCode());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (code) return <GamePage code={code} />;
  return <HomePage onJoin={handleJoin} />;
}
