# Implementation Plan: Ranger (Hunter) and Paladin (Devotion)

Classes five and six, levels 1–5, following the SPEC's "mostly data now" bet.
The bet holds: both classes are `ClassData` entries reusing existing spells,
fighting styles, and the choice-point system. What's genuinely new is four
signature mechanics — Hunter's Mark, Colossus Slayer, Lay on Hands, Divine
Smite — and each lands on an engine hook that already exists (condition
riders, per-turn damage bonuses, feature `apply` hooks, passive checks in
`rollDamage`).

## 1. What already works with zero new code

- **Class picker**: the forge iterates `Object.values(CLASSES)`
  (`web/src/Campaign.tsx:271`), so new entries appear automatically.
  `setPartyClass` (`src/campaign/campaign.ts:463`) already handles picking an
  *unoccupied* class (`ownerIdx === -1` just applies) — the party stays four
  members drawn from a six-class pool; no role-model changes.
- **Fighting Styles**: both classes get one at level 2 via the existing
  `ChoicePoint` machinery and the existing style features (archery, defense,
  dueling, great-weapon-fighting, two-weapon-fighting). Zero new feature code.
- **Half-caster spellcasting**: `spellcasting.slotsByLevel` is per-class data;
  the builder and engine don't care that the curve is slower.
- **Extra Attack at 5**: `attacksPerAction` already keys off the feature id.
- **Shared spells**: cure-wounds, bless, command, aid, misty-step,
  animal-friendship all exist and are on the 2024 ranger/paladin lists.
- **Armor/shop gating, skill checks, ASI at 4**: all read class data.

## 2. Class data (`src/data/classes.ts`)

### Ranger — subclass Hunter

```
hitDie 10, saves [str, dex], armor [light, medium, shield]
skillProfs: [stealth, perception]
statPriority: [dex, wis, con, str, int, cha]
spellcasting: wis, slots [[2],[2],[3],[3],[4,2]]   // 2024 half-caster
spellsByLevel: 1: [hunters-mark*, cure-wounds, animal-friendship]
               5: [misty-step]                      // 2nd-level slots arrive
featuresByLevel: 1: []                              // Hunter's Mark IS the L1 identity
                 2: [deft-explorer*]                // grantsSkill only
                 3: [colossus-slayer*]              // Hunter's Prey
                 5: [extra-attack]
choices: fighting-style at 2, default archery
         (options: archery, defense, dueling, two-weapon-fighting)
weaponMasteries: [longbow, longbow-plus1, shortsword, shortsword-plus1]
equipment: longbow main hand, studded-leather; 2 shortswords + potion in pack
```

`*` = new content, detailed below. AC 15, HP 12 at level 1; an archer who
opens with Hunter's Mark and switches to paired shortswords when cornered.

Simplification (SPEC "notable simplifications" material): Favored Enemy's
free slot-less Hunter's Mark casts are dropped at first pass — the mark just
costs a slot. If it feels slot-starved in the arena, the follow-up is to let
classes seed `innateSpells` the way species do (the combatant field and
per-encounter pool machinery already exist; the builder fold is ~5 lines).

### Paladin — subclass Devotion

```
hitDie 10, saves [wis, cha], armor [light, medium, heavy, shield]
skillProfs: [intimidation]                          // persuasion is cleric's
statPriority: [str, cha, con, wis, dex, int]
spellcasting: cha, slots [[2],[2],[3],[3],[4,2]]
spellsByLevel: 1: [bless, cure-wounds, command]     // all exist, all on the 2024 list
               5: [aid]
featuresByLevel: 1: [lay-on-hands*]
                 2: [divine-smite*]                 // Paladin's Smite, simplified
                 3: [sacred-weapon*]                // Devotion's Channel Divinity
                 5: [extra-attack]                  // Faithful Steed: mounts out of scope
choices: fighting-style at 2, default defense
         (options: dueling, defense, great-weapon-fighting)
weaponMasteries: [longsword, longsword-plus1, warhammer, warhammer-plus1]
equipment: longsword + shield + chain-mail; 2 javelins + potion in pack
```

AC 19 with Defense, HP 12 at level 1 — the tankiest kit in the game, paid
for by a spell list that's support-only and slots that fuel smites.

## 3. New content

### 3.1 Hunter's Mark (`src/data/spells.ts` + one hook in attack.ts)

Bonus-action, concentration, 90 ft, level 1. Cast → push a `marked`
condition on the target with `sourceId: casterId` and `concentration: true`
— exactly the shape `guided`/`outlined`/`webbed` already use, so
concentration-break cleanup is free (`Condition.concentration` is already
honoured, `src/engine/types.ts:77`).

The rider lands in `rollDamage` (`src/engine/rules/attack.ts`), next to the
Dueling/Sneak Attack checks: if the *target* has `marked` with
`sourceId === attacker.id`, add `1d6` force per hit. Every hit, not once per
turn — that's RAW and it's what makes the mark worth a bonus action and
concentration. Simplification: the free re-target when the marked target
drops is skipped (recasting costs another slot); noted in SPEC.

### 3.2 Colossus Slayer (`src/data/features.ts` + attack.ts + one turn flag)

Passive: once per turn, +1d8 when the ranger hits a creature that's below
its HP maximum. Checked in `rollDamage`; gated by a new
`turn.colossusUsed` flag reset in `startTurn`, mirroring
`turn.sneakAttackUsed` precisely.

### 3.3 Lay on Hands (`src/data/features.ts`)

Action-trigger feature with an `apply` hook, built like `preserve-life`
(the closest existing feature: an action that spends a pool on healing).
Pool is 5 × level HP. `FeatureData.uses.count` currently allows
`number | 'proficiency'`; extend the union with `'fiveTimesLevel'` (one line
in the builder where `'proficiency'` is already resolved,
`src/builder/character.ts:113`). Each activation heals one ally within
touch range (adjacent), spending up to `min(pool, missing HP)` points —
partial spends decrement `featureUses` by the amount spent rather than by 1,
which `ResourcePool` supports as-is. All healing routes through
`applyHealing`, so it revives the downed like everything else.

### 3.4 Divine Smite (`src/data/features.ts` + attack.ts)

2024 makes this a bonus-action spell cast on hit. The engine resolves
attacks atomically and has no "react to your own hit" prompt, so model it
the way `shield` is auto-cast for defenders: a **passive consulted in
`rollDamage`**. On a melee weapon hit, if the paladin has a slot and its
bonus action is free: consume the lowest slot, mark
`turn.bonusActionUsed = true`, add `2d8` radiant (+1d8 per slot level above
1st; dice doubled on crit like all damage dice).

The bonus-action cost is the balancing lever the 2024 rules intend — it
caps smiting at once per turn and makes smite compete with Healing Word
timing. Auto-smite means the greedy AI needs no new decision, and a player
toggle ("hold smites") can come later if the arena shows slot-burn is bad.
This is the plan's one real judgement call; the alternative (a distinct
`smite` action the player picks pre-attack) adds action-bar surface and AI
plumbing for little sim value.

### 3.5 Sacred Weapon (`src/data/features.ts` + attack.ts)

Bonus-trigger feature, 1/encounter: `apply` pushes a `sacred-weapon`
condition on self (duration: rest of encounter). `rollAttack`
(`attack.ts:186`, next to the Archery +2) adds the paladin's Cha modifier
to weapon attack rolls while the condition holds. Simple, visible in the
log, and it's what makes Devotion feel like Devotion at level 3.

## 4. AI (`src/ai/`)

- `greedy.ts`:
  - `isMeleeFighter` (line 302): `paladin → true`, `ranger → false`.
  - `scoreSpell`: a `hunters-mark` case — value ≈ expected remaining hits ×
    3.5 minus the slot cost, so it's cast early and not re-cast while up.
    `cure-wounds`, `bless`, `command`, `aid`, `misty-step` cases already
    exist. Smite/Colossus/Sacred Weapon are passives or bonus features the
    existing action enumeration already surfaces.
- `simulated.ts`/`evaluate.ts`: **no changes** — the guardrail test forbids
  content ids there. All four mechanics resolve inside `step()`, so the
  simulation prices them for free. Nothing new needs an
  `advantageDice`-style data declaration yet (no new mechanic changes what
  *advantage* is worth).
- Sanity: run `npm run arena` matchups (ranger/paladin vs. the core four at
  L1/3/5) and eyeball win rates before calling balance done.

## 5. Builder, campaign, UI touchpoints

| File | Change |
| --- | --- |
| `src/builder/character.ts` | resolve `'fiveTimesLevel'` uses count |
| `src/builder/names.ts` | `HERO_NAMES`/`RIVAL_NAMES` for both (e.g. Sylva Thornwood / Kael Grimshaw; Ser Roland / Dame Vex) |
| `src/campaign/campaign.ts` | `defaultPortraitFor`: class-portrait map so `ranger → 'elf-archer'`, `paladin → 'dragonborn-paladin'` (both art assets exist; today the fallback is `classId`, which has no art for the new pair) |
| `web/src/blurbs.ts` | one-line class blurbs |
| `src/campaign/campaign.ts` `PARTY_TEMPLATES` | optional: a "Wild Hunt" template showcasing the pair |
| CLI / web battle UI | nothing — action bars, choice-point disclosure, and shop gating are generic |

New portrait art can follow later through the `art/prompts.md` pipeline;
the mapping above ships playable defaults now.

## 6. Tests

- `test/ranger.test.ts`: L1 stats (AC 15, HP 12, 2 slots, longbow kit);
  Hunter's Mark — rider fires per hit, only for the caster, dies with
  concentration; Colossus Slayer — needs a wounded target, once per turn,
  resets next turn; L5 — two attacks, 2nd-level slots, misty-step known.
- `test/paladin.test.ts`: Lay on Hands — pool is 5×level, partial spends
  persist, revives at 0 HP, needs adjacency; Divine Smite — consumes lowest
  slot, +2d8 (doubled on crit), blocked when bonus action already spent,
  stops when slots run dry; Sacred Weapon — +Cha to attack rolls after the
  bonus action, 1/encounter.
- `test/classes.test.ts` / `test/choices.test.ts`: both classes build at
  1–5; fighting-style choice folds; forge can pick an unoccupied class and
  swap an occupied one.
- The `sim-ai.test.ts` guardrail covers the new content ids automatically.
- Determinism: full-battle replay with the new pair on both sides.

## 7. Order of work

1. **Data skeleton** — both `ClassData` entries with only existing
   features/spells, names, blurbs, portrait mapping. Playable immediately
   (ranger shoots with Archery, paladin tanks and blesses); forge, shop,
   CLI, and swap tests land here.
2. **Ranger mechanics** — Hunter's Mark, Colossus Slayer + tests.
3. **Paladin mechanics** — Lay on Hands (uses-count extension first),
   Divine Smite, Sacred Weapon + tests.
4. **AI + balance** — greedy cases, arena runs, tune equipment/defaults if
   a matchup is lopsided.
5. **Docs** — SPEC §4 gains two columns and the simplification notes
   (Favored Enemy free casts, mark re-targeting, auto-smite, no steed);
   roadmap item 1 gets its checkmark.

Steps 2 and 3 are independent of each other; each step leaves the suite
green and the game shippable.
