import type { ProGuideTopic } from './types';

export const PRO_LEARN_EN_PART1: ProGuideTopic[] = [
  {
    id: 'topic-dough',
    title: 'Dough',
    description: 'Understand how ingredients form dough and recognize its development, elasticity, and extensibility.',
    introduction: '',
    sections: [
      {
        id: 'dough-formation',
        title: 'How dough forms',
        level: 3,
        markdown: `Pizza dough forms when flour absorbs water and mixing and resting bring its ingredients together into a mass that is extensible yet sufficiently strong. Yeast and enzymes in the flour change the dough over time. In the oven, gases expand, starches and proteins set, and the surface dries and browns.

Four related but distinct processes are involved:

1. **Hydration:** water enters flour particles and helps the dough come together.
2. **Structure development:** mixing, folding, and resting develop a network that retains gas.
3. **Fermentation:** yeast produces carbon dioxide and aromatic by-products.
4. **Baking:** heat expands gas, sets the crumb, and creates color and aroma.

In wheat dough, proteins form gluten after contact with water, mixing, and resting, creating a connected network. That network is not a limitless balloon: if it is too weak, gas escapes and the dough spreads; if it is overly tense or insufficiently rested, the dough springs back and is difficult to open.

**What to observe:** after mixing, the dough should be cohesive; after fermentation, it should show small bubbles and signs of activity, but it should not be liquid or fall apart when lifted. The ball should be puffy and supple, but not necessarily twice as large. The baked crust should have a color appropriate to the style and oven, without a raw, gummy center.

**Common mistake:** judging progress only by whether the dough has risen. Volume is a useful sign, but the rate and extent of rise depend on the container shape, amount of yeast, temperature, flour, and dough strength.`
      },
      {
        id: 'dough-gluten',
        title: 'Gluten development',
        level: 3,
        markdown: `In wheat dough, the proteins gliadin and glutenin form gluten with water; mixing and folds help connect the network, while resting allows the dough to relax. Maximum development in the mixer is not necessary: fermentation and gentle folds can further affect the structure. Gluten-free dough does not go through the same steps and is handled separately in the [gluten-free topic](#topic-gluten-free).

**Signs:** the mass is uniform and extensible, and retains gas. If it tears immediately during gentle stretching, cover it and let it rest first; if it spreads despite resting, check hydration, temperature, and fermentation level before adding flour.`
      },
      {
        id: 'dough-properties',
        title: 'Elasticity and extensibility',
        level: 3,
        markdown: `**Elasticity** is the tendency of dough to spring back after being pulled; **extensibility** is its ability to expand without tearing. Pizza dough needs both: dough that is only elastic springs back and shrinks, while dough that is only extensible can become thin and tear. Resting, temperature, water, flour, and mixing method change the balance.

If the dough springs back, cover it and rest it for 10–20 minutes before continuing to open it. If it tears, use less force and check development and hydration. The “windowpane” test can help, but the result depends on the formula and is not a necessary goal for every pizza.`
      },
      {
        id: 'dough-rest',
        title: 'Resting and readiness',
        level: 3,
        markdown: `Rest dough covered so a dry skin does not form. After mixing, it should be cohesive, with no dry patches; before dividing, the mass may be airier and lighter; a ball ready to open yields without tearing or excessive spring-back. Do not judge readiness only by doubling in size or the finger-poke test: consider time, temperature, volume, bubbles, aroma, and strength together.`
      }
    ]
  },
  {
    id: 'topic-flour',
    title: 'Flour',
    description: 'Read labels, distinguish W, protein, and P/L, and choose or blend flours.',
    introduction: '',
    sections: [
      {
        id: 'flour-labels',
        title: 'Flour labels and what they mean',
        level: 3,
        markdown: `- **Type 00 and type 0** in the Italian system primarily indicate the degree of sifting/ash content and flour type, not strength by default. Two type 00 flours can differ in protein, W, P/L, water absorption, and behavior.
- **Protein percentage** is the amount of total protein listed on the label. It is not the same as gluten content, and it does not measure how long the dough can withstand fermentation or how easily it stretches.
- **W** is the result of an alveograph test: an indicator of the work required to inflate and deform a dough sample under specified conditions. It is useful for comparing flours tested by the same method, but is not a direct synonym for “quality.”
- **P** describes the sample’s resistance/strength in the test, while **L** describes its extensibility. The **P/L** ratio summarizes the balance between resistance and extensibility. A high W alone does not guarantee that dough will be easy to shape; P/L and the recipe also matter.
- **Gluten** forms from wheat proteins gliadin and glutenin with water and mechanical work. Rye, oats, and spelt behave differently; wheat spelt contains gluten and is not safe for people who must avoid it.

W and protein percentage measure different properties. Do not convert one to the other with a formula or infer W from the protein number alone. If the label does not list W or P/L, record them as unknown.`
      },
      {
        id: 'flour-choice',
        title: 'Choosing flour for a style and schedule',
        level: 3,
        markdown: `| Flour | What to expect | A reasonable starting point |
|---|---|---|
| All-purpose wheat flour or “00” | The range is wide; fine milling is not proof of strength. | Start with moderate hydration, for example 58–63%, then adjust based on the dough. |
| Strong bread flour | Often retains more water and tolerates longer or colder schedules, but “stronger” does not mean better. | Use the manufacturer’s specifications, then try 60–67%. |
| Whole-wheat flour | Bran absorbs water and can cut/disrupt gluten; it gives fuller flavor and a denser structure. | Start with 10–25% of the blend and rest after adding water. |
| Spelt | Contains gluten, but the dough can be more sensitive to overmixing and prolonged stress. | First replace 10–20% of the wheat flour, not the entire amount. |
| Gluten-free blend | It is not interchangeable with wheat flour 1:1; absorption and binders depend on the product. | Follow the blend’s label for the water ratio and method. |

The ranges in the table are starting estimates, not specifications for every product. Changes in protein, milling, bran, and additives change behavior. Always keep the brand, lot, and hydration details.`
      },
      {
        id: 'flour-blends',
        title: 'Blending flours',
        level: 3,
        markdown: `Calculate a blend by weight. Example: 80% flour A and 20% flour B in a total of 500 g means 400 g A + 100 g B. A weighted average of protein can give an approximate average of the label values, but cannot reliably predict the blend’s W, P/L, or water absorption. Those properties do not necessarily change linearly.

**Signs the flour needs adjustment:** the dough tears when stretched; remains stiff and springs back; or is sticky and does not hold its shape. Check temperature and resting first. Only then change the water or blend in small increments of 1–2 percentage points.`
      }
    ]
  },
  {
    id: 'topic-water',
    title: 'Water and hydration',
    description: 'Calculate hydration and baker’s percentages, and learn to add water gradually.',
    introduction: '',
    sections: [
      {
        id: 'water-hydration',
        title: 'Hydration',
        level: 3,
        markdown: `Baker’s percentages express each ingredient as a percentage of the total flour. Flour is always 100%.

> Ingredient percentage = ingredient weight ÷ flour weight × 100

Example: 600 g flour and 372 g water give 62% hydration. In a recipe with a preferment, the numerator and denominator include all ingredients in both the preferment and final dough, but each ingredient is counted only once.

**Hydration** is the percentage of water relative to total flour. It does not include oil, eggs, sauce, or water later contributed by toppings. For precise recipe comparisons, total liquid can be listed separately, but in this guide “hydration” means water/flour.`
      },
      {
        id: 'water-bakers-math',
        title: 'Baker’s percentages and calculations',
        level: 3,
        markdown: `For a known flour weight:

- water = flour × hydration ÷ 100
- salt = flour × salt percentage ÷ 100
- yeast = flour × yeast percentage ÷ 100

For a known total dough weight, first add all the percentages. For example, 100% flour + 62% water + 2.8% salt + 0.17% fresh yeast = 164.97% total weight. Flour weight is the target dough weight ÷ 1.6497.

After rounding, the dough weight may differ by a few grams. Calculate using unrounded values, then weigh the total dough to divide it to the final portion weights.`
      },
      {
        id: 'water-handling',
        title: 'Working with water and adding it gradually',
        level: 3,
        markdown: `Tap water that is safe to drink is generally suitable. Hardness and minerals may slightly change the result, but do not change them before you have a repeatable baseline method. Adjust the water proportion gradually. More water does not automatically mean better pizza: it changes stickiness, opening, fermentation, and baking.

**If the dough is too stiff:** check that you measured all the water, that the flour was weighed correctly, and that the dough is not cold and tense. Next time, increase the water by 1–2% of the flour weight.
**If it is excessively sticky:** first give the flour time to absorb the water and check that it is not too warm or overfermented. Do not dust the work surface with unlimited flour; that changes the formula.`
      },
      {
        id: 'water-allocation',
        title: 'Total water in the preferment and ice',
        level: 3,
        markdown: `Include the water in the preferment, the water in a yeast suspension, and the water produced when ice melts in the recipe’s total water. Example: a recipe calls for 400 g total water, and the preferment contains 140 g; no more than 260 g water belongs in the final mix. If you put 30 g of ice into the final mix, it is part of that 260 g, not an additional 30 g.

Ice cools the water and dough; its weight still counts as water. Do not add ice directly to a mixer without checking the manufacturer’s instructions and confirming that it can melt completely and distribute throughout the dough.

Related: [biga](#method-biga), [poolish](#method-poolish), [temperature](#topic-temperature).`
      }
    ]
  },
  {
    id: 'topic-yeast',
    title: 'Yeast',
    description: 'Compare fresh, active dry, and instant yeast, and measure each product appropriately.',
    introduction: '',
    sections: [
      {
        id: 'yeast-types',
        title: 'Yeast forms and activity',
        level: 3,
        markdown: `Yeast is a living microorganism that produces gas and aromatic substances from available sugars. In dough, the dose must be considered in relation to the total flour weight, product type, time, temperature, and method of use.

- **Fresh yeast** comes compressed in a block. Store it in the refrigerator as directed on the label; it crumbles easily but spoils quickly.
- **Active dry yeast** has larger granules; some manufacturers recommend rehydration, while others approve adding it directly. Follow the instructions for that specific product.
- **Instant dry yeast** can usually be mixed directly into the flour, but the label still applies. Products do not all have the same strength or intended use.

Conversion between yeast forms is not a universal constant. For example, a manufacturer may approve substituting one dry yeast form for another, but hydration, activation conditions, and quantity depend on the product. To replace fresh yeast with dry, use the manufacturer’s instructions for the specific product or first run a small comparative test; do not assume that “three times less” is always correct.`
      },
      {
        id: 'yeast-storage',
        title: 'Storage and measuring',
        level: 3,
        markdown: `Keep fresh yeast refrigerated and use it before the date on the package. Keep active dry and instant yeast sealed and dry, as directed on the label; heat and moisture shorten their shelf life. Discard fresh yeast that has changed color, become slimy, or developed an unpleasant smell. Do not estimate the dose by a “pinch”: calculate it based on the total flour weight and the specific schedule.`
      },
      {
        id: 'yeast-suspension',
        title: 'Small quantities and yeast suspension',
        level: 3,
        markdown: `For small doses, a scale that measures to at least 0.1 g is useful. If a more precise amount of fresh yeast is needed, prepare a fresh suspension by weight: crumble 1.0 g fresh yeast into 99.0 g water, mix thoroughly, and immediately weigh the required amount of suspension.

Example: 20.0 g suspension contains 0.2 g fresh yeast and 19.8 g water. Subtract that amount of water from the recipe water. Prepare only the amount needed for immediate use, maintain cleanliness, and do not store diluted yeast for a later batch. This method applies to fresh yeast; prepare dry yeast according to its label.`
      },
      {
        id: 'yeast-substitution',
        title: 'Substituting between yeast types',
        level: 3,
        markdown: `First look for a conversion table or instructions from the manufacturer for the specific product and method. If the manufacturer allows active dry and instant yeast to be substituted one-for-one, apply that only within those instructions; other products may behave differently. Fresh yeast contains more water than dry yeast, so their quantities cannot be substituted gram-for-gram. After substituting, monitor the dough and timing, not just a calculator.

**Limited conversion example:** for traditionally made hand-mixed or stand-mixer dough, Red Star states that its Red Star Active Dry Yeast and Red Star Quick Rise Instant Yeast can be substituted one-for-one. If a recipe calls for **7 g Red Star Active Dry Yeast**, use **7 g Red Star Quick Rise Instant Yeast** for that method. Instant yeast may act faster, so judge readiness from the dough and adjust the duration. If the recipe requires rehydration, follow the package method; instant yeast can be mixed with the dry ingredients in many recipes. This example does not automatically apply to fresh yeast, other brands, or bread machines; Red Star specifies a different dose for bread machines.

For 0.2–1 g yeast, a scale that measures tenths of a gram is needed. Teaspoon measurements are particularly imprecise for a long cold schedule. If the scale does not have that resolution, a fresh suspension by weight can be prepared hygienically and used immediately, accounting for its water.

**Yeast activity:** in the dough, look for gas production, bubbles, aroma, and elasticity, not foam in a cup as the only proof. If the yeast does not act, check the expiration date, storage method, whether the water may have been too hot, and the dough temperature. Do not compensate by blindly adding more yeast.

Related: [fermentation](#topic-fermentation), [temperature](#topic-temperature), [food safety](#topic-storage).`
      }
    ]
  },
  {
    id: 'topic-additions',
    title: 'Salt, oil, sugar, and malt',
    description: 'Learn how salt, oil, sugar, and malt affect dough and when to add them.',
    introduction: '',
    sections: [
      {
        id: 'additions-role',
        title: 'Ingredient roles',
        level: 3,
        markdown: `- **Salt** adds flavor, slows yeast activity depending on concentration, and affects dough strength. A starting range for pizza is approximately 2–3% of the total flour. Distribute salt evenly; do not leave a pile of salt directly on the yeast.
- **Oil** softens the eating quality of the crust, contributes flavor, and can help with pan baking. The traditionally regulated Neapolitan recipe does not add oil to the dough; many home and contemporary recipes do use it.
- **Sugar** is not essential food for yeast in most doughs: flour contains available carbohydrates, which enzymes release. A small amount can speed browning in a home oven, but increases the risk that the surface will brown before the center is baked.
- **Malt** can be diastatic (with active enzymes) or non-diastatic (primarily flavor and color). Active malt is not the same as sugar. Too much active malt can break down starch and produce a sticky, gummy center; do not add it without knowing the product and its instructions.

Calculate all percentages against the total flour, including flour in a preferment. If the recipe for the chosen style does not call for oil or sugar, adding them changes the dough’s character and behavior.`
      },
      {
        id: 'additions-use',
        title: 'When and how to add them',
        level: 3,
        markdown: `Weigh the salt and distribute it evenly. It can be dissolved in some of the water or added after the flour and water have come together. Do not leave concentrated salt directly on the yeast. Add oil after the dough has begun to come together; it is then easier to incorporate evenly. Add sugar only when required by the chosen home recipe or when you want to affect browning, not as an automatic “activator.”`
      },
      {
        id: 'additions-malt',
        title: 'Diastatic and non-diastatic malt',
        level: 3,
        markdown: `Diastatic malt contains active enzymes that break down starch; non-diastatic malt primarily contributes flavor and color. Product labels differ. Follow the manufacturer’s dose and do not substitute one type for the other in the same quantity. Too much active malt can cause a sticky center and excessively rapid browning.

Related: [hydration](#topic-water), [baking](#topic-equipment), [New York](#style-new-york).`
      }
    ]
  },
  {
    id: 'topic-temperature',
    title: 'Temperature',
    description: 'Measure temperatures and estimate water temperature for a target dough temperature.',
    introduction: '',
    sections: [
      {
        id: 'temperature-measurements',
        title: 'What to measure',
        level: 3,
        markdown: `Temperature is one of the most important drivers of repeatability. Record at least the temperature of the flour, room, water, dough immediately after mixing, and refrigerator.

Take measurements at different times and do not treat them as interchangeable:

1. **Target temperature after mixing** describes the dough as soon as mixing is complete.
2. **Temperature at dividing/balling** is recorded after bulk fermentation, immediately before portioning.
3. **Temperature before opening** is measured on the ball or pan dough when the final rest is nearly complete.
4. **Refrigerator temperature** is measured with a separate thermometer near the dough container; do not infer it from the appliance setting.

For wheat pizza dough, a practical starting target immediately after mixing is often approximately 22–25°C, but the recipe, method, flour, and duration change the target. This is not the “ideal temperature for every pizza.”`
      },
      {
        id: 'temperature-water',
        title: 'Calculating water temperature as a starting estimate',
        level: 3,
        markdown: `In a simplified direct-dough model, measured flour, room, and water temperatures and a calibrated mixing factor can be used:

> water temperature ≈ 3 × target dough temperature − flour temperature − room temperature − heat added by mixing

Mixing heat (friction) depends on the mixer, speed, time, dough mass, and hand work. Measure it with your own test batches; do not borrow another appliance’s factor. With a preferment, its temperature must also be included, so a four-factor calculation or practical adjustment is needed.

**Direct-dough water-temperature example:** target after mixing 24°C, flour 22°C, room 23°C, and calibrated mixing factor 2°C:

> water = (3 × 24) − 22 − 23 − 2 = 25°C

This is a starting estimate. Measure the dough after mixing. If, for example, it is 26°C instead of 24°C, record the difference and change the water or method in the next batch; do not automatically add ice to dough that has already been mixed.

The refrigerator is not always exactly 4°C: measure it with a thermometer where the dough is kept. Air temperature and the center of the dough are not the same, especially immediately after putting a warm mass in the refrigerator.`
      },
      {
        id: 'temperature-target',
        title: 'Target temperature after mixing and before shaping',
        level: 3,
        markdown: `Record the dough temperature immediately after mixing is complete. That is the target temperature after mixing. Measure it again before shaping: friction, fermentation, and the environment can raise it, while the refrigerator cools it gradually. Do not use the ball temperature just before baking as a substitute for the post-mixing measurement.

Measure the refrigerator with a thermometer where the dough is kept, preferably after the door has been left closed for a while. The appliance’s set-point is not proof that its interior is exactly that temperature.`
      },
      {
        id: 'temperature-friction',
        title: 'Mixing factor and calibration',
        level: 3,
        markdown: `For direct dough, the following simplified baker’s model applies:

> Water temperature = (3 × target dough temperature) − flour temperature − room temperature − mixing factor.

With a preferment, include its temperature as well:

> Water temperature = (4 × target dough temperature) − flour temperature − room temperature − preferment temperature − mixing factor.

These are equations for **calculating water temperature**, not a physical law or an automatic prediction of the final temperature. The mixing factor is a conventional correction term obtained from a test batch for a specific machine, quantity, speed, and duration. It is not simply “how much the dough warmed up” measured before and after.

Calibration: mix a test batch, record room, flour, and water temperatures (and preferment temperature), and measure the dough immediately after mixing. Use the measured dough temperature as the target and calculate the factor from the same equation. Repeat with the same mass and speeds. If you change the machine, speed, mass, or mixing duration, recalibrate. If the calculated water temperature is below 0°C, use part of the measured water as ice, count it in the total water, and check the dough temperature.

**Mixing-factor calibration example:** in the same Direct test batch, measure flour at 22°C, room at 23°C, water at 25°C, and finished dough at 24°C. Use the measured temperature as the target:

> factor = (3 × 24) − 22 − 23 − 25 = 2°C

This is the calibrated correction term for that mixer, quantity, and method; it is **not** obtained by simply subtracting the starting temperature from the finishing temperature. If you want the same target for the next batch and the other conditions are unchanged, the water-temperature calculation gives 25°C.

**Preferment example:** after a separate test mix, measure flour at 21°C, room at 22°C, preferment at 18°C, water at 24°C, and dough after mixing at 23°C:

> factor = (4 × 23) − 21 − 22 − 18 − 24 = 7°C

For a target of 24°C with the same input temperatures and method:

> water = (4 × 24) − 21 − 22 − 18 − 7 = 28°C

The calculation is an approximation: ingredients do not necessarily have the same thermal mass, and bowl shape, batch size, time, speed, and environment change the result. Check the temperature at the center of the dough immediately after mixing; record it and adjust the next batch.

If the formula gives a water temperature below 0°C, treat that as a sign that the process must change, not an instruction to pour “negative” water. First reduce mixer heating, pre-chill the flour/preferment, or divide the mix. If you still use ice, replace an exactly weighed portion of the total water with it, check that the appliance allows ice and that it can melt completely without damage; the combined ice and liquid water must remain equal to the recipe water. Measure and record the final temperature.

Related: [cold fermentation](#topic-cold-proof), [mixing](#topic-handling), [poolish](#method-poolish).`
      }
    ]
  }
];
