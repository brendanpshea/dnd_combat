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
import { SPECIES } from '../../src/data/species.js';
import { ITEMS } from '../../src/data/items.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { acOf } from '../../src/data/armor.js';
import {
  CampaignState, newCampaign, currentStage, isComplete, buildCampaignParty,
  applyVictory, buyItem, sellItem, itemPrice, itemName, itemIcon, SHOP_STOCK, STAGES,
  giveItem, equipItem, equipBlocked, unequipSlot, EquipSlot,
  attemptSteal, attemptHaggle, bestAtSkill, HAGGLE, SkillRoll, shopVisitFor,
  partyLevelOf, LEVEL_XP, MAX_LEVEL, setPartyClass,
} from '../../src/campaign/campaign.js';
import { saveCampaignWeb, loadCampaignWeb, deleteCampaignWeb } from './campaignStorage.js';
import type { BattleProps } from './App.js';
import { Portrait } from './Portrait.js';
import { LootScreen } from './Loot.js';
import { initAudio } from './sound.js';

type Phase =
  | { p: 'forge' }
  | { p: 'shop' }
  | { p: 'battle'; combat: Combat; aiTeams: Set<TeamId> }
  | { p: 'loot'; gold: number; items: ItemStack[]; xpGained: number; leveledTo?: number | undefined }
  | { p: 'over' }
  | { p: 'complete' };

type ShopCategory = 'consumables' | 'weapons' | 'armor';

const SHOP_CATEGORIES: Array<{ id: ShopCategory; label: string }> = [
  { id: 'consumables', label: 'Supplies' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
];

const PORTRAIT_OPTIONS = ['fighter', 'wizard', 'cleric', 'rogue'] as const;

function shopCategory(itemId: Id): ShopCategory {
  if (ITEMS[itemId]) return 'consumables';
  if (WEAPONS[itemId]) return 'weapons';
  return 'armor';
}

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
  const [phase, setPhase] = useState<Phase>(() => (
    isComplete(c) ? { p: 'complete' } : c.partyReady ? { p: 'shop' } : { p: 'forge' }
  ));
  const [rolls, setRolls] = useState<SkillRoll[]>([]);
  /**
   * Transient updates ("Bought Chain Mail → Sir Arthur") used to render inline
   * above a long scrolling list, which is exactly where the eye isn't after you
   * tap a button near the bottom. They're toasts now: bottom-centre, near the
   * thumb, and they expire on their own. Persistent *state* — haggled prices, a
   * watchful shopkeeper — stays inline, because it's a fact about the visit
   * rather than a thing that just happened.
   */
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const toastId = useRef(0);
  const setNotice = (text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);   // at most 3 on screen
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };
  const [equipFor, setEquipFor] = useState<number | null>(null);
  const [giveFrom, setGiveFrom] = useState<number | null>(null);
  const [buyFor, setBuyFor] = useState(0);
  const [stockCategory, setStockCategory] = useState<ShopCategory>('consumables');
  const [sellMode, setSellMode] = useState(false);
  const [advanced, setAdvanced] = useState(false);

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
      if (c.storyMode) {
        // Story mode: no permadeath — regroup and retry the same fight.
        setNotice('The party retreats to regroup. Take another run at it!');
        setPhase({ p: 'shop' });
        return;
      }
      deleteCampaignWeb();
      setPhase({ p: 'over' });
      return;
    }
    const survivors = Object.values(combat.state.combatants).filter((x) => x.team === 'team1');
    const result = applyVictory(c, survivors, combat.state.rng);
    if (isComplete(c)) deleteCampaignWeb();
    else saveCampaignWeb(c);
    setPhase({ p: 'loot', gold: result.gold, items: result.items, xpGained: result.xpGained, leveledTo: result.leveledTo });
  }

  if (phase.p === 'battle') {
    const st = stage!;
    return (
      <Battle
        combat={phase.combat}
        aiTeams={phase.aiTeams}
        aiLevel={c.storyMode ? 'easy' : 'normal'}
        storyMode={c.storyMode}
        mapLabel={`${ENCOUNTERS[st.encounterId]!.name} — ${MAPS[st.mapId]!.name}`}
        theme={MAPS[st.mapId]!.theme}
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
            setPhase({ p: 'forge' });
            setRolls([]);
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
      <LootScreen
        campaign={c}
        gold={phase.gold}
        items={phase.items}
        xpGained={phase.xpGained}
        leveledTo={phase.leveledTo}
        onContinue={() => setPhase(isComplete(c) ? { p: 'complete' } : { p: 'shop' })}
      />
    );
  }

  if (phase.p === 'forge') {
    return (
      <div className="party-forge">
        <header className="forge-header">
          <button className="ghost" onClick={onExit}>✕</button>
          <div>
            <h1>Form your party</h1>
            <p>Choose each adventurer&apos;s identity before the campaign begins.</p>
          </div>
        </header>
        <div className="forge-list">
          {c.characters.map((character, idx) => {
            const classData = CLASSES[character.classId]!;
            return (
              <section className="forge-member" key={idx}>
                <div className="forge-preview">
                  <Portrait id={character.portraitId} team="team1" big label={`${character.name} portrait`} />
                  <span className="forge-role">{classData.name}</span>
                </div>
                <label className="forge-field">
                  <span>Name</span>
                  <input
                    value={character.name}
                    maxLength={24}
                    onChange={(event) => mutate(() => { character.name = event.target.value || classData.name; })}
                  />
                </label>
                <label className="forge-field">
                  <span>Class</span>
                  <select
                    value={character.classId}
                    onChange={(event) => mutate(() => setPartyClass(c, idx, event.target.value))}
                  >
                    {Object.values(CLASSES).map((candidate) => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="forge-field">
                  <span>Species</span>
                  <select
                    value={character.speciesId}
                    onChange={(event) => mutate(() => { character.speciesId = event.target.value; })}
                  >
                    {Object.values(SPECIES).map((species) => (
                      <option key={species.id} value={species.id}>{species.name}</option>
                    ))}
                  </select>
                </label>
                <div className="forge-field portrait-picker">
                  <span>Portrait</span>
                  <div role="radiogroup" aria-label={`${character.name} portrait`}>
                    {PORTRAIT_OPTIONS.map((portraitId) => (
                      <button
                        key={portraitId}
                        className={character.portraitId === portraitId ? 'selected' : ''}
                        role="radio"
                        aria-checked={character.portraitId === portraitId}
                        title={`Use ${CLASSES[portraitId]!.name} portrait`}
                        onClick={() => mutate(() => { character.portraitId = portraitId; })}
                      >
                        <Portrait id={portraitId} team="team1" label={`${CLASSES[portraitId]!.name} portrait`} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
        <fieldset className="difficulty-pick">
          <legend>Difficulty</legend>
          <label className={c.storyMode ? 'selected' : ''}>
            <input type="radio" name="difficulty" checked={c.storyMode} onChange={() => mutate(() => { c.storyMode = true; })} />
            <b>🌱 Story</b> — gentler foes; a loss just lets you try the fight again.
          </label>
          <label className={!c.storyMode ? 'selected' : ''}>
            <input type="radio" name="difficulty" checked={!c.storyMode} onChange={() => mutate(() => { c.storyMode = false; })} />
            <b>⚔️ Adventurer</b> — tougher foes; losing ends the campaign.
          </label>
        </fieldset>
        <button
          className="primary forge-ready"
          onClick={() => mutate(() => { c.partyReady = true; setPhase({ p: 'shop' }); })}
        >
          Begin campaign
        </button>
      </div>
    );
  }

  // ---- shop phase ----
  const enc = stage ? ENCOUNTERS[stage.encounterId]! : undefined;
  // The characters have names; the shop was showing their classes.
  const charNames = c.characters.map((ch) => ch.name);
  const party = buildCampaignParty(c);
  const stockedItems = SHOP_STOCK.filter((id) => shopCategory(id) === stockCategory);
  const healingCount = c.characters.reduce(
    (total, ch) => total + ch.inventory.filter((s) => s.itemId.includes('potion')).reduce((n, s) => n + s.qty, 0),
    0,
  );
  const lowestAc = Math.min(...party.map(acOf));
  const encounterSize = enc?.members.length ?? 0;

  return (
    <div className="campaign">
      <header className="topbar">
        <button className="ghost" onClick={onExit}>✕</button>
        <span className="round">💰 {c.gold}g · L{partyLevelOf(c)}{partyLevelOf(c) < MAX_LEVEL ? ` (${c.xp}/${LEVEL_XP[partyLevelOf(c)]} XP)` : ''}</span>
        <span className="mapname">
          Stage {c.stage + 1}/{STAGES.length}: {enc?.name} ({stage ? MAPS[stage.mapId]!.name : ''}
          {enc && partyLevelOf(c) < enc.suggestedLevel ? ', under-leveled!' : ''})
        </span>
        <button
          className="ghost"
          title="Abandon this campaign and start over"
          onClick={() => {
            if (!confirm('Abandon this campaign and delete your save?')) return;
            deleteCampaignWeb();
            stateRef.current = newCampaign(Math.floor(Math.random() * 2 ** 31));
            setPhase({ p: 'shop' });
            setRolls([]);
          }}
        >
          🗑 Reset
        </button>
      </header>

      {visit.priceMult !== 1 && (
        <div className="notice">
          {visit.priceMult < 1
            ? `Haggled: ${Math.round((1 - visit.priceMult) * 100)}% off this visit`
            : `The shopkeeper is annoyed: +${Math.round((visit.priceMult - 1) * 100)}% this visit`}
        </div>
      )}
      {visit.banned && <div className="notice">👁 The shopkeeper is watching you closely.</div>}
      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((t) => <div key={t.id} className="toast">{t.text}</div>)}
        </div>
      )}
      {rolls.map((r, i) => (
        <div key={i} className="notice roll">
          🎲 {charNames[r.by] ?? 'The party'} rolls {r.skill}: d20({r.natural}) = {r.total} vs DC {r.dc} — {r.success ? 'success!' : 'failure'}
        </div>
      ))}

      <section className="panel">
        <h3>Party</h3>
        {c.characters.map((ch, idx) => (
          <div key={idx} className="char-card">
            <div className="char-head char-identity">
              <Portrait id={ch.portraitId} team="team1" label={`${ch.name} portrait`} />
              <div className="char-name">
                <strong>{ch.name}</strong>
                <span className="muted">{SPECIES[ch.speciesId]?.name ?? ch.speciesId}</span>
              </div>
              {advanced && (
                <div className="char-controls">
                  <button className="mini" onClick={() => { setEquipFor(equipFor === idx ? null : idx); setGiveFrom(null); }}>Equip</button>
                  <button className="mini" onClick={() => { setGiveFrom(giveFrom === idx ? null : idx); setEquipFor(null); }}>Give</button>
                </div>
              )}
            </div>
            <div className="gear-row">
              <span className="gear-slot">{itemIcon(ch.equipped.mainHand)} <b>{itemName(ch.equipped.mainHand)}</b></span>
              <span className="gear-slot">{ch.equipped.offHand ? `${itemIcon(ch.equipped.offHand)} ` : ''}<b>{ch.equipped.offHand ? itemName(ch.equipped.offHand) : 'No off-hand'}</b></span>
              <span className="gear-slot">{ch.equipped.armor ? `${itemIcon(ch.equipped.armor)} ` : ''}<b>{ch.equipped.armor ? itemName(ch.equipped.armor) : 'Unarmored'}</b></span>
              <span className="gear-ac">🛡 {acOf(party[idx]!)}</span>
            </div>
            <div className="char-items">
              <span className="inventory-label">Pack</span>
              {ch.inventory.filter((s) => s.qty > 0).map((s) => (
                <span key={s.itemId} className="item-chip">
                  {itemIcon(s.itemId)} {itemName(s.itemId)}{s.qty > 1 ? `×${s.qty}` : ''}
                </span>
              ))}
              {ch.inventory.every((s) => s.qty <= 0) && <span className="muted">(empty)</span>}
            </div>

            {advanced && equipFor === idx && (
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
                      onClick={() => mutate(() => {
                        equipItem(c, idx, s.itemId, o.slot);
                        setNotice(`${itemIcon(s.itemId)} ${charNames[idx]} equips ${itemName(s.itemId)}`);
                      })}
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

            {advanced && giveFrom === idx && (
              <div className="subpanel">
                {ch.inventory.filter((s) => s.qty > 0).map((s) =>
                  c.characters.map((_, to) =>
                    to !== idx ? (
                      <button
                        key={`${s.itemId}:${to}`}
                        className="mini"
                        onClick={() => mutate(() => giveItem(c, idx, to, s.itemId))}
                      >
                        {itemIcon(s.itemId)} {itemName(s.itemId)} → {charNames[to]}
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
        <div className="shop-heading">
          <h3>Shop</h3>
          <label className="buyfor">
            To{' '}
          <select value={buyFor} onChange={(e) => setBuyFor(Number(e.target.value))}>
            {charNames.map((n, i) => <option key={i} value={i}>{n}</option>)}
          </select>
          </label>
        </div>
        <div className="shop-tabs" role="tablist" aria-label="Shop category">
          {SHOP_CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={stockCategory === category.id ? 'selected' : ''}
              onClick={() => setStockCategory(category.id)}
              role="tab"
              aria-selected={stockCategory === category.id}
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="shop-grid">
          {stockedItems.map((id) => {
            const missingGold = Math.max(0, price(id) - c.gold);
            return (
              <button
                key={id}
                disabled={c.gold < price(id)}
                title={missingGold > 0 ? `Need ${missingGold} more gold` : `Buy for ${charNames[buyFor]}`}
                onClick={() => mutate(() => {
                  if (buyItem(c, buyFor, id, price(id))) {
                    setNotice(`Bought ${itemName(id)} for ${price(id)}g → ${charNames[buyFor]}`);
                    setRolls([]);
                  }
                })}
              >
                {itemIcon(id)} {itemName(id)} <span className="muted">{price(id)}g</span>
              </button>
            );
          })}
        </div>

        {/* One-tap common purchase — the thing you do almost every visit. */}
        <button
          className="quick-buy"
          disabled={c.gold < price('potion-healing')}
          onClick={() => mutate(() => {
            let bought = 0;
            for (let i = 0; i < c.characters.length; i++) {
              if (c.gold >= price('potion-healing') && buyItem(c, i, 'potion-healing', price('potion-healing'))) bought++;
            }
            if (bought) { setNotice(`Bought ${bought} Potion${bought === 1 ? '' : 's'} of Healing — one per hero.`); setRolls([]); }
          })}
        >
          🧪 Stock up — a Potion of Healing for each hero
        </button>

        <button className="adv-toggle" onClick={() => setAdvanced((a) => !a)}>
          {advanced ? '▾ Hide advanced options' : '▸ Advanced: sell, haggle, steal, equip'}
        </button>

        {advanced && (
          <>
            <div className="sell-heading">
              <span className="muted">Sell from packs</span>
              <button className={`mini ${sellMode ? 'selected' : ''}`} onClick={() => setSellMode((open) => !open)}>
                {sellMode ? 'Done selling' : 'Sell items'}
              </button>
            </div>
            {sellMode && <div className="shop-actions sell-items">
              {c.characters.flatMap((ch, idx) =>
                ch.inventory.filter((s) => s.qty > 0 && Math.floor((itemPrice(s.itemId) ?? 0) / 2) > 0).map((s) => (
                  <button
                    key={`${idx}:${s.itemId}`}
                    className="mini"
                    onClick={() => mutate(() => {
                      if (sellItem(c, idx, s.itemId)) setNotice(`Sold ${itemName(s.itemId)} (+${Math.floor(itemPrice(s.itemId)! / 2)}g)`);
                    })}
                  >
                    {itemIcon(s.itemId)} {itemName(s.itemId)} · {charNames[idx]} <span className="muted">+{Math.floor(itemPrice(s.itemId)! / 2)}g</span>
                  </button>
                )),
              )}
            </div>}
            <div className="gambits">
              <span className="muted">Shop gambits (once per visit)</span>
              <div className="shop-actions">
                {!visit.banned && !visit.haggleUsed && (
                  <>
                    {(Object.keys(HAGGLE) as Array<keyof typeof HAGGLE>).map((skill) => {
                      const best = bestAtSkill(c, skill);
                      return (
                        <button
                          key={skill}
                          className="mini"
                          title={`${charNames[best.idx]} rolls, bonus +${best.bonus}`}
                          onClick={() => mutate(() => {
                            const v = shopVisitFor(c);
                            v.haggleUsed = true;
                            const result = attemptHaggle(c, skill);
                            v.priceMult = result.priceMultiplier;
                            setRolls([result.roll]);
                            const who = charNames[result.roll.by] ?? 'The party';
                            const pct = Math.round(Math.abs(1 - result.priceMultiplier) * 100);
                            setNotice(result.roll.success
                              ? `💬 ${who} talks them down — ${pct}% off this visit!`
                              : `😠 ${who} fumbles it — prices up ${pct}% this visit.`);
                          })}
                        >
                          💬 {skill}
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
            </div>
          </>
        )}
      </section>

      <div className="battle-brief">
        <span><b>{enc?.name}</b> · {encounterSize} foes · {stage ? MAPS[stage.mapId]!.name : ''}</span>
        <span>{healingCount} healing potion{healingCount === 1 ? '' : 's'} · lowest AC {lowestAc}</span>
      </div>
      <button className="primary tobattle" onClick={startBattle}>
        ⚔️ To battle: {enc?.name}
      </button>
    </div>
  );
}
