import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { deleteCampaignWeb } from './campaignStorage.js';
import { deleteArenaWeb } from './arenaStorage.js';
import { deleteAdventureWeb } from './adventureStorage.js';
import './styles.css';

// Rounded display font (Baloo 2), loaded from public/ with the base-correct
// path so it works on the GitHub Pages subpath. --display references 'Baloo 2'.
try {
  const baloo = new FontFace(
    'Baloo 2',
    `url(${import.meta.env.BASE_URL}fonts/baloo-2-latin-wght-normal.woff2)`,
    { weight: '400 800', display: 'swap' },
  );
  baloo.load().then((f) => document.fonts.add(f)).catch(() => {});
} catch {
  /* FontFace unsupported — the CSS fallback stack handles it. */
}

/**
 * Errors React cannot see.
 *
 * The boundary below catches anything thrown during render. An async callback
 * or a rejected promise is a different animal: it does NOT unmount the tree, so
 * it never white-screens — it just fails silently, which is its own problem.
 * Logging it with a recognisable prefix is the difference between a bug report
 * that says "it stopped working" and one that can be acted on.
 */
window.addEventListener('error', (e) => console.error('[uncaught]', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[unhandled]', e.reason));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      onReset={() => {
        // The last resort, behind a confirm in the boundary itself: if a save is
        // what makes the app throw, nothing inside the app can clear it.
        deleteCampaignWeb();
        deleteArenaWeb();
        deleteAdventureWeb();
      }}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// The boot shell from index.html has done its job the moment React has painted
// anything. Removed on the next frame rather than immediately so the two never
// swap mid-paint and flash the background between them.
requestAnimationFrame(() => document.getElementById('boot')?.remove());

// PWA: offline cache + installability (production only; dev server stays live).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
