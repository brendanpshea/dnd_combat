/**
 * Which chapters this browser has finished.
 *
 * Separate from the save slot, and it has to be: the save holds one run and is
 * cleared when a campaign ends, so it can say where you are but never where you
 * have been. Without a second record, finishing the last chapter erased every
 * trace that you had played at all — and with chapters now locked until you
 * reach them, that would lock the whole story back up behind you.
 *
 * Deliberately a set of ids and nothing else. Not a date, not a score, not the
 * party you did it with: every extra field is a migration waiting to happen for
 * a feature nobody asked for, and the only question anyone asks of this is
 * "may I start chapter three yet".
 */
const KEY = 'dnd-adventure-progress';

export function completedModules(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const ids: unknown = JSON.parse(raw);
    // A hand-edited or half-written record must degrade to "nothing finished",
    // which locks chapters — never to a throw, which would take the menu down.
    return Array.isArray(ids) ? new Set(ids.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function markModuleCompleted(id: string): void {
  try {
    const done = completedModules();
    if (done.has(id)) return;
    done.add(id);
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch { /* quota, or no storage at all */ }
}

/** For the settings/debug path: forget everything that was ever finished. */
export function clearProgress(): void {
  try { localStorage.removeItem(KEY); } catch { /* no storage */ }
}
