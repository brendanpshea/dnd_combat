// Halden, worn by the thing under the fen: his own words for the dead turn
// it out (one try between them, `liturgy`), or the fight ends him.
# chapel
kind: obstacle
as: dialogue
npc: @HALDEN
art: loc-temple 🕯️
fight: drowned-chapel on ruins
done: chapel-cleared
leave: Back away from the chapel  #leave
The chapel kneels in the water, drowned to its windows, its bell-tower leaning like a man listening. Candles burn on every ledge. A few are **black tallow**, and they smoke like wet wood. On the altar steps stands a priest, robes fen-stained, face serene. He is leading a congregation.
The congregation is dead. They stand in the water in row after row, every face turned to the altar.
? with wren | {wren} grips your arm. "That's **Brother {halden}**," she whispers. "He kept the little chapel in {thornwick}. Mildest man in the valley."
"**Welcome!**" {halden} smiles at you, and the smile is terribly calm. "You've come to see the great work. The {warden} below is gathering his flock at last. Will you kneel? Everyone kneels down here, sooner or later."
again:
The drowned congregation still stands in its rows, and {halden} still waits on the altar steps. "You came back," he says, and beams. "Everyone does."
answer religion 14 > Speak his own burial words back to him  #liturgy
attempt: liturgy
to: chapel-saved
do npc halden fate saved
You say the words cut on every old headstone in his churchyard, slow and plain. *Lie down and be at peace. Your work is done. The bell will wake you.*
answer persuasion 12 > Remind him the dead stepped out in ranks, to his bell  #bell
? graves-ranks
attempt: liturgy
to: chapel-saved
do npc halden fate saved
You tell him what you read in his churchyard. His dead stepped out in ranks, oldest first, like a parish called to a service. "You rang your bell to lay them down, Brother. Whose bell is calling them up?"
answer persuasion 15 > Remind him of the bell he rang in {thornwick}  #bell-plain
? not graves-ranks
attempt: liturgy
to: chapel-saved
do npc halden fate saved
You tell him his bell in {thornwick} has rung for nothing but alarms since he left, and not once over a grave. "Whose bell are you ringing now, Brother?"
fight > Refuse the sermon and draw  #fight
{halden} sighs, a shepherd let down by his flock. Two skeletons in rotted mourning-clothes wade out of the rows, and behind them two of his drowned parishioners, grey and gnawing. Two acolytes in {thornwick}'s chapel colours step up beside him, their eyes as empty as the dead's.
again:
{halden} sighs again, a shepherd let down twice. "The {warden} provides," he says, and his acolytes and his dead come for you once more.
won:
{halden} sinks down on the altar steps and does not rise again. At the end, he mostly looks relieved.
His prayer book lies open on the altar, fen-damp. *The {door-price} each {door-midwinter} was never an offering,* says a note in his tidy hand. *It was her wage. The {reedwife} was the {warden}'s jailer, and we paid her to keep him asleep. She is gone from her door, and he is waking.*
Further down, the hand shakes. *The rites of sealing are on the last three pages. Someone must say them at his door, in the great barrow. Not me. It will not let it be me.*
On the flyleaf someone has inked a mark of reeds and a reaching hand. Beside it, steady again: *Her brand. It was the vigil's mark before she took it. The old builders cut it on the {barrow-gate}, and the watchers there still know it.*
Under the altar cloth is a healing potion {halden} never got to drink.
do @CHAPEL_CLEARED

# chapel-saved
kind: dialogue
npc: @HALDEN
noBack: true
art: loc-temple 📖
The thing inside {halden} lets go of him all at once, like a hand opening, and his dead fold down into the water. He sits hard on the altar steps, shaking and himself again. "It came up through the *prayers*," he says. "A grey little gravedigger brought me black candles. He said his name was **{marrow}**, and I *thanked* him."
"I rang the drowned bell every night. *The bell will wake you.* I thought it was a promise." He swallows. "It was a summons."
He pushes his prayer book into your hands. "The **{reedwife}** was never just a hag. She was a jailer. The fen-folk paid her a {door-price} each {door-midwinter}, and she kept the **{warden} of the Barrows** asleep. When she was gone from that door, his seal broke."
? npc reedwife fate bound | "They say you held her to her price." He shakes his head. "A keeper held by strangers' words keeps the price, but not the watch. Nobody sits by his door."
"The rites of sealing are at the back. Someone must say them whole at his door. I'll follow you down and wait on the stair." He hands you a healing potion from under the altar cloth. "I bought it for a bad night. I think yours will be worse."
He taps the flyleaf, where he has inked a mark of reeds and a reaching hand. "She wore it as her brand, but it was the vigil's mark first. The old builders cut it on the {barrow-gate}, and the gate's watchers still know it."
> Take the prayer book → @hub  #on
  hide
  ? with wren
  do @CHAPEL_CLEARED; npc wren attitude 1
> Take the prayer book → @hub  #on-alone
  ? without wren
  hide
  do @CHAPEL_CLEARED

// The corpse-lights: snuff them, or find the firm ground round the pools.
// Either way finds the drowned folk's purses (`purses`).
# lights
kind: obstacle
art: 💡
fight: corpse-lights on bog
done: lights-cleared
after: purses
leave: Back away from the water  #leave
The flat water south of the old road is where the fen does its prettiest lying. Lights hang over the black mirror, soft and swaying, warm as windows. Corpse-candles: they walk mourners into the deep pools and hold them under.
The lights drift nearer, hopeful as dogs. Between them, further out, two colder things stand in the clothes they drowned in.
? with wren | "We don't have to go through," {wren} says quietly. "There's firm ground round the pools, if you can find it. Miss it, and the lights find *you*."
again:
The corpse-lights still sway over the black water, warm as windows.
fight > Snuff them out  #fight
Four of the lights come in low and fast over the water, crackling with stolen life. The two drowned things rise between them, their mouths open on screams the water drank years ago.
again:
The four lights come in low over the water again, and the drowned things rise between them.
answer survival 13 > Find the dry way round the pools  #skirt
attempt: firm-ground
failed → lights-lured
You find the firm ground and keep to it, one tussock to the next. The lights follow along the water's edge, swaying, waiting for a foot to slip. None does.
answer nature 10 > Read the fen like a map, and walk round  #druid
? class druid
tag: Druid
attempt: firm-ground
like: skirt
answer survival 10 > Follow the reeds that only grow on firm ground  #ranger
? class ranger
tag: Ranger
attempt: firm-ground
like: skirt
won:
The last wisp winks out, and the water goes dark for good.

// Missed the firm ground: the same fight, caught waist-deep.
# lights-lured
kind: battle
encounterId: corpse-lights
mapId: bog
surprise: party
You think you have found the firm ground, and three steps later it is not there. Four wisps flare white-hot in front of your faces, and two cold things rise out of the pool behind you.
won → purses
  You drag each other out onto the mud, soaked and shaking. Behind you the last wisp is out.
  do +lights-cleared

// The drowned folk's purses: keep them, or carry them home for the families.
# purses
art: 💰
noBack: true
In the reeds at the pool's edge lie the drowned, with their purses still tied at their belts. There are {drowned-purses} purses, {drowned-gold} between them, and two hold a stoppered healing potion against the fen-fever.
One body is not like the others. It wears long robes the colour of grave-worms, and a stub of **black candle** sits in its belt. No fen-folk dresses like that to go walking.
? with wren | {wren} looks at the purses, then at you. "Those belonged to somebody's husband, somebody's gran. The families could use them. So could you. Your call."
> Keep the purses. The dead won't spend them → purses-taken  #keep
  hide
  ? with wren
  do gold {drowned-gold}; item potion-healing x2; @WORM_CLUE; npc wren attitude -1
> Keep the purses. The dead won't spend them → purses-taken  #keep-alone
  ? without wren
  hide
  do gold {drowned-gold}; item potion-healing x2; @WORM_CLUE
> Carry the purses home for the families → purses-taken  #home
  hide
  ? with wren
  do +drowned-gold-home; @REGARD; @WORM_CLUE; npc wren attitude 1
> Carry the purses home for the families → purses-taken  #home-alone
  ? without wren
  hide
  do +drowned-gold-home; @REGARD; @WORM_CLUE

# purses-taken
art: 💰
noBack: true
? drowned-gold-home; with wren | {wren} helps you tie the purses into a bundle. She counts them twice. "{^drowned-purses}," she says. "That's {drowned-purses} families." She carries the bundle herself, and walks a little straighter for it.
? not drowned-gold-home; with wren | {wren} watches you fill your pockets with the drowned folk's coin. "Somebody's gran," she says at last, and walks on ahead.
? drowned-gold-home; without wren | You tie the purses into a bundle, and count them twice. {^drowned-purses} families.
? not drowned-gold-home; without wren | You fill your pockets with the drowned folk's coin.
Behind you, the fog closes over the pools again.
> Go on into the fen → @hub  #on

# pool
kind: obstacle
art: 🐍
fight: serpent-pool on marsh
done: pool-cleared
leave: Leave the pool its privacy  #leave
The reeds part around a pool so still it looks solid. Old offerings crowd the rim: coins, combs, grinding-stones. Fen-folk have fed something here for generations. The surface moves once, with no wind to move it, in a line longer than a boat.
? with wren | {wren} picks up a coin and puts it back with great care. "Since the dead took to the fen roads, not one of them has dared come out this far with a coin." She takes one careful step back. "It will be hungry."
again:
The serpent pool lies still again, too still. The water has not forgotten you.
fight > Wade in and clear the pool  #fight
The pool empties itself at you. Three snakes the girth of roof-beams pour over the rim in oiled coils.
again:
The pool empties itself at you again. The three fen-serpents pour over the rim, as hungry as before.
won:
The serpents lie in loops like dropped rope. Your boots turn up everything the fen-folk ever left here, from old coins to a sealed flask of potion.
do gold 85; item potion-greater-healing x1

// The Barrow Gate: its watchers were set to guard the vigil, and Halden's
// book carries the vigil's mark.
# lychgate
kind: obstacle
art: loc-crypt ⛩️
fight: barrow-watchers on ruins
done: watchers-done
after: lychgate-won
All the tracks come together here, and the barrow-country begins. A gate of standing stones rises ahead, the **{barrow-gate}**, mossed to the knees. Two weathered granite watchers crouch on top of it. In the gateway below them, an empty suit of green-bronze armour leans on its spear.
? with wren | {wren} stops dead. "Those weren't in anybody's stories." The stone bases are mossy, but the watchers' claws are clean, and so is the spear.
again:
The two stone watchers sit on the gate again with their wings folded. The bronze armour leans in the gateway below them.
answer history 14 > Show them the vigil's mark in {halden}'s book  #mark
You hold up the book, open at the reed-woman's mark on the flyleaf. The old builders cut that same mark into the gate. You find it on the nearest stone and lay your hand flat on it.
The watchers look at the book for a long, grinding moment, then fold their wings and turn back into plain grey stone. Below them, the armour grounds its spear and stands aside.
fight > Walk up to the gate  #fight
The nearest watcher turns its head with a sound like a millstone. The granite cracks its wings and drops on you like a falling roof. Below it, the empty armour lifts its spear and steps out of the gateway.
again:
The watchers drop from the lintel again, and the armour steps out of the gateway.
won:
The second gargoyle breaks apart in the air. It rains down as plain gravel, over the bronze plates that lie across the road.

// Past the gate, Wren stays: unless she trusts the company enough to come down.
# lychgate-won
art: loc-crypt ⛩️
noBack: true
Past the {barrow-gate} the mounds rise in their dozens. At the field's heart the largest barrow stands **open**, not fallen in but *unlocked*. Worked steps lead down. Every file of the walking dead leads down into it like thread into a needle.
Letters are cut into the lintel, worn almost smooth. *Here is the **{undercrypt}**. Let it stay shut.*
? with wren | {wren} looks at the steps, then at you. "I don't know the ground past here," she says. "I'll hold the gate."
? with wren; {"kind":"npc","npc":"wren","attitude":{"atLeast":2}} | "Someone has to be standing here when you walk back out." You pretend, kindly, not to hear the *when* she leans on. She ties a strip of the reeve's colours round your arm, quick and tight.
? with wren; {"kind":"npc","npc":"wren","attitude":{"below":0}} | She does not wish you luck. She checks her bowstring instead, and watches the fen, not you.
> Leave {wren} the gate, and go down → undercrypt  #down
  hide
  ? with wren
  do +lychgate-cleared; leave wren
// Only a company she would follow anywhere can ask.
> Ask {wren} to come down with you → undercrypt  #ask
  hide
  ? with wren; {"kind":"npc","npc":"wren","attitude":{"atLeast":2}}
  do +lychgate-cleared
> Go down → undercrypt  #down-alone
  hide
  ? without wren
  do +lychgate-cleared
