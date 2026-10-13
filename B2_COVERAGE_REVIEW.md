# PizzaBook B2 Coverage Review

## Outcome

Three representative Beginner combinations were exercised in the local Expo
web UI across the Beginner plan, detailed recipe instructions, Planner, and a
real browser reload. All three preserved the completed first guided step after
reload and retained the bake time of 12 October 2026 at 19:00.

The coverage run found one progress-identity defect affecting New York Style:
the saved Roman format could remain in settings after switching styles and was
included in the New York plan key. That made an unchanged plan appear to have a
new identity on reload. `createBeginnerPlanInputKeyFromState` now includes the
Roman format only for Romana plans. The production persistence test and the
real New York/gluten-free/mixer UI reload both pass with the corrected key.

The final open checks below were run on public preview `fi76aijhtf`. The
custom-blend comparison exposed a 5-minute cold-entry mismatch between the
combined Beginner/Planner event at 16:55 and detailed instructions at 17:00.
After the minimal event-splitting fix, the same case was verified on a fresh
public deployment. The latest corrected build is at
`https://pizzabook--m3gh4gw90j.expo.app` (deployment `m3gh4gw90j`, alias
`b2-fridgein-fix-20261011`); its served bundle matches the export byte-for-byte.

## Executed case matrix

| Case | Style | Mixing | Yeast | Flour | Beginner / detailed / Planner comparison | Reload and progress | Result |
|---|---|---|---|---|---|---|---|
| B2-UI-1 | Romana Tonda | Mixer | Dry | Manitoba | Compared all three surfaces. Beginner and details showed mixer-specific instructions and dry yeast. Shared schedule: mix 15:05, folds 15:45/16:15, balling 16:55, fridge out 17:00, preheat 18:00, bake 19:00. Planner's balling event at 16:55 is distinct from fridge-out at 17:00. | Real reload; `1/8` retained. | PASS |
| B2-UI-2 | Romana Teglia | Hand | Fresh | Whole wheat | Compared all three surfaces. Beginner and details kept dough as one tray mass, used gentle hand-mixing instructions, and agreed on fridge-out 17:00, preheat 18:40 (20 min at 250°C), bake 19:00. Beginner adds a 18:45 tray/topping milestone; Planner does not create a separate 18:45 event. | Real reload; `1/8` retained. | PASS |
| B2-UI-3 | New York Style | Mixer | Fresh | Gluten-free | Compared all three surfaces. Details specified a psyllium-bound cohesive mass, no gluten-development kneading, and mixer instructions. Shared schedule: mix 15:05, gluten-free portioning 16:55, fridge out 17:00, preheat 18:00, bake 19:00. Planner uses a general balling label for the 16:55 portioning event; the detailed and Beginner recipes preserve gluten-free handling. | First attempt exposed stale Roman-format identity. After the identity fix, real reload retained `1/6`. | PASS after fix |
| B2-UI-4 | Neapolitan / direct / hand / Tipo 0/00, room-only | Hand | Fresh | Tipo 0/00 | Public Beginner, detailed instructions and Planner checked. Mix 13:05, folds 13:45/14:15, shape 14:55, room fermentation end and preheat 16:00, bake 17:00. No fridge-in/out events. Planner includes the 2 h room rest in its 14:55 shaping guidance and preheat at 16:00, without a separately named room-end appointment. | Marked first action; Profile → Calculator → full reload retained `1/7` and all dates/times. | PASS on `fi76aijhtf` |
| B2-UI-5 | Romana Tonda / direct / hand / custom blend, fridge-room | Hand | Fresh | Tipo 0/00 70% + whole wheat 30% | Public Beginner, detailed instructions and Planner checked. Before fix, Beginner/Planner combined shaping and fridge-in at 16:55 while detailed instructions placed dough in fridge at 17:00. On corrected build, shaping is 16:55 and fridge-in 17:00 across Beginner and Planner, matching detailed instructions. | Original saved plan retained `1/8` after DE/US and a real reload; changed B flour from whole wheat to spelt and confirmed `0/8` after reload. Corrected build marked one action and retained `1/9` after Profile return and real reload. | PASS after fix |
| B2-UI-6 | Same custom-blend plan / DE and US units | Hand | Fresh | Tipo 0/00 70% + whole wheat 30% | German labels and US display verified. Flour, water, oil, dough, sauce, cheese and temperature values converted; salt (`14.2 g`) and yeast (`0.34 g`) intentionally remain in grams as precision-sensitive weights. Event times were unchanged. | `1/8` retained through a real reload before the plan-input reset. | PASS on `fi76aijhtf` |

For all executed cases, the 19:00 bake timestamp matched across Beginner,
detailed instructions, and Planner. The detailed recipe provides procedural
steps rather than a separately timed Planner event for every shaping/topping
action, so the intermediate shaping milestones shown by Beginner are not
expected to appear as additional Planner appointments.

## Other known checks and scope limits

| Case / surface | Status | Evidence boundary |
|---|---|---|
| Room-only mode, same bake time | Public UI comparison completed; see B2-UI-4. | Public preview and real reload verified; no fridge events. |
| Neapolitan cold / hand / fresh / Tipo 0/00 | Earlier B1 local UI baseline checked progress restoration separately. | Cold-plan comparison was not repeated across all three surfaces in this B2 pass; room-only is the separate executed B2-UI-4 case. |
| Spelt flour | Not run as a full Beginner/details/Planner/reload UI case in this pass. | Automated identity matrix is not a UI substitute. |
| Custom flour blend | Public UI comparison completed; see B2-UI-5/6. | One 70/30 Tipo 0/00 + whole-wheat blend checked; other blend ratios/flours remain open. |
| All remaining Cartesian combinations | Not run interactively. | The executed cases above are representative, not exhaustive UI coverage. |
| Room-only after reload / public preview | Executed on the public preview; see B2-UI-4. | Verified on deployment `fi76aijhtf`; not repeated on the later cold-entry-only fix deployment. |
| Public B2 fridge-out preview | Previously completed as a separate targeted check and documented in the B1 reports. | Not repeated for this coverage pass. |
| Public preview of the three earlier representative B2 combinations | Not repeated; confirmed Napolitana and New York cold cases were intentionally not replayed. | Their prior local results stand; no new public claim. |
| Language and unit preferences | HR → DE and metric → US checked on the saved custom-blend plan. | One combination verified; other languages/units and styles remain open. |
| Mixed-flour combinations | One custom blend checked across all three surfaces and reloads. | Other flour pairs, ratios, and combinations remain open. |
| Neapolitan cold-plan cross-surface comparison | Not run in this B2 pass. | Open; earlier B1 progress coverage is not a substitute. |
| Remaining style/mixing/yeast/flour combinations | Not run interactively. | Open; three representative combinations are not exhaustive coverage. |

## Code change

- `frontend/src/beginnerPlanPersistence.ts`: exclude the irrelevant stored Roman
  subtype for non-Romana plans when building the plan identity.
- `frontend/scripts/verify-beginner-plan-persistence.js`: assert that switching
  the stale Roman subtype cannot change a New York plan identity.
- `frontend/app/(tabs)/index.tsx`, `frontend/src/calculator.ts`, and
  `frontend/src/i18n/translations.ts`: split shaping (`ballingAt`) from fridge
  entry (`fridgeAt`) when those timestamps differ.
- `frontend/scripts/verify-home-pizza-plan.js`: regression checks that Beginner
  and Planner expose separate events at the production schedule timestamps.
- `frontend/B2-coverage-identity-fix.diff`: exact follow-up patch for the
  production identity rule and its regression assertion.

No fermentation schedule-generation formula was changed. The latest build and
the earlier test deployment are detailed below. B3 was not started.

## Evidence

The local and public UI screenshots are included in the B2 coverage archive:

- `frontend/ui_evidence/b2-case1-romana-tonda-mixer-dry-manitoba-beginner.png`
- `frontend/ui_evidence/b2-case1-romana-tonda-mixer-dry-manitoba-detailed.png`
- `frontend/ui_evidence/b2-case1-romana-tonda-mixer-dry-manitoba-planner-timeline-after-reload.png`
- `frontend/ui_evidence/b2-case1-romana-tonda-mixer-dry-manitoba-after-reload.png`
- `frontend/ui_evidence/b2-case2-romana-teglia-hand-fresh-wholewheat-beginner.png`
- `frontend/ui_evidence/b2-case2-romana-teglia-hand-fresh-wholewheat-detailed.png`
- `frontend/ui_evidence/b2-case2-romana-teglia-hand-fresh-wholewheat-planner-after-reload.png`
- `frontend/ui_evidence/b2-case2-romana-teglia-hand-fresh-wholewheat-after-reload.png`
- `frontend/ui_evidence/b2-case3-newyork-mixer-fresh-glutenfree-beginner.png`
- `frontend/ui_evidence/b2-case3-newyork-mixer-fresh-glutenfree-detailed.png`
- `frontend/ui_evidence/b2-case3-newyork-mixer-fresh-glutenfree-planner-after-reload.png`
- `frontend/ui_evidence/b2-case3-newyork-mixer-fresh-glutenfree-after-reload-verified.png`
- `frontend/ui_evidence/b2-public-preview-identityfix-home.png` (deployed
  landing-page load; not a case-specific test)
- `frontend/ui_evidence/b2-public-room-only-after-mark.png`
- `frontend/ui_evidence/b2-public-room-only-after-reload.png`
- `frontend/ui_evidence/b2-public-custom-blend-cold-after-mark.png`
- `frontend/ui_evidence/b2-public-custom-blend-cold-de-metric.png`
- `frontend/ui_evidence/b2-public-custom-blend-cold-de-us-before-reload.png`
- `frontend/ui_evidence/b2-public-custom-blend-cold-de-us-after-reload.png`
- `frontend/ui_evidence/b2-public-custom-blend-cold-de-us-input-reset.png`
- `frontend/ui_evidence/b2-public-custom-blend-cold-de-us-after-reload.png`
- `frontend/ui_evidence/b2-public-fridgein-fix-beginner-and-details.png`
- `frontend/ui_evidence/b2-public-fridgein-fix-beginner-1of9.png`
- `frontend/ui_evidence/b2-public-fridgein-fix-planner.png`
- `frontend/ui_evidence/b2-public-fridgein-fix-after-reload-1of9.png`
- `frontend/ui_evidence/b2-public-preview-fridgein-fix-home.png`

## Verification

- `npm run check:beginner-plan-persistence`: passed after the identity fix.
- `npx tsc --noEmit --pretty false`: passed after the identity fix.
- Three local UI cases were reloaded in a real browser and their guided progress
  was checked after restoration.
- The room-only case and one custom-blend cold case were exercised in the
  public UI, including progress persistence after full reload.
- `npm run check:home-pizza-plan`: passed with the fridge-entry regression.
- `npx tsc --noEmit --pretty false`: passed after the event split.
- Latest deployment `m3gh4gw90j` served the exact exported bundle; SHA-256:
  `0a2237c9f831da6d57765a89cb0153417bd1c67c29b254982fbe3c0b461fc951`.
- Case-specific verification of the previously confirmed Napolitana and New
  York cold scenarios was intentionally not repeated.
- Neapolitan cold cross-surface verification, other custom-blend ratios,
  language/unit combinations beyond DE/US, and remaining combinations stay
  open. Room-only was confirmed on `fi76aijhtf`; the later fix changes only
  fridge-entry milestones and did not change room-only schedule generation.
- B3 was not started.
