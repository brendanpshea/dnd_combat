/**
 * The Sunken Barrows: chapter two of the trilogy (docs/trilogy-plan.md).
 * Thornwick's wrong graves, the deep fen, and the Undercrypt under the
 * barrows. The Reedwife was the Warden's jailer; her fall (or her binding
 * to strangers' words) broke the vigil, and the company closes the door.
 * Why it is built as it is: docs/chapters/sunken-barrows-notes.md.
 */
import type { Module } from '../../adventure/types.js';
import type { DelveSpec } from '../../adventure/delve-spec.js';
import { withCanon, companionsFrom, npcMetFlag, npcFateFlag, carriedRenames } from '../../adventure/npcs.js';
import { TRILOGY_NPCS as NPCS, TRILOGY_RENAMED_FATES } from './npcs.js';
import { TRILOGY_FACTS } from './canon.js';
import { HOLLOW_ROAD_RENAMED_NPC_FLAGS } from './hollow-road.js';
// The scenes are written in sunken-barrows/*.story and built by `npm run stories`.
import { SCENES as scenes, ACTS } from './sunken-barrows/scenes.gen.js';

/** What this chapter once said about people in flags of its own. */
export const SUNKEN_BARROWS_RENAMED_NPC_FLAGS: Record<string, string> = {
  'met-wren': npcMetFlag('wren'),
  'halden-saved': npcFateFlag('halden', 'saved'),
  'marrow-sings': npcFateFlag('marrow', 'sings'),
  'marrow-bound': npcFateFlag('marrow', 'bound'),
};

const flag = (f: string) => ({ kind: 'flag' as const, flag: f });

export const SUNKEN_BARROWS_MODULE: Module = withCanon({
  id: 'sunken-barrows', title: 'The Sunken Barrows',
  blurb: 'The {reedwife}\'s fall broke an old vigil. Follow {thornwick}\'s walking dead into the fen — and close what your victory opened.',
  cover: 'loc-crypt',
  levelBand: { from: 3, to: 4 },
  towns: {
    square: {
      spec: {
        size: 'village', level: 3, name: '{thornwick}', camp: true,
        // A town burying its dead twice: its everyday places know it.
        mood: {
          board: 'Every old notice is covered by a new one, in the reeve\'s hand: the names of the opened graves, oldest first. Under them, smaller: *Reburials when they are found.*',
          shop: '"Whatever you need, take it, and pay me after." The shopkeeper does not look up. "Nobody\'s bought anything since the bells but candles and nails."',
          landmark: { label: 'The Horse Fair', text: 'The horse fair is shut. One dealer leans on an empty pen and says nobody buys a horse the week their gran walks off.' },
        },
        people: [{ name: '{bram}', at: 'general', keeps: true,
          lines: ['"Grave-trouble, they say." **{bram}** spreads his hands over the stall. "Then you\'ll be wanting silver, steel, and no questions. Two of the three I stock."'] }],
        places: [
          { label: 'The {wander-inn}', replaces: 'inn', text: [], event: { scene: 'inn' } },
          // Halden's own chapel, with Halden gone.
          { label: 'The Chapel', replaces: 'temple', icon: 'tok-temple',
            text: ['The chapel door stands open, and nobody is at the altar. A frightened acolyte is keeping the candles lit. "Brother {halden} rang the bell every evening," she says. "I don\'t know the words for it. I keep the candles lit instead."'] },
          { label: 'The Reeve\'s Hall', icon: 'tok-house',
            text: ['The reeve\'s clerk meets you at the door. "The commission stands, and the reeve relies upon you."'],
            event: { scene: 'reeve-hall', until: [flag('reeve-task')] } },
          { label: 'The Churchyard', icon: 'tok-temple',
            text: ['The churchyard lies quiet, its open graves still gaping at the sky. All that could walk has gone ahead of you.'],
            event: { scene: 'grave-study', until: [flag('graves-read')] } },
          // Shut until the reeve says so; then Wren, once; then the road.
          { label: 'The Fen Road', replaces: 'gate', icon: 'tok-gate', text: [], event: { scene: 'wren-meet', when: [
            { if: [{ kind: 'notFlag', flag: 'reeve-task' }], to: 'fen-shut' },
            { if: [flag('wren-joined')], to: 'fen-again' }] } },
        ],
      },
      onLeave: { to: 'fen-again' },
      proveApart: true, title: '{thornwick}',
    },
  },
  delves: {
    // The deep fen: the chapel and the corpse-lights stand between the
    // company and the Barrow Gate.
    fen: {
      spec: {
        // Open country, held by nobody: the chapel and the lights are the story's.
        level: 3, theme: 'marsh', shape: 'hub', rooms: 9, maxFights: 0,
        dressing: { name: 'The Deep Fen',
          door: 'The old raised road goes on into the fog, one great flat stone after another. The fen closes in on both sides.',
          outside: 'The fog thins, and the cart-road back to {thornwick} runs firm under your boots.',
          back: 'Back into the fen', leave: 'Walk back to {thornwick}' },
        lock: { requires: [flag('chapel-cleared'), flag('lights-cleared')],
          note: 'Every trail to the barrows runs past the drowned chapel and the corpse-lights. Deal with both first.' },
        require: [
          { name: 'The Drowned Chapel', where: 'beforeLock', event: { scene: 'chapel', until: [flag('chapel-cleared')] } },
          { name: 'The Corpse-Lights', where: 'beforeLock', event: { scene: 'lights', until: [flag('lights-cleared')] } },
          { name: 'The Serpent Pool', where: 'side', event: { scene: 'pool', until: [flag('pool-cleared')] } },
          { name: 'The {barrow-gate}', where: 'goal', event: { scene: 'lychgate', until: [flag('lychgate-cleared')] } },
        ],
      } as DelveSpec,
      onWin: { to: 'lychgate-won' }, onLeave: { to: 'square/city' },
      proveApart: true, title: 'The Deep Fen',
    },
    // The great barrow: the painted hall, the cut where Thornwick's dead dig,
    // the kings' guard, and the king, whose shaft drops to the Warden's door.
    undercrypt: {
      spec: {
        level: 3, theme: 'graveyard', shape: 'ring', rooms: 8, fights: 'inhabitants', factions: ['restless-dead'], maxFights: 0,
        lore: [
          'A niche holds a lead tablet, half pried loose. On it, a reed-woman sits before a door, and a line of tiny figures bring her lambs.',
          'Names are scratched into the plaster here, hundreds of them, each in a different hand. The newest is still white.',
          'A second tablet, older than the first: three reed-women at the door, not one, and the two behind her watching the one who sits.',
        ],
        dressing: { name: 'The {undercrypt}',
          door: 'Worked steps lead down into the cold. Your torch makes a small, brave circle, and the dark waits politely outside it.',
          outside: 'You climb out into the grey light of the barrow-field.',
          back: 'Back down the stair', leave: 'Walk back to {thornwick}' },
        // Thornwick's dead fill the cut wall to wall: past them, the guard and the king.
        lock: { requires: [flag('diggers-passed')], note: 'The dead are digging in the way, wall to wall.' },
        require: [
          { name: 'The Painted Hall', where: 'beforeLock', event: { scene: 'hall', until: [flag('hall-seen')] } },
          { name: 'The Bone Room', where: 'side', search: 'ossuary' },
          { name: 'The Lead Cut', where: 'beforeLock', event: { scene: 'diggers', until: [flag('diggers-passed')] } },
          { name: 'The Barrow-Guard', where: 'afterLock', event: { scene: 'wights', until: [flag('wights-down')] } },
          { name: 'The King\'s Chamber', where: 'goal', event: { scene: 'king', until: [flag('king-down')] },
            exit: { to: 'shaft', label: 'Drop down the burial shaft' } },
        ],
      } as DelveSpec,
      onWin: { to: 'shaft' }, onLeave: { to: 'square/city' },
      proveApart: true, title: 'The {undercrypt}',
    },
  },
  // Part 2 of the trilogy: a victory carries the company into The Wyrmcalling.
  sequel: 'wyrmcalling',
  start: 'return', scenes, acts: ACTS, defeatScene: 'sb-defeat', town: 'square/city',
  // The clock: Marrow is prying the lead out of the Warden's door. A warning
  // on the third morning; on the fifth the door has shifted, and the rites a
  // company says without help are harder (RESEALING).
  dawns: [
    { day: 3, text: ['The ground shook once in the night, deep down. It felt like a door when someone shoves it from the other side.'] },
    { day: 5, text: ['The ground shook again before dawn, longer this time. Far below, old stone gave a little.'],
      effects: [{ kind: 'setFlag', flag: 'door-straining' }] },
  ],
  // What the last chapter reads (`sunken-barrows:<flag>`): the victory, a
  // cracked door, and the valley's regard (0–3).
  carries: ['won', 'seal-cracked', 'regard'],
  renamedFlags: {
    ...SUNKEN_BARROWS_RENAMED_NPC_FLAGS,
    ...carriedRenames('hollow-road', HOLLOW_ROAD_RENAMED_NPC_FLAGS),
    ...TRILOGY_RENAMED_FATES,
  },
  companions: companionsFrom(NPCS, [
    { id: 'wren', blurb: 'The reeve\'s scout. Guiding you through the deep fen as far as the {barrow-gate}. Past that, she does not know the ground.' },
  ]),
}, { npcs: NPCS, facts: TRILOGY_FACTS });
