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

## Step 2, as built: author control and leads

Four additions to `CitySpec`.

**`people`** (`PlacedPerson`): a name, what they say, and where they are.

- **At an inn or a temple**, they are someone to talk to there: a "Talk to"
  choice placed before the venue's way out. With `keeps`, they run it instead.
- **At a shop**, they run it. A shop has no one else to talk to, so a lead
  there is refused.
- **In a district**, they get a marker of their own.
- **`lead`** is a journal lead, given once. **`when`** is a list of story
  flags ('flag', or '!flag' for not set) that decides whether they are there.

**`places`** (`CustomPlace`): an authored marker with its own text, in a
district, optionally hidden (Perception DC) or gated (`when`).

- **`fight`** is fought on the way in, once; after that the place is just the
  place.
- **`loot`** is taken once.
- **`sets`** is a flag set whichever way the party leaves. It is what closes a
  lead that pointed there. The first cut set it only on "Walk on", so taking
  the loot left the lead open forever. Tested.

**`rumours`**: the author's rumours, told first by the first inn (only the
first: a rumour told at two inns is two leads for one thing). Each may carry a
lead.

**`streets`** (default on for towns and cities): footpads, drawn from the
bandit faction at a room fight's budget, on one marker (town) or two (city)
in the rough districts. Never at the gate, never on a hidden marker, fought on
the village battle map. A town with a fight in it gets somewhere to come to
after a beating.

**Refused up front, with the reason:**

- a person in a district the town does not have;
- a person at a venue the town does not have;
- a shopkeeper with a lead;
- two people or places of one name;
- an unknown encounter or item;
- more than 15 markers;
- a lead whose closing flag no place sets;
- a `when` flag nothing in the town sets. Until towns sit inside stories
  (step 3), the town's own flags are the only flags there are.

**Layout, again.** The browser showed that labels, not markers, are what
collide: a three-line name ("Temple of the Watchful Eye", "The Wandering
Anchor") runs into the marker below it, and the topmost marker sat under the
town's name. Fixes:

- markers are placed by searching a grid for the free spot nearest the
  district's centre, so a crowded city still fits (rerolls fell from 2.4 per
  city to 0.1);
- they are kept clear of every edge;
- names are kept to 20 characters (tested). The longest in 900 towns is 19.

On the dev card, an object in the JSON box is the rest of the town's spec.
The town is built before the save slot is cleared, so a mistyped spec does not
cost a run.

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
