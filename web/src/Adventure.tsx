/**
 * Adventure mode: plays a module through the pure runtime. Story/dialogue/check
 * /explore scenes render here; battles delegate to the shared <Battle>; shops
 * and rests auto-resolve for now (the full shop UI is a follow-up). The dice
 * ritual (<DiceCheck>) reveals every visible check.
 */
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Combat } from '../../src/engine/combat.js';
import {
  newCampaign, buildCampaignParty, applyVictory, type CampaignState,
} from '../../src/campaign/campaign.js';
import { buildEncounter, ENCOUNTERS } from '../../src/data/monsters.js';
import { MAPS } from '../../src/data/maps.js';
import type { TeamId } from '../../src/engine/types.js';
import {
  startAdventure, currentScene, enterScene, legalChoices, choose, rollSceneCheck,
  exploreNodes, enterNode, resolveBattle, resolveShopOrRest, battleSeed,
  hubReturn, returnToHub,
  type AdventureState, type AdventureEvent,
} from '../../src/adventure/runtime.js';
import type { Module, Scene } from '../../src/adventure/types.js';
import { MODULES } from '../../src/data/modules/index.js';
import type { BattleProps } from './App.js';
import { Portrait } from './Portrait.js';
import { DiceCheck } from './DiceCheck.js';
import { AdventureShop } from './AdventureShop.js';
import { JournalDrawer } from './Journal.js';
import { hasSceneArt, sceneArtUrl, hasArt } from './art.js';
import { artEmoji } from '../../src/data/adventure-art.js';
import { sfx, initAudio, isMuted, setMuted } from './sound.js';
import { saveAdventureWeb, loadAdventureWeb, savedAdventureModule, deleteAdventureWeb } from './adventureStorage.js';

interface Props {
  Battle: ComponentType<BattleProps>;
  onExit(): void;
}

/** A check event pulled from an action's stream, shown as a dice overlay. */
type DiceOverlay = Extract<AdventureEvent, { type: 'check' }>;

/** Pick a module (or resume a save), then hand off to the player. */
export function AdventureScreen({ Battle, onExit }: Props) {
  const [start, setStart] = useState<{ module: Module; resume?: AdventureState } | null>(null);
  if (!start) return <ModulePicker onStart={setStart} onExit={onExit} />;
  return (
    <AdventurePlayer
      key={start.module.id + (start.resume ? '-resume' : '-new')}
      Battle={Battle} module={start.module} {...(start.resume ? { resume: start.resume } : {})} onExit={onExit}
    />
  );
}

function ModulePicker(
  { onStart, onExit }: { onStart(s: { module: Module; resume?: AdventureState }): void; onExit(): void },
) {
  const savedId = savedAdventureModule();
  return (
    <div className="setup">
      <h1>📜 Adventures</h1>
      {MODULES.map((m) => {
        const resume = savedId === m.id ? loadAdventureWeb(m) : undefined;
        return (
          <div key={m.id} className="adv-modcard-wrap">
            <button className="adv-modcard" onClick={() => { initAudio(); onStart({ module: m }); }}>
              <strong>{m.title}</strong>
              <span>{m.blurb}</span>
            </button>
            {resume && (
              <button className="adv-resume" onClick={() => { initAudio(); onStart({ module: m, resume }); }}>
                ▶ Resume
              </button>
            )}
          </div>
        );
      })}
      <button className="ghost" onClick={onExit}>← Back</button>
      <p className="hint">Adventure mode is in beta: story scenes, exploration, and skill
        checks between fights. Your run saves in your browser.</p>
    </div>
  );
}

/** The dice overlay plus the scene the player triggered it from, so the roll
 *  renders over the *place and person* they were interacting with (the runtime
 *  has already advanced past that scene by the time we show the dice). */
interface DiceContext { roll: DiceOverlay['roll']; from: Scene; }

/** The location backdrop art id for a scene (its own, or an explore map's). */
function artIdOf(scene: Scene): string | undefined {
  if (scene.kind === 'explore') return scene.map.art?.imageId;
  return 'art' in scene ? scene.art?.imageId : undefined;
}

function AdventurePlayer({ Battle, module, resume, onExit }: Props & { module: Module; resume?: AdventureState }) {
  const stateRef = useRef<AdventureState | null>(null);
  if (!stateRef.current) {
    if (resume) {
      stateRef.current = resume;
    } else {
      const campaign = newCampaign(Math.floor(Math.random() * 2 ** 31));
      campaign.partyReady = true;
      stateRef.current = startAdventure(campaign, module);
      enterScene(stateRef.current, module, module.start);
    }
  }
  const state = stateRef.current;
  const campaign = state.campaign;

  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const [dice, setDice] = useState<DiceContext | null>(null);
  const [banner, setBanner] = useState<string[]>([]);
  const [journalOpen, setJournalOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  /** Last scene that carried a location backdrop — inherited by scenes that
   *  don't declare their own, so a whole conversation stays *in* the tavern. */
  const locationArt = useRef<string | undefined>(undefined);

  const scene = currentScene(state, module);

  // Persist the run on every scene change; clear it once the adventure ends
  // (a finished run shouldn't offer Resume).
  useEffect(() => {
    if (scene.kind === 'ending') {
      sfx(scene.outcome === 'victory' ? 'victory' : 'death');
      deleteAdventureWeb();
    } else {
      saveAdventureWeb(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // Rest scenes auto-resolve (they only heal and advance). Shops render a panel.
  useEffect(() => {
    if (scene.kind === 'rest') {
      const evs = resolveShopOrRest(state, module);
      note(evs);
      rerender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  function note(events: AdventureEvent[]) {
    const lines: string[] = [];
    for (const e of events) {
      if (e.type === 'gold' && e.amount !== 0) { lines.push(`${e.amount >= 0 ? '+' : ''}${e.amount} gold`); sfx('coin'); }
      if (e.type === 'item' && e.gained) { lines.push(`Gained ${label(e.itemId)}`); sfx('item'); }
      if (e.type === 'xp') { lines.push(`+${e.amount} XP${e.leveledTo ? ` — Level ${e.leveledTo}!` : ''}`); sfx(e.leveledTo ? 'levelup' : 'item'); }
      if (e.type === 'heal' && e.amount > 0) { lines.push(`Healed ${e.amount} HP`); sfx('heal'); }
      if (e.type === 'journal') { lines.push(`Journal: ${e.entry.title}`); sfx('page'); }
    }
    setBanner(lines);
  }

  /** Run an action's events. `from` is the scene the player acted from — if the
   *  action rolled a check, the dice reveal renders over that scene's place and
   *  NPC, not the scene the runtime has already advanced to. */
  function process(events: AdventureEvent[], from: Scene) {
    note(events);
    const check = [...events].reverse().find((e): e is DiceOverlay => e.type === 'check');
    if (check) setDice({ roll: check.roll, from });
    else rerender();
  }

  function onChoice(choiceId: string, actorIdx?: number) {
    setBanner([]);
    const from = scene;
    process(choose(state, module, choiceId, actorIdx), from);
  }

  function onRollScene(actorIdx?: number) {
    setBanner([]);
    const from = scene;
    process(rollSceneCheck(state, module, actorIdx), from);
  }

  function onLeave() {
    setBanner([]);
    process(returnToHub(state, module), scene);
  }

  function afterDice() {
    setDice(null);
    rerender();
  }

  // --- Battle scene: hand off to the shared Battle component ---------------
  if (scene.kind === 'battle') {
    const enc = ENCOUNTERS[scene.encounterId];
    const combat = new Combat({
      seed: battleSeed(state, scene.id),
      mapId: scene.mapId,
      combatants: [...buildCampaignParty(campaign), ...buildEncounter(scene.encounterId, 'team2', 7)],
    });
    return (
      <Battle
        combat={combat}
        aiTeams={new Set<TeamId>(['team2'])}
        aiLevel={campaign.storyMode ? 'easy' : 'normal'}
        storyMode={campaign.storyMode}
        mapLabel={`${enc?.name ?? scene.encounterId} — ${MAPS[scene.mapId]?.name ?? ''}`}
        theme={MAPS[scene.mapId]?.theme ?? 'stone'}
        doneLabel="Continue"
        onExit={onExit}
        onDone={(winner) => {
          const won = winner === 'team1';
          if (won) {
            const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
            applyVictory(campaign, survivors, combat.state.rng);
          }
          process(resolveBattle(state, module, won), scene);
        }}
      />
    );
  }

  // The place the player is looking at: while the dice roll, it's the scene they
  // acted from; otherwise the current scene — falling back to the last location
  // seen, so scenes without their own art stay *in* the tavern/village/etc.
  const facing = dice?.from ?? scene;
  const ownArt = artIdOf(facing);
  if (ownArt) locationArt.current = ownArt;
  const backdropArt = ownArt ?? locationArt.current;
  const isExplore = scene.kind === 'explore' && !dice;

  return (
    <div className="adventure">
      <div className="adv-top">
        <button className="ghost" onClick={onExit}>✕ Menu</button>
        <span className="adv-title">{module.title}</span>
        <button className="ghost adv-journal-btn" onClick={() => setJournalOpen(true)}>
          📖{state.journal.length > 0 ? ` ${state.journal.length}` : ''}
        </button>
        <button className="ghost adv-journal-btn" title={muted ? 'Unmute' : 'Mute'}
          onClick={() => { const m = !muted; setMuted(m); setMutedState(m); if (!m) initAudio(); }}>
          {muted ? '🔇' : '🔊'}
        </button>
        <span className="adv-gold">💰 {campaign.gold}</span>
      </div>

      {journalOpen && <JournalDrawer entries={state.journal} onClose={() => setJournalOpen(false)} />}

      <div className={`adv-stage ${isExplore ? 'explore' : ''}`}>
        <Backdrop artId={backdropArt} glyph={artEmoji(backdropArt) ?? sceneGlyph(facing)} />

        <div className="adv-content" key={dice ? 'dice' : scene.id}>
          {dice ? (
            // Freeze the scene the roll came from (NPC + words), so the player
            // stays *in* the moment while the dice resolve over it.
            <FrozenScene scene={dice.from} />
          ) : (
            <SceneBody
              scene={scene}
              state={state}
              module={module}
              onChoice={onChoice}
              onRollScene={onRollScene}
              onLeave={onLeave}
              onNode={(nodeId) => process(enterNode(state, module, nodeId), scene)}
              onBlockedNode={(reason) => setBanner([reason])}
              onLeaveShop={() => process(resolveShopOrRest(state, module), scene)}
              onExit={onExit}
            />
          )}
        </div>

        {banner.length > 0 && !dice && (
          <div className="adv-banner">{banner.map((b, i) => <span key={i}>{b}</span>)}</div>
        )}

        {/* Dice roll as a modal over the frozen scene/NPC, not a replacement. */}
        {dice && (
          <div className="adv-dice-scrim">
            <DiceCheck
              roll={dice.roll}
              rollerName={campaign.characters[dice.roll.by]?.name ?? 'The party'}
              onDone={afterDice}
            />
          </div>
        )}
      </div>

      {!isExplore && <PartyStrip campaign={campaign} />}
    </div>
  );
}

/** Full-bleed location backdrop; a generated painting, else a soft glyph card. */
function Backdrop({ artId, glyph }: { artId: string | undefined; glyph: string }) {
  if (artId && hasSceneArt(artId)) {
    return <div className="adv-backdrop" style={{ backgroundImage: `url(${sceneArtUrl(artId)})` }} />;
  }
  return <div className="adv-backdrop glyph"><span>{glyph}</span></div>;
}

/** A non-interactive snapshot of a story/dialogue/check scene — the NPC and
 *  their words — shown behind the dice modal so the roll happens *in* the scene. */
function FrozenScene({ scene }: { scene: Scene }) {
  const lines = scene.kind === 'story' ? scene.text
    : scene.kind === 'dialogue' ? scene.lines
    : scene.kind === 'check' ? scene.intro : [];
  return (
    <div className="adv-scene bottom">
      <div className="adv-panel frozen">
        {scene.kind === 'dialogue' && (
          <div className="adv-npc">
            {hasArt(scene.npc.portraitId ?? scene.npc.id)
              ? <Portrait id={scene.npc.portraitId ?? scene.npc.id} team="team1" big />
              : <span className="adv-npc-emoji">{scene.npc.emoji ?? artEmoji(scene.npc.portraitId) ?? '💬'}</span>}
            <span className="adv-npc-name">{scene.npc.name}</span>
          </div>
        )}
        {lines.map((p, i) => <p key={i} className="adv-text">{p}</p>)}
      </div>
    </div>
  );
}

/** A compact party read-out (portrait + HP) filling the base of story scenes. */
function PartyStrip({ campaign }: { campaign: CampaignState }) {
  const party = buildCampaignParty(campaign);
  return (
    <div className="adv-party-strip">
      {party.map((c, i) => {
        const pct = Math.max(0, Math.round((c.hp / c.maxHp) * 100));
        return (
          <div key={i} className={`adv-party-member ${c.hp === 0 ? 'down' : ''}`}>
            {hasArt(campaign.characters[i]?.portraitId ?? c.classId)
              ? <Portrait id={campaign.characters[i]?.portraitId ?? c.classId} team="team1" />
              : <span className="adv-party-emoji">🧑</span>}
            <div className="adv-party-hpbar"><div style={{ width: `${pct}%` }} /></div>
            <span className="adv-party-hp">{c.hp}/{c.maxHp}</span>
          </div>
        );
      })}
    </div>
  );
}

function label(itemId: string): string {
  return itemId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function sceneGlyph(scene: Scene): string {
  switch (scene.kind) {
    case 'dialogue': return '💬';
    case 'check': return '🎲';
    case 'explore': return '🗺️';
    case 'ending': return scene.outcome === 'victory' ? '🏆' : '☠️';
    default: return '📜';
  }
}

interface BodyProps {
  scene: Scene;
  state: AdventureState;
  module: Module;
  onChoice: (id: string, actorIdx?: number) => void;
  onRollScene: (actorIdx?: number) => void;
  onLeave: () => void;
  onNode: (nodeId: string) => void;
  onBlockedNode: (reason: string) => void;
  onLeaveShop: () => void;
  onExit(): void;
}

function SceneBody({ scene, state, module, onChoice, onRollScene, onLeave, onNode, onBlockedNode, onLeaveShop, onExit }: BodyProps) {
  const campaign = state.campaign;

  if (scene.kind === 'ending') {
    return (
      <div className="adv-scene centered">
        <div className="adv-panel">
          <h1>{scene.outcome === 'victory' ? '🏆 Victory' : '☠️ Defeat'}</h1>
          {scene.text.map((p, i) => <p key={i} className="adv-text">{p}</p>)}
          <button className="primary" onClick={onExit}>Return to menu</button>
        </div>
      </div>
    );
  }

  if (scene.kind === 'story' || scene.kind === 'dialogue') {
    const lines = scene.kind === 'story' ? scene.text : scene.lines;
    const options = legalChoices(state, module);
    const leaveTo = hubReturn(state, module);
    return (
      // Bottom-anchored panel over the location backdrop (visual-novel style).
      <div className="adv-scene bottom">
        <div className="adv-panel">
          {scene.kind === 'dialogue' && (
            <div className="adv-npc">
              {hasArt(scene.npc.portraitId ?? scene.npc.id)
                ? <Portrait id={scene.npc.portraitId ?? scene.npc.id} team="team1" big />
                : <span className="adv-npc-emoji">{scene.npc.emoji ?? artEmoji(scene.npc.portraitId) ?? '💬'}</span>}
              <span className="adv-npc-name">{scene.npc.name}</span>
            </div>
          )}
          {lines.map((p, i) => <p key={i} className="adv-text">{p}</p>)}
          <div className="adv-choices">
            {options.map(({ choice, blocked }) => (
              <button
                key={choice.id}
                className={`adv-choice ${blocked ? 'blocked' : ''}`}
                disabled={!!blocked}
                onClick={() => onChoice(choice.id)}
              >
                {choice.check && <span className="adv-chip">🎲 {choice.check.skill} DC {choice.check.dc}</span>}
                <span>{choice.label}</span>
                {blocked && <span className="adv-lock">🔒 {blocked}</span>}
              </button>
            ))}
            {leaveTo && (
              <button className="adv-choice adv-leave" onClick={onLeave}>
                <span>← Leave</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (scene.kind === 'check') {
    return (
      <div className="adv-scene bottom">
        <div className="adv-panel">
          {scene.intro.map((p, i) => <p key={i} className="adv-text">{p}</p>)}
          {scene.roller === 'chosen' ? (
            <>
              <p className="adv-prompt">Who steps up? ({scene.skill}, DC {scene.dc})</p>
              <RosterPicker campaign={campaign} onPick={(idx) => onRollScene(idx)} />
            </>
          ) : (
            <button className="primary" onClick={() => onRollScene()}>
              🎲 Roll {scene.skill} (DC {scene.dc})
            </button>
          )}
        </div>
      </div>
    );
  }

  if (scene.kind === 'explore') {
    const nodes = exploreNodes(state, module);
    return (
      // Markers sit directly on the full-bleed location backdrop (the stage).
      <div className="adv-explore">
        <h2 className="adv-maptitle">{scene.map.title}</h2>
        {nodes.map(({ node, blocked, secret, explored }) => (
          <button
            key={node.id}
            className={`adv-node ${blocked ? 'blocked' : ''} ${secret ? 'secret' : ''} ${explored ? 'explored' : 'fog'}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            title={blocked ?? node.label}
            // Blocked nodes stay tappable but explain why (a disabled button
            // gives no feedback on touch).
            onClick={() => (blocked ? onBlockedNode(blocked) : onNode(node.id))}
          >
            <span className="adv-node-icon">{blocked ? '🔒' : node.icon}</span>
            <span className="adv-node-label">{node.label}</span>
          </button>
        ))}
        <p className="adv-maphint">Tap a marker to explore. 🔒 needs something first; dimmed are unvisited.</p>
      </div>
    );
  }

  if (scene.kind === 'shop') {
    return (
      <div className="adv-scene">
        <div className="adv-panel full">
          <AdventureShop
            campaign={campaign}
            {...(scene.stock ? { stock: scene.stock } : {})}
            {...(scene.title ? { title: scene.title } : {})}
            onLeave={onLeaveShop}
          />
        </div>
      </div>
    );
  }

  // rest auto-resolves via the effect above; render a brief placeholder.
  return <div className="adv-scene centered"><p className="adv-text">…</p></div>;
}

function RosterPicker({ campaign, onPick }: { campaign: CampaignState; onPick: (idx: number) => void }) {
  return (
    <div className="adv-roster">
      {campaign.characters.map((ch, idx) => (
        <button key={idx} className="adv-hero" onClick={() => onPick(idx)}>
          <Portrait id={ch.portraitId ?? ch.classId} team="team1" />
          <span>{ch.name}</span>
        </button>
      ))}
    </div>
  );
}
