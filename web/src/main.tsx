import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA: offline cache + installability (production only; dev server stays live).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
