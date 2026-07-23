/**
 * The tap-to-inspect character sheet — the depth advanced players want
 * (ability scores, saving throws, skills, features, resistances) without any
 * of it cluttering the board. Built from a live `Combatant`, so it works for a
 * hero or an enemy; the skill list is passed in only where a campaign context
 * exists to compute it (the camp/party screen).
 */
import type { Combatant, Ability } from '../../src/engine/types.js';
import { abilityMod } from '../../src/engine/types.js';
import { acOf } from '../../src/data/armor.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { FEATURES } from '../../src/data/features.js';
import type { SkillRow } from '../../src/campaign/campaign.js';

const ABIL: Array<{ key: Ability; label: string }> = [
  { key: 'str', label: 'STR' }, { key: 'dex', label: 'DEX' }, { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' }, { key: 'wis', label: 'WIS' }, { key: 'cha', label: 'CHA' },
];

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CharacterSheet(
  { c, subtitle, skills, onClose }: {
    c: Combatant;
    /** e.g. "Fighter · Level 3" or "Enemy". */
    subtitle: string;
    /** The full skill list (camp/party context only); omitted → no skill block. */
    skills?: SkillRow[];
    onClose: () => void;
  },
) {
  // Feature names, deduped by pre-colon label (Cunning Action: Dash/… → one).
  const seen = new Set<string>();
  const features: string[] = [];
  for (const id of c.featureIds) {
    const name = (FEATURES[id]?.name ?? '').split(':')[0]!.trim();
    if (name && !seen.has(name)) { seen.add(name); features.push(name); }
  }
  // Masteries the character can actually use (its trained weapons' mastery).
  const masteries = [...new Set(c.weaponMasteries.map((wid) => WEAPONS[wid]?.mastery).filter(Boolean) as string[])];

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <strong>{c.name}</strong>
            <div className="sheet-sub">{subtitle}</div>
          </div>
          <div className="sheet-core">
            <span>❤️ {c.hp}/{c.maxHp}</span>
            <span>🛡 {acOf(c)}</span>
            <span>👣 {c.speed} ft</span>
          </div>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        <div className="sheet-abilities">
          {ABIL.map(({ key, label }) => {
            const save = c.savingThrowProfs.includes(key);
            return (
              <div key={key} className={`sheet-abil${save ? ' save' : ''}`} title={save ? 'Proficient saving throw' : undefined}>
                <span className="sheet-abil-label">{label}{save ? ' ●' : ''}</span>
                <span className="sheet-abil-mod">{sign(abilityMod(c.abilities[key]))}</span>
                <span className="sheet-abil-score">{c.abilities[key]}</span>
              </div>
            );
          })}
        </div>
        <p className="sheet-note">● = proficient saving throw</p>

        {skills && skills.length > 0 && (
          <div className="sheet-block">
            <span className="sheet-block-label">Skills</span>
            <div className="sheet-skills">
              {skills.map((s) => (
                <div key={s.skill} className={`sheet-skill${s.proficient ? ' prof' : ''}`}>
                  <span>{s.proficient ? '★ ' : ''}{s.label}</span>
                  <span className="sheet-skill-b">{sign(s.bonus)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {features.length > 0 && (
          <div className="sheet-block">
            <span className="sheet-block-label">Features</span>
            <div className="sheet-tags">{features.map((f) => <span key={f} className="sheet-tag">{f}</span>)}</div>
          </div>
        )}
        {masteries.length > 0 && (
          <div className="sheet-block">
            <span className="sheet-block-label">Weapon masteries</span>
            <div className="sheet-tags">{masteries.map((m) => <span key={m} className="sheet-tag">{cap(m)}</span>)}</div>
          </div>
        )}
        {c.resistances.length > 0 && (
          <div className="sheet-block">
            <span className="sheet-block-label">Resistances</span>
            <div className="sheet-tags">{c.resistances.map((r) => <span key={r} className="sheet-tag">{cap(r)}</span>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
