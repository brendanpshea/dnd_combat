/**
 * Name corpora, one per STYLE, for the Markov generators in
 * src/adventure/names.ts.
 *
 * A style is a culture's sound, not a book's cast. Each list is mostly the
 * historical naming tradition a style's authors themselves drew on — Old
 * English for the Shire and Rohan, Old Norse for the dwarves and the North,
 * Welsh and Finnish for the elves, Latin and medieval French for courts —
 * with a smaller share of invented names in the manner of the novels as
 * anchors. The generator learns how a style SOUNDS; it never hands a source
 * name back (it filters its own corpus, and `FAMOUS` below, out of every
 * result).
 *
 * Mixing styles makes mush, so a place picks one: a town's names all sound
 * like one town.
 */

import { MORE, NEW_STYLES } from './cultures.js';

export type NameStyle =
  | 'elvish' | 'saxon' | 'norse' | 'isles' | 'courtly' | 'alley' | 'hearth'
  | 'gaelic' | 'germanic' | 'slavic' | 'sorcery';
export const NAME_STYLES: NameStyle[] = ['elvish', 'saxon', 'norse', 'isles', 'courtly', 'alley', 'hearth', 'gaelic', 'germanic', 'slavic', 'sorcery'];

export interface StyleCorpus {
  /** What it sounds like, for the preview page. */
  blurb: string;
  male: string[];
  female: string[];
  surname: string[];
  /** Place names: towns, rivers, halls. */
  place: string[];
}

const BASE: Record<Exclude<NameStyle, keyof typeof NEW_STYLES>, StyleCorpus> = {
  // Welsh, Finnish and invented-elvish: long vowels, liquid consonants.
  elvish: {
    blurb: 'Elvish: Welsh and Finnish vowels, liquid consonants, long and singing.',
    male: [
      'Aerandir', 'Amroth', 'Anarion', 'Beleth', 'Calanor', 'Caradoc', 'Celebor', 'Cirion', 'Daeron', 'Dirhael',
      'Eardil', 'Elendur', 'Elladan', 'Eluvan', 'Eriador', 'Faelon', 'Fendrel', 'Finrael', 'Galdor', 'Gethin',
      'Gildor', 'Haldir', 'Hallas', 'Ilmarin', 'Ithilan', 'Lindir', 'Lorien', 'Maeglin', 'Malduin', 'Meneldir',
      'Mithrellas', 'Nimloth', 'Orophin', 'Pelendur', 'Rhodri', 'Rumil', 'Saeros', 'Taliesin', 'Tavor', 'Thalion',
      'Thranduin', 'Tuor', 'Ulmo', 'Valandil', 'Voronwe', 'Aelric', 'Aldarion', 'Amlach', 'Arvellon', 'Caelir',
      'Cedric', 'Dior', 'Ecthelion', 'Edrahil', 'Elwing', 'Eolin', 'Erestor', 'Faramell', 'Galion', 'Gwindor',
      'Hador', 'Idril', 'Ingwion', 'Lalwen', 'Lenwe', 'Mablung', 'Nellas', 'Nerdanel', 'Penlod', 'Sador',
      'Ainu', 'Ilkka', 'Väinö', 'Lemmin', 'Aarni', 'Ilmari', 'Tapio', 'Eino', 'Kullervo', 'Tuomas',
    ],
    female: [
      'Aerin', 'Amarie', 'Anwen', 'Arwel', 'Belain', 'Celebrian', 'Ceridwen', 'Elanor', 'Elenwe', 'Eilian',
      'Ellemir', 'Elowen', 'Eluned', 'Erendis', 'Faelith', 'Finduilas', 'Galathil', 'Gilraen', 'Gwendolen', 'Gwenllian',
      'Idrielle', 'Ilsabet', 'Indis', 'Isilme', 'Lianne', 'Lindorie', 'Lirael', 'Lothiel', 'Luthiel', 'Maelis',
      'Meluine', 'Mirieth', 'Morwen', 'Nerwen', 'Nienor', 'Nimrodel', 'Olwen', 'Rhian', 'Rhiannon', 'Rian',
      'Silmarien', 'Siriel', 'Tathariel', 'Tinuviel', 'Ulwen', 'Varda', 'Yavanna', 'Aelin', 'Aranel', 'Branwen',
      'Calaeth', 'Celandine', 'Elestirne', 'Emeldir', 'Finwel', 'Gwenith', 'Haleth', 'Ioreth', 'Lissë', 'Melian',
      'Nessa', 'Nimue', 'Taliesa', 'Teleri', 'Aino', 'Ilona', 'Kielo', 'Lumi', 'Marjatta', 'Tuuli',
    ],
    surname: [
      'Ardhoriel', 'Brethil', 'Calaquendi', 'Celebrindor', 'Dorlomin', 'Elenthir', 'Falathren', 'Galadhon', 'Hithlum', 'Ithildin',
      'Lothlann', 'Mithlond', 'Nanduhir', 'Nevrast', 'Ossiriand', 'Rhovanion', 'Silvertree', 'Starwind', 'Tirion', 'Vanyaron',
      'ap Rhys', 'ap Owain', 'Gwynedd', 'Llewellyn', 'Maelor', 'Penrhyn', 'Tregaron', 'Ystrad', 'Annwn', 'Caerleon',
    ],
    place: [
      'Aldalome', 'Amon Lanc', 'Belegost', 'Calembel', 'Caras Sirion', 'Celebrant', 'Dorthonion', 'Eglarest', 'Eldamar', 'Elostirion',
      'Ephel Brandir', 'Gondolin', 'Himring', 'Ithilien', 'Lindon', 'Lothlorien', 'Menegroth', 'Nargothrond', 'Nimbrethil', 'Ossiriand',
      'Taur-im-Duinath', 'Tol Galen', 'Aberffraw', 'Bryn Celli', 'Caerwys', 'Dinas Emrys', 'Llanberis', 'Pennant', 'Tal-y-llyn', 'Ystradfellte',
      'Aberdaron', 'Amaranthe', 'Annuminas', 'Brithombar', 'Calenhad', 'Cardolan', 'Celduin', 'Dolwyddelan', 'Edhellond', 'Eilinel',
      'Elostirion', 'Ethiren', 'Faelivrin', 'Fornost', 'Gelion', 'Glanduin', 'Gwynlais', 'Harlindon', 'Imladris', 'Lasgalen',
      'Lothlann', 'Mithlond', 'Nenuial', 'Nindalf', 'Pelargir', 'Rhosgobel', 'Sirannon', 'Tharbad', 'Vinyamar', 'Ystwyth',
    ],
  },

  // Old English: the Shire's farmers and Rohan's riders, Lewis's country.
  saxon: {
    blurb: 'Saxon: Old English farmers and riders. Short, solid, a little earthy.',
    male: [
      'Aelfric', 'Aethelred', 'Aldhelm', 'Alfred', 'Athelstan', 'Beornwulf', 'Brand', 'Byrhtnoth', 'Cedd', 'Ceolwulf',
      'Cuthbert', 'Cynric', 'Dunstan', 'Eadric', 'Eadwine', 'Ealdred', 'Ecgbert', 'Edgar', 'Edmund', 'Egbert',
      'Elfwine', 'Eomer', 'Godric', 'Godwin', 'Guthlac', 'Hama', 'Harold', 'Hereward', 'Hrothgar', 'Ine',
      'Leofric', 'Leofwine', 'Offa', 'Osric', 'Oswald', 'Oswy', 'Penda', 'Raedwald', 'Sigeberht', 'Swithun',
      'Theodred', 'Wiglaf', 'Wilfrid', 'Wulfric', 'Wulfstan', 'Aldous', 'Ambrose', 'Barnaby', 'Bartholomew', 'Bram',
      'Cobb', 'Durwin', 'Elmer', 'Fulk', 'Garth', 'Hob', 'Holman', 'Jory', 'Lambert', 'Merry',
      'Ned', 'Odo', 'Perrin', 'Rufus', 'Sim', 'Tobin', 'Wat', 'Wilkin', 'Algar', 'Erkenwald',
    ],
    female: [
      'Aelfgifu', 'Aelfled', 'Aethelburh', 'Aethelflaed', 'Bebba', 'Cwenburh', 'Cyneburh', 'Eadburh', 'Eadgyth', 'Ealdgyth',
      'Ealhswith', 'Ebba', 'Edith', 'Elfleda', 'Ethelinda', 'Frideswide', 'Godgifu', 'Hild', 'Hilda', 'Leofrun',
      'Mildred', 'Milburga', 'Osyth', 'Rowena', 'Seaxburh', 'Sunniva', 'Werburgh', 'Wilburh', 'Winifred', 'Wulfrun',
      'Aldith', 'Alfreda', 'Amabel', 'Bertha', 'Clemence', 'Dora', 'Edda', 'Elfrida', 'Emma', 'Esme',
      'Goda', 'Gytha', 'Hawise', 'Isolda', 'Juliana', 'Lettice', 'Mabel', 'Maud', 'Nan', 'Petronel',
      'Rosamund', 'Sabeth', 'Tamsin', 'Wenna', 'Ada', 'Bryony', 'Elsabet', 'Marigold', 'Primrose', 'Rosie',
    ],
    surname: [
      'Ashby', 'Barrowfield', 'Bracegirdle', 'Brockhurst', 'Burrows', 'Coldwell', 'Cotton', 'Dunmore', 'Elmsworth', 'Fairbairn',
      'Fenwick', 'Gamwell', 'Greenhill', 'Hawthorn', 'Hedger', 'Hollins', 'Lambkin', 'Longbottom', 'Marrowby', 'Millward',
      'Oakley', 'Pennyfeather', 'Redfern', 'Sandhurst', 'Thatcher', 'Thornbury', 'Underhill', 'Wainwright', 'Whitfoot', 'Woodward',
      'Applegate', 'Brandybrook', 'Chubb', 'Dimbleby', 'Goodbody', 'Hayward', 'Netherby', 'Proudfoot', 'Smallwood', 'Tunnely',
    ],
    place: [
      'Ashbury', 'Bamford', 'Barrowdale', 'Brackenham', 'Buckland', 'Chesterholm', 'Cotswold', 'Dunwich', 'Eastfarthing', 'Edoras',
      'Elmet', 'Fernley', 'Frogmorton', 'Glastonbury', 'Hambledon', 'Harrowdale', 'Hobbiton', 'Holloway', 'Kirkby', 'Lindisfarne',
      'Marlow', 'Middlemarsh', 'Oakenshaw', 'Pennywell', 'Ravenscar', 'Sherwood', 'Stonehenge', 'Tadcaster', 'Wantage', 'Whitby',
      'Wimbourne', 'Withywindle', 'Wychwood', 'Yarrowby',
      'Aldbourne', 'Bradwell', 'Brockley', 'Bywater', 'Cheddar', 'Crickhollow', 'Deeping', 'Eastwold', 'Felbridge', 'Hardbottle',
      'Hayfield', 'Ivybridge', 'Kingsbridge', 'Longbottom', 'Michel', 'Newbury', 'Oatbarton', 'Puddleby', 'Rushock', 'Saltash',
      'Stock', 'Tuckborough', 'Waymeet', 'Weathertop', 'Westmarch', 'Whitwell', 'Woodhall', 'Wroxeter', 'Yeovil', 'Hartsfell',
    ],
  },

  // Old Norse: dwarves, the North, the sagas.
  norse: {
    blurb: 'Norse: saga names, hard stops and rolled r\'s. Dwarves and the cold North.',
    male: [
      'Agnar', 'Alrik', 'Arngrim', 'Asbjorn', 'Bard', 'Bjarni', 'Bodvar', 'Bolli', 'Brand', 'Dagfinn',
      'Egil', 'Eirik', 'Eyvind', 'Finnbogi', 'Fjalar', 'Gizur', 'Gorm', 'Grettir', 'Grim', 'Gunnar',
      'Hakon', 'Halfdan', 'Hallbjorn', 'Harald', 'Hauk', 'Hjalmar', 'Hrafn', 'Ingolf', 'Ivar', 'Kari',
      'Ketil', 'Kjartan', 'Leif', 'Njal', 'Olaf', 'Orm', 'Ragnar', 'Rolf', 'Sigurd', 'Skarphedin',
      'Snorri', 'Starkad', 'Steinar', 'Sven', 'Thorgest', 'Thorkel', 'Thorstein', 'Ulf', 'Vali', 'Vidar',
      'Bombur', 'Dain', 'Dwalin', 'Gloin', 'Nain', 'Nar', 'Thror', 'Austri', 'Brokk', 'Durin',
      'Eitri', 'Fundin', 'Groin', 'Hlodvar', 'Ori', 'Regin', 'Sindri', 'Thrain', 'Vestri', 'Yngvar',
    ],
    female: [
      'Alfhild', 'Asa', 'Asgerd', 'Astrid', 'Aud', 'Bergljot', 'Bodil', 'Brynhild', 'Dagny', 'Eir',
      'Freydis', 'Frida', 'Geirrid', 'Gerd', 'Gudrun', 'Gunnhild', 'Gyda', 'Hallgerd', 'Helga', 'Hervor',
      'Hild', 'Hlif', 'Ingrid', 'Ingunn', 'Jorunn', 'Kara', 'Liv', 'Ragna', 'Ragnhild', 'Rannveig',
      'Sigrid', 'Sigrun', 'Solveig', 'Svanhild', 'Thora', 'Thordis', 'Thorgerd', 'Thurid', 'Tove', 'Unn',
      'Valgerd', 'Vigdis', 'Yrsa', 'Alva', 'Brenna', 'Dis', 'Edda', 'Embla', 'Grima', 'Gro',
      'Halla', 'Idunn', 'Kelda', 'Nanna', 'Ottilia', 'Saga', 'Signy', 'Skadi', 'Thyra', 'Vor',
    ],
    surname: [
      'Arnason', 'Bjornsson', 'Eiriksdottir', 'Grimsson', 'Gunnarsdottir', 'Halfdansson', 'Ingolfsson', 'Ketilsson', 'Olafsdottir', 'Ragnarsson',
      'Sigurdsson', 'Thorsdottir', 'Ironfoot', 'Stonehelm', 'Deepdelver', 'Coalbeard', 'Oakenshield', 'Firebeard', 'Stoneborn', 'Hammerhand',
      'Anvilbrow', 'Frostbeard', 'Goldvein', 'Ironside', 'Longbeard', 'Rockjaw', 'Silverpick', 'Thunderforge', 'Copperkettle', 'Graniteheart',
    ],
    place: [
      'Bergen', 'Birka', 'Dalarna', 'Eidsvoll', 'Fjallheim', 'Gardar', 'Hedeby', 'Helgafell', 'Hlidarendi', 'Jotunheim',
      'Kaupang', 'Lindisfjord', 'Midgard', 'Niflheim', 'Reykholt', 'Skalholt', 'Skjoldungen', 'Thingvellir', 'Trondheim', 'Uppsala',
      'Vanaheim', 'Vestfold', 'Ymirholt', 'Khazad', 'Belegrund', 'Nogrod', 'Erebor', 'Ironhold', 'Stonedeep', 'Grimhaug',
      'Aasgard', 'Bjornholm', 'Drangar', 'Eyrarbakki', 'Fjordheim', 'Grimstad', 'Haugesund', 'Hvitfell', 'Jarlsberg', 'Kolfjell',
      'Lofoten', 'Myrkvid', 'Nordhaug', 'Ormsvik', 'Ravnsborg', 'Skaldheim', 'Stavanger', 'Svartalf', 'Tromsheim', 'Ulfsvik',
    ],
  },

  // Earthsea's archipelago: short, soft, true-name plain.
  isles: {
    blurb: 'Isles: short, plain, island names. Sea-folk and quiet mages.',
    male: [
      'Arren', 'Aspen', 'Beech', 'Cob', 'Dulse', 'Ebor', 'Erreth', 'Estarriol', 'Gamble', 'Gelluk',
      'Hare', 'Hawk', 'Heather', 'Hemlock', 'Irian', 'Jasper', 'Kurremkarmerruk', 'Lebannen', 'Medra', 'Moss',
      'Murre', 'Nemmerle', 'Orm', 'Otter', 'Pechvarry', 'Rose', 'Sopli', 'Sparrow', 'Thorion', 'Vetch',
      'Yarrow', 'Alder', 'Birch', 'Brand', 'Cal', 'Corin', 'Dagan', 'Ebrin', 'Fen', 'Gull',
      'Harl', 'Ivor', 'Kell', 'Lark', 'Marl', 'Ness', 'Oak', 'Pell', 'Reed', 'Rook',
      'Sedge', 'Shale', 'Skerry', 'Tern', 'Tor', 'Wrack', 'Ash', 'Calder', 'Drum', 'Flint',
    ],
    female: [
      'Anieb', 'Arha', 'Ath', 'Elfarran', 'Ember', 'Gift', 'Irian', 'Lily', 'Moss', 'Orrimy',
      'Rose', 'Seserakh', 'Tenar', 'Therru', 'Tehanu', 'Weaver', 'Yarrow', 'Ailse', 'Briar', 'Coral',
      'Dove', 'Elva', 'Fern', 'Gwen', 'Hazel', 'Ione', 'Isla', 'Kelp', 'Lark', 'Marram',
      'Meadow', 'Mira', 'Nell', 'Oriel', 'Pearl', 'Rowan', 'Saffi', 'Sorrel', 'Tamsin', 'Tansy',
      'Teal', 'Thrift', 'Una', 'Wren', 'Ailsa', 'Brisa', 'Cara', 'Della', 'Erin', 'Fia',
    ],
    surname: [
      'of Gont', 'of Roke', 'of Havnor', 'of Iffish', 'of Osskil', 'of Paln', 'of Selidor', 'of Way', 'of Ark', 'of Ten Alders',
      'Seaborn', 'Tidewell', 'Saltmarsh', 'Shellby', 'Kelpie', 'Driftwood', 'Netmaker', 'Reedman', 'Stormsby', 'Wavecrest',
    ],
    place: [
      'Ark', 'Atuan', 'Enlad', 'Gont', 'Hara', 'Havnor', 'Hosk', 'Iffish', 'Karego', 'Lorbanery',
      'Narveduen', 'Obehol', 'Osskil', 'Paln', 'Pendor', 'Re Albi', 'Roke', 'Selidor', 'Sorra', 'Wathort',
      'Arran', 'Barra', 'Colonsay', 'Eigg', 'Harris', 'Islay', 'Jura', 'Mingulay', 'Rhum', 'Skye',
      'Tiree', 'Uist', 'Vatersay', 'Lundy', 'Sark', 'Herm', 'Orkney', 'Scilly',
      'Barnisk', 'Eskel', 'Felkway', 'Hego', 'Ilien', 'Kamery', 'Lorbany', 'Mewhen', 'Nepp', 'Omer',
      'Perregal', 'Rolameny', 'Semel', 'Sunbay', 'Torheven', 'Ulfa', 'Vemish', 'Wellogy', 'Yeve', 'Astowell',
    ],
  },

  // Courtly: Valyrian and Andal nobility, medieval French and Latin.
  courtly: {
    blurb: 'Courtly: noble houses, Latin and Norman French. Long names with titles behind them.',
    male: [
      'Aemon', 'Alaric', 'Alistair', 'Amaury', 'Anselm', 'Arnaud', 'Aurelian', 'Baldric', 'Bertrand', 'Bohemond',
      'Casimir', 'Cassian', 'Clovis', 'Corbin', 'Damian', 'Darius', 'Desmond', 'Evrard', 'Florian', 'Gaspard',
      'Gerard', 'Godefroy', 'Guillaume', 'Hadrian', 'Hugo', 'Isembard', 'Jaskier', 'Leopold', 'Lothaire', 'Lucan',
      'Maekar', 'Marcellus', 'Maximilian', 'Octavian', 'Ottokar', 'Raimond', 'Raynald', 'Renaud', 'Roderic', 'Severin',
      'Tancred', 'Theobald', 'Thibault', 'Valerian', 'Viserion', 'Aegor', 'Baelor', 'Daeron', 'Maelys', 'Valarr',
      'Aurane', 'Benedikt', 'Cosimo', 'Fulgrim', 'Lorenzo', 'Ludovic', 'Matthias', 'Quentin', 'Sebastien', 'Vittorio',
    ],
    female: [
      'Adela', 'Adelaide', 'Aliénor', 'Alys', 'Amalasuntha', 'Aurelia', 'Beatrix', 'Berengaria', 'Blanche', 'Cassana',
      'Cecily', 'Clothilde', 'Constance', 'Cordelia', 'Delphine', 'Elaena', 'Eleanor', 'Ermengarde', 'Genevieve', 'Hellisent',
      'Honorine', 'Isabeau', 'Isolde', 'Jacquetta', 'Josceline', 'Lavinia', 'Lucrezia', 'Margery', 'Matilda', 'Melisende',
      'Mirelle', 'Octavia', 'Rhaella', 'Rohanne', 'Rosalind', 'Seraphine', 'Sibylla', 'Theodora', 'Valeria', 'Visenya',
      'Alysanne', 'Baela', 'Daella', 'Elinor', 'Larra', 'Rhaenys', 'Saera', 'Vaella', 'Aemma', 'Laena',
    ],
    surname: [
      'Ardane', 'Beaumont', 'Belcourt', 'Blackwood', 'Bracken', 'Castamere', 'Courcy', 'd\'Aubigny', 'de Bray', 'de Clare',
      'de Lacy', 'Dayne', 'Draycott', 'Fairmont', 'Florent', 'Hightower', 'Lancel', 'Marbrand', 'Montfort', 'Mortimer',
      'Redwyne', 'Rochefort', 'Sarsfield', 'Tarly', 'Valcourt', 'Vance', 'Velaryon', 'Westerling', 'Whitmore', 'Yronwood',
    ],
    place: [
      'Aigues-Mortes', 'Ardennes', 'Aquitaine', 'Avignon', 'Beaucaire', 'Blois', 'Carcassonne', 'Chinon', 'Clairvaux', 'Fontevraud',
      'Highgarden', 'Lorraine', 'Montségur', 'Narbonne', 'Oldtown', 'Orléans', 'Poitiers', 'Rochelle', 'Saumur', 'Sunspear',
      'Tolosa', 'Valence', 'Vézelay', 'Volantis', 'Lys', 'Pentos', 'Tyrosh', 'Braavos', 'Myr', 'Qohor',
      'Albigeois', 'Angevine', 'Arbonne', 'Beaulieu', 'Belmonte', 'Caravelle', 'Castellane', 'Clermont', 'Corbenic', 'Dorvalle',
      'Escalon', 'Fontaine', 'Guyenne', 'Lisieux', 'Malvern', 'Montbard', 'Perigord', 'Roncevaux', 'Salvarre', 'Valmont',
    ],
  },

  // Leiber's Lankhmar and city grime: clipped, shifty, a sneer in it.
  alley: {
    blurb: 'Alley: city grime. Clipped names, nicknames, a sneer in the vowels.',
    male: [
      'Bannat', 'Bazrak', 'Cleef', 'Crake', 'Dask', 'Dirk', 'Fissif', 'Fliss', 'Grex', 'Grilli',
      'Hrisk', 'Jaffer', 'Jex', 'Kreshmar', 'Krovas', 'Larsh', 'Lurk', 'Marik', 'Muulsh', 'Nehwon',
      'Nik', 'Ningauble', 'Ouwenyis', 'Pulg', 'Quarmal', 'Rask', 'Slevyas', 'Slinoor', 'Snarve', 'Sheelba',
      'Skrim', 'Slade', 'Squint', 'Tarsh', 'Tigran', 'Vlek', 'Weasel', 'Wix', 'Zax', 'Zhor',
      'Baz', 'Coln', 'Drago', 'Ferret', 'Garrick', 'Jem', 'Kip', 'Lodge', 'Mace', 'Nab',
      'Pike', 'Quill', 'Rat', 'Sly', 'Tam', 'Vane', 'Wick', 'Yorrick', 'Zed', 'Grub',
      'Arvash', 'Brisko', 'Corvin', 'Darrow', 'Esker', 'Fennick', 'Gristle', 'Hask', 'Ivo', 'Jorrek',
      'Kestrel', 'Lucan', 'Mardock', 'Nettick', 'Orsk', 'Pell', 'Raffin', 'Scarrow', 'Thane', 'Varrick',
    ],
    female: [
      'Ahura', 'Alyx', 'Bree', 'Cass', 'Dessa', 'Elsh', 'Frix', 'Hisvet', 'Hisvin', 'Ivrian',
      'Jinx', 'Keli', 'Kith', 'Lessa', 'Lunda', 'Mara', 'Mog', 'Nix', 'Reesa', 'Ruff',
      'Saska', 'Shan', 'Siv', 'Sly', 'Tash', 'Tix', 'Vex', 'Vlana', 'Wren', 'Zura',
      'Bel', 'Cora', 'Dace', 'Ember', 'Fen', 'Ginny', 'Hex', 'Isk', 'Jessa', 'Lark',
      'Moll', 'Nessa', 'Pip', 'Quin', 'Rook', 'Sable', 'Tilly', 'Vesk', 'Wisp', 'Yara',
      'Ashka', 'Briska', 'Cinder', 'Dariel', 'Esska', 'Fallon', 'Greer', 'Hessa', 'Ilsa', 'Jarra',
      'Kesh', 'Linnet', 'Marrow', 'Nightjar', 'Oriska', 'Prue', 'Riska', 'Sorrel', 'Thessaly', 'Velka',
    ],
    surname: [
      'Blackthumb', 'Crookback', 'Dunrat', 'Fingers', 'Gutterby', 'Halfpenny', 'Knucklebone', 'Lightfoot', 'Muckle', 'Nimblewick',
      'Quickblade', 'Ratcliffe', 'Shadwell', 'Slipknot', 'Smiler', 'Tallow', 'Twopence', 'Wharf', 'Whisper', 'Underbridge',
    ],
    place: [
      'Lankhmar', 'Ilthmar', 'Kvarch Nar', 'Quarmall', 'Ool Hrusp', 'Sarheenmar', 'Tovilyis', 'Horborixen', 'Kiraay', 'Mlurg',
      'Cheap Street', 'Dim Lane', 'Gutter', 'Murder Alley', 'Plague Court', 'Rat Row', 'Silver Street', 'Smoke Lane', 'Tanner Row', 'Wharfside',
      'Grimsditch', 'Mudwharf', 'Rattenburg', 'Slagport', 'Smokeholm', 'Tarwick', 'Blackwater', 'Coldharbour', 'Dregmoor', 'Fleetditch',
      'Gallowgate', 'Hookwick', 'Lowmarket', 'Pikemoor', 'Scumble', 'Sootwick', 'Stinkwell', 'Thievesgate', 'Undercroft', 'Wraithmere',
    ],
  },

  // Hearth: Rowling and Lewis — whimsical, British, a little comic.
  hearth: {
    blurb: 'Hearth: whimsical British. Comic surnames, cosy first names, good for shopkeepers.',
    male: [
      'Ambrose', 'Archibald', 'Augustus', 'Bartholomew', 'Basil', 'Benedict', 'Cuthbert', 'Digby', 'Dudley', 'Ebenezer',
      'Erasmus', 'Fergus', 'Fitzwilliam', 'Gideon', 'Horace', 'Humphrey', 'Ignatius', 'Jasper', 'Lancelot', 'Montague',
      'Mortimer', 'Mungo', 'Neville', 'Ollivander', 'Oswald', 'Percival', 'Phineas', 'Quentin', 'Reginald', 'Rufus',
      'Septimus', 'Silas', 'Tiberius', 'Ulysses', 'Wilfred', 'Algernon', 'Bertram', 'Clement', 'Edmund', 'Ferdinand',
      'Gilbert', 'Hector', 'Jeremiah', 'Lucius', 'Norbert', 'Obadiah', 'Peregrine', 'Rupert', 'Thaddeus', 'Wendell',
    ],
    female: [
      'Agatha', 'Araminta', 'Augusta', 'Beatrice', 'Bellatrix', 'Cassandra', 'Clementine', 'Cressida', 'Dorcas', 'Euphemia',
      'Florence', 'Gertrude', 'Griselda', 'Henrietta', 'Hepzibah', 'Honoria', 'Imelda', 'Iphigenia', 'Jemima', 'Lavender',
      'Mafalda', 'Marjorie', 'Millicent', 'Minerva', 'Muriel', 'Myrtle', 'Ophelia', 'Pandora', 'Pomona', 'Prudence',
      'Rosamund', 'Sybill', 'Tabitha', 'Theodosia', 'Ursula', 'Violetta', 'Wilhelmina', 'Winifred', 'Adelaide', 'Bathilda',
      'Calliope', 'Dilys', 'Elspeth', 'Hortensia', 'Leticia', 'Matilda', 'Petunia', 'Philippa', 'Temperance', 'Verity',
    ],
    surname: [
      'Abernathy', 'Babbling', 'Bagshot', 'Bobbin', 'Bumblewick', 'Crumplehorn', 'Diggory', 'Dimblewit', 'Fawley', 'Figgis',
      'Fudge', 'Gamp', 'Goshawk', 'Higglebottom', 'Hopkirk', 'Inkpot', 'Jorkins', 'Kettleburn', 'Merrythought', 'Nettlebed',
      'Ogden', 'Pettigrew', 'Puddifoot', 'Quibble', 'Scamander', 'Shacklebolt', 'Slughorn', 'Spudmore', 'Tuttle', 'Wimple',
      'Bunbury', 'Chumley', 'Dribble', 'Fiddlewick', 'Goodfellow', 'Huffington', 'Mumble', 'Popplewell', 'Snodgrass', 'Wigglesworth',
    ],
    place: [
      'Ottery St Catchpole', 'Little Whinging', 'Godric\'s Hollow', 'Tinworth', 'Upper Flagley', 'Mould-on-the-Wold', 'Badger\'s Bend', 'Puddlemere', 'Chudley', 'Tutshill',
      'Appleby', 'Bumblebury', 'Chipping Norton', 'Diddlebury', 'Great Snoring', 'Little Snoring', 'Muggleton', 'Nether Wallop', 'Piddletrenthide', 'Wetwang',
      'Bumbleford', 'Crumpleton', 'Dingleberry', 'Fiddleford', 'Gobbleside', 'Higgleby', 'Jollybridge', 'Kettlewell', 'Muddlecombe', 'Nibbleton',
      'Pimbleton', 'Puddingstone', 'Quibbleford', 'Snodsbury', 'Tiddlywink', 'Toddington', 'Twittering', 'Wibbleton', 'Wobbleford', 'Yawnsby',
    ],
  },
};

/** Every style, with cultures.ts's additions folded in. */
export const CORPORA: Record<NameStyle, StyleCorpus> = Object.fromEntries(
  [...Object.entries(BASE), ...Object.entries(NEW_STYLES)].map(([style, c]) => {
    const more = MORE[style] ?? {};
    return [style, {
      ...c,
      male: [...c.male, ...(more.male ?? [])], female: [...c.female, ...(more.female ?? [])],
      surname: [...c.surname, ...(more.surname ?? [])], place: [...c.place, ...(more.place ?? [])],
    }];
  }),
) as Record<NameStyle, StyleCorpus>;

/**
 * Names the generator must never hand back, nor anything within a letter of
 * them: the famous ones, which a reader would know on sight. A generator
 * trained on the sound of Middle-earth will sooner or later spell "Gandalf";
 * this is what stops it.
 */
export const FAMOUS: string[] = [
  // Tolkien
  'Gandalf', 'Frodo', 'Bilbo', 'Samwise', 'Aragorn', 'Arwen', 'Legolas', 'Gimli', 'Boromir', 'Faramir', 'Eowyn', 'Theoden',
  'Galadriel', 'Elrond', 'Sauron', 'Saruman', 'Gollum', 'Smeagol', 'Thorin', 'Balin', 'Fili', 'Kili', 'Beorn', 'Smaug',
  'Glorfindel', 'Celeborn', 'Denethor', 'Isildur', 'Elendil', 'Feanor', 'Fingolfin', 'Morgoth', 'Melkor', 'Luthien', 'Beren', 'Turin',
  'Earendil', 'Thingol', 'Treebeard', 'Radagast', 'Pippin', 'Peregrin', 'Meriadoc', 'Rosie', 'Eomer', 'Grima', 'Shelob',
  // Lewis
  'Aslan', 'Caspian', 'Reepicheep', 'Tumnus', 'Jadis', 'Puddleglum', 'Eustace', 'Rilian', 'Shasta', 'Aravis', 'Digory',
  // Leiber
  'Fafhrd', 'Mouser', 'Ningauble', 'Sheelba', 'Hisvet', 'Vlana', 'Ivrian', 'Lankhmar',
  // Le Guin
  'Ged', 'Sparrowhawk', 'Ogion', 'Tenar', 'Tehanu', 'Lebannen', 'Arren', 'Vetch', 'Kalessin', 'Orm Embar',
  // Rowling
  'Harry', 'Hermione', 'Ronald', 'Dumbledore', 'Voldemort', 'Snape', 'Hagrid', 'Malfoy', 'Draco', 'Sirius', 'Lupin',
  'Neville', 'Luna', 'Ginny', 'Bellatrix', 'Minerva', 'McGonagall', 'Slughorn', 'Shacklebolt', 'Scamander', 'Ollivander',
  'Pettigrew', 'Diggory', 'Lockhart', 'Quirrell', 'Hogwarts',
  // Novik
  'Temeraire', 'Laurence', 'Agnieszka', 'Sarkan', 'Kasia', 'Miryem', 'Galadriel',
  // Martin
  'Daenerys', 'Targaryen', 'Tyrion', 'Lannister', 'Cersei', 'Jaime', 'Arya', 'Sansa', 'Eddard', 'Stark', 'Robb', 'Bran',
  'Jorah', 'Drogo', 'Joffrey', 'Theon', 'Greyjoy', 'Brienne', 'Sandor', 'Petyr', 'Varys', 'Melisandre', 'Stannis', 'Renly',
  'Rhaegar', 'Viserys', 'Aegon', 'Visenya', 'Rhaenys', 'Baelor', 'Maekar', 'Velaryon', 'Hightower', 'Tarly', 'Dayne',
  // Moorcock
  'Elric', 'Melnibone', 'Stormbringer', 'Mournblade', 'Moonglum', 'Yyrkoon', 'Cymoril', 'Arioch', 'Sadric', 'Imrryr', 'Corum', 'Hawkmoon',
  // Howard
  'Conan', 'Cimmeria', 'Cimmerian', 'Aquilonia', 'Thoth-Amon', 'Belit', 'Valeria', 'Kull', 'Thulsa', 'Xaltotun', 'Yasmela', 'Zenobia', 'Akivasha',
  // Pratchett
  'Rincewind', 'Vimes', 'Vetinari', 'Twoflower', 'Weatherwax', 'Ogg', 'Nobby', 'Nobbs', 'Dibbler', 'Ridcully', 'Stibbons', 'Lipwig', 'Angua',
  'Carrot', 'Ankh-Morpork', 'Morpork', 'Discworld', 'Magrat', 'Tiffany', 'Gaspode', 'Ramkin', 'Detritus', 'Cheery', 'Dorfl', 'Mustrum',
];
