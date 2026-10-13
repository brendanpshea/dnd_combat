# thornwick
art: loc-village 🏘️
noBack: true
The road brings you into **{thornwick}** at last, through a scorched gate and past barred shutters. Faces watch you from the dark of doorways.
For a month the {ashfang} have bled this valley dry, and the whole country locks its doors by dark.
> Enter the {wander-inn} → tavern-meet  #go

# tavern-meet
kind: dialogue
npc: @MIRA
art: loc-tavern 🍺
noBack: true
Inside the **{wander-inn}** the fire is low and the talk lower. A broad woman with flour to the elbow picks up a cup and wipes it, looks you over once, and evidently decides you'll do.
"Sellswords. Good. You read my note, then." **{mira}** doesn't smile. She hasn't since the raids began. "The reeve's too proud to beg, so I wrote it for him. Sit."
"The {ashfang} came down the **marsh road**, out past the reeds. Everyone knows that much. Knowing it never once filled a burned cart back up. Last week they took a carter off that same road, and his granddaughter with him. She's seven. The old reed-cutters are counting the nights to the dark of the moon. Six, by my count, and none of them will say why."
"And the reeve sent his two scouts down the marsh road a few days back, a pair of girls on grey horses. Neither one has come back. If one of them's lying hurt out there, she hasn't many nights left."
"Some of the reed-cutters say the {ashfang} chief knows the marsh like he was born on it. There was a reed-cutter's boy once. Years back, the spring the marsh rose, his mother's house went under the water. He walked out of {thornwick} that week and never came back. Not till the raids started this spring, some say. People talk. And there's more, the kind no one says with the door open." She sets the cup down.
> Pull up a stool → tavern  #sit
  journal quest q-main: Break the {ashfang}
    {mira}, who keeps the {wander-inn}, begged your help against the {ashfang} raiders bleeding {thornwick} dry. Find where they den. Ask around the market and the marsh road, then end them. The reed-cutters count six nights to the dark of the moon.
    stage Find the {ashfang} den | visited gate
    stage End the chief, and whatever stands behind him | npc reedwife met
  journal quest q-scouts: The Reeve's Scouts
    The reeve sent two scouts down the marsh road on grey horses, and neither came back. If one lies hurt out there, she has few nights left.
    stage Find the scouts on the marsh road | npc wren fate saved
    resolved: npc.wren.fate.saved
    failed: npc.wren.fate.lost, scout-bled-out, scout-walked-past, scouts-unfound

# tavern
kind: dialogue
npc: @MIRA
art: loc-tavern 🍺
**{mira}** leans on the bar and waits for you to say something useful.
> [Insight DC 12] Read what she isn't saying → tavern-spy  #insight
  once hide
  ? not spy-caught; not spy-seen
  check insight 12 → tavern-blank
> [Persuasion DC 12] Buy the whole room a round ({tavern-round}) → tavern-trail  #persuade
  once
  ? gold {tavern-round}
  do gold -{tavern-round}
  check persuasion 12 → tavern-round-flat
> Ask her the way to the den → tavern-plain  #plain
  once
> Drift over to the regulars' table → regulars  #regulars
> Take a room for the night ({inn-room}, long rest) → inn-rest  #room
  ? gold {inn-room}
  do gold -{inn-room}
> Step out into the square → square/city  #leave

# inn-rest
kind: rest
variant: long
next: tavern
You take a room above the taproom, bolt the door, and sleep straight through until the smell of {mira}'s bread comes up the stairs. Your wounds have closed, and your head is clear. Out of the window, the old moon is a little thinner than it was.

# tavern-spy
noBack: true
art: 👁️
**{mira}** sees you've noticed. She lowers her voice until it barely carries over the fire.
"The {ashfang} always seem to know which wagon's worth taking. Someone here feeds them word of every caravan that leaves — and I think I know who."
"There's a **furtive peddler** who sets up by the **market**, near the gate. Sells nothing, buys nothing, but he's there every time a train rolls out. Watch him. If anyone's carrying word to the raiders, it's him."
> Back to your table → tavern  #ok
  do +know-spy
  journal quest lead-spy: The Furtive Peddler
    {mira} named a peddler who loiters by the market gate as the raiders' informant. Find his stall in {thornwick} Square. Come at him quietly, before he can whistle up his crew.
    stage Catch the peddler, quietly if you can | spy-caught
    taken: know-spy
    resolved: spy-caught
    failed: won

# tavern-trail
noBack: true
art: 🗺️
A round on your coin loosens the whole room. An old trapper drags a finger through spilled ale, sketching the **marsh road** across the bar.
"Here's the reeds, here's the deep water — and here," he taps a hollow in the hills, "is where their smoke rises of a morning. That's your den. Mind, the **trail** bites back long before you reach it."
> Back to your table → tavern  #ok
  do +trail-known

# tavern-plain
back: true
art: 🍺
She jerks her chin at the window. "The marsh road, then. Follow it till the reeds close in, and keep going."
"Buy a healing potion at the market before you go," {mira} says. "I'd rather not bury anyone this month." She turns back to her taps.
> Back to your table → tavern  #ok

# tavern-blank
back: true
art: 🍺
"Whatever you think you see on my face, it's flour." {mira} goes back to wiping cups.
> Back to your table → tavern  #ok

# tavern-round-flat
back: true
art: 🍻
The room drinks your round and thanks you kindly, and then the talk turns to the weather. The marsh does not come up once.
> Back to your table → tavern  #ok

# regulars
back: true
art: 🍻
{thornwick}'s older hands have claimed the long table by the fire — the sort who've survived enough to have firm opinions about how. They'll talk your ear clean off, if you let them. Some of it might even keep you breathing.
again:
The old hands at the long table shove along the bench to make room for you again.
> Ask the old sergeant how a real fight goes → rumor-tactics  #tactics
  once
> Ask the hedge-witch about working spells → rumor-magic  #magic
  once
> Ask the caravan veteran about her axe → rumor-weapons  #weapons
  once
> Ask the old reed-cutter about the lady in the water → rumor-reeds  #reeds
  once
> Leave them to their ale → tavern  #back

# rumor-reeds
back: true
art: 🌾
At the end of the bench an old reed-cutter sits with his hands round his cup, the fingers scarred white from a lifetime of sedge. He does not look up. "The lady in the water. My gran left her a {door-price} every {door-midwinter}, at the edge of the reeds, and so did hers. One a winter, for sitting by our door in the dark. That was the bargain, and the fen kept it."
"Then the spring the water rose, the bargain went wrong somewhere, and nobody's left a {door-price} since. Folk say she's owed. Folk say you can hold her like that: say her own price back to her, the old way, and ask for nothing more." He drinks. "Folk say a lot of things."
> Nod your thanks → regulars  #ok

# rumor-tactics
back: true
art: 🛡️
A grey-bearded man with a soldier's too-straight back taps the boards. "Rule one, and it's the reason I've still got both legs: don't turn your back on a man with a blade in reach. Step away careless and he gets a free cut at you as you go."
"Want out of a scrap without the parting gift? Then do nothing else but get out of it. Eyes on his blade, back off slow, and don't try anything clever on the way. Especially you wand-wavers: get clear before you start your muttering, or you'll be eating steel halfway through the word."
> Nod your thanks → regulars  #ok

# rumor-magic
back: true
art: 🔮
A woman with river-stones knotted in her hair doesn't look up from her knitting. "Magic's never free, whatever the college boys tell you. Every real working takes something out of you, and you've only so much to give before you sleep. Spend it like your last coppers, because in a long fight, that's what it is."
"The strong workings, a held foe or a ward of blades, burn only as long as you hold them in your head. Take a hard knock and you'd best keep your focus, or the whole thing slips through your fingers. Can't hold two at once, either. So pick the one that'll matter."
> Nod your thanks → regulars  #ok

# rumor-weapons
back: true
art: ⚔️
A scarred caravan guard rolls her axe over on the table. "Every weapon's got a trick in it, if you know how to ask. A heavy blade bites one man and the swing carries on into the next. A mace'll rattle a foe, so his next swing at you goes wide."
"Learn what the thing in your hand actually *does*. That's how you put down men twice your size."
> Nod your thanks → regulars  #ok

# board
art: 📜
Here is the reeve's bounty in full, nailed up and gone grey at the edges. He will pay good coin for proof the {ashfang} chief is dead, and better still for their banner brought back whole.
Someone has added a line at the bottom in a smaller, prouder hand: *"{thornwick} does not beg. It pays its debts."* That ink is newer than the rest.
again:
The reeve's bounty still hangs on the board, a little greyer at the edges than before.
> Take the reeve's retainer up front → square/city  #ok
  once
  do +bounty; gold {bounty-retainer}
  journal quest c-bounty: The Reeve's Bounty
    The reeve pays for the {ashfang} chief dead, and pays extra for their banner brought back as proof. You took {bounty-retainer} gold of it up front.
    stage Bring down the {ashfang} chief | npc reedwife met
    stage Collect from the reeve | got-bounty
    taken: bounty
    resolved: got-bounty
> Leave it for now → square/city  #leave

# spy-confront
kind: dialogue
@npc: {"id":"npc-peddler","name":"The Peddler","portraitId":"npc-merchant","emoji":"🕵️"}
art: 🕵️
noBack: true
? not know-spy | The peddler's stall is a marvel of things nobody wants — chipped buttons, one good boot, a birdcage with no bird. He never takes his eyes off the gate.
? know-spy | Up close he is younger than he looked, and he smells of the fish stall.
When your shadow falls across his goods he goes very still, and then he does the last thing you expect of a man selling buttons. He puts two fingers to his teeth and *whistles*. All round the square, hard-faced men start setting down their drinks. A thickset man in a good coat, the **fixer** who pays them, stands up last.
again:
The peddler is back behind his stall of chipped buttons. He sees you coming this time. His fingers are at his teeth before you reach him, and the whistle brings his crew out of the crowd again.
> [Investigation DC 13] Pick his crew out of the crowd first → spy-ambush  #investigate
  once
  do +spy-seen
  check investigation 13 → spy-pinched
  fail do gold -{pinched-purse}
> [Intimidation DC 14] Shout down the hired help before they close → spy-balked  #intimidate
  once
  do +spy-seen
  check intimidation 14 → spy-bolts
> Put your backs to the wall and draw → spy-bolts  #brace
  do +spy-seen

# spy-caught
art: 🔗
noBack: true
His crew is down or gone, one way or another, and the peddler knows it. He sits down in the dirt. "I only carried word! I never lifted a blade!"
@SPY_LIST
The rest comes out all in one breath, and the raiders' **gate-signal** with it. "Call that up to the watch-post and they'll open for you like you're one of their own. None of mine went out the gate," he adds, bitterly. "It's still good."
The reeve pays a purse for the town's leak. The gate-warden is already waving you over.
> Hand him to the reeve → square/city  #ok
  do +spy-caught; +know-signal; gold 40
  journal lead c-signal: The Gate-Signal
    You caught the {ashfang}'s informant in the market and took the raiders' gate-signal off him. Call it up to the watch-post at the den's gate, and the watch should open for you.
    resolved: signal-spent

# spy-caught-loud
art: 🔗
noBack: true
It is over, and half the square watched it happen. The peddler sits in the dirt by his stall with his hands up. "I only carried word! I never lifted a blade!"
@SPY_LIST
You ask him for the raiders' gate-signal. He laughs, shakily, and points past the gate. Out on the marsh road, one of his knives is still running. "He'll be at the den by dark. They'll change the signal the minute he tells them. It's no good to anybody now."
Signal or no signal, the reeve pays a purse for the town's leak. The gate-warden is already pushing through the crowd to collect him.
> Hand him to the reeve → square/city  #ok
  do +spy-caught; gold 40
  journal clue c-peddler: The Peddler's List
    You caught the {ashfang}'s informant in the market, but not quietly. One of his crew ran for the den, so the gate-signal he knew is no good now. You will need another way past the den's watch.

# spy-stalk
art: loc-village 🕵️
assumes: know-spy
There he is, just where {mira} said: a peddler with a stall of chipped buttons and a birdcage with no bird. He sells nothing, and he watches the gate.
He hasn't seen you yet. Round the square, a few big men in work coats nurse their drinks and keep one eye on him.
again:
The peddler is back at his stall of chipped buttons, watching the gate. His crew are back at their drinks, too.
> [Stealth DC 12] Come at him from behind the stalls → spy-grabbed  #stalk
  once
  check stealth 12 → spy-slipped
> Walk straight up to his stall → spy-confront  #walk

# spy-grabbed
art: loc-village 🤫
noBack: true
You slip round behind the fish stall and come up at his back. His fingers are halfway to his teeth when you take his wrist.
His crew sees the knife at his ribs. One by one, they find somewhere else to drink.
> Turn out his stall → spy-caught  #ok
  do xp avoided cutpurses

# gate-blocked
art: loc-village 🚧
assumes: not spy-caught
noBack: true
The gate-warden lays his spear across the road and shakes his head, not unkindly. "Reeve's orders, and for once they're sound ones. Someone in this town sells the {ashfang} word of every cart that leaves. Nobody goes out until he's in the cells."
? not spy-seen | "Don't look at me like that. If I knew his face, he'd be there already. All I know is it's someone near the gate. Someone who's always about when a cart goes out. Find me who it is, and the road's yours."
? not spy-seen; not know-spy | "Or ask {mira} at the {wander-inn}. She hears everything."
? spy-seen | "And don't tell me you don't know who. Half the market watched that peddler whistle his knives out at you." He jerks his chin at the stall by the market. "Bring him in, and the road's yours."
> [Deception DC 13] "Reeve's business. Stand aside." → gate-slipped  #bluff
  once hide
  do alarm inner/delve +2
  check deception 13 → gate-bluff-called
  fail do alarm inner/delve -2
> [Stealth DC 12] Go over the wall after dark → gate-slipped  #wall
  once hide
  do alarm inner/delve +2; day
  check stealth 12 → gate-wall-caught
  fail do alarm inner/delve -2; day
> Back into the square → square/city  #ok

# gate-bluff-called
noBack: true
art: loc-village 🚧
The warden looks at you for a long moment. "The reeve's business," he says. "The reeve was in my guardhouse an hour ago, and he never mentioned you." The spear stays where it is.
> Back into the square → square/city  #ok

# gate-wall-caught
noBack: true
art: loc-village 🌙
You find a low stretch of the wall, but the watch walks it more often than you bargained for. A lantern swings your way, and you spend the rest of the night in a barn, waiting for it to go away.
> Back into the square at first light → square/city  #ok

# gate-slipped
noBack: true
art: loc-road 🌙
You are out, and {thornwick} is behind you. Somewhere behind you, too, the peddler is still at his stall. He saw you go, and the {ashfang} will hear of you before you ever see their smoke.
> Set out on the marsh road → road-out  #go

# mill
kind: dialogue
@npc: {"id":"npc-osk","name":"{osk} the Miller","portraitId":"npc-commoner","emoji":"🌾"}
art: 🌾
The mill's sails hang still, and the miller meets you at a barred door with a boat-hook in both hands. "Not raiders, this one. Something's roosting in my hedgerows — turned my dog stiff as a fencepost. *Stone*, you understand. Won't nobody come near the mill now, and the grain's standing."
"Clear them out and there's coin in it. Just — don't let the ugly things *touch* you."
again:
{osk} the miller still has his boat-hook in both hands. "Back, are you? The ugly things are still in my hedgerows, and my grain's still standing."
> [Nature DC 13] Smoke them out of the hedge with green wood → mill-smoked  #smoke
  once hide
  check nature 13 → mill-fight
> Beat the hedgerows → mill-fight  #help
> Leave him to his hedgerows → square/city  #later

# mill-smoked
noBack: true
art: 🌾
You stack green ash on the windward side of the hedge and light it. The smoke rolls in thick and white. The cockatrices come out of the far side hissing and blind, and keep going, away up the valley. The miller pays up gladly, and spends a long while poking the hedge with his boat-hook to make sure.
> Back to the square → square/city  #ok
  do +mill-saved; gold 35; xp avoided cockatrice-flock

# mill-fight
kind: battle
encounterId: cockatrice-flock
mapId: open
Two bat-winged things burst out of the hedge in a fury of beak and scale, hissing like geese. "Cockatrices!" the miller shouts from his door. "Mind the beaks!"
again:
The cockatrices are still in the hedge, and this time they come out of it the moment you reach the gate. Mind the bite.
won → square/city
  The second cockatrice flops still. The miller pays up gladly, prods the stone dog, and allows that it makes a fair garden ornament.
  do +mill-saved; gold 35

# spy-bolts
kind: battle
encounterId: cutpurses
mapId: village
His crew shoulders out of the market crowd: a fixer and two hired knives, blades held low and level. Up on the stall-roofs three more of them kneel with crossbows. They come straight for you.
again:
The fixer and his two hired knives close in again, blades low and level, and the three crossbows are back up on the stall-roofs. They know your faces now.
won → spy-caught-loud
  The fixer goes down, and the hired help drops its knives and its nerve together, and runs. One of them does not stop at the edge of the square. He goes straight out through the gate, toward the marsh.
parley deception 13 > Tell the knives the watch is coming
  refused: The fixer doesn't even look round. "The reeve's men are down at the marsh gate, friend. We watched them go." His knives close in.
  success → spy-caught-loud
    do xp avoided cutpurses
    "The reeve's men are two stalls behind us," you say, loud enough to carry, and glance past them as if you can see the pikes. The hired knives do the sums faster than their fixer does, and the crossbows come down off the roofs. They are all gone into the crowd before he turns round. Alone, the fixer raises his empty hands and backs off into the market.
    Over the heads of the crowd, though, you see one of the knives slip out through the gate, toward the marsh.

# spy-ambush
kind: battle
encounterId: cutpurses
mapId: village
surprise: enemies
The crew moves in from the stalls, two knives and three crossbows behind their fixer, but you are already where they didn't expect you. They scramble.
won → spy-caught
  The crew is still turning round when the fixer falls, and his hired blades throw down their knives, and the crossbows come down off the roofs. You are standing between them and the gate, so they all bolt the other way, straight into the reeve's watch.

# spy-balked
noBack: true
art: loc-village 📣
You plant your feet and roar at the hired knives to put their blades away, now, while they still have hands to do it. Every head in the square turns.
The knives look at your steel, then at the fixer, then at all the people watching. One by one they set their blades down on the cobbles, and up on the stall-roofs the crossbows come down too. The fixer goes with them, out past the well and away from the gate. None of them looks keen to explain this to the chief.
> Turn out his stall → spy-caught  #ok
  do xp avoided cutpurses

# spy-slipped
noBack: true
art: loc-village 🕵️
A board creaks under your boot, three stalls short. The peddler glances round, sees you, and is gone into the crowd before you can reach him. He does not come back to his stall until the next evening. You lose a whole day watching it stand empty.
> Walk up to his stall → spy-confront  #on
  do day

# spy-pinched
noBack: true
art: loc-village 👛
You search the crowd for his crew, and you look in all the wrong places. By the time you spot the fixer, one of his knives has already brushed past you. Your purse went with him.
> Get your backs to the wall → spy-bolts  #on
