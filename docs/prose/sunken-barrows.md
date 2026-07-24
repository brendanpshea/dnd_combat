# The Sunken Barrows

_The Reedwife's death broke an old vigil. Follow Thornwick's walking dead into the fen — and close what your victory opened._

Levels 3–4 · start `return` · 45 scenes

---

## Scenes

### `return` — story

**Text**

Thornwick by night, and the bells are ringing. Not the steady count of the hour. This is the panicked clatter of a rope hauled by somebody who has forgotten how bells work. <sub>(grade 4.1)</sub>

In the marsh, last season, you hunted down and killed the **Reedwife**, the green hag of the fen. Since that victory, the valley has slept easy. The gate-warden's face says the sleeping is over. "It's the **lychyard**," he manages. "The graves. Sergeant, the graves are *open*, and it wasn't shovels did it." <sub>(grade 3.2)</sub>

Down the lane, past the shuttered market, cold lamplight spills across the churchyard wall. And the shadows between the stones are moving against the light. <sub>(grade 5.3)</sub>

**Choices**

- → Answer the bells  → `lychyard`

### `lychyard` — battle

_Fight: shadow-ambush on corridor_

**Intro**

The lychyard gate hangs off its hinge. Between the headstones, the darkness has come loose. Two shapes of pure spilled night glide across holy ground. They are cold enough to see, and the ground means nothing to them. <sub>(grade 2.4)</sub>

Which, apparently, it now is. Draw steel — for what good steel does against shadow. <sub>(grade 3.2)</sub>

**On win**

> The last shadow tatters apart on your blade like smoke off a doused fire. The lychyard holds its breath. <sub>(grade 2.4)</sub>

### `grave-morning` — story

**Text**

Morning shows the lychyard plain, and plain is worse. A dozen graves stand open — dug *outward*, turf thrown wide from below. The dead didn't wait for anyone to take them. They climbed out and left on their own. <sub>(grade 2.1)</sub>

And they left together. The drag-marks run through the wall-gap and out across the water-meadows, every one of them, straight as a pilgrim road — **into the deep fen**. <sub>(grade 6.7)</sub>

**Choices**

- → Take it to the town  → `town`

### `town` — explore

**Map: Thornwick**

- **The Wander-Inn**  → `inn`
- **Market**  → `sb-market`
- **The Reeve's Hall**  → `reeve-hall`
- **The Lychyard**  → `grave-study`
- **The Fen Road**  → `fen-out`

### `inn` — dialogue

_Speaker: Mira the Innkeeper_

**Lines**

The Wander-Inn is fuller than an inn should be at this hour — nobody in Thornwick fancies sleeping alone with the churchyard in its current mood. **Mira** sets down a bowl in front of you unasked. <sub>(grade 7.4)</sub>

"So. The marsh sends us another bill." She says it flat, wiping the bar the way other people sharpen knives. "First raiders, now the departed. I'd ask what's next, but I've found the marsh treats that as a challenge." <sub>(grade 2.0)</sub>

"Eat. Then go see the reeve — he's been pacing his hall since the bells. And whatever's pulling the dead out there — charge it double." <sub>(grade 1.8)</sub>

**Choices**

- → Take a room for the night — 1 gold (long rest)  → `inn-rest`
- → Back to the street  → `town`

### `inn-rest` — rest

**Intro**

A bolted door, a real bed, and the comfortable murmur of a crowded taproom below. Whatever walks the fen, it isn't walking in here. You sleep like the blessedly living. <sub>(grade 4.8)</sub>

→ `inn`

### `sb-market` — shop

_Speaker: Bram the Quartermaster_

**Intro**

"Back again, and the town in trouble again. I'd call it coincidence, but I'd not call it that twice." **Bram** spreads his hands over the stall. "Grave-trouble, they say. Then you'll be wanting silver, steel, and no questions. Two of the three I stock." <sub>(grade 2.3)</sub>

→ `town`

### `reeve-hall` — dialogue

_Speaker: Reeve Aldous_

**Lines**

The reeve's hall smells of candle-wax and ledgers. **Reeve Aldous** stands at the window with his back to you. He watches the fen fog eat his water-meadows. He grips his chain of office in one fist, like a weapon he doesn't know how to use. <sub>(grade 3.2)</sub>

"Thornwick settles its debts," he says, without turning. "It appears the marsh does likewise. My grandfather's grave is open, and my grandfather has *gone somewhere*." He turns. He looks older than the ledgers. "I paid you to break raiders and you broke them. I'm paying you again. Follow my dead into the fen, find what calls them, and put it down." <sub>(grade 3.2)</sub>

"My scout will meet you at the fen road. She insisted. Rather forcefully, for someone I employ." <sub>(grade 3.3)</sub>

**Choices**

- → Take the reeve's commission _(once)_  → `town`

### `reeve-done` — story

**Text**

The reeve's clerk intercepts you at the door with the particular firmness of a man defending his employer's composure. "The commission stands. The reeve counts on you. The reeve is *busy*." Through the doorway, the reeve is visibly not busy. He is watching the fen. <sub>(grade 4.4)</sub>

**Choices**

- → Leave him to it  → `town`

### `grave-study` — check

_Check: medicine DC 12_

**Intro**

The open graves wait for a steadier eye. The dead left in company — but bodies, even walking ones, tell their stories to anyone trained to listen. <sub>(grade 5.8)</sub>

**On success**

> The story is in the turf. They didn't claw out in hunger. They *stepped* out in order, oldest graves first, called up in ranks. Whatever summons them has real authority. It is old enough to call the oldest first. <sub>(grade 2.9)</sub>

**On failure**

> Mud, turf, and the underside of a churchyard: whatever the graves have to say, they aren't saying it to you. The trails still point one way. Sometimes the obvious clue is the whole clue. <sub>(grade 4.8)</sub>

### `graves-done` — story

**Text**

The lychyard lies quiet, its open graves gaping at the sky like a choir mid-note. Nothing more walks here. Everything that could has already gone ahead of you. <sub>(grade 4.9)</sub>

**Choices**

- → Back to town  → `town`

### `fen-out` — dialogue

_Speaker: Wren, the Reeve's Scout_

**Lines**

Where the cart-road gives up and the old raised road starts, a familiar figure sits sharpening a familiar boot-knife. **Wren** — upright this time, no dead horse in sight, the reeve's colours mended at the shoulder. <sub>(grade 7.1)</sub>

"Heard the bells. Figured you'd be along." She stands, and only barely favours the leg. "I've scouted the near fen twice since the graves opened. Every trail feeds the old barrow-country — past the **drowned chapel**, past the **corpse-lights**. I can walk you as far as sense allows. After that it's barrows, and sense stays home." <sub>(grade 3.1)</sub>

**Choices**

- → Follow her onto the raised road  → `fen`

### `fen` — explore

**Map: The Deep Fen**

- **The Raised Road**  → `causeway`
- **The Drowned Chapel** — _unvisited: “A sunken bell-tower…”_  → `chapel`
- **The Corpse-Lights** — _unvisited: “Pale fire over the water…”_  → `lights`
- **The Serpent Pool** — _unvisited: “Ripples with no wind…”_  → `pool`
- **The Barrow Gate** — _unvisited: “Standing stones ahead…”_  → `lychgate`

### `causeway` — story

**Text**

The old raised road is older than the cart-track that meets it. Hands that measured in generations laid these great flat stones. Wren crouches at its edge and reads the mud the way Mira reads a customer. <sub>(grade 3.9)</sub>

"Here. And here." Footprints, water-filled, in files. "Your churchyard dead came through in *step*. And look at this." She points to older prints, sunk deeper, wider. "They weren't the first. The fen's own dead have been walking for days. Whatever's calling has been at it a while, and it isn't calling them to wander. It's calling them to **work**." <sub>(grade 1.9)</sub>

Two ways on: the **drowned chapel's** broken tower north, the flat water where the **corpse-lights** dance south. Past both, where every file of prints converges, the barrow-country waits. <sub>(grade 7.1)</sub>

**Choices**

- → Into the fen  → `fen`

### `causeway-done` — story

**Text**

The old road's stones stretch on, patient as ever. The files of footprints haven't moved — everything that made them is already where it was going. <sub>(grade 5.8)</sub>

**Choices**

- → Press on  → `fen`

### `fen-night` — battle

_Fight: marsh-dead on bog_

**Intro**

You wake to Wren's hand on your shoulder and her knife already out. The fen has sent visitors. Two ghouls, grave-mud to the elbows, crawl out of the black water. They move with the calm confidence of things that have done this before. No rest tonight. Just work. <sub>(grade 2.5)</sub>

**On win**

> The ghouls lie still — properly still, this time. The night is ruined and the fire is out. Wren does not say what you're both thinking. They came out of the deep fen — the *very place you plan to go*. <sub>(grade 1.2)</sub>

### `chapel` — dialogue

_Speaker: Brother Halden_

**Lines**

The chapel kneels in the water, drowned to its windows, its bell-tower canted like a man listening. Candlelight where no candles should be. And on the dry island of the altar steps stands a priest. His robes are fen-stained, his face serene. He is leading a congregation. <sub>(grade 4.4)</sub>

The congregation is dead. Rank on rank of them, standing patient in the water, mud-black and empty-eyed, *facing the altar*. <sub>(grade 6.6)</sub>

"**Welcome!**" The priest is Brother Halden, once of Thornwick, the mild one who never could hold a room. He beams at you with terrible peace. "You've come to see the great work. The Warden below is gathering his flock at last. I merely… keep the service, until he calls them down. Will you kneel? Everyone kneels, eventually. That's rather the point of everyone." <sub>(grade 3.2)</sub>

**Choices**

- → `[insight DC 13]` [Insight DC 13] Read what's wearing him before it moves _(once)_  → `chapel-caught`
- → Refuse the sermon and draw  → `chapel-fight`

### `chapel-fight` — battle

_Fight: temple on ruins_

**Intro**

Halden sighs, a shepherd disappointed in his flock. The congregation turns as one. Skeletons in rotted mourning-clothes wade from the water. Two acolytes you recognise from Thornwick's own chapel flank their brother, eyes as empty as the dead's. "The Warden provides," says Halden, and provides. <sub>(grade 6.3)</sub>

**On win**

> Halden folds at the altar steps, looking, at the end, mostly relieved. <sub>(grade 5.8)</sub>

### `chapel-caught` — battle

_Fight: temple on ruins_

**Intro**

You see it a breath before it moves. The thing behind Halden's serenity winds up through him like rot up a post. You're already moving when the congregation turns. For once the dead are the ones caught flat-footed. <sub>(grade 4.0)</sub>

**On win**

> Wrong-footed from the first, the congregation never recovers its ranks. Halden folds at the altar steps, looking, at the end, mostly relieved. <sub>(grade 6.9)</sub>

### `chapel-won` — story

**Text**

Halden's prayer-book lies open on the altar, fen-damp but legible. The notes in the margins are a horror-story in a tidy clerical hand. *The Reedwife kept the vigil. The vigil is ended. The Warden of the Barrows wakes, and gathers hands to open his door from within.* <sub>(grade 5.7)</sub>

And beneath, underlined twice, the sentence that makes it your business: *"The rites of sealing are the old rites. The words are in this book. What is wanted is someone with the nerve to say them at the door."* <sub>(grade 3.7)</sub>

So the truth lands at last, and it lands on you. The **Reedwife** was never just a hag. She was the jailer of the **Warden of the Barrows**, an ancient dead power under the fen. Her feeding kept him asleep. When you killed her, you broke his seal without knowing it. Now he wakes, and he calls the dead to open his door from the inside. <sub>(grade 3.0)</sub>

The book also gives you the fix. Take the prayer-book to the great barrow, reach the Warden's door, and *speak the rites of sealing there*. That will shut him in again. <sub>(grade 2.9)</sub>

Wren reads over your shoulder. "Nerve we've got," she says. "Door's past the graveyard gate." She does not mention who ended the vigil. She's kind that way. <sub>(grade 0.9)</sub>

**Choices**

- → Take the prayer book  → `fen`

### `chapel-done` — story

**Text**

The drowned chapel stands empty now, its terrible congregation dispersed to proper stillness. The candles have gone out. On the whole, that counts as an improvement. <sub>(grade 6.4)</sub>

**Choices**

- → Back to the fen  → `fen`

### `lights` — story

**Text**

The flat water south of the old road is where the fen does its prettiest lying. Lights hang over the black mirror — soft, swaying, warm as windows. Wren's face goes carefully blank. "Corpse-candles. They walk mourners into the deep pools and hold them under. Half of Thornwick's missing folk are *under this water*." <sub>(grade 3.9)</sub>

The lights drift nearer, hopeful as dogs. Between them, deeper in, something else keeps them company — a colder shape that was a person once. <sub>(grade 6.3)</sub>

**Choices**

- → Snuff them out  → `lights-fight`
- → Back away from the water  → `fen`

### `lights-fight` — battle

_Fight: wisp-bog on bog_

**Intro**

The lights stop pretending. They come in low and fast over the water, crackling with stolen life. A cold shape rises between them. It is a specter trailing fen-mist, its mouth open on a scream the water drank years ago. <sub>(grade 3.7)</sub>

**On win**

> The last wisp gutters out like a debt paid. The water goes honestly dark. Somewhere under it, half of Thornwick's missing folk finally rest, and tonight that counts as mercy. <sub>(grade 5.2)</sub>

### `lights-done` — story

**Text**

The flat water lies dark and truthful. Nothing dances over it now. It is the only stretch of the fen that feels *cleaner* for your passing. <sub>(grade 2.8)</sub>

**Choices**

- → Back to the fen  → `fen`

### `pool` — story

**Text**

North of the chapel the reeds part around a pool so still it looks solid. Offerings crowd its rim — old ones, coins and combs and querns, generations of fen-folk paying rent to something. The surface moves once, without wind, in a line longer than a boat. <sub>(grade 6.0)</sub>

Wren picks up a coin, puts it back with exaggerated care. "The fen-folk fed the pool so the pool stayed *in* the pool. Nobody's fed it since the graves opened." A pause. "It looks fed to me," she adds, entirely without conviction. <sub>(grade 3.1)</sub>

**Choices**

- → Wade in and settle the rent  → `pool-fight`
- → Leave the pool its privacy  → `fen`

### `pool-fight` — battle

_Fight: snake-pit on marsh_

**Intro**

The pool empties itself at you. Two constrictors the girth of roof-beams pour out of the water in oiled coils. They are fen-serpents, grown old and vast on a century of offerings. And lately, on whatever walks past unwary. <sub>(grade 5.5)</sub>

**On win**

> The serpents lie in loops like discarded rope. In the offering-mud your boots turn up the accumulated rent of generations — and the pool, at long last, is just water. <sub>(grade 6.7)</sub>

### `pool-done` — story

**Text**

The serpent pool sits quiet, its rim of offerings gleaming dully. It is just water now — deep, cold, and finally ordinary. <sub>(grade 7.0)</sub>

**Choices**

- → Back to the fen  → `fen`

### `lychgate` — battle

_Fight: gargoyle-perch on ruins_

**Intro**

Where every file of footprints converges, the barrow-country announces itself. A graveyard gate of standing stones rises here, older than the chapel, older than the old road. Two weathered granite watchers crown it. <sub>(grade 7.3)</sub>

Wren stops dead. "Those weren't there when I scouted." She's right — the plinths are mossy, but the watchers' claws are clean. The granite unfolds, cracks its wings, and comes down at you like the roof of the world. <sub>(grade 1.5)</sub>

**On win**

> The second gargoyle comes apart mid-dive. It rains down as honest gravel. The graveyard gate stands unwatched now. Beyond it, the field of burial mounds opens like a held breath. <sub>(grade 4.2)</sub>

### `lychgate-won` — story

**Text**

Past the graveyard gate the mounds rise in their dozens. At the field's heart the largest barrow stands **open**. Not fallen in, but *unlocked*. A doorway of dressed stone breathes out cold. Worked steps descend. Every file of the walking dead leads down into it like thread into a needle. <sub>(grade 3.5)</sub>

The **Undercrypt**. The thing the old prayers named. The thing her long feeding kept shut. Wren looks at the steps, then at you. "This is where sense stays home," she says. "I'll hold the gate. It's become something of a family tradition. Someone's got to be standing here when you walk back out." You pretend, kindly, not to hear the *when* she leans on. <sub>(grade 1.7)</sub>

**Choices**

- → Descend into the Undercrypt  → `undercrypt`

### `lychgate-open` — story

**Text**

The graveyard gate stands unwatched, its shattered guardians spread across the old road as gravel. Beyond, the great barrow's doorway waits, exhaling cold. Wren keeps her post at the stones, arms folded against more than the chill. <sub>(grade 5.2)</sub>

**Choices**

- → Descend into the Undercrypt  → `undercrypt`

### `undercrypt` — explore

**Map: The Undercrypt**

- **The Painted Hall**  → `hall`
- **The Bone Room** — _unvisited: “A side-gallery…”_  → `ossuary`
- **The Barrow-Lords** — _unvisited: “Armoured silhouettes…”_  → `wights`
- **The King's Chamber** — _unvisited: “A door sealed in lead…”_  → `king`
- **The Warden's Door** — _unvisited: “Chanting, below…”_  → `seal-approach`

### `hall` — story

**Text**

The stair opens into a painted hall. Artists covered these walls before Thornwick had a name. The frescoes tell one story, over and over, wrapping the room like a bandage. A **door** stands under the earth. A **horned warden** waits behind it. And before the door, generation after generation, a **woman of the reeds** keeps watch. She takes the sleep of the dead into herself like a woman drawing water. <sub>(grade 5.0)</sub>

The last panel is fresh mud smeared over old paint. One furious stroke has crossed out the woman of the reeds. Beneath her, many dead hands scrawled the words: **THE VIGIL HAS ENDED. THE DOOR OPENS FROM WITHIN.** <sub>(grade 3.0)</sub>

So there it is, painted plain. The Reedwife was no squatter — she was the *lock*. And the company that broke her has come, at last, to pay for the privilege. <sub>(grade 2.5)</sub>

**Choices**

- → Deeper in  → `undercrypt`

### `crypt-night` — battle

_Fight: specter-haunt on corridor_

**Intro**

You bank a fire in a dry side-vault, and the Undercrypt notices. The cold arrives first, then the shapes it belongs to — two specters sliding out of the painted walls, the fresco-dead come loose from their own story. So much for the watch rotation. <sub>(grade 5.7)</sub>

**On win**

> The specters shred into cold and silence. Nobody suggests going back to sleep. The fire gets banked. The night gets counted as spent. The Undercrypt gets exactly no rest out of any of you. <sub>(grade 2.3)</sub>

### `ossuary` — check

_Check: investigation DC 12_

**Intro**

A side-gallery stacked floor to vault with the tidy dead — ten thousand skulls in courses, like masonry with opinions. Grave-goods glint in the niches. The barrow-lords took their wealth down with them; a careful eye might take some of it back up. <sub>(grade 6.2)</sub>

**On success**

> Behind a course of skulls, the masons left a paymaster's niche. Inside is coin struck by kings nobody remembers. There is also a flask of something that has aged into strength rather than vinegar. <sub>(grade 6.2)</sub>

**On failure**

> You grope two niches, meet something that crunches, and elect to stop. The dead keep their wages. On reflection, they did the work. <sub>(grade 1.8)</sub>

### `ossuary-done` — story

**Text**

The ossuary's ten thousand residents regard you with the fixed patience of an audience that has seen your act already. Nothing left here but the dead and their arithmetic. <sub>(grade 7.6)</sub>

**Choices**

- → Back to the halls  → `undercrypt`

### `wights` — battle

_Fight: wight-tomb on corridor_

**Intro**

This is the hall of the old dead kings. Three slabs of black stone stand in the dark. On the middle one, a king's guard sits *up*. Cold light burns in its eye sockets. It draws a sword older than the road outside. It does not shuffle like the other dead. It takes a **stance**. <sub>(grade 0.6)</sub>

From the slabs on either side, its honour-guard of skeletons rise to their feet. They stand with the parade-ground snap of soldiers called to order. And they mean to enjoy it. <sub>(grade 4.4)</sub>

**On win**

> The wight comes apart at the joints, like a puppet whose strings were cut centuries too late. Its guards clatter down after it. The cold light gutters out of three pairs of sockets. The dead army below just lost its officers. <sub>(grade 3.7)</sub>

### `wights-done` — story

**Text**

The old dead kings lie decommissioned across their stone slabs. The ancient sword you left on the centre slab stays exactly where it is. On the whole, you feel this is the correct arrangement for everyone. <sub>(grade 5.5)</sub>

**Choices**

- → Onward  → `undercrypt`

### `king` — battle

_Fight: mummy-crypt on corridor_

**Intro**

Old masons sealed the king's chamber in lead. Something has peeled the lead back like fruit-rind — from the *inside*. Within, a figure in cerements the colour of old honey stands before a wall of names. It strikes through each one with a charred finger. <sub>(grade 4.3)</sub>

The embalmed king turns. Whatever the Warden promised him for his service, the Warden clearly paid it in full. The eyes behind the wrappings burn with the settled satisfaction of a creditor. Two of his household dead lurch from the corners, still in their funeral best. <sub>(grade 6.1)</sub>

**On win**

> The king burns from the inside out. His grave-cloths turn to ash in a spiral of embers. His servants drop mid-lurch. The wall of crossed-out names stands behind him. Near the bottom, uncrossed and freshly carved, is one word. **THORNWICK**. <sub>(grade 2.9)</sub>

### `king-done` — story

**Text**

Ash and peeled lead mark where the king held court. The wall of names waits for a mason who is never coming. Thornwick's entry, you note in passing, remains unstruck. You intend to keep it that way. <sub>(grade 2.7)</sub>

**Choices**

- → Onward  → `undercrypt`

### `seal-approach` — story

**Text**

The lowest stair ends at the door the frescoes promised. It is a slab of stone the size of a barn wall, veined with lead marks. It bows *outward*, straining, as something on the far side leans its patience against it. The chanting you've heard for an hour resolves into words. Living voices speak them — the dead do not chant. <sub>(grade 3.4)</sub>

A congregation of the **living** kneels at the door. They wear robes the colour of grave-worms and hold candles of black tallow. This is the **Cult of the Worm**, come far and fast on the news of a failing seal. Their fanatic stands at the marks with a chisel of bone, prying up the lead one line at a time. A walking suit of ancient armour holds the stair. Two ghouls crouch among the candles like pets. <sub>(grade 4.0)</sub>

"Faster," the fanatic tells his chisel, sweetly reasonable. "The Warden is *so near the latch*." The rites of sealing are in your pack. The nerve, as promised, you brought yourselves. <sub>(grade 3.9)</sub>

**Choices**

- → Interrupt the service  → `seal-battle`

### `seal-battle` — battle

_Fight: cult on firepit_

**Intro**

The fanatic turns with the chisel still in his hand and rage flooding the sweet reason off his face. "The door opens for the *faithful*!" The armour grinds down the stair. The ghouls come low and fast between the candles. The last fight for the Undercrypt begins at the Warden's own threshold. <sub>(grade 3.7)</sub>

**On win**

> The fanatic dies reaching for the door. For the first time in a very long age, the door finds no one on its outer side. No one stands there except you, and the book. <sub>(grade 2.7)</sub>

### `resealing` — story

**Text**

You read the old rites off Halden's prayer-book by black candle-light, mispronouncing, in Wren's later and much-repeated estimation, "no more than a third of it." The lead marks take the words the way dry ground takes rain. Line by line, the great door stops *straining*. <sub>(grade 6.0)</sub>

Last of all comes the pressure behind it. A vast attention withdraws, unhurried and unimpressed, the way a creditor leaves a debtor's door: *not forgiven. Deferred.* Somewhere above, across the barrow-field, ten thousand dead lie down where they stand. <sub>(grade 6.7)</sub>

It is done. The door stands sealed. The **Warden** sleeps again, and the dead fall still. <sub>(grade -0.2)</sub>

The vigil holds. It has a new keeper now — a book, a door, and a town that knows to watch it. It will have to do. <sub>(grade 0.5)</sub>

**Choices**

- → Climb back to the light  → `sb-aftermath`

### `sb-aftermath` — story

**Text**

Wren is still holding the graveyard gate when you come up. She is upright, knife out, surrounded by a great settling field of the finally motionless dead. She wears the expression of someone determined to have been calm the whole time. The walk home is long, wet, and the best walk any of you can remember. <sub>(grade 5.5)</sub>

Thornwick reburies its dead in the following days, oldest graves first. The reeve stands bareheaded at every single service. He pays before anyone asks, and counts nothing twice. He shakes each of your hands one entire second longer than protocol requires. For Aldous, this is close to weeping. <sub>(grade 5.6)</sub>

Say it plainly, because you earned the right. Your victory over the Reedwife broke the seal and opened these graves. You went into the dark and closed it with your own hands. You fixed what your own triumph broke. <sub>(grade 2.4)</sub>

**Choices**

- → Accept the reeve's commission, paid in full  → `sb-aftermath`
- → Stand Mira's taproom a round, for once  → `sb-aftermath`
- → Let the town sleep  → `sb-epilogue`

### `sb-defeat` — story

**Text**

You wake in the Wander-Inn's back room with fen-mud in your ears and Mira's bone-broth steaming on the sill. Wren dragged you out — all of you, in relays, which she declines to describe and you decline to press. <sub>(grade 7.0)</sub>

"The fen's still there," Mira says, which is her way of asking if you're going back. You are. She puts the bread where you can reach it. <sub>(grade 0.6)</sub>

**Choices**

- → Back on your feet  → `town`

### `sb-epilogue` — ending

**Text**

The barrows sleep. The chapel is drained and re-blessed. The corpse-lights are out for good. Thornwick's lychyard holds precisely the population it should. The prayer-book lives in the reeve's strongest chest. The reeve has promoted Wren again, to her visible horror. She leads the watch that walks the old road once a season. <sub>(grade 4.1)</sub>

Only one thing sours the ale. On the last night, at the fen's edge, the reeds parted around two figures. They did not walk so much as *arrive* — tall, green-fingered, river-weed in their hair. They were sisters, unmistakably, of a certain late Reedwife. They looked at the resealed barrow-field for a long moment, and then at the town, the way creditors look at a debtor's house. Then the reeds closed, and they were gone — for now. Debts, in the deep fen, have a way of *coming due*. <sub>(grade 4.2)</sub>

## Journal entries

**The Opened Graves** _(quest)_

Thornwick's dead are leaving their graves and walking into the deep fen. Find what is calling them, and stop it. <sub>(grade 3.1)</sub>

**They Walk One Way** _(clue)_

Something opened the graves from below. Every trail leads the same way. They all point into the deep fen, where the old burial mounds stand. <sub>(grade 3.2)</sub>

**Reeve Aldous** _(npc)_

Thornwick's reeve is proud and paying, and he takes this one personally. His grandfather's grave is among the opened. His orders are simple. Follow the dead into the fen and end what calls them. <sub>(grade 4.0)</sub>

**Into the Deep Fen** _(lead)_

The dead walk one way — into the barrow-country of the deep fen. Wren waits at the fen road to guide you in. Find where the trails converge. <sub>(grade 1.9)</sub>

**A Muster of the Dead** _(clue)_

The dead left in ranks, oldest first — answering an authority, not a hunger. Something with the right to command graves is doing the commanding. <sub>(grade 6.8)</sub>

**Wren, Again** _(npc)_

Wren is the scout you pulled from under a horse on the marsh road. She has healed, she has earned a promotion, and she refuses to stay behind. She guides you through the deep fen. <sub>(grade 2.4)</sub>

**Called to Work** _(clue)_

The fen's dead have walked for days, in ranks, converging past the chapel and the corpse-lights on the old barrow-country. Whatever calls them is putting them to work. It is digging something open, or building something. <sub>(grade 6.8)</sub>

**The Rites of Sealing** _(clue)_

Brother Halden's prayer-book holds the old rites that closed the Undercrypt. The Reedwife's feeding was the watch that kept the Warden asleep. Her death ended it. Someone must speak the rites at the door itself, deep in the great barrow. <sub>(grade 3.9)</sub>

**The Warden Below** _(clue)_

The Undercrypt's wall-paintings name the truth. The Reedwife was the Warden's jailer. Her feeding was the watch that kept his door shut. Her death, your victory, is what opened the barrows. The rites in Halden's prayer-book can close the door again, spoken at the door itself. <sub>(grade 4.4)</sub>

