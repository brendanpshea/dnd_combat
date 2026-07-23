/**
 * Adventure mode: plays a module through the pure runtime. Story/dialogue/check
 * /explore scenes render here; battles delegate to the shared <Battle>; shops
 * and rests auto-resolve for now (the full shop UI is a follow-up). The dice
 * ritual (<DiceCheck>) reveals every visible check.
 */
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Combat } from '../../src/engine/combat.js';
import {
  newCampaign, buildCampaignParty, applyAdventureVictory, readBackSurvivors,
  type CampaignState, type AdventureVictory,
  partyStash, claimFromStash, stashItem, giveItem, equipItem, equipBlocked, unequipSlot,
  itemName, itemIcon, type EquipSlot,
  storeSpellActions, useStoreSpell, useStoreHealing, isStoreHealingSource,
  isCampBuffPotion, drinkCampBuffPotion, partyNeedsRest,
  cantripLimit, preparedLimit, preparedSpells, levelForXp,
  hitDiceLeft, hitDiceMax, characterSkills, fullRest,
} from '../../src/campaign/campaign.js';
import { CharacterSheet } from './CharacterSheet.js';
import { seenTips, markTipSeen } from './tips.js';
import { acOf } from '../../src/data/armor.js';
import { SPELLS } from '../../src/data/spells.js';
import { SpellTray } from './SpellTray.js';
import { InfoDot } from './InfoCard.js';
import { infoFor, spellSheet } from './gameInfo.js';
import { SlotPips } from './SlotPips.js';
import { buildEncounter, ENCOUNTERS, MONSTERS } from '../../src/data/monsters.js';
import { MAPS } from '../../src/data/maps.js';
import type { TeamId } from '../../src/engine/types.js';
import {
  startAdventure, currentScene, enterScene, legalChoices, choose, rollSceneCheck,
  legalApproaches, tryApproach,
  exploreNodes, enterNode, resolveBattle, resolveShopOrRest, battleSeed,
  hubReturn, returnToHub, campRule, campRest,
  type AdventureState, type AdventureEvent,
} from '../../src/adventure/runtime.js';
import type { Module, Scene, CampRule } from '../../src/adventure/types.js';
import type { BattleProps } from './App.js';
import { Portrait } from './Portrait.js';
import { DiceCheck } from './DiceCheck.js';
import { AdventureShop } from './AdventureShop.js';
import { JournalDrawer } from './Journal.js';
import { hasSceneArt, sceneArtUrl, hasArt, hasTokenArt, tokenUrl } from './art.js';
import { artEmoji, nodeEmoji } from '../../src/data/adventure-art.js';
import { sfx, initAudio, isMuted, setMuted } from './sound.js';
import { renderProse } from './prose.js';
import { PartySetup } from './PartySetup.js';
import { LootScreen } from './Loot.js';
import { LevelUpModal } from './LevelUp.js';
import { saveAdventureWeb, deleteAdventureWeb } from './adventureStorage.js';
import { moduleById } from '../../src/data/modules/index.js';

interface Props {
  Battle: ComponentType<BattleProps>;
  onExit(): void;
  /** Carry the company into a sequel module (Module.sequel): the App swaps the
   *  adventure screen to `module`, resuming from the freshly-started `state`. */
  onContinue?: ((module: Module, state: AdventureState) => void) | undefined;
}

/** A check event pulled from an action's stream, shown as a dice overlay. */
type DiceOverlay = Extract<AdventureEvent, { type: 'check' }>;

/** Play a module the landing chose (resuming a save if one was handed in). */
export function AdventureScreen(
  { Battle, module, resume, onExit, onContinue }: Props & { module: Module; resume?: AdventureState },
) {
  return (
    <AdventurePlayer
      key={module.id + (resume ? '-resume' : '-new')}
      Battle={Battle} module={module} {...(resume ? { resume } : {})} onExit={onExit} onContinue={onContinue}
    />
  );
}

/** The dice overlay plus the scene the player triggered it from, so the roll
 *  renders over the *place and person* they were interacting with (the runtime
 *  has already advanced past that scene by the time we show the dice). */
interface DiceContext { roll: DiceOverlay['roll']; from: Scene; }

/** A modal shown over the (already-advanced) scene before the player acts on
 *  it: encounter loot, then outcome narration + reward chips. */
type Overlay =
  | { kind: 'loot'; victory: AdventureVictory }
  | { kind: 'result'; paragraphs: string[]; rewards: string[] }
  // A level-up always gets its own modal — battle or milestone — so a new level
  // never slips by in a one-line banner.
  | { kind: 'levelup'; fromLevel: number; toLevel: number };

/** The location backdrop art id for a scene (its own, or an explore map's). */
function artIdOf(scene: Scene): string | undefined {
  if (scene.kind === 'explore') return scene.map.art?.imageId;
  return 'art' in scene ? scene.art?.imageId : undefined;
}

/** New runs assemble a party first (resumes skip straight to the saved run). */
function AdventurePlayer({ Battle, module, resume, onExit, onContinue }: Props & { module: Module; resume?: AdventureState }) {
  const [state, setState] = useState<AdventureState | null>(resume ?? null);
  const campaignRef = useRef<CampaignState | null>(null);
  if (!state && !campaignRef.current) {
    // Leave partyReady false during setup so class/species swaps are allowed;
    // it's locked in on Begin.
    campaignRef.current = newCampaign(Math.floor(Math.random() * 2 ** 31));
  }
  if (!state) {
    return (
      <PartySetup
        campaign={campaignRef.current!}
        onExit={onExit}
        onBegin={() => {
          campaignRef.current!.partyReady = true;
          const s = startAdventure(campaignRef.current!, module);
          enterScene(s, module, module.start);
          setState(s);
        }}
      />
    );
  }
  return <AdventureGame Battle={Battle} module={module} state={state} onExit={onExit} onContinue={onContinue} />;
}

function AdventureGame({ Battle, module, state, onExit, onContinue }: Props & { module: Module; state: AdventureState }) {
  const campaign = state.campaign;

  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const [dice, setDice] = useState<DiceContext | null>(null);
  const [banner, setBanner] = useState<string[]>([]);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalUnread, setJournalUnread] = useState(false);
  const [campOpen, setCampOpen] = useState(false);
  // "Needs a rest" nudge: the amber dot on the Party pill, plus a one-time tip
  // the first time the party is worn down outside battle (restTip computed once
  // `scene` is known, below).
  const needsRest = partyNeedsRest(campaign);
  const [restTipDismissed, setRestTipDismissed] = useState(() => seenTips().has('needs-rest'));
  const dismissRestTip = () => { markTipSeen('needs-rest'); setRestTipDismissed(true); };
  /** After a long rest, the queue of prepared-caster indices still to re-prepare
   *  — the only place spells may be re-chosen (2024 rules: prepared changes on a
   *  long rest; cantrips/spellbook are locked in). Empty = no tray showing. */
  const [reprepare, setReprepare] = useState<number[]>([]);
  const [muted, setMutedState] = useState(isMuted());
  /** Shop focus (which hero the buy/sell view is scoped to) — lifted here so
   *  the bottom party strip doubles as the shop's hero selector instead of the
   *  shop repeating the party's portraits as its own chip row. */
  const [shopFocus, setShopFocus] = useState<number | 'all' | 'stash'>('all');
  /** How many story/dialogue beats are revealed — a scene's paragraphs unveil
   *  one tap at a time, so prose reads like a paced scene, not a wall of text. */
  const [beat, setBeat] = useState(0);
  /** The battle scene the player has hit "Fight" on. A battle first shows a
   *  pre-fight intro (enemy portraits + set-up text); only after arming it does
   *  the shared Combat mount, so a fight always opens with a beat, not a jolt. */
  const [armedBattle, setArmedBattle] = useState<string | null>(null);
  /** Last scene that carried a location backdrop — inherited by scenes that
   *  don't declare their own, so a whole conversation stays *in* the tavern. */
  const locationArt = useRef<string | undefined>(undefined);
  /** Whether the scene we most recently entered was a revisit (from the runtime
   *  `scene` event). A revisit (the inn after a check) opens fully revealed, no
   *  re-tapping through prose. Set by the one-shot event handlers — not the
   *  render effect, which StrictMode double-invokes. */
  const sceneRevisitRef = useRef(false);
  /** A queue of result overlays (loot, then outcome narration) shown over the
   *  advanced scene before the player acts on it. The single feedback surface:
   *  every check/battle outcome reports here, so success is never mute. */
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  /** Overlays / banner deferred until a dice roll finishes (the roll first). */
  const pendingOverlays = useRef<Overlay[]>([]);
  const pendingBanner = useRef<string[]>([]);

  const scene = currentScene(state, module);
  const restTip = needsRest && !restTipDismissed && !campOpen &&
    (scene.kind === 'explore' || scene.kind === 'story' || scene.kind === 'dialogue');

  // Persist the run on every scene change; clear it once the adventure ends
  // (a finished run shouldn't offer Resume).
  useEffect(() => {
    if (scene.kind === 'ending') {
      sfx(scene.outcome === 'victory' ? 'victory' : 'death');
      deleteAdventureWeb();
    } else {
      saveAdventureWeb(state);
    }
    setShopFocus('all'); // a fresh shop starts on the whole party
    // A revisited scene opens fully revealed; a fresh one paces from beat 0.
    setBeat(sceneRevisitRef.current ? Number.MAX_SAFE_INTEGER : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  /** Record whether the scene an event stream lands on was a revisit. */
  function markRevisit(events: AdventureEvent[]) {
    const s = [...events].reverse().find((e) => e.type === 'scene');
    if (s && s.type === 'scene') sceneRevisitRef.current = s.revisit;
  }

  /** The prepared spellcasters, in party order — who a long rest lets re-prepare. */
  const casterIdxs = () => campaign.characters.map((_, i) => i).filter((i) => preparedLimit(campaign, i) > 0);

  // Rest scenes auto-resolve (they only heal and advance). Shops render a panel.
  useEffect(() => {
    if (scene.kind === 'rest') {
      const isLong = scene.variant === 'long';
      const evs = resolveShopOrRest(state, module);
      markRevisit(evs);
      const { overlays, banner } = presentFeedback(evs);
      setOverlays(overlays);
      setBanner(banner);
      // A long rest is the moment to re-prepare spells (an inn bed, a safe camp).
      if (isLong) setReprepare(casterIdxs());
      rerender();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  /** The reward/narration lines an event stream carries (plays their sounds). */
  function feedback(events: AdventureEvent[]): { paragraphs: string[]; rewards: string[] } {
    const paragraphs: string[] = [];
    const rewards: string[] = [];
    for (const e of events) {
      if (e.type === 'text') paragraphs.push(...e.paragraphs);
      if (e.type === 'gold' && e.amount !== 0) { rewards.push(`${e.amount >= 0 ? '+' : ''}${e.amount} gold`); sfx('coin'); }
      if (e.type === 'item' && e.gained) { rewards.push(`Gained ${label(e.itemId)}`); sfx('item'); }
      if (e.type === 'xp') { rewards.push(`+${e.amount} XP${e.leveledTo ? ` — Level ${e.leveledTo}!` : ''}`); sfx(e.leveledTo ? 'levelup' : 'item'); }
      if (e.type === 'heal' && e.amount > 0) { rewards.push(`Healed ${e.amount} HP`); sfx('heal'); }
      if (e.type === 'journal') { rewards.push(`📖 ${e.entry.title}`); sfx('page'); setJournalUnread(true); }
    }
    return { paragraphs, rewards };
  }

  /** How an event stream's feedback presents. Only events *before* the scene
   *  transition count — an outcome's narration and rewards precede `enterScene`,
   *  while the destination scene's own prose comes after (rendered by the scene,
   *  not repeated here). A *narrated* outcome (check result, battle) earns a
   *  result beat with its reward chips; bare rewards (a journal grant on a plain
   *  choice) take the transient banner instead — no modal for walking in a door. */
  function presentFeedback(events: AdventureEvent[]): { overlays: Overlay[]; banner: string[] } {
    const sceneIdx = events.findIndex((e) => e.type === 'scene');
    const outcome = sceneIdx >= 0 ? events.slice(0, sceneIdx) : events;
    const { paragraphs, rewards } = feedback(outcome);
    const overlays: Overlay[] = [];
    if (paragraphs.length) overlays.push({ kind: 'result', paragraphs, rewards });
    // A level-up in this stream (e.g. a milestone XP grant on a plain choice)
    // earns its own modal, shown after any result beat.
    const levelled = [...outcome].reverse().find(
      (e): e is Extract<AdventureEvent, { type: 'xp' }> => e.type === 'xp' && e.leveledTo !== undefined,
    );
    if (levelled?.leveledTo) overlays.push({ kind: 'levelup', fromLevel: levelled.leveledFrom ?? levelled.leveledTo - 1, toLevel: levelled.leveledTo });
    // Bare rewards (no prose, no level-up) take the transient banner instead —
    // no modal for walking in a door.
    const banner = overlays.length ? [] : rewards;
    return { overlays, banner };
  }

  /** Run an action's events. `from` is the scene the player acted from — if the
   *  action rolled a check, the dice reveal renders over that scene's place and
   *  NPC, not the scene the runtime has already advanced to; the result beat
   *  then follows the roll. */
  function process(events: AdventureEvent[], from: Scene) {
    markRevisit(events);
    const { overlays, banner } = presentFeedback(events);
    const check = [...events].reverse().find((e): e is DiceOverlay => e.type === 'check');
    if (check) {
      // Roll first; the result beat (or reward banner) follows the dice.
      setDice({ roll: check.roll, from });
      pendingOverlays.current = overlays;
      pendingBanner.current = banner;
    } else {
      setOverlays(overlays);
      setBanner(banner);
      rerender();
    }
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

  function onApproach(approachId: string, actorIdx?: number) {
    setBanner([]);
    const from = scene;
    process(tryApproach(state, module, approachId, actorIdx), from);
  }

  function onLeave() {
    setBanner([]);
    process(returnToHub(state, module), scene);
  }

  function afterDice() {
    setDice(null);
    setOverlays(pendingOverlays.current); // the result beat follows the roll
    setBanner(pendingBanner.current);
    pendingOverlays.current = [];
    pendingBanner.current = [];
    rerender();
  }

  // --- Battle scene: a pre-fight intro, then the shared Battle component ---
  if (scene.kind === 'battle') {
    const enc = ENCOUNTERS[scene.encounterId];
    if (armedBattle !== scene.id) {
      return (
        <BattleIntro
          scene={scene}
          onFight={() => { sfx('melee'); setArmedBattle(scene.id); }}
          onExit={onExit}
        />
      );
    }
    const combat = new Combat({
      seed: battleSeed(state, scene.id),
      mapId: scene.mapId,
      combatants: [...buildCampaignParty(campaign), ...buildEncounter(scene.encounterId, 'team2', 7)],
      ...(scene.surprise ? { surprisedTeam: (scene.surprise === 'enemies' ? 'team2' : 'team1') as TeamId } : {}),
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
          const battleScene = scene; // capture: resolveBattle advances state
          const levelBefore = levelForXp(campaign.xp);
          let victory: AdventureVictory | undefined;
          if (won) {
            const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
            if (battleScene.loot === false) {
              readBackSurvivors(campaign, survivors); // gear persists; no rewards
            } else {
              victory = applyAdventureVictory(
                campaign, survivors, battleScene.encounterId, combat.state.rng, battleScene.loot?.bonusTier,
              );
            }
          }
          setArmedBattle(null); // re-arm the intro if a later fight reuses this
          // Loot ceremony (won fights with rewards), then the onWin/onLoss beat.
          const outcome = resolveBattle(state, module, won);
          markRevisit(outcome);
          // presentFeedback may itself queue a levelup (from an onWin xp effect);
          // strip it so the battle's own end-to-end level check owns the modal.
          const { overlays, banner } = presentFeedback(outcome);
          const queue: Overlay[] = [];
          if (victory && (victory.gold > 0 || victory.items.length > 0 || victory.xpGained > 0)) {
            queue.push({ kind: 'loot', victory });
          }
          queue.push(...overlays.filter((o) => o.kind !== 'levelup'));
          // One level-up modal for the whole resolution (combat XP + any onWin
          // grant), shown last — the clear "you reached Level N" announcement.
          const levelAfter = levelForXp(campaign.xp);
          if (levelAfter > levelBefore) { sfx('levelup'); queue.push({ kind: 'levelup', fromLevel: levelBefore, toLevel: levelAfter }); }
          setOverlays(queue);
          setBanner(banner);
          rerender();
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
        <button className="ghost adv-journal-btn" title={muted ? 'Unmute' : 'Mute'}
          onClick={() => { const m = !muted; setMuted(m); setMutedState(m); if (!m) initAudio(); }}>
          {muted ? '🔇' : '🔊'}
        </button>
        <span className="adv-gold">💰 {campaign.gold}</span>
      </div>

      {journalOpen && <JournalDrawer entries={state.journal} flags={state.flags} onClose={() => setJournalOpen(false)} />}
      {campOpen && (
        <CampScreen
          campaign={campaign}
          camp={campRule(state, module)}
          onRest={(variant) => {
            const evs = campRest(state, module, variant);
            setCampOpen(false);
            process(evs, scene);
            // A long rest at camp is also when spells get re-prepared.
            if (variant === 'long') setReprepare(casterIdxs());
          }}
          onChange={() => { saveAdventureWeb(state); rerender(); }}
          onClose={() => setCampOpen(false)}
        />
      )}

      {/* Post-long-rest: walk each prepared caster through re-preparing (the only
          place spells change, with cantrips/spellbook locked). */}
      {reprepare.length > 0 && (
        <SpellTray
          // Keyed per caster: the queue shifts in place (reprepare[0] changes
          // without unmounting), so without a key the tray would keep the first
          // caster's seeded drafts and show, e.g., the wizard's cantrips on the
          // cleric. The key forces a fresh mount — and fresh useState seeds.
          key={reprepare[0]!}
          campaign={campaign}
          idx={reprepare[0]!}
          mode="prepare"
          onClose={() => setReprepare((q) => q.slice(1))}
          onSaved={() => { saveAdventureWeb(state); rerender(); }}
        />
      )}

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
              onApproach={onApproach}
              onLeave={onLeave}
              onNode={(nodeId) => process(enterNode(state, module, nodeId), scene)}
              onBlockedNode={(reason) => setBanner([reason])}
              onLeaveShop={() => process(resolveShopOrRest(state, module), scene)}
              onShopRoll={(events) => process(events, scene)}
              onShopChange={() => { saveAdventureWeb(state); rerender(); }}
              shopFocus={shopFocus}
              setShopFocus={setShopFocus}
              beat={beat}
              onAdvanceBeat={() => setBeat((b) => b + 1)}
              onExit={onExit}
              onContinue={onContinue}
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

        {/* Result beats (loot, then outcome narration) over the advanced scene. */}
        {!dice && overlays.length > 0 && (() => {
          const ov = overlays[0]!;
          const advance = () => setOverlays((o) => o.slice(1));
          if (ov.kind === 'loot') {
            return (
              <div className="adv-dice-scrim adv-loot-scrim">
                <LootScreen
                  campaign={campaign}
                  gold={ov.victory.gold}
                  items={ov.victory.items}
                  xpGained={ov.victory.xpGained}
                  leveledTo={ov.victory.leveledTo}
                  onContinue={advance}
                />
              </div>
            );
          }
          if (ov.kind === 'levelup') {
            return (
              <LevelUpModal
                campaign={campaign}
                fromLevel={ov.fromLevel}
                toLevel={ov.toLevel}
                onChange={() => { saveAdventureWeb(state); rerender(); }}
                onClose={advance}
              />
            );
          }
          return (
            <div className="adv-dice-scrim">
              <div className="adv-panel adv-result">
                {ov.paragraphs.map((p, i) => <p key={i} className="adv-text">{renderProse(p)}</p>)}
                {ov.rewards.length > 0 && (
                  <div className="adv-result-rewards">
                    {ov.rewards.map((r, i) => <span key={i} className="adv-reward-chip">{r}</span>)}
                  </div>
                )}
                <button className="primary" onClick={advance}>Continue</button>
              </div>
            </div>
          );
        })()}
      </div>

      {scene.kind !== 'ending' && !dice && (
        <PartyStrip
          campaign={campaign}
          onJournal={() => { setJournalUnread(false); setJournalOpen(true); }}
          onCamp={() => { setCampOpen(true); if (!restTipDismissed) dismissRestTip(); }}
          journalCount={state.journal.length}
          journalUnread={journalUnread}
          needsRest={needsRest}
          {...(scene.kind === 'shop' ? {
            onSelect: (i: number) => setShopFocus((f) => (f === i ? 'all' : i)),
            ...(typeof shopFocus === 'number' ? { active: shopFocus } : {}),
          } : {})}
        />
      )}

      {/* One-time nudge the first time the party is worn down out of battle —
          teaches the rest loop a new 5e player won't know to reach for. */}
      {restTip && (
        <div className="tip-toast adv-rest-tip" role="status">
          <span className="tip-icon">🏕️</span>
          <div className="tip-text">
            <strong>Your party is hurting</strong>
            <p>Tap <b>🎒 Party</b> below to make camp. A <b>short rest</b> spends hit dice to heal; a <b>long rest</b> (in town, or at a safe camp) restores HP and spells.</p>
          </div>
          <button className="tip-close" aria-label="Dismiss" onClick={dismissRestTip}>✕</button>
        </div>
      )}
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

/** The beat before a fight: the set-up text and the faces you're about to
 *  meet. Distinct enemy types are shown as portraits with a count, so a battle
 *  reads as an encounter with *someone*, not a sudden grid. Reusable by any
 *  module — it derives everything from the encounter's roster. */
function BattleIntro(
  { scene, onFight, onExit }: { scene: Extract<Scene, { kind: 'battle' }>; onFight: () => void; onExit: () => void },
) {
  const enc = ENCOUNTERS[scene.encounterId];
  // Distinct monster types in roster order, with how many of each.
  const roster: Array<{ id: string; count: number }> = [];
  for (const id of enc?.members ?? []) {
    const seen = roster.find((r) => r.id === id);
    if (seen) seen.count++; else roster.push({ id, count: 1 });
  }
  const artId = artIdOf(scene);
  return (
    <div className="adventure">
      <div className="adv-stage">
        <Backdrop artId={artId} glyph={sceneGlyph(scene)} />
        <div className="adv-content">
          <div className="adv-scene centered">
            <div className="adv-panel adv-battle-intro">
              <h2 className="adv-battle-title">{enc?.name ?? 'A Fight!'}</h2>
              {(scene.intro ?? ['They move to attack!']).map((p, i) => (
                <p key={i} className="adv-text">{renderProse(p)}</p>
              ))}
              <div className="adv-foes">
                {roster.map(({ id, count }) => (
                  <div key={id} className="adv-foe">
                    {hasArt(id)
                      ? <Portrait id={id} team="team2" big />
                      : <span className="adv-foe-emoji">👹</span>}
                    <span className="adv-foe-name">
                      {MONSTERS[id]?.name ?? label(id)}{count > 1 ? ` ×${count}` : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div className="adv-choices">
                <button className="adv-choice primary adv-fight" onClick={onFight}>
                  <span>⚔️ Fight!</span>
                </button>
                <button className="adv-choice adv-leave" onClick={onExit}>
                  <span>✕ Menu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A non-interactive snapshot of a story/dialogue/check scene — the NPC and
 *  their words — shown behind the dice modal so the roll happens *in* the scene. */
function FrozenScene({ scene }: { scene: Scene }) {
  const lines = scene.kind === 'story' ? scene.text
    : scene.kind === 'dialogue' ? scene.lines
    : scene.kind === 'check' ? scene.intro
    : scene.kind === 'challenge' ? scene.intro : [];
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
        {lines.map((p, i) => <p key={i} className="adv-text">{renderProse(p)}</p>)}
      </div>
    </div>
  );
}

/** A compact party read-out (portrait + HP) at the base of most scenes. In the
 *  shop it doubles as the hero selector: `onSelect` makes each member tappable
 *  to scope buy/sell to them, and `active` marks the chosen one. */
/** The persistent status bar: party portraits + HP, and — since it's the one
 *  element on every scene — the Journal and Party/Camp affordances, moved here
 *  out of the top bar (bottom-anchored, thumb-reachable, styled like the rest). */
function PartyStrip(
  { campaign, active, onSelect, onJournal, onCamp, journalCount, journalUnread, needsRest }: {
    campaign: CampaignState; active?: number; onSelect?: (i: number) => void;
    onJournal?: () => void; onCamp?: () => void; journalCount?: number; journalUnread?: boolean;
    needsRest?: boolean;
  },
) {
  const party = buildCampaignParty(campaign);
  const selectable = !!onSelect;
  return (
    <div className={`adv-party-strip ${selectable ? 'selectable' : ''}`}>
      <div className="adv-party-members">
        {party.map((c, i) => {
          const pct = Math.max(0, Math.round((c.hp / c.maxHp) * 100));
          const body = (
            <>
              {hasArt(campaign.characters[i]?.portraitId ?? c.classId)
                ? <Portrait id={campaign.characters[i]?.portraitId ?? c.classId} team="team1" />
                : <span className="adv-party-emoji">🧑</span>}
              <div className="adv-party-hpbar"><div style={{ width: `${pct}%` }} /></div>
              <span className="adv-party-hp">{c.hp}/{c.maxHp}</span>
            </>
          );
          const cls = `adv-party-member ${c.hp === 0 ? 'down' : ''} ${active === i ? 'active' : ''}`;
          return selectable
            ? <button key={i} className={cls} onClick={() => onSelect!(i)}
                title={`Focus ${campaign.characters[i]?.name}`}>{body}</button>
            : <div key={i} className={cls}>{body}</div>;
        })}
      </div>
      {(onJournal || onCamp) && (
        <div className="adv-strip-actions">
          {onJournal && (
            <button className="adv-strip-pill" onClick={onJournal} title="Journal">
              📖<span className="adv-pill-label">Journal</span>
              {journalUnread && <span className="adv-pill-dot" aria-label="new entry" />}
              {!journalUnread && journalCount ? <span className="adv-pill-count">{journalCount}</span> : null}
            </button>
          )}
          {onCamp && (
            <button className={`adv-strip-pill ${needsRest ? 'wants-rest' : ''}`} onClick={onCamp}
              title={needsRest ? 'Party is hurt — make camp to rest' : 'Party & camp'}>
              🎒<span className="adv-pill-label">Party</span>
              {needsRest && <span className="adv-pill-rest" aria-label="party needs rest" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const EQUIP_SLOTS: EquipSlot[] = ['mainHand', 'offHand', 'armor', 'trinket'];

type CampPick =
  | { kind: 'pack'; charIdx: number; itemId: string }
  | { kind: 'stash'; itemId: string }
  | { kind: 'equipped'; charIdx: number; slot: EquipSlot; itemId: string }
  | { kind: 'spell'; charIdx: number; spellId: string }
  | null;

/** The party screen: gear management is always available (you can rummage your
 *  packs anywhere); Rest only appears where the location is campable (`camp`).
 *  Tap an item, then choose what to do with it — the same verb-after-noun flow
 *  as the campaign's between-battle screen, reusing the same state helpers. */
function CampScreen(
  { campaign, camp, onRest, onChange, onClose }: {
    campaign: CampaignState;
    camp: CampRule | null;
    onRest: (variant: 'short' | 'long') => void;
    onChange: () => void;
    onClose: () => void;
  },
) {
  const [picked, setPicked] = useState<CampPick>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheetIdx, setSheetIdx] = useState<number | null>(null);
  const party = buildCampaignParty(campaign);
  const stash = partyStash(campaign).filter((s) => s.qty > 0);

  const act = (fn: () => boolean | void, msg: string) => {
    fn();
    setPicked(null);
    if (msg) setNotice(msg); // '' lets fn set its own notice (e.g. heal amounts)
    onChange();
  };

  return (
    <div className="adv-camp-scrim" onClick={onClose}>
      <div className="adv-camp" onClick={(e) => e.stopPropagation()}>
        <div className="adv-camp-head">
          <h2>🎒 Party</h2>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        {/* Rest — only where you can safely (or riskily) make camp. */}
        <div className="adv-camp-rest">
          {camp ? (
            <>
              <div className="adv-rest-btns">
                <button className="primary" onClick={() => onRest('short')}>🌤 Short rest</button>
                <button className="primary" onClick={() => onRest('long')}>🌙 Long rest</button>
              </div>
              {camp.risky && (
                <p className="adv-rest-warn">⚠ This is open country — a long rest here may be interrupted.</p>
              )}
            </>
          ) : (
            <p className="adv-rest-warn muted">No safe place to rest here. You can still sort your gear.</p>
          )}
        </div>

        {notice && <p className="adv-camp-notice">{notice}</p>}

        {/* Party loot: claim shared items to a chosen hero. */}
        {stash.length > 0 && (
          <div className="adv-camp-stash">
            <span className="adv-camp-label">🎁 Party Loot</span>
            <div className="adv-camp-items">
              {stash.map((s) => (
                <button
                  key={s.itemId}
                  className={`adv-item ${picked?.kind === 'stash' && picked.itemId === s.itemId ? 'sel' : ''}`}
                  onClick={() => setPicked(picked?.kind === 'stash' && picked.itemId === s.itemId ? null : { kind: 'stash', itemId: s.itemId })}
                >
                  {itemIcon(s.itemId)} {itemName(s.itemId)}{s.qty > 1 ? ` ×${s.qty}` : ''}
                </button>
              ))}
            </div>
            {picked?.kind === 'stash' && (
              <div className="adv-item-acts">
                <InfoDot sheet={infoFor(picked.itemId)} />
                <span className="muted">Give to:</span>
                {campaign.characters.map((ch, i) => (
                  <button key={i} onClick={() => act(() => claimFromStash(campaign, i, picked.itemId), `${ch.name} takes ${itemName(picked.itemId)}`)}>
                    {ch.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Each hero: worn gear (tap to unequip) + pack (tap for equip/give/stash). */}
        {campaign.characters.map((ch, idx) => (
          <div key={idx} className="adv-camp-char">
            <div
              className="adv-camp-charhead adv-camp-charhead-tap"
              role="button"
              tabIndex={0}
              title="Tap for full character sheet"
              onClick={() => setSheetIdx(idx)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheetIdx(idx); } }}
            >
              {hasArt(ch.portraitId ?? ch.classId)
                ? <Portrait id={ch.portraitId ?? ch.classId} team="team1" />
                : <span className="adv-party-emoji">🧑</span>}
              <div>
                <strong>{ch.name} <span className="adv-camp-sheethint">ⓘ</span></strong>
                <span className="muted"> · HP {party[idx]!.hp}/{party[idx]!.maxHp} · 🛡 {acOf(party[idx]!)}</span>
                {/* Hit dice left to spend on a short rest — a die per level,
                    refreshed (half) by a long rest. A short rest auto-spends
                    them to heal. */}
                <span className="muted adv-camp-hd" title="Hit dice — spent on a short rest to heal, half restored by a long rest">
                  {' '}· 🎲 {hitDiceLeft(campaign, idx)}/{hitDiceMax(campaign)} HD
                </span>
                {/* Active camp-drunk buff potions (until the next rest), so a
                    drink you took before the fight visibly stuck. */}
                {(() => {
                  const eff = ch.resources?.effects;
                  const chips: string[] = [];
                  if (eff?.giantStrength) chips.push(`💪 Str ${eff.giantStrength}`);
                  for (const r of eff?.resistances ?? []) chips.push(`🛡 ${r} resist`);
                  return chips.length ? (
                    <span className="muted adv-camp-buffs" title="Camp buff — lasts until the next short or long rest">
                      {' · '}{chips.join(' · ')}
                    </span>
                  ) : null;
                })()}
                {/* Spell slots remaining, per level (renders nothing for a
                    non-caster) — so a wizard down to 1 of 2 first-level slots
                    reads at a glance, and "rest to recover" has a visible meter. */}
                <div className="adv-camp-slots"><SlotPips spellSlots={party[idx]!.spellSlots} /></div>
              </div>
            </div>

            <div className="adv-camp-gear">
              {EQUIP_SLOTS.map((slot) => {
                const held = ch.equipped[slot];
                if (!held) return null;
                const sel = picked?.kind === 'equipped' && picked.charIdx === idx && picked.slot === slot;
                return (
                  <button
                    key={slot}
                    className={`adv-item gear ${sel ? 'sel' : ''}`}
                    onClick={() => setPicked(sel ? null : { kind: 'equipped', charIdx: idx, slot, itemId: held })}
                  >
                    {itemIcon(held)} {itemName(held)}
                  </button>
                );
              })}
            </div>
            {picked?.kind === 'equipped' && picked.charIdx === idx && (
              <div className="adv-item-acts">
                <InfoDot sheet={infoFor(picked.itemId)} />
                <button onClick={() => act(() => unequipSlot(campaign, idx, picked.slot), `${ch.name} stows ${itemName(picked.itemId)}`)}>Unequip</button>
              </div>
            )}

            <div className="adv-camp-items">
              {ch.inventory.filter((s) => s.qty > 0).map((s) => {
                const sel = picked?.kind === 'pack' && picked.charIdx === idx && picked.itemId === s.itemId;
                return (
                  <button
                    key={s.itemId}
                    className={`adv-item ${sel ? 'sel' : ''}`}
                    onClick={() => setPicked(sel ? null : { kind: 'pack', charIdx: idx, itemId: s.itemId })}
                  >
                    {itemIcon(s.itemId)} {itemName(s.itemId)}{s.qty > 1 ? ` ×${s.qty}` : ''}
                  </button>
                );
              })}
              {ch.inventory.every((s) => s.qty <= 0) && <span className="muted">(pack empty)</span>}
            </div>
            {picked?.kind === 'pack' && picked.charIdx === idx && (
              <div className="adv-item-acts">
                <InfoDot sheet={infoFor(picked.itemId)} />
                {EQUIP_SLOTS.filter((slot) => equipBlocked(campaign, idx, picked.itemId, slot) === undefined).map((slot) => (
                  <button key={slot} onClick={() => act(() => equipItem(campaign, idx, picked.itemId, slot), `${ch.name} equips ${itemName(picked.itemId)}`)}>
                    Equip{slot === 'offHand' ? ' (off-hand)' : slot === 'mainHand' ? ' (main)' : ''}
                  </button>
                ))}
                {isStoreHealingSource(picked.itemId) && campaign.characters.map((target, t) => (
                  <button key={`h${t}`} onClick={() => act(() => {
                    const r = useStoreHealing(campaign, idx, t, picked.itemId as Parameters<typeof useStoreHealing>[3]);
                    setNotice(r ? `${ch.name} heals ${target.name} for ${r.healed} HP.` : 'Nothing to heal.');
                  }, '')}>
                    💚 {target.name}
                  </button>
                ))}
                {isCampBuffPotion(picked.itemId) && (
                  <button onClick={() => act(() => {
                    const msg = drinkCampBuffPotion(campaign, idx, picked.itemId);
                    if (msg) setNotice(msg);
                  }, '')}>
                    🧪 Drink now
                  </button>
                )}
                {campaign.characters.map((other, j) => j === idx ? null : (
                  <button key={j} onClick={() => act(() => giveItem(campaign, idx, j, picked.itemId), `${other.name} takes ${itemName(picked.itemId)}`)}>
                    → {other.name}
                  </button>
                ))}
                <button onClick={() => act(() => stashItem(campaign, idx, picked.itemId), `${itemName(picked.itemId)} to party loot`)}>Stash</button>
              </div>
            )}

            {/* Camp spellcasting: Cure Wounds, Mage Armor, Find Familiar, … —
                the same out-of-combat casts as the old between-battle store. */}
            {(() => {
              const spells = storeSpellActions(party[idx]!);
              const canPrepare = cantripLimit(campaign, idx) > 0;
              if (spells.length === 0 && !canPrepare) return null;
              return (
                <>
                  <div className="adv-camp-items">
                    {canPrepare && (
                      // Re-preparing is a long-rest activity (camp or inn), not a
                      // free swap — so this is a read-out, not a button.
                      <span className="adv-item muted" title="Prepared spells change when you take a long rest">
                        📖 Prepared {preparedSpells(campaign, idx).length}/{preparedLimit(campaign, idx)} · rest to change
                      </span>
                    )}
                    {spells.map((sp) => {
                      const sel = picked?.kind === 'spell' && picked.charIdx === idx && picked.spellId === sp.spellId;
                      const slotIdx = (SPELLS[sp.spellId]?.level ?? 1) - 1;
                      const outOfSlots = !sp.ritual && (party[idx]!.spellSlots[slotIdx]?.current ?? 0) <= 0;
                      return (
                        <button
                          key={sp.spellId}
                          className={`adv-item ${sel ? 'sel' : ''}`}
                          disabled={outOfSlots}
                          title={outOfSlots ? 'No spell slots left — rest to recover them' : undefined}
                          onClick={() => setPicked(sel ? null : { kind: 'spell', charIdx: idx, spellId: sp.spellId })}
                        >
                          {sp.icon} {sp.name}
                        </button>
                      );
                    })}
                  </div>
                  {picked?.kind === 'spell' && picked.charIdx === idx && (() => {
                    const sp = spells.find((s) => s.spellId === picked.spellId)!;
                    return (
                      <div className="adv-item-acts">
                        <InfoDot sheet={spellSheet(sp.spellId)} />
                        {sp.targeting === 'self' && (
                          <button onClick={() => act(() => {
                            useStoreSpell(campaign, idx, sp.spellId);
                          }, `${ch.name} ${sp.castNotice ?? `casts ${sp.name}`}.`)}>
                            {sp.castLabel ?? 'Cast'}
                          </button>
                        )}
                        {isStoreHealingSource(sp.spellId) && campaign.characters.map((target, t) => (
                          <button key={t} onClick={() => act(() => {
                            const r = useStoreHealing(campaign, idx, t, sp.spellId as Parameters<typeof useStoreHealing>[3]);
                            setNotice(r ? `${ch.name} heals ${target.name} for ${r.healed} HP.` : 'No slots left.');
                          }, '')}>
                            💚 {target.name}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {sheetIdx !== null && campaign.characters[sheetIdx] && party[sheetIdx] && (
        <CharacterSheet
          c={party[sheetIdx]!}
          subtitle={`${label(campaign.characters[sheetIdx]!.classId)} · Level ${levelForXp(campaign.xp)}`}
          skills={characterSkills(campaign, sheetIdx)}
          onClose={() => setSheetIdx(null)}
        />
      )}
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
  onApproach: (id: string, actorIdx?: number) => void;
  onLeave: () => void;
  onNode: (nodeId: string) => void;
  onBlockedNode: (reason: string) => void;
  onLeaveShop: () => void;
  onShopRoll: (events: AdventureEvent[]) => void;
  onShopChange: () => void;
  shopFocus: number | 'all' | 'stash';
  setShopFocus: (f: number | 'all' | 'stash') => void;
  beat: number;
  onAdvanceBeat: () => void;
  onExit(): void;
  onContinue?: ((module: Module, state: AdventureState) => void) | undefined;
}

function SceneBody({ scene, state, module, onChoice, onRollScene, onApproach, onLeave, onNode, onBlockedNode, onLeaveShop, onShopRoll, onShopChange, shopFocus, setShopFocus, beat, onAdvanceBeat, onExit, onContinue }: BodyProps) {
  const campaign = state.campaign;

  if (scene.kind === 'ending') {
    // A victory in a module with a sequel offers to carry the company onward —
    // the same CampaignState (party, XP, gold, gear) walks into the next part.
    const sequel = scene.outcome === 'victory' && module.sequel ? moduleById(module.sequel) : undefined;
    return (
      <div className="adv-scene centered">
        <div className="adv-panel">
          <h1>{scene.outcome === 'victory' ? '🏆 Victory' : '☠️ Defeat'}</h1>
          {scene.text.map((p, i) => <p key={i} className="adv-text">{renderProse(p)}</p>)}
          {sequel && onContinue && (
            <button
              className="primary"
              onClick={() => {
                // Days on the road between chapters: the company arrives fresh.
                fullRest(campaign);
                const next = startAdventure(campaign, sequel);
                enterScene(next, sequel, sequel.start);
                saveAdventureWeb(next);
                onContinue(sequel, next);
              }}
            >
              ⚔️ Continue the company → {sequel.title}
              {sequel.levelBand ? ` (levels ${sequel.levelBand.from}–${sequel.levelBand.to})` : ''}
            </button>
          )}
          <button className={sequel && onContinue ? 'ghost' : 'primary'} onClick={onExit}>Return to menu</button>
        </div>
      </div>
    );
  }

  if (scene.kind === 'story' || scene.kind === 'dialogue') {
    const lines = scene.kind === 'story' ? scene.text : scene.lines;
    // Beats reveal one tap at a time; choices wait until the prose is finished.
    const revealed = Math.min(beat, lines.length - 1);
    const shown = lines.slice(0, revealed + 1);
    const hasMore = revealed < lines.length - 1;
    const options = legalChoices(state, module);
    const leaveTo = hubReturn(state, module);
    return (
      // Bottom-anchored panel over the location backdrop (visual-novel style).
      <div className="adv-scene bottom">
        <div className={`adv-panel ${hasMore ? 'advancing' : ''}`} onClick={hasMore ? onAdvanceBeat : undefined}>
          {scene.kind === 'dialogue' && (
            <div className="adv-npc">
              {hasArt(scene.npc.portraitId ?? scene.npc.id)
                ? <Portrait id={scene.npc.portraitId ?? scene.npc.id} team="team1" big />
                : <span className="adv-npc-emoji">{scene.npc.emoji ?? artEmoji(scene.npc.portraitId) ?? '💬'}</span>}
              <span className="adv-npc-name">{scene.npc.name}</span>
            </div>
          )}
          {shown.map((p, i) => <p key={i} className="adv-text">{renderProse(p)}</p>)}
          {hasMore ? (
            <button className="adv-continue" onClick={(e) => { e.stopPropagation(); onAdvanceBeat(); }}>
              Continue ▸
            </button>
          ) : (
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
          )}
        </div>
      </div>
    );
  }

  if (scene.kind === 'check') {
    return (
      <div className="adv-scene bottom">
        <div className="adv-panel">
          {scene.intro.map((p, i) => <p key={i} className="adv-text">{renderProse(p)}</p>)}
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

  if (scene.kind === 'challenge') {
    return (
      <ChallengeBody
        scene={scene} state={state} module={module}
        onApproach={onApproach} onLeave={onLeave}
      />
    );
  }

  if (scene.kind === 'explore') {
    const nodes = exploreNodes(state, module);
    const visibleIds = new Set(nodes.map((n) => n.node.id));
    const posOf = (id: string) => scene.map.nodes.find((n) => n.id === id);
    const traversal = !!scene.map.paths;
    return (
      // Markers sit directly on the full-bleed location backdrop (the stage).
      <div className="adv-explore">
        <h2 className="adv-maptitle">{scene.map.title}</h2>

        {/* Trail lines between discovered nodes; edges into the frontier fade. */}
        {traversal && (
          <svg className="adv-trails" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(scene.map.paths ?? []).map(([a, b], i) => {
              const pa = posOf(a); const pb = posOf(b);
              if (!pa || !pb || (!visibleIds.has(a) && !visibleIds.has(b))) return null;
              const toFrontier = nodes.some((n) => (n.node.id === a || n.node.id === b) && n.frontier);
              return (
                <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  className={`adv-trail ${toFrontier ? 'faint' : ''}`} />
              );
            })}
          </svg>
        )}

        {nodes.map(({ node, blocked, secret, explored, frontier, here }) => {
          // Frontier (a path map's not-yet-reached node) hides what it is: a
          // generic "?" token and no title, unless the author gave it a teaser
          // `mystery` label. A per-node mystery on a free-roam map still applies.
          const teaser = !explored && !!node.mystery;
          const hideTitle = frontier || (teaser && !frontier);
          const shownLabel = frontier ? (node.mystery ?? '') : teaser ? node.mystery! : node.label;
          const glyph = blocked ? '🔒' : frontier ? '❓' : nodeEmoji(node.icon);
          const tokenArt = !blocked && !frontier && hasTokenArt(node.icon);
          const tier = blocked ? 'blocked' : here ? 'here' : explored ? 'explored'
            : frontier ? 'frontier' : secret ? 'secret' : 'known';
          return (
            <button
              key={node.id}
              className={`adv-node state-${tier} ${teaser && !frontier ? 'mystery' : ''}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              title={blocked ?? (hideTitle ? shownLabel || 'Unknown' : shownLabel)}
              onClick={() => (blocked ? onBlockedNode(blocked) : onNode(node.id))}
            >
              <span className="adv-node-icon">
                {tokenArt
                  ? <img src={tokenUrl(node.icon)} alt="" draggable={false} />
                  : <span>{glyph}</span>}
              </span>
              {here && <span className="adv-node-here" aria-hidden>▾</span>}
              {shownLabel && <span className="adv-node-label">{shownLabel}</span>}
            </button>
          );
        })}
        <p className="adv-maphint">
          {traversal ? 'Follow the trail — new ground reveals as you go. 🔒 needs something first.'
            : 'Tap a marker to explore. 🔒 needs something first; dimmed are unvisited.'}
        </p>
      </div>
    );
  }

  if (scene.kind === 'shop') {
    return (
      <AdventureShop
        campaign={campaign}
        state={state}
        module={module}
        scene={scene}
        focus={shopFocus}
        setFocus={setShopFocus}
        onRoll={onShopRoll}
        onChange={onShopChange}
        onLeave={onLeaveShop}
      />
    );
  }

  // rest auto-resolves via the effect above; render a brief placeholder.
  return <div className="adv-scene centered"><p className="adv-text">…</p></div>;
}

/** A challenge scene: the intro, then the lines of attack as pickable buttons.
 *  Each approach carries its own skill/DC; a `roller: 'chosen'` one asks "who
 *  steps up?" before rolling. A `perApproach` challenge greys out a line once
 *  tried, so the party sees what they've already spent. */
function ChallengeBody(
  { scene, state, module, onApproach, onLeave }: {
    scene: Extract<Scene, { kind: 'challenge' }>;
    state: AdventureState; module: Module;
    onApproach: (id: string, actorIdx?: number) => void;
    onLeave: () => void;
  },
) {
  // The approach awaiting a hero pick (a `roller: 'chosen'` line), or null.
  const [pickFor, setPickFor] = useState<string | null>(null);
  const options = legalApproaches(state, module);
  const leaveTo = hubReturn(state, module);
  const pending = pickFor ? scene.approaches.find((a) => a.id === pickFor) : null;

  if (pending) {
    return (
      <div className="adv-scene bottom">
        <div className="adv-panel">
          <p className="adv-prompt">Who steps up? ({pending.skill}, DC {pending.dc})</p>
          <RosterPicker campaign={state.campaign} onPick={(idx) => { setPickFor(null); onApproach(pending.id, idx); }} />
          <button className="adv-choice adv-leave" onClick={() => setPickFor(null)}><span>← Back</span></button>
        </div>
      </div>
    );
  }

  return (
    <div className="adv-scene bottom">
      <div className="adv-panel">
        {scene.intro.map((p, i) => <p key={i} className="adv-text">{renderProse(p)}</p>)}
        <p className="adv-prompt">How do you handle this?</p>
        <div className="adv-choices">
          {options.map(({ approach, blocked, spent }) => {
            const disabled = !!blocked || spent;
            const onTap = () => {
              if (disabled) return;
              if ((approach.roller ?? 'best') === 'chosen') setPickFor(approach.id);
              else onApproach(approach.id);
            };
            return (
              <button
                key={approach.id}
                className={`adv-choice adv-approach ${blocked ? 'blocked' : ''} ${spent ? 'spent' : ''}`}
                disabled={disabled}
                onClick={onTap}
              >
                <span className="adv-chip">🎲 {approach.skill} DC {approach.dc}</span>
                <span className="adv-approach-label">{approach.label}</span>
                {approach.hint && <span className="adv-approach-hint">{approach.hint}</span>}
                {blocked && <span className="adv-lock">🔒 {blocked}</span>}
                {!blocked && spent && <span className="adv-lock">✓ tried</span>}
              </button>
            );
          })}
          {leaveTo && (
            <button className="adv-choice adv-leave" onClick={onLeave}><span>← Leave</span></button>
          )}
        </div>
      </div>
    </div>
  );
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
