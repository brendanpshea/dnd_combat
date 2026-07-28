/**
 * Arena persistence for the browser: localStorage, mirroring campaignStorage.
 *
 * The run and its party are saved together — a run is meaningless without the
 * party that fought it, and vice versa.
 */
import type { CampaignState } from '../../src/campaign/campaign.js';
import { parseCampaign } from '../../src/campaign/campaign.js';
import type { ArenaRunState } from '../../src/arena/run.js';
import { wrap, unwrap, loadProblem } from './saveEnvelope.js';

const KEY = 'dnd-arena-save';

export interface ArenaSave {
  campaign: CampaignState;
  run: ArenaRunState;
}

export function saveArenaWeb(save: ArenaSave): void {
  try { localStorage.setItem(KEY, wrap(save)); } catch { /* quota */ }
}

export function loadArenaWeb(): ArenaSave | undefined {
  const u = unwrap(localStorage.getItem(KEY));
  if (u.kind !== 'ok') return undefined;
  try {
    const parsed = JSON.parse(u.raw) as { campaign?: unknown; run?: ArenaRunState };
    const campaign = parseCampaign(JSON.stringify(parsed.campaign));
    if (!campaign || !parsed.run) return undefined;
    return { campaign, run: parsed.run };
  } catch {
    return undefined;   // a corrupt save starts a fresh run
  }
}

/** Why the run could not be resumed, for the screen to say — see campaignStorage. */
export function arenaLoadProblem(): string | undefined {
  const raw = localStorage.getItem(KEY);
  const u = unwrap(raw);
  if (u.kind === 'ok' && !loadArenaWeb()) {
    return 'A saved arena run was found but could not be read. Starting fresh will replace it.';
  }
  return loadProblem(u, raw !== null);
}

export function deleteArenaWeb(): void {
  localStorage.removeItem(KEY);
}
