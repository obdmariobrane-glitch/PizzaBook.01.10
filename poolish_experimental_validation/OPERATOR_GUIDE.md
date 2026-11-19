# Operator Guide: Running the 81 Poolish Samples

This is the short bench-side procedure. The full rules and definitions are in `POOLISH_EXPERIMENTAL_PROTOCOL.md`; IDs and quantities are in `POOLISH_81_SAMPLE_MATRIX.csv`.

## Run order

1. Schedule three independent blocks (R1, R2, R3), preferably on separate days. Every sample is mixed and weighed independently. Do not make one large dough and divide it into replicate jars.
2. Run one temperature/sequence group at a time if needed. A one-probe setup should be staged in groups of no more than nine samples so each sample's temperature can be read on a repeatable schedule.
3. Before mixing, check the exact IDs, flour/yeast lots, balances, probe, room temperature, refrigerator temperature, containers, labels, photo setup, and observation schedule. Complete `PREPARATION_CHECKLIST.md`.
4. Prepare fresh 10% yeast suspension (10 g yeast + 90 g water). Keep homogenized before every draw and discard the same day.
5. For each 100 g flour sample, weigh the assigned suspension and corrected extra water: 1 g + 99.1 g for 0.10 g yeast; 2 g + 98.2 g for 0.20 g; 3 g + 97.3 g for 0.30 g. This makes exactly 100 g total water. Add no salt.
6. Mix every sample for the same predeclared time/action. Label its vessel before filling. Record actual ingredient/mix temperatures, mixing-end time, and initial height. Photograph time zero.
7. Place jars in assigned measured conditions. Stable RT/CT time starts only when that sample's core reaches its target +/-0.5 deg C. Keep wall-clock elapsed time from mix as a separate clock.
8. At every observation, record one new row in `POOLISH_OBSERVATION_LOG_TEMPLATE.csv`, photograph consistently, and record raw height, bubbles, surface, structure, smell, and core/ambient temperatures before assigning maturity.
9. At a transition, record timestamp, source/destination targets, core temperature, then each sample's core readings until it reaches the new target +/-0.5 deg C. Transition time is not stable phase time.
10. Follow the exact assigned phase durations. Do not move a sample early because it looks ready. At the combined primary endpoint, record the result, then continue in the final environment only as specified in the protocol.
11. Stop at documented overripe condition or the assigned maximum. If unresolved, record censored/not classifiable, not a guessed peak.
12. After observations are complete, fill the matching row in `POOLISH_SAMPLE_SUMMARY_TEMPLATE.csv`. Preserve raw data and photos. Do not calculate model coefficients yet.

## What the IDs mean

- `RT-T22-Y020-R3`: RT at 22 deg C, 0.20% yeast, repetition 3.
- `CT-T04-Y010-R1`: CT at 4 deg C, 0.10% yeast, repetition 1.
- `RTC-RT12-CT24-Y030-R2`: RT->CT, 12 stable h at 22 deg C then 24 stable h at 4 deg C, 0.30% yeast, repetition 2.
- `CTR-CT24-RT04-Y010-R3`: CT->RT, 24 stable h at 4 deg C then 4 stable h at 22 deg C, 0.10% yeast, repetition 3.

R1/R2/R3 are independent preparations. Never recycle an ID for a failed or replacement run.

## Observation shorthand

Bubble quantity: 0 none, 1 few, 2 moderate, 3 many. Record bubble size and whether bubbles are surface-only or distributed. Surface: flat, domed, leveling, or concave. Maturity: underfermented, mature, overripe, or not classifiable/censored. These labels supplement; they never replace raw measurements.
