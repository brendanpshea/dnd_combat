/**
 * Dev-only (`?dev=recipes`): a spec rolled thirty times, laid out side by
 * side. A recipe nobody can preview is a recipe nobody can write — this is
 * where you see whether a set piece lands where you meant, how often a spec
 * leans on rerolls, and what the fights cost, before anyone plays it.
 */
import { useMemo, useState } from 'react';
import type { Dungeon, Module } from '../../src/adventure/types.js';
import { layoutDungeon, linkKey, ROOM_BOX } from '../../src/adventure/dungeon.js';
import { generateSpecDelve, type DelveSpec } from '../../src/adventure/delve-spec.js';
import { PIECES } from '../../src/adventure/delve-pieces.js';
import { encounterFor } from '../../src/data/encounters.js';
import { adjustedXp } from '../../src/arena/encounter.js';
import { evenBudgetFor } from '../../src/arena/run.js';

const EXAMPLE: DelveSpec = {
  shape: 'classic', floors: 2, level: 2, fights: 'generated', theme: 'stone',
  pieces: [{ piece: 'warden' }, { piece: 'valve', floor: 2 }, { piece: 'prisoner', floor: 2, where: 'afterLock', bind: { name: 'Mara Vell' } }],
};

const PX = 46, PY = 34, PAD = 12;

function FloorMap({ d }: { d: Dungeon }) {
  const layout = useMemo(() => layoutDungeon(d), [d]);
  const cells = Object.values(layout.cells);
  const cols = Math.max(...cells.map((c) => c[0])) + 1, rows = Math.max(...cells.map((c) => c[1])) + 1;
  const at = (id: string): [number, number] => {
    const [c, r] = layout.cells[id] ?? [0, 0];
    return [PAD + c * PX + PX / 2, PAD + r * PY + PY / 2];
  };
  const kind = (r: Dungeon['rooms'][number]) =>
    r.goal ? 'goal' : r.id === d.entry ? 'entry' : r.id.startsWith('p') ? 'piece' : r.rest === 'safe' ? 'safe' : r.fight ? 'fight' : 'plain';
  return (
    <svg className="dp-map" viewBox={`0 0 ${cols * PX + PAD * 2} ${rows * PY + PAD * 2}`} role="img" aria-label={`Map of ${d.title}`}>
      {d.links.map((l) => {
        const path = layout.corridors[linkKey(l)];
        if (!path) return null;
        const cls = l.door?.locked ? 'locked' : l.door?.secret ? 'secret' : l.door?.oneWay ? 'oneway' : l.door?.ambush ? 'ambush' : '';
        return <polyline key={linkKey(l)} className={`dp-corr ${cls}`}
          points={path.map(([c, r]) => `${PAD + c * PX + PX / 2},${PAD + r * PY + PY / 2}`).join(' ')} />;
      })}
      {d.rooms.map((r) => {
        const [x, y] = at(r.id);
        const box = ROOM_BOX[r.size ?? 'medium'];
        const w = box.w * PX * 0.9, h = box.h * PY * 0.9;
        return (
          <g key={r.id} className={`dp-room ${kind(r)}`}>
            <title>{`${r.name} (${r.id})${r.fight ? ' — fight' : ''}${r.search ? ' — search' : ''}${r.rest ? ` — rest: ${r.rest}` : ''}`}</title>
            <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={4} />
          </g>
        );
      })}
    </svg>
  );
}

interface Roll { seed: number; module?: Module; rerolls?: number; error?: string }

export function DelvePreview() {
  const [text, setText] = useState(JSON.stringify(EXAMPLE, null, 1));
  const [base, setBase] = useState(1);
  const [rolls, setRolls] = useState<Roll[] | null>(null);
  const [parseError, setParseError] = useState('');

  const roll = () => {
    let spec: DelveSpec;
    try { spec = JSON.parse(text) as DelveSpec; } catch (e) { setParseError((e as Error).message); return; }
    setParseError('');
    setRolls(Array.from({ length: 30 }, (_, i) => {
      const seed = base + i;
      try {
        const r = generateSpecDelve(seed, spec);
        return { seed, module: r.module, rerolls: r.rerolls };
      } catch (e) { return { seed, error: (e as Error).message }; }
    }));
  };

  const ok = rolls?.filter((r) => r.module) ?? [];
  const meanRerolls = ok.length ? ok.reduce((a, r) => a + r.rerolls!, 0) / ok.length : 0;
  const level = (() => { try { return (JSON.parse(text) as DelveSpec).level ?? 2; } catch { return 2; } })();

  return (
    <div className="dp">
      <h1>Delve preview</h1>
      <p className="muted">A spec (see <code>DelveSpec</code>), rolled on thirty seeds. Pieces: {Object.values(PIECES).map((p) => p.id).join(', ')}.</p>
      <textarea className="dp-spec" rows={10} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} />
      <div className="dp-row">
        <label>First seed <input type="number" value={base} onChange={(e) => setBase(Number(e.target.value) || 1)} /></label>
        <button onClick={roll}>Roll 30</button>
      </div>
      {parseError && <p className="delve-error" role="alert">{parseError}</p>}
      {rolls && (
        <p className="dp-sum">
          {ok.length}/30 built · {rolls.length - ok.length} refused · mean rerolls {meanRerolls.toFixed(2)}
          <span className="dp-key"> <i className="piece" /> piece <i className="goal" /> goal <i className="safe" /> safe <i className="fight" /> fight
            <i className="locked-k" /> locked <i className="secret-k" /> secret</span>
        </p>
      )}
      <div className="dp-grid">
        {rolls?.map((r) => (
          <div key={r.seed} className="dp-card">
            <b>seed {r.seed}</b>
            {r.error ? <p className="delve-error">{r.error}</p> : (() => {
              const m = r.module!;
              const floors = Object.values(m.scenes).flatMap((s) => (s.kind === 'dungeon' ? [s.dungeon] : []));
              const shares = Object.values(m.scenes).flatMap((s) => {
                if (s.kind !== 'battle' || s.loot === false) return [];
                const enc = encounterFor(s.encounterId);
                return enc ? [adjustedXp(enc.members) / evenBudgetFor(level)] : [];
              });
              return (
                <>
                  {!m.blurb.startsWith('A generated') && <small className="muted">{m.blurb}</small>}
                  <small>{m.title} · {r.rerolls} rerolls · {floors.reduce((a, d) => a + d.rooms.length, 0)} rooms · levels {m.levelBand?.from}–{m.levelBand?.to}</small>
                  <small>{shares.length} fights, {(shares.reduce((a, x) => a + x, 0) / Math.max(1, shares.length)).toFixed(2)}× even on average (at the start level)</small>
                  {floors.map((d) => <FloorMap key={d.title} d={d} />)}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
