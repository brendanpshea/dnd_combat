/**
 * Set pieces: hand-made fragments a generated floor is built around.
 *
 * The idea is Dungeon Crawl's vaults and Brogue's machines: the generator lays
 * out the floor, and a piece drops in a cluster of rooms that somebody WROTE —
 * their links, their scenes, their small piece of logic — joined to the floor
 * by one corridor (its port). The validator then proves the result, exactly
 * as it proves a generated room.
 *
 * Pieces are TypeScript functions, not data. A piece builds its rooms and
 * scenes through a context that names everything for it (`ctx.room('cell')`
 * becomes `p0-cell`, `ctx.flag('freed')` becomes `f1-p0-freed`), so two copies
 * of one piece, or one piece on every floor, cannot collide — and there is no
 * id-rewriting pass to get wrong. A spec names a piece by id, so it stays
 * JSON and a saved run rebuilds it.
 *
 * Adding a piece: write a `Piece`, add it to `PIECES`, and the library test
 * places it on every shape and floor and holds it to every proof.
 */
import type { Id } from '../engine/types.js';
import type { EncounterBrief } from '../arena/encounter.js';
import type { DungeonDoor, DungeonLink, DungeonRoom, Effect, Outcome, Scene } from './types.js';
import type { Dice } from './dungeon-gen.js';
import type { SpecTheme } from './delve-spec.js';

/** Where on the floor a piece may be joined. */
export type PieceWhere = 'any' | 'beforeLock' | 'afterLock' | 'main' | 'side';

/** What a piece is asked to hold, in roles; the floor decides the monsters. */
export type FightRole = 'room' | 'elite' | 'boss';

export interface PieceCtx {
  floor: number;
  level: number;
  theme: SpecTheme;
  dice: Dice;
  /** A room id of the piece's own, made unique on the floor. */
  room(local: string): Id;
  /** A scene id, unique in the module. */
  scene(local: string): Id;
  /** A flag, unique in the module. */
  flag(local: string): string;
  /** An encounter for this floor and role (authored or generated, as the
   *  floor's fights are). */
  fight(role: FightRole, brief?: EncounterBrief): Id;
  /** A parameter from the spec's `bind`, or the fallback. */
  param(name: string, fallback: string): string;
  /** Set when this piece is the floor's key: the flag its lock wants. */
  keyFlag?: string;
}

export interface PieceBuild {
  rooms: DungeonRoom[];
  links: DungeonLink[];
  scenes: Scene[];
  /** The room the floor's corridor arrives at, and that corridor's door. */
  port: { room: Id; door?: DungeonDoor };
}

export interface Piece {
  id: Id;
  name: string;
  blurb: string;
  /** Where it may go when the spec does not say. */
  where: PieceWhere;
  /** What it hands the floor: a key replaces the generic key room; a rest
   *  replaces the generic safe room. */
  gives?: ('key' | 'rest')[];
  /** Parameters a spec may bind, for the UI and the preflight. */
  params?: Record<string, string>;
  build(ctx: PieceCtx): PieceBuild;
}

const battle = (id: Id, encounterId: Id, onWin: Outcome, intro?: string[]): Scene =>
  ({ id, kind: 'battle', encounterId, mapId: '@room', onWin, ...(intro ? { intro } : {}) });

const PRISONERS = ['Wren the tinker', 'Old Hobb', 'Sister Maud', 'Tamsin the scout', 'Brother Ash', 'Kit Fennick'];

/** A guarded cell, and someone in it worth getting out. */
const prisoner: Piece = {
  id: 'prisoner',
  name: 'The Prisoner',
  blurb: 'A cell block, its guards, and someone in the cell. Free them, or do not.',
  where: 'any',
  params: { name: 'who is in the cell' },
  build(ctx) {
    const who = ctx.param('name', ctx.dice.pick(PRISONERS));
    const cells = ctx.room('cells');
    const freed = ctx.flag('freed');
    const talk = ctx.scene('talk');
    const fight = ctx.scene('guards');
    return {
      port: { room: cells },
      links: [],
      rooms: [{ id: cells, name: 'Cell Block', size: 'medium', fight, event: { scene: talk } }],
      scenes: [
        battle(fight, ctx.fight('room'), { to: '@hub' }, ['Whoever keeps the cells is still keeping them.']),
        { id: talk, kind: 'story', noBack: true, text: [`Behind the last set of bars, ${who} looks up at the torchlight as if it might be a trick.`],
          next: [
            { id: 'free', label: `Break the lock and get ${who} out`, to: '@hub', effects: [
              { kind: 'setFlag', flag: freed },
              { kind: 'xp', amount: 50 * ctx.level },
              { kind: 'gold', amount: 15 * ctx.level },
              { kind: 'journal', entry: { id: freed, kind: 'npc', title: who, body: `Freed from the cells of a delve, and gone up into the daylight with a promise to repay it.` } },
            ] satisfies Effect[] },
            { id: 'leave', label: 'Leave them', to: '@hub' },
          ] },
      ],
    };
  },
};

/** A shrine behind its guardians: a safe place to sleep, once it is cleared. */
const shrine: Piece = {
  id: 'shrine',
  name: 'Guarded Shrine',
  blurb: 'Steps held by something, and above them a shrine where a party can sleep and be healed.',
  where: 'beforeLock',
  gives: ['rest'],
  build(ctx) {
    const steps = ctx.room('steps');
    const sanctum = ctx.room('sanctum');
    const fight = ctx.scene('guardians');
    const bless = ctx.scene('blessing');
    return {
      port: { room: steps },
      links: [{ a: steps, b: sanctum }],
      rooms: [
        { id: steps, name: 'Shrine Steps', size: 'small', fight },
        { id: sanctum, name: 'Sanctum', size: 'small', rest: 'safe',
          firstVisit: ['Old candles, an older altar, and a quiet that nothing down here has broken. You could sleep here.'],
          search: bless },
      ],
      scenes: [
        battle(fight, ctx.fight('room'), { to: '@hub' }, ['Something has made its lair on the shrine steps.']),
        { id: bless, kind: 'story', text: ['Under the altar cloth, an offering nobody came back for, and the warmth of the place settles on your wounds.'],
          next: [{ id: 'take', label: 'Take it, with thanks', to: '@hub', effects: [{ kind: 'heal', amount: 'full' }, { kind: 'addItem', itemId: 'potion-healing' }] }] },
      ],
    };
  },
};

/** The floor's key, carried by the one who keeps it. */
const warden: Piece = {
  id: 'warden',
  name: 'Warden\'s Quarters',
  blurb: 'The floor\'s key is not lying about: the warden has it, and the warden is not alone.',
  where: 'beforeLock',
  gives: ['key'],
  params: { title: 'what the warden is called' },
  build(ctx) {
    const title = ctx.param('title', 'the warden');
    const quarters = ctx.room('quarters');
    const fight = ctx.scene('warden');
    const win: Outcome = { to: '@hub', text: [`On ${title}'s belt, a ring of keys, one of them heavier than the rest.`],
      effects: [...(ctx.keyFlag ? [{ kind: 'setFlag', flag: ctx.keyFlag } as const] : []), { kind: 'gold', amount: 25 + 10 * ctx.level }] };
    return {
      port: { room: quarters },
      links: [],
      rooms: [{ id: quarters, name: 'Warden\'s Quarters', size: 'large', fight,
        firstVisit: ['A cot, a table, a map of the halls scratched into the wall. Whoever lives here runs the place.'] }],
      scenes: [battle(fight, ctx.fight('elite'), win, [`${title[0]!.toUpperCase()}${title.slice(1)} is waiting for you.`])],
    };
  },
};

/** A flooded way, a wheel that drains it, and what the water was hiding. */
const valve: Piece = {
  id: 'valve',
  name: 'The Sluice',
  blurb: 'A passage drowned to the chest, a valve room off it, and a vault you can only reach once the water is gone.',
  where: 'any',
  build(ctx) {
    const passage = ctx.room('passage');
    const works = ctx.room('works');
    const vault = ctx.room('vault');
    const drained = ctx.flag('drained');
    const wheel = ctx.scene('wheel');
    const loot = ctx.scene('loot');
    const guarded = ctx.dice.chance(0.5);
    const fight = ctx.scene('keeper');
    return {
      port: { room: passage },
      links: [
        { a: passage, b: works },
        { a: passage, b: vault, door: { locked: [{ kind: 'flag', flag: drained }], note: 'The way on is under black water, and the water is moving.' } },
      ],
      rooms: [
        { id: passage, name: 'Flooded Passage', size: 'medium', firstVisit: ['Water to the chest, cold enough to ache. Something is down there with it: a door, by the shape of the ripples.'] },
        { id: works, name: 'Sluice Works', size: 'small', ...(guarded ? { fight } : {}),
          // Until the wheel is turned, it is there every time you come back.
          event: { scene: wheel, until: [{ kind: 'flag', flag: drained }] } },
        { id: vault, name: 'Drained Vault', size: 'small', search: loot,
          firstVisit: ['Silt to the ankle, and everything the water was keeping.'] },
      ],
      scenes: [
        ...(guarded ? [battle(fight, ctx.fight('room'), { to: '@hub' })] : []),
        { id: wheel, kind: 'story', text: ['An iron wheel the size of a cartwheel, crusted with rust, set into the wall over a channel.'],
          next: [
            { id: 'turn', label: 'Put your backs into it', to: '@hub', effects: [{ kind: 'setFlag', flag: drained }] },
            { id: 'leave', label: 'Leave it', to: '@hub' },
          ] },
        { id: loot, kind: 'story', text: ['A strongbox, rusted shut and then not, and a flask that kept its seal.'],
          next: [{ id: 'take', label: 'Take it', to: '@hub', effects: [{ kind: 'gold', amount: 50 + 20 * ctx.level }, { kind: 'addItem', itemId: 'potion-greater-healing' }] }] },
      ],
    };
  },
};

export const PIECES: Record<Id, Piece> = Object.fromEntries([prisoner, shrine, warden, valve].map((p) => [p.id, p]));
