/**
 * Dev-only: a generated delve to play. Each one is a fresh module, held to
 * every proof the validator runs, and saved in a slot of its own so trying one
 * never touches a story company.
 *
 * Left at its defaults it is the classic delve (`generateDelve`). Anything
 * else — a shape, more floors, a theme, generated fights, required rooms — is
 * a spec delve (`generateSpecDelve`), whose id carries the spec so a saved run
 * rebuilds exactly.
 */
import { useState } from 'react';
import type { Module } from '../../src/adventure/types.js';
import type { AdventureState } from '../../src/adventure/runtime.js';
import { generateDelve, delveFromId } from '../../src/adventure/dungeon-gen.js';
import {
  generateSpecDelve, specDelveFromId, DELVE_SHAPES, SPEC_THEMES, MAX_FLOORS,
  type DelveSpec, type DelveShape, type SpecTheme, type RequiredRoom,
} from '../../src/adventure/delve-spec.js';
import { PIECES } from '../../src/adventure/delve-pieces.js';
import { DELVE_SLOT, savedAdventureModule, loadAdventureWeb, deleteAdventureWeb } from './adventureStorage.js';
import { initAudio } from './sound.js';

type Size = NonNullable<DelveSpec['size']>;

function Pick<T extends string | number>({ label, value, options, onPick }: {
  label: string; value: T; options: readonly T[]; onPick(v: T): void;
}) {
  return (
    <div className="delve-row">
      <span className="muted">{label}</span>
      {options.map((o) => (
        <button key={o} className={`mini${o === value ? ' on' : ''}`} aria-pressed={o === value} onClick={() => onPick(o)}>{o}</button>
      ))}
    </div>
  );
}

export function DelveCard({ onPlay }: { onPlay(module: Module, resume?: AdventureState): void }) {
  const [level, setLevel] = useState(2);
  const [theme, setTheme] = useState<SpecTheme | 'any'>('any');
  const [shape, setShape] = useState<DelveShape>('classic');
  const [floors, setFloors] = useState(1);
  const [size, setSize] = useState<Size>('medium');
  const [fights, setFights] = useState<'authored' | 'generated'>('authored');
  const [require, setRequire] = useState('');
  const [pieces, setPieces] = useState<string[]>([]);
  const [error, setError] = useState('');
  const savedId = savedAdventureModule(DELVE_SLOT);
  const saved = savedId ? specDelveFromId(savedId) ?? delveFromId(savedId) : undefined;
  const resume = saved ? loadAdventureWeb(saved, DELVE_SLOT) : undefined;

  const start = () => {
    const seed = Math.floor(Math.random() * 1e6);
    try {
      // A list is required rooms; an object is any part of a spec (pieces with
      // floors and bindings, say), laid over the buttons.
      const raw: unknown = require.trim() ? JSON.parse(require) : [];
      const rooms: RequiredRoom[] = Array.isArray(raw) ? raw as RequiredRoom[] : [];
      const extra: DelveSpec = Array.isArray(raw) ? {} : raw as DelveSpec;
      const picked = pieces.map((piece) => ({ piece }));
      const classic = shape === 'classic' && floors === 1 && fights === 'authored' && rooms.length === 0
        && picked.length === 0 && Object.keys(extra).length === 0
        && (theme === 'any' || !['forest', 'village'].includes(theme));
      const module = classic
        ? generateDelve(seed, { level, size, ...(theme === 'any' ? {} : { theme: theme as never }) }).module
        : generateSpecDelve(seed, {
          level, shape, floors, fights, size, ...(theme === 'any' ? { theme: SPEC_THEMES[seed % SPEC_THEMES.length]! } : { theme }),
          ...(rooms.length ? { require: rooms } : {}),
          ...(picked.length ? { pieces: picked } : {}),
          ...extra,
        }).module;
      setError('');
      initAudio();
      deleteAdventureWeb(DELVE_SLOT);
      onPlay(module);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="landing-alt delve-card">
      <span>🎲 Random delve</span>
      <small>A generated dungeon, proved winnable before you see it.</small>
      <Pick<number> label="Level" value={level} options={[1, 2, 3, 4, 5]} onPick={setLevel} />
      <details className="delve-more">
        <summary>Settings</summary>
        <Pick<SpecTheme | 'any'> label="Theme" value={theme} options={['any', ...SPEC_THEMES] as const} onPick={setTheme} />
        <Pick<DelveShape> label="Shape" value={shape} options={DELVE_SHAPES} onPick={setShape} />
        <Pick<Size> label="Size" value={size} options={['small', 'medium', 'large'] as const} onPick={setSize} />
        <Pick<number> label="Floors" value={floors} options={Array.from({ length: MAX_FLOORS }, (_, i) => i + 1)} onPick={setFloors} />
        <Pick<'authored' | 'generated'> label="Fights" value={fights} options={['authored', 'generated'] as const} onPick={setFights} />
        <div className="delve-row">
          <span className="muted">Set pieces</span>
          {Object.values(PIECES).map((p) => {
            const on = pieces.includes(p.id);
            return (
              <button key={p.id} className={`mini${on ? ' on' : ''}`} aria-pressed={on} title={p.blurb}
                onClick={() => setPieces(on ? pieces.filter((x) => x !== p.id) : [...pieces, p.id])}>{p.name}</button>
            );
          })}
        </div>
        <label className="delve-require">
          <span className="muted">Required rooms, or a spec (JSON)</span>
          <textarea rows={3} value={require} spellCheck={false}
            placeholder={'[{"name":"Shrine","rest":"safe","where":"beforeLock"},\n {"where":"goal","fight":{"brief":"artillery"}}]'}
            onChange={(e) => setRequire(e.target.value)} />
        </label>
      </details>
      {error && <small className="delve-error" role="alert">{error}</small>}
      <div className="delve-row">
        <button className="mini" onClick={start}>New delve</button>
      </div>
      {saved && resume && (
        <button className="mini" onClick={() => { initAudio(); onPlay(saved, resume); }}>
          ▶ Continue {saved.title} (level {saved.levelBand?.from})
        </button>
      )}
    </div>
  );
}
