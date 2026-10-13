# Chapter one review, October 2026: four critics read the new Hollow Road

Four reviewers read chapter one after it was rebuilt: Thornwick and the marsh road are now generated each run, and the den is a generated delve. Each worked independently, in the critical persona of **Margaret Weis & Tracy Hickman**, **Naomi Novik**, **Terry Pratchett** or **Jennell Jaquays**. All four judged the game design as well as the writing; Jaquays judged design first.

**What they read:** the stories in `src/data/modules/hollow-road/`, the chapter one parts of the route transcripts in `docs/transcripts/`, and the atlas, the balance tables and the chapter notes as each chose. This was main at `cdfe035`.

---

## Where they agree

### What works

- **The authored spine.**
  - Vargan is the drowned reed-cutter's boy who sold the common shallows to the hag.
  - The hag was paid "one lamb a winter, for sitting by their door in the dark", and her grievance is earned.
  - Binding her with her own old price is the cleverest ending.
- **Objects that recur.**
  - The girl's one shoe appears in all three of her outcomes.
  - The board's line "*Thornwick does not beg. It pays its debts*" is set up early and paid off in the epilogue.
  - The birdcage with no bird, and the stone dog with its ribbon.
- **People.** Mira ("evidently decides you'll do"), Wren ("I counted. That's the job."), and a reeve who doesn't thank you.
- **Failure branches written as well as the successes.** `scout-dead`, `spy-caught-loud`, `road-carter` and the cruel epilogue all land.
- **The gate is the model obstacle.** Four approaches each come from what the party did in town, and failures move the story on.

### What doesn't work, by agreement

1. **All four: the generated places contradict the chapter.**
   - The marsh road plays as "The Sunken Cellars… Built by an abbey… Now the beasts of the deep wood hold it", with rooms called "Dry Loft" and "Mud Cellar".
   - The Ashfang den becomes "The Burning Furnaces… Built by fire-priests… Now the Bloodmaw gnolls hold it".
   - Room flavour attaches to authored scenes ("Hymn numbers on a board").
   - Leaving the marsh prints "Daylight, and air that does not smell of the deep".
   - Leaving a delve can say "Leave it for someone else" and drop the party back in town mid-quest.
2. **All four: the delves mean backtracking and empty searches.** Routes shuttle through Entrance, Dry Loft and the cache many times, and "Search the room → Dust, old bones and nothing else" repeats. The marsh lost its sense of a road with a direction.
3. **All four: the filler fights are unthemed and wordless.** Fights like `gen:giant-badger+giant-badger+wolf+giant-badger` have no prose. The `wild` faction is wrong for a hag-cursed marsh, and the den's filler repeats the kennels fight.
4. **Three of four: the moon clock is under-signalled.** Nobody says "six nights" early on, and resting doesn't say it costs moon.
5. **Three of four: the tavern regulars teach rules, not Reedwife lore.** They are a missed chance to seed the lamb custom.
6. **Two to three of four:**
   - The climax choices narrow to "End them both" for most parties, because turning Vargan and the binding rite are gated hard.
   - Leaving the captives costs too little when Wren is saved (Novik).
   - The den never reacts to alarms (Jaquays).
   - The spy is a hard single gate (Jaquays).
   - The XP curve peaks before the den: some routes reach 3rd on the marsh (Jaquays).

Checked against the source: the "{wren} says you want out" line one reviewer queried is correct. It needs `know-vex`, which only a party Wren told has.

---

## Margaret Weis & Tracy Hickman

I've reviewed Chapter One, "The Hollow Road", as Weis & Hickman. I made no edits.

**Verdict:** The authored writing is the best thing here. It has a real villain with a grievance, a companion with a pulse, and an epilogue that pays its debts. The generated layer works against it. Where the marsh and the den become dungeon floors, the party's emotional journey turns into a room crawl, and the generated names and blurbs contradict the story.

#### 1. What works

- **The opening hook.** In `road`, Mira's note reads *"Come quick. We are not too proud to ask."* The reeve's line on the board (`board`) is *"Thornwick does not beg. It pays its debts."* The two set up the chapter's theme, pride against need, in two lines. The epilogue closes it: "Someone tears off the bottom corner first, the line in the prouder hand, and keeps it." That is module writing with a spine.
- **Vargan.** He is a villain with a wound. Mira plants him in `tavern-meet` with the reed-cutter's boy whose mother's house went under. His `boss-approach` speech pays it off: "Thornwick watched from the bank… So this spring I came home and sold them to her. Fair price." The Reedwife's answer, "One lamb a winter, for sitting by their door in the dark", makes the whole valley complicit. It's the kind of grey moral ground Dragonlance lived on.
- **The shoe.** The girl in `den-pens` "has one shoe, on her right foot." The trophies in `boss-approach` include "a child's left shoe, small and still muddy." The merciful epilogue ends on "a new pair of shoes." A memorable image that runs through three scenes is rare, and this one earns its place.
- **Wren.** Her lines are clipped and proud: "I'm fine… I counted. That's the job." `claim-scout` gives her a small, true moment: "You came back," then she goes red to the ears, and the reply is *"So did you."* She is the closest thing to a companion arc in the chapter.
- **Consequences in the epilogue.** The cruel epilogue lands hard: the scout found "a hundred yards from a dead horse. She had been crawling toward Thornwick"; Mira's extra cup; the empty pen whose prisoners "are never found." Choices that look small at the time, such as leaving Wren or leaving the pen, come back as grief. That is meaningful agency.
- **Clues chain into later scenes.** The peddler gives up the gate-signal, which opens a `gate` option. Wren gives up Vex, which opens the Vex persuasion line. Turning Vex changes the boss fight to `boss-unguarded`: "Vex has kept his word." This is the right structure.

#### 2. What doesn't work

- **The marsh is not a road.** `trail` reads "The way into The Drowned Halls stands open. Built by an abbey… Now the beasts of the deep wood hold it." The chapter is called *The Hollow Road*, and Mira says "follow it till the reeds close in." What the player gets is a generated abbey dungeon. Its rooms are named "Entrance", "Den" and "Dry Loft". The wounded scout's room shows "Hymn numbers on a board." `barrow` sits inside a room of a flooded abbey. The atmosphere of an open, dying marsh under a waning moon is lost.
- **The den belongs to the wrong people.** In `inner`, "The Ashen Kilns… Built by dwarven smiths… Now the Bloodmaw gnolls hold it." This is the Ashfang raiders' timber-walled camp. A generated faction and backstory override the authored one at the climax, and generic flavour like "Anvils sunk into the floor" or "Channels in the floor for something molten" turns up in the pens and the pit.
- **Filler fights have no names.** Encounters like `gen:brown-bear+giant-badger` and `gen:giant-badger+giant-badger+wolf+giant-badger` have no prose beyond "Something moves in the dark ahead." `trail/f1-fight-m3` has no text at all. The authored fights all have a staging line (the ogre's groove "as deep as a thumb"), and these sit badly beside them.
- **Searching rooms is tedious.** The completionist run is a long stretch of "Search the room → Dust, old bones and nothing else" and back-and-forth room hopping. The cruel run steps out "Back outside", which lands on "Leave it for someone else" and drops the party into the Thornwick shops mid-quest. This is the worst seam in the chapter: it breaks the sense of a journey.
- **The cast travels alone.** Wren can join (`wren-joins`, `ambush-turned` #wren), but both main transcripts send her home. The party characters never speak or react, so there is no companion banter on the long marsh stretch. Vex shows up once, and Hask never appears.
- **Thornwick has filler.** `square/landmark` ("cold in summer and warm in winter") and the stock shop barks have nothing to do with a town under siege. The `regulars` rumors are tutorials dressed as NPCs. The sergeant's "Rule one…" about free cuts is fine, but three in a row slows Act One.
- **Some choices are illusory.** Every boss route says "End them both." The Vargan-turning and binding-rite options are hidden behind Insight DC 14 or class gates, so most players get a straight fight. `tavern-plain` is a dead option.
- **The clock goes unexplained.** The moon line at dawn on day 5, "A few more nights and it will be gone", is the best tension device in the chapter. But players never learn what happens at the dark of the moon until the epilogue reveals the consequence.

#### 3. Top 5 recommendations, by impact

1. **Make the delves fit the story.** Tie `trail/delve` and `inner/delve` to themes the chapter controls: a marsh-causeway theme with reed and pool rooms and Ashfang or Reedwife factions, and a stockade theme for the den. Ban generated backstory blurbs ("abbey", "dwarven smiths", "Bloodmaw") inside authored chapters. Rename room types so that "Den" and "Dry Loft" never appear on the marsh road.
2. **Close the dungeon exit seam.** `trail/outside` and `inner/outside` should never "Leave it for someone else" into `square/city` mid-quest. Route them to `trailhead` or `hollow-quiet`, or remove the exit once the quest has started.
3. **Make the companion the default.** Make `wren-joins` the default or most attractive option. One option: she can only walk if you go slow, which costs a night on the moon clock. Then add short Wren interjections in the generated rooms: the ravine, the barrow, the gate. That turns the marsh crawl into a journey with someone.
4. **Give every filler fight a line, and thin out the empty searches.** Add a short line of staging per `gen:*` encounter ("A badger, fat on Ashfang leavings, will not give up its burrow"). Cap the number of empty "Search the room" results, or tie searches to found lore such as Vargan's childhood, the drowned houses, or lamb offerings, so that exploring tells the story.
5. **Surface the stakes and open up the climax.** Have Mira or the carter state the dark-of-moon deadline plainly in `tavern-meet` or `den-pens`, and show the moon state in the journal. Lower or diversify the gates on `vargan-turns` and `bind-hag-rite` so ordinary parties can reach them through leads earned earlier: the Reedwife clue from `hollow-won`, or the brand seen on the lizardfolk. Then "End them both" becomes one choice among several instead of the only one.

---

## Naomi Novik

I read all five `.story` files and `hollow-road.ts`, plus the Hollow Road part of the merciful and cruel transcripts. I only skimmed the completionist run and did not read the atlas or the design notes. No files were edited.

### The Hollow Road: a review in Naomi Novik's voice

#### 1. What works

**The central bargain is the best thing here, and it is real folklore.** In `boss-approach` the chief speaks: "The shallows were still common water. So this spring I came home and sold them to her. She paid me in monsters, and a valley to run. Fair price." The hag answers: "Fairer than the fen ever paid me. One lamb a winter, for sitting by their door in the dark." That is a proper fairy contract. There is an old price, a broken custom, and a man who sold something that was never his to sell. The carter in `den-pens` sets it up from below ("My gran left her a lamb every midwinter, and that was all she ever asked"), so the hag's grievance has been earned before she arrives. The rite, `bind-hag-rite-alone`, is the right answer: "You ask for nothing more: no shallows, no pens, no chief." The cleverness lies in giving her back her old price, not in killing her. The epilogue pays it off quietly: "In the morning the rope hangs wet and empty, and nothing else is missing." This is the chapter at its best.

**Vargan has moral texture.** He is a drowned boy whom Thornwick "watched from the bank", and he looks at his trophies "the way a farmer looks at a full barn". In `vargan-fate` he says "Thornwick will want me hanged. Thornwick is right." He has agency and guilt, and he never pleads.

**The economics are on the page.** The reeve is too proud to beg, so Mira writes the note. The bounty board carries the line "*Thornwick does not beg. It pays its debts.*" in newer ink. In `claim-balance` the reeve subtracts the 25 gold retainer you drew. In `aftermath` he will not pay for a chief "you turned loose in my marsh". The town has a character, and that character is pride with a ledger. Someone tearing off the proud line and keeping it is a lovely touch.

**The details are grounded and specific.** The girl with one shoe runs through the whole chapter: a "child's left shoe" in the rafters, "still wearing her one shoe", "a new pair of shoes" by the well. The peddler has "a birdcage with no bird". The ogre's collar "has worn a groove in its neck as deep as a thumb". The miller's petrified dog ends up with a ribbon. Wren says "I counted. That's the job." That one line gives her a whole character.

**The cruel epilogue lands.** Mira "does not pour a second"; "a scout in the reeds… a hundred yards from a dead horse. She had been crawling toward Thornwick"; the extra cup set at the end of the bar. These consequences are emotional, not numerical, and they hurt in the right way.

**Information is earned through the world.** The trapper sketches the route in spilled ale in `tavern-trail`, and the sketch pays off in `tracks-mapped`. The gate-signal in `spy-caught` opens the den in `gate`. Wren tells you about Vex, and Vex tells you about the pens. That chain of favours and debts is exactly the right spine.

#### 2. What doesn't work

**The generated dungeons break the fiction badly.** `trail` reads: "The way into The Sunken Halls stands open. Built by an abbey that stood on dry ground… Now the things in the brush hold it." Another seed says "the beasts of the deep wood". This is supposed to be a *marsh road*, and suddenly it is an abbey with an "Entrance", "Back outside… Daylight, and air that does not smell of the deep", and a "Dry Loft". `inner` is worse. The Ashfang den becomes "The Ashen Deeps… Built by fire-priests of a dead god… Now the **Bloodmaw gnolls** hold it." We were promised orcs, bandits and an ogre pit behind a timber wall, and we get murals of "a god with a burning crown" and an unnamed gnoll faction. The `den-slipped` text ("Keep low and move in among the tents") is followed at once by a dwarven furnace. Fights show up as `gen:giant-badger+giant-badger+wolf+wolf` with no prose at all. Search results are filler on rotation: "Dust, old bones and nothing else", "Nothing turns up." The transcripts show long stretches of back-and-forth room shuffling (m1↔m2↔cache) with nothing to read.

**The captives choice is hollow.** In `den-pens-left`, leaving them only costs `wren attitude -1`. The merciful run left them, saved Wren, and still got the best captive epilogue: "The carter carries the girl out himself." So if Wren is saved, walking past a padlocked child is free. Worse, picking the lock (DC 13) risks the `pens-alarm` fight for the same result. A Novik plot needs this to be a debt you actually owe.

**The clock is barely felt.** The dawn texts are well written, especially "something sang until dawn, and then stopped", but in both runs the player can rest at the inn on day 1 and wander the town freely. The only visible clocks are Wren's (day 5) and the pens (day 7). Nobody tells the player that resting costs moon. Mira says the reed-cutters are "counting the nights" but never says *how many*. Vex gives the real number ("Three more nights… at most"), and only after you are already in the den.

**The moral ledger is invisible.** Empathy and law show up only as flags in the transcript header (`npc.wren.attitude=0`). The reeve reacts to law and Mira to mercy, which is good, but the player never sees these as two pulls in tension. They need a moment where the reeve's demand and Mira's mercy conflict before the ending, not only in it.

**The tavern tutorials are out-of-world.** `rumor-magic` ("burn only as long as you hold them in your head… Can't hold two at once") and `rumor-tactics` are game-rules lessons wearing folk costume. The hedge-witch with river-stones in her hair is wasted on concentration mechanics when she could be talking about the Reedwife.

**The rest is thin or generic.** `square/temple` ("Peace be on you. What do you need of the Forge?"), the "Horse Fair", and Coriol of Perrego next to Fishellby's or Proudford's Stores all feel like random-table output in a town whose authored voice is very particular. The cockatrice mill is charming but has nothing to do with the hag or the drowned shallows.

**The hag dies too easily on the violent route.** "End them both" folds her into the chief's fight. A centuries-old fen power should not go down like a lieutenant. Her death should cost the valley something, such as the shallows staying sour or the old custom broken for good.

#### 3. Top five recommendations, by impact

1. **Re-skin the generated delves with chapter-specific theme pools** (`trail`, `inner`, `trail/outside`, `inner/outside`, the `gen:` fights). The marsh road should get reed-cutters' huts, eel weirs, drowned causeways and old lamb-stakes. The den should get tents, kennels, stolen carts and an ogre pit, with the faction locked to the Ashfang. Put an authored line on every fight, and drop the "Built by…/Now X hold it" template and the "Daylight" exit inside a marsh. Collapse pure-transit rooms so the player isn't shuffling back and forth.
2. **Make abandoning the captives cost something** (`den-pens-left`, epilogue lines 154–232). If you leave the pen, the Wren rescue should come too late, or the Ashfang should move the captives when the den falls. Better still, make freeing them change the hall: the carter could tell you the old midwinter words, which would lower the `bind-hag-rite` DC or unlock the binding without a Religion roll. Mercy should buy cleverness.
3. **Telegraph the moon clock early and concretely** (`tavern-meet`, `inn-rest`, `dawns`). Have Mira or a reed-cutter name the dark of the moon as "six nights from now". Add one line to `inn-rest` and to camp choices noting that the moon is wasting. Mark the board or journal with the nights remaining.
4. **Stage the law-versus-mercy conflict before the ending.** Add an authored scene in Thornwick after `spy-caught` where the reeve wants the peddler hanged and Mira argues for him. That would teach the player the two axes early, and then `vargan-fate` and `aftermath` read as payoffs rather than surprises.
5. **Turn the regulars into folklore.** Rewrite `rumor-magic` and `rumor-tactics` as Reedwife lore (the lamb custom, the rule that a fen-power is held by her *own* price, the spring the water rose), and move the mechanics into tooltips. Give the killing route a lasting price (in `boss`/`reedwife-fight` and the epilogue): with no one to keep the bargain, the shallows go bad, which differs from the bound ending. And tie `mill` to the marsh, so the cockatrices are the hag's or the drowning's overspill rather than an unrelated chore.

---

## Terry Pratchett

I read `1-road` through `5-ending.story`, the Hollow Road part of the rusher and unlucky transcripts, and skimmed the completionist run. I changed no files.

#### What works

**Mira is a real person.** "A broad woman with flour to the elbow picks up a cup and wipes it, looks you over once, and evidently decides you'll do." That one sentence does more than most fantasy innkeepers manage in a whole book. "The reeve's too proud to beg, so I wrote it for him" tells you about two people at once. Her epilogue line works because it isn't warm: "It is the nearest thing to thanks she keeps in stock." In `defeat`, the second time round she says "Same cot, same mug… Try to need it less." Losing a fight becomes a running joke, and the stakes stay where they were.

**Thornwick has dignity.** The board has "*Thornwick does not beg. It pays its debts*" added in "a smaller, prouder hand". In `aftermath` the reeve "does not thank you… as though daring you to make something of it". The epilogue pays it off: someone tears off "the line in the prouder hand, and keeps it." The sentiment is set up early and never stated outright. The stone dog with a ribbon round its neck is the same kind of joke.

**The villain is the cliché turned over.** Vargan is the drowned reed-cutter's boy, and he sold the common shallows to a hag who had been paid "one lamb a winter, for sitting by their door in the dark." So the town's neglect created the villain. His sentence fits that: he is sent "to cut reeds on the common land until the drowned houses stand again. Vargan has not missed a day." That is justice, not a punchline.

**Some details are exactly right.** The girl in `den-pens` "has one shoe, on her right foot". In `boss-approach` you see "a child's left shoe, small and still muddy". At the end she has new shoes. If you were too slow, `den-pens-empty` leaves "one small shoe" in the corner. It is the same object in all three outcomes and it works every time. The peddler's "birdcage with no bird" is good too.

**Failure branches are real and are written as well as the success ones.**
- `scout-dead` ("There is no one on the road to tell you her name") is the best paragraph in the chapter.
- In `spy-caught-loud`, failing the check costs you the gate-signal for a reason you can see: a knife-man is running for the den.
- `road-carter` is a better opening than winning the ambush.
- The moon clock ("Last night's moon was a thin paring of light") gives the slow player real pressure without a countdown on screen.

#### What doesn't work

**1. The generated dungeon text contradicts the authored world.**
- The marsh road becomes "The Sunken Cellars… Built by an abbey… Now the beasts of the deep wood hold it." This is a marsh. Where is the wood?
- The Ashfang den, which you enter by "Keep low and move in among the tents", becomes "The Burning Furnaces… Built by fire-priests of a dead god… Now the **Bloodmaw gnolls** hold it." On another seed it is "The Ashen Deeps, built by dwarven smiths."
- So the den belongs to the Ashfang and to an unrelated gnoll tribe at the same moment. Vex, the pens and Vargan's hall all sit inside a dwarven forge-temple that nobody mentions.
- Room flavour gets stuck onto authored scenes: "Fresh Tracks: The top of a chapel window", "A Sunken Barrow: Floors tilted like a ship's deck", and "Hymn numbers on a board" in the hidden cache.
- Leaving the den gives "Daylight, and air that does not smell of the deep." You are standing in a raider camp.

This is the biggest problem in the chapter. The authored prose earns your belief, and the generated wrapper spends it.

**2. Getting through the dungeons is a chore.** The rusher transcript, lines 392–470, goes Fresh Tracks → Hidden Cache → Fresh Tracks → Dry Loft → Entrance → Dry Loft… just to pick up a cache. Unlucky's den run shuttles The Pens/Kennels/Coal Chute half a dozen times. "Search the room" gives "Dust, old bones and nothing else" over and over. The marsh used to be a road with a direction. Now it is a set of cellars you criss-cross, and the sense of "deeper toward the smoke" is gone.

**3. Some scenes don't follow from what the player knows.**
- In `vex-parley`, the option "Wren says you want out" appears; the rusher route did save Wren, so that holds. But in the unlucky run, where Wren is dead, Vex still offers a Persuasion check. Check that the dialogue line is properly gated.
- `vex-refuses` sends Vex "toward the ridge". The epilogue then has him "watched the end of it from the ridge… gives himself up". That is fine if he refused. If he was turned, the same paragraph needs to be different.
- Vex's warning "Once you're in that hall, don't count on walking back past the kennels" depends on room order. In the unlucky layout the Pit comes before the Pens, so geography does the job the moon clock was supposed to do.
- In `hollow-won`, "Come up to the fire… The chief and I will be waiting." Then `boss` has her "come up out of her water to see". The two lines contradict each other.

**4. The town's shops are boilerplate.** Bram has a nice line ("A dead customer never comes back for more"). The Smithy has "The forge roars. Steel or leather?" with no name and no person, and `square/temple-healed` reads like a menu. Thornwick is generated so it can vary, but every variant has the same flat shopkeepers. Compare Osk the miller, who is a person.

**5. The two scouts.** `tavern-meet` gives "a pair of girls on grey horses". After that, only Wren exists until the epilogue mentions "the other scout… walked home the long way round." That is a nice line, but it is the only time she appears. The setup promises two rescues and delivers one.

**6. The regulars' table is a tutorial wearing a beard.** In `rumor-tactics`, `rumor-magic` and `rumor-weapons` the voices are fine ("you'll be eating steel halfway through the word"), but they are rules text with nothing to do with Thornwick. No regular mentions the Reedwife, the lamb, or Vargan's mother.

#### Top 5 recommendations, by impact

1. **Give the generator theme constraints from the chapter (`hollow-road.ts` delves, plus the dungeon name/origin/faction tables).**
   - For `trail/delve`: marsh vocabulary only (reeds, causeway, drowned huts, an eel-weir), and the faction is "the marsh's beasts" or the Reedwife's thralls.
   - For `inner/delve`: faction locked to Ashfang. Origin is either "a reed-cutters' hollow the Ashfang fenced in" or nothing at all. No gnolls, no fire-priests. Change the `inner/outside` text ("Back among the tents").
   - Stop room flavour from appending to authored scenes (`tracks-mapped`, `barrow`, `thicket`). The authored scene should replace the room description.
2. **Cut backtracking in the delves.** Shrink `trail` to a near-linear spine with one or two side pockets. Give "Search the room" one search per room with a single dry, varied line, then hide the option. Let a cleared room offer "Back to the entrance" as one step. The rusher's 70-line shuttle should become about 15 lines.
3. **Make the den's time pressure explicit and robust.** The pens' outcome (`den-pens` / `den-pens-empty`) should depend on the moon clock and on entering `boss-approach`, not on whether the generator put the Pit first. Lock the Pens room adjacent to `vex-parley` (`m1`→`m2`) on every seed.
4. **Audit cross-scene consistency.**
   - `vex-parley`: the Wren line requires `npc.wren.fate.saved`.
   - The epilogue's Vex paragraph should branch on refused, turned and killed.
   - `hollow-won` / `boss-approach`: reconcile where the Reedwife waits.
   - Give the second scout a found-or-not beat in the marsh, or cut her from `tavern-meet`.
5. **Give the generated townsfolk a voice and local knowledge.** Every generated shopkeeper should get a name and one line drawn from the chapter's facts (the raids, the lamb, the moon). Replace one regulars' rumour with marsh lore: "My gran left a lamb at the reeds every midwinter…". That way the tutorial table also seeds the Reedwife twist that the `den-pens` carter line currently has to carry alone.

Overall, the authored prose is good enough that it shows up the machinery around it. Fix the generator so it serves the story, and this chapter would hold up very well.

---

## Jennell Jaquays

I read all of the chapter's own files: the chapter definition, every scene file, the design notes, the balance tables and the four route transcripts up to "The Sunken Barrows". I only skimmed the two generators and the atlas. I edited nothing.

### The Hollow Road: a design review

#### 1. What works

- **The core idea is sound.** A town hub, a road you have to read, a den with an inside man, and a boss who is a puppet of a stronger villain. That is a real three-faction knot: the Ashfang, Vex, and the Reedwife who is using Vargan. Vargan's backstory (a reed-cutter whose mother's house the hag drowned, and who sold the common marsh to her) gives the climax a moral weight beyond "kill the orc". The hag laughing that she was paid "fairer than the fen ever paid me" is a good hook into chapter two.
- **The gate is the best obstacle.** `gate` offers four approaches that come from what you did earlier: the stolen signal (Deception 10, only if you caught the spy quietly), the water-gate lock (Rogue Sleight of Hand 10), going over the wall (group Stealth 13), or storming it. Failures fail forward: `gate-signal-blown` costs a day and burns the signal, and `gate-caught` is the fight with you surprised. That is exactly the "what you did in town pays off at the den" structure I want.
- **Failing a check moves the story on.** The ravine lets each approach fail separately and then charges a day for the long way round. A failed save on the scout (`scout-fail`) keeps her alive but costs a day and loses her as a guide. The boss approach stacks reads (Insight or Warlock Arcana on the brand, then a Persuasion turn) that change the fight (`boss-shaken`). The `defeat` scene sends you back to town, the road or the den.
- **Skipping a fight still pays its XP** (`avoidedFightXP`). That is the correct rule for a game that rewards wits, and the notes check that every company reaches 3rd level before the hall.
- **The clock is real and spread across the chapter.** The scout dies at the fifth dawn and the captives are taken at the seventh. The moon-phase dawn text in `hollow-road.ts` tells you about it without a timer on screen. The unlucky route actually lost the scout this way (it reached her on day 6), so the deadlines bite.

#### 2. What doesn't work

- **Catching the spy is a hard single gate.** `gate-blocked` keeps the marsh road shut until `spy-caught`. There are several ways to catch him (Stealth stalk, Investigation, Intimidation, brawl), but catching him is the only thing that opens the road. You can't bribe the warden, bluff past him, go over the palisade, or just give up on the spy and take the consequences. Then the result barely branches: quiet means you get the signal, loud means you don't. "Ignore him" should be an option, and the den should know you're coming.
- **The generated places name themselves wrong.** The transcripts show the marsh road playing as "The Sunken Cellars", with rooms like "Dry Loft", "Mud Cellar" and "Drowned Crypt". The Ashfang Den plays as "The Burning Furnaces", with "Mould Room" and "Bone Heap". Leaving the marsh road prints "Daylight, and air that does not smell of the deep." (`delve-spec.ts:752`), on an open marsh. The chapter's own `title` fields evidently don't reach the generated dungeon. That breaks the fiction at every room.
- **The layouts are mostly backtracking.** All four routes go back and forth through Entrance, Dry Loft, Sunken Barrow and the rest many times; the merciful route crosses Entrance and Fresh Tracks about eight times. The `classic` marsh shape with a lock that needs two flags (`trail-read` and `crossed-ravine`) makes you search the "beforeLock" area until you've found both. That is chores, not exploring. The `spine` den is linear by design ("no lock and key of its own"), so its 9 rooms are one corridor with side pockets. Jaquaysing means loops, a second way into the hall, and a choice of route. Neither generated map has a loop that matters.
- **The filler fights are unthemed.** Random fights like `gen:brown-bear+giant-badger` and `gen:giant-badger+giant-badger+wolf+giant-badger` come from the `wild` faction in what should be a hag-cursed marsh, and they land in "Sunken Hall". They work against the bestiary-tour goal the notes set out. In the den, the generated `gnoll+hyena` rooms play the same as the authored `den-hyenas` kennels fight.
- **Most side obstacles are "fight it or leave it".** The mill, barrow, thicket and kennels each offer exactly two choices: fight, or walk away. The hollow ambush is a single Perception check that only decides who is surprised (`ambush-turned` against `ambush-sprung`). Only Wren adds a third way. Nowhere can you use the hag's thralls' brand, the toads, the cold water or fire against them.
- **The difficulty curve is off.** In `docs/balance.md`, the pit-brute and gate are EASY (90–100%). The kennels (23%), the pen watch (27%) and the night watch (27%) are much harder, so the optional den rooms are harder than the main ones. The rusher hit level 3 at the thicket, before the hollow, and the completionist hit it on the marsh road too. That means the den and its roughly 560 XP of "level-carrying" fights award nothing (the band caps at 3). The reward rhythm peaks too early.
- **The factions don't act.** Vex's turn has one mechanical effect: Hask steps aside. The gnolls never react to the gate being slipped, the pens being opened, or the kennels going quiet. `spy-caught-loud` says the den changed its signal, and that is the only alarm in the chapter. Nothing in the den reads `pens-alarm` or `vex-refuses` (for example Vex warning the chief). The hag never sends anyone against the company before the hall. She is a reveal, not an opposing player.
- **Small problems:**
  - The `vargan-unread` and `boss-approach` choice lists hold four near-duplicate "End them both" lines, filtered by flags. That works, but it is hard to maintain.
  - The rusher, having sent Wren home, still got a Vex line opening "Wren says you want out", which reads oddly. Please verify this.
  - The tavern regulars are fine but static.
  - The bounty and retainer bookkeeping (`FREE_VARGAN` charging the retainer back) is invisible fiddliness.

#### 3. Top 5 recommendations, by impact

1. **Make generated places carry the chapter's identity.** Pass the `title` and theme names through to the dungeon generator (`delve-spec.ts`, and the outside text in `dungeon-gen.ts:263`). Give the `bog` theme outdoor room names (causeway, reed island, sinkhole, heron rookery) and rename "Dry Loft" and "Mould Room". Swap the `wild` faction on `trail` for a marsh roster: toads, lizardfolk thralls, drowned dead, will-o'-wisp. Have the `inner` filler rooms pull from Ashfang troop types, not repeats of the hyena fight. This is cheap and fixes the most visible problem.
2. **Jaquays both maps.** On `trail`, drop the lock that needs two flags in favour of one lock with two keys: either `trail-read` or `crossed-ravine` opens a different way to The Hollow. One is a dry line that comes in quiet, the other is the sinkholes route (`ambush-wet`). Then the order you take them in is a choice, not a search. On `inner`, swap `spine` for a shape with one loop. Let the water-gate entry (`den-picked`) land you at the Pens or Kennels, the wall entry (`den-slipped`) at A Lone Fire, and the stormed gate at the Pit. Add a back passage into the Chief's Hall that skips the Pit, opened by Vex or by freed captives.
3. **Open up the spy gate.** Give `gate-blocked` other ways through: bribe the warden, a Deception claim of reeve's business, or slip the palisade at night. Each opens the road with `spy-caught` unset. Then have the den react to an uncaught spy: the signal is gone, the watch is doubled, and `gate` gets harder DCs or a `gate-caught` default. The spy stays the best answer but stops being a wall.
4. **Make the den react.** Track a den-alert flag set by `pens-alarm`, `gate-caught`, `spy-caught-loud` and fights you lost. While it's set, Hask doesn't step aside, and `boss-approach` opens with the hag already prepared. Have `vex-refuses` warn Vargan (no `vargan-shaken` route). Have a turned Vex also be able to empty the pens or open the back way. Have a freed carter (`den-pens-freed`) tell you about the throne-room drain. Factions should change the map, not just a flag in the epilogue.
5. **Give side obstacles a third answer, and fix the XP curve.** Give each of `mill`, `barrow`, `thicket`, `den-hyenas` and `ambush` one non-combat answer that pays `xp avoided`. For example: Nature on the cockatrices (move the flock with smoke), Religion to settle the barrow, fire to burn the webs, meat from `den-cache` to quiet the hyenas, turning the cold water on the thralls. Then fix the XP. Cut the marsh filler XP, or raise the level cap to 4 for over-delivering companies, so the den's fights still advance you. Rebalance `kennel-hyenas`, `pen-watch` and `den-watch` (about 25%) against `den-pit` and `den-gate` (90%+), so the optional rooms aren't the deadliest ones and the Pit is a climax rather than a speed bump.

**Bottom line:** the authored layer (the gate, Vex, Vargan and the hag, the clock) is a good, Jaquays-friendly module. The generated layer around it is generic. It names itself wrong, backtracks constantly, and fills the gaps with badgers. Fix the generators and the den's reactions, and this chapter rewards clever play rather than patience.


---

# Recheck, after #395–#398

All four critics read the chapter again after the fixes, with their first review and a list of the changes in hand.

## Where they agree

### Fixed

- **The generated places are the chapter's own.** All four say the marsh road and the stockade now read as this story.
- **The clock is said plainly:** six nights to the dark moon.
- **The reed-cutter's lore** (`rumor-reeds`): each critic named it the best new scene.
- **The non-combat answers:** at the mill, the barrow, the webs and the kennels.
- **The carter's line turns Vargan through mercy.**
- **The marsh walk is shorter:** a straighter road, and no empty searches.

### Broken by the fixes (all four)

1. **`den-alarm` contradicts the scenes around it.**
   - A quiet entry (`den-slipped`, `den-picked`) still says "a camp that thinks it is safe" after a town-set alarm, and then Vex says "the whole den knows you're here".
   - The `pens-alarm` win text says nobody comes.
   - The hall's alarm line sits under `again:`, so it shows only on a return visit.
   - The alarm changes no encounter, and it quietly costs Vex with no warning.
2. **The captive rules are incoherent.**
   - Leaving the pen sets `captives-taken` at once, so the moon clock is broken. `den-pens-empty` says the lady came, with the moon still up and even with the hag dead.
   - A party that never looks is rewarded over one that looks and leaves.
   - Two epilogue slides can both fire.
3. **Generated fights were not all removed.** Corridor ambushes and the den's key guard (with its forced door) remain. The key guard still pays XP and levels a party.
4. **Leftover torch lines.** These remain in `den-pens-door`, `den-pens` and `barrow`.

### Still open

- **The XP curve** peaks on the marsh, and the den's fights then pay nothing; the den's balance is inverted (the Pit easy, the optional rooms deadly).
- **The den is one corridor**: one entry, no loop, no back way into the hall.
- **The climax** usually closes on "End them both". The lore (`rumor-reeds`) doesn't lower the binding rite.
- **Leaving a place mid-quest** can drop the party back in town.
- **Wren** goes home early, and there is no companion on the road.
- **Smaller points:** the hollow ambush has no non-combat answer, and the burning webs never mention the living guard in the cocoons.

### Margaret Weis & Tracy Hickman

I made no edits. I read my earlier section and "Where they agree", `4-den.story` (the pens and the hall), `parts.ts` (the rite), and the chapter one portion of both trilogy transcripts. I only skimmed the other stories and skipped the atlas.

**Verdict:** The bones of a fine chapter are now visible: the lamb, the dark moon, the shoe and the pen all point the same way. But the generated layer still undercuts it in the places players feel most, the long walk and the moment of return.

#### 1. My earlier complaints

**Fixed**
- **The marsh and the den now belong to this story.** `trail` reads "the road runs out into reeds and black water, and goes on as a line of planks and tussocks", and the trailhead has "a reed stake… something tied to it that used to be a hare." `inner` reads "tents and cook-smoke and stolen carts." The abbey, the dwarven smiths and the Bloodmaw are gone. This was my top complaint, and it is answered.
- **The moon clock.** Mira's "Six, by my count, and none of them will say why" is just right: a number, and a mystery. The inn rest's "the old moon is a little thinner than it was" teaches that resting costs moon without a rule being stated.
- **The regulars carry real lore.** `rumor-reeds` is the best new writing in the chapter: "One a winter, for sitting by our door in the dark… say her own price back to her, the old way, and ask for nothing more." It sets up the binding rite properly.
- **The captives matter.** The cruel epilogue's "They find the chain hanging open, and a child's shoe in the straw" closes the shoe image with a gut-punch. The carter line ("The carter's girl is home") is a turn for Vargan earned by mercy, not by a die roll. That is exactly what I asked for.
- **Side obstacles have non-combat answers.** `thicket-burned` reads well.

**Not fixed**
- **Leaving a place mid-quest still drops you in town.** In the cruel run, `trail/outside` offers "Walk back to Thornwick", and the party goes shopping at Proudford's Stores and catches the spy after they had already gone over the wall. `inner/outside` → `hollow-quiet` → "Take the marsh road back" sends the party back through the whole marsh mid-assault.
- **Filler fights survived.** `gen:ghoul+lizardfolk`, `gen:lizardfolk+ghoul`, `gen:bugbear+bugbear+bandit` and `gen:giant-hyena+bugbear+bandit` still appear, each with one staging line ("Every frog in the reeds goes quiet at once"). The lines are better, but this is not "removed".
- **Empty searches remain.** "A boot, with nobody's foot in it." "Fleas, and a blanket you would not wish on an enemy." "Someone's stash, already found by someone else." They are wittier now, but they are still searches that find nothing.
- **The marsh still makes you backtrack.** In the completionist run, the order is Trailhead → Barrow → Trailhead → Ravine → Tracks → Ravine. The cruel run goes Fowler's Blind ↔ Hidden Cache ↔ Dry Hummock three times.
- **Wren is still sent home in both runs.** There is still no companion on the road.
- **The climax still closes on "End them both" in both runs.** The binding rite (`BIND_HAG_RITE_CHOICE`) is still reachable only after Vargan turns, and still needs Religion DC 15. So the reed-cutter's lore teaches a cure the player can't reach directly.

**New problems introduced by the fixes**
- **The den alarm contradicts the scene text.**
  - In the cruel run, the party passes `den-slipped` ("no horn has sounded"), and `inner` still says "a camp that thinks it is safe." Then Vex says "The whole den knows you're here," because the spy was left loose. Neither the player nor the prose knows why.
  - After `pens-alarm`, `den-alarm` is set, yet the won text reads "no one else comes… someone laughs at the noise and goes back to his dice."
  - In `boss-approach`, the line `? den-alarm | The hall is full of raiders…` sits after `again:`. It seems to show only on a revisit: the completionist stormed the gate and got no such line on first entry.
- **Torches are still mentioned.** `den-pens-door` ("as your torch comes near") and `den-pens` ("blink up at your torch") still refer to a torch that was removed.
- **Repeated wording.** The carter in `den-pens` repeats the reed-cutter almost word for word: "My gran left her a lamb every midwinter." The echo should be on purpose and sound different, not be a copy.
- **`gate-slipped` warns of a cost it never shows.** It promises "the Ashfang will hear of you before you ever see their smoke," but nothing on the marsh reacts to that.

#### 2. The most important remaining problems

1. **The journey has no arc of distance.** The exits, the round trips between rooms and the walks back to town break the sense of a road travelled once toward a doom. The chapter's title is "The Hollow Road", and the road still does not behave like a road.
2. **The alarm has no story behind it.** A good system (Vex holds back, the hall is ready) is undercut by text that says the opposite. Players will read the alarm as a bug, not as a consequence.
3. **The climax is still mostly a fight.** The new lore and the new mercy both lead to turning Vargan. Nothing lets a party that has heard the old price speak it directly.
4. **There is no companionship.** Wren is the heart of the chapter, and she leaves on day 3.

#### 3. Top 5 recommendations, by impact

1. **Remove the outbound exits once the quest starts.** Once you are past `trailhead`, `trail/outside` should lead only back into the reeds, or let you fall back to camp. `inner/outside` should stop at `hollow-quiet`, with no "Take the marsh road back" while `den-entered` is set. Make the marsh rooms a single line with no branches, so it plays as a march.
2. **Make the alarm visible and consistent.**
   - Give `inner` and `den-slipped` alternate text that checks `den-alarm` ("torches along the tent lines; someone has heard of you").
   - Make `gate-slipped` set a flag that shows up in the marsh (a watcher in the reeds, a tripped line of bells).
   - Rewrite the `pens-alarm` won text: "Across the yard, a horn."
   - Move `? den-alarm` in `boss-approach` above `again:` so it shows on first entry.
3. **Open the rite to people who learned the lore.** Add a `boss-approach` option, gated on having heard `rumor-reeds`, that speaks her price directly, and lower the DC there, perhaps Religion or Persuasion DC 12. The reed-cutter's lore should pay off in the hall, not only in the epilogue.
4. **Give Wren a reason to stay on the road.** In `scout-saved`, make "walk with us" the warm default: it costs a night, and she adds a line at the barrow, the hollow and the gate. Otherwise, let her come back at `gate` with the reeve's other scout. Her arc needs at least one more beat before `claim-scout`.
5. **Clean up what is left of the generated layer.** Cut the remaining `gen:*` fights or turn them into named encounters (lizardfolk bearing the Reedwife's brand, "the chief's dice-throwers"). Delete empty searches outright. Remove the torch references, and rewrite the carter's lamb line so it answers the reed-cutter's ("same as the old man at the inn says, I'll wager") instead of repeating it.

The heart is there now. Make the road run one way, and the chapter will feel like an epic.

---

### Naomi Novik

I re-read my earlier section and the agreement summary, then all five `.story` files, `hollow-road.ts`, `parts.ts`, and the chapter one portion of the merciful and cruel transcripts. I edited nothing.

#### (1) Earlier complaints: what changed

**Fixed, and well:**
- **Theming of the generated places.** "Past the last fence-post the road runs out into reeds and black water, and goes on as a line of planks and tussocks" is the right door. "A reed stake by the path, and something tied to it that used to be a hare" is exactly the folk detail I asked for. The den's "stolen cart… hacked with the raiders' mark" is good too. The abbey, the fire-priests and the "Daylight" exit are gone.
- **Moon clock.** In `tavern-meet`, Mira now says "Six, by my count, and none of them will say why." The journal repeats it, and `inn-rest` ("the old moon is a little thinner than it was") makes resting feel like spending something. Fixed.
- **Lore at the regulars' table.** `rumor-reeds` is the best new scene: "say her own price back to her, the old way, and ask for nothing more." But `rumor-magic` and `rumor-tactics` are still rules lessons dressed as folk.
- **Non-combat answers.** `mill-smoked`, `barrow-settled` and the kennel meat all read well. `barrow-settled` ("You leave the gold where it lies") is a choice with a price, which is how it should work.
- **Turning Vargan through the captives.** "The carter's girl is home. Your mother's house is still under the water." This is the mercy-buys-cleverness link I asked for.

**Not fixed, or fixed in a way that causes new problems:**
- **The captives are still hollow, and now the incentive runs backwards.** In the merciful run, Vex explicitly points to the pen ("do it before you go through to the chief"). The party walks straight to the hall and never looks. The epilogue still gives them "The carter carries the girl out himself, and she is still wearing her one shoe," and the run carries out `captives-freed`. Meanwhile `den-pens-left` sets `+captives-taken` at once. So looking and walking away is punished, but never looking is rewarded. Ignorance should not be the safest moral choice.
- **The leave-them fix contradicts itself in three ways:**
  - You described the fix as "the raiders move them when the den falls." That line (epilogue: "The {ashfang} who fled took the carter…") needs `not captives-taken`, so a party that left them never sees it.
  - What leavers see instead is "The reeve's men reach the pens… after the moon has gone dark… a child's shoe in the straw." In the cruel run that fires when the den fell on day 5, two nights before the dark of the moon, and **the hag was already dead**.
  - If you go back to `den-pens-empty` right after leaving, you find "wet, webbed footprints… Something has come for them out of the water" within the same hour, with the moon still up. The rule ("she comes when the moon goes dark") is broken by the code meant to enforce it.
- **The alarm is mostly invisible.** In `boss-approach`, "? den-alarm | The hall is full of raiders who heard you coming" sits under `again:`. It only shows on a return visit. The fight itself is unchanged. Only Vex reacts.
- **Vex can be lost to a choice made days earlier.** The merciful party bluffed the warden in town, so Vex said "Not tonight… I'm not turning my coat in front of all of them." That is a fair consequence, and `gate-slipped` hints at it ("the {ashfang} will hear of you"). But nothing tells the player the cost lands on the lieutenant. Also, `gate-signal-blown` costs Vex on a failed DC 10 roll, which is a heavy, invisible penalty for bad luck.
- **Burning the webs.** `thicket` tells us "Some of the bundles are man-shaped." The fight branch then shows one of them is a living caravan guard. `thicket-burned` sets him alight and says only "nothing… but ash and a few blackened cocoons." That is a moral act the text never names. Either the burn should cost you the guard on the page, or the guard should never be there to burn.
- **Generated fights still appear in both transcripts** (`gen:lizardfolk+zombie+zombie`, `gen:giant-hyena+bugbear+bandit`, `gen:lizardfolk+ghoul`), despite `maxFights: 0`. The transcripts may be stale, so this needs checking. Each now has a line ("A raider looks up from the fire with his mouth full, and shouts with it") and a parley, which helps. Searches like "A few coins, dropped and forgotten" also still appear. And the den still has a shuttle: Gate↔Empty Tent and outside↔back inside.
- **XP still peaks before the den.** Both runs reach 3rd level before the pit.

#### (2) The most important remaining problems

1. **The captive outcomes are logically incoherent.** As above.
2. **The lore does nothing in play.** `rumor-reeds` hands the player the binding, but `bind-hag-rite` is still a flat Religion DC 15. Hearing the reed-cutter, freeing the carter (who says the same lamb line), or reading the hag's own words in `boss-approach` changes nothing. The best idea in the chapter is still a single die roll.
3. **Killing the hag costs nothing lasting.** The cruel epilogue's fen is as healed as the bound one ("the cold has lifted off the water"). The sequel picks this up (the Warden, opened from the inside), but chapter one says nothing about it.
4. **Law and mercy never meet before the ending.** There is still no scene where the reeve and Mira want different things before `vargan-fate`.

#### (3) Top five recommendations, by impact

1. **Rebuild the captive ledger** (`den-pens-left`, `den-pens-empty`, epilogue lines ~199–233, the `parts.ts` rule at ~393):
   - Leaving them sets `captives-left` only, not `captives-taken`.
   - When the den falls, a party that left them gets the "raiders took them to sell" ending. Only Wren's men can soften that, and only if Wren was saved *and* the pen was never found.
   - Once Vex has named the pen (`PENS_LEAD`), never looking counts the same as leaving.
   - `den-pens-empty` should only fire after day 7. The "moon has gone dark" line needs both `day ≥ 7` and a living or bound hag.
2. **Let lore lower the rite** (`rumor-reeds`, `den-pens`, `BIND_HAG_RITE`):
   - Set `+know-price` from the reed-cutter, and again from the carter's line.
   - With it, drop the DC to 11, or let any class attempt it with Persuasion or Wisdom. With the carter freed and present in spirit ("your gran's price"), let it pass without a roll.
3. **Make the alarm real and readable:**
   - Move "? den-alarm" in `boss-approach` out of `again:`, and swap the boss encounter for a harder variant or add raiders when it is set.
   - Have `gate-slipped` and the bluff branch of `gate-blocked` say plainly that a known face in the den will not risk itself for you.
   - Make a blown signal cost a day and Vex's *price* (a higher Persuasion DC), not Vex outright.
4. **Name what burning the thicket does** (`thicket-burned`). Show the scorched caravan guard, or let a Perception or Medicine check spot the breathing cocoon first and cut him down before the fire. Fire, like the barrow gold, should carry a visible price.
5. **Stage reeve against Mira, and finish the regulars:**
   - Add a short Thornwick scene after `spy-caught` or `spy-caught-loud` where the reeve wants the peddler hanged and Mira argues for him. It teaches the two axes before `vargan-fate`.
   - Rewrite `rumor-magic` and `rumor-tactics` as fen lore: the spring the water rose, why lambs, the barrow under the fen. That also seeds the Sunken Barrows.
   - Give the hag's death a line in the cruel epilogue, such as the shallows staying sour or a midwinter stake left with no one to take the lamb.

---

### Terry Pratchett

I've finished the re-review. I read my earlier section and the summary, all five story files, `hollow-road.ts` and the chapter-one part of both transcripts, and I edited nothing. In short, the prose has been fixed far more completely than the systems: the old wrapper text is gone, but the generated layer still drops in its own fights, and the new alarm and captives flags are set without the rest of the chapter checking them.

#### 1. My earlier complaints

**Fixed:**
- **The generated wrapper (my #1).** The dressing now belongs to the chapter. "Past the last fence-post the road runs out into reeds and black water, and goes on as a line of planks and tussocks" is a road. The den is "tents and cook-smoke and stolen carts". There are no abbeys, Bloodmaw gnolls or hymn numbers left.
- **Backtracking (my #2).** The marsh now runs in a straight line in the rusher run (Trailhead → Tracks → Ravine → Frog Shallows → Mist Hollow → Thicket → Hollow), and the searches that turned up nothing are gone.
- **The regulars as a tutorial (my #6).** `rumor-reeds` is the best addition: "Folk say a lot of things." It seeds the binding without saying it is a solution. The brief called the speaker a woman; in the text he is a man ("his cup"), which is fine either way.
- **The moon clock.** The six nights are now concrete. Mira's "Six, by my count" matches the day-4 line "Three more nights… at most".
- **The Vex continuity bugs.** `vex-turned` now has its own epilogue line, separate from the "ridge" line, so that bug is fixed.

**Not fixed:**
- **Hag contradiction.** In `hollow-won` she still says "The chief and I will be waiting", yet `boss-approach` has her "come up out of her water to see".
- **The town.** The smithy and temple are still menus with no person behind them.
- **The second scout.** She is still only an epilogue line.
- **Generated fights.** These were supposedly removed, but both transcripts, regenerated in the same commit (#398), still contain them:
  - `trail/f1-ambush-m0-m1` (`gen:giant-toad+lizardfolk`)
  - `inner/f1-ambush-m4-m5` (`gen:giant-hyena+orc+orc+bandit`)
  - `inner/f1-fight-key` (`gen:gnoll+scout+giant-hyena+bandit`)

  They are themed now and get one line each ("Something laughs behind the wood pile, high and wrong"). But the den also still rolls an "Armourer's Tent" with "a heavy key", and a tent with a door you "Force… [Athletics DC 15]". The comment in `hollow-road.ts` says the den has "no lock and key of its own", which these runs contradict.
- **Leftover torch.** "your torch" is still in `den-pens-door` and `den-pens`, and "your light" in `barrow`.

**New problems introduced by the fixes:**
- **The alarm contradicts the scene it is in.**
  - The rusher bluffs the warden, so `gate-slipped` sets `den-alarm`. They then pick the water-gate silently, and the den's door line still reads "a camp that thinks it is safe". Two scenes later, Vex says "Every one of them is up and looking for you." Nothing has happened in between to justify it.
  - `den-slipped` has the gate gnolls snoring while the whole den is supposedly on watch.
  - `pens-alarm` (won) sets `+den-alarm` and then says "someone laughs at the noise and goes back to his dice."
- **The alarm changes nothing but Vex's dialogue.** It blocks Vex's offers and adds one prose line in the hall, and that line ("none of them is sitting down") sits under `boss-approach`'s `again:` block. So you only see it after losing the fight once. Nothing in `parts.ts` or `hollow-road.ts` changes an encounter, so the hall is not actually ready.
- **Leaving the captives now costs them on the spot, faster than the clock.** `den-pens-left` sets `+captives-taken` at once. Come straight back and `den-pens-empty` shows webbed footprints, with "the lady in the water came for them" on night two. The carter told you she comes at the dark moon. The penalty is right, but the clock is now wrong. It also makes the epilogue slide "reeve's men… on Wren's word… captives-left, not captives-taken" impossible to reach.
- **Two epilogue slides contradict each other.** If Wren is saved and you never find the pens, both of these fire:
  - "They have the pen open… she is still wearing her one shoe"
  - "It is empty… They are never found"

  The last slide has no check on Wren's fate.
- **Inconsistent alarm triggers.** Going over the wall alarms the den even if the peddler never saw you. Meanwhile the unlucky party camps in an "Empty Tent" inside a raider den, takes a long rest, and nobody minds.

#### 2. Most important remaining problems

1. **Half-built consequence flags.** `den-alarm` and `captives-taken` are set, but the scenes and the epilogue don't read them consistently. The world doesn't hold together when a player pokes at it, which is exactly where it now gets poked.
2. **The generated layer still sets the pace inside the den.** Keys, forced doors, rest stops and filler fights belong to a dungeon, not a stockade.
3. **The climax still collapses to "End them both".** Both transcripts take it. Turning Vargan through the captives requires `pens-settled; not captives-taken`. That is good design, but Vex never steers you there when you meet him after the pens, and an alarmed den takes Vex off the table.
4. **Losing fights.** "You come to outside, dragged clear by whoever was still standing" is generic. Being thrown out of the den and walking back in the same way, with no change, makes the alarm meaningless.

#### 3. Top 5 recommendations, by impact

1. **Make `den-alarm` real everywhere it is set.**
   - Give `inner`'s door line, `den-slipped` and `pens-alarm` (won) versions gated on `den-alarm`.
   - Move the hall line in `boss-approach` out of `again:` so it shows on the first visit.
   - Give `boss` a stronger encounter variant when the alarm is up.
   - Forbid "Make camp" in the den once the alarm is up.
2. **Fix the captives logic.**
   - `den-pens-left` should set `captives-left` only. Let the day-7 dawn take them, or the reeve's men if Wren is saved, so the moon clock stays true.
   - Gate the epilogue's final "never found" slide on `npc wren not fate saved`. As written, it fires alongside the one-shoe rescue slide.
3. **Actually turn off generated fights and lock-and-key rooms** in `trail` and `inner`, and check by regenerating the transcripts. If the engine can't, say so in the spec comment instead of claiming it.
4. **Make the gate-alarm cause visible.**
   - In `gate-slipped`, say the peddler saw you go.
   - For the wall route, add a line where someone on the road sees you.
   - Let catching the peddler afterwards clear `den-alarm`, since he can't report a party that has him in a cell.
5. **Small continuity fixes.**
   - Change `hollow-won`'s "will be waiting" so it suggests she might come up from the water to the fire.
   - Remove the leftover torch lines.
   - Give the smithy keeper one line and a name, as Bram has.
   - Let Wren mention the second scout once in `scout-saved`.

---

### Jennell Jaquays

I re-reviewed chapter one as Jaquays. I edited nothing. All four route transcripts and `docs/balance.md` were regenerated in #398, the same commit as the fixes, so the play evidence below is current.

#### 1. Earlier complaints: fixed, not fixed, and new problems

**Fixed:**
- **The generated places now belong to the chapter.** The transcripts show "The Marsh Road" with rooms like Frog Shallows and Mist Hollow. The den has The Pit, Kennels and A Lone Fire. The leave texts are outdoor ones and the abbey and fire-priest histories are gone. My #1 is done.
- **Every side obstacle now has a non-combat answer that pays XP.** These are `barrow-settled` (Religion 13), `thicket-burned` (Survival 12), the mill smoke (Nature 13) and the `den-hyenas` parley (Animal Handling 12). The rusher took the meat at the kennels. My #5 is half done: the hollow `ambush` is still only a Perception roll to decide who is surprised.
- **The spy is no longer the only way out of town.** `gate-blocked` now offers a bluff (Deception 13, one try) and the wall (Stealth 12, one try, costs a day). Both set `den-alarm`. If both fail you are back to catching the spy, which is fine.
- **The clock and the lore.** "Six, by my count" now comes in `tavern-meet`, and the reed-cutter's lamb at the regulars' table (`rumor-reeds`) seeds the hag's price.

**Not fixed:**
- **The marsh lock still needs both flags.** `trail.lock` requires `trail-read` AND `crossed-ravine`. On a spine that means less backtracking, but there is still no choice of route.
- **The den is still one corridor.** It has one entry room (m0 Gate) whichever way you got in, no loop, and no back way into the hall.
- **Factions still don't change the map.**
- **The XP curve still peaks before the den.** The completionist reaches 3rd at `thicket-fight`, still on the marsh. The rusher reaches it at `den-picked` and the unlucky route at `gate-caught`. Every den fight after that pays nothing. The balance numbers are still upside down: `den-pit` is 100%/100% (EASY), while `kennel-hyenas` is 80% fresh and 20% worn, `pen-watch` is 47% worn, and `ashfang-hall` is 13% worn.

**Fixes that introduced new problems:**
- **Filler fights were not actually removed.** `maxFights: 0` left two kinds of generated fight in place:
  - Corridor ambushes: `trail/f1-ambush-m0-m1` (gen:lizardfolk+zombie+zombie) and `inner/f1-ambush-m4-m5` (gen:giant-hyena+orc+orc+bandit, right outside the hall).
  - A key guard: `inner/f1-fight-key`, which ends "One of them carried a heavy key", in a den whose spec says it has no lock and key.
  
  Corridor ambushes pay no XP, but the key fight still does. The merciful route went from 2nd to 3rd by parleying it, so a generated fight levelled the party, not the story.
- **`den-alarm` contradicts itself.** In the rusher route, the party bluffs out of Thornwick (`den-alarm` set) and then picks the water-gate silently. `GATE_PASSED` sets `den-quiet`, and the yard reads "a camp that thinks it is safe". Then at A Lone Fire, Vex says "The whole den knows you're here." A flag set in town overrides a perfect infiltration. The town escape should make the gate harder. It should not cancel a quiet entry after the fact.
- **The alarm costs a hidden price and gives no warning.** `VEX_OFFERS` hides every turn option under `den-alarm`, which also drops the XP for skipping `ashfang-hall` and `ashfang-warlord-alone`. So the bluff out of town quietly costs you Vex, Hask and a big XP award. Meanwhile the gate's DCs don't read the alarm at all: the water-gate is still DC 10.
- **The hall's alarm line is almost never seen.** `? den-alarm | The hall is full of raiders…` sits under `again:` in `boss-approach`, so it shows only on a return visit. It also changes nothing mechanically: it is the same `ashfang-hall` encounter either way.
- **A locked door appears on a spine with no keys.** The rusher had to "Force the door to A Lone Fire [Athletics DC 15]". That was generated filler with no fiction behind it.

#### 2. The biggest problems that remain

- **The den is a hallway with set pieces along it.** Every entry lands at m0. The Pit, the Kennels and Vex are visited in generator order. The way you came in (`den-picked`, `den-slipped`, `gate-fight`) makes no difference to where you are.
- **Alarm is one flag that only removes things.** It costs you Vex and adds nothing new: no extra guards at the gate, no changed hall roster, no hag on watch.
- **The level cap of 3 wipes out the den's rewards.** Clever play on the marsh (the new XP-paying answers) gets you to 3rd sooner, so the den's answers pay nothing. The fixes made this worse.
- **The Pit is a pushover and the optional rooms are the killers.** The pacing runs backwards.
- **The hollow is still one roll.** It is the marsh's climax, and its only branches are who gets surprised.

#### 3. Top 5 recommendations, by impact

1. **Make `den-alarm` consistent and give it teeth.** Split it in two:
   - `den-warned` (from the spy loose, the bluff or the wall) raises the gate DCs (water-gate 13, wall 15, signal gone) and adds a second watch to `gate-fight`. A quiet entry clears it: `GATE_PASSED` should cancel the warning, not leave it in force.
   - `den-roused` (from `gate-fight`, `gate-caught`, `pens-alarm`, `gate-signal-blown`) shuts Vex out and swaps `boss` for a heavier encounter.
   
   Also move the "hall is full of raiders" line out of `again:`.
2. **Finish removing the filler.** Strip `f1-fight-key` and the corridor ambushes from `inner` and `trail`, or drop `maxFights: 0` and stop pretending. Also delete the generated locked door. Re-run balance afterwards.
3. **Give the den alternate entries and a back way.** Land `den-picked` at the Pens or Kennels, `den-slipped` at A Lone Fire, and `gate-fight` at The Pit. Open a drain or back passage into The Chief's Hall, from `vex-turned` or `den-pens-freed` (the carter knows it). Using it should skip `inner/f1-ambush-m4-m5` and The Pit.
4. **Fix the XP curve.** Either cut the marsh payouts (the 30 XP at `ravine` and the 20 at `tracks`, and pay the side answers' avoided XP at half), or raise `levelBand.to` to 4 with the hall tuned for it. Make `den-pit` the real climax and soften `kennel-hyenas` and `pen-watch` from about 20% worn up to about 60%.
5. **Give the marsh a real choice.** Replace the two-flag lock with one lock and two keys, `trail-read` OR `crossed-ravine`, each opening its own approach to The Hollow (dry line or sinkholes). Give `ambush` a non-combat answer, such as Wren's route, a cold-water/brand trick on the thralls, or a Nature or Arcana read of the brand that turns them back.
