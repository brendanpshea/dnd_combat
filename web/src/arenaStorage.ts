/**
 * Arena persistence for the browser: localStorage, mirroring campaignStorage.
 *
 * The run and its party are saved together — a run is meaningless without the
 * party that fought it, and vice versa.
 */
import type { CampaignState } from '../../src/campaign/campaign.js';
import { parseCampaign } from '../../src/campaign/campaign.js';
import type { ArenaRunState } from '../../src/arena/run.js';

const KEY = 'dnd-arena-save';

export interface ArenaSave {
  campaign: CampaignState;
  run: ArenaRunState;
}

export function saveArenaWeb(save: ArenaSave): void {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function loadArenaWeb(): ArenaSave | undefined {
  const raw = localStorage.getItem(KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { campaign?: unknown; run?: ArenaRunState };
    const campaign = parseCampaign(JSON.stringify(parsed.campaign));
    if (!campaign || !parsed.run) return undefined;
    return { campaign, run: parsed.run };
  } catch {
    return undefined;   // a corrupt or stale save just starts a fresh run
  }
}

export function deleteArenaWeb(): void {
  localStorage.removeItem(KEY);
}
