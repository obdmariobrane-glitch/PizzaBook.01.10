# PizzaBook complete instruction system export

Generated as a read-only extraction from the current working tree. The application under `frontend/` was not edited by this export.

## Contents

- `instruction_sources/`: verbatim copies of the active instruction, calculation, translation, guided-recipe, notification, and generated-manual sources.
- `all_texts.json`: TypeScript AST inventory of string and template literals with source paths and lines.
- `all_conditions.json`: AST condition inventory plus documented branch axes and numeric controls.
- `instruction_dependencies.json`: source ownership and dependency boundaries.
- `instruction_generator/`: standalone CommonJS runner for exported production generators and Beginner direct assembly from `index.tsx`.
- `branch_coverage.json`: static axes, smoke matrix, and explicit coverage limitations.
- `validation_report.json`: hashes, parse checks, runtime smoke results, and Beginner parity evidence.
- `beginner_matrix_validation.json`: 576-case Beginner direct matrix (language/style/flour/mixing/schedule) execution evidence.

## Languages

The source supports Croatian (HR), English (EN), German (DE), and Slovenian (SL). SL is retained because removing it would omit supported production instructions.

## Beginner execution

The Beginner final display assemblers are local, unexported functions in `frontend/app/(tabs)/index.tsx`. This package executes those exact functions through a read-only runtime extractor in `instruction_generator/index.cjs`; it does not duplicate or rewrite their rules.

## Regeneration

From the repository root:

`node build_instruction_system_export.cjs`

The output directory is intentionally separate from `frontend/`.
