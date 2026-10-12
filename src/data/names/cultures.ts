/**
 * More name corpora: three cultures in their own right (Gaelic, Germanic,
 * Slavic), and more names for the styles in corpora.ts, which were thin
 * enough to repeat themselves.
 *
 * Spellings are the anglicised ones, chosen to be sayable by a native English
 * speaker on first sight: "Neve" over "Niamh", "Dobromir" over "Dobromír",
 * no "szcz". The generator learns the spelling it is given, so a corpus of
 * sayable names gives sayable names.
 */
import type { StyleCorpus } from './corpora.js';

type Lists = Omit<StyleCorpus, 'blurb'>;

export const NEW_STYLES: Record<'gaelic' | 'germanic' | 'slavic' | 'sorcery', StyleCorpus> = {
  /*
   * Sword and sorcery: Howard's Hyborian age and Moorcock's decadent
   * empires. Exotic and grand, not the city's grime (that is `alley`). Built
   * on what Howard himself drew from — Akkadian, Babylonian, Persian,
   * Egyptian, Scythian — with invented anchors in the manner of the books.
   */
  sorcery: {
    blurb: 'Sorcery: Hyborian and Melnibonean grandeur. Ancient empires, sorcerer-kings, apostrophes.',
    male: [
      'Ashurbal', 'Belshazar', 'Nabonid', 'Sargon', 'Tiglath', 'Xerxes', 'Zoroan', 'Ardashir', 'Artabanus', 'Cambyses',
      'Darius', 'Hormizd', 'Kavad', 'Mithradat', 'Narseh', 'Shapur', 'Vologas', 'Akhenat', 'Amenhet', 'Horemheb',
      'Khaemwas', 'Menkaure', 'Nectanebo', 'Psamtek', 'Ramesset', 'Sethos', 'Thutmose', 'Anacharsis', 'Idanthyrsus', 'Scylas',
      'Arkash', 'Bel-Ibni', 'Drogath', 'Esarhad', 'Gorthak', 'Hurusk', 'Ishbaal', 'Kharazim', 'Kuthul', 'Mardok',
      'Nergal', 'Ozymand', 'Rakhamun', 'Sethrak', 'Shamash', 'Tarkhan', 'Thugra', 'Ur-Zabal', 'Vathek', 'Xaltotun',
      'Yaggoth', 'Zabbath', 'Zarathan', 'Aalgar', 'Brakhar', 'Dyvim', 'Gaynor', 'Saxif', 'Theleb', 'Yyrth',
      'Valdrak', 'Sadric', 'Orlak', 'Kaarna', 'Morgath', 'Tsathog', 'Akivash', 'Natohk', 'Tsotha', 'Kallian',
    ],
    female: [
      'Ammunira', 'Ishtara', 'Nitocris', 'Semiramis', 'Tomyris', 'Zarinaea', 'Ankhesen', 'Hatshepa', 'Meritaten', 'Nefertari',
      'Tiye', 'Atossa', 'Parysatis', 'Roxana', 'Stateira', 'Amestris', 'Artemisia', 'Mandane', 'Pantea', 'Rhodogune',
      'Akivasha', 'Belitha', 'Casrin', 'Dejah', 'Esmerith', 'Ghazala', 'Ishara', 'Jhessa', 'Kalyra', 'Lilith',
      'Myrrhine', 'Nazira', 'Octhara', 'Phaedra', 'Qiyara', 'Shalara', 'Thalassa', 'Ulvira', 'Vashti', 'Xaltana',
      'Yasmela', 'Zenobia', 'Zelata', 'Cymara', 'Shaarilla', 'Myshella', 'Oone', 'Ysane', 'Zarozinia', 'Melisande',
    ],
    surname: [
      'of Acheron', 'of Khemi', 'of Shem', 'of Stygia', 'of Zingara', 'of Kheshatta', 'of Imrryr', 'of the Dragon Isle', 'of the Black Ring', 'of Pytarn',
      'the Elder', 'Sar-Ishtar', 'ben Mardok', 'Ashkelon', 'Kharsag', 'Nabuqar', 'Tarsus', 'Ur-Akkad', 'Zabbar', 'Vathekar',
      'Ashurai', 'Belzarad', 'Dumuzid', 'Enkidar', 'Gilgamar', 'Hammurab', 'Ishkurra', 'Kassitan', 'Lugalzag', 'Mesannad',
      'Nabuzar', 'Sinjarib', 'Tammuzad', 'Utnapish', 'Zimrilim', 'Akhetaten', 'Djedkare', 'Khufwet', 'Senusret', 'Userkaf',
    ],
    place: [
      'Acheron', 'Aghrapur', 'Akbitana', 'Anuwat', 'Asgalun', 'Belverus', 'Corinthia', 'Eruk', 'Ghaza', 'Hyrkania',
      'Iranistan', 'Kheshatta', 'Khitai', 'Khoraja', 'Kordava', 'Luxur', 'Messantia', 'Nemedia', 'Ophir', 'Pythos',
      'Sabatea', 'Shamar', 'Shushan', 'Sukhmet', 'Tarantia', 'Turan', 'Vendhya', 'Xuchotl', 'Yezud', 'Zamboula',
      'Babylon', 'Ctesiphon', 'Ecbatana', 'Kanesh', 'Lagash', 'Nineveh', 'Persepolis', 'Sippar', 'Susa', 'Thebes',
      'Imrryr', 'Bakshaan', 'Jharkor', 'Karlaak', 'Org', 'Pikarayd', 'Tarkesh', 'Vilmir', 'Dhakos', 'Ilmiora',
    ],
  },
  // Irish and Scottish Gaelic, anglicised.
  gaelic: {
    blurb: 'Gaelic: Irish and Highland names, anglicised. Soft openings, rolling middles.',
    male: [
      'Aidan', 'Alasdair', 'Angus', 'Ardal', 'Barra', 'Breandan', 'Brennan', 'Bryce', 'Cahal', 'Callum',
      'Carrick', 'Cathal', 'Cian', 'Ciaran', 'Colm', 'Colum', 'Conall', 'Conan', 'Connor', 'Cormac',
      'Craig', 'Daithi', 'Declan', 'Diarmid', 'Donal', 'Donnach', 'Dougal', 'Duncan', 'Eamon', 'Eanna',
      'Ennis', 'Evander', 'Fergal', 'Ferris', 'Fiach', 'Finbar', 'Fingal', 'Finlay', 'Flann', 'Gillan',
      'Gorman', 'Hamish', 'Iain', 'Keegan', 'Kellen', 'Kennet', 'Kieran', 'Lachlan', 'Lorcan', 'Lugh',
      'Malachy', 'Malcolm', 'Murdo', 'Murtagh', 'Naoise', 'Niall', 'Odhran', 'Oisin', 'Padraig', 'Ronan',
      'Rory', 'Ruari', 'Seamus', 'Senan', 'Somerled', 'Tadhg', 'Tavish', 'Tiernan', 'Torin', 'Tully',
      'Uisdean', 'Alastar', 'Bran', 'Coll', 'Dallan', 'Eoghan', 'Fionn', 'Galen', 'Kerr', 'Lennan',
    ],
    female: [
      'Aileen', 'Ailsa', 'Aine', 'Aislin', 'Alana', 'Blair', 'Brenna', 'Bridget', 'Brona', 'Caitlin',
      'Ciara', 'Clodagh', 'Dana', 'Darina', 'Deirdre', 'Dervla', 'Eileen', 'Eilidh', 'Eithne', 'Elsie',
      'Ena', 'Etain', 'Fenella', 'Fiona', 'Fionnuala', 'Grainne', 'Isla', 'Iona', 'Kenna', 'Kerry',
      'Kirsty', 'Lorna', 'Maeve', 'Mairi', 'Maura', 'Moira', 'Morag', 'Morna', 'Muirne', 'Neve',
      'Nora', 'Nuala', 'Oona', 'Orla', 'Rhona', 'Rowan', 'Saoirse', 'Seona', 'Shauna', 'Shona',
      'Sile', 'Siobhan', 'Sorcha', 'Tara', 'Una', 'Ailbe', 'Brighde', 'Catriona', 'Ealasaid', 'Mhairi',
    ],
    surname: [
      'Brennan', 'Buchanan', 'Callahan', 'Cameron', 'Carmody', 'Connolly', 'Corrigan', 'Costello', 'Cullen', 'Delaney',
      'Doherty', 'Donnelly', 'Doyle', 'Drummond', 'Dunbar', 'Fennelly', 'Ferguson', 'Flanagan', 'Galbraith', 'Gallagher',
      'Hennessy', 'Kavanagh', 'Keane', 'Kennedy', 'Kinsella', 'Lachlan', 'Lennox', 'Logan', 'Macallister', 'Macaulay',
      'Macbride', 'Macduff', 'Macintyre', 'Mackinnon', 'Maclaren', 'Macleod', 'Macrae', 'Monaghan', 'Moran', 'Mulcahy',
      'Munro', 'Nolan', 'Quinlan', 'Rafferty', 'Riordan', 'Sheridan', 'Sinclair', 'Sullivan', 'Tierney', 'Whelan',
    ],
    place: [
      'Ardmore', 'Ardnamurchan', 'Athlone', 'Aviemore', 'Ballycastle', 'Ballymena', 'Balmoral', 'Bantry', 'Benbecula', 'Carrick',
      'Cashel', 'Clonmacnoise', 'Connemara', 'Dalriada', 'Donegal', 'Drumcliff', 'Dunadd', 'Dunboyne', 'Dundalk', 'Dunkeld',
      'Dunmore', 'Glencoe', 'Glendalough', 'Glenfinnan', 'Inverness', 'Kilbride', 'Kildare', 'Kilkenny', 'Killarney', 'Kilmartin',
      'Kinloch', 'Kinsale', 'Knockmore', 'Lismore', 'Lochaber', 'Rathmore', 'Strathmore', 'Tara', 'Tobermory', 'Tralee',
      'Tullamore', 'Ullapool', 'Armagh', 'Clonmel', 'Dunvegan', 'Kilcullen', 'Monaghan', 'Strabane', 'Tyrone', 'Westport',
    ],
  },

  // Old High German, Gothic, Frankish and the Nibelungs.
  germanic: {
    blurb: 'Germanic: Old High German, Gothic and Frankish. Strong, two-part names.',
    male: [
      'Adalbert', 'Adelhard', 'Alaric', 'Albrecht', 'Anselm', 'Arnulf', 'Arnold', 'Bertolf', 'Bernhard', 'Brunold',
      'Burkhard', 'Dankwart', 'Detlef', 'Dietmar', 'Dietrich', 'Eberhard', 'Eckhart', 'Egon', 'Ekkehard', 'Emmerich',
      'Engelbert', 'Erhard', 'Ernst', 'Folkmar', 'Friedrich', 'Gebhard', 'Gerhard', 'Gernot', 'Giselher', 'Godehard',
      'Gottfried', 'Gunther', 'Hagen', 'Hartmut', 'Hartwig', 'Heinrich', 'Helmut', 'Herwig', 'Hildebrand', 'Hubert',
      'Konrad', 'Kuno', 'Leopold', 'Lothar', 'Ludwig', 'Manfred', 'Meinhard', 'Norbert', 'Odo', 'Ortwin',
      'Otto', 'Reinhard', 'Reinmar', 'Roland', 'Rudiger', 'Rupert', 'Siegfried', 'Sigmund', 'Theobald', 'Ulrich',
      'Volker', 'Walther', 'Wendel', 'Werner', 'Wieland', 'Wilhelm', 'Wolfram', 'Wolfgang', 'Athalwulf', 'Theodoric',
      'Totila', 'Gelimer', 'Euric', 'Gundobad', 'Childeric', 'Sigibert', 'Chlodomer', 'Ermanaric', 'Odoacer', 'Ricimer',
    ],
    female: [
      'Adela', 'Adelheid', 'Agnes', 'Alheid', 'Amalia', 'Bertha', 'Brunhild', 'Edeltraud', 'Elfriede', 'Elsbeth',
      'Emma', 'Engelberga', 'Ermengard', 'Frieda', 'Gerlinde', 'Gertrud', 'Gisela', 'Gotelind', 'Gudrun', 'Hedwig',
      'Helga', 'Herlinde', 'Hildegard', 'Hiltrud', 'Hroswitha', 'Ida', 'Irmgard', 'Irmtraud', 'Isolde', 'Jutta',
      'Kriemhild', 'Kunigunde', 'Liesel', 'Lioba', 'Mathilde', 'Mechthild', 'Odila', 'Ortrun', 'Ottilie', 'Radegund',
      'Richenza', 'Roswitha', 'Rotrud', 'Sieglinde', 'Sigrun', 'Swanhild', 'Theodelinde', 'Ute', 'Walburga', 'Wilhelmina',
      'Adeltrud', 'Amalaswintha', 'Brunichild', 'Chrodechild', 'Fredegund', 'Galswintha', 'Hildeburg', 'Ingund', 'Klothilde', 'Waldrada',
    ],
    surname: [
      'Adler', 'Bachmann', 'Baumgart', 'Brandt', 'Eberlein', 'Eisenhardt', 'Falkenrath', 'Fischer', 'Frankel', 'Gerber',
      'Grunewald', 'Hartmann', 'Hauser', 'Heller', 'Hoffmann', 'Kessler', 'Klein', 'Koenig', 'Kraus', 'Lehmann',
      'Lindner', 'Mahler', 'Neumann', 'Oberhauser', 'Richter', 'Rosenthal', 'Sauer', 'Schafer', 'Schmidt', 'Schreiber',
      'Steiner', 'Stolz', 'Vogel', 'Wagner', 'Waldmann', 'Weber', 'Winkler', 'Wolff', 'Zimmer', 'von Falken',
      'von Brandt', 'Eichendorf', 'Felsenburg', 'Hohenwald', 'Kaltenbach', 'Lichtenberg', 'Rabenstein', 'Schwarzwald', 'Steinbach', 'Wolfenbach',
    ],
    place: [
      'Altdorf', 'Bamberg', 'Bergheim', 'Brandenburg', 'Dornach', 'Eisenach', 'Falkenstein', 'Frankenburg', 'Freiburg', 'Fulda',
      'Goslar', 'Hammelburg', 'Heidelberg', 'Hildesheim', 'Hohenfels', 'Kaltenberg', 'Konstanz', 'Lichtenau', 'Lindau', 'Lorsch',
      'Magdeburg', 'Marburg', 'Meissen', 'Nordhausen', 'Oberwald', 'Paderborn', 'Quedlinburg', 'Rabenau', 'Regensburg', 'Rosenheim',
      'Rothenburg', 'Schwarzach', 'Speyer', 'Steinach', 'Tannenberg', 'Trier', 'Ulm', 'Wartburg', 'Weissenfels', 'Wolfsburg',
      'Worms', 'Wurzburg', 'Ansbach', 'Dinkelsbuhl', 'Eichstatt', 'Feldberg', 'Hollenstein', 'Kronach', 'Merseburg', 'Sonnenberg',
    ],
  },

  // Old Slavic, chosen to be sayable: no clusters an English tongue trips on.
  slavic: {
    blurb: 'Slavic: old Slavic names, the sayable ones. Bright vowels, -mir and -slav.',
    male: [
      'Bogdan', 'Bogumil', 'Boleslav', 'Boris', 'Borislav', 'Bozhidar', 'Bronislav', 'Casimir', 'Danilo', 'Dobromir',
      'Dobroslav', 'Dragan', 'Dragomir', 'Dmitri', 'Gavril', 'Gleb', 'Goran', 'Gostomir', 'Igor', 'Ivan',
      'Jaromir', 'Kazimir', 'Lazar', 'Lev', 'Lubomir', 'Ludmil', 'Milan', 'Milorad', 'Miloslav', 'Miroslav',
      'Mstislav', 'Nikola', 'Oleg', 'Ostromir', 'Pavel', 'Predrag', 'Premysl', 'Radek', 'Radomir', 'Radoslav',
      'Ratibor', 'Rostislav', 'Ruslan', 'Sergei', 'Slavomir', 'Stanimir', 'Stanislav', 'Stoyan', 'Svetomir', 'Tomislav',
      'Vadim', 'Vasily', 'Velimir', 'Vlad', 'Vladimir', 'Vlastimil', 'Vojtek', 'Volodar', 'Vsevolod', 'Yaromir',
      'Yaroslav', 'Zbigniew', 'Zdenek', 'Zoran', 'Zvonimir', 'Bratislav', 'Ciril', 'Damir', 'Gorazd', 'Krasimir',
    ],
    female: [
      'Agata', 'Alena', 'Bogdana', 'Bogumila', 'Bozena', 'Branka', 'Danica', 'Darina', 'Dobrava', 'Dobroslava',
      'Dragana', 'Galina', 'Goranka', 'Irina', 'Ivana', 'Jarmila', 'Katya', 'Kseniya', 'Lada', 'Larisa',
      'Lidia', 'Lubava', 'Lyudmila', 'Marina', 'Mila', 'Milena', 'Milica', 'Mira', 'Miroslava', 'Nadia',
      'Nadezhda', 'Natasha', 'Olga', 'Oksana', 'Radmila', 'Radoslava', 'Rusalka', 'Snezhana', 'Stanislava', 'Svetlana',
      'Tatiana', 'Tamara', 'Vanda', 'Vasilisa', 'Vera', 'Vesna', 'Vlasta', 'Yaroslava', 'Zdenka', 'Zlata',
      'Zora', 'Zoya', 'Bela', 'Dusana', 'Jelena', 'Kasia', 'Ludmila', 'Marta', 'Nevena', 'Rada',
    ],
    surname: [
      'Antonov', 'Belov', 'Bogdanov', 'Borisov', 'Dragovich', 'Golubev', 'Ivanov', 'Karpov', 'Kovac', 'Kozlov',
      'Krasnov', 'Lebedev', 'Markovic', 'Medvedev', 'Milanov', 'Morozov', 'Novak', 'Orlov', 'Pavlov', 'Petrovich',
      'Popov', 'Radev', 'Sokolov', 'Stoyanov', 'Volkov', 'Vukovic', 'Zaitsev', 'Zoric', 'Belinsky', 'Dobrev',
      'Gorsky', 'Jankovic', 'Kalinin', 'Lazarev', 'Mirkovic', 'Nikolic', 'Ostrov', 'Rostov', 'Sorokin', 'Tarasov',
    ],
    place: [
      'Belgorod', 'Bratislava', 'Brno', 'Chernigov', 'Dubrovnik', 'Gorodets', 'Kiev', 'Kolomna', 'Kostroma', 'Krakow',
      'Ladoga', 'Lublin', 'Lutsk', 'Mozhaisk', 'Murom', 'Novgorod', 'Ochrid', 'Olomouc', 'Opole', 'Plovdiv',
      'Polotsk', 'Poznan', 'Pskov', 'Rostov', 'Ryazan', 'Sarajevo', 'Smolensk', 'Sofia', 'Suzdal', 'Torzhok',
      'Tver', 'Uglich', 'Velikograd', 'Vidin', 'Vitebsk', 'Vladimir', 'Vologda', 'Vyshgorod', 'Yaroslavl', 'Zadar',
      'Zagreb', 'Zvenigorod', 'Belozersk', 'Chernograd', 'Dobrograd', 'Kamenets', 'Miroslavl', 'Ostrograd', 'Svetlograd', 'Zlatograd',
    ],
  },
};

/** More names for the first seven styles: enough that a town does not repeat itself. */
export const MORE: Record<string, Partial<Lists>> = {
  elvish: {
    male: ['Aegnor', 'Amrod', 'Angrod', 'Belegund', 'Bregor', 'Celegorm', 'Curufin', 'Edrahil', 'Elemmir', 'Finarfin', 'Galathil', 'Gelmir', 'Guilin', 'Gwindor', 'Halmir', 'Ingwe', 'Lenwe', 'Mahtan', 'Olwe', 'Orodreth', 'Pengolodh', 'Rumil', 'Thalos', 'Voronwil', 'Aranwe', 'Belecthor', 'Celepharn', 'Duilin', 'Egalmoth', 'Elerrina', 'Glanhir', 'Hirgon', 'Iorlas', 'Lomion', 'Mablung', 'Nimir', 'Rhovan', 'Taurion', 'Ulmion', 'Valandor'],
    female: ['Aerinel', 'Almarian', 'Anaire', 'Earwen', 'Elemmire', 'Eldalote', 'Erinel', 'Faniel', 'Finduil', 'Galathiel', 'Indril', 'Ithilwen', 'Lalaith', 'Lindiriel', 'Maeriel', 'Meldis', 'Mirime', 'Nimloth', 'Nolwen', 'Rian', 'Silmeth', 'Tarelien', 'Tinwe', 'Vanimelde', 'Yavien', 'Aredhel', 'Celebwen', 'Elerrin', 'Gilwen', 'Lothwen'],
    surname: ['Amonlhach', 'Celebrant', 'Doriathon', 'Eithelion', 'Gilthoniel', 'Hithaeglir', 'Lindonath', 'Nimbrethil', 'Silverbough', 'Morningdew', 'Moonwhisper', 'Nightbloom', 'Leafsong', 'Dawnstar', 'Mistvale', 'Willowmere', 'Thornvale', 'Evenstar', 'Rivermoon', 'Duskwalker'],
  },
  saxon: {
    male: ['Aelfwald', 'Beorhtric', 'Brihtwold', 'Ceadda', 'Cenred', 'Cuthred', 'Eadbald', 'Eadmund', 'Ealdwine', 'Earconbert', 'Eorpwald', 'Hereric', 'Hlothhere', 'Ingeld', 'Merewalh', 'Oslac', 'Saeberht', 'Sigeric', 'Tondberht', 'Wihtred', 'Wigheard', 'Wulfhere', 'Aelle', 'Byrhtferth', 'Cynewulf', 'Eadnoth', 'Leofsige', 'Ordgar', 'Oswine', 'Wulfnoth'],
    female: ['Aebbe', 'Aelfthryth', 'Beorhtgifu', 'Cwenthryth', 'Eadwynn', 'Ealdthryth', 'Eanflaed', 'Eormengyth', 'Leofgifu', 'Mildgyth', 'Wulfhild', 'Aelfwynn', 'Cynethryth', 'Eadflaed', 'Hereswith', 'Osthryth', 'Sexburga', 'Wynflaed', 'Aldgyth', 'Godwyn'],
    surname: ['Ashworth', 'Barrowman', 'Blackmore', 'Bradford', 'Bramley', 'Coldridge', 'Cropper', 'Dimwood', 'Elderberry', 'Fallowfield', 'Goodchild', 'Harrowgate', 'Hedgecock', 'Larkspur', 'Littlewood', 'Meadowcroft', 'Oakshott', 'Reedbury', 'Stonebridge', 'Wetherby'],
  },
  norse: {
    male: ['Arnbjorn', 'Asgeir', 'Bersi', 'Bjorgolf', 'Einar', 'Eyjolf', 'Flosi', 'Geirmund', 'Gisli', 'Glum', 'Grimkel', 'Hallfred', 'Hrolf', 'Hoskuld', 'Illugi', 'Ingimund', 'Kolbein', 'Ljot', 'Odd', 'Onund', 'Ozur', 'Refil', 'Skeggi', 'Solvi', 'Sturla', 'Thorbjorn', 'Thorvald', 'Torfi', 'Uni', 'Vemund'],
    female: ['Arnbjorg', 'Asdis', 'Bergthora', 'Dalla', 'Droplaug', 'Gjaflaug', 'Gudny', 'Hallbera', 'Hallveig', 'Hrefna', 'Ingibjorg', 'Jofrid', 'Ketilbjorg', 'Oddny', 'Sigrid', 'Steinunn', 'Thorhild', 'Thorunn', 'Ulfhild', 'Yngvild'],
    surname: ['Axebiter', 'Bearclaw', 'Bloodaxe', 'Fairhair', 'Forkbeard', 'Grimfist', 'Hardrada', 'Ironskull', 'Ravenfeeder', 'Skullsplitter', 'Snowfoot', 'Stonefist', 'Whitebeard', 'Wolfskin', 'Deepcutter'],
  },
  isles: {
    male: ['Aspar', 'Borre', 'Corrin', 'Dunne', 'Eskel', 'Farrow', 'Garth', 'Hallow', 'Isk', 'Jory', 'Kestrel', 'Lorn', 'Mallow', 'Nettle', 'Osprey', 'Pebble', 'Quarry', 'Raven', 'Spar', 'Thrush', 'Umber', 'Vale', 'Whin', 'Yew', 'Bracken', 'Cormorant', 'Dunlin', 'Ebb', 'Gannet', 'Heron'],
    female: ['Ailie', 'Bryn', 'Cove', 'Dulce', 'Eider', 'Fable', 'Glimmer', 'Holly', 'Ivy', 'Juniper', 'Kittiwake', 'Linnet', 'Marigold', 'Nerys', 'Oriel', 'Piper', 'Quill', 'Robin', 'Selkie', 'Tamar', 'Undine', 'Willow', 'Yarra', 'Zephyr', 'Clover', 'Daisy', 'Ember', 'Fern', 'Sedge', 'Wynne'],
    surname: ['Fisher', 'Gullwing', 'Harbourne', 'Kelpson', 'Lighthouse', 'Nettles', 'Oarsman', 'Pebbleshore', 'Rockpool', 'Seawell', 'Shorewood', 'Spindrift', 'Tidesman', 'Weatherby', 'Windward'],
  },
  courtly: {
    male: ['Amadeus', 'Anatole', 'Bastien', 'Benoit', 'Cyprien', 'Dorian', 'Emeric', 'Etienne', 'Fabrice', 'Gauvain', 'Hippolyte', 'Isidore', 'Jerome', 'Lucien', 'Mathurin', 'Olivier', 'Perceval', 'Rainier', 'Remy', 'Sylvain', 'Tristan', 'Urbain', 'Valentin', 'Yvain', 'Achille', 'Bayard', 'Gaston', 'Lancelin', 'Marcel', 'Philippe'],
    female: ['Amelie', 'Anouk', 'Apolline', 'Aveline', 'Bernadette', 'Celeste', 'Colette', 'Elise', 'Esmee', 'Fleur', 'Gisele', 'Heloise', 'Iseult', 'Juliette', 'Lisette', 'Margaux', 'Odette', 'Ombeline', 'Perrine', 'Sabine', 'Solene', 'Sylvie', 'Violaine', 'Ysolde', 'Aliette', 'Bettina', 'Cerise', 'Manon', 'Orane', 'Viviane'],
    surname: ['Aubert', 'Beauregard', 'Bellamy', 'Chastain', 'Delacroix', 'Dumont', 'Fontaine', 'Gascoigne', 'Lafayette', 'Lemaire', 'Marchand', 'Montague', 'Navarre', 'Prideaux', 'Rousseau', 'Saintclair', 'Toussaint', 'Valois', 'Vasseur', 'Villiers'],
  },
  /*
   * City grime, widened past Leiber: Pratchett's Ankh-Morpork, the comic
   * underside of the same streets — watchmen, hucksters, guild hangers-on.
   */
  alley: {
    male: ['Arnold', 'Blowfly', 'Cutwell', 'Dibbs', 'Fred', 'Gaspode', 'Harry', 'Ironfoundersson', 'Jimkin', 'Knuckles', 'Lemmy', 'Mustrum', 'Nobby', 'Ponder', 'Reg', 'Sam', 'Throat', 'Trevor', 'Victor', 'Wee', 'Burleigh', 'Cheery', 'Dorfl', 'Ernie', 'Foul', 'Gimlet', 'Hughnon', 'Moist', 'Ossie', 'Snapcase'],
    female: ['Adora', 'Angua', 'Bunty', 'Cheri', 'Doreen', 'Esk', 'Gytha', 'Hilta', 'Ink', 'Letice', 'Magrat', 'Molly', 'Nancy', 'Penny', 'Queenie', 'Sacharissa', 'Sybil', 'Tiffany', 'Trudy', 'Verence'],
    surname: [
      'Dibbler', 'Nobbs', 'Colon', 'Ridcully', 'Stibbons', 'Lipwig', 'Spangler', 'Goodmountain', 'Dearheart', 'Slant', 'Snoxall', 'Stronginthearm',
      'Boggis', 'Cheesemonger', 'Cripslock', 'Gimlet', 'Hamcrusher', 'Jugwhistle', 'Muckwhistle', 'Pudding', 'Ramkin', 'Skate', 'Thimblewick', 'Whiteface','Blackwater', 'Coinclipper', 'Cutpurse', 'Dregs', 'Fogg', 'Gristlewick', 'Hangfire', 'Inkfinger', 'Jackdaw', 'Keyhole', 'Lockjaw', 'Mudlark', 'Nightsoil', 'Pennywhistle', 'Ragpicker', 'Sootfoot', 'Thimble', 'Turncoat', 'Wormwood', 'Yardarm'],
  },
  hearth: {
    male: ['Abernathy', 'Barnabus', 'Cornelius', 'Desmond', 'Eustace', 'Fennimore', 'Godfrey', 'Hamish', 'Ichabod', 'Jeremy', 'Leopold', 'Marmaduke', 'Nigel', 'Octavius', 'Penrose', 'Quincy', 'Roderick', 'Sebastian', 'Tobias', 'Valentine'],
    female: ['Aurelia', 'Belinda', 'Constance', 'Dulcie', 'Edwina', 'Felicity', 'Georgiana', 'Harriet', 'Isadora', 'Josephine', 'Lucinda', 'Mabel', 'Nettie', 'Octavia', 'Penelope', 'Rosalind', 'Seraphina', 'Theodora', 'Una', 'Wilhelmina'],
    surname: ['Applewhite', 'Biscuit', 'Crumpet', 'Dandelion', 'Featherstone', 'Gooseberry', 'Honeycutt', 'Inglenook', 'Jellicoe', 'Kipling', 'Lollipop', 'Marmalade', 'Nutkin', 'Oddfellow', 'Pumpernickel', 'Quackenbush', 'Rumbelow', 'Sugarplum', 'Teacake', 'Whittlesey'],
  },
};
