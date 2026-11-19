# Data Analysis and PizzaBook Calibration Specification

## Status and evidence classes

No experimental results are supplied by this document. Keep four evidence classes separate in every report and any future implementation proposal:

1. **Directly measured:** scale readings, timestamps, temperatures, heights, photographs, sensory/structure observations, and final-dough outcomes.
2. **Calculated from measurements:** yeast percentage, total water/hydration, stable and transition durations, height-change proxy, time brackets, replicate summaries, and derived contrasts. Preserve formulas and input columns.
3. **Model assumptions:** any interpolation, temperature-rate function, mapping from height to volume, maturity threshold, or assumption about residual yeast activity.
4. **Proposed calibration coefficients:** candidate parameters estimated from specified training data, with uncertainty, validation design, and supported domain. They are proposals until independently tested.

Never replace raw observations with smoothed values or model predictions. Keep original files immutable and make analysis copies.

## Data integrity and derived fields

Validate that there are 81 unique planned sample IDs and 3 independent replicates per condition: 27 RT, 18 CT, 18 RT->CT, and 18 CT->RT. Check each sample has 100 g flour, exactly 100 g water including suspension water, 100% hydration, and 0 g salt. Flag missing, inconsistent, censored, and temperature-excursion records before calculating summaries.

For each observation calculate:

- `elapsed_since_mix_h` from mixing-end timestamp.
- `transition_elapsed_h` from each transfer until the sample core first reaches destination target +/-0.5 deg C.
- Stable RT/CT exposure from sample-specific entry/exit timestamps, excluding transition intervals. Preserve actual wall-clock elapsed time as a separate field.
- `volume_change_proxy_pct` = 100 x (height_mm - initial_height_mm) / initial_height_mm, only for the same sample and unchanged measurement method. Do not label it measured volume.
- Peak as maximum recorded height, with the time interval bracketed by the adjacent observations. If the maximum is at the first/last observation or an excursion obscures the trajectory, mark peak as left/right-censored or unresolved.
- Time-to-maturity and time-to-overripe as observed intervals, not falsely exact times.

Maintain a sample-level summary and a long-form observation table. A failed temperature target, missing transition data, or contaminated sample is not silently removed; report its validity status and analyze with/without it only when justified.

## Pre-registered comparisons

1. **RT temperature:** compare time-course and peak/maturity outcomes at 20, 22, and 24 deg C, separately by yeast dose. Examine measured core-temperature histories, not just chamber setpoints.
2. **CT temperature:** compare 4 and 6 deg C by dose, accounting for sample-specific cooling times and excursions.
3. **Yeast dose:** within every mode/temperature/sequence, compare 0.10, 0.20, and 0.30%. Do not collapse temperature and dose effects into one contrast.
4. **RT->CT order and first-phase length:** compare 12+24 with 4+24 at each dose; use primary endpoint at 36 and 28 stable hours respectively, and also compare complete trajectories at matched phase points.
5. **CT->RT order and final-phase length:** compare 24+12 with 24+4 at each dose; use primary endpoint at 36 and 28 stable hours respectively, with full trajectory comparisons.
6. **Order effect:** compare RT->CT and CT->RT only as explicitly matched profiles where phase durations and actual temperature histories permit; do not assume sequence equivalence or interpret the two requested schedules as identical exposures.
7. **Transitions:** report cooling/warming time and temperature profile separately. Explore whether transition duration predicts later kinetics, but do not count transition as stable RT/CT time or discard it.
8. **Maturity and collapse:** compare time-to-peak brackets, peak height, plateau duration, decline from peak, and observed classifications. A sample not at peak by its limit is censored, not a long time-to-peak observation.
9. **Final dough:** compare A vs C0, B vs C+, and A vs B within matched block/Poolish condition. Evaluate fermentation time and structural/baking outcomes separately. Do not infer residual yeast mass directly from the Poolish inoculum.

Report all replicate trajectories, individual values, mean and standard deviation where meaningful, and median/range. With only three replicates per condition, uncertainty is large; avoid significance claims or precise fitted coefficients based solely on a small p-value or a single run.

## Candidate modeling workflow (after data exist)

1. Lock and audit the raw data; record exclusions and deviations before looking for a preferred coefficient.
2. Plot each sample's height proxy and core-temperature history versus both actual elapsed time and stable-phase time. Mark phase transitions, target-band entry, peak interval, primary endpoint, and censoring.
3. Begin with condition-specific empirical summaries and interpolation only inside tested levels. Show uncertainty and data support in the interface proposal.
4. For continuous candidate models, model time-to-peak as a response to yeast dose, measured temperature history, and mode/sequence interactions. Consider separate rise and decline behavior rather than one scalar endpoint. Use a trajectory/segmented or time-to-event framework if justified; do not force a specific functional form in advance.
5. For combined modes, compare explicit ordered phase histories. A cumulative-temperature or equivalent-time model may be explored only as a hypothesis and must be tested against sequence-specific results. Do not impose a universal RT-to-CT conversion coefficient.
6. Treat the existing K=0.5 coefficient as an unvalidated comparator, not a constraint or truth. Report its prediction error against observations if a comparable prediction can be computed; do not tune the data to preserve it.
7. Estimate candidate parameters with uncertainty intervals and test prediction on held-out independent blocks. Three blocks are a starting replication level, not a strong external validation set. Collect new independent batches for validation; never random-split observations from the same sample across train/test.
8. State the tested domain: flour/yeast lots, hydration, vessel geometry, temperature range, yeast levels, and phase schedules. Do not extrapolate beyond it without new experiments.
9. Only propose a Calculator/Planner formula after the candidate predicts held-out outcomes acceptably, has calibrated uncertainty, and preserves distinct RT, CT, RT->CT, and CT->RT behavior where data show differences.

## Remaining unknowns requiring further experiments

- Other flour protein/enzymatic profiles, brands, lots, extraction rates, and water chemistry.
- Yeast brand/strain, age, viability, storage, and variation between fresh-yeast batches.
- Temperatures outside 4-6 and 20-24 deg C; finer temperature spacing and seasonal room/refrigerator cycling.
- Poolish hydration and flour ratios other than 100%; salt and other ingredients.
- Jar geometry, sample depth, scale-up effects, mixing oxygenation, and evaporation.
- Dense early/late observation intervals if the peak falls between scheduled reads.
- Replicate count needed for stable parameter estimates and between-day/operator variability.
- Direct objective volume/gas measurement and standardized rheology if height/handling is insufficient.
- Final-dough responses across more than one selected mature state, flour lot, yeast lot, and bake setup.
- Whether a single maturity label captures performance or whether maturity is a continuum.

The model is not validated until actual measurements are collected, quality-checked, analyzed, and tested on independent batches.
