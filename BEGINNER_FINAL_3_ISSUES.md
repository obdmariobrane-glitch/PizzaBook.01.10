# PizzaBook Beginner — Final 3 Issues Investigation

**Audit type:** Read-only investigation  
**Date:** 2026-10-10  
**Scope:** Active Beginner recipe display paths for A-02, A-03, and A-04.

No application files, calculations, schedules, or selection logic were modified.

## Executive summary

| Issue | Finding in the active Beginner path | Text-only correction safe now? | Display-logic change required? |
|---|---|---:|---:|
| A-02 — refrigerator removal | The active scheduled Beginner path displays calculated schedule times and dynamic “take out” instructions. The 15–20 minute and 30–60 minute wording belongs to shared/legacy translation steps and is not the active Beginner scheduled Phase C/D copy. | Not needed for the active path | No |
| A-03 — topping quantities | The active Beginner final phase interpolates calculated sauce and mozzarella amounts and the selected diameter. The static 32 cm examples are in shared/legacy translation steps and are not the active Beginner final-phase copy. | No correction needed in the active path | No |
| A-04 — gluten-free mixing | Dedicated gluten-free hand and mixer Phase A branches are selected before the generic wheat branches. They explicitly avoid gluten development and use low-intensity/cohesive-mass wording. | No correction needed in the active path | No |

The remaining concern is verification of the legacy/fallback surfaces outside the active Beginner route. Removing or changing those strings would require confirming their non-Beginner usage first.

## Active Beginner routing

### Beginner method and recipe source

In [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):399-403, Beginner forces:

```ts
const method: Method = isBeginner ? 'direct' : selectedMethod;
```

Therefore:

- Beginner uses the direct-dough path.
- Biga and Poolish are not selectable Beginner methods.
- [`frontend/src/i18n/prefermentSteps.ts`](/app/frontend/src/i18n/prefermentSteps.ts) is used by the Pro Biga/Poolish branches, not the active Beginner path.
- The actual active Beginner direct phases are produced by `getDetailedDirectSteps` or `getDetailedDirectStepsLocalized`, then adapted by the Beginner schedule builders.

At [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):1874-1898:

- Croatian uses `getDetailedDirectSteps`.
- English, German, and Slovenian use `getDetailedDirectStepsLocalized`.
- The result is used for Beginner direct recipes and then passed through `buildBeginnerDirectHomeSteps` or `buildBeginnerUnscheduledDirectSteps`.

### Supported styles and flour branches

The active direct builder explicitly distinguishes:

- Neapolitan
- Romana Tonda
- Romana Teglia
- New York Style
- Tipo 00
- Manitoba
- Spelt
- Whole wheat
- Gluten-free
- Custom blends
- Hand mixing
- Mixer mixing
- Room-only and refrigerated schedules

The branch flags and flour-specific handling are in [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):4105-4142 and 5199-5223.

---

# A-02 — Dough removal from refrigerator

## 1. Exact affected source locations

### Shared translation-object text

The previously identified static text is stored under:

- `calc.handMixSteps.C.steps`
- `calc.handMixSteps.D.steps`
- `calc.mixerSteps.C.steps`
- `calc.mixerSteps.D.steps`

Locations:

- HR: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):253-278
- EN: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):838-863
- DE: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):1387-1412
- SL: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):1933-1958

These values contain the 15–20 minute and 1 hour 15 minute wording identified in the earlier audit.

### Active Beginner display locations

The active Beginner scheduled path instead uses:

- `buildNeapolitanDirectPhaseC` at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):6455 onward
- `buildBeginnerColdPhaseD` at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5886-5960
- `buildBeginnerColdFinalStart` at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5935 onward
- `buildBeginnerDirectHomeSteps` at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):6659-6990
- `buildBeginnerUnscheduledDirectSteps` at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5635-5674

The guided timeline is generated from `directHomeSchedule` at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):1001-1095.

## 2. What actually appears

### Refrigerated Beginner path

The timeline creates a fridge-entry event at the calculated `ballingAt`/`fridgeAt` values and a fridge-out event at:

```ts
getBeginnerFridgeOutAt(schedule)
```

The formula is already existing schedule logic and was not changed in this audit.

The active Phase C / cold-fermentation copy is dynamic:

**HR**

> Ostavite zatvorenu fermentacijsku kutiju s kuglicama u hladnjaku {duration}, do {time}.

**EN**

> Leave the closed fermentation box with the dough balls in the refrigerator for {duration}, until {time}.

**DE**

> Lassen Sie die geschlossene Gärbox mit den Teigkugeln {duration} im Kühlschrank, bis {time}.

**SL**

> Zaprto fermentacijsko posodo s kroglicami pustite v hladilniku {duration}, do {time}.

Source: `buildBeginnerColdPhaseD` in [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5886-5960.

The following final-phase instruction then references the calculated time remaining after fridge removal:

**HR**

> U {time} izvadite fermentacijsku kutiju iz hladnjaka {duration} prije pečenja. Kuglice ostavite pokrivene na sobnoj temperaturi do oblikovanja pizze.

**EN**

> At {time}, take the fermentation box out of the refrigerator {duration} before baking. Keep the dough balls covered at room temperature until shaping.

**DE**

> Nehmen Sie die Gärbox um {time}, {duration} vor dem Backen, aus dem Kühlschrank. Lassen Sie die Teigkugeln bis zum Formen abgedeckt bei Raumtemperatur.

**SL**

> Ob {time} vzemite fermentacijsko posodo iz hladilnika {duration} pred peko. Kroglice pustite pokrite pri sobni temperaturi do oblikovanja.

Source: `buildBeginnerColdFinalStart` in [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5935 onward.

### Room-only Beginner path

When `schedule.fridgeHours === 0`, the active path removes the cold phase and uses room-temperature schedule text:

**HR**

> Držite oblikovane kuglice pokrivene na sobnoj temperaturi do {time} prije pečenja.

**EN**

> Keep the shaped dough balls covered at room temperature until {time} before baking.

**DE**

> Lassen Sie die geformten Teigkugeln bis {time} vor dem Backen abgedeckt bei Raumtemperatur stehen.

**SL**

> Oblikovane kroglice naj ostanejo pokrite pri sobni temperaturi do {time} pred peko.

Source: `buildBeginnerDirectHomeSteps` in [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):6742-6750.

For an unscheduled recipe, the active text deliberately refers the user to the generated schedule rather than inventing a duration:

**HR**

> Ako su kugle bile u hladnjaku, izvadite kugle u vrijeme navedeno u vašem rasporedu i ostavite ih da dosegnu sobnu temperaturu prije oblikovanja.

**EN**

> If the dough balls were refrigerated, take the dough balls out at the time given in your schedule and let them come to room temperature before shaping.

**DE**

> Wenn die Teigkugeln im Kühlschrank waren, nehmen Sie die Teigkugeln zum Zeitpunkt aus Ihrem Zeitplan heraus und lassen Sie sie vor dem Formen Raumtemperatur annehmen.

**SL**

> Če so bile kroglice v hladilniku, kroglice vzemite ven ob času iz vašega načrta in jih pred oblikovanjem pustite, da dosežejo sobno temperaturo.

Source: `buildBeginnerUnscheduledDirectSteps` in [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5635-5674.

## 3. Comparison with the 15–20 minute and 30–60 minute text

The static translation-object values include wording such as:

**HR**

> Nakon oblikovanja ostavite loptice 30–60 minuta na sobnoj temperaturi, zatim ih stavite u hladnjak ... Izvadite ih 15–20 minuta prije razvlačenja.

**EN**

> Put the balls in the fridge for the selected time ... Take them out 1 hour 15 minutes before baking or when they roughly double in size.

The corresponding DE and SL values express the same general 1 hour 15 minute removal instruction, with the earlier HR value additionally mentioning 30–60 minutes before refrigeration.

However, the active Beginner scheduled path does **not** render these shared `t.calc.handMixSteps` / `t.calc.mixerSteps` values when `detailedDirectSteps` is available. It renders schedule-generated text with the actual calculated event time and duration.

## 4. A-02 conclusion

- The 15–20 minute wording is present in shared translation data but is not the active scheduled Beginner Phase C/D instruction.
- The 30–60 minute pre-refrigeration wording is likewise present in shared translation data but is not the active scheduled Beginner Phase C/D instruction.
- The active Beginner path displays the already calculated fridge-entry time, fridge duration, fridge-out time, and final room-tempering duration.
- Room-only paths display the calculated room-only endpoint rather than a fixed 15–20 minute removal value.
- Hand and mixer modes use the same schedule milestones but have separate Phase A mixing copy; the removal/tempering text is schedule-driven.
- Romana Teglia uses its own one-mass path and does not use round dough-ball removal wording.
- Beginner does not expose Biga or Poolish.

**Proposed action:** Do not change the active Beginner text. If the static translation keys are still displayed by a non-Beginner fallback surface, replace them only after that surface is identified. The safest text-only fallback wording would reference the generated schedule, for example:

| Language | Proposed fallback wording |
|---|---|
| HR | Izvadite tijesto iz hladnjaka u vrijeme navedeno u vašem rasporedu i ostavite ga da se temperira prema uputama. |
| EN | Take the dough out of the refrigerator at the time shown in your schedule and let it temper as instructed. |
| DE | Nehmen Sie den Teig zu dem in Ihrem Zeitplan angegebenen Zeitpunkt aus dem Kühlschrank und lassen Sie ihn wie beschrieben temperieren. |
| SL | Testo vzemite iz hladilnika ob času, navedenem v vašem načrtu, in ga pustite temperirati po navodilih. |

**Safe as text-only:** Yes, only for a confirmed fallback surface.  
**Display-logic change required:** No for the active Beginner path.  
**Approval needed:** Confirm whether the shared translation-object path is reachable in any supported Beginner entry state before removing or replacing it.

---

# A-03 — Topping quantities

## 1. Static shared text

The shared translation objects contain fixed examples:

### Hand

**HR**

> Nafilujte tijesto (za pizzu od 32 cm ide cca 80–90 g pelata i 100–110 g mocarele).

**EN**

> Top the dough (32 cm pizza: ~80–90 g peeled tomatoes and 100–110 g mozzarella).

**DE**

> Belegen (32 cm Pizza: ca. 80–90 g Pelati + 100–110 g Mozzarella).

**SL**

> Obloži testo (za pizzo 32 cm: ca. 80–90 g pelatov in 100–110 g mocarele).

### Mixer

The mixer values use a different fixed example:

- HR: approximately 120–130 g mozzarella and pelat for a 32 cm pizza
- EN: approximately 120–130 g mozzarella plus peeled tomatoes
- DE: approximately 120–130 g Mozzarella plus Pelati
- SL: approximately 120–130 g mocarele plus pelati

Locations:

- HR: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):275-278 and 317-319
- EN: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):860-863 and 902-904
- DE: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):1409-1412 and 1451-1453
- SL: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):1955-1958 and 1997-1999

## 2. What the active Beginner UI displays

The active Beginner direct recipe is built by `getDetailedDirectSteps` / `getDetailedDirectStepsLocalized`, not by those shared fixed examples.

The active topping templates are in [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):6748-6805:

**HR**

> Ravnomjerno rasporedite {saucePerPizza} g umaka i {cheesePerPizza} g dobro ocijeđene mozzarelle; ostavite rub bez nadjeva.

**EN**

> Spread {saucePerPizza} g sauce and {cheesePerPizza} g well-drained mozzarella evenly, leaving the rim clear.

**DE**

> Verteilen Sie {saucePerPizza} g Sauce und {cheesePerPizza} g gut abgetropften Mozzarella gleichmäßig; lassen Sie den Rand frei.

**SL**

> Enakomerno razporedite {saucePerPizza} g omake in {cheesePerPizza} g dobro odcejene mocarele; rob pustite prost.

The selected diameter is also displayed dynamically:

**HR**

> Za pizzu od {diameter} cm zadana količina mozzarelle je približno {cheeseAmount} g.

**EN**

> For a {diameter} cm pizza, the default mozzarella amount is approximately {cheeseAmount} g.

**DE**

> Für eine Pizza mit {diameter} cm beträgt die voreingestellte Mozzarella-Menge ungefähr {cheeseAmount} g.

**SL**

> Za pico premera {diameter} cm je privzeta količina mocarele približno {cheeseAmount} g.

The diameter/cheese display is in the active detailed final-phase construction at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5446-5447 and 6805.

## 3. Style and mode coverage

- Neapolitan: active topping copy uses the selected diameter and calculated amounts.
- Romana Tonda: active shaping copy is style-specific and topping copy remains dynamic.
- New York Style: active shaping copy is style-specific; topping copy remains dynamic.
- Romana Teglia: uses the separate one-mass tray path and does not use the round 32 cm hand/mixer example.
- Hand and mixer: active Beginner detailed paths both use dynamic `saucePerPizza` and `cheesePerPizza` values. The static translation examples differ, but those examples are not the active Beginner final-phase copy.
- Flour types and custom blends: topping wording is not replaced by a fixed 32 cm example in the active Beginner path.

## 4. A-03 conclusion

The active Beginner UI already provides text-only dynamic rendering of topping quantities and diameter. No calculation or logic change is required, and changing the shared static examples would not correct the active Beginner path.

**Proposed action:** No active Beginner correction. If the shared `calc.handMixSteps.D` and `calc.mixerSteps.D` values are reachable in another supported screen, replace the examples with a neutral reference:

| Language | Proposed fallback wording |
|---|---|
| HR | Nadjenite pizzu prema količinama prikazanima u receptu za odabrani promjer i stil. |
| EN | Add toppings according to the quantities shown in the recipe for the selected diameter and style. |
| DE | Belegen Sie die Pizza nach den im Rezept angegebenen Mengen für den gewählten Durchmesser und Stil. |
| SL | Pico obložite po količinah, prikazanih v receptu za izbrani premer in slog. |

**Safe as text-only:** Yes for a confirmed fallback surface; unnecessary for active Beginner.  
**Display-logic change required:** No for active Beginner.  
**Approval needed:** Confirm whether the static shared values are intentionally retained for Pro/fallback screens before replacing them.

---

# A-04 — Gluten-free mixing instructions

## 1. Actual active gluten-free hand path

The active branch is selected in `getDetailedDirectSteps` at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5209 onward for:

- Neapolitan or Romana Tonda gluten-free hand mixing
- Romana Teglia gluten-free hand mixing

The displayed HR/EN/DE/SL steps include:

**HR**

> Dodajte bezglutensko brašno i psyllium te miješajte rukom ili lopaticom dok ne nestanu suhi dijelovi.

> Miješajte samo dok se sve sastojke povežu u homogenu, ljepljivu masu.

**EN**

> Add the gluten-free flour and psyllium husks and mix by hand or with a spatula until no dry parts remain.

> Mix only until all ingredients come together into a homogeneous, sticky mass.

**DE**

> Geben Sie das glutenfreie Mehl und die Flohsamenschalen hinzu und mischen Sie von Hand oder mit einem Spatel, bis keine trockenen Stellen mehr vorhanden sind.

> Mischen Sie nur, bis sich alle Zutaten zu einer homogenen, klebrigen Masse verbunden haben.

**SL**

> Dodajte brezglutensko moko in psilium ter mešajte z roko ali lopatico, dokler ne izginejo suhi deli.

> Mešajte samo, dokler se vse sestavine povežejo v homogeno, lepljivo maso.

The branch ends with a short psyllium rest:

**HR**

> Pokrijte tijesto i ostavite ga da odmori 5 minuta, da psyllium upije vodu i tijesto dobije potrebnu čvrstost.

**EN**

> Cover the dough and let it rest for 5 minutes so the psyllium can absorb water and the dough can gain the required firmness.

**DE**

> Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen, damit das Psyllium Wasser aufnehmen kann und der Teig die nötige Festigkeit erhält.

**SL**

> Testo pokrijte in pustite počivati 5 minut, da psilium vpije vodo in testo dobi potrebno čvrstost.

## 2. Actual active gluten-free mixer path

The active mixer branch is selected immediately before the generic wheat branches at [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):5199-5210.

It explicitly displays:

**HR**

> Ulijte svu vodu ... u posudu miksera i u njoj otopite kvasac.

> Dodajte bezglutensko brašno i psyllium te počnite miješati na niskoj brzini dok ne nestanu suhi dijelovi.

> Nastavite miješati na niskoj brzini samo toliko da se sve sastojke povežu u homogenu, ljepljivu masu.

**EN**

> Pour all the water ... into the mixer bowl and dissolve the yeast in it.

> Add the gluten-free flour and psyllium husks and start mixing at low speed until no dry parts remain.

> Continue mixing at low speed only until all ingredients come together into a homogeneous, sticky mass.

**DE**

> Gießen Sie das gesamte Wasser ... in die Mixerschüssel und lösen Sie darin die Hefe auf.

> Geben Sie das glutenfreie Mehl und die Flohsamenschalen hinzu und beginnen Sie, bei niedriger Geschwindigkeit zu mischen, bis keine trockenen Stellen mehr vorhanden sind.

> Mischen Sie bei niedriger Geschwindigkeit weiter, bis sich alle Zutaten zu einer homogenen, klebrigen Masse verbunden haben.

**SL**

> V posodo mešalnika vlijte vso vodo ... in v njej raztopite kvas.

> Dodajte brezglutensko moko in psilium ter začnite mešati pri nizki hitrosti, dokler ne izginejo suhi deli.

> Nadaljujte z mešanjem pri nizki hitrosti samo toliko časa, da se vse sestavine povežejo v homogeno, lepljivo maso.

The mixer branch also ends with the same five-minute psyllium-rest instruction in all four languages.

## 3. Do generic gluten-development instructions appear for gluten-free Beginner?

The shared translation values contain generic wheat wording such as:

**HR**

> Pokrijte tijesto ... da se gluten opusti.

> Prebacite mikser na veću brzinu kako bi se razvio glutenski repozitorij.

**EN**

> Cover dough ... so gluten relaxes.

> Switch to higher speed to develop gluten.

Equivalent wording exists in DE and SL under `calc.handMixSteps` and `calc.mixerSteps`.

Those shared values are at:

- HR: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):232-322
- EN: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):820-908
- DE: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):1369-1457
- SL: [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):1918-2004

They are not the active Beginner gluten-free Phase A display when `detailedDirectSteps` is available. The gluten-free branch is selected first and the active renderer uses the dedicated low-speed/cohesive-mass copy described above.

## 4. Flour and custom-blend scope

- Selecting `glutenFree` activates the dedicated gluten-free branch.
- The active branch explicitly includes psyllium and a 2% psyllium amount in the displayed ingredient/mixing steps.
- A custom blend is not automatically treated as gluten-free. The custom instruction path normalizes its instruction flour to Tipo 00 while separately displaying blend information.
- Therefore, no unsupported assumption about arbitrary custom blends being gluten-free was found in this path.
- Spelt and whole-wheat paths have separate gentle/shorter handling branches and do not use the gluten-free branch.
- Manitoba uses stronger-gluten wording appropriate to that flour branch.

## 5. A-04 conclusion

The earlier concern is not present in the active Beginner display path:

- Gluten-development instructions do not appear in the dedicated gluten-free Phase A branch.
- Separate hand and mixer gluten-free instructions already exist and are used.
- The active mixer path remains low speed and stops at a cohesive, homogeneous, sticky mass.
- The active hand path mixes by hand or spatula only until dry parts disappear and the mass comes together.
- No display-logic change or text-only correction is required.

**Safe as text-only:** No correction is currently needed.  
**Display-logic change required:** No.  
**Approval needed:** None for the active Beginner route. A separate review would be needed only if a different screen is proven to render the shared generic `calc.handMixSteps` values for gluten-free flour.

## Final recommendation

1. Do not modify A-02, A-03, or A-04 in the active Beginner route.
2. Preserve the existing schedule-generated timing and dynamic topping values.
3. If the shared translation-object values are used by another supported screen, audit that caller separately before replacing their static wording.
4. Do not alter calculator formulas, dough quantities, flour classification, fermentation schedules, or phase selection.

