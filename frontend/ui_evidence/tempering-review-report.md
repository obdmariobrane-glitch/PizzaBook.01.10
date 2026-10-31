# Tempering and Planner alignment review

## Findings

### Tempering duration

In a fresh session with no running timer, Pro / Romana Tonda showed a **38-minute initial timer** at 22°C. This was not 38 minutes remaining on an active timer: the initial value comes from the temperature-dependent `getTemperingWindow` result in `src/calculator.ts`.

The detailed recipe instruction had incorrectly reused `roomHours` (2 hours), which is the preceding room-temperature fermentation, not tempering after the cold phase. Planner descriptions also contained an outdated fixed duration. The earlier correction aligned the timer, detailed instruction, and Planner tempering event with `getTemperingWindow`.

### Calculator-to-Planner settings

Two Planner gaps were reproduced before the current change:

1. Planner loaded `calculatorSettings` once on mount. Since tab navigation kept the screen mounted, changes to room temperature in the calculator did not refresh Planner's local settings on return.
2. Planner generated Pro timelines from generic defaults (one room hour and a fixed 24 cold hours), not from the user's selected schedule. The test had not connected the production-selected 2-hour room + 24-hour cold schedule to Planner.

In a fresh UI session, Planner was first opened at 22°C. After changing the calculator to 18°C, the recipe instruction and initial timer changed to **1 h 8 min**, while Planner remained at its old **38 min**. The stale behavior is preserved in `planner-stale-roomtemp-18-before-fix.png`.

## Change

- Refresh saved calculator settings whenever the Planner tab regains focus.
- Build Planner's schedule with production `getFermentationSchedule`, using the saved method, room/fridge temperatures and durations, and Biga/Poolish duration where applicable.
- Pass the selected schedule into `reversePlan`; derive Planner stage offsets and localized duration descriptions from those actual phases. Keep Beginner's existing schedule path unchanged.
- Regression coverage uses production functions and the selected 2-hour room + 24-hour cold schedule, verifies a changed 3-hour + 18-hour schedule and a room-only schedule, and checks that tempering is not added twice.
- Preserve PRO-2F Roman Tonda/Teglia selector behavior and existing Pro card layout.

## Verification

Passed from `frontend/`:

- `yarn tsc --noEmit`
- `node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-tempering-alignment.mjs`
- `yarn check:roman-workflow`
- `yarn check:pro-options`
- `yarn check:home-pizza-plan`
- `yarn check:beginner-plan-persistence`
- `yarn check:beginner-phase-sequence`
- `yarn check:beginner-direct-schedule`
- `node scripts/verify-neapolitan-workflow.js`
- `node scripts/verify-new-york-workflow.js`
- `git diff --check`

The targeted alignment regression checks Napolitana, Romana and New York; Direct, Biga and Poolish; room temperatures 18°C, 22°C and 26°C; and HR/EN/DE/SL translations. It compares generated Planner event offsets and localized durations against the schedule returned by `getFermentationSchedule`. It confirms the selected 2-hour room and 24-hour fridge stages remain exactly those durations, then checks 3-hour + 18-hour and room-only (no cold event) paths.

The Planner schedule API has no flour or yeast inputs: flour category/blend and fresh/dry yeast share this timing path and do not select separate Planner branches. Existing Beginner checks and shared style/method coverage were run; this was targeted representative coverage, not an exhaustive combination matrix.

## Public preview UI evidence

Preview: [https://pizzabook--9k625zl80s.expo.app](https://pizzabook--9k625zl80s.expo.app)  
Deployment ID: `9k625zl80s`

Public UI checks:

- Calculator and Planner were checked successively at 18°C (**1 h 8 min**), 22°C (**38 min**) and 26°C (**23 min**). The displayed timer, recipe instruction and Planner tempering event matched at each temperature.
- At 22°C, Planner retained the selected **2 h room + 24 h fridge** schedule. After changing calculator settings to **3 h room + 18 h fridge**, Planner showed those durations and placed the room/cold/tempering events at the matching offsets.
- After a full reload, the selected style, temperature, room/fridge durations and recipe timer remained persisted; Planner regenerated from the stored 3 h + 18 h values.
- Planner UI was exercised for Romana, Napolitana and New York, with Direct/Biga/Poolish. Biga and Poolish descriptions and event timings reflected the saved preferment duration plus the selected final room/fridge phases.
- Calculator UI confirmed Romana Tonda and Teglia selection closes the style card, reopening permits changing format, and transitions to Napolitana/New York continue to show the temperature-matched timer and instruction.
- Hand and mixer recipe paths were checked. Selecting mixer changed the mixing instructions without changing the 23-minute tempering duration.
- The 23-minute timer was started, instructions hidden, and reopened. The countdown advanced from `23:25` to `22:42` while hidden and continued at `22:37` after reopening; it did not restart.
- Initial welcome screen was completed after the hard reload.

Screenshots:

- Temperature changes: [18°C calculator](./calculator-temp-18-initial.png), [18°C Planner](./planner-temp-18-2h-24h.png), [22°C calculator](./calculator-temp-22-initial.png), [22°C Planner](./planner-temp-22-2h-24h.png), [26°C calculator](./calculator-temp-26-initial.png), [26°C Planner](./planner-temp-26-2h-24h.png)
- Changed schedule: [3 h + 18 h Planner](./planner-changed-schedule-26-3h-18h.png)
- Method/style coverage: [Biga](./planner-biga-26-3h-18h.png), [Poolish](./planner-poolish-26-3h-18h.png), [Napolitana Planner](./planner-neapolitan-26-3h-18h.png), [New York Planner](./planner-new-york-26-3h-18h.png)
- Calculator style transitions: [Romana Teglia](./calculator-romana-teglia-26c-23m.png), [Napolitana](./calculator-neapolitan-26c-23m.png), [New York](./calculator-new-york-26c-23m.png)
- Active timer persistence: [timer after hiding and reopening instructions](./calculator-active-timer-retained-after-toggle.png)
- Original issue reproduction: [stale Planner temperature before fix](./planner-stale-roomtemp-18-before-fix.png)

Tempering continues to use room temperature only; it does not account for fridge temperature or dough mass. No APK was generated.

## Diff and workspace scope

The scoped patch is based on repository HEAD `98c348517f54e5d12ee7dd2fd6c15ab1af8ba948`. The PRO-2F state and related prior work existed in a pre-existing dirty worktree. The packaged diff includes the complete current changes against that HEAD for the directly relevant calculator, Planner, translations, and alignment-regression files, including earlier changes in those same files. It excludes unrelated worktree paths and is not an isolated commit-ready patch for only the latest Planner synchronization change.
