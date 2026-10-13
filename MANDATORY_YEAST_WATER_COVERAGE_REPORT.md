# MANDATORY Yeast/Water Coverage Report

Generated: 2026-10-13T08:39:43.988Z

Scope: exhaustive static branch-source verification for Croatian direct yeast/water wording across Beginner + PRO source paths.

## Forbidden phrase scan

- frontend/app/(tabs)/index.tsx: 0
- frontend/src/i18n/spiralMixing.ts: 0
- frontend/src/i18n/styleSteps.ts: 0
- frontend/src/i18n/translations.ts: 0
- frontend/src/i18n/prefermentSteps.ts: 0

Result: PASS

## Required pattern evidence

- frontend/app/(tabs)/index.tsx: normalized direct sentence occurrences = 25
- frontend/src/i18n/spiralMixing.ts: dynamic 80/90%+grams template present = YES
- frontend/src/i18n/styleSteps.ts: dynamic 80/90%+grams template present = YES
- frontend/src/i18n/translations.ts: normalized fallback sentence present = YES

## Corrected paths (key)

- frontend/app/(tabs)/index.tsx:4759
- frontend/app/(tabs)/index.tsx:4770
- frontend/app/(tabs)/index.tsx:4781
- frontend/app/(tabs)/index.tsx:4792
- frontend/app/(tabs)/index.tsx:4803
- frontend/app/(tabs)/index.tsx:4814
- frontend/app/(tabs)/index.tsx:4825
- frontend/app/(tabs)/index.tsx:4836
- frontend/app/(tabs)/index.tsx:4847
- frontend/app/(tabs)/index.tsx:4858
- frontend/app/(tabs)/index.tsx:4992
- frontend/app/(tabs)/index.tsx:5007
- frontend/app/(tabs)/index.tsx:4869
- frontend/app/(tabs)/index.tsx:4880
- frontend/app/(tabs)/index.tsx:4891
- frontend/app/(tabs)/index.tsx:4902
- frontend/app/(tabs)/index.tsx:4913
- frontend/app/(tabs)/index.tsx:4924
- frontend/app/(tabs)/index.tsx:4935
- frontend/app/(tabs)/index.tsx:4946
- frontend/app/(tabs)/index.tsx:4969
- frontend/app/(tabs)/index.tsx:4980
- frontend/app/(tabs)/index.tsx:4993
- frontend/app/(tabs)/index.tsx:5008
- frontend/app/(tabs)/index.tsx:5046
- frontend/src/i18n/spiralMixing.ts:44
- frontend/src/i18n/styleSteps.ts:31
- frontend/src/i18n/translations.ts:248

## Conclusion

- Forbidden legacy phrases: removed from all scanned source paths.
- Direct Croatian sentence now standardized to 80%/90% format with grams in dynamic generators (app direct path, spiral direct path, style direct path).
- Legacy translation fallback (static-only) standardized to 90% wording without grams because it has no runtime water amount input.
