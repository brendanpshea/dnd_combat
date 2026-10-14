/**
 * The Sunken Barrows' shared pieces: effects, lines and scenes more than one
 * scene uses. The scenes (*.story) name them as `@NAME`.
 */
import type { Scene, Effect } from '../../../adventure/types.js';
import { speaker } from '../../../adventure/npcs.js';
import { TRILOGY_NPCS as NPCS } from '../npcs.js';

export const MIRA = speaker(NPCS.mira!, { label: '{mira} the Innkeeper' });
export const REEVE = speaker(NPCS.aldous!, { label: 'Reeve {aldous}' });
export const WREN = speaker(NPCS.wren!, 'the Reeve\'s Scout');
export const HALDEN = speaker(NPCS.halden!, { label: 'Brother {halden}' });
export const MARROW = speaker(NPCS.marrow!, 'the Gravedigger');

/** Into the churchyard, however the company comes to it. */
export const OPENING: Effect[] = [
  { kind: 'journal', entry: { id: 'q-barrows', kind: 'quest', title: 'The Opened Graves',
    body: '{thornwick}\'s dead are leaving their graves and walking into the deep fen. Find what is calling them, and stop it.' } }];

/** The valley's regard (docs/state-ledger.md): one for each deed that keeps
 *  faith with {thornwick}, carried on as `sunken-barrows:regard`. */
export const REGARD: Effect = { kind: 'addFlag', flag: 'regard', amount: 1 };

/** The cult, glimpsed in the fen before it shows itself at the Warden's door. */
export const WORM_CLUE: Effect = { kind: 'journal', entry: { id: 'c-worm', kind: 'clue', title: 'Robes the Colour of Worms',
  body: 'A stranger in long, worm-pale robes lay drowned among the corpse-lights. Nailed boots on the old road, black candles in the chapel, and now this. Someone living is helping the dead along.' } };

/** What the chapel hands over, whether Halden lived through it or not. */
export const CHAPEL_CLEARED: Effect[] = [
  { kind: 'addItem', itemId: 'potion-healing', qty: 1 },
  { kind: 'journal', entry: { id: 'c-rites', kind: 'clue', title: 'The Rites of Sealing',
    body: 'Brother {halden}\'s prayer book holds the old rites of sealing. The {reedwife} was the jailer of the {warden} of the Barrows. The fen-folk gave her a {door-price} each {door-midwinter}, and she kept him asleep. She left her door, and his seal broke. Dead or alive, she does not keep his watch now. Speak the rites at the {warden}\'s door, deep in the great barrow, to shut him in again.' } },
];

/** The words that seal the door. Each way of saying them is one try; if every
 *  voice fails, the door cracks. Once the door has shifted (`door-straining`,
 *  the fifth dawn), every way the company has without help is two harder;
 *  the help it earned ({halden}, {marrow}) is not. */
export function RESEALING(strained: boolean): Scene {
  const id = strained ? 'resealing-shifted' : 'resealing';
  const hard = strained ? 2 : 0;
  const singers = { if: [{ kind: 'npc' as const, npc: 'marrow', fate: 'sings' }],
    text: 'At the back of the stair, {marrow}\'s kneelers chant every line back. The whole stair keeps time, low and steady.' };
  return {
    id, kind: 'challenge', art: { imageId: 'loc-dungeon', emoji: '📖' }, retry: 'perApproach', noBack: true,
    intro: [
      'The great door still bulges outward, and half the lead is gone from its letters.',
      ...(strained ? ['A line of dark, a finger wide, shows along its top, where the stone gave in the night.'] : []),
      '{halden}\'s book lies open in your hands. The rites fill three pages, and the oldest words look too old for a living mouth. Someone has to say them, now, at this door.',
    ],
    approaches: [
      { id: 'rites', label: 'Speak the rites aloud', skill: 'religion', dc: 13 + hard,
        success: { to: 'seal-closed', text: ['You read the old rites by black candle-light. You stumble over the oldest words, and say them again until they come out right. With each word, the lead in its letter warms and sets hard.', singers] },
        failure: { to: id, text: ['Your voice cracks on the oldest word, and the rest come out wrong. The letters stay dark. The door groans, and leans a little harder.'] } },
      { id: 'letters', label: 'Read the leaded letters as a spell', hint: 'They are cut deeper than any prayer needs.', skill: 'arcana', dc: 14 + hard,
        success: { to: 'seal-closed', text: ['The letters are not a prayer at all. They are a lock, and the rites are its key. You trace each letter and speak its line from the book, and one by one they glow and set hard.', singers] },
        failure: { to: id, text: ['You trace the wrong line first. A letter spits its lead at your hand and goes dark.'] } },
      { id: 'kneelers', label: 'Turn the kneeling cultists to the words', hint: 'They came here to chant at this door.',
        skill: 'persuasion', dc: 14 + hard, hideWhenBlocked: true,
        requires: [{ kind: 'notFlag', flag: 'kneelers-scorned' }, { kind: 'npc', npc: 'marrow', notFate: ['sings'] }],
        success: { to: 'seal-closed', text: ['You hold the book up where the kneelers can see it. "You came to sing to the {warden}," you tell them. "Then sing this." One voice joins yours, then five, then all of them.'] },
        failure: { to: id, text: ['The kneelers look at the book, then at the door, and go back to their own chant, louder than before.'] } },
      { id: 'marrow', label: 'Let {marrow} lead his faithful in the rites', skill: 'persuasion', dc: 9, hideWhenBlocked: true,
        requires: [{ kind: 'npc', npc: 'marrow', fate: 'sings' }],
        success: { to: 'seal-closed', text: ['{marrow} takes the book in both hands and turns to his kneelers. "We had the words wrong," he tells them. He reads, and every kneeler on the stair follows him, and one by one the lead letters fill with light.'] },
        failure: { to: id, text: ['{marrow}\'s voice breaks on the first line. He was never a priest. The kneelers wait for him, and the door groans.'] } },
      { id: 'halden', label: 'Give {halden} the book', skill: 'religion', dc: 8, hideWhenBlocked: true,
        requires: [{ kind: 'npc', npc: 'halden', fate: 'saved' }],
        success: { to: 'seal-closed', text: ['{halden} takes the book and finds his place without looking. He reads in the same calm voice that led the drowned congregation. This time the voice is his own, and the lead sets hard under every word.', singers] },
        failure: { to: id, text: ['{halden} opens his mouth, and the voice that comes out is not quite his. He shuts the book fast. "Not me," he whispers. "It still knows me."'] } },
    ],
    success: { to: 'seal-closed' },
    failure: { to: 'seal-breach', text: ['The last word dies in the dark. The great door splits down its middle with a crack like river ice, and grey hands push out through the gap. The {warden} has stopped waiting for his servants.'] },
  };
}
