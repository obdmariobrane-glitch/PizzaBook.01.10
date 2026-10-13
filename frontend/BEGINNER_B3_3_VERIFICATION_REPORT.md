# Beginner B3.3 Verification Report

**Scope:** B-014, B-017, B-009, B-011, B-012 and B-015 only.  
**Disposition:** Six B3.3 corrections and the room-only milestone wording are locally verified and present in the running development preview. No commit, production deployment or Beginner lock was performed.

## Preview/build identity

The local repository was on branch `before-beginner-ui-redesign` at `98c348517f54e5d12ee7dd2fd6c15ab1af8ba948`. These corrections are local and uncommitted.

The preview at `https://dough-timer-1.preview.emergentagent.com/` serves the active Expo/Metro development bundle from the running `expo start --port 3000` process. After the final source edit, local and preview bundle responses reported the same Metro delta ID, `fa7f7e9ba8a0b8e7`, and `Last-Modified: 2026-10-12 23:00:07 GMT`; the preview bundle contained the updated HR B-017 copy and final-preparation wording. No Git SHA is exposed by the preview. This verifies the development preview is serving the current working tree; no restart or deployment was needed.

## Findings and local verification

| Defect | Root cause | Source file/function | Exact correction | Regression result | Available on preview? |
|---|---|---|---|---|---|
| B-014 | Beginner Teglia numbered instructions and help metadata placed preheating before the final proof. | `frontend/app/(tabs)/index.tsx` — `buildBeginnerTegliaHomeSteps` and associated Teglia help metadata | Move preheating after the final-proof instructions and keep its help metadata in matching chronological order. | Passed the focused B3.3 Teglia ordering check and `verify-teglia-workflow.mjs`. | **Yes** — current Metro delta ID. |
| B-017 | The EN/DE/SL localized path omitted the initial water/flour mix; the separate HR Beginner path still dissolved yeast before flour and did not receive the selected yeast type. | `frontend/app/(tabs)/index.tsx` — `getBeginnerNewYorkInstantMixerInstructions`, `getDetailedDirectSteps`, and `getDetailedDirectStepsLocalized` | Pass the selected yeast type into the HR Beginner path and use a localized initial flour/first-water mix, then add the existing calculated instant-yeast quantity; retain the remaining-water step. Scoped to Beginner NY mixer, excluding gluten-free dough. | Passed focused B3.3 assertions in HR/EN/DE/SL; the served preview bundle includes the new HR copy. NY workflow regression passed. | **Yes** — current Metro delta ID. |
| B-009 | Shared help titles did not identify the gluten-free or New York context, although the help body already had conditional content. | `frontend/app/(tabs)/index.tsx` — Beginner contextual help title/body selection | Use flour/style-appropriate titles while retaining the conditional help body; regression checks cover both title and body. | Passed focused help-content checks in HR/EN/DE/SL. | **Yes** — current Metro delta ID. |
| B-011 | Planner quick-date labels used English independently of the selected app language; one Croatian instruction contained Slovenian `ter`. | `frontend/app/(tabs)/planner.tsx` — `fmt`; `frontend/app/(tabs)/index.tsx` — localized direct-step text | Pass the selected language into quick-date formatting and correct Croatian `ter` to `i`. | Passed focused localization checks in HR/EN/DE/SL. | **Yes** — current Metro delta ID. |
| B-012 | Beginner NY mixer copy said 5 minutes while the rounded duration badge/timer represented 6 minutes. | `frontend/app/(tabs)/index.tsx` — localized NY mixer instruction/timer path | Set the Beginner NY mixer rest instruction to 6 minutes and keep its timer derived from the same 360-second duration. Other styles and gluten-free behavior remain unchanged. | Passed focused B3.3 rest-copy/timer checks and NY workflow regression. | **Yes** — current Metro delta ID. |
| B-015 | Cold-duration descriptions interpolated raw fractional hours instead of a formatted duration; translation templates also supplied their own trailing hour units. | `frontend/src/calculator.ts` — `formatHoursLabel` use in cold descriptions; `frontend/src/i18n/translations.ts` — `coldDesc` templates | Format the duration before interpolation and remove duplicate template units. Verified values include `24 h` and `15 h 11 min`. | Passed focused checks in HR/EN/DE/SL and central duration-format regression. | **Yes** — current Metro delta ID. |

## Room-only fermentation-end milestone

For the reported schedule, the existing calculation still places the milestone at the earlier of oven preheat or shaping start. With preheat at `03:53`, shaping scheduled at `04:38`, and baking at `04:53`, the event remains at `03:53`; the `65`-minute room-rest interval from balling at `02:48` to that event is unchanged. Mixing at `00:58` and all other schedule calculations are untouched.

The inaccurate “end of room-temperature fermentation” label is now “Start of final preparation” in the Planner and numbered phase instructions. Phase help and HR/EN/DE/SL notification copy clarify that the covered dough remains at room temperature until shaping; the combined preheat notification still instructs users to preheat at the scheduled time. Phase C/D sequencing and nighttime-warning behavior remain intact.

The calculation in `getBeginnerRoomOnlyEnd` is unchanged. The wording is produced by `getBeginnerFinalPrepStartLabel` and `buildBeginnerRoomOnlyPhaseCEnd` in `frontend/app/(tabs)/index.tsx`; the Planner uses `timelineFinalPrepStart`, and notifications use the localized `roomFermentationEnd` and `roomFermentationEndPreheat` copy in `frontend/src/i18n/translations.ts`.

## Regression commands

The following checks passed:

- `npm run check:beginner-phase-a`
- `npm run check:beginner-phase-b`
- `npm run check:beginner-phase-sequence`
- `npm run check:beginner-b3-3`
- `npm run check:beginner-night-schedule`
- `npm run check:beginner-notifications`
- `npm run check:guided-recipe`
- `node ./scripts/verify-planner-phase-overrides.mjs`
- `npm run check:home-pizza-plan`
- `node ./scripts/verify-teglia-workflow.mjs`
- `node ./scripts/verify-duration-format.js`
- `node ./scripts/verify-new-york-workflow.js`
- `npm run check:beginner-final-fixes`
- `node ./scripts/verify-tempering-alignment.mjs`
- `npm run check:pro-options`
- `npm run check:roman-workflow`
- `./node_modules/.bin/tsc --noEmit`

Phase-sequence coverage passed for HR/EN/DE/SL, styles, flour paths, and room/cold schedule variants. The B3.3 checks passed for all four languages, including the HR instant-mixer path. PRO option/saved-recipe and Romana workflow checks passed. No full combination audit or production release was performed. The preview now serves the corrected development bundle and is ready for ChatGPT Work's live retest; that is not itself a declaration of live PASS for all six UI cases.
