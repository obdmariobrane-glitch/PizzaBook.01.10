# PRO-LEARN-1 — provjerene razlike prema aplikaciji

**Stanje pregleda:** 12. listopada 2026.

**Svrha:** usporedba sadržaja koji se u priručniku može opravdati neovisno s vidljivim tipovima, zadanim vrijednostima i uputama sadašnjeg frontenda. Ovo je samo urednički gap dokument. **Ne mijenja se aplikacija, njezine formule ni zasloni.**

## Što je aplikacija podržavala pri pregledu

Provjereni su tipovi i aktivni tekst u `frontend/src/calculator.ts`, `frontend/src/i18n/translations.ts`, `frontend/src/i18n/styleSteps.ts` i `frontend/app/(tabs)/index.tsx`.

- **Metode:** Direct, Biga i Poolish.
- **Stilovi kalkulatora:** Neapolitan, Romana, New York; pod Romana su zasebno obrađeni Tonda i Teglia.
- **Brašna:** Tipo 0/00, Manitoba/visoki W, pirovo, integralno pšenično, bezglutenska mješavina i prilagođeni blend.
- **Vrste kvasca:** kalkulatorni tipovi su svježi, suhi i sourdough; u dijelu vidljivih ručnih/mikser uputa zamjena je formulirana samo za svježi ili suhi kvasac.
- **Miješenje:** korisnički odabir ručno ili mikserom; tip kalkulatora dodatno uključuje `home` i `spiral` za izračun nekih temperatura/svojstava.
- **Pećnice:** Ooni/vanjska pizza peć, kućna pećnica s kamenom/čelikom i kućna pećnica s plehom. Teglia u određenom korisničkom putu prikazuje samo kućnu pećnicu s plehom.

To je opis pronađenih kodnih opcija, a ne tvrdnja da je svaki izbor jednako dobro dokumentiran ili provjeren u svim dijelovima sučelja.

## Konkretne sadržajne razlike i rizici

| Oznaka | Aplikacija / izvorna lokacija | Neovisno uređivačko opažanje | Obrada u ovom priručniku |
|---|---|---|---|
| G1 | `frontend/src/calculator.ts`, `PIZZA_STYLE_PROFILES`: Neapolitan 62% hydration, 2.9% salt, 2% oil; profile for Romana 59% / 2.8% / 4%; New York 64% / 2.3% / 3%. | Jedan skup profilnih vrijednosti ne definira cijeli stil. Ulje nije dio tradicionalne certificirane napolitanske formule. New York i rimski stilovi imaju široke varijacije. | Vrijednosti nisu kopirane kao univerzalni recept. `topic-styles` nudi uvjetovane početne raspone i izričito odvaja tradicionalni standard od kućnih prilagodbi. |
| G2 | `frontend/app/(tabs)/index.tsx`, `FLOURS_HR`: Tipo 0/00 prikazuje oznaku „Idealno 63%”, a opisni tekst uz istu stavku navodi hidrataciju 65–70%; Manitoba prikazuje „Idealno 65%”, a tekst navodi 70–80%. | Oznaka i objašnjenje u samoj aplikaciji nisu usklađeni. Ni jedna hidratacija nije univerzalna za cijelu kategoriju brašna. | Priručnik ne prenosi te idealne brojke kao dokazane. Rasponi su uvjetovani, oprezni i uz korak prilagodbe; pogledati G6. |
| G3 | `frontend/app/(tabs)/index.tsx`, `FLOURS_HR`: W 260–300 za grupu Tipo 0/00, W 320+ za Manitoba; „protein” i „W” u aplikaciji su korišteni kao kratki vodič za jačinu. | W i proteinski postotak nisu zamjenjivi. Sam naziv Manitoba ili Tipo 00 ne jamči vrijednost W; deklaracija i stvarni proizvod su važni. | `topic-flour` razlikuje proteine, W i P/L; ne zaključuje W iz naziva brašna. |
| G4 | `frontend/src/calculator.ts`, `doughCalc`: kalkulator računa Biga hidrataciju 45%, Poolish 100%, s udjelima brašna prema konfiguraciji. | To su vrijednosti odabrane za aplikacijsku formulu, ali nisu potpuna definicija svih biga i poolisha. Količina kvasca i raspored ovise o temperaturi i trajanju. | `method-biga` i `method-poolish` objašnjavaju udio, računanje svih sastojaka jednom i procjenu spremnosti. |
| G5 | `frontend/src/i18n/translations.ts`: HR opisi spominju bigu 50% brašna, 45% hidratacije, 1% kvasca i 16–18 h na 18–20°C; Poolish 35%, 100%, 0,1% kvasca i 12–14 h na 18–20°C. UI uputa za Poolish također spominje med. | Kvasac u aplikacijskim opisima može zvučati kao stalna vrijednost, bez razjašnjenja mase prema kojoj se postotak računa ili stanja prefermenta. Med nije obvezni sastojak definicije poolisha. | `topic-recipes` uz `recipe-biga` i `recipe-poolish` imenuje kvasac, osnovu postotka, temperaturu i trajanje te označava početne formule kao uvjetovane primjere. |
| G6 | `frontend/app/(tabs)/index.tsx`, FLOURS_HR tekst: tvrdi se da mješavina automatski računa „ponderirani prosjek” idealne hidratacije dva brašna. | Ponderirani prosjek može biti samo gruba procjena. Ne modelira nelinearne interakcije ni stvarnu apsorpciju vode, W ili P/L mješavine. | `topic-flour` navodi da ponderirani prosjek ne predviđa pouzdano ponašanje blendova; recept treba provjeriti probnim zamjesom. |
| G7 | `frontend/src/i18n/styleSteps.ts`: uputa za bezglutensko tijesto traži psyllium u količini 2% brašna; kalkulator `doughCalc` dodaje fiksnih 2% psylliuma za `glutenFree`. | Gotove bezglutenske mješavine mogu već sadržavati psyllium/ksantan i slijediti druge omjere vode. Fiksni dodatak nije siguran kao univerzalna formula. | `topic-gluten-free` nalaže provjeru deklaracije i ne dodaje automatski vezivo. Recept s Caputo Fioreglutom jasno je označen kao računska ilustracija, ne potvrđena formula proizvoda. |
| G8 | `frontend/src/calculator.ts` temperature: za dio Pro proračuna koristi se pojednostavljeni „55/60 rule” umanjen za sobnu temperaturu; Beginner direct put ima zasebne ciljeve i faktore. | Pojednostavljena pravila nisu jednako prikladna za svaki mikser, preferment, temperaturu brašna i masu tijesta. Konačnu temperaturu treba mjeriti. | `topic-temperature` daje DDT procjenu s faktorom miješanja kalibriranim za konkretan postupak; ne predstavlja kodni izračun kao univerzalni standard. |
| G9 | `frontend/src/calculator.ts`, stari opis Bige/Poolisha u planneru; `frontend/src/i18n/prefermentSteps.ts` detaljni koraci uključuju različite faze sobe/hladnjaka, te kasnije završni odmor. | Vremena iz različitih putanja nisu nužno usporediva: neke upute opisuju samo preferment, druge cijeli raspored ili odvojeno hladnu fazu. „Preferment 24h” nije isto što i „ukupno tijesto 24h”. | Priručnik eksplicitno razlaže preferment, završni zamjes, bulk, hladnu fazu, kugle i proof u plehu te zbraja ukupno trajanje u primjerima. |
| G10 | `frontend/src/calculator.ts`, `PIZZA_STYLE_PROFILES.romana`: jedan okrugli profil; `frontend/app/(tabs)/index.tsx` ima zasebnu logiku/izračun za Teglia i automatsku masu pleha. | Romana Tonda i Teglia nisu samo promjene težine ili oblika: razlikuju se način zadržavanja tijesta i mjesto završnog dizanja. | `topic-styles` odvojeno vodi `style-tonda` i `style-teglia`, s receptnim sidrima `recipe-tonda` i `recipe-teglia`. |
| G11 | `frontend/src/i18n/translations.ts`: neki opisi govore da duga fermentacija daje „lakšu probavu”. | Takvo obećanje je preopćenito i ne slijedi samo iz duljeg vremena; utjecaj ovisi o receptu, fermentaciji i osobi. | `topic-fermentation` ne tvrdi da je duže fermentirano tijesto svima lakše probavljivo; izvori/nedoumice to izričito bilježe. |
| G12 | `frontend/src/i18n/styleSteps.ts` i `translations.ts`: pojedine putanje daju fiksne minute miješenja, odmor prije hladnjaka ili vremenski/volumenski kriterij za kugle. | Minutaža, udvostručenje ili sobna temperatura sami ne određuju spremnost; masa i tip tijesta, mikroklima i stvarni kvasac bitno mijenjaju rezultat. | Priručnik kombinira vrijeme, temperaturu, miris, mjehuriće, napetost i strukturu; timer služi planiranju, ne kao samostalni test. |
| G13 | `frontend/src/calculator.ts` sadrži YeastType `sourdough`; dijelovi UI recepta i kalkulacije ipak govore o svježem/suhom kvascu. | „Sourdough”/kiselo tijesto nije zamjenjiva treća vrsta suhog ili svježeg kvasca: starter traži vlastitu hidraciju, hranjenje, mikrobiološki sastav i račun ukupnog brašna/vode. | `topic-yeast` obrađuje samo kvasce tražene u poglavlju D i napominje da se sourdough ne može tretirati kao izravna konverzija. Posebna sourdough receptura nije dodana bez zasebno provjerenog protokola. |
| G14 | UI razlikuje ručni i mikser zamjes; kalkulatorni tip `Mixing` dodatno uključuje `home` i `spiral`. | Različiti ekrani i računske putanje ne znače da su sve kombinacije, koraci i korisničke upute jednako vidljivi. „Mikser” također ne opisuje univerzalnu frikciju. | `topic-methods` opisuje ručni, planetarni i spiralni postupak, uz upozorenje da se faktor miješanja mjeri zasebno za konkretan uređaj. |
| G15 | Pećnice su tipovi Ooni, kućna s kamenom/čelikom i kućna s plehom; Teglia put može ograničiti odabir na pleh. | Temperatura postavljena na pećnici ne mora biti temperatura podloge. Kamen, čelik, pleh i pizza peć prenose toplinu različito. | `topic-equipment` traži stvarno predgrijavanje/mjerenje i ne prenosi minute između različitih uređaja. |

## Potvrđeno, nije potvrđeno i izvan opsega

**Potvrđeno u kodu:** navedeni enum-i/tipovi, korisničke oznake brašna, zadane profilne brojke te osnovni postoci prefermenta i bezglutenskog psylliuma u relevantnim izračunima. Upute su pregledane kao postojeći sadržaj, ne klinički ili eksperimentalno provjereni protokoli.

**Nije potvrđeno:** da je svaka formula ili tekstualna smjernica aplikacije točna, univerzalna ili jednako prikazana na svakom modu/zaslonu. Nije testiran prikaz na živom uređaju u ovom sadržajnom zadatku.

**Namjerno nije učinjeno:** kodne izmjene, korekcija prijevoda, deployment, build APK-a, promjena kalkulatora ili uklanjanje stare Škole pizze. Ovaj dokument je urednička lista za buduću usklađenu reviziju.

## Preporučeni redoslijed budućeg usklađivanja

1. **Izvori istine za formule:** usporediti svaki profilni postotak i svaku metodu s priručnikom; prikazati koje su vrijednosti početne procjene, a koje su korisnikovi izračuni. Ne prepisati priručnik radi usklađenja s formulom koju nije moguće opravdati.
2. **Brašno i blendovi:** ukloniti unutarnje neslaganje „idealne” hidratacije i opisnog raspona; zamijeniti univerzalni ponderirani prosjek upozorenjem i poljem za početnu procjenu.
3. **Temperatura:** razdvojiti temperaturu nakon zamjesa, prije oblikovanja i temperaturu završnog odmora. Uskladiti pravilo s odabranim mikserom/prefermentom i zatražiti stvarni cilj tijesta; ne mijenjati kod dok formula nije validirana.
4. **Prefermenti i vrijeme:** označiti postotak kvasca kao udio ukupnog brašna ili brašna prefermenta; jasno zbrojiti preferment, završni zamjes, bulk, hladnjak, kugle i dizanje u plehu.
5. **Kvasac:** razdvojiti svježi, aktivni suhi i instant kvasac, svaku zamjenu vezati uz proizvod i metodu. Ostaviti starter/sourdough izvan automatske konverzije dok nije definirana hidracija i račun ukupnog brašna/vode.
6. **Bezglutensko:** ukloniti fiksno dodavanje psylliuma kad mješavina to možda već sadrži; vezati recept uz potvrđeni proizvod i njegove aktualne upute.
7. **Testiranje:** prije promjene formula provesti aritmetičke testove, zatim praktične serije za tipične raspone kuhinjske temperature i uređaja. Aritmetička provjera nije zamjena za pekarsku validaciju.
8. **Zasebna UI revizija:** pregledati lokalizirane korake, završne tekstove i putanju Beginner/Pro tek nakon što su izvori formule prihvaćeni; ovaj sadržajni zadatak nije odobrenje za implementaciju.
