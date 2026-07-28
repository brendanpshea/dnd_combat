# Spell variety A/B

Regenerate: `npm run arena-eda -- 60 --max-days 120 --variety N`
Commit: 93aacdf · 2026-07-28

## Question

`chooseAction` is a hard argmax, so a caster in a given situation casts the same
spell every time. Does picking uniformly among spells within a margin of the
best cost win rate — and does it buy any variety?

## Answer

It is free, and it buys almost nothing. The margin fires (it changes the pick on
5.6% of spell turns at 0.15) but the aggregate histogram does not move, because
the sameness is caused by large score gaps rather than by near-ties. The thing
that would move it is the flat `slotCost`, not this.

| margin | finished | win rate (median per run) | spells cast | top-5 share | effective variety |
| --- | --- | --- | --- | --- | --- |
| 0 (old argmax) | 24/60 | 45% | 53 | 43% | 17.6 |
| 0.15 (default) | 21/60 | 46% | 53 | 44% | 16.5 |
| 0.30 | 24/60 | 44% | 54 | 43% | 17.3 |

"Effective variety" is inverse-Simpson over the cast counts — the number of
spells the distribution behaves like. At n=60 runs the finished column carries
about +/-6 points of noise, so 21 vs 24 is not a difference.

## Full output, margin 0

```

=== 60 arena runs, party randomized every run (species + class, role-guarded)
finished within 120 days: 24/60 (40%)
spell variety margin: 0
stalled (10 losses in a row): 36/60 (60%)
fights 3471 · wins 1547 (45%)
per-run win rate: median 45% (finished runs 53%, stalled runs 41%)
level reached: median 7 (stalled runs 6)

--- classes (per fight the class was in)
class          dmg taken  heal downs casts  runs  fin%
Wizard          69    32     0    92     4    24   33%
Ranger          61    35     8    64     2    23   43%
Barbarian       54    61     0    90     0    23   35%
Rogue           54    39     0    83     0    26   19%
Monk            50    44     0   107     1    24   46%
Fighter         48    64     9    95     0    17   35%
Druid           43    51    20    94     5    21   33%
Bard            37    31    18    69     5    22   36%
Paladin         28    47    18    78     3    31   42%
Cleric          21    50    43    70     6    29   69%
  dmg/taken/heal/casts are per fight; downs is per 100 fights;
  fin% is the share of runs reaching the finish line with this class in the party.

--- spells cast (43817 casts)
  Healing Word           L1  5921   Druid 2099, Cleric 1778, Bard 1665
  Poison Spray           L0  4477   Druid 1307, Wizard 709, Cleric 682, Monk 481, Paladin 250, Fighter 213, Bard 146, Barbarian 73, Ranger 21, Rogue 1
  Cure Wounds            L1  2922   Cleric 1090, Ranger 694, Paladin 581, Druid 259, Bard 7
  Command                L1  2726   Paladin 1665, Cleric 484, Bard 373
  Shatter                L2  2605   Bard 1579, Wizard 1026
  Starry Wisp            L0  2317   Bard 919, Druid 840
  Sleep                  L1  2130   Wizard 1153, Bard 909
  Hold Person            L2  1667   Cleric 1019, Druid 304, Bard 270
  Fireball               L3  1523   Wizard 1017
  Sacred Flame           L0  1467   Cleric 1170
  Breath Weapon          L1  1415   Cleric 455, Monk 248, Barbarian 219, Paladin 197, Fighter 109, Bard 93, Ranger 65, Rogue 19, Druid 5, Wizard 5
  Hunter's Mark          L1  1348   Ranger 1348
  Spiritual Weapon       L2  1327   Cleric 1029
  Mass Healing Word      L3  1325   Cleric 955, Bard 370
  Magic Missile          L1  1167   Wizard 1081
  Faerie Fire            L1  1116   Monk 238, Ranger 196, Rogue 171, Druid 150, Cleric 68, Paladin 38, Bard 24, Wizard 7
  Shield of Faith        L1   902   Paladin 902
  Bless                  L1   829   Paladin 356, Cleric 226
  Call Lightning         L3   696   Druid 552
  Fire Bolt              L0   590   Wizard 62
  Scorching Ray          L2   514   Wizard 514
  True Strike            L0   459   Cleric 420, Bard 30, Druid 8, Wizard 1
  Animal Friendship      L1   455   Ranger 219, Fighter 95, Barbarian 53, Paladin 46, Bard 12, Wizard 11, Druid 10, Cleric 4, Rogue 3, Monk 2
  Moonbeam               L2   443   Druid 327
  Vicious Mockery        L0   404   Bard 220
  Flaming Sphere         L2   397   
  Ray of Frost           L0   370   Wizard 15
  Shining Smite          L2   350   Paladin 350
  Guiding Bolt           L1   327   
  Confusion              L4   269   Druid 114, Bard 81, Wizard 74
  Divine Smite           L1   231   Paladin 231
  Misty Step             L2   146   Wizard 69
  Banishment             L4   142   Cleric 142
  Web                    L2   115   
  Suggestion             L2    94   
  Spirit Guardians       L3    89   Cleric 81
  Aid                    L2    81   Cleric 59, Ranger 13, Paladin 9
  Ensnaring Strike       L1    67   Ranger 67
  Entangle               L1    61   Druid 56
  Heat Metal             L2    58   
  Bane                   L1    56   
  Burning Hands          L1    54   Wizard 33
  Thunderwave            L1    40   Druid 5
  Protection from Energy L3    37   Cleric 36, Druid 1
  Inflict Wounds         L1    20   Cleric 16
  Blindness              L2    17   
  Lesser Restoration     L2    16   Paladin 13, Ranger 3
  Acid Splash            L0    14   
  Warding Bond           L2    11   Paladin 11
  Lightning Bolt         L3     7   Wizard 2
  Color Spray            L1     1   
  Dispel Magic           L3     1   Cleric 1
  Shocking Grasp         L0     1   Wizard 1

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
  Counterspell fired 185 times
  Shield is not separable here — it shares Mirror Image's condition event.

--- consumables used
  potion-healing             362
  scroll-magic-missile       26

--- species (runs finished, 60 runs)
  orc             21 runs    57%
  halfling        26 runs    50%
  human           23 runs    39%
  tiefling        29 runs    38%
  gnome           27 runs    37%
  elf             22 runs    36%
  dwarf           31 runs    35%
  dragonborn      29 runs    34%
```

## Full output, margin 0.15

```

=== 60 arena runs, party randomized every run (species + class, role-guarded)
finished within 120 days: 21/60 (35%)
spell variety margin: 0.15
stalled (10 losses in a row): 39/60 (65%)
fights 3210 · wins 1444 (45%)
per-run win rate: median 46% (finished runs 50%, stalled runs 41%)
level reached: median 6 (stalled runs 5)

--- classes (per fight the class was in)
class          dmg taken  heal downs casts  runs  fin%
Wizard          69    32     0    92     4    24   33%
Ranger          60    34     8    65     2    23   30%
Barbarian       57    61     0    92     0    23   35%
Rogue           54    41     0    85     0    26   15%
Monk            50    46     0   109     1    24   42%
Fighter         45    58     9    90     0    17   24%
Druid           40    48    20    88     5    21   38%
Bard            37    32    20    72     6    22   45%
Paladin         27    45    18    78     3    31   39%
Cleric          21    50    46    75     6    29   45%
  dmg/taken/heal/casts are per fight; downs is per 100 fights;
  fin% is the share of runs reaching the finish line with this class in the party.

--- spells cast (41065 casts)
  Healing Word           L1  5754   Druid 1920, Bard 1805, Cleric 1704
  Poison Spray           L0  4941   Druid 1441, Cleric 764, Wizard 703, Monk 525, Paladin 267, Bard 249, Fighter 189, Barbarian 55, Ranger 20, Rogue 5
  Cure Wounds            L1  2748   Cleric 1006, Paladin 639, Ranger 537, Druid 240, Bard 6
  Command                L1  2408   Paladin 1326, Bard 442, Cleric 423
  Shatter                L2  2402   Bard 1400, Wizard 1002
  Starry Wisp            L0  2169   Bard 1002, Druid 715
  Sleep                  L1  2094   Wizard 1036, Bard 983
  Fireball               L3  1533   Wizard 983
  Breath Weapon          L1  1228   Cleric 433, Barbarian 212, Monk 194, Paladin 168, Fighter 91, Bard 64, Ranger 49, Rogue 9, Druid 5, Wizard 3
  Sacred Flame           L0  1217   Cleric 1006
  Hunter's Mark          L1  1189   Ranger 1189
  Hold Person            L2  1177   Cleric 762, Druid 230, Bard 120
  Spiritual Weapon       L2  1127   Cleric 837
  Magic Missile          L1  1106   Wizard 996
  Mass Healing Word      L3  1011   Cleric 697, Bard 314
  Faerie Fire            L1   930   Druid 173, Monk 168, Ranger 138, Rogue 116, Cleric 101, Paladin 46, Bard 20, Wizard 16
  Shield of Faith        L1   817   Paladin 817
  Bless                  L1   778   Paladin 374, Cleric 250
  Moonbeam               L2   682   Druid 430
  Fire Bolt              L0   624   Wizard 66
  Vicious Mockery        L0   479   Bard 270
  Ray of Frost           L0   455   Wizard 49
  True Strike            L0   431   Cleric 386, Wizard 19, Bard 15, Druid 11
  Scorching Ray          L2   422   Wizard 422
  Call Lightning         L3   396   Druid 294
  Guiding Bolt           L1   396   
  Divine Smite           L1   363   Paladin 363
  Animal Friendship      L1   341   Ranger 146, Fighter 76, Paladin 61, Barbarian 26, Bard 10, Wizard 8, Cleric 4, Druid 4, Monk 3, Rogue 3
  Flaming Sphere         L2   312   
  Confusion              L4   256   Druid 120, Bard 86, Wizard 50
  Shining Smite          L2   175   Paladin 175
  Misty Step             L2   130   Wizard 69
  Web                    L2   127   
  Banishment             L4   123   Cleric 123
  Heat Metal             L2    96   
  Aid                    L2    92   Cleric 57, Ranger 26, Paladin 9
  Suggestion             L2    84   
  Ensnaring Strike       L1    81   Ranger 81
  Entangle               L1    79   Druid 67
  Burning Hands          L1    58   Wizard 28
  Bane                   L1    58   
  Acid Splash            L0    43   
  Spirit Guardians       L3    39   Cleric 32
  Thunderwave            L1    23   Druid 4
  Inflict Wounds         L1    22   Cleric 16
  Lesser Restoration     L2    13   Paladin 11, Ranger 2
  Lightning Bolt         L3    10   
  Blindness              L2     7   
  Protection from Energy L3     6   Cleric 5, Druid 1
  Shocking Grasp         L0     6   Wizard 6
  Dispel Magic           L3     3   Cleric 3
  Warding Bond           L2     3   Paladin 3
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
  Counterspell fired 126 times
  Shield is not separable here — it shares Mirror Image's condition event.

--- consumables used
  potion-healing             331
  scroll-magic-missile       26

--- species (runs finished, 60 runs)
  halfling        26 runs    42%
  orc             21 runs    38%
  tiefling        29 runs    38%
  gnome           27 runs    37%
  elf             22 runs    36%
  human           23 runs    35%
  dragonborn      29 runs    34%
  dwarf           31 runs    29%
```

## Full output, margin 0.30

```

=== 60 arena runs, party randomized every run (species + class, role-guarded)
finished within 120 days: 24/60 (40%)
spell variety margin: 0.3
stalled (10 losses in a row): 36/60 (60%)
fights 3236 · wins 1456 (45%)
per-run win rate: median 44% (finished runs 52%, stalled runs 40%)
level reached: median 7 (stalled runs 5)

--- classes (per fight the class was in)
class          dmg taken  heal downs casts  runs  fin%
Wizard          65    32     0    93     4    24   33%
Barbarian       59    61     0    88     0    23   39%
Rogue           56    38     0    80     0    26   23%
Ranger          54    35     9    67     2    23   30%
Monk            51    46     0   108     1    24   46%
Fighter         49    64     9    99     0    17   35%
Druid           39    49    22    90     5    21   38%
Bard            32    34    20    75     5    22   45%
Paladin         28    44    16    77     3    31   39%
Cleric          22    49    45    72     6    29   66%
  dmg/taken/heal/casts are per fight; downs is per 100 fights;
  fin% is the share of runs reaching the finish line with this class in the party.

--- spells cast (40404 casts)
  Healing Word           L1  5731   Druid 2004, Cleric 1782, Bard 1709
  Poison Spray           L0  3886   Druid 1062, Cleric 678, Monk 593, Wizard 307, Paladin 233, Fighter 233, Bard 66, Barbarian 42, Rogue 2, Ranger 2
  Cure Wounds            L1  2590   Cleric 1038, Ranger 521, Paladin 453, Druid 298, Bard 6
  Shatter                L2  2547   Bard 1403, Wizard 1144
  Command                L1  2448   Paladin 1387, Cleric 532, Bard 433
  Sleep                  L1  2268   Wizard 1155, Bard 1045
  Starry Wisp            L0  2260   Druid 999, Bard 796
  Fireball               L3  1666   Wizard 929
  Sacred Flame           L0  1409   Cleric 1223
  Breath Weapon          L1  1249   Cleric 448, Monk 227, Paladin 187, Barbarian 165, Fighter 92, Bard 57, Ranger 54, Rogue 9, Druid 8, Wizard 2
  Hold Person            L2  1170   Cleric 683, Druid 260, Bard 158
  Hunter's Mark          L1  1116   Ranger 1116
  Spiritual Weapon       L2  1113   Cleric 962
  Mass Healing Word      L3  1055   Cleric 660, Bard 395
  Magic Missile          L1  1017   Wizard 886
  Faerie Fire            L1   928   Monk 215, Druid 180, Ranger 105, Rogue 101, Cleric 87, Bard 32, Paladin 22, Wizard 16
  Bless                  L1   842   Paladin 411, Cleric 293
  Shield of Faith        L1   776   Paladin 776
  Moonbeam               L2   737   Druid 484
  Vicious Mockery        L0   647   Bard 462
  Fire Bolt              L0   605   Wizard 134
  Animal Friendship      L1   507   Ranger 244, Fighter 93, Paladin 70, Barbarian 66, Bard 15, Cleric 7, Wizard 3, Monk 3, Rogue 3, Druid 3
  Ray of Frost           L0   437   Wizard 103
  Divine Smite           L1   408   Paladin 408
  True Strike            L0   408   Cleric 345, Druid 28, Bard 25, Wizard 10
  Call Lightning         L3   336   Druid 225
  Scorching Ray          L2   260   Wizard 260
  Shining Smite          L2   250   Paladin 250
  Confusion              L4   232   Bard 99, Druid 92, Wizard 41
  Guiding Bolt           L1   230   
  Misty Step             L2   174   Wizard 93
  Flaming Sphere         L2   167   Druid 6
  Web                    L2   159   
  Banishment             L4   120   Cleric 120
  Burning Hands          L1    92   Wizard 63
  Aid                    L2    87   Cleric 58, Ranger 18, Paladin 11
  Heat Metal             L2    74   
  Entangle               L1    72   Druid 64
  Ensnaring Strike       L1    46   Ranger 46
  Spirit Guardians       L3    43   Cleric 37
  Suggestion             L2    41   
  Thunderwave            L1    35   Druid 3
  Bane                   L1    30   
  Inflict Wounds         L1    28   Cleric 22
  Acid Splash            L0    25   
  Lesser Restoration     L2    17   Paladin 13, Ranger 4
  Protection from Energy L3    17   Cleric 17
  Protection from Evil and Good L1    13   Paladin 13
  Blindness              L2    13   
  Lightning Bolt         L3     9   Wizard 1
  Shocking Grasp         L0     7   Wizard 7
  Dispel Magic           L3     4   Cleric 3, Druid 1
  Warding Bond           L2     2   Paladin 2
  Wall of Fire           L4     1   Druid 1

--- never cast (20 of 74 playable combat spells)
  Bestow Curse           L3
  Blight                 L4
  Color Spray            L1
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
  Sanctuary              L1
  Searing Smite          L1
  Shillelagh             L0
  Silence                L2

--- reactions (no spellCast event; counted from their own)
  Counterspell fired 175 times
  Shield is not separable here — it shares Mirror Image's condition event.

--- consumables used
  potion-healing             379
  scroll-magic-missile       26

--- species (runs finished, 60 runs)
  halfling        26 runs    54%
  gnome           27 runs    48%
  orc             21 runs    48%
  dwarf           31 runs    42%
  human           23 runs    39%
  tiefling        29 runs    38%
  elf             22 runs    36%
  dragonborn      29 runs    34%
```

