/**
 * Adventure persistence for the browser: localStorage, in save slots.
 *
 * There was one slot, shared by every adventure, so starting a second company
 * — or a different chapter — overwrote the first. Now there are SLOT_COUNT
 * companies, each with two saves:
 *
 *   the run         written on every action, as the one slot always was;
 *   a checkpoint    written as the party steps up to a fight, so a fight that
 *                   went badly can be taken again from just before it — the
 *                   Gold Box habit of saving at the door, done for the player.
 *
 * The old single slot is moved into slot 1 the first time it is read.
 */
import type { AdventureState } from '../../src/adventure/runtime.js';
import type { Module } from '../../src/adventure/types.js';
import { serializeAdventure, parseAdventure, savedModuleId } from '../../src/adventure/save.js';
import { levelForXp } from '../../src/campaign/campaign.js';

export const SLOT_COUNT = 3;
const LEGACY_KEY = 'dnd-adventure-save';
const ACTIVE_KEY = 'dnd-adventure-active-slot';
const runKey = (slot: number) => `dnd-adventure-slot-${slot}`;
const checkpointKey = (slot: number) => `dnd-adventure-slot-${slot}-checkpoint`;
const metaKey = (slot: number) => `dnd-adventure-slot-${slot}-meta`;

/** What a slot's card shows without parsing the whole save. */
export interface SlotMeta {
  moduleId: string;
  /** Party level and names, for "Level 3 · Arthur, Morgan, …". */
  level: number;
  names: string[];
  savedAt: number;
  /** The fight the checkpoint was taken before, if there is one. */
  checkpointLabel?: string;
}

function get(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function set(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota or blocked */ }
}
function remove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* blocked */ }
}

/** Move the pre-slots save into slot 1, once. */
function migrate(): void {
  const legacy = get(LEGACY_KEY);
  if (legacy === null) return;
  if (get(runKey(0)) === null) set(runKey(0), legacy);
  remove(LEGACY_KEY);
}

export function activeSlot(): number {
  migrate();
  const n = Number(get(ACTIVE_KEY) ?? 0);
  return Number.isInteger(n) && n >= 0 && n < SLOT_COUNT ? n : 0;
}

export function setActiveSlot(slot: number): void {
  set(ACTIVE_KEY, String(slot));
}

function writeMeta(slot: number, state: AdventureState, checkpointLabel?: string): void {
  const prev = slotMeta(slot);
  const meta: SlotMeta = {
    moduleId: state.moduleId,
    level: levelForXp(state.campaign.xp ?? 0),
    names: state.campaign.characters.map((c) => c.name),
    savedAt: Date.now(),
    ...(checkpointLabel !== undefined ? { checkpointLabel }
      : prev?.checkpointLabel !== undefined && prev.moduleId === state.moduleId
        ? { checkpointLabel: prev.checkpointLabel } : {}),
  };
  set(metaKey(slot), JSON.stringify(meta));
}

/** The card for `slot`, or undefined when it is empty. */
export function slotMeta(slot: number): SlotMeta | undefined {
  migrate();
  const raw = get(metaKey(slot));
  if (raw) {
    try { return JSON.parse(raw) as SlotMeta; } catch { /* fall through */ }
  }
  // A save with no card (the migrated legacy slot): enough to name the module.
  const run = get(runKey(slot));
  const moduleId = run ? savedModuleId(run) : undefined;
  return moduleId ? { moduleId, level: 0, names: [], savedAt: 0 } : undefined;
}

export function saveAdventureWeb(state: AdventureState, slot = activeSlot()): void {
  set(runKey(slot), serializeAdventure(state));
  writeMeta(slot, state);
}

/** Resume the active slot's run for `module`, or undefined if none/invalid. */
export function loadAdventureWeb(module: Module, slot = activeSlot()): AdventureState | undefined {
  const raw = get(runKey(slot));
  return raw ? parseAdventure(raw, module) : undefined;
}

/** The module id of the active slot's save (to show "Resume" on the right card). */
export function savedAdventureModule(slot = activeSlot()): string | undefined {
  const raw = get(runKey(slot));
  return raw ? savedModuleId(raw) : undefined;
}

/** Empty `slot` (the active one by default), checkpoint and all. */
export function deleteAdventureWeb(slot = activeSlot()): void {
  remove(runKey(slot));
  remove(checkpointKey(slot));
  remove(metaKey(slot));
}

/** Every slot, for the error boundary's last-resort reset. */
export function deleteAllAdventureSaves(): void {
  remove(LEGACY_KEY);
  remove(ACTIVE_KEY);
  for (let s = 0; s < SLOT_COUNT; s++) deleteAdventureWeb(s);
}

/** The party as it stands at the door of a fight, labelled with the fight. */
export function saveCheckpointWeb(state: AdventureState, label: string, slot = activeSlot()): void {
  set(checkpointKey(slot), serializeAdventure(state));
  writeMeta(slot, state, label);
}

/** The checkpoint for `module` in `slot`, or undefined. */
export function loadCheckpointWeb(module: Module, slot = activeSlot()): AdventureState | undefined {
  const raw = get(checkpointKey(slot));
  return raw ? parseAdventure(raw, module) : undefined;
}
