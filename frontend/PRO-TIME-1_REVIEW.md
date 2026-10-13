# PRO-TIME-1 review

## Result

Pro's final room rest is now represented once as a `final-rest` phase and that
same fermentation schedule feeds the Pro yeast calculation and Planner. A valid
Pro Direct Home plan uses its own `roomAfterFridgeHours`; no formula-derived
rest is layered on top of it. Existing `getTemperingWindow` values are
unchanged. When there is no cold phase, no automatic post-fridge rest is added,
and scheduled room phases remain intact.

The scope is limited to the Pro schedule/calculation/UI/Planner path and focused
regressions. Beginner schedules, yeast coefficients and conversions,
Biga/Poolish yeast allocation, timer `endsAt` state, and Teglia shaping/baking
steps are preserved. Missing localized Biga/Poolish Home builders remain a
separate issue and were not added here.

## Example

For Direct, 4 × 260 g, 22°C, 2 h room + 24 h fridge, adding the previously
omitted 38-minute final rest changes the production calculation from
`eTotal 5.2` and `0.60 g` fresh yeast to `eTotal 5.9` and `0.52 g`. The
existing yeast coefficients and fresh/dry conversion are unchanged.

## UI verification (local web app)

- Existing PRO-2F Roman selection remains intact: Tonda/Teglia selection closes
  the style card, shows the selected summary, and permits reopening/change.
- Direct / Romana Tonda with 2 h room + 24 h fridge at 22°C shows a 38-minute
  initial “Prije pečenja” timer and a matching 38-minute detailed instruction.
- Starting the timer, hiding recipe steps for several seconds, and reopening
  them retained the active countdown (it continued from 37:59 to 37:43); the
  active timer's stored end time was not changed by this implementation.
- Setting fridge duration to 0 removed the cold and automatic final-rest
  instruction/timer events while leaving existing room fermentation steps. The
  screenshot still shows the persistent chip for the already-running timer
  started on the previous cold schedule; no new room-only final-rest timer was
  created, and the active countdown was intentionally preserved.
- Planner generated a timeline for the selected bake date; the production
  regression below verifies the schedule's actual phase times against the
  same selected fermentation schedule, for cold and room-only paths.

Evidence is included in `ui_evidence/`:

- `pro-time-timer-resume.png`
- `pro-time-room-only.png`
- `pro-time-planner-room-only.png`
- `pro-time-planner-generated.png`
- `pro-time-planner-cold.png`
- `pro-time-final-rest-phase.png`
- `pro-time-mode-select.png`
- `pro-time-romana-teglia-selected.png`
- `pro-time-pro-fermentation-controls.png`

## Regression coverage and checks

`scripts/verify-tempering-alignment.mjs` exercises production exports rather
than testing text presence alone. It checks scheduled `final-rest` phase counts
and durations, `doughCalc` exposure/yeast output, `reversePlan` event timing,
actual production-generated Direct Home cold and room-only plans, and
representative style/method/language, mixing, yeast, and flour paths. It also
checks that the room-only schedule has no zero-hour or cold phases. The direct,
room-only, and combined schedules are kept distinct.
The mode-ownership regression creates real Direct, Biga, and Poolish Home plans,
then verifies that Pro rejects prior Beginner schedules, accepts a current
valid Pro Direct schedule, and that Beginner still retains its schedules.

Passed:

- `npx tsc --noEmit`
- `node scripts/verify-tempering-alignment.mjs`
- `npm run check:dough-calc`
- `npm run check:home-pizza-plan`
- `npm run check:beginner-direct-schedule`
- `npm run check:beginner-plan-persistence`
- `npm run check:beginner-phase-sequence`
- `npm run check:beginner-recipe-gate`
- `npm run check:beginner-final-fixes`
- `npm run check:roman-workflow`
- `npm run check:pro-options`
- `git diff --check` (from `frontend/`)

## Diff baseline and scope note

`pro-time1-scoped.diff` compares the included tracked files to repository
`HEAD`, and includes the new production-function regression as an added-file
diff. The worktree was already dirty before PRO-TIME-1. In particular,
`index.tsx`, `planner.tsx`, `calculator.ts`, and
`verify-home-pizza-plan.js` contain earlier accumulated PRO/Planner and
Beginner changes in addition to this task. Those earlier hunks are retained and
are not attributed solely to PRO-TIME-1. Unrelated dirty files are excluded
from this package.

No public deployment or APK was created, as requested.
