// The painted hall shows the Warden's door, and the old kings' salute (the
// wights' answer), and the man running the door's clock.
# hall
art: loc-crypt 🎨
noBack: true
The stair opens into a painted hall. The pictures tell one story, over and over. A **door** stands under the earth with a **horned warden** behind it, and before it, age after age, a **woman of the reeds** keeps watch.
In one panel a line of soldiers in green bronze stands before the door, each with a fist pressed flat to his chest. It is the old kings' salute, and the painter took great care over it.
The last panel is fresh mud smeared over old paint. One angry stroke crosses her out. Beneath her, many dead hands scrawled the words: **THE VIGIL HAS ENDED. THE DOOR OPENS FROM WITHIN.**
A thin grey man in a gravedigger's apron stands under the last panel. He smooths the mud flat with his palm, the way you would pat down a fresh grave. A bundle of black candles hangs at his hip.
? npc halden fate saved | A grey little gravedigger, {halden} said. The one who brought the candles.
? not diggers-passed | He sees your torch and is not alarmed. "Mind the cut," he says kindly. "My diggers are working down there, and they don't like to be stopped."
? diggers-passed | He sees your torch and is not alarmed. "You got past my diggers," he says kindly. "No matter. They have dug enough."
? not door-straining | "Soon enough, the {warden} will put his own shoulder to the door." He picks up his lantern and goes on down into the dark.
? door-straining | "You felt the ground shake? That was the {warden}, leaning on his door." He picks up his lantern and goes on down into the dark.
> Go deeper in → @hub  #on
  do +hall-seen
  journal clue c-warden: The Door Opens From Within
    The painted hall shows the {warden}'s door, far below, and the reed-woman who guarded it. His servants are at the door now. Get there first and speak {halden}'s rites.

# ossuary
kind: check
skill: investigation
dc: 12
art: 💀
Skulls fill this room from floor to ceiling, stacked in rows like bricks. Old gold winks from the niches between them. A careful eye might take some of it back up.
success → @hub
  Behind a row of skulls, the builders left a hidden nook. Inside are coins stamped with kings with no names, and a flask of drink that has gone strong with age instead of sour.
  do gold 90; item potion-greater-healing x1
failure → @hub
  You grope through two niches, touch something that crunches, and decide to stop. You leave with a few loose coins off the floor.
  do gold 20

// Thornwick's own dead, quarrying the lead. Among them is the reeve's
// grandfather, in his chain.
# diggers
kind: obstacle
art: loc-crypt ⛏️
fight: diggers on corridor
after: diggers-chain
{thornwick}'s dead fill the cut. They still wear their burial clothes. They chip at a seam of grey **lead** in the wall with picks, stones and bare fingers. No one stands over them. The picks keep time on their own.
The cut is just wide enough for them. Near the far end, one digger wears a chain of office over its burial coat.
again:
{thornwick}'s dead are still digging at the lead, wall to wall.
answer stealth 12 > Slip past along the wall  #sneak
roller: group
retry
The picks ring loud enough to cover a footstep. You edge along the wall between swings, and not one head turns.
answer religion 13 > Say the burial words over them  #still
attempt: words
You speak the old words, slow and plain. *Lie down and be at peace. Your work is done.* One by one the picks go quiet, and the dead lie down in the cut in rows.
answer deception 10 > Fall in at the back of the oldest rank  #ranks
? graves-ranks
attempt: words
You find the oldest rank by its grave-clothes and fall in at the back of it. Swing, step, swing. The dead make room for you without breaking step, and you walk out the far end, still swinging.
answer religion 10 > Raise a holy symbol and turn them aside  #turn
? class cleric
tag: Cleric
attempt: words
A light that is not torch-light fills the cut. The dead shuffle back from it like sheep from a dog, and press to the walls, and leave you a road.
answer religion 10 > Stand in their road and speak your oath  #oath
? class paladin
tag: Paladin
attempt: words
like: turn
fight > Wade into the diggers  #fight
The dead come down the cut with their picks raised. Two are bare bones in grave-rags. Three are fresh, and still wear the faces {thornwick} buried. Hit hard, and try not to look.
again:
The dead are waiting in the cut this time, picks raised.
won:
The last digger falls across its pick. The cut goes quiet, apart from your breathing.

// The old reeve home (a day's carrying, and the town's regard), or the
// grave-goods, whose silvered spear bites the dead still ahead.
# diggers-chain
art: loc-crypt ⛓️
noBack: true
At the end of the cut, an old man in a good burial coat has folded down against the wall. A reeve's chain of office hangs round his neck, the twin of the one {aldous} grips in his hall. He is light now, just bones in a coat.
? with wren | {wren} kneels and straightens the chain on his chest. "The reeve's grandfather," she says, and nothing else.
The diggers stacked their grave-goods against the wall: rings, buckles, old coin, and a boar-spear with a silvered head. You can carry the old man, or the heap, but not both, and the old man will slow you all the way down.
> Carry him home in your cloak, though it will cost the day → @hub  #carry
  do +diggers-passed; +grandfather-home; @REGARD; {"kind":"npc","npc":"wren","attitude":1,"hearsay":true}; day
  journal clue c-grandfather: The Old Reeve
    Reeve {aldous}'s grandfather was digging with the dead in the {undercrypt}. You are carrying him home to {thornwick}.
> Lay him down here, chain and all, and take the grave-goods → @hub  #leave
  do +diggers-passed; gold 40; item silvered-spear

// An old soldier at his post: fought, or relieved of it with the salute the
// painted hall shows.
# wights
kind: obstacle
art: loc-crypt ⚔️
fight: wight-tomb on corridor
done: wights-down
This is the hall of the kings' guard. Three slabs of black stone stand in the dark. On the middle one, an old guardsman in barrow-armour sits *up*, with cold light burning in its eye sockets. It draws a sword of green bronze, like the soldiers in the paintings, and takes a **stance**.
again:
The old guardsman stands before its slab again, sword drawn, cold light in its eyes.
answer history 15 > Relieve him of his post, the old way  #salute
? hall-seen
You give the salute the painted hall showed, fist to chest, and tell him his watch is over. At last he lowers his sword and lies back down on his slab, and his skeletons lie down with him.
fight > Draw on him  #fight
From the slabs on either side, two skeletons rise to guard it. They snap to their feet at the same instant, and come for you.
again:
The guardsman's two skeletons stand at its sides, heads turned toward you.
won:
The wight comes apart at the joints and lies down in its own armour. Under its slab lies a guardsman's pay that no one ever came to collect.
do gold 40

# king
kind: battle
encounterId: barrow-king
mapId: ruins
Old masons sealed the king's chamber in lead. Something has peeled the lead back like fruit-rind, from the *inside*. Inside, a figure in grave-wrappings the colour of old honey stands before a carved wall. It is cut with the names of villages, hundreds of them, and a line runs through every one.
The embalmed king turns. Someone has set a crown of green bronze back on his head, and set it straight. Two of his household dead lurch from the corners, and beside the throne a barrow-soldier in green bronze draws its sword.
again:
The embalmed king still stands before his wall of crossed-out villages. His household dead lurch out of the corners again, and his soldier draws its sword.
won → @hub
  The king crumbles to dust and old spice, his servants drop mid-lurch, and his soldier folds down in its bronze. At the bottom of the wall, one name sits freshly carved, with no line through it yet. **THORNWICK**.
  You pick his gold rings out of the dust. Behind the throne, a burial shaft drops into the dark, and chanting comes up out of it. There will be no climbing back up it.
  do +king-down; gold 60

// No way back up the shaft: the cult's candles light the last stair.
# shaft
art: loc-crypt 🕯️
noBack: true
You land hard in old bones and older dust. The shaft goes up into the dark, far out of reach. Below, black candles burn on every step of the last stair, toward the chanting.
again:
The black candles still burn on every step below you, and the chanting has not stopped.
> Go down toward the chanting → seal-approach  #down
> Sleep at the shaft's foot (long rest) → shaft-rest  #rest
  once

# shaft-rest
kind: rest
variant: long
next: shaft
You sleep badly, under the black candles, with the chanting for a lullaby. Nobody below comes up to look.

# seal-approach
art: loc-dungeon 🚪
noBack: true
The lowest stair ends at the door the paintings promised. It is a slab of stone the size of a barn wall, with old words cut across it and lead in every letter. The stone bows *outward*, as something behind it leans its weight on it.
The chanting comes from the **living**. They kneel at the door with candles of black tallow, in long robes the colour of grave-worms. Their leader is the thin grey man from the painted hall. He pries the lead out of the door one letter at a time with a chisel of bone.
A walking suit of ancient armour guards the stair. Two ghouls crouch among the candles like pets. Against the door sit two soldiers of the old kings in green bronze, waiting for an order.
"**{marrow}**," the grey man says, without stopping. "I brought your priest his candles. I dug graves at {saltmere} for thirty years. Then the fever came. I buried the whole village, my wife and my two boys last, and walked away and left them in the cold. The {warden} leaves nobody in the cold. Is that so wicked?"
? door-straining | The door has shifted in its frame since the ground shook. A line of dark shows along its top. "He leaned on it in the night," {marrow} says. "It will be harder to shut now."
again:
{marrow} is still at the door, prying the lead out of its letters. "Back again," he says. "It is nearly open now."
> [Persuasion DC 14] Tell {marrow} what the king's wall says → seal-doubt-words  #wall
  once
  check persuasion 14 → seal-battle
  fail do +kneelers-scorned
> Interrupt the service → seal-battle  #fight

# seal-doubt-words
noBack: true
art: loc-dungeon ⛏️
You tell him about the wall in the king's chamber: hundreds of villages, with a line through every one. "{thornwick} is the next name," you say. "{saltmere}'s graves will be on the wall after that."
{marrow}'s chisel stops. His acolyte sees it stop, and screams that {marrow} has lost his faith.
> Face what is left of his flock → seal-doubt  #on
  do xp avoided cult-at-door - avoided cult-wavering

// Talked round, Marrow sits it out, and half his flock with him. No falling
// back: the stair behind leads only to the shaft.
# seal-doubt
kind: battle
encounterId: cult-wavering
mapId: firepit
noFlee: true
@loot: {"bonusTier":"rare"}
{marrow} sits with his back against the door, his chisel loose in his lap. The armour and the ghouls come for you anyway, and two of the kneelers come up off their knees, praying aloud. One bronze soldier gets to its feet at the acolyte's scream. Its twin waits for an order, and {marrow} gives none.
again:
The acolyte is still shrieking. The armour, the ghouls, the two praying kneelers and the one bronze soldier come for you again. {marrow} still has not lifted his chisel.
won → seal-door
  The last ghoul falls among the candles. The bronze soldier that rose lies broken at the foot of the stair, and the cold light goes out of its twin's eyes. {marrow} is still sitting against the door.
  Coins lie thick on the bottom step, thrown there by the faithful. You gather them up.
  do +cult-broken; gold 120
lost → seal-doubt-lost

# seal-doubt-lost
kind: rest
variant: long
sameDay: true
next: seal-doubt
The ghouls drag you down among the candles. When you come round, you are lying by the shaft with a gravedigger's coat folded under your head. Below, the acolyte is still shrieking, and {marrow} still has not lifted his chisel.

# seal-battle
kind: battle
encounterId: cult-at-door
mapId: firepit
noFlee: true
@loot: {"bonusTier":"rare"}
? kneelers-scorned | {marrow} hears you out without stopping his chisel. "Then the {warden} chose {thornwick}," he says. "He chose well." Behind him the kneelers laugh, all together, and lift their black candles higher.
{marrow} turns with the chisel in his hand, and rage floods the sweet reason off his face. "The door opens for the *faithful*!" His acolyte pulls a knife. The armour grinds down the stair, the ghouls come low and fast between the candles, and the two bronze soldiers get to their feet.
again:
{marrow} turns from the door again, chisel in hand. The armour, the ghouls and the two soldiers in green bronze come for you once more.
won → seal-door
  {marrow} dies reaching for the door. His kneeling faithful stare at the body and do not get up. Coins lie thick on the bottom step, where the faithful threw them. You sweep them into a sack.
  do +cult-broken; +marrow-dead; gold 120
lost → seal-battle-lost

# seal-battle-lost
kind: rest
variant: long
sameDay: true
next: seal-battle
A knife-hilt catches you behind the ear, and the candles go out. You come to by the shaft with your wrists tied. The faithful were too busy with the door to finish you, and the chanting has not missed a beat.

// The fighting over: what to do with a Marrow who lived, and Halden keeps his
// promise. The door's clock decides which door the book is opened at.
# seal-door
art: loc-dungeon 🚪
noBack: true
Quiet settles over the last stair. Only the door still makes a sound, a slow grinding, as the {warden} leans on what is left of its lead.
? not marrow-dead | {marrow} looks up at the letters he pried loose. "I thought he would give them back to me," he says. "My faithful will sing whatever I sing. Or you can take me up to your reeve."
? npc halden fate saved | Boots scrape in the shaft above. Brother {halden} drops down it, skinning his palms, and limps down the last stair. He promised to follow you down, and he has.
> Make {marrow} lead his faithful in the rites → seal-door-book  #sing
  hide
  ? not marrow-dead
  do npc marrow fate sings
> Bind {marrow} for the reeve, and take the cult's offering-purse → seal-door-book  #bind
  hide
  ? not marrow-dead
  do npc marrow fate bound; gold {offering-purse}
> Open {halden}'s book at the door → seal-door-book  #open
  hide
  ? marrow-dead

# seal-door-book
art: loc-dungeon 📖
noBack: true
? npc marrow fate sings | {marrow} kneels down among his faithful. "Read, or let me read. Whoever reads, they will chant it after, because I will."
? npc marrow fate bound | You tie {marrow}'s wrists with his own apron strings, and take the offering-purse from his belt.
You open {halden}'s book.
> Read → resealing  #read
  hide
  ? not door-straining
> Read → resealing-shifted  #read-shifted
  hide
  ? door-straining

# resealing = @RESEALING(false)
# resealing-shifted = @RESEALING(true)

// The rites failed, and the Warden pushed back: a setback, not a payday.
# seal-breach
kind: battle
encounterId: warden-dead
mapId: firepit
noFlee: true
@loot: false
The {warden}'s own dead squeeze out through the split in his door. Skeletons in green bronze come first, then three swollen fen-dead, then two tall dead soldiers with drawn swords. If they get past you, {thornwick} is next.
again:
The {warden}'s dead are still coming, a few at a time. If they get past you, {thornwick} is next.
won → seal-closed
  The last of them falls across the doorstep. You put your shoulders to the door and shove it home over the bodies, and shout the rites into the crack, badly and all at once. It is enough, barely.
  do +seal-cracked
lost → seal-breach-lost

# seal-breach-lost
kind: rest
variant: long
sameDay: true
next: seal-breach
Grey hands close over your face. You wake on the stair, far above the door, and the dead have not climbed past you. They are still squeezing through, one at a time. Someone has to hold that door, and it is still you.

# seal-closed
art: loc-dungeon 🚪
noBack: true
? not seal-cracked | Line by line the great door stops *straining*, and the weight behind it eases off. Something enormous turns away, unhurried, like a sleeper turning over in a warm bed. The **{warden}** sleeps. The door is shut.
? seal-cracked | The door holds, but the crack in it does not close. Behind the stone the {warden} settles without sleeping, and now and then the door ticks under your hand like a knuckle tapping.
Far above you, across the barrow-field, every walking corpse lies down where it stands.
Among the cult's packs you find a rope ladder and a grapnel. You throw the hook up the burial shaft until it bites.
> Climb back to the light → sb-aftermath  #home
