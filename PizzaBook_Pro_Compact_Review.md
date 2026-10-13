# PizzaBook Pro compact calculator review

## Changes

- Reorganized the Pro calculator into a compact, responsive layout with a mobile quick result/save card and side-by-side input/result columns on wide screens.
- Kept detailed guided steps and illustrations in Beginner mode only; moved baking and mixing/ice options into collapsible sections.
- Added a compact horizontal fresh/dry yeast selector and retained Biga/Poolish result breakdowns for preferment, final dough, and totals.
- Removed fixed preferment-time advice from Pro results so it cannot contradict the selected schedule. Beginner behavior is unchanged.
- Fixed the `{N} g` placeholder rendering and added regression assertions for the Pro selector and schedule advice.

## Validation

- `yarn tsc --noEmit`
- `yarn check:pro-options`
- `yarn check:home-pizza-plan`
- `node scripts/verify-neapolitan-workflow.js`
- `yarn check:roman-workflow`
- `yarn check:beginner-notifications`
- `yarn check:beginner-plan-persistence`
- `yarn check:guided-recipe`
- `yarn check:beginner-direct-schedule`
- `yarn check:beginner-water-temp`
- `yarn check:dough-calc`
- `git diff --check`
- Deployed web preview checked at mobile (390 × 844) and wide (1440 × 1000) sizes. Live checks covered Napolitana, New York, Romana Tonda/Teglia, Direct/Biga/Poolish, the flour selector and gluten-free Direct-only limit, fresh/dry yeast, manual/mixer, and the Biga/Poolish result tables.

No APK was built.

## Preview

https://pizzabook--4rliun25vp.expo.app
