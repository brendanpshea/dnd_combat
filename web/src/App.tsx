import { useEffect, useMemo, useRef, useState } from 'react';
import { Combat } from '../../src/engine/combat.js';
import type { Combatant, Id, Position, TeamId } from '../../src/engine/types.js';
import { buildParty } from '../../src/builder/character.js';
import { buildEncounter, ENCOUNTERS } from '../../src/data/monsters.js';
import { MAPS, MAP_IDS } from '../../src/data/maps.js';
import { acOf } from '../../src/data/armor.js';
import { chooseAction } from '../../src/ai/greedy.js';
import { chooseActionSim, SIM_PRESETS } from '../../src/ai/simulated.js';
import type { Action } from '../../src/engine/actions.js';
import { renderEvent } from '../../src/ui/cli/renderer.js';
import { sphere2x2, cone15 } from '../../src/engine/grid.js';
import { SPELLS, directionFromDelta } from '../../src/data/spells.js';
import { SPECIES } from '../../src/data/species.js';
import { Board, CellHighlight, tooltipFor } from './Board.js';
import { groupActions, buildMultiAction, posKey, MultiTargetSpec } from './actionGroups.js';
import { effectsFor, FloatEffect, CorpseEffect } from './effects.js';
import { initAudio, isMuted, setMuted } from './sound.js';
import { CampaignScreen } from './Campaign.js';
import { loadCampaignWeb } from './campaignStorage.js';

type Mode = 'hotseat' | 'vs-ai' | 'spectate' | 'encounter';
export type AiLevel = 'easy' | 'normal' | 'hard';

// Tiers ordered by measured arena strength: sim-easy < sim-normal < greedy.
// (See src/ui/cli/battle.ts for the full rationale.)
export function aiPolicy(level: AiLevel) {
  if (level === 'hard') return chooseAction;
  const opts = SIM_PRESETS[level];
  return (state: Parameters<typeof chooseAction>[0], id: Id) => chooseActionSim(state, id, opts);
}

interface SetupConfig {
  mode: Mode;
  mapId: string;
  level: number;
  encounterId: string;
  seed: number;
  aiLevel: AiLevel;
  speciesIds: Id[];
}

const PARTY_CLASS_IDS = ['fighter', 'wizard', 'cleric', 'rogue'] as const;

/** Cells an area spell will actually cover, for the targeting preview. */
function footprint(caster: Combatant, spellId: string, target: Position): string[] {
  const kind = SPELLS[spellId]?.targeting.kind;
  if (kind === 'sphere2x2') return sphere2x2(target).map(posKey);
  if (kind === 'cone15') {
    try {
      return cone15(caster.position, directionFromDelta(caster.position, target)).map(posKey);
    } catch {
      return [posKey(target)];
    }
  }
  return [posKey(target)]; // emptyCell (teleport), self
}

type Targeting =
  | { type: 'cells'; label: string; spellId: string; byCell: Map<string, Action>; preview?: Position | undefined }
  | { type: 'multi'; label: string; spec: MultiTargetSpec; picked: Id[] };

type Screen =
  | { view: 'menu' }
  | { view: 'skirmish-setup' }
  | { view: 'skirmish'; config: SetupConfig }
  | { view: 'campaign' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ view: 'menu' });
  switch (screen.view) {
    case 'menu':
      return <Menu onPick={setScreen} />;
    case 'skirmish-setup':
      return <Setup onStart={(config) => setScreen({ view: 'skirmish', config })} />;
    case 'skirmish':
      return (
        <Skirmish
          key={JSON.stringify(screen.config)}
          config={screen.config}
          onExit={() => setScreen({ view: 'menu' })}
        />
      );
    case 'campaign':
      return <CampaignScreen Battle={Battle} onExit={() => setScreen({ view: 'menu' })} />;
  }
}

function Menu({ onPick }: { onPick(s: Screen): void }) {
  const hasSave = !!loadCampaignWeb();
  return (
    <div className="setup">
      <h1>⚔️ D&D Grid Combat</h1>
      <button className="primary" onClick={() => onPick({ view: 'campaign' })}>
        🏰 Campaign{hasSave ? ' (resume)' : ''}
      </button>
      <button onClick={() => onPick({ view: 'skirmish-setup' })}>⚔️ Single battle</button>
      <p className="hint">
        Campaign: a persistent party fights a 4-battle ladder, shopping and
        looting between fights. Progress saves in your browser.
      </p>
    </div>
  );
}

function Skirmish({ config, onExit }: { config: SetupConfig; onExit(): void }) {
  const ref = useRef<{ combat: Combat; aiTeams: Set<TeamId> } | null>(null);
  if (!ref.current) ref.current = makeCombat(config);
  return (
    <Battle
      combat={ref.current.combat}
      aiTeams={ref.current.aiTeams}
      aiLevel={config.aiLevel}
      mapLabel={MAPS[config.mapId]?.name ?? ''}
      doneLabel="New battle"
      onExit={onExit}
      onDone={onExit}
    />
  );
}

function Setup({ onStart }: { onStart(c: SetupConfig): void }) {
  const [mode, setMode] = useState<Mode>('vs-ai');
  const [mapId, setMapId] = useState('ruins');
  const [level, setLevel] = useState(1);
  const [encounterId, setEncounterId] = useState('goblins');
  const [aiLevel, setAiLevel] = useState<AiLevel>('normal');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [speciesIds, setSpeciesIds] = useState<Id[]>(() => PARTY_CLASS_IDS.map(() => 'human'));

  return (
    <div className="setup">
      <h1>⚔️ D&D Grid Combat</h1>
      <label>
        Mode
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="hotseat">Hot-seat (2 players)</option>
          <option value="vs-ai">You vs AI</option>
          <option value="spectate">AI vs AI (watch)</option>
          <option value="encounter">Party vs monsters</option>
        </select>
      </label>
      {mode === 'encounter' && (
        <label>
          Encounter
          <select value={encounterId} onChange={(e) => setEncounterId(e.target.value)}>
            {Object.values(ENCOUNTERS).map((enc) => (
              <option key={enc.id} value={enc.id}>{enc.name} (lvl {enc.suggestedLevel})</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Map
        <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
          {MAP_IDS.map((id) => <option key={id} value={id}>{MAPS[id]!.name}</option>)}
        </select>
      </label>
      <label>
        Party level
        <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {mode !== 'hotseat' && (
        <label>
          AI difficulty
          <select value={aiLevel} onChange={(e) => setAiLevel(e.target.value as AiLevel)}>
            <option value="easy">Easy</option>
            <option value="normal">Normal</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      )}
      {PARTY_CLASS_IDS.map((classId, index) => (
        <label key={classId}>
          {classId[0]!.toUpperCase() + classId.slice(1)} species
          <select
            value={speciesIds[index]}
            onChange={(e) => setSpeciesIds((current) => current.map((id, i) => i === index ? e.target.value : id))}
          >
            {Object.values(SPECIES).map((species) => (
              <option key={species.id} value={species.id}>{species.name}</option>
            ))}
          </select>
        </label>
      ))}
      <label>
        Seed
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
        />
      </label>
      <button className="primary" onClick={() => onStart({ mode, mapId, level, encounterId, seed, aiLevel, speciesIds })}>
        Fight!
      </button>
    </div>
  );
}

function makeCombat(config: SetupConfig): { combat: Combat; aiTeams: Set<TeamId> } {
  const aiTeams = new Set<TeamId>();
  if (config.mode === 'vs-ai' || config.mode === 'spectate' || config.mode === 'encounter') aiTeams.add('team2');
  if (config.mode === 'spectate') aiTeams.add('team1');
  const team2 = config.mode === 'encounter'
    ? buildEncounter(config.encounterId, 'team2', 7)
    : buildParty('team2', 7, config.level, undefined, config.speciesIds);
  const combat = new Combat({
    seed: config.seed,
    mapId: config.mapId,
    combatants: [...buildParty('team1', 0, config.level, undefined, config.speciesIds), ...team2],
  });
  return { combat, aiTeams };
}

export interface BattleProps {
  combat: Combat;
  aiTeams: Set<TeamId>;
  aiLevel?: AiLevel;
  mapLabel: string;
  doneLabel: string;
  onExit(): void;
  onDone(winner: TeamId): void;
}

export function Battle({ combat, aiTeams, aiLevel = 'normal', mapLabel, doneLabel, onExit, onDone }: BattleProps) {
  const [, setVersion] = useState(0);
  const [log, setLog] = useState<string[]>(() =>
    combat.log.map((e) => renderEvent(combat.state, e)).filter((s): s is string => !!s));
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [chooser, setChooser] = useState<{ target: Combatant; options: Array<{ label: string; action: Action }> } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [floats, setFloats] = useState<FloatEffect[]>([]);
  const [corpses, setCorpses] = useState<CorpseEffect[]>([]);
  const [hitIds, setHitIds] = useState<Set<Id>>(new Set());
  const [movePaths, setMovePaths] = useState<Map<Id, Position[]>>(new Map());
  const [muted, setMutedState] = useState(isMuted());
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  speedRef.current = speed;
  const logEnd = useRef<HTMLDivElement>(null);

  const state = combat.state;
  const activeId = combat.isOver() ? undefined : combat.activeId;
  const active = activeId ? state.combatants[activeId] : undefined;
  const isHumanTurn = !!active && !aiTeams.has(active.team) && !combat.isOver();

  function apply(action: Action) {
    initAudio();
    try {
      const events = combat.apply(action);
      const lines = events.map((e) => renderEvent(combat.state, e)).filter((s): s is string => !!s);
      setLog((l) => [...l, ...lines]);

      // Movement animation: tokens follow the actual path (around walls, past
      // allies) instead of sliding in a straight line through them.
      const paths = new Map<Id, Position[]>();
      for (const e of events) {
        if (e.type === 'moved' && e.path.length > 1) paths.set(e.combatantId, e.path);
      }
      setMovePaths(paths);

      const fx = effectsFor(combat.state, events);
      if (fx.floats.length > 0) {
        setFloats((f) => [...f, ...fx.floats]);
        const ids = new Set(fx.floats.map((f) => f.id));
        setTimeout(() => setFloats((f) => f.filter((x) => !ids.has(x.id))), 1600);
      }
      if (fx.corpses.length > 0) {
        setCorpses((c) => [...c, ...fx.corpses]);
        const ids = new Set(fx.corpses.map((c) => c.id));
        setTimeout(() => setCorpses((c) => c.filter((x) => !ids.has(x.id))), 1800);
      }
      if (fx.hits.length > 0) {
        setHitIds((h) => new Set([...h, ...fx.hits]));
        setTimeout(() => setHitIds((h) => {
          const next = new Set(h);
          for (const id of fx.hits) next.delete(id);
          return next;
        }), 450);
      }
    } catch (err) {
      setLog((l) => [...l, `(${(err as Error).message})`]);
    }
    setTargeting(null);
    setChooser(null);
    setVersion((v) => v + 1);
  }

  // AI turns, paced by what the action is so effects can land.
  useEffect(() => {
    if (combat.isOver() || !active || !aiTeams.has(active.team)) return;
    const action = aiPolicy(aiLevel)(combat.state, combat.activeId);
    const base =
      action.kind === 'move' ? 550 :
      action.kind === 'endTurn' ? 350 :
      action.kind === 'attack' || action.kind === 'castSpell' || action.kind === 'useItem' ? 1000 :
      700;
    const t = setTimeout(() => apply(action), base / speedRef.current);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const grouped = useMemo(
    () => (isHumanTurn && activeId ? groupActions(state, activeId, combat.legalActions()) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isHumanTurn, activeId, log],
  );

  const highlights = useMemo(() => {
    const m = new Map<string, CellHighlight>();
    if (!grouped || !active) return m;
    if (targeting?.type === 'cells') {
      for (const k of targeting.byCell.keys()) m.set(k, 'cell-target');
      // Previewing a placement: light up the full footprint it will hit.
      if (targeting.preview) {
        for (const k of footprint(active, targeting.spellId, targeting.preview)) m.set(k, 'aoe');
      }
      return m;
    }
    if (targeting?.type === 'multi') {
      for (const id of targeting.spec.validIds) {
        const c = state.combatants[id]!;
        m.set(posKey(c.position), c.team === active.team ? 'ally' : 'enemy');
      }
      return m;
    }
    for (const k of grouped.moves.keys()) m.set(k, 'move');
    for (const id of grouped.perTarget.keys()) {
      const c = state.combatants[id]!;
      m.set(posKey(c.position), c.team === active.team ? 'ally' : 'enemy');
    }
    return m;
  }, [grouped, targeting, state, active]);

  const multiCounts = useMemo(() => {
    if (targeting?.type !== 'multi') return undefined;
    const m = new Map<Id, number>();
    for (const id of targeting.picked) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [targeting]);

  function onCellTap(pos: Position, occ?: Combatant) {
    if (!grouped || !isHumanTurn) return;
    setChooser(null);
    const key = posKey(pos);

    if (targeting?.type === 'cells') {
      const a = targeting.byCell.get(key);
      if (!a) { setTargeting(null); return; }
      // Two-phase: first tap previews the footprint, a second tap on the same
      // cell (or the Confirm button) casts — so the 2x2 / cone is visible.
      if (targeting.preview && posKey(targeting.preview) === key) apply(a);
      else setTargeting({ ...targeting, preview: pos });
      return;
    }
    if (targeting?.type === 'multi') {
      const spec = targeting.spec;
      if (occ && spec.validIds.has(occ.id) && (spec.allowRepeats || !targeting.picked.includes(occ.id))) {
        const picked = [...targeting.picked, occ.id];
        if (picked.length >= spec.maxTargets) apply(buildMultiAction(spec, picked));
        else setTargeting({ ...targeting, picked });
      }
      return;
    }
    if (occ && grouped.perTarget.has(occ.id)) {
      // Always confirm via the chooser — even a single option — so the player
      // sees what they're about to do and can back out.
      setChooser({ target: occ, options: grouped.perTarget.get(occ.id)! });
      return;
    }
    const move = grouped.moves.get(key);
    if (move) apply(move);
  }

  const winner = combat.winner();

  return (
    <div className="battle">
      <header className="topbar">
        <button className="ghost" onClick={onExit}>✕</button>
        <span className="round">Round {state.round}</span>
        <span className="mapname">{mapLabel}</span>
        <button
          className="ghost"
          title="AI speed"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
        >
          {speed === 1 ? '🐢 1×' : '🐇 2×'}
        </button>
        <button
          className="ghost"
          title={muted ? 'Unmute' : 'Mute'}
          onClick={() => {
            initAudio();
            setMuted(!muted);
            setMutedState(!muted);
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="ghost" onClick={() => setShowLog((s) => !s)}>
          📜 {showLog ? 'Hide' : 'Log'}
        </button>
      </header>

      <Board
        state={state}
        activeId={activeId ?? ''}
        highlights={highlights}
        selectedId={activeId}
        multiCounts={multiCounts}
        movePaths={movePaths}
        floats={floats}
        corpses={corpses}
        hitIds={hitIds}
        onCellTap={onCellTap}
      />

      {active && (
        <div className="statusline" title={tooltipFor(active)}>
          <strong>{active.name}</strong>
          <span className={active.team}>{active.team === 'team1' ? 'Blue' : 'Red'}</span>
          <span>HP {active.hp}/{active.maxHp}</span>
          <span>AC {acOf(active)}</span>
          <span>{active.turn.actionUsed ? '·' : 'A'}{active.turn.bonusActionUsed ? '·' : 'B'}</span>
          <span>{active.turn.movementMax - active.turn.movementUsed}ft</span>
          {!isHumanTurn && !combat.isOver() && <em className="thinking">AI thinking…</em>}
        </div>
      )}

      {targeting && (
        <div className="targeting-banner">
          {targeting.label}
          {targeting.type === 'multi' && (
            <>
              <span> ({targeting.picked.length}/{targeting.spec.maxTargets})</span>
              {targeting.picked.length > 0 && (
                <button className="mini" onClick={() => apply(buildMultiAction(targeting.spec, targeting.picked))}>
                  Cast now
                </button>
              )}
            </>
          )}
          {targeting.type === 'cells' && targeting.preview && (
            <button className="mini" onClick={() => apply(targeting.byCell.get(posKey(targeting.preview!))!)}>
              Cast here
            </button>
          )}
          <button className="mini" onClick={() => setTargeting(null)}>Cancel</button>
        </div>
      )}

      {isHumanTurn && grouped && !targeting && (
        <div className="actionbar">
          {grouped.bar.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                if (b.action) apply(b.action);
                else if (b.cellTargets) {
                  const spellId = [...b.cellTargets.values()][0]?.kind === 'castSpell'
                    ? ([...b.cellTargets.values()][0] as { spellId: string }).spellId : '';
                  setTargeting({ type: 'cells', label: `${b.label} — tap a cell, tap again to cast`, spellId, byCell: b.cellTargets });
                }
                else if (b.multi) setTargeting({ type: 'multi', label: `${b.label} — pick targets`, spec: b.multi, picked: [] });
              }}
            >
              {b.label}
            </button>
          ))}
          <button className="endturn" onClick={() => apply({ kind: 'endTurn' })}>End turn ➤</button>
        </div>
      )}

      {chooser && (
        <div className="chooser" onClick={() => setChooser(null)}>
          <div className="chooser-box" onClick={(e) => e.stopPropagation()}>
            <h3>{chooser.target.name}</h3>
            {chooser.options.map((o, i) => (
              <button key={i} onClick={() => apply(o.action)}>{o.label}</button>
            ))}
            <button className="ghost" onClick={() => setChooser(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={`log ${showLog ? 'open' : ''}`}>
        {log.slice(-200).map((line, i) => <div key={i} className="logline">{line}</div>)}
        <div ref={logEnd} />
      </div>

      {winner && (
        <div className="overlay">
          <div className="overlay-box">
            <h2>{winner === 'team1' ? '🔵 Blue team wins!' : '🔴 Red team wins!'}</h2>
            <button className="primary" onClick={() => onDone(winner)}>{doneLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
