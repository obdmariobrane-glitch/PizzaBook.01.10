import type { ProGuideTopic } from './types';

export const PRO_LEARN_EN_PART2: ProGuideTopic[] = [
  {
    id: 'topic-fermentation',
    title: 'Fermentation and maturation',
    description: 'Distinguish fermentation from maturation and assess readiness using multiple signs.',
    introduction: '',
    sections: [
      {
        id: 'fermentation-process',
        title: 'Fermentation and enzymatic changes',
        level: 3,
        markdown: `**Fermentation** is the metabolic activity of yeast and, in some doughs, bacteria; it produces carbon dioxide and various aromatic compounds. **Dough maturation** includes a broader set of changes, including the enzymatic activity of the flour. These are not synonyms.

Enzymes such as amylases release smaller sugars from starch; yeast can use them, and the sugars contribute to the color of the baked crust. Proteases change proteins and can make dough more extensible over time. These changes depend on the flour, temperature, water, salt, yeast, and duration.

More time is not automatically better: fermentation that is too long or too warm can weaken the structure, make the dough sticky, excessively sour, or weak. Longer fermentation also does not guarantee easier digestion or health benefits. This guide addresses observable baking properties, not health effects.`
      },
      {
        id: 'fermentation-schedules',
        title: 'Short, medium, and long schedules',
        level: 3,
        markdown: `Time is a guide only when the temperature and amount of yeast are known. For a short same-day schedule, plan several hours at room temperature and use the dough’s condition to decide when to divide it. A medium schedule can combine an initial rest with 12–24 h in the refrigerator. A long schedule can take longer, but requires precise weighing, a measured refrigerator temperature, and flour that retains its structure. These are not universal limits: specific examples are in the [recipes](#topic-recipes).`
      },
      {
        id: 'fermentation-readiness',
        title: 'Assessing readiness',
        level: 3,
        markdown: `- **At the beginning:** the mass is dense and shows little gas.
- **During active development:** the surface rounds, bubbles appear around the edges, the mass grows and becomes lighter.
- **At a later stage:** the dough may begin to deflate, become stickier, and lose strength. This may mean fermentation has gone too far; do not wait for the schedule to end just because the timer is still running.

Always compare the temperature and appearance with the recipe timing. Use the gentle finger-press test carefully and only as one sign: gas in the ball can affect how quickly the indentation springs back.`
      }
    ]
  },
  {
    id: 'topic-methods',
    title: 'Preparation methods',
    description: 'Compare Direct, Biga, and Poolish with hand mixing, a planetary mixer, and a spiral mixer.',
    introduction: `**Direct** means all ingredients are mixed into the final dough, without a pre-fermented portion of the flour. It does not mean the dough must be mixed without pauses or cannot be refrigerated.`,
    sections: [
      {
        id: 'method-direct',
        title: 'Direct',
        level: 3,
        markdown: `For all three methods, weigh the total ingredients in advance, set aside the specified amount of water for gradual addition, and measure the flour, room, and water temperatures. Do not add water that is not in the formula. Add yeast according to its label, salt after the flour and water have initially come together, and oil or sugar only if the recipe includes them.

Crumble fresh yeast into the flour or dissolve it in some of the recipe water, as appropriate for the recipe and label. Rehydrate active dry yeast only if the instructions for that specific product require it; use part of the water already weighed and the temperature specified by the manufacturer. Instant yeast is usually mixed into the flour unless its label says otherwise. Water used for rehydration always counts toward the recipe’s total water; do not add it on top of the formula.`
      },
      {
        id: 'direct-hand',
        title: 'Hand mixing',
        level: 3,
        markdown: `1. Prepare a clean bowl, scraper, and work area; lightly wet your hands if the dough is soft. Do not dust it generously with flour.
2. Add the yeast and most of the water using the method appropriate for its type, as described above. Mix with your fingers and squeeze until no dry flour remains.
3. Leave covered for 10–20 minutes if the dough is stiff or tears during handling; this pause is not required for every formula.
4. Add the salt evenly. Add the remaining water in small portions only after the previous portion has been absorbed and the mass has come together again.
5. Fold the edge of the dough toward the center and press it; turn the bowl and repeat squeezing, folding, and resting instead of kneading continuously for a long time. Work in the oil gradually only after the dough has come together.
6. Stop when there are no dry pockets, the mass can be lifted as one piece, and it becomes more elastic after resting. If it tears, cover it for 10–20 minutes; if it warms or spreads, stop, measure the temperature, and assess the hydration.
7. Measure and record the temperature immediately after mixing is complete.

**Stiffer dough:** use your fingers and a scraper, work in short rounds, and allow rests; do not try to stretch it by force. **Softer dough:** use wet hands or a scraper, less additional flour, and more lifting/folding than kneading.`
      },
      {
        id: 'direct-mixer',
        title: 'Planetary or home mixer',
        level: 3,
        markdown: `1. Check the appliance instructions for the permitted attachment, duty cycle, and minimum and maximum dough quantity. These limits depend on the model; the bowl’s nominal capacity is not automatically the recommended dough weight.
2. Add the flour and yeast prepared according to the instructions for its type, then most of the recipe water to the bowl. Use the dough hook or another attachment only as the manufacturer specifies for dough.
3. Bring the ingredients together at the lowest permitted setting. Stop the appliance before scraping the bowl or checking the dough; do not reach into the bowl while the mixer is moving.
4. Add the remaining water gradually once the dough has begun to come together. Add salt after initial hydration, and add oil later only if it is in the formula.
5. Check after short intervals of operation: the dough may remain rough, come together, and then become smoother and more elastic. Continue mixing only if the structure is not yet sufficiently cohesive.
6. If the dough climbs the hook, strikes the bowl, spreads, or heats rapidly, stop the appliance and follow the model’s instructions; reduce the batch or finish by hand only if it is safe.
7. Measure the temperature immediately after mixing. Do not transfer another mixer’s speed, duration, or mixing factor to this one.

Stiff dough can overload a small home mixer; soft dough can wrap around the hook or be picked up less effectively from the bottom. If the quantity or consistency is outside the appliance’s operating range, finish by hand or choose another method.`
      },
      {
        id: 'direct-spiral',
        title: 'Spiral mixer',
        level: 3,
        markdown: `1. Check the user manual for the specific spiral mixer: permitted attachment, operating sequence, guard, minimum/maximum quantity, duty cycle, and shutdown rules. Do not assume every model has the same speeds or rotation directions.
2. Weigh the flour, yeast, and total water; set aside only the water the recipe intends to add gradually or use for rehydration. Load the ingredients in the order required by the appliance and recipe. Prepare the yeast according to its type instructions and product label.
3. Run the permitted initial setting only until the ingredients come together and dry pockets disappear. The dough should gather into a mass worked around the spiral and bowl, but its movement depends on the model, batch size, and hydration.
4. Add the remaining water gradually only after the previous amount is incorporated. Add salt after the initial mixing, and add oil later if the formula includes it. Do not pour in extra water just because the dough briefly clings to the bowl.
5. Check between permitted operating cycles: **cohesive** means there is no dry flour; **developed** means the mass is elastic and holds together; **overheated** means the post-mixing temperature is above target or the mass becomes unusually soft/sticky. Do not wait for overheating to appear as a malfunction.
6. Stop when the structure is sufficient for the recipe. Switch off the appliance before touching, scraping, or sampling the dough. Measure the temperature immediately, and record the mixing factor separately for this mixer, mass, and method.

If the batch is below the minimum and the mixer does not catch the dough, or above the maximum and strains the motor, do not continue hoping it will sort itself out. Follow the manual, change the amount only with the formula recalculated, or finish using another suitable method.

**Signs of sufficient development:** the dough is uniform, elastic, and extensible; a thin area can be carefully stretched before tearing. The “windowpane” test is an aid, not a mandatory ideal for every hydration, flour, or style.

**If the dough is too tight:** cover it and leave it for 10–20 minutes, then try again. **If it is hot:** stop mixing, spread the mass in a container, and briefly chill it if needed. Do not try to correct overheating by adding flour.`
      },
      {
        id: 'method-biga',
        title: 'Biga',
        level: 3,
        markdown: `Biga is a stiffer preferment made from flour, water, and yeast. The flour proportion in a biga is usually expressed as a share of the **total flour**: 40% means 40% of the recipe flour is in the biga, not that the biga is 40% of the total dough weight.

A stiffer biga often uses approximately 40–50% water relative to the flour in that preferment. This is the biga’s hydration, not the final pizza hydration. Different protocols exist: the yeast quantity, temperature, and duration must be coordinated. One documented protocol uses 44–45% water, 1% fresh yeast relative to the biga flour, and 18 hours at 18°C; this is a specific method, not a universal recommendation.`
      },
      {
        id: 'biga-readiness',
        title: 'Preparation and readiness',
        level: 4,
        markdown: `1. Set aside the preferment portion of the total flour; do the same with the water and yeast.
2. Mix briefly until there are no dry pockets. Do not knead into a smooth, fully developed dough if the goal is a crumbly, firm biga.
3. Cover the container so the surface does not dry, while leaving enough room for it to grow.
4. Keep it at the temperature required by the chosen protocol; measure the actual temperature rather than relying only on the room setting.
5. A mature biga is usually slightly puffy, contains small cavities, and has a pleasant fermented aroma. If it is collapsed, wet, strongly alcoholic, or sharply unpleasant, it may have passed its peak.

For a small home batch, hand mixing is usually sufficient: use your fingers or a spatula to moisten the crumbs evenly. Use a planetary or spiral mixer only when the batch is within the manufacturer’s operating range; stop as soon as there are no dry parts. Biga is not developed like final dough, so prolonged mixing unnecessarily warms and smooths it.

Do not equate “mature” with doubled in size: a firm biga does not have to double in volume. Record the temperature and time. If it is over-mature, you may use it only if the aroma and structure remain acceptable, shortening the later schedule; do not mask an unpleasant smell.`
      },
      {
        id: 'biga-final-mix',
        title: 'Final mixing',
        level: 4,
        markdown: `Tear or cut the biga into pieces, add some of the remaining water, and let it soften as you combine it with the remaining flour. Add the rest of the water gradually, then the salt; add oil at the end only if the final formula includes it. The goal is an even dough without dry pieces of biga, not necessarily a “perfectly clean” bowl.

List the total flour and water separately in the recipe table, then show how they are divided between the biga and final mix. Do not count the biga flour and water a second time in the recipe total.

**By hand:** separate the biga into pieces and soften them in some of the remaining water. Add the remaining flour, squeeze and fold until the mass comes together, then rest it if it resists. Add the remaining water gradually, followed by salt and oil. Finish when there are no dry biga pieces and the dough can be lifted as one mass.

**Planetary mixer:** check the permitted quantity and dough hook. Start with most of the water and the biga pieces; once the biga has dispersed, add the remaining flour. Add water in small portions after the dough has picked it up. Add salt after the dough comes together and oil late. Stop the appliance before checking; do not force dough that climbs the hook or strikes the bowl.

**Spiral mixer:** first check the minimum quantity; a small home batch of biga is often unsuitable for a spiral bowl. If the batch is suitable, follow the manual’s sequence, distribute the biga pieces and most of the remaining water so they are picked up evenly, then add water gradually. Add salt and oil according to the recipe only after the dough comes together. Stop when no preferment pieces remain, the dough is developed for the chosen style, and its temperature is near target.`
      },
      {
        id: 'method-poolish',
        title: 'Poolish',
        level: 3,
        markdown: `Poolish is a liquid preferment, most often made with equal weights of water and flour, that is, 100% hydration. The proportion is calculated based on the flour in the poolish. If 35% of the total flour goes into the poolish, the remaining 65% of the flour is added in the final mix.`
      },
      {
        id: 'poolish-readiness',
        title: 'Preparation and readiness',
        level: 4,
        markdown: `1. Weigh the flour for the poolish, an equal weight of water, and a small, deliberately measured amount of yeast into a container.
2. Mix until no dry flour remains; the liquid mixture does not need to be kneaded like final dough.
3. Cover and ferment according to the recipe and temperature.
4. Assess readiness: bubbles are visible across the surface and along the sides, the volume has increased, and the surface is still slightly domed or is just beginning to level. A fully collapsed mixture with a strong alcoholic smell has probably passed its peak.

A bowl and spoon/whisk are sufficient for a typical small poolish; a mixer is unnecessary because the goal is only to combine water, flour, and yeast, not develop a gluten network. If the quantity is large and a mixer is used, it must be within the appliance’s permitted range and stopped as soon as there are no dry pockets. A spiral mixer is especially unsuitable for a small quantity that does not reach the spiral.

Timing depends on the amount of yeast, temperature, and the proportion of poolish. A range of several hours at a cooler room temperature may be practical, but should not be carried over unchanged to a warm kitchen. Instead of changing only the clock time, monitor its condition.

For the final mix, add the poolish and remaining flour. Add water gradually until you reach the **total** amount. Then mix in salt and any oil. The poolish already contains part of the total water, flour, and yeast; list only the remainder for the final mix.

**By hand:** mix the poolish with the remaining flour and most of the final-mix water. When the mixture comes together, add the remaining water little by little, then salt and oil if the recipe includes them. Work briefly by squeezing and folding, rest if the mass resists, and check the temperature.

**Planetary mixer:** check the permitted quantity and attachment. Add the poolish, remaining flour, and most of the final-mix water to the bowl; bring them together at a permitted initial setting. Add the reserved water gradually once the dough has picked up the flour, then add salt and oil at the end. Stop to check, and do not follow a preset number of minutes.

**Spiral mixer:** do not use it if the poolish and final batch do not meet the minimum weight in the manual. For a suitable batch, load the poolish, flour, and most of the water according to the appliance instructions; add the remaining water only once the dough has come together. Add salt and any oil later, watch how the dough gathers around the spiral, and stop once it is developed for the recipe, before its temperature rises above target.`
      }
    ]
  },
  {
    id: 'topic-handling',
    title: 'Mixing and handling dough',
    description: 'Practice resting, folding, bulk fermentation, dividing, and balling.',
    introduction: `Mixing distributes ingredients and develops structure. Mixing longer is not necessarily better: excessive work can heat the dough and damage its structure, while resting between short periods of work often makes development easier.`,
    sections: [
      {
        id: 'handling-rests',
        title: 'Autolyse, pauses, and folds',
        level: 3,
        markdown: `- **Autolyse** is a rest after mixing flour and water, before adding yeast and salt. A starting point can be 20–30 minutes. With low-water dough or some specialty flours, the effect may be small; do not leave it for a long time in a warm place uncovered.
- A **pause/rest** after mixing reduces tension. Cover the dough so a dry skin does not form.

Gluten-free dough does not undergo autolyse or folding in the same way as wheat dough. Follow the instructions for the gluten-free blend.

**Sign that a pause is needed:** the dough tears and shrinks as you stretch it. Cover it for 10–20 minutes. **Sign that more mixing is not needed:** it is smooth, elastic, and beginning to pull away from the bowl; further mixing raises the temperature, but does not necessarily improve quality.`
      },
      {
        id: 'handling-folds',
        title: 'Step-by-step folding',
        level: 3,
        markdown: `Folding is gentle work on the dough during bulk fermentation; it is not the same as kneading or balling.

1. Prepare a clean container and scraper. Wet your hands or coat them with a very thin layer of oil; extra flour can change the recipe and dry the surface.
2. Uncover the dough, loosen the edges from the bowl, and grasp one side broadly from beneath the surface, not just by a thin edge.
3. Lift the side slowly. Stretch it only until the dough lengthens without thinning, tearing, or strong resistance; stop as soon as you feel resistance.
4. Fold the lifted portion over the center of the mass and lay it down gently, without pressing gas out of the entire surface.
5. Turn the bowl about a quarter turn and repeat with another side. Continue around all four sides; this is one complete set of folds.
6. If the mass is still very weak and spreads immediately when set down, cover it for 20–30 min, then assess whether a second set is needed. If it is already taut, smooth, and holds its shape, do not add more folds.
7. Cover the container and continue bulk fermentation according to the recipe.

**Stiffer dough:** wet your hands, loosen the edge with a scraper, and use a shorter motion; do not pull it to its limit. **Softer dough:** take a wider hold and lift only as much as needed to fold; use a wet hand or scraper. If the dough tears, set it down immediately, cover, and rest it. Folding is not required for dough that is already strongly developed and does not apply to a gluten-free mixture.`
      },
      {
        id: 'handling-bulk',
        title: 'Bulk fermentation',
        level: 3,
        markdown: `**Bulk fermentation** is fermentation of the entire mass from the end of mixing until division. **Final proof of the dough balls** begins after dividing and shaping them. For teglia, final proof may take place in the pan, not in balls.`
      },
      {
        id: 'handling-bulk-readiness',
        title: 'Assessing bulk fermentation',
        level: 4,
        markdown: `Put the dough in a covered, preferably transparent, straight-sided container and mark its starting height. One or more gentle folds can help if the mass is weak. Do not wait for a specific percentage of rise at all costs: a clear increase in volume and visible airiness may be enough, and in some cold schedules bulk fermentation remains short.`
      },
      {
        id: 'handling-balling',
        title: 'Dividing and balling',
        level: 3,
        markdown: `1. Prepare a scale, scraper, and covered dough box/containers. Lightly oil them if the dough sticks; leave the work surface unfloured or barely dusted.
2. Weigh the total dough mass. Calculate the number and weight of portions, then separate them with a clean cut using the scraper; do not tear off long pieces.
3. Place one portion rough side up. Gather the edges toward the center in several motions, turning the piece after each motion, until the edges meet.
4. Pinch the seam on the underside closed. Turn the portion so the smooth side is up and the seam is underneath.
5. Cup the ball lightly with both hands. Your palms guide the edges, while your fingers do not squeeze the top; briefly drag the ball across the surface to tighten it. Turn it slightly and repeat with a few short strokes.
6. Stop as soon as the top is smooth and taut and the bottom seam is closed. If the surface starts to tear, stop immediately, cover, and rest for 10–20 min; do not try to increase tension by force.
7. Transfer the ball seam-side down into a container, leave room for expansion, and cover it so a skin does not form.

For softer dough, use a scraper, a little oil on your hands, and less dragging; do not add a handful of flour. For stiffer dough, let it relax covered before tightening and use less force. A ball ready to open has usually risen, is soft and supple, and shows small gas bubbles. If it is firm and springs back, it needs to rest; if it spreads, sticks, and tears when lifted, it may be too warm, too soft, or overfermented.`
      }
    ]
  },
  {
    id: 'topic-cold-proof',
    title: 'Cold fermentation and preparation for baking',
    description: 'Distinguish chilling, tempering, final ball rest, and proofing dough in a pan.',
    introduction: `A refrigerator slows fermentation but does not stop it completely. Dough does not immediately cool to refrigerator temperature: the center of a large mass or sealed container may remain warm for a while. That is why the combination of time, mass, starting temperature, and refrigerator measurements matters.`,
    sections: [
      {
        id: 'cold-stage',
        title: 'Cooling and temperature stages',
        level: 3,
        markdown: `Record separately:

- time from mixing until the dough goes into the refrigerator;
- time in the refrigerator and its measured temperature;
- whether the mass or the balls went into the refrigerator;
- tempering time for the balls after removal;
- final proof time in the pan, if making teglia.

“Tempering” means allowing cold dough to adjust to room temperature for easier handling. It is not the same as final proof: a cold ball can warm up but still be underfermented; a warm ball can be overfermented.`
      },
      {
        id: 'cold-balls',
        title: 'Tempering and final proof of dough balls',
        level: 3,
        markdown: `Start with approximately 1–3 hours at 20–23°C for the balls, but treat this only as an initial plan. A ball ready to shape yields under gentle pressure and stretches without being pulled forcefully. If it immediately shrinks back, give it more rest. If it is very slack and sticky, shape it gently or move on to baking before it weakens further.`
      },
      {
        id: 'cold-pan',
        title: 'Final proof in the pan',
        level: 3,
        markdown: `For teglia and some gluten-free doughs, the dough is pressed into the pan after resting, and final proof continues there. Look for a visibly puffy mass that jiggles slightly when you move the pan but still holds its shape. This is not the same as warming dough from the refrigerator or bulk-fermenting the entire mass.`
      }
    ]
  },
  {
    id: 'topic-styles',
    title: 'Pizza styles',
    description: 'Explore Neapolitan, Romana Tonda, Romana Teglia, and New York styles.',
    introduction: '',
    sections: [
      {
        id: 'style-neapolitan',
        title: 'Neapolitan: traditional and contemporary approaches',
        level: 3,
        markdown: `The name covers multiple practices. The traditional certified protocol is not synonymous with every modern pizza with a puffy rim: its own specification defines ingredients, handling, and baking at very high temperature. Those rules apply to that standard; a home oven cannot automatically produce the same result.`
      },
      {
        id: 'neapolitan-traditional',
        title: 'Traditional framework',
        level: 4,
        markdown: `Traditional dough relies on flour, water, salt, and yeast, with no oil or sugar in the dough itself. The balls are opened by hand so gas is directed toward the rim while the center remains thin. In an oven reaching approximately 430–480°C, the pizza bakes for about 60–90 seconds; that range belongs to this class of equipment and standard, not an ordinary home oven.`
      },
      {
        id: 'neapolitan-home',
        title: 'Contemporary home adaptations',
        level: 4,
        markdown: `At home, you can use a longer cold fermentation, a different water percentage, a small amount of oil or sugar, and bake on steel, stone, or in a home pizza oven. These are deliberate adaptations, not “rules” of the traditional protocol. For a 250 g ball, start around 58–63% water and 2.5–3% salt, and adjust yeast to the schedule. Open from the center toward the rim, then transfer the dough to a peel with minimal additional flour.`
      },
      {
        id: 'neapolitan-mixing',
        title: 'Mixing Neapolitan dough',
        level: 4,
        markdown: `For a small home batch, hand mixing allows short rests and gentle development. A planetary or spiral mixer may be used only if the quantity is within its permitted range; stop once the dough is cohesive and extensible, before unnecessary heating. Do not force a fully developed translucent membrane. See [Direct by hand](#direct-hand), [planetary mixer](#direct-mixer), and [spiral mixer](#direct-spiral).

**Readiness:** the rim is airy and supple, and the center is thin enough to bake without drying out. If the rim is dense, check whether the dough was cold, insufficiently rested, or pressed too hard while shaping.`
      },
      {
        id: 'style-tonda',
        title: 'Romana Tonda',
        level: 3,
        markdown: ''
      },
      {
        id: 'tonda-shaping',
        title: 'Shaping and baking',
        level: 4,
        markdown: `Romana Tonda is a thin, round Roman pizza that is often baked longer and is crispier than softer Neapolitan pizza. Recipes vary; they do not all have the same thickness, hydration, or level of crispness. A rolling pin is often used to open it thinly and evenly.

A starting framework for a home test can be 58–63% water, approximately 2.5–3% salt, and around 2–4% oil, with flour that can handle the chosen schedule. For a very thin, crisp version, start closer to the lower end of the range; a softer home version can use higher hydration. Oil is a common style adaptation, not a universal requirement. The ball should be rested enough to open thinly without shrinking.

1. Dust the ball with flour and open it evenly by hand or with a rolling pin to about 28–30 cm, without thick bubbles.
2. Keep the center uniformly thin; when rolling, check that the edges are not completely compressed.
3. Transfer to a lightly floured peel or pan and add a moderate amount of toppings.
4. In a home oven, bake on well-preheated steel/stone for about 6–10 min at 230–280°C, monitoring the bottom and top.

Tonda can brown underneath before the toppings heat through. Adjust the rack height, sauce quantity, and temperature according to the actual bake. The goal is an evenly thin base and crispness, not necessarily the same result as in a professional oven.`
      },
      {
        id: 'tonda-mixing',
        title: 'Mixing Tonda dough',
        level: 4,
        markdown: `Tonda is often shaped thin, so evenly cohesive, rested dough is easier to roll or open without shrinking. By hand, use short periods of work and rest; with a mixer, stop once the mass is cohesive and sufficiently extensible. For very stiff dough, first check the recipe water and flour; do not try to compensate for dryness by working it longer. Use the [Direct by hand](#direct-hand) method or a suitable [planetary](#direct-mixer)/[spiral](#direct-spiral) mixer only within its limits.`
      },
      {
        id: 'style-teglia',
        title: 'Romana Teglia',
        level: 3,
        markdown: ''
      },
      {
        id: 'teglia-shaping',
        title: 'Shaping and baking in a pan',
        level: 4,
        markdown: `Romana Teglia is baked in an oiled rectangular pan. Unlike the round Tonda ball, the dough is usually kept as one mass and stretched in the pan in one or more stages. Final proof takes place in the pan.

As a starting point, many home recipes use approximately 70–80% water, but this range is not a universal formula: it depends on the flour, pan, thickness, and fermentation method. If this is your first attempt, stay closer to the lower end. Higher hydration requires accurate weighing, a container for folding, and careful transfer.

1. After mixing, leave the mass covered.
2. If it is weak, do one or two gentle folds with a rest between them, until the mass tightens.
3. Ferment as one mass, cold or at room temperature according to the recipe.
4. Oil the pan. Transfer the dough, let it rest, and press it toward the edges with your fingers without tearing it.
5. If it shrinks back, cover it and wait 15–20 minutes before continuing.
6. Let the dough become visibly puffy in the pan, add toppings as planned, and bake.

**Mistake:** shaping balls as for Tonda and then trying to join them together again in the pan. This can create uneven thickness. **Immediate action:** gently even it out, rest it, and continue with one mass.`
      },
      {
        id: 'teglia-mixing',
        title: 'Mixing Teglia dough',
        level: 4,
        markdown: `With softer dough, hold back some of the water for gradual addition and check that the mass absorbs each portion. By hand, use wet hands and pauses; use a planetary or spiral mixer only if the quantity and hydration meet the appliance instructions. After mixing, strengthen the dough as needed with one or two of the described [folds](#handling-folds), rather than mixing it for a long time. An appliance that cannot catch a small mass is not suitable for that batch.`
      },
      {
        id: 'style-new-york',
        title: 'New York',
        level: 3,
        markdown: ''
      },
      {
        id: 'new-york-shaping',
        title: 'Shaping, toppings, and baking',
        level: 4,
        markdown: `New York style usually has a thin, flexible center, a pronounced but not oversized rim, and a bottom that can brown and fold. These are descriptive guidelines, not one official formula. Recipes vary in flour, sugar, oil, water, and fermentation.

As a home starting point, try 60–65% water, 2–2.7% salt, 1–3% oil, and optionally 0–2% sugar. Strong bread flour is often practical, but check the label and the dough’s behavior. Cold fermentation for 24–48 hours is a common schedule, but the yeast quantity must account for refrigerator temperature, room-temperature time, and tempering duration.

Open the dough evenly while retaining a light rim. Do not thin the center so much that toppings break through. A home oven bakes longer than a Neapolitan oven; a thinner crust and moderate quantity of moist toppings reduce the risk of a gummy center.`
      },
      {
        id: 'new-york-mixing',
        title: 'Mixing New York dough',
        level: 4,
        markdown: `Develop an even, extensible structure that can hold a thin center and raised rim; rest the dough if it shrinks back. Work by hand in short rounds or use a home/spiral mixer within the manufacturer’s limits. Add oil after the initial mixing when the formula calls for it. See the [Direct by hand](#direct-hand), [planetary](#direct-mixer), and [spiral](#direct-spiral) methods.`
      }
    ]
  },
  {
    id: 'topic-gluten-free',
    title: 'Gluten-free dough',
    description: 'Prepare gluten-free dough separately and prevent cross-contact.',
    introduction: `A gluten-free blend does not form a wheat gluten network. Water and binding structure are provided by the blend’s composition and any additions such as psyllium or xanthan. Each blend can behave differently; check the label and allergens.`,
    sections: [
      {
        id: 'gf-blend',
        title: 'Blend and binder',
        level: 3,
        markdown: `- If the blend already contains a binder, do not automatically add more psyllium.
- If it contains no binder, do not assume that the same amount of an added binder will work with a different starch/flour.`
      },
      {
        id: 'gf-handling',
        title: 'Mixing and shaping',
        level: 3,
        markdown: `- The mixture is often softer and can be pressed into a pan with wet or oiled fingers; do not try to develop it like a wheat dough ball.
- Resting after mixing allows the starch and binders to hydrate. Folding for gluten strength is not needed.
- Baking in a pan or on parchment can make handling easier.
- A planetary attachment or spiral mixer is not automatically suitable: check the blend instructions and the appliance’s minimum/maximum quantity. If the product instructions call for hand mixing or a paddle, follow them; do not use gluten tests or wheat-dough folding techniques.`
      },
      {
        id: 'gf-bake',
        title: 'Fermentation and baking',
        level: 3,
        markdown: `Watch for rise, bubbles, and the surface structure, but do not expect the same elasticity signs as with wheat dough. Overproofing can weaken the mass and make it harder to transfer. Bake the dough until the center is firm and the bottom is well browned; some recipes benefit from a short par-bake before adding toppings.`
      },
      {
        id: 'gf-safety',
        title: 'Cross-contamination',
        level: 3,
        markdown: `For people with celiac disease or a medical need to avoid gluten, use labeled gluten-free ingredients, clean containers, work surfaces, utensils, and oven, and take care with airborne flour and shared stone/steel. This guide does not guarantee the absence of cross-contamination.`
      }
    ]
  }
];
