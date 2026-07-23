/**
 * The level-up modal, shared by the campaign shop and the adventure overlay.
 * It shows one card per hero listing what they *gained* (all derived by
 * diffing the class table — see `levelUpSummary`), and surfaces the choices a
 * level can unlock: a build choice (a Fighting Style at 2nd level) as a picker,
 * and, for casters, a "choose new spells" button that opens the spell tray.
 * Every choice is optional — Continue always works and the defaults stand.
 */
import { useState } from 'react';
import {
  type CampaignState, type LevelGain,
  levelUpSummary, setLevelChoice,
} from '../../src/campaign/campaign.js';
import { SpellTray } from './SpellTray.js';

export function LevelUpModal(
  { campaign, fromLevel, toLevel, onChange, onClose }: {
    campaign: CampaignState;
    fromLevel: number;
    toLevel: number;
    /** Persist + re-render after a choice/spell edit (the caller owns the save). */
    onChange?: () => void;
    onClose: () => void;
  },
) {
  const [, tick] = useState(0);
  const [spellsFor, setSpellsFor] = useState<number | null>(null);
  const gains = levelUpSummary(campaign, fromLevel, toLevel);
  const bump = () => { onChange?.(); tick((n) => n + 1); };

  return (
    <div className="overlay levelup-scrim">
      <div className="overlay-box levelup-box">
        <div className="levelup-head">
          <span className="levelup-star">⭐</span>
          <h2>Level Up!</h2>
          <p className="levelup-to">The party reaches <strong>Level {toLevel}</strong>.</p>
        </div>

        <div className="levelup-cards">
          {gains.map((g) => (
            <LevelCard key={g.charIdx} g={g} campaign={campaign}
              onChoose={(pt, opt) => { setLevelChoice(campaign, g.charIdx, pt, opt); bump(); }}
              onSpells={() => setSpellsFor(g.charIdx)} />
          ))}
        </div>

        <button className="primary levelup-go" onClick={onClose}>Continue</button>
      </div>

      {spellsFor !== null && (
        <SpellTray
          key={spellsFor}
          campaign={campaign}
          idx={spellsFor}
          mode="create"          // a level-up may widen the spellbook, not just re-prepare
          onClose={() => setSpellsFor(null)}
          onSaved={() => { setSpellsFor(null); bump(); }}
        />
      )}
    </div>
  );
}

function LevelCard(
  { g, onChoose, onSpells }: {
    g: LevelGain; campaign: CampaignState;
    onChoose: (pointId: string, optionId: string) => void;
    onSpells: () => void;
  },
) {
  const chips: string[] = [];
  if (g.hp) chips.push(`+${g.hp} HP`);
  if (g.extraAttack) chips.push('⚔️ Extra Attack');
  // Extra Attack has its own chip above — don't also list it as a feature.
  for (const f of g.features) if (!(g.extraAttack && f === 'Extra Attack')) chips.push(`✦ ${f}`);
  if (g.newSpellLevel) chips.push(`🔮 ${ordinal(g.newSpellLevel)}-level spells`);
  else if (g.moreSlots) chips.push('🔮 More spell slots');
  if (g.spellbook > 0) chips.push(`📖 +${g.spellbook} spellbook`);
  if (g.prepared > 0) chips.push(`📖 +${g.prepared} prepared`);
  if (g.cantrips > 0) chips.push(`✨ +${g.cantrips} cantrip${g.cantrips > 1 ? 's' : ''}`);
  if (g.proficiency) chips.push(`🎯 Proficiency +${g.proficiency}`);

  return (
    <div className="levelup-card">
      <div className="levelup-card-head">
        <strong>{g.name}</strong>
        <span className="muted"> · {cap(g.classId)}</span>
      </div>
      <div className="levelup-chips">
        {chips.length ? chips.map((ch, i) => <span key={i} className="levelup-chip">{ch}</span>)
          : <span className="muted">Steadier and tougher.</span>}
      </div>

      {g.choices.map((c) => (
        <div key={c.pointId} className="levelup-choice">
          <span className="levelup-choice-label">Choose your {c.label}:</span>
          <div className="levelup-choice-opts">
            {c.options.map((o) => (
              <button
                key={o.id}
                className={`levelup-opt${c.current === o.id ? ' on' : ''}`}
                title={o.blurb}
                onClick={() => onChoose(c.pointId, o.id)}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      {g.isCaster && (g.spellbook > 0 || g.prepared > 0 || g.cantrips > 0) && (
        <button className="levelup-spells" onClick={onSpells}>📖 Choose new spells</button>
      )}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ordinal = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
