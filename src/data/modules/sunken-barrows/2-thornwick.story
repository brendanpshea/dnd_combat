# inn
kind: dialogue
npc: @MIRA
art: loc-tavern 🍺
The {wander-inn} is full, and the drinkers are in no hurry to leave, not with the churchyard standing open across the lane. **{mira}** sets down a bowl in front of you unasked.
"Well." She says it flat, and wipes the bar hard enough to take the varnish off. "I'll say it, since the rest of them won't. You saw off the {reedwife}, and this whole town drank to it. I poured. Now the dead get up and walk, and we all sleep with the lamp lit."
? npc reedwife fate bound | "And you didn't even kill her. You held her to her old price, the fen-folk say. They've a {door-price} penned ready for {door-midwinter}, the way their grans did." She shakes her head. "So the price is as good as paid. Then why are the graves open?"
"Brother {halden}'s not rung the chapel bell in a week. He walked out toward the fen with his prayer book, and he hasn't come back."
? npc vargan fate dead | She stops with the jug still tilted. "Some of them haven't forgotten the chief, either. On his knees in his own hall, they say." She sets the jug down. "I haven't forgotten it myself."
"Eat. Then go see the reeve. He's been pacing his hall since the bells."
again:
The {wander-inn} is as full as ever. **{mira}** slides a fresh bowl your way.
? not reeve-task | "Still here? The reeve's still pacing his hall. Go and let him pay you."
? reeve-task | "So {aldous} hired you. Good. He pays slow, but he pays. Put the dead back where they belong."
> Take a room for the night ({inn-room}, long rest) → inn-rest  #room
  ? gold {inn-room}
  do gold -{inn-room}
> Go back out to the street → @hub  #leave

# inn-rest
kind: rest
variant: long
next: inn
A bolted door, a real bed, and the comfortable murmur of a crowded taproom below. For one night the fen can keep its dead to itself, and you sleep soundly.

# reeve-hall
kind: dialogue
npc: @REEVE
art: ⚖️
The reeve's hall smells of candle-wax and ledgers. **Reeve {aldous}** stands at the window with his back to you, watching the fen fog eat his water-meadows.
"You have returned," he says, without turning. "You broke the {ashfang} for us, and {thornwick} remembers that. Now the marsh has sent us a new trouble. My grandfather's grave stands empty. We buried him in his chain of office, the twin of this one. He is gone."
? npc vargan fate spared | Out past the glass, at the edge of the water-meadows, a man is cutting reeds. It is {vargan}. "Those shallows were common water in my grandfather's day," {aldous} says. "{vargan} sold them to the hag anyway. And there he is, alive, cutting reeds in the shallows he sold."
He turns. His collar is undone, and there is ink on his cuff. "You stood in my churchyard when the bells rang, and my watch did not. So I am paying you, sixty gold today and the rest when it is done. Follow my dead into the fen, find what calls them, and put it down."
"My scout, {wren}, will meet you at the fen road. She asked for the task before I could give it."
again:
**Reeve {aldous}** is still at his window, watching the fen fog. "The commission stands," he says, without turning. "Sixty gold now, and the rest when it is done."
> Accept the reeve's commission → @hub  #take
  do +reeve-task; gold 60
  journal npc n-aldous: Reeve {aldous}
    {thornwick}'s reeve is proud and paying, and he takes this one personally. His grandfather's grave is among the opened. Follow the dead into the fen and end what calls them.
  journal lead lead-fen: Into the Deep Fen
    The dead walk one way, into the barrow-country of the deep fen. The reeve's scout, {wren}, waits at the fen road to guide you in.
    resolved: lychgate-cleared

# grave-study
kind: check
skill: medicine
dc: 12
art: 🪦
The open graves are as the dead left them. In the bottom of the nearest, the clay still holds the shape of the body that lay there. A healer's eye might read how it got up.
success → @hub
  They did not claw their way out. At the lip of the oldest grave, two heel-marks sit square in the clay. The next grave's pair stands one pace behind them, and the next behind that.
  They *stepped* out, oldest graves first, in ranks, as if someone had called the roll.
  do +graves-read; +graves-ranks; xp 30
  journal clue c-muster: The Dead Marched in Ranks
    The dead left in neat rows, oldest graves first. They were obeying orders. If you must pass among them, fall in at the back of the oldest rank.
failure → @hub
  You get mud, turf, and the underside of a churchyard, and what the graves had to say is gone under your boots. The trails still point one way, into the fen.
  do +graves-read

# fen-shut
art: loc-marsh 🌫️
noBack: true
The gate-warden will not open the fen road without the reeve's say-so. "See Reeve {aldous} at his hall," he says, and folds his arms.
> Go and see the reeve → reeve-hall  #reeve
> Walk back into town → @hub  #ok

// Wren, by how the company left her in Part 1: pulled from under the horse
// (`saved`), the partner of the scout who died under it (`lost`), or a
// stranger the reeve's men brought in.
# wren-meet
kind: dialogue
npc: @WREN
art: loc-marsh 🌫️
? npc wren fate saved | The cart-road ends where the old raised road begins. **{wren}** sits on a milestone there, putting an edge on a boot-knife, upright this time and with no dead horse on top of her. "Heard the bells. Figured you'd be along."
? npc wren not fate saved | The cart-road ends where the old raised road begins. A young woman in the reeve's colours sits on a milestone there, sharpening a boot-knife. "**{wren}**. The reeve's scout." She says it fast, like she practised it on the way here.
? npc wren fate lost | "My partner was {tamsin}. A dead horse came down on her on the marsh road, the week you went for the den. She died out there in the night, alone." She tests her bowstring and does not look up.
? npc wren not fate saved,lost | She favours one leg when she stands, and pretends she doesn't. "A dead horse came down on me on the marsh road, last season. I was under it until the reeve's men brought me in. It holds."
"I was out on the near fen at first light, and the drag-marks were still wet. They walk in step, and one set has nails in the heel. The dead don't buy boots. Somebody **living** walked out there with them. Every trail runs to the old barrow-country, past the **drowned chapel** and past the **corpse-lights**. I can walk you as far as the barrow-country. Past that, I don't know the ground."
again:
{wren} is still sitting on the milestone where the raised road begins. She looks up. "Ready?"
> Follow her onto the raised road → fen  #go
  do npc wren met; join wren; +wren-joined
  journal npc n-wren: {wren}, the Reeve's Scout
    {wren} is Reeve {aldous}'s scout, and she will not be left behind. She guides you through the deep fen as far as the old barrow-country.

# fen-again
art: loc-marsh 🌫️
noBack: true
The old raised road goes on into the fog, the same as before. The fen waits at the end of it.
> Walk out along the raised road → fen  #go
> Walk back to town → @hub  #back
