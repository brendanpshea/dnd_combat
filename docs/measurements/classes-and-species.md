# Every class and every species, in the arena

```
npm run arena-eda -- 300 --give-up 12                  # as the harness has always run
npm run arena-eda -- 300 --give-up 12 --shop --creep   # with the two things it was missing
npm run arena-eda -- 300 --start-level 8 --give-up 12 --random-prep   # the microscope
```

All twelve classes and all eight species exist now, so this is the first
whole-game measurement. 300 randomized parties per configuration, played from
level 1 to the finish line or to a twelve-loss stall.

## What the harness was missing, and who it was costing

The first pass looked like a balance report and was partly an artefact. Two
things the real campaign does were not being done:

**Nobody ever shopped.** The fighter starts in scale mail (base 14) and was
still wearing it at level 8, with plate (18) sitting on a shelf it could afford.

**Nobody ever crept in.** `CombatSetup.surprisedTeam` has existed since combat
was written and `arena/ambush.ts` gives the arena a way to earn it — the harness
never called either. A free round is worth more to a rogue than to anyone: it is
a Sneak Attack with advantage that costs nothing.

Those are not evenly distributed handicaps. They fall on the fighter and the
rogue — which is to say, on exactly the two classes whose first-pass numbers
looked strange.

| | no shop/creep | + shop + creep |
| --- | --- | --- |
| runs finished | 136/300 (45%) | **181/300 (60%)** |
| fights won | 8504 / 20578 (41%) | **9242 / 19777 (47%)** |
| median per-run win rate | 41% | **47%** |
| median level reached | 7 | **8** |

Fewer fights, further along: the party is playing better, not merely longer.

## Classes, with the harness playing the real game

300 runs · 19,777 fights · 265,538 party casts.

| class | dmg | taken | heal | downs/100 | runs | fin% |
| --- | --- | --- | --- | --- | --- | --- |
| Wizard | **82** | 31 | 0 | 79 | 95 | 58% |
| Rogue | 73 | 39 | 0 | 68 | 76 | 54% |
| Barbarian | 65 | **71** | 0 | 93 | 116 | 67% |
| Sorcerer | 64 | 33 | 0 | **60** | 92 | 72% |
| Warlock | 64 | 46 | 0 | 78 | 101 | 51% |
| Ranger | 62 | 36 | 13 | 61 | 95 | 54% |
| Monk | 61 | 44 | 0 | **95** | 94 | 56% |
| Fighter | 60 | 68 | 9 | 85 | 108 | 58% |
| Druid | 43 | 50 | 21 | 81 | 92 | 54% |
| Bard | 34 | 33 | 22 | 66 | 98 | 62% |
| Paladin | 28 | 50 | 21 | 75 | 122 | 51% |
| Cleric | **26** | 54 | **45** | 69 | 111 | **83%** |

### What moved, and by how much

| class | dmg | taken | downs/100 | fin% |
| --- | --- | --- | --- | --- |
| Warlock | +12 | −6 | −13 | +15 |
| Wizard | +12 | −6 | −19 | +14 |
| Rogue | +10 | −6 | −16 | **+16** |
| Ranger | +10 | −4 | −9 | +12 |
| Monk | +10 | −1 | −11 | +15 |
| Druid | +8 | −12 | −25 | +8 |
| Fighter | +7 | **−3** | −11 | +14 |
| Barbarian | +6 | +2 | −3 | **+19** |
| Bard | +6 | −3 | −7 | +14 |
| Cleric | +5 | +1 | −3 | +15 |
| Sorcerer | +4 | −3 | −9 | +18 |
| Paladin | +1 | +1 | −3 | **+18** |

Everything improves, which is what a free surprise round 84% of the time and
better armour ought to do. What matters is the *shape*: the rogue gains the most
finish rate of any non-tank, and the fighter's damage taken finally falls.

### The Cleric

83% finish rate against a 60% baseline, over 111 runs, while dealing the least
damage in the game. It is not close — the next best is the Sorcerer at 72%.

A campaign is 120 days of two fights a day, and the binding constraint is not
how fast anything dies, it is whether the party is still standing on day 90.
Read the damage column as a role axis rather than a power ranking: the Cleric
and the Paladin sit at the bottom of it and hold the top and middle of `fin%`.

### Read `fin%` carefully

It counts runs *containing* the class, and every run contains four heroes. Three
quarters of any row is somebody else. The Cleric's 23-point lead survives that;
a five-point gap between two middling classes does not.

## Species

300 runs, roughly 10,000 hero-fights behind each row.

| species | dmg | taken | heal | downs/100 | runs finished |
| --- | --- | --- | --- | --- | --- |
| orc | **59** | **52** | 11 | **71** | 60% |
| human | 56 | 48 | 10 | 82 | 65% |
| halfling | 56 | 46 | 11 | 76 | **66%** |
| dwarf | 55 | **45** | 13 | 71 | 61% |
| tiefling | 52 | 48 | 12 | 80 | 59% |
| gnome | 52 | 47 | 13 | 74 | 56% |
| elf | 52 | 48 | 12 | 82 | **49%** |
| dragonborn | **50** | **44** | 11 | 74 | 61% |

**Species are nearly flat, and that is the finding.** Nine points separate the
best and worst damage across ten thousand fights each, against a 56-point spread
between classes.

The column with a mechanical story is `taken`. Dragonborn (44) and dwarf (45)
are lowest and both carry damage resistance; orc is highest at 52, which is
Relentless Endurance doing exactly what it says — an orc keeps standing, and a
creature that keeps standing keeps being hit.

A species row averages over whatever classes rolled it. The `taken` differences
are backed by ten thousand fights each and a mechanism; a five-point damage gap
is not something worth defending as a species effect.

## Content coverage

At level 8 with randomized prepared lists, **3 of 79 playable combat spells were
never cast**: Dimension Door, Minor Illusion, Shocking Grasp.

In the level-1 campaign it reads as 10, but most of that is *never prepared*
rather than never chosen — the curated loadout takes the first few spells of
each tier and the rest never leave the shelf. Sanctuary is cast 704 times in the
microscope and 0 in the campaign. That is what `--random-prep` exists to
separate, and the microscope is the honest answer to "will the AI ever pick
this".

Still worth a look: **Haste and Ice Storm at zero in both directions**, and
Polymorph — which was a genuine scoring bug, fixed separately.

## Caveats

- **The shopper buys armour only**, and only heavy and medium classes can use
  the shelf. Warlock, Bard and Rogue are stuck in leather because `SHOP_STOCK`
  has no light-armour upgrade, so the rogue's whole gain here is the creep.
- **The creep is always attempted** where there is cover, rather than judged.
  The harness has no read on whether the gamble is worth it, and inventing one
  would measure a guess instead of the mechanic. It succeeds 84% of the time
  across 19,165 attempts, which is high enough to be a balance question of its
  own: a group Stealth check needs only half the party to pass, against monster
  passive Perception that is mostly 10-13.
- **The AI is the greedy scorer.** A class it plays badly and a class that is
  weak look identical here. The honest reading of a low row is "look here".
