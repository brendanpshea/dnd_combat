# dnd_combat

A grid-based D&D 5.5e (SRD 5.2.1) tactical combat game for the terminal, with a
headless rules engine, data-driven content, and a greedy AI opponent.

Two teams fight on an 8×8 board: the classic party of four (Fighter, Wizard,
Cleric, Rogue — levels 1–3, one subclass each) against a mirror party or an
SRD monster encounter (goblins, wolves, undead, or an ogre). Real d20 rules:
advantage/disadvantage, opportunity attacks, concentration, conditions, weapon
masteries, spell slots, terrain, forced movement, and inventory (equipment
slots, weapon swapping, healing potions, scrolls, alchemist's fire).

## Quick start

```bash
npm install
npm test          # 130+ engine tests
npm start         # terminal battle: hot-seat human vs human, random map
npm run web       # web UI (mobile + desktop) at http://localhost:5173
```

### Play modes

```bash
npm start -- --p2 ai                       # you vs the AI
npm start -- --p1 ai --p2 ai               # spectate an AI mirror match
npm start -- --encounter goblins           # party vs monsters (AI-run)
npm start -- --level 3 --encounter ogre    # level-3 party vs the boss fight
npm run campaign                           # persistent 4-battle campaign
```

### Campaign mode

`npm run campaign` runs a persistent ladder: Goblin Warband → Wolf Pack →
Restless Dead → Ogre, leveling from 1 to 3 along the way. Between battles you
shop (potions, scrolls, alchemist's fire) with gold from victories and loot;
consumables spent in battle stay spent. Progress saves to
`campaign-save.json` after each victory (`--new` restarts, `--auto` lets the
AI play the party, `--seed n` for a deterministic run). Defeat ends the
campaign and deletes the save.

### Flags

| Flag | Values | Effect |
| --- | --- | --- |
| `--seed <n>` | any integer | Deterministic battle; same seed + same actions = same game |
| `--map <id>` | `open` `ruins` `marsh` `firepit` `corridor` | Battle map (random if omitted) |
| `--level <n>` | `1` `2` `3` | Party level (both sides in PvP) |
| `--encounter <id>` | `goblins` `wolves` `undead` `ogre` | Fight monsters instead of a mirror party |
| `--p1 ai`, `--p2 ai` | | Let the greedy AI play that team |

Encounters have suggested party levels (goblins/wolves 1, undead 2, ogre 3);
the CLI warns on a mismatch.

### Reading the board

```
      a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
  8 |   | F2| W2|   | C2|   | R2|   |    F/W/C/R = party (1 = team 1, 2 = team 2)
  7 |   |###|   |~~~|   |^^^|   |   |    g/G/s/w/z/O = goblin/boss/skeleton/wolf/zombie/ogre
                                          ### wall   ~~~ difficult   ^^^ fire hazard
```

Cells are named chess-style (`c4`). Menus are generated from the engine's
legal-action list, so an illegal move is never offered.

### Web UI

`npm run web` serves a touch-friendly battle screen (React + Vite, no external
assets — CSS board, emoji tokens). Pick mode (hot-seat / vs AI / spectate /
encounter), map, level, and seed on the start screen. Legal moves are painted
onto the board: tap a tinted cell to move, a red-ringed enemy to attack (a
chooser pops up when several weapons/spells reach), green rings for heals.
Area spells enter a pick-a-cell mode; Magic Missile-style spells accumulate
target taps. `npm run web:build` produces a static bundle in `dist-web/`.

## Project layout

```
src/
  data/      # all content: classes, spells, features, weapons, armor, monsters, maps
  engine/    # pure rules engine: grid, dice, turn loop, actions, combat events
  builder/   # class + level -> combatant construction
  ai/        # greedy expected-value player (same Action API as the CLI)
  ui/cli/    # terminal renderer and hot-seat loop
test/        # vitest suites, including full AI-vs-AI battle completion tests
docs/SPEC.md # design document
```

The engine is fully headless and deterministic: a `(seed, actions[])` pair
replays a battle exactly. See [docs/SPEC.md](docs/SPEC.md) for the architecture
and rules scope.

## Development

```bash
npm test            # run all tests
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
```

Content is data-driven: adding a monster, spell, weapon, or map is a data-file
edit (`src/data/`), never an engine change.
