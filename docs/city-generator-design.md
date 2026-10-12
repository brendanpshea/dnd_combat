# Generated towns

Status: **step 1 built** (`src/adventure/city-gen.ts`). Steps 2–4 are design.
Companion to `dungeon-recipes-design.md`.

## What a town is for

A dungeon generator is about structure under threat: locks, keys, fights,
attrition. A town is about **services, people and leads**: what is for sale,
who keeps the inn, what the temple charges, and what folk say about the old
mine. Combat is occasional. The interesting rolls are the shelves, the faces
and the rumours.

Almost all of the runtime already exists, so the generator writes content and
layout, not engine:

- the free-roam `explore` map (the Hollow Road's square): tappable markers,
  decorative roads, hidden markers found by Perception, gated markers,
  `sceneWhen`;
- `shop` scenes with a stock list and a shopkeeper, haggling and stealing, and
  level-scaled thinning of magical wares;
- `rest` scenes for inns, `dialogue` scenes, the NPC registry and its
  introduction check, and `Module.town` for fast travel.

## Defaults decided

- **One level, 6–15 places.** `MAX_PLACES = 15`: past it, a phone map is a
  mess of markers. Districts pace a bigger town instead of more markers.
- **No time of day yet.** Shops shutting at night and the guild opening only
  after dark is a new runtime feature, deferred.
- **No new services yet.** Healing for gold and paid rooms use existing
  effects. Identification, curse removal, raising the dead and fencing stolen
  goods each touch the item or death systems, and are deferred.
- **Permanent magic is never for sale.** This is the economy's standing rule
  (`isPermanentMagic`): enchanted arms, armour, wands and trinkets are earned,
  not bought. A mage's guild sells scrolls and potions. Tested.

## Step 1, as built

`generateCity(seed, { size, level, venues })`. It follows the delves'
pipeline: spec, layout, contents, module, and the validator as the acceptance
test. Ids are `city-<seed>-<spec>`, so a saved run rebuilds the same town.

**Sizes and districts:**

| Size    | Districts                            | Places |
|---------|--------------------------------------|--------|
| village | green                                | 6–7    |
| town    | market, temple quarter, gate         | 10–11  |
| city    | market, temple quarter, warrens, gate | 12–14  |

Each venue kind has a preferred list of districts (`HOME`) and goes to the
first one the town has. Markers are placed near their district's centre, far
enough apart to read on a phone (`apart`: the map is tall and narrow, so
markers need more room across than down), and clear of the hint bar at the
bottom. Roads join each place to its nearest neighbour in its
district, then each district to the rest, so the town is one connected place
(tested).

**The venue library.** Each venue is a template that writes its own scenes:

| Venue | What it is |
|---|---|
| Inn | Innkeeper dialogue; a paid room (1/2/5 gold by size) leading to a long rest; a rumour table |
| General store | Healing potions, alchemist's fire |
| Smithy (village) | Weapons and armour together |
| Armourer, weaponsmith | Mundane armour; mundane weapons |
| Mage's guild | Every scroll that isn't purely divine, plus non-healing potions |
| Temple | Priest dialogue: healing for 10 × level gold; a shop of cleric and paladin scrolls and healing potions |
| Thieves' guild | A hidden marker (Perception DC 12/13/14 by size); a black-market shelf |
| Notice board, landmarks | Flavour (step 2 turns them into leads) |
| Gate | The road out |

A city stocks every ware the game sells somewhere in it (tested). Proprietors
and names come from small tables.

On the dev delve card: **🏘️ New village / town / city**.

**What the browser found:** plain 12-point spacing put an armourer's long
name on top of the guild's marker, the same landmark could appear twice, and
the lowest marker's label sat under the hint bar. All three are fixed and
tested: spacing by screen shape, shorter names, landmarks never repeated, and
markers kept off the bottom edge.

**The bug the tests found first:** `classScrollPool` returns spell ids, not
scroll item ids. Matched against scroll ids, the mage's guild stocked no
scrolls at all, only potions. It now matches on the scroll's own spell.

## Step 2: author control and leads

- **NPC placement:** `{ npc, at: venue kind | district | node id, when? }`.
  Placed NPCs are real cast members with the introduction check. A placed NPC
  replaces a venue's generated proprietor, or stands at their own marker.
- **Custom markers:** authored nodes with their own scenes, pinned to a
  district, optionally hidden or gated. The town's version of required rooms.
- **Custom encounters:** street fights by district (pickpockets in the market,
  thugs in the warrens) and authored set fights.
- **Rumours and leads:** rumours drawn from the town's own facts (its
  factions, history, nearby dungeons), handing out journal `lead` entries. A
  lead may point at an authored scene or a generated delve.

## Step 3: composition

- Generalise `Module.delves` into generated places of both kinds, reusing the
  roll, the namespacing, the flags in and out, and `validateLive`.
- Towns link to delves: the sewers, the catacombs under the temple, the mine
  the rumour was about.

## Step 4: factions, consequences, economy

- **Town factions:** the watch and the guild. **Reputation:** theft gets
  noticed.
- **Measure the economy:** can a level-N party, on what a delve pays, afford a
  meaningful upgrade without buying its way out of difficulty? The delve
  simulator already tracks gold.
