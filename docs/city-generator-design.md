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
| town    | market, temple quarter, gatehouse         | 10–11  |
| city    | market, temple quarter, warrens, gatehouse | 12–14  |

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

## Step 3, as built: towns in stories, and the delves under them

**`Module.towns`**, beside `Module.delves`: `{ spec, onLeave, reads?,
exports? }` by the scene id the story links to. One splice now serves both
kinds of generated place (`embed.ts`, `splice`):

- the place's door becomes the story's scene, and everything else lives under
  `<scene>/`;
- the place's endings reroute straight to the story's scenes (a town's road
  out to `onLeave`);
- a beating inside lands inside.

The run's roll, `liveModule`, the save reload and `validateLive` all cover
towns too.

**What a town in a story can do that one on its own cannot:**

- **Lead on into the story.** `CustomPlace.way` adds a choice from the
  place to one of the story's scenes, most often a delve's door. The demo's
  sewer grate does this.
- **Read story flags.** `when` on people and places, and leads closed by
  story flags. A flag the town reads must be in `reads`, or the splice
  renames it into the town and it is never set. `validateLive` says so by
  name.
- **Be returned to.** A delve's `onWin` may name `<town>/city`, so the party
  climbs back out onto the town's map, not through its gate again.

**What building it found:**

- **The splice renamed `flag` but not a lead's `resolvedBy`.** A lead closed
  by one of the town's own places waited forever on a name nothing set.
  `resolvedBy` is now renamed with the flags (tested with a town-closed lead;
  the demo's story-closed lead could not show it).
- **`gate` was both a venue and a district.** "At the gate" meant the venue
  when the author meant the district. The district is now `gatehouse`.
- **People at a gate, notice board or landmark** had nowhere to stand (the
  code would have crashed). They are now refused, with the reason.
- **The cast check refused the first draft.** It put "Harbourmaster Wrenna"
  on the map before anyone had met her. People with a marker take a `title`
  ("The Harbourmaster") shown until met.

**The demo**, *The Drowned Tunnels* (`src/data/modules/town-story.ts`, dev
card):

1. A written arrival leads into a generated port.
2. The harbourmaster gives a lead.
3. A grate in the market leads down into a generated undead-held delve.
4. Winning it sets a story flag that closes the lead and brings a priest out
   to thank you.
5. The written ending knows which way it went.

A test plays it through from arrival to ending on three seeds.

## Step 4, as built: theft noticed, and the economy measured

**Theft was unbounded.** Stealing is once per shop visit (Stealth and Sleight
of Hand against DC 13; caught, a 50 gold fine), but a visit ended at the door.
Walk out, walk back in, try again. Measured in generated towns: 60–68% of
tries succeed, for an item worth 86–124 gold at list price. That is about +40
gold of value a try, for ever, and a town has six shops.

**Now, in the runtime (every shop, written or generated):**

- **Caught, you are barred** from that shop for good. At the door you are
  turned straight back out.
- **The run counts it** in `caught-stealing`, the one flag the runtime sets
  itself (`CAUGHT_STEALING`).
- **Bounded.** A shop now yields about 1.5–2 items before it catches you,
  and then never again.
- **The validator** counts `caught-stealing` as written wherever there is a
  shop, so a written story may read it.
- **The splice** never renames it, so a town inside a story sees the same
  count the runtime keeps.

**In a generated town:**

- **Caught twice, the watch is at the gate.** Pay a fine (75 × level), or
  fight them (guards and veterans at a room fight's budget). Either way the
  count is cleared.
- **The thieves' guild is now a conversation**, not a bare shelf: its wares,
  and, for anyone with a name to clear, 40 × level gold to clear it. That is
  always cheaper than the watch, or nobody would go.

**The economy, measured** (`scripts/delve-sim.ts` now records it). What one
delve pays a careful party, in coin plus loot at the half-price shops pay:

| Level | 1   | 2     | 3     | 4     | 5     |
|-------|-----|-------|-------|-------|-------|
| Pays  | 744 | 1,218 | 2,685 | 3,088 | 4,430 |

**What that says:**

- **The town's services are not where the economy bites.** An inn room is
  1–5 gold, and temple healing 10 × level: 1–3% of a delve. That is by design.
  Healing at the temple does not spend a day as a rest does, which is what it
  is for in a story with a clock, and resting should not be a tax.
- **The watch's fine was too small to matter.** At 25 × level it was 1–3% of
  a delve, so theft cost nothing to walk away from. It is now 75 × level,
  about a tenth of a delve.
- **The spending is on wares:** scrolls (50–1,000), potions, and mundane
  armour up to plate (1,500). A level-2 delve buys half-plate; plate is a
  level-5 purchase, which is where the rarity tiers already put it.
  Permanent magic stays unbuyable.

## After step 4: night, a travelling name, thrown out on the spot

**Thrown out on the spot.** Caught stealing, the party is walked out of the
shop by the runtime, the same way Leave does, instead of standing at a counter
that will not serve it.

**Night** (`NIGHT`, a second runtime-owned flag):

- set by waiting for nightfall at an inn, and cleared by every dawn (a long
  rest), or by sitting up by the fire until morning, so a party with no coin
  for a room is never stuck in the dark;
- after dark the shops are shuttered and the thieves' guild answers its door
  only then; the temple, the inn and the gate keep no hours;
- the map title says it is night;
- never renamed by a splice: one sky over a story and its towns.

**A name for theft travels.** `caught-stealing` carries into the next chapter
with the company, so its towns have heard.

**Not done, and why.** Identification, curse removal and raising the dead
have nothing to act on in this game as it stands. No item is ever
unidentified, no curse outlasts a fight, and nobody stays dead: every hero and
companion is read back at 1 HP or more after a won fight, and a wipe revives
the party. Each service needs its system first (unidentified magic loot,
lasting curses, death that sticks). That is a decision about the game, not
about towns.

## Names

Generated people, places and leaders are named by `src/adventure/names.ts`:
order-3 character Markov chains, one per style (elvish, saxon, norse, isles,
courtly, alley, hearth, gaelic, germanic, slavic, sorcery), trained on
corpora in `src/data/names/` drawn from classic and modern fantasy plus
historical Celtic, Germanic and Slavic names. Filters refuse corpus names,
near-copies of famous names, unsayable shapes and a short blocklist. A place
picks one style, so a town sounds like one town; names never repeat within
it. Only people the player can talk to are named. Bosses get an epithet, and
beast leaders get a growl name. Preview: `?dev=names`.
