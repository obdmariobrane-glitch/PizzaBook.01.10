# PizzaBook PRO-2D review

Preview: https://pizzabook--u02cj3xcu6.expo.app

## Changes

- Made the Pro pizza-size card independently collapsible. Its closed summary shows quantity and calculated ball weight; Romana Teglia also shows tray dimensions.
- Kept Pro quantity, weight, diameter, and tray controls and handlers intact; opening and closing the card does not reset values.
- Added the selected method and hydration to the closed Pro method-card summary. The existing Pro Direct/Biga/Poolish controls and fermentation settings remain inside the collapsible card.
- Fixed ball-weight hint substitution to replace the complete `{N} g` placeholder with the formatted weight, including the selected unit system.
- Corrected Pro section numbering to match screen order: style 1, flour 2, size 3, method 4, baking 5, mixing 6. Beginner section titles and its closed method summary are unchanged.

## Verification

- `yarn check:pro-options` — passed.
- `yarn check:dough-calc` — passed.
- `yarn check:roman-workflow` — passed.
- `yarn tsc --noEmit` — passed.
- `git diff --check` — passed.
- Browser-checked the published preview at 390×844 and 1440×1000. No horizontal overflow; size and method cards were checked closed/open, and quantity and Biga values remained after toggling.
- Checked Romana Teglia summary: tray count, dough mass, and dimensions are displayed.
- `yarn lint --no-cache` was also attempted; it reports existing hook/state-in-effect errors elsewhere in the large calculator and other files, outside the edited UI blocks.
- No Android/APK build was run.

## Screenshots

- Mobile cards collapsed: `frontend/ui_evidence/pro2d/mobile-collapsed.png`
- Mobile size card open: `frontend/ui_evidence/pro2d/mobile-size-open.png`
- Mobile method card open: `frontend/ui_evidence/pro2d/mobile-method-open.png`
- Mobile Romana Teglia summary: `frontend/ui_evidence/pro2d/mobile-teglia-collapsed.png`
- Wide cards collapsed: `frontend/ui_evidence/pro2d/wide-collapsed.png`
- Wide cards open: `frontend/ui_evidence/pro2d/wide-expanded.png`

## Modified source files

- `frontend/app/(tabs)/index.tsx`
- `frontend/scripts/verify-pro-options.js`
