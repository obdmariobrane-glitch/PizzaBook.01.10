# Beginner extraction coverage

## Source files inspected

- [translations.ts](/app/frontend/src/i18n/translations.ts)
- [styleSteps.ts](/app/frontend/src/i18n/styleSteps.ts)
- [prefermentSteps.ts](/app/frontend/src/i18n/prefermentSteps.ts)
- [calculator.ts](/app/frontend/src/calculator.ts)
- [guidedRecipe.ts](/app/frontend/src/guidedRecipe.ts)
- [notifications.ts](/app/frontend/src/notifications.ts)
- [index.tsx](/app/frontend/app/(tabs)/index.tsx)
- [planner.tsx](/app/frontend/app/(tabs)/planner.tsx)
- [onboarding.tsx](/app/frontend/app/onboarding.tsx)
- [settings.tsx](/app/frontend/app/settings.tsx)
- [profile.tsx](/app/frontend/app/(tabs)/profile.tsx)
- [login.tsx](/app/frontend/app/login.tsx)
- [_layout.tsx](/app/frontend/app/_layout.tsx)
- [feed.tsx](/app/frontend/app/(tabs)/feed.tsx)
- [[id].tsx](/app/frontend/app/post/[id].tsx)
- [new-post.tsx](/app/frontend/app/new-post.tsx)
- [app.json](/app/frontend/app.json)
- [eas.json](/app/frontend/eas.json)

## Languages

- Croatian (HR)
- German (DE)
- English (EN)
- Slovenian (SL)

## Styles

- Napoletana / `neapolitan`
- Romana Tonda / `romana` + `romanFormat = tonda`
- Romana Teglia / `romana` + `romanFormat = teglia`
- New York Style / `ny_style`

These style branches are represented in calculator/profile data and in the style-step functions.

## Flour and flour behavior branches

- `caputo00` — Tipo 0 / 00
- `manitoba` — Manitoba / Visoki W
- `spelt` — Pirovo brašno
- `wholeWheat` — Integralno brašno
- `glutenFree` — Bezglutensko brašno
- `custom` — Mješavina brašna
- Custom flour blends and flour-strength inputs
- Exact declarations: `FlourType`, `FLOUR_PROFILES`, and `BASE_FLOURS` in [calculator.ts](/app/frontend/src/calculator.ts)

## Mixing and method branches

- Beginner direct method
- Hand mixing
- Mixer mixing
- Pro direct method
- Pro Biga
- Pro Poolish
- Preferment hand and mixer paths

## Fermentation branches

- Room-temperature-only fermentation
- Cold plus room-temperature fermentation
- Biga room/fridge stages
- Poolish room/fridge stages
- Style-specific tray and round workflows
- All duration templates whose values are supplied by calculator state

## Ovens

- Home oven / home pan
- Home stone
- Pizza oven / Ooni

## Recipe phases

- Phase A: mixing or preferment creation
- Phase B: first fermentation, folding, or final mix depending on method
- Phase C: portioning, balling, or tray mass
- Phase D: shaping/proofing
- Phase E: baking and completion

## Screens and surfaces

- Onboarding
- Beginner calculator
- Pro calculator paths that share the same recipe modules
- Guided recipe panel and progress
- Mixing galleries and help popups
- Planner and local alarm scheduling
- Saved recipes
- Settings/preferences
- Login/authentication
- Profile/account deletion
- Community feed
- Post detail, comments, likes, ratings, reports
- New post and media upload
- App update prompt

## Extraction counts

- Static translation entries: 580
- Dynamic translation functions: 4
- Missing static translation values: 0
- Literal inventory modules: 15

## Conditions

The exact branch predicates remain in the verbatim source appendix. Important predicates include experience level, pizza style, Roman format, flour type, mixing method, preferment method, room-hours, fridge-hours, oven type, and platform.
