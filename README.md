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
gear progression, and eight combat-relevant species: Human, Dwarf, Wood Elf,
Orc, Dragonborn, Abyssal Tiefling, Gnome, and Halfling.

Hide is a DC 15 Dexterity (Stealth) action available only outside every
enemy's line of sight. A hidden creature cannot be directly targeted, gains
advantage on its next attack, and becomes visible when it attacks or casts a
spell. Enemies can reveal a hidden creature at the start of their turns when
they can see it and their advantaged passive Perception beats its Hide result.
Rogues and goblins can Hide as a bonus action.

## Quick start

```bash
npm install
npm test          # 300 deterministic engine, campaign, AI, and UI tests
npm run web       # web UI (mobile + desktop) at http://localhost:5173
npm start         # terminal battle: hot-seat human vs human, random map
npm run campaign  # terminal campaign: 11-battle ladder with XP, leveling, loot
```

## Web UI

React + Vite, no external art — CSS board, emoji tokens, inline SVG icon,
WebAudio-synthesized sound. Main menu offers **Campaign** (progress persists
in localStorage) and **Single battle** (hot-seat / vs AI / AI spectate /
monster encounters, with map/level/seed selection).
Choose a species for each party member before a skirmish; player-versus-player
and spectated mirror matches use the same lineup on both teams. Campaign
mode begins with a dedicated party forge: name each adventurer, select species,
swap among the four class roles, and choose an authored portrait. The selected
portrait is used for the party card and the live battlefield token; all of that
identity persists with the save. Campaigns keep one Fighter, Wizard, Cleric,
and Rogue for a balanced starting kit, so choosing an occupied class swaps the
two members' roles and standard gear.

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
| `--encounter <id>` | `goblins` `wolves` `undead` `ogre` `bandits` `spiders` `crypt` `kobolds` `raiders` `wilds` `cult` | Fight monsters instead of a mirror party |
| `--p1 ai`, `--p2 ai` | | Let the greedy AI play that team |
| `--new`, `--auto` | (campaign) | Restart the campaign / let the AI play the party |

Encounters have suggested party levels (goblins/wolves 1, undead/bandits/spiders 2, ogre/crypt 3);
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

An 11-battle ladder ordered easy → hard (Kobold Warren up to the Ogre finale).
The party **earns XP and levels up** (1 → 3) as it goes — level is derived from
accumulated XP, not fixed per stage, so progression is gradual and you can end
up under-leveled for a tough fight (the UI warns you). **Treasure is generated
from each encounter's XP**: gold scales with the fight, and bigger fights roll
more items from higher rarity tiers (the finale guarantees a rare drop).
Between battles: shop (consumables, weapons, armor, +1 magic weapons — armor
purchases are proficiency-gated), manage equipment, haggle or steal, then
fight. Consumables spent in battle stay spent; weapon swaps and remaining HP
persist. The shop offers unrestricted testing rests: a **short rest** restores
half of every hero's maximum HP, while a **long rest** fully restores HP. Defeat
ends the campaign and deletes the save (there's also a reset/delete option).
Healing consumables and the cleric's **Cure Wounds** can also be used in the
shop: inventory sources stay in the Pack, while store-usable spells appear in
a separate Spells row. Select the source, then select the party member to
heal. Potions and scrolls are consumed; Cure Wounds uses no encounter-only
spell slot there.
Wizards can summon an owl with **Find Familiar** from the store Spells row.
The familiar persists through unconsciousness and rests, and grants advantage
on the wizard's first melee or spell attack roll each combat round.
Wizards can also cast **Mage Armor** in the store or combat. It sets AC to
$13 + \text{Dexterity modifier}$ while unarmored and remains active until the
next long rest.
New campaigns begin at the party forge; names, species, class roles, and
portrait choices are locked in when the campaign begins and travel with the
party through every battle.
Seeded runs are reproducible end to end — battles, skill checks, treasure, and
XP alike.

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

### Working on the AI

Two tools, answering different questions. Use both — neither substitutes for the
other, and skipping the slow one is how a 9-point regression nearly shipped.

```bash
npm run probe                          # ~3s: does it still play sensibly?
npm run arena -- 80                    # ~30s: is it stronger? (160 games)
npm run arena -- 80 hard --samples 8   # sweep a preset without editing it
npm run arena -- 20 normal --serial    # in-process, for debugging one game
```

`probe` runs tactical set-pieces with an obvious right answer and prints what
the AI did — instant, deterministic, and it tells you *why* something changed.
`arena` plays seeded mirror matches against the greedy policy and is the
authority on strength, sharded across cores.

**Mind the noise.** A win rate off N games carries a standard error of about
`sqrt(0.25/N)` — ±7 points at 50 games, ±4 at 160 — and the arena prints it.
Two readings inside ~2 SE are the same reading. Before believing an improvement,
re-run it on more games, paired against baseline on the same seeds.
