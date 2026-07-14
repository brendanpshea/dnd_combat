/**
 * Campaign persistence: plain JSON in the working directory.
 */
import * as fs from 'node:fs';
import type { CampaignState } from './campaign.js';

export const SAVE_PATH = 'campaign-save.json';

export function saveCampaign(c: CampaignState, path = SAVE_PATH): void {
  fs.writeFileSync(path, JSON.stringify(c, null, 2));
}

export function loadCampaign(path = SAVE_PATH): CampaignState | undefined {
  if (!fs.existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf8')) as CampaignState;
    if (typeof raw.gold !== 'number' || !Array.isArray(raw.characters)) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

export function deleteSave(path = SAVE_PATH): void {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
