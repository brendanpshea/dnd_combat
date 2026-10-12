// Built by `npm run stories` from hollow-road/*.story. Edit those, not this.
/* eslint-disable */
import type { Scene } from '../../../adventure/types.js';
import { factValue } from '../canon.js';
import { avoidedFightXP } from '../../encounters.js';
import { AFTERMATH_CLAIMS, BIND_HAG, BIND_HAG_RITE, BIND_HAG_RITE_CHOICE, BIND_VARGAN, BOSS_HOARD, BOSS_WON, END_VARGAN, FREE_VARGAN, GATE_PASSED, HOLLOW_PASSED, LIEUTENANT, MIRA, MIRA_COOL, REEDWIFE_HOARD, REEDWIFE_LOST, SCOUT, SPY_LIST, VARGAN_BRAND, VARGAN_TURNS, VEX_OFFERS, WREN_ON_VEX, WREN_SAVED, turnUnread } from './parts.js';

export const SCENES: Record<string, Scene> = {
  "road": {
    id: "road",
    kind: "story",
    art: { imageId: "loc-road", emoji: "🛤️" },
    noBack: true,
    text: [
      "A day's hard walk up the valley, and the country has gone wrong-quiet. There are no carters on the road and no herders, only crows that lift off the hedgerows as you pass.",
      "{thornwick} lies an hour ahead, its chimney-smoke thin against the grey hills. Word of the reeve's bounty reached you three towns back, but the note folded in your pack is in a plainer hand. *Come quick. We are not too proud to ask.* {mira} of the {wander-inn} signed it, and that note is why you kept walking.",
      "The hedges shift on both sides at once, and it is already too late to run.",
    ],
    next: [{ id: "go", label: "Draw steel", to: "road-ambush" }],
  },
  "road-ambush": {
    id: "road-ambush",
    kind: "battle",
    encounterId: "raiders-forward",
    mapId: "open",
    intro: [
      "Raiders scramble out of the ditches on both sides: two orcs with notched axes, and two lean scouts with arrows on the string. Two bandits climb out after them, one of them in a stolen carter's coat, picking his teeth.",
      "\"The road's the **{ashfang}'s** now!\" the bandit in the coat crows. \"Chief takes his cut of every throat on it — and yours'll do just fine.\"",
    ],
    onWin: { to: "road-reveal", text: ["The bandit in the carter's coat is the last to drop into the mud."] },
    onLoss: { to: "road-carter", text: ["The world goes grey, then black."] },
  },
  "road-carter": {
    id: "road-carter",
    kind: "story",
    art: { imageId: "loc-road", emoji: "🛒" },
    noBack: true,
    text: [
      "You wake on a bed of turnips, rocking gently. An old carter glances back from his seat. \"Found you face-down in the ditch,\" he says. \"The {ashfang} left you for dead. Lucky for you, they're poor judges of it.\"",
      "He points his whip at the hills, where a thin smudge of smoke rises past the marsh. \"That's their den up there. Folk keep well clear of it.\" Ahead, the roofs of {thornwick} come into view.",
    ],
    next: [
      {
        id: "on",
        label: "Ride the last mile into {thornwick}",
        to: "thornwick",
        effects: [
          {
            kind: "journal",
            entry: {
              id: "c-ashfang",
              kind: "clue",
              title: "The {ashfang} Own the Valley",
              body: "{ashfang} raiders ambushed you on the road and left you for dead. A carter brought you to {thornwick} and showed you their smoke, rising in the hills past the marsh.",
            },
          },
        ],
      },
    ],
  },
  "road-reveal": {
    id: "road-reveal",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-road", emoji: "🩸" },
    text: [
      "The bandit isn't dead yet. He laughs wetly through red teeth as you stand over him.",
      "\"You think you've done something? There's more of us in the hollow than you've got arrows — and the **chief**, he don't belong to himself no more. There's something *in the marsh* he feeds, and it feeds him back. The **{ashfang}** own this whole valley now, and worse than us owns them.\"",
      "His eyes drift to the hills, to a thin smudge of smoke past the marsh, and then to nothing at all.",
    ],
    next: [
      {
        id: "on",
        label: "Press on to {thornwick}",
        to: "thornwick",
        effects: [
          {
            kind: "journal",
            entry: {
              id: "c-ashfang",
              kind: "clue",
              title: "The {ashfang} Own the Valley",
              body: "Raiders ambushed you on the road, boasting of an {ashfang} chief who dens in the hills past the marsh — you saw his smoke rise for yourself. They are many, and they answer to him.",
            },
          },
        ],
      },
    ],
  },
  "thornwick": {
    id: "thornwick",
    kind: "story",
    art: { imageId: "loc-village", emoji: "🏘️" },
    noBack: true,
    text: [
      "The road brings you into **{thornwick}** at last, through a scorched gate and past barred shutters. Faces watch you from the dark of doorways.",
      "For a month the {ashfang} have bled this valley dry, and the whole country locks its doors by dark.",
    ],
    next: [{ id: "go", label: "Enter the {wander-inn}", to: "tavern-meet" }],
  },
  "tavern-meet": {
    id: "tavern-meet",
    kind: "dialogue",
    npc: MIRA,
    art: { imageId: "loc-tavern", emoji: "🍺" },
    noBack: true,
    lines: [
      "Inside the **{wander-inn}** the fire is low and the talk lower. A broad woman with flour to the elbow picks up a cup and wipes it, looks you over once, and evidently decides you'll do.",
      "\"Sellswords. Good. You read my note, then.\" **{mira}** doesn't smile. She hasn't since the raids began. \"The reeve's too proud to beg, so I wrote it for him. Sit.\"",
      "\"The {ashfang} came down the **marsh road**, out past the reeds. Everyone knows that much. Knowing it never once filled a burned cart back up. Last week they took a carter off that same road, and his granddaughter with him. She's seven. The old reed-cutters are counting the nights to the dark of the moon. Six, by my count, and none of them will say why.\"",
      "\"And the reeve sent his two scouts down the marsh road a few days back, a pair of girls on grey horses. Neither one has come back. If one of them's lying hurt out there, she hasn't many nights left.\"",
      "\"Some of the reed-cutters say the {ashfang} chief knows the marsh like he was born on it. There was a reed-cutter's boy once. Years back, the spring the marsh rose, his mother's house went under the water. He walked out of {thornwick} that week and never came back. Not till the raids started this spring, some say. People talk. And there's more, the kind no one says with the door open.\" She sets the cup down.",
    ],
    next: [
      {
        id: "sit",
        label: "Pull up a stool",
        to: "tavern",
        effects: [
          {
            kind: "journal",
            entry: {
              id: "q-main",
              kind: "quest",
              title: "Break the {ashfang}",
              body: "{mira}, who keeps the {wander-inn}, begged your help against the {ashfang} raiders bleeding {thornwick} dry. Find where they den. Ask around the market and the marsh road, then end them. The reed-cutters count six nights to the dark of the moon.",
              stages: [
                { text: "Find the {ashfang} den", done: [{ kind: "visited", scene: "gate" }] },
                {
                  text: "End the chief, and whatever stands behind him",
                  done: [{ kind: "npc", npc: "reedwife", met: true }],
                },
              ],
            },
          },
          {
            kind: "journal",
            entry: {
              id: "q-scouts",
              kind: "quest",
              title: "The Reeve's Scouts",
              body: "The reeve sent two scouts down the marsh road on grey horses, and neither came back. If one lies hurt out there, she has few nights left.",
              stages: [
                { text: "Find the scouts on the marsh road", done: [{ kind: "npc", npc: "wren", fate: "saved" }] },
              ],
              resolvedBy: "npc.wren.fate.saved",
              failedBy: ["npc.wren.fate.lost", "scout-bled-out", "scout-walked-past", "scouts-unfound"],
            },
          },
        ],
      },
    ],
  },
  "tavern": {
    id: "tavern",
    kind: "dialogue",
    npc: MIRA,
    art: { imageId: "loc-tavern", emoji: "🍺" },
    lines: ["**{mira}** leans on the bar and waits for you to say something useful."],
    next: [
      {
        id: "insight",
        label: "[Insight DC 12] Read what she isn't saying",
        to: "tavern-spy",
        once: true,
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "spy-caught" }, { kind: "notFlag", flag: "spy-seen" }],
        check: {
          skill: "insight",
          dc: 12,
          failTo: "tavern-blank",
          failEffects: [{ kind: "setFlag", flag: "mira-read" }],
        },
      },
      {
        id: "persuade",
        label: "[Persuasion DC 12] Buy the whole room a round ({tavern-round})",
        to: "tavern-trail",
        once: true,
        requires: [{ kind: "gold", atLeast: factValue("tavern-round") }],
        effects: [{ kind: "gold", amount: -factValue("tavern-round") }],
        check: { skill: "persuasion", dc: 12, failTo: "tavern-round-flat" },
      },
      { id: "plain", label: "Ask her the way to the den", to: "tavern-plain", once: true },
      { id: "regulars", label: "Drift over to the regulars' table", to: "regulars" },
      {
        id: "room",
        label: "Take a room for the night ({inn-room}, long rest)",
        to: "inn-rest",
        requires: [{ kind: "gold", atLeast: factValue("inn-room") }],
        effects: [{ kind: "gold", amount: -factValue("inn-room") }],
      },
      { id: "leave", label: "Step out into the square", to: "square/city" },
    ],
  },
  "inn-rest": {
    id: "inn-rest",
    kind: "rest",
    variant: "long",
    next: "tavern",
    intro: [
      "You take a room above the taproom, bolt the door, and sleep straight through until the smell of {mira}'s bread comes up the stairs. Your wounds have closed, and your head is clear. Out of the window, the old moon is a little thinner than it was.",
    ],
  },
  "tavern-spy": {
    id: "tavern-spy",
    kind: "story",
    noBack: true,
    art: { emoji: "👁️" },
    text: [
      "**{mira}** sees you've noticed. She lowers her voice until it barely carries over the fire.",
      "\"The {ashfang} always seem to know which wagon's worth taking. Someone here feeds them word of every caravan that leaves — and I think I know who.\"",
      "\"There's a **furtive peddler** who sets up by the **market**, near the gate. Sells nothing, buys nothing, but he's there every time a train rolls out. Watch him. If anyone's carrying word to the raiders, it's him.\"",
    ],
    next: [
      {
        id: "ok",
        label: "Back to your table",
        to: "tavern",
        effects: [
          { kind: "setFlag", flag: "know-spy" },
          {
            kind: "journal",
            entry: {
              id: "lead-spy",
              kind: "quest",
              title: "The Furtive Peddler",
              body: "{mira} named a peddler who loiters by the market gate as the raiders' informant. Find his stall in {thornwick} Square. Come at him quietly, before he can whistle up his crew.",
              stages: [{ text: "Catch the peddler, quietly if you can", done: [{ kind: "flag", flag: "spy-caught" }] }],
              takenBy: "know-spy",
              resolvedBy: "spy-caught",
              failedBy: "den-alarm",
            },
          },
        ],
      },
    ],
  },
  "tavern-trail": {
    id: "tavern-trail",
    kind: "story",
    noBack: true,
    art: { emoji: "🗺️" },
    text: [
      "A round on your coin loosens the whole room. An old trapper drags a finger through spilled ale, sketching the **marsh road** across the bar.",
      "\"Here's the reeds, here's the deep water — and here,\" he taps a hollow in the hills, \"is where their smoke rises of a morning. That's your den. Mind, the **trail** bites back long before you reach it.\"",
    ],
    next: [
      {
        id: "ok",
        label: "Back to your table",
        to: "tavern",
        effects: [{ kind: "setFlag", flag: "trail-known" }],
      },
    ],
  },
  "tavern-plain": {
    id: "tavern-plain",
    kind: "story",
    back: true,
    art: { emoji: "🍺" },
    text: [
      "She jerks her chin at the window. \"The marsh road, then. Follow it till the reeds close in, and keep going.\"",
      "\"Buy a healing potion at the market before you go,\" {mira} says. \"I'd rather not bury anyone this month.\" She turns back to her taps.",
    ],
    next: [{ id: "ok", label: "Back to your table", to: "tavern" }],
  },
  "tavern-blank": {
    id: "tavern-blank",
    kind: "story",
    back: true,
    art: { emoji: "🍺" },
    text: ["\"Whatever you think you see on my face, it's flour.\" {mira} goes back to wiping cups."],
    next: [{ id: "ok", label: "Back to your table", to: "tavern" }],
  },
  "tavern-round-flat": {
    id: "tavern-round-flat",
    kind: "story",
    back: true,
    art: { emoji: "🍻" },
    text: [
      "The room drinks your round and thanks you kindly, and then the talk turns to the weather. The marsh does not come up once.",
    ],
    next: [{ id: "ok", label: "Back to your table", to: "tavern" }],
  },
  "regulars": {
    id: "regulars",
    kind: "story",
    back: true,
    art: { emoji: "🍻" },
    text: [
      "{thornwick}'s older hands have claimed the long table by the fire — the sort who've survived enough to have firm opinions about how. They'll talk your ear clean off, if you let them. Some of it might even keep you breathing.",
    ],
    again: ["The old hands at the long table shove along the bench to make room for you again."],
    next: [
      {
        id: "tactics",
        label: "Ask the old sergeant how a real fight goes",
        to: "rumor-tactics",
        once: true,
      },
      { id: "magic", label: "Ask the hedge-witch about working spells", to: "rumor-magic", once: true },
      { id: "weapons", label: "Ask the caravan veteran about her axe", to: "rumor-weapons", once: true },
      {
        id: "reeds",
        label: "Ask the old reed-cutter about the lady in the water",
        to: "rumor-reeds",
        once: true,
      },
      { id: "back", label: "Leave them to their ale", to: "tavern" },
    ],
  },
  "rumor-reeds": {
    id: "rumor-reeds",
    kind: "story",
    back: true,
    art: { emoji: "🌾" },
    text: [
      "At the end of the bench an old reed-cutter sits with his hands round his cup, the fingers scarred white from a lifetime of sedge. He does not look up. \"The lady in the water. My gran left her a {door-price} every {door-midwinter}, at the edge of the reeds, and so did hers. One a winter, for sitting by our door in the dark. That was the bargain, and the fen kept it.\"",
      "\"Then the spring the water rose, the bargain went wrong somewhere, and nobody's left a {door-price} since. Folk say she's owed. Folk say you can hold her like that: say her own price back to her, the old way, and ask for nothing more.\" He drinks. \"Folk say a lot of things.\"",
    ],
    next: [{ id: "ok", label: "Nod your thanks", to: "regulars" }],
  },
  "rumor-tactics": {
    id: "rumor-tactics",
    kind: "story",
    back: true,
    art: { emoji: "🛡️" },
    text: [
      "A grey-bearded man with a soldier's too-straight back taps the boards. \"Rule one, and it's the reason I've still got both legs: don't turn your back on a man with a blade in reach. Step away careless and he gets a free cut at you as you go.\"",
      "\"Want out of a scrap without the parting gift? Then do nothing else but get out of it. Eyes on his blade, back off slow, and don't try anything clever on the way. Especially you wand-wavers: get clear before you start your muttering, or you'll be eating steel halfway through the word.\"",
    ],
    next: [{ id: "ok", label: "Nod your thanks", to: "regulars" }],
  },
  "rumor-magic": {
    id: "rumor-magic",
    kind: "story",
    back: true,
    art: { emoji: "🔮" },
    text: [
      "A woman with river-stones knotted in her hair doesn't look up from her knitting. \"Magic's never free, whatever the college boys tell you. Every real working takes something out of you, and you've only so much to give before you sleep. Spend it like your last coppers, because in a long fight, that's what it is.\"",
      "\"The strong workings, a held foe or a ward of blades, burn only as long as you hold them in your head. Take a hard knock and you'd best keep your focus, or the whole thing slips through your fingers. Can't hold two at once, either. So pick the one that'll matter.\"",
    ],
    next: [{ id: "ok", label: "Nod your thanks", to: "regulars" }],
  },
  "rumor-weapons": {
    id: "rumor-weapons",
    kind: "story",
    back: true,
    art: { emoji: "⚔️" },
    text: [
      "A scarred caravan guard rolls her axe over on the table. \"Every weapon's got a trick in it, if you know how to ask. A heavy blade bites one man and the swing carries on into the next. A mace'll rattle a foe, so his next swing at you goes wide.\"",
      "\"Learn what the thing in your hand actually *does*. That's how you put down men twice your size.\"",
    ],
    next: [{ id: "ok", label: "Nod your thanks", to: "regulars" }],
  },
  "board": {
    id: "board",
    kind: "story",
    art: { emoji: "📜" },
    text: [
      "Here is the reeve's bounty in full, nailed up and gone grey at the edges. He will pay good coin for proof the {ashfang} chief is dead, and better still for their banner brought back whole.",
      "Someone has added a line at the bottom in a smaller, prouder hand: *\"{thornwick} does not beg. It pays its debts.\"* That ink is newer than the rest.",
    ],
    again: ["The reeve's bounty still hangs on the board, a little greyer at the edges than before."],
    next: [
      {
        id: "ok",
        label: "Take the reeve's retainer up front",
        to: "square/city",
        once: true,
        effects: [
          { kind: "setFlag", flag: "bounty" },
          { kind: "gold", amount: factValue("bounty-retainer") },
          {
            kind: "journal",
            entry: {
              id: "c-bounty",
              kind: "quest",
              title: "The Reeve's Bounty",
              body: "The reeve pays for the {ashfang} chief dead, and pays extra for their banner brought back as proof. You took {bounty-retainer} gold of it up front.",
              stages: [
                { text: "Bring down the {ashfang} chief", done: [{ kind: "npc", npc: "reedwife", met: true }] },
                { text: "Collect from the reeve", done: [{ kind: "flag", flag: "got-bounty" }] },
              ],
              takenBy: "bounty",
              resolvedBy: "got-bounty",
            },
          },
        ],
      },
      { id: "leave", label: "Leave it for now", to: "square/city" },
    ],
  },
  "spy-confront": {
    id: "spy-confront",
    kind: "dialogue",
    npc: { id: "npc-peddler", name: "The Peddler", portraitId: "npc-merchant", emoji: "🕵️" },
    art: { emoji: "🕵️" },
    noBack: true,
    lines: [
      {
        if: [{ kind: "notFlag", flag: "know-spy" }],
        text: "The peddler's stall is a marvel of things nobody wants — chipped buttons, one good boot, a birdcage with no bird. He never takes his eyes off the gate.",
      },
      {
        if: [{ kind: "flag", flag: "know-spy" }],
        text: "Up close he is younger than he looked, and he smells of the fish stall.",
      },
      "When your shadow falls across his goods he goes very still, and then he does the last thing you expect of a man selling buttons. He puts two fingers to his teeth and *whistles*. All round the square, hard-faced men start setting down their drinks. A thickset man in a good coat, the **fixer** who pays them, stands up last.",
    ],
    again: [
      "The peddler is back behind his stall of chipped buttons. He sees you coming this time. His fingers are at his teeth before you reach him, and the whistle brings his crew out of the crowd again.",
    ],
    next: [
      {
        id: "investigate",
        label: "[Investigation DC 13] Pick his crew out of the crowd first",
        to: "spy-ambush",
        once: true,
        effects: [{ kind: "setFlag", flag: "spy-seen" }],
        check: {
          skill: "investigation",
          dc: 13,
          failTo: "spy-pinched",
          failEffects: [{ kind: "gold", amount: -factValue("pinched-purse") }],
        },
      },
      {
        id: "intimidate",
        label: "[Intimidation DC 14] Shout down the hired help before they close",
        to: "spy-balked",
        once: true,
        effects: [{ kind: "setFlag", flag: "spy-seen" }],
        check: { skill: "intimidation", dc: 14, failTo: "spy-bolts" },
      },
      {
        id: "brace",
        label: "Put your backs to the wall and draw",
        to: "spy-bolts",
        effects: [{ kind: "setFlag", flag: "spy-seen" }],
      },
    ],
  },
  "spy-caught": {
    id: "spy-caught",
    kind: "story",
    art: { emoji: "🔗" },
    noBack: true,
    text: [
      "His crew is down or gone, one way or another, and the peddler knows it. He sits down in the dirt. \"I only carried word! I never lifted a blade!\"",
      ...[SPY_LIST].flat(),
      "The rest comes out all in one breath, and the raiders' **gate-signal** with it. \"Call that up to the watch-post and they'll open for you like you're one of their own. None of mine went out the gate,\" he adds, bitterly. \"It's still good.\"",
      "The reeve pays a purse for the town's leak. The gate-warden is already waving you over.",
    ],
    next: [
      {
        id: "ok",
        label: "Hand him to the reeve",
        to: "square/city",
        effects: [
          { kind: "setFlag", flag: "spy-caught" },
          { kind: "setFlag", flag: "know-signal" },
          { kind: "gold", amount: 40 },
          {
            kind: "journal",
            entry: {
              id: "c-signal",
              kind: "lead",
              title: "The Gate-Signal",
              body: "You caught the {ashfang}'s informant in the market and took the raiders' gate-signal off him. Call it up to the watch-post at the den's gate, and the watch should open for you.",
              resolvedBy: "signal-spent",
            },
          },
        ],
      },
    ],
  },
  "spy-caught-loud": {
    id: "spy-caught-loud",
    kind: "story",
    art: { emoji: "🔗" },
    noBack: true,
    text: [
      "It is over, and half the square watched it happen. The peddler sits in the dirt by his stall with his hands up. \"I only carried word! I never lifted a blade!\"",
      ...[SPY_LIST].flat(),
      "You ask him for the raiders' gate-signal. He laughs, shakily, and points past the gate. Out on the marsh road, one of his knives is still running. \"He'll be at the den by dark. They'll change the signal the minute he tells them. It's no good to anybody now.\"",
      "Signal or no signal, the reeve pays a purse for the town's leak. The gate-warden is already pushing through the crowd to collect him.",
    ],
    next: [
      {
        id: "ok",
        label: "Hand him to the reeve",
        to: "square/city",
        effects: [
          { kind: "setFlag", flag: "spy-caught" },
          { kind: "gold", amount: 40 },
          {
            kind: "journal",
            entry: {
              id: "c-peddler",
              kind: "clue",
              title: "The Peddler's List",
              body: "You caught the {ashfang}'s informant in the market, but not quietly. One of his crew ran for the den, so the gate-signal he knew is no good now. You will need another way past the den's watch.",
            },
          },
        ],
      },
    ],
  },
  "spy-stalk": {
    id: "spy-stalk",
    kind: "story",
    art: { imageId: "loc-village", emoji: "🕵️" },
    assumes: [{ kind: "flag", flag: "know-spy" }],
    text: [
      "There he is, just where {mira} said: a peddler with a stall of chipped buttons and a birdcage with no bird. He sells nothing, and he watches the gate.",
      "He hasn't seen you yet. Round the square, a few big men in work coats nurse their drinks and keep one eye on him.",
    ],
    again: [
      "The peddler is back at his stall of chipped buttons, watching the gate. His crew are back at their drinks, too.",
    ],
    next: [
      {
        id: "stalk",
        label: "[Stealth DC 12] Come at him from behind the stalls",
        to: "spy-grabbed",
        once: true,
        check: { skill: "stealth", dc: 12, failTo: "spy-slipped" },
      },
      { id: "walk", label: "Walk straight up to his stall", to: "spy-confront" },
    ],
  },
  "spy-grabbed": {
    id: "spy-grabbed",
    kind: "story",
    art: { imageId: "loc-village", emoji: "🤫" },
    noBack: true,
    text: [
      "You slip round behind the fish stall and come up at his back. His fingers are halfway to his teeth when you take his wrist.",
      "His crew sees the knife at his ribs. One by one, they find somewhere else to drink.",
    ],
    next: [
      {
        id: "ok",
        label: "Turn out his stall",
        to: "spy-caught",
        effects: [{ kind: "xp", amount: avoidedFightXP("cutpurses") }],
      },
    ],
  },
  "gate-blocked": {
    id: "gate-blocked",
    kind: "story",
    art: { imageId: "loc-village", emoji: "🚧" },
    assumes: [{ kind: "notFlag", flag: "spy-caught" }],
    noBack: true,
    text: [
      "The gate-warden lays his spear across the road and shakes his head, not unkindly. \"Reeve's orders, and for once they're sound ones. Someone in this town sells the {ashfang} word of every cart that leaves. Nobody goes out until he's in the cells.\"",
      {
        if: [{ kind: "notFlag", flag: "spy-seen" }],
        text: "\"Don't look at me like that. If I knew his face, he'd be there already. All I know is it's someone near the gate. Someone who's always about when a cart goes out. Find me who it is, and the road's yours.\"",
      },
      {
        if: [
          { kind: "notFlag", flag: "spy-seen" },
          { kind: "notFlag", flag: "know-spy" },
          { kind: "notFlag", flag: "mira-read" },
        ],
        text: "\"Or ask {mira} at the {wander-inn}. She hears everything.\"",
      },
      {
        if: [{ kind: "flag", flag: "spy-seen" }],
        text: "\"And don't tell me you don't know who. Half the market watched that peddler whistle his knives out at you.\" He jerks his chin at the stall by the market. \"Bring him in, and the road's yours.\"",
      },
    ],
    next: [
      {
        id: "bluff",
        label: "[Deception DC 13] \"Reeve's business. Stand aside.\"",
        to: "gate-slipped",
        once: true,
        hideWhenBlocked: true,
        effects: [{ kind: "setFlag", flag: "den-alarm" }],
        check: {
          skill: "deception",
          dc: 13,
          failTo: "gate-bluff-called",
          failEffects: [{ kind: "clearFlag", flag: "den-alarm" }],
        },
      },
      {
        id: "wall",
        label: "[Stealth DC 12] Go over the wall after dark",
        to: "gate-slipped",
        once: true,
        hideWhenBlocked: true,
        effects: [{ kind: "setFlag", flag: "den-alarm" }, { kind: "passDay" }],
        check: {
          skill: "stealth",
          dc: 12,
          failTo: "gate-wall-caught",
          failEffects: [{ kind: "clearFlag", flag: "den-alarm" }, { kind: "passDay" }],
        },
      },
      { id: "ok", label: "Back into the square", to: "square/city" },
    ],
  },
  "gate-bluff-called": {
    id: "gate-bluff-called",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-village", emoji: "🚧" },
    text: [
      "The warden looks at you for a long moment. \"The reeve's business,\" he says. \"The reeve was in my guardhouse an hour ago, and he never mentioned you.\" The spear stays where it is.",
    ],
    next: [{ id: "ok", label: "Back into the square", to: "square/city" }],
  },
  "gate-wall-caught": {
    id: "gate-wall-caught",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-village", emoji: "🌙" },
    text: [
      "You find a low stretch of the wall, but the watch walks it more often than you bargained for. A lantern swings your way, and you spend the rest of the night in a barn, waiting for it to go away.",
    ],
    next: [{ id: "ok", label: "Back into the square at first light", to: "square/city" }],
  },
  "gate-slipped": {
    id: "gate-slipped",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-road", emoji: "🌙" },
    text: [
      "You are out, and {thornwick} is behind you. Somewhere behind you, too, the peddler is still at his stall, and the {ashfang} will hear of you before you ever see their smoke.",
    ],
    next: [{ id: "go", label: "Set out on the marsh road", to: "road-out" }],
  },
  "mill": {
    id: "mill",
    kind: "dialogue",
    npc: { id: "npc-osk", name: "{osk} the Miller", portraitId: "npc-commoner", emoji: "🌾" },
    art: { emoji: "🌾" },
    lines: [
      "The mill's sails hang still, and the miller meets you at a barred door with a boat-hook in both hands. \"Not raiders, this one. Something's roosting in my hedgerows — turned my dog stiff as a fencepost. *Stone*, you understand. Won't nobody come near the mill now, and the grain's standing.\"",
      "\"Clear them out and there's coin in it. Just — don't let the ugly things *touch* you.\"",
    ],
    again: [
      "{osk} the miller still has his boat-hook in both hands. \"Back, are you? The ugly things are still in my hedgerows, and my grain's still standing.\"",
    ],
    next: [
      {
        id: "smoke",
        label: "[Nature DC 13] Smoke them out of the hedge with green wood",
        to: "mill-smoked",
        once: true,
        hideWhenBlocked: true,
        check: { skill: "nature", dc: 13, failTo: "mill-fight" },
      },
      { id: "help", label: "Beat the hedgerows", to: "mill-fight" },
      { id: "later", label: "Leave him to his hedgerows", to: "square/city" },
    ],
  },
  "mill-smoked": {
    id: "mill-smoked",
    kind: "story",
    noBack: true,
    art: { emoji: "🌾" },
    text: [
      "You stack green ash on the windward side of the hedge and light it. The smoke rolls in thick and white. The cockatrices come out of the far side hissing and blind, and keep going, away up the valley. The miller pays up gladly, and spends a long while poking the hedge with his boat-hook to make sure.",
    ],
    next: [
      {
        id: "ok",
        label: "Back to the square",
        to: "square/city",
        effects: [
          { kind: "setFlag", flag: "mill-saved" },
          { kind: "gold", amount: 35 },
          { kind: "xp", amount: avoidedFightXP("cockatrice-flock") },
        ],
      },
    ],
  },
  "mill-fight": {
    id: "mill-fight",
    kind: "battle",
    encounterId: "cockatrice-flock",
    mapId: "open",
    intro: [
      "Two bat-winged things burst out of the hedge in a fury of beak and scale, hissing like geese. \"Cockatrices!\" the miller shouts from his door. \"Mind the beaks!\"",
    ],
    again: [
      "The cockatrices are still in the hedge, and this time they come out of it the moment you reach the gate. Mind the bite.",
    ],
    onWin: {
      to: "square/city",
      text: [
        "The second cockatrice flops still. The miller pays up gladly, prods the stone dog, and allows that it makes a fair garden ornament.",
      ],
      effects: [{ kind: "setFlag", flag: "mill-saved" }, { kind: "gold", amount: 35 }],
    },
  },
  "spy-bolts": {
    id: "spy-bolts",
    kind: "battle",
    encounterId: "cutpurses",
    mapId: "village",
    intro: [
      "His crew shoulders out of the market crowd: a fixer and two hired knives, blades held low and level. Up on the stall-roofs three more of them kneel with crossbows. They come straight for you.",
    ],
    again: [
      "The fixer and his two hired knives close in again, blades low and level, and the three crossbows are back up on the stall-roofs. They know your faces now.",
    ],
    onWin: {
      to: "spy-caught-loud",
      text: [
        "The fixer goes down, and the hired help drops its knives and its nerve together, and runs. One of them does not stop at the edge of the square. He goes straight out through the gate, toward the marsh.",
      ],
    },
    parley: {
      skill: "deception",
      dc: 13,
      label: "Tell the knives the watch is coming",
      refused: [
        "The fixer doesn't even look round. \"The reeve's men are down at the marsh gate, friend. We watched them go.\" His knives close in.",
      ],
      success: {
        to: "spy-caught-loud",
        effects: [{ kind: "xp", amount: avoidedFightXP("cutpurses") }],
        text: [
          "\"The reeve's men are two stalls behind us,\" you say, loud enough to carry, and glance past them as if you can see the pikes. The hired knives do the sums faster than their fixer does, and the crossbows come down off the roofs. They are all gone into the crowd before he turns round. Alone, the fixer raises his empty hands and backs off into the market.",
          "Over the heads of the crowd, though, you see one of the knives slip out through the gate, toward the marsh.",
        ],
      },
    },
  },
  "spy-ambush": {
    id: "spy-ambush",
    kind: "battle",
    encounterId: "cutpurses",
    mapId: "village",
    surprise: "enemies",
    intro: [
      "The crew moves in from the stalls, two knives and three crossbows behind their fixer, but you are already where they didn't expect you. They scramble.",
    ],
    onWin: {
      to: "spy-caught",
      text: [
        "The crew is still turning round when the fixer falls, and his hired blades throw down their knives, and the crossbows come down off the roofs. You are standing between them and the gate, so they all bolt the other way, straight into the reeve's watch.",
      ],
    },
  },
  "spy-balked": {
    id: "spy-balked",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-village", emoji: "📣" },
    text: [
      "You plant your feet and roar at the hired knives to put their blades away, now, while they still have hands to do it. Every head in the square turns.",
      "The knives look at your steel, then at the fixer, then at all the people watching. One by one they set their blades down on the cobbles, and up on the stall-roofs the crossbows come down too. The fixer goes with them, out past the well and away from the gate. None of them looks keen to explain this to the chief.",
    ],
    next: [
      {
        id: "ok",
        label: "Turn out his stall",
        to: "spy-caught",
        effects: [{ kind: "xp", amount: avoidedFightXP("cutpurses") }],
      },
    ],
  },
  "spy-slipped": {
    id: "spy-slipped",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-village", emoji: "🕵️" },
    text: [
      "A board creaks under your boot, three stalls short. The peddler glances round, sees you, and is gone into the crowd before you can reach him. He does not come back to his stall until the next evening. You lose a whole day watching it stand empty.",
    ],
    next: [{ id: "on", label: "Walk up to his stall", to: "spy-confront", effects: [{ kind: "passDay" }] }],
  },
  "spy-pinched": {
    id: "spy-pinched",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-village", emoji: "👛" },
    text: [
      "You search the crowd for his crew, and you look in all the wrong places. By the time you spot the fixer, one of his knives has already brushed past you. Your purse went with him.",
    ],
    next: [{ id: "on", label: "Get your backs to the wall", to: "spy-bolts" }],
  },
  "trailhead": {
    id: "trailhead",
    kind: "story",
    art: { imageId: "loc-road", emoji: "🛤️" },
    text: [
      {
        assumes: [{ kind: "flag", flag: "spy-caught" }],
        text: "The peddler is in the reeve's cells now. The gate-warden stands aside, and **{thornwick}** falls away behind you. Ahead the road narrows into the **marsh**, a ribbon of mud between dark pools and whispering reeds.",
      },
      "Somewhere out in that maze the {ashfang} keep their den. Somewhere a good deal closer, it seems, they keep their eyes on the road.",
    ],
    next: [{ id: "go", label: "Set out on the marsh road", to: "road-out" }],
  },
  "trailhead-clear": {
    id: "trailhead-clear",
    kind: "story",
    art: { imageId: "loc-road", emoji: "🛤️" },
    text: [
      "The gate-warden waves you through, and the marsh road lies quiet. The goblins you met on it have not come back.",
    ],
    next: [{ id: "go", label: "Take the marsh road again", to: "trail" }],
  },
  "road-out": {
    id: "road-out",
    kind: "battle",
    encounterId: "goblin-outriders",
    mapId: "open",
    intro: [
      "Barely a mile from the gate the reeds erupt. A pack of goblins spills onto the road, yelling as if they had been waiting for you all day. Their boss lopes out in front with his scimitar bared, cackling and pointing at your boots. At his heel slinks a grey wolf the size of a pony, its lips drawn back from yellow teeth.",
    ],
    again: [
      "The goblin outriders are still in the reeds a mile from the gate. Their boss lopes out in front of the pack again, scimitar bared, cackling, his great grey wolf at his heel.",
    ],
    onWin: {
      to: "trail",
      text: [
        "The goblin pack breaks and vanishes into the reeds, and ahead of you the marsh swallows the road whole. Your arms ache.",
      ],
    },
    parley: {
      skill: "intimidation",
      dc: 13,
      label: "Stare down the goblin boss",
      refused: [
        "The goblin boss counts your blades, then counts his pack, and likes his own sum better. \"Chief pays for heads,\" he cackles in bad Common. \"Yours.\"",
      ],
      success: {
        to: "trail",
        text: [
          "You hold his eye and draw steel slow, and let him count your blades. The cackle dies in his throat. He barks something at his pack, and they melt back into the reeds as if they were never there. Behind you, somebody lets out a long breath. Not one blade got wet.",
        ],
        effects: [{ kind: "xp", amount: avoidedFightXP("goblin-outriders") }],
      },
    },
  },
  "tracks": {
    id: "tracks",
    kind: "story",
    art: { emoji: "👣" },
    text: [
      "Boot-prints and drag-marks cross the mud. Read them right, and they will lead you through the reeds.",
    ],
    next: [
      {
        id: "ranger",
        label: "[Ranger · Survival DC 9] Read the patrols' line at a glance",
        to: "tracks-read",
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "ranger" }],
        attempt: "tracks",
        check: { skill: "survival", dc: 9, failTo: "tracks-lost" },
      },
      {
        id: "read",
        label: "[Survival DC 12] Follow the boot-prints",
        to: "tracks-read",
        attempt: "tracks",
        check: { skill: "survival", dc: 12, failTo: "tracks-lost" },
      },
    ],
  },
  "tracks-read": {
    id: "tracks-read",
    kind: "story",
    art: { emoji: "👣" },
    noBack: true,
    text: [
      "The tracks tell their whole story: a heavy patrol out at dusk, a lighter one back at dawn, always the same dry line through the reeds. You've found the **safe path to the hollow**.",
    ],
    next: [
      {
        id: "ok",
        label: "Follow the dry line",
        to: "@hub",
        effects: [{ kind: "setFlag", flag: "trail-read" }, { kind: "xp", amount: 20 }],
      },
    ],
  },
  "tracks-lost": {
    id: "tracks-lost",
    kind: "story",
    art: { emoji: "👣" },
    noBack: true,
    text: [
      "The prints tangle and double back on themselves until your eyes water, but they point roughly toward the hills. That's enough to find the hollow by, if not the dry way there.",
      "The wet way is slow and loud. You will come at the hollow splashing from one tussock to the next. Anything waiting in the reeds will hear you long before you see it.",
    ],
    next: [
      {
        id: "ok",
        label: "Head for the hills",
        to: "@hub",
        effects: [{ kind: "setFlag", flag: "trail-read" }, { kind: "setFlag", flag: "trail-wet" }],
      },
    ],
  },
  "tracks-mapped": {
    id: "tracks-mapped",
    kind: "story",
    art: { emoji: "🗺️" },
    assumes: [{ kind: "flag", flag: "trail-known" }],
    noBack: true,
    text: [
      "The old trapper's ale-sketch was a good one. The reeds, the pools and the hollow in the hills all line up with the mud. The patrols' dry line runs just where his finger traced it.",
    ],
    next: [
      {
        id: "ok",
        label: "Follow the trapper's line",
        to: "@hub",
        effects: [{ kind: "setFlag", flag: "trail-read" }, { kind: "xp", amount: 20 }],
      },
    ],
  },
  "hollow-quiet": {
    id: "hollow-quiet",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🌾" },
    assumes: [{ kind: "flag", flag: "know-hag" }],
    noBack: true,
    text: [
      "The hollow lies quiet where you broke the {reedwife}'s ambush, with nothing left of it but flattened reeds and still water. The den's wooden wall waits ahead.",
    ],
    next: [
      {
        id: "ok",
        label: "Make for the den's wall",
        to: "gate",
        hideWhenBlocked: true,
        requires: [{ kind: "noCompanion", companion: "wren" }],
      },
      {
        id: "wren",
        label: "Make for the den's wall",
        to: "wren-parts",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }],
      },
      {
        id: "back",
        label: "Take the marsh road back",
        to: "trail",
        hideWhenBlocked: true,
        requires: [{ kind: "noCompanion", companion: "wren" }],
      },
    ],
  },
  "ravine": {
    id: "ravine",
    kind: "challenge",
    art: { emoji: "🪨" },
    retry: "perApproach",
    intro: [
      "A collapsed ravine cuts the trail. The other lip is close, but the gap between is all loose rock, and there is more than one way across it.",
    ],
    again: [
      "The ravine still cuts the trail. You look the loose stone over again for a way across you have not tried.",
    ],
    approaches: [
      {
        id: "climb",
        label: "Climb the sheer face",
        skill: "athletics",
        dc: 13,
        success: {
          to: "@hub",
          text: ["You haul each other up and over, hand over hand."],
          effects: [{ kind: "setFlag", flag: "crossed-ravine" }, { kind: "xp", amount: 30 }],
        },
        failure: {
          to: "ravine",
          text: ["A hold crumbles and you slide back down in a clatter of stone. That way will not work."],
        },
      },
      {
        id: "scramble",
        label: "Pick across the rubble where it lies shallowest",
        skill: "acrobatics",
        dc: 12,
        success: {
          to: "@hub",
          text: ["Light on your feet, you thread the shifting stones and reach the far lip."],
          effects: [{ kind: "setFlag", flag: "crossed-ravine" }, { kind: "xp", amount: 30 }],
        },
        failure: {
          to: "ravine",
          text: ["The loose stone gives all at once and you scramble back before it takes an ankle with it."],
        },
      },
      {
        id: "detour",
        label: "Look for a gentler way round",
        skill: "survival",
        dc: 11,
        hint: "It will cost you time.",
        success: {
          to: "@hub",
          text: [
            "You trace a gentler slope downstream and lead the party around dry-shod. It costs time, but nothing else.",
          ],
          effects: [{ kind: "setFlag", flag: "crossed-ravine" }, { kind: "xp", amount: 15 }],
        },
        failure: {
          to: "ravine",
          text: [
            "You follow the lip of the ravine downstream for an hour, and it only gets deeper. You trudge back to where you started.",
          ],
        },
      },
    ],
    success: { to: "@hub", effects: [{ kind: "setFlag", flag: "crossed-ravine" }] },
    failure: {
      to: "@hub",
      text: [
        "Every way across fights you. In the end you take the long, muddy detour downstream, miles out of your way. By the time you climb back onto the trail past the ravine, the light is gone. You have lost the whole day.",
      ],
      effects: [{ kind: "setFlag", flag: "crossed-ravine" }, { kind: "passDay" }],
    },
  },
  "wounded": {
    id: "wounded",
    kind: "dialogue",
    npc: SCOUT,
    art: { emoji: "🤕" },
    noBack: true,
    lines: [
      "A young scout in the reeve's colours lies pinned under a dead horse, an arrow through her leg, her jaw set hard against the pain. \"I'm fine,\" she says — a lie you can see from here. \"Get the horse off me and I'll tell you everything. How they're set, where they watch. I counted. That's the job.\"",
      "The mud under the arrow is dark and wet. She will not last many more nights out here.",
    ],
    next: [
      {
        id: "potion",
        label: "Give her a healing potion",
        to: "scout-saved",
        hideWhenBlocked: true,
        requires: [{ kind: "item", itemId: "potion-healing" }],
        effects: [{ kind: "removeItem", itemId: "potion-healing", qty: 1 }],
      },
      {
        id: "lay-hands",
        label: "[Paladin · Religion DC 9] Lay hands on the wound",
        to: "scout-saved",
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "paladin" }],
        attempt: "scout-wound",
        check: { skill: "religion", dc: 9, failTo: "scout-fail" },
      },
      {
        id: "pray",
        label: "[Cleric · Religion DC 9] Pray over the wound",
        to: "scout-saved",
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "cleric" }],
        attempt: "scout-wound",
        check: { skill: "religion", dc: 9, failTo: "scout-fail" },
      },
      {
        id: "moss",
        label: "[Druid · Nature DC 9] Pack the wound with marsh-moss",
        to: "scout-saved",
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "druid" }],
        attempt: "scout-wound",
        check: { skill: "nature", dc: 9, failTo: "scout-fail" },
      },
      {
        id: "medicine",
        label: "[Medicine DC 12] Ease her out and bind the leg",
        to: "scout-saved",
        attempt: "scout-wound",
        check: { skill: "medicine", dc: 12, failTo: "scout-fail" },
      },
      {
        id: "leave",
        label: "Leave her and press on",
        to: "scout-left",
        effects: [{ kind: "setFlag", flag: "scout-walked-past" }],
      },
    ],
  },
  "scout-left": {
    id: "scout-left",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🐴" },
    noBack: true,
    text: [
      "You step around the horse. She doesn't call after you. She only watches you go, jaw still set.",
      "Behind you the reeds close over the trail. You don't look back.",
    ],
    next: [{ id: "ok", label: "Keep walking", to: "@hub" }],
  },
  "scout-passed": {
    id: "scout-passed",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🐴" },
    assumes: [{ kind: "flag", flag: "scout-walked-past" }, { kind: "notFlag", flag: "scout-bled-out" }],
    noBack: true,
    text: [
      "The dead horse still lies across the trail. The scout is gone. A line of flattened reeds drags away toward {thornwick}, and you cannot tell who made it.",
    ],
    next: [{ id: "ok", label: "Leave the horse where it lies", to: "@hub" }],
  },
  "scout-saved": {
    id: "scout-saved",
    kind: "story",
    noBack: true,
    art: { emoji: "❤️‍🩹" },
    text: [
      "The horse comes off and the bleeding stops, and the scout lets out a breath she has been holding for hours. \"**{wren}**,\" she offers, as if admitting to a name costs her something. She scratches the den's watch-posts into the mud, quick and exact.",
      ...[WREN_ON_VEX].flat(),
    ],
    next: [
      {
        id: "ok",
        label: "Send {wren} back to {thornwick}",
        to: "@hub",
        effects: [...[WREN_SAVED].flat(), { kind: "npc", npc: "wren", attitude: 1 }],
      },
      {
        id: "come",
        label: "Ask {wren} to come with you through the marsh",
        to: "wren-joins",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "den-entered" }],
        effects: [
          ...[WREN_SAVED].flat(),
          { kind: "npc", npc: "wren", attitude: 1 },
          { kind: "joinParty", companion: "wren" },
        ],
      },
    ],
  },
  "wren-joins": {
    id: "wren-joins",
    kind: "story",
    noBack: true,
    art: { emoji: "🧭" },
    assumes: [{ kind: "companion", companion: "wren" }],
    text: [
      "{wren} tests the bound leg, winces, and decides it will do. \"I know where the sinkholes are. You don't.\" She takes up her bow. \"As far as their gate. Then I go for the reeve's men, and you had better still be alive when I get back.\"",
    ],
    next: [{ id: "go", label: "Follow {wren} into the marsh", to: "@hub" }],
  },
  "wren-parts": {
    id: "wren-parts",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-camp", emoji: "🧭" },
    assumes: [{ kind: "companion", companion: "wren" }],
    text: [
      "At the tree line above the hollow {wren} stops, and eases her weight off the leg. \"This is as far as I said.\" She looks down at the hollow a long moment. \"Reeve's men by nightfall, if I run. Leave me something to arrest.\"",
    ],
    next: [
      {
        id: "go",
        label: "Let her go, and face the gate",
        to: "gate",
        effects: [{ kind: "leaveParty", companion: "wren" }],
      },
    ],
  },
  "scout-fail": {
    id: "scout-fail",
    kind: "story",
    noBack: true,
    art: { emoji: "🩸" },
    text: [
      "It goes wrong. As the horse comes off her the arrowhead shifts, and the blood comes fast and dark. She fumbles at her belt for the healing potion she could never reach with the horse on top of her. You get it down her, and press on the wound until your arms shake.",
      "The bleeding stops at last, with the light already going. \"**{wren}**,\" she says, grey to the lips. \"In case you have to tell someone.\" She scratches the den's watch-posts into the mud, slower than she wants to. She is in no state to guide anyone anywhere today.",
      ...[WREN_ON_VEX].flat(),
    ],
    next: [
      {
        id: "ok",
        label: "Send {wren} limping back to {thornwick}",
        to: "@hub",
        effects: [...[WREN_SAVED].flat(), { kind: "passDay" }],
      },
    ],
  },
  "scout-dead": {
    id: "scout-dead",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-marsh", emoji: "🐴" },
    assumes: [
      { kind: "flag", flag: "scout-bled-out" },
      { kind: "npc", npc: "wren", notFate: ["saved", "lost"] },
    ],
    text: [
      {
        if: [{ kind: "notFlag", flag: "scout-walked-past" }],
        text: "A young scout in the reeve's colours lies under the dead horse with an arrow through her leg. She died in the night, alone. There are tally-marks scratched in the mud by her hand. She was still counting the den's watch-posts.",
      },
      {
        if: [{ kind: "notFlag", flag: "scout-walked-past" }],
        text: "At her belt is the healing potion she could never reach with the horse on top of her.",
      },
      {
        if: [{ kind: "flag", flag: "scout-walked-past" }],
        text: "A line of flattened reeds runs from the dead horse toward {thornwick} for a hundred yards, and stops. The scout you stepped round lies at the end of it, face down. She died in the night, alone.",
      },
      {
        if: [{ kind: "flag", flag: "scout-walked-past" }],
        text: "She got the healing potion out of her belt at last. Her fingers are still closed round it, and the stopper is still in.",
      },
      "There is no one on the road to tell you her name.",
    ],
    next: [
      {
        id: "ok",
        label: "Cover her and go",
        to: "@hub",
        effects: [
          { kind: "npc", npc: "wren", fate: "lost" },
          { kind: "setFlag", flag: "scout-covered" },
          { kind: "addItem", itemId: "potion-healing", qty: 1 },
        ],
      },
    ],
  },
  "scout-gone": {
    id: "scout-gone",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🐴" },
    assumes: [{ kind: "npc", npc: "wren", fate: "lost" }],
    noBack: true,
    text: [
      "The dead horse still lies across the trail, white with frost. Beside it is the low mound of reeds where you covered the scout.",
    ],
    next: [{ id: "ok", label: "Leave her to her rest", to: "@hub" }],
  },
  "scout-along": {
    id: "scout-along",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🐴" },
    assumes: [{ kind: "companion", companion: "wren" }],
    noBack: true,
    text: [
      "The dead horse still lies across the trail. {wren} walks past it without looking. \"He was a good horse,\" she says, too quickly. \"Come on.\"",
    ],
    next: [{ id: "ok", label: "Follow {wren} on", to: "@hub" }],
  },
  "scout-sent": {
    id: "scout-sent",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🐴" },
    assumes: [{ kind: "npc", npc: "wren", fate: "saved" }, { kind: "noCompanion", companion: "wren" }],
    noBack: true,
    text: [
      "The dead horse still lies across the trail.",
      "{wren} is long gone to {thornwick} for the reeve's men. The flies have the horse to themselves.",
    ],
    next: [{ id: "ok", label: "Keep to the trail", to: "@hub" }],
  },
  "barrow": {
    id: "barrow",
    kind: "story",
    art: { emoji: "🪦" },
    text: [
      "Half-swallowed by the reeds lies a barrow-mound, its stones worn smooth as soap. Its capstone is cracked and weeping cold air. The marsh has been chewing at it for centuries. Lately, something below has been pushing at the capstone, and something else has been pushing it back down.",
      "Something gold catches your light in the dark below. So does something that moves without touching the water.",
    ],
    again: [
      "The barrow-mound still breathes cold air through its cracked capstone. Down in the dark, the grave-goods still glint, and something still waits beside them.",
    ],
    next: [
      { id: "in", label: "Go down into the dark", to: "barrow-fight" },
      {
        id: "settle",
        label: "[Religion DC 13] Say the old words over the capstone, and close it",
        to: "barrow-settled",
        once: true,
        hideWhenBlocked: true,
        check: { skill: "religion", dc: 13, failTo: "barrow-fight" },
      },
      { id: "leave", label: "Leave the dead their peace", to: "@hub" },
    ],
  },
  "barrow-settled": {
    id: "barrow-settled",
    kind: "story",
    noBack: true,
    art: { emoji: "🪦" },
    text: [
      "You kneel at the cracked capstone and say the words for the dead, slowly, the way the old priests said them when the barrow was new. The cold air stops breathing out of the crack. Below, something settles back down among the grave-goods, and is still. You leave the gold where it lies.",
    ],
    next: [
      {
        id: "ok",
        label: "Back to the trail",
        to: "@hub",
        effects: [
          { kind: "setFlag", flag: "barrow-cleared" },
          { kind: "xp", amount: avoidedFightXP("barrow-haunt") },
        ],
      },
    ],
  },
  "barrow-fight": {
    id: "barrow-fight",
    kind: "battle",
    encounterId: "barrow-haunt",
    mapId: "corridor",
    intro: [
      "The cold answers you. Two figures rise out of the grave-earth. One wears the form of a man, but it is nothing now but spite and winter air. It passes *through* the barrow stones to reach you. The other climbs up out of the grave-goods in rotten mail. It holds a green-bronze sword in its grey hand, and a cold light burns where its eyes should be.",
    ],
    again: [
      "The two cold dead are waiting this time, down among the grave-goods. One is nothing but winter air, and one wears rotten mail and carries a sword. They come for you again.",
    ],
    onWin: {
      to: "@hub",
      text: [
        "The cold shape shreds into mist, and the dead thing in mail folds down among the grave-goods and is only bones. Among the grave-goods you find a little plain silver, and leave the rest, on balance, where it lies.",
      ],
      effects: [{ kind: "setFlag", flag: "barrow-cleared" }, { kind: "gold", amount: 45 }],
    },
  },
  "thicket": {
    id: "thicket",
    kind: "story",
    art: { emoji: "🕸️" },
    text: [
      "Pale silk sheets the reeds ahead, and the reeds under it have gone grey and still. Bundles hang in the webbing at the height a man's shoulders would be. Some of the bundles are man-shaped.",
      "Something spins here, and it has been eating well off the {ashfang}'s road. But those cocoons will have purses.",
    ],
    again: [
      "The grey webs still sheet the reeds, and the man-shaped bundles still hang in them. The spinners have not gone anywhere.",
    ],
    next: [
      { id: "in", label: "Cut your way in", to: "thicket-fight" },
      {
        id: "burn",
        label: "[Survival DC 12] Fire the dry reeds upwind, and let the webs burn",
        to: "thicket-burned",
        once: true,
        hideWhenBlocked: true,
        check: { skill: "survival", dc: 12, failTo: "thicket-fight" },
      },
      { id: "leave", label: "Give the webs a wide berth", to: "@hub" },
    ],
  },
  "thicket-burned": {
    id: "thicket-burned",
    kind: "story",
    noBack: true,
    art: { emoji: "🔥" },
    text: [
      "You wait for the wind, then put a spark to the dead reeds on the near side. The fire goes through the thicket in a rush and a crackle, and the webs go up like paper. Whatever spun them does not come out. By the time the smoke clears there is nothing in the thicket but ash and a few blackened cocoons.",
    ],
    next: [
      {
        id: "ok",
        label: "Back to the trail",
        to: "@hub",
        effects: [{ kind: "setFlag", flag: "thicket-cleared" }, { kind: "xp", amount: avoidedFightXP("spiders") }],
      },
    ],
  },
  "thicket-fight": {
    id: "thicket-fight",
    kind: "battle",
    encounterId: "spiders",
    mapId: "marsh",
    intro: ["The silk trembles over your heads. Four giant spiders drop from the high webbing on every side."],
    again: [
      "The spiders are waiting in the high webbing this time. They drop the moment your blade touches the silk.",
    ],
    onWin: {
      to: "@hub",
      text: [
        "The final spider curls in on itself like a burnt glove. The cocoons hold two dissolved raiders, their purses intact. There is also one caravan guard, still breathing. He presses his last healing potion into your hands, and he does not stop thanking you until the reeds swallow the sound.",
      ],
      effects: [
        { kind: "setFlag", flag: "thicket-cleared" },
        { kind: "gold", amount: 60 },
        { kind: "addItem", itemId: "potion-healing", qty: 1 },
      ],
    },
  },
  "ambush": {
    id: "ambush",
    kind: "check",
    skill: "perception",
    dc: 13,
    roller: "group",
    art: { emoji: "⛰️" },
    intro: [
      "The hollow opens below you, and the reeds in it are too still, and cold where the marsh should be warm. Nothing moves. Something out there is lying flat in the water, waiting for you to come closer.",
    ],
    again: [
      "You come back to the lip of the hollow. The reeds below are still too still, and too cold. Something out there is waiting for you again.",
    ],
    success: {
      to: "ambush-turned",
      text: [
        "You catch the gleam of an eye among the reeds a breath before it moves. The trap is yours to spring.",
      ],
    },
    failure: {
      to: "ambush-sprung",
      text: ["A hiss, a ripple — and the reeds come alive all at once. Too late."],
    },
  },
  "ambush-wet": {
    id: "ambush-wet",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-marsh", emoji: "⛰️" },
    text: [
      "You come up out of the sinkholes on the wrong side of the hollow, soaked to the waist. Every step sucks and splashes.",
      "The reeds ahead are too still, and cold where the marsh should be warm. You see it a moment too late. Anything lying in that water heard you coming a long way off.",
    ],
    next: [{ id: "on", label: "Draw steel", to: "ambush-sprung" }],
  },
  "ambush-wren": {
    id: "ambush-wren",
    kind: "story",
    art: { imageId: "loc-marsh", emoji: "🧭" },
    assumes: [{ kind: "companion", companion: "wren" }],
    text: [
      "At the lip of the hollow {wren} puts out an arm and stops you. She watches the reeds below for a long time.",
      "\"Too still,\" she says. \"And cold. The marsh is never cold at noon.\" She points once, twice, three times. \"Lizardfolk, lying in the water. And two big ones behind them, toads, I think. They think we'll come down the dry line. So we won't.\"",
    ],
    next: [
      {
        id: "wren",
        label: "Follow {wren} round behind them",
        to: "ambush-turned",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }],
      },
    ],
  },
  "ambush-turned": {
    id: "ambush-turned",
    kind: "battle",
    encounterId: "hag-thralls",
    mapId: "bog",
    surprise: "enemies",
    intro: [
      "You strike first. Scaled backs rise out of the water where they lay, a hunting-party of **lizardfolk** with two monstrous toads lumbering behind them like herded oxen. For a heartbeat, not one of them sees you.",
    ],
    again: [
      "You strike first again. The lizardfolk are back in the water with their toads behind them, and once more they are watching the wrong way.",
    ],
    onWin: {
      to: "hollow-won",
      text: ["The lizardfolk sink back into the dark water they came from, one by one."],
    },
  },
  "ambush-sprung": {
    id: "ambush-sprung",
    kind: "battle",
    encounterId: "hag-thralls",
    mapId: "bog",
    surprise: "party",
    intro: [
      "The reeds burst apart around you, and scaled shapes rush in with hooked spears, two giant toads heaving up through the muck behind them. They move together, too well, as if one hand worked them all.",
    ],
    again: [
      "The reeds erupt around you again. The lizardfolk and their toads have been waiting for you to come back.",
    ],
    onWin: {
      to: "hollow-won",
      text: [
        "Bloodied, you break them at last. The last of the lizardfolk drags itself into the water and does not come up.",
      ],
    },
  },
  "hollow-won": {
    id: "hollow-won",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-marsh", emoji: "🐍" },
    text: [
      "You turn the nearest body with your boot. Branded into the scaled hide, still weeping, is a crude mark of reeds and a reaching hand.",
      "A voice drifts across the water, old and wet and amused. \"My little dogs, off their leash. No matter, sweetlings. The reed-cutters call me the **{reedwife}**. Ask your chief what he sold me. Ask him what I paid.\"",
      "\"Come up to the fire, if you can find it. The chief and I will be waiting.\" The reeds shiver, and go quiet.",
      {
        if: [{ kind: "companion", companion: "wren" }],
        text: "{wren} has gone white. \"A green hag,\" she says. \"Reed-cutters' children get told about them. I thought it was a story.\"",
      },
    ],
    next: [
      {
        id: "ok",
        label: "Go up and find her fire",
        to: "gate",
        hideWhenBlocked: true,
        requires: [{ kind: "noCompanion", companion: "wren" }],
        effects: [...[HOLLOW_PASSED].flat()],
      },
      {
        id: "wren",
        label: "Go up and find her fire",
        to: "wren-parts",
        hideWhenBlocked: true,
        requires: [{ kind: "companion", companion: "wren" }],
        effects: [...[HOLLOW_PASSED].flat()],
      },
    ],
  },
  "gate": {
    id: "gate",
    kind: "story",
    back: true,
    art: { imageId: "loc-camp", emoji: "🏚️" },
    text: [
      "A wall of lashed timber rings the hollow, with a watch-post looming over its only gate. Somewhere beyond it, the chief is waiting.",
    ],
    next: [
      {
        id: "back",
        label: "Slip back in the way you left",
        to: "inner",
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "den-entered" }],
      },
      {
        id: "signal",
        label: "[Deception DC 10] Call the stolen gate-signal up to the post",
        to: "den-slipped",
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "know-signal" }, { kind: "notFlag", flag: "den-entered" }],
        effects: [{ kind: "setFlag", flag: "den-entered" }, { kind: "setFlag", flag: "signal-spent" }],
        check: {
          skill: "deception",
          dc: 10,
          failTo: "gate-signal-blown",
          failEffects: [{ kind: "clearFlag", flag: "den-entered" }],
        },
      },
      {
        id: "lock",
        label: "[Rogue · Sleight of Hand DC 10] Pick the lock on the little water-gate",
        to: "den-picked",
        once: true,
        hideWhenBlocked: true,
        requires: [{ kind: "classInParty", classId: "rogue" }, { kind: "notFlag", flag: "den-entered" }],
        effects: [{ kind: "setFlag", flag: "den-entered" }],
        check: {
          skill: "sleight-of-hand",
          dc: 10,
          failTo: "den-lock-jammed",
          failEffects: [{ kind: "clearFlag", flag: "den-entered" }],
        },
      },
      {
        id: "sneak",
        label: "[Stealth DC 13] Slip over the wall together",
        to: "den-slipped",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "den-entered" }],
        effects: [{ kind: "setFlag", flag: "den-entered" }],
        check: {
          skill: "stealth",
          dc: 13,
          failTo: "gate-caught",
          failEffects: [{ kind: "clearFlag", flag: "den-entered" }],
          roller: "group",
        },
      },
      {
        id: "fight",
        label: "Storm the gate",
        to: "gate-fight",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "den-entered" }],
      },
    ],
  },
  "den-lock-jammed": {
    id: "den-lock-jammed",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-camp", emoji: "🗝️" },
    text: [
      "Down where the wall meets the marsh, a little gate lets the den draw water. Its lock is cheap and rusted, and your pick snaps off inside it. No one on the wall hears, but that gate will not open now, for anyone.",
    ],
    next: [{ id: "back", label: "Back to the main gate", to: "gate" }],
  },
  "den-picked": {
    id: "den-picked",
    kind: "story",
    art: { imageId: "loc-camp", emoji: "🗝️" },
    noBack: true,
    text: [
      "Down where the wall meets the marsh, a little gate lets the den draw water. Its lock is cheap and rusted. It takes your rogue about as long as a sneeze, and makes less noise.",
    ],
    next: [{ id: "in", label: "Slip inside", to: "inner", effects: [...[GATE_PASSED].flat()] }],
  },
  "den-slipped": {
    id: "den-slipped",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-camp", emoji: "🤫" },
    text: [
      "You are inside the wall, and no horn has sounded. Up in the gateway something hairy and twice a man's size scratches itself and watches the marsh, its back to you. A heap of spotted, dog-faced things snores by the fire.",
    ],
    next: [
      {
        id: "in",
        label: "Keep low and move in among the tents",
        to: "inner",
        effects: [...[GATE_PASSED].flat()],
      },
    ],
  },
  "gate-fight": {
    id: "gate-fight",
    kind: "battle",
    encounterId: "den-gate",
    mapId: "corridor",
    intro: [
      "A horn brays from the watch-post, and the gate-runners answer. Something hairy and twice a man's size ducks through the gateway. Behind him three gnolls come yammering their high, laughing bark, and a fourth, hung with bone charms, howls them on. A spotted hyena as big as a pony lopes at their heels. The narrow timber run hems them all in.",
    ],
    again: [
      "The watch-post saw you coming this time. The big one already fills the gateway, and his gnolls yammer behind him while the bone-hung one howls and their hyena slavers.",
    ],
    onWin: {
      to: "inner",
      text: ["The big one goes down last, folding across the gateway."],
      effects: [
        { kind: "setFlag", flag: "den-entered" },
        { kind: "setFlag", flag: "signal-spent" },
        { kind: "setFlag", flag: "den-alarm" },
      ],
    },
    parley: {
      skill: "deception",
      dc: 15,
      label: "Pass yourselves off as new blood",
      refused: [
        "The big one sniffs you, slow and thorough. \"Chief sent for nobody,\" he rumbles. \"Chief never sends for anybody.\" Behind him the gnolls laugh harder.",
      ],
      success: {
        to: "inner",
        text: [
          "\"Chief sent for fighters,\" you growl, and shoulder past the horn like you own the place. The big one sniffs you, weighs you, and decides you are someone else's problem. The gnolls fall in laughing behind you, and the den stays asleep.",
        ],
        effects: [{ kind: "setFlag", flag: "den-entered" }, ...[GATE_PASSED].flat()],
      },
    },
  },
  "gate-signal-blown": {
    id: "gate-signal-blown",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-camp", emoji: "📯" },
    text: [
      "The watch-post goes quiet, and a voice calls down a countersign you never learned. Somebody up there knows that someone sold the gate-signal.",
      "A horn brays, and torches run along the wall. You fall back into the reeds and lie in the mud while the watch hunts the hollow. It takes all night and most of the next day before the den settles. By then the watch has a new signal, and you do not know it.",
    ],
    next: [
      {
        id: "back",
        label: "Crawl back up to the gate",
        to: "gate",
        effects: [
          { kind: "passDay" },
          { kind: "clearFlag", flag: "know-signal" },
          { kind: "setFlag", flag: "den-alarm" },
          {
            kind: "journal",
            entry: {
              id: "c-signal-burned",
              kind: "clue",
              title: "The Gate-Signal Is Burned",
              body: "The den's watch knew someone sold the gate-signal, and they changed it. You will need another way past the gate: over the wall, or through it.",
            },
          },
        ],
      },
    ],
  },
  "gate-caught": {
    id: "gate-caught",
    kind: "battle",
    encounterId: "den-gate",
    mapId: "corridor",
    surprise: "party",
    intro: [
      "Halfway over the wall, a stake shifts under a boot and cracks. A horn brays right above your heads. When you drop down inside, something hairy and twice a man's size is already waiting at the foot of the wall. A pack of spotted, dog-faced things yammers behind it.",
    ],
    onWin: {
      to: "inner",
      text: ["The big one goes down last, face-first in the mud at the foot of the wall."],
      effects: [
        { kind: "setFlag", flag: "den-entered" },
        { kind: "setFlag", flag: "signal-spent" },
        { kind: "setFlag", flag: "den-alarm" },
      ],
    },
  },
  "den-muster": {
    id: "den-muster",
    kind: "battle",
    encounterId: "den-pit",
    mapId: "ruins",
    intro: [
      "The chained shape in the pit stands up, and keeps standing up: an **ogre**, half-starved, whip-scarred and beside itself with rage. Two orc goaders work its temper with barbed poles, and when they see you they whoop and haul the pins.",
      "On the far side of the ring, a bare-chested raider gets up off an upturned barrel. Scars run from his collarbone to his belt. He lifts a notched greataxe and rolls his shoulders. This is his pit.",
      "\"Fresh meat for the pit!\" a goader bellows, and slips the ogre's chain.",
    ],
    again: [
      "The ogre is off its chain now, and it is not going back on. The two orc goaders whoop and drive it at you with their barbed poles. Their scarred champion comes round the ring behind it, greataxe high.",
    ],
    onWin: {
      to: "@hub",
      text: [
        "The ogre crashes down across its own broken chains. The goaders and their champion don't outlive it by much. The ogre's collar has worn a groove in its neck as deep as a thumb.",
        "Under the champion's barrel is a fat purse: the takings from every fight he ever won in this pit.",
      ],
      effects: [{ kind: "gold", amount: 40 }, { kind: "setFlag", flag: "pit-won" }],
    },
  },
  "den-pens-door": {
    id: "den-pens-door",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-camp", emoji: "⛓️" },
    text: [
      "Behind the kennels stands a pen of lashed stakes, the kind a farmer keeps pigs in. Something in the straw shifts as your torch comes near.",
    ],
    next: [
      {
        id: "look",
        label: "Look in the pen",
        to: "den-pens",
        hideWhenBlocked: true,
        requires: [{ kind: "notFlag", flag: "captives-taken" }],
        effects: [{ kind: "setFlag", flag: "pens-found" }, { kind: "setFlag", flag: "pens-settled" }],
      },
      {
        id: "look-late",
        label: "Look in the pen",
        to: "den-pens-empty",
        hideWhenBlocked: true,
        requires: [{ kind: "flag", flag: "captives-taken" }],
        effects: [{ kind: "setFlag", flag: "pens-found" }, { kind: "setFlag", flag: "pens-settled" }],
      },
    ],
  },
  "den-pens-empty": {
    id: "den-pens-empty",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-camp", emoji: "⛓️" },
    assumes: [{ kind: "flag", flag: "captives-taken" }],
    text: [
      "There are no pigs in the pen, and no people. It was only a rat in the straw. The chain hangs open, and wet, webbed footprints lead from the gate toward the marsh. None lead back.",
      "Something has come for them out of the water, and gone again. In the corner lies one small shoe.",
    ],
    next: [{ id: "ok", label: "Back to the den", to: "@hub" }],
  },
  "den-pens": {
    id: "den-pens",
    kind: "story",
    art: { imageId: "loc-camp", emoji: "⛓️" },
    assumes: [{ kind: "notFlag", flag: "captives-taken" }],
    noBack: true,
    text: [
      "There are no pigs. A grey-bearded carter, two reed-cutters and a girl of about seven blink up at your torch.",
      "The girl has one shoe, on her right foot. \"They said the lady in the water comes for us when the moon goes dark,\" the carter whispers. \"My gran left her a {door-price} every {door-midwinter}, and that was all she ever asked. Now the chief feeds her people.\" He swallows. \"Are you the reeve's men?\"",
      "A chain and a heavy padlock hold the pen shut. Across the yard, a raider dozes by the fire with his spear across his lap.",
    ],
    next: [
      {
        id: "pick",
        label: "[Sleight of Hand DC 13] Work the padlock open quietly",
        to: "den-pens-freed",
        once: true,
        check: { skill: "sleight-of-hand", dc: 13, failTo: "pens-alarm" },
      },
      { id: "hack", label: "Hack through the stakes, and never mind the noise", to: "pens-alarm" },
      {
        id: "leave",
        label: "Leave them for the reeve's men",
        to: "den-pens-left",
        effects: [
          { kind: "setFlag", flag: "captives-left" },
          { kind: "setFlag", flag: "captives-taken" },
          { kind: "npc", npc: "wren", attitude: -1 },
        ],
      },
    ],
  },
  "pens-alarm": {
    id: "pens-alarm",
    kind: "battle",
    encounterId: "pen-watch",
    mapId: "ruins",
    loot: false,
    noFlee: true,
    intro: [
      "The noise carries. The raider by the fire jumps up and yells, and the den's watch comes running with him. Two hulking raiders with greataxes, four archers and an orc spread out in front of the pen. The carter pulls the girl down into the straw.",
    ],
    onWin: {
      to: "den-pens-freed",
      effects: [{ kind: "setFlag", flag: "den-alarm" }],
      text: [
        "The last raider falls against the stakes, and no one else comes. Across the yard someone laughs at the noise and goes back to his dice.",
      ],
    },
    onLoss: {
      to: "@hub",
      text: [
        "You go down in the mud in front of the pen, and come to in the straw of the pen itself, left for dead. The gate stands open and the captives are gone. Their tracks lead out toward the deep fen.",
      ],
      effects: [{ kind: "setFlag", flag: "captives-taken" }, { kind: "setFlag", flag: "den-alarm" }],
    },
  },
  "den-pens-freed": {
    id: "den-pens-freed",
    kind: "story",
    art: { imageId: "loc-camp", emoji: "⛓️" },
    noBack: true,
    text: [
      "The pen comes open. The carter lifts the girl onto his back, and the reed-cutters take a kennel-pole each. They slip off toward the gate and the dark of the marsh road, not making a sound.",
    ],
    next: [
      {
        id: "ok",
        label: "Back to the den",
        to: "@hub",
        effects: [{ kind: "setFlag", flag: "captives-freed" }, { kind: "npc", npc: "wren", attitude: 1 }],
      },
    ],
  },
  "den-pens-left": {
    id: "den-pens-left",
    kind: "story",
    art: { imageId: "loc-camp", emoji: "⛓️" },
    noBack: true,
    text: [
      "\"The reeve's men will come,\" you tell them. The carter nods slowly and says nothing. The girl watches you go, one bare foot tucked up in the straw.",
    ],
    next: [{ id: "ok", label: "Back to the den", to: "@hub" }],
  },
  "den-hyenas": {
    id: "den-hyenas",
    kind: "battle",
    encounterId: "kennel-hyenas",
    mapId: "ruins",
    intro: [
      "Three giant hyenas and three grey wolves the size of ponies lunge to the ends of their chains at the sight of you. The {ashfang} raider who keeps them yanks the pins and runs. The pack comes loose in a scrabble of claws and yelping.",
    ],
    again: [
      "The hyenas and the grey wolves are loose in the kennels now. Their keeper is long gone, and they come for you at once.",
    ],
    onWin: {
      to: "@hub",
      text: [
        "The kennel falls quiet. In the straw you find a raider's stashed purse and a satchel worth the trouble. By the gate lies the key ring their keeper dropped as he ran. One key fits the plunder tent.",
      ],
      effects: [
        { kind: "setFlag", flag: "kennel-cleared" },
        { kind: "gold", amount: 30 },
        { kind: "addItem", itemId: "potion-healing", qty: 1 },
      ],
    },
    parley: {
      skill: "animal-handling",
      dc: 12,
      label: "Throw them the meat off the cook fire",
      refused: ["The pack goes for the meat and then for you, in that order, and not for long in the first."],
      success: {
        to: "@hub",
        text: [
          "The pack falls on the meat, snarling at each other instead of you, and you step round them to the gate. Their keeper dropped his key ring as he ran. One key fits the plunder tent.",
        ],
        effects: [
          { kind: "setFlag", flag: "kennel-cleared" },
          { kind: "xp", amount: avoidedFightXP("kennel-hyenas") },
        ],
      },
    },
  },
  "den-cache": {
    id: "den-cache",
    kind: "check",
    skill: "investigation",
    dc: 12,
    art: { emoji: "📦" },
    intro: ["A tent of stolen goods, heaped anyhow. A careful search turns up the best of it."],
    success: {
      to: "@hub",
      text: [
        "Beneath the junk you find real coin and a caravan's lost potion. Stuffed in a sack at the bottom is the **{ashfang} banner** itself. The reeve will pay extra for that.",
      ],
      effects: [
        { kind: "gold", amount: 80 },
        { kind: "addItem", itemId: "potion-greater-healing", qty: 1 },
        { kind: "setFlag", flag: "looted" },
      ],
    },
    failure: {
      to: "@hub",
      text: ["You grab what's in reach before the noise draws eyes."],
      effects: [{ kind: "gold", amount: 25 }],
    },
  },
  "vex-parley": {
    id: "vex-parley",
    kind: "dialogue",
    noBack: true,
    npc: LIEUTENANT,
    art: { emoji: "🗡️" },
    lines: [
      "At the lone fire a lean, grey-templed raider watches you come. A bare blade lies across his knees. He holds it as if he would rather be leaning on it.",
      "\"**{vex}**,\" he says. \"The chief's lieutenant, for my sins. He keeps an ogre in a pit for people like you. For me he keeps a knife he thinks I haven't seen.\" A thin smile, gone as fast. \"So what do you offer a man for stepping aside?\"",
      {
        if: [{ kind: "notFlag", flag: "pens-found" }, { kind: "notFlag", flag: "captives-taken" }],
        text: "Before you can answer, he tips his head back toward the kennels. \"One thing for nothing. There's a pen behind the dogs, with people in it. A carter and a little girl, among others. The chief keeps them for the lady in the water.\" He looks into his fire. \"I never had the stomach to open it. You might. But do it before you go through to the chief. Once you're in that hall, don't count on walking back past the kennels.\"",
      },
      {
        if: [{ kind: "notFlag", flag: "pens-found" }, { kind: "flag", flag: "captives-taken" }],
        text: "Before you can answer, he tips his head back toward the kennels. \"There was a pen behind the dogs, with people in it. The lady in the water came for them when the moon went dark.\" He looks into his fire. \"Go and look, if you want to know what the chief sold.\"",
      },
      {
        if: [{ kind: "flag", flag: "den-alarm" }],
        text: "\"Not tonight, though.\" He doesn't take his eyes off the fire. \"The whole den knows you're here. Every one of them is up and looking for you, and I'm not turning my coat in front of all of them.\"",
      },
    ],
    next: [...[VEX_OFFERS(true)].flat(), ...[VEX_OFFERS(false)].flat()],
  },
  "vex-turned": {
    id: "vex-turned",
    kind: "story",
    noBack: true,
    art: { emoji: "🤝" },
    text: [
      {
        if: [{ kind: "notFlag", flag: "vex-threatened" }],
        text: "{vex} weighs it, then slides the blade home. \"A road out of this valley, then. I'll take it before the reeve's men take it from me.\"",
      },
      {
        if: [{ kind: "flag", flag: "vex-threatened" }],
        text: "{vex} looks along your drawn blades, one by one, then slides his own home. \"Not much of a choice, put like that. I'll take the road out of this valley, while I still have the legs for it.\"",
      },
      "\"{hask} guards the chief, and {hask} answers to me. He'll find somewhere else to be — this once.\" He steps back into the smoke, unhurried. \"Do it properly. I'm tired of soldiering for a man who burns barns and calls it strategy.\"",
    ],
    next: [
      {
        id: "ok",
        label: "Go and face the chief",
        to: "@hub",
        effects: [
          { kind: "npc", npc: "vex", met: true, fate: "turned" },
          { kind: "xp", amount: avoidedFightXP("ashfang-hall") - avoidedFightXP("ashfang-warlord-alone") },
          {
            kind: "journal",
            entry: {
              id: "n-vex",
              kind: "npc",
              title: "{vex}, Turned",
              body: "{vex} the lieutenant has turned on the chief, and means to take the road out of the valley. {hask}, the chief's guard, answers to {vex}. He will stand aside when you face the chief, this once. After that, {vex} means to be gone.",
            },
          },
        ],
      },
    ],
  },
  "vex-refuses": {
    id: "vex-refuses",
    kind: "story",
    noBack: true,
    art: { emoji: "💢" },
    text: [
      "{vex} studies you a long moment, then shakes his head, almost sorry about it. \"No. You'd hang me the morning after, and we both know it.\"",
      "\"Pity. I'd have liked to see the far end of this valley.\" He melts back into the dark, toward the ridge above the den.",
    ],
    next: [
      {
        id: "ok",
        label: "Leave him to the dark",
        to: "@hub",
        effects: [{ kind: "npc", npc: "vex", met: true }],
      },
    ],
  },
  "vex-dismissed": {
    id: "vex-dismissed",
    kind: "story",
    noBack: true,
    art: { emoji: "🗡️" },
    text: [
      "\"Suit yourself.\" {vex} turns back to his fire. \"I won't help you. I won't get in your way, either.\"",
    ],
    next: [
      {
        id: "ok",
        label: "Leave him to his fire",
        to: "@hub",
        effects: [{ kind: "npc", npc: "vex", met: true }, { kind: "setFlag", flag: "vex-rebuffed" }],
      },
    ],
  },
  "vargan-unread": {
    id: "vargan-unread",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-throne", emoji: "👑" },
    assumes: [{ kind: "notFlag", flag: "vargan-shaken" }],
    text: [
      "His axe hand stays wrapped in its rag, and his face gives you nothing at all. Behind the throne the hag watches you look, and smiles.",
    ],
    next: [
      ...[turnUnread([])].flat(),
      {
        id: "fight",
        label: "End them both",
        to: "boss",
        hideWhenBlocked: true,
        requires: [{ kind: "npc", npc: "vex", notFate: ["turned"] }],
      },
      {
        id: "fight-alone",
        label: "End them both",
        to: "boss-unguarded",
        hideWhenBlocked: true,
        requires: [{ kind: "npc", npc: "vex", fate: "turned" }],
      },
    ],
  },
  "boss-approach": {
    id: "boss-approach",
    kind: "story",
    art: { imageId: "loc-throne", emoji: "👑" },
    text: [
      "The chief's hall reeks of smoke and old blood. Trophies of a hundred raids hang from the rafters: a miller's ledger, a carter's whip, and a child's left shoe, small and still muddy.",
      "The **{ashfang} chief** sits on a throne of lashed spears, a rag wound round his axe hand. In the shadows behind the throne something else unfolds — long and green and grinning, river-weed in its hair, fingers too many and too long. The **{reedwife}**, come up out of her water to see what her coin has bought.",
      "\"Up, **{vargan}**, my sweet,\" the hag says. \"Guests.\" The chief rises.",
      "\"I was born down in {thornwick},\" {vargan} says. \"I cut reeds on that marsh for a copper a bundle, same as my father. The spring I was a boy, she raised the water, and my mother's house went under first. {thornwick} watched from the bank.\" He looks up at his trophies the way a farmer looks at a full barn. \"The shallows were still common water. So this spring I came home and sold them to her. She paid me in monsters, and a valley to run. Fair price.\"",
      "The hag laughs. \"Fairer than the fen ever paid me. One {door-price} a winter, for sitting by their door in the dark.\" She turns to you, delighted. \"You've been *busy*.\" At a flick of her hand, she calls for the chief's guard. The whole hall waits to see what you'll do.",
    ],
    again: [
      "The chief's hall still reeks of smoke and old blood, and the child's shoe still hangs from the rafters.",
      "**{vargan}** is back on his throne of spears, and the **{reedwife}** waits in the shadows behind it. \"Back for more,\" the hag says, delighted. \"Waste not.\" {vargan} only rolls the great axe off his shoulder.",
      {
        if: [{ kind: "flag", flag: "vargan-shaken" }],
        text: "He keeps his branded hand shut in a fist. His eyes keep going back to it.",
      },
      {
        if: [{ kind: "flag", flag: "den-alarm" }],
        text: "The hall is full of raiders who heard you coming, and none of them is sitting down.",
      },
    ],
    next: [
      {
        id: "insight",
        label: "[Insight DC 14] Look at his hands",
        to: "vargan-brand",
        hideWhenBlocked: true,
        attempt: "brand",
        requires: [{ kind: "npc", npc: "vex", notFate: ["turned"] }],
        effects: [{ kind: "setFlag", flag: "vargan-shaken" }],
        check: {
          skill: "insight",
          dc: 14,
          failTo: "vargan-unread",
          failEffects: [{ kind: "clearFlag", flag: "vargan-shaken" }],
        },
      },
      {
        id: "insight-alone",
        label: "[Insight DC 14] Look at his hands",
        to: "vargan-brand-alone",
        hideWhenBlocked: true,
        attempt: "brand",
        requires: [{ kind: "npc", npc: "vex", fate: "turned" }],
        effects: [{ kind: "setFlag", flag: "vargan-shaken" }],
        check: {
          skill: "insight",
          dc: 14,
          failTo: "vargan-unread",
          failEffects: [{ kind: "clearFlag", flag: "vargan-shaken" }],
        },
      },
      {
        id: "pact",
        label: "[Warlock · Arcana DC 11] Name the bargain burned into his hand",
        to: "vargan-brand",
        hideWhenBlocked: true,
        attempt: "brand",
        requires: [{ kind: "classInParty", classId: "warlock" }, { kind: "npc", npc: "vex", notFate: ["turned"] }],
        effects: [{ kind: "setFlag", flag: "vargan-shaken" }],
        check: {
          skill: "arcana",
          dc: 11,
          failTo: "vargan-unread",
          failEffects: [{ kind: "clearFlag", flag: "vargan-shaken" }],
        },
      },
      {
        id: "pact-alone",
        label: "[Warlock · Arcana DC 11] Name the bargain burned into his hand",
        to: "vargan-brand-alone",
        hideWhenBlocked: true,
        attempt: "brand",
        requires: [{ kind: "classInParty", classId: "warlock" }, { kind: "npc", npc: "vex", fate: "turned" }],
        effects: [{ kind: "setFlag", flag: "vargan-shaken" }],
        check: {
          skill: "arcana",
          dc: 11,
          failTo: "vargan-unread",
          failEffects: [{ kind: "clearFlag", flag: "vargan-shaken" }],
        },
      },
      ...[turnUnread([{ kind: 'notFlag', flag: 'vargan-shaken' }])].flat(),
      {
        id: "turn-carter",
        label: "[Persuasion DC 10] \"The carter's girl is home. Your mother's house is still under the water.\"",
        to: "vargan-turns",
        hideWhenBlocked: true,
        attempt: "turn",
        requires: [
          { kind: "flag", flag: "pens-settled" },
          { kind: "notFlag", flag: "captives-taken" },
          { kind: "npc", npc: "vex", notFate: ["turned"] },
          { kind: "notFlag", flag: "vargan-shaken" },
        ],
        check: { skill: "persuasion", dc: 10, failTo: "boss" },
      },
      {
        id: "turn-carter-alone",
        label: "[Persuasion DC 10] \"The carter's girl is home. Your mother's house is still under the water.\"",
        to: "vargan-turns-alone",
        hideWhenBlocked: true,
        attempt: "turn",
        requires: [
          { kind: "flag", flag: "pens-settled" },
          { kind: "notFlag", flag: "captives-taken" },
          { kind: "npc", npc: "vex", fate: "turned" },
          { kind: "notFlag", flag: "vargan-shaken" },
        ],
        check: { skill: "persuasion", dc: 10, failTo: "boss-unguarded" },
      },
      {
        id: "turn-shaken",
        label: "[Persuasion DC 10] \"She owns you too. Help us end her.\"",
        to: "vargan-turns",
        hideWhenBlocked: true,
        attempt: "turn",
        requires: [{ kind: "npc", npc: "vex", notFate: ["turned"] }, { kind: "flag", flag: "vargan-shaken" }],
        check: { skill: "persuasion", dc: 10, failTo: "boss-shaken" },
      },
      {
        id: "turn-shaken-alone",
        label: "[Persuasion DC 10] \"She owns you too. Help us end her.\"",
        to: "vargan-turns-alone",
        hideWhenBlocked: true,
        attempt: "turn",
        requires: [{ kind: "npc", npc: "vex", fate: "turned" }, { kind: "flag", flag: "vargan-shaken" }],
        check: { skill: "persuasion", dc: 10, failTo: "boss-unguarded-shaken" },
      },
      {
        id: "fight-alone",
        label: "End them both",
        to: "boss-unguarded",
        hideWhenBlocked: true,
        requires: [{ kind: "npc", npc: "vex", fate: "turned" }, { kind: "notFlag", flag: "vargan-shaken" }],
      },
      {
        id: "fight-alone-shaken",
        label: "End them both",
        to: "boss-unguarded-shaken",
        hideWhenBlocked: true,
        requires: [{ kind: "npc", npc: "vex", fate: "turned" }, { kind: "flag", flag: "vargan-shaken" }],
      },
      {
        id: "fight",
        label: "End them both",
        to: "boss",
        hideWhenBlocked: true,
        requires: [{ kind: "npc", npc: "vex", notFate: ["turned"] }, { kind: "notFlag", flag: "vargan-shaken" }],
      },
      {
        id: "fight-shaken",
        label: "End them both",
        to: "boss-shaken",
        hideWhenBlocked: true,
        requires: [{ kind: "npc", npc: "vex", notFate: ["turned"] }, { kind: "flag", flag: "vargan-shaken" }],
      },
    ],
  },
  "boss": {
    id: "boss",
    kind: "battle",
    encounterId: "ashfang-hall",
    mapId: "firepit",
    loot: { bonusTier: "rare" },
    intro: [
      "\"You've cost me a good season,\" the chief says, almost mild, and rolls the great axe off his shoulder. Beside him the hag only laughs, low and pleased, her fingers already weaving something cold out of the smoke. \"Oh, don't kill them quickly,\" she tells him. \"Waste not.\"",
      "The chief's guard answers her call from the door. He is a grey, scarred soldier, and the only one in the hall who looks as if he has done this before. He comes for you without a word, and a raider with a knife comes in at his back.",
    ],
    again: [
      "The hag's fingers are already weaving something cold out of the smoke. \"Don't kill them quickly this time,\" she tells the chief. His grey old guard is back at his shoulder, and the raider with the knife behind him.",
    ],
    onWin: {
      to: "vargan-beaten",
      text: [
        "The chief's axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging. By the door the chief's grey old guard is down, and the raider who stood with him lies across the threshold.",
        ...[BOSS_HOARD].flat(),
      ],
      effects: [...[BOSS_WON].flat()],
    },
  },
  "boss-shaken": {
    id: "boss-shaken",
    kind: "battle",
    encounterId: "ashfang-hall",
    mapId: "firepit",
    surprise: "enemies",
    loot: { bonusTier: "rare" },
    intro: [
      {
        assumes: [{ kind: "flag", flag: "vargan-shaken" }],
        text: "{vargan} closes his fist over the brand and looks at it a moment too long, and the hag does not tell him to stop. By then you are already moving.",
      },
      "By the door, the chief's guard is still reaching for his weapon. He is a grey and scarred old soldier. The raider beside him is still fumbling for his knife.",
    ],
    again: [
      {
        assumes: [{ kind: "flag", flag: "vargan-shaken" }],
        text: "{vargan}'s eyes go to his shut fist again, and the hag lets them. By then you are already moving.",
      },
    ],
    onWin: {
      to: "vargan-beaten",
      text: [
        "{vargan} fights with one eye on his own shut fist. The chief's axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging. By the door the chief's grey old guard is down, and the raider who stood with him lies across the threshold.",
        ...[BOSS_HOARD].flat(),
      ],
      effects: [...[BOSS_WON].flat()],
    },
  },
  "boss-unguarded": {
    id: "boss-unguarded",
    kind: "battle",
    encounterId: "ashfang-warlord-alone",
    mapId: "firepit",
    loot: { bonusTier: "rare" },
    intro: [
      {
        assumes: [{ kind: "npc", npc: "vex", fate: "turned" }],
        text: "The chief bellows for {hask}, his guard. {hask} stands by the door with his spear grounded. He looks at the chief, then at you, and steps aside to let you pass before he walks out into the smoke. {vex} has kept his word.",
      },
      "\"You've cost me a good season,\" {vargan} says anyway, almost mild, and rolls the great axe off his shoulder. The hag goes quiet. Her eyes flick to the doorway, counting the blades that didn't come.",
      "She whistles, low and wet. One raider comes in from the yard, white-faced. Behind him something long and heavy pours over the threshold out of the night. It is a marsh snake as thick as a man's waist, with reeds and a reaching hand branded into its scales.",
    ],
    again: [
      {
        assumes: [{ kind: "npc", npc: "vex", fate: "turned" }],
        text: "{hask} is nowhere in the hall. {vex}'s word still holds.",
      },
      "{vargan} rolls the great axe off his shoulder again. The hag whistles, and her branded snake pours over the threshold once more, with the one raider who stayed.",
    ],
    onWin: {
      to: "vargan-beaten",
      text: [
        "The chief's axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging. Across the threshold her branded snake lies dead in its own coils, and the one raider who stayed lies beside it.",
        ...[BOSS_HOARD].flat(),
      ],
      effects: [...[BOSS_WON].flat()],
    },
  },
  "boss-unguarded-shaken": {
    id: "boss-unguarded-shaken",
    kind: "battle",
    encounterId: "ashfang-warlord-alone",
    mapId: "firepit",
    surprise: "enemies",
    loot: { bonusTier: "rare" },
    intro: [
      {
        assumes: [{ kind: "npc", npc: "vex", fate: "turned" }, { kind: "flag", flag: "vargan-shaken" }],
        text: "{vargan} closes his fist over the brand and bellows for {hask}. By the door, {hask} grounds his spear, steps aside to let you pass, and walks out into the smoke.",
      },
      "\"Waste not,\" the hag hisses, and whistles. One raider comes in from the yard. Behind him a marsh snake as thick as a man's waist pours over the threshold, with reeds and a reaching hand branded into its scales. By then you are already moving.",
    ],
    again: [
      {
        assumes: [{ kind: "npc", npc: "vex", fate: "turned" }, { kind: "flag", flag: "vargan-shaken" }],
        text: "{hask} is still gone, and {vargan} still keeps his branded hand shut in a fist.",
      },
      "\"Waste not,\" the hag hisses, and her branded snake pours over the threshold again with the one raider who stayed. By then you are already moving.",
    ],
    onWin: {
      to: "vargan-beaten",
      text: [
        "{vargan} fights with one eye on his own shut fist. The chief's axe goes spinning out of his hand, and the **{reedwife}** screams. She goes down full length on the earth floor, and the scream stops. She lies there long and green and still, and the river-weed in her hair begins to dry and crack. Up in the rafters, the trophies of a hundred raids stop swinging. Across the threshold her branded snake lies dead in its own coils, and the one raider who stayed lies beside it.",
        ...[BOSS_HOARD].flat(),
      ],
      effects: [...[BOSS_WON].flat()],
    },
  },
  "vargan-brand": {
    id: "vargan-brand",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-throne", emoji: "✋" },
    text: [...[VARGAN_BRAND].flat()],
    next: [
      {
        id: "turn",
        label: "[Persuasion DC 10] \"She owns you too. Help us end her.\"",
        to: "vargan-turns",
        attempt: "turn",
        check: { skill: "persuasion", dc: 10, failTo: "boss-shaken" },
      },
      { id: "strike", label: "Strike while he stares", to: "boss-shaken" },
    ],
  },
  "vargan-brand-alone": {
    id: "vargan-brand-alone",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-throne", emoji: "✋" },
    text: [...[VARGAN_BRAND].flat()],
    next: [
      {
        id: "turn",
        label: "[Persuasion DC 10] \"She owns you too. Help us end her.\"",
        to: "vargan-turns-alone",
        attempt: "turn",
        check: { skill: "persuasion", dc: 10, failTo: "boss-unguarded-shaken" },
      },
      { id: "strike", label: "Strike while he stares", to: "boss-unguarded-shaken" },
    ],
  },
  "vargan-turns": {
    id: "vargan-turns",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-throne", emoji: "✋" },
    text: [
      ...[VARGAN_TURNS].flat(),
      "The hag looks down at him a moment, and when she looks up she is smiling.",
    ],
    next: [
      { id: "fight", label: "Face the {reedwife}", to: "reedwife-fight" },
      ...[BIND_HAG_RITE_CHOICE('bind-hag-rite')].flat(),
    ],
  },
  "vargan-turns-alone": {
    id: "vargan-turns-alone",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-throne", emoji: "✋" },
    text: [
      ...[VARGAN_TURNS].flat(),
      "The hag looks down at him a moment, and when she looks up she is smiling.",
    ],
    next: [
      { id: "fight", label: "Face the {reedwife}", to: "reedwife-fight-alone" },
      ...[BIND_HAG_RITE_CHOICE('bind-hag-rite-alone')].flat(),
    ],
  },
  "bind-hag-rite": BIND_HAG_RITE('bind-hag-rite', 'hag-guarded', 'reedwife-fight', 'At the door she whistles for the chief\'s guard. He comes out of the smoke at her call with four raiders at his back. He watches her go, and then walks out into the smoke after her, and his raiders go with him.'),
  "bind-hag-rite-alone": BIND_HAG_RITE('bind-hag-rite-alone', 'hag-whistled', 'reedwife-fight-alone', 'At the door she whistles for {hask}, and he does not come. Two raiders stumble in from the yard. Behind them something long and heavy slides over the threshold. It is a marsh snake as thick as a man\'s waist, with reeds and a reaching hand branded into its scales. The raiders watch her go, and then run too. The snake pours out after her into the dark.'),
  "reedwife-fight": {
    id: "reedwife-fight",
    kind: "battle",
    encounterId: "hag-guarded",
    mapId: "firepit",
    noFlee: true,
    loot: { bonusTier: "rare" },
    parley: BIND_HAG('hag-guarded', 'The chief\'s guard watches her go, and then walks out into the smoke after her. His four raiders go with him.'),
    intro: [
      "The **{reedwife}** stands by the fire-pit with marsh water dripping from her fingers. \"Waste not,\" she says, and whistles for the chief's guard again. He comes out of the smoke at last, with four raiders at his back: three orcs and an archer.",
    ],
    again: [
      "The {reedwife} is still by the fire-pit. \"Up again, sweetlings?\" She whistles, and the chief's guard comes back out of the smoke with his four raiders.",
    ],
    onWin: {
      to: "vargan-fate",
      text: [
        "The **{reedwife}** staggers back into the fire-pit and goes down hissing among the coals. When the steam clears she is still lying there, and she does not get up. The smell of her, rotten water and burning weed, hangs in the hall for a long time. The four raiders lie where they fell, and the chief's grey old guard is down among them.",
        ...[REEDWIFE_HOARD].flat(),
      ],
      effects: [...[BOSS_WON].flat()],
    },
    onLoss: { to: "reedwife-lost" },
  },
  "reedwife-fight-alone": {
    id: "reedwife-fight-alone",
    kind: "battle",
    encounterId: "hag-whistled",
    mapId: "firepit",
    noFlee: true,
    loot: { bonusTier: "rare" },
    parley: BIND_HAG('hag-whistled', 'Her two raiders watch her go, and then they run too. The snake pours out after her into the dark.'),
    intro: [
      "The **{reedwife}** stands by the fire-pit with marsh water dripping from her fingers. \"Waste not,\" she says, and whistles for the chief's guard again. {hask} still does not come. Two raiders come in from the yard instead, an orc and an archer. Behind them something long and heavy pours over the threshold out of the night. It is a marsh snake as thick as a man's waist, with reeds and a reaching hand branded into its scales.",
    ],
    again: [
      "The {reedwife} is still by the fire-pit. She whistles for {hask} once more, and he still does not come. Her two raiders come in from the yard again, and her branded snake pours over the threshold behind them.",
    ],
    onWin: {
      to: "vargan-fate",
      text: [
        "The **{reedwife}** staggers back into the fire-pit and goes down hissing among the coals. When the steam clears she is still lying there, and she does not get up. The smell of her, rotten water and burning weed, hangs in the hall for a long time. Across the threshold her branded snake lies dead in its own coils, and her two raiders lie beside it.",
        ...[REEDWIFE_HOARD].flat(),
      ],
      effects: [...[BOSS_WON].flat()],
    },
    onLoss: { to: "reedwife-lost-alone" },
  },
  "reedwife-lost": {
    id: "reedwife-lost",
    kind: "rest",
    variant: "long",
    sameDay: true,
    next: "reedwife-fight",
    intro: [...[REEDWIFE_LOST].flat()],
  },
  "reedwife-lost-alone": {
    id: "reedwife-lost-alone",
    kind: "rest",
    variant: "long",
    sameDay: true,
    next: "reedwife-fight-alone",
    intro: [...[REEDWIFE_LOST].flat()],
  },
  "vargan-beaten": {
    id: "vargan-beaten",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-throne", emoji: "⚖️" },
    text: [
      "{vargan} is down on one knee in the ashes of the fire-pit, and his axe lies out of his reach. He is still breathing.",
      {
        if: [{ kind: "flag", flag: "vargan-shaken" }],
        text: "The brand on his hand has gone grey, like an old scar. He looks at it, and not at you.",
      },
      {
        if: [{ kind: "notFlag", flag: "vargan-shaken" }],
        text: "The rag has burned off his axe hand. Under it is a brand of reeds and a reaching hand, the mark the lizardfolk wore, gone grey like an old scar.",
      },
      "\"Go on, then,\" he says. \"{thornwick} will only hang me slower.\"",
    ],
    next: [
      ...[BIND_VARGAN].flat(),
      ...[FREE_VARGAN('Let him crawl out into the marsh')].flat(),
      ...[END_VARGAN].flat(),
    ],
  },
  "vargan-fate": {
    id: "vargan-fate",
    kind: "story",
    noBack: true,
    art: { imageId: "loc-throne", emoji: "⚖️" },
    text: [
      "{vargan} sits against his throne of spears. The brand on his hand has gone grey, like an old scar. He does not reach for his axe.",
      "\"{thornwick} will want me hanged,\" he says. \"{thornwick} is right. I sold her their common water, and I called it a fair price.\" He looks at the trophies in the rafters. \"Do what you came to do.\"",
      {
        if: [{ kind: "classInParty", classId: "cleric" }],
        text: "Your cleric kneels beside him and studies the grey brand. There is no prayer for this, and {vargan} does not ask for one.",
      },
    ],
    next: [
      ...[BIND_VARGAN].flat(),
      ...[FREE_VARGAN('Let him walk out into the marsh')].flat(),
      ...[END_VARGAN].flat(),
    ],
  },
  "aftermath": {
    id: "aftermath",
    kind: "story",
    art: { imageId: "loc-village", emoji: "🏘️" },
    noBack: true,
    text: [
      "You come back down the marsh road into a {thornwick} with every shutter in it thrown open. Word runs ahead of you; by the time you reach the square, the square is full.",
      {
        if: [{ kind: "npc", npc: "vargan", fate: "spared" }, { kind: "notFlag", flag: "vargan-let-go" }],
        text: "{vargan} walks in front of you with his hands tied, and the crowd goes quiet to let him through. An old reed-cutter spits at his feet. {vargan} does not look up from the road.",
      },
      {
        if: [{ kind: "notFlag", flag: "vargan-let-go" }],
        text: "The reeve is there too — stiff-backed, unsmiling, a strongbox under one arm. He does not thank you. He sets the strongbox on the well and opens it. \"{thornwick} keeps its word,\" he says, as though daring you to make something of it.",
      },
      {
        if: [{ kind: "flag", flag: "vargan-let-go" }],
        text: "The reeve is there too — stiff-backed, unsmiling, a strongbox under one arm. He sets it down on the well, and keeps his hand on the lid.",
      },
      {
        if: [{ kind: "flag", flag: "vargan-let-go" }],
        text: "The reeve looks past you, up the marsh road, for the prisoner who isn't there. \"You let him *walk*?\" His face goes red, then white. \"{thornwick} pays for a chief it can see. Not for one you turned loose in my marsh.\"",
      },
      {
        if: [{ kind: "flag", flag: "vargan-let-go" }, { kind: "flag", flag: "bounty" }],
        text: "He holds out his hand for the retainer you drew at the board. He does not lower it until the coin, or what is left of it, is back in the strongbox. \"{thornwick} pays its debts,\" he says. \"So will you.\"",
      },
      {
        if: [{ kind: "npc", npc: "vargan", notFate: ["dead"] }, { kind: "flag", flag: "captives-freed" }],
        text: "Behind him, {mira} catches your eye and very nearly smiles.",
      },
      {
        if: [
          { kind: "npc", npc: "vargan", notFate: ["dead"] },
          { kind: "notFlag", flag: "captives-freed" },
          { kind: "npc", npc: "wren", fate: "saved" },
        ],
        text: "Behind him, {mira} catches your eye and very nearly smiles.",
      },
      {
        if: [
          { kind: "npc", npc: "vargan", notFate: ["dead"] },
          { kind: "notFlag", flag: "captives-freed" },
          { kind: "npc", npc: "wren", notFate: ["saved"] },
          { kind: "flag", flag: "mill-saved" },
        ],
        text: "Behind him, {mira} catches your eye and very nearly smiles.",
      },
      {
        if: [{ kind: "npc", npc: "vargan", notFate: ["dead"] }, ...[MIRA_COOL].flat()],
        text: "Behind him, {mira} watches from the inn door, wiping her hands on her apron.",
      },
      {
        if: [{ kind: "npc", npc: "vargan", fate: "dead" }],
        text: "Someone asks how the chief died, and you tell them: on his knees in his own hall, with the fight already over. The square goes quiet. Behind the reeve, {mira} looks at you, says nothing, and turns away.",
      },
    ],
    next: [...[AFTERMATH_CLAIMS].flat()],
  },
  "aftermath-hub": {
    id: "aftermath-hub",
    kind: "story",
    art: { imageId: "loc-village", emoji: "🏘️" },
    noBack: true,
    text: [
      "The crowd presses in around the well, where the reeve's strongbox stands.",
      {
        if: [{ kind: "flag", flag: "got-bounty" }, { kind: "notFlag", flag: "vargan-let-go" }],
        text: "The reeve has closed his ledger, and stands with his arms folded in case anyone else has a claim.",
      },
      {
        if: [{ kind: "flag", flag: "got-banner" }],
        text: "Someone has hung the {ashfang} banner from the well-rope, and the children are taking turns to throw mud at it.",
      },
      {
        if: [{ kind: "flag", flag: "got-scout" }],
        text: "{wren} has found a barrel to sit on, her crutch propped beside her. She is pretending not to watch you.",
      },
    ],
    next: [...[AFTERMATH_CLAIMS].flat()],
  },
  "claim-bounty": {
    id: "claim-bounty",
    kind: "story",
    art: { imageId: "loc-village", emoji: "💰" },
    noBack: true,
    text: ["The reeve counts out {bounty-full}, coin by coin, as if each one hurts. \"Paid in full.\""],
    next: [{ id: "ok", label: "Sweep it into your pack", to: "aftermath-hub" }],
  },
  "claim-balance": {
    id: "claim-balance",
    kind: "story",
    art: { imageId: "loc-village", emoji: "💰" },
    assumes: [{ kind: "flag", flag: "bounty" }],
    noBack: true,
    text: [
      "The reeve checks his ledger, takes off the {bounty-retainer} you drew at the board, and counts out {bounty-balance}. \"Paid in full.\"",
    ],
    next: [{ id: "ok", label: "Sweep it into your pack", to: "aftermath-hub" }],
  },
  "claim-banner": {
    id: "claim-banner",
    kind: "story",
    art: { imageId: "loc-village", emoji: "🚩" },
    assumes: [{ kind: "flag", flag: "looted" }],
    noBack: true,
    text: [
      "You unroll the {ashfang} banner across the well for the crowd to see, and the cheer goes on for some time. The reeve adds {bounty-banner} to your pile without a word.",
    ],
    next: [{ id: "ok", label: "Let them cheer", to: "aftermath-hub" }],
  },
  "claim-scout": {
    id: "claim-scout",
    kind: "story",
    art: { imageId: "loc-village", emoji: "🏹" },
    assumes: [{ kind: "npc", npc: "wren", fate: "saved" }, { kind: "noCompanion", companion: "wren" }],
    noBack: true,
    text: [
      "{wren} pushes through the crowd on a crutch and hands you the reeve's purse of {scout-reward}, and then she just stands there.",
      {
        if: [{ kind: "npc", npc: "wren", attitude: { atLeast: 0 } }],
        text: "\"You came back,\" she says at last, and goes red to the ears.",
      },
      {
        if: [{ kind: "npc", npc: "wren", attitude: { below: 0 } }],
        text: "\"You came back,\" she says at last, and looks at you a moment longer, as if she is still making up her mind about it.",
      },
    ],
    next: [{ id: "ok", label: "\"So did you.\"", to: "aftermath-hub" }],
  },
  "defeat": {
    id: "defeat",
    kind: "story",
    art: { imageId: "loc-tavern", emoji: "🍺" },
    noBack: true,
    text: [
      "You wake to lamplight and the crackle of {mira}'s hearth. The last thing you remember is the ground coming up to meet you.",
      {
        if: [{ kind: "at", hub: "square/city" }],
        text: "The reeve's men carried you in, she tells you, and then stood about in her taproom until she fed them.",
      },
      {
        if: [{ kind: "at", hub: "trail/delve" }],
        text: "A reed-cutter found you face-down in the reeds and poled you home on his raft. He would not take a copper for it.",
      },
      {
        if: [{ kind: "at", hub: "inner/delve" }],
        text: "She does not know who carried you out of the den. At first light she found you on her step, laid side by side, with your weapons at your feet.",
      },
      {
        assumes: [{ kind: "npc", npc: "vargan", notFate: ["dead"] }],
        text: "\"Easy, now.\" {mira} puts a mug of something hot and bitter into your hands. \"You slept the day round. The {ashfang} are still out there, but you're no use to {thornwick} dead. Drink that. Then go and finish them.\"",
      },
    ],
    again: [
      "You wake on {mira}'s cot again, under the same crack in the ceiling, aching in all the same places.",
      {
        assumes: [{ kind: "npc", npc: "vargan", notFate: ["dead"] }],
        text: "\"Same cot, same mug,\" {mira} says, and sets it down. \"Try to need it less.\"",
      },
    ],
    next: [
      { id: "up", label: "Get back on your feet", to: "square/city", effects: [{ kind: "passDay" }] },
      {
        id: "back",
        label: "Go straight back out on the marsh road",
        to: "trail",
        hideWhenBlocked: true,
        effects: [{ kind: "passDay" }],
        requires: [{ kind: "visited", scene: "trail" }],
      },
      {
        id: "den",
        label: "Go straight back into the den",
        to: "inner",
        hideWhenBlocked: true,
        effects: [{ kind: "passDay" }],
        requires: [{ kind: "at", hub: "inner/delve" }, { kind: "flag", flag: "den-entered" }],
      },
    ],
  },
  "epilogue": {
    id: "epilogue",
    kind: "ending",
    outcome: "victory",
    art: { emoji: "🏆" },
    slides: [
      {
        thread: "vargan",
        cases: [
          {
            if: [{ kind: "npc", npc: "vargan", fate: "dead" }, { kind: "flag", flag: "vargan-shaken" }],
            text: "Round the bonfire they tell it in low voices: the {ashfang} chief wore the hag's brand too, and he knelt in his own hall knowing it. The reed-cutters bury him at the edge of the shallows he sold, and leave the grave unmarked.",
          },
          {
            if: [{ kind: "npc", npc: "vargan", fate: "dead" }],
            text: "The reed-cutters bury {vargan} at the edge of the shallows he sold. They leave the grave unmarked, and no one asks where it is.",
          },
          {
            if: [{ kind: "flag", flag: "vargan-let-go" }],
            text: "The reeve keeps his bounty, and says so loudly. Before the month is out, a man with a scarred hand is cutting reeds in the shallows below the water-meadows. The reeve watches him from his window, and does not send the watch.",
          },
          {
            if: [{ kind: "npc", npc: "vargan", fate: "spared" }],
            text: "The reeve does not hang {vargan}. He sends him out to cut reeds on the common land until the drowned houses stand again. {vargan} has not missed a day.",
          },
        ],
      },
      {
        thread: "vex",
        cases: [
          {
            if: [{ kind: "npc", npc: "vex", fate: "turned" }],
            text: "At the edge of the crowd, a lean, grey-templed man with no rope on his wrists touches two fingers to his brow and is gone.",
          },
          {
            if: [{ kind: "npc", npc: "vex", met: true }, { kind: "flag", flag: "vex-rebuffed" }],
            text: "{vex} sat out the end of it at his own fire, the bare blade across his knees. At dawn he walks down into {thornwick} alone and lays it on the reeve's table. He asks for a cell with a window.",
          },
          {
            if: [{ kind: "npc", npc: "vex", met: true }],
            text: "{vex} watched the end of it from the ridge above the den. At dawn he walks down into {thornwick} alone and gives himself up at the reeve's hall. He asks for a cell with a window.",
          },
        ],
      },
      {
        thread: "wren",
        cases: [
          {
            if: [{ kind: "npc", npc: "wren", fate: "saved" }],
            text: "At dawn {wren} limps out ahead of the reeve's men to round up what's left of the {ashfang}. She makes a list first. The other scout, who lost her horse in the fen and walked home the long way round, helps her write it.",
          },
          {
            if: [{ kind: "npc", npc: "wren", fate: "lost" }, { kind: "flag", flag: "scout-covered" }],
            text: "",
          },
          {
            if: [{ kind: "npc", npc: "wren", fate: "lost" }, { kind: "flag", flag: "scout-walked-past" }],
            text: "The reeve's men find a scout in the reeds off the marsh road, a hundred yards from a dead horse. She had been crawling toward {thornwick}.",
          },
          {
            if: [{ kind: "npc", npc: "wren", fate: "lost" }],
            text: "Out on the marsh road, the reeve's men lift a dead horse off one of their own scouts. She died under it alone, with a healing potion at her belt that she could never reach.",
          },
          {
            if: [{ kind: "flag", flag: "scout-walked-past" }],
            text: "The reeve's men bring a scout in from the marsh road on a door. The other scout, who lost her horse in the fen and walked home the long way round, walks beside it. Whether the one on the door lives, nobody at the bonfire will say.",
          },
          {
            text: "The other scout lost her horse in the fen and walked home the long way round. She leads the reeve's men back down the marsh road. They find her partner still pinned under a dead horse, alive and furious, with every watch-post on the den's wall scratched into the mud.",
          },
        ],
      },
      {
        thread: "mira",
        cases: [
          {
            if: [{ kind: "npc", npc: "vargan", fate: "dead" }],
            text: "{mira} pours your round and sets it down without a word. She does not pour a second. When you leave, she is wiping the same cup she was wiping when you came in.",
          },
          {
            if: [{ kind: "flag", flag: "captives-freed" }],
            text: "{mira} pours the first round on the house, and the second when she thinks you aren't counting. \"Don't go making a habit of saving towns,\" she warns you. \"People come to expect it.\" It is the nearest thing to thanks she keeps in stock, and you both know it.",
          },
          {
            if: [{ kind: "notFlag", flag: "captives-freed" }, { kind: "npc", npc: "wren", fate: "saved" }],
            text: "{mira} pours the first round on the house, and the second when she thinks you aren't counting. \"Don't go making a habit of saving towns,\" she warns you. \"People come to expect it.\" It is the nearest thing to thanks she keeps in stock, and you both know it.",
          },
          {
            if: [
              { kind: "notFlag", flag: "captives-freed" },
              { kind: "npc", npc: "wren", notFate: ["saved"] },
              { kind: "flag", flag: "mill-saved" },
            ],
            text: "{mira} pours the first round on the house, and the second when she thinks you aren't counting. \"Don't go making a habit of saving towns,\" she warns you. \"People come to expect it.\" It is the nearest thing to thanks she keeps in stock, and you both know it.",
          },
          {
            text: "{mira} pours your round and takes your coin for it. \"Town's still standing,\" she allows, and moves off down the bar.",
          },
        ],
      },
      {
        if: [{ kind: "flag", flag: "got-banner" }],
        text: "By the week's end the {ashfang} banner hangs upside down over {mira}'s bar, still spattered with the children's mud.",
      },
      {
        if: [{ kind: "npc", npc: "wren", fate: "lost" }],
        text: "{mira} sets an extra cup at the end of the bar and fills it. The dead scout's partner walked home out of the fen too late to help, and sits beside it all evening. Nobody asks.",
      },
      {
        if: [],
        text: "Up in the hollow, the reeve's men pull down the den's timber wall one post at a time. They leave the posts for the marsh to take.",
      },
      {
        if: [{ kind: "visited", scene: "board" }],
        text: "The bounty notice comes down off the board in the square. Someone tears off the bottom corner first, the line in the prouder hand, and keeps it.",
      },
      {
        if: [{ kind: "npc", npc: "reedwife", fate: "bound" }],
        text: "At {door-midwinter} an old reed-cutter ties a {door-price} to a stake at the water's edge, the way his gran did. In the morning the rope hangs wet and empty, and nothing else is missing.",
      },
      {
        if: [{ kind: "flag", flag: "mill-saved" }],
        text: "Out at the old mill the sails are turning, and someone has tied a ribbon round the stone dog's neck.",
      },
      {
        if: [
          { kind: "npc", npc: "wren", fate: "saved" },
          { kind: "notFlag", flag: "captives-taken" },
          { kind: "flag", flag: "captives-left" },
        ],
        text: "The reeve's men, sent up the marsh road on {wren}'s word, are already in the reeds below the den when it falls. They have the pen open before the fires are out. The carter carries the girl out himself, and she is still wearing her one shoe.",
      },
      {
        if: [
          { kind: "npc", npc: "wren", fate: "saved" },
          { kind: "notFlag", flag: "captives-taken" },
          { kind: "notFlag", flag: "pens-found" },
        ],
        text: "The reeve's men, sent up the marsh road on {wren}'s word, are already in the reeds below the den when it falls. They have the pen open before the fires are out. The carter carries the girl out himself, and she is still wearing her one shoe.",
      },
      {
        if: [{ kind: "flag", flag: "captives-freed" }],
        text: "The carter's girl sits on the edge of the well in a new pair of shoes. She shows them to anyone who stops long enough.",
      },
      {
        if: [
          { kind: "flag", flag: "captives-taken" },
          { kind: "notFlag", flag: "captives-freed" },
          { kind: "notFlag", flag: "captives-left" },
        ],
        text: "Every evening, a widow walks the edge of the marsh and calls a name across the water.",
      },
      {
        if: [{ kind: "flag", flag: "captives-left" }, { kind: "flag", flag: "captives-taken" }],
        text: "The reeve's men reach the pens behind the kennels after the moon has gone dark. They find the chain hanging open, and a child's shoe in the straw.",
      },
      {
        if: [{ kind: "notFlag", flag: "captives-taken" }, { kind: "notFlag", flag: "captives-freed" }],
        text: "The reeve's men reach the pen behind the kennels two days after the den falls. It is empty, and its chain has been cut. The {ashfang} who fled took the carter, the girl and the reed-cutters with them, to sell wherever they could. They are never found.",
      },
    ],
    text: [
      "Bonfires burn in the square tonight. Out past the reeds the marsh has gone still, and the cold has lifted off the water.",
      "By morning the carters are already complaining about the state of the road. {mira} lets them.",
    ],
  },
};
