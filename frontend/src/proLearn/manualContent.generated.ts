import type { ProGuideManual } from './types';

export const PRO_LEARN_HR: ProGuideManual = {
  "locale": "hr",
  "title": "Kako postati Pro",
  "introduction": "Praktičan PizzaBook vodič za razumijevanje tijesta i pripremu pizze kod kuće. Količine i rasporedi početne su procjene: pratite temperaturu, izgled i podatnost tijesta te po potrebi prilagodite vrijeme.",
  "topics": [
    {
      "id": "topic-dough",
      "title": "Tijesto",
      "description": "Razumij kako sastojci stvaraju tijesto i prepoznaj njegov razvoj, elastičnost i podatnost.",
      "introduction": "",
      "sections": [
        {
          "id": "dough-formation",
          "title": "Kako nastaje tijesto",
          "level": 3,
          "markdown": "Tijesto za pizzu nastaje kad brašno upije vodu, a miješenje i mirovanje povežu njegove sastojke u rastezljivu, ali dovoljno čvrstu masu. Kvasac i enzimi iz brašna mijenjaju tijesto tijekom vremena. U pećnici se plinovi šire, škrob i proteini učvršćuju, a površina se suši i tamni.\n\nČetiri su povezane, ali različite zadaće:\n\n1. **Hidratacija:** voda ulazi u čestice brašna i pomaže povezivanju tijesta.\n2. **Razvoj strukture:** miješenje, preklapanje i odmor razvijaju mrežu koja zadržava plin.\n3. **Fermentacija:** kvasac stvara ugljikov dioksid i aromatske nusproizvode.\n4. **Pečenje:** toplina širi plin, učvršćuje sredinu i stvara boju i miris.\n\nU tijestu od pšenice gluten čine proteini koji nakon dodira s vodom, miješanja i odmora stvaraju povezanu mrežu. Ta mreža nije balon bez granica: ako je preslaba, plin izlazi i tijesto se razlije; ako je pretjerano napeto ili nedovoljno odmoreno, tijesto se vraća i teško se otvara.\n\n**Što promatrati:** nakon zamjesa tijesto treba biti povezano; nakon fermentacije treba pokazivati sitne mjehuriće i živost, ali ne smije biti tekuće ni se raspadati pri podizanju. Kugla treba biti napuhnuta i podatna, a ne nužno dvostruko veća. Pečena kora treba imati boju primjerenu stilu i pećnici, bez sirove gnjecave sredine.\n\n**Česta pogreška:** procjenjivati napredak samo po tome je li tijesto naraslo. Volumen je koristan znak, ali brzina i visina rasta ovise o obliku posude, količini kvasca, temperaturi, brašnu i čvrstoći tijesta."
        },
        {
          "id": "dough-gluten",
          "title": "Razvoj glutena",
          "level": 3,
          "markdown": "U pšeničnom tijestu proteini gliadin i glutenin uz vodu tvore gluten; miješenje i presavijanja pomažu da se mreža poveže, a odmor dopušta da se tijesto opusti. Nije potrebno postići maksimalan razvoj u mikseru: fermentacija i nježni preklopi mogu dodatno utjecati na strukturu. Tijesto bez glutena ne prolazi iste korake i obrađuje se zasebno u [bezglutenskoj temi](#topic-gluten-free).\n\n**Znakovi:** masa je jednolična i rastezljiva te zadržava plin. Ako se pri laganom istezanju odmah trga, prvo je pokrijte i odmorite; ako se unatoč odmoru razlijeva, provjerite hidraciju, temperaturu i stupanj fermentacije prije dodavanja brašna."
        },
        {
          "id": "dough-properties",
          "title": "Elastičnost i rastezljivost",
          "level": 3,
          "markdown": "**Elastičnost** je sklonost tijesta da se nakon povlačenja vrati; **rastezljivost** je mogućnost širenja bez pucanja. Za pizzu trebaju obje: tijesto koje je samo elastično vraća se i skuplja, a tijesto koje je samo rastezljivo može se stanjiti i trgati. Odmor, temperatura, voda, brašno i način zamjesa mijenjaju ravnotežu.\n\nAko se tijesto vraća, pokrijte ga i odmorite 10–20 minuta prije daljnjeg otvaranja. Ako puca, smanjite silu i provjerite razvoj i hidraciju. „Prozor” može pomoći, ali rezultat ovisi o formuli i nije nužan cilj svake pizze."
        },
        {
          "id": "dough-rest",
          "title": "Odmor i spremnost",
          "level": 3,
          "markdown": "Tijesto odmarajte pokriveno da se ne stvori suha kožica. Nakon zamjesa treba biti povezano, bez suhih dijelova; prije dijeljenja masa može biti prozračnija i lakša; kugla spremna za otvaranje popušta bez kidanja i pretjeranog vraćanja. Ne zaključujte spremnost samo po udvostručenju ili pritisku prsta: kombinirajte vrijeme, temperaturu, volumen, mjehuriće, miris i čvrstoću."
        }
      ]
    },
    {
      "id": "topic-flour",
      "title": "Brašno",
      "description": "Čitaj deklaracije, razlikuj W, proteine i P/L te odaberi ili pomiješaj brašna.",
      "introduction": "",
      "sections": [
        {
          "id": "flour-labels",
          "title": "Oznake i što znače",
          "level": 3,
          "markdown": "- **Tip 00 i tip 0** u talijanskom sustavu prvenstveno označavaju stupanj prosijavanja/pepela i tip brašna, a ne automatski snagu. Dva brašna tipa 00 mogu se razlikovati po proteinu, W, P/L, upijanju vode i ponašanju.\n- **Postotak proteina** je količina ukupnih bjelančevina prema deklaraciji. Nije isto što i količina glutena, niti mjeri koliko će tijesto izdržati fermentaciju ili koliko će se lako rastezati.\n- **W** je rezultat alveografskog testa: pokazatelj rada potrebnog za napuhavanje i deformiranje uzorka tijesta pod propisanim uvjetima. Koristan je za usporedbu brašna testiranih istom metodom, ali nije izravan sinonim za „kvalitetu”.\n- **P** opisuje otpor/čvrstoću uzorka u testu, a **L** njegovu rastezljivost. Omjer **P/L** sažima ravnotežu između otpora i rastezljivosti. Visok W sam po sebi ne jamči da će tijesto biti lako oblikovati; P/L i recept također su važni.\n- **Gluten** nastaje od pšeničnih proteina gliadina i glutenina uz vodu i mehanički rad. Raž, zob i pira imaju drukčije ponašanje; pšenična pira sadrži gluten i nije sigurna za osobe koje ga moraju izbjegavati.\n\nW i postotak proteina mjere različite osobine. Ne pretvarajte jedno u drugo formulom i ne zaključujte W samo iz broja proteina. Ako deklaracija ne navodi W ili P/L, zabilježite da su nepoznati."
        },
        {
          "id": "flour-choice",
          "title": "Izbor prema stilu i rasporedu",
          "level": 3,
          "markdown": "| Brašno | Što očekivati | Razuman početak |\n|---|---|---|\n| Pšenično glatko ili „00” | Raspon mogućnosti je širok; finoća mljevenja nije dokaz snage. | Počnite s umjerenom hidratacijom, primjerice 58–63%, pa prilagodite prema tijestu. |\n| Jače krušno brašno | Često zadržava više vode i podnosi dulje ili hladnije rasporede, ali „jače” nije isto što i bolje. | Koristite specifikaciju proizvođača, a zatim isprobajte 60–67%. |\n| Integralno pšenično | Mekinje upijaju vodu i mogu presijecati/ometati gluten; daje puniji okus i gušću strukturu. | Počnite s 10–25% udjela u mješavini i odmorom nakon dodavanja vode. |\n| Pirovo | Sadrži gluten, ali tijesto može biti osjetljivije na prekomjerno miješenje i dugotrajno opterećenje. | Zamijenite najprije 10–20% pšeničnog brašna, ne cijelu količinu. |\n| Bezglutenska mješavina | Nije zamjenjiva s pšeničnim brašnom 1:1; upijanje i veziva ovise o proizvodu. | Slijedite omjer vode i postupak na deklaraciji mješavine. |\n\nRasponi u tablici su početne procjene, ne deklaracija svakog proizvoda. Promjene proteina, mljevenja, mekinja i dodataka mijenjaju ponašanje. Uvijek sačuvajte podatke o marki, seriji i hidrataciji."
        },
        {
          "id": "flour-blends",
          "title": "Miješanje brašna",
          "level": 3,
          "markdown": "Mješavina se računa po masi. Primjer: 80% brašna A i 20% brašna B u ukupno 500 g znači 400 g A + 100 g B. Ponderirani prosjek proteina može dati okvirni prosjek deklaracija, ali ne može pouzdano predvidjeti W, P/L ili apsorpciju vode mješavine. Ta svojstva se ne moraju mijenjati linearno.\n\n**Znakovi da brašno traži prilagodbu:** tijesto se kida pri rastezanju; ostaje kruto i vraća se; ili je ljepljivo i ne zadržava oblik. Prvo provjerite temperaturu i odmor. Tek zatim mijenjajte vodu ili mješavinu u malim koracima od 1–2 postotna boda."
        }
      ]
    },
    {
      "id": "topic-water",
      "title": "Voda i hidratacija",
      "description": "Izračunaj hidrataciju i pekarske postotke te nauči postupno dodavati vodu.",
      "introduction": "",
      "sections": [
        {
          "id": "water-hydration",
          "title": "Hidratacija",
          "level": 3,
          "markdown": "Pekarski postotci izražavaju svaki sastojak kao postotak ukupnog brašna. Brašno je uvijek 100%.\n\n> Postotak sastojka = masa sastojka ÷ masa brašna × 100\n\nPrimjer: 600 g brašna i 372 g vode daju 62% hidratacije. U receptu s prefermentom brojnik i nazivnik obuhvaćaju sve sastojke iz prefermenta i završnog tijesta, ali se sastojci zbrajaju samo jednom.\n\n**Hidratacija** je postotak vode prema ukupnom brašnu. Ne uključuje ulje, jaja, umak ni vodu koja kasnije dolazi iz nadjeva. Za preciznu usporedbu recepta može se posebno navesti i ukupna tekućina, no u ovom vodiču „hidratacija” znači voda/brašno."
        },
        {
          "id": "water-bakers-math",
          "title": "Pekarski postoci i proračun",
          "level": 3,
          "markdown": "Za poznatu masu brašna:\n\n- voda = brašno × hidratacija ÷ 100\n- sol = brašno × postotak soli ÷ 100\n- kvasac = brašno × postotak kvasca ÷ 100\n\nZa poznatu ukupnu masu tijesta najprije zbrojite sve postotke. Primjerice, 100% brašna + 62% vode + 2,8% soli + 0,17% svježeg kvasca = 164,97% ukupne mase. Brašno je ciljna masa tijesta ÷ 1,6497.\n\nMasa tijesta nakon zaokruživanja može odstupati nekoliko grama. Računajte po nezaokruženim vrijednostima, a za završnu gramažu podijelite ukupno tijesto vagom."
        },
        {
          "id": "water-handling",
          "title": "Rad s vodom i postupno dodavanje",
          "level": 3,
          "markdown": "Voda iz slavine koja je sigurna za piće uglavnom je prikladna. Tvrdoća i minerali mogu malo promijeniti dojam, ali ne treba ih mijenjati prije nego što imate ponovljiv osnovni postupak. Udio vode mijenjajte postupno. Više vode ne znači automatski bolju pizzu: mijenja lijepljenje, otvaranje, fermentaciju i način pečenja.\n\n**Ako je tijesto pretvrdo:** provjerite jeste li odmjerili svu vodu, da brašno nije pogrešno izvagano i da tijesto nije hladno i napeto. Sljedeći put povećajte vodu za 1–2% brašna.\n**Ako je pretjerano ljepljivo:** prvo dajte brašnu vremena da upije vodu i provjerite da nije pretoplo ili prefermentirano. Ne posipajte radnu plohu neograničenim brašnom; time mijenjate formulu."
        },
        {
          "id": "water-allocation",
          "title": "Ukupna voda u prefermentu i led",
          "level": 3,
          "markdown": "U ukupnu vodu recepta uključite vodu u prefermentu, vodu u suspenziji kvasca i vodu koja nastane otapanjem leda. Primjer: recept traži 400 g ukupne vode, a preferment sadrži 140 g; završnom zamjesu pripada najviše 260 g vode. Ako u završni zamjes stavite 30 g leda, to je dio tih 260 g, ne dodatnih 30 g.\n\nLed hladi vodu i tijesto; njegova masa svejedno se računa kao voda. Nemojte dodavati led izravno mikseru bez provjere uputa proizvođača i bez provjere da se može potpuno otopiti i rasporediti.\n\nPovezano: [biga](#method-biga), [poolish](#method-poolish), [temperatura](#topic-temperature)."
        }
      ]
    },
    {
      "id": "topic-yeast",
      "title": "Kvasac",
      "description": "Usporedi svježi, aktivni suhi i instant kvasac te primjereno odmjeri svaki proizvod.",
      "introduction": "",
      "sections": [
        {
          "id": "yeast-types",
          "title": "Oblici i djelovanje kvasca",
          "level": 3,
          "markdown": "Kvasac je živi mikroorganizam koji u dostupnim šećerima stvara plin i aromatske tvari. U tijestu se doza mora vezati uz ukupnu masu brašna, tip proizvoda, vrijeme, temperaturu i način uporabe.\n\n- **Svježi kvasac** dolazi stisnut u kocki. Drži se u hladnjaku prema deklaraciji, lako se mrvi, ali se brzo kvari.\n- **Aktivni suhi kvasac** ima krupnije granule; neki proizvođači preporučuju rehidraciju, drugi odobravaju izravno dodavanje. Slijedite uputu baš tog proizvoda.\n- **Instant suhi kvasac** obično se može umiješati izravno u brašno, no i tu vrijedi deklaracija. Nisu svi proizvodi iste jačine ili namjene.\n\nPretvorba između oblika kvasca nije univerzalna konstanta. Primjerice, proizvođač može odobriti zamjenu suhog kvasca drugim suhim oblikom, ali uvjeti hidratacije, aktivacije i količina ovise o proizvodu. Za zamjenu svježeg kvasca suhim koristite uputu proizvođača za konkretan proizvod ili prvo napravite malu usporednu probu; nemojte pretpostaviti da je „tri puta manje” uvijek točno."
        },
        {
          "id": "yeast-storage",
          "title": "Čuvanje i doziranje",
          "level": 3,
          "markdown": "Svježi kvasac držite u hladnjaku i upotrijebite unutar roka na pakiranju. Aktivni suhi i instant čuvajte zatvorene, suhe i prema deklaraciji; toplina i vlaga skraćuju im vijek. Svježi kvasac koji je promijenio boju, postao sluzav ili ima neugodan miris odbacite. Ne procjenjujte dozu po „prstohvatu”: izračunajte je prema masi ukupnog brašna i konkretnom rasporedu."
        },
        {
          "id": "yeast-suspension",
          "title": "Male količine i suspenzija kvasca",
          "level": 3,
          "markdown": "Za male doze korisna je vaga koja mjeri najmanje 0,1 g. Ako je potrebna preciznija količina svježeg kvasca, može se pripremiti svježa masena suspenzija: izmrvite 1,0 g svježeg kvasca u 99,0 g vode, dobro promiješajte i odmah odmjerite potrebnu masu suspenzije.\n\nPrimjer: 20,0 g suspenzije sadrži 0,2 g svježeg kvasca i 19,8 g vode. Tu količinu vode oduzmite od receptne vode. Pripremajte samo količinu za trenutnu upotrebu, održavajte čistoću i nemojte pohranjivati razrijeđeni kvasac za kasniju seriju. Ovaj postupak odnosi se na svježi kvasac; suhi kvasac pripremajte prema deklaraciji."
        },
        {
          "id": "yeast-substitution",
          "title": "Zamjena između vrsta kvasca",
          "level": 3,
          "markdown": "Najprije tražite tablicu ili uputu proizvođača baš za proizvod i način rada. Ako proizvođač dopušta zamjenu aktivnog suhog i instant kvasca jedan-za-jedan, primjenjujte to samo unutar te upute; drugi proizvodi mogu se ponašati drukčije. Svježi kvasac sadrži više vode od suhog pa se njegove količine ne mogu zamijeniti gram-za-gram. Nakon zamjene pratite tijesto i vrijeme, ne samo kalkulator.\n\n**Ograničen primjer pretvorbe:** za tradicionalno ručno ili stand-mixer tijesto, Red Star navodi da se njegov Red Star Active Dry Yeast i Red Star Quick Rise Instant Yeast mogu zamijeniti jedan-za-jedan. Ako recept traži **7 g Red Star Active Dry Yeast**, za taj postupak upotrijebite **7 g Red Star Quick Rise Instant Yeast**. Instant može djelovati brže pa spremnost procjenjujte po tijestu i prilagodite trajanje. Ako recept zahtijeva rehidraciju, primijenite način dodavanja s pakiranja; instant se u mnogim receptima može umiješati sa suhim sastojcima. Ovaj primjer ne vrijedi automatski za svježi kvasac, druge marke ni kruhomat; Red Star za kruhomat navodi drukčiju dozu.\n\nZa 0,2–1 g kvasca potrebna je vaga koja mjeri desetinke grama. Mjerenje žličicom posebno je neprecizno za dug hladni raspored. Ako vaga nema tu razlučivost, može se pripremiti svježa masena suspenzija prema higijenskom postupku i odmah je upotrijebiti, uz uračunavanje vode.\n\n**Spremnost kvasca:** u tijestu gledajte nastanak plina, mjehuriće, miris i elastičnost, ne pjenu u čaši kao jedini dokaz. Ako kvasac ne djeluje, provjerite rok, način skladištenja, vodu koja je možda bila prevruća i temperaturu tijesta. Nemojte kompenzirati slijepo dodavanjem još kvasca.\n\nPovezano: [fermentacija](#topic-fermentation), [temperatura](#topic-temperature), [sigurnost hrane](#topic-storage)."
        }
      ]
    },
    {
      "id": "topic-additions",
      "title": "Sol, ulje, šećer i slad",
      "description": "Saznaj kako sol, ulje, šećer i slad utječu na tijesto i kada ih dodati.",
      "introduction": "",
      "sections": [
        {
          "id": "additions-role",
          "title": "Uloga sastojaka",
          "level": 3,
          "markdown": "- **Sol** daje okus, usporava aktivnost kvasca ovisno o koncentraciji i utječe na čvrstoću tijesta. Početni raspon za pizzu je otprilike 2–3% ukupnog brašna. Sol ravnomjerno rasporedite; ne ostavljajte gomilu soli izravno na kvascu.\n- **Ulje** omekšava dojam kore, doprinosi okusu i može pomoći pri pečenju u plehu. Tradicionalno regulirani napolitanski recept ne dodaje ulje u tijesto; mnogi kućni i suvremeni recepti ga ipak koriste.\n- **Šećer** nije nužna hrana kvascu u većini tijesta: brašno sadrži dostupne ugljikohidrate i enzimi ih oslobađaju. Mala količina može ubrzati tamnjenje u kućnoj pećnici, ali povećava rizik da površina potamni prije nego što se sredina ispeče.\n- **Slad** može biti dijastatski (s aktivnim enzimima) ili nedijastatski (pretežno okus i boja). Aktivni slad nije isto što i šećer. Previše aktivnog slada može razgraditi škrob i dati ljepljivu, gnjecavu sredinu; ne dodajte ga bez poznavanja proizvoda i upute.\n\nSve postotke računajte prema ukupnom brašnu, uključujući brašno u prefermentu. Ako recept za odabrani stil ne traži ulje ili šećer, njihovo dodavanje mijenja karakter i ponašanje tijesta."
        },
        {
          "id": "additions-use",
          "title": "Kada i kako ih dodati",
          "level": 3,
          "markdown": "Sol izvažite i rasporedite ravnomjerno. Može se otopiti u dijelu vode ili dodati nakon što se brašno i voda povežu. Ne ostavljajte koncentriranu sol izravno na kvascu. Ulje dodajte nakon što se tijesto počelo povezivati; tada se lakše ravnomjerno uklopi. Šećer dodajte samo kad ga traži odabrani kućni recept ili želite utjecati na tamnjenje, ne kao automatski „aktivator”."
        },
        {
          "id": "additions-malt",
          "title": "Dijastatički i nedijastatički slad",
          "level": 3,
          "markdown": "Dijastatički slad sadrži aktivne enzime koji razgrađuju škrob; nedijastatički slad prvenstveno daje okus i boju. Proizvodne deklaracije nisu jednake. Slijedite dozu proizvođača i ne zamjenjujte jedan tip drugim u istoj količini. Previše aktivnog slada može uzrokovati ljepljivu sredinu i pretjerano brzo tamnjenje.\n\nPovezano: [hidratacija](#topic-water), [pečenje](#topic-equipment), [New York](#style-new-york)."
        }
      ]
    },
    {
      "id": "topic-temperature",
      "title": "Temperatura",
      "description": "Mjeri temperature i procijeni vodu za ciljanu temperaturu tijesta.",
      "introduction": "",
      "sections": [
        {
          "id": "temperature-measurements",
          "title": "Što mjeriti",
          "level": 3,
          "markdown": "Temperatura je jedan od najvažnijih pokretača ponovljivosti. Bilježite barem temperaturu brašna, prostorije, vode, tijesta odmah nakon zamjesa i hladnjaka.\n\nMjerenja radite u različitim trenucima i nemojte ih zamjenjivati:\n\n1. **Ciljna temperatura nakon zamjesa** opisuje tijesto čim je završeno miješenje.\n2. **Temperatura pri dijeljenju/kuglanju** bilježi se nakon fermentacije u masi, neposredno prije porcioniranja.\n3. **Temperatura prije otvaranja** mjeri se na kugli ili tijestu u plehu kad je završni odmor pri kraju.\n4. **Temperatura hladnjaka** mjeri se zasebnim termometrom blizu posude s tijestom; ne zaključuje se po postavci uređaja.\n\nZa pšenično tijesto za pizzu praktičan početni cilj nakon zamjesa često je približno 22–25°C, ali recept, metoda, brašno i trajanje mijenjaju cilj. To nije „idealna temperatura za svaku pizzu”."
        },
        {
          "id": "temperature-water",
          "title": "Račun vode kao početna procjena",
          "level": 3,
          "markdown": "U pojednostavljenom direktnom modelu mogu se koristiti izmjerene temperature brašna, prostorije i vode te kalibrirani faktor miješenja:\n\n> temperatura vode ≈ 3 × ciljna temperatura tijesta − temperatura brašna − temperatura prostorije − toplina koju dodaje miješenje\n\nToplina miješenja (frikcija) ovisi o mikseru, brzini, vremenu, masi tijesta i ručnom radu. Mjeri se vlastitim probnim zamjesima; ne posuđujte faktor tuđeg uređaja. S prefermentom se mora uračunati i njegova temperatura, pa je potreban četverofaktorski izračun ili praktična prilagodba.\n\n**Primjer izračuna vode za Direct:** cilj nakon zamjesa 24°C, brašno 22°C, prostorija 23°C i kalibrirani faktor miješenja 2°C:\n\n> voda = (3 × 24) − 22 − 23 − 2 = 25°C\n\nTo je početna procjena. Nakon zamjesa izmjerite tijesto. Ako je, primjerice, 26°C umjesto 24°C, zabilježite odstupanje i promijenite vodu ili postupak u idućoj seriji; nemojte automatski dodavati led u već zamiješeno tijesto.\n\nHladnjak nije uvijek točno 4°C: izmjerite ga termometrom u području gdje stoji tijesto. Temperatura zraka i sredine tijesta nisu jednake, posebno odmah nakon stavljanja tople mase u hladnjak."
        },
        {
          "id": "temperature-target",
          "title": "Ciljna temperatura nakon zamjesa i prije oblikovanja",
          "level": 3,
          "markdown": "Zapišite temperaturu tijesta odmah po završetku miješenja. To je ciljna temperatura nakon zamjesa. Mjerite je ponovo prije oblikovanja: trenje, fermentacija i okoliš mogu je podići, a hladnjak je snižava postupno. Ne koristite temperaturu kugle neposredno prije pečenja kao zamjenu za mjerenje nakon zamjesa.\n\nHladnjak izmjerite termometrom na mjestu gdje stoji tijesto, po mogućnosti nakon što se vrata neko vrijeme nisu otvarala. Zadana oznaka uređaja nije dokaz da je njegova unutrašnjost točno te temperature."
        },
        {
          "id": "temperature-friction",
          "title": "Faktor miješenja i kalibracija",
          "level": 3,
          "markdown": "Za direktno tijesto u jednostavnom pekarskom modelu vrijedi:\n\n> Temperatura vode = (3 × ciljna temperatura tijesta) − temperatura brašna − temperatura prostorije − faktor miješenja.\n\nUz preferment uključite i njegovu temperaturu:\n\n> Temperatura vode = (4 × ciljna temperatura tijesta) − temperatura brašna − temperatura prostorije − temperatura prefermenta − faktor miješenja.\n\nTo su jednadžbe za **izračun temperature vode**, ne fizički zakon ni automatsko predviđanje konačne temperature. Faktor miješenja je konvencionalni korekcijski član dobiven probnim zamjesom za konkretan stroj, količinu, brzinu i trajanje. To nije jednostavno „koliko se tijesto ugrijalo” mjerenjem prije i poslije.\n\nKalibracija: izmiješajte probnu seriju, zabilježite temperaturu prostorije, brašna, vode (i prefermenta) te izmjerite tijesto odmah nakon miješenja. Uvrstite izmjerenu temperaturu tijesta kao cilj i izračunajte faktor iz iste jednadžbe. Ponovite s jednakom masom i istim brzinama. Ako promijenite stroj, brzinu, masu ili trajanje miješenja, kalibrirajte ponovno. Ako se izračuna voda ispod 0°C, koristite dio odmjerene vode kao led, uračunajte ga u ukupnu vodu i provjerite temperaturu tijesta.\n\n**Primjer kalibracije faktora miješenja:** u istom Direct probnom zamjesu izmjerite brašno 22°C, prostoriju 23°C, vodu 25°C i temperaturu gotovog tijesta 24°C. Uvrstite izmjerenu temperaturu kao cilj:\n\n> faktor = (3 × 24) − 22 − 23 − 25 = 2°C\n\nTo je kalibrirani korekcijski član za taj mikser, količinu i postupak; **nije** dobiven jednostavnim oduzimanjem početne temperature od završne. Ako za sljedeću seriju želite isti cilj i ostali su uvjeti isti, račun vode daje 25°C.\n\n**Primjer s prefermentom:** nakon zasebnog probnog zamjesa izmjerite brašno 21°C, prostoriju 22°C, preferment 18°C, vodu 24°C i tijesto nakon zamjesa 23°C:\n\n> faktor = (4 × 23) − 21 − 22 − 18 − 24 = 7°C\n\nZa cilj 24°C uz iste ulazne temperature i isti postupak:\n\n> voda = (4 × 24) − 21 − 22 − 18 − 7 = 28°C\n\nIzračun je aproksimacija: sastojci nemaju nužno jednaku toplinsku masu, a oblik zdjele, veličina šarže, vrijeme, brzina i okoliš mijenjaju rezultat. Provjerite temperaturu u središtu tijesta odmah nakon zamjesa; bilježite je i prilagodite iduću seriju.\n\nAko formula daje temperaturu vode ispod 0°C, tretirajte to kao znak da se proces mora promijeniti, a ne kao naredbu da ulijete „negativnu” vodu. Prvo smanjite zagrijavanje miksera, predhladite brašno/preferment ili podijelite zamjes. Ako i dalje koristite led, zamijenite njime točno izvagani dio ukupne vode, provjerite da uređaj dopušta led i da se potpuno otopi bez oštećenja; zbroj leda i tekuće vode mora ostati jednak receptnoj vodi. Izmjerite završnu temperaturu i zabilježite je.\n\nPovezano: [hladna fermentacija](#topic-cold-proof), [miješenje](#topic-handling), [poolish](#method-poolish)."
        }
      ]
    },
    {
      "id": "topic-fermentation",
      "title": "Fermentacija i dozrijevanje",
      "description": "Razlikuj fermentaciju od dozrijevanja i procijeni spremnost po više znakova.",
      "introduction": "",
      "sections": [
        {
          "id": "fermentation-process",
          "title": "Fermentacija i enzimske promjene",
          "level": 3,
          "markdown": "**Fermentacija** je metabolička aktivnost kvasca i, u nekim tijestima, bakterija; proizvodi ugljikov dioksid i različite aromatske spojeve. **Dozrijevanje tijesta** obuhvaća širi skup promjena, uključujući enzimsko djelovanje brašna. To nisu sinonimi.\n\nEnzimi poput amilaza oslobađaju manje šećere iz škroba; kvasac ih može koristiti, a šećeri doprinose boji pečene kore. Proteaze mijenjaju proteine i mogu tijesto s vremenom učiniti podatnijim. Te promjene ovise o brašnu, temperaturi, vodi, soli, kvascu i trajanju.\n\nDulje vrijeme nije automatski bolje: preduga ili pretopla fermentacija može oslabiti strukturu, učiniti tijesto ljepljivim, previše kiselim ili slabim. Dulja fermentacija također ne jamči lakšu probavu ni zdravstvenu korist. Ovaj vodič govori o pekarskim svojstvima koja se mogu opažati, ne o zdravstvenim učincima."
        },
        {
          "id": "fermentation-schedules",
          "title": "Kratki, srednji i dugi raspored",
          "level": 3,
          "markdown": "Vrijeme je orijentir koji vrijedi samo uz poznatu temperaturu i količinu kvasca. Za kratki isti-dan raspored planirajte nekoliko sati na sobnoj temperaturi i koristite stanje tijesta da odlučite kad dijeliti. Srednji raspored može kombinirati početni odmor i 12–24 h u hladnjaku. Dugi raspored može trajati dulje, ali traži precizno vaganje, izmjerenu temperaturu hladnjaka i brašno koje zadržava strukturu. To nisu univerzalne granice: konkretni primjeri nalaze se u [receptima](#topic-recipes)."
        },
        {
          "id": "fermentation-readiness",
          "title": "Procjena spremnosti",
          "level": 3,
          "markdown": "- **Na početku:** masa je zbijena i vidi se malo plina.\n- **Tijekom aktivnog razvoja:** površina se zaobljuje, uz rub se pojavljuju mjehurići, masa raste i postaje lakša.\n- **U kasnijoj fazi:** tijesto može početi splašnjavati, postati ljepljivije i gubiti čvrstoću. To može značiti da je fermentacija otišla predaleko; nemojte čekati kraj rasporeda samo zato što timer još radi.\n\nTemperaturu i izgled uvijek usporedite s vremenom iz recepta. Test laganim pritiskom prsta koristite pažljivo i samo kao jedan od znakova: plin u kugli može utjecati na to koliko se udubljenje vraća."
        }
      ]
    },
    {
      "id": "topic-methods",
      "title": "Metode pripreme",
      "description": "Usporedi Direct, Bigu i Poolish uz ručno miješenje te planetarni i spiralni mikser.",
      "introduction": "**Direct** znači da se svi sastojci zamijese u završno tijesto, bez prethodno fermentiranog dijela brašna. Ne znači da se tijesto mora miješati bez pauza ili da se ne može hladiti.",
      "sections": [
        {
          "id": "method-direct",
          "title": "Direct",
          "level": 3,
          "markdown": "Za sve tri izvedbe unaprijed odvažite ukupne sastojke, odvojite propisanu količinu vode za postupno dodavanje i izmjerite brašno, prostoriju i vodu. Ne dodajte vodu koja nije u formuli. Kvasac dodajte prema deklaraciji, sol nakon početnog povezivanja brašna i vode, a ulje ili šećer samo ako ih recept sadrži.\n\nSvježi kvasac izmrvite u brašno ili razmutite u dijelu receptne vode prema receptu i deklaraciji. Aktivni suhi kvasac rehidrirajte samo ako tako nalažu upute konkretnog proizvoda; upotrijebite dio već izvagane vode i temperaturu koju navodi proizvođač. Instant kvasac obično se umiješa u brašno, osim ako deklaracija kaže drukčije. Voda za rehidraciju uvijek ulazi u ukupnu vodu recepta; nemojte je dodavati povrh formule."
        },
        {
          "id": "direct-hand",
          "title": "Ručni zamjes",
          "level": 3,
          "markdown": "1. Pripremite čistu zdjelu, strugač i mjesto za rad; lagano navlažite ruke ako je tijesto mekano. Ne pobrašnjujte ga izdašno.\n2. Dodajte kvasac i većinu vode postupkom primjerenim njegovoj vrsti prema prethodnoj uputi. Miješajte prstima i stiskanjem dok ne nestane suhog brašna.\n3. Ostavite pokriveno 10–20 minuta ako je tijesto kruto ili se trga pri radu; ova pauza nije obavezna za svaku formulu.\n4. Dodajte sol ravnomjerno. Preostalu vodu dodajte u malim obrocima tek kad prethodni dio upije i masa ponovno postane povezana.\n5. Preklopite rub tijesta prema sredini i pritisnite ga; okrenite zdjelu i ponavljajte stiskanje, preklapanje i odmor, umjesto dugog neprekidnog gnječenja. Ulje umiješajte postupno tek nakon što se tijesto povezalo.\n6. Stanite kad nema suhih džepova, masa se može podići kao cjelina i nakon odmora postaje elastičnija. Ako se trga, pokrijte 10–20 minuta; ako se zagrijava ili razlijeva, stanite, izmjerite temperaturu i procijenite hidraciju.\n7. Izmjerite temperaturu odmah po završetku zamjesa i zabilježite je.\n\n**Čvršće tijesto:** koristite prste i strugač, radite kratkim serijama i dajte mu odmore; ne pokušavajte ga silom rastegnuti. **Mekše tijesto:** vlažne ruke ili strugač, manje dodatnog brašna i više podizanja/preklapanja od gnječenja."
        },
        {
          "id": "direct-mixer",
          "title": "Planetarni ili kućni mikser",
          "level": 3,
          "markdown": "1. Provjerite u uputama uređaja dopušteni nastavak, radni ciklus te minimalnu i maksimalnu količinu tijesta. Te granice ovise o modelu; nazivna zapremnina zdjele nije automatski preporučena masa tijesta.\n2. U zdjelu dodajte brašno i kvasac primijenjen prema uputama za njegovu vrstu, zatim većinu receptne vode. Kuku ili drugi nastavak koristite samo kako proizvođač predviđa za tijesto.\n3. Povežite sastojke na najnižoj dopuštenoj postavci. Zaustavite uređaj prije struganja zdjele ili provjere tijesta; ne posežite u zdjelu dok se mikser kreće.\n4. Dodajte ostatak vode postupno kad se tijesto već povezuje. Dodajte sol nakon početne hidratacije, a ulje kasnije i samo ako je u formuli.\n5. Provjeravajte nakon kratkih intervala rada: tijesto može ostati hrapavo, povezati se, zatim postati glađe i elastičnije. Mijesite dalje samo ako struktura još nije dovoljno povezana.\n6. Ako se tijesto penje uz kuku, udara po zdjeli, razlijeva se ili se brzo grije, zaustavite uređaj i slijedite upute modela; smanjite seriju ili dovršite ručno samo ako je sigurno.\n7. Mjerite temperaturu odmah nakon zamjesa. Ne prenosite brzinu, trajanje ili faktor miješenja drugog miksera.\n\nČvrsto tijesto može previše opteretiti mali kućni mikser; mekano tijesto može se omotati oko kuke ili slabije pokupiti sa dna. Ako je količina ili konzistencija izvan radnog opsega uređaja, dovršite je ručno ili odaberite drugi postupak."
        },
        {
          "id": "direct-spiral",
          "title": "Spiralni mikser",
          "level": 3,
          "markdown": "1. Provjerite korisnički priručnik konkretnog spiralnog miksera: dopušteni nastavak, redoslijed rada, zaštitu, minimalnu/maksimalnu količinu, radni ciklus i pravila za isključivanje. Ne pretpostavljajte da svaki model ima iste brzine ili smjerove vrtnje.\n2. Odvažite brašno, kvasac i ukupnu vodu; odvojite samo onu vodu koju recept namjerava dodati postupno ili upotrijebiti za rehidraciju. Učitajte sastojke redoslijedom koji nalažu uređaj i recept. Kvasac pripremite prema uputama za njegovu vrstu i deklaraciji proizvoda.\n3. Pokrenite dopušteni početni režim samo da se sastojci povežu i nestanu suhi džepovi. Tijesto se treba okupljati u masu koja se obrađuje uz spiralu i zdjelu, ali njegovo kretanje ovisi o modelu, veličini šarže i hidraciji.\n4. Dodajte preostalu vodu postupno tek kad je prethodna količina uklopljena. Dodajte sol nakon početnog povezivanja i ulje kasnije ako ga formula sadrži. Ne ulijevajte dodatnu vodu samo zato što tijesto kratko prianja uz zdjelu.\n5. Provjeravajte između dopuštenih radnih ciklusa: **povezano** znači da nema suhog brašna; **razvijeno** znači da je masa elastična i drži se zajedno; **pregrijano** znači da je temperatura nakon zamjesa iznad cilja ili masa postaje neuobičajeno mekana/ljepljiva. Ne čekajte da se pregrijavanje vidi kao kvar.\n6. Zaustavite kad je struktura dovoljna za recept. Isključite uređaj prije dodira, struganja ili uzorkovanja tijesta. Izmjerite temperaturu odmah, a faktor miješenja bilježite zasebno za ovaj mikser, masu i postupak.\n\nAko je šarža ispod minimuma i ne dohvata tijesto ili iznad maksimuma i opterećuje motor, nemojte nastavljati u nadi da će se samo urediti. Poštujte priručnik, smanjite/povećajte količinu samo uz preračun formule ili završite drugim prikladnim načinom.\n\n**Znakovi dovoljnog razvoja:** tijesto je ujednačeno, elastično i rastezljivo; tanki dio može se pažljivo rastegnuti prije pucanja. „Prozor” je pomoćni test, ne obvezan ideal za svaku hidraciju, brašno ili stil.\n\n**Ako je tijesto pretijesno:** pokrijte ga i ostavite 10–20 minuta, pa ponovno pokušajte. **Ako je vruće:** zaustavite miješenje, raširite masu u posudi i po potrebi je kratko ohladite. Nemojte pokušavati ispraviti pregrijavanje dodatnim brašnom."
        },
        {
          "id": "method-biga",
          "title": "Biga",
          "level": 3,
          "markdown": "Biga je čvršći preferment od brašna, vode i kvasca. Udio brašna u bigi obično se iskazuje kao dio **ukupnog brašna**: 40% znači da je 40% receptnog brašna u bigi, a ne da je 40% ukupne mase tijesta biga.\n\nZa čvršću bigu često se koristi približno 40–50% vode prema brašnu u tom prefermentu. To je hidratacija bige, ne konačna hidratacija pizze. Postoje različiti protokoli: količina kvasca, temperatura i trajanje moraju se međusobno uskladiti. Jedan dokumentirani protokol koristi 44–45% vode, 1% svježeg kvasca prema brašnu u bigi i 18 sati na 18°C; to je specifičan postupak, ne univerzalna preporuka."
        },
        {
          "id": "biga-readiness",
          "title": "Priprema i spremnost",
          "level": 4,
          "markdown": "1. Od ukupnog brašna izdvojite količinu za preferment; isto učinite s vodom i kvascem.\n2. Kratko pomiješajte dok nema suhih džepova. Ne mijesite u glatko, potpuno razvijeno tijesto ako je cilj mrvičasta, čvrsta biga.\n3. Pokrijte posudu tako da se površina ne suši, ali da posuda ima dovoljno prostora za rast.\n4. Držite na temperaturi koju traži odabrani protokol; mjerite stvarnu temperaturu, a ne samo postavku prostorije.\n5. Zrela biga obično je blago napuhnuta, prožeta manjim šupljinama i mirisom ugodne fermentacije. Ako je spljoštena, mokra, izrazito alkoholna ili oštro neugodna, možda je prešla vrhunac.\n\nZa malu kućnu količinu najčešće je dovoljan ručni postupak: prstima ili lopaticom ravnomjerno navlažite mrvice. Planetarni ili spiralni mikser koristite samo kad je šarža unutar proizvođačeva radnog raspona; zaustavite ga čim nema suhih dijelova. Biga se ne razvija kao završno tijesto, pa dug rad nepotrebno zagrijava i zaglađuje je.\n\nNe miješajte „zrelu” s dvostruko naraslom: čvrsta biga ne mora udvostručiti volumen. Zabilježite temperaturu i vrijeme. Ako je previše sazrela, možete je iskoristiti samo ako miris i struktura ostaju prihvatljivi, uz skraćivanje kasnijeg rasporeda; nemojte prikrivati neugodan miris."
        },
        {
          "id": "biga-final-mix",
          "title": "Završni zamjes",
          "level": 4,
          "markdown": "Natrgajte ili narežite bigu na komade, dodajte dio preostale vode i pustite da omekša dok je povezujete s preostalim brašnom. Dodajte ostatak vode postupno, zatim sol; na kraju dodajte ulje samo ako ga završna formula sadrži. Cilj je ravnomjerno tijesto bez komada suhe bige, ne nužno „savršeno čista” posuda.\n\nU tablici recepta posebno iskažite ukupno brašno i vodu, zatim razdvojite njihovu raspodjelu u bigu i završni zamjes. Ne pribrajajte brašno i vodu bige drugi put ukupnom receptu.\n\n**Ručno:** odvojite komade bige i omekšajte ih u dijelu preostale vode. Dodajte preostalo brašno, stisnite i preklapajte dok se masa ne poveže, pa odmorite ako se opire. Postupno dodajte preostalu vodu, zatim sol i ulje. Završite kad nema suhih komada bige i tijesto se može podići kao jedna masa.\n\n**Planetarni mikser:** provjerite dopuštenu količinu i kuku. Počnite s većinom vode i komadima bige; kad se biga rasprši, dodajte preostalo brašno. Vodu dodajte po malim obrocima nakon što se tijesto pokupi. Dodajte sol nakon povezivanja i ulje kasno. Zaustavite uređaj prije provjere; ne forsirajte tijesto koje se penje uz kuku ili udara u zdjelu.\n\n**Spiralni mikser:** prvo provjerite minimalnu količinu; mala kućna biga često nije prikladna za zdjelu spirale. Ako je serija prikladna, slijedite redoslijed iz priručnika, rasporedite komade bige i većinu preostale vode tako da se ravnomjerno pokupe, pa vodu dodajte postupno. Dodajte sol i ulje prema receptu tek nakon povezivanja. Stanite kad nema komada prefermenta, tijesto je razvijeno za odabrani stil i temperatura je blizu cilja."
        },
        {
          "id": "method-poolish",
          "title": "Poolish",
          "level": 3,
          "markdown": "Poolish je tekući preferment, najčešće jednakih masa vode i brašna, odnosno 100% hidratacije. Udio se računa prema brašnu koje se nalazi u poolishu. Ako 35% ukupnog brašna ide u poolish, preostalih 65% brašna dodaje se u završnom zamjesu."
        },
        {
          "id": "poolish-readiness",
          "title": "Priprema i spremnost",
          "level": 4,
          "markdown": "1. U posudu odvažite brašno za poolish, jednaku masu vode i malu, namjerno odmjerenu količinu kvasca.\n2. Pomiješajte dok ne nestane suho brašno; tekuća smjesa ne treba se mijesiti kao završno tijesto.\n3. Pokrijte i fermentirajte prema receptu i temperaturi.\n4. Procijenite spremnost: vidljivi mjehurići po površini i stijenkama, povećan volumen te površina koja je još blago zaobljena ili upravo počinje ravnati. Potpuno urušena smjesa s jakim alkoholnim mirisom vjerojatno je prošla vrhunac.\n\nZa tipičnu malu količinu poolisha dovoljna je zdjela i žlica/pjenjača; mikser nije potreban jer je cilj samo izjednačiti vodu, brašno i kvasac, ne razviti glutensku mrežu. Ako je količina velika i koristi se mikser, mora biti u dopuštenom rasponu uređaja i treba stati čim nema suhih džepova. Spiralni mikser osobito nije primjeren maloj količini koja ne zahvaća spiralu.\n\nVrijeme ovisi o količini kvasca, temperaturi i udjelu poolisha. Raspon od više sati na hladnijoj sobnoj temperaturi može biti praktičan, ali se ne prenosi bez prilagodbe na toplu kuhinju. Umjesto da povećavate ili smanjujete samo sat, pratite stanje.\n\nZa završni zamjes dodajte poolish i preostalo brašno. Vodu koja nedostaje do **ukupne** količine dodajte postupno. Potom umiješajte sol i eventualno ulje. Poolish već sadrži dio ukupne vode, brašna i kvasca; na popisu završnog zamjesa navedite samo ostatak.\n\n**Ručno:** promiješajte poolish s preostalim brašnom i većinom završne vode. Kad se smjesa poveže, dodajte ostatak vode malo po malo, zatim sol i ulje ako su u receptu. Kratko radite stiskanjem i preklapanjem, odmorite ako se masa opire i provjerite temperaturu.\n\n**Planetarni mikser:** provjerite dopuštenu količinu i nastavak. U zdjelu dodajte poolish, preostalo brašno i većinu završne vode; povežite na dopuštenoj početnoj postavci. Dodajte zadržanu vodu postupno kad je masa pokupila brašno, pa sol i na kraju ulje. Zaustavljajte za provjeru i ne slijedite unaprijed zadani broj minuta.\n\n**Spiralni mikser:** ne koristite ga ako poolish i završna količina ne dosežu minimalnu masu iz priručnika. Za odgovarajuću šaržu učitajte poolish, brašno i većinu vode prema uputama uređaja; dodajte ostatak vode tek kad se tijesto poveže. Dodajte sol i eventualno ulje kasnije, pazite kako se tijesto okuplja uz spiralu i zaustavite čim je razvijeno za recept, prije porasta temperature iznad cilja."
        }
      ]
    },
    {
      "id": "topic-handling",
      "title": "Miješenje i rukovanje tijestom",
      "description": "Vježbaj odmore, presavijanje, bulk-fermentaciju, dijeljenje i kuglanje.",
      "introduction": "Miješenje raspoređuje sastojke i razvija strukturu. Nije potrebno miješati što dulje: pretjerani rad može zagrijati tijesto i oštetiti strukturu, a odmor između kratkih serija rada često olakšava razvoj.",
      "sections": [
        {
          "id": "handling-rests",
          "title": "Autoliza, pauze i presavijanja",
          "level": 3,
          "markdown": "- **Autoliza** je odmor nakon miješanja brašna i vode prije dodavanja kvasca i soli. Kao početak može poslužiti 20–30 minuta. Kod tijesta s malo vode ili nekih posebnih brašna učinak može biti malen; nemojte ostaviti dugo na toplom i nezaštićeno.\n- **Pauza/odmor** nakon zamjesa smanjuje napetost. Pokrijte tijesto kako se ne bi stvorila suha kožica.\n\nBezglutensko tijesto ne prolazi autolizu ni presavijanje na isti način kao pšenično tijesto. Slijedite upute proizvođača bezglutenske mješavine.\n\n**Znak da treba pauza:** tijesto puca i skuplja se kad ga širite. Pokrijte 10–20 minuta. **Znak da ne treba dodatno mijesiti:** glatko je, elastično i počinje se odvajati od zdjele; daljnje miješenje podiže temperaturu, a ne nužno kvalitetu."
        },
        {
          "id": "handling-folds",
          "title": "Presavijanje korak po korak",
          "level": 3,
          "markdown": "Presavijanje je nježan rad na tijestu tijekom bulk-fermentacije, a nije isto što i gnječenje ili kuglanje.\n\n1. Pripremite čistu posudu i strugač. Navlažite ruke ili ih vrlo tanko nauljite; dodatno brašno može promijeniti recept i osušiti površinu.\n2. Otkrijte tijesto, odvojite rubove od stijenke zdjele i uhvatite jednu stranu široko ispod površine, a ne samo za tanki rub.\n3. Podignite stranu polako. Rastegnite je samo dok se tijesto izduži bez stanjivanja, cijepanja ili snažnog otpora; čim osjetite otpor, stanite.\n4. Preklopite podignuti dio preko sredine mase i nježno ga položite, bez pritiskanja plina iz cijele površine.\n5. Okrenite zdjelu za približno četvrt kruga i ponovite s drugom stranom. Nastavite sa sve četiri strane; to je jedan potpuni set presavijanja.\n6. Ako je masa još izrazito slaba i širi se odmah po spuštanju, pokrijte je 20–30 min pa procijenite treba li drugi set. Ako je već napeta, glatka i zadržava oblik, nemojte dodavati presavijanja.\n7. Pokrijte posudu i nastavite bulk-fermentaciju prema receptu.\n\n**Čvršće tijesto:** navlažite ruke, odvojite rub strugačem i skratite potez; ne vucite do krajnje duljine. **Mekše tijesto:** zahvatite šire i podignite samo koliko je potrebno da se preklopi; radite mokrom rukom ili strugačem. Ako se tijesto trga, odmah ga položite, pokrijte i odmorite. Presavijanja nisu obvezna za već snažno razvijeno tijesto i ne primjenjuju se na bezglutensku smjesu."
        },
        {
          "id": "handling-bulk",
          "title": "Fermentacija u masi",
          "level": 3,
          "markdown": "**Bulk-fermentacija** je fermentacija cijele mase od završetka zamjesa do dijeljenja. **Završno dizanje kugli** počinje nakon dijeljenja i oblikovanja kugli. Za tegliju se završno dizanje može odvijati u plehu, ne u kuglama."
        },
        {
          "id": "handling-bulk-readiness",
          "title": "Procjena bulk-fermentacije",
          "level": 4,
          "markdown": "Stavite tijesto u pokrivenu, po mogućnosti prozirnu posudu ravnih stranica i označite početnu visinu. Jedno ili više nježnih presavijanja može pomoći ako je masa slaba. Ne čekajte određeni postotak rasta pod svaku cijenu: ponekad je dovoljno jasno povećanje volumena i vidljiva prozračnost, a kod nekih hladnih rasporeda bulk ostaje kratak."
        },
        {
          "id": "handling-balling",
          "title": "Dijeljenje i kuglanje",
          "level": 3,
          "markdown": "1. Pripremite vagu, strugač i kutiju/posude s poklopcem. Lagano ih nauljite ako se tijesto lijepi; radnu plohu ostavite bez brašna ili je jedva pobrašnite.\n2. Izvažite ukupnu masu tijesta. Izračunajte broj i masu porcija, pa ih odvojite strugačem čistim rezom; nemojte trgati dugačke komade.\n3. Stavite jednu porciju hrapavom stranom prema gore. Skupljajte rubove prema sredini u nekoliko zahvata, okrećući komad nakon svakog zahvata, dok se rubovi ne susretnu.\n4. Stisnite spoj na donjoj strani da se zatvori. Okrenite porciju tako da glatka strana bude gore, a spoj dolje.\n5. Obuhvatite kuglu objema rukama kao laganom čašom. Dlanovi vode rubove, a prsti ne stišću vrh; kratkim povlačenjem kugle po plohi zategnite površinu. Okrenite je malo i ponovite nekoliko kratkih poteza.\n6. Stanite čim je gornja površina glatka i napeta, a donji spoj zatvoren. Ako se površina počinje trgati, odmah prestanite, pokrijte i odmorite 10–20 min; ne pokušavajte napetost povećati silom.\n7. Prenesite kuglu spojem prema dolje u posudu, ostavite razmak za širenje i pokrijte da se ne stvori kožica.\n\nKod mekšeg tijesta koristite strugač, malo ulja na rukama i manje povlačenja; ne dodajte šaku brašna. Kod čvršćeg tijesta pustite ga pokrivenog da se opusti prije zatezanja i primijenite manju silu. Kugla spremna za otvaranje obično je narasla, mekana i podatna, uz vidljive sitne plinove. Ako je tvrda i vraća se, treba joj odmor; ako se razlije, lijepi i puca pri podizanju, možda je pretopla, premekana ili prefermentirana."
        }
      ]
    },
    {
      "id": "topic-cold-proof",
      "title": "Hladna fermentacija i priprema za pečenje",
      "description": "Razdvoji hlađenje, temperiranje, završni odmor kugli i dizanje tijesta u plehu.",
      "introduction": "Hladnjak usporava, ali ne zaustavlja potpuno fermentaciju. Tijesto se ne ohladi odmah do temperature hladnjaka: sredina velike mase ili zatvorene kutije može ostati topla neko vrijeme. Zato je važna kombinacija vremena, mase, početne temperature i mjerenja hladnjaka.",
      "sections": [
        {
          "id": "cold-stage",
          "title": "Hlađenje i temperaturne faze",
          "level": 3,
          "markdown": "Zapišite odvojeno:\n\n- vrijeme od zamjesa do ulaska u hladnjak;\n- vrijeme u hladnjaku i izmjerenu temperaturu;\n- je li u hladnjak išla masa ili kugle;\n- vrijeme temperiranja izvađenih kugli;\n- vrijeme završnog dizanja u plehu, ako je riječ o tegliji.\n\n„Temperiranje” znači da se hladno tijesto prilagodi sobnoj temperaturi radi lakšeg rukovanja. To nije isto što i završno dizanje: hladna kugla može se zagrijati, ali još biti premalo fermentirana; topla kugla može biti previše fermentirana."
        },
        {
          "id": "cold-balls",
          "title": "Temperiranje i završna fermentacija kugli",
          "level": 3,
          "markdown": "Krenite s približno 1–3 sata na 20–23°C za kugle, ali tretirajte to samo kao plan početka. Kugla spremna za oblikovanje popušta pri laganom pritisku i rasteže se bez nasilnog povlačenja. Ako se odmah skuplja, dajte joj još odmora. Ako je vrlo mlohava i ljepljiva, oblikujte je nježno ili prijeđite na pečenje prije daljnjeg slabljenja."
        },
        {
          "id": "cold-pan",
          "title": "Završno dizanje u plehu",
          "level": 3,
          "markdown": "Kod teglije i nekih bezglutenskih tijesta tijesto se nakon odmora utiskuje u pleh, pa završno dizanje nastavlja u njemu. Tražite vidljivo napuhanu masu koja se lagano trese kad pomaknete pleh, ali još zadržava oblik. To nije isto što i zagrijavanje tijesta iz hladnjaka niti bulk-fermentacija cijele mase."
        }
      ]
    },
    {
      "id": "topic-styles",
      "title": "Stilovi pizze",
      "description": "Upoznaj Napolitanu, Romanu Tondu, Romanu Tegliu i New York stil.",
      "introduction": "",
      "sections": [
        {
          "id": "style-neapolitan",
          "title": "Napolitana: tradicionalni i suvremeni pristup",
          "level": 3,
          "markdown": "Naziv obuhvaća više praksi. Tradicionalni certificirani protokol nije sinonim za svaku modernu pizzu s napuhanim rubom: u vlastitoj specifikaciji definira sastojke, obradu i pečenje na vrlo visokoj temperaturi. Ta pravila vrijede za taj standard; kućna pećnica ne može automatski dati isti rezultat."
        },
        {
          "id": "neapolitan-traditional",
          "title": "Tradicionalni okvir",
          "level": 4,
          "markdown": "Tradicionalno tijesto oslanja se na brašno, vodu, sol i kvasac, bez ulja i šećera u samom tijestu. Kugle se ručno otvaraju tako da se plin usmjerava prema rubu, a sredina ostaje tanka. U peći koja postiže temperaturu reda 430–480°C pizza se peče približno 60–90 sekundi; raspon pripada toj klasi opreme i standardu, ne običnoj kućnoj pećnici."
        },
        {
          "id": "neapolitan-home",
          "title": "Suvremene kućne prilagodbe",
          "level": 4,
          "markdown": "Kod kuće se mogu koristiti dulja hladna fermentacija, drugačiji postotak vode, mala količina ulja ili šećera te pečenje na čeliku, kamenu ili u kućnoj pizza peći. To su svjesne prilagodbe, ne „pravila” tradicionalnog protokola. Za 250 g kuglu počnite oko 58–63% vode, 2,5–3% soli i prilagodite kvasac rasporedu. Otvarajte od sredine prema rubu, a zatim prebacite tijesto na lopatu uz minimalno dodatno brašno."
        },
        {
          "id": "neapolitan-mixing",
          "title": "Miješenje napolitane",
          "level": 4,
          "markdown": "Za malu kućnu seriju ručni zamjes omogućuje kratke odmore i nježno razvijanje. Planetarni i spiralni mikser mogu se koristiti samo ako je količina u njihovu dopuštenom rasponu; zaustavite se kad je tijesto povezano i rastezljivo, prije nepotrebnog zagrijavanja. Ne forsirajte potpuno razvijenu prozirnu opnu. Pogledajte [Direct ručno](#direct-hand), [planetarni mikser](#direct-mixer) i [spiralni mikser](#direct-spiral).\n\n**Spremnost:** rub je prozračan i podatljiv, sredina dovoljno tanka da se ispeče bez isušivanja. Ako je rub zbijen, provjerite je li tijesto bilo hladno, nedovoljno odmoreno ili previše pritisnuto pri oblikovanju."
        },
        {
          "id": "style-tonda",
          "title": "Romana Tonda",
          "level": 3,
          "markdown": ""
        },
        {
          "id": "tonda-shaping",
          "title": "Oblikovanje i pečenje",
          "level": 4,
          "markdown": "Romana Tonda je tanka, okrugla rimska pizza koja se često peče dulje i hrskavija je od mekše napolitane. Recepti se razlikuju; nije svaki jednake debljine, hidratacije ili razine hrskavosti. Valjak se često koristi za tanko i ravnomjerno otvaranje.\n\nPočetni okvir za kućnu probu može biti 58–63% vode, približno 2,5–3% soli i oko 2–4% ulja, uz brašno koje podnosi odabrani raspored. Za vrlo tanku i hrskavu varijantu počnite bliže donjem kraju raspona; mekša kućna izvedba može koristiti višu hidrataciju. Ulje je česta prilagodba stila, a ne univerzalni uvjet. Kugla treba biti dovoljno odmorena da se može otvoriti tanko bez skupljanja.\n\n1. Pobrašnite kuglu i otvorite je ravnomjerno rukama ili valjkom do oko 28–30 cm, bez debelih mjehura.\n2. Ostavite ravnomjernu tanku sredinu; kod valjanja provjerite da rubovi nisu potpuno stisnuti.\n3. Prenesite na lagano pobrašnjenu lopatu ili pleh i dodajte umjerenu količinu nadjeva.\n4. U kućnoj pećnici pecite na dobro zagrijanom čeliku/kamenu oko 6–10 min pri 230–280°C, prateći dno i površinu.\n\nTonda može potamniti odozdo prije nego što se nadjev zagrije. Podesite visinu rešetke, količinu umaka i temperaturu prema stvarnom pečenju. Cilj je ravnomjerno tanka podloga i hrskavost, ne nužno isti rezultat kao u profesionalnoj peći."
        },
        {
          "id": "tonda-mixing",
          "title": "Miješenje Tonde",
          "level": 4,
          "markdown": "Tonda se često oblikuje tanko, pa ravnomjerno povezano, odmoreno tijesto lakše se valja ili otvara bez skupljanja. Ručno koristite kratki rad i odmor; mikserom stanite kad je masa povezana i dovoljno rastezljiva. Za vrlo čvrsto tijesto prvo provjerite receptnu vodu i brašno; nemojte pokušavati nadoknaditi suhoću dužim radom. Primijenite postupak [Direct ručno](#direct-hand) ili odgovarajući [planetarni](#direct-mixer)/[spiralni](#direct-spiral) mikser samo unutar njegovih granica."
        },
        {
          "id": "style-teglia",
          "title": "Romana Teglia",
          "level": 3,
          "markdown": ""
        },
        {
          "id": "teglia-shaping",
          "title": "Oblikovanje i pečenje u plehu",
          "level": 4,
          "markdown": "Romana Teglia peče se u nauljenom pravokutnom plehu. Za razliku od okrugle tonda kugle, tijesto se obično čuva kao masa i rasteže u plehu u jednoj ili više faza. Završno dizanje događa se u plehu.\n\nZa početak mnogi kućni recepti koriste približno 70–80% vode, ali raspon nije univerzalna formula: ovisi o brašnu, plehu, debljini i načinu fermentacije. Ako je ovo prvi pokušaj, ostanite bliže donjem kraju. Viša hidratacija zahtijeva dobro vaganje, posudu za preklapanje i pažljivo prenošenje.\n\n1. Nakon miješenja ostavite masu pokrivenu.\n2. Ako je slaba, napravite jedno ili dva nježna presavijanja s razmakom, dok se masa ne zategne.\n3. Fermentirajte kao masu, hladno ili na sobnoj temperaturi prema receptu.\n4. Nauljite pleh. Prebacite tijesto, odmorite ga i utisnite prstima prema rubovima bez kidanja.\n5. Ako se skuplja, pokrijte i pričekajte 15–20 minuta prije nastavka.\n6. Pustite da se tijesto vidljivo napuhne u plehu, dodajte nadjev prema planu i pecite.\n\n**Greška:** oblikovati kugle kao za tonda i zatim pokušati ih ponovno spojiti u plehu. To može stvoriti neujednačenu debljinu. **Odmah:** nježno poravnajte, odmorite i nastavite s jednom masom."
        },
        {
          "id": "teglia-mixing",
          "title": "Miješenje Teglie",
          "level": 4,
          "markdown": "Kod mekšeg tijesta zadržite dio vode za postupno dodavanje i provjeravajte da masa upija svaki dio. Ručno koristite mokre ruke i pauze; planetarni ili spiralni mikser koristite samo ako količina i hidracija odgovaraju uputama uređaja. Nakon zamjesa ojačajte tijesto po potrebi jednim ili dvama opisanim [presavijanjima](#handling-folds), umjesto da ga dugo mijesite. Uređaj koji ne zahvaća malu masu nije prikladan za tu seriju."
        },
        {
          "id": "style-new-york",
          "title": "New York",
          "level": 3,
          "markdown": ""
        },
        {
          "id": "new-york-shaping",
          "title": "Oblikovanje, nadjev i pečenje",
          "level": 4,
          "markdown": "New York stil obično ima tanku, savitljivu sredinu, izraženiji ali ne prevelik rub i dno koje se može zapeći i presaviti. To su opisne smjernice, ne jedan službeni sastav. Recepti se razlikuju po brašnu, šećeru, ulju, vodi i fermentaciji.\n\nKao kućni početak pokušajte 60–65% vode, 2–2,7% soli, 1–3% ulja i po želji 0–2% šećera. Jače krušno brašno često je praktično, no provjerite deklaraciju i oblikovanje. Hladna fermentacija od 24–48 sati čest je raspored, ali za količinu kvasca treba uračunati temperaturu hladnjaka, sobnu fazu i trajanje temperiranja.\n\nTijesto se otvara ravnomjerno, uz zadržavanje laganog ruba. Ne istanjujte sredinu toliko da nadjev probije. Kućna pećnica peče dulje od peći za napolitanu; tanja kora i umjerena količina vlažnog nadjeva smanjuju rizik od gnjecave sredine."
        },
        {
          "id": "new-york-mixing",
          "title": "Miješenje New Yorka",
          "level": 4,
          "markdown": "Razvijte ravnomjernu, rastezljivu strukturu koja može zadržati tanku sredinu i podignuti rub; odmorite ako se tijesto skuplja. Ručno radite u kratkim serijama ili uporabite kućni/spiralni mikser unutar proizvođačevih granica. Dodajte ulje nakon početnog povezivanja kad tako nalaže formula. Pogledajte [Direct ručno](#direct-hand), [planetarni](#direct-mixer) i [spiralni](#direct-spiral) postupak."
        }
      ]
    },
    {
      "id": "topic-gluten-free",
      "title": "Bezglutensko tijesto",
      "description": "Pripremi zasebno bezglutensko tijesto i spriječi unakrsni kontakt.",
      "introduction": "Bezglutenska mješavina ne stvara pšeničnu glutensku mrežu. Vodu i vezivnu strukturu osiguravaju sastav mješavine i eventualni dodaci poput psylliuma ili ksantana. Svaka mješavina može se ponašati drukčije; provjerite deklaraciju i alergene.",
      "sections": [
        {
          "id": "gf-blend",
          "title": "Mješavina i vezivo",
          "level": 3,
          "markdown": "- Ako mješavina već sadrži vezivo, ne dodajte automatski još psylliuma.\n- Ako nema veziva, nemojte pretpostaviti da će ista količina dodatka raditi s drugim škrobom/brašnom."
        },
        {
          "id": "gf-handling",
          "title": "Miješanje i oblikovanje",
          "level": 3,
          "markdown": "- Smjesa je često mekša i može se utiskivati mokrim ili nauljenim prstima u pleh; ne pokušavajte je razvijati kao pšeničnu kuglu.\n- Odmor nakon miješanja služi hidrataciji škroba i veziva. Presavijanje radi glutenske čvrstoće nije potrebno.\n- Pečenje u plehu ili na papiru može olakšati rukovanje.\n- Planetarni nastavak ili spiralni mikser nisu automatski prikladni: provjerite upute mješavine i minimalnu/maksimalnu količinu uređaja. Ako uputa proizvoda traži ručno miješanje ili miješalicu, slijedite je; ne koristite gluten-testove ni pšenična presavijanja."
        },
        {
          "id": "gf-bake",
          "title": "Fermentacija i pečenje",
          "level": 3,
          "markdown": "Promatrajte porast, mjehuriće i strukturu površine, ali nemojte očekivati iste znakove elastičnosti kao kod pšeničnog tijesta. Predugo dizanje može oslabiti masu i otežati prenošenje. Tijesto pecite do čvrste sredine i dobro obojenog dna; u nekim receptima pomaže kratko predpečenje prije nadjeva."
        },
        {
          "id": "gf-safety",
          "title": "Križna kontaminacija",
          "level": 3,
          "markdown": "Za osobe s celijakijom ili medicinskom potrebom za izbjegavanjem glutena, koristite označene bezglutenske sastojke, čiste posude, plohu, pribor i pećnicu te pazite na brašno u zraku i zajednički kamen/čelik. Ovaj vodič ne jamči odsutnost unakrsne kontaminacije."
        }
      ]
    },
    {
      "id": "topic-toppings",
      "title": "Umak, sir i nadjevi",
      "description": "Upravljaj vlagom, količinama i redoslijedom umaka, sira i nadjeva.",
      "introduction": "Nadjev utječe na pečenje jednako kao tijesto. Previše vode hladi sredinu, omekšava podlogu i produljuje pečenje.",
      "sections": [
        {
          "id": "toppings-moisture",
          "title": "Vlažnost i priprema",
          "level": 3,
          "markdown": "- **Rajčica:** pasirane ili usitnjene rajčice posolite prema okusu. Ako su izrazito vodenaste, ocijedite ili koristite manje; dugo kuhanje nije obavezno.\n- **Mozzarella:** svježu mozzarellu ocijedite i narežite unaprijed. Sir s nižim udjelom vlage praktičan je za kućne pećnice, ali mijenja okus i teksturu.\n- **Povrće:** gljive, tikvice i drugo vlažno povrće mogu se prethodno kratko termički obraditi ili staviti u manjoj količini.\n- **Meso:** koristite sastojke koji su sigurni za konzumaciju nakon predviđenog vremena pečenja; sirovo meso ili perad mogu zahtijevati prethodno kuhanje."
        },
        {
          "id": "toppings-amounts",
          "title": "Količine i redoslijed",
          "level": 3,
          "markdown": "Kao početak za pizzu promjera 28–32 cm upotrijebite približno 50–80 g umaka i 70–100 g sira. Za tanku Romanu ili New York često je bolje krenuti od donjeg kraja. Na plehu 30 × 40 cm počnite s približno 100–150 g umaka i 150–220 g sira. To su kućne početne količine, ne stilskim pravilima zadane norme. Rasporedite umak ravnomjerno i tanko, zatim sir i umjerenu količinu nadjeva. Osjetljivo svježe bilje i završno ulje dodajte nakon pečenja ili pri kraju."
        },
        {
          "id": "toppings-safety",
          "title": "Sigurno pečenje nadjeva",
          "level": 3,
          "markdown": "Sirovo meso ili perad mogu zahtijevati prethodnu termičku obradu; nemojte pretpostaviti da će kratko pečenje pizze uvijek biti dovoljno. Ako je podloga pečena, a nadjev nije, završite nadjev zasebno na način primjeren sastojku. Vrijeme ovisi o stvarnoj pećnici i masi nadjeva; pratite boju, topljenje i sigurno pečenje sastojaka."
        }
      ]
    },
    {
      "id": "topic-equipment",
      "title": "Pećnice i oprema",
      "description": "Odaberi kamen, čelik, pleh ili pizza peć i procijeni toplinu.",
      "introduction": "",
      "sections": [
        {
          "id": "equipment-surface",
          "title": "Površina i položaj",
          "level": 3,
          "markdown": "| Oprema | Prednosti | Na što paziti |\n|---|---|---|\n| Obična kućna pećnica | Dostupna; pogodna za Romanu, New York i tegliju. | Ograničena gornja temperatura i često slabije gornje zračenje. |\n| Kamen za pečenje | Daje ravnomjerniju toplinu i može pomoći dnu. | Predgrijati dugo; ne izlagati temperaturnom šoku ni vodi dok je vruć. |\n| Čelik | Brzo prenosi toplinu i snažno zapeče dno. | Može prebrzo potamniti dno; mijenjajte visinu i vrijeme. |\n| Pleh | Olakšava tegliju i bezglutensko tijesto. | Tanki ili tamni plehovi jače tamne; pratite rub i dno. |\n| Vanjska pizza peć | Daje visoku temperaturu i kratko pečenje. | Mjerite pod i svod odvojeno ako je moguće; zakrenite pizzu i pazite na vatru. |\n\nZa kamen ili čelik predgrijte pećnicu u skladu s uputama opreme, često 45–60 minuta, jer zaslon pećnice ne govori temperaturu same ploče. Infracrveni termometar pomaže, ali mjeri površinu koju ciljate i može pogriješiti ovisno o emissivnosti i sjaju. Za Ooni ili sličnu peć mjerite pod i ostavite ga da se vrati na temperaturu između pizza."
        },
        {
          "id": "equipment-preheat",
          "title": "Predgrijavanje i oporavak",
          "level": 3,
          "markdown": "U običnoj pećnici postavite kamen ili čelik na gornju polovicu pećnice ako trebate više topline odozgo, ili niže ako se gornji grijač prebrzo zapeče. Ne oslanjajte se samo na zvučni signal pećnice; površina mora doseći stabilnu temperaturu. Imajte na umu da pizza lokalno hladi podlogu pa prije sljedeće pričekajte da se kamen ili čelik oporavi. Nikada ne polijevajte vrući kamen ili staklo vodom."
        },
        {
          "id": "equipment-tools",
          "title": "Radna oprema",
          "level": 3,
          "markdown": "**Radna oprema:** vaga, termometar za tijesto/prostoriju, kutija s poklopcem, strugač, lopata ili pleh, timer i bilježnica. Digitalni infracrveni termometar je koristan, ali nije zamjena za temperaturu tijesta."
        }
      ]
    },
    {
      "id": "topic-troubleshooting",
      "title": "Rješavanje problema",
      "description": "Poveži znakove tijesta i pečene pizze s mogućim uzrocima i prilagodbama.",
      "introduction": "",
      "sections": [
        {
          "id": "troubleshooting-table",
          "title": "Dijagnoza prema simptomu",
          "level": 3,
          "markdown": "| Simptom | Mogući uzrok | Što odmah napraviti | Sljedeći put |\n|---|---|---|---|\n| Kugla se vraća i ne širi | Nedovoljno odmorena, hladna ili previše zategnuta | Pokrijte i odmorite 15–20 min; otvorite nježno | Bilježite temperaturu i ostavite dovoljno odmora nakon kuglanja |\n| Tijesto se kida | Slab razvoj, preniska hidratacija, previše napeto ili brašno s drukčijim svojstvima | Odmor, zatim oprezno oblikovanje | Promijenite jednu varijablu; razmotrite nježan preklop |\n| Tijesto se lijepi i razlijeva | Previše vode za brašno, pretoplo, preduga fermentacija ili slaba struktura | Ohladite kratko, koristite strugač i lagano pobrašnite radnu površinu | Smanjite vodu 1–2 boda ili skratite/toplinski prilagodite fermentaciju |\n| Kugla se napuhala pa splasnula | Vjerojatno prešla vrhunac; moguće i preslaba struktura | Pecite čim možete, nježno; ne pokušavajte je snažno ponovno kuglati | Smanjite kvasac ili vrijeme, ohladite ranije |\n| Nema vidljivog rasta | Kvasac slab, tijesto hladno, sol/kvasac pogrešno izvagani | Provjerite temperaturu; pričekajte na toplijem mjestu i pratite stanje | Provjerite svježinu kvasca i temperaturu nakon zamjesa |\n| Dno izgori, vrh je blijed | Čelik/kamen prevruć u odnosu na gornju toplinu ili preniska rešetka | Podižite pizzu/rešetku, skratite vrijeme na površini | Podesite položaj i temperaturu, koristite završno gornje grijanje |\n| Vrh izgori, dno je blijedo | Gornji grijač prejak ili površina nedovoljno predgrijana | Pomaknite niže ili smanjite gornju toplinu | Dulje predgrijte površinu i prilagodite rešetku |\n| Sredina je mokra | Previše umaka/sira, predebela sredina, niska toplina | Produžite pečenje ili kratko odvojite pečenje podloge i nadjeva | Smanjite vlagu/nadjev i oblikujte ravnomjernije |\n| Kora je blijeda | Nedovoljno pečeno, malo šećera dostupnog za tamnjenje, mokra površina | Nastavite peći uz praćenje | Podesite pećnicu, nadjev i vrijeme; šećer nije prvi lijek |\n| Okus je oštar ili alkoholni | Pretjerana ili neusklađena fermentacija | Ako nema znakova kvarenja, pecite prije daljnjeg čekanja | Smanjite kvasac, temperaturu ili ukupno trajanje |\n| Bezglutenska podloga se mrvi | Nedovoljno vode/veziva ili pogrešan proizvodni postupak | Navlažite i prešajte nježno u plehu ako smjesa dopušta | Slijedite upute konkretne mješavine; ne primjenjujte pšenični recept |\n| Tijesto se lijepi za lopatu | Predugo stoji nakon stavljanja na lopatu, previše nadjeva ili nedovoljno brašna/krupice ispod | Protresite lopatu kratko prije pečenja; ako se zalijepilo, nježno podignite rub i dodajte malo krupice | Nadijevajte tek prije lansiranja, koristite suhu lopatu i ne ostavljajte tijesto na njoj |\n| Dno je tvrdo, a rub suh | Predugo pečenje, preniska temperatura ili pretanka podloga | Skratite pečenje sljedeće pizze i dodajte umak/sir tek u primjerenoj količini | Predgrijte bolje i prilagodite debljinu receptu |\n| Kugla puca pri kuglanju | Presuha ili preslabo razvijena masa, pretjerano zatezanje | Pokrijte, pustite da se opusti i oblikujte nježnije | Provjerite vaganje vode i smanjite napetost pri oblikovanju |\n| Površina kugle se osušila | Nedovoljno pokrivena posuda ili suh zrak | Tanko nauljite/prekrijte ako je kožica plitka; odstranite suhu kožicu samo ako ne može ući u tijesto | Koristite poklopac i izbjegavajte otvorene posude |"
        },
        {
          "id": "troubleshooting-log",
          "title": "Dnevnik i ponavljanje",
          "level": 3,
          "markdown": "**Bilježnica serije:** datum, brašno/serija, voda, sol, ulje, kvasac i oblik, temperatura vode/tijesta/sobe/hladnjaka, početak i kraj svake faze, izgled prije pečenja i rezultat. Tako se otkriva uzrok; sjećanje na „otprilike isto” nije dovoljno. Mijenjajte samo jednu varijablu po pokusu da biste razumjeli učinak."
        }
      ]
    },
    {
      "id": "topic-storage",
      "title": "Čuvanje i higijena",
      "description": "Sigurno čuvaj, zamrzni i odmrzni tijesto uz dobru higijenu.",
      "introduction": "",
      "sections": [
        {
          "id": "storage-safety",
          "title": "Sirovo brašno i čistoća",
          "level": 3,
          "markdown": "Sirovo brašno može sadržavati patogene i ne smije se kušati; ni sirovo tijesto nije sigurno za jelo. Pecite tijesto do kraja. Operite ruke, posude, alat i radnu površinu nakon rada sa sirovim brašnom. Držite brašno i sirovo tijesto odvojeno od hrane spremne za jelo."
        },
        {
          "id": "storage-fridge",
          "title": "Hladnjak",
          "level": 3,
          "markdown": "- Čuvajte tijesto pokriveno u hladnjaku, uz zapis datuma i temperaturu uređaja. Sigurnosne smjernice za hladnjak preporučuju najviše 4°C; kvaliteta tijesta i brzina fermentacije ovise o stvarnoj temperaturi."
        },
        {
          "id": "storage-freeze",
          "title": "Zamrzavanje i odmrzavanje",
          "level": 3,
          "markdown": "- Zamrznite kugle kad su oblikovane i još nisu prešle vrhunac fermentacije. Koristite zatvorenu, označenu ambalažu za zamrzavanje. Vrijeme zamrzavanja prvenstveno utječe na kvalitetu; za duga pohranjivanja slijedite upute proizvođača sastojaka i lokalne smjernice za hranu.\n- Odmrzavajte pokriveno u hladnjaku, ne satima na toplom. Zatim dopustite kontrolirano temperiranje prije otvaranja. Kondenzacija može stvoriti mokru površinu.\n- Ako tijesto ima neugodan miris koji nije uobičajena aroma fermentacije, promjenu boje ili nepoznatu povijest skladištenja, odbacite ga. Pečenje nije razlog za korištenje namirnice koja pokazuje znakove kvarenja.\n\nBezglutensko tijesto za osobu koja izbjegava gluten zahtijeva zasebnu čistu posudu, pribor i površinu; uobičajeno pšenično brašno može se lako prenijeti zrakom."
        }
      ]
    },
    {
      "id": "topic-recipes",
      "title": "Recepti i vremenski rasporedi",
      "description": "Isprobaj potpune formule, raspodjelu prefermenta i vremenske rasporede.",
      "introduction": "Svi recepti ispod su PizzaBookovi početni primjeri, ne protokol pojedinog izvora. Kvasac je naveden kao **svježi** osim gdje je drugačije naznačeno. Za suhi kvasac koristite uputu proizvođača za točan proizvod; ne pretvarajte količinu napamet. Vremena se računaju od početka pripreme do pečenja i treba ih korigirati prema temperaturi i stanju tijesta.\n\n\nRecepti su računski PizzaBook primjeri, a nisu svi praktično isprobani za različita brašna, miksere i pećnice. U svakom receptu računajte preferment kao dio ukupnog brašna i vode samo jednom. Ukupna masa tijesta ne uključuje nadjev. Male količine kvasca traže preciznu vagu; promjena temperature ili trajanja traži novu provjeru, ne izravno preslikavanje iste doze.",
      "sections": [
        {
          "id": "recipe-pan-scaling",
          "title": "Raspodjela tijesta prema površini pleha",
          "level": 3,
          "markdown": "Za istu približnu debljinu teglije raspodijelite tijesto prema površini, a ne samo prema duljini pleha:\n\n> masa za pleh = ciljna masa ÷ površina početnog pleha × površina novog pleha\n\nPrimjer: 800 g za pleh 30 × 40 cm znači 800 ÷ 1200 = **0,667 g/cm²**. Za drugi pleh 25 × 35 cm površina je 875 cm², pa je masa 0,667 × 875 = **583,3 g**. Ako pripremite obje teglije, ukupna masa je 800 + 583,3 = **1383,3 g**. Ovo čuva približnu debljinu podloge, ali ne prilagođava rub, nadjev ni geometriju pleha."
        },
        {
          "id": "recipe-neapolitan",
          "title": "Napolitana, direct, 4 kugle po 250 g",
          "level": 3,
          "markdown": "**Sastojci ukupno — 1000 g:**\n\n| Sastojak | Masa | Pekarski postotak |\n|---|---:|---:|\n| Pšenično brašno, srednje jako do jako prema rasporedu | 606 g | 100% |\n| Voda | 376 g | 62,0% |\n| Sol | 17 g | 2,8% |\n| Svježi kvasac | 1 g | 0,17% |\n| Ukupno | **1000 g** | **165,02%** |\n\n**Oprema i uvjeti:** kućna pećnica s čelikom/kamenom ili vanjska pizza peć; soba 21–23°C; cilj nakon zamjesa 23–24°C. Omjer soli i voda su kućna početna točka; nije nužno identičan propisu za verace napolitanu. Kuglu od 250 g otvorite na približno 28–30 cm.\n\n1. Zamijesite direct metodom dok se tijesto poveže; izmjerite temperaturu.\n2. Ostavite pokriveno 60–90 min na 21–23°C, dok se ne opusti i lagano ne napuhne.\n3. Podijelite na četiri kugle po 250 g. Pokrijte i ostavite približno 4–6 h na istoj temperaturi.\n4. Na svaku pizzu rasporedite oko 50–60 g umaka i 70–85 g mozzarelle, po želji uz bosiljak. Pecite kad kugle postanu podatne, lagane i mogu se otvoriti bez skupljanja. Na dobro zagrijanom čeliku/kamenu u pećnici od približno 250–300°C računajte okvirno 5–8 min; u pizza peći s podom 430–480°C često oko 60–90 s. Vremena su početni rasponi: pratite boju dna i vrha, a ne sat iz druge pećnice.\n\n**Primjer satnice:** počnite 08:00, planirajte pečenje 15:00. Uključujući kratko oblikovanje i pečenje, ukupno je približno **5 h 45 min–8 h 25 min**; prozor je orijentir, ne obveza da se peče po satu.\n\n| Vrijeme | Faza i znak |\n|---|---|\n| 08:00–08:20 | Direct zamjes, ručno ili odgovarajućim mikserom; izmjerite temperaturu nakon zamjesa. |\n| 08:20–09:20/09:50 | Bulk 60–90 min; tijesto se opušta i počinje pokazivati sitne mjehuriće. |\n| 09:20–09:35 / 09:50–10:10 | Podijelite i kuglajte četiri porcije; pokrijte. |\n| 09:35/10:10–13:35/16:10 | Završno dizanje 4–6 h; otvorite kad je kugla podatna i ne vraća se nasilno. |\n| 14:00–15:00 | Predgrijte kamen/čelik za planirano pečenje u 15:00; ovo se odvija paralelno s odmorom kugli. |\n| Oko 15:00 | Oblikujte, dodajte nadjev i pecite po znakovima boje dna i vrha. Ako kugle nisu spremne, pomaknite i pečenje i predgrijavanje. |\n\nAko kuhinja prelazi 25°C, smanjite kvasac ili skratite fazu; ako je hladnija, stanje tijesta može kasniti."
        },
        {
          "id": "recipe-new-york",
          "title": "New York, direct, dvije kugle po 375 g",
          "level": 3,
          "markdown": "**Sastojci ukupno — 750 g:**\n\n| Sastojak | Masa | Pekarski postotak |\n|---|---:|---:|\n| Krušno pšenično brašno | 446 g | 100% |\n| Voda | 276,5 g | 62,0% |\n| Sol | 11,2 g | 2,5% |\n| Ulje | 8,9 g | 2,0% |\n| Šećer | 6,7 g | 1,5% |\n| Svježi kvasac | 0,7 g | 0,16% |\n| Ukupno | **750,0 g** | **168,16%** |\n\n**Uvjeti:** cilj nakon zamjesa 23–24°C; hladnjak izmjeren na približno 4°C; kućna pećnica s čelikom ili kamenom. Kugla od 375 g odgovara približno 33–35 cm, ovisno o debljini.\n\n1. Zamijesite do srednjeg razvoja glutena; dodajte ulje kad se tijesto već počelo povezivati.\n2. Ostavite pokriveno oko 20 min, zatim oblikujte dvije kugle.\n3. Hladite zatvoreno oko 24 h. Uzmite 2–3 h na sobnoj temperaturi prije otvaranja kao prvi vremenski plan.\n4. Otvorite sredinu ravnomjerno, ostavite umjeren rub i ne preopterećujte nadjevom. Za jednu pizzu počnite s 60–75 g umaka i 110–130 g niskovlažne mozzarelle.\n5. Pecite na dobro zagrijanom čeliku/kamenu pri najvišoj prikladnoj postavci kućne pećnice; kao početnu procjenu očekujte oko 7–12 min pri 250–290°C. Završetak procijenite po obojenom dnu, rastopljenom siru i pečenom rubu.\n\n**Primjer satnice:** počnite 1. dana u 08:00, planirajte pečenje 2. dana oko 11:45. Uz 24 h hladnog odmora i 2–3 h temperiranja, ukupno traje približno **27 h 10 min–28 h 25 min**, uključujući oblikovanje i pečenje.\n\n| Vrijeme | Faza i znak |\n|---|---|\n| 1. dan, 08:00–08:20 | Direct zamjes; cilj nakon zamjesa 23–24°C. |\n| 08:20–08:40 | Pokriven odmor od 20 min. |\n| 08:40–08:55 | Podijelite i kuglajte; stavite zatvoreno u hladnjak izmjeren na oko 4°C. |\n| 08:55–2. dan, 08:55 | Hladna fermentacija 24 h. |\n| 2. dan, 08:55–10:55/11:55 | Temperiranje i završni odmor 2–3 h; procjenjujte kuglu, ne samo temperaturu. |\n| 10:45–11:45 | Predgrijte čelik/kamen dok kugle temperiraju. |\n| Oko 11:45 | Otvorite i nadjenite kad se kugla rasteže bez skupljanja; pecite po boji i donjoj strani. |\n\n0,7 g kvasca mjerite preciznom vagom; promjena temperature hladnjaka ili trajanja zahtijeva novu kalibraciju.\nAko kugla nakon temperiranja još pruža jak otpor ili se trga pri otvaranju, odgodite pečenje; predgrijavanje se može produljiti paralelno."
        },
        {
          "id": "recipe-tonda",
          "title": "Romana Tonda, direct, četiri kugle po 220 g",
          "level": 3,
          "markdown": "**Sastojci ukupno — 880 g:**\n\n| Sastojak | Masa | Pekarski postotak |\n|---|---:|---:|\n| Pšenično brašno za pizzu, jačine prikladne rasporedu | 530 g | 100% |\n| Voda | 318 g | 60,0% |\n| Sol | 15 g | 2,83% |\n| Ulje | 16 g | 3,02% |\n| Svježi kvasac | 1 g | 0,19% |\n| Ukupno | **880 g** | **166,04%** |\n\n**Uvjeti:** prostor 21–22°C, cilj nakon zamjesa oko 23°C; kućna pećnica s kamenom/čelikom ili plehom. Kugla od 220 g odgovara približno 28–30 cm.\n\n1. Zamijesite, dodajući ulje nakon početnog povezivanja.\n2. Pokriveno odmorite oko 45 min; podijelite i kuglajte četiri porcije.\n3. Završno odmarajte približno 4–5 h na 21–22°C. Ako koristite hladnjak, raspored mijenja se i treba ga zasebno probno prilagoditi.\n4. Otvorite tanko i ravnomjerno, po potrebi valjkom. Za jednu pizzu krenite s 40–55 g umaka i 65–85 g mozzarelle. Pecite pri približno 230–280°C oko 6–10 min na zagrijanom kamenu/čeliku ili plehu, prilagođavajući stvarnom pečenju.\n\n**Primjer satnice:** počnite 08:00, planirajte pečenje oko 14:00. Ukupno je približno **5 h 35 min–6 h 45 min**.\n\n| Vrijeme | Faza i znak |\n|---|---|\n| 08:00–08:20 | Direct zamjes; zabilježite temperaturu tijesta. |\n| 08:20–09:05 | Pokriven bulk-odmor 45 min. |\n| 09:05–09:20 | Podijelite i kuglajte četiri porcije. |\n| 09:20–13:20/14:20 | Završno dizanje kugli 4–5 h; oblikujte kad se kugla otvara bez snažnog vraćanja. |\n| 13:00–14:00 | Predgrijte kamen/čelik ili pećnicu paralelno sa završnim odmorom. |\n| Oko 14:00 | Tanko otvorite, nadjenite i pecite; ako kugla nije spremna, pomaknite pečenje. |\n\nAko se kugla vraća, dajte joj još odmora; ne forsirajte tankoću."
        },
        {
          "id": "recipe-teglia",
          "title": "Romana Teglia, direct, jedna tepsija 30 × 40 cm",
          "level": 3,
          "markdown": "**Sastojci ukupno — 800 g:**\n\n| Sastojak | Masa | Pekarski postotak |\n|---|---:|---:|\n| Jače pšenično brašno prikladno za višu hidrataciju | 443 g | 100% |\n| Voda | 332 g | 74,9% |\n| Sol | 11 g | 2,5% |\n| Ulje u tijestu | 13 g | 2,9% |\n| Svježi kvasac | 1 g | 0,23% |\n| Ukupno | **800 g** | **180,59%** |\n\n**Uvjeti:** prostor 21–23°C, hladnjak oko 4°C; cilj nakon zamjesa približno 23°C; obična pećnica i nauljen metalni pleh.\n\n1. Zamijesite dok nema suhih dijelova; tijesto će biti mekše nego za kugle.\n2. Ostavite 30 min, napravite nježan preklop ako se masa razlijeva. Odmorite još 30 min.\n3. Pokriveno hladite kao jednu masu 18–24 h.\n4. Temperirajte 1–2 h, zatim prebacite na dobro nauljen pleh. Utisnite do dijela ruba, odmorite 15–20 min i nastavite prema kutovima.\n5. Ostavite u plehu približno 1–2 h, ali završite kad je tijesto napuhnuto i lagano podrhtava pri pomaku pleha, ne kad timer zazvoni.\n6. Počnite s oko 100–130 g umaka i 150–180 g mozzarelle za cijeli pleh. Pecite na 230–250°C okvirno 20–30 min. Za vlažan nadjev prvo kratko zapecite bazu s malo umaka pa dodajte ostatak; koristite boju dna i pečenost sredine za odluku.\n\n**Primjer satnice:** počnite 1. dana u 08:00, planirajte pečenje 2. dana oko 12:15; završetak pečenja u 12:45 znači ukupno **28 h 45 min**. Ukupni raspon iznosi **22 h 05 min–30 h 40 min**, zbrojeno iz minimalnih i maksimalnih trajanja: miješanje 15–20 min + prvi odmor 30 min + presavijanje 5–10 min + drugi odmor 30 min + hladni bulk 18–24 h + temperiranje 1–2 h + početno utiskivanje u pleh 5–10 min + odmor 15–20 min + završno utiskivanje 5–10 min + završno dizanje u plehu 1–2 h + pečenje 20–30 min. Predgrijavanje pećnice i zasebne podloge odvija se paralelno i ne pribraja se.\n\n| Vrijeme | Faza i znak |\n|---|---|\n| 1. dan, 08:00–08:20 | Direct zamjes; cilj nakon zamjesa oko 23°C. |\n| 08:20–08:50 | Pokriven odmor 30 min. |\n| 08:50–09:00 | Nježno presavijanje samo ako se masa razlijeva. |\n| 09:00–09:30 | Pokriven odmor; zatim zatvorite masu i stavite u hladnjak. |\n| 09:30–2. dan, 08:30 | Hladni bulk 23 h na izmjerenih približno 4°C. |\n| 2. dan, 08:30–10:00 | Temperirajte 1,5 h; to nije završno dizanje u plehu. |\n| 10:00–10:45 | Prebacite i utisnite u pleh, odmorite 15 min, zatim dovršite utiskivanje prema kutovima. |\n| 10:45–12:15 | Završno dizanje u plehu oko 1,5 h; gledajte napuhnutost i lagano podrhtavanje. |\n| 11:15–12:15 | Predgrijte pećnicu i eventualni zaseban kamen/čelik. Pleh s tijestom ostaje izvan pećnice do pečenja. |\n| Oko 12:15–12:45 | Dodajte nadjev i pecite do obojenog dna i stabilne sredine. |\n\nPredgrijavanje je paralelno i ne pribraja se drugi put. Ako masa još nije napuhana, odgodite pečenje umjesto da završno dizanje određujete samo po satu. Ne zagrijavajte pleh s tijestom koje se u njemu diže."
        },
        {
          "id": "recipe-biga",
          "title": "Biga, završno tijesto 1000 g",
          "level": 3,
          "markdown": "**Ukupna formula — 1000 g tijesta (4 × 250 g):**\n\n| Sastojak | Ukupno | Pekarski postotak |\n|---|---:|---:|\n| Jače pšenično brašno prikladno za raspored bige | 592,4 g | 100% |\n| Voda | 379,1 g | 64,0% |\n| Sol | 16,6 g | 2,8% |\n| Ulje | 8,9 g | 1,5% |\n| Svježi kvasac | 3,0 g | 0,51% |\n| Ukupno | **1000,0 g** | **168,81%** |\n\n**Preferment — biga, 432,5 g:**\n\n| Sastojak | Masa | Prema ukupnom brašnu |\n|---|---:|---:|\n| Brašno za bigu | 296,2 g | 50,0% |\n| Voda za bigu | 133,3 g | 22,5% |\n| Svježi kvasac | 3,0 g | 0,51%* |\n| Ukupno biga | **432,5 g** | — |\n\n**Završni zamjes — 567,5 g:**\n\n| Sastojak | Masa | Prema ukupnom brašnu |\n|---|---:|---:|\n| Preostalo brašno | 296,2 g | 50,0% |\n| Preostala voda | 245,8 g | 41,5% |\n| Sol | 16,6 g | 2,8% |\n| Ulje | 8,9 g | 1,5% |\n| Ukupno završni zamjes | **567,5 g** | — |\n\n*3,0 g svježeg kvasca je oko 1,01% brašna u bigi. Zbroj biga i završnog zamjesa daje 1000,0 g; brašno i voda prefermenta nisu ponovno dodani.\n\nBiga sadrži 50% ukupnog brašna i ima 45% hidratacije u odnosu na brašno bige. Doza kvasca približno je 1% brašna u bigi. Ovo je **jedan namjerno izabran protokol**, vezan uz 18 h na oko 18°C; nije primjenjiv bez izmjene u toplijoj prostoriji ili s drukčijim proizvodom.\n\nOdaberite pšenično brašno koje prema deklaraciji i probnom zamjesu može podnijeti ovaj raspored. W i proteini su zasebni podatci; jedan se ne može zaključiti iz drugoga.\n\nDobit ćete četiri kugle od 250 g za okruglu pizzu. Ovo je biga-varijanta kućnog tijesta, ne tvrdnja o tradicionalnom ili certificiranom stilu.\n\n**Pećnica i nadjev:** za svaku kuglu otvorite približno 28–30 cm; počnite s 50–60 g umaka i 70–85 g mozzarelle. U kućnoj pećnici s dobro zagrijanim kamenom/čelikom pri približno 250–290°C očekujte oko 5–9 min. Nadjev i trajanje su kućni početci, ne dio definicije bige.\n\n1. Kratko pomiješajte sastojke bige do mrvičaste, ravnomjerno navlažene mase. Pokrijte.\n2. Fermentirajte približno 18 h na 18°C. Procijenite miris, sitne šupljine i lagani rast; ne oslanjajte se samo na sat.\n3. Natrgajte bigu. Dodajte preostalo brašno i veći dio vode; povežite u mikseru ili ručno. Postupno dodajte ostatak vode, zatim sol. Dodajte ulje pri kraju.\n4. Ciljajte 23–24°C nakon završnog zamjesa. Ostavite pokriveno 45–60 min, zatim oblikujte kugle.\n5. Završno odmarajte približno 2–4 h na 21–22°C do podatnosti i vidljivog plina. Ako je tijesto već mlohavo, skratite fazu.\n\n**Primjer satnice:** počnite 1. dana u 13:30, planirajte pečenje 2. dana oko 12:20. Ukupno trajanje od miješanja bige do završetka pečenja iznosi približno **21 h 45 min–24 h 30 min**.\n\n| Vrijeme | Faza i znak |\n|---|---|\n| 1. dan, 13:30–13:45 | Izvažite i kratko povežite bigu; pokrijte. |\n| 13:45–2. dan, 07:45 | Fermentacija bige 18 h na 18°C. Zrelost procijenite po mirisu, šupljinama i blagom rastu. |\n| 2. dan, 07:45–08:05 | Završni zamjes; cilj nakon zamjesa 23–24°C. |\n| 08:05–08:55 | Bulk 50 min. |\n| 08:55–09:10 | Podijelite i kuglajte četiri porcije. |\n| 09:10–12:10 | Završno dizanje kugli; tražite podatnost i sitne plinove. |\n| 11:20–12:20 | Predgrijte kamen/čelik paralelno s završnim odmorom. |\n| Oko 12:20–12:30 | Otvorite, dodajte nadjev i pecite do obojenog dna i vrha. |\n\nAko biga ili kugle nisu spremne po znakovima, pomaknite predgrijavanje i pečenje; ne prisiljavajte 18-satni protokol na drugu temperaturu."
        },
        {
          "id": "recipe-poolish",
          "title": "Poolish, završno tijesto 1000 g",
          "level": 3,
          "markdown": "**Ukupna formula — 1000 g tijesta (4 × 250 g):**\n\n| Sastojak | Ukupno | Pekarski postotak |\n|---|---:|---:|\n| Pšenično brašno za pizzu, srednje do jače prema rasporedu | 594 g | 100% |\n| Voda | 380,2 g | 64,0% |\n| Sol | 16,6 g | 2,8% |\n| Ulje | 8,9 g | 1,5% |\n| Svježi kvasac | 0,3 g | 0,05% |\n| Ukupno | **1000,0 g** | **168,35%** |\n\n**Preferment — poolish, 416,3 g:**\n\n| Sastojak | Masa | Prema ukupnom brašnu |\n|---|---:|---:|\n| Brašno za poolish | 208 g | 35,0% |\n| Voda za poolish | 208 g | 35,0% |\n| Svježi kvasac | 0,3 g | 0,05% |\n| Ukupno poolish | **416,3 g** | — |\n\n**Završni zamjes — 583,7 g:**\n\n| Sastojak | Masa | Prema ukupnom brašnu |\n|---|---:|---:|\n| Preostalo brašno | 386 g | 65,0% |\n| Preostala voda | 172,2 g | 29,0% |\n| Sol | 16,6 g | 2,8% |\n| Ulje | 8,9 g | 1,5% |\n| Ukupno završni zamjes | **583,7 g** | — |\n\nPoolish sadrži oko 35% ukupnog brašna i ima 100% hidratacije. Kvasac je osjetljiva količina i ovaj početni raspored pretpostavlja oko 10–12 h na 19–20°C. Topliji uvjeti znače kraći raspored ili drukčiju dozu.\n\nDobit ćete četiri kugle od 250 g za okruglu kućnu pizzu. Ovo je poolish-varijanta; nemojte očekivati da će sama metoda odrediti jedan stil.\n\n**Pećnica i nadjev:** za svaku kuglu otvorite približno 28–30 cm; počnite s 50–60 g umaka i 70–85 g mozzarelle. Pecite na dobro zagrijanom kamenu/čeliku u kućnoj pećnici pri približno 250–290°C, obično 5–9 min. Trajanje prilagodite boji dna i sredine.\n\n1. Pomiješajte sastojke poolisha kratko i pokrijte. Ne treba razvijati gluten.\n2. Početni raspored je 10–12 h na 19–20°C. Spremni poolish ima mnogo sitnih mjehurića, naraslu i blago kupolastu površinu; kad je ravna i tek počinje padati, iskoristite ga. Temperatura i inokulacija mijenjaju vrijeme.\n3. Umiješajte poolish s preostalim brašnom i većinom preostale vode. Dodajte ostatak vode postupno, zatim sol; na kraju ulje. Za ručni, planetarni ili spiralni zamjes primijenite odgovarajući postupak iz [poglavlja o metodama](#topic-methods); kod male količine provjerite da mikser sigurno i učinkovito miješa.\n4. Nakon zamjesa ciljajte 23–24°C. Bulk 45–60 min, oblikujte kugle i hladite ih zatvorene 12–18 h na oko 4°C.\n5. Temperirajte 2–3 h prije oblikovanja/pečenja, prilagođavajući se stanju kugle.\n\n**Primjer satnice:** počnite 1. dana u 08:00, planirajte pečenje 2. dana oko 11:15. Ukupno je približno **27 h 20–25 min**, a raspon navedenih faza oko **25 h 35 min–35 h 20 min**.\n\n| Vrijeme | Faza i znak |\n|---|---|\n| 1. dan, 08:00–08:10 | Pomiješajte i pokrijte poolish. |\n| 08:10–19:10 | Fermentirajte 11 h na 19–20°C; upotrijebite po mjehurićima i obliku površine. |\n| 19:10–19:30 | Završni zamjes; cilj nakon zamjesa 23–24°C. |\n| 19:30–20:20 | Bulk 50 min. |\n| 20:20–20:35 | Podijelite i kuglajte četiri porcije; zatvorite. |\n| 20:35–2. dan, 08:35 | Hladna fermentacija 12 h na oko 4°C. |\n| 2. dan, 08:35–11:05 | Temperirajte 2 h 30 min i procijenite kugle. |\n| 10:15–11:15 | Predgrijte kamen/čelik paralelno s temperiranjem. |\n| 11:05–11:15 | Otvorite i nadjenite kad se kugla rasteže bez skupljanja. |\n| Oko 11:15–11:24 | Pecite po boji dna i vrha. |\n\nPoolish, kao i ostatak prefermenta, već je uračunat u ukupnu masu; nikad ga ne pribrajajte ponovno brašnu i vodi završne formule."
        },
        {
          "id": "recipe-gluten-free",
          "title": "Bezglutenska tepsijska pizza — Caputo Fioreglut, jedna tepsija 30 × 40 cm",
          "level": 3,
          "markdown": "**Računska ilustracija, ne potvrđen proizvođački recept i ne praktično ispitana formula.** Odaberite točno navedenu gotovu mješavinu Caputo Fioreglut. Prije pečenja provjerite trenutačnu deklaraciju i upute pakiranja; ako se razlikuju, slijedite proizvođača. Ne dodajte psyllium automatski.\n\n| Sastojak | Masa | Pekarski postotak |\n|---|---:|---:|\n| Caputo Fioreglut | 500 g | 100% |\n| Voda | 400 g | 80% |\n| Sol | 12,5 g | 2,5% |\n| Ulje | 17,5 g | 3,5% |\n| Instant suhi kvasac | 4 g | 0,8% |\n| Med | 10 g | 2% |\n| Ukupno | **944 g** | **188,8%** |\n\n**Uvjeti:** sastojci sobne temperature, cilj nakon miješanja približno 24°C; kućna pećnica oko 230–250°C; papir za pečenje ili nauljen pleh; bez zajedničkog pribora koji je bio u dodiru s pšeničnim brašnom. Ovo nije pšenično tijesto: ne primjenjujte gluten-orijentirano miješenje, presavijanje ni kuglanje. Miješalicu koristite samo ako upute proizvoda i uređaja to dopuštaju.\n\n1. Pomiješajte suhe sastojke. Rastopite med u vodi, dodajte vodu i ulje te miješajte špatulom dok smjesa ne bude ravnomjerno vlažna. Nemojte je mijesiti kao pšenično tijesto s glutenom.\n2. Odmorite pokriveno 15–30 min da mješavina upije vodu.\n3. Prebacite svu smjesu u pripremljen pleh i utisnite vlažnim ili nauljenim prstima. Ne oblikujte kugle.\n4. Ostavite 45–90 min na približno 24°C, dok se smjesa vidljivo ne napuhne.\n5. Za jednu tepsiju počnite s približno 100–130 g umaka i 150–180 g sira. Pecite podlogu 12–15 min, dodajte nadjev i pecite još približno 6–10 min. Vrijeme ovisi o plehu, pećnici i debljini.\n\n**Primjer satnice:** počnite u 10:00, planirajte pečenje oko 11:55. Ukupno je približno **1 h 40 min–2 h 45 min**, uključujući miješanje, odmor, dizanje i dvije faze pečenja.\n\n| Vrijeme | Faza i znak |\n|---|---|\n| 10:00–10:10 | Ravnomjerno izmiješajte špatulom; ne mijesite kao pšenično tijesto. |\n| 10:10–10:30 | Odmor pokriveno 20 min. |\n| 10:30–10:40 | Prebacite i utisnite u pripremljen pleh. |\n| 10:40–11:55 | Završno dizanje oko 75 min na približno 24°C; tražite vidljivo napuhivanje. |\n| 10:55–11:55 | Predgrijte pećnicu i eventualni zaseban kamen/čelik. Pleh sa smjesom ostaje izvan pećnice do pečenja. |\n| 11:55–12:07/12:10 | Zapecite podlogu 12–15 min. |\n| 12:07/12:10–12:13/12:20 | Dodajte nadjev i pecite još 6–10 min, do stabilne sredine i pečenog dna. |\n\nZbroj rasporeda za gornji primjer: 10 min miješanje + 20 min odmor + 10 min utiskivanje + 75 min dizanje + 12–15 min prvo pečenje + 6–10 min završno pečenje = **2 h 13 min–2 h 20 min**. Predgrijavanje je paralelno i nije dodano. Ne predgrijavajte pleh dok se u njemu diže smjesa; stavite ga u pećnicu tek pri pečenju. Recept nije jamstvo prikladnosti za celijakiju bez kontrole sastojaka i unakrsnog kontakta."
        }
      ]
    },
    {
      "id": "topic-glossary",
      "title": "Rječnik pojmova",
      "description": "Brzo pronađi objašnjenja ključnih pekarskih pojmova.",
      "introduction": "",
      "sections": [
        {
          "id": "glossary-entries",
          "title": "Abecedni rječnik",
          "level": 3,
          "markdown": "- **Autoliza:** odmor mješavine brašna i vode prije dodavanja ostalih sastojaka.\n- **Biga:** čvršći preferment od brašna, vode i kvasca.\n- **Bulk-fermentacija:** fermentacija cijele mase prije dijeljenja.\n- **Fermentacija:** mikrobiološka aktivnost koja stvara plin i spojeve okusa.\n- **Hidratacija:** voda kao postotak ukupnog brašna.\n- **Kuglanje:** oblikovanje porcije tijesta u kuglu sa zategnutom površinom.\n- **Maturacija/dozrijevanje:** šire enzimske i fizikalne promjene tijesta tijekom mirovanja.\n- **P/L:** alveografski omjer otpora i rastezljivosti.\n- **Poolish:** tekući preferment, tipično s jednakom masom vode i brašna.\n- **Preferment:** dio brašna i vode koji fermentira prije završnog zamjesa.\n- **Proof/završno dizanje:** odmor i fermentacija nakon oblikovanja porcije ili u plehu.\n- **Teglia:** pizza pečena u pravokutnom plehu.\n- **Temperiranje:** zagrijavanje hladnog tijesta prema temperaturi okoline radi rukovanja; nije isto što i dokaz završne fermentacije.\n- **W:** rezultat alveografskog testa koji opisuje energiju deformiranja tijesta pod zadanim uvjetima."
        }
      ]
    }
  ]
};
