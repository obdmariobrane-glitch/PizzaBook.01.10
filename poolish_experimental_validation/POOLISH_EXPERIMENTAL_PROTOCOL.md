# PizzaBook Poolish Experimental Validation Protocol

## Purpose and status

This protocol defines a controlled 81-sample study of fresh-yeast Poolish under RT, CT, RT->CT, and CT->RT conditions. Its purpose is to collect traceable observations for later PizzaBook model calibration. It does not declare universal fermentation recommendations and does not validate any model before the experiment is run and analyzed.

The full preassigned sample list is `POOLISH_81_SAMPLE_MATRIX.csv`. Use the IDs exactly as written. Three repetitions mean three independently weighed, mixed, and fermented samples prepared in separate experimental blocks, preferably on separate days. Do not split one master mix into three jars and call them independent repetitions.

## Design at a glance

| Group | Conditions | Samples |
|---|---|---:|
| RT | 20, 22, 24 deg C x 0.10, 0.20, 0.30% fresh yeast x 3 reps | 27 |
| CT | 4, 6 deg C x 0.10, 0.20, 0.30% fresh yeast x 3 reps | 18 |
| RT->CT | 22 deg C RT for 12 or 4 stable h, then 4 deg C CT for 24 stable h; 3 doses x 3 reps | 18 |
| CT->RT | 4 deg C CT for 24 stable h, then 22 deg C RT for 12 or 4 stable h; 3 doses x 3 reps | 18 |
| **Total** | **81 unique samples** | **81** |

Combined conditions have a pre-registered primary endpoint at the end of their assigned stable phases (28 or 36 stable h). After that endpoint, continue observation at the final target temperature until peak/overripe status is documented or the maximum final-phase exposure is reached: 120 stable CT hours for RT->CT and 48 stable RT hours for CT->RT. The primary endpoint and any continuation are reported separately.

## Standard ingredients and exact water accounting

Each Poolish sample contains 100.00 g flour, exactly 100.00 g water, fresh baker's yeast at the assigned dose, and 0 g salt. Hydration is 100% by total water mass divided by flour mass. Use the same flour and yeast lots throughout a block and record brand, lot, label, expiry, and storage history.

Use a freshly prepared 10% w/w yeast suspension: 10.00 g fresh yeast plus 90.00 g water. Its yeast mass fraction is 0.10. Homogenize immediately before every draw. Do not store it for another day.

| Yeast dose | 10% suspension to weigh | Water carried by suspension | Additional water | Total water |
|---:|---:|---:|---:|---:|
| 0.10 g | 1.00 g | 0.90 g | 99.10 g | 100.00 g |
| 0.20 g | 2.00 g | 1.80 g | 98.20 g | 100.00 g |
| 0.30 g | 3.00 g | 2.70 g | 97.30 g | 100.00 g |

Calculation: suspension mass = yeast mass / 0.10; water in suspension = suspension mass - yeast mass; additional water = 100.00 g - water in suspension. The frequently copied additional-water values 99, 98, and 97 g would produce 99.9, 99.8, and 99.7 g total water, respectively, if the full suspension mass is weighed. They therefore do not meet the exact 100 g water requirement and are not used in this protocol.

Use a 0.01 g resolution scale for yeast suspension and yeast; verify the main scale with a check weight. Use mass, not volume, for all ingredients.

## Equipment and container controls

- 81 identical, clear, straight-sided containers are convenient if all samples overlap; alternatively execute the matrix in smaller runs while preserving all IDs and independent repetitions. Each container should hold at least 400-500 ml, have the same internal geometry, and use the same loose lid or cover.
- Scale readable to 0.1 g for flour/water and 0.01 g for suspension; check weights.
- Fast, sanitized probe thermometer. A multi-channel temperature logger is preferred for transition tracking; if unavailable, use one probe on a fixed repeated rotation and record each reading's timestamp.
- Temperature-controlled spaces for RT 20/22/24 deg C and CT 4/6 deg C, plus independent room/refrigerator thermometers or loggers.
- Ruler or fixed height scale, timer, labels, camera/phone, permanent marker, notebook or spreadsheet, and a consistent light/background for photos.
- Optional infrared thermometer for the baking surface in the later dough study; it does not replace a dough-core probe.

Mark a vertical height scale on every container or use a fixed external ruler. Do not use different jar shapes for different groups. Keep covers equally vented, keep jars away from direct sun, heaters, refrigerator cooling plates, and strong airflow. Randomize positions within each temperature space and record position. If the space has a temperature gradient, map it before the study and avoid assigning all of one yeast dose to one location.

## Sample preparation and labels

1. Before each block, verify the sample IDs and phase schedule against the matrix. Record date, operator, room temperature, refrigerator temperature, flour lot, yeast lot, scale IDs, and thermometer IDs.
2. Prepare fresh 10% suspension immediately before use. Add 10.00 g fresh yeast to 90.00 g water and mix until uniform. Keep it gently mixed; homogenize before each dose. Discard unused suspension at the end of the session.
3. For each ID, weigh 100.00 g flour, the assigned suspension mass, and the corrected additional water from the matrix. No salt is added. Confirm suspension + additional water contains exactly 100.00 g water by the stated calculation.
4. Use the same mixing vessel, utensil, mixing action, and duration for every sample. Suggested standard: combine suspension and additional water, add flour, mix for 60 seconds with the same utensil and motion, scrape the sides once, then mix another 30 seconds. Record any deviation. Do not knead or intentionally aerate.
5. Transfer all mixture into its labeled fermentation container, scrape consistently, close with the standard cover, and record the time mixing ends as elapsed-time zero. Measure and record mixture core temperature and initial height immediately. The actual phase clock begins only when the core is within target +/-0.5 deg C; elapsed time from mixing is always retained separately.
6. Take a time-zero photo with ID, ruler, and timestamp visible. Do not tap or shake the sample to level it. Avoid writing on reusable lids where IDs could be swapped.

If CT ingredients and equipment cannot be conditioned in the cold space, mix consistently at the documented preparation temperature and treat the initial cooling as a transition. Do not backdate stable CT exposure. For CT->RT, pre-chill ingredients/equipment where practical so the initial CT transition is short; record it regardless. For fair comparisons, use the same preparation approach for all samples in the same group and record it in the block notes.

## Temperature definitions and transition tracking

Record three temperatures separately: actual room/RT-space temperature, actual refrigerator/CT-space temperature, and Poolish core temperature. The setting shown on an appliance is not a measurement. Record target and measured values in deg C.

For every sample and every phase transition:

- Write the transition start timestamp and the source and destination temperatures.
- Record core temperature at the transition and at least every 10 minutes until the core first enters destination target +/-0.5 deg C; use 5-minute readings near the target if practical. Log the actual timestamp for every sample, not one shared approximate arrival time.
- Record elapsed time from mixing, transition duration, cumulative stable time in the phase that just ended, and stable time in the new phase. Transition time is neither stable RT nor stable CT.
- The stable phase timer starts at the first core reading within target +/-0.5 deg C. If the sample later leaves the band, log the excursion and its duration; do not silently count the excursion as stable exposure.
- Continue logging room and refrigerator temperatures at least every 15 minutes during transitions and at least hourly during stable phases, or use a logger. Note door openings and power interruptions.

A single probe can be used if the run is staged in groups of no more than nine jars and the operator records each jar's actual reading time. Keep the measurement order fixed and cycle it. Do not infer the individual arrival time from a witness jar. A logger in a witness jar is useful for context but does not replace the required sample-specific core readings. Insert a sanitized probe to the same approximate center depth, avoid walls and the bottom, and do not stir or press the sample.

## Fermentation schedules

### RT-only

Setpoints are 20, 22, and 24 deg C. Observe at elapsed 0, 4, 8, 12, 16, and 20 h. If the sample is still rising or maturity/peak has not been resolved, continue at the same RT setpoint with observations at least every 4 h, and every 1-2 h when approaching a suspected peak. Stop at documented overripe condition or 48 stable RT hours, whichever comes first. Do not call an unobserved peak a measured peak.

### CT-only

Setpoints are 4 and 6 deg C. Observe at 12, 24, 36, 48, and 72 stable CT hours. If still rising or unresolved, continue every 12 h, with more frequent readings near an apparent peak, to a maximum of 120 stable CT hours. Record the initial cooling transition separately from stable CT time.

### RT->CT combined

Set RT at 22 deg C. For the long-first-phase condition, hold 12 stable RT hours; for the short-first-phase condition, hold 4 stable RT hours. Observe RT at time zero and every 4 h for the 12 h phase; for the 4 h phase observe at 0, 2, and 4 h. At the exact assigned stable-phase endpoint, record height/photo/core temperature and transfer to 4 deg C. Log cooling per sample until core reaches 4 +/-0.5 deg C. Start the 24 h stable CT timer only then. Observe the CT phase at 0, 6, 12, 18, and 24 stable h, adding readings near a suspected peak. The scheduled primary endpoint is the end of 24 stable CT hours. If unresolved, continue at 4 deg C to a maximum of 120 total stable CT hours and label these readings post-endpoint continuation.

### CT->RT combined

Set CT at 4 deg C for 24 stable hours. Observe at 0, 6, 12, 18, and 24 stable CT hours. At the exact assigned 24 h endpoint, record height/photo/core temperature and transfer to 22 deg C. Log warming per sample until core reaches 22 +/-0.5 deg C. Then hold 12 stable RT hours for the long-final-phase condition or 4 stable RT hours for the short-final-phase condition. Observe the RT phase at 0 and every 4 h for a 12 h phase, or at 0, 2, and 4 h for a 4 h phase. The scheduled primary endpoint is the end of that assigned stable RT phase. If unresolved, continue at 22 deg C to a maximum of 48 total stable RT hours and mark post-endpoint continuation.

For all combined samples, the transition can occur between scheduled observations only if the assigned phase duration is complete; do not use appearance to move a sample early. Record both the planned transition and actual transition timestamps. The prescribed phase lengths are stable-target hours, not wall-clock elapsed hours. This distinction makes the measured real-time duration longer when transitions take longer.

## Observation method and maturity labels

At each observation, record the required fields in `POOLISH_OBSERVATION_LOG_TEMPLATE.csv`. Photograph the jar from the same angle and distance with its ruler, ID, and timestamp. Record raw facts before assigning a maturity label. Use height in mm. For an identical straight-sided jar, report `volume_change_proxy_pct` as a volume proxy: 100 x (current height - initial height) / initial height. Label it a height-based proxy, not measured volume. If actual volume is measured by a validated method, record the method separately. Record the transition start and target-band entry timestamps explicitly for every transfer.

Use consistent descriptive scales: bubble quantity 0 none, 1 few, 2 moderate, 3 many; bubble size tiny, small, medium, large; surface flat, domed, leveling, concave; structure cohesive, webbed, loose, liquid/separated, or other with a note. Record smell descriptively without tasting raw dough. Note whether bubbles are only at the surface or distributed through the mixture.

Pre-register the following operational labels before collecting data, and retain all raw observations:

- **Underfermented:** visibly still rising and/or insufficient visible fermentation development; no observed peak. Record `still rising` and evidence.
- **Mature:** at the measured peak or a stable plateau, with developed bubbles/fermentation structure and no sustained decline. A plateau may be noted when consecutive readings are within the predeclared height measurement tolerance; state that tolerance in the block sheet.
- **Overripe:** visible post-peak decline, loss of structure, and sustained reduction in height/volume proxy across at least two consecutive observations. Record the observed maximum and decline; do not assign this label from elapsed time alone.
- **Not classifiable/censored:** peak or state could not be resolved before the study limit, a critical measurement is missing, or a temperature excursion invalidates the intended exposure. Preserve the sample in the dataset with a reason; do not force a maturity label.

The measured peak is the highest recorded height. Report peak time as an interval between the last non-peak reading and first reading at/after the maximum if the peak is only bracketed by sparse observations. A later lower height supports post-peak decline; never infer exact peak time between observations.

## Repetition, execution blocks, and exclusions

Prepare R1, R2, and R3 as separate independent blocks, preferably on separate dates. Each sample receives its own weigh-out, mixing, vessel, and measurement series. Within a block, run conditions in parallel only when the operator can keep to the measurement schedule. Otherwise stage the groups, preserving original IDs and recording actual dates. Randomize positions and, where possible, preparation/order within each group. Do not change more than the assigned temperature, yeast dose, or sequence condition.

Do not discard inconvenient results. Flag, with a reason, scale error, wrong ID, contamination, temperature excursion, missed observations, spill, or equipment failure. Keep the raw row and mark it invalid for the affected comparison rather than deleting it. If a repeat is needed, assign a new suffix such as `R3-REP1`, retain the failed original, and document why the replacement was made.

## Data files and recordkeeping

- `POOLISH_81_SAMPLE_MATRIX.csv`: immutable planned IDs, factors, recipe quantities, phase schedule, and limits.
- `POOLISH_OBSERVATION_LOG_TEMPLATE.csv`: duplicate one row for every actual observation; never overwrite prior timepoints.
- `POOLISH_SAMPLE_SUMMARY_TEMPLATE.csv`: one row per planned sample; fill only after its time series is complete.
- Keep an unedited raw copy and a separate analysis copy. Use ISO dates/timestamps and state the time zone. Filenames for photos should include sample ID and timestamp, for example `RTC-RT12-CT24-Y010-R1_2026-11-03T1200.jpg`.

No experimental outcomes are prefilled. The 81 records are planned samples only.
