# The Wyrmcalling

_The Reedwife's sisters wake the Calling Stone, and the hills answer with wyrms, giants, and worse. Climb the passes, thin what answers, and silence the stone._

Levels 4–5 · start `muster` · 47 scenes

---

## Scenes

### `muster` — story

**Text**

The valley has raised an army at last. A **war-camp** spreads across the wet meadows below the high hills. Thornwick's recruits drill there, fen-folk with boar-spears and carters holding pikes. This time everyone can see the trouble coming. Every night there are fires burning up in the high passes, and no shepherd lit them. <sub>(grade 4.8)</sub>

The story reaches you before you reach the tents. High in the hills stands the **Calling Stone**, a black fang of rock as old as the mountain. Someone has woken it. It sings a note that only monsters can hear, and that note pulls them down toward the valley. Every day it sings, more of them come. <sub>(grade 3.1)</sub>

People whisper about who woke it. The **Reedwife's sisters** did, they say — two more hags, tall as doorframes, seen at the edge of the fen the night the barrows closed. Now the hills answer their stone. Wyrmlings ride the wind at dusk. Giant footprints cross the orchards. Streams run uphill, as if the stone called the water too. <sub>(grade 2.6)</sub>

Everyone in this camp knows you. You broke the Ashfang. You shut the Undercrypt. The crowd opens a path for you all the way to the command tent. Nobody says out loud that the sisters have come to collect your debt. Nobody needs to. <sub>(grade 2.6)</sub>

**Choices**

- → Report to the command tent  → `envoys`

### `envoys` — battle

_Fight: hag-coven on open_

**Intro**

You are ten paces from the command tent when the whole camp goes quiet at once. A woman stands in your way. She was not there a moment ago. She is tall as a doorframe, with river-weed braided into her hair. Two hired swords stand at her shoulders and watch you with bored, empty eyes. <sub>(grade 3.1)</sub>

"The famous company," the Reedwife's sister says. Her smile has too many teeth in it. "My sister fed off that marsh for a hundred years. You cost this family its living, so we have come to settle the bill." She flexes her green fingers. "The rest of the collectors are already gathering up on the mountain. Think of this as a knock at the door." <sub>(grade 3.5)</sub>

**On win**

> The hag falls apart into reeds and river-water. She was never really standing there at all. Her hired swords were real, and they stay where they fall. <sub>(grade 3.2)</sub>

### `envoys-won` — story

**Text**

The command tent is already open. Inside, maps cover a table, and a grey-haired captain sits with a sword across his knees. He watches you duck in with the tired calm of a man whose worst guesses keep coming true. This is **Vex**. He was the Ashfang's lieutenant once. Now Thornwick trusts him to run its war. <sub>(grade 3.2)</sub>

"That is the second one of those this week. You get used to it." He taps the map, where the high passes are marked fire by fire. "Here is the problem. The stone calls, and the hills answer. There are wyrm dens here, here, and here. An ogre-mage holds the middle pass with a warband. An ettin has taken a hall above the tree-line. And there are things in the streams now that are not fish." <sub>(grade 1.2)</sub>

"When the Calling reaches its peak, all of it comes down this slope at once. Unless it is already dead." He looks up at you. "So here is the deal. Every den you burn out is one monster fewer on the day. Fight as many as your legs will carry you to. My scouts will keep the map honest." <sub>(grade 1.7)</sub>

A thin smile crosses his face and vanishes. "I would come myself, but apparently I am respectable now. Nobody warns you about that part." <sub>(grade 5.2)</sub>

**Choices**

- → Take the war-camp  → `warcamp`

### `warcamp` — explore

**Map: The War-Camp**

- **The Command Tent**  → `command`
- **The War-Stores**  → `wc-stores`
- **The Scouts' Fire**  → `scouts-fire`
- **The High Trail**  → `hills-out`

### `command` — story

**Text**

Vex is arguing with three recruits about guard rotations, keeping time by waving a map-weight at them. He gives you a nod that means the hills are that way and you know your business. From Vex, that counts as a warm send-off. <sub>(grade 4.8)</sub>

**Choices**

- → Leave him to the war  → `warcamp`

### `command-done` — story

**Text**

The command tent works on. Guard posts, rations, the slow business of keeping frightened people pointed the right way. Vex adds a new pin to his map for every fight you win up in the hills. He would never say so, but he keeps them in a neat little row. <sub>(grade 3.7)</sub>

**Choices**

- → Back to the camp  → `warcamp`

### `wc-stores` — shop

_Speaker: Bram, War-Quartermaster_

**Intro**

Bram has taken over a supply wagon and, by the look of things, every pricing decision in the war. "War makes everything cost more. Except my goods, because I am a patriot. Also the captain reads my books." He turns a crate around to face you. "There are big things up that hill. Buy accordingly." <sub>(grade 3.8)</sub>

→ `warcamp`

### `scouts-fire` — dialogue

_Speaker: Wren, Chief of Scouts_

**Lines**

**Wren** runs the scouts' fire now. Three young riders hang on her every word, and a map of the passes lies weighted down with arrowheads. She made Chief of Scouts young. She wears the title like a coat that fits her but embarrasses her anyway. <sub>(grade 3.2)</sub>

"Right. Listen." She jabs a finger at the map. "The **manticore** on the toll-cliff talks. Do not talk back. The **boar-runs** flood with a stampede twice a day, so either time it or fight through it. And there is a valley past the middle pass full of statues that are far too good. Count the sculptors and you will find none. Stay out, or go in with your blade already drawn." <sub>(grade 1.6)</sub>

She looks up. "And the streams are walking uphill. I have no advice about that one. I only know where they walk." <sub>(grade 1.0)</sub>

She pauses. "Third time we have done this. Horse, fen, mountain." She almost smiles. "Try to come down the hill on your own feet. It is traditional now." <sub>(grade 0.6)</sub>

**Choices**

- → Take her map-notes  → `warcamp`

### `scouts-done` — story

**Text**

The scouts' fire crackles through another change of shift. Wren's riders come and go with the tidy urgency she has drilled into them, and her map grows more arrowheads by the hour. She flicks you a two-finger salute without looking up. <sub>(grade 5.9)</sub>

**Choices**

- → Back to the camp  → `warcamp`

### `hills-out` — story

**Text**

The high trail leaves the last lookout behind at a stone marker the recruits have started saluting. Above you the hills stack up into the sky, pass over pass. Over the highest one you hear it for the first time: the **Calling**. It is not really a sound. It is a pull, like a door standing open somewhere above the clouds. <sub>(grade 4.4)</sub>

**Choices**

- → Climb  → `hills`

### `hills` — explore

**Map: The High Hills**

- **The Switchbacks**  → `switchbacks`
- **The Toll-Cliff** — _unvisited: “A voice on the wind…”_  → `tollcliff`
- **The Boar-Runs** — _unvisited: “Drumming underfoot…”_  → `boarruns`
- **The Green Den** — _unvisited: “A sharp green stink…”_  → `greenden`
- **The Flooded Pass** — _unvisited: “A stream running uphill…”_  → `seam`
- **The Blue Mesa** — _unvisited: “A smell of thunder…”_  → `blueden`
- **The Middle Pass** — _unvisited: “A horn on a wall…”_  → `onihold`
- **The Burning Den** — _unvisited: “Smoke with no campfire…”_  → `redden`
- **The Valley of Statues** — _unvisited: “Statues that are too good…”_  → `gorgonvale`
- **The Giants' Hall** — _unvisited: “Smoke above the tree-line…”_  → `steading`
- **The Last Ridge** — _unvisited: “The pull, stronger…”_  → `calling-gate`

### `switchbacks` — story

**Text**

The path climbs in tight turns past empty shepherds' huts with their roofs fallen in. The higher you go, the less the mountain hides. <sub>(grade 3.3)</sub>

Burn marks streak the loose rock in three different sizes and three different colours. Red, white, and green mean three separate dragons came this way. <sub>(grade 4.9)</sub>

A boulder sits beside the trail with a handprint pressed into it. The hand was wider than a door. <sub>(grade 3.0)</sub>

Water has cut channels straight across the path. There is no stream up here. There should be no water at all. <sub>(grade 1.2)</sub>

And under all of it, that steady pull. The stone is drawing every monster on this mountain toward one high place. Whatever you beat down here will not be waiting for you at the top. <sub>(grade 4.5)</sub>

**Choices**

- → Pick your fights  → `hills`

### `switchbacks-done` — story

**Text**

The switchbacks wind away below you, familiar now. No new burn marks have appeared. What you cleared has stayed cleared. The Calling still pulls at the edge of hearing, thinner than it was. <sub>(grade 2.6)</sub>

**Choices**

- → Onward  → `hills`

### `hills-night` — battle

_Fight: harpy-roost on open_

**Intro**

The singing starts an hour after you bank the fire. It is sweet, and wrong, and getting closer. Harpies come riding the night wind down from the crags. Their song tugs at your legs. Stand up. Walk to the edge. It is not far. You wake in time, mostly because the sentry threw a boot. <sub>(grade 0.8)</sub>

**On win**

> The harpies flap away into the dark with their voices broken. Nobody sleeps after that. You bank the fire and count the watches until a grey, quiet dawn. <sub>(grade 3.6)</sub>

### `tollcliff` — story

**Text**

The trail narrows under an overhang, and the overhang is occupied. A **manticore** lies stretched along it like a lord at his dinner table. It has the body of a lion, the wings of a bat, and a tail covered in black spikes. Its face is human, which is somehow the worst part. <sub>(grade 5.4)</sub>

"Toll," it says. Its voice is a purr dragged over gravel. "Everything that walks my cliff pays. The goblins paid in sheep. The hags paid in promises." Its grin widens by one tooth too many. "You look like the sort that pays in blood." <sub>(grade 1.1)</sub>

**Choices**

- → Pay it in steel  → `tollcliff-fight`
- → Back down the trail and find another way  → `hills`

### `tollcliff-fight` — battle

_Fight: manticore-cliff on ruins_

**Intro**

"Steel, then," the manticore sighs, sounding genuinely put out. Its tail curves over its shoulder like a drawn bow. Two goblins scramble up from the rocks behind it with spears. They are probably the ones who paid in sheep, working off a debt. <sub>(grade 4.2)</sub>

**On win**

> The manticore drops onto the trail with one last offended word. "Toll." Its goblins run downhill to find a better boss. The pile in the overhang holds ten years of payments, taken from frightened travellers. <sub>(grade 4.7)</sub>

### `tollcliff-done` — story

**Text**

The overhang stands empty and its hoard is picked clean. The trail below is free to walk now. It may take the local shepherds a whole generation to believe it. <sub>(grade 4.4)</sub>

**Choices**

- → Onward  → `hills`

### `boarruns` — story

**Text**

A dry gully crosses the trail here. Hooves have churned its floor to mud and left coarse hair all over it. These are the **boar-runs**, and the drumming under your boots says the herd is coming. These are not farm pigs. The hoofprints are as wide as wash-basins. <sub>(grade 2.2)</sub>

Something has been driving the herd uphill, day after day. The Calling wants its beasts angry and moving. <sub>(grade 5.0)</sub>

You can wait half a day for the runs to clear. Or you can meet the stampede where the gully narrows and break the herd for good. <sub>(grade 2.8)</sub>

**Choices**

- → Meet the stampede at the narrows  → `boarruns-fight`
- → Wait out the runs and slip across  → `hills`

### `boarruns-fight` — battle

_Fight: boar-stampede on open_

**Intro**

The drumming turns into thunder. Two boars the size of hay-carts come down the narrows shoulder to shoulder. Their tusks are as long as plough blades and their eyes are mad with the Calling. Then you notice that the gully narrows behind you as well. <sub>(grade 4.0)</sub>

**On win**

> The stampede breaks around its fallen leaders and scatters back down the slope. The herd will keep to the low country now. You have just saved the war-camp from a living battering ram. <sub>(grade 4.1)</sub>

### `boarruns-done` — story

**Text**

The boar-runs lie quiet, and grass is already growing back over the churned earth. The herd stays down in the valleys now. They have learned what the narrows cost. <sub>(grade 3.2)</sub>

**Choices**

- → Onward  → `hills`

### `greenden` — battle

_Fight: green-dragon-den on marsh_

**Intro**

The thicket smells of cut grass gone bad, sharp and rotten at the same time. That smell means a **green wyrmling**. Its den is a tunnel dug through strangling briar, and the floor is a bed of picked bones. Everything in that pile mistook a young dragon for a safe one. Its kobolds are already shrieking the alarm. <sub>(grade 4.0)</sub>

The wyrmling slides out of the briar like an eel out of a wall. It is small. Its grin is still a dragon's grin. This is one more monster for the Calling, unless you stop it here. <sub>(grade 1.4)</sub>

**On win**

> The wyrmling drops in the middle of a hiss, its poison breath fading to a harmless stink, and its kobolds bolt into the briar. That is one monster fewer for the Calling. The den's small hoard rides out in your packs. <sub>(grade 4.4)</sub>

### `greenden-done` — story

**Text**

The briar tunnel stands silent, and the sharp green stink has faded to ordinary rot. There is one dragon fewer in these hills. <sub>(grade 4.3)</sub>

**Choices**

- → Onward  → `hills`

### `seam` — story

**Text**

Here is Wren's walking stream. A mountain brook runs up the pass instead of down it, quickly and steadily, straight against gravity. Where it pools at the top, the pool has a shape. It has shoulders. It waits with a patience that water should not have. <sub>(grade 2.9)</sub>

The Undercrypt's broken ward left thin places in the world, and something came through this one. The Calling holds it here like a cork in a bottle. The road to the middle pass runs right through its pool. <sub>(grade 3.6)</sub>

**Choices**

- → Break the water  → `seam-fight`

### `seam-fight` — battle

_Fight: water-vortex on bog_

**Intro**

The pool stands up. Twelve feet of mountain water in the rough shape of a giant, cold as the crack it came through. The **water elemental** does not roar. It simply pours itself at you, and it hits like the flood it actually is. <sub>(grade 3.2)</sub>

**On win**

> The elemental loses its argument with gravity all at once. It collapses into a hundred gallons of ordinary water, which hurries away downhill as if embarrassed. The thin place behind it closes. The pass is open. <sub>(grade 6.6)</sub>

### `seam-done` — story

**Text**

The brook runs downhill now, the way brooks should, chattering over the stones with no shape in it at all. The crack it came through stays shut. <sub>(grade 3.2)</sub>

**Choices**

- → Onward  → `hills`

### `blueden` — battle

_Fight: blue-dragon-den on ruins_

**Intro**

The mesa smells like a storm about to break. A **blue wyrmling** has taken the ruined watchtower at its top, and its kobolds have been busy. They have tied copper rods to every standing wall and wired the whole nest like a thundercloud waiting to go off. <sub>(grade 6.3)</sub>

The wyrmling uncoils along a broken wall, crackling with pride, and the air turns sharp and metallic. Someone has clearly told it that it will be enormous one day. Nobody has told it about you. <sub>(grade 5.5)</sub>

**On win**

> The wyrmling falls off the wall trailing dead sparks, and the kobolds' lightning farm shorts out into scrap. The hoard here was tribute, saved up for a dragon's future. It pays for your present instead. <sub>(grade 4.1)</sub>

### `blueden-done` — story

**Text**

The ruin on the mesa is quiet, and its copper rods are already turning green. The storms overhead are only weather now. <sub>(grade 5.9)</sub>

**Choices**

- → Onward  → `hills`

### `onihold` — story

**Text**

The middle pass is held. Not squatted in. Held properly, by someone who knows soldiering. A stone fort rebuilt in a week by hands that lift boulders like loaves of bread. Guard posts of sharpened pine. A horn on the wall that has already sounded once. <sub>(grade 2.0)</sub>

The holder stands above the gate: an **ogre-mage**, blue-skinned, wearing scraps of old lacquered armour. It looks down at you, and that look is the worst thing you have met in these hills, because it is thinking. <sub>(grade 6.6)</sub>

"The stone sings," it calls down, pleasantly. "We answered first, and whoever answers first holds the door. Pay a toll, swear a tithe, or try us, little debtors." <sub>(grade 2.8)</sub>

**Choices**

- → Try them  → `onihold-fight`

### `onihold-fight` — battle

_Fight: oni on corridor_

**Intro**

The horn sounds twice, and the gate opens on the ogre-mage's guard: an ogre with a hammered-together maul and an orc veteran in stolen mail. Then the ogre-mage itself rises off the wall on a cold wind with its blade drawn. The air darkens around it like ink spreading through water. <sub>(grade 7.0)</sub>

**On win**

> The ogre-mage falls out of its own darkness, astonished right to the end, and its warband breaks apart with it. The middle pass stands open, and beyond it lies the road to the giants' hall and the stone. The fort's war-chest is yours, fair and square. <sub>(grade 5.0)</sub>

### `onihold-done` — story

**Text**

The fort at the middle pass stands empty, its horn silent on the wall. Wren's scouts have already been through. They have chalked a small, tidy arrowhead by the gate, pointing up. <sub>(grade 3.7)</sub>

**Choices**

- → Onward  → `hills`

### `redden` — battle

_Fight: red-dragon-den on firepit_

**Intro**

You smell the den before you see it: woodsmoke with a hot, metal edge to it. It sits in a scorched bowl of hillside where a **red wyrmling** has built itself a forge-hall out of split rock and cinders. Kobolds tend heaps of half-melted treasure with the care of bank clerks. <sub>(grade 5.6)</sub>

The wyrmling lies on the largest heap with one eye open. Red dragons are the proudest of a proud family, and the stone's song promised this one a war. It rises, burning with its own light, delighted that you have saved it the trip downhill. <sub>(grade 4.9)</sub>

**On win**

> The wyrmling's fire goes out from the inside, and it is finally, simply small. Its half-melted hoard cools into heavy lumps. They are the honest kind, and Bram will weigh them twice and pay well. <sub>(grade 3.8)</sub>

### `redden-done` — story

**Text**

The burning den has gone cold. Rain has already found the scorched bowl, and something green is growing up through the ash, thoroughly unimpressed by dragons. <sub>(grade 6.3)</sub>

**Choices**

- → Onward  → `hills`

### `gorgonvale` — story

**Text**

This is Wren's valley, and the statues are exactly as good as she warned. A shepherd caught mid-stride with one arm flung up. A wolf turning to run. A hired sword with his blade half drawn and a look on his face you can read from thirty paces. No sculptor chose these subjects, and no sculptor ever worked this fast. <sub>(grade 3.3)</sub>

At the head of the valley stands a bull made of black iron plates, grazing between its own victims. This is a **gorgon**. Its breath turns living things to stone, and steam curls from its nostrils in the cold air. The Calling drew it down from somewhere higher and worse. <sub>(grade 3.9)</sub>

It has not noticed you yet. The statues suggest that never lasts long. <sub>(grade 2.4)</sub>

**Choices**

- → Go in blade-first  → `gorgonvale-fight`
- → Take Wren's advice and stay out  → `hills`

### `gorgonvale-fight` — battle

_Fight: gorgon-maze on corridor_

**Intro**

The gorgon's head comes up, and its breath comes with it. A rolling green vapour turns the grass it touches into grey stalks of stone. It charges through its own statues with its iron plates thundering, and the valley becomes a maze of stone people with you inside it. <sub>(grade 5.5)</sub>

**On win**

> The gorgon crashes onto its side with a sound like a foundry falling downstairs, and the green vapour thins away to nothing. The statues keep their silent watch. But the collection is closed. <sub>(grade 4.8)</sub>

### `gorgonvale-done` — story

**Text**

The valley of statues stands in permanent, silent company. Moss will cover them in time, and shepherds will tell stories about them for much longer. Nothing grazes between them now. <sub>(grade 5.6)</sub>

**Choices**

- → Onward  → `hills`

### `steading` — battle

_Fight: giants on ruins_

**Intro**

Above the tree-line stands the giants' hall, built from whole pine trunks and stone blocks the size of doorways. Something put it up in a single season and treated the work as simple stacking. The **ettin** that holds it comes out at the first scrape of your boots. It is two heads arguing on top of one enormous body. An ogre and an orc runner scramble out behind it. <sub>(grade 4.7)</sub>

"THE STONE PROMISED US THE VALLEY," booms the left head. "The stone promised ME the valley," the right head corrects. Then both heads notice you at the same moment, and for the first time all day they agree about something. <sub>(grade 4.7)</sub>

**On win**

> The ettin goes down still arguing about whose fault it was, and its followers do not stay to finish the argument. Inside the hall you find tribute, plunder, and an entire orchard's worth of pickled fruit, all of it bound for the war-camp below. The last strong voice on the mountain has stopped singing. <sub>(grade 6.9)</sub>

### `steading-done` — story

**Text**

The giants' hall stands hollow, its doorway a bright rectangle of sky. Vex will want it for a forward post. Wren's scouts have already claimed the roof. <sub>(grade 2.8)</sub>

**Choices**

- → Onward  → `hills`

### `calling-gate` — story

**Text**

You reach the last ridge. The Calling is not a pull any more. It is a pressure, a note held so long that the mountain hums it back at you. <sub>(grade 1.3)</sub>

Beyond the ridge, a bowl of bare rock opens under the sky. At its centre stands the **stone**: a single black fang, older than anyone can guess, wrapped in a light that hurts to look at. <sub>(grade 5.2)</sub>

Wingbeats ride the wind. The rim of the bowl is where the wyrms gather, and what is left of the brood is massing up there to meet you. Every den you left standing sent its dragon here. Clear the rim, and only the stone and its keepers are left. <sub>(grade 3.2)</sub>

**Choices**

- → Meet the clutch on the rim  → `clutch-fight`

### `calling-gate-clear` — story

**Text**

You reach the last ridge. The Calling is not a pull any more. It is a pressure, a note held so long that the mountain hums it back at you. <sub>(grade 1.3)</sub>

Beyond the ridge, a bowl of bare rock opens under the sky. At its centre stands the **stone**: a single black fang, older than anyone can guess, wrapped in a light that hurts to look at. <sub>(grade 5.2)</sub>

Nothing moves overhead. The rim is a gathering ground with nothing gathered on it. You emptied every den on the way up, so there is no brood left to send against you. You cross the ridge unopposed. That is what being thorough buys. Only the stone and its keepers are left. <sub>(grade 3.2)</sub>

**Choices**

- → Down into the bowl  → `calling-approach`

### `ridge-quiet` — story

**Text**

The ridge lies quiet, the broken brood scattered or dead. Below you, the bowl and the stone wait in their bruised light. <sub>(grade 2.6)</sub>

**Choices**

- → Down into the bowl  → `calling-approach`

### `clutch-fight` — battle

_Fight: chromatic-clutch on open_

**Intro**

They come over the rim together, every wyrmling the Calling could still reach. Black and green and white, shrieking in three different keys of greed. The dens you emptied stay empty. The ones you did not are all here, and they have decided that your debt is theirs to collect. <sub>(grade 4.4)</sub>

**On win**

> The last wyrmling drops out of the bruised light and does not get up. The rim is yours, and the hollow below waits. The stone's note wavers, as if it has just counted how few voices are still answering it. <sub>(grade 3.2)</sub>

### `calling-approach` — story

**Text**

Down in the bowl, at the foot of the stone, the **sisters** are waiting. Two hags, tall as doorframes, their green fingers buried to the knuckle in the black rock. <sub>(grade 4.4)</sub>

This close, you finally understand what the Calling is. They are not commanding the stone. They are pouring themselves into it. Their hair has turned to river-weed and wire. Their faces are burning down like candles. Two long lives spent to hold one door open. <sub>(grade 3.1)</sub>

So here is the truth at the top of the mountain. The keepers of the Calling Stone are the **Reedwife's sisters**, and they woke it for revenge. You killed the Reedwife in her marsh. For that, they mean to drown the whole valley in monsters. <sub>(grade 3.2)</sub>

"Sister-killers," they say together, without turning around. "You cut her down in her own fen. So we woke the stone, and we called the hills down on everyone you saved. That is what she was worth." The light around the stone thickens, and the ground beneath it begins, gently, to burn. "But you came so far. Stay. The last of the collection is arriving now. Out of the fire, and out of the ground." <sub>(grade 2.4)</sub>

**Choices**

- → Break the stone, and the sisters with it  → `calling-battle`

### `calling-battle` — battle

_Fight: elemental-cataclysm on firepit_

**Intro**

The sisters pour the last of themselves into the stone, and the stone spends it all at once. The floor of the bowl splits along a burning crack. A pillar of living fire climbs out of it. The mountain's own bones heave up into a shape with fists. The sisters crumble into drifts of dry reeds, smiling as they go. The Calling's last note is a disaster, and it has your name in it. <sub>(grade 3.6)</sub>

**On win**

> The fire gutters out of the air. The stone shape shakes itself apart into loose rubble. The black fang has nothing left to spend and nobody left to spend it, so it cracks from top to bottom and falls silent. The Calling does not end with thunder. It ends with the huge, ringing quiet of a held note finally let go. <sub>(grade 4.1)</sub>

### `calling-won` — story

**Text**

It is over. The **Calling Stone** lies cracked and silent, and the sisters spent themselves along with it. Where they stood, a scatter of dry reeds lifts on the wind. The revenge they climbed all this way to take burned away in the taking. Your company stands whole on a quiet mountain. <sub>(grade 3.7)</sub>

Below you, pass by pass, the hills go still. The song that pulled monsters toward the valley has stopped, so the monsters stop with it. Whatever was walking toward the stone lies down where it stands, and the wingbeats fade off the wind. The valley is safe. Far down the slope, faint and disbelieving, the war-camp starts to cheer. <sub>(grade 3.8)</sub>

**Choices**

- → Come down the mountain  → `wc-aftermath`

### `wc-aftermath` — story

**Text**

You come down the hill on your own feet, which is traditional now. You walk into a camp that has stopped being an army and started being the biggest festival the valley has ever thrown. <sub>(grade 6.4)</sub>

Vex shakes your hand like a man signing off on accounts he never expected to balance. "Three for three," he says. "The Calling is broken. Tomorrow this camp packs up and everybody goes home. Do stop now, before your luck notices you." <sub>(grade 3.7)</sub>

Wren says nothing at all. She just looks at the four of you, then up at the quiet hills, and grins her whole age for once. Then she remembers that she is Chief of Scouts, coughs, and asks for your route report. <sub>(grade 3.4)</sub>

**Choices**

- → Accept the valley's purse — every village paid in  → `wc-aftermath`
- → Let the valley celebrate  → `wc-epilogue`

### `wc-defeat` — story

**Text**

You wake in the hospital tent to canvas light and the smell of Bram's cooking, which nobody voted for. Wren's scouts carried you down again, in relays. It is a tradition everyone would happily retire. <sub>(grade 6.2)</sub>

Vex looks in, notes that you are breathing, and sets your kit at the foot of the cot without a word. The hills are still up there. The stone is still calling. Nothing has changed. It is only waiting. <sub>(grade 1.1)</sub>

**Choices**

- → Back on your feet  → `warcamp`

### `wc-epilogue` — ending

**Text**

The valley remembers it as the year of three wars: the raiders, the graves, and the hills. The same four names run through all three stories like a bright thread. You broke the Ashfang. You sealed the Undercrypt. You silenced the Calling, and the coven's long debt burned away to reeds on a mountain wind. <sub>(grade 3.3)</sub>

Mira pours the first round on the house, and the second before anybody asks. With the third comes her observation that heroes drink no more carefully than anyone else. The reeve orders a plaque made. Wren corrects the geography on it. <sub>(grade 5.7)</sub>

Vex has seen every side of this valley's troubles, and he finally picked the right one. He raises a quiet glass to the four of you, and drinks to **the Free Company**. Paid in full, and free at last. <sub>(grade 4.0)</sub>

## Journal entries

**Silence the Calling** _(quest)_

The Reedwife's sisters have woken the Calling Stone in the high hills. Its song pulls wyrms, giants, and worse down on the valley. Climb the passes, kill what answers the call, and break the stone. <sub>(grade 2.8)</sub>

**Captain Vex** _(npc)_

The Ashfang's old lieutenant now runs the valley's war-camp. He is tired, careful, and right more often than anyone likes. His plan is simple: every den and every beast you clear in the hills is one monster fewer when the Calling peaks. <sub>(grade 6.7)</sub>

**The Calling Stone** _(lead)_

Somewhere past the ogre-mage's pass and the giants' hall, the sisters are tending the stone that calls the hills down. Climb until you find it. <sub>(grade 4.4)</sub>

**Wren's Map-Notes** _(clue)_

The manticore on the toll-cliff talks. Do not talk back. The boar-runs stampede twice a day. The valley of statues has no sculptors, because a gorgon made them. And the streams themselves are walking uphill. <sub>(grade 3.3)</sub>

