# PizzaBook PRO-2F review

## Public web preview

- Preview: https://pizzabook--heqzvm8c9b.expo.app
- EAS Hosting deployment ID: `heqzvm8c9b`
- The production alias was not changed because the EAS Free plan has reached its five-alias limit. The preview deployment is public and serves the corrected export.

## Cause and minimal change

The PRO Romana Tonda/Teglia handlers updated `romanFormat` but did not close the expanded style card. The PRO format picker was also rendered independently of the card's expanded state.

The change is limited to the UI surface:

- gate the PRO Romana format picker by `styleExpanded`;
- close `styleExpanded` after selecting Tonda or Teglia;
- extend the existing Roman and Pro source checks to protect both behaviors.

No calculation, recipe, persistence, schedule, APK, or Android changes were made for PRO-2F. The Tonda timer “38 min” versus text “2 h” remains a separate open item.

## Verification

- `cd frontend && yarn tsc --noEmit` — passed.
- `cd frontend && yarn check:roman-workflow` — passed.
- `cd frontend && yarn check:pro-options` — passed.
- `git diff --check` for the PRO-2F patch — passed.
- Fresh web export with `npx expo export --platform web` — passed.
- Public browser UI at the preview URL:
  - selected Romana, opened Tonda/Teglia immediately below the style choices and before flour;
  - selected Tonda and Teglia; each closed the style card and retained the matching summary;
  - reopened the style card and switched Teglia ↔ Tonda;
  - switched Romana ↔ Napolitana and New York;
  - opened the Pro method card and confirmed Direct, Biga, Poolish plus hand/mixer controls remain available;
  - retained the selected format summary after the card closed.
- Existing targeted source checks continue to cover Beginner, gluten-free Direct gating, Direct/Biga/Poolish, and hand/mixer branches.
- No new APK was built.

## UI evidence

- [Tonda closed summary](frontend/ui_evidence/pro2f-final-tonda.png)
- [Teglia closed summary](frontend/ui_evidence/pro2f-final-teglia.png)
- [Reopened style picker](frontend/ui_evidence/pro2f-style-reopen.png)
- [Pro method branches](frontend/ui_evidence/pro2f-methods.png)

## Diff and delivery package

- [Full PRO-2F diff from HEAD](PRO_2F.diff)
- [Downloadable PRO-2F evidence package](PizzaBook_PRO_2F.zip)
