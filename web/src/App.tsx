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
import { logLinesFor, type LogLine } from './log.js';
import { sphere2x2, sphere5x5, cone15, cube15, line15 } from '../../src/engine/grid.js';
import { SPELLS, directionFromDelta } from '../../src/data/spells.js';
import { SPECIES } from '../../src/data/species.js';
import { STAGES } from '../../src/campaign/campaign.js';
import { Board, CellHighlight, tooltipFor } from './Board.js';
import { groupActions, buildMultiAction, posKey, describeShort, MultiTargetSpec, type BarEntry, type BarGroup, type TargetOption } from './actionGroups.js';
import { effectsFor, FloatEffect, CorpseEffect, BurstEffect, AreaEffect, ProjectileEffect } from './effects.js';
import { beatFor, narrate } from './pacing.js';
import { initAudio, isMuted, setMuted } from './sound.js';
import { CampaignScreen } from './Campaign.js';
import { AdventureScreen } from './Adventure.js';
import { savedAdventureModule, loadAdventureWeb, deleteAdventureWeb } from './adventureStorage.js';
import { loadCampaignWeb } from './campaignStorage.js';
import { playableModules } from '../../src/data/modules/index.js';
import type { Module } from '../../src/adventure/types.js';
import type { AdventureState } from '../../src/adventure/runtime.js';
import { hasSceneArt, sceneArtUrl } from './art.js';
import { artEmoji } from '../../src/data/adventure-art.js';
import { Portrait } from './Portrait.js';
import { SlotPips } from './SlotPips.js';

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

/**
 * The action bar shows one control per category, not per action, so it is the
 * same size at level 3 and level 20. Order runs most- to least-used: the skip
 * verbs sit last because they are, measurably, what nobody does — across 3,806
 * AI decisions, dodge 2.3%, dash 0.1%, disengage 0.0%.
 */
const CATEGORIES: Array<{ group: BarGroup; icon: string; name: string }> = [
  { group: 'spell', icon: '🔮', name: 'Spells' },
  { group: 'item', icon: '🎒', name: 'Items' },
  { group: 'skill', icon: '⭐', name: 'Skills' },
  { group: 'basic', icon: '⋯', name: 'More' },
];

/** Cells an area spell will actually cover, for the targeting preview. */
function footprint(caster: Combatant, spellId: string, target: Position): string[] {
  const kind = SPELLS[spellId]?.targeting.kind;
  if (kind === 'sphere2x2') return sphere2x2(target).map(posKey);
  if (kind === 'sphere5x5') return sphere5x5(target).map(posKey);
  if (kind === 'cone15' || kind === 'cube15' || kind === 'line15') {
    try {
      const dir = directionFromDelta(caster.position, target);
      const area = kind === 'cube15' ? cube15 : kind === 'line15' ? line15 : cone15;
      return area(caster.position, dir).map(posKey);
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
  | { view: 'campaign' }
  | { view: 'adventure'; module: Module; resume?: AdventureState };

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
    case 'adventure':
      return (
        <AdventureScreen
          Battle={Battle}
          module={screen.module}
          {...(screen.resume ? { resume: screen.resume } : {})}
          onExit={() => setScreen({ view: 'menu' })}
        />
      );
  }
}

/** The front door. Adventures lead; a saved run is offered as Continue; the
 *  classic modes sit quietly below. `?dev` reveals the test modules too. */
function Menu({ onPick }: { onPick(s: Screen): void }) {
  const [about, setAbout] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState<string | null>(null); // module id
  const dev = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');
  const modules = playableModules(dev);
  const savedId = savedAdventureModule();

  return (
    <div className="setup landing">
      <header className="landing-head">
        <h1>⚔️ The Free Company</h1>
        <p className="landing-tag">Tabletop adventures you can play on a laptop or a phone — solo, in your browser, free.</p>
        <div className="landing-badges">
          <span>📱 Plays anywhere</span>
          <span>🆓 Free &amp; open</span>
          <span>📜 SRD 5.2 · CC-BY</span>
        </div>
      </header>

      <div className="landing-modules">
        {modules.map((m) => {
          const resume = savedId === m.id ? loadAdventureWeb(m) : undefined;
          const play = (fresh?: boolean) => {
            initAudio();
            onPick({ view: 'adventure', module: m, ...(resume && !fresh ? { resume } : {}) });
          };
          const cover = m.cover;
          return (
            <div key={m.id} className="module-card">
              <button className="module-cover" onClick={() => play()} aria-label={`Play ${m.title}`}>
                {cover && hasSceneArt(cover)
                  ? <div className="module-cover-art" style={{ backgroundImage: `url(${sceneArtUrl(cover)})` }} />
                  : <div className="module-cover-art glyph"><span>{(cover && artEmoji(cover)) ?? '📜'}</span></div>}
                <div className="module-cover-body">
                  <strong>{m.title}{dev && !['hollow-road'].includes(m.id) ? ' · dev' : ''}</strong>
                  <span>{m.blurb}</span>
                  <span className="module-cta">{resume ? '▶ Continue your run' : '▶ Play'}</span>
                </div>
              </button>
              {resume && (
                <div className="module-actions">
                  {confirmWipe === m.id ? (
                    <>
                      <span className="muted">Erase your saved run and start fresh?</span>
                      <button className="mini danger" onClick={() => { deleteAdventureWeb(); setConfirmWipe(null); play(true); }}>Start over</button>
                      <button className="mini" onClick={() => setConfirmWipe(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="mini ghost" onClick={() => setConfirmWipe(m.id)}>↺ Start over</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="landing-more">
        <span className="landing-more-label">More ways to play</span>
        <div className="landing-more-row">
          <button className="landing-alt" onClick={() => onPick({ view: 'campaign' })}>
            🏰 Classic Campaign{loadCampaignWeb() ? ' · resume' : ''}
            <small>The pure {STAGES.length}-battle tactics ladder.</small>
          </button>
          <button className="landing-alt" onClick={() => onPick({ view: 'skirmish-setup' })}>
            ⚔️ Quick Battle
            <small>One custom fight, your party vs. anything.</small>
          </button>
        </div>
      </div>

      <button className="ghost landing-about-link" onClick={() => setAbout(true)}>About &amp; credits</button>

      {about && (
        <div className="overlay" onClick={() => setAbout(false)}>
          <div className="overlay-box about-box" onClick={(e) => e.stopPropagation()}>
            <h2>The Free Company</h2>
            <p>A little tactics-and-story RPG you can play in a browser, on a phone or a laptop. No account, no cost — your progress saves in this browser.</p>
            <p className="muted">Built on the <b>System Reference Document 5.2.1</b>, © Wizards of the Coast LLC, released under <b>CC-BY-4.0</b>. This game uses those rules with house rules where noted, and is not affiliated with or endorsed by Wizards of the Coast.</p>
            <p className="muted">Open source — <a href="https://github.com/brendanpshea/dnd_combat" target="_blank" rel="noreferrer">github.com/brendanpshea/dnd_combat</a>.</p>
            <button className="primary" onClick={() => setAbout(false)}>Close</button>
          </div>
        </div>
      )}
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
      theme={MAPS[config.mapId]?.theme}
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
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
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
  /** Younger-player mode: slower beats and narration on by default. */
  storyMode?: boolean;
  mapLabel: string;
  /** Visual theme of the map being fought on. */
  theme?: string | undefined;
  doneLabel: string;
  onExit(): void;
  onDone(winner: TeamId): void;
}

export function Battle({ combat, aiTeams, aiLevel = 'normal', storyMode = false, mapLabel, theme, doneLabel, onExit, onDone }: BattleProps) {
  const [version, setVersion] = useState(0);
  const [log, setLog] = useState<LogLine[]>(() => logLinesFor(combat.state, combat.log));
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [chooser, setChooser] = useState<{ target: Combatant; options: TargetOption[] } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [floats, setFloats] = useState<FloatEffect[]>([]);
  const [corpses, setCorpses] = useState<CorpseEffect[]>([]);
  const [bursts, setBursts] = useState<BurstEffect[]>([]);
  const [areas, setAreas] = useState<AreaEffect[]>([]);
  const [projectiles, setProjectiles] = useState<ProjectileEffect[]>([]);
  const [castingId, setCastingId] = useState<Id | undefined>(undefined);
  const [critFlash, setCritFlash] = useState(false);
  const [hitIds, setHitIds] = useState<Set<Id>>(new Set());
  const [movePaths, setMovePaths] = useState<Map<Id, Position[]>>(new Map());
  const [muted, setMutedState] = useState(isMuted());
  const [speed, setSpeed] = useState(1);
  /** Wall-clock time before which the AI must not act — see beatFor. */
  const dwellUntil = useRef(0);
  const [narration, setNarration] = useState<string | null>(null);
  const [tray, setTray] = useState<BarGroup | null>(null);
  // Default on: on a phone the log is hidden, so this is the only running
  // account of the fight. Story mode additionally slows the beats down.
  const [narrationOn, setNarrationOn] = useState(true);
  const [hint, setHint] = useState<Action | null>(null);
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('dnd-tutorial-seen'));
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
      setLog((l) => [...l, ...logLinesFor(combat.state, events)]);

      // Movement animation: tokens follow the actual path (around walls, past
      // allies) instead of sliding in a straight line through them.
      const paths = new Map<Id, Position[]>();
      for (const e of events) {
        if (e.type === 'moved' && e.path.length > 1) paths.set(e.combatantId, e.path);
      }
      setMovePaths(paths);

      // Hold the board still long enough to read what just happened. Story mode
      // lingers; the speed control divides it (and ⚡ removes it entirely).
      const pace = (storyMode ? 1.45 : 1) / speedRef.current;
      dwellUntil.current = performance.now() + beatFor(events) * pace;

      const headline = narrate(combat.state, events);
      if (headline) setNarration(headline);

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
      if (fx.bursts.length > 0) {
        setBursts((b) => [...b, ...fx.bursts]);
        const ids = new Set(fx.bursts.map((b) => b.id));
        setTimeout(() => setBursts((b) => b.filter((x) => !ids.has(x.id))), 900);
      }
      if (fx.areas.length > 0) {
        setAreas((a) => [...a, ...fx.areas]);
        const ids = new Set(fx.areas.map((a) => a.id));
        setTimeout(() => setAreas((a) => a.filter((x) => !ids.has(x.id))), 1100);
      }
      if (fx.projectiles.length > 0) {
        setProjectiles((p) => [...p, ...fx.projectiles]);
        const ids = new Set(fx.projectiles.map((p) => p.id));
        setTimeout(() => setProjectiles((p) => p.filter((x) => !ids.has(x.id))), 450);
      }
      if (fx.casterId !== undefined) {
        const id = fx.casterId;
        setCastingId(id);
        setTimeout(() => setCastingId((c) => (c === id ? undefined : c)), 450);
      }
      if (fx.critFlash) {
        setCritFlash(true);
        setTimeout(() => setCritFlash(false), 260);
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
      setLog((l) => [...l, { text: `(${(err as Error).message})`, kind: 'misc' }]);
    }
    setTargeting(null);
    setChooser(null);
    setHint(null);
    setVersion((v) => v + 1);
  }

  function dismissTutorial() {
    localStorage.setItem('dnd-tutorial-seen', '1');
    setShowTutorial(false);
  }

  /** The board cell a suggested action points at (for the hint highlight). */
  function hintCell(a: Action): string | undefined {
    if (a.kind === 'move') return posKey(a.to);
    if (a.kind === 'attack' || a.kind === 'shakeAwake') return posKey(state.combatants[a.targetId]!.position);
    if (a.kind === 'castSpell' || a.kind === 'useItem') {
      const t = a.targets?.[0];
      if (t && 'combatantId' in t) return posKey(state.combatants[t.combatantId]!.position);
      if (t && 'position' in t) return posKey(t.position);
    }
    return undefined;
  }

  /** Play a bar entry: fire it, or enter its targeting mode. */
  function runEntry(b: BarEntry) {
    setTray(null);
    if (b.action) apply(b.action);
    else if (b.cellTargets) {
      const first = [...b.cellTargets.values()][0];
      const spellId = first?.kind === 'castSpell' ? first.spellId : '';
      setTargeting({ type: 'cells', label: `${b.label} — tap a cell, tap again to cast`, spellId, byCell: b.cellTargets });
    } else if (b.multi) {
      setTargeting({ type: 'multi', label: `${b.label} — pick targets`, spec: b.multi, picked: [] });
    }
  }

  // AI turns wait out the beat owed by whatever just happened (see beatFor).
  // Any action sets that debt — including the player's own — so an enemy never
  // starts moving while your hit is still landing.
  //
  // The dependency list matters: this effect used to have none, so it re-ran on
  // every render and restarted its own timer. Unrelated state changes (a float
  // expiring, a class toggling) silently re-rolled the AI's clock, which is no
  // way to pace anything. `version` bumps once per applied action, which is
  // exactly when the AI should reconsider.
  useEffect(() => {
    if (combat.isOver() || !active || !aiTeams.has(active.team)) return;
    const wait = Math.max(0, dwellUntil.current - performance.now());
    const t = setTimeout(() => {
      apply(aiPolicy(aiLevel)(combat.state, combat.activeId));
    }, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, activeId, aiLevel]);

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
    // Resting state: only ring enemies you can attack (red) — allies are
    // still tappable for heals/potions, but not pre-highlighted (green shows
    // only once you're actively targeting an ally spell).
    for (const id of grouped.perTarget.keys()) {
      const c = state.combatants[id]!;
      if (c.team !== active.team) m.set(posKey(c.position), 'enemy');
    }
    if (hint) {
      const k = hintCell(hint);
      if (k) m.set(k, 'hint');
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, targeting, state, active, hint]);

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
      {critFlash && <div className="crit-flash" />}
      <header className="topbar">
        <button className="ghost" onClick={onExit}>✕</button>
        <span className="round">Round {state.round}</span>
        <span className="mapname">{mapLabel}</span>
        <button
          className="ghost"
          title="Enemy turn speed"
          onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 99 : 1))}
        >
          {speed === 1 ? '🐢 1×' : speed === 2 ? '🐇 2×' : '⚡ Instant'}
        </button>
        <button
          className={narrationOn ? 'ghost on' : 'ghost'}
          title={narrationOn ? 'Hide narration' : 'Show narration'}
          onClick={() => setNarrationOn((n) => !n)}
        >
          💬
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
        <button className="ghost log-toggle" onClick={() => setShowLog((s) => !s)}>
          📜 {showLog ? 'Hide' : 'Log'}
        </button>
        <button className="ghost" title="How to play" onClick={() => setShowTutorial(true)}>❓</button>
      </header>

      {/* The play area, grouped so the log can be a sibling column on desktop
          rather than a grid item spanning rows. Spanning meant inheriting one
          row-gap per row it crossed — ~780px of nothing, and the log ran off
          the bottom of the screen. */}
      <div className="battle-main">
      <Board
        state={state}
        activeId={activeId ?? ''}
        highlights={highlights}
        selectedId={activeId}
        multiCounts={multiCounts}
        movePaths={movePaths}
        theme={theme}
        floats={floats}
        bursts={bursts}
        areas={areas}
        projectiles={projectiles}
        castingId={castingId}
        corpses={corpses}
        hitIds={hitIds}
        onCellTap={onCellTap}
      />

      {/* Directly under the board: a fixed place to read what just happened,
          so following a fight never depends on watching the right cell. */}
      {narrationOn && (
        <div className="narration" key={narration ?? ''} aria-live="polite">
          {narration ?? ' '}
        </div>
      )}

      {active && (
        <div className="statusline" title={tooltipFor(active)}>
          <Portrait id={active.portraitId ?? active.classId} team={active.team} />
          <strong>{active.name}</strong>
          <span className={active.team}>{active.team === 'team1' ? 'Blue' : 'Red'}</span>
          <span>HP {active.hp}/{active.maxHp}</span>
          <span>AC {acOf(active)}</span>
          <SlotPips spellSlots={active.spellSlots} />
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

      {isHumanTurn && hint && !targeting && (
        <div className="hint-banner">
          💡 Suggestion: <b>{hint.kind === 'endTurn' ? 'end your turn' : describeShort(hint)}</b>
          <button className="mini" onClick={() => setHint(null)}>Dismiss</button>
        </div>
      )}

      {isHumanTurn && grouped && !targeting && (
        <div className="actionbar">
          <button
            className="hint-btn"
            title="Ask for a suggested move"
            onClick={() => setHint(aiPolicy('normal')(combat.state, combat.activeId))}
          >
            💡 Hint
          </button>
          {CATEGORIES.map(({ group, icon, name }) => {
            const entries = grouped.bar.filter((b) => b.group === group);
            if (entries.length === 0) return null;
            // A category holding one thing shouldn't cost a tap to open — show
            // the thing. Only 'basic' is always a tray: it's the shelf for the
            // rarely-used verbs, which is the point of putting them there.
            if (entries.length === 1 && group !== 'basic') {
              const only = entries[0]!;
              return (
                <button key={group} onClick={() => runEntry(only)}>
                  {only.icon ?? icon} {only.label}
                </button>
              );
            }
            return (
              <button key={group} className="category" onClick={() => setTray(group)}>
                {icon} {name} <span className="count">{entries.length}</span>
              </button>
            );
          })}
          <button className="endturn" onClick={() => apply({ kind: 'endTurn' })}>End turn ➤</button>
        </div>
      )}
      </div>

      {/* The tray: where a growing spell list lives, so the bar can't grow with
          it. Roughly two thirds of every spell is bar-bound, so a flat bar was
          fine at level 3 and hopeless by level 9. */}
      {isHumanTurn && grouped && tray && (
        <div className="tray-backdrop" onClick={() => setTray(null)}>
          <div className="tray" onClick={(e) => e.stopPropagation()}>
            <div className="tray-head">
              {CATEGORIES.find((c) => c.group === tray)?.icon}{' '}
              {CATEGORIES.find((c) => c.group === tray)?.name}
              <button className="ghost" onClick={() => setTray(null)}>✕</button>
            </div>
            <div className="tray-grid">
              {grouped.bar.filter((b) => b.group === tray).map((b) => (
                <button key={b.id} className="chip" onClick={() => runEntry(b)}>
                  {b.icon && <span className="chip-ico">{b.icon}</span>}
                  <span className="chip-label">{b.label}</span>
                  {b.note && <span className="chip-note">{b.note}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {chooser && (
        <div className="chooser" onClick={() => setChooser(null)}>
          <div className="chooser-box" onClick={(e) => e.stopPropagation()}>
            <div className="chooser-head">
              <Portrait id={chooser.target.portraitId ?? chooser.target.classId} team={chooser.target.team} big />
              <h3>{chooser.target.name}</h3>
            </div>
            {chooser.options.map((o, i) => (
              <button key={i} onClick={() => apply(o.action)}>
                {o.icon && <span className="opt-ico">{o.icon}</span>}
                {o.label}
              </button>
            ))}
            <button className="ghost" onClick={() => setChooser(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={`log ${showLog ? 'open' : ''}`}>
        {log.slice(-200).map((line, i) => (
          <div key={i} className={`logline ${line.kind} ${line.team ?? ''}`}>{line.text}</div>
        ))}
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

      {showTutorial && (
        <div className="overlay" onClick={dismissTutorial}>
          <div className="overlay-box tutorial" onClick={(e) => e.stopPropagation()}>
            <h2>⚔️ How to play</h2>
            <ul className="tut-list">
              <li>🔽 The <b>bobbing gold arrow</b> shows whose turn it is.</li>
              <li>🟦 Tap a <b>blue tile</b> to move your hero there.</li>
              <li>🟥 Tap a <b>red-ringed enemy</b> to attack it.</li>
              <li>✨ Use spells, potions, and abilities from the <b>action bar</b> at the bottom.</li>
              <li>💡 Stuck? Tap <b>Hint</b> for a suggested move.</li>
              <li>➤ Done? Tap <b>End turn</b>. Defeat all enemies to win!</li>
            </ul>
            <button className="primary" onClick={dismissTutorial}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
