import { describe, it, expect } from 'vitest';
import { buildCharacter } from '../src/builder/character.js';
import { newCampaign, setPartyClass, setPartyChoice, buildCampaignParty } from '../src/campaign/campaign.js';

describe('build-choice points', () => {
  it('a fighter with no choice specified resolves to the default Fighting Style (Dueling)', () => {
    const f = buildCharacter({ classId: 'fighter', team: 'team1', position: { x: 0, y: 0 } });
    expect(f.featureIds).toContain('dueling');
    expect(f.featureIds).not.toContain('archery');
  });

  it('a chosen Fighting Style grants that feature and drops the default', () => {
    const f = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 },
      choices: { 'fighting-style': 'archery' },
    });
    expect(f.featureIds).toContain('archery');
    expect(f.featureIds).not.toContain('dueling');
  });

  it('an unknown choice id falls back to the default rather than granting nothing', () => {
    const f = buildCharacter({
      classId: 'fighter', team: 'team1', position: { x: 0, y: 0 },
      choices: { 'fighting-style': 'nonsense' },
    });
    expect(f.featureIds).toContain('dueling');
  });

  it('a legacy party character with no choices field still builds (defaults apply)', () => {
    const c = newCampaign(7);
    // Simulate an old save: strip any choices that might be present.
    for (const ch of c.characters) delete ch.choices;
    const party = buildCampaignParty(c);
    const fighter = party.find((p) => p.classId === 'fighter')!;
    expect(fighter.featureIds).toContain('dueling');
  });

  it('setPartyChoice flows through to the built combatant', () => {
    const c = newCampaign(7);
    const fi = c.characters.findIndex((ch) => ch.classId === 'fighter');
    expect(setPartyChoice(c, fi, 'fighting-style', 'defense')).toBe(true);
    const party = buildCampaignParty(c);
    const fighter = party.find((p) => p.classId === 'fighter')!;
    expect(fighter.featureIds).toContain('defense');
    expect(fighter.featureIds).not.toContain('dueling');
  });

  it('swapping a slot to a new class clears its old choices', () => {
    const c = newCampaign(7);
    const fi = c.characters.findIndex((ch) => ch.classId === 'fighter');
    const wi = c.characters.findIndex((ch) => ch.classId === 'wizard');
    setPartyChoice(c, fi, 'fighting-style', 'archery');
    // Swap the fighter slot to wizard (role-swap with the existing wizard slot).
    setPartyClass(c, fi, 'wizard');
    expect(c.characters[fi]!.choices).toBeUndefined();
    // The wizard that moved into the old fighter's role must not inherit a style.
    const party = buildCampaignParty(c);
    const anyArchery = party.some((p) => p.featureIds.includes('archery'));
    expect(anyArchery).toBe(false);
    expect(wi).toBeGreaterThanOrEqual(0);
  });
});
