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
  return issues;
}

export interface ProsePassage {
  /** Where it lives, for a failing-test message: `moduleId:sceneId:field`. */
  where: string;
  text: string;
}

/** Every substantial prose passage in a module — the narration a player reads,
 *  not the short choice/approach labels. */
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
