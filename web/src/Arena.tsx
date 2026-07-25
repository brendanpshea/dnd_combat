/**
 * Arena mode: endless generated waves, with a full rest and a shop between.
 *
 * The loop is deliberately simple — brief, fight, rest+shop, repeat — because
 * everything interesting is in the generator (src/arena/*). This screen's job
 * is to show what the wave is, keep score honestly, and get out of the way.
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
import type { Id, TeamId } from '../../src/engine/types.js';
import {
  type CampaignState, newCampaign, buildCampaignParty, partyLevelOf, longRest,
  applyArenaVictory, reviveParty, buyItem, itemPrice, itemName, itemIcon,
  SHOP_STOCK, shopOffering,
} from '../../src/campaign/campaign.js';
import { buildMonster, MONSTERS } from '../../src/data/monsters.js';
import { parseMap } from '../../src/data/maps.js';
import {
  buildWave, newArenaRun, recordResult, runSummary, type ArenaRunState, type ArenaWave,
} from '../../src/arena/run.js';
import { ForgeMemberEditor } from './ForgeMember.js';
import { SpellTray } from './SpellTray.js';
import { Portrait } from './Portrait.js';
import type { BattleProps } from './App.js';
import { saveArenaWeb, loadArenaWeb, deleteArenaWeb } from './arenaStorage.js';

type Phase =
  | { p: 'forge' }
  | { p: 'brief' }
  | { p: 'battle'; combat: Combat }
  | { p: 'result'; won: boolean; gold?: number; xp?: number; leveledTo?: number };

interface Props {
  Battle: ComponentType<BattleProps>;
  onExit(): void;
}

/** Build the combatants and board for a wave. */
function makeCombat(c: CampaignState, run: ArenaRunState, wave: ArenaWave): Combat {
  const grid = parseMap(wave.map);
  // Same spread buildEncounter uses, so a wide group fans out from the centre.
  const files = [3, 1, 5, 2, 6, 0, 7, 4];
  const foes = wave.encounter.members.map((mid, i) =>
    buildMonster(mid, 'team2', { x: files[i % files.length]!, y: grid.height - 1 },
      wave.encounter.members.length > 1 ? String(i + 1) : ''));
  return new Combat({
    seed: (run.seed ^ (wave.wave * 7919)) >>> 0,
    map: wave.map,
    combatants: [...buildCampaignParty(c), ...foes],
  });
}

/** "2 Ogres, a Wight" — the roster in words, so the brief says what's coming. */
function describeFoes(members: Id[]): string {
  const counts = new Map<Id, number>();
  for (const m of members) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, n]) => {
      const name = MONSTERS[id]?.name ?? id;
      return n > 1 ? `${n} ${name}s` : name;
    })
    .join(', ');
}

export function ArenaScreen({ Battle, onExit }: Props) {
  const saved = loadArenaWeb();
  const [c, setC] = useState<CampaignState>(() => saved?.campaign ?? newCampaign(Date.now() & 0xffff));
  const [run, setRun] = useState<ArenaRunState>(() => saved?.run ?? newArenaRun(Date.now() & 0xffff));
  const [phase, setPhase] = useState<Phase>(() => (saved ? { p: 'brief' } : { p: 'forge' }));
  const [editing, setEditing] = useState<number | null>(null);
  const [spellsFor, setSpellsFor] = useState<number | null>(null);
  const [shopping, setShopping] = useState(false);
  const [, bump] = useState(0);

  const level = partyLevelOf(c);
  const wave = buildWave(run.seed, level, run.wave);
  const mutate = (fn: () => void) => { fn(); setC({ ...c }); bump((v) => v + 1); };
  const persist = (nextC: CampaignState, nextRun: ArenaRunState) =>
    saveArenaWeb({ campaign: nextC, run: nextRun });

  function beginWave() {
    setPhase({ p: 'battle', combat: makeCombat(c, run, wave) });
  }

  function battleDone(winner: TeamId, combat: Combat) {
    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    if (winner !== 'team1') {
      // No run-ending defeat: the party picks itself up and takes another run
      // at the same wave. The score keeps count of how many needed a second go.
      reviveParty(c);
      const nextRun = recordResult(run, false, wave.purse);
      setRun(nextRun); setC({ ...c }); persist(c, nextRun);
      setPhase({ p: 'result', won: false });
      return;
    }
    const result = applyArenaVictory(c, survivors, wave.encounter.rawXp, combat.state.rng);
    c.gold += wave.purse;
    // A full rest between waves: the arena is a tactics test, not an attrition
    // one, and it keeps each wave an honest measure of the fight itself.
    longRest(c);
    const nextRun = recordResult(run, true, wave.purse);
    setRun(nextRun); setC({ ...c }); persist(c, nextRun);
    setPhase({
      p: 'result', won: true,
      gold: result.gold + wave.purse, xp: result.xpGained,
      ...(result.leveledTo !== undefined ? { leveledTo: result.leveledTo } : {}),
    });
  }

  // ---- forge: build the party before the first wave ----
  if (phase.p === 'forge') {
    return (
      <div className="setup">
        <h2>⚔️ The Arena</h2>
        <p className="muted">
          Endless waves, each one harder than the last. Full rest and a shop between
          fights — lose one and you can take another run at it, so the score is how
          many you clear <b>first try</b>.
        </p>
        {c.characters.map((ch, i) => (
          <div key={i} className="forge-member">
            <button className="forge-summary" onClick={() => setEditing(editing === i ? null : i)}>
              <Portrait id={ch.portraitId ?? ch.classId} team="team1" />
              <b>{ch.name}</b>
              <span className="muted">{ch.speciesId} {ch.classId}</span>
            </button>
            {editing === i && (
              <ForgeMemberEditor
                campaign={c} idx={i} mutate={mutate}
                onEditSpells={() => setSpellsFor(i)}
              />
            )}
          </div>
        ))}
        {spellsFor !== null && (
          <SpellTray
            campaign={c} idx={spellsFor}
            onClose={() => setSpellsFor(null)}
            onSaved={() => { setC({ ...c }); persist(c, run); }}
          />
        )}
        <div className="row">
          <button className="primary" onClick={() => {
            mutate(() => { c.partyReady = true; });
            persist(c, run);
            setPhase({ p: 'brief' });
          }}>Enter the arena</button>
          <button className="ghost" onClick={onExit}>Back</button>
        </div>
      </div>
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

  if (phase.p === 'result') {
    return (
      <div className="setup">
        <h2>{phase.won ? `Wave ${run.wave - 1} cleared` : `Wave ${run.wave} holds`}</h2>
        {phase.won ? (
          <>
            <p>
              +{phase.gold} gold · +{phase.xp} XP
              {phase.leveledTo !== undefined && <b> · Level {phase.leveledTo}!</b>}
            </p>
            <p className="muted">The party rests fully before the next wave.</p>
          </>
        ) : (
          <p className="muted">
            The party is dragged out and patched up. The same wave is waiting —
            take another run at it.
          </p>
        )}
        <p className="muted">{runSummary(run)}</p>
        <div className="row">
          <button className="primary" onClick={() => setPhase({ p: 'brief' })}>Continue</button>
        </div>
      </div>
    );
  }

  // ---- brief: what's next, plus rest/shop ----
  const shelf = shopOffering(SHOP_STOCK, level, `arena-${run.wave}`);
  return (
    <div className="setup">
      <h2>⚔️ Wave {run.wave}</h2>
      <div className="arena-card">
        <div className="arena-stat"><b>{describeFoes(wave.encounter.members)}</b></div>
        <div className="muted">
          {wave.encounter.members.length} enemies · {wave.encounter.types.join(' + ')} ·
          {' '}{parseMap(wave.map).width}×{parseMap(wave.map).height} {wave.map.theme}
        </div>
        {run.attempts > 0 && (
          <div className="notice">Attempt {run.attempts + 1} at this wave.</div>
        )}
      </div>

      <p className="muted">{runSummary(run)} · {c.gold} gold · party level {level}</p>

      <div className="row">
        <button className="primary" onClick={beginWave}>Fight wave {run.wave}</button>
        <button onClick={() => setShopping(!shopping)}>🛒 {shopping ? 'Close shop' : 'Shop'}</button>
        <button className="ghost" onClick={() => { persist(c, run); onExit(); }}>Leave</button>
      </div>

      {shopping && (
        <div className="shop-list">
          {shelf.filter((id) => itemPrice(id) !== undefined).map((id) => (
            <div key={id} className="shop-row">
              <span>{itemIcon(id)} {itemName(id)}</span>
              <span className="muted">{itemPrice(id)}g</span>
              <button
                disabled={c.gold < (itemPrice(id) ?? 0)}
                onClick={() => mutate(() => { buyItem(c, 0, id); persist(c, run); })}
              >Buy</button>
            </div>
          ))}
          <p className="muted">
            Bought gear goes to {c.characters[0]?.name}; open the party editor to move it.
          </p>
        </div>
      )}

      <div className="row">
        <button className="ghost" onClick={() => {
          deleteArenaWeb();
          const freshC = newCampaign(Date.now() & 0xffff);
          const freshRun = newArenaRun(Date.now() & 0xffff);
          setC(freshC); setRun(freshRun); setPhase({ p: 'forge' });
        }}>Start a new run</button>
      </div>
    </div>
  );
}

