/**
 * Player-facing "what does this do?" info for any weapon, armour, consumable, or
 * spell. Stats are derived from the structured data (damage dice, AC formula,
 * range, properties); the one-line blurbs are authored here because the rules
 * live in code (a spell's effect is its `cast()`), not in prose. One shared
 * sheet powers the ⓘ card in camp, the shop, and the spell tray.
 */
import { SPELLS, type SpellTargeting } from '../../src/data/spells.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { ARMOR } from '../../src/data/armor.js';
import { ITEMS } from '../../src/data/items.js';
import { TRINKETS } from '../../src/data/trinkets.js';

export interface InfoSheet {
  name: string;
  icon: string;
  kind: string; // "1st-level spell", "Martial weapon", "Potion", …
  stats: Array<{ label: string; value: string }>;
  blurb: string;
}

const ORD = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** Short, SRD-accurate descriptions for every spell in the game. */
const SPELL_BLURB: Record<string, string> = {
  'fire-bolt': 'A mote of fire streaks at one creature — a ranged spell attack for 1d10 fire.',
  'ray-of-frost': 'A frigid beam: 1d8 cold on a hit, and the target’s speed drops by 10 ft.',
  'shocking-grasp': 'Lightning leaps from your hand (1d8), and the target can’t take reactions until its next turn.',
  'poison-spray': 'A puff of toxic gas; the target takes 1d12 poison on a failed Constitution save.',
  'sacred-flame': 'Radiant flame descends (1d8); a Dexterity save negates, ignoring cover.',
  'acid-splash': 'A bubble of acid bursts over one or two close creatures — 1d6 acid on a failed Dex save.',
  'guidance': 'Touch a willing creature; once, it adds 1d4 to an ability check. (Out of combat.)',
  'true-strike': 'A guided weapon strike — attack with the weapon in hand, adding a little radiant damage.',
  'ray-of-sickness': 'A ray of sickly energy: 2d8 poison, and on a failed save the target is poisoned.',
  'magic-missile': 'Three darts of force, 1d4+1 each, that never miss. Extra darts at higher levels.',
  'sleep': 'Creatures in the area fall unconscious until damaged or roused — the weakest first.',
  'burning-hands': 'A 15-ft cone of flame — 3d6 fire, halved on a Dexterity save.',
  'thunderwave': 'A wave of force in a 15-ft cube: 2d8 thunder and a shove back, Con save for half.',
  'color-spray': 'A dazzling spray blinds a cluster of creatures for a round.',
  'faerie-fire': 'Outlines creatures in light: they can’t benefit from being unseen, and attacks against them have advantage.',
  'mage-armor': 'Sets an unarmoured ally’s AC to 13 + Dex for the fight.',
  'shield': 'A reaction ward: +5 AC against the triggering attack (auto-cast when it would turn a hit into a miss).',
  'false-life': 'A wash of necrotic vigour grants a few temporary hit points.',
  'minor-illusion': 'A small illusion — cover or distraction on the battlefield.',
  'cure-wounds': 'Touch heals a creature for 1d8 + your spell modifier; more per higher slot.',
  'healing-word': 'A bonus-action heal at range — 1d4 + your modifier, enough to get an ally up.',
  'bless': 'Up to three allies add 1d4 to attack rolls and saves (concentration).',
  'bane': 'Up to three foes subtract 1d4 from attacks and saves on a failed save (concentration).',
  'guiding-bolt': 'A bolt of light: 4d6 radiant, and the next attacker against it has advantage.',
  'inflict-wounds': 'A touch of necrotic energy for 3d10 on a hit.',
  'shield-of-faith': 'A shimmering field gives one creature +2 AC (concentration).',
  'divine-smite': 'Hold holy power ready. Your next melee hit adds 2d8 radiant damage (more from a bigger slot).',
  'searing-smite': 'Hold fire ready. Your next melee hit adds 1d6 fire and sets the target alight — it burns for 1d6 more each turn until it shakes the flames off.',
  'thunderous-smite': 'Hold thunder ready. Your next melee hit adds 2d6 thunder and, unless the target is strong enough to stand firm, hurls it 10 feet back and knocks it flat.',
  'wrathful-smite': 'Hold wrath ready. Your next melee hit adds 1d6 psychic and fills the target with dread, leaving it frightened until it shakes the fear off.',
  'aid': 'Raises the max and current HP of up to three allies for the fight.',
  'blindness': 'A creature is blinded unless it succeeds a Constitution save (save-ends).',
  'command': 'One creature obeys a one-word command — grovel, flee, halt — for its next turn.',
  'hold-person': 'A humanoid is paralysed on a failed Wisdom save (concentration, save-ends).',
  'lesser-restoration': 'Ends one disease or the blinded, deafened, paralysed, or poisoned condition.',
  'spiritual-weapon': 'Conjure a spectral hammer that chases your enemies and strikes on its own each turn (1d8 + mod force).',
  'flaming-sphere': 'Conjure a rolling ball of fire that chases your enemies and rams on its own each turn — 2d6 fire, Dex save for half (concentration).',
  'spiritual-guardians': 'Spirits swirl around you, slowing foes and dealing 3d8 each turn (Wis save for half).',
  'mass-healing-word': 'A bonus-action heal for up to six creatures at once (1d4 + modifier).',
  'dispel-magic': 'Ends a spell effect on a creature or object.',
  'suggestion': 'Nudge a creature into a reasonable course of action (concentration).',
  'web': 'Fills an area with sticky webs — creatures are restrained on a failed Dex save (concentration).',
  'invisibility': 'A creature turns invisible until it attacks or casts (concentration).',
  'misty-step': 'A bonus-action blink up to 30 ft to an empty space you can see.',
  'scorching-ray': 'Three rays of fire, 2d6 each, aimed independently (ranged spell attacks).',
  'fireball': 'A roaring 20-ft blast — 8d6 fire, halved on a Dexterity save.',
  'lightning-bolt': 'A 100-ft line of lightning — 8d6, halved on a Dexterity save.',
  'haste': 'One creature gains extra speed, +2 AC, and an extra action (concentration).',
  'fear': 'Foes in a cone flee in terror on a failed Wisdom save (concentration).',
  'find-familiar': 'Summon a spirit companion (an owl) that can Help you in a fight. (Ritual.)',
  'animal-friendship': 'Charms a beast out of the fight on a failed Wisdom save.',
  'hunters-mark': 'Mark a foe for an extra 1d6 on your weapon hits. When it drops, the mark leaps to the next foe (bonus action, concentration).',
  'breath-weapon': 'A dragonborn’s elemental breath in a cone or line — save for half.',
};

function reachOf(t: SpellTargeting): string {
  switch (t.kind) {
    case 'creature': {
      const who = t.who === 'enemy' ? 'foe' : t.who === 'ally' ? 'ally' : 'creature';
      return t.range === 0 ? `touch, ${t.count > 1 ? `${t.count} ` : ''}${who}${t.count > 1 ? 's' : ''}`
        : `${t.range} ft · ${t.count > 1 ? `${t.count} ` : ''}${who}${t.count > 1 ? 's' : ''}`;
    }
    case 'weaponAttack': return 'your weapon’s reach';
    case 'sphere2x2': return `${t.range} ft · small burst`;
    case 'sphere5x5': return `${t.range} ft · large burst`;
    case 'cone15': return '15-ft cone';
    case 'cube15': return '15-ft cube';
    case 'line15': return '100-ft line';
    case 'emptyCell': return `${t.range} ft · teleport`;
    case 'self': return 'self / around you';
  }
}

export function spellSheet(id: string): InfoSheet | null {
  const s = SPELLS[id];
  if (!s) return null;
  const stats: InfoSheet['stats'] = [
    { label: 'Cast', value: s.castingTime === 'action' ? 'Action' : s.castingTime === 'bonus' ? 'Bonus action' : 'Reaction' },
    { label: 'Range', value: reachOf(s.targeting) },
  ];
  if (s.concentration) stats.push({ label: 'Concentration', value: 'Yes' });
  if (s.ritual) stats.push({ label: 'Ritual', value: 'Yes' });
  return {
    name: s.name, icon: s.icon,
    kind: s.level === 0 ? 'Cantrip' : `${ORD[s.level]}-level spell`,
    stats,
    blurb: SPELL_BLURB[id] ?? 'A spell from the SRD.',
  };
}

function weaponSheet(id: string): InfoSheet | null {
  const w = WEAPONS[id];
  if (!w) return null;
  const props = w.properties.length ? w.properties.map((p) => p.replace('-', ' ')).join(', ') : '—';
  const stats: InfoSheet['stats'] = [
    { label: 'Damage', value: `${w.damage}${w.damageBonus ? `+${w.damageBonus}` : ''} ${w.damageType}` },
    { label: 'Reach', value: w.range ? `${w.range.normal}/${w.range.long} ft` : (w.melee ? 'Melee (5 ft)' : '—') },
    { label: 'Properties', value: props },
  ];
  if (w.attackBonus) stats.push({ label: 'To hit', value: `+${w.attackBonus} bonus` });
  if (w.mastery) stats.push({ label: 'Mastery', value: MASTERY_BLURB[w.mastery]?.name ?? w.mastery });
  // Magic first (the thing a shopper is paying for), then the mastery trick.
  const magic = w.attackBonus
    ? `Enchanted: +${w.attackBonus} to attack rolls and +${w.damageBonus ?? 0} damage. `
    : w.magic ? 'Moon-touched: counts as magical, cutting through resistance to its damage. ' : '';
  return {
    name: w.name, icon: w.melee ? '⚔️' : '🏹',
    kind: w.attackBonus || w.magic ? 'Magic weapon' : 'Weapon',
    stats,
    blurb: `${magic}${w.mastery ? (MASTERY_BLURB[w.mastery]?.text ?? '') : magic ? '' : 'A weapon.'}`.trim(),
  };
}

const MASTERY_BLURB: Record<string, { name: string; text: string }> = {
  cleave: { name: 'Cleave', text: 'Mastery: on a hit, the swing carries into a second foe beside the first.' },
  sap: { name: 'Sap', text: 'Mastery: a hit leaves the target easier for your allies to strike next.' },
  topple: { name: 'Topple', text: 'Mastery: a hit can knock the target prone (Con save).' },
  vex: { name: 'Vex', text: 'Mastery: a hit gives you advantage on your next attack against that foe.' },
  nick: { name: 'Nick', text: 'Mastery: make the light-weapon extra attack without spending your bonus action.' },
  slow: { name: 'Slow', text: 'Mastery: a hit cuts the target’s speed by 10 ft.' },
  push: { name: 'Push', text: 'Mastery: a hit can shove the target back 10 ft.' },
  graze: { name: 'Graze', text: 'Mastery: even a miss scrapes the target for your ability modifier.' },
};

function armorSheet(id: string): InfoSheet | null {
  if (id === 'shield' || id === 'shield-plus1') {
    const bonus = id === 'shield-plus1' ? 3 : 2;
    return {
      name: id === 'shield-plus1' ? 'Shield +1' : 'Shield', icon: '🛡️',
      kind: 'Shield',
      stats: [{ label: 'AC', value: `+${bonus}` }],
      blurb: 'Held in the off-hand to raise your Armour Class.',
    };
  }
  const a = ARMOR[id];
  if (!a) return null;
  const dex = a.dexCap === 'full' ? ' + Dex' : a.dexCap === 'none' ? '' : ` + Dex (max ${a.dexCap})`;
  const plus1 = id.endsWith('-plus1');
  return {
    name: a.name, icon: '🥋',
    kind: `${plus1 || a.noCrit ? 'Magic ' : ''}${a.category} armour`,
    stats: [{ label: 'AC', value: `${a.base}${dex}` }],
    blurb: a.noCrit ? 'Adamantine: you can’t be critically hit while you wear it.'
      : plus1 ? 'Enchanted: +1 AC over the ordinary version (already counted above).'
      : 'Worn armour.',
  };
}

function trinketSheet(id: string): InfoSheet | null {
  const t = TRINKETS[id];
  if (!t) return null;
  return {
    name: t.name, icon: t.icon,
    kind: 'Wondrous item (trinket slot)',
    stats: [],
    blurb: t.blurb,
  };
}

const ITEM_BLURB: Record<string, string> = {
  'potion-healing': 'Drink to regain 2d4+2 hit points.',
  'potion-greater-healing': 'Drink to regain 4d4+4 hit points.',
  'alchemists-fire': 'A thrown flask that sets a creature alight — ongoing fire damage until put out.',
  'potion-fire-resistance': 'Resistance to fire damage for the fight.',
  'potion-poison-resistance': 'Resistance to poison damage for the fight.',
  'potion-cold-resistance': 'Resistance to cold damage for the fight.',
  'potion-acid-resistance': 'Resistance to acid damage for the fight.',
  'potion-giant-strength-hill': 'Your Strength becomes 21 for the fight — carry and hit like a giant.',
  'potion-giant-strength-frost': 'Your Strength becomes 23 for the fight.',
};

function consumableSheet(id: string): InfoSheet | null {
  const it = ITEMS[id];
  if (!it) return null;
  // A spell scroll shows the spell it casts, framed as a scroll.
  if (it.targeting.kind === 'spell') {
    const sp = spellSheet(it.targeting.spellId);
    if (sp) return { ...sp, name: it.name, icon: '📜', kind: `Spell scroll · ${sp.kind}` };
  }
  return {
    name: it.name, icon: itemGlyph(id),
    kind: it.targeting.kind === 'thrown' ? 'Thrown item' : 'Consumable',
    stats: [],
    blurb: ITEM_BLURB[id] ?? 'A useful item.',
  };
}

function itemGlyph(id: string): string {
  if (id.startsWith('potion')) return '🧪';
  if (id.startsWith('scroll')) return '📜';
  if (id.includes('fire')) return '🔥';
  return '🎒';
}

/** The info sheet for any game id (weapon / armour / trinket / consumable), or null. */
export function infoFor(id: string): InfoSheet | null {
  return weaponSheet(id) ?? armorSheet(id) ?? trinketSheet(id) ?? consumableSheet(id);
}
