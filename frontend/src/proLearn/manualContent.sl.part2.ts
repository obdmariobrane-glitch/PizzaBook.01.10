import type { ProGuideTopic } from './types';

export const PRO_LEARN_SL_PART2: ProGuideTopic[] = [
  {
    id: 'topic-fermentation',
    title: 'Fermentacija in zorenje',
    description: 'Loči fermentacijo od zorenja in pripravljenost oceni po več znakih.',
    introduction: '',
    sections: [
      {
        id: 'fermentation-process',
        title: 'Fermentacija in encimske spremembe',
        level: 3,
        markdown: '**Fermentacija** je presnovna dejavnost kvasa in pri nekaterih testih tudi bakterij; pri tem nastajata ogljikov dioksid in različne aromatične spojine. **Zorenje testa** zajema širši nabor sprememb, vključno z encimskim delovanjem moke. Izraza nista sopomenki.\n\nEncimi, kot so amilaze, iz škroba sproščajo manjše sladkorje; kvas jih lahko porablja, sladkorji pa prispevajo k barvi pečene skorje. Proteaze spreminjajo beljakovine in lahko sčasoma naredijo testo bolj prožno. Te spremembe so odvisne od moke, temperature, vode, soli, kvasa in trajanja.\n\nDaljši čas ni samodejno boljši: predolga ali pretopla fermentacija lahko oslabi strukturo, testo naredi lepljivo, preveč kislo ali šibko. Daljša fermentacija tudi ne zagotavlja lažje prebave ali koristi za zdravje. Ta priročnik obravnava opazne pekovske lastnosti, ne zdravstvenih učinkov.'
      },
      {
        id: 'fermentation-schedules',
        title: 'Kratek, srednji in dolg časovni razpored',
        level: 3,
        markdown: 'Čas je orientacijski podatek, ki velja le ob znani temperaturi in količini kvasa. Za kratek razpored zamesa in peke istega dne načrtujte nekaj ur pri sobni temperaturi ter se o času deljenja odločite glede na stanje testa. Srednji razpored lahko združuje začetni počitek in 12–24 h v hladilniku. Dolg razpored lahko traja dlje, vendar zahteva natančno tehtanje, izmerjeno temperaturo hladilnika in moko, ki ohrani strukturo. To niso univerzalne meje: konkretni primeri so v [receptih](#topic-recipes).'
      },
      {
        id: 'fermentation-readiness',
        title: 'Ocena pripravljenosti',
        level: 3,
        markdown: '- **Na začetku:** masa je zbita in vidnih je malo plinov.\n- **Med aktivnim razvojem:** površina se zaobli, ob robu se pojavijo mehurčki, masa naraste in postane lažja.\n- **V poznejši fazi:** testo lahko začne upadati, postane lepljivejše in izgublja čvrstost. To lahko pomeni, da je fermentacija šla predaleč; ne čakajte do konca časovnega razporeda samo zato, ker časovnik še teče.\n\nTemperaturo in videz vedno primerjajte s časom, navedenim v receptu. Test z nežnim pritiskom prsta uporabljajte previdno in le kot enega od znakov: plin v krogli lahko vpliva na to, koliko se vdolbina povrne.'
      }
    ]
  },
  {
    id: 'topic-methods',
    title: 'Metode priprave',
    description: 'Primerjaj Direct, bigo in poolish ter ročno gnetenje, planetarni in spiralni mešalnik.',
    introduction: '**Direct** pomeni, da vse sestavine zamesimo v končno testo brez predhodno fermentiranega dela moke. Ne pomeni, da je treba testo mešati brez premorov ali da ga ni mogoče hladiti.',
    sections: [
      {
        id: 'method-direct',
        title: 'Direct',
        level: 3,
        markdown: 'Pri vseh treh izvedbah vnaprej stehtajte vse sestavine, odmerite predpisano količino vode za postopno dodajanje ter izmerite temperaturo moke, prostora in vode. Ne dodajajte vode, ki je ni v formuli. Kvas dodajte v skladu z deklaracijo, sol po začetnem povezovanju moke in vode, olje ali sladkor pa samo, če ju vsebuje recept.\n\nSveži kvas nadrobite v moko ali ga po receptu in deklaraciji razmešajte v delu vode iz recepta. Aktivni suhi kvas rehidrirajte samo, če to zahtevajo navodila za konkretni izdelek; uporabite del že stehtane vode in temperaturo, ki jo navaja proizvajalec. Instant kvas se običajno vmeša v moko, razen če deklaracija določa drugače. Voda za rehidracijo je vedno del skupne vode v receptu; ne dodajajte je poleg predpisane količine.'
      },
      {
        id: 'direct-hand',
        title: 'Ročno gnetenje',
        level: 3,
        markdown: '1. Pripravite čisto skledo, strgalo in delovno površino; če je testo mehko, si rahlo zmočite roke. Ne posipajte ga z veliko moke.\n2. Kvas in večino vode dodajte po postopku, primernem za njegovo vrsto, kot je opisano zgoraj. Mešajte s prsti in stiskanjem, dokler ni več suhe moke.\n3. Če je testo čvrsto ali se med delom trga, ga pokrijte in pustite počivati 10–20 minut; ta premor ni obvezen pri vsaki formuli.\n4. Enakomerno dodajte sol. Preostalo vodo dodajajte v majhnih količinah šele, ko testo vpije prejšnjo količino in se masa znova poveže.\n5. Rob testa prepognite proti sredini in ga pritisnite; obrnite skledo ter ponavljajte stiskanje, prepogibanje in počivanje, namesto dolgotrajnega neprekinjenega gnetenja. Olje postopoma vmešajte šele, ko se testo poveže.\n6. Prenehajte, ko ni več suhih žepov, lahko dvignete maso kot celoto in je po počitku prožnejša. Če se trga, jo pokrijte za 10–20 minut; če se segreva ali razleze, prenehajte, izmerite temperaturo in ocenite hidracijo.\n7. Takoj po končanem gnetenju izmerite in zabeležite temperaturo.\n\n**Čvrstejše testo:** uporabljajte prste in strgalo, delajte v kratkih intervalih in mu omogočite počitek; ne raztegujte ga na silo. **Mehkejše testo:** uporabite mokre roke ali strgalo, dodajte manj moke in ga več dvigujte/zgibajte, namesto da ga gnetete.'
      },
      {
        id: 'direct-mixer',
        title: 'Planetarni ali gospodinjski mešalnik',
        level: 3,
        markdown: '1. V navodilih naprave preverite dovoljeni nastavek, delovni cikel ter najmanjšo in največjo količino testa. Te omejitve so odvisne od modela; nazivna prostornina posode ni samodejno priporočena masa testa.\n2. V posodo dodajte moko in kvas, pripravljen glede na njegova navodila, nato večino vode iz recepta. Kavelj ali drug nastavek uporabljajte za testo samo tako, kot predvideva proizvajalec.\n3. Sestavine povežite pri najnižji dovoljeni nastavitvi. Pred strganjem posode ali preverjanjem testa napravo ustavite; med delovanjem mešalnika ne segajte v posodo.\n4. Preostalo vodo postopoma dodajte, ko se testo že povezuje. Sol dodajte po začetni hidraciji, olje pa pozneje in samo, če je navedeno v formuli.\n5. Po kratkih intervalih delovanja preverite stanje: testo je lahko sprva grobo, nato se poveže in postane bolj gladko ter prožno. Nadaljujte z gnetenjem samo, če struktura še ni dovolj povezana.\n6. Če se testo vzpenja po kavlju, udarja ob posodo, se razleze ali hitro segreva, napravo ustavite in upoštevajte navodila za model; zmanjšajte količino ali gnetenje ročno dokončajte le, če je to varno.\n7. Temperaturo izmerite takoj po gnetenju. Hitrosti, trajanja ali faktorja gnetenja ne prenašajte z drugega mešalnika.\n\nČvrsto testo lahko preobremeni majhen gospodinjski mešalnik; mehko testo se lahko ovije okoli kavlja ali pa ga kavelj slabše pobira z dna. Če sta količina ali konsistenca zunaj delovnega območja naprave, testo dokončajte ročno ali izberite drug primeren postopek.'
      },
      {
        id: 'direct-spiral',
        title: 'Spiralni mešalnik',
        level: 3,
        markdown: '1. Preverite priročnik za konkretni spiralni mešalnik: dovoljeni nastavek, vrstni red delovanja, varovalo, najmanjšo/največjo količino, delovni cikel in pravila za izklop. Ne predpostavljajte, da imajo vsi modeli enake hitrosti ali smeri vrtenja.\n2. Stehtajte moko, kvas in skupno količino vode; odmerite samo tisto vodo, ki jo nameravate dodati postopoma ali uporabiti za rehidracijo. Sestavine dodajte v vrstnem redu, ki ga določata naprava in recept. Kvas pripravite v skladu z navodili za njegovo vrsto in deklaracijo izdelka.\n3. Dovoljeni začetni način delovanja uporabite samo toliko, da se sestavine povežejo in izginejo suhi žepi. Testo se mora zbirati v maso, ki jo obdelujeta spirala in posoda, vendar je njegovo gibanje odvisno od modela, velikosti serije in hidracije.\n4. Preostalo vodo dodajajte postopoma šele, ko je prejšnja količina vmešana. Po začetnem povezovanju dodajte sol, olje pa pozneje, če ga vsebuje formula. Dodatne vode ne dolivajte samo zato, ker se testo za kratek čas oprime posode.\n5. Stanje preverjajte med dovoljenimi delovnimi cikli: **povezano** pomeni, da ni suhe moke; **razvito** pomeni, da je masa prožna in se drži skupaj; **pregreto** pomeni, da je temperatura po gnetenju nad ciljem ali da masa postaja nenavadno mehka/lepljiva. Ne čakajte, da se pregrevanje pokaže kot okvara.\n6. Ko je struktura za recept zadostna, prenehajte. Napravo izklopite, preden se dotaknete testa, postrgate posodo ali vzamete vzorec. Takoj izmerite temperaturo; faktor gnetenja beležite ločeno za ta mešalnik, maso in postopek.\n\nČe je serija premajhna, da bi jo naprava zajela, ali prevelika in obremenjuje motor, ne nadaljujte v upanju, da se bo sama uredila. Upoštevajte priročnik, količino zmanjšajte/povečajte le po preračunu formule ali delo dokončajte na drug primeren način.\n\n**Znaki zadostnega razvoja:** testo je enakomerno, prožno in raztegljivo; tanek del lahko previdno raztegnete, preden se strga. »Okence« je pomožni preizkus, ne obvezen ideal za vsako hidracijo, moko ali slog.\n\n**Če je testo preveč napeto:** pokrijte ga in pustite počivati 10–20 minut, nato poskusite znova. **Če je vroče:** ustavite gnetenje, maso razporedite v posodi in jo po potrebi na kratko ohladite. Pregretja ne poskušajte odpraviti z dodatno moko.'
      },
      {
        id: 'method-biga',
        title: 'Biga',
        level: 3,
        markdown: 'Biga je čvrstejši preferment iz moke, vode in kvasa. Delež moke v bigi se običajno izraža kot del **skupne količine moke**: 40% pomeni, da je v bigi 40% moke iz recepta, ne pa da biga predstavlja 40% skupne mase testa.\n\nZa čvrstejšo bigo se pogosto uporabi približno 40–50% vode glede na moko v tem prefermentu. To je hidracija bige, ne končna hidracija pice. Obstajajo različni protokoli: količino kvasa, temperaturo in trajanje je treba medsebojno uskladiti. En dokumentiran protokol uporablja 44–45% vode, 1% svežega kvasa glede na moko v bigi in 18 ur pri 18°C; to je specifičen postopek, ne univerzalno priporočilo.'
      },
      {
        id: 'biga-readiness',
        title: 'Priprava in pripravljenost',
        level: 4,
        markdown: '1. Od skupne količine moke odmerite del za preferment; enako storite z vodo in kvasom.\n2. Na kratko premešajte, da ni več suhih žepov. Če je cilj drobljiva, čvrsta biga, je ne gnetite v gladko, povsem razvito testo.\n3. Posodo pokrijte, da se površina ne suši, hkrati pa pustite dovolj prostora za vzhajanje.\n4. Hranite jo pri temperaturi, ki jo zahteva izbrani protokol; izmerite dejansko temperaturo, ne zgolj nastavitve prostora.\n5. Zrela biga je običajno rahlo napihnjena, prepredena z manjšimi votlinami in prijetno fermentirano diši. Če je sploščena, mokra, izrazito alkoholnega ali ostro neprijetnega vonja, je morda že presegla vrh.\n\nZa majhno domačo količino običajno zadostuje ročna priprava: drobtine enakomerno navlažite s prsti ali lopatico. Planetarni ali spiralni mešalnik uporabite samo, če je serija znotraj delovnega območja, ki ga določa proizvajalec; ustavite ga takoj, ko ni več suhih delov. Biga se ne razvija kot končno testo, zato jo dolgotrajno delo po nepotrebnem segreje in zgladi.\n\n»Zrela« biga ne pomeni nujno, da se je prostornina podvojila: čvrsta biga se ne mora podvojiti. Zabeležite temperaturo in čas. Če je preveč dozorela, jo lahko uporabite le, če sta vonj in struktura še sprejemljiva, ter skrajšate poznejši časovni razpored; neprijetnega vonja ne poskušajte prikriti.'
      },
      {
        id: 'biga-final-mix',
        title: 'Končno gnetenje',
        level: 4,
        markdown: 'Bigo natrgajte ali narežite na koščke, dodajte del preostale vode in jo med povezovanjem s preostalo moko pustite, da se zmehča. Preostalo vodo dodajajte postopoma, nato dodajte sol; olje dodajte nazadnje samo, če ga vsebuje končna formula. Cilj je enakomerno testo brez koščkov suhe bige, ne nujno »popolnoma čista« posoda.\n\nV tabeli recepta ločeno navedite skupno količino moke in vode, nato pa razdelite njuno količino med bigo in končno gnetenje. Moke in vode iz bige ne prištevajte drugič k skupnemu receptu.\n\n**Ročno:** ločite koščke bige in jih zmehčajte v delu preostale vode. Dodajte preostalo moko, stiskajte in prepogibajte, dokler se masa ne poveže, nato jo pustite počivati, če se upira. Postopoma dodajte preostalo vodo, nato sol in olje. Končajte, ko ni več suhih koščkov bige in lahko testo dvignete kot eno maso.\n\n**Planetarni mešalnik:** preverite dovoljeno količino in kavelj. Začnite z večino vode in koščki bige; ko se biga razprši, dodajte preostalo moko. Vodo dodajajte v majhnih količinah, ko mešalnik pobere testo. Sol dodajte po povezovanju, olje pozneje. Pred preverjanjem napravo ustavite; testa, ki se vzpenja po kavlju ali udarja ob posodo, ne silite naprej.\n\n**Spiralni mešalnik:** najprej preverite najmanjšo dovoljeno količino; majhna domača biga pogosto ni primerna za spiralno posodo. Če je serija ustrezna, upoštevajte vrstni red v priročniku, razporedite koščke bige in večino preostale vode tako, da jih naprava enakomerno pobere, nato vodo dodajajte postopoma. Sol in olje po receptu dodajte šele po povezovanju. Prenehajte, ko ni več koščkov prefermenta, je testo razvito za izbrani slog in je temperatura blizu ciljne.'
      },
      {
        id: 'method-poolish',
        title: 'Poolish',
        level: 3,
        markdown: 'Poolish je tekoči preferment, običajno iz enakih mas vode in moke, torej s 100% hidracijo. Delež se računa glede na moko v poolishu. Če gre v poolish 35% skupne količine moke, se preostalih 65% moke doda pri končnem gnetenju.'
      },
      {
        id: 'poolish-readiness',
        title: 'Priprava in pripravljenost',
        level: 4,
        markdown: '1. V posodo stehtajte moko za poolish, enako maso vode in majhno, namerno odmerjeno količino kvasa.\n2. Mešajte, dokler ne izgine suha moka; tekoče zmesi ni treba gnesti kot končnega testa.\n3. Pokrijte in fermentirajte v skladu z receptom in temperaturo.\n4. Ocenite pripravljenost: na površini in ob stenah so vidni mehurčki, prostornina je povečana, površina pa je še rahlo zaobljena ali se je pravkar začela ravnati. Povsem sesedla zmes z močnim alkoholnim vonjem je verjetno že presegla vrh.\n\nZa običajno majhno količino poolisha zadostujeta skleda in žlica/metlica; mešalnik ni potreben, saj je cilj le združiti vodo, moko in kvas, ne pa razviti glutenske mreže. Če je količina velika in uporabite mešalnik, mora biti znotraj dovoljenega območja naprave; ustavite ga takoj, ko ni več suhih žepov. Spiralni mešalnik zlasti ni primeren za majhno količino, ki ne doseže spirale.\n\nČas je odvisen od količine kvasa, temperature in deleža poolisha. Večurni razpon pri hladnejši sobni temperaturi je lahko praktičen, vendar ga ni mogoče brez prilagoditve prenesti v toplo kuhinjo. Namesto da spreminjate samo število ur, spremljajte stanje.\n\nPri končnem gnetenju dodajte poolish in preostalo moko. Vodo, ki manjka do **skupne** količine, dodajajte postopoma. Nato vmešajte sol in po potrebi olje. Poolish že vsebuje del skupne količine vode, moke in kvasa; na seznamu za končno gnetenje navedite samo preostanek.\n\n**Ročno:** poolish zmešajte s preostalo moko in večino vode za končno testo. Ko se zmes poveže, preostalo vodo dodajajte po malem, nato dodajte sol in olje, če sta v receptu. Na kratko delajte s stiskanjem in prepogibanjem, počivajte, če se masa upira, in preverite temperaturo.\n\n**Planetarni mešalnik:** preverite dovoljeno količino in nastavek. V posodo dodajte poolish, preostalo moko in večino vode za končno testo; povežite pri dovoljeni začetni nastavitvi. Zadržano vodo dodajajte postopoma, ko masa pobere moko, nato dodajte sol in nazadnje olje. Ustavite za preverjanje; ne sledite vnaprej določenemu številu minut.\n\n**Spiralni mešalnik:** ne uporabljajte ga, če poolish in končna količina ne dosegata najmanjše mase iz priročnika. Pri ustrezni seriji dodajte poolish, moko in večino vode v skladu z navodili naprave; preostalo vodo dodajte šele, ko se testo poveže. Sol in morebitno olje dodajte pozneje, spremljajte, kako se testo zbira ob spirali, in ustavite, ko je razvito za recept, še preden temperatura preseže cilj.'
      }
    ]
  },
  {
    id: 'topic-handling',
    title: 'Gnetenje in ravnanje s testom',
    description: 'Vadite počivanje, prepogibanje, fermentacijo celotne mase, deljenje in oblikovanje kroglic.',
    introduction: 'Gnetenje porazdeli sestavine in razvija strukturo. Testa ni treba gnesti čim dlje: pretirano delo ga lahko segreje in poškoduje strukturo, počitek med kratkimi intervali dela pa pogosto olajša razvoj.',
    sections: [
      {
        id: 'handling-rests',
        title: 'Avtoliza, premori in prepogibanje',
        level: 3,
        markdown: '- **Avtoliza** je počitek po mešanju moke in vode ter pred dodajanjem kvasa in soli. Za začetek lahko traja 20–30 minut. Pri testu z malo vode ali nekaterih posebnih mokah je učinek lahko majhen; testa ne puščajte dolgo na toplem in nepokritega.\n- **Premor/počitek** po gnetenju zmanjša napetost. Testo pokrijte, da se ne naredi suha skorjica.\n\nBrezglutensko testo ne gre skozi avtolizo ali prepogibanje enako kot pšenično testo. Upoštevajte navodila proizvajalca brezglutenske mešanice.\n\n**Znak, da potrebuje počitek:** testo poka in se krči, ko ga raztezate. Pokrijte ga za 10–20 minut. **Znak, da dodatno gnetenje ni potrebno:** testo je gladko in prožno ter se začne ločevati od posode; nadaljnje gnetenje zvišuje temperaturo, ne nujno kakovosti.'
      },
      {
        id: 'handling-folds',
        title: 'Prepogibanje po korakih',
        level: 3,
        markdown: 'Prepogibanje je nežno delo s testom med fermentacijo celotne mase; ni isto kot gnetenje ali oblikovanje kroglic.\n\n1. Pripravite čisto posodo in strgalo. Roke zmočite ali jih zelo na tanko naoljite; dodatna moka lahko spremeni recept in izsuši površino.\n2. Odkrijte testo, ločite robove od stene posode in široko primite eno stran pod površino, ne samo tankega roba.\n3. Stran počasi dvignite. Raztegnite jo le toliko, da se testo podaljša, ne da bi se stanjšalo, raztrgalo ali močno upiralo; ko začutite upor, prenehajte.\n4. Dvignjeni del prepognite čez sredino mase in ga nežno položite, ne da bi iztisnili plin iz celotne površine.\n5. Posodo obrnite za približno četrt obrata in ponovite z drugo stranjo. Nadaljujte na vseh štirih straneh; to je en celoten sklop prepogibov.\n6. Če je masa še zelo šibka in se takoj po odlaganju razleze, jo pokrijte za 20–30 min in ocenite, ali potrebuje še en sklop. Če je že napeta, gladka in ohranja obliko, ne dodajajte prepogibov.\n7. Posodo pokrijte in nadaljujte fermentacijo celotne mase po receptu.\n\n**Čvrstejše testo:** zmočite roke, rob ločite s strgalom in skrajšajte gib; ne vlecite ga do skrajne dolžine. **Mehkejše testo:** primite ga širše in dvignite le toliko, da ga lahko prepognete; delajte z mokro roko ali strgalom. Če se testo trga, ga takoj položite, pokrijte in pustite počivati. Prepogibanje ni obvezno pri že dobro razvitem testu in se ne uporablja za brezglutensko zmes.'
      },
      {
        id: 'handling-bulk',
        title: 'Fermentacija celotne mase',
        level: 3,
        markdown: '**Fermentacija celotne mase** traja od konca gnetenja do deljenja celotnega testa. **Končno vzhajanje kroglic** se začne po deljenju in oblikovanju kroglic. Pri pici teglia lahko končno vzhajanje poteka v pekaču, ne v kroglicah.'
      },
      {
        id: 'handling-bulk-readiness',
        title: 'Ocena fermentacije celotne mase',
        level: 4,
        markdown: 'Testo položite v pokrito, po možnosti prozorno posodo z ravnimi stenami in označite začetno višino. Eno ali več nežnih prepogibanj lahko pomaga, če je masa šibka. Ne čakajte za vsako ceno na določen odstotek narasta: včasih zadostujeta jasno povečanje prostornine in vidna zračnost, pri nekaterih hladnih časovnih razporedih pa je fermentacija celotne mase kratka.'
      },
      {
        id: 'handling-balling',
        title: 'Deljenje in oblikovanje kroglic',
        level: 3,
        markdown: '1. Pripravite tehtnico, strgalo ter škatlo/posode s pokrovom. Če se testo lepi, jih rahlo naoljite; delovno površino pustite brez moke ali jo le komaj pomokajte.\n2. Stehtajte skupno maso testa. Izračunajte število in maso porcij, nato jih ločite s strgalom z enim čistim rezom; ne trgajte dolgih kosov.\n3. Eno porcijo položite z grobo stranjo navzgor. Robove z nekaj prijemi zbirajte proti sredini in kos po vsakem prijemu obrnite, dokler se robovi ne stikajo.\n4. Stisnite stik na spodnji strani, da se zapre. Porcijo obrnite tako, da je gladka stran zgoraj, stik pa spodaj.\n5. Kroglo z obema rokama rahlo objemite kot s skledastima dlanema. Dlani vodijo robove, prsti pa ne pritiskajo vrha; s kratkim potegom krogle po površini napnite površino. Rahlo jo obrnite in gib nekajkrat na kratko ponovite.\n6. Prenehajte, takoj ko je zgornja površina gladka in napeta, spodnji stik pa zaprt. Če se površina začne trgati, takoj prenehajte, pokrijte testo in ga pustite počivati 10–20 min; napetosti ne poskušajte povečati na silo.\n7. Kroglo položite v posodo s stikom navzdol, pustite prostor za širjenje in jo pokrijte, da se ne naredi skorjica.\n\nPri mehkejšem testu uporabite strgalo, na rokah malo olja in manj vlečenja; ne dodajajte pesti moke. Čvrstejše testo naj se pokrito sprosti, preden ga napnete; uporabite manj sile. Krogla, pripravljena za raztezanje, je običajno narasla, mehka in prožna, vidni pa so drobni plini. Če je trda in se vrača, potrebuje počitek; če se razleze, lepi in trga pri dvigovanju, je morda pretopla, premehka ali preveč fermentirana.'
      }
    ]
  },
  {
    id: 'topic-cold-proof',
    title: 'Hladna fermentacija in priprava na peko',
    description: 'Loči hlajenje, temperiranje, končni počitek kroglic in vzhajanje testa v pekaču.',
    introduction: 'Hladilnik fermentacijo upočasni, vendar je ne ustavi povsem. Testo se ne ohladi takoj na temperaturo hladilnika: sredica velike mase ali zaprte škatle lahko nekaj časa ostane topla. Zato je pomembna kombinacija časa, mase, začetne temperature in meritve temperature hladilnika.',
    sections: [
      {
        id: 'cold-stage',
        title: 'Hlajenje in temperaturne faze',
        level: 3,
        markdown: 'Ločeno zabeležite:\n\n- čas od gnetenja do postavitve v hladilnik;\n- čas v hladilniku in izmerjeno temperaturo;\n- ali ste v hladilnik dali maso ali kroglice;\n- čas temperiranja kroglic po odstranitvi iz hladilnika;\n- čas končnega vzhajanja v pekaču, če pripravljate teglio.\n\n»Temperiranje« pomeni, da se hladno testo prilagodi sobni temperaturi, da je lažje delati z njim. To ni isto kot končno vzhajanje: hladna krogla se lahko ogreje, vendar je še vedno premalo fermentirana; topla krogla je lahko preveč fermentirana.'
      },
      {
        id: 'cold-balls',
        title: 'Temperiranje in končna fermentacija kroglic',
        level: 3,
        markdown: 'Za kroglice začnite s približno 1–3 urami pri 20–23°C, vendar to obravnavajte le kot začetni načrt. Krogla, pripravljena za oblikovanje, se ob rahlem pritisku vda in se razteza brez silovitega vlečenja. Če se takoj krči, ji omogočite še počitek. Če je zelo mlahava in lepljiva, jo nežno oblikujte ali jo specite, preden še bolj oslabi.'
      },
      {
        id: 'cold-pan',
        title: 'Končno vzhajanje v pekaču',
        level: 3,
        markdown: 'Pri tegliji in nekaterih brezglutenskih testih testo po počitku vtisnemo v pekač, kjer se nadaljuje končno vzhajanje. Masa naj bo vidno napihnjena in naj se ob premiku pekača rahlo zatrese, vendar še ohranja obliko. To ni isto kot ogrevanje testa iz hladilnika ali fermentacija celotne mase.'
      }
    ]
  },
  {
    id: 'topic-styles',
    title: 'Slogi pice',
    description: 'Spoznaj neapeljsko pico, Romana Tondo, Romana Teglia in newyorški slog.',
    introduction: '',
    sections: [
      {
        id: 'style-neapolitan',
        title: 'Neapeljska pica: tradicionalni in sodobni pristop',
        level: 3,
        markdown: 'Ime zajema več različnih praks. Tradicionalni certificirani protokol ni sopomenka za vsako sodobno pico z napihnjenim robom: v lastni specifikaciji določa sestavine, obdelavo in peko pri zelo visoki temperaturi. Ta pravila veljajo za ta standard; domača pečica samodejno ne more zagotoviti enakega rezultata.'
      },
      {
        id: 'neapolitan-traditional',
        title: 'Tradicionalni okvir',
        level: 4,
        markdown: 'Tradicionalno testo temelji na moki, vodi, soli in kvasu, brez olja in sladkorja v samem testu. Kroglice se ročno raztegnejo tako, da se plin usmeri proti robu, sredica pa ostane tanka. V peči, ki dosega približno 430–480°C, se pica peče približno 60–90 sekund; ta razpon velja za ta razred opreme in standard, ne za običajno domačo pečico.'
      },
      {
        id: 'neapolitan-home',
        title: 'Sodobne domače prilagoditve',
        level: 4,
        markdown: 'Doma lahko uporabite daljšo hladno fermentacijo, drugačen odstotek vode, majhno količino olja ali sladkorja ter peko na jeklu, kamnu ali v domači peči za pico. To so zavestne prilagoditve, ne »pravila« tradicionalnega protokola. Za kroglo 250 g začnite pri približno 58–63% vode, 2,5–3% soli, količino kvasa pa prilagodite časovnemu razporedu. Raztezajte od sredine proti robu, nato testo z minimalno količino dodatne moke prenesite na lopar.'
      },
      {
        id: 'neapolitan-mixing',
        title: 'Gnetenje neapeljske pice',
        level: 4,
        markdown: 'Pri majhni domači seriji ročno gnetenje omogoča kratke počitke in nežen razvoj. Planetarni in spiralni mešalnik uporabite le, če je količina znotraj dovoljenega območja; prenehajte, ko je testo povezano in raztegljivo, še preden se po nepotrebnem segreje. Ne silite ga v povsem razvito prozorno membrano. Oglejte si postopek [ročno gnetenje Direct](#direct-hand), [planetarni mešalnik](#direct-mixer) in [spiralni mešalnik](#direct-spiral).\n\n**Pripravljenost:** rob je zračen in prožen, sredica pa dovolj tanka, da se speče, ne da bi se izsušila. Če je rob zbit, preverite, ali je bilo testo hladno, premalo spočito ali premočno stisnjeno pri oblikovanju.'
      },
      {
        id: 'style-tonda',
        title: 'Romana Tonda',
        level: 3,
        markdown: ''
      },
      {
        id: 'tonda-shaping',
        title: 'Oblikovanje in peka',
        level: 4,
        markdown: 'Romana Tonda je tanka, okrogla rimska pica, ki se pogosto peče dlje in je bolj hrustljava od mehkejše neapeljske pice. Recepti se razlikujejo; niso vsi enake debeline, hidracije ali stopnje hrustljavosti. Za tanko in enakomerno raztezanje se pogosto uporablja valjar.\n\nZačetno izhodišče za domači preizkus je lahko 58–63% vode, približno 2,5–3% soli in okoli 2–4% olja, ob uporabi moke, ki prenese izbrani časovni razpored. Pri zelo tanki in hrustljavi različici začnite bliže spodnjemu delu razpona; mehkejša domača različica lahko uporabi višjo hidracijo. Olje je pogosta prilagoditev sloga, ne pa univerzalni pogoj. Krogla mora dovolj počivati, da jo lahko tanko raztegnete brez krčenja.\n\n1. Kroglo pomokajte in jo z rokami ali valjarjem enakomerno raztegnite na približno 28–30 cm, brez velikih mehurjev.\n2. Sredica naj bo enakomerno tanka; pri valjanju pazite, da robov povsem ne stisnete.\n3. Prenesite jo na rahlo pomokan lopar ali pekač in dodajte zmerno količino nadeva.\n4. V domači pečici pecite na dobro segretem jeklu/kamnu približno 6–10 min pri 230–280°C; spremljajte dno in površino.\n\nTonda lahko na spodnji strani potemni, še preden se nadev segreje. Višino rešetke, količino omake in temperaturo prilagodite dejanski peki. Cilj sta enakomerno tanka podlaga in hrustljavost, ne nujno enak rezultat kot v profesionalni peči.'
      },
      {
        id: 'tonda-mixing',
        title: 'Gnetenje Tonde',
        level: 4,
        markdown: 'Tonda se pogosto oblikuje na tanko, zato je enakomerno povezano in spočito testo lažje razvaljati ali raztegniti brez krčenja. Pri ročnem delu uporabljajte kratke intervale dela in počitka; z mešalnikom prenehajte, ko je masa povezana in dovolj raztegljiva. Pri zelo čvrstem testu najprej preverite količino vode v receptu in moko; suhosti ne poskušajte nadomestiti z daljšim delom. Uporabite postopek [ročno gnetenje Direct](#direct-hand) ali ustrezen [planetarni](#direct-mixer)/[spiralni](#direct-spiral) mešalnik, vendar samo znotraj njegovih omejitev.'
      },
      {
        id: 'style-teglia',
        title: 'Romana Teglia',
        level: 3,
        markdown: ''
      },
      {
        id: 'teglia-shaping',
        title: 'Oblikovanje in peka v pekaču',
        level: 4,
        markdown: 'Romana Teglia se peče v naoljenem pravokotnem pekaču. V nasprotju z okroglo kroglo za tondo se testo običajno ohrani kot ena masa in se v pekaču raztegne v eni ali več fazah. Končno vzhajanje poteka v pekaču.\n\nŠtevilni domači recepti za začetek uporabijo približno 70–80% vode, vendar ta razpon ni univerzalna formula: odvisen je od moke, pekača, debeline in načina fermentacije. Pri prvem poskusu se držite spodnjega dela razpona. Višja hidracija zahteva natančno tehtanje, posodo za prepogibanje in previdno prenašanje.\n\n1. Po gnetenju maso pustite pokrito.\n2. Če je šibka, jo enkrat ali dvakrat nežno prepognite z vmesnim počitkom, dokler se ne napne.\n3. Fermentirajte jo kot celotno maso, v hladnem ali pri sobni temperaturi, skladno z receptom.\n4. Pekač naoljite. Testo prenesite vanj, pustite počivati in ga s prsti potisnite proti robovom, ne da bi ga trgali.\n5. Če se krči, ga pokrijte in pred nadaljevanjem počakajte 15–20 minut.\n6. Počakajte, da se testo v pekaču vidno napihne, dodajte nadev po načrtu in specite.\n\n**Napaka:** oblikovanje kroglic kot za tondo in nato ponovno združevanje v pekaču. Tako lahko nastane neenakomerna debelina. **Takojšen ukrep:** nežno poravnajte, pustite počivati in nadaljujte z eno maso.'
      },
      {
        id: 'teglia-mixing',
        title: 'Gnetenje Teglie',
        level: 4,
        markdown: 'Pri mehkejšem testu prihranite del vode za postopno dodajanje in preverjajte, ali masa vpije vsako količino. Pri ročnem delu uporabljajte mokre roke in premore; planetarni ali spiralni mešalnik uporabite samo, če količina in hidracija ustrezata navodilom naprave. Po gnetenju testo po potrebi okrepite z enim ali dvema opisanima [prepogiboma](#handling-folds), namesto da bi ga dolgo gneli. Naprava, ki ne zajame majhne mase, ni primerna za to serijo.'
      },
      {
        id: 'style-new-york',
        title: 'New York',
        level: 3,
        markdown: ''
      },
      {
        id: 'new-york-shaping',
        title: 'Oblikovanje, nadev in peka',
        level: 4,
        markdown: 'Za slog New York je običajna tanka, upogljiva sredica, izrazitejši, vendar ne prevelik rob ter dno, ki ga je mogoče zapeči in prepogniti. To so opisne smernice, ne ena uradna sestava. Recepti se razlikujejo po moki, sladkorju, olju, vodi in fermentaciji.\n\nZa domači začetek poskusite 60–65% vode, 2–2,7% soli, 1–3% olja in po želji 0–2% sladkorja. Močnejša krušna moka je pogosto praktična, vendar preverite deklaracijo in obnašanje pri oblikovanju. Hladna fermentacija 24–48 ur je pogost razpored, vendar morate količino kvasa prilagoditi temperaturi hladilnika, sobni fazi in času temperiranja.\n\nTesto raztezajte enakomerno in ohranite rahel rob. Sredice ne stanjšajte toliko, da bi nadev prebil testo. Domača pečica peče dlje kot peč za neapeljsko pico; tanjša skorja in zmerna količina vlažnega nadeva zmanjšata tveganje za pocasto sredico.'
      },
      {
        id: 'new-york-mixing',
        title: 'Gnetenje testa New York',
        level: 4,
        markdown: 'Razvijte enakomerno, raztegljivo strukturo, ki lahko ohrani tanko sredico in dvignjen rob; če se testo krči, ga pustite počivati. Ročno delajte v kratkih intervalih ali uporabite gospodinjski/spiralni mešalnik znotraj omejitev proizvajalca. Olje dodajte po začetnem povezovanju, če tako zahteva formula. Oglejte si postopek [ročno gnetenje Direct](#direct-hand), [planetarni mešalnik](#direct-mixer) in [spiralni mešalnik](#direct-spiral).'
      }
    ]
  },
  {
    id: 'topic-gluten-free',
    title: 'Brezglutensko testo',
    description: 'Pripravi ločeno brezglutensko testo in prepreči navzkrižni stik.',
    introduction: 'Brezglutenska mešanica ne tvori pšenične glutenske mreže. Vodo in vezivno strukturo zagotavljata sestava mešanice in morebitni dodatki, kot sta psyllium ali ksantan. Vsaka mešanica se lahko obnaša drugače; preveri deklaracijo in alergene.',
    sections: [
      {
        id: 'gf-blend',
        title: 'Mešanica in vezivo',
        level: 3,
        markdown: '- Če mešanica že vsebuje vezivo, ne dodajajte samodejno še psylliuma.\n- Če veziva ne vsebuje, ne predpostavljajte, da bo enaka količina dodatka delovala z drugim škrobom/moko.'
      },
      {
        id: 'gf-handling',
        title: 'Mešanje in oblikovanje',
        level: 3,
        markdown: '- Zmes je pogosto mehkejša in jo lahko z mokrimi ali naoljenimi prsti vtisnete v pekač; ne poskušajte je raztezati kot pšenično kroglo.\n- Počitek po mešanju omogoči, da škrob in vezivo vpijeta vodo. Prepogibanje za glutensko čvrstost ni potrebno.\n- Peka v pekaču ali na papirju lahko olajša delo.\n- Planetarni nastavek ali spiralni mešalnik nista samodejno primerna: preverite navodila za mešanico ter najmanjšo/največjo količino naprave. Če navodila za izdelek zahtevajo ročno mešanje ali mešalnik, jih upoštevajte; ne uporabljajte preizkusov glutena ali pšeničnih prepogibov.'
      },
      {
        id: 'gf-bake',
        title: 'Fermentacija in peka',
        level: 3,
        markdown: 'Spremljajte narast, mehurčke in strukturo površine, vendar ne pričakujte enakih znakov elastičnosti kot pri pšeničnem testu. Predolgo vzhajanje lahko oslabi maso in oteži prenašanje. Testo pecite, dokler sredica ni čvrsta, dno pa dobro obarvano; pri nekaterih receptih pomaga kratka predpeka pred dodajanjem nadeva.'
      },
      {
        id: 'gf-safety',
        title: 'Navzkrižna kontaminacija',
        level: 3,
        markdown: 'Za osebe s celiakijo ali zdravstveno potrebo po izogibanju glutenu uporabite označene brezglutenske sestavine, čiste posode, delovno površino, pribor in pečico; pazite tudi na moko v zraku ter skupni kamen/jeklo. Ta priročnik ne zagotavlja odsotnosti navzkrižne kontaminacije.'
      }
    ]
  }
];
