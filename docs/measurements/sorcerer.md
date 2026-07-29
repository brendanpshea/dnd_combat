# Sorcerer: Font of Magic and Quickened Spell

```
npm run arena-eda -- 60 --start-level 8 --give-up 12 --random-prep
```

60 randomized-party arena runs started at level 8 — a microscope, not a balance
run. 867 fights, 48% won, 52/60 finished.

## Does the class play?

| class | dmg/fight | taken | downs/100 | casts | fin% |
| --- | --- | --- | --- | --- | --- |
| Rogue | 108 | 63 | 0 | 73 | 79% |
| Barbarian | 92 | 97 | 1 | 85 | 76% |
| Fighter | 83 | 100 | 16 | 86 | 94% |
| Warlock | 82 | 69 | 2 | 66 | 100% |
| Monk | 78 | 57 | 1 | 82 | 85% |
| Druid | 78 | 87 | 23 | 94 | 95% |
| Ranger | 72 | 56 | 25 | 63 | 78% |
| Bard | 72 | 50 | 21 | 65 | 91% |
| Wizard | 68 | 43 | 2 | 78 | 80% |
| **Sorcerer** | **65** | **45** | **1** | **54** | **94%** |
| Paladin | 34 | 82 | 35 | 82 | 77% |
| Cleric | 33 | 76 | 59 | 63 | 96% |

The sorcerer lands next to the wizard, which is the honest place for it: same
slot table, a subset of the same spell list. It takes slightly *more* damage
than the wizard (45 vs 43) on a d6 hit die, which is Draconic Resilience doing
its job — AC 10 + Dex + Cha at level 8 is 17, and without it the class would be
the softest target on the board.

Its `fin%` (94%) is the second-highest in the table, but that column is a party
statistic, not a class one: it counts runs *containing* the class, and 17 runs
is not enough to separate it from the wizard's 20. Do not read a 14-point gap
there as a finding.

## Is Quickened ever chosen?

78 uses across 867 fights — roughly one every eleven fights, on:

```
Command 31, Ray of Sickness 22, Magic Missile 10, Blindness 5,
Breath Weapon 2, Shatter 2, Thunderwave 2, Mage Armor 1,
Invisibility 1, Scorching Ray 1, False Life 1
```

Cheap leveled spells, which is right: the sorcerer spends its action on the big
one and quickens whatever else it is still holding. Fireball is absent from the
list for the same reason — it is what the action was spent on.

## The measurement that changed the design

The first version let the AI quicken anything with a casting time of an action,
cantrips included, on the theory that `scoreSpell` would sort it out.

```
quickened  258   Poison Spray 236, Ray of Frost 14, Fire Bolt 4, Acid Splash 3, Magic Missile 1
```

**236 of 258 uses were a cantrip** — two sorcery points, a quarter of a level-8
sorcerer's daily pool, for about five hit points. That is the always-chosen half
of the modifier bug this codebase has hit six times: the scorer prices what a
spell *does* and has no term at all for the points, so anything above zero wins.

The fix is a stated policy rather than an invented price — `legalActions` offers
Quickened for leveled spells only. A constant for "what a sorcery point is
worth" would have been a seventh guess with nothing behind it. `isLegalAction`
is unchanged, so a *player* may still spend two points on a Fire Bolt.

## And a bug it surfaced

Ray of Sickness was reachable only through a tiefling's innate casting and the
wizard's `learnableExtra` until the sorcerer put it on a class list. It was
implemented as `${2 + slotLevel}d8` with a Constitution save for the Poisoned
rider, hung off the generic save-ends mechanism.

The SRD says 2d8 at 1st level (+1d8 per level *above* 1st, so `1 + slotLevel`),
and applies Poisoned on a hit with **no save at all**, lasting until the end of
the caster's next turn. The off-by-one had been invisible while nothing could
reach the spell; once the sorcerer could, it became the second most-cast leveled
spell in the game at a third more damage than it is entitled to. Fixed, with the
scoring case rewritten to match.
