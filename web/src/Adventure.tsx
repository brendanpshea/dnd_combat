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
import { CLASSIC_MODULE } from '../../src/data/modules/classic.js';
import type { BattleProps } from './App.js';
import { Portrait } from './Portrait.js';
import { DiceCheck } from './DiceCheck.js';

interface Props {
  Battle: ComponentType<BattleProps>;
  module?: Module;
  onExit(): void;
}

/** A check event pulled from an action's stream, shown as a dice overlay. */
type DiceOverlay = Extract<AdventureEvent, { type: 'check' }>;

export function AdventureScreen({ Battle, module = CLASSIC_MODULE, onExit }: Props) {
  const stateRef = useRef<AdventureState | null>(null);
  if (!stateRef.current) {
    const campaign = newCampaign(Math.floor(Math.random() * 2 ** 31));
    campaign.partyReady = true;
    stateRef.current = startAdventure(campaign, module);
    enterScene(stateRef.current, module, module.start);
  }
  const state = stateRef.current;
  const campaign = state.campaign;

  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const [dice, setDice] = useState<DiceOverlay | null>(null);
  const [banner, setBanner] = useState<string[]>([]);

  const scene = currentScene(state, module);

  // Auto-resolve shop/rest scenes (the runtime just advances to `next`).
  useEffect(() => {
    if (scene.kind === 'shop' || scene.kind === 'rest') {
      const evs = resolveShopOrRest(state, module);
      note(evs);
      rerender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  function note(events: AdventureEvent[]) {
    const lines: string[] = [];
    for (const e of events) {
      if (e.type === 'gold') lines.push(`${e.amount >= 0 ? '+' : ''}${e.amount} gold`);
      if (e.type === 'item' && e.gained) lines.push(`Gained ${label(e.itemId)}`);
      if (e.type === 'xp') lines.push(`+${e.amount} XP${e.leveledTo ? ` — Level ${e.leveledTo}!` : ''}`);
      if (e.type === 'heal' && e.amount > 0) lines.push(`Healed ${e.amount} HP`);
      if (e.type === 'journal') lines.push(`Journal: ${e.entry.title}`);
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
        <span className="adv-gold">💰 {campaign.gold}</span>
      </div>

      <div className="adv-stage">
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
            onExit={onExit}
          />
        )}

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
  const emoji = 'art' in scene ? scene.art?.emoji : undefined;
  const npcEmoji = scene.kind === 'dialogue' ? scene.npc.emoji : undefined;
  const glyph = emoji ?? npcEmoji ?? sceneGlyph(scene);
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
  onExit(): void;
}

function SceneBody({ scene, state, module, onChoice, onRollScene, onNode, onExit }: BodyProps) {
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
            <Portrait id={scene.npc.portraitId ?? scene.npc.id} team="team1" />
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
    return (
      <div className="adv-scene">
        <h2 className="adv-maptitle">{scene.map.title}</h2>
        <div className="adv-map">
          {nodes.map(({ node, blocked, secret }) => (
            <button
              key={node.id}
              className={`adv-node ${blocked ? 'blocked' : ''} ${secret ? 'secret' : ''}`}
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
      </div>
    );
  }

  // shop/rest auto-resolve via the effect above; render a brief placeholder.
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
