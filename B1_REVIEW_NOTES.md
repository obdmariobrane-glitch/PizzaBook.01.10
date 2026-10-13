# PizzaBook B1 Final Review Notes

## Status

B1 potvrđen nakon popravka i stvarnog web reloada. B2 je potvrđen za raniji
ciljani javni fridge-out test i dodatnu lokalnu coverage provjeru. Opseg,
ograničenja i matrica slučajeva nalaze se u `B2_COVERAGE_REVIEW.md`; tri nova
slučaja nisu potvrđena u javnom previewu.

## Baseline

- Base/current repository commit: `98c348517f54e5d12ee7dd2fd6c15ab1af8ba948`
- Commit subject: `Preserve Teglia format in Beginner planner`
- B1 promjene nisu commitane; aktualni preview je pokrenut iz ovog worktreeja.
- Local preview URL: `http://localhost:3000`
- Public B2 preview URL: `https://pizzabook--b2-fridgeout-20261011.expo.app`
- EAS B2 deployment: `aw0tig81p0`; alias `b2-fridgeout-20261011`.
- B2 URL was generated from a fresh `expo export --platform web` directory.
- Build/source identitet: `local-web-b1-2026-10-10`, Expo `1.0.4`, Android
  versionCode `5`, base commit gore plus aktualni B1 worktree patch.
- Nema udaljenog objavljenog commit-a ili EAS native builda; javni web preview
	je EAS Hosting deployment iz aktualnog uncommitted worktreeja. Postojeći
	`update.json` APK URL nije korišten kao B1 preview.

## B1 implementation files

- `frontend/app/(tabs)/index.tsx`
- `frontend/src/beginnerPlanPersistence.ts`
- `frontend/src/beginnerPlanRestoreCoordinator.ts`
- `frontend/src/experienceLevel.ts`
- `frontend/src/preferences.ts`
- `frontend/src/i18n/translations.ts`
- `frontend/app/(tabs)/planner.tsx`
- `frontend/package.json`
- `frontend/scripts/verify-beginner-plan-persistence.js`

`frontend/B1.diff` uključuje sve navedene B1 izmjene i nove untracked datoteke.
`frontend/B2.diff` je stvarni Git diff iz baze
`98c348517f54e5d12ee7dd2fd6c15ab1af8ba948`, uključujući aktualne
`planner.tsx`, `translations.ts`, B1 module i B2 regresiju.
`experienceLevel.ts` i `preferences.ts` sadrže generation-safe in-memory commit
API-je potrebne nakon koordiniranog čitanja.

## Root cause and fix

`guidedPlanId` je prije sadržavao `directHomeSchedule.startAt` i izvedene sate.
Ti podaci ovise o trenutku izračuna, pa je pravi reload mogao napraviti novi ID
za isti korisnički plan i učitati prazan progress zapis. Popravak veže ID uz
production builder `createBeginnerPlanInputKeyFromState()` i postojeći stabilni
`beginnerPlanInputKey`. Builder uključuje stvarne plan-inpute, uključujući
promjer za okrugle pizze i `30x40`/`20x60` dimenzije samo za Tegliu. Roman
format je dio ključa samo za stil Romana. Stvarna
promjena termina, stila, brašna, zamjesa, kvasca, promjera ili Teglia dimenzija
i dalje stvara novi ID.

## Packaged support files

Pomoćni produkcijski i testni izvori potrebni za pokretanje provjera:

- `frontend/src/calculator.ts`
- `frontend/src/guidedRecipe.ts`
- `frontend/src/notifications.ts`
- `frontend/src/components/GuidedRecipePanel.tsx`
- `frontend/src/utils/storage/index.ts`
- `frontend/src/utils/storage/index.web.ts`
- `frontend/src/utils/storage/storage-base.ts`
- `frontend/tsconfig.json`
- `frontend/scripts/verify-beginner-direct-v1.js`
- `frontend/scripts/verify-beginner-direct-schedule.js`
- `frontend/scripts/verify-guided-recipe.js`
- `frontend/scripts/verify-beginner-notifications.js`
- `frontend/scripts/verify-home-pizza-plan.js`

Review documents included:

- `B1_REVIEW_NOTES.md`
- `B1_VERIFICATION_REPORT.md`

## Unrelated worktree changes

These existing user changes are intentionally excluded from the B1 diff and
ZIP and were not modified:

- `BEGINNER_FINAL_3_ISSUES.md`
- `BEGINNER_REMAINING_TEXT_AUDIT.md`
- `QA_HANDOFF.md`
- `frontend/app.json.backup`
- `pizzabook_beginner_text_export/`

The final B1 diff contains only the two tracked B1 source changes, the two
tracked support-module changes, and the three B1 untracked production/test files:
`index.tsx`, `package.json`, `experienceLevel.ts`, `preferences.ts`,
`beginnerPlanPersistence.ts`, `beginnerPlanRestoreCoordinator.ts`, and
`verify-beginner-plan-persistence.js`.

## Verification completed

No checks were rerun for packaging. The latest completed results were:

- `npx tsc --noEmit --pretty false`: passed.
- `npm run check:beginner-plan-persistence`: passed.
- `npm run check:beginner-direct-v1`: passed.
- `npm run check:beginner-direct-schedule`: passed.
- `npm run check:guided-recipe`: passed.
- `npm run check:beginner-notifications`: passed.
- Editor diagnostics for touched TypeScript/JavaScript files: no errors.
- Proširena identity matrica: svi Beginner stilovi, room-only/fridge-room,
	hand/mixer, fresh/dry yeast i caputo00/manitoba/spelt/wholeWheat/glutenFree/
	custom flour putovi.
- Stvarni UI tok na lokalnom previewu: `1/8` nakon prvog koraka, `1/8` nakon
	Profil -> Kalkulator, `1/8` nakon punog reload-a. Dokazi su u
	`frontend/ui_evidence/18-b1-after-reload-progress-visible.png` i ranijim
	screenshotovima u istom direktoriju. Javni preview je otvoren i prikazuje
	aktualni Beginner intro.
- Novi ZIP, checksum i sadržaj paketa provjereni nakon regeneracije.

## Resolver assumption and limitation

`resolveBeginnerRestoreBakeAt` treats a valid `beginnerBakeAt` legacy value that
differs from an older snapshot bake time as the current Planner selection. This
matches the application contract: Planner writes that legacy key when the user
chooses a new date, and the new date must invalidate/supersede the old snapshot.

A different timestamp alone does not prove that the legacy record was written
later. Storage has no write-generation or timestamp metadata in this B1 format,
so an out-of-order or stale legacy write cannot be distinguished from a current
Planner selection. The automated regression verifies the intended policy and
explicitly documents this provenance limitation; it does not claim chronological
proof from the date values.

## Automated versus UI verification

Kodne provjere izvršavaju produkcijske persistence, restore-coordinator,
calculator i guided-recipe funkcije; identity matrica i source contract izravno
provjeravaju novi ključ. To nisu zamjena za mount aplikacije.

UI provjera je izvršena u stvarnom Expo web previewu s AsyncStorageom: generiran
je plan za 11.10.2026. u 19:00, zatim je označen prvi korak, posjećena je Profil
kartica, vraćeno se na Kalkulator i napravljen browser reload. Rezultat je
uspješno ostao `1/8`.

## B2 fridge-out finding and fix

Za isti raspored (`bakeAt=19:00`, `roomBeforeFridgeHours=115/60 h`,
`fridgeHours=8 h`, Phase A/B/C `20/90/5 min`, `roomAfterFridgeHours=2 h`):

- `ballingAt = 08:55`, `fridgeAt = 09:00`; `fridgeAt - ballingAt = Phase C = 5 min`.
- Beginner i detaljne upute koriste `startAt + (roomBeforeFridgeHours + fridgeHours)`:
	`07:05 + 1:55 + 8:00 = 17:00`.
- Stari Planner je koristio `ballingAt + fridgeHours`: `08:55 + 8:00 = 16:55`.
- Popravak u `reversePlan` koristi `fridgeAt + fridgeHours`: `09:00 + 8:00 = 17:00`.

Time je potvrđeno da je `ballingAt` uzrok razlike samo zato što ga je Planner
pogrešno koristio kao početak hladne faze. Formula `ballingAt` nije mijenjana;
Planner sada izvodi vađenje iz `fridgeAt`, kao Beginner i detaljne upute.

## B2 public end-to-end verification

Javni B2 UI test izvršen je na `https://pizzabook--b2-fridgeout-20261011.expo.app`.
Beginner i detaljne upute prikazali su vađenje u `17:00`; Planner je prikazao
`16:55` za podjelu/kuglice i `17:00` za stvarni korak vađenja. Nakon označavanja
prvog koraka, odlaska na Profil, povratka na Calculator i punog reloada ostali
su `1/8`, `17:00` i isti plan. Dokazi su u
`frontend/ui_evidence/19-b2-public-planner-fridgeout.png` i
`frontend/ui_evidence/20-b2-public-beginner-after-reload.png`.

## B2 representative coverage follow-up

Proširena lokalna UI provjera izvršena je za Romana Tonda/mikser/suhi kvasac/
Manitoba, Romana Teglia/ručni zamjes/svježi kvasac/integralno i New York/
mikser/svježi kvasac/bezglutensko brašno. Beginner, detaljne upute i Planner
uspoređeni su za svaki slučaj; nakon stvarnog reloada napredak je ostao `1/8`,
`1/8` i `1/6`. Provjera je otkrila i popravila zastarjeli Roman format u
identitetu New York plana. Detaljna matrica i granice provjere nalaze se u
`B2_COVERAGE_REVIEW.md` i `B2_VERIFICATION_REPORT.md`.

Room-only rezultat iz ranije provjere klasificiran je samo kao lokalni UI test.
Nije potvrđen javnim previewem ni reloadom. Room-only rasporedni kod nije
mijenjan. Tri nove kombinacije nisu ponovljene u javnom previewu. B3 nije
započet.

## Naknadna objava B2 identity popravka

Aktualni kod s popravkom identiteta plana objavljen je na
`https://pizzabook--fi76aijhtf.expo.app`, EAS deployment ID `fi76aijhtf`,
alias `b2-identityfix-20261011`. Javni landing page učitao se, a SHA-256
objavljenog JavaScript bundlea poklapa se s lokalnim exportom:
`07ce27d3c1f021ff439672695d332941db4cc5b10b61951e27d2f47f0603e5b0`.
To potvrđuje identitet builda, ne ponavljanje B2 slučajeva na javnom UI-ju.
Room-only reload/javna provjera, miješano brašno, jezik/jedinice, Neapolitan
cross-surface i preostale kombinacije ostaju otvoreni.

## Završne B2 provjere nakon ovog deploymenta

Naknadno su na `fi76aijhtf` javno provjereni room-only plan i Romana Tonda
hladni plan s mješavinom brašna 70% Tipo 0/00 + 30% integralno. Room-only
raspored i `1/7` napredak preživjeli su Profil → Kalkulator i stvarni reload.
Custom plan je ostao `1/8` nakon HR → DE i metričkih → US jedinica; promjena
sastojka B iz integralnog u pir pokazala je reset na `0/8`.

Usporedba je otkrila da je Beginner/Planner prikazivao kuglice i ulazak u
hladnjak u `16:55`, dok su detaljne upute pokazivale `17:00`. Popravak sada
razdvaja `ballingAt` i `fridgeAt`; potvrđen je javno na
`https://pizzabook--m3gh4gw90j.expo.app` (`m3gh4gw90j`) uz reload i `1/9`.
Prethodno potvrđene Napolitana i New York hladne slučajeve nismo ponavljali.
