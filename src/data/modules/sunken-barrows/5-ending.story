# sb-aftermath
art: loc-town 🏘️
noBack: true
The rope ladder brings you up out of the great barrow and into the open air.
? without wren | {wren} is still at the gate when you come up, with her knife out. All round her, the dead lie still in the grass at last. She looks like someone who means to have been calm the whole time.
? with wren | {wren} comes up behind you. At the top she stands a long moment among the dead, who lie still in the grass at last. Then she unstrings her bow.
? npc halden fate saved | Brother {halden} climbs out, blinking at the daylight. He says the burial words over every one of the dead in the grass.
? npc marrow fate bound | {marrow} climbs out behind you with his wrists tied. {wren} looks him up and down, and leaves his rope in your hands.
? npc marrow fate sings | {marrow} climbs out after you, and walks off alone toward {saltmere}. {wren} keeps her hand on her knife until the fog takes him.
? grandfather-home | {wren} sees the chain glint in the folds of your cloak, and she knows it. She takes one end of the bundle before you can ask. "I've got his feet," she says. "Mind the ruts."
? not seal-cracked | The walk home is long and wet. The door under the barrows is shut behind you, and the fen is only a fen again.
? seal-cracked | The walk home is long and wet. Every so often one of you stops and looks back at the barrow-field, and the others wait, and listen with them.
? {"kind":"npc","npc":"wren","attitude":{"atLeast":2}} | At the edge of town {wren} says "Thank you," fast, to the road. She walks on before anyone can ask what for.
> Go up to the reeve's hall → sb-hall  #hall
  hide
  ? without wren
  do gold 150
> Go up to the reeve's hall → sb-hall  #hall-wren
  hide
  ? with wren
  do gold 150; leave wren

// That evening: the reeve pays, the old reeve is laid down, the purses go
// home, and the town buries its dead again.
# sb-hall
art: ⚖️
noBack: true
? grandfather-home | That evening you carry the old man into the reeve's hall and lay him on the long table among the ledgers. {aldous} takes off his own chain of office and lays it beside his grandfather's. The links match. "He taught me to wear this straight," he says, and his voice gives out on the last word.
? grandfather-home | Then he counts your purse into your hands himself, coin by coin. He loses count twice, and does not seem to mind.
? not grandfather-home | That evening, in the reeve's hall, {aldous} counts your purse into your hands himself, coin by coin, and does not lose count once.
{thornwick} reburies its dead in the following days, oldest graves first. The reeve stands bareheaded at every service.
? drowned-gold-home | The fen-folk come in from the far pools for the reburials, and {wren} hands over the drowned folk's purses one by one. One widow opens hers and finds a carved bone button among the coins. "He always kept that," she says, and holds the purse to her chest.
Every night of the reburials the {wander-inn} fills with mourners, and the innkeeper keeps a pot on. "A town remembers who fed it while it buried its dead," she says. "Longer than it remembers who dug the graves."
> Spend the reeve's purse on a hot supper for the whole taproom ({taproom-supper}) → sb-supper  #mira
  hide
  ? gold {taproom-supper}
  do gold -{taproom-supper}; @REGARD
> Let the town sleep → sb-epilogue  #done
  do +won

# sb-supper
art: loc-tavern 🍺
noBack: true
The whole taproom eats on your coin. Someone stands and names {thornwick}'s dead, one by one, and the room listens with its cups down. When the last name is said, someone raises a cup to {mira}, who cooked it all, and she goes on scrubbing the pot.
> Let the town sleep → sb-epilogue  #done
  do +won

# sb-defeat
art: loc-tavern 🍺
noBack: true
The first thing you know is the smell of tallow and wet wool. You are lying in the back room of the {wander-inn}. Fen-mud has dried stiff in your hair.
? at fen/delve | Eel-catchers found you by the old road at first light, {mira} says. They carried you in on hurdles.
? at undercrypt/delve | When no one came back up by dark, eel-catchers went down the stair after you with ropes, {mira} says. They hauled you all up.
"The fen's still there," {mira} says. She puts the bread where you can reach it.
again:
Back on the settles in {mira}'s back room, with fresh bruises under the old mud. "You know where the bread is," {mira} says, and leaves you to it.
> Get back on your feet → square/city  #up
  do day
> Go straight back down the barrow stair → undercrypt  #back
  hide
  ? at undercrypt/delve
  do day

# sb-epilogue
kind: ending
outcome: victory
art: 🏆
@slides:
  [
    {"if":[{"kind":"npc","npc":"vex","fate":"turned"}],"text":"{vex} hears the news in a hill inn. He sits up late by the fire, looking back toward the valley."},
    {"if":[{"kind":"npc","npc":"vargan","fate":"spared"}],"text":"Out in the reed-beds, {vargan} stops cutting when a burial goes by on the lane. He takes off his cap until it has passed."},
    {"if":[{"kind":"npc","npc":"marrow","fate":"bound"}],"text":"{marrow} waits in the reeve's cells. He asks for a shovel. After some thought, {aldous} gives him the churchyard to mend."},
    {"if":[{"kind":"npc","npc":"marrow","fate":"sings"}],"text":"In {saltmere}, {marrow} keeps the graves he once left in the cold. He says the rites over them every evening."},
    {"if":[{"kind":"npc","npc":"halden","fate":"saved"}],"text":"Brother {halden} keeps the vigil now, and he reads the rites a little louder than he needs to."},
    {"if":[{"kind":"npc","npc":"halden","notFate":["saved"]}],"text":"{halden} and his acolytes share a new grave by the chapel. {mira} of the {wander-inn} paid for the white headstone. Under the names it says only *Asleep*."},
    {"if":[{"kind":"npc","npc":"wren","met":true}],"text":"{wren} wears a captain's knot in the reeve's colours now, to her plain horror. She leads the watch that walks the old road once a season."},
    {"if":[],"text":"Every night since the graves opened, a lamp has burned in the window of the {wander-inn}. Now {mira} takes it down and blows it out."},
    {"if":[{"kind":"flag","flag":"drowned-gold-home"}],"text":"The widow who found the bone button sews it back onto her husband's good coat. They bury him in it beside the rest of {thornwick}'s dead, oldest graves first."},
    {"if":[{"kind":"flag","flag":"grandfather-home"}],"text":"{aldous} buries his grandfather a second time, chain and all, and digs the grave himself."},
    {"if":[{"kind":"flag","flag":"diggers-passed"},{"kind":"notFlag","flag":"grandfather-home"}],"text":"The old reeve's grave in the churchyard stays empty. {aldous} fills it in anyway, and visits it every week."},
    {"if":[{"kind":"notFlag","flag":"seal-cracked"}],"text":"Deep under the barrow-field, the {warden}'s door stands shut in the dark, among the cold candle-ends."},
    {"if":[{"kind":"flag","flag":"seal-cracked"}],"text":"On still nights the fen-folk swear that something under the barrows knocks, faintly, like a knuckle on a door."},
    {"if":[],"text":"On the night the barrows close, at the fen's edge, two figures step out of the reeds, tall and green-fingered, with river-weed in their hair. They are the {reedwife}'s sisters. They look at the sealed barrow-field, and then at the town, and take their time about both."}
  ]
In {thornwick}'s churchyard the turf is back over every grave, and the bell-rope hangs still.
