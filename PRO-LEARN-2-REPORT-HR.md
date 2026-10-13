# PRO-LEARN-2 — izvještaj za pregled

## Status

Hrvatska verzija priručnika implementirana je u aplikaciji. Uključuje svih 18 tema, potpuni sadržaj iz ažuriranog HR izvornika, zasebne stranice tema, navigaciju po podpoglavlju i zajednički ulaz iz Beginner, Pro i postavki.

Prijevodi novog priručnika na EN/DE/SL nisu ugrađeni. Za te jezike ostaje postojeći lokalizirani edukativni prikaz. Nove ilustracije nisu izrađene; na naslovnici se koristi postojeća ilustracija Pro chefa. Nije provedena produkcijska objava niti je izrađen APK.

## Sadržaj i navigacija

- Početna stranica prikazuje 18 tema kao kartice; sadržaj se čita na pojedinačnim stranicama.
- Stranice tema prikazuju sadržaj podpoglavlja na vrhu, cijeli tekst redom, poveznice među temama te povratak na popis.
- Povratak s teme na popis zadržava prethodni položaj u pregledniku.
- Direct, Biga i Poolish te ručni, planetarni/kućni i spiralni zamjes obrađeni su zasebno u edukativnom sadržaju; odabiri kalkulatora nisu mijenjani.
- Tablice ostaju unutar širine prikaza. Na mobilnoj širini provjerena je čitljivost receptne tablice i satnice.
- U HR su izvorni i generirani sadržaj potpuno usklađeni. Provjera je našla 18 tema, 97 jedinstvenih stabilnih ID-jeva i 111 internih poveznica.

## Završne HR ispravke

Ažuriran je `PRO-LEARN-HR.md` i iz njega ponovno generiran sadržaj aplikacije. Ispravljene su upute o zagrijavanju pleha, dodavanju i rehidraciji triju vrsta kvasca te očite jezične pogreške. Teglia raspored od 08:00 prvog dana do 12:45 drugog dana navodi ukupno 28 h 45 min; navedeni raspon je 22 h 05 min–30 h 40 min i uključuje radne korake. Napomene o procjenama i o tome da računski primjeri nisu svi praktično isprobani ostaju u izvorniku.

## Provjere

| Provjera | Rezultat |
|---|---|
| `node ./frontend/scripts/generate-pro-learn-manual.js` | Prošlo; generirano 18 tema. |
| `node ./frontend/scripts/verify-pro-learn.js` | Prošlo; 18 tema, 97 stabilnih ID-jeva, 111 internih poveznica i potpuna podudarnost s izvornikom. |
| `cd frontend && yarn tsc --noEmit` | Prošlo. |
| ESLint za nove rute, renderer, postavke i lokalizaciju | Prošlo. |
| Interaktivna provjera HR pristupa iz Beginner, Pro i postavki | Prošlo; sva tri ulaza otvaraju zajednički `/pro-guide`. |
| Interaktivna provjera inline poveznice na drugu temu i povratka na popis | Prošlo u web pregledniku. |
| EN/DE/SL prikaz | Prošlo vizualno; postojeći lokalizirani sadržaj ostaje prikazan, bez HR teksta. |
| Web i mobilni prikaz | Pregledano na širokom prikazu preglednika te u mobilnom prozoru 390 × 844 px. |

Puna naredba `yarn lint` i ranije je prijavila postojeće probleme u velikoj datoteci kalkulatora `frontend/app/(tabs)/index.tsx` (ažuriranje stanja u efektima i redoslijed deklaracije). Ti problemi nisu dio ove edukativne izmjene; ciljano lintanje izmijenjenih edukativnih i lokalizacijskih datoteka prolazi.

Nije provedeno testiranje na fizičkom Android uređaju ni nativni APK; mobilna vizualna provjera provedena je u web pregledniku. Android povratna gesta stoga nije zasebno potvrđena.

## Snimke

- [Početna stranica — web](PRO-LEARN-2-review/screenshots/01-index-web.png)
- [Početna stranica — mobilni prikaz](PRO-LEARN-2-review/screenshots/04-index-mobile.png)
- [Metode pripreme — web](PRO-LEARN-2-review/screenshots/02-methods-web.png)
- [Direct i ručni zamjes — mobilni prikaz](PRO-LEARN-2-review/screenshots/03-methods-mobile-direct.png)
- [Romana Teglia — receptna tablica i koraci, mobilni prikaz](PRO-LEARN-2-review/screenshots/05-teglia-schedule-mobile.png)
- [Metode — mobilni prikaz nakon interne poveznice](PRO-LEARN-2-review/screenshots/06-methods-mobile-crosslink.png)
- [Postojeći engleski edukativni sadržaj](PRO-LEARN-2-review/screenshots/07-legacy-english-fallback.png)
- [Postojeći njemački edukativni sadržaj](PRO-LEARN-2-review/screenshots/08-legacy-german-fallback.png)
- [Postojeći slovenski edukativni sadržaj](PRO-LEARN-2-review/screenshots/09-legacy-slovenian-fallback.png)
- [Romana Teglia — receptna tablica i koraci, web](PRO-LEARN-2-review/screenshots/10-teglia-schedule-web.png)

## Promijenjene datoteke

- `PRO-LEARN-HR.md` i `PRO-LEARN-REPORT-HR.md` — završne HR ispravke i ažurirani izvještaj sadržaja.
- `frontend/app/(tabs)/index.tsx` i `frontend/app/settings.tsx` — zajednički ulazi u priručnik.
- `frontend/app/pro-guide/index.tsx` i `frontend/app/pro-guide/[topicId].tsx` — popis tema i stranice tema.
- `frontend/src/proLearn/types.ts`, `manuals.ts`, `MarkdownContent.tsx`, `LegacySchoolPage.tsx` i `manualContent.generated.ts` — tipovi, registracija lokalizacija, prikaz Markdowna, naslijeđeni prikaz i generirani HR sadržaj.
- `frontend/src/i18n/LanguageProvider.tsx` i `frontend/src/i18n/translations.ts` — čekanje učitavanja jezika i lokalizirani navigacijski tekstovi.
- `frontend/scripts/generate-pro-learn-manual.js` i `frontend/scripts/verify-pro-learn.js` — generiranje i provjera izvornika.
- `PRO-LEARN-2-REPORT-HR.md` — ovaj izvještaj.

## Granice promjena

Nisu mijenjani kalkulatori, formule, doziranje kvasca u kalkulatoru, fermentacijski rasporedi kalkulatora, planer, timere, pohrana recepata, pretplate ni prava pristupa. Stari sadržaj drugih jezika ostaje dostupan dok ne budu spremni potpuni prijevodi novog priručnika.

## Dodatni korak — ulaz iz početnog izbora

Prije izmjene ekran izbora provjeren je na webu pri 1280 × 720 px i u mobilnom prikazu 390 × 844 px. Obje opcije bile su vidljive; na mobitelu je ispod njih ostalo dovoljno mjesta za zasebnu karticu.

Ispod kartica Beginner i Pro dodan je pritisljivi ulaz „Kako postati Pro”, s postojećom slikom `chef-pro.png`. Kartica koristi postojeći `/pro-guide`; ne stvara drugu rutu niti kopiju vodiča. Dodani opis i naziv koriste lokalizirane tekstove za HR/EN/DE/SL. Početna provjera usmjeravanja dopušta otvaranje vodiča prije izbora načina rada, ali i dalje vraća na izbor za ostale rute dok način rada nije odabran.

### Datoteke izmijenjene u ovom koraku

- `frontend/app/onboarding.tsx` — nova kartica ispod obje postojeće opcije, postojeća ilustracija Pro chefa i navigacija na `/pro-guide`.
- `frontend/app/_layout.tsx` — uska iznimka u početnom usmjeravanju kako bi se vodič mogao otvoriti prije odabira Beginner/Pro.
- `frontend/src/i18n/translations.ts` — opis kartice na hrvatskom, engleskom, njemačkom i slovenskom.
- `PRO-LEARN-2-REPORT-HR.md` — ovaj zapis provjere.

### Rezultati provjera

- Vizualno provjereno prije i poslije izmjene na webu i mobilnoj širini. Nakon izmjene kartica je neposredno ispod obje opcije; nijedna opcija nije prekrivena ni zamijenjena. Kartica je aktivirana klikom/tapom na obje širine.
- U HR/EN/DE/SL kartica prikazuje lokalizirani naziv i vodi na isti `/pro-guide`. Za EN/DE/SL prikazuje se postojeći lokalizirani sadržaj, bez hrvatskog teksta.
- Povratak iz novog ulaza vraća na odgovarajući izbor Beginner/Pro; povratak iz postojećeg ulaza vraća na kalkulator.
- `cd frontend && yarn tsc --noEmit` prolazi.
- ESLint prolazi za `app/onboarding.tsx` i `src/i18n/translations.ts`. `app/_layout.tsx` prolazi uz isključivanje već postojeće greške pravila `react-hooks/set-state-in-effect`; ostaje ranije upozorenje `@typescript-eslint/array-type`. Bez tog isključenja lint datoteke pada na postojećem sinkronom ažuriranju stanja u efektu, koje nije uvedeno ovim korakom niti je mijenjano.
