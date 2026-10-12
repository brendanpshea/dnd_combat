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

## Next

3. Encounters on the road: per leg walked, by terrain, party level and
   road/no road, falling off after a fight; terrain-based camping risk;
   night streets in rough quarters.
4. Travel time: legs take hours, night falls on the road.
