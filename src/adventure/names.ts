/**
 * Markov name generators: people, places, bosses — and the odd minion.
 *
 * Character-level chains of order 3, backing off to 2 and 1 where a context
 * was never seen, trained on one STYLE's corpus at a time (data/names). A
 * style is a culture's sound; a place picks one, so a town's names all sound
 * like one town.
 *
 * The chain only makes the proper noun. Everything around it — "the
 * Unbowed", "Temple of the Lantern", "The Crooked Stag" — is a template,
 * because templates are what make those read right.
 *
 * Quality is the filters' job, not the chain's:
 *   - never a name from the corpus it learned from, nor one within a letter
 *     of a famous name (FAMOUS): a chain that learned Middle-earth will one
 *     day spell "Gandalf", and this is what stops it;
 *   - a shape that can be said: a vowel, no four consonants running, no
 *     letter three times over;
 *   - nothing on a short blocklist of words nobody wants on a shopkeeper.
 *
 * Who gets a name: people the player may talk to. Minions get one only when
 * a scene calls for it (the guard you trick, the sentry you slip past).
 *
 * Deterministic: every draw takes a random function, so a generator seeded
 * from a delve's or a town's dice names the same people every rebuild.
 */
import { CORPORA, FAMOUS, NAME_STYLES, type NameStyle } from '../data/names/corpora.js';

export type { NameStyle };
export { NAME_STYLES };
export type Gender = 'male' | 'female';
type Rng = () => number;

const START = '^';
const END = '$';
const ORDER = 3;

/** One trained chain: for each context of 1..ORDER letters, what follows. */
class Chain {
  private readonly next = new Map<string, Map<string, number>>();
  /** Every name of its style, not just its own list: a male chain that
   *  spells "Olwen" has still handed back a teacher's name. */
  readonly source: Set<string>;

  constructor(words: readonly string[], kin: readonly string[] = []) {
    // Single words only. A multi-word place split into its words taught the
    // chain "Middle", "Street" and "Little" — English, not names.
    const own = words.map(norm).filter((w) => !/\s/.test(w));
    this.source = new Set([...own, ...kin.map(norm).filter((w) => !/\s/.test(w))]);
    for (const w of own) {
      for (const part of [w]) {
        const s = START.repeat(ORDER) + part + END;
        for (let i = ORDER; i < s.length; i++) {
          for (let k = 1; k <= ORDER; k++) {
            const ctx = s.slice(i - k, i);
            const m = this.next.get(ctx) ?? new Map<string, number>();
            m.set(s[i]!, (m.get(s[i]!) ?? 0) + 1);
            this.next.set(ctx, m);
          }
        }
      }
    }
  }

  /** One raw draw, or undefined if it ran on too long. */
  draw(rng: Rng, max: number): string | undefined {
    let out = '';
    let ctx = START.repeat(ORDER);
    for (let guard = 0; guard < max + 2; guard++) {
      // The longest context that has been seen; shorter ones as a fallback.
      let m: Map<string, number> | undefined;
      for (let k = ORDER; k >= 1 && !m; k--) m = this.next.get(ctx.slice(-k));
      if (!m) return undefined;
      const total = [...m.values()].reduce((a, n) => a + n, 0);
      let r = rng() * total;
      let c = END;
      for (const [ch, n] of m) { r -= n; if (r < 0) { c = ch; break; } }
      if (c === END) return out;
      out += c;
      ctx += c;
    }
    return undefined;
  }
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z' -]/g, '');
}

function cap(s: string): string {
  return s.replace(/(^|[\s'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
    // ...but not after an apostrophe mid-word ("d'aubigny" stays "D'aubigny").
    .replace(/'([A-Z])/g, (_, b: string) => `'${b.toLowerCase()}`);
}

/** Levenshtein distance, capped: only "is it within 1" is ever asked. */
function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const FAMOUS_NORM = FAMOUS.map(norm);

/** Words nobody wants on a shopkeeper. Substrings, so short and specific. */
const BLOCK = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'rape', 'nazi', 'whore', 'slut', 'piss', 'cock', 'dick', 'twat', 'wank', 'kike', 'spic', 'chink'];

/** Whether a drawn name is fit to use. */
export function acceptable(name: string, source: ReadonlySet<string>): boolean {
  const n = norm(name);
  if (!/[aeiouy]/.test(n)) return false;
  if (/(.)\1\1/.test(n)) return false;
  if (/[^aeiouy' -]{4}/.test(n)) return false;
  if (/^[^aeiouy]{3}/.test(n) && !/^(sch|str|scr|spr|spl|thr|chr|shr|phr)/.test(n)) return false;
  // Not one of its teachers; for a long name, not a near-copy of one either
  // ("Karphedin" from Skarphedin) — a short one is within a letter of half
  // the corpus, and refusing those left nothing but the corpus itself; and
  // never a fragment of one ("Brook" out of Brandybrook).
  for (const w of source) {
    if (n === w || (n.length >= 6 && near(n, w)) || (w.length > n.length && w.includes(n))) return false;
  }
  if (FAMOUS_NORM.some((f) => near(n, f) || (n.length >= 6 && n.includes(f) && f.length >= 5))) return false;
  if (BLOCK.some((b) => n.includes(b))) return false;
  return true;
}

const chains = new Map<string, Chain>();
function chain(style: NameStyle, list: 'male' | 'female' | 'surname' | 'place'): Chain {
  const key = `${style}/${list}`;
  let c = chains.get(key);
  if (!c) { const k = CORPORA[style];
    c = new Chain(k[list], [...k.male, ...k.female, ...k.surname, ...k.place]); chains.set(key, c); }
  return c;
}

/** A fresh word from a chain, within the length bounds, passing the filters,
 *  and not one of `avoid` (which it then joins): one town, no two Breesas. */
function word(c: Chain, rng: Rng, min: number, max: number, avoid?: Set<string>): string {
  for (let tries = 0; tries < 120; tries++) {
    const w = c.draw(rng, max);
    if (!w || w.length < min || w.length > max || !acceptable(w, c.source)) continue;
    const name = cap(w);
    if (avoid?.has(name)) continue;
    avoid?.add(name);
    return name;
  }
  // Still nothing: let any fresh draw through that is merely sayable and not
  // famous, before ever handing back a name the chain learned from.
  for (let tries = 0; tries < 200; tries++) {
    const w = c.draw(rng, max);
    if (w && w.length >= min && w.length <= max && !c.source.has(w) && /[aeiouy]/.test(w)
      && !FAMOUS_NORM.some((f) => near(w, f)) && !BLOCK.some((b) => w.includes(b)) && !avoid?.has(cap(w))) {
      avoid?.add(cap(w));
      return cap(w);
    }
  }
  return '';
}

/** A word, or — every fresh one used up in this place — one that repeats,
 *  before ever "Nameless". */
function wordOrRepeat(c: Chain, rng: Rng, min: number, max: number, avoid?: Set<string>): string {
  return word(c, rng, min, max, avoid) || word(c, rng, min, max) || 'Nameless';
}

export function firstName(style: NameStyle, gender: Gender, rng: Rng, max = 9, avoid?: Set<string>): string {
  return wordOrRepeat(chain(style, gender), rng, 4, max, avoid);
}

/** A surname — or, the style's run of them used up, "of" a place of its own. */
export function surname(style: NameStyle, rng: Rng, max = 11, avoid?: Set<string>): string {
  return word(chain(style, 'surname'), rng, 4, max, avoid) || `of ${placeName(style, rng, max - 3, avoid)}`;
}

/** A person: first name and surname, in one style. */
export function personName(style: NameStyle, gender: Gender, rng: Rng, avoid?: Set<string>): { first: string; last: string; full: string } {
  const first = firstName(style, gender, rng, 9, avoid);
  // Where a style's surnames are mostly "of" somewhere ("of Stygia", "of
  // Gont"), the chain cannot learn them — they are not one word — so its
  // people are "of" a place of its own instead, as often as the corpus is.
  const of = CORPORA[style].surname.filter((x) => x.startsWith('of ')).length / CORPORA[style].surname.length;
  if (of > 0 && rng() < of) {
    const last = `of ${placeName(style, rng, 11, avoid)}`;
    return { first, last, full: `${first} ${last}` };
  }
  // A patronymic says who it is for: no "Ori Thorsdottir".
  let last = surname(style, rng, 11, avoid);
  for (let i = 0; i < 20 && (gender === 'male' ? /dottir$/i : /sson$/i).test(last); i++) last = surname(style, rng, 11, avoid);
  if ((gender === 'male' ? /dottir$/i : /sson$/i).test(last)) last = gender === 'male' ? last.replace(/dottir$/i, 'sson') : last.replace(/sson$/i, 'dottir');
  return { first, last, full: `${first} ${last}` };
}

/** A place: a town, a river, a hall. One word, short enough for a map label. */
export function placeName(style: NameStyle, rng: Rng, max = 11, avoid?: Set<string>): string {
  return wordOrRepeat(chain(style, 'place'), rng, 4, max, avoid);
}

const EPITHETS = [
  'the Unbowed', 'the Hollow', 'the Pale', 'the Red', 'the Patient', 'the Twice-Drowned', 'the Smiling', 'the Unburied',
  'Ironhand', 'Bonebreaker', 'the Gaunt', 'the Faithful', 'the Last', 'the Hungry', 'the Grey', 'Oathbreaker',
  'the Lame', 'Kingsbane', 'the Quiet', 'Blackheart', 'the Elder', 'the Tusked', 'Gravecaller', 'the Thrice-Born',
];

/** A boss: a name with an epithet, "Gerrith the Unbowed". */
export function bossName(style: NameStyle, gender: Gender, rng: Rng, avoid?: Set<string>): string {
  return `${firstName(style, gender, rng, 9, avoid)} ${EPITHETS[Math.floor(rng() * EPITHETS.length)]!}`;
}

/** A beast that leads: a name like a growl, and an epithet. "Gnash the Tusked". */
export function beastName(rng: Rng, avoid?: Set<string>): string {
  return `${minionName(rng, avoid)} ${EPITHETS[Math.floor(rng() * EPITHETS.length)]!}`;
}

const MINION = [
  'Grak', 'Snik', 'Bruz', 'Gubbo', 'Mogg', 'Narg', 'Ratchit', 'Skab', 'Uggo', 'Zogg', 'Blug', 'Grizz', 'Kratt', 'Lurg', 'Nubbik', 'Pokk',
  'Shrog', 'Snotlik', 'Throk', 'Vrek', 'Yagg', 'Durz', 'Fitchek', 'Gnash', 'Hruk', 'Jabbo', 'Krug', 'Mukk', 'Nixit', 'Ozk', 'Rudge',
  'Skulk', 'Tuzzik', 'Wortle', 'Brak', 'Drigg', 'Gorb', 'Hobbik', 'Klik', 'Lugga', 'Murk', 'Ningle', 'Pilch', 'Scabbit', 'Sprigg', 'Tikkit',
  'Azog', 'Bolgrik', 'Grishnak', 'Gorbag', 'Lagduf', 'Muzgash', 'Radbug', 'Shagrat', 'Ufthak', 'Snaga', 'Bugrat', 'Grubnik', 'Krakka', 'Mazog',
  'Nazgrik', 'Ogrod', 'Pugnak', 'Rakkus', 'Skarg', 'Thrug', 'Urzog', 'Varg', 'Wazzik', 'Yazug', 'Zubrak', 'Bragg', 'Dregnik', 'Frak',
  'Glob', 'Harg', 'Izzik', 'Jorg', 'Kruk', 'Lurtz', 'Mugrash', 'Nurk', 'Ork', 'Prak', 'Quag', 'Rogash', 'Sludge', 'Tagrat', 'Ughash',
];
let minionChain: Chain | undefined;

/**
 * A minion's name — only when a scene needs one: the sentry you slip past, the
 * guard you talk round. Short and harsh; never a person's style.
 */
export function minionName(rng: Rng, avoid?: Set<string>): string {
  minionChain ??= new Chain(MINION);
  return wordOrRepeat(minionChain, rng, 4, 7, avoid);
}

/** The style a place of this kind and theme sounds like, drawn among a few. */
export function styleFor(kind: 'village' | 'town' | 'city' | 'delve', theme: string, rng: Rng): NameStyle {
  const by: Record<string, NameStyle[]> = {
    village: ['saxon', 'hearth', 'isles', 'gaelic', 'slavic'],
    town: ['saxon', 'hearth', 'norse', 'isles', 'gaelic', 'germanic', 'slavic'],
    city: ['courtly', 'alley', 'elvish', 'germanic', 'slavic', 'sorcery'],
    stone: ['norse', 'saxon', 'germanic'], ember: ['norse', 'germanic', 'sorcery'], graveyard: ['courtly', 'saxon', 'slavic', 'sorcery'],
    bog: ['isles', 'saxon', 'gaelic', 'slavic'], forest: ['elvish', 'saxon', 'gaelic'],
  };
  const pool = by[kind === 'delve' ? theme : kind] ?? NAME_STYLES;
  return pool[Math.floor(rng() * pool.length)]!;
}
