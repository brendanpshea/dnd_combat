# The Free Company

A solo, browser-based tactical RPG built on the D&D SRD 5.2.1 — a headless,
deterministic rules engine with data-driven content, an expected-value AI, and
a mobile-first React front end.

**▶ Play: https://brendanpshea.github.io/dnd_combat/** — free, no account,
installable to a phone home screen, works offline.

> This work includes material from the System Reference Document 5.2.1
> ("SRD 5.2.1") by Wizards of the Coast LLC, available at
> <https://www.dndbeyond.com/srd>, licensed under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode).
> Not affiliated with or endorsed by Wizards of the Coast.

## What's in it

| | |
| --- | --- |
| Classes | 12 (levels 1–9) |
| Ancestries | 8 |
| Spells | 94 — cantrips through 5th level |
| Monsters | 146, of which 16 cast spells |
| Authored encounters | 63 |
| Weapons / items / features | 226 / 103 / 152 |
| Maps | 11 hand-built across 6 themes, plus a generator |

Those numbers come from `src/data/`; [docs/reference/](docs/reference/README.md)
lists every one of them and is regenerated from the data rather than written by
hand.

Real d20 rules: advantage and disadvantage, opportunity attacks, cover,
concentration and its Constitution saves, conditions, weapon masteries, spell
slots and preparation, hit dice, terrain and hazards, forced movement, hiding,
and an inventory with equipment slots and free-interaction weapon draws.

## The three ways to play

The app opens on three things, in this order.

**Learn the basics.** A two-minute guided battle — move, attack, win. No setup,
no party building.

**The story campaign.** A three-chapter trilogy that takes one company from 1st
to 5th, each chapter a complete evening with its own region and bestiary:

1. **The Hollow Road** (1–3) — break the Ashfang raiders, through a village hub,
   a marsh crossed node by node, and their den.
2. **The Sunken Barrows** (3–4) — the victory's bill comes due: the Reedwife was
   the Undercrypt's jailer, and the barrows are opening.
3. **The Wyrmcalling** (4–5) — her sisters wake the Calling stone, and the hills
   answer with wyrms, giants and elementals.

Finishing a chapter offers **"Continue the company"** — the same party, XP, gold
and gear walk into the next. Each also stands alone behind a cold-start level
floor. Chapters thread combat with inline skill checks, branching choices that
pay off in epilogues, a journal of quests and leads, explore maps that reveal as
you push in, camps you can rest at (safely in town, at a risk in the wild), and
shops. Tapping any item or spell opens an **ⓘ info card** — derived stats and a
plain-English blurb.

**The arena.** An endless run of fights generated on the spot, on maps generated
on the spot, against every monster in the game. It is structured as a series of
**days**:

- A day holds **two fights**, morning and afternoon. Between them the party
  takes a lunch that spends hit dice; overnight, a full rest.
- Each fight begins at **the gate**, where three **doors** are offered. A door
  names its map, its difficulty, the monsters behind it, and a **prize** with a
  condition attached — *"Catch three enemies in one spell"*, *"Use a potion,
  scroll or flask"* — so the choice is a plan, not a coin flip.
- Before fighting you can walk the day's steps: **Spells** (prepare, and cast
  the pre-fight buffs that belong before a fight rather than during one),
  **Stall** (a level-appropriate shop, with haggling and theft), **Gear**, and
  **Doors**.
- Somebody can attempt a **lore check** on the roster, or the party can **creep
  in** for position — both rolled by whoever is best at it.
- **A defeat ends the day, not the run.** The party is picked up, the night
  passes, and tomorrow holds the same two fights, frozen at the level they were
  met at. The healers take a cut for it; the first defeat of a run is free.

Difficulty is **measured, not guessed**: `EVEN_BUDGET` is the adjusted-XP figure
at which a standard party wins about half its fights, found by simulating
generated encounters against the AI. Waves open well under an even fight and
cross it around wave six, so a run ends where the player finds its end.

Two traps a naive budget check walks into, both handled. Raw XP understates a
crowd — five creatures get five turns to the party's four — so fights are
budgeted against 5e's headcount-adjusted XP and paid out at the raw sum. And
drafting greedily by "biggest that still fits" collapses every fight into one or
two heavyweights, so headcount is chosen before any monster is.

> Two older modes — the 34-battle **Classic Ladder** and a configurable **Quick
> Battle** — still exist and still pass their tests, but are reachable only in a
> dev build. `import.meta.env.DEV` gates them, so the bundler drops them from the
> shipped app entirely.

## Quick start

```bash
npm install
npm test          # 2108 tests across 137 files
npm run web       # the app at http://localhost:5173
```

## Terminal front end

The same engine drives a terminal UI. It is a development and debugging tool
rather than the product, but it is complete and it stays in the test suite.

```bash
npm start                                  # hot-seat battle, random map
npm start -- --p2 ai                       # you vs the AI
npm start -- --p1 ai --p2 ai               # spectate an AI mirror match
npm start -- --encounter goblins           # party vs monsters
npm start -- --level 3 --encounter ogre    # a level-3 party vs the boss
npm run campaign                           # the 34-battle ladder
npm run adventure                          # a story module, headless
```

| Flag | Values | Effect |
| --- | --- | --- |
| `--seed <n>` | any integer | Deterministic: same seed + same actions = same game |
| `--map <id>` | `open` `ruins` `marsh` `firepit` `corridor` `village` `grove` `thicket` `bog` `pass` `cliff` | Battle map (random if omitted) |
| `--level <n>` | `1`–`5` | Party level (both sides in a mirror match) |
| `--species <ids>` | four comma-separated ids | Species for Fighter, Wizard, Cleric, Rogue |
| `--encounter <id>` | 63 rosters — see `ENCOUNTERS` in `src/data/encounters.ts` | Fight monsters instead of a mirror party |
| `--p1 ai`, `--p2 ai` | | Let the AI play that team |
| `--ai <level>` | `easy` `normal` `hard` | AI strength |
| `--new`, `--auto` | (campaign only) | Restart / let the AI play the party |

Cells are named chess-style (`c4`), and menus are generated from the engine's
legal-action list, so an illegal move is never offered.

```
      a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
  8 |   | F2| W2|   | C2|   | R2|   |   F/W/C/R = party (1 = team 1, 2 = team 2)
  7 |   |###|   |~~~|   |^^^|   |   |   ### wall  ~~~ difficult  ^^^ hazard
```

## Project layout

```
src/
  data/       all content: classes, spells, features, weapons, armor, items,
              monsters, encounters, maps, adventure modules
  engine/     pure rules engine: grid, dice, turn loop, actions, events,
              rules/ (attack, movement, cover, saves, hide, estimate…)
  builder/    class + level + gear -> combatant
  ai/         greedy expected-value player, plus a sampling policy
  arena/      generated encounters, generated maps, run and day state
  campaign/   party, stages, shop, loot, skill checks, save parsing
  adventure/  story modules: pure runtime, scene types, validator, headless runner
  ui/cli/     terminal renderer and loops
web/          React app: board, battle, camp, shop, arena, adventure screens
test/         vitest suites, including full AI-vs-AI completion runs
docs/         SPEC.md (architecture and rules scope), reference/ (generated),
              module-writing-guide.md
art/          the image pipeline (Python): framing, silhouettes, token fill
scripts/      measurement and generation tools (see below)
```

The engine is headless and deterministic: a `(seed, actions[])` pair replays a
battle exactly. Every driver — both front ends and both AIs — goes through the
same `legalActions` / `step` contract. See [docs/SPEC.md](docs/SPEC.md) for the
architecture and the rules scope.

## Derived, not hand-kept

Several things here are generated from a source of truth and checked in CI,
because a hand-kept list beside the thing it describes drifts silently in both
directions — a declared id with no file draws a broken image, and a file nobody
declares ships in the bundle and is never shown.

```bash
npm run reference             # docs/reference/*.md    <- src/data/
npm run art-registry          # web/src/art-registry.ts <- web/public/art/
python3 art/token_fill.py     # web/src/token-fill.ts   <- the token images
```

Each takes `--check` and fails when stale, and the suite runs them that way, so
adding a monster and forgetting to regenerate is a test failure rather than a
quiet inconsistency. Dropping `portrait-<id>.webp` and `token-<id>.webp` into
`web/public/art` and regenerating makes an id live; there is nothing else to
edit.

## Rules source

The full SRD is vendored at [`SRD_CC_v5.2.1.txt`](SRD_CC_v5.2.1.txt) (1.4 MB of
plain text) and is the authority for every rule, spell and stat block here.
Check against it rather than from memory — two spells were once wrong in ways
that read as deliberate balance choices (Ice Storm hailed 2d8 where the book
says 2d10; Spirit Guardians neither scaled with its slot nor halved Speed).

## Development

```bash
npm test               # everything
npm run test:watch     # watch mode
npm run typecheck      # engine + CLI
npm run web:typecheck  # web app
npm run web:build      # production bundle into dist-web/
```

Pushes to `main` deploy to GitHub Pages via Actions, gated on the suite.

Content is data-driven: adding a monster, spell, weapon, item, map or story
scene is a data edit, never an engine change. Story modules in particular are
pure data interpreted by a pure runtime — see
[docs/module-writing-guide.md](docs/module-writing-guide.md).

### Measuring instead of guessing

Design questions here get answered with numbers, and the tools that produce them
are checked in so the answers can be re-derived rather than remembered.

```bash
npm run probe           # ~3s: does the AI still play sensibly?
npm run arena -- 80     # ~30s: is it stronger? (160 seeded mirror matches)
npm run chooser-load    # what the action chooser really offers, over 60 battles
npm run arena-even      # the XP budget at which a party wins half its fights
npm run board-sheet     # render every map theme to one page
```

The two AI tools answer different questions and neither substitutes for the
other; skipping the slow one is how a nine-point regression nearly shipped.
`probe` runs tactical set-pieces with an obvious right answer and prints what
the AI did — instant, deterministic, and it tells you *why* something changed.
`arena` plays seeded mirror matches and is the authority on strength.

**Mind the noise.** A win rate off N games carries a standard error of about
`sqrt(0.25/N)` — ±7 points at 50 games, ±4 at 160 — and the arena prints it. Two
readings inside about 2 SE are the same reading.

> **Naming note:** `npm run arena` is the *AI benchmarking* tool, unrelated to
> the arena game mode, which lives in `src/arena/`.
