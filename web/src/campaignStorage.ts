/**
 * Campaign persistence for the browser: localStorage.
 *
 * Written through a version envelope (see saveEnvelope.ts) so a save this build
 * cannot read is distinguishable from no save at all. Reading an unwrapped blob
 * still works: every save written before versioning is version 0 and parses
 * exactly as it always did.
 */
import type { CampaignState } from '../../src/campaign/campaign.js';
import { parseCampaign } from '../../src/campaign/campaign.js';
import { wrap, unwrap, loadProblem } from './saveEnvelope.js';

const KEY = 'dnd-campaign-save';

/** The raw save, or null when there is none — or when storage is blocked. */
function readKey(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function saveCampaignWeb(c: CampaignState): void {
  try { localStorage.setItem(KEY, wrap(c)); } catch { /* quota */ }
}

export function loadCampaignWeb(): CampaignState | undefined {
  const u = unwrap(readKey());
  return u.kind === 'ok' ? parseCampaign(u.raw) : undefined;
}

/**
 * Why the save could not be opened, for the screen to say out loud — undefined
 * when there was nothing to open, which needs no words.
 */
export function campaignLoadProblem(): string | undefined {
  const raw = readKey();
  const u = unwrap(raw);
  if (u.kind === 'ok' && !parseCampaign(u.raw)) {
    return 'A saved campaign was found but could not be read. Starting fresh will replace it.';
  }
  return loadProblem(u, raw !== null);
}

export function deleteCampaignWeb(): void {
  try { localStorage.removeItem(KEY); } catch { /* blocked */ }
}
