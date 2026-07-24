/**
 * The shared "forge" editor for one party member — name, class, species,
 * portrait, level-appropriate build choices (Fighting Style, …), and the spell
 * tray hook. Both the campaign forge (Campaign.tsx) and the adventure party
 * setup (PartySetup.tsx) render this, so a party is built identically in either
 * mode and the two never drift.
 *
 * The host owns persistence and layout: it passes a `mutate` that runs a change
 * and then saves/re-renders however that screen does, and an `onEditSpells` that
 * opens its own SpellTray. This component only renders the expanded editor body
 * (each screen keeps its own summary row / accordion around it).
 */
import {
  type CampaignState,
  setPartyClass, setPartySpecies, setPartyChoice, setPartyBackground, partyLevelOf, cantripLimit,
} from '../../src/campaign/campaign.js';
import { CLASSES } from '../../src/data/classes.js';
import { SPECIES } from '../../src/data/species.js';
import { BACKGROUNDS, defaultBackgroundFor } from '../../src/data/backgrounds.js';
import { SKILL_LABEL } from '../../src/data/classes.js';
import { Portrait } from './Portrait.js';
import { PORTRAITS } from './portraits.js';
import { classBlurb, speciesBlurb } from './blurbs.js';

export function ForgeMemberEditor(
  { campaign: c, idx, mutate, onEditSpells }: {
    campaign: CampaignState;
    idx: number;
    /** Run a mutation and then persist / re-render however the host does. */
    mutate: (fn: () => void) => void;
    /** Open the host's spell tray for this caster. */
    onEditSpells: () => void;
  },
) {
  const ch = c.characters[idx];
  if (!ch) return null;
  const classData = CLASSES[ch.classId]!;
  // Build choice-points the character has reached: class first, then species.
  const choicePoints = [
    ...(CLASSES[ch.classId]?.choices ?? []),
    ...(SPECIES[ch.speciesId]?.choices ?? []),
  ].filter((cp) => cp.atLevel <= partyLevelOf(c));

  return (
    <div className="member-editor">
      <label className="forge-field">
        <span>Name</span>
        <input
          value={ch.name}
          maxLength={24}
          onChange={(e) => mutate(() => { ch.name = e.target.value || classData.name; })}
        />
      </label>

      <div className="forge-field card-picker">
        <span>Class</span>
        <div className="card-grid" role="radiogroup" aria-label={`${ch.name} class`}>
          {Object.values(CLASSES).map((cl) => (
            <button
              key={cl.id}
              className={ch.classId === cl.id ? 'pick-card selected' : 'pick-card'}
              role="radio" aria-checked={ch.classId === cl.id}
              onClick={() => mutate(() => setPartyClass(c, idx, cl.id))}
            >
              <b>{cl.name}</b><small>{classBlurb(cl.id)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="forge-field card-picker">
        <span>Species</span>
        <div className="card-grid" role="radiogroup" aria-label={`${ch.name} species`}>
          {Object.values(SPECIES).map((sp) => (
            <button
              key={sp.id}
              className={ch.speciesId === sp.id ? 'pick-card selected' : 'pick-card'}
              role="radio" aria-checked={ch.speciesId === sp.id}
              onClick={() => mutate(() => setPartySpecies(c, idx, sp.id))}
            >
              <b>{sp.name}</b><small>{speciesBlurb(sp.id)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="forge-field portrait-picker">
        <span>Portrait</span>
        <div role="radiogroup" aria-label={`${ch.name} portrait`}>
          {PORTRAITS.map((portrait) => (
            <button
              key={portrait.id}
              className={ch.portraitId === portrait.id ? 'selected' : ''}
              role="radio" aria-checked={ch.portraitId === portrait.id}
              title={`Use ${portrait.name} portrait`}
              onClick={() => mutate(() => { ch.portraitId = portrait.id; })}
            >
              <Portrait id={portrait.id} team="team1" label={`${portrait.name} portrait`} />
            </button>
          ))}
        </div>
      </div>

      {/* Background: where this character was before the adventure, and the
          main source of skill proficiency in the 2024 rules. It sits above the
          class choice points because it changes what the party can *do* outside
          a fight, which is most of adventure mode. */}
      <div className="forge-field card-picker">
        <span>Background</span>
        <div className="card-grid" role="radiogroup" aria-label={`${ch.name} background`}>
          {Object.values(BACKGROUNDS).map((bg) => {
            const selected = (ch.backgroundId ?? defaultBackgroundFor(ch.classId)) === bg.id;
            return (
              <button
                key={bg.id}
                className={selected ? 'pick-card selected' : 'pick-card'}
                role="radio" aria-checked={selected}
                onClick={() => mutate(() => setPartyBackground(c, idx, bg.id))}
              >
                <b>{bg.name}</b>
                <small>{bg.blurb}</small>
                <small className="pick-grants">
                  {bg.skills.map((sk) => SKILL_LABEL[sk]).join(' · ')}
                </small>
              </button>
            );
          })}
        </div>
      </div>

      {choicePoints.map((cp) => {
        const selected = ch.choices?.[cp.id] ?? cp.default;
        return (
          <div className="forge-field choice-point" key={cp.id}>
            <span>{cp.label}</span>
            <div className="card-grid" role="radiogroup" aria-label={`${ch.name} ${cp.label}`}>
              {cp.options.map((opt) => (
                <button
                  key={opt.id}
                  className={selected === opt.id ? 'pick-card selected' : 'pick-card'}
                  role="radio" aria-checked={selected === opt.id}
                  onClick={() => mutate(() => setPartyChoice(c, idx, cp.id, opt.id))}
                >
                  <b>{opt.name}</b><small>{opt.blurb}</small>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {cantripLimit(c, idx) > 0 && (
        <div className="forge-field">
          <span>Spells</span>
          <button className="mini prepare-btn" onClick={onEditSpells}>
            📖 Choose cantrips &amp; spells
          </button>
        </div>
      )}
    </div>
  );
}
