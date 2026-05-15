import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

// Called by the Google GSI library after the user authenticates.
(window as unknown as Record<string, unknown>).handleCredentialResponse = async (
  response: { credential: string },
) => {
  await fetch('/api/auth/google/credential', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: response.credential }),
  });
  window.location.href = '/';
};

const root = document.getElementById('root')!;
createRoot(root).render(<App />);
