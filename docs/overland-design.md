# Overland generator

A county to walk across: a city near its middle, towns and villages round
it, roads between, terrain under it all. `src/adventure/overland.ts`.

## Step 1 (built): the default county

- **Scale.** 20 miles across, 40 down (a day's walk by two); a phone held
  upright shows it whole. Terrain in 2-mile squares, 10 × 20.
- **Ground first.** Two layers of smooth noise (height, wetness), shaped by
  the kind of land (`valley`, `coast`, `hills`, `forest`, `marsh`), give
  plain, forest, hills, marsh and mountain. A river runs down the county (on
  a coast, from the hills to the sea) through the low ground.
- **Places as a county grows them.** The city near the middle, on the water
  (a ford or the shore); two towns 7–14 miles out, spread round it; six
  villages a morning's walk (3.5–7.5 miles) from anything.
- **Roads.** The cheapest network that joins them (walking cost by terrain:
  marsh and hills slow, mountains and sea all but closed), plus up to three
  short straight roads that cross no other. A road over the river gets a
  ford, bridge or ferry; a leg over 7 miles a waystop by its ground (wayside
  inn, forest shrine, watchtower, causeway).
- **Play.** A traversal map: the South Road in, the next places revealed as
  you walk. Every town is a full generated town (city-gen), named by the
  map, spliced in like a story's town (`Module.towns`).
- **Proof.** In parts: the county with each town a stub, and each town on
  its own. Whole, nine towns' flags overrun the reachability search.

## Step 2 (built): built round a story

`LandSpec.places` names what the story needs; the map is built round them,
and a spec it cannot honour is refused at once, saying why.

- **Kinds:** `city`, `town`, `village` (whole generated towns, with their
  own `town` spec), `delve` (a spec delve, spliced in like a story's; its
  theme from its ground), `place` (a story scene), `camp`.
- **`terrain`, `far`:** the ground it stands on; at least so many miles
  from the city.
- **`via`:** reached only through another place. It hangs off that place
  alone, lies beyond it from the city, nearer it than anything else; and a
  ridge is drawn round it, open only toward its gate, so the map says why.
- **`after`:** closed (padlocked, with the author's `note`) until the party
  has been to that place, or — a delve — won it (`won-<id>`).

**Fewer settlements, more wild.** City, two towns, three villages: enough
to shop and rest, not so many they repeat. The rest is wild: two delves
and three **camps** (`camps`), one band each of whoever lives on that
ground — bandits, goblins, kobolds, gnolls, lizardfolk. Some fight on
sight; some let you sit at the fire and tell you something; you cannot
tell from the road. Beaten, a camp is cold ashes and some coin.

**Rivers.** A road over the river gets a ford, bridge or ferry stop, named
for the nearer place, where there is room; otherwise a bridge drawn on the
road. A town on the river is its own crossing.

## Step 3 (built): trouble on the road

Runtime, for any map (`ExploreMap.legs`, `ExploreNode.camp`,
`wandering.night`):

- **Legs.** Walking a leg between two nodes rolls its `chance` every
  time — halved for each fight already met on that leg, and half again at
  night. Won, the party has arrived. In a county a leg rolls on the ground
  at its middle (plain 12%, forest 22%, hills 20%, marsh 28%), less on a
  road between towns (×0.6) and near the city (×0.5), for a fight of who
  lives there (bandits and gnolls on the plain, wolves in the forest,
  goblins and kobolds in the hills, lizardfolk and hags in the marsh).
- **Camping by the ground.** A node's own camp rule overrides the map's: a
  night in a town is safe; one in the wild is a roll on that ground.
- **Night streets.** A town's rough-street fight rolls once by day and once
  more after dark, at twice the chance.
- **Beaten on the road:** you come to by the roadside.
- **Fix:** a map remembers where the party stood on it (`mapAt`): coming
  out of a county's town no longer puts the party back at the road in.

## Step 4 (built): the day on the road

A leg may take `hours` (a county's: its walking cost at three miles an hour,
so rough ground is slower). The party sets out at 8 am; past 8 pm it is
night — the town flag, so a party that arrives late finds the shops shut and
the gates barred — and at 8 the next morning, day again. A long rest, or
sitting up at an inn till dawn, makes it morning; waiting at the inn for
nightfall makes it dusk. The map's title shows the hour. No rations.

## Camps by level (built)

Each band has a **tier**: the party level it is a fair fight for — kobolds
and goblins 1, bandits and lizardfolk 2, gnolls and cultists 3, the witch
circle 4, the ember court 5. A county rolls bands on suitable ground within
a level of its own, and a camp's fight is built at the band's tier, not
the party's.

In play, a camp goes by the party's **current** level (`partyLevel`, a new
requirement the proofs treat as either-way):

- **Weaker than the band:** prey. The hostile come for you, sure of
  themselves; the calm demand a toll (5 gold a tier) — pay, refuse and
  fight, or back away.
- **Within a level:** as the band is disposed (rolled at build): fight, or
  sit and talk.
- **Two levels past it:** they bow. Most pay to be let be (10 gold a tier)
  and will talk; goblins and kobolds bolt and leave their camp to you.

So the goblins that jumped a level-1 party scatter before it at level 3.
