/**
 * Reading-level tooling for adventure prose. New players (and younger ones)
 * have to *read* every scene, so the writing is held to roughly an 8th-grade
 * level — short sentences, plain words. This computes the Flesch–Kincaid grade
 * level of a passage and walks a module's prose so a test can flag anything
 * that drifts too hard to parse.
 *
 * Grade level = 0.39·(words/sentence) + 11.8·(syllables/word) − 15.59. The two
 * levers are sentence length and word length, so the fix for a failing passage
 * is almost always "split the long sentence", which is exactly what makes a
 * beat easier to follow on a phone mid-fight.
 */
import nlp from 'compromise';
import type { Module, Paragraph } from './types.js';

/** Strip the markdown and glyphs the UI renders, so scoring sees only prose. */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/[—–]/g, ' ')             // dashes → spaces (not sentence ends)
    .replace(/[^\p{L}\p{N}\s.!?,'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A rough but stable syllable count: vowel groups, with a few common
 *  adjustments (silent trailing 'e', short words count as one). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch–Kincaid grade level for a passage (higher = harder). */
export function gradeLevel(text: string): number {
  const clean = plain(text);
  const sentences = Math.max(1, (clean.match(/[.!?]+/g) ?? []).length);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

/** How many real words a passage has (short UI fragments — button labels, a
 *  two-word hint — aren't worth grading, so callers can skip them). */
export function wordCount(text: string): number {
  return plain(text).split(/\s+/).filter(Boolean).length;
}

/**
 * Archaic / obscure words that a grade-school reader stumbles on — the ones the
 * Flesch–Kincaid score sails right past because they happen to be short.
 * "huscarl", "bier", and "causeway" all score as easy by syllable count but
 * stop a young reader cold. We want plain, vivid modern-fantasy prose (Zelda,
 * Final Fantasy, Pratchett, Dungeon Crawler Carl), not 1980s rulebook diction,
 * so these are banned and a test flags them. Creature names the game genuinely
 * uses (wyrmling, manticore, gorgon, oni) and the setting's own proper nouns
 * are NOT here — only ordinary words with a plain synonym one reach away.
 */
export const HARD_WORDS: Set<string> = new Set([
  'huscarl', 'huscarls', 'bier', 'biers', 'causeway', 'causeways',
  'shamble', 'shambles', 'shambling', 'shambled', 'ossuary', 'ossuaries',
  'missal', 'missals', 'palisade', 'palisades', 'cairn', 'cairns',
  'sigil', 'sigils', 'parapet', 'parapets', 'flagstone', 'flagstones',
  'levy', 'levies', 'muster', 'musters', 'mustered', 'mustering',
  'picket', 'pickets', 'lychgate', 'lychgates',
  'sepulchre', 'sepulchres', 'fetid', 'miasma',
  'pallid', 'gaunt', 'wan', 'sundered', 'riven', 'rime', 'hoarfrost',
  'thrall', 'thralls', 'sortie', 'sorties', 'rampart', 'ramparts',
  'portcullis', 'scrivener', 'apothecary', 'draught', 'draughts',
  'halberd', 'halberds', 'glaive', 'glaives',
]);
// Deliberately NOT banned: creature names the game uses (wyrmling, manticore,
// gorgon, oni, wight) and established NPC titles read in context (a reeve, a
// quartermaster) — those are proper nouns, not vocabulary a rewrite can swap.

/** Any banned archaic words a passage uses (lower-cased, deduped). Splits on
 *  hyphens too, so a compound like "missal-named" can't smuggle one past. */
export function hardWordsIn(text: string): string[] {
  const words = plain(text).toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^a-z]/g, '')) // strip attached punctuation ("flagstones." → "flagstones")
    .filter(Boolean);
  return [...new Set(words.filter((w) => HARD_WORDS.has(w)))];
}

// --- The general readability check -----------------------------------------
// One passage, several independent signals — no single metric catches every
// way prose gets hard to follow, so we combine the standard grade score with
// the two structural habits that make a beat a slog to parse on a phone: the
// sprawling run-on sentence, and the clause pile-up (a thought chopped into
// sub-clauses with stacked em-dashes, semicolons, and colons).

/** Longest a single sentence should run. Past this it outruns a reader's breath. */
export const MAX_SENTENCE_WORDS = 26;
/** Heavy clause-breaks (— ; :) allowed in one sentence. Two+ is a pile-up: the
 *  "A — B; C: D" construction that reads as four half-thoughts, not one. */
export const MAX_CLAUSE_BREAKS = 1;

/** Split a passage into sentences (markdown/glyphs already meaningless here). */
function sentences(text: string): string[] {
  return plain(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

// --- Fragment + passive-voice detection ------------------------------------
// Narration should be complete, active sentences: "Cold light burning in its
// sockets." makes the reader supply the missing verb, and "the graves were
// opened" hides *who* opened them — both cost clarity. Dialogue is exempt
// (people talk in fragments), so quoted spans are stripped before checking.

/** Auxiliaries + modals: any of these makes a sentence verb-bearing. */
const AUX_VERBS = new Set([
  'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'has', 'have', 'had', 'do', 'does', 'did',
  'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must',
  "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "couldn't", "shouldn't",
]);

/** Common base verbs of adventure narration — enough to recognise a finite verb
 *  in present tense (base or 3rd-person -s). Not exhaustive English; tuned so
 *  real module sentences pass and real fragments fail. */
const BASE_VERBS = new Set([
  'stand', 'take', 'make', 'come', 'go', 'walk', 'run', 'burn', 'draw', 'hold', 'keep',
  'open', 'close', 'fall', 'rise', 'sit', 'lie', 'lead', 'turn', 'look', 'watch', 'wait',
  'call', 'name', 'know', 'see', 'hear', 'smell', 'feel', 'mean', 'say', 'tell', 'ask',
  // "talk" without these reads as a plural noun after an out-of-lexicon subject
  // ("The manticore talks." parsed like "TED talks"), flagging a real sentence.
  'talk', 'listen', 'sound', 'graze', 'drill', 'salute', 'chalk', 'wire',
  'answer', 'pay', 'buy', 'sell', 'break', 'build', 'leave', 'arrive', 'reach', 'cross',
  'climb', 'drop', 'hang', 'stay', 'live', 'die', 'kill', 'fight', 'win', 'lose', 'find',
  'hide', 'seek', 'hunt', 'follow', 'chase', 'catch', 'carry', 'bring', 'send', 'put',
  'set', 'cut', 'hit', 'strike', 'swing', 'throw', 'roll', 'move', 'step', 'pass',
  'enter', 'descend', 'gather', 'count', 'read', 'write', 'speak', 'whisper', 'shout',
  'sing', 'ring', 'sound', 'echo', 'begin', 'end', 'stop', 'start', 'finish', 'need',
  'want', 'help', 'serve', 'work', 'try', 'seem', 'appear', 'remain', 'become', 'get',
  'give', 'grow', 'point', 'aim', 'fire', 'shoot', 'guard', 'seal', 'bless', 'pray',
  'feed', 'eat', 'drink', 'sleep', 'wake', 'remember', 'forget', 'learn', 'believe',
  'trust', 'fear', 'hope', 'promise', 'swear', 'agree', 'refuse', 'offer', 'accept',
  'choose', 'decide', 'plan', 'prepare', 'spend', 'cost', 'owe', 'steal', 'bleed',
  'heal', 'hurt', 'wound', 'save', 'free', 'trap', 'lock', 'bar', 'block', 'clear',
  'pour', 'fill', 'empty', 'sink', 'float', 'swim', 'wade', 'march', 'ride', 'fly',
  'glide', 'crawl', 'creep', 'sneak', 'slip', 'slide', 'stumble', 'land', 'jump',
  'leap', 'duck', 'dodge', 'kneel', 'beg', 'thank', 'greet', 'meet', 'join', 'split',
  'share', 'spread', 'stretch', 'bend', 'twist', 'wrap', 'tie', 'bind', 'snap',
  'crack', 'shatter', 'smash', 'crush', 'grind', 'tear', 'rip', 'pull', 'push',
  'lift', 'raise', 'lower', 'settle', 'rest', 'breathe', 'smile', 'laugh', 'cry',
  'nod', 'shake', 'wave', 'reply', 'notice', 'ignore', 'welcome', 'warn', 'threaten',
  'attack', 'defend', 'charge', 'retreat', 'flee', 'scatter', 'surround', 'press',
  'lean', 'pretend', 'mention', 'suggest', 'expect', 'wonder', 'matter', 'happen',
  'belong', 'depend', 'change', 'stink', 'reek', 'glint', 'gleam', 'glow', 'flicker',
  'shine', 'darken', 'brighten', 'loom', 'lurk', 'wear', 'show', 'hand', 'trade',
  'stock', 'haggle', 'travel', 'return', 'visit', 'explore', 'search', 'check',
  // Motion, gesture, and sound verbs the POS tagger tends to read as nouns.
  'scramble', 'flop', 'lope', 'erupt', 'drift', 'loosen', 'narrow', 'tap', 'crow',
  'sigh', 'groan', 'creak', 'rattle', 'hiss', 'growl', 'snarl', 'bark', 'howl',
  'roar', 'shriek', 'wail', 'mutter', 'grumble', 'chuckle', 'grin', 'frown',
  'shrug', 'blink', 'stare', 'gaze', 'glance', 'peer', 'squint', 'gesture',
  'stride', 'trot', 'gallop', 'dash', 'bolt', 'sprint', 'hurry', 'wander',
  'roam', 'linger', 'pause', 'hesitate', 'tremble', 'shiver', 'shudder',
  'flinch', 'sway', 'wobble', 'collapse', 'crumble', 'topple', 'tumble',
  'plunge', 'dive', 'soar', 'hover', 'perch', 'cling', 'grip', 'grasp',
  'clutch', 'snatch', 'grab', 'yank', 'shove', 'heave', 'haul', 'drag', 'tug',
  'fling', 'hurl', 'toss', 'flick', 'slap', 'punch', 'kick', 'stomp',
  'trample', 'bulge', 'gutter', 'wink', 'lash', 'coil', 'uncoil', 'slither',
  'scuttle', 'skitter', 'lurch', 'stagger', 'limp', 'shuffle', 'stalk',
  'prowl', 'pounce', 'lunge', 'swoop', 'flap', 'flutter', 'twitch', 'jerk',
  'bob', 'dip', 'tilt', 'crane', 'cock', 'curl', 'clench', 'brace', 'steady',
  'straighten', 'stiffen', 'relax', 'ease', 'settle', 'crouch', 'squat',
  'sprawl', 'slump', 'sag', 'droop', 'wilt', 'bloom', 'sprout', 'swell',
  'shrink', 'fade', 'dim', 'blaze', 'flare', 'spark', 'smoke', 'smoulder',
  'seep', 'ooze', 'trickle', 'gush', 'splash', 'ripple', 'churn', 'boil',
  'simmer', 'freeze', 'thaw', 'melt', 'crackle', 'pop', 'thud', 'thump',
  'clang', 'clatter', 'chime', 'toll', 'hum', 'buzz', 'drone', 'murmur',
  'rustle', 'crunch', 'squelch', 'squeal', 'yelp', 'whine', 'whimper', 'purr',
  'cackle', 'jeer', 'sneer', 'scoff', 'boast', 'brag', 'bicker', 'argue',
  'debate', 'insist', 'declare', 'announce', 'proclaim', 'vow', 'plead',
  'urge', 'command', 'order', 'demand', 'summon', 'dismiss', 'banish',
  'intercept', 'short', 'commission', 'stampede',
]);

/** Common irregular past forms (the -ed heuristic can't see these). */
const IRREGULAR_PASTS = new Set([
  'came', 'went', 'stood', 'took', 'made', 'found', 'left', 'drew', 'held', 'kept',
  'fell', 'rose', 'sat', 'lay', 'led', 'knew', 'saw', 'heard', 'felt', 'meant',
  'said', 'told', 'paid', 'bought', 'sold', 'broke', 'built', 'brought', 'sent',
  'got', 'gave', 'grew', 'began', 'sang', 'rang', 'ran', 'won', 'lost', 'fought',
  'caught', 'taught', 'thought', 'sought', 'struck', 'swung', 'threw', 'flew',
  'slew', 'wore', 'tore', 'swore', 'bore', 'spoke', 'woke', 'chose', 'froze',
  'stole', 'drove', 'rode', 'rode', 'ate', 'drank', 'sank', 'swam', 'sprang',
  'hung', 'stuck', 'dug', 'spun', 'bled', 'fed', 'fled', 'sped', 'met', 'lit',
  'hid', 'slid', 'bit', 'fit', 'spat', 'shot', 'shut', 'burst', 'cast', 'let',
  'read', 'spread', 'wound', 'bound', 'ground', 'stank', 'burnt', 'dreamt',
  'leapt', 'crept', 'slept', 'swept', 'wept', 'dealt', 'knelt', 'shone',
]);

/** Participles that are really adjectives in everyday use — "she is tired" is
 *  not the passive voice the check is hunting. */
const ADJECTIVAL_PARTICIPLES = new Set([
  'tired', 'armed', 'armored', 'dressed', 'worried', 'pleased', 'scared',
  'ashamed', 'surprised', 'disappointed', 'interested', 'excited', 'exhausted',
  'wounded', 'dead', 'gone', 'alone', 'open', 'shut', 'closed', 'crowded',
  'deserted', 'abandoned', 'ruined', 'rotted', 'cracked', 'crooked', 'pointed',
  'jagged', 'twisted', 'hooded', 'bearded', 'aged', 'sacred', 'wicked', 'naked',
]);

const IRREGULAR_PARTICIPLES = new Set([
  'taken', 'given', 'held', 'kept', 'built', 'made', 'found', 'left', 'sworn',
  'worn', 'torn', 'broken', 'chosen', 'driven', 'drawn', 'thrown', 'known',
  'shown', 'seen', 'done', 'begun', 'sung', 'hung', 'struck', 'bound', 'wound',
  'laid', 'paid', 'said', 'sold', 'told', 'brought', 'bought', 'caught',
  'taught', 'fought', 'sent', 'spent', 'bent', 'lost', 'meant', 'set', 'put',
  'cut', 'hit', 'hurt', 'let', 'led', 'fed', 'bled', 'met', 'lit', 'hidden',
  'ridden', 'risen', 'fallen', 'beaten', 'eaten', 'forgotten', 'written',
  'frozen', 'stolen', 'woken', 'spoken', 'borne', 'born', 'slain', 'lain',
  'heard', 'buried', 'carried', 'slept', 'swept', 'kept', 'crept',
]);

const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');

/** Does this token read as a finite verb (or auxiliary)? */
function isVerbToken(word: string): boolean {
  const w = norm(word);
  if (!w) return false;
  if (AUX_VERBS.has(w) || BASE_VERBS.has(w) || IRREGULAR_PASTS.has(w)) return true;
  if (w.length > 3 && w.endsWith('ed')) return true;                 // walked, opened
  if (w.endsWith('s')) {                                            // takes, watches
    const stem = w.endsWith('es') ? w.slice(0, -2) : w.slice(0, -1);
    if (BASE_VERBS.has(stem) || BASE_VERBS.has(w.slice(0, -1))) return true;
  }
  return false;
}

/** Narration with quoted dialogue removed — fragments in speech are fine. */
function narrationOnly(text: string): string {
  return text.replace(/"[^"]*"/g, ' ').replace(/“[^”]*”/g, ' ');
}

/**
 * Sentences (outside dialogue) with three or more words and no finite verb —
 * "Cold light burning in its sockets.", "The hall of the old dead kings." A
 * 1–2-word punch ("**THORNWICK**.") is allowed; it's the run of verbless
 * imagery that hurts.
 *
 * Two independent verb detectors vote, and a sentence is flagged only when
 * BOTH find nothing finite — precision over recall, so the lint never bullies
 * a good sentence: the compromise POS tagger (which knows English inflection
 * but mis-tags noun/verb-ambiguous words in fantasy register: "raiders
 * scramble") unioned with a curated lexicon (which knows this corpus's verbs
 * but not all of English). A bare gerund with no auxiliary ("light *burning*")
 * is non-finite for both — that's the classic fragment.
 */
export function sentenceFragments(text: string): string[] {
  const out: string[] = [];
  for (const s of sentences(narrationOnly(text))) {
    const words = s.split(/\s+/).filter((w) => norm(w).length > 0);
    if (words.length < 3) continue;
    if (words.some(isVerbToken)) continue; // lexicon vote: has a finite verb
    const d = nlp(s);
    // POS vote: a #Verb that isn't merely a dangling gerund (or the particle
    // of one — "burning *in*") counts as finite.
    const finite = d.match('#Verb').not('#Gerund').not('#Particle').found
      || d.has('(#Copula|#Auxiliary|#Modal) #Adverb? #Gerund');
    if (!finite) out.push(s);
  }
  return out;
}

/** Passive-voice constructions — "the graves were opened", "the road is
 *  watched" — via the POS tagger: a form of "be" + optional adverb + a past
 *  participle. Active voice names the actor; that's the house style. The
 *  adjectival-participle allowlist ("she is tired") suppresses the classic
 *  false positives. */
export function passiveConstructions(text: string): string[] {
  const out: string[] = [];
  for (const s of sentences(narrationOnly(text))) {
    const d = nlp(s);
    const m = d.match('(is|are|was|were|been|being|be) #Adverb? #PastTense');
    if (!m.found) continue;
    // Skip when the "participle" is really an adjective in everyday use.
    const parts = m.match('#PastTense').out('array') as string[];
    if (parts.every((p) => ADJECTIVAL_PARTICIPLES.has(norm(p)))) continue;
    out.push(s);
  }
  return [...new Set(out)];
}

/**
 * Every concrete reason a passage is harder to read than our target, as short
 * human-readable strings (empty = clean). Drives the readability test, so a
 * failure points at the exact sentence or word to fix rather than a bare score.
 */
export function readabilityIssues(text: string): string[] {
  const issues: string[] = [];
  const grade = gradeLevel(text);
  if (grade > 8) issues.push(`grade ${grade.toFixed(1)} (> 8)`);
  for (const w of hardWordsIn(text)) issues.push(`archaic word "${w}"`);
  for (const s of sentences(text)) {
    const words = s.split(/\s+/).filter(Boolean).length;
    if (words > MAX_SENTENCE_WORDS) issues.push(`${words}-word sentence: "${s.slice(0, 50)}…"`);
  }
  // Clause-break density needs the ORIGINAL punctuation (plain() turns dashes to
  // spaces), so re-scan the source, split on sentence enders, marks intact.
  for (const s of text.replace(/\*+/g, '').split(/(?<=[.!?])\s+/)) {
    const breaks = (s.match(/[—–;:]/g) ?? []).length;
    if (breaks > MAX_CLAUSE_BREAKS) {
      issues.push(`${breaks} clause-breaks (— ; :) in one sentence: "${s.trim().slice(0, 50)}…"`);
    }
  }
  for (const s of sentenceFragments(text)) issues.push(`sentence fragment (no verb): "${s.slice(0, 60)}"`);
  for (const s of passiveConstructions(text)) issues.push(`passive voice: "${s.slice(0, 60)}"`);
  return issues;
}

export interface ProsePassage {
  /** Where it lives, for a failing-test message: `moduleId:sceneId:field`. */
  where: string;
  text: string;
}

/**
 * Every short player-facing *label*: choice buttons, approach names and hints,
 * map-node names, and the mystery text an unvisited node shows. These are read
 * and tapped as much as any paragraph, but they're too short to grade — so they
 * get the vocabulary check only, and `collectModuleProse` leaves them alone.
 *
 * Collected separately because they were invisible to the checker for a long
 * time, which is how "Slip over the palisade" and "The Muster Yard" survived
 * every readability pass the paragraphs went through.
 */
export function collectModuleLabels(mod: Module): ProsePassage[] {
  const out: ProsePassage[] = [];
  const push = (text: string | undefined, where: string) => {
    if (text) out.push({ where, text });
  };
  for (const scene of Object.values(mod.scenes)) {
    const at = `${mod.id}:${scene.id}`;
    if ('title' in scene) push(scene.title, `${at}:title`);
    if ('next' in scene && Array.isArray(scene.next)) {
      for (const c of scene.next) push(c.label, `${at}:choice:${c.id}`);
    }
    if ('approaches' in scene) {
      for (const a of scene.approaches ?? []) {
        push(a.label, `${at}:approach:${a.id}`);
        push(a.hint, `${at}:approach:${a.id}:hint`);
      }
    }
    if ('map' in scene) {
      push(scene.map.title, `${at}:map:title`);
      for (const n of scene.map.nodes) {
        push(n.label, `${at}:node:${n.id}`);
        push(n.mystery, `${at}:node:${n.id}:mystery`);
      }
    }
  }
  push(mod.title, `${mod.id}:title`);
  push(mod.blurb, `${mod.id}:blurb`);
  return out;
}

/** Every substantial prose passage in a module — the narration a player reads,
 *  not the short choice/approach labels (see `collectModuleLabels`). */
export function collectModuleProse(mod: Module): ProsePassage[] {
  const out: ProsePassage[] = [];
  const add = (paras: Paragraph[] | undefined, where: string) => {
    for (const p of paras ?? []) out.push({ where, text: String(p) });
  };
  for (const scene of Object.values(mod.scenes)) {
    const at = `${mod.id}:${scene.id}`;
    if ('text' in scene) add(scene.text, `${at}:text`);
    if ('lines' in scene) add(scene.lines, `${at}:lines`);
    if ('intro' in scene) add(scene.intro, `${at}:intro`);
    if ('success' in scene && scene.success?.text) add(scene.success.text, `${at}:success`);
    if ('failure' in scene && scene.failure?.text) add(scene.failure.text, `${at}:failure`);
    if ('onWin' in scene && scene.onWin?.text) add(scene.onWin.text, `${at}:onWin`);
    if ('onLoss' in scene && scene.onLoss?.text) add(scene.onLoss.text, `${at}:onLoss`);
    if ('approaches' in scene) {
      for (const a of scene.approaches ?? []) {
        if (a.success?.text) add(a.success.text, `${at}:${a.id}:success`);
        if (a.failure?.text) add(a.failure.text, `${at}:${a.id}:failure`);
      }
    }
  }
  // Journal entries (quest logs, clues, NPC notes) are player-facing reading
  // too — buried in `effects` all over the tree, so sweep for them recursively.
  const seen = new Set<string>();
  const sweepJournals = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(sweepJournals); return; }
    const o = node as Record<string, unknown>;
    if (o['kind'] === 'journal' && o['entry'] && typeof o['entry'] === 'object') {
      const entry = o['entry'] as { id?: string; body?: string };
      if (entry.body && !seen.has(entry.body)) {
        seen.add(entry.body);
        out.push({ where: `${mod.id}:journal:${entry.id ?? '?'}`, text: entry.body });
      }
    }
    for (const key of Object.keys(o)) sweepJournals(o[key]);
  };
  sweepJournals(mod.scenes);
  return out;
}
