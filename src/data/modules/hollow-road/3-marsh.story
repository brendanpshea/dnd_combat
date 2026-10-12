# trailhead
art: loc-road 🛤️
?! spy-caught | The peddler is in the reeve's cells now. The gate-warden stands aside, and **{thornwick}** falls away behind you. Ahead the road narrows into the **marsh**, a ribbon of mud between dark pools and whispering reeds.
Somewhere out in that maze the {ashfang} keep their den. Somewhere a good deal closer, it seems, they keep their eyes on the road.
> Set out on the marsh road → road-out  #go

# trailhead-clear
art: loc-road 🛤️
The gate-warden waves you through, and the marsh road lies quiet. The goblins you met on it have not come back.
> Take the marsh road again → trail  #go

# road-out
kind: battle
encounterId: goblin-outriders
mapId: open
Barely a mile from the gate the reeds erupt. A pack of goblins spills onto the road, yelling as if they had been waiting for you all day. Their boss lopes out in front with his scimitar bared, cackling and pointing at your boots. At his heel slinks a grey wolf the size of a pony, its lips drawn back from yellow teeth.
again:
The goblin outriders are still in the reeds a mile from the gate. Their boss lopes out in front of the pack again, scimitar bared, cackling, his great grey wolf at his heel.
won → trail
  The goblin pack breaks and vanishes into the reeds, and ahead of you the marsh swallows the road whole. Your arms ache.
parley intimidation 13 > Stare down the goblin boss
  refused: The goblin boss counts your blades, then counts his pack, and likes his own sum better. "Chief pays for heads," he cackles in bad Common. "Yours."
  success → trail
    You hold his eye and draw steel slow, and let him count your blades. The cackle dies in his throat. He barks something at his pack, and they melt back into the reeds as if they were never there. Behind you, somebody lets out a long breath. Not one blade got wet.
    do xp avoided goblin-outriders

# tracks
art: 👣
Boot-prints and drag-marks cross the mud. Read them right, and they will lead you through the reeds.
> [Ranger · Survival DC 9] Read the patrols' line at a glance → tracks-read  #ranger
  hide
  ? class ranger
  attempt: tracks
  check survival 9 → tracks-lost
> [Survival DC 12] Follow the boot-prints → tracks-read  #read
  attempt: tracks
  check survival 12 → tracks-lost

# tracks-read
art: 👣
noBack: true
The tracks tell their whole story: a heavy patrol out at dusk, a lighter one back at dawn, always the same dry line through the reeds. You've found the **safe path to the hollow**.
> Follow the dry line → @hub  #ok
  do +trail-read; xp 20

# tracks-lost
art: 👣
noBack: true
The prints tangle and double back on themselves until your eyes water, but they point roughly toward the hills. That's enough to find the hollow by, if not the dry way there.
The wet way is slow and loud. You will come at the hollow splashing from one tussock to the next. Anything waiting in the reeds will hear you long before you see it.
> Head for the hills → @hub  #ok
  do +trail-read; +trail-wet

# tracks-mapped
art: 🗺️
assumes: trail-known
noBack: true
The old trapper's ale-sketch was a good one. The reeds, the pools and the hollow in the hills all line up with the mud. The patrols' dry line runs just where his finger traced it.
> Follow the trapper's line → @hub  #ok
  do +trail-read; xp 20

# hollow-quiet
art: loc-marsh 🌾
assumes: know-hag
noBack: true
The hollow lies quiet where you broke the {reedwife}'s ambush, with nothing left of it but flattened reeds and still water. The den's wooden wall waits ahead.
> Make for the den's wall → gate  #ok
  hide
  ? without wren
> Make for the den's wall → wren-parts  #wren
  hide
  ? with wren
> Take the marsh road back → trail  #back
  hide
  ? without wren

# ravine
kind: challenge
art: 🪨
retry: perApproach
A collapsed ravine cuts the trail. The other lip is close, but the gap between is all loose rock, and there is more than one way across it.
again:
The ravine still cuts the trail. You look the loose stone over again for a way across you have not tried.
approach climb athletics 13 > Climb the sheer face
  success → @hub
    You haul each other up and over, hand over hand.
    do +crossed-ravine; xp 30
  failure → ravine
    A hold crumbles and you slide back down in a clatter of stone. That way will not work.
approach scramble acrobatics 12 > Pick across the rubble where it lies shallowest
  success → @hub
    Light on your feet, you thread the shifting stones and reach the far lip.
    do +crossed-ravine; xp 30
  failure → ravine
    The loose stone gives all at once and you scramble back before it takes an ankle with it.
approach detour survival 11 > Look for a gentler way round
  hint: It will cost you time.
  success → @hub
    You trace a gentler slope downstream and lead the party around dry-shod. It costs time, but nothing else.
    do +crossed-ravine; xp 15
  failure → ravine
    You follow the lip of the ravine downstream for an hour, and it only gets deeper. You trudge back to where you started.
success → @hub
  do +crossed-ravine
failure → @hub
  Every way across fights you. In the end you take the long, muddy detour downstream, miles out of your way. By the time you climb back onto the trail past the ravine, the light is gone. You have lost the whole day.
  do +crossed-ravine; day

# wounded
kind: dialogue
npc: @SCOUT
art: 🤕
noBack: true
A young scout in the reeve's colours lies pinned under a dead horse, an arrow through her leg, her jaw set hard against the pain. "I'm fine," she says — a lie you can see from here. "Get the horse off me and I'll tell you everything. How they're set, where they watch. I counted. That's the job."
The mud under the arrow is dark and wet. She will not last many more nights out here.
> Give her a healing potion → scout-saved  #potion
  hide
  ? item potion-healing
  do drop potion-healing x1
> [Paladin · Religion DC 9] Lay hands on the wound → scout-saved  #lay-hands
  hide
  ? class paladin
  attempt: scout-wound
  check religion 9 → scout-fail
> [Cleric · Religion DC 9] Pray over the wound → scout-saved  #pray
  hide
  ? class cleric
  attempt: scout-wound
  check religion 9 → scout-fail
> [Druid · Nature DC 9] Pack the wound with marsh-moss → scout-saved  #moss
  hide
  ? class druid
  attempt: scout-wound
  check nature 9 → scout-fail
> [Medicine DC 12] Ease her out and bind the leg → scout-saved  #medicine
  attempt: scout-wound
  check medicine 12 → scout-fail
> Leave her and press on → scout-left  #leave
  do +scout-walked-past

# scout-left
art: loc-marsh 🐴
noBack: true
You step around the horse. She doesn't call after you. She only watches you go, jaw still set.
Behind you the reeds close over the trail. You don't look back.
> Keep walking → @hub  #ok

# scout-passed
art: loc-marsh 🐴
assumes: scout-walked-past; not scout-bled-out
noBack: true
The dead horse still lies across the trail. The scout is gone. A line of flattened reeds drags away toward {thornwick}, and you cannot tell who made it.
> Leave the horse where it lies → @hub  #ok

# scout-saved
noBack: true
art: ❤️‍🩹
The horse comes off and the bleeding stops, and the scout lets out a breath she has been holding for hours. "**{wren}**," she offers, as if admitting to a name costs her something. She scratches the den's watch-posts into the mud, quick and exact.
@WREN_ON_VEX
> Send {wren} back to {thornwick} → @hub  #ok
  do @WREN_SAVED; npc wren attitude 1
> Ask {wren} to come with you through the marsh → wren-joins  #come
  hide
  ? not den-entered
  do @WREN_SAVED; npc wren attitude 1; join wren

# wren-joins
noBack: true
art: 🧭
assumes: with wren
{wren} tests the bound leg, winces, and decides it will do. "I know where the sinkholes are. You don't." She takes up her bow. "As far as their gate. Then I go for the reeve's men, and you had better still be alive when I get back."
> Follow {wren} into the marsh → @hub  #go

# wren-parts
noBack: true
art: loc-camp 🧭
assumes: with wren
At the tree line above the hollow {wren} stops, and eases her weight off the leg. "This is as far as I said." She looks down at the hollow a long moment. "Reeve's men by nightfall, if I run. Leave me something to arrest."
> Let her go, and face the gate → gate  #go
  do leave wren

# scout-fail
noBack: true
art: 🩸
It goes wrong. As the horse comes off her the arrowhead shifts, and the blood comes fast and dark. She fumbles at her belt for the healing potion she could never reach with the horse on top of her. You get it down her, and press on the wound until your arms shake.
The bleeding stops at last, with the light already going. "**{wren}**," she says, grey to the lips. "In case you have to tell someone." She scratches the den's watch-posts into the mud, slower than she wants to. She is in no state to guide anyone anywhere today.
@WREN_ON_VEX
> Send {wren} limping back to {thornwick} → @hub  #ok
  do @WREN_SAVED; day

# scout-dead
noBack: true
art: loc-marsh 🐴
assumes: scout-bled-out; npc wren not fate saved,lost
? not scout-walked-past | A young scout in the reeve's colours lies under the dead horse with an arrow through her leg. She died in the night, alone. There are tally-marks scratched in the mud by her hand. She was still counting the den's watch-posts.
? not scout-walked-past | At her belt is the healing potion she could never reach with the horse on top of her.
? scout-walked-past | A line of flattened reeds runs from the dead horse toward {thornwick} for a hundred yards, and stops. The scout you stepped round lies at the end of it, face down. She died in the night, alone.
? scout-walked-past | She got the healing potion out of her belt at last. Her fingers are still closed round it, and the stopper is still in.
There is no one on the road to tell you her name.
> Cover her and go → @hub  #ok
  do npc wren fate lost; +scout-covered; item potion-healing x1

# scout-gone
art: loc-marsh 🐴
assumes: npc wren fate lost
noBack: true
The dead horse still lies across the trail, white with frost. Beside it is the low mound of reeds where you covered the scout.
> Leave her to her rest → @hub  #ok

# scout-along
art: loc-marsh 🐴
assumes: with wren
noBack: true
The dead horse still lies across the trail. {wren} walks past it without looking. "He was a good horse," she says, too quickly. "Come on."
> Follow {wren} on → @hub  #ok

# scout-sent
art: loc-marsh 🐴
assumes: npc wren fate saved; without wren
noBack: true
The dead horse still lies across the trail.
{wren} is long gone to {thornwick} for the reeve's men. The flies have the horse to themselves.
> Keep to the trail → @hub  #ok

# barrow
art: 🪦
Half-swallowed by the reeds lies a barrow-mound, its stones worn smooth as soap. Its capstone is cracked and weeping cold air. The marsh has been chewing at it for centuries. Lately, something below has been pushing at the capstone, and something else has been pushing it back down.
Something gold catches your light in the dark below. So does something that moves without touching the water.
again:
The barrow-mound still breathes cold air through its cracked capstone. Down in the dark, the grave-goods still glint, and something still waits beside them.
> Go down into the dark → barrow-fight  #in
> [Religion DC 13] Say the old words over the capstone, and close it → barrow-settled  #settle
  once hide
  check religion 13 → barrow-fight
> Leave the dead their peace → @hub  #leave

# barrow-settled
noBack: true
art: 🪦
You kneel at the cracked capstone and say the words for the dead, slowly, the way they would have been said when the barrow was new. The cold air stops breathing out of the crack. Below, something settles back down among the grave-goods, and is still. You leave the gold where it lies.
> Back to the trail → @hub  #ok
  do +barrow-cleared; xp avoided barrow-haunt

# barrow-fight
kind: battle
encounterId: barrow-haunt
mapId: corridor
The cold answers you. Two figures rise out of the grave-earth. One wears the form of a man, but it is nothing now but spite and winter air. It passes *through* the barrow stones to reach you. The other climbs up out of the grave-goods in rotten mail. It holds a green-bronze sword in its grey hand, and a cold light burns where its eyes should be.
again:
The two cold dead are waiting this time, down among the grave-goods. One is nothing but winter air, and one wears rotten mail and carries a sword. They come for you again.
won → @hub
  The cold shape shreds into mist, and the dead thing in mail folds down among the grave-goods and is only bones. Among the grave-goods you find a little plain silver, and leave the rest, on balance, where it lies.
  do +barrow-cleared; gold 45

# thicket
art: 🕸️
Pale silk sheets the reeds ahead, and the reeds under it have gone grey and still. Bundles hang in the webbing at the height a man's shoulders would be. Some of the bundles are man-shaped.
Something spins here, and it has been eating well off the {ashfang}'s road. But those cocoons will have purses.
again:
The grey webs still sheet the reeds, and the man-shaped bundles still hang in them. The spinners have not gone anywhere.
> Cut your way in → thicket-fight  #in
> [Survival DC 12] Fire the dry reeds upwind, and let the webs burn → thicket-burned  #burn
  once hide
  check survival 12 → thicket-fight
> Give the webs a wide berth → @hub  #leave

# thicket-burned
noBack: true
art: 🔥
You wait for the wind, then put a spark to the dead reeds on the near side. The fire goes through the thicket in a rush and a crackle, and the webs go up like paper. Whatever spun them does not come out. By the time the smoke clears there is nothing in the thicket but ash and a few blackened cocoons.
> Back to the trail → @hub  #ok
  do +thicket-cleared; xp avoided spiders

# thicket-fight
kind: battle
encounterId: spiders
mapId: marsh
The silk trembles over your heads. Four giant spiders drop from the high webbing on every side.
again:
The spiders are waiting in the high webbing this time. They drop the moment your blade touches the silk.
won → @hub
  The final spider curls in on itself like a burnt glove. The cocoons hold two dissolved raiders, their purses intact. There is also one caravan guard, still breathing. He presses his last healing potion into your hands, and he does not stop thanking you until the reeds swallow the sound.
  do +thicket-cleared; gold 60; item potion-healing x1

# ambush
kind: check
skill: perception
dc: 13
roller: group
art: ⛰️
The hollow opens below you, and the reeds in it are too still, and cold where the marsh should be warm. Nothing moves. Something out there is lying flat in the water, waiting for you to come closer.
again:
You come back to the lip of the hollow. The reeds below are still too still, and too cold. Something out there is waiting for you again.
success → ambush-turned
  You catch the gleam of an eye among the reeds a breath before it moves. The trap is yours to spring.
failure → ambush-sprung
  A hiss, a ripple — and the reeds come alive all at once. Too late.

# ambush-wet
noBack: true
art: loc-marsh ⛰️
You come up out of the sinkholes on the wrong side of the hollow, soaked to the waist. Every step sucks and splashes.
The reeds ahead are too still, and cold where the marsh should be warm. You see it a moment too late. Anything lying in that water heard you coming a long way off.
> Draw steel → ambush-sprung  #on

# ambush-wren
art: loc-marsh 🧭
assumes: with wren
At the lip of the hollow {wren} puts out an arm and stops you. She watches the reeds below for a long time.
"Too still," she says. "And cold. The marsh is never cold at noon." She points once, twice, three times. "Lizardfolk, lying in the water. And two big ones behind them, toads, I think. They think we'll come down the dry line. So we won't."
> Follow {wren} round behind them → ambush-turned  #wren
  hide
  ? with wren

# ambush-turned
kind: battle
encounterId: hag-thralls
mapId: bog
surprise: enemies
You strike first. Scaled backs rise out of the water where they lay, a hunting-party of **lizardfolk** with two monstrous toads lumbering behind them like herded oxen. For a heartbeat, not one of them sees you.
again:
You strike first again. The lizardfolk are back in the water with their toads behind them, and once more they are watching the wrong way.
won → hollow-won
  The lizardfolk sink back into the dark water they came from, one by one.

# ambush-sprung
kind: battle
encounterId: hag-thralls
mapId: bog
surprise: party
The reeds burst apart around you, and scaled shapes rush in with hooked spears, two giant toads heaving up through the muck behind them. They move together, too well, as if one hand worked them all.
again:
The reeds erupt around you again. The lizardfolk and their toads have been waiting for you to come back.
won → hollow-won
  Bloodied, you break them at last. The last of the lizardfolk drags itself into the water and does not come up.

# hollow-won
noBack: true
art: loc-marsh 🐍
You turn the nearest body with your boot. Branded into the scaled hide, still weeping, is a crude mark of reeds and a reaching hand.
A voice drifts across the water, old and wet and amused. "My little dogs, off their leash. No matter, sweetlings. The reed-cutters call me the **{reedwife}**. Ask your chief what he sold me. Ask him what I paid."
"Come up to the fire, if you can find it. The chief and I will be waiting." The reeds shiver, and go quiet.
? with wren | {wren} has gone white. "A green hag," she says. "Reed-cutters' children get told about them. I thought it was a story."
> Go up and find her fire → gate  #ok
  hide
  ? without wren
  do @HOLLOW_PASSED
> Go up and find her fire → wren-parts  #wren
  hide
  ? with wren
  do @HOLLOW_PASSED
