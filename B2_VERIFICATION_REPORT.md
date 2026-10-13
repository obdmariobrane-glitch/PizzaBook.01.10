# PizzaBook B2 Verification Report

## Test environment

- App: Expo web UI, local preview at `http://localhost:3000`
- Browser: isolated `agent-browser` session with browser-backed local storage
- Bake date/time in the three representative cases: 12 October 2026, 19:00
- Welcome message dismissal was persisted before the final reload screenshots.
- These three earlier results are local UI results; no public-preview claim is
  made for those three cases.
- Current identity-fix build was deployed to
  `https://pizzabook--fi76aijhtf.expo.app` (deployment ID `fi76aijhtf`,
  alias `b2-identityfix-20261011`). The preview landing page loaded in
  `agent-browser`. The exact served JavaScript bundle matched the fresh local
  export (`07ce27d3c1f021ff439672695d332941db4cc5b10b61951e27d2f47f0603e5b0`).
  This does not claim that the three cases were replayed on the public preview.

## Case results

### B2-UI-1 — Romana Tonda / mixer / dry yeast / Manitoba

Beginner and the detailed recipe showed mixer-specific mixing, Manitoba
handling, and dry yeast. Planner and Beginner both scheduled mixing at 15:05,
folds at 15:45 and 16:15, balling at 16:55, fridge-out at 17:00, preheat at
18:00, and baking at 19:00. The two 16:55/17:00 events are separate balling and
fridge-out milestones. The detailed recipe's time-specific fridge and preheat
steps agreed. After completing the first guided action and performing a real
reload, Beginner showed `1/8`.

### B2-UI-2 — Romana Teglia / hand / fresh yeast / whole wheat

The dough remained one mass for the tray, not individual balls. Detailed
instructions used hand mixing and gentle whole-wheat handling. Beginner and
Planner agreed on mixing at 15:05, folds at 15:45 and 16:15, fridge-in at
16:55, fridge-out at 17:00, preheat at 18:40 (20 minutes at 250°C), and baking
at 19:00. Beginner additionally displayed a separate 18:45 tray/topping
milestone; Planner does not schedule that as a separate appointment. After
completing the first guided action and performing a real reload, Beginner
showed `1/8`.

### B2-UI-3 — New York / mixer / fresh yeast / gluten-free

Detailed instructions explicitly used psyllium, a cohesive gluten-free mass,
and mixer-specific mixing without gluten-development kneading. Beginner and
Planner agreed on mixing at 15:05, gluten-free portioning at 16:55, fridge-out
at 17:00, preheat at 18:00, and baking at 19:00. Planner's generic “balling”
wording at 16:55 is a portioning event; Beginner and the detailed recipe retain
the gluten-free-specific handling.

The first reload of this combination exposed a progress issue: `romanFormat`
was carried from prior Romana settings into a New York plan identity even
though New York does not use a Roman subtype. After correcting the plan-key
builder to include that field only for Romana, the case was run again. The
first action persisted and a real reload restored `1/6`; the stored snapshot
identity and guided progress record matched.

## Room-only public verification

On deployment `fi76aijhtf`, the public UI was set to Neapolitan / direct /
hand-mixed / Tipo 0/00 with room-only fermentation and a bake time of
11 October 2026 at 17:00. Beginner showed mixing at 13:05, folds at 13:45 and
14:15, shaping at 14:55, room-fermentation end at 16:00, preheat at 16:00
(60 min at 300°C), and baking at 17:00. Detailed instructions agreed on the
16:00 room-fermentation end and preheat. Planner showed the same timed work
events and bake time; its 14:55 step explains the two-hour covered room rest,
and it does not add a separate appointment named “room fermentation end”.
There were no refrigerator entry or removal events on any surface.

After marking the first step, opening Profile, returning to Calculator, and
performing a full browser reload, the bake date, terms and `1/7` progress
remained unchanged. This is a public UI and reload result, superseding the
earlier local-only boundary note. No room-only scheduling code was changed.

## Executed versus not executed

| Scenario | Beginner | Detailed instructions | Planner | Real reload / progress | Status |
|---|---|---|---|---|---|
| Romana Tonda, mixer, dry, Manitoba | Checked | Checked | Checked | `1/8` retained | Executed |
| Romana Teglia, hand, fresh, whole wheat | Checked | Checked | Checked | `1/8` retained | Executed |
| New York, mixer, fresh, gluten-free | Checked | Checked | Checked | `1/6` retained after key fix | Executed |
| Room-only / Neapolitan / hand / Tipo 0/00 | Checked | Checked | Checked | `1/7` retained after Profile return and real reload | Publicly executed on `fi76aijhtf`; no fridge events |
| Neapolitan cold plan, hand, fresh, Tipo 0/00 | Earlier B1 local progress test only | Not compared in this pass | Not compared in this pass | Earlier B1 test; not repeated here | Cold-plan cross-surface case not executed in this B2 pass |
| Romana Tonda / hand / fresh / 70% Tipo 0/00 + 30% whole wheat | Checked | Checked | Checked | `1/8` retained after DE/US reload; changed flour reset to `0/8` and stayed after reload | Publicly executed on `fi76aijhtf`; cross-surface fridge-in mismatch found |
| Same custom blend on corrected build | Checked | Checked | Checked | `1/9` retained after mark, Profile return and full reload | Publicly executed on `m3gh4gw90j`; fridge-in now agrees at 17:00 |
| Language HR → DE, metric → US | Checked on saved custom plan | Checked | Checked | `1/8` retained through full reload before input change | Publicly executed on `fi76aijhtf`; other locales/systems open |
| Spelt and other custom-blend UI combinations | Not checked | Not checked | Not checked | Not checked | Not executed |
| Remaining style/mix/yeast/flour cross-product | Not checked | Not checked | Not checked | Not checked | Not exhaustive |
| Public preview for earlier three combinations | Not rerun | Not rerun | Not rerun | Not rerun | Confirmed Napolitana and New York cold cases intentionally not repeated |
| Mixed-flour ratios beyond 70/30 Tipo 0/00 + whole wheat | Not checked | Not checked | Not checked | Not checked | Open |
| Language and unit combinations beyond HR/DE and metric/US | Not checked | Not checked | Not checked | Not checked | Open |
| Neapolitan cold-plan cross-surface case | Not checked in this B2 pass | Not checked in this B2 pass | Not checked in this B2 pass | Not checked in this B2 pass | Open |

An earlier, targeted public B2 fridge-out check is documented in
`B1_VERIFICATION_REPORT.md`; it was not repeated in this pass.

## Commands and result

```text
cd frontend && npm run check:beginner-plan-persistence
  PASS — production persistence, calculator, guided-plan and restore functions
cd frontend && npm run check:home-pizza-plan
  PASS — Beginner schedule and separate balling/fridge-in regression
cd frontend && npx tsc --noEmit --pretty false
  PASS
```

The persistence regression includes the new invariant that changing a stale
Roman subtype cannot change the identity of a non-Romana Beginner plan. The
browser test then verified the impact in the actual app and storage lifecycle.

The initial identity-fix deployment landing-page load is captured in
`frontend/ui_evidence/b2-public-preview-identityfix-home.png`. Later, the
room-only and custom-blend cases were exercised on that deployment; the
corrected custom-blend event timing was then verified on the newer deployment.

## Final open B2 checks and fridge-entry fix

### Custom blend cold-plan reproduction

On the public deployment `fi76aijhtf`, the plan was Romana Tonda, direct hand
mixing, fresh yeast, custom flour blend (70% Tipo 0/00 and 30% whole wheat),
four 210 g dough balls, baking 13 October 2026 at 19:00. The ingredient panel
showed 354 g Tipo 0/00 + 152 g whole wheat (506 g total flour), 299 g water,
14.2 g salt, 0.34 g fresh yeast, and 20 g olive oil.

Beginner and Planner placed “divide/shape and put in the refrigerator” at
16:55 on 12 October. Detailed instructions correctly placed transfer to the
refrigerator at 17:00. The schedule has `ballingAt=16:55`,
`fridgeAt=17:00` (Phase C is 5 minutes), followed by fridge-out 17:00 on
13 October, preheat 18:00, shaping/topping 18:45, and bake 19:00. Root cause:
Beginner and `reversePlan` used one combined balling/fridge-in event at
`ballingAt`, except for one previously special-cased Neapolitan configuration.

The smallest fix separates shaping at `ballingAt` from fridge entry at
`fridgeAt` when those times differ. The relevant `reversePlan` regression test
uses both a Neapolitan fixture and a Romana Tonda fixture and checks the two
event timestamps. The public UI on the corrected deployment
`m3gh4gw90j` showed “Oblikuj kuglice” at 16:55 and “Stavi kuglice u hladnjak”
at 17:00 in both Beginner and Planner, matching the detailed recipe. After
marking the first action, visiting Profile, returning, and fully reloading,
`1/9` and all dates/times remained. The extra actionable event explains why
the corrected plan total is nine rather than eight.

### Language, units, progress and reset

On the saved custom plan on `fi76aijhtf`, HR was changed to DE and metric to
US. The schedule remained 12 October 15:05/15:45/16:15/16:55, then 13 October
17:00/18:00/18:45/19:00; progress remained `1/8` after a full reload. Flour
converted to 12.5 oz Tipo 0/00 (70%) + 5.4 oz whole wheat (30%), 1.12 lb total
flour; water 10.5 oz, oil 0.7 oz, dough ball 7.4 oz, sauce 3.4 oz each and
cheese 3.5 oz each. Temperature values displayed in °F. Salt (14.2 g) and
yeast (0.34 g) remain grams by the app’s precision-sensitive weight-display
policy. Changing blend component B from whole wheat to spelt (keeping 30%)
changed the plan identity and reset progress from `1/8` to `0/8`; after reload,
spelt and `0/8` remained.

### Public deployment identities

- Tested before the event fix: `https://pizzabook--fi76aijhtf.expo.app`,
  deployment `fi76aijhtf`.
- Corrected build: `https://pizzabook--m3gh4gw90j.expo.app`, deployment
  `m3gh4gw90j`, alias `b2-fridgein-fix-20261011`.
- Corrected JS bundle SHA-256 matched the local export:
  `0a2237c9f831da6d57765a89cb0153417bd1c67c29b254982fbe3c0b461fc951`.
- The room-only case was verified on `fi76aijhtf`. The later code change only
  splits cold balling/fridge-entry events; room-only generation was untouched
  and was not rerun on the corrected deployment.

## Archive contents

`PizzaBook_B2_Coverage_Review.zip` contains the current relevant implementation
sources (`index.tsx`, `planner.tsx`, calculator, persistence/restore, preference,
experience-level, translation, guided-recipe, notification and recipe-step
modules), the focused and supporting Beginner verification scripts, project
TypeScript/package manifests, the B1/B2 review reports and diffs, and the
case-specific local and public UI screenshots including post-reload progress
and Planner timelines. Secrets, dependency trees, and generated web bundles are
excluded.

## Deployment and remaining scope

The latest corrected identity-fix build is deployed at
`https://pizzabook--m3gh4gw90j.expo.app` (deployment ID `m3gh4gw90j`,
alias `b2-fridgein-fix-20261011`). Earlier public UI checks were run on
`fi76aijhtf`. Confirmed earlier Napolitana and New York cold cases were
intentionally not repeated. The room-only schedule formula was not changed.
Still open: Neapolitan cold cross-surface comparison, other blend ratios and
flours, other language/unit combinations, and the remaining style/mixing/
yeast/flour combinations. B3 was not started.
