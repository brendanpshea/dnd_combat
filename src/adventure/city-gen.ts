/**
 * Generated towns: one level, a map of places to go, and people to see.
 *
 * A dungeon generator is about structure under threat — locks, keys, fights,
 * the walk home. A town is about SERVICES, PEOPLE and LEADS: what is for sale,
 * who keeps the inn, what the temple charges to close your wounds. So this is
 * built on the free-roam map the written towns already use (the Hollow Road's
 * square): a district layout, venues placed in them, and each venue a template
 * that writes its own scenes — a shop with a stock profile, an inn with a room
 * and a rumour table, a temple that heals for coin.
 *
 * Same pipeline as the delves: spec, then layout, then contents, then the
 * module, with the validator's proofs as the acceptance test.
 *
 * What a town will not sell: permanent magic. That is a standing rule of the
 * economy (campaign.ts, `isPermanentMagic`): enchanted arms, armour, wands and
 * trinkets are earned, never bought. A mage's guild sells scrolls and potions.
 */
import type { Id } from '../engine/types.js';
import { seedRng } from '../engine/rng.js';
import { SHOP_STOCK, isMagicalWare, itemPrice } from '../campaign/campaign.js';
import { classScrollPool } from '../data/classes.js';
import { WEAPONS } from '../data/weapons.js';
import { ARMOR } from '../data/armor.js';
import { ITEMS } from '../data/items.js';
import type { ExploreNode, Module, NpcRef, Scene } from './types.js';
import { validateModule } from './validate.js';
import { Dice } from './dungeon-gen.js';
import { encodeSpec, decodeSpec } from './delve-spec.js';

export type CitySize = 'village' | 'town' | 'city';
export const CITY_SIZES: CitySize[] = ['village', 'town', 'city'];

export type VenueKind =
  | 'inn' | 'general' | 'smithy' | 'armorer' | 'weaponsmith' | 'mage-guild' | 'temple'
  | 'thieves-guild' | 'notice-board' | 'landmark' | 'gate';
export const VENUE_KINDS: VenueKind[] = [
  'inn', 'general', 'smithy', 'armorer', 'weaponsmith', 'mage-guild', 'temple', 'thieves-guild', 'notice-board', 'landmark', 'gate',
];

export type DistrictKind = 'green' | 'market' | 'temple-quarter' | 'warrens' | 'gate' | 'noble-hill';

export interface CitySpec {
  size?: CitySize;
  /** Party level the wares and prices are set for (default 2). */
  level?: number;
  /** Venues that must be there, beyond what the size brings. */
  venues?: VenueKind[];
}

/** What each size brings, before the spec adds anything. */
const BY_SIZE: Record<CitySize, { districts: DistrictKind[]; venues: VenueKind[]; extra: [number, number] }> = {
  village: { districts: ['green'], venues: ['inn', 'general', 'smithy', 'temple', 'notice-board', 'gate'], extra: [0, 1] },
  town: {
    districts: ['market', 'temple-quarter', 'gate'],
    venues: ['inn', 'general', 'armorer', 'weaponsmith', 'mage-guild', 'temple', 'thieves-guild', 'notice-board', 'gate'],
    extra: [1, 2],
  },
  city: {
    districts: ['market', 'temple-quarter', 'warrens', 'gate'],
    venues: ['inn', 'inn', 'general', 'armorer', 'weaponsmith', 'mage-guild', 'temple', 'thieves-guild', 'notice-board', 'gate'],
    extra: [2, 4],
  },
};

/** Where a venue goes, in order of preference. */
const HOME: Record<VenueKind, DistrictKind[]> = {
  inn: ['gate', 'green', 'warrens', 'market'],
  general: ['market', 'green'],
  smithy: ['market', 'green'],
  armorer: ['market', 'green'],
  weaponsmith: ['market', 'green'],
  'mage-guild': ['noble-hill', 'market', 'temple-quarter', 'green'],
  temple: ['temple-quarter', 'green'],
  'thieves-guild': ['warrens', 'market', 'gate', 'green'],
  'notice-board': ['gate', 'market', 'green'],
  landmark: ['temple-quarter', 'warrens', 'market', 'green'],
  gate: ['gate', 'green'],
};

/** District centres on the map (percent), by how many districts there are. */
const CENTRES: [number, number][][] = [
  [],
  [[50, 50]],
  [[30, 45], [70, 55]],
  [[28, 30], [72, 30], [50, 74]],
  [[28, 26], [72, 26], [28, 74], [72, 74]],
];

const NAME_HEAD = ['Ash', 'Stone', 'Mill', 'Ember', 'Hollow', 'King\'s', 'Salt', 'Bright', 'Raven', 'Oak', 'Fen', 'Thorn', 'Wolf', 'Copper'];
const NAME_TAIL = ['ford', 'bridge', 'haven', 'mere', 'wick', 'gate', 'stead', 'holm', 'fall', 'cross', 'barrow', 'well'];
const FIRST = ['Agna', 'Bertil', 'Corra', 'Dunstan', 'Edda', 'Fenn', 'Gisla', 'Hollis', 'Isolde', 'Jory', 'Kesta', 'Lom', 'Marta', 'Nils', 'Orrin', 'Pell', 'Quill', 'Rhosyn', 'Sabeth', 'Tobin', 'Ulla', 'Wendel'];
const LAST = ['Ashby', 'Brack', 'Coldwell', 'Dray', 'Fairweather', 'Greaves', 'Hale', 'Inchcape', 'Marrow', 'Penhale', 'Rook', 'Tallow', 'Underhill', 'Vane'];
const INN_A = ['Gilded', 'Drowsy', 'Laughing', 'Crooked', 'Silver', 'Wandering', 'Three-Legged', 'Blue', 'Lucky', 'Sleeping'];
const INN_B = ['Flagon', 'Stag', 'Lantern', 'Goose', 'Kettle', 'Anchor', 'Badger', 'Crown', 'Mare', 'Hearth'];
const TEMPLE = ['the Dawn', 'the Lantern', 'the Harvest', 'the Still Water', 'the Forge Father', 'the Watchful Eye'];

const RUMOURS = [
  'The miller swears the river ran red for an hour last spring, and nobody upstream will say why.',
  'They say the old watchtower on the ridge has a light in it, some nights, and nobody lives there.',
  'A pedlar came through with silver he would not say where he dug up. He did not come back through.',
  'The temple has been buying up candles by the cartload. The priest will not say what for.',
  'There is a door in the cellars under the counting-house that the guild keeps chained. Two guards, day and night.',
  'Wolves took three sheep off the common last month, and left the fourth with its throat cut clean, like a knife.',
  'Somebody has been paying children a copper apiece to count the watch on the walls.',
  'The last company that went down the old mine came back one short, and would not drink to him.',
];
const LANDMARKS: [string, string, string][] = [
  ['Old Well', 'tok-well', 'The well is older than the town around it. Someone has carved a name on the lip of it, and someone else has tried hard to scratch it out.'],
  ['Market Cross', 'tok-crossing', 'A stone cross, worn faceless, where the roads meet. Folk touch it for luck as they pass and do not seem to know they are doing it.'],
  ['Hanging Tree', 'tok-tree', 'An oak with one bough worn smooth by rope. Nobody stands under it for long.'],
  ['Founder\'s Statue', 'tok-figure', 'A founder nobody now can name, holding up a sword that has been stolen and replaced with a broom handle.'],
];

/** Wares, by what kind of shop would sell them. Drawn from the one shop list
 *  the game sells from, so nothing here can be unobtainable or new. */
function wares() {
  const sold = SHOP_STOCK.filter((id) => itemPrice(id) !== undefined);
  const mundane = (id: Id) => !isMagicalWare(id);
  // A scroll is sold by whoever's faith or craft it belongs to: the temple
  // the divine ones, the guild everything else — so a town with both sells
  // every scroll the game sells at all.
  const divine = new Set([...classScrollPool('cleric'), ...classScrollPool('paladin')]);
  const arcane = new Set(['wizard', 'sorcerer', 'warlock', 'bard', 'druid', 'ranger'].flatMap((c) => [...classScrollPool(c)]));
  const spellOf = (id: Id) => { const t = ITEMS[id]?.targeting; return t && 'spellId' in t ? t.spellId : undefined; };
  const isScroll = (id: Id) => id.startsWith('scroll-') && spellOf(id) !== undefined;
  const cleric = { has: (id: Id) => divine.has(spellOf(id)!) };
  const wizard = { has: (id: Id) => arcane.has(spellOf(id)!) || !divine.has(spellOf(id)!) };
  return {
    weapons: sold.filter((id) => WEAPONS[id] && mundane(id)),
    armor: sold.filter((id) => ARMOR[id] && mundane(id)),
    general: sold.filter((id) => ITEMS[id] && !isScroll(id) && (mundane(id) || id === 'potion-healing')),
    temple: sold.filter((id) => (isScroll(id) && cleric.has(id)) || id === 'potion-healing' || id === 'potion-greater-healing'),
    arcane: sold.filter((id) => (isScroll(id) && wizard.has(id)) || (id.startsWith('potion-') && !id.includes('healing'))),
    // What the guild moves: things for doing what you should not.
    black: sold.filter((id) => ['alchemists-fire', 'dagger', 'rapier', 'potion-poison-resistance',
      'scroll-invisibility', 'scroll-pass-without-trace', 'scroll-silence', 'scroll-misty-step', 'scroll-sleep', 'scroll-suggestion'].includes(id)),
  };
}

interface Built { node: Omit<ExploreNode, 'x' | 'y'>; scenes: Scene[] }

function person(dice: Dice, emoji: string): NpcRef & { first: string } {
  const first = dice.pick(FIRST);
  return { id: `${first.toLowerCase()}-${dice.int(100, 999)}`, name: `${first} ${dice.pick(LAST)}`, emoji, first };
}

/** One venue: its marker, and the scenes behind it. */
function venue(kind: VenueKind, id: Id, dice: Dice, ctx: { town: string; size: CitySize; level: number; hub: Id; used: Set<string> }): Built {
  const W = wares();
  const back = (label = 'Back out into the street') => ({ id: 'leave', label, to: ctx.hub });
  const shop = (title: string, stock: Id[], who: NpcRef, intro: string, icon: string): Built => ({
    node: { id, label: title, icon, scene: id },
    scenes: [{ id, kind: 'shop', title, stock, npc: who, intro: [intro], next: ctx.hub }],
  });
  switch (kind) {
    case 'inn': {
      const name = `The ${dice.pick(INN_A)} ${dice.pick(INN_B)}`;
      const keeper = person(dice, '🍺');
      const room = ctx.size === 'village' ? 1 : ctx.size === 'town' ? 2 : 5;
      const rumours = dice.shuffle([...RUMOURS]).slice(0, 3);
      return {
        node: { id, label: name, icon: 'tok-tavern', scene: id },
        scenes: [
          { id, kind: 'dialogue', npc: keeper, lines: [`**${keeper.first}** wipes the bar down and looks you over. "Room, food, or talk?"`],
            next: [
              { id: 'room', label: `Take a room for the night (${room} gold, long rest)`, to: `${id}-rest`,
                requires: [{ kind: 'gold', atLeast: room }], effects: [{ kind: 'gold', amount: -room }] },
              { id: 'talk', label: 'Ask what folk are saying', to: `${id}-talk` },
              back(),
            ] },
          { id: `${id}-rest`, kind: 'rest', variant: 'long', next: id,
            intro: [`A narrow bed above the taproom at ${name}, and a door that bolts. You sleep until the noise downstairs is breakfast.`] },
          { id: `${id}-talk`, kind: 'story', noBack: true, text: rumours.map((r) => `"${r}"`),
            next: [{ id: 'ok', label: 'Thank them, and drink up', to: id }] },
        ],
      };
    }
    case 'general':
      return shop(`${dice.pick(LAST)}'s Provisions`, W.general, person(dice, '🧺'), '"Rope, oil, a good knife, a healing draught. All honest."', 'tok-market');
    case 'smithy':
      return shop('The Smithy', [...W.weapons, ...W.armor], person(dice, '⚒️'), 'The forge roars. "Steel or leather? I make both, and I make them to last."', 'tok-fire');
    case 'armorer':
      return shop(`${dice.pick(LAST)}'s Armoury`, W.armor, person(dice, '🛡️'), '"Stand still. Arms out. No — you\'re a size bigger than you think."', 'tok-house');
    case 'weaponsmith':
      return shop('The Whetstone', W.weapons, person(dice, '⚔️'), '"Balanced, sharp, and nobody\'s ever brought one back."', 'tok-fire');
    case 'mage-guild':
      return shop('The Collegium', W.arcane, person(dice, '🔮'),
        'Shelves of scroll-cases and a smell of hot ink. "We sell what may be written down and drunk. What must be earned, we do not sell."', 'tok-mystery');
    case 'temple': {
      const god = dice.pick(TEMPLE);
      const priest = person(dice, '🕯️');
      const cost = 10 * ctx.level;
      return {
        node: { id, label: `Temple of ${god}`, icon: 'tok-temple', scene: id },
        scenes: [
          { id, kind: 'dialogue', npc: priest, lines: [`**${priest.first}** looks up from the altar. "Peace be on you. What do you need of ${god}?"`],
            next: [
              { id: 'heal', label: `Ask for healing (${cost} gold)`, to: `${id}-healed`,
                requires: [{ kind: 'gold', atLeast: cost }], effects: [{ kind: 'gold', amount: -cost }, { kind: 'heal', amount: 'full' }] },
              { id: 'wares', label: 'See what the temple sells', to: `${id}-wares` },
              back('Leave the temple'),
            ] },
          { id: `${id}-healed`, kind: 'story', noBack: true, text: ['Warm hands, an old prayer, and your wounds close like they were never there.'],
            next: [{ id: 'ok', label: 'Give thanks', to: id }] },
          { id: `${id}-wares`, kind: 'shop', title: `Temple of ${god}`, stock: W.temple, npc: priest,
            intro: ['"Scrolls of the faith, and the draughts the sisters brew."'], next: id },
        ],
      };
    }
    case 'thieves-guild': {
      // Hidden until someone with a sharp eye spots the sign scratched on the door.
      const b = shop('The Back Room', W.black, person(dice, '🗝️'),
        '"You found the door. That\'s the test." A smile with no warmth in it. "Coin buys what you need, and nobody asks."', 'tok-mystery');
      return { node: { ...b.node, hidden: { dc: ctx.size === 'village' ? 12 : ctx.size === 'town' ? 13 : 14 } }, scenes: b.scenes };
    }
    case 'notice-board':
      return {
        node: { id, label: 'Notice Board', icon: 'tok-notice', scene: id },
        scenes: [{ id, kind: 'story', text: [`Notices, most of them old: a lost goat, a reward for a stolen cart, a warning about the roads out of ${ctx.town}.`],
          next: [back('Step away')] }],
      };
    case 'landmark': {
      // Never the same landmark twice in one town.
      const left = LANDMARKS.filter(([l]) => !ctx.used.has(l));
      const [label, icon, text] = dice.pick(left.length ? left : LANDMARKS);
      ctx.used.add(label);
      return { node: { id, label, icon, scene: id }, scenes: [{ id, kind: 'story', text: [text], next: [back('Walk on')] }] };
    }
    case 'gate':
      return {
        node: { id, label: `Leave ${ctx.town}`, icon: 'tok-gate', scene: id },
        scenes: [{ id, kind: 'story', text: [`The road out of ${ctx.town} runs on through the fields.`],
          next: [{ id: 'go', label: 'Take the road', to: 'left' }, back('Not yet')] }],
      };
  }
}

/** Every built town's id: `city-<seed>-<spec>`, so a saved run rebuilds it. */
export function cityId(seed: number, spec: CitySpec): string {
  return `city-${seed}-${encodeSpec(spec)}`;
}

export function cityFromId(id: string): Module | undefined {
  const m = /^city-(\d+)-([A-Za-z0-9_-]+)$/.exec(id);
  if (!m) return undefined;
  try { return generateCity(Number(m[1]), decodeSpec(m[2]!) as CitySpec).module; } catch { return undefined; }
}

export function checkCitySpec(spec: CitySpec): Required<CitySpec> {
  const err = (m: string) => { throw new Error(`Bad city spec: ${m}`); };
  const size = spec.size ?? 'town';
  if (!CITY_SIZES.includes(size)) err(`no size '${size}'`);
  const level = spec.level ?? 2;
  if (!Number.isInteger(level) || level < 1 || level > 9) err(`level ${level} is not 1–9`);
  for (const v of spec.venues ?? []) if (!VENUE_KINDS.includes(v)) err(`no venue '${v}'`);
  return { size, level, venues: spec.venues ?? [] };
}

/**
 * Far enough apart to read. The map is a phone screen — tall and narrow — so
 * a point of width is about half a point of height on screen, and a marker
 * with its label needs more room across than down. Measured on the first
 * build: 12 points apart in plain distance put an armourer's label on top of
 * the guild's marker.
 */
export function apart(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.hypot((a.x - b.x) / 22, (a.y - b.y) / 12) >= 1;
}

/** Most places on one map: past it, a phone screen is a mess of markers. */
export const MAX_PLACES = 15;

function draftCity(seed: number, spec: Required<CitySpec>): Module {
  const dice = new Dice(seedRng(seed));
  const town = `${dice.pick(NAME_HEAD)}${dice.pick(NAME_TAIL)}`;
  const plan = BY_SIZE[spec.size];
  const kinds: VenueKind[] = [...plan.venues];
  for (const v of spec.venues) if (!kinds.includes(v)) kinds.push(v);
  for (let i = dice.int(...plan.extra); i > 0 && kinds.length < MAX_PLACES; i--) kinds.push('landmark');
  if (kinds.length > MAX_PLACES) throw new Error(`Bad city spec: ${kinds.length} places; at most ${MAX_PLACES}`);

  // Districts, and each venue to the first of its homes the town has.
  const districts = plan.districts;
  const centres = CENTRES[districts.length]!;
  const home = (k: VenueKind) => HOME[k].find((d) => districts.includes(d)) ?? districts[0]!;
  const placed: { id: Id; kind: VenueKind; d: number; x: number; y: number }[] = [];
  const counts = new Map<VenueKind, number>();
  for (const kind of kinds) {
    const d = districts.indexOf(home(kind));
    const [cx, cy] = centres[d]!;
    const n = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, n);
    const id = n === 1 ? kind : `${kind}-${n}`;
    // A spot near the district's centre, clear of every marker already down.
    let spot: [number, number] | undefined;
    for (let tries = 0; tries < 60 && !spot; tries++) {
      const a = dice.float() * Math.PI * 2, r = 8 + dice.float() * 22;
      const x = Math.round(Math.min(90, Math.max(10, cx + Math.cos(a) * r)));
      // Off the bottom edge: the map's hint bar sits over the last tenth.
      const y = Math.round(Math.min(82, Math.max(10, cy + Math.sin(a) * r)));
      if (placed.every((p) => apart(p, { x, y }))) spot = [x, y];
    }
    if (!spot) throw new Reroll(`no room for ${id}`);
    placed.push({ id, kind, d, x: spot[0], y: spot[1] });
  }

  // Roads: within a district, each place to its nearest neighbour already
  // joined; then each district to the next, nearest pair to nearest pair.
  const roads: [Id, Id][] = [];
  const near = (from: typeof placed, to: typeof placed) => {
    let best: [typeof placed[number], typeof placed[number]] | undefined; let dist = Infinity;
    for (const a of from) for (const b of to) { const h = Math.hypot(a.x - b.x, a.y - b.y); if (h < dist) { dist = h; best = [a, b]; } }
    return best!;
  };
  const byDistrict = districts.map((_, i) => placed.filter((p) => p.d === i));
  for (const group of byDistrict) {
    for (let i = 1; i < group.length; i++) { const [a, b] = near([group[i]!], group.slice(0, i)); roads.push([a.id, b.id]); }
  }
  for (let i = 1; i < byDistrict.length; i++) {
    if (!byDistrict[i]!.length) continue;
    const [a, b] = near(byDistrict[i]!, byDistrict.slice(0, i).flat());
    roads.push([a.id, b.id]);
  }

  const scenes: Record<Id, Scene> = {};
  const nodes: ExploreNode[] = [];
  const ctx = { town, size: spec.size, level: spec.level, hub: 'city', used: new Set<string>() };
  for (const p of placed) {
    const v = venue(p.kind, p.id, dice, ctx);
    nodes.push({ ...v.node, x: p.x, y: p.y });
    for (const s of v.scenes) scenes[s.id] = s;
  }
  const entry = placed.find((p) => p.kind === 'gate') ?? placed[0]!;
  Object.assign(scenes, {
    start: { id: 'start', kind: 'story', text: [`${town} comes into sight: ${spec.size === 'village' ? 'a few roofs and a green' : spec.size === 'town' ? 'a market town behind a low wall' : 'walls, towers, and the smoke of a thousand chimneys'}.`],
      next: [{ id: 'in', label: `Go into ${town}`, to: 'city', effects: [{ kind: 'xpToLevel', level: spec.level }] }] },
    city: { id: 'city', kind: 'explore', map: { title: town, theme: 'village', art: { emoji: '🏘️' }, entry: [entry.id], roads, nodes } },
    left: { id: 'left', kind: 'ending', outcome: 'victory', text: [`${town} falls away behind you.`] },
  } satisfies Record<Id, Scene>);
  return {
    id: `city-${seed}`, title: town, blurb: `A generated ${spec.size} (level ${spec.level}).`,
    start: 'start', scenes, town: 'city', levelBand: { from: spec.level, to: spec.level },
  };
}

class Reroll extends Error {}

/** A playable, validated town. Deterministic in seed and spec. */
export function generateCity(seed: number, spec: CitySpec = {}): { module: Module; rerolls: number } {
  const full = checkCitySpec(spec);
  let last: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    let module: Module;
    try { module = draftCity(seed * 41 + attempt, full); } catch (e) {
      if (!(e instanceof Reroll)) throw e;
      last = [e.message]; continue;
    }
    last = validateModule(module);
    if (last.length === 0) return { module: { ...module, id: cityId(seed, spec) }, rerolls: attempt };
  }
  throw new Error(`No valid town for seed ${seed}: ${last.join('; ')}`);
}
