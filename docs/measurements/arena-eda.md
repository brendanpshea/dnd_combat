# Arena EDA

Regenerate: `npm run arena-eda -- 40 --max-days 120 --items --item-fights 60`
Commit: c9336e7 · 2026-07-28

## How to read this

The greedy AI plays both sides. There is no shopping between waves, no potions
bought, no bounties, no re-preparing of spells — all things a player does, and
all things that matter most exactly when a wave is hard. A low number is "look
here", not "this is weak".

Three harness bugs were found and fixed while producing it, each of which had
already produced a confident wrong answer. They are worth stating because the
same shapes will recur:

1. **The retry was a bit-identical replay.** The combat seed was keyed on
   `run.wave`, which a loss does not advance, and the night's long rest restores
   the party exactly — so a stalled run replayed one fight forever. Reported as
   "88% of runs stall". Actually 60%, and the finish rate went 12% -> 40%.
2. **The item A/B ran an unwinnable fight.** Baseline won 4 of 60, and all 27
   trinkets scored exactly +0. A test with no resolution reports "nothing
   matters", which is indistinguishable from a finding.
3. **The item A/B used a level-1 party.** `buildWave`'s level argument shapes the
   ENEMIES; the party came from `newCampaign`, which starts at level 1. Every
   item number was a fact about level 1 wearing the label of a fact about the
   item. Belt of Hill Giant Strength read +12 there and -2 at level 4.

## Headline

Runs finish 40% of the time within 120 days; the median run reaches level 6-7
(the cap is 7). The median per-run win rate is 46%. A run that stalls has hit a
wall it cannot pay its way past — losing awards no XP and no gold, so there is
no grind-out path, only a better roll on the retry.

## The strongest signal in the whole dataset

Summoning items. At a calibrated level-4 fight, given to a SINGLE carrier, the
elemental figurines and braziers are worth +9 to +17 fights out of a possible
+18. Nothing else in 91 items is in that range; the best wondrous item is the
Cloak of Displacement at +7 and most are inside noise.

Two caveats, both real:
  - The baseline wins 70%, leaving only 18 fights of headroom, so these are
    pressed against a ceiling and the true gap may be larger, not smaller.
  - An extra body is worth disproportionately more to a four-creature party than
    it would be to a larger one. It is still a five-versus-four fight.

## What could not be measured

Weapon upgrades. `worn` sits at 0.4-0.8 — fewer than one party member per fight
carries any given weapon, because the test only upgrades a weapon a character
already wields. A +1 longsword held by 0.8 of a party cannot move 60 fights
either way, so every row in that family is inside the noise band. That is a
statement about the experiment, not about the weapons.

## Armour reads negative almost everywhere, and that is correct

Equipping armour REPLACES what the character already wears, and the classes
start in the best armour they are proficient with. So the light-armour rows
(Padded -14, Leather -14, Chain Shirt -14) are the harness correctly measuring a
downgrade, and they are the best evidence available that the A/B works at all.
The upgrades that are genuinely available sit inside noise.

## Full output

```

=== 40 arena runs, party randomized every run (species + class, role-guarded)
finished within 120 days: 16/40 (40%)
spell variety margin: 0.15
stalled (10 losses in a row): 24/40 (60%)
fights 2180 · wins 994 (46%)
per-run win rate: median 46% (finished runs 51%, stalled runs 42%)
level reached: median 6 (stalled runs 5)

--- classes (per fight the class was in)
class          dmg taken  heal downs casts  runs  fin%
Wizard          74    33     0    93     4    16   38%
Ranger          63    34     7    64     2    13   38%
Barbarian       58    63     0    94     0    14   43%
Rogue           57    45     0    89     0    13   15%
Monk            53    49     0   117     1    15   47%
Fighter         48    59     9    86     0    11   36%
Druid           40    49    20    90     5    15   40%
Bard            39    32    20    75     6    16   44%
Paladin         29    47    18    79     3    24   42%
Cleric          22    49    46    75     6    23   48%
  dmg/taken/heal/casts are per fight; downs is per 100 fights;
  fin% is the share of runs reaching the finish line with this class in the party.

--- spells cast (30220 casts)
  Healing Word           L1  4253   Cleric 1401, Druid 1360, Bard 1268
  Poison Spray           L0  3861   Druid 981, Cleric 629, Wizard 562, Monk 420, Paladin 265, Bard 249, Fighter 120, Barbarian 55, Rogue 5, Ranger 2
  Cure Wounds            L1  2015   Cleric 820, Paladin 490, Ranger 273, Druid 167, Bard 2
  Command                L1  1808   Paladin 989, Cleric 354, Bard 311
  Shatter                L2  1663   Bard 997, Wizard 666
  Sleep                  L1  1484   Wizard 712, Bard 705
  Starry Wisp            L0  1462   Bard 652, Druid 490
  Fireball               L3  1073   Wizard 741
  Sacred Flame           L0   991   Cleric 827
  Hold Person            L2   921   Cleric 620, Druid 149, Bard 90
  Breath Weapon          L1   898   Cleric 365, Monk 194, Barbarian 104, Fighter 91, Bard 64, Paladin 60, Ranger 16, Druid 2, Wizard 2
  Spiritual Weapon       L2   891   Cleric 672
  Mass Healing Word      L3   759   Cleric 554, Bard 205
  Magic Missile          L1   755   Wizard 678
  Hunter's Mark          L1   645   Ranger 645
  Shield of Faith        L1   617   Paladin 617
  Bless                  L1   606   Paladin 316, Cleric 199
  Faerie Fire            L1   576   Monk 146, Druid 127, Cleric 85, Ranger 76, Bard 20, Rogue 20, Wizard 16
  Moonbeam               L2   499   Druid 315
  Fire Bolt              L0   454   Wizard 50
  True Strike            L0   373   Cleric 329, Wizard 19, Bard 15, Druid 10
  Vicious Mockery        L0   352   Bard 214
  Ray of Frost           L0   344   Wizard 38
  Divine Smite           L1   325   Paladin 325
  Scorching Ray          L2   324   Wizard 324
  Call Lightning         L3   299   Druid 223
  Animal Friendship      L1   294   Ranger 113, Fighter 69, Paladin 61, Barbarian 21, Bard 9, Wizard 8, Cleric 4, Druid 4, Monk 3, Rogue 2
  Guiding Bolt           L1   278   
  Flaming Sphere         L2   241   
  Confusion              L4   166   Druid 75, Bard 51, Wizard 40
  Shining Smite          L2   152   Paladin 152
  Web                    L2   105   
  Misty Step             L2   103   Wizard 53
  Banishment             L4    90   Cleric 90
  Aid                    L2    72   Cleric 44, Ranger 20, Paladin 8
  Heat Metal             L2    71   
  Ensnaring Strike       L1    62   Ranger 62
  Suggestion             L2    60   
  Entangle               L1    59   Druid 49
  Burning Hands          L1    47   Wizard 23
  Acid Splash            L0    43   
  Spirit Guardians       L3    31   Cleric 25
  Bane                   L1    26   
  Thunderwave            L1    14   Druid 3
  Inflict Wounds         L1    14   Cleric 12
  Lesser Restoration     L2    12   Paladin 11, Ranger 1
  Lightning Bolt         L3    10   
  Blindness              L2     7   
  Shocking Grasp         L0     5   Wizard 5
  Dispel Magic           L3     3   Cleric 3
  Warding Bond           L2     3   Paladin 3
  Protection from Energy L3     3   Cleric 2, Druid 1
  Color Spray            L1     1   

--- never cast (21 of 74 playable combat spells)
  Bestow Curse           L3
  Blight                 L4
  Death Ward             L4
  Dimension Door         L4
  False Life             L1
  Fear                   L3
  Freedom of Movement    L4
  Greater Invisibility   L4
  Haste                  L3
  Ice Storm              L4
  Invisibility           L2
  Mage Armor             L1
  Minor Illusion         L0
  Mirror Image           L2
  Phantasmal Killer      L4
  Protection from Evil and Good L1
  Sanctuary              L1
  Searing Smite          L1
  Shillelagh             L0
  Silence                L2
  Wall of Fire           L4

--- reactions (no spellCast event; counted from their own)
  Counterspell fired 75 times
  Shield is not separable here — it shares Mirror Image's condition event.

--- consumables used
  potion-healing             230
  scroll-magic-missile       18

--- species (runs finished, 40 runs)
  tiefling        21 runs    48%
  gnome           19 runs    47%
  elf             15 runs    47%
  dwarf           19 runs    42%
  orc             12 runs    42%
  human           16 runs    38%
  halfling        19 runs    37%
  dragonborn      21 runs    33%

=== magic items: same fights, item fitted to the party vs nothing
calibrated on wave 6 at party level 4
baseline (nothing added): 42/60 won (70%)
a swing under +/-4 fights is inside the noise at n=60.
"worn" is how many of the four could actually use it — a +0 nobody
could equip is a different finding from a +0 everybody wore.

--- wondrous & rings
  Cloak of Displacement            +7   worn 4.0 *
  Ring of Acid Resistance          +2   worn 4.0
  Boots of the Winterlands         +1   worn 4.0
  Ring of Cold Resistance          +1   worn 4.0
  Ring of Lightning Resistance     +1   worn 4.0
  Ring of Poison Resistance        +1   worn 4.0
  Cloak of Protection              +0   worn 4.0
  Brooch of Shielding              +0   worn 4.0
  Bracers of Archery               +0   worn 4.0
  Gloves of Thievery               +0   worn 4.0
  Ring of Fire Resistance          +0   worn 4.0
  Ring of Necrotic Resistance      +0   worn 4.0
  Ring of Force Resistance         +0   worn 4.0
  Ring of Psychic Resistance       +0   worn 4.0
  Ring of Thunder Resistance       +0   worn 4.0
  Ring of Free Action              +0   worn 4.0
  Necklace of Prayer Beads         +0   worn 1.4
  Gauntlets of Ogre Power          -1   worn 4.0
  Headband of Intellect            -1   worn 4.0
  Bracers of Defense               -1   worn 4.0
  Mantle of Spell Resistance       -1   worn 4.0
  Ring of Radiant Resistance       -1   worn 4.0
  Wand of the War Mage +1          -1   worn 4.0
  Ring of Evasion                  -1   worn 4.0
  Belt of Hill Giant Strength      -2   worn 4.0
  Wand of the War Mage +2          -2   worn 4.0
  Amulet of Health                 -3   worn 4.0

--- armour
  Half Plate +1                    +2   worn 2.4
  Chain Mail                       +0   worn 1.3
  Adamantine Scale Mail            +0   worn 2.4
  Adamantine Splint                +0   worn 1.3
  Adamantine Chain Mail            -1   worn 1.3
  Plate +1                         -1   worn 1.3
  Splint                           -2   worn 1.3
  Scale Mail                       -3   worn 2.4
  Breastplate                      -3   worn 2.4
  Plate                            -3   worn 1.3
  Adamantine Plate                 -3   worn 1.3
  Splint +1                        -3   worn 1.3
  Half Plate                       -4   worn 2.4
  Scale Mail +1                    -4   worn 2.4
  Breastplate +1                   -4   worn 2.4
  Adamantine Half Plate            -5   worn 2.4 *
  Ring Mail                        -7   worn 1.3 *
  Hide                            -11   worn 2.4 *
  Studded Leather                 -12   worn 3.2 *
  Padded                          -14   worn 3.2 *
  Leather                         -14   worn 3.2 *
  Chain Shirt                     -14   worn 2.4 *

--- weapon upgrades
  Vicious Longbow                  +4   worn 0.4
  Vicious Mace                     +2   worn 0.5
  Dagger +1                        +0   worn 0.8
  Longsword +1                     +0   worn 0.8
  Greataxe +1                      +0   worn 0.4
  Shortsword +1                    -1   worn 0.4
  Vicious Greataxe                 -1   worn 0.4
  Vicious Longsword                -1   worn 0.8
  Vicious Dagger                   -1   worn 0.8
  Quarterstaff +1                  -2   worn 0.8
  Mace +1                          -2   worn 0.5
  Longbow +1                       -2   worn 0.4

--- wands, staves & charged
  Censer of Controlling Air Elementals  +17   worn 1.0 *
  Stone of Controlling Earth Elementals  +17   worn 1.0 *
  Bowl of Commanding Water Elementals  +16   worn 1.0 *
  Marble Elephant                 +15   worn 1.0 *
  Brazier of Commanding Fire Elementals  +13   worn 1.0 *
  Staff of the Python             +11   worn 1.0 *
  Bronze Griffon                   +9   worn 1.0 *
  Wand of Fireballs                +8   worn 1.0 *
  Golden Lion                      +3   worn 1.0
  Wand of Magic Missiles           +2   worn 1.0
  Wand of Lightning Bolts          +2   worn 1.0
  Wand of Fear                     +2   worn 1.0
  Wand of Web                      +1   worn 1.0
  Ring of the Ram                  +0   worn 1.0
  Wand of Paralysis                +0   worn 1.0
  Staff of Healing                 +0   worn 1.0
  Wand of Binding                  +0   worn 1.0

  * = outside the noise band.
```
