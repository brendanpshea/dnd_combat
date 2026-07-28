/**
 * Adventure party setup: assemble the four heroes before the story begins.
 * Reuses the campaign's party mechanics (templates, randomize, class/species
 * swaps) and the shared spell tray, so an adventure party is built the same way
 * a campaign one is — just in the adventure's own lighter chrome. A leaner cut
 * of the campaign forge; the two can be unified later.
 */
import { useState } from 'react';
import {
  PARTY_TEMPLATES, applyPartyTemplate, randomizeParty, type CampaignState,
} from '../../src/campaign/campaign.js';
import { CLASSES } from '../../src/data/classes.js';
import { SPECIES } from '../../src/data/species.js';
import { Portrait } from './Portrait.js';
import { SpellTray } from './SpellTray.js';
import { ForgeMemberEditor } from './ForgeMember.js';
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
      <p className="hint">This party works as it is — begin whenever you like. Roll a new one, or tap anyone to change their class, kin, portrait, build choices, and spells.</p>

      {/* One roller, not two. The old pair were "random kin" and "random
          everything, no promises" — and the promise-free one could deal four
          wizards, which the arena will happily build an unwinnable fight for.

          And it stands alone above the roster, because the party below is
          already a good party: the two things a player needs on this screen are
          "go" and "give me a different one". Six named bands ahead of their own
          roster made choosing feel mandatory before they had seen what they
          had. They are still here, one tap away, for anyone who wants one. */}
      <div className="adv-templates one-roll">
        <button className="adv-template" onClick={() => { randomizeParty(c); setEditing(null); bump(); }}>
          <b>🎲 Surprise me</b><small>Random kin and classes — always a party that works.</small>
        </button>
      </div>

      <details className="adv-template-more">
        <summary>Or take a ready-made band</summary>
        <div className="adv-templates">
          {PARTY_TEMPLATES.map((t) => (
            <button key={t.id} className="adv-template" onClick={() => { applyPartyTemplate(c, t.id); setEditing(null); bump(); }}>
              <b>{t.name}</b><small>{t.blurb}</small>
            </button>
          ))}
        </div>
      </details>

      <div className="adv-roster-list">
        {c.characters.map((ch, idx) => {
          const open = editing === idx;
          const styleId = ch.choices?.['fighting-style'];
          const styleName = styleId
            ? CLASSES[ch.classId]?.choices?.find((p) => p.id === 'fighting-style')?.options.find((o) => o.id === styleId)?.name
            : undefined;
          const summary = [SPECIES[ch.speciesId]?.name ?? ch.speciesId, CLASSES[ch.classId]?.name, styleName]
            .filter(Boolean).join(' · ');
          return (
            <div key={idx} className={`adv-roster-card ${open ? 'open' : ''}`}>
              <button className="adv-roster-summary" onClick={() => setEditing(open ? null : idx)}>
                <Portrait id={ch.portraitId ?? ch.classId} team="team1" />
                <span className="adv-roster-id">
                  <b>{ch.name}</b>
                  <small>{summary}</small>
                </span>
                <span className="member-chevron">{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div className="adv-roster-editor">
                  <ForgeMemberEditor
                    campaign={c} idx={idx}
                    mutate={(fn) => { fn(); bump(); }}
                    onEditSpells={() => setSpellsFor(idx)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="primary adv-begin" onClick={() => { initAudio(); onBegin(); }}>Begin the adventure →</button>

      {spellsFor !== null && (
        <SpellTray key={spellsFor} campaign={c} idx={spellsFor} mode="create" onClose={() => setSpellsFor(null)} onSaved={change} />
      )}
    </div>
  );
}
