# Instruction generator

This generator loads the current frontend TypeScript modules through the frontend-local TypeScript compiler. It does not modify or copy files back into the application.

Usage:

`node instruction_generator/index.cjs '{"kind":"beginnerDirect","lang":"en","style":"neapolitan","mixing":"hand","flourType":"caputo00","bakeAt":"2026-10-13T18:00:00.000Z"}'`

Supported kinds are `preferment`, `spiral`, `style`, `directSchedule`, `bigaSchedule`, `poolishSchedule`, and `beginnerDirect`. Dates are serialized as ISO strings.

The `beginnerDirect` generator executes the exact existing Beginner instruction functions from `frontend/app/(tabs)/index.tsx` through a read-only extracted runtime.
