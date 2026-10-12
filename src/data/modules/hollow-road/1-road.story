# road
art: loc-road 🛤️
noBack: true
A day's hard walk up the valley, and the country has gone wrong-quiet. There are no carters on the road and no herders, only crows that lift off the hedgerows as you pass.
{thornwick} lies an hour ahead, its chimney-smoke thin against the grey hills. Word of the reeve's bounty reached you three towns back, but the note folded in your pack is in a plainer hand. *Come quick. We are not too proud to ask.* {mira} of the {wander-inn} signed it, and that note is why you kept walking.
The hedges shift on both sides at once, and it is already too late to run.
> Draw steel → road-ambush  #go

# road-ambush
kind: battle
encounterId: raiders-forward
mapId: open
Raiders scramble out of the ditches on both sides: two orcs with notched axes, and two lean scouts with arrows on the string. Two bandits climb out after them, one of them in a stolen carter's coat, picking his teeth.
"The road's the **{ashfang}'s** now!" the bandit in the coat crows. "Chief takes his cut of every throat on it — and yours'll do just fine."
won → road-reveal
  The bandit in the carter's coat is the last to drop into the mud.
lost → road-carter
  The world goes grey, then black.

# road-carter
art: loc-road 🛒
noBack: true
You wake on a bed of turnips, rocking gently. An old carter glances back from his seat. "Found you face-down in the ditch," he says. "The {ashfang} left you for dead. Lucky for you, they're poor judges of it."
He points his whip at the hills, where a thin smudge of smoke rises past the marsh. "That's their den up there. Folk keep well clear of it." Ahead, the roofs of {thornwick} come into view.
> Ride the last mile into {thornwick} → thornwick  #on
  journal clue c-ashfang: The {ashfang} Own the Valley
    {ashfang} raiders ambushed you on the road and left you for dead. A carter brought you to {thornwick} and showed you their smoke, rising in the hills past the marsh.

# road-reveal
noBack: true
art: loc-road 🩸
The bandit isn't dead yet. He laughs wetly through red teeth as you stand over him.
"You think you've done something? There's more of us in the hollow than you've got arrows — and the **chief**, he don't belong to himself no more. There's something *in the marsh* he feeds, and it feeds him back. The **{ashfang}** own this whole valley now, and worse than us owns them."
His eyes drift to the hills, to a thin smudge of smoke past the marsh, and then to nothing at all.
> Press on to {thornwick} → thornwick  #on
  journal clue c-ashfang: The {ashfang} Own the Valley
    Raiders ambushed you on the road, boasting of an {ashfang} chief who dens in the hills past the marsh — you saw his smoke rise for yourself. They are many, and they answer to him.
