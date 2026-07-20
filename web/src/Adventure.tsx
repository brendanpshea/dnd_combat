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
  type AdventureState, type AdventureEvent,
} from '../../src/adventure/runtime.js';
import type { Module, Scene } from '../../src/adventure/types.js';
import { MODULES } from '../../src/data/modules/index.js';
import type { BattleProps } from './App.js';
import { Portrait } from './Portrait.js';
import { DiceCheck } from './DiceCheck.js';
import { AdventureShop } from './AdventureShop.js';
import { JournalDrawer } from './Journal.js';
import { HAS_BOARD_BG, boardBgUrl, hasSceneArt, sceneArtUrl, hasArt } from './art.js';
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
  const [dice, setDice] = useState<DiceOverlay | null>(null);
  const [banner, setBanner] = useState<string[]>([]);
  const [journalOpen, setJournalOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

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

  /** Show the dice overlay for a check within an event stream, if present. */
  function process(events: AdventureEvent[]) {
    note(events);
    const check = [...events].reverse().find((e): e is DiceOverlay => e.type === 'check');
    if (check) setDice(check);
    else rerender();
  }

  function onChoice(choiceId: string, actorIdx?: number) {
    setBanner([]);
    process(choose(state, module, choiceId, actorIdx));
  }

  function onRollScene(actorIdx?: number) {
    setBanner([]);
    process(rollSceneCheck(state, module, actorIdx));
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
          process(resolveBattle(state, module, won));
        }}
      />
    );
  }

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

      <div className="adv-stage">
        {/* key on scene id so a new scene replays the wipe-in animation */}
        <div className="adv-transition" key={dice ? 'dice' : scene.id}>
          <SceneArtBanner scene={scene} />

          {dice ? (
            <DiceCheck
              roll={dice.roll}
              rollerName={campaign.characters[dice.roll.by]?.name ?? 'The party'}
              onDone={afterDice}
            />
          ) : (
            <SceneBody
              scene={scene}
              state={state}
              module={module}
              onChoice={onChoice}
              onRollScene={onRollScene}
              onNode={(nodeId) => process(enterNode(state, module, nodeId))}
              onLeaveShop={() => process(resolveShopOrRest(state, module))}
              onExit={onExit}
            />
          )}
        </div>

        {banner.length > 0 && !dice && (
          <div className="adv-banner">{banner.map((b, i) => <span key={i}>{b}</span>)}</div>
        )}
      </div>
    </div>
  );
}

function label(itemId: string): string {
  return itemId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function SceneArtBanner({ scene }: { scene: Scene }) {
  const imageId = 'art' in scene ? scene.art?.imageId : undefined;
  // A generated location backdrop when we have one; otherwise the emoji glyph.
  if (imageId && hasSceneArt(imageId)) {
    return <div className="adv-art has-img" style={{ backgroundImage: `url(${sceneArtUrl(imageId)})` }} />;
  }
  const emoji = 'art' in scene ? scene.art?.emoji : undefined;
  const npcEmoji = scene.kind === 'dialogue' ? scene.npc.emoji : undefined;
  const glyph = emoji ?? npcEmoji ?? artEmoji(imageId) ?? sceneGlyph(scene);
  return <div className="adv-art"><span className="adv-art-glyph">{glyph}</span></div>;
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
  onNode: (nodeId: string) => void;
  onLeaveShop: () => void;
  onExit(): void;
}

function SceneBody({ scene, state, module, onChoice, onRollScene, onNode, onLeaveShop, onExit }: BodyProps) {
  const campaign = state.campaign;

  if (scene.kind === 'ending') {
    return (
      <div className="adv-scene">
        <h1>{scene.outcome === 'victory' ? '🏆 Victory' : '☠️ Defeat'}</h1>
        {scene.text.map((p, i) => <p key={i} className="adv-text">{p}</p>)}
        <button className="primary" onClick={onExit}>Return to menu</button>
      </div>
    );
  }

  if (scene.kind === 'story' || scene.kind === 'dialogue') {
    const lines = scene.kind === 'story' ? scene.text : scene.lines;
    const options = legalChoices(state, module);
    return (
      <div className="adv-scene">
        {scene.kind === 'dialogue' && (
          <div className="adv-npc">
            {hasArt(scene.npc.portraitId ?? scene.npc.id)
              ? <Portrait id={scene.npc.portraitId ?? scene.npc.id} team="team1" />
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
        </div>
      </div>
    );
  }

  if (scene.kind === 'check') {
    return (
      <div className="adv-scene">
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
    );
  }

  if (scene.kind === 'explore') {
    const nodes = exploreNodes(state, module);
    const theme = scene.map.theme;
    const scrim = 'linear-gradient(rgba(20,16,32,.35), rgba(20,16,32,.7))';
    // Prefer a generated location backdrop; fall back to the combat theme
    // backdrop, then to the plain gradient the CSS already draws.
    const locId = scene.map.art?.imageId;
    const bg = locId && hasSceneArt(locId)
      ? { backgroundImage: `${scrim}, url(${sceneArtUrl(locId)})` }
      : theme && HAS_BOARD_BG.has(theme)
        ? { backgroundImage: `${scrim}, url(${boardBgUrl(theme)})` }
        : undefined;
    return (
      <div className="adv-scene">
        <h2 className="adv-maptitle">{scene.map.title}</h2>
        <div className="adv-map" style={bg}>
          {nodes.map(({ node, blocked, secret, explored }) => (
            <button
              key={node.id}
              className={`adv-node ${blocked ? 'blocked' : ''} ${secret ? 'secret' : ''} ${explored ? 'explored' : 'fog'}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              disabled={!!blocked}
              title={blocked ?? node.label}
              onClick={() => onNode(node.id)}
            >
              <span className="adv-node-icon">{blocked ? '🔒' : node.icon}</span>
              <span className="adv-node-label">{node.label}</span>
            </button>
          ))}
        </div>
        <p className="adv-maphint">Tap a marker to explore. Dimmed markers are unvisited.</p>
      </div>
    );
  }

  if (scene.kind === 'shop') {
    return (
      <AdventureShop
        campaign={campaign}
        {...(scene.stock ? { stock: scene.stock } : {})}
        {...(scene.title ? { title: scene.title } : {})}
        onLeave={onLeaveShop}
      />
    );
  }

  // rest auto-resolves via the effect above; render a brief placeholder.
  return <div className="adv-scene"><p className="adv-text">…</p></div>;
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
