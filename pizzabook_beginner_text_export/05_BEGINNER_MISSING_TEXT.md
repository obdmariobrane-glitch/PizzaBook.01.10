# Beginner extraction gaps and source-level missing text

This is not a language review. It records extraction limitations and source facts only. No text was corrected or translated.

## Static translation nulls

The JSON catalog reports **0** static keys with at least one missing language value.

- None detected in the parsed translation object.

## Hardcoded and non-catalog text

- [styleSteps.ts](/app/frontend/src/i18n/styleSteps.ts) contains substantial Croatian hardcoded recipe text and dynamic Croatian templates rather than four parallel language tables.
- [index.tsx](/app/frontend/app/(tabs)/index.tsx), [planner.tsx](/app/frontend/app/(tabs)/planner.tsx), and other UI modules contain inline literals and inline language maps outside `translations.ts`. These are preserved in the dynamic literal inventory and verbatim appendices.
- Some literal inventory entries are implementation values, route names, test IDs, storage keys, or accessibility values rather than visible copy. They are retained intentionally to avoid omitting a user-facing literal.
- Runtime-rendered values depending on user input, current time, calculator output, locale formatting, or backend data cannot be exhaustively enumerated as finite values. Their exact templates and branch conditions are preserved.
- Remote community content, user names, comments, uploaded media, backend update messages, and server-provided profile data are not source-controlled text and therefore are not represented as fixed translation entries.
- The custom update manifest/backend can provide runtime message text not present in the frontend source.

## Unverified runtime coverage

- This export was produced by static source inspection only. The app was not built or run.
- No language correction, translation, normalization, or spelling correction was performed.
- No claim is made that every code literal is visible; implementation literals are included as a conservative superset.
