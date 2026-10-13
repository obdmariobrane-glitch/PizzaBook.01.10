# PRO-2C Review

## Changes

- Pro now uses the Beginner three-card pizza-style picker, including the same images, spacing, info controls, typography, and selected-state treatment.
- Pro now uses the Beginner flour card grid and collapsed selected-flour summary.
- Preserved Pro's Roman Tonda/Teglia selectors, all six flour categories, blend ingredients and percentage controls, and W/protein/unknown strength controls.
- Moved the existing Pro Tonda/Teglia picker to directly below the style cards and before flour; selecting Romana keeps the Pro style cards open so the format choice appears beneath them.
- Kept the original Pro selection handlers and info actions; removed the duplicate controls from the pizza-size section.
- Beginner's rendered picker behavior and selection flow remain unchanged. No formulas, compatibility rules, or other calculator sections were changed.

## Verification

- `yarn check:pro-options` passed.
- `yarn tsc --noEmit` passed.
- `git diff --check` passed.
- Compared Beginner and Pro in the web app at 390×844 and 1440×1000.
- Interactively selected Napolitana, Romana Tonda, Romana Teglia, New York, and all six Pro flour categories.
- Verified blend ingredient and percentage controls, W and protein input, `Ne znam`, and retention of selected flour, blend settings, and strength values after closing and reopening the flour card.
- Confirmed gluten-free selection retains its Direct-only compatibility behavior.
- Checked Pro Romana Tonda and Teglia on mobile and wide layouts; each format still selects its existing dough-size and oven behavior.
- No Android APK or EAS Android build was started.

## Comparison captures

All captures are from the local web app. Mobile is 390×844; wide is 1440×1000.

| View | Beginner | Pro |
|---|---|---|
| Pizza styles, mobile | `frontend/ui_evidence/pro-2c-beginner-mobile-style.png` | `frontend/ui_evidence/pro-2c-pro-mobile-style.png` |
| Flour picker, mobile | `frontend/ui_evidence/pro-2c-beginner-mobile-flour.png` | `frontend/ui_evidence/pro-2c-pro-mobile-flour.png` |
| Pizza styles, wide | `frontend/ui_evidence/pro-2c-beginner-wide-style.png` | `frontend/ui_evidence/pro-2c-pro-wide-style.png` |
| Flour picker, wide | `frontend/ui_evidence/pro-2c-beginner-wide-flour.png` | `frontend/ui_evidence/pro-2c-pro-wide-flour.png` |
| Blend controls, mobile | — | `frontend/ui_evidence/pro-2c-pro-mobile-blend.png` |
| Blend controls, wide | — | `frontend/ui_evidence/pro-2c-pro-wide-blend-edited.png` |

### Pro Roman selector placement

Mobile: [Romana Tonda](frontend/ui_evidence/pro-2c-roman-mobile-tonda.png) · [Romana Teglia](frontend/ui_evidence/pro-2c-roman-mobile-teglia.png)

Wide: [Romana Tonda](frontend/ui_evidence/pro-2c-roman-wide-tonda.png) · [Romana Teglia](frontend/ui_evidence/pro-2c-roman-wide-teglia.png)

## Preview

Public web preview: https://pizzabook--6sdvt6ku7e.expo.app

The exported bundle was deployed successfully. Its SHA-256 matches the local
export: `38159b1a6a62e0468f7c2f327371e793125d54aa03999e6e4d869db3b1421471`.
The preview returned HTTP 200. No Android APK or EAS Android build was started.
