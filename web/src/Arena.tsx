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
import { useState, type ComponentType } from 'react';
import { Combat } from '../../src/engine/combat.js';
import type { Id, TeamId, ItemStack } from '../../src/engine/types.js';
import {
  type CampaignState, type RestResult, newCampaign, buildCampaignParty, partyLevelOf, preparableSpells, preparedRoom, partyPreparedRoom,
  applyArenaVictory, reviveParty, buyItem, itemPrice, itemName, itemIcon,
  SHOP_STOCK, shopOffering,
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
    }
  | { p: 'defeat'; bill: RevivalBill }
  /** The run is over: the party could not pay to be put back on its feet. */
  | { p: 'over'; bill: RevivalBill };

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
  /** Which caster's prepared list is open, if any. */
  const [prepareFor, setPrepareFor] = useState<number | null>(null);
  const [buyFor, setBuyFor] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
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
        setPhase({ p: 'over', bill });
        return;
      }
      reviveParty(c);
      const nextRun = advanceDay(run, false, 0, {
        spellsUsed: spellsCastBy(combat.log, combat.state),
      });
      night(c, nextRun.cleared);
      setRun(nextRun); setC({ ...c }); persist(c, nextRun);
      setPhase({ p: 'defeat', bill });
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
          setPhase({ p: 'brief' });
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
        onLevelChange={() => { refresh(); persist(c, run); }}
        onContinue={() => setPhase({ p: 'brief' })}
      />
    );
  }

  const backdrop = HAS_BOARD_BG.has(wave.map.theme)
    ? <div className="adv-backdrop" style={{ backgroundImage: `url(${boardBgUrl(wave.map.theme)})` }} />
    : <div className="adv-backdrop glyph"><span>🏟️</span></div>;

  if (phase.p === 'over') {
    return (
      <div className="adventure">
        <div className="adv-stage">
          {backdrop}
          <div className="adv-content">
            <div className="adv-scene centered">
              <div className="adv-panel">
                <h2>The healers look at your purse, and turn away.</h2>
                <p className="adv-text">
                  There is a price for being put back together, and you cannot
                  meet it. Whatever you were proving, you will not get to finish
                  proving it — not with this company.
                </p>
                <div className="revival-bill">
                  <div className="loot-line">
                    <span>⚕️ Owed</span>
                    <b className="loss">{phase.bill.cost}g</b>
                  </div>
                  <div className="loot-sub">
                    {c.gold}g in hand, and nothing left worth selling.
                  </div>
                </div>
                <p className="hint">
                  Lasted {dayOf(run)} days · {run.cleared} cleared ·
                  {' '}{run.wins} of {run.fights} fights won
                </p>
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

              {/* The planning half of the screen: what this wave will pay extra
                  for. Named before the fight, or they are not something to play
                  toward — they are a surprise at the end. */}
              {bounties.length > 0 && (
                <div className="bounties">
                  <b className="bounties-head">Bounties</b>
                  {bounties.map((b) => (
                    <div key={b.id} className="bounty">
                      <span className="bounty-name">{b.name}</span>
                      <span className="bounty-blurb">{b.blurb}</span>
                      <span className="bounty-gold">+{bountyGold(b, wave.purse)}g</span>
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
                  <p className="hint">Buying for <b>{c.characters[buyFor]?.name}</b></p>
                  <div className="arena-shelf">
                    {shelf.map((id) => {
                      const price = itemPrice(id) ?? 0;
                      return (
                        <button
                          key={id}
                          className="arena-buy"
                          disabled={c.gold < price}
                          onClick={() => {
                            if (buyItem(c, buyFor, id)) {
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
                <button className="ghost" onClick={() => { persist(c, run); onExit(); }}>Leave the arena</button>
                {restartButton}
              </div>
            </div>
          </div>
        </div>
      </div>
      <PartyStrip campaign={c} />
      {spellPanel}
    </div>
  );
}
