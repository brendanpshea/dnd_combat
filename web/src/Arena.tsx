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
  type CampaignState, newCampaign, buildCampaignParty, partyLevelOf, longRest, preparableSpells, preparedRoom, partyPreparedRoom,
  applyArenaVictory, reviveParty, buyItem, itemPrice, itemName, itemIcon,
  SHOP_STOCK, shopOffering,
} from '../../src/campaign/campaign.js';
import { buildMonster, MONSTERS } from '../../src/data/monsters.js';
import { membersCoinXP } from '../../src/data/encounters.js';
import { parseMap } from '../../src/data/maps.js';
import {
  buildWave, newArenaRun, recordResult, type ArenaRunState, type ArenaWave,
} from '../../src/arena/run.js';
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

type Phase =
  | { p: 'forge' }
  | { p: 'brief' }
  | { p: 'battle'; combat: Combat }
  | { p: 'loot'; gold: number; items: ItemStack[]; xpGained: number; leveledTo?: number; leveledFrom?: number }
  | { p: 'defeat' };

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
  const wave = buildWave(run.seed, level, run.wave);
  const persist = (nextC: CampaignState, nextRun: ArenaRunState) =>
    saveArenaWeb({ campaign: nextC, run: nextRun });
  const refresh = () => { setC({ ...c }); bump((v) => v + 1); };

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
    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    if (winner !== 'team1') {
      reviveParty(c);
      // Rest after a defeat as well as after a win. The arena's whole premise is
      // that each wave is an independent tactical problem; retrying one at half
      // hit points with the spell slots you already spent is a strictly harder
      // fight than the one you just lost, which is the opposite of that. Worth
      // about four points of win rate on a retry, measured over 20 playthroughs.
      longRest(c);
      const nextRun = recordResult(run, false, wave.purse);
      setRun(nextRun); setC({ ...c }); persist(c, nextRun);
      setPhase({ p: 'defeat' });
      return;
    }
    // Coin scales only with what actually carries a purse — a wolf pack hoards
    // nothing, the same rule adventure treasure uses.
    const result = applyArenaVictory(
      c, survivors, wave.encounter.rawXp, combat.state.rng,
      membersCoinXP(wave.encounter.members),
    );
    c.gold += wave.purse;
    // Full rest between waves: the arena is a tactics test, not an attrition
    // one, and it keeps each wave an honest measure of the fight itself.
    longRest(c);
    const nextRun = recordResult(run, true, wave.purse);
    setRun(nextRun); setC({ ...c }); persist(c, nextRun);
    setPhase({
      p: 'loot',
      gold: result.gold + wave.purse, items: result.items, xpGained: result.xpGained,
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
        onLevelChange={() => { refresh(); persist(c, run); }}
        onContinue={() => setPhase({ p: 'brief' })}
      />
    );
  }

  const backdrop = HAS_BOARD_BG.has(wave.map.theme)
    ? <div className="adv-backdrop" style={{ backgroundImage: `url(${boardBgUrl(wave.map.theme)})` }} />
    : <div className="adv-backdrop glyph"><span>🏟️</span></div>;

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
                  Wave {run.wave} still stands. The healers do their work, and the
                  same challengers are waiting — go again.
                </p>
                <p className="hint">
                  {run.cleared} cleared · attempt {run.attempts + 1} on this wave
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
                <h2>Wave {run.wave}</h2>
                <span className="arena-score">
                  {run.cleared} cleared · {run.clearedFirstTry} first try · {c.gold}g
                </span>
              </div>

              {/* Who you're facing, as faces — a list of names doesn't land. */}
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
                {run.attempts > 0 && ` · attempt ${run.attempts + 1}`}
              </p>

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
                  ⚔️ Fight wave {run.wave}
                </button>
                <button onClick={() => { setPanel(panel === 'shop' ? 'none' : 'shop'); setNotice(null); }}>
                  🛒 {panel === 'shop' ? 'Close the stall' : 'Visit the stall'}
                </button>
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
