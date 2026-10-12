# aftermath
art: loc-village 🏘️
noBack: true
You come back down the marsh road into a {thornwick} with every shutter in it thrown open. Word runs ahead of you; by the time you reach the square, the square is full.
? npc vargan fate spared; not vargan-let-go | {vargan} walks in front of you with his hands tied, and the crowd goes quiet to let him through. An old reed-cutter spits at his feet. {vargan} does not look up from the road.
? not vargan-let-go | The reeve is there too — stiff-backed, unsmiling, a strongbox under one arm. He does not thank you. He sets the strongbox on the well and opens it. "{thornwick} keeps its word," he says, as though daring you to make something of it.
? vargan-let-go | The reeve is there too — stiff-backed, unsmiling, a strongbox under one arm. He sets it down on the well, and keeps his hand on the lid.
? vargan-let-go | The reeve looks past you, up the marsh road, for the prisoner who isn't there. "You let him *walk*?" His face goes red, then white. "{thornwick} pays for a chief it can see. Not for one you turned loose in my marsh."
? vargan-let-go; bounty | He holds out his hand for the retainer you drew at the board. He does not lower it until the coin, or what is left of it, is back in the strongbox. "{thornwick} pays its debts," he says. "So will you."
? npc vargan not fate dead; captives-freed | Behind him, {mira} catches your eye and very nearly smiles.
? npc vargan not fate dead; not captives-freed; npc wren fate saved | Behind him, {mira} catches your eye and very nearly smiles.
? npc vargan not fate dead; not captives-freed; npc wren not fate saved; mill-saved | Behind him, {mira} catches your eye and very nearly smiles.
? npc vargan not fate dead; @MIRA_COOL | Behind him, {mira} watches from the inn door, wiping her hands on her apron.
? npc vargan fate dead | Someone asks how the chief died, and you tell them: on his knees in his own hall, with the fight already over. The square goes quiet. Behind the reeve, {mira} looks at you, says nothing, and turns away.
> @AFTERMATH_CLAIMS

# aftermath-hub
art: loc-village 🏘️
noBack: true
The crowd presses in around the well, where the reeve's strongbox stands.
? got-bounty; not vargan-let-go | The reeve has closed his ledger, and stands with his arms folded in case anyone else has a claim.
? got-banner | Someone has hung the {ashfang} banner from the well-rope, and the children are taking turns to throw mud at it.
? got-scout | {wren} has found a barrel to sit on, her crutch propped beside her. She is pretending not to watch you.
> @AFTERMATH_CLAIMS

# claim-bounty
art: loc-village 💰
noBack: true
The reeve counts out {bounty-full}, coin by coin, as if each one hurts. "Paid in full."
> Sweep it into your pack → aftermath-hub  #ok

# claim-balance
art: loc-village 💰
assumes: bounty
noBack: true
The reeve checks his ledger, takes off the {bounty-retainer} you drew at the board, and counts out {bounty-balance}. "Paid in full."
> Sweep it into your pack → aftermath-hub  #ok

# claim-banner
art: loc-village 🚩
assumes: looted
noBack: true
You unroll the {ashfang} banner across the well for the crowd to see, and the cheer goes on for some time. The reeve adds {bounty-banner} to your pile without a word.
> Let them cheer → aftermath-hub  #ok

# claim-scout
art: loc-village 🏹
assumes: npc wren fate saved; without wren
noBack: true
{wren} pushes through the crowd on a crutch and hands you the reeve's purse of {scout-reward}, and then she just stands there.
? {"kind":"npc","npc":"wren","attitude":{"atLeast":0}} | "You came back," she says at last, and goes red to the ears.
? {"kind":"npc","npc":"wren","attitude":{"below":0}} | "You came back," she says at last, and looks at you a moment longer, as if she is still making up her mind about it.
> "So did you." → aftermath-hub  #ok

# defeat
art: loc-tavern 🍺
noBack: true
You wake to lamplight and the crackle of {mira}'s hearth. The last thing you remember is the ground coming up to meet you.
? at square/city | The reeve's men carried you in, she tells you, and then stood about in her taproom until she fed them.
? at trail/delve | A reed-cutter found you face-down in the reeds and poled you home on his raft. He would not take a copper for it.
? at inner/delve | She does not know who carried you out of the den. At first light she found you on her step, laid side by side, with your weapons at your feet.
?! npc vargan not fate dead | "Easy, now." {mira} puts a mug of something hot and bitter into your hands. "You slept the day round. The {ashfang} are still out there, but you're no use to {thornwick} dead. Drink that. Then go and finish them."
again:
You wake on {mira}'s cot again, under the same crack in the ceiling, aching in all the same places.
?! npc vargan not fate dead | "Same cot, same mug," {mira} says, and sets it down. "Try to need it less."
> Get back on your feet → square/city  #up
  do day
> Go straight back out on the marsh road → trail  #back
  hide
  do day
  ? visited trail
> Go straight back into the den → inner  #den
  hide
  do day
  ? at inner/delve; den-entered

# epilogue
kind: ending
outcome: victory
art: 🏆
@slides:
  [
    {
      "thread": "vargan",
      "cases": [
        {
          "if": [{"kind":"npc","npc":"vargan","fate":"dead"},{"kind":"flag","flag":"vargan-shaken"}],
          "text": "Round the bonfire they tell it in low voices: the {ashfang} chief wore the hag's brand too, and he knelt in his own hall knowing it. The reed-cutters bury him at the edge of the shallows he sold, and leave the grave unmarked."
        },
        {
          "if": [{"kind":"npc","npc":"vargan","fate":"dead"}],
          "text": "The reed-cutters bury {vargan} at the edge of the shallows he sold. They leave the grave unmarked, and no one asks where it is."
        },
        {
          "if": [{"kind":"flag","flag":"vargan-let-go"}],
          "text": "The reeve keeps his bounty, and says so loudly. Before the month is out, a man with a scarred hand is cutting reeds in the shallows below the water-meadows. The reeve watches him from his window, and does not send the watch."
        },
        {
          "if": [{"kind":"npc","npc":"vargan","fate":"spared"}],
          "text": "The reeve does not hang {vargan}. He sends him out to cut reeds on the common land until the drowned houses stand again. {vargan} has not missed a day."
        }
      ]
    },
    {
      "thread": "vex",
      "cases": [
        {
          "if": [{"kind":"npc","npc":"vex","fate":"turned"}],
          "text": "At the edge of the crowd, a lean, grey-templed man with no rope on his wrists touches two fingers to his brow and is gone."
        },
        {
          "if": [{"kind":"npc","npc":"vex","met":true},{"kind":"flag","flag":"vex-rebuffed"}],
          "text": "{vex} sat out the end of it at his own fire, the bare blade across his knees. At dawn he walks down into {thornwick} alone and lays it on the reeve's table. He asks for a cell with a window."
        },
        {
          "if": [{"kind":"npc","npc":"vex","met":true}],
          "text": "{vex} watched the end of it from the ridge above the den. At dawn he walks down into {thornwick} alone and gives himself up at the reeve's hall. He asks for a cell with a window."
        }
      ]
    },
    {
      "thread": "wren",
      "cases": [
        {
          "if": [{"kind":"npc","npc":"wren","fate":"saved"}],
          "text": "At dawn {wren} limps out ahead of the reeve's men to round up what's left of the {ashfang}. She makes a list first. The other scout, who lost her horse in the fen and walked home the long way round, helps her write it."
        },
        {"if":[{"kind":"npc","npc":"wren","fate":"lost"},{"kind":"flag","flag":"scout-covered"}],"text":""},
        {
          "if": [{"kind":"npc","npc":"wren","fate":"lost"},{"kind":"flag","flag":"scout-walked-past"}],
          "text": "The reeve's men find a scout in the reeds off the marsh road, a hundred yards from a dead horse. She had been crawling toward {thornwick}."
        },
        {
          "if": [{"kind":"npc","npc":"wren","fate":"lost"}],
          "text": "Out on the marsh road, the reeve's men lift a dead horse off one of their own scouts. She died under it alone, with a healing potion at her belt that she could never reach."
        },
        {
          "if": [{"kind":"flag","flag":"scout-walked-past"}],
          "text": "The reeve's men bring a scout in from the marsh road on a door. The other scout, who lost her horse in the fen and walked home the long way round, walks beside it. Whether the one on the door lives, nobody at the bonfire will say."
        },
        {
          "text": "The other scout lost her horse in the fen and walked home the long way round. She leads the reeve's men back down the marsh road. They find her partner still pinned under a dead horse, alive and furious, with every watch-post on the den's wall scratched into the mud."
        }
      ]
    },
    {
      "thread": "mira",
      "cases": [
        {
          "if": [{"kind":"npc","npc":"vargan","fate":"dead"}],
          "text": "{mira} pours your round and sets it down without a word. She does not pour a second. When you leave, she is wiping the same cup she was wiping when you came in."
        },
        {
          "if": [{"kind":"flag","flag":"captives-freed"}],
          "text": "{mira} pours the first round on the house, and the second when she thinks you aren't counting. \"Don't go making a habit of saving towns,\" she warns you. \"People come to expect it.\" It is the nearest thing to thanks she keeps in stock, and you both know it."
        },
        {
          "if": [{"kind":"notFlag","flag":"captives-freed"},{"kind":"npc","npc":"wren","fate":"saved"}],
          "text": "{mira} pours the first round on the house, and the second when she thinks you aren't counting. \"Don't go making a habit of saving towns,\" she warns you. \"People come to expect it.\" It is the nearest thing to thanks she keeps in stock, and you both know it."
        },
        {
          "if": [
            {"kind":"notFlag","flag":"captives-freed"},
            {"kind":"npc","npc":"wren","notFate":["saved"]},
            {"kind":"flag","flag":"mill-saved"}
          ],
          "text": "{mira} pours the first round on the house, and the second when she thinks you aren't counting. \"Don't go making a habit of saving towns,\" she warns you. \"People come to expect it.\" It is the nearest thing to thanks she keeps in stock, and you both know it."
        },
        {
          "text": "{mira} pours your round and takes your coin for it. \"Town's still standing,\" she allows, and moves off down the bar."
        }
      ]
    },
    {
      "if": [{"kind":"flag","flag":"got-banner"}],
      "text": "By the week's end the {ashfang} banner hangs upside down over {mira}'s bar, still spattered with the children's mud."
    },
    {
      "if": [{"kind":"npc","npc":"wren","fate":"lost"}],
      "text": "{mira} sets an extra cup at the end of the bar and fills it. The dead scout's partner walked home out of the fen too late to help, and sits beside it all evening. Nobody asks."
    },
    {
      "if": [],
      "text": "Up in the hollow, the reeve's men pull down the den's timber wall one post at a time. They leave the posts for the marsh to take."
    },
    {
      "if": [{"kind":"visited","scene":"board"}],
      "text": "The bounty notice comes down off the board in the square. Someone tears off the bottom corner first, the line in the prouder hand, and keeps it."
    },
    {
      "if": [{"kind":"npc","npc":"reedwife","fate":"bound"}],
      "text": "At {door-midwinter} an old reed-cutter ties a {door-price} to a stake at the water's edge, the way his gran did. In the morning the rope hangs wet and empty, and nothing else is missing."
    },
    {
      "if": [{"kind":"flag","flag":"mill-saved"}],
      "text": "Out at the old mill the sails are turning, and someone has tied a ribbon round the stone dog's neck."
    },
    {
      "if": [
        {"kind":"npc","npc":"wren","fate":"saved"},
        {"kind":"notFlag","flag":"captives-taken"},
        {"kind":"flag","flag":"captives-left"}
      ],
      "text": "The reeve's men, sent up the marsh road on {wren}'s word, are already in the reeds below the den when it falls. They have the pen open before the fires are out. The carter carries the girl out himself, and she is still wearing her one shoe."
    },
    {
      "if": [
        {"kind":"npc","npc":"wren","fate":"saved"},
        {"kind":"notFlag","flag":"captives-taken"},
        {"kind":"notFlag","flag":"pens-found"}
      ],
      "text": "The reeve's men, sent up the marsh road on {wren}'s word, are already in the reeds below the den when it falls. They have the pen open before the fires are out. The carter carries the girl out himself, and she is still wearing her one shoe."
    },
    {
      "if": [{"kind":"flag","flag":"captives-freed"}],
      "text": "The carter's girl sits on the edge of the well in a new pair of shoes. She shows them to anyone who stops long enough."
    },
    {
      "if": [
        {"kind":"flag","flag":"captives-taken"},
        {"kind":"notFlag","flag":"captives-freed"},
        {"kind":"notFlag","flag":"captives-left"}
      ],
      "text": "Every evening, a widow walks the edge of the marsh and calls a name across the water."
    },
    {
      "if": [{"kind":"flag","flag":"captives-left"},{"kind":"flag","flag":"captives-taken"}],
      "text": "The reeve's men reach the pens behind the kennels after the moon has gone dark. They find the chain hanging open, and a child's shoe in the straw."
    },
    {
      "if": [{"kind":"notFlag","flag":"captives-taken"},{"kind":"notFlag","flag":"captives-freed"}],
      "text": "The reeve's men reach the pen behind the kennels two days after the den falls. It is empty, and its chain has been cut. The {ashfang} who fled took the carter, the girl and the reed-cutters with them, to sell wherever they could. They are never found."
    }
  ]
Bonfires burn in the square tonight. Out past the reeds the marsh has gone still, and the cold has lifted off the water.
By morning the carters are already complaining about the state of the road. {mira} lets them.
