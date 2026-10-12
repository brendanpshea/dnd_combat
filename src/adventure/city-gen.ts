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
import type { Effect, ExploreNode, Module, NpcRef, Requirement, Scene } from './types.js';
import type { EncounterBrief } from '../arena/encounter.js';
import { generateEncounter } from '../arena/encounter.js';
import { evenBudgetFor, memberCapFor, maxCountFor } from '../arena/run.js';
import { encounterFor, generatedEncounterId } from '../data/encounters.js';
import { FACTIONS } from '../data/factions.js';
import { shareFor } from './delve-spec.js';
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

// 'gatehouse', not 'gate': a district named like a venue made "at: 'gate'"
// mean the venue when the author meant the district.
export type DistrictKind = 'green' | 'market' | 'temple-quarter' | 'warrens' | 'gatehouse' | 'noble-hill';

/** Something worth following up: a journal lead, closed when `flag` is set. */
export interface Lead { title: string; text: string; flag?: string }

/**
 * Someone the author puts in the town.
 *   at a venue    found there: a choice to talk to them at an inn or temple,
 *                 or (with `keeps`, or at a shop, which has no one else to
 *                 talk to) the person who runs it
 *   at a district a marker of their own there
 */
export interface PlacedPerson {
  name: string;
  /**
   * What the party would call them before they have met: "The Harbourmaster".
   * Shown on their marker in place of the name — a story's cast check will
   * not let a map name someone nobody has been introduced to. Default: name.
   */
  title?: string;
  emoji?: string;
  at: VenueKind | DistrictKind;
  keeps?: boolean;
  /** What they say. */
  lines: string[];
  /** What they point the party at. */
  lead?: Lead;
  /** Story flags that must hold for them to be there ('!flag': must not). */
  when?: string[];
}

/** A place the author writes: a marker with its own scene. */
export interface CustomPlace {
  label: string;
  icon?: string;
  /** Default: the town's first district. */
  district?: DistrictKind;
  text: string[];
  /** Found only by a passive Perception of at least this. */
  hidden?: number;
  when?: string[];
  /** A fight on first walking in: an encounter id, or one generated to a brief. */
  fight?: Id | { brief?: EncounterBrief };
  /** A flag set on leaving it: what closes a lead that pointed here. */
  sets?: string;
  /** What is there to take: coin, or an item id. */
  loot?: 'gold' | Id;
  /**
   * A way on, out of the town and into the story: the sewer grate, the road
   * to the mine. Only in a town inside a story (Module.towns), where `to`
   * names one of the story's scenes — a delve's door, most often.
   */
  way?: { to: Id; label?: string };
}

/** A rumour the inn tells, before its own. */
export interface Rumour { text: string; lead?: Lead }

export interface CitySpec {
  size?: CitySize;
  /** Party level the wares and prices are set for (default 2). */
  level?: number;
  /** Venues that must be there, beyond what the size brings. */
  venues?: VenueKind[];
  people?: PlacedPerson[];
  places?: CustomPlace[];
  rumours?: Rumour[];
  /** Street trouble in the rougher districts (default: towns and cities). */
  streets?: boolean;
}

/** What each size brings, before the spec adds anything. */
const BY_SIZE: Record<CitySize, { districts: DistrictKind[]; venues: VenueKind[]; extra: [number, number] }> = {
  village: { districts: ['green'], venues: ['inn', 'general', 'smithy', 'temple', 'notice-board', 'gate'], extra: [0, 1] },
  town: {
    districts: ['market', 'temple-quarter', 'gatehouse'],
    venues: ['inn', 'general', 'armorer', 'weaponsmith', 'mage-guild', 'temple', 'thieves-guild', 'notice-board', 'gate'],
    extra: [1, 2],
  },
  city: {
    districts: ['market', 'temple-quarter', 'warrens', 'gatehouse'],
    venues: ['inn', 'inn', 'general', 'armorer', 'weaponsmith', 'mage-guild', 'temple', 'thieves-guild', 'notice-board', 'gate'],
    extra: [2, 4],
  },
};

/** Where a venue goes, in order of preference. */
const HOME: Record<VenueKind, DistrictKind[]> = {
  inn: ['gatehouse', 'green', 'warrens', 'market'],
  general: ['market', 'green'],
  smithy: ['market', 'green'],
  armorer: ['market', 'green'],
  weaponsmith: ['market', 'green'],
  'mage-guild': ['noble-hill', 'market', 'temple-quarter', 'green'],
  temple: ['temple-quarter', 'green'],
  'thieves-guild': ['warrens', 'market', 'gatehouse', 'green'],
  'notice-board': ['gatehouse', 'market', 'green'],
  landmark: ['temple-quarter', 'warrens', 'market', 'green'],
  gate: ['gatehouse', 'green'],
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
const LAST = ['Ashby', 'Brack', 'Coldwell', 'Dray', 'Greaves', 'Hale', 'Inchcape', 'Marrow', 'Penhale', 'Rook', 'Tallow', 'Underhill', 'Vane'];
// Short words: a long inn name wraps to three lines on a phone and runs into
// the marker below it ("The Wandering Anchor" did).
const INN_A = ['Gilded', 'Drowsy', 'Crooked', 'Silver', 'Blue', 'Lucky', 'Red', 'Old', 'Merry', 'Black'];
const INN_B = ['Flagon', 'Stag', 'Lantern', 'Goose', 'Kettle', 'Anchor', 'Badger', 'Crown', 'Mare', 'Hearth'];
// Short, because a marker's label wraps on a phone and a three-line label
// runs into the marker below it.
const TEMPLE = ['Dawn', 'Lantern', 'Harvest', 'Tide', 'Forge', 'Watcher'];

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
interface VenueCtx { town: string; size: CitySize; level: number; hub: Id; used: Set<string>; rumours: Rumour[] }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A lead, as the journal entry that records it. */
function leadEffect(lead: Lead): Effect {
  return { kind: 'journal', entry: { id: `lead-${slug(lead.title)}`, kind: 'lead', title: lead.title, body: lead.text,
    ...(lead.flag ? { resolvedBy: lead.flag } : {}) } };
}

/** Story flags as requirements: 'flag' must be set, '!flag' must not. */
const needs = (when: string[] | undefined): Requirement[] =>
  (when ?? []).map((w) => (w.startsWith('!') ? { kind: 'notFlag', flag: w.slice(1) } : { kind: 'flag', flag: w }));

function venue(kind: VenueKind, id: Id, dice: Dice, ctx: VenueCtx): Built {
  const W = wares();
  const back = (label = 'Back out into the street') => ({ id: 'leave', label, to: ctx.hub });
  const shop = (title: string, stock: Id[], who: NpcRef, intro: string, icon: string): Built => ({
    node: { id, label: title, icon, scene: id },
    scenes: [{ id, kind: 'shop', title, stock, npc: who, intro: [intro], next: ctx.hub }],
  });
  switch (kind) {
    case 'inn': {
      // Never two inns of one name in a town.
      let name = `The ${dice.pick(INN_A)} ${dice.pick(INN_B)}`;
      while (ctx.used.has(name)) name = `The ${dice.pick(INN_A)} ${dice.pick(INN_B)}`;
      ctx.used.add(name);
      const keeper = person(dice, '🍺');
      const room = ctx.size === 'village' ? 1 : ctx.size === 'town' ? 2 : 5;
      // The first inn tells the author's rumours first, and notes their leads.
      const told = id === 'inn' ? ctx.rumours : [];
      const rumours = [...told.map((r) => r.text), ...dice.shuffle([...RUMOURS])].slice(0, Math.max(3, told.length));
      const leads = told.flatMap((r) => (r.lead ? [leadEffect(r.lead)] : []));
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
            next: [{ id: 'ok', label: 'Thank them, and drink up', to: id, ...(leads.length ? { effects: leads } : {}) }] },
        ],
      };
    }
    case 'general':
      return shop(`${dice.pick(LAST)}'s Stores`, W.general, person(dice, '🧺'), '"Rope, oil, a good knife, a healing draught. All honest."', 'tok-market');
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
        node: { id, label: `${god} Temple`, icon: 'tok-temple', scene: id },
        scenes: [
          { id, kind: 'dialogue', npc: priest, lines: [`**${priest.first}** looks up from the altar. "Peace be on you. What do you need of the ${god}?"`],
            next: [
              { id: 'heal', label: `Ask for healing (${cost} gold)`, to: `${id}-healed`,
                requires: [{ kind: 'gold', atLeast: cost }], effects: [{ kind: 'gold', amount: -cost }, { kind: 'heal', amount: 'full' }] },
              { id: 'wares', label: 'See what the temple sells', to: `${id}-wares` },
              back('Leave the temple'),
            ] },
          { id: `${id}-healed`, kind: 'story', noBack: true, text: ['Warm hands, an old prayer, and your wounds close like they were never there.'],
            next: [{ id: 'ok', label: 'Give thanks', to: id }] },
          { id: `${id}-wares`, kind: 'shop', title: `${god} Temple`, stock: W.temple, npc: priest,
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

/** How a town is being built: on its own (a dev-card town, which must pass
 *  every proof by itself), or inside a story, whose flags and scenes it may
 *  use and whose validator proves the whole (embed.ts, validateLive). */
export interface CityOptions { story?: boolean }

export function checkCitySpec(spec: CitySpec, opts: CityOptions = {}): Required<CitySpec> {
  const err = (m: string) => { throw new Error(`Bad city spec: ${m}`); };
  const size = spec.size ?? 'town';
  if (!CITY_SIZES.includes(size)) err(`no size '${size}'`);
  const level = spec.level ?? 2;
  if (!Number.isInteger(level) || level < 1 || level > 9) err(`level ${level} is not 1–9`);
  for (const v of spec.venues ?? []) if (!VENUE_KINDS.includes(v)) err(`no venue '${v}'`);
  const districts = BY_SIZE[size].districts;
  const venues = new Set([...BY_SIZE[size].venues, ...(spec.venues ?? [])]);
  const people = spec.people ?? [];
  const places = spec.places ?? [];
  const names = new Set<string>();
  for (const p of people) {
    if (!p.name?.trim() || !p.lines?.length) err(`a person needs a name and something to say`);
    if (names.has(slug(p.name))) err(`two people called '${p.name}'`);
    names.add(slug(p.name));
    const isVenue = VENUE_KINDS.includes(p.at as VenueKind);
    if (isVenue && !venues.has(p.at as VenueKind)) err(`${p.name} is at the ${p.at}, which a ${size} does not have (add it to venues)`);
    if (!isVenue && !districts.includes(p.at as DistrictKind)) err(`${p.name} is in '${p.at}', which is not a district of a ${size} (${districts.join(', ')})`);
    // A gate, a notice board, a landmark: nobody keeps them, and there is no
    // one there to talk to — a person there would have nowhere to stand.
    if (isVenue && ['gate', 'notice-board', 'landmark'].includes(p.at)) {
      err(`${p.name} is at the ${p.at}, which has no one to talk to: put them at an inn, a temple, a shop, or a district`);
    }
    if (isVenue && !['inn', 'temple'].includes(p.at) && p.lead) {
      err(`${p.name} keeps the ${p.at}, a shop, where there is no talking: put a lead at an inn, a temple, or a district`);
    }
  }
  const labels = new Set<string>();
  for (const pl of places) {
    if (!pl.label?.trim() || !pl.text?.length) err(`a place needs a label and some text`);
    if (labels.has(slug(pl.label))) err(`two places called '${pl.label}'`);
    labels.add(slug(pl.label));
    if (pl.district && !districts.includes(pl.district)) err(`'${pl.label}' is in '${pl.district}', which is not a district of a ${size} (${districts.join(', ')})`);
    if (typeof pl.fight === 'string' && !encounterFor(pl.fight)) err(`'${pl.label}': no encounter '${pl.fight}'`);
    if (pl.loot && pl.loot !== 'gold' && !ITEMS[pl.loot] && !itemPrice(pl.loot)) err(`'${pl.label}': no item '${pl.loot}'`);
  }
  for (const pl of places) {
    if (pl.way && !opts.story) err(`'${pl.label}' leads on to '${pl.way.to}', but a town on its own has no story to lead into`);
  }
  // A lead nothing can close is a promise the town cannot keep. Inside a
  // story, the story may close it — and the whole story's proofs say so.
  const closers = new Set(places.flatMap((pl) => (pl.sets ? [pl.sets] : [])));
  if (!opts.story) for (const lead of [...people.flatMap((p) => (p.lead ? [p.lead] : [])), ...(spec.rumours ?? []).flatMap((r) => (r.lead ? [r.lead] : []))]) {
    if (lead.flag && !closers.has(lead.flag)) err(`the lead '${lead.title}' closes on '${lead.flag}', which no place sets`);
  }
  // On its own, the only flags there are are the town's own.
  if (!opts.story) for (const w of [...people.flatMap((p) => p.when ?? []), ...places.flatMap((pl) => pl.when ?? [])]) {
    const f = w.replace(/^!/, '');
    if (!closers.has(f)) err(`'${w}' reads the flag '${f}', which nothing in the town sets`);
  }
  const markers = BY_SIZE[size].venues.length + (spec.venues ?? []).filter((v) => !BY_SIZE[size].venues.includes(v)).length
    + people.filter((p) => !VENUE_KINDS.includes(p.at as VenueKind)).length + places.length;
  if (markers > MAX_PLACES) err(`${markers} places; a town holds at most ${MAX_PLACES}`);
  return {
    size, level, venues: spec.venues ?? [], people, places, rumours: spec.rumours ?? [],
    streets: spec.streets ?? size !== 'village',
  };
}

/**
 * Far enough apart to read. The map is a phone screen — tall and narrow — so
 * a point of width is about half a point of height on screen, and a marker
 * with its label needs more room across than down. Measured on the first
 * build: 12 points apart in plain distance put an armourer's label on top of
 * the guild's marker.
 */
export function apart(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.hypot((a.x - b.x) / 22, (a.y - b.y) / 14) >= 1;
}

/** Most places on one map: past it, a phone screen is a mess of markers. */
export const MAX_PLACES = 15;

function draftCity(seed: number, spec: Required<CitySpec>): Module {
  const dice = new Dice(seedRng(seed));
  const town = `${dice.pick(NAME_HEAD)}${dice.pick(NAME_TAIL)}`;
  const plan = BY_SIZE[spec.size];
  const kinds: VenueKind[] = [...plan.venues];
  // The author's own markers count against the map's room too.
  const authored = spec.people.filter((p) => !VENUE_KINDS.includes(p.at as VenueKind)).length + spec.places.length;
  for (const v of spec.venues) if (!kinds.includes(v)) kinds.push(v);
  for (let i = dice.int(...plan.extra); i > 0 && kinds.length + authored < MAX_PLACES; i--) kinds.push('landmark');
  if (kinds.length > MAX_PLACES) throw new Error(`Bad city spec: ${kinds.length} places; at most ${MAX_PLACES}`);

  // Districts, and each venue to the first of its homes the town has.
  const districts = plan.districts;
  const centres = CENTRES[districts.length]!;
  const home = (k: VenueKind) => HOME[k].find((d) => districts.includes(d)) ?? districts[0]!;
  type Kind = VenueKind | 'person' | 'place';
  const placed: { id: Id; kind: Kind; d: number; x: number; y: number }[] = [];
  const counts = new Map<VenueKind, number>();
  const put = (id: Id, kind: Kind, d: number) => {
    const [cx, cy] = centres[d]!;
    /*
     * The free spot nearest the district's centre, from a grid over the whole
     * map, with a little jitter so two towns do not look stamped from one
     * mould. Random tries near the centre gave up on a crowded map: a city
     * rerolled 2.4 times a town once the spacing was set for a phone.
     * Clear of the edges, too: a label is wider than its marker, and the
     * town's name sits across the top of the map.
     */
    let spot: [number, number] | undefined;
    let best = Infinity;
    for (let x = 14; x <= 86; x += 4) {
      for (let y = 16; y <= 82; y += 3) {
        if (!placed.every((p) => apart(p, { x, y }))) continue;
        const score = Math.hypot((x - cx) / 22, (y - cy) / 14) + dice.float() * 0.6;
        if (score < best) { best = score; spot = [x, y]; }
      }
    }
    if (!spot) throw new Reroll(`no room for ${id}`);
    placed.push({ id, kind, d, x: spot[0], y: spot[1] });
  };
  for (const kind of kinds) {
    const n = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, n);
    put(n === 1 ? kind : `${kind}-${n}`, kind, districts.indexOf(home(kind)));
  }
  // The author's own: people with a marker of their own, and places.
  for (const p of spec.people) {
    if (!VENUE_KINDS.includes(p.at as VenueKind)) put(`person-${slug(p.name)}`, 'person', districts.indexOf(p.at as DistrictKind));
  }
  for (const pl of spec.places) put(`place-${slug(pl.label)}`, 'place', pl.district ? districts.indexOf(pl.district) : 0);

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
  const ctx: VenueCtx = { town, size: spec.size, level: spec.level, hub: 'city', used: new Set<string>(), rumours: spec.rumours };
  const fightFor = (f: CustomPlace['fight']): Id => {
    if (typeof f === 'string') return f;
    const enc = generateEncounter({
      budget: Math.round(evenBudgetFor(spec.level) * shareFor('room', spec.level)), maxMemberXp: memberCapFor(spec.level),
      maxCount: maxCountFor(spec.level), partyLevel: spec.level, ...(f?.brief ? { brief: f.brief } : {}),
    }, seedRng(Math.floor(dice.float() * 2 ** 31))).value;
    return generatedEncounterId(enc.members);
  };
  for (const p of placed) {
    if (p.kind === 'person' || p.kind === 'place') continue;
    const v = venue(p.kind, p.id, dice, ctx);
    nodes.push({ ...v.node, x: p.x, y: p.y });
    for (const s of v.scenes) scenes[s.id] = s;
  }

  // People: at a venue, or at a marker of their own.
  for (const who of spec.people) {
    const id = `person-${slug(who.name)}`;
    const npc: NpcRef = { id: slug(who.name), name: who.name, emoji: who.emoji ?? '🧑' };
    const atVenue = VENUE_KINDS.includes(who.at as VenueKind);
    const venueScene = atVenue ? scenes[who.at] : undefined;
    const keeps = atVenue && (who.keeps || venueScene?.kind === 'shop');
    if (keeps) {
      // They run it: the venue's own keeper stands aside.
      if (venueScene?.kind === 'shop') Object.assign(venueScene, { npc, intro: [who.lines[0]!] });
      if (venueScene?.kind === 'dialogue') Object.assign(venueScene, { npc, lines: who.lines });
      if (who.at === 'temple' && scenes['temple-wares']?.kind === 'shop') Object.assign(scenes['temple-wares'], { npc });
      continue;
    }
    const home = atVenue ? who.at : 'city';
    scenes[id] = { id, kind: 'dialogue', npc, lines: who.lines, ...(atVenue ? { noBack: true } : {}),
      next: [
        ...(who.lead ? [{ id: 'ask', label: `Ask about ${who.lead.title.toLowerCase()}`, to: `${id}-told`, once: true, effects: [leadEffect(who.lead)] }] : []),
        { id: 'leave', label: atVenue ? 'Leave them to it' : 'Walk on', to: home },
      ] };
    if (who.lead) {
      scenes[`${id}-told`] = { id: `${id}-told`, kind: 'story', noBack: true, text: [`${who.name} tells you what they know, and you write it down.`],
        next: [{ id: 'ok', label: 'Thank them', to: id }] };
    }
    if (venueScene?.kind === 'dialogue') {
      // A choice at the venue, before its way out.
      const talk = { id: `talk-${slug(who.name)}`, label: `Talk to ${who.name}`, to: id,
        ...(who.when?.length ? { requires: needs(who.when), hideWhenBlocked: true } : {}) };
      venueScene.next.splice(venueScene.next.length - 1, 0, talk);
    } else {
      const p = placed.find((x) => x.id === id)!;
      nodes.push({ id, label: who.title ?? who.name, icon: 'tok-person', scene: id, x: p.x, y: p.y,
        ...(who.when?.length ? { requires: needs(who.when), note: `${who.name} is not here just now.` } : {}) });
    }
  }

  // The author's places.
  for (const pl of spec.places) {
    const id = `place-${slug(pl.label)}`;
    const p = placed.find((x) => x.id === id)!;
    const sets: Effect[] = pl.sets ? [{ kind: 'setFlag', flag: pl.sets }] : [];
    const loot: Effect[] = !pl.loot ? [] : pl.loot === 'gold' ? [{ kind: 'gold', amount: 20 * spec.level }] : [{ kind: 'addItem', itemId: pl.loot }];
    scenes[id] = { id, kind: 'story', noBack: true, text: pl.text,
      next: [
        ...(loot.length ? [{ id: 'take', label: 'Take what is there', to: 'city', once: true, effects: [...loot, ...sets] }] : []),
        ...(pl.way ? [{ id: 'on', label: pl.way.label ?? `Go on, past the ${pl.label.toLowerCase()}`, to: pl.way.to, ...(sets.length ? { effects: sets } : {}) }] : []),
        { id: 'leave', label: 'Walk on', to: 'city', ...(sets.length ? { effects: sets } : {}) },
      ] };
    const node: ExploreNode = { id, label: pl.label, icon: pl.icon ?? 'tok-mystery', scene: id, x: p.x, y: p.y,
      ...(pl.hidden ? { hidden: { dc: pl.hidden } } : {}),
      ...(pl.when?.length ? { requires: needs(pl.when), note: 'Not now.' } : {}) };
    if (pl.fight) {
      // A fight on the way in, once: won, the place is just the place.
      const fid = `${id}-fight`, won = `${id}-cleared`;
      scenes[fid] = { id: fid, kind: 'battle', encounterId: fightFor(pl.fight), mapId: 'village',
        onWin: { to: id, effects: [{ kind: 'setFlag', flag: won }] } };
      Object.assign(node, { scene: fid, sceneWhen: [{ if: [{ kind: 'flag', flag: won }], to: id }] });
    }
    nodes.push(node);
  }

  // Trouble in the streets: a scuffle on the way to a place or two in the
  // rougher districts. Rolled last, so a town without them is built as before.
  if (spec.streets) {
    const rough = new Set(['warrens', 'gatehouse', 'market'].map((d) => districts.indexOf(d as DistrictKind)).filter((i) => i >= 0));
    const spots = dice.shuffle(nodes.filter((n) => {
      const p = placed.find((x) => x.id === n.id);
      return p && rough.has(p.d) && !n.hidden && !n.wandering && p.kind !== 'gate' && !n.id.startsWith('place-');
    })).slice(0, spec.size === 'city' ? 2 : 1);
    for (const n of spots) {
      const bid = `street-${n.id}`;
      const enc = generateEncounter({
        budget: Math.round(evenBudgetFor(spec.level) * shareFor('room', spec.level)), maxMemberXp: memberCapFor(spec.level),
        maxCount: maxCountFor(spec.level), partyLevel: spec.level, members: FACTIONS.bandits!.members,
      }, seedRng(Math.floor(dice.float() * 2 ** 31))).value;
      scenes[bid] = { id: bid, kind: 'battle', encounterId: generatedEncounterId(enc.members), mapId: 'village',
        intro: ['Someone steps out of an alley ahead of you, and then someone else, behind.'], onWin: { to: 'city' } };
      n.wandering = { chance: 0.25, battleScene: bid };
    }
  }
  const entry = placed.find((p) => p.kind === 'gate') ?? placed[0]!;
  Object.assign(scenes, {
    start: { id: 'start', kind: 'story', text: [`${town} comes into sight: ${spec.size === 'village' ? 'a few roofs and a green' : spec.size === 'town' ? 'a market town behind a low wall' : 'walls, towers, and the smoke of a thousand chimneys'}.`],
      next: [{ id: 'in', label: `Go into ${town}`, to: 'city', effects: [{ kind: 'xpToLevel', level: spec.level }] }] },
    city: { id: 'city', kind: 'explore', map: { title: town, theme: 'village', art: { emoji: '🏘️' }, entry: [entry.id], roads, nodes } },
    left: { id: 'left', kind: 'ending', outcome: 'victory', text: [`${town} falls away behind you.`] },
  } satisfies Record<Id, Scene>);
  // Somewhere to come to after a beating — only in a town with a fight in it.
  const fights = Object.values(scenes).some((x) => x.kind === 'battle');
  if (fights) {
    scenes.beaten = { id: 'beaten', kind: 'story', noBack: true, text: ['You come to in the temple, bandaged, lighter by a purse, and told to be more careful.'],
      next: [{ id: 'up', label: 'Get up', to: 'city' }] };
  }
  return {
    id: `city-${seed}`, title: town, blurb: `A generated ${spec.size} (level ${spec.level}).`,
    start: 'start', scenes, town: 'city', ...(fights ? { defeatScene: 'beaten' } : {}), levelBand: { from: spec.level, to: spec.level },
  };
}

class Reroll extends Error {}

/** A playable, validated town. Deterministic in seed and spec. */
export function generateCity(seed: number, spec: CitySpec = {}, opts: CityOptions = {}): { module: Module; rerolls: number } {
  const full = checkCitySpec(spec, opts);
  let last: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    let module: Module;
    try { module = draftCity(seed * 41 + attempt, full); } catch (e) {
      if (!(e instanceof Reroll)) throw e;
      last = [e.message]; continue;
    }
    // Inside a story the town is not a module of its own: the story's
    // validator proves it, spliced in, with the story's scenes and flags.
    last = opts.story ? [] : validateModule(module);
    if (last.length === 0) return { module: { ...module, id: cityId(seed, spec) }, rerolls: attempt };
  }
  throw new Error(`No valid town for seed ${seed}: ${last.join('; ')}`);
}
