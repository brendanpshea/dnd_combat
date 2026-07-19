/**
 * One-line trait descriptions for the forge card pickers — player-facing copy,
 * so it lives on the web side rather than in engine data. Keyed by class/species
 * id; a missing id falls back to an empty string (the card still shows the name).
 */
export const CLASS_BLURB: Record<string, string> = {
  fighter: 'Tough front-liner. Second Wind, Action Surge, a Fighting Style.',
  cleric: 'Healer and buffer. Cure Wounds, Bless, Turn Undead.',
  wizard: 'Glass-cannon caster. Magic Missile, Sleep, area spells.',
  rogue: 'Skirmisher. Sneak Attack, Cunning Action, hides as a bonus action.',
  ranger: "Marksman. Hunter's Mark, Colossus Slayer, a bow and a blade.",
  paladin: 'Holy tank. Lay on Hands, Divine Smite, heavy armor and a shield.',
};

export const SPECIES_BLURB: Record<string, string> = {
  human: 'Versatile. Heroic Inspiration and an extra skill.',
  dwarf: 'Sturdy. Poison resistance and extra HP.',
  elf: 'Fast and watchful. True Strike, keen senses, Faerie Fire at 3rd.',
  orc: 'Relentless. Adrenaline rush and a second wind from death.',
  dragonborn: 'Fire resistance and a breath-weapon cone.',
  tiefling: 'Poison resistance, Poison Spray, Ray of Sickness at 3rd.',
  gnome: 'Clever. Mind-save advantage, illusions, charms beasts.',
  halfling: 'Lucky (reroll 1s) and naturally stealthy.',
};

export function classBlurb(id: string): string {
  return CLASS_BLURB[id] ?? '';
}
export function speciesBlurb(id: string): string {
  return SPECIES_BLURB[id] ?? '';
}
