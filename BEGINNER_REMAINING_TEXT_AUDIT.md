# PizzaBook Beginner — Remaining Text Audit

**Audit type:** Read-only language and instructional-text audit  
**Date:** 2026-10-10  
**Scope:** Active Beginner recipe, guided-recipe, Planner, notification, style, flour, mixing, fermentation, and phase text in HR, EN, DE, and SL.

No application files were modified. No calculations, quantities, schedules, phase transitions, or application behavior were changed.

## Coverage and method

Inspected:

- [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts)
- [`frontend/src/i18n/prefermentSteps.ts`](/app/frontend/src/i18n/prefermentSteps.ts)
- [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx)
- [`frontend/app/(tabs)/planner.tsx`](/app/frontend/app/(tabs)/planner.tsx)
- [`frontend/src/notifications.ts`](/app/frontend/src/notifications.ts)

The audit covered the active direct, Biga, and Poolish paths; hand and mixer branches; Neapolitan, Romana Tonda, Romana Teglia, and New York Style; supported flour choices; room and refrigerated fermentation; phases A–E where the selected path exposes them; guided recipe copy; Planner copy; and notification copy.

[`frontend/src/i18n/styleSteps.ts`](/app/frontend/src/i18n/styleSteps.ts) was inspected but is not imported by the active Beginner screen. Its Croatian-only strings are therefore not reported as displayed UI text.

The 13 keys corrected in Task 1 were excluded from this audit. No new issue was identified in those keys.

## Findings summary

| ID | Severity | Area | Language(s) | Correction type | Approval needed |
|---|---|---|---|---|---|
| A-01 | High | Active Beginner selector | HR/EN/DE/SL | Missing localization for a visible control label | No; language-only |
| A-02 | Medium | Beginner hand-mix Phase C | All four | Conflicting removal/rest timing wording | Yes; changes instructional meaning |
| A-03 | Medium | Beginner direct Phase D | All four | Hard-coded 32 cm topping quantities in a multi-style branch | Yes; changes instructional meaning |
| A-04 | Medium | Beginner direct hand/mixer Phase A | All four | Generic gluten-development wording is not compatible with gluten-free flour | Yes; branch-specific instructional change |
| A-05 | Low | Croatian guided notification permission | HR | Formal/informal address inconsistency | No; language-only |
| A-06 | Low | German guided notifications | DE | Formal/informal address inconsistency | No; language-only |
| A-07 | Low | Slovenian guided notifications and Phase C | SL | Formal/informal address inconsistency | No; language-only |
| A-08 | Low | Active Planner header | All four | Hard-coded English “Back” visible in every language | No; language-only |

---

## A-01 — Romana subtype selector has hard-coded English-independent labels

**Source:** [`frontend/app/(tabs)/index.tsx`](/app/frontend/app/(tabs)/index.tsx):2445-2466  
**Translation key:** None  
**Affected branch:** Beginner → Romana → subtype selection, all flour types and fermentation paths.

### Original displayed text

The active Beginner UI displays:

- `Tonda`
- `Teglia`

These labels are displayed directly in JSX and do not come from the language object. They are also repeated in the information-row labels. The names are valid Italian style names, so the words themselves do not necessarily need translation, but the current implementation provides no localized wording or explicit terminology convention for the four languages.

### Suggested wording

| Language | Tonda | Teglia |
|---|---|---|
| HR | Romana Tonda | Romana Teglia |
| EN | Romana Tonda | Romana Teglia |
| DE | Romana Tonda | Romana Teglia |
| SL | Romana Tonda | Romana Teglia |

**Classification:** Language-only terminology consistency.  
**Approval needed:** No, provided these are kept as standardized style names. If the product intentionally wants the short Italian names, this can instead be documented as an intentional proper-name exception.

---

## A-02 — Phase C contains materially different removal/rest timing

**Source:** `calc.handMixSteps.C.steps` in [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):253-259, 838-844, 1387-1393, 1933-1939  
**Affected branches:** Direct dough, both hand and mixer display paths; Neapolitan, Romana Tonda, New York Style, and direct Romana Teglia-adjacent flows where this shared copy is rendered.

### Original text

**HR**

> Nakon oblikovanja ostavite loptice 30–60 minuta na sobnoj temperaturi, zatim ih stavite u hladnjak na odabrani broj sati pri 4–6 °C. Izvadite ih 15–20 minuta prije razvlačenja.

**EN**

> Put the balls in the fridge for the selected time at 4–6°C. Take them out 1 hour 15 minutes before baking or when they roughly double in size, but avoid overproofing.

**DE**

> Die Kugeln für die ausgewählte Kühlschrankzeit bei 4–6°C in den Kühlschrank stellen. 1 Stunde 15 Minuten vor dem Backen herausnehmen oder wenn sie sich etwa verdoppeln, aber nicht überfermentieren lassen.

**SL**

> Kepice daj v hladilnik za izbrano časovno obdobje pri 4–6 °C. Vzemi jih 1 uro 15 minut pred peko ali ko se približno podvojijo, a pazite, da ne predignete.

### Issue

HR prescribes an additional 30–60 minute room-temperature period before refrigeration and says to remove the balls 15–20 minutes before stretching. EN, DE, and SL omit the initial room period and prescribe removal 1 hour 15 minutes before baking or at approximately doubled volume. This is not merely a translation difference: it changes the fermentation and tempering instructions shown to users.

### Suggested wording

Because the correct timing must match the verified schedule, the text should first be selected as the canonical instruction and then translated consistently:

| Language | Suggested wording |
|---|---|
| HR | Nakon oblikovanja stavite loptice u hladnjak na odabrani broj sati pri 4–6 °C. Izvadite ih 1 sat i 15 minuta prije pečenja ili kada se približno udvostruče, ali pazite da ne predignu. |
| EN | After shaping, place the dough balls in the refrigerator for the selected time at 4–6°C. Take them out 1 hour 15 minutes before baking or when they roughly double in size, but avoid overproofing. |
| DE | Die Teiglinge nach dem Formen für die ausgewählte Zeit bei 4–6°C in den Kühlschrank stellen. 1 Stunde 15 Minuten vor dem Backen oder bei ungefähr doppeltem Volumen herausnehmen, aber nicht übergären lassen. |
| SL | Po oblikovanju daj kroglice v hladilnik za izbrani čas pri 4–6 °C. Vzemi jih 1 uro in 15 minut pred peko ali ko se približno podvojijo, vendar pazi, da ne pred fermentirajo. |

**Classification:** Instructional meaning.  
**Approval needed:** **Yes.** The canonical timing must be confirmed before any wording is changed.

---

## A-03 — Shared Phase D hard-codes 32 cm topping quantities across styles

**Source:** `calc.handMixSteps.D.steps` and `calc.mixerSteps.D.steps` in [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):275-278, 317-319, 860-863, 902-904, 1409-1412, 1451-1453, 1955-1958, 1997-1999  
**Affected branches:** Direct hand and mixer paths; Neapolitan, Romana Tonda, and New York Style; all flour selections that use these shared steps.

### Original text

**HR hand**

> Nafilujte tijesto (za pizzu od 32 cm ide cca 80–90 g pelata i 100–110 g mocarele).

**EN hand**

> Top the dough (32 cm pizza: ~80–90 g peeled tomatoes and 100–110 g mozzarella).

**DE hand**

> Belegen (32 cm Pizza: ca. 80–90 g Pelati + 100–110 g Mozzarella).

**SL hand**

> Obloži testo (za pizzo 32 cm: ca. 80–90 g pelatov in 100–110 g mocarele).

The mixer branches use the same fixed 32 cm framing but a different quantity pair: approximately 120–130 g mozzarella plus peeled tomatoes.

### Issue

The copy is shared across multiple pizza styles and flour branches, but it gives a fixed 32 cm example and inconsistent topping quantities between hand and mixer modes. It can be read as a required amount rather than an example, and it does not correspond to every selected diameter or style. This is a content/meaning issue rather than a grammar issue.

### Suggested wording

| Language | Suggested wording |
|---|---|
| HR | Nadjenite tijesto prema količinama prikazanima u receptu za odabrani promjer i stil pizze. |
| EN | Add toppings according to the quantities shown in the recipe for the selected pizza style and diameter. |
| DE | Belegen Sie den Teig nach den im Rezept angegebenen Mengen für den gewählten Pizzastil und Durchmesser. |
| SL | Testo obložite po količinah, prikazanih v receptu za izbrani slog in premer pice. |

**Classification:** Instructional meaning and branch accuracy.  
**Approval needed:** **Yes.** Confirm whether examples should be removed or replaced with dynamic recipe values.

---

## A-04 — Shared direct steps are not technically compatible with gluten-free flour

**Source:** `calc.handMixSteps` and `calc.mixerSteps` in [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):234-322, 820-908, 1369-1457, 1918-2004  
**Affected branches:** Direct hand and mixer; gluten-free flour; all styles and room/refrigerated fermentation variants.

### Original text

Representative exact wording is equivalent across all four languages:

**HR**

> Pokrijte tijesto posudom ili folijom i ostavite 15 minuta na radnoj površini da se gluten opusti.

> Prebacite mikser na veću brzinu kako bi se razvio glutenski repozitorij.

**EN**

> Cover dough with a bowl or cling film, rest 15 min on the work surface so gluten relaxes.

> Switch to higher speed to develop gluten.

**DE**

> Teig mit Schüssel oder Folie abdecken, 15 Min. auf der Arbeitsfläche ruhen, damit sich das Gluten entspannt.

> Höhere Geschwindigkeit für Glutenaufbau.

**SL**

> Pokrij testo s posodo ali folijo in pusti 15 minut na delovni površini, da se gluten sprosti.

> Preklopi na višjo hitrost za razvoj glutena.

### Issue

These shared direct instructions are rendered for the gluten-free branch as well. Gluten-free dough does not use traditional gluten development. The active screen has separate gluten-free handling in other copy, but these shared phase steps still instruct gluten relaxation/development and mixer speed escalation. This can contradict the flour-specific method.

### Suggested wording for the gluten-free branch

| Language | Suggested wording |
|---|---|
| HR | Pokrijte smjesu i ostavite je 15 minuta da psyllium upije vlagu. Miješajte samo dok se smjesa ne poveže; ne razvijajte gluten. |
| EN | Cover the mixture and let it rest for 15 minutes so the psyllium can absorb moisture. Mix only until the mixture comes together; do not develop gluten. |
| DE | Die Mischung abdecken und 15 Minuten ruhen lassen, damit das Psyllium Feuchtigkeit aufnimmt. Nur mischen, bis die Masse zusammenkommt; kein Gluten entwickeln. |
| SL | Zmes pokrijte in jo pustite 15 minut, da psilium vpije vlago. Mešajte le, dokler se zmes ne poveže; glutena ne razvijajte. |

For standard wheat flours, the existing gluten-development wording should remain subject to the verified recipe behavior.

**Classification:** Branch-specific instructional meaning.  
**Approval needed:** **Yes.** This requires selecting or wiring flour-specific copy; it must not be handled as a translation-only replacement.

---

## A-05 — Croatian guided notification uses inconsistent address

**Source:** `beginnerCalc.guidedPermissionBody` in [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):79  
**Affected branch:** Beginner guided-recipe notification permission dialog, HR.

### Original text

> PizzaBook vas može obavijestiti kada je vrijeme za sljedeći korak.

Nearby HR Beginner copy uses informal second-person wording: `tvoj`, `odaberi`, `unesi`, and `prati`.

### Suggested wording

| Language | Suggested wording |
|---|---|
| HR | PizzaBook te može obavijestiti kada je vrijeme za sljedeći korak. |
| EN | PizzaBook can notify you when it is time for your next step. |
| DE | PizzaBook kann dich benachrichtigen, wenn der nächste Schritt ansteht. |
| SL | PizzaBook te lahko obvesti, ko bo čas za naslednji korak. |

Only the HR value is affected by this finding; the other three are supplied as the aligned wording.

**Classification:** Language-only.  
**Approval needed:** No.

---

## A-06 — German guided notification copy mixes formal and informal address

**Source:** `beginnerCalc.guidedNotificationCopy` in [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):1225-1243  
**Affected branch:** Beginner guided notifications, DE; all styles and direct/preferment events that use these keys.

### Original text

Informal examples:

> Mische und knete den Teig nach deinem Rezept.

> Decke den Teig ab und stelle ihn wie im Rezept beschrieben kalt.

Formal examples in the same object:

> Führen Sie das erste Stretch & Fold wie im Rezept beschrieben durch.

> Teilen Sie den Teig, formen Sie die Teiglinge und stellen Sie sie wie im Rezept beschrieben in den Kühlschrank.

> Bereiten Sie die glutenfreien Portionen vor und stellen Sie sie nach Plan in den Kühlschrank.

### Suggested wording

Use one register consistently. Recommended informal DE:

| Language | Suggested wording |
|---|---|
| HR | Napravite prvi Stretch & Fold prema receptu. |
| EN | Perform the first Stretch & Fold as described in your recipe. |
| DE | Führe den ersten Stretch & Fold wie im Rezept beschrieben durch. |
| SL | Naredi prvi Stretch & Fold po navodilih recepta. |

Apply the same informal register to the remaining DE notification bodies (`Teile`, `Bereiten Sie`, `Behandeln Sie`, and corresponding forms).

**Classification:** Language-only.  
**Approval needed:** No, unless the product intentionally prefers formal German.

---

## A-07 — Slovenian guided notification copy mixes informal and formal address

**Source:** `beginnerCalc.guidedNotificationCopy` and `calc.handMixSteps.C.steps` in [`frontend/src/i18n/translations.ts`](/app/frontend/src/i18n/translations.ts):1774-1792, 1944, 1986  
**Affected branch:** Beginner guided notifications and direct hand/mixer Phase C, SL.

### Original text

Informal examples:

> Zamesi testo po receptu.

> Pokrito testo postavi v hladilnik po navodilih recepta.

Formal examples:

> Naredite prvi Stretch & Fold po navodilih recepta.

> Kepice ... a pazite, da ne predignete.

### Suggested wording

Recommended informal SL:

| Current phrase | Suggested wording |
|---|---|
| `Naredite prvi Stretch & Fold po navodilih recepta.` | `Naredi prvi Stretch & Fold po navodilih recepta.` |
| `Naredite drugi Stretch & Fold po navodilih recepta.` | `Naredi drugi Stretch & Fold po navodilih recepta.` |
| `a pazite, da ne predignete.` | `vendar pazi, da ne pred fermentirajo.` |

For the last phrase, the preferred wording should be confirmed by a Slovenian reviewer because `predignete` is grammatically mismatched with the informal subject and the intended baking term is “overproof”.

Aligned wording in HR/EN/DE:

| Language | Suggested wording |
|---|---|
| HR | ali pazite da ne predignu |
| EN | but avoid overproofing |
| DE | aber nicht übergären lassen |

**Classification:** Mostly language-only; the exact Slovenian fermentation term should be linguistically reviewed.  
**Approval needed:** No for register; linguistic confirmation recommended for the final Slovenian term.

---

## A-08 — Planner back control is hard-coded in English

**Source:** [`frontend/app/(tabs)/planner.tsx`](/app/frontend/app/(tabs)/planner.tsx):250-252  
**Translation key:** None  
**Affected branch:** Beginner Planner, every language.

### Original text

Visible label:

> Back

Accessibility label:

> Back

### Suggested wording

| Language | Visible label / accessibility label |
|---|---|
| HR | Natrag |
| EN | Back |
| DE | Zurück |
| SL | Nazaj |

**Classification:** Language-only.  
**Approval needed:** No.

---

## Additional observations without a reportable active-text defect

1. Active direct and preferment recipe text has four language objects in `translations.ts` and `prefermentSteps.ts`; no missing active translation value was found in those structures.
2. The active Beginner screen renders `BIGA_STEPS` and `POOLISH_STEPS` from [`prefermentSteps.ts`](/app/frontend/src/i18n/prefermentSteps.ts) using the selected language, so those paths are not Croatian-only.
3. `styleSteps.ts` contains extensive Croatian-only legacy/generated text and a `lang !== 'hr'` null guard, but no active import or call site was found. It should not be treated as displayed Beginner UI without first confirming whether another build surface consumes it.
4. `Tonda`, `Teglia`, `Biga`, `Poolish`, `Stretch & Fold`, `semola`, and `knuckle stretch` are technical or proper style terms. Their consistency should be decided as a terminology policy rather than translated independently in each screen.
5. The audit did not evaluate or recommend changes to formulas, calculated values, ingredient quantities, temperatures, durations, fermentation schedules, timers, or application logic.

## Recommended review order

1. Confirm the canonical Phase C fermentation/removal timing (A-02).
2. Confirm whether Phase D topping quantities are examples or should be dynamic (A-03).
3. Confirm flour-specific handling for gluten-free direct dough (A-04).
4. Apply the language-only register and hard-coded-label corrections (A-01, A-05–A-08).

