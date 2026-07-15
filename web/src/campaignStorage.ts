/**
 * Campaign persistence for the browser: localStorage.
 */
import type { CampaignState } from '../../src/campaign/campaign.js';
import { parseCampaign } from '../../src/campaign/campaign.js';

const KEY = 'dnd-campaign-save';

export function saveCampaignWeb(c: CampaignState): void {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export function loadCampaignWeb(): CampaignState | undefined {
  const raw = localStorage.getItem(KEY);
  return raw ? parseCampaign(raw) : undefined;
}

export function deleteCampaignWeb(): void {
  localStorage.removeItem(KEY);
}
