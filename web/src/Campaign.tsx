/**
 * Browser campaign: shop/equip/steal/haggle between battles, loot after,
 * progress in localStorage. All game logic lives in src/campaign; this file
 * is forms and routing.
 */
import { useRef, useState, ComponentType } from 'react';
import { Combat } from '../../src/engine/combat.js';
import type { TeamId, Id, ItemStack } from '../../src/engine/types.js';
import { buildEncounter, ENCOUNTERS } from '../../src/data/monsters.js';
import { MAPS } from '../../src/data/maps.js';
import { CLASSES } from '../../src/data/classes.js';
import {
  CampaignState, newCampaign, currentStage, isComplete, buildCampaignParty,
  applyVictory, buyItem, sellItem, itemPrice, itemName, SHOP_STOCK, STAGES,
  giveItem, equipItem, equipBlocked, unequipSlot, EquipSlot,
  attemptSteal, attemptHaggle, bestAtSkill, HAGGLE, SkillRoll, shopVisitFor,
} from '../../src/campaign/campaign.js';
import { saveCampaignWeb, loadCampaignWeb, deleteCampaignWeb } from './campaignStorage.js';
import type { BattleProps } from './App.js';
import { initAudio } from './sound.js';

type Phase =
  | { p: 'shop' }
  | { p: 'battle'; combat: Combat; aiTeams: Set<TeamId> }
  | { p: 'loot'; gold: number; items: ItemStack[] }
  | { p: 'over' }
  | { p: 'complete' };

interface Props {
  Battle: ComponentType<BattleProps>;
  onExit(): void;
}

export function CampaignScreen({ Battle, onExit }: Props) {
  const stateRef = useRef<CampaignState | null>(null);
  if (!stateRef.current) {
    stateRef.current = loadCampaignWeb() ?? newCampaign(Math.floor(Math.random() * 2 ** 31));
  }
  const c = stateRef.current;
  const [, setVersion] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => (isComplete(c) ? { p: 'complete' } : { p: 'shop' }));
  const [rolls, setRolls] = useState<SkillRoll[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [equipFor, setEquipFor] = useState<number | null>(null);
  const [giveFrom, setGiveFrom] = useState<number | null>(null);
  const [buyFor, setBuyFor] = useState(0);

  const mutate = (fn: () => void) => {
    initAudio();
    fn();
    saveCampaignWeb(c);
    setVersion((v) => v + 1);
  };

  const stage = currentStage(c);
  const visit = shopVisitFor(c);
  const price = (id: Id) => Math.ceil((itemPrice(id) ?? 0) * visit.priceMult);

  function startBattle() {
    const st = currentStage(c)!;
    const combat = new Combat({
      seed: (c.rng ^ (c.stage * 7919)) >>> 0,
      mapId: st.mapId,
      combatants: [...buildCampaignParty(c), ...buildEncounter(st.encounterId, 'team2', 7)],
    });
    setPhase({ p: 'battle', combat, aiTeams: new Set<TeamId>(['team2']) });
  }

  function battleDone(winner: TeamId, combat: Combat) {
    if (winner !== 'team1') {
      deleteCampaignWeb();
      setPhase({ p: 'over' });
      return;
    }
    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    const result = applyVictory(c, survivors, combat.state.rng);
    if (isComplete(c)) deleteCampaignWeb();
    else saveCampaignWeb(c);
    setPhase({ p: 'loot', gold: result.gold, items: result.items });
  }

  if (phase.p === 'battle') {
    const st = stage!;
    return (
      <Battle
        combat={phase.combat}
        aiTeams={phase.aiTeams}
        mapLabel={`${ENCOUNTERS[st.encounterId]!.name} — ${MAPS[st.mapId]!.name}`}
        doneLabel="Continue"
        onExit={() => setPhase({ p: 'shop' })}
        onDone={(winner) => battleDone(winner, phase.combat)}
      />
    );
  }

  if (phase.p === 'over' || phase.p === 'complete') {
    return (
      <div className="setup">
        <h1>{phase.p === 'complete' ? '🏆 Campaign complete!' : '☠️ The party has fallen'}</h1>
        <p className="hint">
          {phase.p === 'complete'
            ? `The ogre is slain. Final gold: ${c.gold}. Battles won: ${c.victories.length}/${STAGES.length}.`
            : 'The campaign is over. A new party awaits.'}
        </p>
        <button
          className="primary"
          onClick={() => {
            stateRef.current = newCampaign(Math.floor(Math.random() * 2 ** 31));
            setPhase({ p: 'shop' });
            setRolls([]);
            setNotice(null);
          }}
        >
          New campaign
        </button>
        <button onClick={onExit}>Main menu</button>
      </div>
    );
  }

  if (phase.p === 'loot') {
    return (
      <div className="setup">
        <h1>🎉 Victory!</h1>
        <p className="hint">
          Loot: {phase.gold} gold
          {phase.items.length > 0 && ` — ${phase.items.map((i) => `${itemName(i.itemId)}×${i.qty}`).join(', ')}`}
        </p>
        <button
          className="primary"
          onClick={() => setPhase(isComplete(c) ? { p: 'complete' } : { p: 'shop' })}
        >
          Continue
        </button>
      </div>
    );
  }

  // ---- shop phase ----
  const enc = stage ? ENCOUNTERS[stage.encounterId]! : undefined;
  const charNames = c.characters.map((ch) => CLASSES[ch.classId]!.name);

  return (
    <div className="campaign">
      <header className="topbar">
        <button className="ghost" onClick={onExit}>✕</button>
        <span className="round">💰 {c.gold}g</span>
        <span className="mapname">
          Stage {c.stage + 1}/{STAGES.length}: {enc?.name} (lvl {stage?.partyLevel}, {stage ? MAPS[stage.mapId]!.name : ''})
        </span>
      </header>

      {visit.priceMult !== 1 && (
        <div className="notice">
          {visit.priceMult < 1
            ? `Haggled: ${Math.round((1 - visit.priceMult) * 100)}% off this visit`
            : `The shopkeeper is annoyed: +${Math.round((visit.priceMult - 1) * 100)}% this visit`}
        </div>
      )}
      {visit.banned && <div className="notice">👁 The shopkeeper is watching you closely.</div>}
      {notice && <div className="notice">{notice}</div>}
      {rolls.map((r, i) => (
        <div key={i} className="notice roll">
          🎲 {CLASSES[r.by]!.name} rolls {r.skill}: d20({r.natural}) = {r.total} vs DC {r.dc} — {r.success ? 'success!' : 'failure'}
        </div>
      ))}

      <section className="panel">
        <h3>Party</h3>
        {c.characters.map((ch, idx) => (
          <div key={idx} className="char-card">
            <div className="char-head">
              <strong>{charNames[idx]}</strong>
              <span className="muted">
                {itemName(ch.equipped.mainHand)}
                {ch.equipped.offHand ? ` + ${itemName(ch.equipped.offHand)}` : ''}
                {ch.equipped.armor ? `, ${itemName(ch.equipped.armor)}` : ', unarmored'}
              </span>
              <button className="mini" onClick={() => { setEquipFor(equipFor === idx ? null : idx); setGiveFrom(null); }}>Equip</button>
              <button className="mini" onClick={() => { setGiveFrom(giveFrom === idx ? null : idx); setEquipFor(null); }}>Give</button>
            </div>
            <div className="char-items">
              {ch.inventory.filter((s) => s.qty > 0).map((s) => (
                <span key={s.itemId} className="item-chip">
                  {itemName(s.itemId)}{s.qty > 1 ? `×${s.qty}` : ''}
                </span>
              ))}
              {ch.inventory.every((s) => s.qty <= 0) && <span className="muted">(no items)</span>}
            </div>

            {equipFor === idx && (
              <div className="subpanel">
                {ch.inventory.filter((s) => s.qty > 0).map((s) => {
                  const slots: EquipSlot[] = ['mainHand', 'offHand', 'armor'];
                  const options = slots
                    .map((slot) => ({ slot, blocked: equipBlocked(c, idx, s.itemId, slot) }))
                    .filter((o) => o.blocked === undefined);
                  if (options.length === 0) return null;
                  return options.map((o) => (
                    <button
                      key={`${s.itemId}:${o.slot}`}
                      className="mini"
                      onClick={() => mutate(() => { equipItem(c, idx, s.itemId, o.slot); setNotice(null); })}
                    >
                      Equip {itemName(s.itemId)} ({o.slot === 'mainHand' ? 'main' : o.slot === 'offHand' ? 'off-hand' : 'armor'})
                    </button>
                  ));
                })}
                {ch.equipped.offHand && (
                  <button className="mini" onClick={() => mutate(() => unequipSlot(c, idx, 'offHand'))}>
                    Unequip off-hand
                  </button>
                )}
                {ch.equipped.armor && (
                  <button className="mini" onClick={() => mutate(() => unequipSlot(c, idx, 'armor'))}>
                    Unequip armor
                  </button>
                )}
              </div>
            )}

            {giveFrom === idx && (
              <div className="subpanel">
                {ch.inventory.filter((s) => s.qty > 0).map((s) =>
                  c.characters.map((_, to) =>
                    to !== idx ? (
                      <button
                        key={`${s.itemId}:${to}`}
                        className="mini"
                        onClick={() => mutate(() => giveItem(c, idx, to, s.itemId))}
                      >
                        {itemName(s.itemId)} → {charNames[to]}
                      </button>
                    ) : null,
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>Shop</h3>
        <label className="buyfor">
          Purchases go to{' '}
          <select value={buyFor} onChange={(e) => setBuyFor(Number(e.target.value))}>
            {charNames.map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
        </label>
        <div className="shop-grid">
          {SHOP_STOCK.map((id) => (
            <button
              key={id}
              disabled={c.gold < price(id)}
              onClick={() => mutate(() => {
                if (buyItem(c, buyFor, id, price(id))) {
                  setNotice(`Bought ${itemName(id)} for ${price(id)}g → ${charNames[buyFor]}`);
                  setRolls([]);
                }
              })}
            >
              {itemName(id)} <span className="muted">{price(id)}g</span>
            </button>
          ))}
        </div>
        <div className="shop-actions">
          <span className="muted">Sell (half price):</span>
          {c.characters.flatMap((ch, idx) =>
            ch.inventory
              .filter((s) => s.qty > 0 && itemPrice(s.itemId) !== undefined)
              .map((s) => (
                <button
                  key={`${idx}:${s.itemId}`}
                  className="mini"
                  onClick={() => mutate(() => {
                    if (sellItem(c, idx, s.itemId)) setNotice(`Sold ${itemName(s.itemId)} (+${Math.floor(itemPrice(s.itemId)! / 2)}g)`);
                  })}
                >
                  {itemName(s.itemId)} ({charNames[idx]})
                </button>
              )),
          )}
        </div>
        <div className="shop-actions">
          {!visit.banned && !visit.haggleUsed && (
            <>
              {(Object.keys(HAGGLE) as Array<keyof typeof HAGGLE>).map((skill) => {
                const best = bestAtSkill(c, skill);
                return (
                  <button
                    key={skill}
                    className="mini"
                    onClick={() => mutate(() => {
                      const v = shopVisitFor(c);
                      v.haggleUsed = true;
                      const result = attemptHaggle(c, skill);
                      v.priceMult = result.priceMultiplier;
                      setRolls([result.roll]);
                      setNotice(null);
                    })}
                  >
                    {skill} ({CLASSES[c.characters[best.idx]!.classId]!.name} +{best.bonus})
                  </button>
                );
              })}
            </>
          )}
          {!visit.banned && !visit.stealUsed && (
            <button
              className="mini danger"
              onClick={() => mutate(() => {
                const v = shopVisitFor(c);
                v.stealUsed = true;
                const result = attemptSteal(c);
                setRolls(result.rolls);
                if (result.success) setNotice(`🪄 Swiped: ${itemName(result.itemId!)}!`);
                else {
                  v.banned = true;
                  setNotice(`Caught! Fined ${result.fine}g.`);
                }
              })}
            >
              🕵️ Steal (random item)
            </button>
          )}
        </div>
      </section>

      <button className="primary tobattle" onClick={startBattle}>
        ⚔️ To battle: {enc?.name}
      </button>
    </div>
  );
}
