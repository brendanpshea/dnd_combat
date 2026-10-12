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

## Next

2. Author specs: required places (named towns, delves, custom places),
   constraints ("only through X" — every route to it passes X, justified by
   a ridge or a river with one crossing; "locked until a flag" — a washed-out
   bridge), delves spliced in like towns.
3. Encounters on the road: per leg walked, by terrain, party level and
   road/no road, falling off after a fight; terrain-based camping risk;
   night streets in rough quarters.
4. Travel time: legs take hours, night falls on the road.
