/**
 * Where a rescue's room sends a party coming back to it (story-format.ts,
 * `kind: rescue`): travelling with them, sent home, lost, dead by the
 * story's deadline, or walked past. Its `when`, for the room's `event`.
 */
import type { Id } from '../engine/types.js';
import type { Requirement } from './types.js';

export const rescueWhen = (scene: Id, who: Id, flags: { walked: string; bled: string }): Array<{ if: Requirement[]; to: Id }> => [
  { if: [{ kind: 'npc', npc: who, fate: 'saved' }, { kind: 'companion', companion: who }], to: `${scene}-along` },
  { if: [{ kind: 'npc', npc: who, fate: 'saved' }], to: `${scene}-sent` },
  { if: [{ kind: 'npc', npc: who, fate: 'lost' }], to: `${scene}-gone` },
  { if: [{ kind: 'flag', flag: flags.bled }], to: `${scene}-dead` },
  { if: [{ kind: 'flag', flag: flags.walked }], to: `${scene}-passed` },
];
