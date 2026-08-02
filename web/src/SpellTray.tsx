/**
 * The spell-selection tray (cantrips / spellbook / prepared), shared by the
 * campaign's between-battle screen and the adventure's camp screen. It owns its
 * own draft state — seeded from the character on mount — and only touches the
 * campaign through the same setters both callers already use. Save applies the
 * three tiers and hands a message back; the caller persists and re-renders.
 */
import { Fragment, useState } from 'react';
import type { Id } from '../../src/engine/types.js';
import {
  type CampaignState,
  cantripPool, cantripLimit, knownCantrips, setCantrips,
  spellbookPool, spellbookLimit, chosenSpellbook, setSpellbook,
  preparableSpells, preparedLimit, preparedSpells, setPrepared,
  knownRitualSpells, resetPrepared,
} from '../../src/campaign/campaign.js';
import { SPELLS } from '../../src/data/spells.js';
import { SpellInfoDot } from './InfoCard.js';
import { byTier, TIER_NAME } from './spellTiers.js';
import { spellRow } from './spellRow.js';

/**
 * One pickable spell. The ⓘ button sits BESIDE the label, never inside it — a
 * button inside a label is invalid HTML and folds the dot's name into the
 * checkbox's accessible label.
 */
function Option(
  { id, checked, disabled, onToggle }:
  { id: Id; checked: boolean; disabled: boolean; onToggle: () => void },
) {
  return (
    <div className="prepare-option-row">
      <label className={`prepare-option${checked ? ' checked' : ''}`}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
        <span className="prepare-option-name">{SPELLS[id]?.icon} {SPELLS[id]?.name ?? id}</span>
      </label>
      <SpellInfoDot spellId={id} />
    </div>
  );
}

/**
 * One spell with BOTH of a wizard's decisions on it: is it in the book, and is
 * it prepared today.
 *
 * The tray used to draw those as two grids, so a wizard's spellbook and their
 * prepared list showed the same names twice — the single largest thing on the
 * screen, and the reason a level-up scrolled for pages. Two ticks on one row
 * says the same thing once, and says the dependency out loud: preparing is
 * disabled until the book tick is on, which the stacked version could only
 * express by silently omitting the row from the list below.
 *
 * The name lives in the BOOK label because that is the gating choice. `fixed`
 * is for a scribed scroll: known for good, so there is nothing to untick.
 */
function DualOption(
  { id, known, prepared, knownDisabled, prepareDisabled, fixed, onKnown, onPrepare }: {
    id: Id; known: boolean; prepared: boolean;
    knownDisabled: boolean; prepareDisabled: boolean; fixed?: boolean;
    onKnown: () => void; onPrepare: () => void;
  },
) {
  const name = SPELLS[id]?.name ?? id;
  return (
    <div className="prepare-option-row">
      <label className={`prepare-option${known ? ' checked' : ''}${fixed ? ' scribed' : ''}`}>
        {fixed
          ? <span className="prepare-fixed" aria-label={`${name}, copied from a scroll`}>📜</span>
          : <input
              type="checkbox" checked={known} disabled={knownDisabled} onChange={onKnown}
              aria-label={`${name} — in the spellbook`}
            />}
        <span className="prepare-option-name">{SPELLS[id]?.icon} {name}</span>
      </label>
      {/* A second tick, not a second row. `title` because the control is an
          emoji: the tooltip and the aria-label are the only text it has. */}
      <label
        className={`prepare-prep${prepared ? ' on' : ''}`}
        title={prepared ? `${name} is prepared` : `Prepare ${name}`}
      >
        <input
          type="checkbox" checked={prepared} disabled={prepareDisabled} onChange={onPrepare}
          aria-label={`${name} — prepared`}
        />
        <span aria-hidden="true">✨</span>
      </label>
      <SpellInfoDot spellId={id} />
    </div>
  );
}


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
  /**
   * Scrolls this wizard has copied in. They are not part of the base book —
   * they do not count against its size and cannot be un-picked — so they live
   * beside the draft rather than in it.
   */
  const scribed = ch.scribedSpells ?? [];
  /**
   * Everything this caster may prepare FROM.
   *
   * This was `spellbookDraft` for a wizard: the base book alone. A scribed
   * scroll went into `scribedSpells`, which `preparableSpells` reads and the
   * engine honours — but the tray showed it in neither list, so a spell bought
   * for 100 gold appeared nowhere and could never be prepared. Reported as
   * "I tried scribing web and the spellbook didn't update".
   */
  const leveledPool = usesBook ? [...spellbookDraft, ...scribed] : preparableSpells(c, idx);
  /**
   * Every spell a wizard may put a tick against: the class pool plus anything
   * scribed in. Scribed spells are not in `bookPool` — they were bought, not
   * chosen — so without this a copied scroll would vanish from the merged grid
   * the same way it once vanished from the prepared list.
   */
  const mergedPool = [...bookPool, ...scribed.filter((id) => !bookPool.includes(id))];
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
      <div className="tray tray-prepare" onClick={(e) => e.stopPropagation()}>
        {/* Title and tally on separate lines. Run together they wrapped into
            four ragged lines on a 390px phone, and the ✕ — the only way out of
            a sheet this long — floated off beside the middle of the name. */}
        <div className="tray-head">
          <span className="tray-title">📖 {ch.name}'s Spells</span>
          <button className="ghost" onClick={onClose}>✕</button>
          <span className="muted tray-tally">
            {cantripDraft.length}/{cCap} cantrips{usesBook ? `, ${spellbookDraft.length}/${bookCap} known` : ''}, {prepareDraft.length}/{cap} prepared
          </span>
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
            <div className="sheet-row">
              <span className="sheet-label">Cantrips ({cantripDraft.length}/{cCap}) — always ready</span>
              <div className="prepare-grid">
                {cPool.map((id) => (
                  <Option
                    key={id} id={id}
                    checked={cantripDraft.includes(id)}
                    disabled={!cantripDraft.includes(id) && cAtCap}
                    onToggle={() => toggleCantrip(id)}
                  />
                ))}
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
            /* ONE grid, two ticks. See `DualOption` — the book and the prepared
               list are the same spells, and drawing them twice was the biggest
               single thing on this screen. */
            <div className="sheet-row">
              <span className="sheet-label">
                Spellbook — ☑️ known ({spellbookDraft.length}/{bookCap})
                {' · '}✨ prepared ({prepareDraft.length}/{cap})
              </span>
              <div className="prepare-grid">
                {byTier(mergedPool).map(([lv, ids]) => (
                  <Fragment key={lv}>
                    <span className="prepare-tier">{TIER_NAME[lv] ?? `L${lv}`} level</span>
                    {ids.map((id) => (
                      <DualOption
                        key={id} id={id}
                        {...spellRow(id, {
                          book: spellbookDraft, prepared: prepareDraft, scribed,
                          bookCap: bookCap ?? 0, prepCap: cap,
                        })}
                        onKnown={() => toggleBook(id)}
                        onPrepare={() => togglePrepare(id)}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          )
        )}
        {/* A knows-all caster (cleric) has no book to merge, so preparing stays
            a list of its own. */}
        {(!usesBook || locked) && (
          <div className="sheet-row">
            <span className="sheet-label">Prepared ({prepareDraft.length}/{cap})</span>
            <div className="prepare-grid">
              {byTier(leveledPool).map(([lv, ids]) => (
                <Fragment key={lv}>
                  <span className="prepare-tier">{TIER_NAME[lv] ?? `L${lv}`} level</span>
                  {ids.map((id) => (
                    <Option
                      key={id} id={id}
                      checked={prepareDraft.includes(id)}
                      disabled={!prepareDraft.includes(id) && atCap}
                      onToggle={() => togglePrepare(id)}
                    />
                  ))}
                </Fragment>
              ))}
              {leveledPool.length === 0 && <span className="muted">Pick spellbook spells above first.</span>}
            </div>
          </div>
        )}
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
