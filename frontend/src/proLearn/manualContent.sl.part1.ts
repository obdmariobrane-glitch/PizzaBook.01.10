import type { ProGuideTopic } from './types';

export const PRO_LEARN_SL_PART1: ProGuideTopic[] = [
  {
    id: 'topic-dough',
    title: 'Testo',
    description: 'Razumi, kako sestavine tvorijo testo, ter prepoznaj njegov razvoj, elastičnost in raztegljivost.',
    introduction: '',
    sections: [
      {
        id: 'dough-formation',
        title: 'Kako nastane testo',
        level: 3,
        markdown: 'Testo za pico nastane, ko moka vpije vodo, gnetenje in počivanje pa sestavine povežeta v raztegljivo, vendar dovolj čvrsto maso. Kvas in encimi iz moke sčasoma spreminjajo testo. V pečici se plini širijo, škrob in beljakovine se utrdijo, površina pa se suši in rjavi.\n\nGre za štiri povezane, vendar različne naloge:\n\n1. **Hidracija:** voda prodre v delce moke in pomaga povezati testo.\n2. **Razvoj strukture:** gnetenje, prepogibanje in počivanje razvijajo mrežo, ki zadržuje plin.\n3. **Fermentacija:** kvas tvori ogljikov dioksid in aromatične stranske produkte.\n4. **Peka:** toplota razširi plin, utrdi sredico ter ustvari barvo in vonj.\n\nV pšeničnem testu beljakovine ob stiku z vodo, gnetenju in počivanju tvorijo povezano glutensko mrežo. Ta mreža ni balon brez omejitev: če je prešibka, plin uhaja in testo se razleze; če je preveč napeto ali premalo spočito, se testo krči in ga je težko raztegniti.\n\n**Kaj opazovati:** po gnetenju mora biti testo povezano; po fermentaciji mora kazati drobne mehurčke in živahnost, vendar ne sme biti tekoče ali razpadati, ko ga dvignemo. Krogla mora biti napihnjena in prožna, ni pa nujno, da je dvakrat večja. Pečena skorja mora imeti barvo, primerno slogu in pečici, sredica pa ne sme biti surova in pocasta.\n\n**Pogosta napaka:** napredek ocenjujemo samo po tem, ali je testo vzhajalo. Prostornina je koristen pokazatelj, vendar sta hitrost in obseg vzhajanja odvisna od oblike posode, količine kvasa, temperature, moke in čvrstosti testa.'
      },
      {
        id: 'dough-gluten',
        title: 'Razvoj glutena',
        level: 3,
        markdown: 'V pšeničnem testu beljakovini gliadin in glutenin z vodo tvorita gluten; gnetenje in prepogibanje pomagata povezati mrežo, počivanje pa omogoči, da se testo sprosti. V mešalniku ni treba doseči največjega možnega razvoja: fermentacija in nežno prepogibanje lahko strukturo še dodatno spremenita. Brezglutensko testo ne gre skozi iste korake in se obravnava ločeno v [temi o brezglutenskem testu](#topic-gluten-free).\n\n**Znaki:** masa je enakomerna in raztegljiva ter zadržuje plin. Če se pri nežnem raztezanju takoj trga, jo najprej pokrijte in pustite počivati; če se kljub počitku razleze, pred dodajanjem moke preverite hidracijo, temperaturo in stopnjo fermentacije.'
      },
      {
        id: 'dough-properties',
        title: 'Elastičnost in raztegljivost',
        level: 3,
        markdown: '**Elastičnost** je težnja testa, da se po potegu vrne v prvotno obliko; **raztegljivost** je zmožnost širjenja brez trganja. Za pico potrebujemo oboje: testo, ki je samo elastično, se vrača in krči, testo, ki je samo raztegljivo, pa se lahko stanjša in trga. Ravnovesje spreminjajo počitek, temperatura, voda, moka in način gnetenja.\n\nČe se testo krči nazaj, ga pokrijte in pustite počivati 10–20 minut, preden ga nadalje raztezate. Če se trga, uporabite manj sile ter preverite razvoj in hidracijo. »Test okenca« je lahko koristen, vendar je rezultat odvisen od formule in ni nujen cilj za vsako pico.'
      },
      {
        id: 'dough-rest',
        title: 'Počitek in pripravljenost',
        level: 3,
        markdown: 'Testo naj počiva pokrito, da se na njem ne naredi suha skorjica. Po gnetenju mora biti povezano in brez suhih delov; pred deljenjem je lahko masa bolj zračna in lahka; krogla, pripravljena za raztezanje, se vda brez trganja in pretiranega krčenja. Pripravljenosti ne presojajte samo po podvojitvi prostornine ali pritisku s prstom: upoštevajte čas, temperaturo, prostornino, mehurčke, vonj in čvrstost.'
      }
    ]
  },
  {
    id: 'topic-flour',
    title: 'Moka',
    description: 'Berite deklaracije, razlikujte W, beljakovine in P/L ter izberite ali zmešajte moke.',
    introduction: '',
    sections: [
      {
        id: 'flour-labels',
        title: 'Oznake in njihov pomen',
        level: 3,
        markdown: '- **Tip 00 in tip 0** v italijanskem sistemu označujeta predvsem stopnjo presejanja/pepela in tip moke, ne pa samodejno njene moči. Moki tipa 00 se lahko razlikujeta po deležu beljakovin, W, P/L, vpijanju vode in obnašanju.\n- **Delež beljakovin** je količina skupnih beljakovin, navedena na deklaraciji. Ni enak količini glutena in ne meri, kako dolgo bo testo zdržalo fermentacijo ali kako zlahka se bo raztezalo.\n- **W** je rezultat alveografskega preizkusa: kazalnik dela, potrebnega za napihovanje in deformiranje vzorca testa v predpisanih pogojih. Uporaben je za primerjavo mok, preizkušenih z isto metodo, ni pa neposredna sopomenka za »kakovost«.\n- **P** opisuje upor/čvrstost vzorca pri preizkusu, **L** pa njegovo raztegljivost. Razmerje **P/L** povzema ravnovesje med uporom in raztegljivostjo. Visok W sam po sebi ne zagotavlja, da bo testo lahko oblikovati; pomembna sta tudi P/L in recept.\n- **Gluten** nastane iz pšeničnih beljakovin gliadina in glutenina ob prisotnosti vode in mehanske obdelave. Rž, oves in pira se obnašajo drugače; pšenična pira vsebuje gluten in ni varna za osebe, ki se mu morajo izogibati.\n\nW in delež beljakovin merita različne lastnosti. Ne pretvarjajte enega v drugega s formulo in W ne sklepajte samo iz številke beljakovin. Če deklaracija ne navaja W ali P/L, zabeležite, da podatka nista znana.'
      },
      {
        id: 'flour-choice',
        title: 'Izbira glede na slog in časovni razpored',
        level: 3,
        markdown: '| Moka | Kaj pričakovati | Smiseln začetek |\n|---|---|---|\n| Pšenična gladka moka ali »00« | Možnosti so zelo široke; finost mletja ne dokazuje moči. | Začnite z zmerno hidracijo, na primer 58–63%, nato jo prilagodite glede na testo. |\n| Močnejša krušna moka | Pogosto zadrži več vode in prenese daljše ali hladnejše razporede, vendar »močnejša« ne pomeni »boljša«. | Upoštevajte specifikacijo proizvajalca, nato poskusite 60–67%. |\n| Polnozrnata pšenična moka | Otrobi vpijajo vodo in lahko prerežejo/motijo gluten; dajejo polnejši okus in gostejšo strukturo. | Začnite z 10–25% deležem v mešanici in počitkom po dodajanju vode. |\n| Pirina moka | Vsebuje gluten, vendar je testo lahko občutljivejše na pretirano gnetenje in dolgotrajno obremenitev. | Najprej zamenjajte 10–20% pšenične moke, ne celotne količine. |\n| Brezglutenska mešanica | Pšenične moke ni mogoče zamenjati v razmerju 1:1; vpijanje in veziva so odvisni od izdelka. | Upoštevajte razmerje vode in postopek na deklaraciji mešanice. |\n\nRazponi v tabeli so začetne ocene, ne deklaracija za vsak izdelek. Spremembe deleža beljakovin, mletja, otrobov in dodatkov spremenijo obnašanje. Vedno si zabeležite znamko, serijo in hidracijo.'
      },
      {
        id: 'flour-blends',
        title: 'Mešanje mok',
        level: 3,
        markdown: 'Mešanico izračunamo po masi. Primer: 80% moke A in 20% moke B v skupno 500 g pomeni 400 g A + 100 g B. Tehtano povprečje beljakovin lahko poda okvirno povprečje deklaracij, ne more pa zanesljivo napovedati W, P/L ali vpijanja vode v mešanici. Te lastnosti se ne spreminjajo nujno linearno.\n\n**Znaki, da je treba moko prilagoditi:** testo se pri raztezanju trga; ostane čvrsto in se krči nazaj; ali pa je lepljivo in ne ohrani oblike. Najprej preverite temperaturo in počitek. Šele nato spreminjajte vodo ali mešanico v majhnih korakih po 1–2 odstotni točki.'
      }
    ]
  },
  {
    id: 'topic-water',
    title: 'Voda in hidracija',
    description: 'Izračunaj hidracijo in pekovske odstotke ter se nauči vodo dodajati postopoma.',
    introduction: '',
    sections: [
      {
        id: 'water-hydration',
        title: 'Hidracija',
        level: 3,
        markdown: 'Pekovski odstotki izražajo vsako sestavino kot odstotek skupne količine moke. Moka je vedno 100%.\n\n> Odstotek sestavine = masa sestavine ÷ masa moke × 100\n\nPrimer: 600 g moke in 372 g vode pomenita 62% hidracije. V receptu s prefermentom števec in imenovalec vključujeta vse sestavine iz prefermenta in končnega testa, vendar sestavine seštejemo samo enkrat.\n\n**Hidracija** je odstotek vode glede na skupno količino moke. Ne vključuje olja, jajc, omake ali vode, ki pozneje pride iz nadeva. Za natančno primerjavo receptov lahko posebej navedemo tudi skupno količino tekočine, vendar v tem priročniku »hidracija« pomeni voda/moka.'
      },
      {
        id: 'water-bakers-math',
        title: 'Pekovski odstotki in izračun',
        level: 3,
        markdown: 'Pri znani masi moke:\n\n- voda = moka × hidracija ÷ 100\n- sol = moka × odstotek soli ÷ 100\n- kvas = moka × odstotek kvasa ÷ 100\n\nČe je znana skupna masa testa, najprej seštejte vse odstotke. Na primer, 100% moke + 62% vode + 2,8% soli + 0,17% svežega kvasa = 164,97% skupne mase. Moka je ciljna masa testa ÷ 1,6497.\n\nPo zaokroževanju lahko masa testa odstopa za nekaj gramov. Računajte z nezaokroženimi vrednostmi, za končno maso pa celotno testo razdelite z uporabo tehtnice.'
      },
      {
        id: 'water-handling',
        title: 'Delo z vodo in postopno dodajanje',
        level: 3,
        markdown: 'Voda iz pipe, ki je varna za pitje, je večinoma primerna. Trdota in minerali lahko nekoliko spremenijo občutek, vendar jih ni treba spreminjati, preden imate ponovljiv osnovni postopek. Delež vode spreminjajte postopoma. Več vode ne pomeni samodejno boljše pice: vpliva na lepljivost, raztezanje, fermentacijo in način peke.\n\n**Če je testo pretrdo:** preverite, ali ste odmerili vso vodo, ali je bila moka pravilno stehtana in ali testo ni hladno ter napeto. Naslednjič povečajte vodo za 1–2% glede na moko.\n**Če je testo pretirano lepljivo:** najprej pustite moki čas, da vpije vodo, in preverite, ali testo ni pretoplo ali preveč fermentirano. Delovne površine ne posipajte z neomejeno količino moke; s tem spremenite formulo.'
      },
      {
        id: 'water-allocation',
        title: 'Skupna voda v prefermentu in led',
        level: 3,
        markdown: 'V skupno količino vode v receptu vključite vodo v prefermentu, vodo v suspenziji kvasa in vodo, ki nastane s taljenjem ledu. Primer: recept zahteva 400 g skupne vode, preferment pa vsebuje 140 g; za končno gnetenje ostane največ 260 g vode. Če v končno testo dodate 30 g ledu, je to del teh 260 g, ne dodatnih 30 g.\n\nLed ohladi vodo in testo; njegova masa se kljub temu šteje kot voda. Ledu ne dodajajte neposredno v mešalnik, ne da bi preverili navodila proizvajalca in se prepričali, da se lahko povsem stopi ter enakomerno porazdeli.\n\nPovezano: [biga](#method-biga), [poolish](#method-poolish), [temperatura](#topic-temperature).'
      }
    ]
  },
  {
    id: 'topic-yeast',
    title: 'Kvas',
    description: 'Primerjaj sveži, aktivni suhi in instant kvas ter ustrezno odmeri vsak izdelek.',
    introduction: '',
    sections: [
      {
        id: 'yeast-types',
        title: 'Oblike in delovanje kvasa',
        level: 3,
        markdown: 'Kvas je živ mikroorganizem, ki iz razpoložljivih sladkorjev tvori plin in aromatične snovi. V testu je treba odmerek določiti glede na skupno maso moke, vrsto izdelka, čas, temperaturo in način uporabe.\n\n- **Sveži kvas** je stisnjen v kocko. Hranite ga v hladilniku v skladu z deklaracijo; zlahka ga nadrobimo, vendar se hitro pokvari.\n- **Aktivni suhi kvas** ima večja zrnca; nekateri proizvajalci priporočajo rehidracijo, drugi dovoljujejo neposredno dodajanje. Upoštevajte navodila prav za ta izdelek.\n- **Instant suhi kvas** lahko običajno vmešamo neposredno v moko, vendar tudi zanj velja deklaracija. Vsi izdelki nimajo enake moči ali namena uporabe.\n\nPretvorba med vrstami kvasa ni univerzalna konstanta. Proizvajalec lahko na primer dovoli zamenjavo ene vrste suhega kvasa z drugo, vendar so pogoji hidracije, aktivacije in količina odvisni od izdelka. Pri zamenjavi svežega kvasa s suhim upoštevajte navodila proizvajalca za konkretni izdelek ali najprej opravite manjši primerjalni preizkus; ne predpostavljajte, da je »trikrat manj« vedno pravilno.'
      },
      {
        id: 'yeast-storage',
        title: 'Shranjevanje in odmerjanje',
        level: 3,
        markdown: 'Sveži kvas hranite v hladilniku in ga porabite do roka uporabe, navedenega na embalaži. Aktivni suhi in instant kvas hranite zaprta, na suhem in v skladu z deklaracijo; toplota in vlaga skrajšata njuno obstojnost. Sveži kvas, ki je spremenil barvo, postal sluzast ali ima neprijeten vonj, zavrzite. Odmerka ne ocenjujte »po ščepcu«: izračunajte ga glede na maso skupne količine moke in konkretni časovni razpored.'
      },
      {
        id: 'yeast-suspension',
        title: 'Majhne količine in suspenzija kvasa',
        level: 3,
        markdown: 'Za majhne odmerke je uporabna tehtnica z ločljivostjo vsaj 0,1 g. Če potrebujete natančnejšo količino svežega kvasa, lahko pripravite svežo masno suspenzijo: nadrobite 1,0 g svežega kvasa v 99,0 g vode, dobro premešajte in takoj odtehtajte potrebno maso suspenzije.\n\nPrimer: 20,0 g suspenzije vsebuje 0,2 g svežega kvasa in 19,8 g vode. To količino odštejte od vode v receptu. Pripravite samo količino za takojšnjo uporabo, poskrbite za čistočo in razredčenega kvasa ne shranjujte za naslednjo serijo. Ta postopek velja za sveži kvas; suhi kvas pripravite v skladu z deklaracijo.'
      },
      {
        id: 'yeast-substitution',
        title: 'Zamenjava med vrstami kvasa',
        level: 3,
        markdown: 'Najprej poiščite tabelo ali navodila proizvajalca za točno določen izdelek in način dela. Če proizvajalec dovoljuje zamenjavo aktivnega suhega in instant kvasa v razmerju ena proti ena, to uporabite samo v okviru teh navodil; drugi izdelki se lahko obnašajo drugače. Sveži kvas vsebuje več vode kot suhi, zato njunih količin ni mogoče zamenjati gram za gram. Po zamenjavi spremljajte testo in čas, ne samo izračuna.\n\n**Omejen primer pretvorbe:** za tradicionalno testo, pripravljeno ročno ali v stoječem mešalniku, Red Star navaja, da je mogoče njegov Red Star Active Dry Yeast in Red Star Quick Rise Instant Yeast zamenjati v razmerju ena proti ena. Če recept zahteva **7 g Red Star Active Dry Yeast**, za ta postopek uporabite **7 g Red Star Quick Rise Instant Yeast**. Instant kvas lahko deluje hitreje, zato pripravljenost ocenjujte po testu in po potrebi prilagodite trajanje. Če recept zahteva rehidracijo, uporabite način dodajanja z embalaže; instant kvas lahko v mnogih receptih vmešate med suhe sestavine. Ta primer ne velja samodejno za sveži kvas, druge znamke ali kruhomat; Red Star za kruhomat navaja drugačen odmerek.\n\nZa 0,2–1 g kvasa potrebujete tehtnico, ki meri desetinke grama. Merjenje z žličko je pri dolgem hladnem razporedu še posebej nenatančno. Če tehtnica nima takšne ločljivosti, lahko po higienskem postopku pripravite svežo masno suspenzijo in jo takoj uporabite, pri tem pa upoštevajte količino vode.\n\n**Pripravljenost kvasa:** v testu spremljajte nastajanje plina, mehurčke, vonj in elastičnost; pena v kozarcu naj ne bo edini dokaz. Če kvas ne deluje, preverite rok uporabe, način shranjevanja, ali voda morda ni bila prevroča, in temperaturo testa. Ne poskušajte težave na slepo odpraviti z dodajanjem več kvasa.\n\nPovezano: [fermentacija](#topic-fermentation), [temperatura](#topic-temperature), [varnost hrane](#topic-storage).'
      }
    ]
  },
  {
    id: 'topic-additions',
    title: 'Sol, olje, sladkor in slad',
    description: 'Spoznaj, kako sol, olje, sladkor in slad vplivajo na testo ter kdaj jih dodati.',
    introduction: '',
    sections: [
      {
        id: 'additions-role',
        title: 'Vloga sestavin',
        level: 3,
        markdown: '- **Sol** daje okus, glede na koncentracijo upočasni delovanje kvasa in vpliva na čvrstost testa. Za pico je začetni razpon približno 2–3% skupne količine moke. Sol enakomerno razporedite; kupa soli ne pustite neposredno na kvasu.\n- **Olje** zmehča občutek skorje, prispeva k okusu in lahko pomaga pri peki v pekaču. Tradicionalni regulirani neapeljski recept testu ne dodaja olja; številni domači in sodobni recepti ga vseeno uporabljajo.\n- **Sladkor** pri večini test ni nujna hrana za kvas: moka vsebuje dostopne ogljikove hidrate, encimi pa jih sproščajo. Majhna količina lahko v domači pečici pospeši porjavitev, vendar poveča tveganje, da površina potemni, še preden se sredica speče.\n- **Slad** je lahko diastatični (z aktivnimi encimi) ali nediastatični (predvsem za okus in barvo). Aktivni slad ni isto kot sladkor. Preveč aktivnega sladu lahko razgradi škrob in povzroči lepljivo, pocasto sredico; ne dodajajte ga, če ne poznate izdelka in navodil.\n\nVse odstotke izračunajte glede na skupno količino moke, vključno z moko v prefermentu. Če recept za izbrani slog ne zahteva olja ali sladkorja, njuno dodajanje spremeni značaj in obnašanje testa.'
      },
      {
        id: 'additions-use',
        title: 'Kdaj in kako jih dodati',
        level: 3,
        markdown: 'Sol stehtajte in jo enakomerno razporedite. Lahko jo raztopite v delu vode ali dodate, ko se moka in voda že povežeta. Koncentrirane soli ne pustite neposredno na kvasu. Olje dodajte, ko se testo začne povezovati; tako se lažje enakomerno vmeša. Sladkor dodajte samo, kadar ga zahteva izbrani domači recept ali želite vplivati na porjavitev, ne pa samodejno kot »aktivator«.'
      },
      {
        id: 'additions-malt',
        title: 'Diastatični in nediastatični slad',
        level: 3,
        markdown: 'Diastatični slad vsebuje aktivne encime, ki razgrajujejo škrob; nediastatični slad prispeva predvsem okus in barvo. Deklaracije izdelkov se razlikujejo. Upoštevajte odmerek proizvajalca in ene vrste ne zamenjujte z drugo v enaki količini. Preveč aktivnega sladu lahko povzroči lepljivo sredico in pretirano hitro porjavitev.\n\nPovezano: [hidracija](#topic-water), [peka](#topic-equipment), [New York](#style-new-york).'
      }
    ]
  },
  {
    id: 'topic-temperature',
    title: 'Temperatura',
    description: 'Izmeri temperature in oceni vodo za doseganje ciljne temperature testa.',
    introduction: '',
    sections: [
      {
        id: 'temperature-measurements',
        title: 'Kaj meriti',
        level: 3,
        markdown: 'Temperatura je eden najpomembnejših dejavnikov ponovljivosti. Zabeležite vsaj temperaturo moke, prostora, vode, testa takoj po gnetenju in hladilnika.\n\nMeritve opravite ob različnih časih in jih ne zamenjujte med seboj:\n\n1. **Ciljna temperatura po gnetenju** opisuje testo takoj po končanem gnetenju.\n2. **Temperatura ob deljenju/oblikovanju kroglic** se zabeleži po fermentaciji celotne mase, tik pred razdelitvijo na porcije.\n3. **Temperatura pred raztezanjem** se izmeri na krogli ali testu v pekaču, ko se končni počitek bliža koncu.\n4. **Temperatura hladilnika** se izmeri z ločenim termometrom v bližini posode s testom; ne sklepajte nanjo iz nastavitve naprave.\n\nZa pšenično testo za pico je praktična začetna ciljna temperatura po gnetenju pogosto približno 22–25°C, vendar jo spreminjajo recept, metoda, moka in trajanje. To ni »idealna temperatura za vsako pico«.'
      },
      {
        id: 'temperature-water',
        title: 'Izračun temperature vode kot začetna ocena',
        level: 3,
        markdown: 'V poenostavljenem modelu za neposredno testo lahko uporabite izmerjene temperature moke, prostora in vode ter umerjen faktor gnetenja:\n\n> temperatura vode ≈ 3 × ciljna temperatura testa − temperatura moke − temperatura prostora − toplota, ki jo doda gnetenje\n\nToplota zaradi gnetenja (trenje) je odvisna od mešalnika, hitrosti, časa, mase testa in ročnega dela. Izmerite jo z lastnimi poskusnimi zamesi; faktorja druge naprave ne prevzemajte. Pri prefermentu je treba upoštevati tudi njegovo temperaturo, zato je potreben izračun s štirimi dejavniki ali praktična prilagoditev.\n\n**Primer izračuna vode za neposredno testo:** cilj po gnetenju 24°C, moka 22°C, prostor 23°C in umerjeni faktor gnetenja 2°C:\n\n> voda = (3 × 24) − 22 − 23 − 2 = 25°C\n\nTo je začetna ocena. Po gnetenju izmerite temperaturo testa. Če je na primer 26°C namesto 24°C, zabeležite odstopanje in v naslednji seriji spremenite temperaturo vode ali postopek; ledu ne dodajajte samodejno že zamešenemu testu.\n\nHladilnik ni vedno natanko 4°C: izmerite ga s termometrom na mestu, kjer stoji testo. Temperatura zraka in sredice testa nista enaki, zlasti takoj po tem, ko toplo maso postavite v hladilnik.'
      },
      {
        id: 'temperature-target',
        title: 'Ciljna temperatura po gnetenju in pred oblikovanjem',
        level: 3,
        markdown: 'Temperaturo testa zabeležite takoj po končanem gnetenju. To je ciljna temperatura po gnetenju. Znova jo izmerite pred oblikovanjem: trenje, fermentacija in okolje jo lahko zvišajo, hladilnik pa jo znižuje postopoma. Temperature krogle tik pred peko ne uporabljajte namesto meritve po gnetenju.\n\nHladilnik izmerite s termometrom na mestu, kjer stoji testo, po možnosti potem, ko nekaj časa niste odpirali vrat. Nastavljena vrednost naprave ne dokazuje, da je v njeni notranjosti natanko takšna temperatura.'
      },
      {
        id: 'temperature-friction',
        title: 'Faktor gnetenja in umerjanje',
        level: 3,
        markdown: 'Za neposredno testo velja v preprostem pekovskem modelu:\n\n> Temperatura vode = (3 × ciljna temperatura testa) − temperatura moke − temperatura prostora − faktor gnetenja.\n\nPrištejte tudi temperaturo prefermenta:\n\n> Temperatura vode = (4 × ciljna temperatura testa) − temperatura moke − temperatura prostora − temperatura prefermenta − faktor gnetenja.\n\nTo sta enačbi za **izračun temperature vode**, ne fizikalni zakon ali samodejna napoved končne temperature. Faktor gnetenja je konvencionalni korekcijski člen, dobljen s poskusnim zamesom za določen stroj, količino, hitrost in trajanje. Ne pomeni preprosto »koliko se je testo segrelo«, izmerjeno z meritvijo pred in po gnetenju.\n\nUmerjanje: zamesite poskusno serijo, zabeležite temperaturo prostora, moke, vode (in prefermenta) ter izmerite testo takoj po gnetenju. Izmerjeno temperaturo testa vstavite kot ciljno in iz iste enačbe izračunajte faktor. Ponovite z enako maso in enakimi hitrostmi. Če spremenite stroj, hitrost, maso ali trajanje gnetenja, umerjanje ponovite. Če izračunana temperatura vode pade pod 0°C, uporabite del odmerjene vode v obliki ledu, ga vštejte v skupno količino vode in preverite temperaturo testa.\n\n**Primer umerjanja faktorja gnetenja:** pri istem poskusnem zamesu neposrednega testa izmerite moko 22°C, prostor 23°C, vodo 25°C in temperaturo končnega testa 24°C. Izmerjeno temperaturo vstavite kot ciljno:\n\n> faktor = (3 × 24) − 22 − 23 − 25 = 2°C\n\nTo je umerjeni korekcijski člen za ta mešalnik, količino in postopek; **ni** dobljen s preprostim odštevanjem začetne temperature od končne. Če želite v naslednji seriji enak cilj in so drugi pogoji nespremenjeni, izračun vode da 25°C.\n\n**Primer s prefermentom:** po ločenem poskusnem zamesu izmerite moko 21°C, prostor 22°C, preferment 18°C, vodo 24°C in testo po gnetenju 23°C:\n\n> faktor = (4 × 23) − 21 − 22 − 18 − 24 = 7°C\n\nZa cilj 24°C ob enakih vhodnih temperaturah in enakem postopku:\n\n> voda = (4 × 24) − 21 − 22 − 18 − 7 = 28°C\n\nIzračun je približen: sestavine nimajo nujno enake toplotne kapacitete, rezultat pa spreminjajo oblika posode, velikost serije, čas, hitrost in okolje. Takoj po gnetenju preverite temperaturo v sredini testa; zabeležite jo in prilagodite naslednjo serijo.\n\nČe formula poda temperaturo vode pod 0°C, to obravnavajte kot znak, da je treba spremeniti postopek, ne kot navodilo, naj dolijete »negativno« vodo. Najprej zmanjšajte segrevanje mešalnika, predhodno ohladite moko/preferment ali razdelite zames. Če kljub temu uporabite led, z njim nadomestite natančno stehtani del skupne količine vode, preverite, ali naprava dovoljuje led in ali se bo povsem stopil brez poškodb; masa ledu in tekoče vode mora ostati enaka količini vode v receptu. Izmerite končno temperaturo in jo zabeležite.\n\nPovezano: [hladna fermentacija](#topic-cold-proof), [gnetenje](#topic-handling), [poolish](#method-poolish).'
      }
    ]
  }
];
