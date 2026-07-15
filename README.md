# dnd_combat

A grid-based D&D 5.5e (SRD 5.2.1) tactical combat game with a headless,
deterministic rules engine, data-driven content, a greedy AI opponent, and two
frontends: a terminal CLI and a mobile-friendly web app.

**▶ Play it now: https://brendanpshea.github.io/dnd_combat/** (installable as a
phone app — Add to Home Screen; works offline).

Two teams fight on an 8×8 board: the classic party of four (Fighter, Wizard,
Cleric, Rogue — levels 1–3, one subclass each) against a mirror party or an
SRD monster encounter (goblins, wolves, undead, or an ogre). Real d20 rules:
advantage/disadvantage, opportunity attacks, concentration, conditions, weapon
masteries, spell slots, terrain, forced movement, and inventory (equipment
slots, weapon swapping, healing potions, scrolls, alchemist's fire). A
persistent campaign mode adds shops (with haggling and theft), random loot,
gear progression, and four combat-relevant species: Human, Dwarf, Wood Elf,
and Orc.

Hide is a DC 15 Dexterity (Stealth) action available only outside every
enemy's line of sight. A hidden creature cannot be directly targeted, gains
advantage on its next attack, and becomes visible when it attacks or casts a
spell. Enemies can reveal a hidden creature at the start of their turns when
they can see it and their advantaged passive Perception beats its Hide result.
Rogues and goblins can Hide as a bonus action.

## Quick start

```bash
npm install
npm test          # 140 engine tests
npm run web       # web UI (mobile + desktop) at http://localhost:5173
npm start         # terminal battle: hot-seat human vs human, random map
npm run campaign  # terminal campaign: persistent 4-battle ladder
```

## Web UI

React + Vite, no external art — CSS board, emoji tokens, inline SVG icon,
WebAudio-synthesized sound. Main menu offers **Campaign** (progress persists
in localStorage) and **Single battle** (hot-seat / vs AI / AI spectate /
monster encounters, with map/level/seed selection).
Choose a species for each party member before a skirmish; player-versus-player
and spectated mirror matches use the same lineup on both teams. Campaign
species can be chosen on the party cards before the first battle and persist
with the save.

In battle, legal actions are painted onto the board: tap a tinted cell to
move (tokens slide), a red-ringed enemy to attack (a confirm chooser always
shows what you're committing to), green rings for heals. Area spells enter a
pick-a-cell mode; Magic Missile-style spells accumulate target taps. Damage
floats color-coded by type, death animations, sound effects (mutable 🔊), and
an adjustable AI speed (🐢/🐇). The combat log tells the story in English.

The campaign screen handles shopping, equipment management (proficiency-
checked), giving items between characters, and the shop skill gambits:
haggle via Persuasion/Intimidation/Deception, or steal with Stealth +
Sleight of Hand — rolled by whoever in the party is best at it.

`npm run web:build` produces a static bundle in `dist-web/`; pushes to `main`
auto-deploy it to GitHub Pages via Actions (gated on the test suite).

## Terminal CLI

```bash
npm start -- --p2 ai                       # you vs the AI
npm start -- --p1 ai --p2 ai               # spectate an AI mirror match
npm start -- --encounter goblins           # party vs monsters (AI-run)
npm start -- --level 3 --encounter ogre    # level-3 party vs the boss fight
npm start -- --species dwarf,elf,orc,human # Fighter, Wizard, Cleric, Rogue
npm run campaign                           # campaign (saves to campaign-save.json)
```

| Flag | Values | Effect |
| --- | --- | --- |
| `--seed <n>` | any integer | Deterministic battle; same seed + same actions = same game |
| `--map <id>` | `open` `ruins` `marsh` `firepit` `corridor` | Battle map (random if omitted) |
| `--level <n>` | `1` `2` `3` | Party level (both sides in PvP) |
| `--species <ids>` | four comma-separated species IDs | Fighter, Wizard, Cleric, Rogue species; `human,human,human,human` by default |
| `--encounter <id>` | `goblins` `wolves` `undead` `ogre` | Fight monsters instead of a mirror party |
| `--p1 ai`, `--p2 ai` | | Let the greedy AI play that team |
| `--new`, `--auto` | (campaign) | Restart the campaign / let the AI play the party |

Encounters have suggested party levels (goblins/wolves 1, undead 2, ogre 3);
the CLI warns on a mismatch.

```
      a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
  8 |   | F2| W2|   | C2|   | R2|   |    F/W/C/R = party (1 = team 1, 2 = team 2)
  7 |   |###|   |~~~|   |^^^|   |   |    g/G/s/w/z/O = goblin/boss/skeleton/wolf/zombie/ogre
                                          ### wall   ~~~ difficult   ^^^ fire hazard
```

Cells are named chess-style (`c4`). Menus are generated from the engine's
legal-action list, so an illegal move is never offered.

## Campaign mode

A persistent ladder: Goblin Warband → Wolf Pack → Restless Dead → Ogre,
leveling from 1 to 3. Between battles: shop (consumables, weapons, armor,
+1 magic weapons — armor purchases are proficiency-gated), manage equipment,
haggle or steal, then fight. Victories roll weighted loot tables (gold plus
item draws; the ogre can drop +1 weapons and half plate). Consumables spent
in battle stay spent; weapon swaps persist. Defeat ends the campaign and
deletes the save. Seeded runs are reproducible end to end — battles, skill
checks, and loot alike.

## Project layout

```
src/
  data/      # all content: classes, spells, features, weapons, armor, items, monsters, maps
  engine/    # pure rules engine: grid, dice, turn loop, actions, combat events
  builder/   # class + level + gear -> combatant construction
  ai/        # greedy expected-value player (same Action API as both UIs)
  campaign/  # meta-game: party, stages, shop, loot, skill checks, save parsing
  ui/cli/    # terminal renderer, battle loop, campaign loop
web/         # React app: board, battle screen, campaign screens, effects, sound
test/        # vitest suites, including full AI-vs-AI battle completion tests
docs/SPEC.md # design document
.github/     # CI: test + build + deploy to GitHub Pages on push to main
```

The engine is fully headless and deterministic: a `(seed, actions[])` pair
replays a battle exactly. Both frontends and the AI drive it through the same
`legalActions`/`step` contract. See [docs/SPEC.md](docs/SPEC.md) for the
architecture and rules scope.

## Development

```bash
npm test               # run all tests
npm run test:watch     # watch mode
npm run typecheck      # engine + CLI
npm run web:typecheck  # web app
npm run web:build      # production bundle
```

Content is data-driven: adding a monster, spell, weapon, item, or map is a
data-file edit (`src/data/`), never an engine change.
