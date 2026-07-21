/**
 * Adventure party setup: assemble the four heroes before the story begins.
 * Reuses the campaign's party mechanics (templates, randomize, class/species
 * swaps) and the shared spell tray, so an adventure party is built the same way
 * a campaign one is — just in the adventure's own lighter chrome. A leaner cut
 * of the campaign forge; the two can be unified later.
 */
import { useState } from 'react';
import {
  PARTY_TEMPLATES, applyPartyTemplate, randomizeParty, setPartyClass, setPartySpecies,
  cantripLimit, preparedSpells, preparedLimit, type CampaignState,
} from '../../src/campaign/campaign.js';
import { CLASSES } from '../../src/data/classes.js';
import { SPECIES } from '../../src/data/species.js';
import { Portrait } from './Portrait.js';
import { SpellTray } from './SpellTray.js';
import { classBlurb, speciesBlurb } from './blurbs.js';
import { initAudio } from './sound.js';

export function PartySetup(
  { campaign: c, onBegin, onExit }: { campaign: CampaignState; onBegin: () => void; onExit: () => void },
) {
  const [, setV] = useState(0);
  const bump = () => setV((v) => v + 1);
  const [editing, setEditing] = useState<number | null>(null);
  const [spellsFor, setSpellsFor] = useState<number | null>(null);
  const change = () => bump();

  return (
    <div className="setup adv-partysetup">
      <div className="adv-setup-head">
        <button className="ghost" onClick={onExit}>✕</button>
        <h1>Assemble your party</h1>
      </div>
      <p className="hint">Take a ready-made band, roll random heroes, or tap anyone to change their class, kin, and spells.</p>

      <div className="adv-templates">
        {PARTY_TEMPLATES.map((t) => (
          <button key={t.id} className="adv-template" onClick={() => { applyPartyTemplate(c, t.id); setEditing(null); bump(); }}>
            <b>{t.name}</b><small>{t.blurb}</small>
          </button>
        ))}
        <button className="adv-template" onClick={() => { randomizeParty(c); setEditing(null); bump(); }}>
          <b>🎲 Surprise me</b><small>Random kin for all four.</small>
        </button>
      </div>

      <div className="adv-roster-list">
        {c.characters.map((ch, idx) => {
          const open = editing === idx;
          const casts = cantripLimit(c, idx) > 0;
          return (
            <div key={idx} className={`adv-roster-card ${open ? 'open' : ''}`}>
              <button className="adv-roster-summary" onClick={() => setEditing(open ? null : idx)}>
                <Portrait id={ch.portraitId ?? ch.classId} team="team1" />
                <span className="adv-roster-id">
                  <b>{ch.name}</b>
                  <small>{SPECIES[ch.speciesId]?.name ?? ch.speciesId} · {CLASSES[ch.classId]?.name}</small>
                </span>
                <span className="member-chevron">{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div className="adv-roster-editor">
                  <label className="forge-field">
                    <span>Name</span>
                    <input value={ch.name} maxLength={24}
                      onChange={(e) => { ch.name = e.target.value || CLASSES[ch.classId]!.name; bump(); }} />
                  </label>
                  <div className="forge-field card-picker">
                    <span>Class</span>
                    <div className="card-grid">
                      {Object.values(CLASSES).map((cl) => (
                        <button key={cl.id} className={ch.classId === cl.id ? 'pick-card selected' : 'pick-card'}
                          onClick={() => { setPartyClass(c, idx, cl.id); bump(); }}>
                          <b>{cl.name}</b><small>{classBlurb(cl.id)}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="forge-field card-picker">
                    <span>Kin</span>
                    <div className="card-grid">
                      {Object.values(SPECIES).map((sp) => (
                        <button key={sp.id} className={ch.speciesId === sp.id ? 'pick-card selected' : 'pick-card'}
                          onClick={() => { setPartySpecies(c, idx, sp.id); bump(); }}>
                          <b>{sp.name}</b><small>{speciesBlurb(sp.id)}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  {casts && (
                    <button className="mini prepare-btn" onClick={() => setSpellsFor(idx)}>
                      📖 Spells ({preparedSpells(c, idx).length}/{preparedLimit(c, idx)})
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="primary adv-begin" onClick={() => { initAudio(); onBegin(); }}>Begin the adventure →</button>

      {spellsFor !== null && (
        <SpellTray campaign={c} idx={spellsFor} onClose={() => setSpellsFor(null)} onSaved={change} />
      )}
    </div>
  );
}
