# The Hollow Road

_Break the Ashfang raiders — through the village, the marsh, and their den. By blade or by wit._

Levels 1–3 · start `road` · 72 scenes

---

## Scenes

### `road` — story

**Text**

A day's hard walk up the valley. The country has gone wrong-quiet. The road holds no carters and no herders. Only crows lift off the hedgerows as you pass. <sub>(grade 2.7)</sub>

Thornwick lies an hour ahead, its chimney-smoke thin against the grey hills. You carry the reeve's bounty folded in your pack. The plea that hung beneath it is why you kept walking. <sub>(grade 3.7)</sub>

Then the hedges shift on both sides at once — and it's already too late to run. <sub>(grade 3.9)</sub>

**Choices**

- → Draw steel  → `road-ambush`

### `road-ambush` — battle

_Fight: raiders-forward on open_

**Intro**

Raiders scramble out of the ditch. An orc hefts a notched axe. A lean scout nocks an arrow. A bandit is already grinning. <sub>(grade 2.0)</sub>

"The road's the **Ashfang's** now!" the bandit crows. "Chief takes his cut of every throat on it — and yours'll do just fine." <sub>(grade 1.2)</sub>

**On win**

> The last of them drops into the mud. The road is yours again — for now. <sub>(grade 0.7)</sub>

### `road-reveal` — story

**Text**

The bandit isn't dead yet. He laughs wetly through red teeth as you stand over him. <sub>(grade 1.5)</sub>

"You think you've done something? We're a hundred strong in the hollow — and the **chief**, he don't even answer to himself no more. There's something *in the marsh* he feeds, and it feeds him back. The **Ashfang** own this whole valley now, and worse than us owns them." <sub>(grade 3.6)</sub>

His eyes drift to the hills, to a thin smudge of smoke rising somewhere past the marsh. Then they drift to nothing at all. <sub>(grade 3.3)</sub>

**Choices**

- → Press on to Thornwick  → `thornwick`

### `thornwick` — story

**Text**

You limp the last mile into **Thornwick** — gate scorched, shutters barred, faces watching you pass from the dark of doorways. <sub>(grade 7.6)</sub>

So the raiders on the road told it true. For a month the **Ashfang** have bled this valley dry. The whole country has learned to lock its doors by dark. <sub>(grade 2.1)</sub>

The reeve's bounty is what you came for. But it was the plea nailed beneath it, in a shakier hand, that made you keep walking: "Help us. There is no one else." <sub>(grade 1.8)</sub>

**Choices**

- → Enter the Wander-Inn  → `tavern`

### `tavern` — dialogue

_Speaker: Mira the Innkeeper_

**Lines**

Inside the **Wander-Inn** the fire is low and the talk lower. A broad woman with flour to the elbow sets down her cloth, looks you over once, and evidently decides you'll do. <sub>(grade 6.5)</sub>

"Sellswords. Good." **Mira** doesn't smile — you get the feeling she keeps it somewhere safe, for special occasions. "The reeve's too proud to beg, so I do it for him. Sit." <sub>(grade 2.1)</sub>

"The **Ashfang** came down the **marsh road**, out past the reeds. Everyone knows that much. Knowing it never once filled a burned cart back up. But there's more — the kind folk won't say with the door open." <sub>(grade 1.7)</sub>

**Choices**

- → `[insight DC 12]` [Insight DC 12] Read what she isn't saying _(once)_  → `tavern-spy`
- → `[persuasion DC 12]` [Persuasion DC 12] Buy the whole room a round _(once)_  → `tavern-trail`
- → Just ask the road to the den _(once)_  → `tavern-plain`
- → Drift over to the regulars' table  → `regulars`
- → Take a room for the night — 1 gold (long rest)  → `inn-rest`
- → Step out into the square  → `square`

### `inn-rest` — rest

**Intro**

You take a room above the taproom. For the first time in days you sleep behind a bolted door — and wake clear-headed, wounds closed, spells fresh. <sub>(grade 3.1)</sub>

→ `tavern`

### `tavern-spy` — story

**Text**

**Mira** reads the doubt on your face and lowers her voice until it barely carries over the fire. <sub>(grade 7.8)</sub>

"The **Ashfang** always seem to know which wagon's worth taking. Someone here feeds them word of every caravan that leaves — and I think I know who." <sub>(grade 5.4)</sub>

"There's a **furtive peddler** who sets up by the **market**, near the gate. Sells nothing, buys nothing, but he's there every time a train rolls out. Watch him. If anyone's carrying word to the raiders, it's him." <sub>(grade 3.0)</sub>

**Choices**

- → Back to your table  → `tavern`

### `tavern-trail` — story

**Text**

A round on your coin loosens the whole room. An old trapper drags a finger through spilled ale, sketching the **marsh road** across the bar. <sub>(grade 3.9)</sub>

"Here's the reeds, here's the black water — and here," he taps a hollow in the hills, "is where their smoke rises of a morning. That's your den. Mind, the **trail** bites back long before you reach it." <sub>(grade 2.3)</sub>

**Choices**

- → Back to your table  → `tavern`

### `tavern-plain` — story

**Text**

"The marsh road, then. Mind yourself." She turns back to her taps. <sub>(grade -1.2)</sub>

**Choices**

- → Back to your table  → `tavern`

### `regulars` — story

**Text**

Thornwick's older hands have claimed the long table by the fire — the sort who've survived enough to have firm opinions about how. They'll talk your ear clean off, if you let them. Some of it might even keep you breathing. <sub>(grade 4.4)</sub>

**Choices**

- → Ask the old sergeant how a real fight goes _(once)_  → `rumor-tactics`
- → Ask the hedge-witch about working spells _(once)_  → `rumor-magic`
- → Ask the caravan veteran about her axe _(once)_  → `rumor-weapons`
- → Leave them to their ale  → `tavern`

### `rumor-tactics` — story

**Text**

A grey-bearded man with a soldier's too-straight back taps the boards. "Rule one, and it's the reason I've still got both legs: don't turn your back on a man with a blade in reach. Step away careless and he gets a free cut at you — an *opportunity*, they call it. They don't miss those the way they miss in a fair fight." <sub>(grade 4.5)</sub>

"Want out of a scrap without the parting gift? *Disengage* — costs you your whole action, but you walk clear and nobody swings. Especially you wand-wavers: get clear before you start your muttering, or you'll be eating steel halfway through the word." <sub>(grade 6.7)</sub>

**Choices**

- → Nod your thanks  → `regulars`

### `rumor-magic` — story

**Text**

A woman with river-stones braided into her hair doesn't look up from her knitting. "Magic's never free, whatever the college boys tell you. Your real spells burn *slots*, and you've precious few. Spend them like your last coppers — because in a long fight, that's what they are." <sub>(grade 4.3)</sub>

"And the strong workings. A held foe, a ward of blades. You've to *concentrate* to keep them lit. Take a hard knock and you'd best hold your focus or the whole thing comes apart in your hands. Can't hold two at once, either. So pick the one that'll matter." <sub>(grade 1.3)</sub>

**Choices**

- → Nod your thanks  → `regulars`

### `rumor-weapons` — story

**Text**

A scarred caravan guard rolls her axe over on the table. "Every weapon's got a trick in it, if you know how to ask. A heavy blade *cleaves* — bite one man and the swing carries on into the next. A flail'll *sap* a foe, so the next of your lot to hit him lands the easier." <sub>(grade 4.0)</sub>

"Learn what the thing in your hand actually *does*, and you'll put down men a brute twice your size never lays a finger on. It's not the size of the axe, love. It's knowing where the grain runs." <sub>(grade 2.7)</sub>

**Choices**

- → Nod your thanks  → `regulars`

### `square` — explore

**Map: Thornwick Square**

- **The Wander-Inn**  → `tavern`
- **Market**  → `market`
- **Notice Board**  → `board`
- **The Old Mill**  → `mill`
- **Furtive Peddler**  → `spy-confront`
- **Leave for the Marsh Road**  → `trailhead`

### `market` — shop

_Speaker: Bram the Quartermaster_

**Intro**

"Coin's coin, and I'll not ask where yours has been." **Bram** plants both hands on the stall. "Buying, or selling? Prices are honest — a dead customer never comes back for more, and I do like the repeat trade." <sub>(grade 2.1)</sub>

→ `square`

### `board` — story

**Text**

A bounty, nailed up and gone grey at the edges. The reeve will pay good coin for proof the **Ashfang chief** is dead. He will pay better coin still for their banner brought back whole. <sub>(grade 2.4)</sub>

Someone has added a line at the bottom in a smaller, prouder hand — *"Thornwick does not beg. It pays its debts."* That ink is newer than the rest. <sub>(grade 2.4)</sub>

**Choices**

- → Take the reeve's retainer up front (25 gold) _(once)_  → `square`
- → Leave it for now  → `square`

### `spy-confront` — dialogue

_Speaker: The Peddler_

**Lines**

The peddler's stall is a marvel of things nobody wants — chipped buttons, one good boot, a birdcage with no bird. He watches the gate the way a cat watches a mousehole. <sub>(grade 5.7)</sub>

When your shadow falls across his goods he goes very still. Then he does the last thing you expected of a man selling buttons. He puts two fingers to his teeth and *whistles*. All round the square, the wrong sort of people start setting down their drinks. This won't end with words. <sub>(grade 2.5)</sub>

**Choices**

- → `[investigation DC 13]` [Investigation DC 13] Pick his crew out of the crowd first _(once)_  → `spy-ambush`
- → `[intimidation DC 14]` [Intimidation DC 14] Shout down the hired help before they close _(once)_  → `spy-ambush`
- → Put your backs to the wall and draw  → `spy-bolts`

### `spy-caught` — story

**Text**

With his hired knives down, the peddler makes it four steps before you run him down. Under the false bottom of his cart: a tally of every caravan to leave Thornwick in a month, in a hand that isn't his. He folds like wet paper. "I only carried word. I never lifted a blade!" And, babbling, he gives it up: **the raiders' gate-signal. You can walk into the den wearing their own password.** <sub>(grade 3.8)</sub>

**Choices**

- → Hand him to the reeve  → `square`

### `gate-blocked` — story

**Text**

The gate-warden lays his spear across the road and shakes his head, not unkindly. "Reeve's orders, and for once they're sound ones. Nobody leaves while the Ashfang still keep a whistler in the **market**, counting who comes and goes. Deal with that first — then the road's yours." <sub>(grade 4.3)</sub>

**Choices**

- → Back into the square  → `square`

### `mill` — dialogue

_Speaker: Osk the Miller_

**Lines**

The mill's sails hang still, and the miller meets you at a barred door with a boat-hook in both hands. "Not raiders, this one. Something's roosting in my hedgerows — turned my dog stiff as a fencepost. *Stone*, you understand. Won't nobody come near the mill now, and the grain's standing." <sub>(grade 3.7)</sub>

"Clear them out and there's coin in it. Just — don't let the ugly things *touch* you." <sub>(grade 0.1)</sub>

**Choices**

- → Beat the hedgerows  → `mill-fight`
- → Another time  → `square`

### `mill-fight` — battle

_Fight: cockatrice-flock on open_

**Intro**

Two bat-winged things explode out of the hedge in a fury of beak and scale — cockatrices, ugly as sin and twice as mean. Mind the bite: flesh that takes it goes to stone. <sub>(grade 5.1)</sub>

**On win**

> The last cockatrice flops still. The miller pays up gladly, prods the stone dog, and allows that it makes a fair garden ornament. <sub>(grade 4.8)</sub>

### `mill-done` — story

**Text**

The mill's sails are turning again. The miller waves from the door — and the stone dog keeps its vigil by the gate, forever pointing at nothing. <sub>(grade 4.9)</sub>

**Choices**

- → Back to the square  → `square`

### `spy-bolts` — battle

_Fight: cutpurses on village_

**Intro**

His crew shoulders out of the market crowd — a fixer and two hired knives, blades already low and level. No surprises left; just the work. <sub>(grade 4.4)</sub>

**On win**

> The last of the hired help drops his knife and his nerve together, and runs. <sub>(grade 3.6)</sub>

### `spy-ambush` — battle

_Fight: cutpurses on village_

**Intro**

You had them marked before the whistle finished. When the crew moves in from the stalls, you're already where they didn't expect you — and they scramble, a beat behind. <sub>(grade 5.1)</sub>

**On win**

> Wrong-footed from the first, the crew never finds its feet. The last of them throws down and bolts. <sub>(grade 1.0)</sub>

### `trailhead` — story

**Text**

The peddler is in the reeve's cells now. The gate-warden stands aside, and **Thornwick** falls away behind you. Ahead the road narrows toward the **marsh**. It is a ribbon of mud between black water and whispering reeds. <sub>(grade 4.9)</sub>

Somewhere out in that maze the **Ashfang** keep their den. Somewhere a good deal closer, it seems, they keep their eyes on the road. <sub>(grade 4.3)</sub>

**Choices**

- → Set out on the marsh road  → `road-out`

### `road-out` — battle

_Fight: goblin-outriders on open_

**Intro**

Barely a mile from the gate, the reeds erupt. The Ashfang keep goblin outriders on the road, and word of you has run ahead. A wiry goblin boss lopes out in front of his pack. His scimitar is bared, and he cackles something in Goblin that needs no translation. <sub>(grade 5.6)</sub>

**On win**

> The last of the pack breaks and vanishes into the reeds. Behind you Thornwick; ahead, the marsh swallows the road whole. You feel steadier on your feet than a week ago — hardened, and a shade deadlier. <sub>(grade 4.2)</sub>

### `trail` — explore

**Map: The Marsh Road**

- **Fresh Tracks**  → `tracks`
- **A Cry for Help** — _unvisited: “A faint sound…”_  → `wounded`
- **A Sunken Barrow** — _unvisited: “A low mound…”_  → `barrow`
- **Webbed Thicket** — _unvisited: “Pale shapes in the reeds…”_  → `thicket`
- **Sunken Ravine**  → `ravine`
- **The Hollow Ahead**  → `ambush`

### `tracks` — check

_Check: survival DC 12_

**Intro**

Boot-prints and drag-marks cross the mud. Read them right and the maze unravels. <sub>(grade 2.4)</sub>

**On success**

> The tracks tell their whole story: a heavy patrol out at dusk, a lighter one back at dawn, always the same dry line through the reeds. You've found the **safe path to the hollow** — and you'll see the raiders before they see you. <sub>(grade 7.1)</sub>

**On failure**

> The prints tangle and double back on themselves until your eyes water. Still — they point, roughly, toward the hills. You'll find the den, but you'll be walking in blind. <sub>(grade 3.6)</sub>

### `tracks-done` — story

**Text**

The mud has told you all it can — you now hold the patrols' dry line through the reeds fixed in your memory. Nothing new has passed this way since. <sub>(grade 3.5)</sub>

**Choices**

- → Back to the trail  → `trail`

### `hollow-quiet` — story

**Text**

The hollow lies quiet where you broke the Reedwife's ambush — only flattened reeds and still black water remain. The den's wooden wall waits ahead. <sub>(grade 5.8)</sub>

**Choices**

- → On to the den gate  → `gate`

### `ravine` — challenge

**Intro**

A collapsed ravine cuts the trail. The far side is close — but the gap is loose stone and broken rock. There's more than one way across. <sub>(grade 1.4)</sub>

**On failure**

> Every way across fights you. In the end you give up the hour and take the long, muddy detour — bruised and behind schedule. <sub>(grade 4.8)</sub>

**Approach: Climb it head-on** `[athletics DC 13]` — _Muscle up the sheer face — fastest, if you don't fall._

**… success**

> You haul the party up and over hand over hand. The shortcut is yours. <sub>(grade 2.3)</sub>

**… failure**

> A hold crumbles and you slide back down in a clatter of stone. That way will not work. <sub>(grade 1.0)</sub>

**Approach: Pick across the rubble** `[acrobatics DC 12]` — _Balance over the loose stone where it has fallen shallowest._

**… success**

> Light on your feet, you thread the shifting stones and reach the far lip. The shortcut is yours. <sub>(grade 1.0)</sub>

**… failure**

> The loose stone gives all at once and you scramble back before it takes an ankle with it. <sub>(grade 5.2)</sub>

**Approach: Find the long way round** `[survival DC 11]` — _Read the ground for a safe line — slower, but no broken bones._

**… success**

> You trace a gentler slope downstream and lead the party around dry-shod. It costs time, but nothing else. <sub>(grade 3.7)</sub>

### `ravine-done` — story

**Text**

The broken ravine lies behind you now, already crossed. Nothing waits here but the wind over the loose stone. <sub>(grade 4.3)</sub>

**Choices**

- → Press on  → `trail`

### `wounded` — dialogue

_Speaker: Wounded Scout_

**Lines**

A young scout in the reeve's colours lies pinned under a dead horse, an arrow through her leg, her jaw set hard against the pain. "I'm fine," she says — a lie you can see from here. "Get the horse off me and I'll tell you everything. How they're set, where they watch. I counted. That's the job." <sub>(grade 1.4)</sub>

**Choices**

- → `[medicine DC 12]` [Medicine DC 12] Ease her out and bind the leg _(once)_  → `scout-saved`
- → No time to spare her — press on  → `trail`

### `scout-saved` — story

**Text**

The horse comes off and the bleeding stops, and the scout lets out a breath she looks like she'd been saving all week. "**Wren**," she offers, as if admitting to a name costs her something. She scratches the den's watch-posts into the mud, quick and exact. She really did count. <sub>(grade 3.7)</sub>

"One thing more, and then I owe you twice over." She catches your wrist. "There's a man in there hates the chief worse than you do — **Vex**, the lieutenant. Offer him a way out when you reach his fire, and he might stand his guards aside instead of setting them at your throat." <sub>(grade 3.2)</sub>

**Choices**

- → Send Wren back to Thornwick  → `trail`

### `scout-fail` — story

**Text**

Your hands aren't enough; she fades before she can say much. She presses a token into your palm — the reeve will know it. <sub>(grade 3.3)</sub>

**Choices**

- → Cover her and go  → `trail`

### `scout-gone` — story

**Text**

The dead horse still lies across the trail, flies rising in the heat. Of the scout there's no sign — dragged home, or into the reeds. Nothing more remains for you here. <sub>(grade 2.1)</sub>

**Choices**

- → Move on  → `trail`

### `spy-gone` — story

**Text**

The peddler's stall stands bare, its awning taken down. The reeve's men came for him at first light; the square has already moved on. <sub>(grade 3.3)</sub>

**Choices**

- → Turn back to the square  → `square`

### `barrow` — story

**Text**

Half-swallowed by the reeds is a barrow-mound older than any kingdom you could name. Its capstone is cracked and weeping cold air. The marsh has been chewing at it for centuries. Lately, something has been chewing back out. <sub>(grade 4.9)</sub>

Grave-goods glint in the dark below. So does something that moves without touching the water. <sub>(grade 5.4)</sub>

**Choices**

- → Go down into the dark  → `barrow-fight`
- → Leave the dead their peace  → `trail`

### `barrow-fight` — battle

_Fight: specter-haunt on corridor_

**Intro**

The cold answers you. Two shapes pour up out of the grave-earth. They were men once, and now they are nothing but spite and winter air. They pass *through* the barrow stones to reach you. <sub>(grade 1.6)</sub>

**On win**

> The specters shred into cold mist. Among the grave-goods you find honest silver — and leave the rest, on balance, where it lies. <sub>(grade 4.8)</sub>

### `barrow-done` — story

**Text**

The barrow lies quiet now, its cold spent. Whatever walked here walks no more. <sub>(grade 2.3)</sub>

**Choices**

- → Back to the trail  → `trail`

### `thicket` — story

**Text**

The reeds ahead are wrong — sheeted in pale silk, gone grey and still. Bundles hang in the webbing at the height a man's shoulders would be. Some of the bundles are man-shaped. <sub>(grade 3.0)</sub>

Whatever spins here has been eating well off the Ashfang's road. It is not small, and there is more than one of it. But those cocoons will have purses. <sub>(grade 2.0)</sub>

**Choices**

- → Cut your way in  → `thicket-fight`
- → Give the webs a wide berth  → `trail`

### `thicket-fight` — battle

_Fight: spiders on marsh_

**Intro**

The silk trembles — then the reeds themselves seem to stand up and walk. Giant spiders, four of them, drop from the high webbing on every side. They are quick, and their bite carries venom. <sub>(grade 3.4)</sub>

**On win**

> The last spider curls in on itself like a burnt glove. The cocoons hold two dissolved raiders, their purses intact. There is also one caravan guard, still breathing. He does not stop thanking you until the reeds swallow the sound. <sub>(grade 3.9)</sub>

### `thicket-done` — story

**Text**

The torn webs hang slack and grey. Nothing spins in the thicket now. <sub>(grade 0.6)</sub>

**Choices**

- → Back to the trail  → `trail`

### `bog-toads` — battle

_Fight: toad-swamp on bog_

**Intro**

The black water bulges, then heaves. A pair of giant toads haul themselves onto the mud bank. Each is wider than a shield, and faster than anything that size should be. A tongue lashes out for the nearest of you. <sub>(grade 2.8)</sub>

**On win**

> The last toad shudders and goes still, half in the water. You scrape the slime off and press on — the ravine still waits. <sub>(grade 2.2)</sub>

### `camp-ambush` — battle

_Fight: marsh-dead on bog_

**Intro**

You wake to the wrongness before you hear it — a wet, dragging sound in the dark. The marsh gives up its dead: two ghouls claw up out of the mire, jaws working, and come for the firelight. No time to ready anything — you fight with what you've got. <sub>(grade 4.7)</sub>

**On win**

> The dead lie still again — but the night's ruined, and no one's resting now. You got no good of that rest; you'll have to bank the fire and try again, if you dare. <sub>(grade 3.7)</sub>

### `ambush` — check

_Check: perception DC 13_

**Intro**

The hollow opens below — and the reeds are wrong. Too still, and cold where the marsh should be warm. Shapes crouch there that are neither raider nor beast. Scaled things wait in the shallows, listening for a word. Who spots the trap first decides everything. <sub>(grade 2.9)</sub>

**On success**

> You catch the gleam of an eye among the reeds a breath before it moves. The trap is yours to spring. <sub>(grade 1.4)</sub>

**On failure**

> A hiss, a ripple — and the reeds come alive all at once. Too late. <sub>(grade 0.6)</sub>

### `ambush-turned` — battle

_Fight: hag-thralls on bog_

**Intro**

You strike first. A hunting-party of **lizardfolk** rises from the water where they lay. Driven, herded, a monstrous toad lumbering at their backs. For a heartbeat they don't even see you. Whatever bound them here, it did not teach them to watch their own flank. <sub>(grade 3.4)</sub>

**On win**

> The last of the marsh-folk sinks back into the black water it came from. <sub>(grade 4.2)</sub>

### `ambush-sprung` — battle

_Fight: hag-thralls on bog_

**Intro**

The reeds erupt around you. **Lizardfolk** rush in with hooked spears. A giant toad heaves up through the muck. All of it moves with one dreadful purpose, as if a single hand worked them like puppets. <sub>(grade 2.3)</sub>

**On win**

> Bloodied, you break them at last. The marsh-things fall still. <sub>(grade 0.5)</sub>

### `hollow-won` — story

**Text**

You turn the nearest body with your boot. Branded into the scaled hide, still weeping: a crude mark of reeds and a reaching hand. These weren't raiders. Someone *owned* them, and marked them like cattle. <sub>(grade 2.7)</sub>

Then a voice comes drifting across the water — old, and wet, and amused. "Vargan's little dogs, off their leash. No matter. Come up to the fire, sweetlings. The chief and his **Reedwife** have been expecting you." The reeds shiver, and go quiet. **So that is the Ashfang's secret: a green hag of the marsh, and a chief who sold his people's home to her for coin and cruelty.** <sub>(grade 2.9)</sub>

**Choices**

- → On to the den  → `gate`

### `gate` — story

**Text**

A wooden wall of lashed timber rings the hollow. A watch-post looms over the only gate. Beyond: the chief. <sub>(grade 3.0)</sub>

**Choices**

- → Give the stolen watch-signal  → `inner`
- → `[stealth DC 13]` [Stealth] Slip over the wall (whole party)  → `inner`
- → Storm the gate  → `gate-fight`

### `gate-fight` — battle

_Fight: den-gate on corridor_

**Intro**

A horn brays from the watch-post, and the gate-runners answer. A hulking bugbear ducks through the gateway. Behind him two gnolls come yammering that awful laughing bark. The narrow timber run hems all three in. <sub>(grade 5.0)</sub>

**On win**

> The bugbear goes down last, folding across the gateway. The path in is open — though the whole den is awake and shouting now. <sub>(grade 5.3)</sub>

### `inner` — explore

**Map: Inside the Den**

- **The Gathering Yard**  → `den-yard`
- **Back to the Marsh Road**  → `den-retreat`
- **Plunder Tent** — _unvisited: “A guarded tent…”_  → `cache`
- **The Kennels** — _unvisited: “Something's snarling…”_  → `kennel`
- **The Pit** — _unvisited: “Chains and firelight…”_  → `den-muster`
- **Vex's Fire** — _unvisited: “A lone fire, apart…”_  → `vex-parley`
- **The Chief's Hall**  → `boss-approach`

### `den-yard` — story

**Text**

Inside the wooden wall the Ashfang den sprawls around a central fire-pit. Tents and drying-racks churn together. Over it all hangs the reek of a place that has never once been clean. <sub>(grade 4.8)</sub>

Directly ahead, a staked ring of trampled mud: **the pit**, where a chained shape heaves against its irons in the firelight. Past it, apart from the rest, a single small fire burns — someone keeping their own counsel. The chief's hall looms beyond, and behind you the gate still opens onto the marsh road, if it comes to that. <sub>(grade 7.0)</sub>

**Choices**

- → Take stock of the camp  → `inner`

### `den-retreat` — story

**Text**

You slip back out through the gate the way you came. The marsh road stretches behind the den. Here you can catch your breath, sort your gear, or bank a fire in the reeds before you go back in. <sub>(grade 1.9)</sub>

**Choices**

- → Out to the marsh road  → `trail`

### `den-muster` — battle

_Fight: den-muster on ruins_

**Intro**

The chained shape in the pit is an **ogre** — half-starved, whip-scarred, and utterly beside itself with rage. Two orc goaders work its temper with barbed poles, and when they see you they grin and haul the pins. <sub>(grade 6.3)</sub>

"Fresh meat for the pit!" one bellows, and slips the ogre's chain. <sub>(grade -0.5)</sub>

**On win**

> The ogre crashes down across its own broken chains, and the goaders don't outlive it by much. The pit is quiet. Whatever the Ashfang were, they were cruel to their own monsters too. <sub>(grade 3.7)</sub>

### `muster-done` — story

**Text**

The pit stands empty, its chains slack in the churned mud. Nothing moves here but the fire-shadows. <sub>(grade 3.0)</sub>

**Choices**

- → On through the camp  → `inner`

### `den-camp-ambush` — battle

_Fight: raiders-forward on corridor_

**Intro**

You've barely banked the fire when a watch-patrol rounds the tents — an orc and two hired blades, blinking in the firelight, already shouting the alarm. So much for rest. <sub>(grade 6.3)</sub>

**On win**

> You put the patrol down before the whole camp wakes — but the night's gone, and you got no rest of it. Bank the fire and try again, if you dare. <sub>(grade 3.6)</sub>

### `kennel` — story

**Text**

A staked-out run of gnawed bones and rank straw — the Ashfang keep hunting-beasts. Two giant hyenas lunge to the ends of their chains at the sight of you, and a gnoll handler reaches for the pins to loose them. <sub>(grade 5.9)</sub>

**Choices**

- → Put them down before they're loosed  → `den-hyenas`
- → Back away slowly  → `inner`

### `den-hyenas` — battle

_Fight: kennel-hyenas on open_

**Intro**

The handler yanks the pins. The hyenas come off their chains in a scrabble of claws and that awful laughing yammer. <sub>(grade 3.7)</sub>

**On win**

> The kennel falls quiet. Among the straw and bones: a raider's stashed purse and a half-eaten satchel worth the trouble. <sub>(grade 4.8)</sub>

### `kennel-done` — story

**Text**

The kennels stand silent now, chains slack in the mud. Nothing left here but flies. <sub>(grade 1.5)</sub>

**Choices**

- → Back to the den  → `inner`

### `cache-done` — story

**Text**

You already turned the plunder tent over yourself. Only torn sacking and broken crates remain. <sub>(grade 6.2)</sub>

**Choices**

- → Back to the den  → `inner`

### `cache` — check

_Check: investigation DC 12_

**Intro**

A tent of stolen goods, hastily hidden. A careful search turns up the best of it. <sub>(grade 3.8)</sub>

**On success**

> Beneath the junk: real coin and a caravan's lost potions. <sub>(grade 4.8)</sub>

**On failure**

> You grab what's in reach before the noise draws eyes. <sub>(grade 2.5)</sub>

### `vex-parley` — dialogue

_Speaker: Vex, the Lieutenant_

**Lines**

At the lone fire a lean, grey-templed raider watches you come — bared blade across his knees, held like a man who'd rather be leaning on it. "**Vex**," he offers, unprompted. "The chief's lieutenant, for my sins. He sent his best to die at the gate; I notice he didn't send me." A thin smile, gone as fast. "You've come this far through his people. So — what do you offer a man for stepping aside?" <sub>(grade 2.9)</sub>

**Choices**

- → `[persuasion DC 13]` [Persuasion DC 13] Offer him the chief's seat, once it's empty _(once)_  → `vex-turned`
- → `[intimidation DC 14]` [Intimidation DC 14] Point out his one other way out _(once)_  → `vex-turned`
- → Refuse to deal with a raider  → `inner`

### `vex-turned` — story

**Text**

Vex weighs it, then slides the blade home. "The chief's guards answer to me, not him. They'll find somewhere else to be — this once." He steps back into the smoke, unhurried. "Do it properly. I'm tired of soldiering for a man who burns barns and calls it strategy." <sub>(grade 2.3)</sub>

**Choices**

- → On to the chief  → `inner`

### `vex-refuses` — story

**Text**

Vex studies you a long moment, then shakes his head, almost sorry about it. "No. You'd hang me the morning after, and we both know it." He melts back into the dark. "Pity. I'd have made a better chief than either of us." You'll meet his blade again — at the warlord's side. <sub>(grade 2.1)</sub>

**Choices**

- → Press on  → `inner`

### `vex-done` — story

**Text**

Vex's little fire still burns, but the man himself is done talking — either your ally now, or your enemy at the throne. There's nothing left to say here. <sub>(grade 5.0)</sub>

**Choices**

- → On through the camp  → `inner`

### `boss-approach` — story

**Text**

The chief's hall reeks of smoke and old blood. Trophies of a hundred raids hang from the rafters — a child's shoe, a miller's ledger, a reeve's chain. <sub>(grade 3.2)</sub>

The **Ashfang** warlord rises from a throne of lashed spears, axe already in hand. And in the shadows behind the throne something else unfolds — long and green and grinning, river-weed in its hair, fingers too many and too long. The **Reedwife**, the green hag of the marsh, come up out of her water to see how her investment fares. <sub>(grade 7.5)</sub>

"You've been *busy*," she says, delighted, and the warlord's guards set their feet at a flick of her hand. For a heartbeat the whole hall waits to see what you'll do. <sub>(grade 4.2)</sub>

**Choices**

- → End them both — Vex's guards stand aside  → `boss-unguarded`
- → End them both  → `boss`

### `boss` — battle

_Fight: ashfang-warlord on firepit_

**Intro**

"You've cost me a good season," the warlord says, almost mild, and rolls the great axe off his shoulder. Beside him the hag only laughs, low and pleased, her fingers already weaving something cold out of the smoke. "Oh, don't kill them quickly," she tells him. "Waste not." <sub>(grade 4.1)</sub>

**On win**

> The warlord falls, and the **Reedwife** comes apart like wet reeds in a fist, her laughter curdling to a wail that sinks back into the marsh. The **Ashfang** are broken — root and branch. <sub>(grade 5.5)</sub>

### `boss-unguarded` — battle

_Fight: ashfang-warlord-alone on firepit_

**Intro**

The warlord bellows for his guard. Nothing answers. Somewhere back in the smoke, Vex is looking the other way on purpose. <sub>(grade 4.0)</sub>

"You've cost me a good season," the chief says anyway, almost mild, and rolls the great axe off his shoulder. The hag's laughter falters, just once, counting the blades that didn't come. <sub>(grade 5.4)</sub>

**On win**

> The warlord falls, and the **Reedwife** comes apart like wet reeds in a fist, her laughter curdling to a wail that sinks back into the marsh. The **Ashfang** are broken — root and branch. <sub>(grade 5.5)</sub>

### `aftermath` — story

**Text**

You come back down the marsh road into a Thornwick with its shutters thrown open for the first time in a month. Word runs ahead of you; by the time you reach the square, the square is full. <sub>(grade 5.2)</sub>

The reeve is there too — stiff-backed, unsmiling, a strongbox under one arm. He does not thank you. He pays. "Thornwick settles its debts," he says, as though daring you to make something of it. Behind him, Mira catches your eye and very nearly smiles. <sub>(grade 3.7)</sub>

**Choices**

- → Claim the reeve's bounty for the chief's head  → `aftermath`
- → Present the Ashfang banner for the bonus  → `aftermath`
- → Accept the scout's reward and her thanks  → `aftermath`
- → Raise a glass at the Wander-Inn  → `epilogue`

### `defeat` — story

**Text**

You wake to lamplight and the smell of Mira's hearth. Someone hauled you off the field before the ravens came. <sub>(grade 3.1)</sub>

"Easy, now," she says, setting down a bowl. "The Ashfang are still out there — but you're no use to Thornwick dead. Rest, then finish it." <sub>(grade 1.8)</sub>

**Choices**

- → Get back on your feet  → `square`

### `epilogue` — ending

**Text**

The Ashfang banner burns in the square. Out past the reeds the marsh has gone strangely still. The black water is lower than anyone remembers, and the wrong-cold has lifted. It is as if something held its breath for years and finally let it out. The **Reedwife** is done. The carters have already started complaining about the state of the road. Mira says that is the surest sign a place has stopped being afraid. <sub>(grade 4.2)</sub>

She pours the first round on the house, and the second when she thinks you aren't counting. "Don't go making a habit of saving towns," she warns you. "People come to expect it." It is the nearest thing to thanks she keeps in stock, and you both know it. <sub>(grade 3.2)</sub>

## Journal entries

**The Ashfang Own the Valley** _(clue)_

Raiders ambushed you on the road, boasting of an Ashfang chief who dens in the hills past the marsh — you saw his smoke rise for yourself. They are many, and they answer to him. <sub>(grade 5.3)</sub>

**Break the Ashfang** _(quest)_

Mira, who keeps the Wander-Inn, begged your help against the Ashfang raiders bleeding Thornwick dry. Find where they den. Ask around the market and the marsh road, then end them. <sub>(grade 4.0)</sub>

**The Furtive Peddler** _(lead)_

Mira named a peddler who loiters by the market gate as the raiders' informant. Find him in Thornwick Square and deal with him. <sub>(grade 4.8)</sub>

**The Reeve's Bounty** _(clue)_

The reeve pays for the Ashfang chief dead, and pays extra for their banner brought back as proof. You took the retainer up front. <sub>(grade 3.3)</sub>

**The Watch-Signal** _(clue)_

You caught the Ashfang's informant in the market and took the raiders' gate signal off him. With it, you can fool the den's watch. <sub>(grade 3.8)</sub>

**Wren, the Scout** _(npc)_

You pulled a reeve's scout, Wren, out from under a dead horse on the marsh road. She mapped the den for you. <sub>(grade 1.0)</sub>

**Vex, the Lieutenant** _(lead)_

Wren named Vex, the Ashfang chief's resentful lieutenant. Seek out his fire inside the den — he may turn on the chief if offered a way out. <sub>(grade 4.9)</sub>

**The Reedwife** _(clue)_

A green hag called the "Reedwife" owns and brands the marsh-creatures that serve the Ashfang. Chief Vargan sold his people's marsh to her. She gets caravans and captives. He gets coin and monsters. She waits at the den's fire beside him. <sub>(grade 2.6)</sub>

**Vex, Turned** _(npc)_

Vex the lieutenant took your offer. His guards will stand aside when you face the Ashfang chief — this once. <sub>(grade 3.6)</sub>

