# SETTINGS-1 review

## Changes

- Replaced four separate settings cards with one grouped, divided card and a
  responsive layout centered at a maximum width of 680 px.
- Kept the existing preference handlers and storage keys for language,
  experience level, measurement system, temperature unit, and preferred yeast.
  Selecting a measurement system continues to update the separate temperature
  preference as before.
- Added native language names, accessible radio roles and checked states,
  48-pixel controls, localized yeast guidance and version text, and the actual
  unit symbols supported by each system.
- Displays the version from `Constants.expoConfig.version`. The existing
  in-app privacy route is linked; no contact address or external URL was
  invented.

## Browser checks

Using the local web app, checked the settings layout at 360 × 800, 390 × 844,
and 1280 × 900. Mobile and desktop views have no horizontal scrolling or clipped
labels. German labels were checked at 360 px and on desktop; language choices
show each language's own name.

Switched language, mode, units, and yeast type, then reloaded the app. The
selected German, Beginner, US customary, and dry-yeast choices remained
selected. Switched back to Pro and confirmed its selected state after another
reload. English and Slovenian translations were also exercised in the UI.
The privacy link opened the existing privacy screen.

Screenshots in `ui_evidence/`:

- `settings-360-hr.png`
- `settings-390-hr.png`
- `settings-360-de.png`
- `settings-360-de-reloaded.png`
- `settings-desktop-de.png`
- `settings-privacy-route.png`

## Validation

Passed:

- `npx tsc --noEmit`
- `npm run check:beginner-plan-persistence`
- `npm run check:pro-options`
- `npm run check:home-pizza-plan`
- `git diff --check` from `frontend/`

No CSS- or source-text-only test was added.

## Diff scope

`settings1-scoped.diff` is a valid diff against repository `HEAD` for
`app/settings.tsx` and `src/i18n/translations.ts`. The translations file was
already dirty before this task, so its diff includes earlier accumulated
translation changes as well as the SETTINGS-1 strings. Those earlier changes
are not attributed to this task; unrelated files are excluded.

No deployment or APK was produced.
