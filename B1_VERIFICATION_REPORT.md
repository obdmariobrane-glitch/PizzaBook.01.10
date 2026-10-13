# B1 Verification Report

## Status

B1 je potvrđen ranijim testom. Ciljani B2 fridge-out slučaj je zasebno ranije
potvrđen u javnom UI-ju; dodatna reprezentativna coverage provjera za tri
kombinacije provedena je lokalno. Ne tvrdi se da su te tri kombinacije
provjerene u javnom previewu. Njihovi rezultati i ograničenja nalaze se u
`B2_VERIFICATION_REPORT.md`.

## Baseline

- B1 nije commit-an; paket prikazuje aktualne uncommitted datoteke.
- Local preview URL: `http://localhost:3000`
- Public B2 preview URL: `https://pizzabook--b2-fridgeout-20261011.expo.app`
- EAS Hosting B2 deployment: `aw0tig81p0`, alias `b2-fridgeout-20261011`.
- Build/source: `local-web-b1-2026-10-10`, Expo `1.0.4`, Android versionCode `5`,
  base commit `98c348517f54e5d12ee7dd2fd6c15ab1af8ba948` plus B1 worktree patch.
- Nema udaljenog objavljenog commit-a ili EAS native builda; javni web preview
	je objavljen iz svježeg `expo export --platform web` direktorija. `update.json`
	APK nije dokaz aktualnog B1 previewa.

## Exact B1 implementation files

- `frontend/app/(tabs)/index.tsx`
- `frontend/src/beginnerPlanPersistence.ts`
- `frontend/src/beginnerPlanRestoreCoordinator.ts`
- `frontend/src/experienceLevel.ts`
- `frontend/src/preferences.ts`
- `frontend/package.json`
- `frontend/scripts/verify-beginner-plan-persistence.js`

B1 review artifacts:

- `frontend/B1.diff`
- `B1_REVIEW_NOTES.md`
- `B1_VERIFICATION_REPORT.md`
- `frontend/B2.diff`
- `frontend/ui_evidence/19-b2-public-planner-fridgeout.png`
- `frontend/ui_evidence/20-b2-public-beginner-after-reload.png`

Known pre-existing unrelated worktree changes were not modified or packaged:

- `BEGINNER_FINAL_3_ISSUES.md`
- `BEGINNER_REMAINING_TEXT_AUDIT.md`
- `QA_HANDOFF.md`
- `frontend/app.json.backup`
- `pizzabook_beginner_text_export/`

## Production implementation

`frontend/app/(tabs)/index.tsx` uses the shared persistence module and the shared
async restore coordinator. `frontend/src/beginnerPlanPersistence.ts` owns the
versioned snapshot shape, schedule date serialization and validation, tolerant
JSON parsing, active-plan expiry, and stable input-key creation.

`frontend/src/beginnerPlanRestoreCoordinator.ts` reads the actual AsyncStorage
path and keys for experience level, temperature unit, measurement system,
preferred yeast, calculator settings, legacy bake date, and the versioned
Beginner snapshot. It returns no restore result until every read completes.
Scalar preference and experience values are decoded from their JSON-stringified
storage form. Calculator settings and the snapshot retain their own JSON
payloads, while the Planner legacy date remains its separate ISO-string record.
Generation and mounted guards discard an older response after a mode change, a
new load, or unmount. `activate()` makes the same coordinator reusable for
React Strict Mode setup-cleanup-setup.

The app applies loaded experience and preference caches only after the
coordinator confirms the generation is current. This prevents temporary `fresh`
from entering the snapshot input key. It preserves the existing shared bake date
while reading. Only a current successful Beginner restore or valid Planner
legacy date changes it; Pro, rejected, stale, and unmounted restores preserve
the date. Saving the snapshot and guided notification synchronization remain
gated by completed settings hydration.

The restored schedule remains authoritative for displayed schedule terms, while
`homePlan` is calculated with the stored `calculationNow`, preserving candidate
evaluations and flour guidance.

### Reload identity fix

The previous `guidedPlanId` included `directHomeSchedule.startAt` and derived
durations. Those values can move when `calculationNow` changes during reload,
which orphaned the saved progress for the same plan. The targeted fix now calls
`createGuidedPlanId([beginnerPlanInputKey])`, where the app constructs that key
through production `createBeginnerPlanInputKeyFromState()`. It includes actual
plan choices, round diameter, and conditional Teglia tray dimensions, while
excluding language/unit display preferences. Roman format is included only
when `pizzaStyle === 'romana'`; stale Roman settings do not affect New York or
Neapolitan plan identity.

## Planner-date resolver limitation

`resolveBeginnerRestoreBakeAt` gives a valid Planner legacy date precedence when
it differs from the stored snapshot date. This is the intended application
policy because Planner writes `beginnerBakeAt` when the user selects a new date,
and the new selection must supersede the older active snapshot.

A different date alone is not evidence that the legacy record was written later.
The B1 storage format has no write-generation or provenance metadata, so an
out-of-order or stale legacy write cannot be distinguished from a current
Planner selection. The automated test verifies the policy, not chronological
proof from timestamps. Adding provenance would be a separate storage-format
change and is outside this B1 package.

## Commands already executed and results

The following commands were completed successfully on the latest application
state before this packaging-only task:

```text
npx tsc --noEmit --pretty false
npm run check:beginner-plan-persistence
npm run check:beginner-direct-v1
npm run check:beginner-direct-schedule
npm run check:guided-recipe
npm run check:beginner-notifications
```

Results:

- TypeScript: passed with no output/errors.
- B1 persistence and async restore: passed using production persistence, calculator, guided-plan, and restore-coordinator functions.
- Beginner Direct V1: passed.
- Beginner Direct schedule: passed.
- Guided recipe: passed for grouping, event order, progress, countdown, and plan identity.
- Beginner notifications: passed for notification completeness and workflow exclusions.
- Editor diagnostics for touched TypeScript/JavaScript files: no errors.
- The preceding package build passed ZIP integrity, required-module, exclusion, and report-consistency checks.
- `yarn check:beginner-phase-sequence`, `phase-a`, `phase-b`, `recipe-gate`,
	`final-fixes`, `water-temp`: passed.
- Teglia Tipo 00, custom, spelt, whole-wheat and gluten-free Phase A checks:
	passed.
- Expanded identity matrix: passed for all requested style, schedule, mixing,
	yeast and flour paths.

## What is tested from production

`verify-beginner-plan-persistence.js` transpiles and executes the actual:

- `src/beginnerPlanPersistence.ts` parser, serializer, active check, and key function;
- `src/calculator.ts` schedule validator;
- `src/guidedRecipe.ts` `createGuidedPlanId`;
- `src/beginnerPlanRestoreCoordinator.ts` storage-key loaders, date resolver, and generation coordinator;
- current `app/(tabs)/index.tsx` coordinator wiring.

The fixtures cover room-only and fridge-room snapshots, a restore 30 minutes
before baking, moved controlled time, saved `calculationNow`, exact schedule
round-trip, guided plan identity and separate progress record, invalid JSON,
structurally invalid data, expiry, new-date/input identity, display-setting
invariance, Pro isolation, and hydration/error gates.

The async restore fixtures use controlled promises and mock storage to verify the
actual storage key path, JSON-stringified `pro`, `dry`, `us`, and `fahrenheit`
values, delayed saved `dry` yeast, dry-plan restoration, no temporary save/alarm
side effects, reverse completion of two loads, Beginner-to-Pro mode change while
reading, unmount cancellation, Pro/error/stale/Planner shared-date behavior, and
React Strict Mode setup-cleanup-setup reuse. Stale responses resolve but return
`null` from the same coordinator used by the app. These are executable
production-function checks, not a duplicated lifecycle model.

## Automated versus UI verification

Automated and completed:

- production persistence and async restore functions;
- TypeScript compilation;
- Beginner Direct, guided recipe, and notification regressions;
- editor diagnostics for touched files;
- final archive integrity and package-content comparison.

Executed in the actual Expo web preview:

- Beginner, Neapolitan, Direct, hand mixing, Tipo 0/00, 4 x 250 g, stone oven,
	300 C, bake time 11.10.2026 19:00.
- First guided step marked: `1/8`.
- Profile -> Calculator: `1/8` retained.
- Full browser reload: `1/8` retained.
- Evidence: `frontend/ui_evidence/18-b1-after-reload-progress-visible.png` plus
	the preceding evidence files.

The welcome intro was closed persistently before the final local reload check;
the resulting screenshot clearly shows `1/8` after reload. The public EAS
preview was then opened separately and confirmed to load the current Beginner
intro.

The code checks and UI checks are reported separately: code checks exercise
production modules and source wiring; the UI check mounts the real app and uses
the browser's actual AsyncStorage lifecycle.

## B2 verification: fridge-out timestamp

For one identical schedule, the production formulas and values are:

```text
bakeAt = 19:00
Phase A/B/C = 20/90/5 minutes
roomBeforeFridgeHours = (20 + 90 + 5) / 60 = 115/60 h
fridgeHours = 8 h
startAt = 07:05
ballingAt = startAt + (Phase A + Phase B) = 08:55
fridgeAt = ballingAt + Phase C = 09:00
```

Beginner and detailed instructions compute `fridgeOutAt` as
`startAt + (roomBeforeFridgeHours + fridgeHours)`, producing `17:00`.
The old Planner formula was `ballingAt + fridgeHours`, producing `16:55`.
The corrected Planner formula is `(fridgeAt ?? ballingAt) + fridgeHours`,
producing `17:00`. The fallback preserves schedules without `fridgeAt`.

The targeted `check:home-pizza-plan` regression verifies all three values,
the five-minute `fridgeAt - ballingAt` Phase C boundary, and the corrected
Planner milestone. `ballingAt` itself was not changed.

## B2 production and public UI coverage

The regression creates the Beginner schedule through
`createDirectHomePizzaPlan`, then feeds that production schedule to
`reversePlan`. It covers the generated `fridgeRoom` plan, the normal schedule,
and a generated plan crossing local midnight in `Europe/Vienna`. It compares
timestamps, not only formatted clock strings.

The Beginner/detailed-instructions surface is separately verified through the
production `getBeginnerFridgeOutAt` source contract and its callers; it is not
claimed as an executed UI function by the Node test. The Planner surface is
executed through production `reversePlan` and then mounted in the public UI.

Public B2 UI verification completed at the deployment above:

- Beginner schedule: fridge entry `17:00`, fridge removal `17:00`.
- Detailed instructions: cold phase ends and final room phase begins at `17:00`.
- Planner: `16:55` is the balling/portioning milestone; “Izvadi loptice iz
	hladnjaka” is `17:00`.
- After first-step completion, Profile -> Calculator, and full browser reload:
	progress remained `1/8` and the `17:00` terms remained unchanged.
- Evidence: `frontend/ui_evidence/19-b2-public-planner-fridgeout.png` and
	`frontend/ui_evidence/20-b2-public-beginner-after-reload.png`.

No B3 work was started.

## B2 representative local UI coverage update

See `B2_VERIFICATION_REPORT.md` for the executed/not-executed case matrix,
per-surface comparison, progress values after actual reloads, and local-only
room-only boundary. During the New York/gluten-free case, a stale Roman format
in saved calculator settings changed the guided plan identity after a reload.
`createBeginnerPlanInputKeyFromState` was corrected to omit Roman format for
non-Romana styles, and the persistence test now asserts that invariant. The
targeted persistence check and TypeScript check pass after the fix.

This did not change room-only schedule generation. At the time of the local UI
pass, no new public preview was created and the three cases remained local.
B3 was not started.

## Naknadna objava B2 identity popravka

The final identity-fix code was later deployed to
`https://pizzabook--fi76aijhtf.expo.app` (EAS deployment `fi76aijhtf`,
alias `b2-identityfix-20261011`). The public landing page loaded and the served
JavaScript bundle SHA-256 matched the fresh local export:
`07ce27d3c1f021ff439672695d332941db4cc5b10b61951e27d2f47f0603e5b0`.
This is deployment/build identity verification only; the representative B2
cases were not re-run on the public preview. Room-only reload/public UI,
mixed-flour, language/units, Neapolitan cross-surface, and remaining
combinations stay open. B3 was not started.

## Final B2 public checks and fix

The later B2 follow-up tested a supported room-only plan on
`https://pizzabook--fi76aijhtf.expo.app`: mix 13:05, folds 13:45/14:15,
shape 14:55, room fermentation end and preheat 16:00, bake 17:00, with no
fridge events. Beginner, detailed instructions and Planner were compared.
After marking one step, visiting Profile, returning to Calculator and fully
reloading, all schedule terms and progress `1/7` remained.

A Romana Tonda custom-blend cold plan (70% Tipo 0/00 + 30% whole wheat) exposed
that Beginner and Planner combined shaping and fridge entry at 16:55, while
detailed instructions correctly placed the dough in the refrigerator at
17:00. The fix separates shaping at `ballingAt` from fridge entry at
`fridgeAt`, with a focused regression. Corrected public deployment
`https://pizzabook--m3gh4gw90j.expo.app` (`m3gh4gw90j`) showed matching 16:55
and 17:00 events across surfaces and retained `1/9` after Profile navigation
and a real reload.

On `fi76aijhtf`, switching the saved custom plan HR → DE and metric → US kept
the bake/event times and `1/8` progress across a real reload. Flour, water,
oil, dough, sauce and cheese quantities converted to oz/lb; precision-sensitive
salt and yeast remain in grams by design. Changing blend component B from
whole wheat to spelt changed the plan input and reset progress to `0/8`, which
remained after reload. Other blend ratios, language/unit combinations,
Neapolitan cross-surface checks and remaining style/mixing/yeast/flour cases
remain open. B3 was not started.
