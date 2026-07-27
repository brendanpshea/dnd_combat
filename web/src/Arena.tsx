/**
 * Arena mode: endless generated waves, with a full rest and a shop between.
 *
 * Deliberately built out of the pieces the other modes already use rather than
 * its own look — `PartySetup` for the forge, `LootScreen` for rewards,
 * `PartyStrip` and the `adv-*` stage/panel styling for everything between
 * fights. A separate visual language for the arena would be work to build and
 * a thing for a player to re-learn.
 *
 * Two things it does differently from the campaign:
 *  - A defeat retries the *same* wave rather than ending anything. The wave is
 *    seeded from run seed + wave number, so the retry is the same fight; it is
 *    a puzzle to solve, not a reroll until something easy turns up.
 *  - It reports first-try clears as the score. With unlimited retries a plain
 *    win rate climbs to 100% and stops meaning anything.
 */
import { useState, useEffect, type ComponentType } from 'react';
import { Combat } from '../../src/engine/combat.js';
import type { Id, TeamId, ItemStack } from '../../src/engine/types.js';
import {
  type CampaignState, type RestResult, newCampaign, buildCampaignParty, partyLevelOf, preparableSpells, preparedRoom, partyPreparedRoom,
  applyArenaVictory, reviveParty, buyItem, itemPrice, itemName, itemIcon,
  SHOP_STOCK, shopOffering, addItem, sellItem, attemptHaggle, attemptSteal,
  partyStash, sellFromStash, HAGGLE, STEAL_DC, STEAL_FINE,
} from '../../src/campaign/campaign.js';
import { buildMonster, MONSTERS } from '../../src/data/monsters.js';
import { membersCoinXP } from '../../src/data/encounters.js';
import { parseMap } from '../../src/data/maps.js';
import {
  newArenaRun, advanceDay, type ArenaRunState, type ArenaWave,
} from '../../src/arena/run.js';
import { halfOf, dayOf, dayLevelOf, lunch, night, noteSpentItems } from '../../src/arena/day.js';
import {
  revivalCost, payRevival, isFirstDefeat, type RevivalBill,
} from '../../src/arena/revival.js';
import {
  runComplete, summarise, RUN_TARGET_XP, MEDAL_LABEL, MEDAL_ICON, type RunSummary,
} from '../../src/arena/medal.js';
import { spoilOffer, spoilTierLabel } from '../../src/arena/spoils.js';
import { SpoilPicker } from './Spoils.js';
import { gatesFor, gateFor, gateLocked, type Gate } from '../../src/arena/gates.js';
import {
  bountiesFor, bountyGold, claimedBounties, spellsCastBy, type Bounty,
} from '../../src/arena/bounties.js';
import { PartySetup } from './PartySetup.js';
import { SpellTray } from './SpellTray.js';
import { PartyStrip } from './Adventure.js';
import { LootScreen } from './Loot.js';
import { Portrait } from './Portrait.js';
import { classLook } from './classLook.js';
import { boardBgUrl, HAS_BOARD_BG, hasArt, tokenUrl } from './art.js';
import { ChorusBubble } from './Chorus.js';
import { PartyScreen } from './PartyScreen.js';
import {
  stallVisitOf, stallPrice, stallResale, type StallVisit,
} from '../../src/arena/stall.js';
import { chorusLine, firstUnheard, type ChorusCue } from '../../src/arena/chorus.js';
import { ArtImage } from './ArtImage.js';
import type { BattleProps } from './App.js';
import { saveArenaWeb, loadArenaWeb, deleteArenaWeb } from './arenaStorage.js';
import { deployFoes } from '../../src/arena/deploy.js';
import { actsOnItsOwn } from '../../src/engine/rules/summon.js';

type Phase =
  | { p: 'forge' }
  | { p: 'brief' }
  | { p: 'battle'; combat: Combat }
  | {
      p: 'loot'; gold: number; items: ItemStack[]; xpGained: number;
      leveledTo?: number; leveledFrom?: number;
      /** What the break after this fight gave back — lunch or a night. */
      rested: RestResult;
      /** Bounties claimed in the fight just won, named on the loot screen. */
      claimed: Array<{ name: string; gold: number }>;
      /**
       * One three-item offer per bounty claimed, still to be chosen from. The
       * loot screen holds Continue until they are all resolved: an award you
       * can walk past by mistake is worse than no award at all.
       */
      offers: Array<{ bounty: string; items: Id[] }>;
    }
  /** The premise, once, before a new party's first gate. */
  | { p: 'intro' }
  | { p: 'defeat'; bill: RevivalBill }
  /**
   * The run is over, one way or the other — the finish line reached, or the
   * healers' bill unpayable. Every run ends here: a record you can be graded
   * on is the only thing that makes the difference between solving a day and
   * out-levelling it mean anything.
   */
  | { p: 'summary'; summary: RunSummary; bill?: RevivalBill };

interface Props {
  Battle: ComponentType<BattleProps>;
  onExit(): void;
}

function makeCombat(c: CampaignState, run: ArenaRunState, wave: ArenaWave): Combat {
  const grid = parseMap(wave.map);
  // Where they start is part of the wave, seeded off it, so a retry is the same
  // fight rather than a reroll of the layout.
  const spots = deployFoes(grid, wave.encounter.members.length, (run.seed ^ (wave.wave * 2654435761)) >>> 0);
  const foes = wave.encounter.members.map((mid, i) =>
    buildMonster(mid, 'team2', spots.value.positions[i] ?? { x: 0, y: grid.height - 1 },
      wave.encounter.members.length > 1 ? String(i + 1) : ''));
  return new Combat({
    seed: (run.seed ^ (wave.wave * 7919)) >>> 0,
    map: wave.map,
    combatants: [...buildCampaignParty(c), ...foes],
  });
}

/**
 * The two bounties on offer for a wave.
 *
 * Built from a throwaway Combat because eligibility asks about the board (is
 * there a barricade? any fire?) and the roster (anything undead to smite?), and
 * both only exist once the wave is assembled. Cheap, deterministic, and it
 * means the pre-wave screen shows exactly what the post-battle check will use.
 */
function offeredBounties(c: CampaignState, run: ArenaRunState, wave: ArenaWave): Bounty[] {
  const preview = makeCombat(c, run, wave);
  const party = Object.values(preview.state.combatants).filter((x) => x.team === 'team1');
  return bountiesFor(run.seed, wave.wave, party, preview.state);
}

/** The roster, grouped — "3 Cockatrices, an Ogre" reads; a list of ids doesn't. */
function foeCounts(members: Id[]): Array<{ id: Id; n: number }> {
  const counts = new Map<Id, number>();
  for (const m of members) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts.entries()].map(([id, n]) => ({ id, n }));
}

function describeFoes(members: Id[]): string {
  return foeCounts(members)
    .map(({ id, n }) => (n > 1 ? `${n} ${MONSTERS[id]?.name ?? id}s` : MONSTERS[id]?.name ?? id))
    .join(', ');
}

export function ArenaScreen({ Battle, onExit }: Props) {
  const saved = loadArenaWeb();
  const [c, setC] = useState<CampaignState>(() => saved?.campaign ?? newCampaign(Date.now() & 0xffff));
  const [run, setRun] = useState<ArenaRunState>(() => saved?.run ?? newArenaRun(Date.now() & 0xffff));
  const [phase, setPhase] = useState<Phase>(() => (saved ? { p: 'brief' } : { p: 'forge' }));
  const [panel, setPanel] = useState<'none' | 'shop' | 'prepare'>('none');
  /**
   * The party screen — packs, worn gear, camp buffs, camp spellcasting.
   *
   * The arena had none of this: you could buy a Mace +1 and never wield it,
   * because nothing here could equip anything. It is the same screen the
   * adventures use, with `camp` null — the arena's rests are lunch and the
   * night, which happen to you rather than being chosen.
   */
  const [showParty, setShowParty] = useState(false);
  const [shopTab, setShopTab] = useState<'buy' | 'sell'>('buy');
  /** Which caster's prepared list is open, if any. */
  const [prepareFor, setPrepareFor] = useState<number | null>(null);
  const [buyFor, setBuyFor] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  /**
   * The commentary, on by default and switchable off for good.
   *
   * Stored outside the run because it is a preference about the game, not a
   * fact about this attempt at it — someone who has heard the quasit's routine
   * should not have to turn him off again every time they start over.
   */
  const [chorusOn, setChorusOn] = useState<boolean>(
    () => localStorage.getItem('arena-chorus') !== 'off',
  );
  const [, bump] = useState(0);

  const level = partyLevelOf(c);
  const half = halfOf(run);
  // The day's fights are pinned to the level the party was when they first
  // walked into it, so a retry is the same puzzle and levelling up is a real
  // way through one. See `dayLevel` in arena/run.ts.
  const dayLevel = dayLevelOf(run, level);
  // The three doors, and the one currently selected. Both derive from the run
  // rather than from component state, so a refresh mid-choice restores it.
  const gates = gatesFor(run.seed, dayLevel, run.wave, half);
  const gate = gateFor(gates, run.gate);
  const wave = gate.wave;
  const bounties = offeredBounties(c, run, wave);
  // Reading the visit is what creates it, so nothing has to remember to reset
  // the stall at dawn. See arena/stall.ts.
  const visit = stallVisitOf(run.stall, dayOf(run));

  /** Persist a change to this morning's visit (a haggle made, a pocket picked). */
  const setVisit = (next: StallVisit) => {
    const nextRun = { ...run, stall: next };
    setRun(nextRun); persist(c, nextRun);
  };
  const locked = gateLocked(run.attempts);

  const persist = (nextC: CampaignState, nextRun: ArenaRunState) =>
    saveArenaWeb({ campaign: nextC, run: nextRun });
  const refresh = () => { setC({ ...c }); bump((v) => v + 1); };

  /**
   * Pin the day's difficulty the first time the player looks at it.
   *
   * Done here rather than at the end of the previous fight because a level-up
   * lands in the loot screen, between the two — freezing any earlier would pin
   * a level the party no longer has, and freezing any later would let the
   * afternoon regenerate at a level the morning was not built for.
   */
  if (run.dayLevel === undefined && phase.p === 'brief') {
    const pinned = { ...run, dayLevel: level };
    setRun(pinned); persist(c, pinned);
  }

  /**
   * What the quasit has to say right now, if anything.
   *
   * Marking a line heard is a side effect of *showing* it, done in an effect
   * rather than during render so React is not asked to persist a save file
   * mid-paint. `heard` lives in the run, so closing the tab does not reset the
   * commentary and a new run gets all of it back.
   */
  function say(...cues: ChorusCue[]): ChorusCue | undefined {
    return chorusOn ? firstUnheard(cues, run.heard ?? []) : undefined;
  }

  function markHeard(cue: ChorusCue) {
    if (!chorusOn || (run.heard ?? []).includes(cue)) return;
    const nextRun = { ...run, heard: [...(run.heard ?? []), cue] };
    setRun(nextRun); persist(c, nextRun);
  }

  /** Render a cue if there is one, and remember it was said. */
  function Say({ cue }: { cue: ChorusCue | undefined }) {
    const text = cue === undefined ? undefined : chorusLine(cue, run.heard ?? []);
    useEffect(() => {
      if (cue !== undefined && text !== undefined) markHeard(cue);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cue]);
    return text === undefined ? null : <ChorusBubble text={text} />;
  }

  /** Take a door. Free until the first attempt; after that the wave is fixed. */
  function chooseGate(door: number) {
    if (locked || door === (run.gate ?? 0)) return;
    const nextRun = { ...run, gate: door };
    setRun(nextRun); persist(c, nextRun); setNotice(null);
  }

  /** Wipe the save and go back to the forge — a new party, a new ladder. */
  function restartRun() {
    deleteArenaWeb();
    setC(newCampaign(Date.now() & 0xffff));
    setRun(newArenaRun(Date.now() & 0xffff));
    setPanel('none'); setNotice(null); setConfirmRestart(false);
    setPhase({ p: 'forge' });
  }

  /**
   * Restarting throws away the party as well as the run, so it asks first —
   * one stray tap next to "Fight" shouldn't cost an hour of clears.
   */
  const restartButton = confirmRestart ? (
    <div className="arena-confirm">
      <span>Start over with a new party? This run is lost.</span>
      <button className="danger" onClick={restartRun}>Start over</button>
      <button className="ghost" onClick={() => setConfirmRestart(false)}>Keep going</button>
    </div>
  ) : (
    <button className="ghost" onClick={() => setConfirmRestart(true)}>Start a new run</button>
  );

  function battleDone(winner: TeamId, combat: Combat) {
    // The party, not the menagerie: a summoned snake is on team1 and is not a
    // survivor to read back, revive or pay.
    const survivors = Object.values(combat.state.combatants)
      .filter((x) => x.team === 'team1' && !actsOnItsOwn(x));
    if (winner !== 'team1') {
      // A defeat ends the DAY, not the run. Everyone is picked up, the night
      // passes, and tomorrow holds the same two fights — frozen at the level
      // they were met at, so what was learned still applies and what was bought
      // still helps. Nothing is kept from today's attempt except that.
      // The powers that be will put you back together, and they take their cut
      // for it. The first defeat of a run is on the house — at level 1 the bill
      // is most of a starting purse, and a party that loses its opening day
      // should not be nearly broke before it has learned what the arena is.
      const bill = payRevival(c, isFirstDefeat(run) ? 0 : revivalCost(dayLevel, run.wave));
      if (bill.insolvent) {
        // Nothing was sold and nothing was taken: the run simply ends here.
        setC({ ...c }); persist(c, run);
        setPhase({ p: 'summary', summary: summarise(run, c.xp), bill });
        return;
      }
      reviveParty(c);
      const nextRun = advanceDay(run, false, 0, {
        spellsUsed: spellsCastBy(combat.log, combat.state),
      });
      night(c, nextRun.cleared);
      setRun(nextRun); setC({ ...c }); persist(c, nextRun);
      // The experience is earned whether or not the day was won, so a party
      // that crosses the line on a losing day has still crossed it.
      setPhase(runComplete(c.xp)
        ? { p: 'summary', summary: summarise(nextRun, c.xp), bill }
        : { p: 'defeat', bill });
      return;
    }
    // Coin scales only with what actually carries a purse — a wolf pack hoards
    // nothing, the same rule adventure treasure uses.
    const result = applyArenaVictory(
      c, survivors, wave.encounter.rawXp, combat.state.rng,
      membersCoinXP(wave.encounter.members),
      // Somebody who went down stays down until lunch pays a hit die for them.
      { downedAtZero: half === 'morning' },
    );
    // What the fight earned beyond winning it. Read off the event log, which
    // Combat has kept the whole way through, so nothing had to be tracked as
    // the battle ran.
    const claimed = claimedBounties(bounties, {
      events: combat.log,
      state: combat.state,
      party: survivors,
      spellsUsedBefore: new Set(run.spellsUsed),
      rounds: combat.state.round,
      foes: wave.encounter.members.length,
    });
    // The purse is the day's pay, handed over when the day is done — winning
    // the morning buys you the afternoon, not a wage.
    const paid = half === 'afternoon' ? wave.purse : 0;
    const bonus = claimed.reduce((g, b) => g + bountyGold(b, paid || wave.purse), 0);
    c.gold += paid + bonus;
    const nextRun = advanceDay(run, true, wave.purse, {
      spellsUsed: spellsCastBy(combat.log, combat.state),
      bounties: claimed.length,
    });
    // Lunch after the morning; a night's rest after the afternoon. The
    // difference between them is the whole feature: hit points, slots and
    // charges all cross the lunch break, and none of them cross the night.
    noteSpentItems(c, nextRun.cleared);
    const rested = half === 'morning' ? lunch(c) : night(c, nextRun.cleared);
    setRun(nextRun); setC({ ...c }); persist(c, nextRun);
    setPhase({
      p: 'loot',
      gold: result.gold + paid + bonus, items: result.items, xpGained: result.xpGained,
      claimed: claimed.map((b) => ({ name: b.name, gold: bountyGold(b, paid || wave.purse) })),
      // Seeded off the day and half, never the attempt: a retried day has to
      // put the same three things on the table, or losing on purpose becomes a
      // way to reroll the prize. See arena/spoils.ts.
      offers: claimed.map((b, i) => ({
        bounty: b.name,
        items: spoilOffer(run.seed, dayOf(run), half, i, level),
      })),
      rested,
      ...(result.leveledTo !== undefined ? { leveledTo: result.leveledTo } : {}),
      ...(result.leveledFrom !== undefined ? { leveledFrom: result.leveledFrom } : {}),
    });
  }

  // ---- the forge: the same party builder the adventures use ----
  if (phase.p === 'forge') {
    return (
      <PartySetup
        campaign={c}
        onExit={onExit}
        onBegin={() => {
          c.partyReady = true;
          persist(c, run);
          setPhase({ p: 'intro' });
        }}
      />
    );
  }

  if (phase.p === 'battle') {
    return (
      <Battle
        combat={phase.combat}
        aiTeams={new Set<TeamId>(['team2'])}
        aiLevel={c.storyMode ? 'easy' : 'normal'}
        storyMode={c.storyMode}
        mapLabel={`Wave ${run.wave} — ${describeFoes(wave.encounter.members)}`}
        theme={wave.map.theme}
        doneLabel="Continue"
        onExit={() => setPhase({ p: 'brief' })}
        onDone={(winner) => battleDone(winner, phase.combat)}
      />
    );
  }

  // ---- rewards: the adventure loot screen, XP bar and level-up and all ----
  if (phase.p === 'loot') {
    return (
      <LootScreen
        campaign={c}
        gold={phase.gold}
        items={phase.items}
        xpGained={phase.xpGained}
        leveledTo={phase.leveledTo}
        leveledFrom={phase.leveledFrom}
        claimed={phase.claimed}
        rested={phase.rested}
        spoilsPending={phase.offers.length > 0}
        spoils={phase.offers.length > 0 && (
          <SpoilPicker
            bounty={phase.offers[0]!.bounty}
            items={phase.offers[0]!.items}
            onTake={(itemId) => {
              // Straight into the pack of whoever has room; equipping is the
              // player's own business on the party screen, the same as anything
              // they bought. Awarding it *equipped* would silently replace gear
              // somebody had chosen.
              addItem(c.characters[0]!.inventory, itemId);
              persist(c, run); refresh();
              setPhase({ ...phase, offers: phase.offers.slice(1) });
            }}
          />
        )}
        chorus={<Say cue={say(
          // Which break this was cannot be read off `half`: the run has already
          // advanced by the time this screen paints, so after a won morning
          // `half` says 'afternoon'. `hitDiceSpent` is the honest signal — only
          // a lunch reports it — and it is what the panel itself keys on.
          //
          // Lunch teaches the day model better than a cleared day does, so the
          // hit-dice lines get first refusal.
          ...(phase.rested.hitDiceSpent === 0 ? ['noHitDice' as const] : []),
          ...((phase.rested.revived ?? 0) > 0 ? ['firstHitDice' as const] : []),
          ...(phase.rested.hitDiceSpent !== undefined
            ? ['firstLunch' as const]
            : ['firstClear' as const]),
        )} />}
        onLevelChange={() => { refresh(); persist(c, run); }}
        onContinue={() => setPhase(
          // Crossing the finish line ends the run here rather than sending the
          // party back to a gate they no longer have any reason to walk through.
          runComplete(c.xp)
            ? { p: 'summary', summary: summarise(run, c.xp) }
            : { p: 'brief' },
        )}
      />
    );
  }

  const backdrop = HAS_BOARD_BG.has(wave.map.theme)
    ? <div className="adv-backdrop" style={{ backgroundImage: `url(${boardBgUrl(wave.map.theme)})` }} />
    : <div className="adv-backdrop glyph"><span>🏟️</span></div>;

  if (phase.p === 'intro') {
    return (
      <div className="adventure">
        <div className="adv-stage">
          {backdrop}
          <div className="adv-content">
            <div className="adv-scene centered">
              <div className="adv-panel">
                <h2>You do not remember dying.</h2>
                <p className="adv-text">
                  That is normal. Almost nobody does. What matters is where it
                  put you: a ring of packed sand under a sky nobody built, with
                  something enormous and unhurried watching from the seats.
                </p>
                <p className="adv-text">
                  They are deciding what you were worth. Not by asking — by
                  making you show them. Two fights a day, every day, until they
                  have seen enough of you or you have nothing left to pay the
                  healers with.
                </p>
                <p className="hint">
                  Lose, and the day is written off: you come back tomorrow to
                  the same two fights, exactly as they were, keeping everything
                  you learned and everything you bought. Nothing here is
                  permanent except the record.
                </p>
                <div className="adv-choices">
                  <button className="primary" onClick={() => setPhase({ p: 'brief' })}>
                    Step out onto the sand
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase.p === 'summary') {
    const { summary } = phase;
    return (
      <div className="adventure">
        <div className="adv-stage">
          {backdrop}
          <div className="adv-content">
            <div className="adv-scene centered">
              <div className="adv-panel run-summary">
                {summary.completed ? (
                  <>
                    <div className={`medal m-${summary.medal}`}>
                      <span className="medal-ico">{MEDAL_ICON[summary.medal!]}</span>
                      <span className="medal-tier">{MEDAL_LABEL[summary.medal!]}</span>
                    </div>
                    <h2>They have seen enough.</h2>
                    <p className="adv-text">
                      Whatever it was you came here to prove, you have proved it.
                      The gates stand open and nobody moves to stop you.
                    </p>
                  </>
                ) : (
                  <>
                    <h2>The healers look at your purse, and turn away.</h2>
                    <p className="adv-text">
                      There is a price for being put back together, and you
                      cannot meet it. Whatever you were proving, you will not
                      get to finish proving it — not with this company.
                    </p>
                    {phase.bill && (
                      <div className="revival-bill">
                        <div className="loot-line">
                          <span>⚕️ Owed</span>
                          <b className="loss">{phase.bill.cost}g</b>
                        </div>
                        <div className="loot-sub">
                          {c.gold}g in hand, and nothing left worth selling.
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="loot-panel">
                  <div className="loot-line">
                    <span>⚔️ Win rate</span>
                    <b className={summary.completed ? 'gain' : ''}>{summary.winRate}%</b>
                  </div>
                  <div className="loot-sub">
                    {summary.wins} of {summary.fights} fights won ·
                    {' '}{summary.clearedFirstTry} days cleared at the first attempt
                  </div>
                  <div className="loot-line">
                    <span>📅 Days</span>
                    <b>{summary.days}</b>
                  </div>
                  <div className="loot-line">
                    <span>✨ Experience</span>
                    <b>{summary.xp}</b>
                  </div>
                  {!summary.completed && (
                    <div className="loot-sub">
                      {Math.round((summary.xp / RUN_TARGET_XP) * 100)}% of the way
                      to the {RUN_TARGET_XP} needed to walk out.
                    </div>
                  )}
                </div>

                <Say cue={say(summary.completed ? 'finished' : 'brokeOff')} />

                {summary.completed && summary.medal !== 'gold' && (
                  <p className="hint">
                    A higher win rate takes a better medal. Days you solve outright
                    count for more than days you out-level.
                  </p>
                )}

                <div className="adv-choices">
                  {restartButton}
                  <button onClick={onExit}>Leave the arena</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase.p === 'defeat') {
    return (
      <div className="adventure">
        <div className="adv-stage">
          {backdrop}
          <div className="adv-content">
            <div className="adv-scene centered">
              <div className="adv-panel">
                <h2>The crowd roars. You are dragged out.</h2>
                <p className="adv-text">
                  The healers do their work and the day is written off. Come back
                  tomorrow: the same two fights will be waiting, exactly as they
                  are now — and everything you have learned, earned and bought
                  comes with you.
                </p>
                <div className="revival-bill">
                  {phase.bill.cost === 0 ? (
                    <p className="adv-text quiet">
                      &ldquo;The first one is on us,&rdquo; says the healer, not looking up.
                      &ldquo;It will not be next time.&rdquo;
                    </p>
                  ) : (
                    <>
                      <div className="loot-line">
                        <span>⚕️ The healers&rsquo; cut</span>
                        <b className="loss">−{phase.bill.cost}g</b>
                      </div>
                      {phase.bill.sold.length > 0 && (
                        <div className="claimed">
                          {phase.bill.sold.map((sale, i) => (
                            <div className="claimed-row" key={`${sale.itemId}-${i}`}>
                              <span className="claimed-tick">↦</span>
                              <span className="claimed-name">sold {itemName(sale.itemId)}</span>
                              <span className="gain">+{sale.gold}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="loot-sub">{c.gold}g left</div>
                    </>
                  )}
                </div>
                <Say cue={say(
                  ...(phase.bill.sold.length > 0 ? ['soldToPay' as const] : []),
                  ...(c.gold < phase.bill.cost ? ['nearlyBroke' as const] : []),
                  ...(phase.bill.cost > 0 ? ['firstBill' as const] : []),
                  'firstDefeat',
                )} />
                <p className="hint">
                  Day {dayOf(run)} · wave {run.wave} · attempt {run.attempts + 1}
                  {run.dayLevel !== undefined && run.dayLevel < level &&
                    ` · this day is still set for level ${run.dayLevel}, and you are level ${level}`}
                </p>
                <div className="adv-choices">
                  <button className="primary" onClick={() => setPhase({ p: 'brief' })}>Back to the gate</button>
                  {restartButton}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- the gate: what's coming, the party, and the shop ----
  const shelf = shopOffering(SHOP_STOCK, level, `arena-${run.wave}`)
    .filter((id) => itemPrice(id) !== undefined);
  const grid = parseMap(wave.map);

  // Everyone with a prepared list worth opening. A fighter has none, and
  // offering them a spell tray is a dead button.
  const casters = c.characters
    .map((ch, i) => ({ ch, i }))
    .filter(({ i }) => preparableSpells(c, i).length > 0);
  // Anyone carrying fewer spells than they are allowed. A saved prepared list
  // does not grow when the cap does, so this is easy to end up in and
  // impossible to notice from the outside — the badge is the whole point.
  const withRoom = partyPreparedRoom(c);

  /**
   * The prepared-spell tray, on the gate screen.
   *
   * The arena long-rests the party after every win, which is exactly when the
   * rules let you re-prepare — but the only ways to change a prepared list were
   * the forge and the level-up modal, so between waves at the same level you
   * were locked into whatever you walked in with. `prepare` mode locks cantrips
   * and the spellbook and opens only the prepared list, which is what a long
   * rest actually allows.
   */
  const spellPanel = prepareFor !== null && (
    <SpellTray
      key={prepareFor}          // fresh drafts per caster — never inherit another's
      campaign={c}
      idx={prepareFor}
      mode="prepare"
      onClose={() => setPrepareFor(null)}
      onSaved={(msg) => { setPrepareFor(null); setNotice(msg); refresh(); persist(c, run); }}
    />
  );

  return (
    <div className="adventure">
      <div className="adv-stage">
        {backdrop}
        <div className="adv-content">
          <div className="adv-scene bottom">
            <div className="adv-panel">
              <div className="arena-head">
                <h2>
                  Day {dayOf(run)} · {half === 'morning' ? 'Morning' : 'Afternoon'}
                </h2>
                <span className="arena-score">
                  wave {run.wave} · {run.cleared} cleared · {c.gold}g
                </span>
              </div>

              {/* Three doors. The choice is the planning half of the screen:
                  same purse behind each, so what you are picking is which fight
                  your party is actually good at. Free to change until you have
                  fought one — after that the wave is the wave you failed. */}
              <div className="gates">
                {gates.map((g) => (
                  <button
                    key={g.door}
                    className={`gate${g.door === (run.gate ?? 0) ? ' on' : ''}${locked ? ' locked' : ''}`}
                    onClick={() => chooseGate(g.door)}
                    disabled={locked && g.door !== (run.gate ?? 0)}
                    aria-pressed={g.door === (run.gate ?? 0)}
                  >
                    <b className="gate-name">{g.name}</b>
                    <span className="gate-blurb">{g.blurb}</span>
                    <span className="gate-foes">
                      {foeCounts(g.wave.encounter.members).map(({ id, n }) => (
                        <span key={id} className="gate-foe" title={MONSTERS[id]?.name ?? id}>
                          <ArtImage
                            id={id}
                            {...(hasArt(id) ? { src: tokenUrl(id) } : {})}
                            glyphClassName="gate-foe-glyph"
                            alt=""
                          />
                          {n > 1 && <i className="gate-foe-count">×{n}</i>}
                        </span>
                      ))}
                    </span>
                    <span className="gate-count">
                      {g.wave.encounter.members.length} enem{g.wave.encounter.members.length === 1 ? 'y' : 'ies'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Who the selected door actually puts in front of you, named —
                  the tokens on a card are too small to identify a monster from. */}
              <div className="arena-foes">
                {foeCounts(wave.encounter.members).map(({ id, n }) => (
                  <div key={id} className="arena-foe" title={MONSTERS[id]?.name ?? id}>
                    <ArtImage
                      id={id}
                      {...(hasArt(id) ? { src: tokenUrl(id) } : {})}
                      glyphClassName="arena-foe-glyph"
                      alt=""
                    />
                    {n > 1 && <span className="arena-foe-count">×{n}</span>}
                    <small>{MONSTERS[id]?.name ?? id}</small>
                  </div>
                ))}
              </div>

              <p className="hint">
                <button
                  className="chorus-toggle"
                  onClick={() => {
                    const next = !chorusOn;
                    setChorusOn(next);
                    localStorage.setItem('arena-chorus', next ? 'on' : 'off');
                  }}
                  title={chorusOn ? 'Silence the quasit' : 'Let the quasit talk'}
                >
                  {chorusOn ? '🗣️' : '🔇'}
                </button>
                {grid.width}×{grid.height} {wave.map.theme}
                {locked && ` · attempt ${run.attempts + 1}, this door is committed`}
              </p>
              {/* The afternoon is the same wave as the morning, fought by a
                  party that has already spent one. Saying so is the only way a
                  player learns to keep something back. */}
              <p className="hint">
                {half === 'morning'
                  ? 'Two fights today. Whatever you spend this morning is gone until tonight.'
                  : 'The second fight of the day — no rest after this one until the day is done.'}
                {run.dayLevel !== undefined && run.dayLevel < level &&
                  ` You have outgrown this day: it is still set for level ${run.dayLevel}.`}
              </p>

              {/* The quasit, on the way in. Ordered most-interesting-first:
                  several of these can be true at once and he gets one. */}
              <Say cue={say(
                ...(dayOf(run) === 1 && run.fights === 0 ? ['arrival' as const] : []),
                ...(run.attempts >= 2 ? ['grinding' as const] : []),
                ...(half === 'afternoon' ? ['firstAfternoon' as const] : []),
                ...(c.xp >= RUN_TARGET_XP * 0.7 ? ['homeStretch' as const] : []),
                ...(run.dayLevel !== undefined && run.dayLevel < level ? ['levelled' as const] : []),
                'firstGate',
              )} />

              {/* The planning half of the screen: what this wave will pay extra
                  for. Named before the fight, or they are not something to play
                  toward — they are a surprise at the end. */}
              {bounties.length > 0 && (
                <div className="bounties">
                  <b className="bounties-head">Bounties</b>
                  {/* What they pay, said once. Each bounty carries an award as
                      well as coin, and the card used to mention only the coin —
                      so the pick-one-of-three screen arrived unannounced, and a
                      reward nobody knows about cannot be played for. */}
                  <span className="bounties-sub">
                    Each one claimed pays coin and {spoilTierLabel(level)} — three offered, you keep one.
                  </span>
                  {bounties.map((b) => (
                    <div key={b.id} className="bounty">
                      <span className="bounty-name">{b.name}</span>
                      <span className="bounty-blurb">{b.blurb}</span>
                      <span className="bounty-gold">
                        +{bountyGold(b, wave.purse)}g
                        <i className="bounty-award">+ {spoilTierLabel(level)}</i>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {notice && <div className="notice">{notice}</div>}

              {panel === 'prepare' && (
                <div className="arena-shop">
                  <div className="arena-shop-head">
                    <b>Study your spells</b>
                    <div className="arena-buyer">
                      {casters.map(({ ch, i }) => {
                        const look = classLook(ch.classId);
                        return (
                          <button
                            key={i}
                            className="arena-buyer-pick"
                            onClick={() => setPrepareFor(i)}
                            title={`Prepare spells for ${ch.name}`}
                          >
                            <Portrait id={ch.portraitId ?? ch.classId} team="team1" />
                            {look && (
                              <span className="class-pip on-portrait" style={{ ['--pip' as string]: look.color }}>
                                {look.glyph}
                              </span>
                            )}
                            <span className={`prep-count${preparedRoom(c, i).room > 0 ? ' has-room' : ''}`}>
                              {preparedRoom(c, i).used}/{preparedRoom(c, i).limit}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="hint">
                    You rested after the last wave — swap in whatever this one calls for.
                    {withRoom.length > 0 && ' Anyone showing spare slots is walking in with fewer spells than they could.'}
                  </p>
                </div>
              )}

              {panel === 'shop' && (
                <div className="arena-shop">
                  <div className="arena-shop-head">
                    <b>The armourer's stall</b>
                    <div className="arena-buyer">
                      {c.characters.map((ch, i) => {
                        const look = classLook(ch.classId);
                        return (
                          <button
                            key={i}
                            className={`arena-buyer-pick ${buyFor === i ? 'on' : ''}`}
                            onClick={() => setBuyFor(i)}
                            title={`Buy for ${ch.name}${look ? ` — ${look.name}` : ''}`}
                          >
                            <Portrait id={ch.portraitId ?? ch.classId} team="team1" />
                            {look && (
                              <span className="class-pip on-portrait" style={{ ['--pip' as string]: look.color }}>
                                {look.glyph}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="hint">
                    {shopTab === 'buy'
                      ? <>Buying for <b>{c.characters[buyFor]?.name}</b></>
                      : <>Selling from <b>{c.characters[buyFor]?.name}</b>&rsquo;s pack and the party loot</>}
                    {visit.priceMult !== 1 && (
                      <span className={visit.priceMult < 1 ? 'haggle-good' : 'haggle-bad'}>
                        {' · '}prices {visit.priceMult < 1 ? 'down' : 'up'}{' '}
                        {Math.round(Math.abs(1 - visit.priceMult) * 100)}%
                      </span>
                    )}
                  </p>

                  {/* Gambits, once a morning each. A party with a bard or a
                      rogue had nothing to spend either on at the one screen
                      where a social skill plausibly matters. */}
                  <div className="stall-gambits">
                    {(Object.keys(HAGGLE) as Array<keyof typeof HAGGLE>).map((skill) => {
                      const cfg = HAGGLE[skill];
                      const face = skill === 'persuasion' ? '🤝 Persuade'
                        : skill === 'deception' ? '🎭 Deceive' : '😠 Intimidate';
                      return (
                        <button
                          key={skill}
                          className="stall-gambit"
                          disabled={visit.haggleUsed}
                          title={visit.haggleUsed
                            ? 'You have had your say this morning'
                            : `DC ${cfg.dc} — ${Math.round(cfg.discount * 100)}% off, ` +
                              `${cfg.penalty ? `${Math.round(cfg.penalty * 100)}% up if it lands badly` : 'no downside'}`}
                          onClick={() => {
                            const { roll, priceMultiplier } = attemptHaggle(c, skill);
                            setVisit({ ...visit, haggleUsed: true, priceMult: priceMultiplier });
                            setNotice(
                              `${c.characters[roll.by]?.name ?? 'Someone'} rolled ${roll.total} vs DC ${cfg.dc} — ` +
                              (roll.success ? 'the price comes down.' : 'that went badly.'),
                            );
                            refresh();
                          }}
                        >
                          {face}
                          <i>{Math.round(cfg.discount * 100)}% off</i>
                        </button>
                      );
                    })}
                    <button
                      className="stall-gambit risky"
                      disabled={visit.stealUsed}
                      title={visit.stealUsed
                        ? 'Once a morning is quite enough'
                        : `Stealth AND Sleight of Hand, both DC ${STEAL_DC} — a ${STEAL_FINE}g fine if either fails`}
                      onClick={() => {
                        const r = attemptSteal(c, shelf);
                        setVisit({ ...visit, stealUsed: true });
                        setNotice(r.success
                          ? `Pocketed ${itemName(r.itemId!)}. Nobody saw a thing.`
                          : `Caught. ${r.fine}g gone in fines.`);
                        refresh(); persist(c, run);
                      }}
                    >
                      🖐️ Pocket something
                      <i>risky</i>
                    </button>
                  </div>

                  <div className="stall-tabs">
                    <button className={shopTab === 'buy' ? 'on' : ''} onClick={() => setShopTab('buy')}>Buy</button>
                    <button className={shopTab === 'sell' ? 'on' : ''} onClick={() => setShopTab('sell')}>Sell</button>
                  </div>

                  {shopTab === 'buy' ? (
                    <div className="arena-shelf">
                      {shelf.map((id) => {
                        const price = stallPrice(id, visit);
                        return (
                          <button
                            key={id}
                            className="arena-buy"
                            disabled={c.gold < price}
                            onClick={() => {
                              // The haggled price, not the list price — pass it
                              // explicitly, because `buyItem` charges list by
                              // default and a silent list charge would make a
                              // good roll look like it did nothing.
                              if (buyItem(c, buyFor, id, price)) {
                                setNotice(`${itemName(id)} → ${c.characters[buyFor]?.name}`);
                                refresh(); persist(c, run);
                              }
                            }}
                          >
                            <span className="arena-buy-icon">{itemIcon(id)}</span>
                            <span className="arena-buy-name">{itemName(id)}</span>
                            <span className="arena-buy-price">{price}g</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="arena-shelf">
                      {(() => {
                        const pack = (c.characters[buyFor]?.inventory ?? []).filter((st) => st.qty > 0);
                        const loot = partyStash(c).filter((st) => st.qty > 0);
                        if (pack.length === 0 && loot.length === 0) {
                          return <span className="hint">Nothing to sell — this pack is empty.</span>;
                        }
                        return (
                          <>
                            {pack.map((st) => (
                              <button
                                key={`p-${st.itemId}`}
                                className="arena-buy"
                                onClick={() => {
                                  if (sellItem(c, buyFor, st.itemId)) {
                                    setNotice(`Sold ${itemName(st.itemId)} (+${stallResale(st.itemId)}g).`);
                                    refresh(); persist(c, run);
                                  }
                                }}
                              >
                                <span className="arena-buy-icon">{itemIcon(st.itemId)}</span>
                                <span className="arena-buy-name">
                                  {itemName(st.itemId)}{st.qty > 1 ? ` ×${st.qty}` : ''}
                                </span>
                                <span className="arena-buy-price">+{stallResale(st.itemId)}g</span>
                              </button>
                            ))}
                            {loot.map((st) => (
                              <button
                                key={`s-${st.itemId}`}
                                className="arena-buy"
                                onClick={() => {
                                  if (sellFromStash(c, st.itemId)) {
                                    setNotice(`Sold ${itemName(st.itemId)} from the party loot (+${stallResale(st.itemId)}g).`);
                                    refresh(); persist(c, run);
                                  }
                                }}
                              >
                                <span className="arena-buy-icon">🎁</span>
                                <span className="arena-buy-name">
                                  {itemName(st.itemId)}{st.qty > 1 ? ` ×${st.qty}` : ''}
                                </span>
                                <span className="arena-buy-price">+{stallResale(st.itemId)}g</span>
                              </button>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              <div className="adv-choices">
                <button className="primary" onClick={() => setPhase({ p: 'battle', combat: makeCombat(c, run, wave) })}>
                  ⚔️ Fight — {gate.name}
                </button>
                {/* The market keeps daylight hours. Two breaks with different
                    characters: the night is where you re-equip and re-prepare,
                    lunch is only a rest — which is what makes what you carry
                    into the morning a decision rather than a shopping list. */}
                {half === 'morning' ? (
                  <button onClick={() => { setPanel(panel === 'shop' ? 'none' : 'shop'); setNotice(null); }}>
                    🛒 {panel === 'shop' ? 'Close the stall' : 'Visit the stall'}
                  </button>
                ) : (
                  <button disabled title="The stalls shut at noon — you buy in the morning">
                    🛒 The stalls are shut
                  </button>
                )}
                {casters.length > 0 && (
                  <button onClick={() => { setPanel(panel === 'prepare' ? 'none' : 'prepare'); setNotice(null); }}>
                    📖 {panel === 'prepare' ? 'Close the spellbook' : 'Prepare spells'}
                    {panel !== 'prepare' && withRoom.length > 0 && (
                      <span className="prep-badge" title="Spare prepared slots going unused">
                        {withRoom.length} with room
                      </span>
                    )}
                  </button>
                )}
                <button onClick={() => { setShowParty(true); setNotice(null); }}>
                  🎒 Party &amp; gear
                </button>
                <button className="ghost" onClick={() => { persist(c, run); onExit(); }}>Leave the arena</button>
                {restartButton}
              </div>
            </div>
          </div>
        </div>
      </div>
      <PartyStrip campaign={c} />
      {showParty && (
        <PartyScreen
          campaign={c}
          camp={null}
          onRest={() => { /* the arena rests on its own clock */ }}
          onChange={() => { persist(c, run); refresh(); }}
          onClose={() => setShowParty(false)}
        />
      )}
      {spellPanel}
    </div>
  );
}
