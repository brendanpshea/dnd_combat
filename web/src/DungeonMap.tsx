/**
 * The dungeon screen: the map is the interface.
 *
 * Every room the party knows of is drawn where `layoutDungeon` put it; a tap
 * walks there (across rooms already seen, in one go). A room it has only
 * glimpsed through a doorway is an outline with no name. State is marks, not
 * words — 🔒 on a shut door, ❗ where a fight was left standing, 📦 where a
 * search is still owed, 🚪 at a way out — and a reason appears only when the
 * player taps something that will not open. The one line of text that stays
 * on screen is where the party is standing.
 */
import { useMemo, useState } from 'react';
import type { Module, Scene } from '../../src/adventure/types.js';
import { layoutDungeon, linkKey, ROOM_BOX } from '../../src/adventure/dungeon.js';
import {
  type AdventureState, type AdventureEvent,
  dungeonProgress, dungeonExits, dungeonRoute, walkTo, canSearch, searchRoom, forceDoor,
  dungeonExitHere, leaveDungeon, travelDestinations, campRule,
} from '../../src/adventure/runtime.js';
import { SKILL_LABEL, type SkillId } from '../../src/data/classes.js';

/** Layout cell → map units. Wider than tall: room names run across. */
const PX = 150;
const PY = 110;
const PAD = 36;

interface Props {
  scene: Extract<Scene, { kind: 'dungeon' }>;
  state: AdventureState;
  module: Module;
  onAct: (events: AdventureEvent[]) => void;
  onRest: () => void;
  onTravel: (sceneId: string) => void;
}

/** Split a room name over at most two lines. */
function lines(name: string, max = 13): string[] {
  if (name.length <= max) return [name];
  const words = name.split(' ');
  let a = '';
  while (words.length && (a + ' ' + words[0]).trim().length <= max) a = (a + ' ' + words.shift()).trim();
  return a ? [a, words.join(' ')] : [name];
}

export function DungeonMap({ scene, state, module, onAct, onRest, onTravel }: Props) {
  const d = scene.dungeon;
  const layout = useMemo(() => layoutDungeon(d), [d]);
  const [note, setNote] = useState<{ room: string; text: string; force?: { skill: string; dc: number; link: string } } | null>(null);

  const p = dungeonProgress(state, scene.id, d);
  const here = p.at;
  const seen = new Set(p.seen);
  const visibleLink = (l: (typeof d.links)[number]) => !l.door?.secret || p.revealed.includes(linkKey(l));
  // Known: seen, or next door to a seen room through a door the party can see.
  const known = new Set(seen);
  for (const l of d.links) {
    if (!visibleLink(l)) continue;
    if (seen.has(l.a)) known.add(l.b);
    if (seen.has(l.b)) known.add(l.a);
  }
  const exits = dungeonExits(state, module);
  const shut = new Map(exits.filter((x) => x.blocked).map((x) => [x.link, x]));

  const W = layout.cols * PX + PAD * 2;
  const H = layout.rows * PY + PAD * 2;
  const centre = (id: string): [number, number] => {
    const [c, r] = layout.cells[id] ?? [0, 0];
    return [PAD + c * PX + PX / 2, PAD + r * PY + PY / 2];
  };
  const pt = ([c, r]: [number, number]) => `${PAD + c * PX + PX / 2},${PAD + r * PY + PY / 2}`;

  function tap(roomId: string) {
    setNote(null);
    if (roomId === here) return;
    const name = d.rooms.find((r) => r.id === roomId)?.name ?? '';
    if (dungeonRoute(state, module, roomId)) { onAct(walkTo(state, module, roomId)); return; }
    const x = exits.find((e) => e.to === roomId);
    if (x?.blocked) {
      setNote({ room: roomId, text: x.blocked, ...(x.force ? { force: { ...x.force, link: x.link } } : {}) });
      return;
    }
    setNote({ room: roomId, text: seen.has(roomId) ? `No way to ${name} from here.` : 'No way there from here — yet.' });
  }

  const room = d.rooms.find((r) => r.id === here)!;
  const exitHere = dungeonExitHere(state, module);
  const travel = exitHere ? travelDestinations(state, module) : [];
  const camp = campRule(state, module);

  return (
    <div className="dg">
      <div className="dg-head">
        <span className="dg-title">{d.title}</span>
        {d.torch && p.torch !== undefined && (
          <span className="dg-torch" title={`Torch: ${p.torch} of ${d.torch.length}`}>
            🔥
            <span className="dg-pips" aria-label={`torch ${p.torch} of ${d.torch.length}`}>
              {Array.from({ length: d.torch.length }, (_, i) => <i key={i} className={i < p.torch! ? 'lit' : ''} />)}
            </span>
          </span>
        )}
      </div>

      <div className="dg-map">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Map of ${d.title}`}>
          <defs>
            <pattern id="dg-fog" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <line x1="0" y1="0" x2="0" y2="10" stroke="#ffffff10" strokeWidth="3" />
            </pattern>
            <marker id="dg-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#cbb994" />
            </marker>
          </defs>

          {d.links.map((l) => {
            const key = linkKey(l);
            const path = layout.corridors[key];
            if (!path || !visibleLink(l) || !known.has(l.a) || !known.has(l.b)) return null;
            const walked = seen.has(l.a) && seen.has(l.b);
            const secret = !!l.door?.secret;
            const cls = `dg-corr${walked ? ' walked' : ' glimpsed'}${secret ? ' secret' : ''}`;
            const mid = path.length > 2 ? path[Math.floor(path.length / 2)]! : null;
            const [ax, ay] = centre(l.a); const [bx, by] = centre(l.b);
            const [mx, my] = mid ? [PAD + mid[0] * PX + PX / 2, PAD + mid[1] * PY + PY / 2] : [(ax + bx) / 2, (ay + by) / 2];
            return (
              <g key={key}>
                <polyline points={path.map(pt).join(' ')} className={cls} {...(l.door?.oneWay ? { markerMid: 'url(#dg-arrow)' } : {})} />
                {l.door?.oneWay && path.length === 2 && (
                  <polyline points={`${ax},${ay} ${mx},${my} ${bx},${by}`} className="dg-corr-arrow" markerMid="url(#dg-arrow)" />
                )}
                {shut.has(key) && (
                  <text x={mx} y={my + 6} className="dg-mark" textAnchor="middle"
                    onClick={() => tap(l.a === here ? l.b : l.a)}>🔒</text>
                )}
              </g>
            );
          })}

          {d.rooms.map((r) => {
            if (!known.has(r.id)) return null;
            const [cx, cy] = centre(r.id);
            const box = ROOM_BOX[r.size ?? 'medium'];
            const w = box.w * PX; const h = box.h * PY;
            const isHere = r.id === here;
            const wasSeen = seen.has(r.id);
            const marks: string[] = [];
            if (wasSeen && r.fight && !p.cleared.includes(r.id)) marks.push('❗');
            if (wasSeen && r.search && !p.searched.includes(r.id)) marks.push('📦');
            if (wasSeen && r.exit) marks.push('🚪');
            const name = lines(r.name);
            return (
              <g key={r.id} className={`dg-room${isHere ? ' here' : ''}${wasSeen ? ' seen' : ' glimpsed'}${note?.room === r.id ? ' noted' : ''}`}
                onClick={() => tap(r.id)} role="button" aria-label={wasSeen ? r.name : 'Unexplored room'}>
                <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9} />
                {!wasSeen && <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9} fill="url(#dg-fog)" className="fog" />}
                {wasSeen && name.map((ln, i) => (
                  <text key={i} x={cx} y={cy + (i - (name.length - 1) / 2) * 17 + 6} textAnchor="middle" className="dg-name">{ln}</text>
                ))}
                {marks.length > 0 && (
                  <text x={cx + w / 2 - 4} y={cy - h / 2 + 4} textAnchor="end" className="dg-mark small">{marks.join('')}</text>
                )}
              </g>
            );
          })}
        </svg>

        {note && (
          <div className="dg-note" role="status">
            <span>{note.text.startsWith('No way') ? '' : '🔒 '}{note.text}</span>
            {note.force && (
              <button className="mini" onClick={() => { const f = note.force!; setNote(null); onAct(forceDoor(state, module, f.link)); }}>
                Force it · {SKILL_LABEL[note.force.skill as SkillId] ?? note.force.skill} DC {note.force.dc}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="dg-bar">
        <span className="dg-here">📍 <b>{room.name}</b></span>
        {canSearch(state, module) && (
          <button className="dg-act" onClick={() => { setNote(null); onAct(searchRoom(state, module)); }}>🔍 Search</button>
        )}
        {camp && <button className="dg-act" onClick={onRest}>🏕️ Rest</button>}
        {exitHere && (
          <button className="dg-act" onClick={() => { setNote(null); onAct(leaveDungeon(state, module)); }}>🚪 {exitHere.label}</button>
        )}
      </div>
      {travel.length > 0 && (
        <div className="dg-travel">
          {travel.map((t) => (
            <button key={t.sceneId} className="adv-travel-dest" onClick={() => onTravel(t.sceneId)}>
              {t.isTown ? '🏘️ ' : '📍 '}{t.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
