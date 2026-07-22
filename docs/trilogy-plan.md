# The Reedwife's Debt — a 1→5 campaign in three modules

The Hollow Road was designed (and plays well) as a tight L1→3 adventure.
Taking a company from 1 to 5 *naturally* on the SRD curve needs ~26,000 total
encounter XP for a party of four — roughly five times what one ~2-hour module
holds. Rather than bloat The Hollow Road into an 8-hour mega-module, the
campaign is a **trilogy**: three modules, each a complete evening with its own
region, bestiary slice, and climax, linked by **party continuation**
(`Module.sequel` — a victory ending carries the same `CampaignState` into the
next part). Milestone `xpToLevel` effects remain as per-module *floors*, not
the engine of leveling: a party that fights what the module offers levels
honestly, and the floor only catches a maximally fight-avoidant run.

The XP arithmetic that shapes everything (SRD thresholds, per-character award
= encounterXP / 4):

| Part | Band | XP needed / char | Encounter XP needed | Fights (approx) |
| --- | --- | --- | --- | --- |
| 1 The Hollow Road | 1→3 | 900 | ~3,600 required (+~2,300 optional exists) | ~12 |
| 2 The Sunken Barrows | 3→4 | 1,800 | ~7,200 | 7–9 |
| 3 The Wyrmcalling | 4→5 | 3,800 | ~15,200 | 10–12 |

## Part 1 — The Hollow Road (shipped)

L1→3, the Ashfang arc. Densified with three optional side fights (the mill's
cockatrices, the sunken barrow's specters — a deliberate Part-2 foreshadow —
and the webbed thicket) so a fight-most run reaches L3 before the boss without
the milestone firing. When Part 2 ships, set `sequel: 'sunken-barrows'` on the
module.

## Part 2 — The Sunken Barrows (L3→4, shipped)

**Hook.** The Reedwife was not merely squatting in the marsh — she was
*feeding* on something beneath it, and her feeding kept it asleep. With her
dead, the barrows that stud the deep fen begin to open. Thornwick's own
graveyard goes wrong first. The reeve, who now owes the company twice, pays a
third time.

**Shape.** Village hub (Thornwick again — familiar, now recovering, shops
restocked) → the deep fen (traversal map, barrow field) → the Undercrypt (a
proper dungeon traversal, the module's den-equivalent). Three acts like Part 1.

**Bestiary slice** (the undead/guardian shelf, almost none of it used yet):

| Fight | Encounter | XP | Notes |
| --- | --- | --- | --- |
| Graveyard gone wrong | `shadow-ambush` + reskin intro | 200 | cold open, teaches undead |
| The drowned chapel | `temple` | 650 | corrupt priest arc |
| Wisp-lights | `wisp-bog` | 1,100 | the fen's false guides |
| Gargoyle lychgate | `gargoyle-perch` | 900 | the Undercrypt's door |
| The serpent pool | `snake-pit` | 900 | optional |
| Barrow-wights | `wight-tomb` | 800 | required spine |
| The embalmed king | `mummy-crypt` | 800 | required spine |
| Finale: the Worm's chosen | `cult` | 1,100 | fanatic + armor + ghouls at the seal |

Required spine ≈ 5,550; with either optional ≈ 6,450–7,350 → lands L4 at or
just before the finale; `xpToLevel: 4` floor on the finale win.

**Payoff threads from Part 1.** `saved-scout` → Wren is the fen guide NPC;
`vex-turned` → Vex holds Thornwick's gate during the crisis (a beat, and his
arc continues); the Part 1 barrow side-fight is referenced as the first crack.

## Part 3 — The Wyrmcalling (L4→5, shipped)

**Hook.** What slept under the barrows was never the real debt-holder. The
Reedwife's two sisters come to collect what the company "owes" the coven — by
calling down every hungry thing in the hills: wyrmlings whistled from their
dens, giants promised a valley, elementals pulled through the seams the
Undercrypt's seal no longer holds.

**Shape.** A war-camp hub (the valley musters) → the high hills (traversal:
dragon dens, giant steadings — the company *picks its battles* to weaken the
final muster) → the Calling stone (finale). More open than Parts 1–2: several
mid fights are genuinely optional, but the finale scales in story (not
mechanics) with what was left standing.

**Bestiary slice** (the top shelf):

| Fight | Encounter | XP | Notes |
| --- | --- | --- | --- |
| The coven's envoys | `hag-coven` | 750 | the sisters' opening move |
| Manticore toll-cliff | `manticore-cliff` | 800 | optional |
| Boar-runs / high passes | `boar-stampede` | 900 | optional |
| Green wyrm den | `green-dragon-den` | 500 | den raids — pick your dragons |
| Blue wyrm mesa | `blue-dragon-den` | 775 | |
| Red wyrm forge | `red-dragon-den` | 1,150 | |
| The clutch together | `chromatic-clutch` | 1,350 | if dens were skipped |
| The ogre-mage's warband | `oni` | 1,650 | required spine |
| The giants' steading | `giants` | 1,650 | required spine |
| Stone sentinel | `gorgon-maze` | 1,800 | optional, telegraphed hard |
| Unbound elemental | `water-vortex` / `earth-tremor` | 1,800 | seam-leaks, 1–2 required |
| Finale: the Calling | `elemental-cataclysm` | 3,600 | fire + earth at the stone |

Required spine ≈ 10,500; typical run ≈ 13,000–16,000 → L5 at or just before
the finale; `xpToLevel: 5` floor on the finale win. (L5 is `MAX_LEVEL` — the
campaign ends at the cap, fighting the biggest encounter in the data.)

## Mechanics status

- `Module.sequel` + `Module.levelBand` — **shipped** (typed, menu badge,
  victory-ending "Continue the company" button, registry-link test).
- Party continuation — **shipped**: `startAdventure(existingCampaign, sequel)`
  carries party/XP/gold/gear; story flags deliberately do not carry (each
  module owns its flag namespace; cross-part payoffs re-derive from the
  carried campaign or are re-established in an opening beat).
- Cold starts — **shipped** as an XP floor: each sequel's opening choice
  carries `xpToLevel` to its band's start (a no-op for continuing parties).
  Fresh parties keep starting gear + an early gold grant, and shop up in the
  hub. Cross-part payoffs are re-established in opening beats (Wren, Vex, and
  the sisters recur without needing carried flags).

**Whole-arc measurement** (random-policy headless runs, fight-everything):
20/20 companies complete all three modules in sequence, L1 → the L5 cap,
final XP median ~6,700. Per-module: Part 2 continuing companies pass L4
honestly in 60/60 runs; Part 3 random policies split roughly half honest-L5 /
half floored (random play skips optional dens — deliberate den-raiding
clears 6,500 without the floor).

## Authoring checklist per part

Follow docs/module-writing-guide.md, plus: budget the XP table *first*; give
every act a fight-free path with the milestone floor as its safety net; guard
every reward node with a `sceneWhen` done-beat (the anti-farm shape); a
distinct encounter roster per fight; validate + headless-run in the suite with
a pacing-band test like Part 1's.
