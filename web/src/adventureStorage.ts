/** Adventure persistence for the browser: localStorage (one save slot). */
import type { AdventureState } from '../../src/adventure/runtime.js';
import type { Module } from '../../src/adventure/types.js';
import { serializeAdventure, parseAdventure, savedModuleId } from '../../src/adventure/save.js';

const KEY = 'dnd-adventure-save';

/** The raw save, or null when there is none — or when storage is blocked. */
function readKey(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function saveAdventureWeb(state: AdventureState): void {
  try { localStorage.setItem(KEY, serializeAdventure(state)); } catch { /* quota */ }
}

/** Resume a saved run for `module`, or undefined if none/invalid. */
export function loadAdventureWeb(module: Module): AdventureState | undefined {
  const raw = readKey();
  return raw ? parseAdventure(raw, module) : undefined;
}

/** The module id of the current save (to show "Resume" on the right card). */
export function savedAdventureModule(): string | undefined {
  const raw = readKey();
  return raw ? savedModuleId(raw) : undefined;
}

export function deleteAdventureWeb(): void {
  try { localStorage.removeItem(KEY); } catch { /* blocked */ }
}
