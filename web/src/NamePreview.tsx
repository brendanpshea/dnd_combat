/**
 * Dev-only (`?dev=names`): every style's names side by side — men, women,
 * surnames, places, bosses — with a reroll. Where you hear whether a style
 * sounds like itself, and catch the name nobody wants on a shopkeeper.
 */
import { useMemo, useState } from 'react';
import { NAME_STYLES, personName, placeName, bossName, beastName, minionName } from '../../src/adventure/names.js';
import { CORPORA } from '../../src/data/names/corpora.js';

function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function NamePreview() {
  const [seed, setSeed] = useState(1);
  const rows = useMemo(() => NAME_STYLES.map((style) => {
    const rng = rngFrom(seed * 7919 + style.length), avoid = new Set<string>();
    const n = (k: number, f: () => string) => Array.from({ length: k }, f);
    return {
      style, blurb: CORPORA[style].blurb,
      men: n(5, () => personName(style, 'male', rng, avoid).full),
      women: n(5, () => personName(style, 'female', rng, avoid).full),
      places: n(5, () => placeName(style, rng, 11, avoid)),
      bosses: n(3, () => bossName(style, rng() < 0.5 ? 'male' : 'female', rng, avoid)),
    };
  }), [seed]);
  const beasts = useMemo(() => { const r = rngFrom(seed); return [...Array(6)].map(() => beastName(r)); }, [seed]);
  const minions = useMemo(() => { const r = rngFrom(seed + 1); return [...Array(10)].map(() => minionName(r)); }, [seed]);
  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Names</h1>
      <p>Seed {seed} <button onClick={() => setSeed((s) => s + 1)}>🎲 Reroll</button></p>
      {rows.map((r) => (
        <section key={r.style} style={{ marginBottom: 16 }}>
          <h2 style={{ marginBottom: 2 }}>{r.style}</h2>
          <p style={{ marginTop: 0, opacity: 0.7 }}>{r.blurb}</p>
          <p><b>Men:</b> {r.men.join(' · ')}</p>
          <p><b>Women:</b> {r.women.join(' · ')}</p>
          <p><b>Places:</b> {r.places.join(' · ')}</p>
          <p><b>Bosses:</b> {r.bosses.join(' · ')}</p>
        </section>
      ))}
      <h2>Beasts</h2><p>{beasts.join(' · ')}</p>
      <h2>Minions</h2><p>{minions.join(' · ')}</p>
    </div>
  );
}
