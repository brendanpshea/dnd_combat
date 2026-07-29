# Measurements

Output from the simulation harnesses, committed so a finding can be argued with
rather than remembered.

**These are snapshots, not derived files.** Everything else under `docs/` is
regenerated from the data and checked in CI; these are not, because they are a
record of what the game did on a particular day at a particular commit. A stale
one is still a true statement about the commit named in its header — which is
the point of keeping it.

Regenerate with the command printed at the top of each file. Numbers will not
match exactly: the parties are randomized and the confidence bands are quoted in
the reports for that reason.

| File | Harness | What it answers |
| --- | --- | --- |
| `arena-eda.md` | `npm run arena-eda -- 40 --items` | Class performance, spell usage, species, and a 91-item A/B over randomized parties |
| `spell-variety.md` | `npm run arena-eda -- --variety N` | Whether randomizing spell choice among near-ties costs win rate |
| `classes-and-species.md` | `npm run arena-eda -- 300 --give-up 12 --shop --creep` | All twelve classes and eight species, and what the harness was missing |
| `sorcerer.md` | `npm run arena-eda -- 60 --start-level 8 --give-up 12 --random-prep` | Where the sorcerer lands, and whether Quickened Spell is ever chosen |

## Reading them honestly

Every one of these is the *greedy AI* playing, with no shopping, no potions
bought between waves and no re-preparing of spells. A low number is "look
here", not "this is weak". Where a harness cannot support a claim, the report
says so rather than rounding the claim down.
