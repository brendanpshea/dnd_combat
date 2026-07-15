/**
 * Campaign persistence for the CLI: plain JSON in the working directory.
 * (The web UI has its own localStorage-backed equivalent.)
 */
import * as fs from 'node:fs';
import type { CampaignState } from './campaign.js';
import { parseCampaign } from './campaign.js';

export const SAVE_PATH = 'campaign-save.json';

export function saveCampaign(c: CampaignState, path = SAVE_PATH): void {
  fs.writeFileSync(path, JSON.stringify(c, null, 2));
}

export function loadCampaign(path = SAVE_PATH): CampaignState | undefined {
  if (!fs.existsSync(path)) return undefined;
  return parseCampaign(fs.readFileSync(path, 'utf8'));
}

export function deleteSave(path = SAVE_PATH): void {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
