# gate
back: true
art: loc-camp 🏚️
A wall of lashed timber rings the hollow, with a watch-post looming over its only gate. Somewhere beyond it, the chief is waiting.
> Slip back in the way you left → inner  #back
  hide
  ? den-entered
> [Deception DC 10] Call the stolen gate-signal up to the post → den-slipped  #signal
  hide
  ? know-signal; not den-entered
  do +den-entered; +signal-spent
  check deception 10 → gate-signal-blown
  fail do -den-entered
> [Rogue · Sleight of Hand DC 10] Pick the lock on the little water-gate → den-picked  #lock
  once hide
  ? class rogue; not den-entered
  do +den-entered
  check sleight-of-hand 10 → den-lock-jammed
  fail do -den-entered
> [Stealth DC 13] Slip over the wall together → den-slipped  #sneak
  hide
  ? not den-entered
  do +den-entered
  check stealth 13 → gate-caught
  fail do -den-entered
  check roller: group
> Storm the gate → gate-fight  #fight
  hide
  ? not den-entered

# den-lock-jammed
noBack: true
art: loc-camp 🗝️
Down where the wall meets the marsh, a little gate lets the den draw water. Its lock is cheap and rusted, and your pick snaps off inside it. No one on the wall hears, but that gate will not open now, for anyone.
> Back to the main gate → gate  #back

# den-picked
art: loc-camp 🗝️
noBack: true
Down where the wall meets the marsh, a little gate lets the den draw water. Its lock is cheap and rusted. It takes your rogue about as long as a sneeze, and makes less noise.
> Slip inside → inner  #in
  do @GATE_PASSED

# den-slipped
noBack: true
art: loc-camp 🤫
You are inside the wall, and no horn has sounded. Up in the gateway something hairy and twice a man's size scratches itself and watches the marsh, its back to you. A heap of spotted, dog-faced things snores by the fire.
> Keep low and move in among the tents → inner  #in
  do @GATE_PASSED

# gate-fight
kind: battle
encounterId: den-gate
mapId: corridor
A horn brays from the watch-post, and the gate-runners answer. Something hairy and twice a man's size ducks through the gateway. Behind him three gnolls come yammering their high, laughing bark, and a fourth, hung with bone charms, howls them on. A spotted hyena as big as a pony lopes at their heels. The narrow timber run hems them all in.
again:
The watch-post saw you coming this time. The big one already fills the gateway, and his gnolls yammer behind him while the bone-hung one howls and their hyena slavers.
won → inner
  The big one goes down last, folding across the gateway.
  do +den-entered; +signal-spent; +den-alarm
parley deception 15 > Pass yourselves off as new blood
  refused: The big one sniffs you, slow and thorough. "Chief sent for nobody," he rumbles. "Chief never sends for anybody." Behind him the gnolls laugh harder.
  success → inner
    "Chief sent for fighters," you growl, and shoulder past the horn like you own the place. The big one sniffs you, weighs you, and decides you are someone else's problem. The gnolls fall in laughing behind you, and the den stays asleep.
    do +den-entered; @GATE_PASSED

# gate-signal-blown
noBack: true
art: loc-camp 📯
The watch-post goes quiet, and a voice calls down a countersign you never learned. Somebody up there knows that someone sold the gate-signal.
A horn brays, and torches run along the wall. You fall back into the reeds and lie in the mud while the watch hunts the hollow. It takes all night and most of the next day before the den settles. By then the watch has a new signal, and you do not know it.
> Crawl back up to the gate → gate  #back
  do day; -know-signal; +den-alarm
  journal clue c-signal-burned: The Gate-Signal Is Burned
    The den's watch knew someone sold the gate-signal, and they changed it. You will need another way past the gate: over the wall, or through it.

# gate-caught
kind: battle
encounterId: den-gate
mapId: corridor
surprise: party
Halfway over the wall, a stake shifts under a boot and cracks. A horn brays right above your heads. When you drop down inside, something hairy and twice a man's size is already waiting at the foot of the wall. A pack of spotted, dog-faced things yammers behind it.
won → inner
  The big one goes down last, face-first in the mud at the foot of the wall.
  do +den-entered; +signal-spent; +den-alarm

# den-muster
kind: battle
encounterId: den-pit
mapId: ruins
The chained shape in the pit stands up, and keeps standing up: an **ogre**, half-starved, whip-scarred and beside itself with rage. Two orc goaders work its temper with barbed poles, and when they see you they whoop and haul the pins.
On the far side of the ring, a bare-chested raider gets up off an upturned barrel. Scars run from his collarbone to his belt. He lifts a notched greataxe and rolls his shoulders. This is his pit.
"Fresh meat for the pit!" a goader bellows, and slips the ogre's chain.
again:
The ogre is off its chain now, and it is not going back on. The two orc goaders whoop and drive it at you with their barbed poles. Their scarred champion comes round the ring behind it, greataxe high.
won → @hub
  The ogre crashes down across its own broken chains. The goaders and their champion don't outlive it by much. The ogre's collar has worn a groove in its neck as deep as a thumb.
  Under the champion's barrel is a fat purse: the takings from every fight he ever won in this pit.
  do gold 40; +pit-won

# den-pens-door
noBack: true
art: loc-camp ⛓️
Behind the kennels stands a pen of lashed stakes, the kind a farmer keeps pigs in. Something in the straw shifts as your torch comes near.
> Look in the pen → den-pens  #look
  hide
  ? not captives-taken
  do +pens-found; +pens-settled
> Look in the pen → den-pens-empty  #look-late
  hide
  ? captives-taken
  do +pens-found; +pens-settled

# den-pens-empty
noBack: true
art: loc-camp ⛓️
assumes: captives-taken
There are no pigs in the pen, and no people. It was only a rat in the straw. The chain hangs open, and wet, webbed footprints lead from the gate toward the marsh. None lead back.
Something has come for them out of the water, and gone again. In the corner lies one small shoe.
> Back to the den → @hub  #ok

# den-pens
art: loc-camp ⛓️
assumes: not captives-taken
noBack: true
There are no pigs. A grey-bearded carter, two reed-cutters and a girl of about seven blink up at your torch.
The girl has one shoe, on her right foot. "They said the lady in the water comes for us when the moon goes dark," the carter whispers. "My gran left her a {door-price} every {door-midwinter}, and that was all she ever asked. Now the chief feeds her people." He swallows. "Are you the reeve's men?"
A chain and a heavy padlock hold the pen shut. Across the yard, a raider dozes by the fire with his spear across his lap.
> [Sleight of Hand DC 13] Work the padlock open quietly → den-pens-freed  #pick
  once
  check sleight-of-hand 13 → pens-alarm
> Hack through the stakes, and never mind the noise → pens-alarm  #hack
> Leave them for the reeve's men → den-pens-left  #leave
  do +captives-left; +captives-taken; npc wren attitude -1

# pens-alarm
kind: battle
encounterId: pen-watch
mapId: ruins
loot: false
noFlee: true
The noise carries. The raider by the fire jumps up and yells, and the den's watch comes running with him. Two hulking raiders with greataxes, four archers and an orc spread out in front of the pen. The carter pulls the girl down into the straw.
won → den-pens-freed
  do +den-alarm
  The last raider falls against the stakes, and no one else comes. Across the yard someone laughs at the noise and goes back to his dice.
lost → @hub
  You go down in the mud in front of the pen, and come to in the straw of the pen itself, left for dead. The gate stands open and the captives are gone. Their tracks lead out toward the deep fen.
  do +captives-taken; +den-alarm

# den-pens-freed
art: loc-camp ⛓️
noBack: true
The pen comes open. The carter lifts the girl onto his back, and the reed-cutters take a kennel-pole each. They slip off toward the gate and the dark of the marsh road, not making a sound.
> Back to the den → @hub  #ok
  do +captives-freed; npc wren attitude 1

# den-pens-left
art: loc-camp ⛓️
noBack: true
"The reeve's men will come," you tell them. The carter nods slowly and says nothing. The girl watches you go, one bare foot tucked up in the straw.
> Back to the den → @hub  #ok

# den-hyenas
kind: battle
encounterId: kennel-hyenas
mapId: ruins
Three giant hyenas and three grey wolves the size of ponies lunge to the ends of their chains at the sight of you. The {ashfang} raider who keeps them yanks the pins and runs. The pack comes loose in a scrabble of claws and yelping.
again:
The hyenas and the grey wolves are loose in the kennels now. Their keeper is long gone, and they come for you at once.
won → @hub
  The kennel falls quiet. In the straw you find a raider's stashed purse and a satchel worth the trouble. By the gate lies the key ring their keeper dropped as he ran. One key fits the plunder tent.
  do +kennel-cleared; gold 30; item potion-healing x1
parley animal-handling 12 > Throw them the meat off the cook fire
  refused: The pack goes for the meat and then for you, in that order, and not for long in the first.
  success → @hub
    The pack falls on the meat, snarling at each other instead of you, and you step round them to the gate. Their keeper dropped his key ring as he ran. One key fits the plunder tent.
    do +kennel-cleared; xp avoided kennel-hyenas

# den-cache
kind: check
skill: investigation
dc: 12
art: 📦
A tent of stolen goods, heaped anyhow. A careful search turns up the best of it.
success → @hub
  Beneath the junk you find real coin and a caravan's lost potion. Stuffed in a sack at the bottom is the **{ashfang} banner** itself. The reeve will pay extra for that.
  do gold 80; item potion-greater-healing x1; +looted
failure → @hub
  You grab what's in reach before the noise draws eyes.
  do gold 25

# vex-parley
kind: dialogue
noBack: true
npc: @LIEUTENANT
art: 🗡️
At the lone fire a lean, grey-templed raider watches you come. A bare blade lies across his knees. He holds it as if he would rather be leaning on it.
"**{vex}**," he says. "The chief's lieutenant, for my sins. He keeps an ogre in a pit for people like you. For me he keeps a knife he thinks I haven't seen." A thin smile, gone as fast. "So what do you offer a man for stepping aside?"
? not pens-found; not captives-taken | Before you can answer, he tips his head back toward the kennels. "One thing for nothing. There's a pen behind the dogs, with people in it. A carter and a little girl, among others. The chief keeps them for the lady in the water." He looks into his fire. "I never had the stomach to open it. You might. But do it before you go through to the chief. Once you're in that hall, don't count on walking back past the kennels."
? not pens-found; captives-taken | Before you can answer, he tips his head back toward the kennels. "There was a pen behind the dogs, with people in it. The lady in the water came for them when the moon went dark." He looks into his fire. "Go and look, if you want to know what the chief sold."
? den-alarm | "Not tonight, though." He doesn't take his eyes off the fire. "The whole den knows you're here. Every one of them is up and looking for you, and I'm not turning my coat in front of all of them."
> @VEX_OFFERS(true)
> @VEX_OFFERS(false)

# vex-turned
noBack: true
art: 🤝
? not vex-threatened | {vex} weighs it, then slides the blade home. "A road out of this valley, then. I'll take it before the reeve's men take it from me."
? vex-threatened | {vex} looks along your drawn blades, one by one, then slides his own home. "Not much of a choice, put like that. I'll take the road out of this valley, while I still have the legs for it."
"{hask} guards the chief, and {hask} answers to me. He'll find somewhere else to be — this once." He steps back into the smoke, unhurried. "Do it properly. I'm tired of soldiering for a man who burns barns and calls it strategy."
> Go and face the chief → @hub  #ok
  do npc vex met fate turned; xp avoided ashfang-hall - avoided ashfang-warlord-alone
  journal npc n-vex: {vex}, Turned
    {vex} the lieutenant has turned on the chief, and means to take the road out of the valley. {hask}, the chief's guard, answers to {vex}. He will stand aside when you face the chief, this once. After that, {vex} means to be gone.

# vex-refuses
noBack: true
art: 💢
{vex} studies you a long moment, then shakes his head, almost sorry about it. "No. You'd hang me the morning after, and we both know it."
"Pity. I'd have liked to see the far end of this valley." He melts back into the dark, toward the ridge above the den.
> Leave him to the dark → @hub  #ok
  do npc vex met

# vex-dismissed
noBack: true
art: 🗡️
"Suit yourself." {vex} turns back to his fire. "I won't help you. I won't get in your way, either."
> Leave him to his fire → @hub  #ok
  do npc vex met; +vex-rebuffed

# vargan-unread
noBack: true
art: loc-throne 👑
assumes: not vargan-shaken
His axe hand stays wrapped in its rag, and his face gives you nothing at all. Behind the throne the hag watches you look, and smiles.
> @turnUnread([])
> End them both → boss  #fight
  hide
  ? npc vex not fate turned
> End them both → boss-unguarded  #fight-alone
  hide
  ? npc vex fate turned

# boss-approach
art: loc-throne 👑
The chief's hall reeks of smoke and old blood. Trophies of a hundred raids hang from the rafters: a miller's ledger, a carter's whip, and a child's left shoe, small and still muddy.
The **{ashfang} chief** sits on a throne of lashed spears, a rag wound round his axe hand. In the shadows behind the throne something else unfolds — long and green and grinning, river-weed in its hair, fingers too many and too long. The **{reedwife}**, come up out of her water to see what her coin has bought.
"Up, **{vargan}**, my sweet," the hag says. "Guests." The chief rises.
"I was born down in {thornwick}," {vargan} says. "I cut reeds on that marsh for a copper a bundle, same as my father. The spring I was a boy, she raised the water, and my mother's house went under first. {thornwick} watched from the bank." He looks up at his trophies the way a farmer looks at a full barn. "The shallows were still common water. So this spring I came home and sold them to her. She paid me in monsters, and a valley to run. Fair price."
The hag laughs. "Fairer than the fen ever paid me. One {door-price} a winter, for sitting by their door in the dark." She turns to you, delighted. "You've been *busy*." At a flick of her hand, she calls for the chief's guard. The whole hall waits to see what you'll do.
again:
The chief's hall still reeks of smoke and old blood, and the child's shoe still hangs from the rafters.
**{vargan}** is back on his throne of spears, and the **{reedwife}** waits in the shadows behind it. "Back for more," the hag says, delighted. "Waste not." {vargan} only rolls the great axe off his shoulder.
? vargan-shaken | He keeps his branded hand shut in a fist. His eyes keep going back to it.
? den-alarm | The hall is full of raiders who heard you coming, and none of them is sitting down.
> [Insight DC 14] Look at his hands → vargan-brand  #insight
  hide
  attempt: brand
  ? npc vex not fate turned
  do +vargan-shaken
  check insight 14 → vargan-unread
  fail do -vargan-shaken
> [Insight DC 14] Look at his hands → vargan-brand-alone  #insight-alone
  hide
  attempt: brand
  ? npc vex fate turned
  do +vargan-shaken
  check insight 14 → vargan-unread
  fail do -vargan-shaken
> [Warlock · Arcana DC 11] Name the bargain burned into his hand → vargan-brand  #pact
  hide
  attempt: brand
  ? class warlock; npc vex not fate turned
  do +vargan-shaken
  check arcana 11 → vargan-unread
  fail do -vargan-shaken
> [Warlock · Arcana DC 11] Name the bargain burned into his hand → vargan-brand-alone  #pact-alone
  hide
  attempt: brand
  ? class warlock; npc vex fate turned
  do +vargan-shaken
  check arcana 11 → vargan-unread
  fail do -vargan-shaken
> @turnUnread([{ kind: 'notFlag', flag: 'vargan-shaken' }])
> [Persuasion DC 10] "The carter's girl is home. Your mother's house is still under the water." → vargan-turns  #turn-carter
  hide
  attempt: turn
  ? pens-settled; not captives-taken; npc vex not fate turned; not vargan-shaken
  check persuasion 10 → boss
> [Persuasion DC 10] "The carter's girl is home. Your mother's house is still under the water." → vargan-turns-alone  #turn-carter-alone
  hide
  attempt: turn
  ? pens-settled; not captives-taken; npc vex fate turned; not vargan-shaken
  check persuasion 10 → boss-unguarded
> [Persuasion DC 10] "She owns you too. Help us end her." → vargan-turns  #turn-shaken
  hide
  attempt: turn
  ? npc vex not fate turned; vargan-shaken
  check persuasion 10 → boss-shaken
> [Persuasion DC 10] "She owns you too. Help us end her." → vargan-turns-alone  #turn-shaken-alone
  hide
  attempt: turn
  ? npc vex fate turned; vargan-shaken
  check persuasion 10 → boss-unguarded-shaken
> End them both → boss-unguarded  #fight-alone
  hide
  ? npc vex fate turned; not vargan-shaken
> End them both → boss-unguarded-shaken  #fight-alone-shaken
  hide
  ? npc vex fate turned; vargan-shaken
> End them both → boss  #fight
  hide
  ? npc vex not fate turned; not vargan-shaken
> End them both → boss-shaken  #fight-shaken
  hide
  ? npc vex not fate turned; vargan-shaken

# boss
kind: battle
encounterId: ashfang-hall
mapId: firepit
@loot: {"bonusTier":"rare"}
"You've cost me a good season," the chief says, almost mild, and rolls the great axe off his shoulder. Beside him the hag only laughs, low and pleased, her fingers already weaving something cold out of the smoke. "Oh, don't kill them quickly," she tells him. "Waste not."
The chief's guard answers her call from the door. He is a grey, scarred soldier, and the only one in the hall who looks as if he has done this before. He comes for you without a word, and a raider with a knife comes in at his back.
again:
The hag's fingers are already weaving something cold out of the smoke. "Don't kill them quickly this time," she tells the chief. His grey old guard is back at his shoulder, and the raider with the knife behind him.
won → vargan-beaten
  The chief's axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging. By the door the chief's grey old guard is down, and the raider who stood with him lies across the threshold.
  @BOSS_HOARD
  do @BOSS_WON

# boss-shaken
kind: battle
encounterId: ashfang-hall
mapId: firepit
surprise: enemies
@loot: {"bonusTier":"rare"}
?! vargan-shaken | {vargan} closes his fist over the brand and looks at it a moment too long, and the hag does not tell him to stop. By then you are already moving.
By the door, the chief's guard is still reaching for his weapon. He is a grey and scarred old soldier. The raider beside him is still fumbling for his knife.
again:
?! vargan-shaken | {vargan}'s eyes go to his shut fist again, and the hag lets them. By then you are already moving.
won → vargan-beaten
  {vargan} fights with one eye on his own shut fist. The chief's axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging. By the door the chief's grey old guard is down, and the raider who stood with him lies across the threshold.
  @BOSS_HOARD
  do @BOSS_WON

# boss-unguarded
kind: battle
encounterId: ashfang-warlord-alone
mapId: firepit
@loot: {"bonusTier":"rare"}
?! npc vex fate turned | The chief bellows for {hask}, his guard. {hask} stands by the door with his spear grounded. He looks at the chief, then at you, and steps aside to let you pass before he walks out into the smoke. {vex} has kept his word.
"You've cost me a good season," {vargan} says anyway, almost mild, and rolls the great axe off his shoulder. The hag goes quiet. Her eyes flick to the doorway, counting the blades that didn't come.
She whistles, low and wet. One raider comes in from the yard, white-faced. Behind him something long and heavy pours over the threshold out of the night. It is a marsh snake as thick as a man's waist, with reeds and a reaching hand branded into its scales.
again:
?! npc vex fate turned | {hask} is nowhere in the hall. {vex}'s word still holds.
{vargan} rolls the great axe off his shoulder again. The hag whistles, and her branded snake pours over the threshold once more, with the one raider who stayed.
won → vargan-beaten
  The chief's axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging. Across the threshold her branded snake lies dead in its own coils, and the one raider who stayed lies beside it.
  @BOSS_HOARD
  do @BOSS_WON

# boss-unguarded-shaken
kind: battle
encounterId: ashfang-warlord-alone
mapId: firepit
surprise: enemies
@loot: {"bonusTier":"rare"}
?! npc vex fate turned; vargan-shaken | {vargan} closes his fist over the brand and bellows for {hask}. By the door, {hask} grounds his spear, steps aside to let you pass, and walks out into the smoke.
"Waste not," the hag hisses, and whistles. One raider comes in from the yard. Behind him a marsh snake as thick as a man's waist pours over the threshold, with reeds and a reaching hand branded into its scales. By then you are already moving.
again:
?! npc vex fate turned; vargan-shaken | {hask} is still gone, and {vargan} still keeps his branded hand shut in a fist.
"Waste not," the hag hisses, and her branded snake pours over the threshold again with the one raider who stayed. By then you are already moving.
won → vargan-beaten
  {vargan} fights with one eye on his own shut fist. The chief's axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging. Across the threshold her branded snake lies dead in its own coils, and the one raider who stayed lies beside it.
  @BOSS_HOARD
  do @BOSS_WON

# vargan-brand
noBack: true
art: loc-throne ✋
@VARGAN_BRAND
> [Persuasion DC 10] "She owns you too. Help us end her." → vargan-turns  #turn
  attempt: turn
  check persuasion 10 → boss-shaken
> Strike while he stares → boss-shaken  #strike

# vargan-brand-alone
noBack: true
art: loc-throne ✋
@VARGAN_BRAND
> [Persuasion DC 10] "She owns you too. Help us end her." → vargan-turns-alone  #turn
  attempt: turn
  check persuasion 10 → boss-unguarded-shaken
> Strike while he stares → boss-unguarded-shaken  #strike

# vargan-turns
noBack: true
art: loc-throne ✋
@VARGAN_TURNS
The hag looks down at him a moment, and when she looks up she is smiling.
> Face the {reedwife} → reedwife-fight  #fight
> @BIND_HAG_RITE_CHOICE('bind-hag-rite')

# vargan-turns-alone
noBack: true
art: loc-throne ✋
@VARGAN_TURNS
The hag looks down at him a moment, and when she looks up she is smiling.
> Face the {reedwife} → reedwife-fight-alone  #fight
> @BIND_HAG_RITE_CHOICE('bind-hag-rite-alone')

# bind-hag-rite = @BIND_HAG_RITE('bind-hag-rite', 'hag-guarded', 'reedwife-fight', 'At the door she whistles for the chief\'s guard. He comes out of the smoke at her call with four raiders at his back. He watches her go, and then walks out into the smoke after her, and his raiders go with him.')

# bind-hag-rite-alone = @BIND_HAG_RITE('bind-hag-rite-alone', 'hag-whistled', 'reedwife-fight-alone', 'At the door she whistles for {hask}, and he does not come. Two raiders stumble in from the yard. Behind them something long and heavy slides over the threshold. It is a marsh snake as thick as a man\'s waist, with reeds and a reaching hand branded into its scales. The raiders watch her go, and then run too. The snake pours out after her into the dark.')

# reedwife-fight
kind: battle
encounterId: hag-guarded
mapId: firepit
noFlee: true
@loot: {"bonusTier":"rare"}
parley: @BIND_HAG('hag-guarded', 'The chief\'s guard watches her go, and then walks out into the smoke after her. His four raiders go with him.')
The **{reedwife}** stands by the fire-pit with marsh water dripping from her fingers. "Waste not," she says, and whistles for the chief's guard again. He comes out of the smoke at last, with four raiders at his back: three orcs and an archer.
again:
The {reedwife} is still by the fire-pit. "Up again, sweetlings?" She whistles, and the chief's guard comes back out of the smoke with his four raiders.
won → vargan-fate
  The **{reedwife}** staggers back into the fire-pit and goes down hissing among the coals. When the steam clears she is still lying there, and she does not get up. The smell of her, rotten water and burning weed, hangs in the hall for a long time. The four raiders lie where they fell, and the chief's grey old guard is down among them.
  @REEDWIFE_HOARD
  do @BOSS_WON
lost → reedwife-lost

# reedwife-fight-alone
kind: battle
encounterId: hag-whistled
mapId: firepit
noFlee: true
@loot: {"bonusTier":"rare"}
parley: @BIND_HAG('hag-whistled', 'Her two raiders watch her go, and then they run too. The snake pours out after her into the dark.')
The **{reedwife}** stands by the fire-pit with marsh water dripping from her fingers. "Waste not," she says, and whistles for the chief's guard again. {hask} still does not come. Two raiders come in from the yard instead, an orc and an archer. Behind them something long and heavy pours over the threshold out of the night. It is a marsh snake as thick as a man's waist, with reeds and a reaching hand branded into its scales.
again:
The {reedwife} is still by the fire-pit. She whistles for {hask} once more, and he still does not come. Her two raiders come in from the yard again, and her branded snake pours over the threshold behind them.
won → vargan-fate
  The **{reedwife}** staggers back into the fire-pit and goes down hissing among the coals. When the steam clears she is still lying there, and she does not get up. The smell of her, rotten water and burning weed, hangs in the hall for a long time. Across the threshold her branded snake lies dead in its own coils, and her two raiders lie beside it.
  @REEDWIFE_HOARD
  do @BOSS_WON
lost → reedwife-lost-alone

# reedwife-lost
kind: rest
variant: long
sameDay: true
next: reedwife-fight
@REEDWIFE_LOST

# reedwife-lost-alone
kind: rest
variant: long
sameDay: true
next: reedwife-fight-alone
@REEDWIFE_LOST

# vargan-beaten
noBack: true
art: loc-throne ⚖️
{vargan} is down on one knee in the ashes of the fire-pit, and his axe lies out of his reach. He is still breathing.
? vargan-shaken | The brand on his hand has gone grey, like an old scar. He looks at it, and not at you.
? not vargan-shaken | The rag has burned off his axe hand. Under it is a brand of reeds and a reaching hand, the mark the lizardfolk wore, gone grey like an old scar.
"Go on, then," he says. "{thornwick} will only hang me slower."
> @BIND_VARGAN
> @FREE_VARGAN('Let him crawl out into the marsh')
> @END_VARGAN

# vargan-fate
noBack: true
art: loc-throne ⚖️
{vargan} sits against his throne of spears. The brand on his hand has gone grey, like an old scar. He does not reach for his axe.
"{thornwick} will want me hanged," he says. "{thornwick} is right. I sold her their common water, and I called it a fair price." He looks at the trophies in the rafters. "Do what you came to do."
? class cleric | Your cleric kneels beside him and studies the grey brand. There is no prayer for this, and {vargan} does not ask for one.
> @BIND_VARGAN
> @FREE_VARGAN('Let him walk out into the marsh')
> @END_VARGAN
