import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Combat } from '../../src/engine/combat.js';
import type { Combatant, Id, Position, TeamId } from '../../src/engine/types.js';
import { actsOnItsOwn } from '../../src/engine/rules/summon.js';
import { coverReadAt, coverReadFor, type CoverRead } from '../../src/engine/rules/cover.js';
import { worstCaseWalkDamage } from '../../src/engine/rules/movement.js';
import { buildParty, DEFAULT_PARTY } from '../../src/builder/character.js';
import { CLASSES } from '../../src/data/classes.js';
import { buildEncounter, ENCOUNTERS } from '../../src/data/encounters.js';
import { MAPS, MAP_IDS, farRank } from '../../src/data/maps.js';
import { acOf } from '../../src/data/armor.js';
import { chooseAction } from '../../src/ai/greedy.js';
import { chooseActionSim, SIM_PRESETS } from '../../src/ai/simulated.js';
import type { Action } from '../../src/engine/actions.js';
import { logLinesFor, type LogLine } from './log.js';
import { sphere2x2, sphere5x5, cone15, cube15, line15 } from '../../src/engine/grid.js';
import { SPELLS, directionFromDelta } from '../../src/data/spells.js';
import { SPECIES } from '../../src/data/species.js';
import { CLASS_COUNT, SPECIES_COUNT, SPELL_COUNT, MONSTER_COUNT } from './contentCounts.js';
import { STAGES } from '../../src/campaign/campaign.js';
import { Board, CellHighlight, tooltipFor } from './Board.js';
import { groupActions, buildMultiAction, bendTray, posKey, describeShort, MultiTargetSpec, type BarEntry, type BarGroup, type TargetOption } from './actionGroups.js';
import { affordableMetamagic, type MetamagicId } from '../../src/engine/rules/metamagic.js';
import { effectsFor, FloatEffect, CorpseEffect, BurstEffect, AreaEffect, ProjectileEffect } from './effects.js';
import { beatFor, narrate } from './pacing.js';
import { initAudio, isMuted, setMuted } from './sound.js';
import { detectTips, seenTips, markTipSeen, tipsOff, setTipsOff, type Tip } from './tips.js';
import { makeTrainingCombat, TRAINING_COACH, type CoachStep } from './training.js';
import { CampaignScreen } from './Campaign.js';
import { ArenaScreen } from './Arena.js';
import { AdventureScreen } from './Adventure.js';
import { savedAdventureModule, loadAdventureWeb, deleteAdventureWeb } from './adventureStorage.js';
import { completedModules } from './adventureProgress.js';
import { moduleChains, chapterStates, currentChapter } from '../../src/adventure/chain.js';
import { loadCampaignWeb, campaignLoadProblem } from './campaignStorage.js';
import { loadArenaWeb, deleteArenaWeb, arenaLoadProblem } from './arenaStorage.js';
import { classLook } from './classLook.js';
import { playableModules } from '../../src/data/modules/index.js';
import type { Module } from '../../src/adventure/types.js';
import type { AdventureState } from '../../src/adventure/runtime.js';
import { hasSceneArt, sceneArtUrl, hasSpellIcon, spellIconUrl, boardBgUrl, HAS_BOARD_BG, tokenUrl, hasArt, thumbUrl } from './art.js';
import { artEmoji } from '../../src/data/adventure-art.js';
import { Portrait } from './Portrait.js';
import { SlotPips } from './SlotPips.js';
import { FeaturePips } from './FeaturePips.js';
import { CharacterSheet } from './CharacterSheet.js';

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
  classIds: Id[];
}


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

/** "Quickened Spell" -> "quickened", for the empty-tray line. */
const METAMAGIC_LABEL: Record<MetamagicId, string> = {
  quickened: 'quickened', heightened: 'heightened', empowered: 'empowered',
};

type Targeting =
  | { type: 'cells'; label: string; spellId: string; byCell: Map<string, Action>; preview?: Position | undefined }
  | { type: 'multi'; label: string; spec: MultiTargetSpec; picked: Id[] };

type Screen =
  | { view: 'menu' }
  | { view: 'skirmish-setup' }
  | { view: 'skirmish'; config: SetupConfig }
  | { view: 'training' }
  | { view: 'campaign' }
  | { view: 'arena' }
  | { view: 'adventure'; module: Module; resume?: AdventureState };

export function App() {
  const [screen, setScreen] = useState<Screen>({ view: 'menu' });
  switch (screen.view) {
    case 'menu':
      return <Menu onPick={setScreen} />;
    case 'skirmish-setup':
      return <Setup onStart={(config) => setScreen({ view: 'skirmish', config })} />;
    case 'training':
      return <TrainingYard onExit={() => setScreen({ view: 'menu' })} />;
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
    case 'arena':
      return <ArenaScreen Battle={Battle} onExit={() => setScreen({ view: 'menu' })} />;
    case 'adventure':
      return (
        <AdventureScreen
          Battle={Battle}
          module={screen.module}
          {...(screen.resume ? { resume: screen.resume } : {})}
          onExit={() => setScreen({ view: 'menu' })}
          onContinue={(module, resume) => setScreen({ view: 'adventure', module, resume })}
        />
      );
  }
}

/** The front door. Adventures lead; a saved run is offered as Continue; the
 *  classic modes sit quietly below. `?dev` reveals the test modules too. */
function Menu({ onPick }: { onPick(s: Screen): void }) {
  const [about, setAbout] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState<string | null>(null); // module id
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const dev = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');
  const modules = playableModules(dev);
  const savedId = savedAdventureModule();
  const completed = completedModules();
  // One card per campaign, not per chapter. The story is a chain of three that
  // share a party, so three peer cards misdescribed it — and the page grew by
  // 318px every time a chapter was written. Chapters live inside the card.
  const chains = moduleChains(modules);
  const storyChain = chains.find((c) => c.length > 1) ?? chains[0] ?? [];
  const loose = chains.filter((c) => c !== storyChain).flat();
  const states = chapterStates(storyChain, completed, savedId);
  const at = currentChapter(storyChain, completed, savedId);

  // A save that cannot be opened used to read as no save at all: the screen
  // simply offered a fresh start and the player was never told their party had
  // been there. Whatever else goes wrong, being told is the minimum.
  const saveProblems = [arenaLoadProblem(), campaignLoadProblem()].filter(Boolean);

  return (
    <div className="setup landing">
      {saveProblems.length > 0 && (
        <div className="save-warning" role="status">
          ⚠️ {saveProblems[0]}
        </div>
      )}
      <header className="landing-head">
        <h1>⚔️ The Free Company</h1>
        <p className="landing-tag">The fifth-edition tabletop rules you already know — solo, in your browser, free.</p>
        <div className="landing-badges">
          <span>📱 Plays anywhere</span>
          <span>🆓 Free &amp; open</span>
          <span>⚔️ {CLASS_COUNT} classes · {SPECIES_COUNT} ancestries</span>
          <span>🐉 {SPELL_COUNT} spells · {MONSTER_COUNT} monsters</span>
        </div>
        <p className="landing-legal">
          Built on the <b>Dungeons &amp; Dragons</b> SRD 5.2, released free under Creative Commons —
          not affiliated with or endorsed by Wizards of the Coast.
        </p>
      </header>

      {/* The tutorial, first. It sat fifth, 1,769px down — you reached
          "New to this?" only after scrolling past three chapters and the
          arena, which is to say after you had already answered it. */}
      <button className="landing-learn" onClick={() => { initAudio(); onPick({ view: 'training' }); }}>
        🎓 New to this? Learn the basics
        <small>A quick guided battle — move, attack, win. Two minutes, no setup.</small>
      </button>

      <div className="landing-section">
        <span className="landing-section-label">The story campaign</span>
        {storyChain.length > 0 && (() => {
          const m = storyChain[at]!;
          const resume = savedId === m.id ? loadAdventureWeb(m) : undefined;
          const cover = m.cover;
          const play = (fresh?: boolean) => {
            initAudio();
            onPick({ view: 'adventure', module: m, ...(resume && !fresh ? { resume } : {}) });
          };
          // Starting fresh would overwrite the one save slot, and the company
          // in it may have walked two chapters to get there.
          const wouldOverwrite = !!savedId && savedId !== m.id;
          const done = completed.size;
          return (
            <div className={`module-card${resume ? ' resuming' : ''}`}>
              <button
                className="module-cover"
                onClick={() => (wouldOverwrite ? setConfirmWipe(m.id) : play())}
                aria-label={`Play ${m.title}`}
              >
                {cover && hasSceneArt(cover)
                  ? <div className="module-cover-art" style={{ backgroundImage: `url(${thumbUrl(sceneArtUrl(cover))})` }} />
                  : <div className="module-cover-art glyph"><span>{(cover && artEmoji(cover)) ?? '📜'}</span></div>}
                <div className="module-cover-body">
                  <span className="module-band">
                    Chapter {at + 1} of {storyChain.length}
                    {m.levelBand ? ` · Levels ${m.levelBand.from}–${m.levelBand.to}` : ''}
                  </span>
                  <strong>{m.title}</strong>
                  <span>{m.blurb}</span>
                  <span className="module-cta">
                    {resume ? '▶ Continue your run' : done ? '▶ Play this chapter' : '▶ Begin the story'}
                  </span>
                </div>
              </button>

              {(resume || confirmWipe === m.id) && (
                <div className="module-actions">
                  {confirmWipe === m.id ? (
                    <>
                      <span className="muted">
                        {wouldOverwrite
                          ? `Your company is saved at ${storyChain.find((x) => x.id === savedId)?.title}. Starting here abandons them and rolls a new level-1 party.`
                          : 'Erase your saved run and start fresh?'}
                      </span>
                      <button className="mini danger" onClick={() => { deleteAdventureWeb(); setConfirmWipe(null); play(true); }}>
                        {wouldOverwrite ? 'Abandon them' : 'Start over'}
                      </button>
                      <button className="mini" onClick={() => setConfirmWipe(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="mini ghost" onClick={() => setConfirmWipe(m.id)}>↺ Start over</button>
                  )}
                </div>
              )}

              {/* The other chapters, folded away. A locked one is shown rather
                  than hidden: knowing the story continues is the point, and a
                  chapter that simply appears one day reads as a bug. */}
              {storyChain.length > 1 && (
                <div className="chapter-list">
                  <button className="chapter-toggle" onClick={() => setChaptersOpen((v) => !v)}>
                    {chaptersOpen ? '⌃' : '⌄'} Chapters ({completed.size}/{storyChain.length} finished)
                  </button>
                  {chaptersOpen && storyChain.map((ch, i) => {
                    const state = states[i]!;
                    const here = i === at;
                    return (
                      <button
                        key={ch.id}
                        className={`chapter-row ${state}${here ? ' here' : ''}`}
                        disabled={state === 'locked'}
                        onClick={() => {
                          if (state === 'locked') return;
                          if (savedId && savedId !== ch.id) { setConfirmWipe(ch.id); return; }
                          initAudio();
                          const r = savedId === ch.id ? loadAdventureWeb(ch) : undefined;
                          onPick({ view: 'adventure', module: ch, ...(r ? { resume: r } : {}) });
                        }}
                      >
                        <span className="chapter-mark">
                          {state === 'done' ? '✓' : state === 'locked' ? '🔒' : here ? '▸' : '·'}
                        </span>
                        <span className="chapter-name">{i + 1}. {ch.title}</span>
                        <span className="chapter-note">
                          {state === 'locked'
                            ? 'Finish the chapter before it'
                            : ch.levelBand ? `Levels ${ch.levelBand.from}–${ch.levelBand.to}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="landing-section">
        <span className="landing-section-label">Endless</span>
        <ArenaCard onPick={onPick} />
      </div>

      {/* The two modes that are not shipping. `import.meta.env.DEV` rather
          than the `?dev` URL flag, because a flag is something you can be sent
          a link to: these are gone from a production build entirely, and the
          branch is dead code the bundler drops. `?dev` still reveals the test
          MODULES, which do want to be reachable on a deployed build. */}
      {(import.meta.env.DEV || loose.length > 0) && (
        <div className="landing-more">
          <span className="landing-more-label">{import.meta.env.DEV ? 'Dev builds only' : 'Test modules'}</span>
          <div className="landing-more-row">
            {import.meta.env.DEV && (<>
            <button className="landing-alt" onClick={() => onPick({ view: 'campaign' })}>
              🏰 Classic Campaign{loadCampaignWeb() ? ' · resume' : ''}
              <small>The pure {STAGES.length}-battle tactics ladder.</small>
            </button>
            <button className="landing-alt" onClick={() => onPick({ view: 'skirmish-setup' })}>
              ⚔️ Quick Battle
              <small>One custom fight, your party vs. anything.</small>
            </button>
            </>)}
            {loose.map((m) => (
              <button key={m.id} className="landing-alt" onClick={() => { initAudio(); onPick({ view: 'adventure', module: m }); }}>
                🧪 {m.title}
                <small>Test module.</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="ghost landing-about-link" onClick={() => setAbout(true)}>About &amp; credits</button>

      {about && (
        <div className="overlay" onClick={() => setAbout(false)}>
          <div className="overlay-box about-box" onClick={(e) => e.stopPropagation()}>
            <h2>The Free Company</h2>
            <p>A little tactics-and-story RPG that runs on the fifth-edition <b>Dungeons &amp; Dragons</b> rules — play it in a browser, on a phone or a laptop. No account, no cost; your progress saves in this browser.</p>
            <p className="muted">Inside: {CLASS_COUNT} classes, {SPECIES_COUNT} ancestries, {SPELL_COUNT} spells, and {MONSTER_COUNT} monsters, plus the full skill and grid-combat rules — all drawn from the SRD.</p>
            <p className="muted">Built on the <b>System Reference Document 5.2.1</b>, © Wizards of the Coast LLC, released under <b>CC-BY-4.0</b>. This game uses those rules with house rules where noted, and is not affiliated with or endorsed by Wizards of the Coast.</p>
            <p className="muted">Open source — <a href="https://github.com/brendanpshea/dnd_combat" target="_blank" rel="noreferrer">github.com/brendanpshea/dnd_combat</a>.</p>
            <button className="primary" onClick={() => setAbout(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Faces for the arena cover: one per creature type, chosen to read at 64px
 *  and to look like a line-up rather than a family. */
const ARENA_FACES = [
  'wight', 'ogre', 'owlbear', 'red-wyrmling', 'gladiator', 'gorgon', 'fire-elemental',
];

/**
 * The Arena, as a peer of the story chapters rather than a line in a
 * "more ways to play" list.
 *
 * It deliberately reuses the module card's markup and classes instead of
 * getting its own component. Two reasons: the rail then reads as one list of
 * things you can play, and every behaviour the chapters already have — the
 * gold resume frame, the hover lift, the start-over confirm — comes along
 * without being rebuilt. The `endless` modifier is the only new styling, and
 * it exists to say "this one has no ending", not to make it look like a
 * different product.
 *
 * What replaces the level band is the point of the mode: a chapter says
 * "Levels 1–3", the arena says it scales to whoever turns up.
 */
function ArenaCard({ onPick }: { onPick(s: Screen): void }) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const saved = loadArenaWeb();
  const run = saved?.run;
  const enter = (fresh?: boolean) => {
    initAudio();
    if (fresh) deleteArenaWeb();
    onPick({ view: 'arena' });
  };
  return (
    <div className={`module-card endless${run ? ' resuming' : ''}`}>
      <button className="module-cover" onClick={() => enter()} aria-label="Play The Arena">
        <div
          className="module-cover-art arena-cover"
          style={HAS_BOARD_BG.has('ember')
            ? { backgroundImage: `url(${thumbUrl(boardBgUrl('ember'))})` }
            : undefined}
        >
          {/* The cover the mode deserves is not a place — it has no place —
              but the roster. A row of faces says "every monster in the game"
              in a way a painted backdrop of anywhere cannot. */}
          <div className="arena-cover-roster">
            {/* Lazy and low, because this row is decoration below the fold.
                Measured on a 400 kbps profile: these seven faces plus the two
                card thumbnails are 132 KB fetched eagerly, occupying the
                connection for the first 2.6 seconds. A player who taps "Begin
                the story" has already left, but the requests are in flight and
                browsers do not cancel them, so the fight they are waiting on
                queues behind a picture of an owlbear they never looked at.
                The hint is here on those grounds rather than on a measured
                improvement — see the note on `priority` in ArtImage. */}
            {ARENA_FACES.filter(hasArt).map((id, i) => (
              <img key={id} src={tokenUrl(id)} alt="" draggable={false}
                   loading="lazy" fetchPriority="low"
                   style={{ zIndex: i === 3 ? 4 : 3 - Math.abs(3 - i) }} />
            ))}
          </div>
        </div>
        <div className="module-cover-body">
          <strong>The Arena</strong>
          <span className="module-band">Endless · scales to your party</span>
          <span>
            Fights built on the spot, on maps drawn on the spot, against every
            monster in the game. Each wave costs more than the last. Full rest
            and a stall between them.
          </span>
          <span className="module-cta">
            {run
              ? `▶ Continue — wave ${run.wave}, ${run.cleared} cleared`
              : '▶ Enter the arena'}
          </span>
        </div>
      </button>
      {run && (
        <div className="module-actions">
          {confirmWipe ? (
            <>
              <span className="muted">Erase this run and start fresh?</span>
              <button className="mini danger" onClick={() => { setConfirmWipe(false); enter(true); }}>Start over</button>
              <button className="mini" onClick={() => setConfirmWipe(false)}>Cancel</button>
            </>
          ) : (
            <button className="mini ghost" onClick={() => setConfirmWipe(true)}>↺ Start over</button>
          )}
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

/** The guided first battle — a fixed skirmish wrapped with the coach script. */
function TrainingYard({ onExit }: { onExit(): void }) {
  const ref = useRef<{ combat: Combat; aiTeams: Set<TeamId> } | null>(null);
  if (!ref.current) ref.current = makeTrainingCombat();
  return (
    <Battle
      combat={ref.current.combat}
      aiTeams={ref.current.aiTeams}
      aiLevel="easy"
      storyMode         // slower beats + narration on, so a newcomer can follow
      coach={TRAINING_COACH}
      mapLabel="Training Yard"
      theme={MAPS.open?.theme}
      doneLabel="Back to menu"
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
  const [speciesIds, setSpeciesIds] = useState<Id[]>(() => DEFAULT_PARTY.map(() => 'human'));
  /**
   * Which four classes fight. Previously fixed at fighter/wizard/cleric/rogue,
   * which meant eight of the twelve classes could not be taken into a quick
   * battle by any route -- in the one mode whose whole point is trying
   * something out. A player who wanted to see the new sorcerer had to play an
   * arena run to level 2 to reach its first interesting feature.
   */
  const [classIds, setClassIds] = useState<Id[]>(() => [...DEFAULT_PARTY]);

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
          {/* The campaign reaches 8, and several classes only become themselves
              above 5 -- the sorcerer's Metamagic is a level-2 feature but its
              subclass lands at 3 and its 4th-level slots at 7. Capping the
              try-it-out mode at 5 hid the top half of the game. */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
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
      {classIds.map((classId, index) => (
        <label key={index} className="setup-hero">
          {`Hero ${index + 1}`}
          <span className="setup-hero-pair">
            <select
              value={classId}
              onChange={(e) => setClassIds((cur) => cur.map((id, i) => (i === index ? e.target.value : id)))}
            >
              {Object.values(CLASSES).map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            <select
              value={speciesIds[index]}
              onChange={(e) => setSpeciesIds((current) => current.map((id, i) => i === index ? e.target.value : id))}
            >
              {Object.values(SPECIES).map((species) => (
                <option key={species.id} value={species.id}>{species.name}</option>
              ))}
            </select>
          </span>
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
      <button className="primary" onClick={() => onStart({ mode, mapId, level, encounterId, seed, aiLevel, speciesIds, classIds })}>
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
    ? buildEncounter(config.encounterId, 'team2', farRank(config.mapId))
    : buildParty('team2', farRank(config.mapId), config.level, undefined, config.speciesIds, config.classIds);
  const combat = new Combat({
    seed: config.seed,
    mapId: config.mapId,
    combatants: [...buildParty('team1', 0, config.level, undefined, config.speciesIds, config.classIds), ...team2],
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
  /** A step-by-step coach (the Training Yard). Present = show a coach banner
   *  and advance through the steps off the battle's own events. */
  coach?: CoachStep[] | undefined;
  onExit(): void;
  onDone(winner: TeamId): void;
}

export function Battle({ combat, aiTeams, aiLevel = 'normal', storyMode = false, mapLabel, theme, doneLabel, coach, onExit, onDone }: BattleProps) {
  const [version, setVersion] = useState(0);
  const [log, setLog] = useState<LogLine[]>(() => logLinesFor(combat.state, combat.log));
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  /**
   * The Metamagic option the sorcerer is holding down, if any.
   *
   * A mode, like `targeting` — it changes what the next tap means rather than
   * doing anything itself. Cleared whenever the tray closes or a cast goes off,
   * because an option left armed across turns is a resource spent by accident.
   */
  const [armed, setArmed] = useState<MetamagicId | null>(null);
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
  const [strikingSummons, setStrikingSummons] = useState<Set<string>>(new Set());
  const [movePaths, setMovePaths] = useState<Map<Id, Position[]>>(new Map());
  const [muted, setMutedState] = useState(isMuted());
  const [speed, setSpeed] = useState(1);
  /** Wall-clock time before which the AI must not act — see beatFor. */
  const dwellUntil = useRef(0);
  // Decorative-effect timers (floats, bursts, hit flashes…). Tracked so exiting
  // the battle mid-flourish clears them instead of firing setState on an
  // unmounted component — the same cleanup discipline the AI-turn effect has.
  const fxTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const fxTimeout = (fn: () => void, ms: number) => {
    const t = setTimeout(() => { fxTimers.current.delete(t); fn(); }, ms);
    fxTimers.current.add(t);
  };
  useEffect(() => () => { for (const t of fxTimers.current) clearTimeout(t); }, []);
  const [narration, setNarration] = useState<string | null>(null);
  const [tray, setTray] = useState<BarGroup | null>(null);
  // Default on: on a phone the log is hidden, so this is the only running
  // account of the fight. Story mode additionally slows the beats down.
  const [narrationOn, setNarrationOn] = useState(true);
  const [hint, setHint] = useState<Action | null>(null);
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('dnd-tutorial-seen'));
  // Just-in-time coaching: a one-time tip surfaces the first time a mechanic
  // actually happens (an ally goes down, a slot is spent, …). See tips.ts.
  const [tip, setTip] = useState<Tip | null>(null);
  const [tipsMuted, setTipsMuted] = useState(() => tipsOff());
  // Tap the status line to inspect the active combatant's full sheet.
  const [sheetFor, setSheetFor] = useState<Combatant | null>(null);
  // Training Yard: which coach step is showing. Advances off battle events.
  const [coachStep, setCoachStep] = useState(0);
  const speedRef = useRef(1);
  speedRef.current = speed;
  const logEnd = useRef<HTMLDivElement>(null);

  const state = combat.state;
  const activeId = combat.isOver() ? undefined : combat.activeId;
  const active = activeId ? state.combatants[activeId] : undefined;
  const activeLook = classLook(active?.classId);
  // A conjured ally runs itself even on the player's side: the SRD lets you
  // command it, but a fifth character sheet on a phone for a creature whose
  // whole job is "bite the nearest thing" is a worse game than letting it act.
  const runsItself = (c: Combatant | undefined): boolean =>
    !!c && (aiTeams.has(c.team) || actsOnItsOwn(c));
  const isHumanTurn = !!active && !runsItself(active) && !combat.isOver();

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
        fxTimeout(() => setFloats((f) => f.filter((x) => !ids.has(x.id))), 1600);
      }
      if (fx.corpses.length > 0) {
        setCorpses((c) => [...c, ...fx.corpses]);
        const ids = new Set(fx.corpses.map((c) => c.id));
        fxTimeout(() => setCorpses((c) => c.filter((x) => !ids.has(x.id))), 1800);
      }
      if (fx.bursts.length > 0) {
        setBursts((b) => [...b, ...fx.bursts]);
        const ids = new Set(fx.bursts.map((b) => b.id));
        fxTimeout(() => setBursts((b) => b.filter((x) => !ids.has(x.id))), 900);
      }
      if (fx.areas.length > 0) {
        setAreas((a) => [...a, ...fx.areas]);
        const ids = new Set(fx.areas.map((a) => a.id));
        fxTimeout(() => setAreas((a) => a.filter((x) => !ids.has(x.id))), 1100);
      }
      if (fx.projectiles.length > 0) {
        setProjectiles((p) => [...p, ...fx.projectiles]);
        const ids = new Set(fx.projectiles.map((p) => p.id));
        fxTimeout(() => setProjectiles((p) => p.filter((x) => !ids.has(x.id))), 450);
      }
      if (fx.casterId !== undefined) {
        const id = fx.casterId;
        setCastingId(id);
        fxTimeout(() => setCastingId((c) => (c === id ? undefined : c)), 450);
      }
      if (fx.critFlash) {
        setCritFlash(true);
        fxTimeout(() => setCritFlash(false), 260);
      }
      if (fx.summonStrikes.length > 0) {
        setStrikingSummons((h) => new Set([...h, ...fx.summonStrikes]));
        fxTimeout(() => setStrikingSummons((h) => {
          const next = new Set(h);
          for (const k of fx.summonStrikes) next.delete(k);
          return next;
        }), 420);
      }
      if (fx.hits.length > 0) {
        setHitIds((h) => new Set([...h, ...fx.hits]));
        fxTimeout(() => setHitIds((h) => {
          const next = new Set(h);
          for (const id of fx.hits) next.delete(id);
          return next;
        }), 450);
      }

      const isPlayer = (id: Id) => !runsItself(combat.state.combatants[id]);

      // Contextual coaching: surface the first not-yet-seen tip these events
      // trigger. Skipped when muted; each tip fires once ever (localStorage).
      // The Training Yard suppresses tips — its own coach owns the guidance.
      // …but not while the "How to play" modal is up. On a first-ever run both
      // fire at once and the tip lands under the scrim, so the player's one
      // showing of it is spent on a toast they can't read or dismiss. Detection
      // is skipped entirely rather than queued, so the tip stays unseen and
      // fires properly the next time its trigger comes round.
      if (!tipsMuted && !coach && !showTutorial) {
        const seen = seenTips();
        const fresh = detectTips(events, combat.state, isPlayer).find((t) => !seen.has(t.id));
        if (fresh) { markTipSeen(fresh.id); setTip(fresh); }
      }

      // Training Yard coach: advance a step when this turn's events clear it;
      // a finished fight always completes the coach (the win screen takes over),
      // so a fast clear never strands the banner on an unmet step.
      if (coach) {
        const ended = events.some((e) => e.type === 'combatEnded');
        setCoachStep((step) => ended ? coach.length
          : (step < coach.length && coach[step]!.done(events, combat.state, isPlayer) ? step + 1 : step));
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
  // An action's icon as generated art when we have it (spell-icon webp), else
  // the emoji glyph. `id` is 'spell:<id>' / 'item:scroll-<id>'; a raw spellId
  // also works. Rendered on a uniform plate so the mixed art styles normalize.
  function actionIcon(emoji: string | undefined, entryId?: string): ReactNode {
    const raw = entryId?.startsWith('spell:') ? entryId.slice(6)
      : entryId?.startsWith('item:scroll-') ? entryId.slice('item:scroll-'.length)
      : entryId && hasSpellIcon(entryId) ? entryId : undefined;
    if (raw && hasSpellIcon(raw)) {
      return <span className="act-ico-img"><img src={spellIconUrl(raw)} alt="" draggable={false} /></span>;
    }
    return emoji ? <>{emoji}</> : null;
  }

  function runEntry(b: BarEntry) {
    setTray(null);
    // The bend is already baked into `b` by `bendTray`; disarming here rather
    // than on apply keeps a multi-tap flow (which returns later, through
    // `buildMultiAction`) carrying the option it was started with.
    setArmed(null);
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
    if (combat.isOver() || !active || !runsItself(active)) return;
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

  /**
   * Cover at every cell you could move to, and on everyone already standing.
   *
   * XCOM's shield: the point is that the mechanical fact arrives at the moment
   * of the decision, not as scenery you have to decode first. Computed here
   * rather than in the board because it is a rules question, and the board's
   * job is to draw what it is handed.
   *
   * Only while it is a human's turn and nothing else is being targeted — during
   * an enemy turn or mid-spell there is no move decision to inform, and the
   * badges would just be clutter over the thing you are actually looking at.
   */
  /**
   * Worst-case damage for each cell the hero could walk to.
   *
   * The engine has computed this since pathing was written — `worstCaseWalkDamage`
   * walks the route the mover would actually take, adds every opportunity
   * attack it provokes at maximum, and every hazard it crosses — and until now
   * only the AI ever read it. The player, who is asked the same question every
   * turn, was told nothing.
   *
   * Cheap enough to do per cell: each call is one BFS over an eighty-cell grid,
   * and it runs for the forty-odd cells in range, memoised on the same
   * dependencies as the cover read beside it.
   */
  const riskCells = useMemo(() => {
    const m = new Map<string, number>();
    if (!grouped || !active || targeting || !isHumanTurn) return m;
    for (const k of grouped.moves.keys()) {
      const [x, y] = k.split(',').map(Number);
      const worst = worstCaseWalkDamage(state, active, { x: x!, y: y! });
      if (worst > 0) m.set(k, worst);
    }
    return m;
  }, [grouped, active, state, targeting, isHumanTurn]);

  const coverCells = useMemo(() => {
    const m = new Map<string, CoverRead>();
    if (!grouped || !active || targeting || !isHumanTurn) return m;
    for (const k of grouped.moves.keys()) {
      const [x, y] = k.split(',').map(Number);
      const read = coverReadAt(state, { x: x!, y: y! }, active.team, active.size ?? 'medium');
      if (read.covered) m.set(k, read);
    }
    return m;
  }, [grouped, active, state, targeting, isHumanTurn]);

  /** Everyone currently behind something, so the board's defensive shape reads
   *  at a glance rather than one hover at a time. */
  const coverUnits = useMemo(() => {
    const m = new Map<Id, CoverRead>();
    for (const c of Object.values(state.combatants)) {
      if (!c.alive) continue;
      const read = coverReadFor(state, c.id);
      if (read.covered) m.set(c.id, read);
    }
    return m;
  }, [state]);

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
  // When exactly one side is human-controlled (vs-AI, campaign, adventure, the
  // training yard), the outcome is "yours" — say so instead of a team colour.
  // Symmetric matches (hot-seat, AI-vs-AI spectate) keep Blue/Red.
  // Publish the top bar's real height as --topbar-h, which the floating tip and
  // coach banners position themselves under. The variable existed but nothing
  // ever set it, so everything used the 46px fallback — fine while the bar was
  // one row, wrong the moment it wraps to two on a phone, which left the first
  // learning tip sitting on top of the controls.
  const battleRef = useRef<HTMLDivElement | null>(null);
  /** The action bar's height, kept across the turns it is not rendered on. */
  const barHeight = useRef(0);
  /** Distance from the window's bottom to the action bar's top edge. */
  const aboveBar = useRef(14);
  const topbarRef = useRef<HTMLElement | null>(null);
  const publishRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const bar = topbarRef.current;
    const root = battleRef.current;
    if (!bar || !root) return;
    const publish = () => {
      root.style.setProperty('--topbar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);

      // …and the action bar's, which the coach banner and the learning toast
      // sit ABOVE. They used to hang under the top bar, where they covered the
      // top three rows of the board — and the board draws rank 0 at the bottom,
      // so those three rows are exactly where the enemies start. The training
      // yard's opening screen hid all four kobolds while telling the player to
      // go and attack one. Moving them to the bottom put them over the action
      // bar instead, hence this: the bar's real height, so they clear it.
      // Absent (nobody's turn to act) it is 0 and they sit at the floor.
      const abar = root.querySelector('.actionbar') as HTMLElement | null;
      root.style.setProperty(
        '--actionbar-h',
        `${abar ? Math.round(abar.getBoundingClientRect().height) : 0}px`,
      );
      // Remembered, because the bar is only rendered on a human's turn — and
      // the board is budgeted from what is left over, so without this the board
      // GREW the instant an enemy's turn began and shrank back when yours did.
      // Measured at 412x600: 254px with the bar, 349px without, every single
      // turn. That is the resize, and it is far more frequent than the URL bar
      // one it was mistaken for.
      if (abar) barHeight.current = Math.round(abar.getBoundingClientRect().height);
      /**
       * How far the action bar's TOP sits above the bottom of the window.
       *
       * The banners were anchored `bottom: actionbar-h + 14`, which assumes the
       * bar is flush with the bottom of the screen. It is in flow, so it is not:
       * whenever the layout does not fill the viewport the bar rides up and the
       * banner lands on top of it — and a fixed element over a button eats the
       * tap. Caught by a click on "End turn" timing out at 412x800, in the
       * tutorial, which is the worst possible place for an unclickable button.
       *
       * Remembered across the turns the bar is not rendered on, like its height,
       * so the banner does not hop about either.
       */
      if (abar) {
        aboveBar.current = Math.round(window.innerHeight - abar.getBoundingClientRect().top);
      }
      root.style.setProperty('--above-bar', `${aboveBar.current}px`);

      // How much height is left for the board once everything else has taken
      // what it needs.
      //
      // The board used to claim a guessed share of the viewport — 44vh plus
      // 14vh per unit of aspect, so 65vh for an 8x12 — and everything below it
      // took whatever remained. On a phone that ran out: the second row of the
      // action bar was clipped by the navigation bar. The guess cannot be made
      // right, because what sits under the board changes with the turn (a
      // character card, one or two rows of buttons, sometimes a banner).
      //
      // So measure instead. `scrollHeight - board` is the height of everything
      // that is NOT the board, whatever that happens to be right now; the
      // budget is what is left of the visible box after that. The board is the
      // only thing here that can shrink, so it is the thing that gives way.
      const wrap = root.querySelector('.board-wrap') as HTMLElement | null;
      if (!wrap) return;
      // Sum the siblings directly rather than using scrollHeight. With
      // `overflow-y: auto` on this column, scrollHeight equals clientHeight
      // whenever the content fits, so `scrollHeight - board` collapsed to
      // "clientHeight - board" and the budget ratcheted down to whatever the
      // board already was — it shrank a little on every render.
      const style = getComputedStyle(root);
      const gap = Number.parseFloat(style.rowGap) || 0;
      const pad = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
      let others = pad + gap * Math.max(0, root.children.length - 1);
      /**
       * Only what is ABOVE OR BELOW the board, not what is beside it.
       *
       * `.battle` is a grid, and on a wide screen the log sits in a second
       * COLUMN — same row as the board, to its right. Summing every child's
       * height subtracted that column's 559px from the board's vertical budget,
       * which is height the board was never going to get back: the floor below
       * then bit on every desktop, and the board rendered at 0.38 of the
       * viewport. Measured at 1680x1050 it came out 266x395 — smaller than the
       * same board on a 390px phone, on a screen with 400px of empty space
       * under it.
       *
       * Horizontal overlap is the test, because it is the one that matches what
       * "stacked" actually means here: the topbar spans the full width and
       * counts, the side log does not touch the board's columns and does not.
       */
      const wrapBox = wrap.getBoundingClientRect();
      for (const child of Array.from(root.children) as HTMLElement[]) {
        // Only things that actually take space in the column. A floating toast,
        // the slide-over log and anything hidden are out of flow, and counting
        // them left the board a few hundred pixels smaller than the screen
        // could afford.
        const cs = getComputedStyle(child);
        if (cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'none') {
          others -= gap;
          continue;
        }
        const box = child.getBoundingClientRect();
        // Side by side with the board: it costs width, not height. Guarded on
        // a real measurement, so the first paint (every rect zero) keeps the
        // old conservative behaviour rather than over-claiming.
        if (!child.contains(wrap) && wrapBox.width > 0 && box.width > 0 &&
            (box.right <= wrapBox.left || box.left >= wrapBox.right)) {
          others -= gap;
          continue;
        }
        // The column that holds the board contributes only whatever else is
        // inside it; the board itself is the thing being budgeted for.
        others += child.contains(wrap) ? child.offsetHeight - wrap.offsetHeight : child.offsetHeight;
      }
      // A floor, in case something below the board is unusually tall: better a
      // slightly cramped board than cells too small to tap. If the floor bites,
      // `.battle` scrolls rather than clipping — a button you cannot reach is
      // worse than a board you have to scroll to.
      // Hold the bar's space whether or not it is on screen right now.
      const reserved = others + (root.querySelector('.actionbar') ? 0 : barHeight.current + gap);
      const budget = Math.max(root.clientHeight * 0.38, root.clientHeight - reserved);
      const prev = Number.parseFloat(root.style.getPropertyValue('--board-budget')) || 0;
      // Only on a real change: writing it back re-runs the observer, and a
      // sub-pixel wobble would loop forever.
      if (Math.abs(budget - prev) > 2) root.style.setProperty('--board-budget', `${Math.round(budget)}px`);
    };
    publishRef.current = publish;
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(publish);
    ro.observe(bar);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // ...and again after every render.
  //
  // The ResizeObserver alone is not enough: `.battle` is height:100%, so its
  // own box never changes when a child appears or leaves, and the budget went
  // stale. Measured with the tutorial panel up and never recomputed once it
  // was dismissed, the board stayed at 250px on an 844px screen with 600
  // available — the fix for the overflow had quietly become a different bug.
  // What changes the content is a render, so that is when to re-measure.
  useEffect(() => { publishRef.current?.(); });

  const soloHuman = (['team1', 'team2'] as TeamId[]).filter((t) => !aiTeams.has(t));
  const youTeam = soloHuman.length === 1 ? soloHuman[0] : undefined;

  return (
    <div className="battle" ref={battleRef}>
      {critFlash && <div className="crit-flash" />}
      <header className="topbar" ref={topbarRef}>
        <button className="ghost" onClick={onExit}>✕</button>
        <span className="round">Round {state.round}</span>
        <span className="mapname">{mapLabel}</span>
        {/* The controls are one flex child, not seven, so on a narrow screen
            they wrap to their own row together instead of the row overflowing
            the viewport. */}
        <div className="topbar-tools">
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
        <button
          className={`ghost tips-toggle${tipsMuted ? ' off' : ''}`}
          title={tipsMuted ? 'Learning tips: off' : 'Learning tips: on'}
          onClick={() => { const next = !tipsMuted; setTipsOff(next); setTipsMuted(next); if (next) setTip(null); }}
        >
          💡
        </button>
        <button className="ghost" title="How to play" onClick={() => setShowTutorial(true)}>❓</button>
        </div>
      </header>

      {/* Training Yard: the step-by-step coach banner. Persists per step until
          the player does the thing it asks; the last step rides to victory. */}
      {coach && coachStep < coach.length && (
        <div className="coach-banner" role="status" aria-live="polite">
          <span className="coach-step">Step {Math.min(coachStep + 1, coach.length)} of {coach.length}</span>
          <p>{coach[coachStep]!.text}</p>
        </div>
      )}

      {/* Just-in-time coaching toast — the first time a mechanic actually
          happens. Dismissible; muted from the header 💡 toggle. */}
      {tip && (
        <div className="tip-toast" role="status">
          <span className="tip-icon">{tip.icon}</span>
          <div className="tip-text">
            <strong>{tip.title}</strong>
            <p>{tip.body}</p>
          </div>
          <button className="tip-close" aria-label="Dismiss tip" onClick={() => setTip(null)}>✕</button>
        </div>
      )}

      {/* The play area, grouped so the log can be a sibling column on desktop
          rather than a grid item spanning rows. Spanning meant inheriting one
          row-gap per row it crossed — ~780px of nothing, and the log ran off
          the bottom of the screen. */}
      <div className="battle-main">
      <Board
        state={state}
        activeId={activeId ?? ''}
        highlights={highlights}
        coverCells={coverCells}
        riskCells={riskCells}
        coverUnits={coverUnits}
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
        strikingSummons={strikingSummons}
        onCellTap={onCellTap}
        onCondition={(label, icon) => {
          // A badge tap explains the condition through the same toast card. The
          // label is "Name — what it does"; split on the em dash for the title.
          const [name, ...rest] = label.split(' — ');
          setTip({ id: 'cond-lookup', icon, title: name!, body: rest.join(' — ') || 'A status effect on this creature.' });
        }}
      />

      {/* Directly under the board: a fixed place to read what just happened,
          so following a fight never depends on watching the right cell. */}
      {narrationOn && (
        <div
          className={`narration${narration ? '' : ' quiet'}`}
          key={narration ?? ''}
          aria-live="polite"
        >
          {narration ?? ' '}
        </div>
      )}

      {active && (
        <div
          className="statusline statusline-tap"
          style={activeLook ? { ['--pip' as string]: activeLook.color } : undefined}
          title="Tap for full character sheet"
          role="button"
          tabIndex={0}
          onClick={() => setSheetFor(active)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheetFor(active); } }}
        >
          <span className="adv-party-face">
            <Portrait id={active.portraitId ?? active.classId} team={active.team} />
            {activeLook && <span className="class-pip on-portrait" title={activeLook.name}>{activeLook.glyph}</span>}
          </span>
          <strong>{active.name}</strong>
          {/* The line named who and how hurt, but never *what* — and portraits
              follow species, so nothing on screen said "wizard". Words, not a
              glyph: this is the one place with room for them. */}
          {activeLook && <span className="class-tag">{activeLook.name}</span>}
          {/* From a solo-human game (campaign/adventure/vs-AI) read the side as
              You / Enemy; a symmetric match keeps the neutral Blue / Red. */}
          <span className={active.team}>
            {youTeam ? (active.team === youTeam ? 'You' : 'Enemy') : (active.team === 'team1' ? 'Blue' : 'Red')}
          </span>
          <span>HP {active.hp}/{active.maxHp}</span>
          <span>AC {acOf(active)}</span>
          <SlotPips spellSlots={active.spellSlots} />
          <FeaturePips featureUses={active.featureUses} />
          {/* Was a bare "AB" that decayed to "A·" / "··". Sitting next to "AC 15"
              it read like a stat with a missing value, and nothing on screen
              said what it meant — so the one indicator of what you still have
              left to spend this turn was the least legible thing on the line. */}
          <span className="economy">
            <span
              className={`econ-chip${active.turn.actionUsed ? ' spent' : ''}`}
              title={active.turn.actionUsed ? 'Action spent' : 'Action available'}
            >Action</span>
            <span
              className={`econ-chip${active.turn.bonusActionUsed ? ' spent' : ''}`}
              title={active.turn.bonusActionUsed ? 'Bonus action spent' : 'Bonus action available'}
            >Bonus</span>
          </span>
          <span>{active.turn.movementMax - active.turn.movementUsed}ft</span>
          {!isHumanTurn && !combat.isOver() && <em className="thinking">AI thinking…</em>}
        </div>
      )}

      {sheetFor && (
        <CharacterSheet
          c={sheetFor}
          subtitle={youTeam
            ? (sheetFor.team === youTeam ? 'Your hero' : 'Enemy')
            : (sheetFor.team === 'team1' ? 'Blue team' : 'Red team')}
          onClose={() => setSheetFor(null)}
        />
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
            // Class powers (Turn Undead, Second Wind, …) each get their own bar
            // button — they're few, situational, and were invisible buried in a
            // tray. A category holding one thing likewise shows the thing. Only
            // spells/items/basic collapse to a tray (they grow with level).
            if (group === 'skill' || (entries.length === 1 && group !== 'basic')) {
              return entries.map((only) => (
                <button key={only.id} onClick={() => runEntry(only)}>
                  {actionIcon(only.icon ?? icon, only.id)} {only.label}
                </button>
              ));
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
        <div className="tray-backdrop" onClick={() => { setTray(null); setArmed(null); }}>
          <div className="tray" onClick={(e) => e.stopPropagation()}>
            <div className="tray-head">
              {CATEGORIES.find((c) => c.group === tray)?.icon}{' '}
              {CATEGORIES.find((c) => c.group === tray)?.name}
              <button className="ghost" onClick={() => { setTray(null); setArmed(null); }}>✕</button>
            </div>
            {/* Metamagic: arm an option, and the list below becomes what that
                option can touch. One chip per option the sorcerer knows and can
                pay for, so the list stays N buttons however many it learns —
                the alternative, an entry per spell x option, is what the tray
                looked like before this and it doubled at the second option. */}
            {tray === 'spell' && active && affordableMetamagic(active).length > 0 && (
              <div className="meta-row">
                {affordableMetamagic(active).map((m) => (
                  <button
                    key={m.id}
                    className={`meta-chip${armed === m.id ? ' armed' : ''}`}
                    title={m.blurb}
                    onClick={() => setArmed(armed === m.id ? null : m.id)}
                  >
                    {m.name.replace(' Spell', '')} <span className="chip-note">{m.cost} SP</span>
                  </button>
                ))}
              </div>
            )}
            <div className="tray-grid">
              {bendTray(grouped.bar.filter((b) => b.group === tray), armed).map((b) => (
                <button key={b.id} className="chip" onClick={() => runEntry(b)}>
                  <span className="chip-ico">{actionIcon(b.icon, b.id)}</span>
                  <span className="chip-label">{b.label}</span>
                  {b.note && <span className="chip-note">{b.note}</span>}
                </button>
              ))}
              {armed && bendTray(grouped.bar.filter((b) => b.group === tray), armed).length === 0 && (
                <div className="tray-empty">Nothing you have prepared can be {METAMAGIC_LABEL[armed]}.</div>
              )}
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
              <button key={i} onClick={() => {
                // A multi-target spell tapped off an enemy starts the
                // accumulate-taps flow with that enemy pre-picked as its first
                // ray/dart — pick the rest, or hit "Cast now" to fire what you
                // have. Everything else applies immediately.
                if (o.multi) {
                  const anchor = chooser.target.id;
                  const spec = o.multi;
                  if (spec.maxTargets <= 1) apply(buildMultiAction(spec, [anchor]));
                  else {
                    setChooser(null);
                    const name = SPELLS[spec.spellId]?.name ?? o.label;
                    setTargeting({ type: 'multi', label: `${name} — pick the rest (or Cast now)`, spec, picked: [anchor] });
                  }
                } else {
                  apply(o.action);
                }
              }}>
                <span className="opt-ico">{actionIcon(o.icon, o.action.kind === 'castSpell' ? `spell:${o.action.spellId}` : undefined)}</span>
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
            <h2>
              {youTeam
                ? (winner === youTeam ? '🎉 You win!' : '💀 You were defeated')
                : (winner === 'team1' ? '🔵 Blue team wins!' : '🔴 Red team wins!')}
            </h2>
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
              <li>🎓 <b>Learning tips</b> pop up the first time something new happens — tap the 💡 in the top bar to turn them off once you know the ropes.</li>
              <li>🏷️ Tap a <b>status badge</b> on a token to see what that condition does.</li>
              <li>➤ Done? Tap <b>End turn</b>. Defeat all enemies to win!</li>
            </ul>
            <button className="primary" onClick={dismissTutorial}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
