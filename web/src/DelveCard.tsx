/**
 * Dev-only: a generated delve to play. Each one is a fresh module from
 * `generateDelve`, held to every proof the validator runs, and saved in a
 * slot of its own so trying one never touches a story company.
 */
import { useState } from 'react';
import type { Module } from '../../src/adventure/types.js';
import type { AdventureState } from '../../src/adventure/runtime.js';
import { generateDelve, delveFromId } from '../../src/adventure/dungeon-gen.js';
import { DELVE_SLOT, savedAdventureModule, loadAdventureWeb, deleteAdventureWeb } from './adventureStorage.js';
import { initAudio } from './sound.js';

export function DelveCard({ onPlay }: { onPlay(module: Module, resume?: AdventureState): void }) {
  const [level, setLevel] = useState(2);
  const savedId = savedAdventureModule(DELVE_SLOT);
  const saved = savedId ? delveFromId(savedId) : undefined;
  const resume = saved ? loadAdventureWeb(saved, DELVE_SLOT) : undefined;
  return (
    <div className="landing-alt delve-card">
      <span>🎲 Random delve</span>
      <small>A generated dungeon, proved winnable before you see it.</small>
      <div className="delve-row">
        <span className="muted">Level</span>
        {[1, 2, 3, 4].map((l) => (
          <button key={l} className={`mini${l === level ? ' on' : ''}`} aria-pressed={l === level} onClick={() => setLevel(l)}>{l}</button>
        ))}
        <button className="mini" onClick={() => {
          initAudio();
          deleteAdventureWeb(DELVE_SLOT);
          onPlay(generateDelve(Math.floor(Math.random() * 1e6), { level }).module);
        }}>New delve</button>
      </div>
      {saved && resume && (
        <button className="mini" onClick={() => { initAudio(); onPlay(saved, resume); }}>
          ▶ Continue {saved.title} (level {saved.levelBand?.from})
        </button>
      )}
    </div>
  );
}
