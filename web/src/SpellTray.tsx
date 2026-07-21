/**
 * The spell-selection tray (cantrips / spellbook / prepared), shared by the
 * campaign's between-battle screen and the adventure's camp screen. It owns its
 * own draft state — seeded from the character on mount — and only touches the
 * campaign through the same setters both callers already use. Save applies the
 * three tiers and hands a message back; the caller persists and re-renders.
 */
import { useState } from 'react';
import type { Id } from '../../src/engine/types.js';
import {
  type CampaignState,
  cantripPool, cantripLimit, knownCantrips, setCantrips,
  spellbookPool, spellbookLimit, chosenSpellbook, setSpellbook,
  preparableSpells, preparedLimit, preparedSpells, setPrepared,
  knownRitualSpells, resetPrepared,
} from '../../src/campaign/campaign.js';
import { SPELLS } from '../../src/data/spells.js';

export function SpellTray(
  { campaign: c, idx, mode = 'create', onClose, onSaved }: {
    campaign: CampaignState;
    idx: number;
    /** `create` (the forge): pick cantrips, spellbook, and prepared freely.
     *  `prepare` (the field, after a long rest): cantrips and the spellbook are
     *  locked in — only the prepared list may change. */
    mode?: 'create' | 'prepare';
    onClose: () => void;
    onSaved: (msg: string) => void;
  },
) {
  const ch = c.characters[idx]!;
  const locked = mode === 'prepare'; // cantrips + spellbook are fixed in the field
  const [cantripDraft, setCantripDraft] = useState<Id[]>(() => knownCantrips(c, idx));
  const [spellbookDraft, setSpellbookDraft] = useState<Id[]>(() => chosenSpellbook(c, idx));
  const [prepareDraft, setPrepareDraft] = useState<Id[]>(() => preparedSpells(c, idx));

  const cPool = cantripPool(c, idx);
  const cCap = cantripLimit(c, idx);
  const bookPool = spellbookPool(c, idx);          // empty for a knows-all caster (cleric)
  const bookCap = spellbookLimit(c, idx);          // undefined for a cleric
  const usesBook = bookCap !== undefined;
  const cap = preparedLimit(c, idx);
  const rituals = knownRitualSpells(c, idx);
  const leveledPool = usesBook ? spellbookDraft : preparableSpells(c, idx);
  const isDefault = ch.prepared === undefined && ch.cantrips === undefined && ch.spellbook === undefined;
  const cAtCap = cantripDraft.length >= cCap;
  const bookAtCap = usesBook && spellbookDraft.length >= (bookCap ?? 0);
  const atCap = prepareDraft.length >= cap;

  const toggleCantrip = (id: Id) => setCantripDraft((d) =>
    d.includes(id) ? d.filter((x) => x !== id) : cAtCap ? d : [...d, id]);
  const toggleBook = (id: Id) => setSpellbookDraft((d) => {
    if (d.includes(id)) { setPrepareDraft((p) => p.filter((x) => x !== id)); return d.filter((x) => x !== id); }
    return bookAtCap ? d : [...d, id];
  });
  const togglePrepare = (id: Id) => setPrepareDraft((d) =>
    d.includes(id) ? d.filter((x) => x !== id) : atCap ? d : [...d, id]);

  return (
    <div className="tray-backdrop" onClick={onClose}>
      <div className="tray" onClick={(e) => e.stopPropagation()}>
        <div className="tray-head">
          📖 {ch.name}'s Spells
          <span className="muted">
            — {cantripDraft.length}/{cCap} cantrips{usesBook ? `, ${spellbookDraft.length}/${bookCap} known` : ''}, {prepareDraft.length}/{cap} prepared
          </span>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        {isDefault && !locked && (
          <p className="hint">A sensible set is chosen by default — adjust only if you want to.</p>
        )}
        {locked && (
          <p className="hint">Rested at last — choose which spells to prepare. Your cantrips{usesBook ? ' and spellbook are' : ' are'} fixed until you level up.</p>
        )}
        {cPool.length > 0 && (
          locked ? (
            // Cantrips are known for good — show them, but they can't be swapped.
            <div className="sheet-row">
              <span className="sheet-label">Cantrips (always ready)</span>
              {cantripDraft.map((id) => (
                <span key={id} className="item-chip muted">{SPELLS[id]?.icon} {SPELLS[id]?.name ?? id}</span>
              ))}
            </div>
          ) : (
            <div className="sheet-row prepare-list">
              <span className="sheet-label">Cantrips ({cantripDraft.length}/{cCap}) — always ready</span>
              <div className="prepare-grid">
                {cPool.map((id) => {
                  const checked = cantripDraft.includes(id);
                  return (
                    <label key={id} className={`prepare-option${checked ? ' checked' : ''}`}>
                      <input type="checkbox" checked={checked} disabled={!checked && cAtCap} onChange={() => toggleCantrip(id)} />
                      {SPELLS[id]?.icon} {SPELLS[id]?.name ?? id}
                    </label>
                  );
                })}
              </div>
            </div>
          )
        )}
        {usesBook && (
          locked ? (
            // The spellbook only grows by leveling or scribing scrolls, never here.
            <div className="sheet-row">
              <span className="sheet-label">Spellbook — spells known</span>
              {spellbookDraft.map((id) => (
                <span key={id} className="item-chip muted">{SPELLS[id]?.icon} {SPELLS[id]?.name ?? id}</span>
              ))}
            </div>
          ) : (
            <div className="sheet-row prepare-list">
              <span className="sheet-label">Spellbook ({spellbookDraft.length}/{bookCap}) — spells known</span>
              <div className="prepare-grid">
                {bookPool.map((id) => {
                  const checked = spellbookDraft.includes(id);
                  return (
                    <label key={id} className={`prepare-option${checked ? ' checked' : ''}`}>
                      <input type="checkbox" checked={checked} disabled={!checked && bookAtCap} onChange={() => toggleBook(id)} />
                      {SPELLS[id]?.icon} {SPELLS[id]?.name ?? id}
                    </label>
                  );
                })}
              </div>
            </div>
          )
        )}
        <div className="sheet-row prepare-list">
          <span className="sheet-label">Prepared ({prepareDraft.length}/{cap})</span>
          <div className="prepare-grid">
            {leveledPool.map((id) => {
              const checked = prepareDraft.includes(id);
              return (
                <label key={id} className={`prepare-option${checked ? ' checked' : ''}`}>
                  <input type="checkbox" checked={checked} disabled={!checked && atCap} onChange={() => togglePrepare(id)} />
                  {SPELLS[id]?.icon} {SPELLS[id]?.name ?? id}<span className="muted"> (L{SPELLS[id]?.level ?? 1})</span>
                </label>
              );
            })}
            {leveledPool.length === 0 && <span className="muted">Pick spellbook spells above first.</span>}
          </div>
        </div>
        {rituals.length > 0 && (
          <div className="sheet-row">
            <span className="sheet-label">Rituals (always ready)</span>
            {rituals.map((id) => (
              <span key={id} className="item-chip muted">{SPELLS[id]?.icon} {SPELLS[id]?.name ?? id}</span>
            ))}
          </div>
        )}
        <div className="sheet-row">
          <button className="mini" onClick={() => {
            resetPrepared(c, idx);
            onSaved(`${ch.name} takes the recommended spells.`);
            onClose();
          }}>Use recommended</button>
          <button className="mini primary" onClick={() => {
            if (!locked) {
              setCantrips(c, idx, cantripDraft);
              if (usesBook) setSpellbook(c, idx, spellbookDraft);
            }
            setPrepared(c, idx, prepareDraft);
            onSaved(`${ch.name}'s spells are set.`);
            onClose();
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}
