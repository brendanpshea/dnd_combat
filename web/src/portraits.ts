/**
 * Portrait catalogue — the pictures a character can wear, independent of its
 * class. `portraitId` on a character indexes this list, not CLASSES: a Wizard
 * may wear the Warrior portrait, and adding new art is one entry here plus the
 * matching `portrait-<id>.webp` (registered in art.ts's HAS_ART).
 *
 * The seed set reuses the four class-archetype portraits that already ship; the
 * names describe what the art depicts, not the character's role.
 */
export interface PortraitOption {
  id: string;
  name: string;
}

export const PORTRAITS: PortraitOption[] = [
  { id: 'fighter', name: 'Warrior' },
  { id: 'wizard', name: 'Mage' },
  { id: 'cleric', name: 'Priest' },
  { id: 'rogue', name: 'Rogue' },
];

export function portraitName(id: string): string {
  return PORTRAITS.find((p) => p.id === id)?.name ?? id;
}
