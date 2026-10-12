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
