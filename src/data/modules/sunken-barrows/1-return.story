# return
art: loc-town 🔔
noBack: true
{thornwick} by night, and the bells are ringing, but not to count the hour. Somebody who has forgotten how bells work is hauling on the rope in a panic.
You had hoped for a quiet season after the marsh. You very nearly had one.
The gate-warden meets you on the road, his lantern shaking. Behind him the bell clangs on and on. "It's the **churchyard**," he manages. "The graves are *open*, and it wasn't shovels did it."
Down the lane, past the shuttered market, cold lamplight spills across the churchyard wall. And the shadows between the stones are moving against the light.
? not hollow-road:won | Your purse is still heavy with the reeve's bounty for the {ashfang}. {thornwick} keeps its word.
> Answer the bells → lychyard  #go
  hide
  ? hollow-road:won
  do @OPENING
// A cold start: still the company that broke the Ashfang, with last season's bounty.
> Answer the bells → lychyard  #go-cold
  hide
  ? not hollow-road:won
  do {"kind":"xpToLevel","level":3}; @OPENING; gold 250

# lychyard
kind: battle
encounterId: shadow-ambush
mapId: corridor
The churchyard gate hangs off its hinge. Between the headstones the darkness has come loose, and four shapes of it glide toward you across the grass. You can feel the cold coming off them.
Behind them, by the newest grave, stands a woman in a burial shift. The lamplight goes straight through her. Her face is the face of a woman three weeks buried.
On either side of her, two of the new-buried stand up out of their open graves. They step onto the grass together, square and in step, like men called to the roll.
again:
The shadows are still loose among the headstones, and the woman in the burial shift still stands by the newest grave.
won → grave-morning
  The last shadow tears on your blade and is gone. The woman in the shift sinks back into her grave without a sound. The two that stepped up out of the earth lie still across their own graves.
lost → lychyard-lost

# lychyard-lost
kind: rest
variant: long
next: grave-morning
The cold sinks into your bones, and you fall among the headstones. The last thing you hear is the bells.
You wake in the {wander-inn} with the sun up. The bell-ringers carried you in. "The shadows went with the dark," **{mira}** says, and tears you a heel of bread. "The graves have waited this long. They can wait while you eat."

# grave-morning
art: ⛪
noBack: true
Morning shows the churchyard plain, and plain is worse. A dozen graves stand open — dug *outward*, turf thrown wide from below. The dead climbed out and left on their own, and they left together.
The drag-marks run through the gap in the wall and out across the water-meadows. Every one of them points the same way: **out to the deep fen**.
Every old headstone carries the same words, cut deep and green with moss. *Lie down and be at peace. Your work is done. The bell will wake you.* {thornwick}'s priests have said them over every grave for {thornwick-liturgy}.
> Take it to the town → square/city  #on
  journal clue c-deadwalk: They Walk One Way
    Something opened the graves from below. Every trail leads the same way, into the deep fen, where the old burial mounds stand.
