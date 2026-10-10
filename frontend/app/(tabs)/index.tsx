import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Platform, Alert, Image, ImageBackground, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BIGA_STEPS, POOLISH_STEPS,
  PHASE_TIMER_DURATIONS, TIMER_KIND_LABEL, TIMER_NOTIF, BaseTimer,
  formatDuration, formatCountdown,
} from '../../src/i18n/prefermentSteps';
import { useT } from '../../src/i18n/LanguageProvider';
import type { Lang } from '../../src/i18n/translations';
import { scheduleLocal, cancelLocal, cancelGuidedNotificationForStep, cancelGuidedNotificationsForPlan, cancelPlannerNotificationsForMethods, isPushSupported, requestNotificationPermissions, scheduleLocalAt } from '../../src/notifications';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { getCachedExperienceLevel, loadExperienceLevel, subscribeExperienceLevel } from '../../src/experienceLevel';
import {
  getCachedTemperatureUnit, subscribeTemperatureUnit,
  getCachedMeasurementSystem, subscribeMeasurementSystem,
  getCachedPreferredYeastType, subscribePreferredYeastType,
} from '../../src/preferences';
import { displayTemperature, formatLength, formatTemperature, formatUnitText, formatWeight, temperatureInputToCelsius, weightInputToGrams } from '../../src/units';
import {
  dimensionsCalc, doughCalc, getFermentationSchedule, iceCalc, getBakingTimeRange, formatBakingTimeRange,
  Method, OvenType, FlourType, PizzaStyle, HomeFlourStrengthSource, PIZZA_STYLE_PROFILES, FLOUR_PROFILES, BASE_FLOURS, normalizeBeginnerSavedState, beginnerHydrationFor, beginnerBallWeightForDiameter, beginnerDiameterForBallWeight, blendIdealHydration,
  calculateBeginnerPhaseBPlan, createDirectHomePizzaPlan, createBigaHomePizzaPlan, createPoolishHomePizzaPlan, getBeginnerFlourGuidanceKind, getBeginnerPreheatMinutes, getHomeFlourStrengthInput, getHomePlanLegacyFermentationHours,
  BeginnerPhaseBPlan, BeginnerDirectScheduleMode,
  HomePizzaPlanSchedule, BigaHomePizzaSchedule, PoolishHomePizzaSchedule, getBigaHomeScheduleMilestones, getPoolishHomeScheduleMilestones, getSharedHomeBakeAt, subscribeSharedHomeBakeAt,
  setSharedHomeBakeAt, setSharedHomeDirectSchedule, setSharedHomeBigaSchedule, setSharedHomePoolishSchedule,
} from '../../src/calculator';
import { api, useAuth } from '../../src/auth';
import GuidedRecipePanel, { GuidedRecipeSchedule } from '../../src/components/GuidedRecipePanel';
import MixingGuideCarousel, { MixingGuideKind } from '../../src/components/MixingGuideCarousel';
import {
  createGuidedPlanId,
  getGuidedCountdown,
  getGuidedProgress,
  getNighttimeActiveEvents,
  getLocalDayOffset,
  getNextGuidedEvent,
  groupGuidedEventsByLocalDate,
  GuidedScheduleEvent,
  planGuidedNotifications,
} from '../../src/guidedRecipe';

const DIAMETERS = [28, 30, 33, 35];
const CALCULATOR_SETTINGS_KEY = 'calculatorSettings';
const BEGINNER_BAKE_AT_KEY = 'beginnerBakeAt';
const GUIDED_NOTIFICATIONS_ENABLED_KEY = 'beginnerGuidedNotificationsEnabled';
const GUIDED_PROGRESS_STORAGE_PREFIX = 'beginnerGuidedProgress:';
const GUIDED_NIGHT_WARNING_CONFIRMED_PREFIX = 'beginnerNightWarningConfirmed:';
const FREE_PIZZA_STYLE: PizzaStyle = 'neapolitan';
const FREE_FLOUR_TYPES: FlourType[] = ['caputo00', 'manitoba', 'spelt'];
const ALL_FLOUR_TYPES: FlourType[] = ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom'];
const isFlourType = (value: unknown): value is FlourType => ALL_FLOUR_TYPES.includes(value as FlourType);
type RecipeVariant = 'napolitana' | 'romanaTonda' | 'romanaTeglia' | 'newYork';
type BeginnerSection = 'style' | 'flour' | 'quantity' | 'method' | 'oven' | 'bake' | 'plan';
type BeginnerPhaseAFlourBehavior = 'standard' | 'spelt' | 'wholeWheat';
type SavedRecipe = { recipe_id: string; name: string; recipe: any };
type DetailedPhase = {
  title: string;
  steps: string[];
  stepInfo?: Array<{ title: string; body: string } | undefined>;
  timers?: BaseTimer[];
  waterInfo?: string;
  containerOilInfo?: string;
  fermentationInfo?: string;
  fermentationSignsInfo?: string;
  degassingInfo?: string;
  doughHandlingInfo?: string;
  temperingInfo?: string;
  proofingInfo?: string;
  ovenTimingInfo?: string;
  ovenProgramInfo?: string;
  bakingCheckInfo?: string;
  bakingInfo?: string;
  infoTitleOverrides?: Partial<Record<'handling' | 'room' | 'readiness' | 'baking' | 'biga', string>>;
};

function croatianHours(hours: number): string {
  const absoluteHours = Math.abs(hours);
  const lastTwo = absoluteHours % 100;
  const last = absoluteHours % 10;
  const unit = last === 1 && lastTwo !== 11 ? 'sat' : last >= 2 && last <= 4 && (lastTwo < 10 || lastTwo >= 20) ? 'sata' : 'sati';
  return `${hours} ${unit}`;
}

function croatianMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} minuta`;
  if (remainingMinutes === 0) return croatianHours(hours);
  return `${croatianHours(hours)} i ${remainingMinutes} minuta`;
}

function formatBeginnerClockTime(at: Date, lang: Lang): string {
  const locale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(at);
}

function localizeBeginnerScheduleNotice(notice: string, lang: Lang): string | null {
  if (notice.includes('Very short schedule')) {
    return {
      hr: 'Vrlo kratak raspored: puna fermentacija nije zajamčena.',
      en: 'Very short schedule: full fermentation is not guaranteed.',
      de: 'Sehr kurzer Zeitplan: Eine vollständige Fermentation ist nicht garantiert.',
      sl: 'Zelo kratek načrt: popolna fermentacija ni zagotovljena.',
    }[lang];
  }
  if (notice.includes('Stretch & Fold skipped')) {
    return {
      hr: 'Stretch & Fold je preskočen jer je raspored prekratak.',
      en: 'Stretch & Fold is skipped because the schedule is too short.',
      de: 'Stretch & Fold wird übersprungen, weil der Zeitplan zu kurz ist.',
      sl: 'Stretch & Fold je izpuščen, ker je načrt prekratek.',
    }[lang];
  }
  if (notice.includes('Fridge + room requires')) {
    return {
      hr: 'Fermentacija u hladnjaku zahtijeva najmanje 3 sata u hladnjaku i završni odmor na sobnoj temperaturi.',
      en: 'Refrigerated fermentation requires at least 3 hours in the refrigerator and a final room-temperature rest.',
      de: 'Kühlschrankgärung benötigt mindestens 3 Stunden im Kühlschrank und eine abschließende Ruhezeit bei Raumtemperatur.',
      sl: 'Fermentacija v hladilniku zahteva vsaj 3 ure v hladilniku in končni počitek pri sobni temperaturi.',
    }[lang];
  }
  if (notice.includes('Room temperature is outside')) {
    return {
      hr: 'Temperatura prostorije je izvan procijenjenog raspona od 18–26 °C za završni odmor.',
      en: 'Room temperature is outside the provisional 18–26°C range for the final rest.',
      de: 'Die Raumtemperatur liegt außerhalb des vorläufigen Bereichs von 18–26 °C für die abschließende Ruhezeit.',
      sl: 'Sobna temperatura je zunaj predvidenega razpona 18–26 °C za končni počitek.',
    }[lang];
  }
  return null;
}

function buildBeginnerOvenInfo(lang: Lang, oven: OvenType, ovenTemp: number, teglia: boolean): string {
  const minutes = getBeginnerPreheatMinutes(oven);
  const workflow = teglia
    ? {
      hr: 'Za Romanu Tegliu tijesto ostaje jedna masa i priprema se u tepsiji.',
      en: 'For Romana Teglia, keep the dough as one mass and prepare it in the tray.',
      de: 'Bei Romana Teglia bleibt der Teig eine Masse und wird im Blech vorbereitet.',
      sl: 'Pri Romani Teglia testo ostane ena masa in ga pripravite v pekaču.',
    }[lang]
    : {
      hr: 'Za okruglu pizzu tijesto oblikujte na radnoj površini prema receptu.',
      en: 'For a round pizza, shape the dough on the work surface as described in the recipe.',
      de: 'Für eine runde Pizza formen Sie den Teig wie im Rezept auf der Arbeitsfläche.',
      sl: 'Za okroglo pico testo oblikujte na delovni površini po receptu.',
    }[lang];
  return {
    hr: `Potrebno: odabrana pećnica, ciljna temperatura ${ovenTemp} °C i planirano predgrijavanje od ${minutes} minuta.\n\nPostupak: uključite pećnicu u vrijeme prikazano u receptu i postavite ciljnu temperaturu. Pripremite kamen, čelik ili tepsiju prema odabranoj pećnici. ${workflow}\n\nIspravno: pećnica je na ciljnoj temperaturi, a kamen, čelik ili tepsija su zagrijani prije pečenja.\n\nČeste pogreške: uključivanje pećnice prekasno, promjena programa nakon početka zagrijavanja ili stavljanje tijesta na hladnu podlogu. Ako se to dogodi, slijedite prikazano vrijeme predgrijavanja i provjerite da je odabrana podloga spremna prije oblikovanja ili pečenja.`,
    en: `Needed: the selected oven, the target temperature of ${ovenTemp} °C, and the planned ${minutes}-minute preheat.\n\nSteps: turn the oven on at the time shown in the recipe and set the target temperature. Prepare the stone, steel, or tray for the selected oven. ${workflow}\n\nCorrect result: the oven has reached the target temperature and the stone, steel, or tray is heated before baking.\n\nCommon mistakes: turning the oven on late, changing the program after preheating starts, or placing dough on a cold surface. If this happens, follow the displayed preheat time and confirm that the selected surface is ready before shaping or baking.`,
    de: `Benötigt werden: der ausgewählte Ofen, die Zieltemperatur von ${ovenTemp} °C und die geplante Vorheizzeit von ${minutes} Minuten.\n\nVorgehen: Schalten Sie den Ofen zur im Rezept angezeigten Zeit ein und stellen Sie die Zieltemperatur ein. Bereiten Sie Stein, Stahl oder Blech für den ausgewählten Ofen vor. ${workflow}\n\nRichtig ist es, wenn der Ofen die Zieltemperatur erreicht hat und Stein, Stahl oder Blech vor dem Backen aufgeheizt sind.\n\nHäufige Fehler sind zu spätes Einschalten, ein Programmwechsel nach Beginn des Vorheizens oder Teig auf einer kalten Oberfläche. Folgen Sie in diesem Fall der angezeigten Vorheizzeit und prüfen Sie die Oberfläche vor dem Formen oder Backen.`,
    sl: `Potrebujete izbrano pečico, ciljno temperaturo ${ovenTemp} °C in načrtovano ${minutes}-minutno segrevanje.\n\nPostopek: pečico vklopite ob času, prikazanem v receptu, in nastavite ciljno temperaturo. Pripravite kamen, jeklo ali pekač za izbrano pečico. ${workflow}\n\nPravilno je, ko pečica doseže ciljno temperaturo, kamen, jeklo ali pekač pa so pred peko segreti.\n\nPogoste napake so prepozno vklapljanje, menjava programa po začetku segrevanja ali polaganje testa na hladno površino. Če se to zgodi, upoštevajte prikazan čas segrevanja in preverite, ali je podlaga pripravljena, preden testo oblikujete ali pečete.`,
  }[lang];
}

function labelSelectedYeast(text: string, lang: Lang, yeastType: 'fresh' | 'dry'): string {
  const labels = {
    hr: yeastType === 'dry' ? 'suhog kvasca' : 'svježeg kvasca',
    en: yeastType === 'dry' ? 'dry yeast' : 'fresh yeast',
    de: yeastType === 'dry' ? 'Trockenhefe' : 'Frischhefe',
    sl: yeastType === 'dry' ? 'suhega kvasa' : 'svežega kvasa',
  }[lang];
  const patterns = {
    hr: /svježeg kvasca/gi,
    en: /fresh yeast/gi,
    de: /Frischhefe/gi,
    sl: /svežega kvasa/gi,
  }[lang];
  return text.replace(patterns, labels);
}

function getBeginnerPhaseAFlourBehavior(
  flour: FlourType,
  blendA: Exclude<FlourType, 'custom'> = 'caputo00',
  blendB: Exclude<FlourType, 'custom'> = 'wholeWheat',
): BeginnerPhaseAFlourBehavior {
  const components = flour === 'custom' ? [blendA, blendB] : [flour];
  if (components.includes('spelt')) return 'spelt';
  if (components.includes('wholeWheat')) return 'wholeWheat';
  return 'standard';
}

type CalculatorSettings = {
  pizzaStyle: PizzaStyle;
  romanFormat: 'tonda' | 'teglia';
  trayWidth: number;
  trayLength: number;
  flour: FlourType;
  flourStrengthSource?: HomeFlourStrengthSource;
  flourW?: number;
  flourProteinPct?: number;
  blendA: Exclude<FlourType, 'custom'>;
  blendB: Exclude<FlourType, 'custom'>;
  blendPctA: number;
  pizzas: number;
  diameter: number;
  customBallWeight: number | null;
  method: Method;
  bigaPct: number;
  poolishPct: number;
  bigaHours: number;
  poolishHours: number;
  hydration: number;
  saltPct: number;
  oilPct: number;
  roomTemp: number;
  roomHours: number;
  fridgeTemp: number;
  fridgeHours: number;
  useIce: boolean;
  oven: OvenType;
  ovenTemp: number;
  mixing: 'hand' | 'mixer';
};

type FlourEntry = { key: FlourType; label: string; suffix: string; info?: string };

const FLOURS_HR: FlourEntry[] = [
  { key: 'caputo00',   label: 'Tipo 0 / 00',           suffix: 'Idealno 63%', info: 'Klasično meko brašno za neapolitansku pizzu.\n\nPrimjeri: Caputo Pizzeria, Caputo Classica, Molino Dallagiovanna Rinforzato.\n\nW faktor ~ 260–300. Idealna hidracija 65–70%.' },
  { key: 'manitoba',   label: 'Manitoba / Visoki W',   suffix: 'Idealno 65%', info: 'Jače brašno s puno glutena za dugu hladnu fermentaciju i visoku hidraciju.\n\nPrimjeri: Caputo Cuoco, Caputo Oro, Manitoba Le 5 Stagioni.\n\nW faktor 320+. Idealna hidracija 70–80%.' },
  { key: 'spelt',      label: 'Pirovo brašno',         suffix: 'Idealno 63%', info: 'Aromatično brašno stare žitarice. Kraća fermentacija, niža hidracija.\n\nČesto se koristi u mješavini 30–50% s Tipo 00 za punoću okusa.' },
  { key: 'wholeWheat', label: 'Integralno brašno',     suffix: 'Idealno 68%', info: 'Integralno pšenično brašno. Više vlakana, tamnija boja, blago orašast okus.\n\nNajbolje u mješavini 20–40% s Tipo 00.' },
  { key: 'glutenFree', label: 'Bezglutensko brašno',   suffix: 'Idealno 75%', info: 'Poseban bezglutenski miks (npr. Caputo Fioreglut, Schär Mix B). Zahtijeva višu hidraciju i drukčiji zamjes.\n\nBez klasičnog razvoja glutena — pizza se često peče u kalupu.' },
  { key: 'custom',     label: 'Mješavina brašna (Blend)', suffix: 'Prilagođeno', info: 'Kombiniraj dva brašna A i B. Aplikacija automatski računa idealnu hidraciju kao ponderirani prosjek dvaju odabranih brašna.' },
];
const FLOURS_EN: FlourEntry[] = [
  { key: 'caputo00',   label: 'Tipo 0 / 00',       suffix: 'Ideal 63%', info: 'Classic soft wheat flour for Neapolitan pizza.\n\nExamples: Caputo Pizzeria, Caputo Classica, Molino Dallagiovanna Rinforzato.\n\nW factor ~ 260–300. Ideal hydration 65–70%.' },
  { key: 'manitoba',   label: 'Manitoba / High W', suffix: 'Ideal 65%', info: 'Strong flour with high gluten content for long cold fermentation and high hydration.\n\nExamples: Caputo Cuoco, Caputo Oro, Manitoba Le 5 Stagioni.\n\nW factor 320+. Ideal hydration 70–80%.' },
  { key: 'spelt',      label: 'Spelt flour',       suffix: 'Ideal 63%', info: 'Aromatic ancient grain flour. Shorter fermentation, lower hydration.\n\nOften used in 30–50% blend with Tipo 00 for rich flavor.' },
  { key: 'wholeWheat', label: 'Whole wheat flour', suffix: 'Ideal 68%', info: 'Whole wheat flour. Higher fiber, darker color, slightly nutty flavor.\n\nBest in a 20–40% blend with Tipo 00.' },
  { key: 'glutenFree', label: 'Gluten-free flour', suffix: 'Ideal 75%', info: 'Special gluten-free mix (e.g., Caputo Fioreglut, Schär Mix B). Requires higher hydration and different kneading.\n\nNo traditional gluten structure — pizza is often baked in a pan.' },
  { key: 'custom',     label: 'Flour Blend',        suffix: 'Custom',    info: 'Combine two flours A and B. The app automatically calculates the ideal hydration as a weighted average of the two selected flours.' },
];
const FLOURS_DE: FlourEntry[] = [
  { key: 'caputo00',   label: 'Tipo 0 / 00',           suffix: 'Ideal 63%', info: 'Klassisches Weichweizenmehl für neapolitanische Pizza.\n\nBeispiele: Caputo Pizzeria, Caputo Classica, Molino Dallagiovanna Rinforzato.\n\nW-Wert ~ 260–300. Ideale Hydratisierung 65–70%.' },
  { key: 'manitoba',   label: 'Manitoba / Hoher W-Wert', suffix: 'Ideal 65%', info: 'Starkes Mehl mit hohem Glutengehalt für lange kalte Fermentation und hohe Hydratisierung.\n\nBeispiele: Caputo Cuoco, Caputo Oro, Manitoba Le 5 Stagioni.\n\nW-Wert 320+. Ideale Hydratisierung 70–80%.' },
  { key: 'spelt',      label: 'Dinkelmehl',            suffix: 'Ideal 63%', info: 'Aromatisches Urgetreidemehl. Kürzere Fermentation, geringere Hydratisierung.\n\nOft in 30–50% Mischung mit Tipo 00 für vollen Geschmack.' },
  { key: 'wholeWheat', label: 'Vollkornmehl',          suffix: 'Ideal 68%', info: 'Weizenvollkornmehl. Mehr Ballaststoffe, dunklere Farbe, leicht nussiger Geschmack.\n\nAm besten in 20–40% Mischung mit Tipo 00.' },
  { key: 'glutenFree', label: 'Glutenfreies Mehl',     suffix: 'Ideal 75%', info: 'Spezielle glutenfreie Mischung (z.B. Caputo Fioreglut, Schär Mix B). Erfordert höhere Hydratisierung und anderes Kneten.\n\nOhne klassisches Glutennetzwerk – Pizza wird oft in der Form gebacken.' },
  { key: 'custom',     label: 'Mehlmischung (Blend)',  suffix: 'Angepasst', info: 'Kombiniere zwei Mehle A und B. Die App berechnet automatisch die ideale Hydratisierung als gewichteten Durchschnitt der beiden gewählten Mehle.' },
];
const FLOURS_SL: FlourEntry[] = [
  { key: 'caputo00',   label: 'Tipo 0 / 00',           suffix: 'Idealno 63%', info: 'Klasična mehka moka za neapeljsko pico.\n\nPrimeri: Caputo Pizzeria, Caputo Classica, Molino Dallagiovanna Rinforzato.\n\nW faktor ~ 260–300. Idealna hidracija 65–70%.' },
  { key: 'manitoba',   label: 'Manitoba / Visok W',    suffix: 'Idealno 65%', info: 'Močna moka z veliko glutena za dolgo hladno fermentacijo in visoko hidracijo.\n\nPrimeri: Caputo Cuoco, Caputo Oro, Manitoba Le 5 Stagioni.\n\nW faktor 320+. Idealna hidracija 70–80%.' },
  { key: 'spelt',      label: 'Pirova moka',           suffix: 'Idealno 63%', info: 'Aromatična moka iz pradavnih žit. Krajša fermentacija, nižja hidracija.\n\nPogosto uporabljena v mešanici 30–50% s Tipo 00 za bogat okus.' },
  { key: 'wholeWheat', label: 'Polnozrnata moka',      suffix: 'Idealno 68%', info: 'Polnozrnata pšenična moka. Več vlaknin, temnejša barva, rahlo oreškast okus.\n\nNajbolje v mešanici 20–40% s Tipo 00.' },
  { key: 'glutenFree', label: 'Brezglutenska moka',    suffix: 'Idealno 75%', info: 'Posebna brezglutenska mešanica (npr. Caputo Fioreglut, Schär Mix B). Zahteva višjo hidracijo in drugačno gnetenje.\n\nBrez klasičnega gluten mreževja — pica se pogosto peče v pekaču.' },
  { key: 'custom',     label: 'Mešanica moke (Blend)', suffix: 'Prilagojeno', info: 'Kombiniraj dve moki A in B. Aplikacija samodejno izračuna idealno hidracijo kot tehtano povprečje obeh izbranih mok.' },
];
const FLOURS_BY_LANG: Record<'hr' | 'en' | 'de' | 'sl', FlourEntry[]> = {
  hr: FLOURS_HR, en: FLOURS_EN, de: FLOURS_DE, sl: FLOURS_SL,
};

const BEGINNER_FLOUR_NOTE: Record<Lang, string> = {
  hr: 'Referentne informacije o brašnu. U Beginner načinu hidrataciju određuje odabrani stil pizze ({N}%), a ne ovo brašno.',
  en: 'Reference information about the flour. In Beginner mode, hydration is set by the selected pizza style ({N}%), not by this flour.',
  de: 'Referenzinformation zum Mehl. Im Beginner-Modus bestimmt der gewählte Pizzastil die Hydratisierung ({N}%), nicht dieses Mehl.',
  sl: 'Referenčne informacije o moki. V načinu Beginner hidracijo določa izbrani slog pice ({N}%), ne ta moka.',
};
const BEGINNER_BLEND_INFO: Record<Lang, string> = {
  hr: 'Kombiniraj dva brašna A i B. U Beginner načinu hidrataciju određuje odabrani stil pizze ({N}%).',
  en: 'Combine two flours A and B. In Beginner mode, hydration is set by the selected pizza style ({N}%).',
  de: 'Kombiniere zwei Mehle A und B. Im Beginner-Modus bestimmt der gewählte Pizzastil die Hydratisierung ({N}%).',
  sl: 'Kombiniraj dve moki A in B. V načinu Beginner hidracijo določa izbrani slog pice ({N}%).',
};
const ROMANA_FORMAT_INFO: Record<Lang, { tonda: string; teglia: string }> = {
  hr: { tonda: 'Okrugla, tanka i hrskava pizza. Tijesto se oblikuje iz kugle i rasteže ručno prije pečenja.', teglia: 'Pravokutna pizza iz tepsije. Tijesto se utiskuje u nauljenu tepsiju prema unesenim dimenzijama.' },
  en: { tonda: 'Round, thin and crispy pizza. The dough ball is stretched by hand before baking.', teglia: 'Rectangular pizza baked in a tray. The dough is pressed into an oiled tray matching the entered dimensions.' },
  de: { tonda: 'Runde, dünne und knusprige Pizza. Der Teigling wird vor dem Backen von Hand gedehnt.', teglia: 'Rechteckige Pizza aus dem Blech. Der Teig wird in ein geöltes Blech gemäß den eingegebenen Maßen gedrückt.' },
  sl: { tonda: 'Okrogla, tanka in hrustljava pica. Kroglico pred peko ročno razvlecite.', teglia: 'Pravokotna pica iz pekača. Testo vtisnite v naoljen pekač glede na vnesene mere.' },
};
const flourName = (lang: Lang, key: FlourType) => FLOURS_BY_LANG[lang].find((entry) => entry.key === key)?.label ?? FLOUR_PROFILES[key].label;

const FLOUR_IMAGES: Record<FlourType, any> = {
  caputo00: require('../../assets/images/flour-tipo00.png'),
  manitoba: require('../../assets/images/flour-manitoba.png'),
  spelt: require('../../assets/images/flour-spelt.png'),
  wholeWheat: require('../../assets/images/flour-wholewheat.png'),
  glutenFree: require('../../assets/images/flour-glutenfree.png'),
  custom: require('../../assets/images/flour-custom.png'),
};

const METHOD_INFO: Record<Lang, Record<Method, { title: string; body: string }>> = {
  hr: {
    direct: {
      title: 'Direktna metoda (Direct Dough)',
      body: 'Svi sastojci (brašno, voda, kvasac, sol i ulje) zamijese se odjednom u jednom koraku. Najjednostavnija je za početnike i ne zahtijeva pripremu predfermenta dan ranije. Može se raditi brzo na sobnoj temperaturi ili uz sporu fermentaciju u hladnjaku 24–48 sati za bolji okus i probavljivost.',
    },
    biga: {
      title: 'Biga',
      body: 'Biga je tvrdi talijanski predferment s približno 44–50% vode u odnosu na brašno. Dio brašna, vode i kvasca grubo se sjedini dan ranije, a zatim se nakon fermentacije dodaje ostatku sastojaka. Daje bogat okus, lagano i probavljivo tijesto, hrskavost i velike mjehuriće zraka.',
    },
    poolish: {
      title: 'Poolish',
      body: 'Poolish je tekuće predtijesto od jednakih količina brašna i vode (100% hidracija) uz dodatak kvasca. Nakon fermentacije dodaje se preostalo brašno, voda i sol. Rezultat je mekano, elastično tijesto koje se lako razvlači, lijepo zlatno zapečeno i blago orašasto.',
    },
  },
  en: {
    direct: {
      title: 'Direct method (Direct Dough)',
      body: 'All ingredients (flour, water, yeast, salt, and oil) are mixed together in one step. It is the simplest method and does not require preparing a preferment the day before. It can be made quickly at room temperature or fermented slowly in the refrigerator for 24–48 hours for better flavor and digestibility.',
    },
    biga: {
      title: 'Biga',
      body: 'Biga is a firm Italian preferment made with roughly 44–50% water relative to the flour. Part of the flour, water, and yeast is mixed roughly the day before, then combined with the remaining ingredients after fermentation. It creates rich flavor, a light and digestible dough, crispness, and large air bubbles.',
    },
    poolish: {
      title: 'Poolish',
      body: 'Poolish is a liquid preferment made with equal parts flour and water (100% hydration) plus yeast. After fermentation, the remaining flour, water, and salt are added. It creates soft, elastic dough that stretches easily, develops a beautiful golden color, and has a gentle, lightly nutty flavor.',
    },
  },
  de: {
    direct: {
      title: 'Direkte Methode (Direct Dough)',
      body: 'Alle Zutaten (Mehl, Wasser, Hefe, Salz und Öl) werden in einem Schritt miteinander vermischt. Diese Methode ist am einfachsten und benötigt keinen Vorteig am Vortag. Sie kann schnell bei Raumtemperatur oder langsam 24–48 Stunden im Kühlschrank fermentiert werden.',
    },
    biga: {
      title: 'Biga',
      body: 'Biga ist ein fester italienischer Vorteig mit etwa 44–50% Wasser bezogen auf die Mehlmenge. Ein Teil von Mehl, Wasser und Hefe wird am Vortag grob vermischt und später mit den übrigen Zutaten verknetet. Sie sorgt für kräftiges Aroma, einen leichten Teig und große Luftblasen.',
    },
    poolish: {
      title: 'Poolish',
      body: 'Poolish ist ein flüssiger Vorteig aus gleichen Teilen Mehl und Wasser (100% Hydration) mit Hefe. Nach der Fermentation werden das restliche Mehl, Wasser und Salz hinzugefügt. Das Ergebnis ist ein weicher, elastischer Teig mit schöner goldener Farbe und leicht nussigem Geschmack.',
    },
  },
  sl: {
    direct: {
      title: 'Neposredna metoda (Direct Dough)',
      body: 'Vse sestavine (moka, voda, kvas, sol in olje) zmešamo naenkrat v enem koraku. To je najpreprostejša metoda in ne zahteva priprave predtesta dan prej. Testo lahko pripravimo hitro pri sobni temperaturi ali ga 24–48 ur počasi fermentiramo v hladilniku.',
    },
    biga: {
      title: 'Biga',
      body: 'Biga je čvrsto italijansko predtesto s približno 44–50% vode glede na količino moke. Del moke, vode in kvasa dan prej grobo zmešamo, nato pa po fermentaciji dodamo preostale sestavine. Daje bogat okus, lahko in prebavljivo testo ter velike zračne mehurčke.',
    },
    poolish: {
      title: 'Poolish',
      body: 'Poolish je tekoče predtesto iz enakih količin moke in vode (100% hidracija) z dodatkom kvasa. Po fermentaciji dodamo preostalo moko, vodo in sol. Testo je mehko, elastično in ga je lahko raztegniti, pri peki pa dobi lepo zlato barvo in rahlo oreškast okus.',
    },
  },
};

export default function CalculatorHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { focus, stepId } = useLocalSearchParams<{ focus?: string; stepId?: string }>();
  const { t, lang } = useT();
  const sharedBakeAt = useSyncExternalStore(subscribeSharedHomeBakeAt, getSharedHomeBakeAt, getSharedHomeBakeAt);
  const sharedBakeTimestamp = sharedBakeAt?.getTime() ?? null;
  const scheduleCalculationNow = useMemo(() => new Date(), [sharedBakeTimestamp]);
  const { user } = useAuth();
  const experienceLevel = useSyncExternalStore(subscribeExperienceLevel, getCachedExperienceLevel, getCachedExperienceLevel);
  const experienceLoaded = experienceLevel !== undefined;
  const isBeginner = experienceLevel !== 'pro';
  const calculatorScrollRef = useRef<ScrollView>(null);

  const [pizzaStyle, setPizzaStyle] = useState<PizzaStyle>('neapolitan');
  const [selectedRomanFormat, setRomanFormat] = useState<'tonda' | 'teglia'>('tonda');
  const romanFormat = selectedRomanFormat;
  const [trayWidth, setTrayWidth] = useState(30);
  const [trayLength, setTrayLength] = useState(40);
  const [trayWidthInput, setTrayWidthInput] = useState('30');
  const [trayLengthInput, setTrayLengthInput] = useState('40');
  const [flour, setFlour] = useState<FlourType>('caputo00');
  const [flourStrengthSource, setFlourStrengthSource] = useState<HomeFlourStrengthSource>('unknown');
  const [flourStrengthValue, setFlourStrengthValue] = useState('');
  const [blendA, setBlendA] = useState<Exclude<FlourType, 'custom'>>('caputo00');
  const [blendB, setBlendB] = useState<Exclude<FlourType, 'custom'>>('wholeWheat');
  const [blendPctA, setBlendPctA] = useState(70);
  const [pizzas, setPizzas] = useState(4);
  const [diameter, setDiameter] = useState(30);
  const [customDiameter, setCustomDiameter] = useState('');
  const [customBallWeight, setCustomBallWeight] = useState<number | null>(null);
  const [customBallInput, setCustomBallInput] = useState<string>('');
  const [customBallInputSystem, setCustomBallInputSystem] = useState<'metric' | 'us'>('metric');
  const [selectedMethod, setMethod] = useState<Method>('direct');
  const method: Method = isBeginner ? 'direct' : selectedMethod;
  const [bigaPct, setBigaPct] = useState(50);
  const [poolishPct, setPoolishPct] = useState(35);
  const [bigaHours, setBigaHours] = useState(24);
  const [poolishHours, setPoolishHours] = useState(24);
  const [methodExpanded, setMethodExpanded] = useState(false);
  const [hydration, setHydration] = useState(beginnerHydrationFor('neapolitan', 'caputo00'));
  const [saltPct, setSaltPct] = useState(PIZZA_STYLE_PROFILES.neapolitan.saltPct);
  const [oilPct, setOilPct] = useState(PIZZA_STYLE_PROFILES.neapolitan.oilPct);
  const [roomTemp, setRoomTemp] = useState(22);
  const [roomHours, setRoomHours] = useState(2);
  const [fridgeTemp, setFridgeTemp] = useState(4);
  const [fridgeHours, setFridgeHours] = useState(24);
  const [useIce, setUseIce] = useState(false);
  const [oven, setOven] = useState<OvenType>('homeStone');
  const [ovenTemp, setOvenTemp] = useState(300);
  const [ovenTempInput, setOvenTempInput] = useState('300');
  const [ovenTempEditing, setOvenTempEditing] = useState(false);
  const [mixing, setMixing] = useState<'hand' | 'mixer'>('hand');
  const [beginnerScheduleMode, setBeginnerScheduleMode] = useState<BeginnerDirectScheduleMode | undefined>(undefined);
  const [showMixSteps, setShowMixSteps] = useState(false);
  const [moreTool, setMoreTool] = useState<null | 'school' | 'leftover' | 'shopping' | 'savedRecipes'>(null);
  const [editingRecipe, setEditingRecipe] = useState<{ id: string; name: string } | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [guidedCompletedAt, setGuidedCompletedAt] = useState<Record<string, number>>({});
  const [guidedProgressPlanId, setGuidedProgressPlanId] = useState<string | null>(null);
  const [guidedNotificationsEnabled, setGuidedNotificationsEnabled] = useState(false);
  const [guidedNotificationPreferenceLoaded, setGuidedNotificationPreferenceLoaded] = useState(false);
  const [guidedNow, setGuidedNow] = useState(() => Date.now());
  const [nighttimeWarningRequest, setNighttimeWarningRequest] = useState(0);
  const [beginnerIngredientsExpanded, setBeginnerIngredientsExpanded] = useState(true);
  const [beginnerPlanExpanded, setBeginnerPlanExpanded] = useState(true);
  const [mixingGuideKind, setMixingGuideKind] = useState<MixingGuideKind | null>(null);
  const [visualGuideSlide, setVisualGuideSlide] = useState(0);
  const previousGuidedPlanId = useRef<string | null>(null);
  const nighttimeWarningShown = useRef<Set<string>>(new Set());
  const beginnerScheduleModeUserSelected = useRef(false);
  const notificationSyncGeneration = useRef(0);
  const [flourInfo, setFlourInfo] = useState<null | { label: string; info: string }>(null);
  const [styleInfo, setStyleInfo] = useState<PizzaStyle | null>(null);
  const [methodInfo, setMethodInfo] = useState<Method | null>(null);
  const [fermentationInfoOpen, setFermentationInfoOpen] = useState(false);
  const visibleMethodInfo = isBeginner && methodInfo !== 'direct' ? null : methodInfo;
  const beginnerFermentationInfoTitle = ({ hr: 'Koji način fermentacije odabrati?', en: 'Which fermentation method should you choose?', de: 'Welche Fermentationsart wählen?', sl: 'Kateri način fermentacije izbrati?' }[lang]);
  const beginnerFermentationInfoBody = ({
    hr: '❄️ Fermentacija u hladnjaku\n\nFermentacija u hladnjaku odvija se sporije, što omogućuje bolju kontrolu tijesta tijekom duljeg vremena. Tijesto može razviti bogatiji okus i aromu.\n\nKuglice se prije pečenja vade iz hladnjaka kako bi se postupno zagrijale i bile spremne za oblikovanje.\n\n🌡️ Fermentacija na sobnoj temperaturi\n\nTijesto fermentira na sobnoj temperaturi, bez korištenja hladnjaka. Ovaj način posebno je praktičan kada imaš manje vremena do pečenja.\n\nŠto je prostorija toplija, fermentacija je brža. Zato je važno pravilno prilagoditi količinu kvasca i vrijeme fermentacije.\n\n🍕 Što preporučuje PizzaBook?\n\nPizzaBook uzima u obzir vrijeme do pečenja, sobnu temperaturu i temperaturu hladnjaka te izračunava količinu kvasca i raspored fermentacije.\n\nNa temelju tih podataka preporučuje prikladniji način fermentacije. Ako nema dovoljno vremena za hladnjak, dostupna je samo fermentacija na sobnoj temperaturi.\n\nVažno: Izračun je procjena. Stvarna spremnost tijesta ovisi i o temperaturi samog tijesta te njegovu razvoju tijekom fermentacije.',
    en: '❄️ Refrigerator fermentation\n\nRefrigerator fermentation is slower and easier to control over a longer period. The dough may develop richer flavour and aroma.\n\nRemove the dough balls from the refrigerator before baking so they can warm gradually and be ready to shape.\n\n🌡️ Room-temperature fermentation\n\nThe dough ferments at room temperature without refrigeration. This is especially practical when less time remains before baking.\n\nThe warmer the room, the faster fermentation proceeds. Adjust yeast quantity and fermentation time accordingly.\n\n🍕 What does PizzaBook recommend?\n\nPizzaBook considers time until baking, room temperature and refrigerator temperature, then calculates yeast quantity and a fermentation schedule.\n\nIt recommends the more suitable method based on these inputs. If there is not enough time for refrigeration, only room-temperature fermentation is available.\n\nImportant: This calculation is an estimate. Actual dough readiness also depends on dough temperature and its development during fermentation.',
    de: '❄️ Gärung im Kühlschrank\n\nDie Gärung im Kühlschrank verläuft langsamer und lässt sich über längere Zeit besser kontrollieren. Der Teig kann ein komplexeres Aroma entwickeln.\n\nDie Teiglinge werden vor dem Backen aus dem Kühlschrank genommen, damit sie sich langsam erwärmen und formbar werden.\n\n🌡️ Gärung bei Raumtemperatur\n\nDer Teig gärt ohne Kühlschrank bei Raumtemperatur. Diese Methode eignet sich besonders, wenn bis zum Backen weniger Zeit bleibt.\n\nJe wärmer der Raum, desto schneller die Gärung. Hefemenge und Gärzeit sollten deshalb angepasst werden.\n\n🍕 Was empfiehlt PizzaBook?\n\nPizzaBook berücksichtigt die Zeit bis zum Backen sowie Raum- und Kühlschranktemperatur und berechnet Hefemenge und Gärplan.\n\nAuf dieser Grundlage wird die passendere Methode empfohlen. Reicht die Zeit für den Kühlschrank nicht aus, steht nur die Raumtemperaturgärung zur Verfügung.\n\nWichtig: Die Berechnung ist eine Schätzung. Die tatsächliche Reife hängt auch von der Teigtemperatur und seiner Entwicklung ab.',
    sl: '❄️ Fermentacija v hladilniku\n\nFermentacija v hladilniku poteka počasneje, zato je testo dlje časa bolj obvladljivo. Testo lahko razvije bogatejši okus in aromo.\n\nKroglice pred peko vzamemo iz hladilnika, da se postopoma segrejejo in so pripravljene za oblikovanje.\n\n🌡️ Fermentacija pri sobni temperaturi\n\nTesto fermentira pri sobni temperaturi brez hladilnika. Ta način je posebej praktičen, ko je do peke manj časa.\n\nToplejši prostor pospeši fermentacijo, zato je treba prilagoditi količino kvasa in čas fermentacije.\n\n🍕 Kaj priporoča PizzaBook?\n\nPizzaBook upošteva čas do peke ter temperaturo prostora in hladilnika ter izračuna količino kvasa in razpored fermentacije.\n\nNa podlagi teh podatkov priporoči primernejši način. Če za hladilnik ni dovolj časa, je na voljo le fermentacija pri sobni temperaturi.\n\nPomembno: Izračun je ocena. Dejanska pripravljenost testa je odvisna tudi od temperature testa in njegovega razvoja.',
  }[lang]);
  const [styleExpanded, setStyleExpanded] = useState(() => getCachedExperienceLevel() !== 'pro');
  const [flourExpanded, setFlourExpanded] = useState(false);
  const [quantityExpanded, setQuantityExpanded] = useState(false);
  const [activeTimers, setActiveTimers] = useState<Record<string, { endsAt: number; label: string; notifId?: string | null }>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const beginnerSectionY = useRef<Partial<Record<BeginnerSection, number>>>({});
  const beginnerSectionRefs = useRef<Partial<Record<BeginnerSection, View | null>>>({});
  const beginnerScrollOffset = useRef(0);
  const pendingBeginnerScroll = useRef<BeginnerSection | null>(null);
  const lastBeginnerPlanFocus = useRef<string | null>(null);
  const [beginnerLayoutVersion, setBeginnerLayoutVersion] = useState(0);
  const alertedRef = useRef<Set<string>>(new Set());
  // ticker: force re-render each second for countdowns AND check for expired timers
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    AsyncStorage.getItem(BEGINNER_BAKE_AT_KEY).then((value) => {
      if (!value) return;
      const parsed = new Date(value);
      const availableHours = (parsed.getTime() - Date.now()) / 3600000;
      if (Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now()
        && (!isBeginner || availableHours >= 1)) {
        setSharedHomeBakeAt(parsed);
      }
    }).catch((error) => {
      console.error('Unable to restore the scheduled bake time:', error);
    });
  }, [isBeginner]);

  useEffect(() => {
    AsyncStorage.getItem(GUIDED_NOTIFICATIONS_ENABLED_KEY).then((value) => {
      setGuidedNotificationsEnabled(value === 'true');
      setGuidedNotificationPreferenceLoaded(true);
    }).catch((error) => {
      console.error('Unable to restore the guided notification preference:', error);
      setGuidedNotificationPreferenceLoaded(true);
    });
  }, []);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(CALCULATOR_SETTINGS_KEY), loadExperienceLevel()]).then(([value]) => {
      if (value) {
        try {
          const saved = JSON.parse(value) as Partial<CalculatorSettings>;
          const restoreBeginnerStyles = getCachedExperienceLevel() !== 'pro';
          if (saved.pizzaStyle === FREE_PIZZA_STYLE || (restoreBeginnerStyles && (saved.pizzaStyle === 'romana' || saved.pizzaStyle === 'ny_style'))) {
            setPizzaStyle(saved.pizzaStyle);
          }
          if (saved.romanFormat) setRomanFormat(saved.romanFormat);
          if (typeof saved.trayWidth === 'number') {
            setTrayWidth(saved.trayWidth);
            setTrayWidthInput(String(saved.trayWidth));
          }
          if (typeof saved.trayLength === 'number') {
            setTrayLength(saved.trayLength);
            setTrayLengthInput(String(saved.trayLength));
          }
          if (saved.flour && (restoreBeginnerStyles ? isFlourType(saved.flour) : FREE_FLOUR_TYPES.includes(saved.flour))) setFlour(saved.flour);
          if (saved.flourStrengthSource === 'w' || saved.flourStrengthSource === 'protein' || saved.flourStrengthSource === 'unknown') {
            setFlourStrengthSource(saved.flourStrengthSource);
          }
          if (saved.flourStrengthSource === 'w' && typeof saved.flourW === 'number') setFlourStrengthValue(String(saved.flourW));
          if (saved.flourStrengthSource === 'protein' && typeof saved.flourProteinPct === 'number') setFlourStrengthValue(String(saved.flourProteinPct));
          if (saved.blendA) setBlendA(saved.blendA);
          if (saved.blendB) setBlendB(saved.blendB);
          if (typeof saved.blendPctA === 'number') setBlendPctA(saved.blendPctA);
          if (typeof saved.pizzas === 'number') setPizzas(saved.pizzas);
          if (typeof saved.diameter === 'number') {
            setDiameter(restoreBeginnerStyles && (saved.pizzaStyle ?? FREE_PIZZA_STYLE) === 'neapolitan' ? PIZZA_STYLE_PROFILES.neapolitan.defaultDiameter : saved.diameter);
          }
          if (saved.customBallWeight !== undefined) setCustomBallWeight(saved.customBallWeight);
          if (saved.method === 'direct' || saved.method === 'biga' || saved.method === 'poolish') {
            setMethod(saved.flour === 'glutenFree' ? 'direct' : saved.method);
          }
          if (typeof saved.bigaPct === 'number') setBigaPct(saved.bigaPct);
          if (typeof saved.poolishPct === 'number') setPoolishPct(saved.poolishPct);
          if (typeof saved.bigaHours === 'number') setBigaHours(saved.bigaHours);
          if (typeof saved.poolishHours === 'number') setPoolishHours(saved.poolishHours);
          if (typeof saved.hydration === 'number') setHydration(saved.hydration);
          if (typeof saved.saltPct === 'number') setSaltPct(saved.saltPct);
          if (typeof saved.oilPct === 'number') setOilPct(saved.oilPct);
          if (typeof saved.roomTemp === 'number') setRoomTemp(saved.roomTemp);
          if (typeof saved.roomHours === 'number') setRoomHours(saved.roomHours);
          if (typeof saved.fridgeTemp === 'number') setFridgeTemp(saved.fridgeTemp);
          if (typeof saved.fridgeHours === 'number') setFridgeHours(saved.fridgeHours);
          if (typeof saved.useIce === 'boolean') setUseIce(saved.useIce);
          if (saved.oven) setOven(saved.oven);
          if (typeof saved.ovenTemp === 'number') {
            setOvenTemp(saved.ovenTemp);
            setOvenTempInput(String(saved.ovenTemp));
          }
          if (saved.pizzaStyle === 'romana' && saved.romanFormat === 'teglia' && !restoreBeginnerStyles) {
            setOven('homePan');
            setOvenTemp(250);
            setOvenTempInput('250');
          }
          if (saved.mixing === 'hand' || saved.mixing === 'mixer') setMixing(saved.mixing);
          if (restoreBeginnerStyles) applyBeginnerNormalized(saved);
        } catch {}
      }
      setSettingsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!settingsLoaded || !experienceLoaded) return;
    const parsedStrength = Number(flourStrengthValue);
    const strengthIsValid = Number.isFinite(parsedStrength) && parsedStrength > 0;
    const settings: CalculatorSettings = {
      pizzaStyle, romanFormat, trayWidth, trayLength, flour, blendA, blendB, blendPctA, pizzas, diameter,
      flourStrengthSource,
      ...(flourStrengthSource === 'w' && strengthIsValid ? { flourW: parsedStrength } : {}),
      ...(flourStrengthSource === 'protein' && strengthIsValid ? { flourProteinPct: parsedStrength } : {}),
      customBallWeight, method, bigaPct, poolishPct, bigaHours, poolishHours, hydration, saltPct, oilPct,
      roomTemp, roomHours, fridgeTemp, fridgeHours, useIce, oven, ovenTemp, mixing,
    };
    AsyncStorage.setItem(CALCULATOR_SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settingsLoaded, experienceLoaded, pizzaStyle, romanFormat, trayWidth, trayLength, flour, flourStrengthSource, flourStrengthValue, blendA, blendB, blendPctA, pizzas, diameter, customBallWeight, method, bigaPct, poolishPct, bigaHours, poolishHours, hydration, saltPct, oilPct, roomTemp, roomHours, fridgeTemp, fridgeHours, useIce, oven, ovenTemp, mixing]);

  useEffect(() => {
    if (experienceLoaded && isBeginner) void cancelPlannerNotificationsForMethods(['biga', 'poolish']);
  }, [experienceLoaded, isBeginner]);

  useEffect(() => {
    const active = Object.entries(activeTimers);
    if (active.length === 0) return;
    const iv = setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];
      for (const [k, v] of active) {
        if (v.endsAt <= now && !alertedRef.current.has(k)) expired.push(k);
      }
      if (expired.length > 0) {
        const NOTIF = TIMER_NOTIF[lang];
        for (const k of expired) alertedRef.current.add(k);
        setActiveTimers((prev) => {
          const next = { ...prev };
          for (const k of expired) delete next[k];
          AsyncStorage.setItem('activeTimers', JSON.stringify(next)).catch(() => {});
          return next;
        });
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        const firstLabel = activeTimers[expired[0]]?.label ?? '';
        Alert.alert(NOTIF.expiredAlertTitle, NOTIF.expiredAlertBody(firstLabel));
      } else {
        setNow(now);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [activeTimers, lang]);

  // Load persisted checkbox state
  useEffect(() => {
    AsyncStorage.getItem('completedSteps').then((v) => {
      if (v) {
        try { setCompletedSteps(JSON.parse(v) || {}); } catch {}
      }
    });
  }, []);

  const toggleStep = (key: string) => {
    setCompletedSteps((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem('completedSteps', JSON.stringify(next)).catch(() => {});
      return next;
    });
    try { Haptics.selectionAsync(); } catch {}
  };

  const scrollUsingMeasuredSection = useCallback((section: BeginnerSection) => {
    const sectionRef = beginnerSectionRefs.current[section];
    const scrollRef = calculatorScrollRef.current;
    if (!sectionRef || !scrollRef) return false;
    const measurableScroll = scrollRef as unknown as {
      measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
    };
    measurableScroll.measureInWindow((_scrollX, scrollY) => {
      sectionRef.measureInWindow((_sectionX, sectionY) => {
        scrollRef.scrollTo({
          y: Math.max(0, beginnerScrollOffset.current + sectionY - scrollY - 4),
          animated: true,
        });
      });
    });
    return true;
  }, []);

  const scrollToBeginnerSection = useCallback((section: BeginnerSection) => {
    if (!isBeginner) return;
    pendingBeginnerScroll.current = section;
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (pendingBeginnerScroll.current !== section) return;
      const y = beginnerSectionY.current[section];
      if (y === undefined) return;
      pendingBeginnerScroll.current = null;
      if (!scrollUsingMeasuredSection(section)) calculatorScrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
    }))))));
  }, [isBeginner, scrollUsingMeasuredSection]);

  const recordBeginnerSection = (section: BeginnerSection, y: number) => {
    if (beginnerSectionY.current[section] === y) return;
    beginnerSectionY.current[section] = y;
    setBeginnerLayoutVersion((version) => version + 1);
  };

  useEffect(() => {
    const section = pendingBeginnerScroll.current;
    const y = section ? beginnerSectionY.current[section] : undefined;
    if (!section || y === undefined) return;
    pendingBeginnerScroll.current = null;
    requestAnimationFrame(() => {
      if (!scrollUsingMeasuredSection(section)) calculatorScrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
    });
  }, [beginnerLayoutVersion, scrollUsingMeasuredSection]);

  const transitionBeginnerTo = (section: BeginnerSection) => {
    if (!isBeginner) return;
    setStyleExpanded(section === 'style');
    setFlourExpanded(section === 'flour');
    setQuantityExpanded(section === 'quantity');
    setMethodExpanded(section === 'method');
    scrollToBeginnerSection(section);
  };

  const toggleBeginnerSection = (section: BeginnerSection) => {
    if (!isBeginner) return;
    const isOpen = section === 'style'
      ? styleExpanded
      : section === 'flour'
        ? flourExpanded
        : section === 'quantity'
          ? quantityExpanded
          : section === 'method'
            ? methodExpanded
            : false;
    if (isOpen) {
      if (section === 'style') setStyleExpanded(false);
      if (section === 'flour') setFlourExpanded(false);
      if (section === 'quantity') setQuantityExpanded(false);
      if (section === 'method') setMethodExpanded(false);
    } else {
      transitionBeginnerTo(section);
    }
  };

  const resetStepsForCurrent = () => {
    const prefixes = [`${method}-${mixing}-`, `style-${pizzaStyle}-${method}-${mixing}-`];
    setCompletedSteps((prev) => {
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) {
        if (!prefixes.some((prefix) => k.startsWith(prefix))) next[k] = prev[k];
      }
      AsyncStorage.setItem('completedSteps', JSON.stringify(next)).catch(() => {});
      return next;
    });
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
  };

  // Load persisted active timers
  useEffect(() => {
    AsyncStorage.getItem('activeTimers').then((v) => {
      if (!v) return;
      try {
        const parsed = JSON.parse(v) as Record<string, { endsAt: number; label: string; notifId?: string | null }>;
        // drop already-expired timers
        const now = Date.now();
        const fresh: typeof parsed = {};
        const removedNotificationIds: string[] = [];
        for (const [k, val] of Object.entries(parsed)) {
          if (val && val.endsAt > now && !(isBeginner && /^(biga|poolish)[-_]/i.test(k))) {
            fresh[k] = val;
          } else if (isBeginner && /^(biga|poolish)[-_]/i.test(k) && val?.notifId) {
            removedNotificationIds.push(val.notifId);
          }
        }
        setActiveTimers(fresh);
        removedNotificationIds.forEach((id) => { void cancelLocal(id); });
        AsyncStorage.setItem('activeTimers', JSON.stringify(fresh)).catch(() => {});
      } catch {}
    });
  }, [isBeginner]);

  const startTimer = async (phaseKey: string, t: BaseTimer) => {
    const key = `${phaseKey}-${t.id}`;
    if (activeTimers[key]) return; // already running
    const label = `${TIMER_KIND_LABEL[lang][t.kind]} · ${formatDuration(t.seconds, lang)}`;
    const NOTIF = TIMER_NOTIF[lang];
    let notifId: string | null = null;
    try {
      if (isPushSupported()) {
        notifId = await scheduleLocal(NOTIF.title, NOTIF.body(label), t.seconds);
      }
    } catch {}
    const endsAt = Date.now() + t.seconds * 1000;
    setActiveTimers((prev) => {
      const next = { ...prev, [key]: { endsAt, label, notifId } };
      AsyncStorage.setItem('activeTimers', JSON.stringify(next)).catch(() => {});
      return next;
    });
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  };

  const stopTimer = async (phaseKey: string, timerId: string) => {
    const key = `${phaseKey}-${timerId}`;
    const t = activeTimers[key];
    if (t?.notifId) { try { await cancelLocal(t.notifId); } catch {} }
    setActiveTimers((prev) => {
      const next = { ...prev };
      delete next[key];
      AsyncStorage.setItem('activeTimers', JSON.stringify(next)).catch(() => {});
      return next;
    });
    try { Haptics.selectionAsync(); } catch {}
  };

  const flourProfile = FLOUR_PROFILES[flour];
  const temperatureUnit = useSyncExternalStore(subscribeTemperatureUnit, getCachedTemperatureUnit, getCachedTemperatureUnit) ?? 'celsius';
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';
  const preferredYeastType = useSyncExternalStore(subscribePreferredYeastType, getCachedPreferredYeastType, getCachedPreferredYeastType) ?? 'fresh';
  // Default to the simpler, safe beginner presentation until a Pro choice is explicitly loaded.
  // Beginner-safe classification: only flag 'specific' once verified W/protein metadata actually exists for this flour.
  const flourStrengthCategory: 'specific' | 'generic' | 'custom' = flour === 'custom'
    ? 'custom'
    : flourProfile.strength
      ? 'specific'
      : 'generic';
  const parsedFlourStrength = Number(flourStrengthValue);
  const explicitFlourStrength = useMemo(() => (
    isBeginner || flourStrengthSource === 'unknown'
      ? { source: 'unknown' as const }
      : flourStrengthSource === 'w'
        ? { source: 'w' as const, w: parsedFlourStrength }
        : { source: 'protein' as const, proteinPct: parsedFlourStrength }
  ), [isBeginner, flourStrengthSource, parsedFlourStrength]);
  const styleProfile = PIZZA_STYLE_PROFILES[pizzaStyle];
  const isRomanTeglia = pizzaStyle === 'romana' && romanFormat === 'teglia';
  const selectedPizzaStyleName = pizzaStyle === 'romana'
    ? romanFormat === 'teglia' ? 'Romana Teglia' : 'Romana Tonda'
    : t.calc.pizzaStyles[pizzaStyle].name;
  const trayDoughWeight = Math.round(trayWidth * trayLength * 0.4);
  const isIdealSalt = saltPct === styleProfile.saltPct;
  const isIdealOil = oilPct === styleProfile.oilPct;
  const styleImages: Record<PizzaStyle, any> = {
    neapolitan: require('../../assets/images/pizza-neapolitan.png'),
    romana: require('../../assets/images/pizza-romana.png'),
    ny_style: require('../../assets/images/pizza-new-york.png'),
  };
  const isCustom = flour === 'custom';
  const isPremiumUnlocked = false;
  const customIdeal = useMemo(() => blendIdealHydration(blendA, blendB, blendPctA), [blendA, blendB, blendPctA]);
  const idealHydration = isBeginner ? beginnerHydrationFor(pizzaStyle, flour) : flourProfile.ideal;
  const isIdealHydration = hydration === idealHydration;
  const inRange = isCustom
    ? Math.abs(hydration - customIdeal) <= 3
    : (hydration >= flourProfile.min && hydration <= flourProfile.max);

  // Auto-adjust hydration when custom blend changes
  const changeFlour = (f: FlourType) => {
    if (!isPremiumUnlocked && !isBeginner && !FREE_FLOUR_TYPES.includes(f)) {
      Alert.alert('Pizzabook Premium', 'Ova opcija je zaključana. Otključaj Premium jednokratnom kupovinom.');
      return;
    }
    setFlour(f);
    if (f === 'glutenFree') setMethod('direct');
    if (isBeginner) {
      const previousIdeal = beginnerHydrationFor(pizzaStyle, flour);
      if (hydration === previousIdeal) setHydration(beginnerHydrationFor(pizzaStyle, f));
    } else if (f === 'custom') {
      setHydration(blendIdealHydration(blendA, blendB, blendPctA));
    } else {
      setHydration(FLOUR_PROFILES[f].ideal);
    }
    try { Haptics.selectionAsync(); } catch {}
  };

  const changeStyle = (nextStyle: PizzaStyle) => {
    if (!isPremiumUnlocked && !isBeginner && nextStyle !== FREE_PIZZA_STYLE) {
      Alert.alert('Pizzabook Premium', 'Ovaj stil pizze je zaključan. Otključaj Premium jednokratnom kupovinom.');
      return;
    }
    const next = PIZZA_STYLE_PROFILES[nextStyle];
    setPizzaStyle(nextStyle);
    if (isBeginner && nextStyle === 'romana') setRomanFormat('tonda');
    if (isBeginner && nextStyle === 'ny_style') setDiameter(next.defaultDiameter);
    if (isBeginner && nextStyle === 'romana') setDiameter(next.defaultDiameter);
    if (isBeginner && nextStyle === 'neapolitan') {
      setDiameter(next.defaultDiameter);
      setRomanFormat('tonda');
      setTrayWidth(30);
      setTrayLength(40);
      setTrayWidthInput('30');
      setTrayLengthInput('40');
    }
    setHydration(isBeginner ? beginnerHydrationFor(nextStyle, flour) : next.hydration);
    setSaltPct(next.saltPct);
    setOilPct(next.oilPct);
    setOven(nextStyle === 'neapolitan' ? 'ooni' : 'homeStone');
    if (isBeginner) {
      const styleOvenTemp = nextStyle === 'neapolitan' ? 450 : 300;
      setOvenTemp(styleOvenTemp);
      setOvenTempInput(String(styleOvenTemp));
      setOvenTempEditing(false);
    }
    if (nextStyle === 'romana' && !isBeginner && romanFormat === 'teglia') {
      setOven('homePan');
      setOvenTemp(250);
      setOvenTempInput('250');
    }
    setCustomBallWeight(null);
    setCustomBallInput('');
    if (isBeginner) {
      if (nextStyle === 'romana') transitionBeginnerTo('style');
      else transitionBeginnerTo('flour');
    } else {
      setStyleExpanded(false);
    }
    try { Haptics.selectionAsync(); } catch {}
  };

  const selectOven = (nextOven: OvenType, temperature: number) => {
    setOven(nextOven);
    setOvenTemp(temperature);
    setOvenTempEditing(false);
    if (isBeginner) scrollToBeginnerSection('plan');
  };

  const commitOvenTemperature = () => {
    const parsed = Number(ovenTempInput.replace(',', '.'));
    const celsius = temperatureInputToCelsius(parsed, temperatureUnit);
    if (Number.isFinite(celsius) && celsius >= 200 && celsius <= 500) {
      const temperature = Math.round(celsius);
      setOvenTemp(temperature);
    }
    setOvenTempEditing(false);
    setOvenTempInput('');
  };

  const resetStyleDefaults = () => {
    const profile = PIZZA_STYLE_PROFILES[pizzaStyle];
    setHydration(isBeginner ? beginnerHydrationFor(pizzaStyle, flour) : profile.hydration);
    setSaltPct(profile.saltPct);
    setOilPct(profile.oilPct);
    setDiameter(profile.defaultDiameter);
    setCustomBallWeight(null);
    setCustomBallInput('');
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  };

  useEffect(() => {
    if (!isBeginner) return;
    if (blendA === 'glutenFree') setBlendA('caputo00');
    if (blendB === 'glutenFree') setBlendB('wholeWheat');
  }, [isBeginner, blendA, blendB]);

  const changeBlend = (which: 'a' | 'b' | 'pct', value: any) => {
    let a = blendA, b = blendB, p = blendPctA;
    if (which === 'a') { a = value; setBlendA(value); }
    if (which === 'b') { b = value; setBlendB(value); }
    if (which === 'pct') { p = value; setBlendPctA(value); }
    if (flour === 'custom' && !isBeginner) setHydration(blendIdealHydration(a, b, p));
    try { Haptics.selectionAsync(); } catch {}
  };

  // Reactive calculations - RE-COMPUTE on any input change
  const dims = useMemo(() => dimensionsCalc(diameter, pizzas), [diameter, pizzas]);
  const effectiveBall = isRomanTeglia
    ? customBallWeight ?? trayDoughWeight
    : isBeginner
      ? customBallWeight ?? beginnerBallWeightForDiameter(pizzaStyle, diameter)
      : customBallWeight ?? (diameter === styleProfile.defaultDiameter ? styleProfile.ballWeight : dims.doughBall);
  const prefermentHours = method === 'biga' ? bigaHours : method === 'poolish' ? poolishHours : 0;
  const fermentationSchedule = useMemo(() => getFermentationSchedule({
    method, prefermentHours, roomHours, roomTemp, fridgeHours, fridgeTemp,
  }), [method, prefermentHours, roomHours, roomTemp, fridgeHours, fridgeTemp]);
  const homePlan = useMemo(() => {
    if (method !== 'direct' || sharedBakeAt === null) return null;
    return createDirectHomePizzaPlan({
      style: pizzaStyle,
      pizzas,
      ballWeight: effectiveBall,
      method,
      romanFormat: isBeginner && isRomanTeglia ? romanFormat : undefined,
      ovenTemp,
      bakeAt: sharedBakeAt,
      roomTemp,
      fridgeTemp,
      ovenType: oven,
      flourType: flour,
      mixing: mixing === 'hand' ? 'hand' : 'home',
      beginnerScheduleMode,
    }, getHomeFlourStrengthInput(flour, explicitFlourStrength), hydration, preferredYeastType, scheduleCalculationNow, isBeginner);
  }, [isBeginner, method, sharedBakeAt, pizzaStyle, romanFormat, isRomanTeglia, pizzas, effectiveBall, roomTemp, fridgeTemp, oven, ovenTemp, flour, mixing, beginnerScheduleMode, explicitFlourStrength, hydration, preferredYeastType, scheduleCalculationNow]);
  const directHomeSchedule = method === 'direct' ? homePlan?.schedule ?? null : null;
  const beginnerCandidateEvaluations = isBeginner && method === 'direct' && (mixing === 'hand' || mixing === 'mixer')
    ? (homePlan?.candidateEvaluations ?? [])
    : [];
  const beginnerSelectableModes = beginnerCandidateEvaluations.filter((evaluation) => evaluation.selectable);
  const selectedBeginnerEvaluation = beginnerCandidateEvaluations.find((evaluation) =>
    (evaluation.candidate as unknown as { mode?: BeginnerDirectScheduleMode }).mode === beginnerScheduleMode,
  ) ?? homePlan?.selectedEvaluation;
  const beginnerFlourGuidanceKind = isBeginner && method === 'direct'
    ? getBeginnerFlourGuidanceKind(selectedBeginnerEvaluation, flour === 'glutenFree')
    : 'none';
  const beginnerFlourGuidance = ({
    hr: {
      glutenFree: 'Bezglutensko brašno ne procjenjuje se W-faktorom. Za njega vrijedi poseban postupak bez razvoja glutena.',
      unknown: 'Snaga odabranog brašna nije poznata. Procjena ne može potvrditi da je prikladno za odabrano trajanje; pratite razvoj tijesta, a hladnjak usporava fermentaciju.',
      strongerFlourMayHelp: 'Za odabrano trajanje i uvjete fermentacije jače brašno može pružiti veću sigurnost. Viša sobna temperatura ubrzava fermentaciju, a hladnjak je usporava.',
      none: 'Odabrano trajanje i način fermentacije u skladu su s dostupnom procjenom brašna. Viša sobna temperatura ubrzava fermentaciju, a hladnjak je usporava.',
    },
    en: {
      glutenFree: 'Gluten-free flour is not assessed by W strength. It follows a separate gluten-free process.',
      unknown: 'The selected flour strength is unknown. The evaluation cannot confirm that it suits the selected duration; watch the dough, while refrigeration slows fermentation.',
      strongerFlourMayHelp: 'For the selected duration and fermentation conditions, stronger flour may provide more margin. Higher room temperature speeds fermentation, while refrigeration slows it.',
      none: 'The selected duration and fermentation mode fit the available flour evaluation. Higher room temperature speeds fermentation, while refrigeration slows it.',
    },
    de: {
      glutenFree: 'Glutenfreies Mehl wird nicht nach dem W-Faktor beurteilt. Dafür gilt ein eigenes Verfahren ohne Glutenentwicklung.',
      unknown: 'Die Mehlstärke des ausgewählten Mehls ist unbekannt. Die Bewertung kann nicht bestätigen, dass es für die gewählte Dauer geeignet ist; beobachten Sie den Teig, während Kühlung die Gärung verlangsamt.',
      strongerFlourMayHelp: 'Für die gewählte Dauer und die Gärbedingungen kann stärkeres Mehl mehr Reserve bieten. Eine höhere Raumtemperatur beschleunigt die Gärung, Kühlung verlangsamt sie.',
      none: 'Die gewählte Dauer und Gärart passen zur verfügbaren Mehlbewertung. Eine höhere Raumtemperatur beschleunigt die Gärung, Kühlung verlangsamt sie.',
    },
    sl: {
      glutenFree: 'Brezglutenske moke ne ocenjujemo z W-faktorjem. Zanjo velja ločen postopek brez razvoja glutena.',
      unknown: 'Moč izbrane moke ni znana. Ocena ne more potrditi, da je primerna za izbrano trajanje; opazujte testo, hladilnik pa fermentacijo upočasni.',
      strongerFlourMayHelp: 'Za izbrano trajanje in pogoje fermentacije lahko močnejša moka zagotovi več rezerve. Višja sobna temperatura pospeši fermentacijo, hladilnik pa jo upočasni.',
      none: 'Izbrano trajanje in način fermentacije ustrezata razpoložljivi oceni moke. Višja sobna temperatura pospeši fermentacijo, hladilnik pa jo upočasni.',
    },
  }[lang])[beginnerFlourGuidanceKind];
  const beginnerScheduleSelectionVisible = isBeginner
    && method === 'direct'
    && (mixing === 'hand' || mixing === 'mixer')
    && sharedBakeAt !== null;
  useEffect(() => {
    const current = beginnerCandidateEvaluations.find((evaluation) => (evaluation.candidate as unknown as { mode?: BeginnerDirectScheduleMode }).mode === beginnerScheduleMode);
    if (current?.selectable) return;
    if (beginnerSelectableModes.length === 0) return;
    const fallback = beginnerSelectableModes.find((evaluation) => evaluation.recommended) ?? beginnerSelectableModes[0];
    const mode = (fallback.candidate as unknown as { mode: BeginnerDirectScheduleMode }).mode;
    if (mode && mode !== beginnerScheduleMode) setBeginnerScheduleMode(mode);
  }, [beginnerCandidateEvaluations, beginnerScheduleMode, beginnerSelectableModes]);
  const beginnerDirectHome = isBeginner && method === 'direct' && !!directHomeSchedule;
  const beginnerPhaseBPlan: BeginnerPhaseBPlan | null = beginnerDirectHome && directHomeSchedule
    ? calculateBeginnerPhaseBPlan({
      // Legacy expression: durationMinutes: directHomeSchedule.roomBeforeFridgeHours * 60. V1 stores Phase B separately.
      durationMinutes: directHomeSchedule.phaseBMinutes ?? directHomeSchedule.roomBeforeFridgeHours * 60,
      flourBehavior: flour === 'glutenFree'
        ? 'glutenFree'
        : getBeginnerPhaseAFlourBehavior(flour, blendA, blendB) === 'standard'
          ? 'standard'
          : 'gentle',
      workflow: isRomanTeglia ? 'teglia' : 'round',
    })
    : null;
  useEffect(() => {
    setSharedHomeDirectSchedule(directHomeSchedule && flour === 'glutenFree' ? { ...directHomeSchedule, glutenFree: true } : directHomeSchedule);
  }, [directHomeSchedule, flour]);
  const directRecipeRoomHours = directHomeSchedule?.roomAfterFridgeHours ?? roomHours;
  const directRecipeFridgeHours = directHomeSchedule?.fridgeHours ?? fridgeHours;
  const directHomeScheduleDisplay = directHomeSchedule ? formatDirectHomeSchedule(directHomeSchedule, roomTemp, fridgeTemp, lang) : null;
  const beginnerFlourBehavior = getBeginnerPhaseAFlourBehavior(flour, blendA, blendB);
  const beginnerScheduleSteps: GuidedScheduleEvent[] = useMemo(() => directHomeSchedule ? (() => {
    const dateLocale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
    const formatAt = (at: Date, previousAt?: Date) => {
      const sameDay = previousAt
        && at.getFullYear() === previousAt.getFullYear()
        && at.getMonth() === previousAt.getMonth()
        && at.getDate() === previousAt.getDate();
      return new Intl.DateTimeFormat(dateLocale, sameDay ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' }).format(at);
    };
    const { startAt, bakeAt, roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours } = directHomeSchedule;
    const isGlutenFree = flour === 'glutenFree';
    const phaseBStart = new Date(
      startAt.getTime() + (directHomeSchedule.phaseAMinutes ?? 0) * 60000,
    );
    const isTargetBeginnerSchedule = beginnerDirectHome
      && pizzaStyle === 'neapolitan'
      && flour === 'caputo00'
      && (mixing === 'hand' || mixing === 'mixer');
    const steps: (GuidedScheduleEvent & { time?: string })[] = [
      { id: 'mix', label: t.beginnerCalc.timelineMix, at: startAt, actionable: true },
    ];
    if (beginnerPhaseBPlan) {
      for (const fold of beginnerPhaseBPlan.folds) {
        steps.push({
          id: fold.index === 1 ? 'fold1' : 'fold2',
          label: fold.index === 1 ? t.beginnerCalc.timelineFold1 : t.beginnerCalc.timelineFold2,
          at: new Date(phaseBStart.getTime() + fold.offsetMinutes * 60000),
          actionable: true,
        });
      }
    }
    const ballingAt = directHomeSchedule.ballingAt ?? new Date(startAt.getTime() + roomBeforeFridgeHours * 3600000);
    if (fridgeHours > 0) {
      steps.push({
        id: isGlutenFree
          ? 'portioning'
          : isRomanTeglia || isTargetBeginnerSchedule
            ? 'fridgeIn'
            : 'fridgeInCombined',
        label: isRomanTeglia
          ? t.beginnerCalc.timelineRefrigerateDough
          : isGlutenFree
            ? t.beginnerCalc.timelinePreparePortions
            : t.beginnerCalc.timelineDivideBallRefrigerate(
              pizzas,
              effectiveBall,
            ),
        at: ballingAt,
        actionable: true,
      });
      if (isTargetBeginnerSchedule && directHomeSchedule.fridgeAt) {
        steps[steps.length - 1] = {
          id: 'balling',
          label: t.beginnerCalc.timelineShapeBalls,
          at: ballingAt,
          actionable: true,
        };
        steps.push({
          id: 'fridgeIn',
          label: t.beginnerCalc.timelineRefrigerateDough,
          at: directHomeSchedule.fridgeAt,
          actionable: true,
        });
      }
      if (roomAfterFridgeHours > 0) {
        steps.push({
          id: 'fridgeOut',
          label: t.beginnerCalc.timelineRemoveFromFridge,
          at: getBeginnerFridgeOutAt(directHomeSchedule),
          actionable: true,
        });
      }
    } else {
      steps.push({
        id: isRomanTeglia ? 'trayPrepare' : isGlutenFree ? 'portioning' : 'balling',
        label: isRomanTeglia
          ? t.beginnerCalc.timelineShapeTray
          : isGlutenFree
            ? t.beginnerCalc.timelinePreparePortions
            : t.beginnerCalc.timelineShapeBalls,
        at: ballingAt,
        actionable: true,
      });
    }
    const preheatAt = directHomeSchedule.preheatAt ?? new Date(bakeAt.getTime() - getBeginnerPreheatMinutes(oven) * 60000);
    const preheatMinutes = Math.round((bakeAt.getTime() - preheatAt.getTime()) / 60000);
    const roomOnlyEnd = getBeginnerRoomOnlyEnd(directHomeSchedule, preheatAt);
    if (roomOnlyEnd) {
      steps.push({
        id: 'roomFermentationEnd',
        label: t.beginnerCalc.timelineRoomFermentationEnd,
        at: roomOnlyEnd.endAt,
        actionable: true,
      });
    }
    steps.push({
      id: 'preheat',
      label: `${t.beginnerCalc.preheat} · ${formatDuration(preheatMinutes * 60, lang)} · ${formatTemperature(ovenTemp, temperatureUnit)}`,
      at: preheatAt,
      activeUntil: bakeAt,
      actionable: true,
    });
    const isTargetBeginnerDirect = beginnerDirectHome
      && pizzaStyle === 'neapolitan'
      && flour === 'caputo00'
      && (mixing === 'hand' || mixing === 'mixer');
    if (!isTargetBeginnerDirect) steps.push({
      id: 'shape',
      label: isRomanTeglia ? t.beginnerCalc.timelineShapeTray : t.beginnerCalc.timelineShapeTop,
      at: new Date(bakeAt.getTime() - 15 * 60000),
      actionable: true,
    });
    steps.push({ id: 'bake', label: t.beginnerCalc.bake, at: bakeAt, actionable: true });
    return steps
      .sort((left, right) => left.at.getTime() - right.at.getTime())
      .map((step, index, sorted) => ({
        ...step,
        time: formatAt(step.at, index > 0 ? sorted[index - 1].at : undefined),
      }));
  })() : [], [
    directHomeSchedule, beginnerPhaseBPlan, lang, t.beginnerCalc, isRomanTeglia, pizzaStyle, flour, blendA, blendB, mixing, oven, ovenTemp, temperatureUnit, beginnerDirectHome,
  ]);
  const legacyDoughHours = getHomePlanLegacyFermentationHours(homePlan, roomHours, fridgeHours);
  const bigaHomePlan = useMemo(() => {
    if (!isBeginner || method !== 'biga' || sharedBakeAt === null) return null;
    return createBigaHomePizzaPlan({
      style: pizzaStyle,
      pizzas,
      ballWeight: effectiveBall,
      bakeAt: sharedBakeAt,
      roomTemp,
      fridgeTemp,
      ovenType: oven,
    }, scheduleCalculationNow);
  }, [isBeginner, method, sharedBakeAt, pizzaStyle, pizzas, effectiveBall, roomTemp, fridgeTemp, oven, scheduleCalculationNow]);
  const bigaHomeSchedule = isBeginner && method === 'biga' ? bigaHomePlan?.schedule ?? null : null;
  const beginnerNeapolitanBigaHome = isBeginner && pizzaStyle === 'neapolitan' && method === 'biga' && !!bigaHomeSchedule;
  useEffect(() => {
    setSharedHomeBigaSchedule(bigaHomeSchedule);
  }, [bigaHomeSchedule]);
  const bigaHomeScheduleDisplay = bigaHomeSchedule ? formatBigaHomeSchedule(bigaHomeSchedule, lang) : null;
  const bigaHomeScheduleHint = beginnerNeapolitanBigaHome ? (() => {
    const room = formatDuration(bigaHomeSchedule.bigaRoomHours * 3600, lang);
    const fridge = formatDuration(bigaHomeSchedule.bigaFridgeHours * 3600, lang);
    return ({
      hr: `Biga: ${bigaPct}% brašna, 45% hidratacije; sazrijevanje prema Home rasporedu: ${room} na sobnoj temperaturi + ${fridge} u hladnjaku.`,
      en: `Biga: ${bigaPct}% of flour at 45% hydration; Home maturation schedule: ${room} at room temperature + ${fridge} refrigerated.`,
      de: `Biga: ${bigaPct}% des Mehls bei 45% Hydration; Home-Reifeplan: ${room} bei Raumtemperatur + ${fridge} im Kühlschrank.`,
      sl: `Biga: ${bigaPct}% moke pri 45% hidraciji; Home načrt zorenja: ${room} pri sobni temperaturi + ${fridge} v hladilniku.`,
    }[lang]);
  })() : null;
  const poolishHomePlan = useMemo(() => {
    if (!isBeginner || method !== 'poolish' || sharedBakeAt === null) return null;
    return createPoolishHomePizzaPlan({
      style: pizzaStyle,
      pizzas,
      ballWeight: effectiveBall,
      bakeAt: sharedBakeAt,
      roomTemp,
      fridgeTemp,
      ovenType: oven,
      poolishHours,
    }, scheduleCalculationNow);
  }, [isBeginner, method, sharedBakeAt, pizzaStyle, pizzas, effectiveBall, roomTemp, fridgeTemp, oven, poolishHours, scheduleCalculationNow]);
  const poolishHomeSchedule = isBeginner && method === 'poolish' ? poolishHomePlan?.schedule ?? null : null;
  useEffect(() => {
    setSharedHomePoolishSchedule(poolishHomeSchedule);
  }, [poolishHomeSchedule]);
  const poolishHomeScheduleDisplay = poolishHomeSchedule ? formatPoolishHomeSchedule(poolishHomeSchedule, lang) : null;
  const beginnerHomePlanMilestones = !directHomeSchedule
    ? bigaHomeScheduleDisplay?.steps ?? poolishHomeScheduleDisplay?.steps ?? []
    : [];
  const beginnerHomeRecipeLayout = isBeginner && !!(
    (method === 'direct' && directHomeSchedule)
    || (method === 'biga' && bigaHomeSchedule)
    || (method === 'poolish' && poolishHomeSchedule)
  );
  const guidedPlanId = beginnerHomeRecipeLayout && directHomeSchedule && sharedBakeAt
    ? createGuidedPlanId([
      sharedBakeAt.getTime(),
      directHomeSchedule.startAt.getTime(),
      directHomeSchedule.roomBeforeFridgeHours,
      directHomeSchedule.fridgeHours,
      directHomeSchedule.roomAfterFridgeHours,
      roomTemp,
      fridgeTemp,
      pizzaStyle,
      isRomanTeglia ? romanFormat : null,
      flour,
      flour === 'custom' ? blendA : null,
      flour === 'custom' ? blendB : null,
      flour === 'custom' ? blendPctA : null,
      mixing,
      oven,
      ovenTemp,
      hydration,
      preferredYeastType,
      pizzas,
      effectiveBall,
      diameter,
      trayWidth,
      trayLength,
    ])
    : null;
  const guidedDateGroups = useMemo(() => groupGuidedEventsByLocalDate(beginnerScheduleSteps), [beginnerScheduleSteps]);
  const nextGuidedEvent = useMemo(() => getNextGuidedEvent(beginnerScheduleSteps, guidedCompletedAt), [beginnerScheduleSteps, guidedCompletedAt]);
  const guidedProgress = useMemo(() => getGuidedProgress(beginnerScheduleSteps, guidedCompletedAt), [beginnerScheduleSteps, guidedCompletedAt]);
  const guidedEventScheduleKey = beginnerScheduleSteps.map((event) => `${event.id}:${event.at.getTime()}`).join('|');

  useEffect(() => {
    if (!guidedPlanId) return undefined;

    let active = true;
    AsyncStorage.getItem(`${GUIDED_PROGRESS_STORAGE_PREFIX}${guidedPlanId}`).then((value) => {
      if (!active) return;
      if (!value) {
        setGuidedCompletedAt({});
        return;
      }
      const stored = JSON.parse(value) as { planId?: string; completedAt?: Record<string, number> };
      if (stored.planId !== guidedPlanId || !stored.completedAt || typeof stored.completedAt !== 'object') {
        setGuidedCompletedAt({});
        return;
      }
      const validIds = new Set(beginnerScheduleSteps.filter((event) => event.actionable).map((event) => event.id));
      const restored = Object.fromEntries(Object.entries(stored.completedAt).filter(([id, time]) =>
        validIds.has(id as GuidedScheduleEvent['id']) && typeof time === 'number' && Number.isFinite(time),
      ));
      setGuidedCompletedAt(restored);
    }).catch((error) => {
      console.error('Unable to restore guided recipe progress:', error);
      if (active) setGuidedCompletedAt({});
    }).finally(() => {
      if (active) setGuidedProgressPlanId(guidedPlanId);
    });

    return () => { active = false; };
  }, [guidedPlanId, guidedEventScheduleKey]);

  useEffect(() => {
    if (!guidedPlanId || guidedProgressPlanId !== guidedPlanId) return;
    AsyncStorage.setItem(
      `${GUIDED_PROGRESS_STORAGE_PREFIX}${guidedPlanId}`,
      JSON.stringify({ planId: guidedPlanId, completedAt: guidedCompletedAt }),
    ).catch((error) => {
      console.error('Unable to save guided recipe progress:', error);
    });
  }, [guidedPlanId, guidedProgressPlanId, guidedCompletedAt]);

  useEffect(() => {
    if (!isBeginner || !guidedPlanId || !beginnerScheduleModeUserSelected.current) return;
    const affected = getNighttimeActiveEvents(beginnerScheduleSteps);
    if (affected.length === 0 || nighttimeWarningShown.current.has(guidedPlanId)) return;
    nighttimeWarningShown.current.add(guidedPlanId);
    const locale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
    const formatTime = (at: Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
    const copy = {
      hr: {
        title: 'Priprema tijekom noći',
        description: 'Prema izračunatom rasporedu, neke aktivnosti potrebno je obaviti između 00:00 i 06:00.',
        recommendation: 'Preporučujemo promjenu vremena pečenja kako biste izbjegli noćnu pripremu.',
        change: 'Promijeni vrijeme pečenja',
        keep: 'Zadrži postojeći raspored',
        activities: 'Aktivnosti:',
      },
      en: {
        title: 'Overnight preparation',
        description: 'According to the calculated schedule, some activities must be done between 00:00 and 06:00.',
        recommendation: 'We recommend changing the baking time to avoid overnight preparation.',
        change: 'Change baking time',
        keep: 'Keep the current schedule',
        activities: 'Activities:',
      },
      de: {
        title: 'Vorbereitung während der Nacht',
        description: 'Laut dem berechneten Zeitplan müssen einige Aktivitäten zwischen 00:00 und 06:00 Uhr durchgeführt werden.',
        recommendation: 'Wir empfehlen, die Backzeit zu ändern, um nächtliche Vorbereitung zu vermeiden.',
        change: 'Backzeit ändern',
        keep: 'Aktuellen Zeitplan beibehalten',
        activities: 'Aktivitäten:',
      },
      sl: {
        title: 'Priprava ponoči',
        description: 'Po izračunanem načrtu je treba nekatere dejavnosti opraviti med 00:00 in 06:00.',
        recommendation: 'Priporočamo spremembo časa peke, da se izognete nočni pripravi.',
        change: 'Spremeni čas peke',
        keep: 'Obdrži trenutni načrt',
        activities: 'Dejavnosti:',
      },
    }[lang];
    const activityList = affected.map((event) => `• ${event.label} — ${formatTime(event.at)}`).join('\n');
    AsyncStorage.getItem(`${GUIDED_NIGHT_WARNING_CONFIRMED_PREFIX}${guidedPlanId}`).then((confirmed) => {
      if (confirmed === 'true') return;
      Alert.alert(
        copy.title,
        `${copy.description}\n\n${copy.activities}\n${activityList}\n\n${copy.recommendation}`,
        [
          {
            text: copy.change,
            onPress: () => router.push(`/(tabs)/planner?returnTo=beginner&returnToken=${Date.now()}&returnSection=bake`),
          },
          {
            text: copy.keep,
            onPress: () => {
              AsyncStorage.setItem(`${GUIDED_NIGHT_WARNING_CONFIRMED_PREFIX}${guidedPlanId}`, 'true').catch((error) => {
                console.error('Unable to remember nighttime schedule confirmation:', error);
              });
            },
          },
        ],
      );
    }).catch((error) => {
      console.error('Unable to check nighttime schedule confirmation:', error);
    });
  }, [isBeginner, guidedPlanId, beginnerScheduleSteps, lang, router, nighttimeWarningRequest]);

  useEffect(() => {
    if (!guidedPlanId) {
      const previousPlanId = previousGuidedPlanId.current;
      previousGuidedPlanId.current = null;
      if (previousPlanId) {
        void cancelGuidedNotificationsForPlan(previousPlanId).catch((error) => {
          console.error('Unable to cancel notifications for the previous guided plan:', error);
        });
      }
      return;
    }
    if (!guidedNotificationPreferenceLoaded || guidedProgressPlanId !== guidedPlanId) return;

    const generation = ++notificationSyncGeneration.current;
    const previousPlanId = previousGuidedPlanId.current;
    previousGuidedPlanId.current = guidedPlanId;

    const syncNotifications = async () => {
      if (previousPlanId && previousPlanId !== guidedPlanId) {
        await cancelGuidedNotificationsForPlan(previousPlanId);
      }
      await cancelGuidedNotificationsForPlan(guidedPlanId);
      if (!guidedNotificationsEnabled || !isPushSupported()) return;

      for (const { event, combinedWith } of planGuidedNotifications(beginnerScheduleSteps, guidedCompletedAt, Date.now())) {
        const useGentleFoldCopy = flour !== 'custom'
          && (beginnerFlourBehavior === 'spelt' || beginnerFlourBehavior === 'wholeWheat');
        const copy = combinedWith
          ? t.beginnerCalc.guidedNotificationCopy.roomFermentationEndPreheat
          : event.id === 'fold1' && useGentleFoldCopy
          ? t.beginnerCalc.guidedNotificationCopy.fold1Gentle
          : event.id === 'fold2' && useGentleFoldCopy
            ? t.beginnerCalc.guidedNotificationCopy.fold2Gentle
            : t.beginnerCalc.guidedNotificationCopy[event.id];
        const notificationBody = !combinedWith && (event.id === 'fridgeIn' || event.id === 'preheat')
          ? event.label
          : copy.body;
        const notificationId = await scheduleLocalAt(copy.title, notificationBody, event.at, {
          source: 'pizza-guided-recipe',
          planId: guidedPlanId,
          stepId: event.id,
          ...(combinedWith ? { combinedStepId: combinedWith.id } : {}),
        });
        if (!notificationId) throw new Error(`No notification was scheduled for guided step "${event.id}".`);
        if (generation !== notificationSyncGeneration.current) {
          await cancelGuidedNotificationsForPlan(guidedPlanId);
          return;
        }
      }
    };

    void syncNotifications().catch((error) => {
      console.error('Unable to synchronize guided recipe notifications:', error);
      if (generation !== notificationSyncGeneration.current) return;
      setGuidedNotificationsEnabled(false);
      AsyncStorage.setItem(GUIDED_NOTIFICATIONS_ENABLED_KEY, 'false').catch((storageError) => {
        console.error('Unable to save the disabled notification preference:', storageError);
      });
      Alert.alert(t.beginnerCalc.guidedNotifications, t.beginnerCalc.guidedNotificationError);
    });

    return () => {
      notificationSyncGeneration.current += 1;
    };
  }, [
    guidedPlanId, guidedEventScheduleKey, guidedNotificationPreferenceLoaded, guidedProgressPlanId,
    guidedNotificationsEnabled, guidedCompletedAt, pizzas, effectiveBall, t.beginnerCalc,
  ]);

  useEffect(() => {
    if (!guidedPlanId) return undefined;
    const interval = setInterval(() => setGuidedNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [guidedPlanId]);

  const completeGuidedStep = (stepId: GuidedScheduleEvent['id']) => {
    if (!guidedPlanId || guidedProgressPlanId !== guidedPlanId || guidedCompletedAt[stepId] !== undefined) return;
    const completed = { ...guidedCompletedAt, [stepId]: Date.now() };
    setGuidedCompletedAt(completed);
    void cancelGuidedNotificationForStep(guidedPlanId, stepId).catch((error) => {
      console.error(`Unable to cancel notification for guided step "${stepId}":`, error);
      Alert.alert(t.beginnerCalc.guidedNotifications, t.beginnerCalc.guidedNotificationError);
    });
  };

  const toggleGuidedNotifications = () => {
    if (!guidedPlanId) return;
    if (guidedNotificationsEnabled) {
      setGuidedNotificationsEnabled(false);
      AsyncStorage.setItem(GUIDED_NOTIFICATIONS_ENABLED_KEY, 'false').catch((error) => {
        console.error('Unable to save the guided notification preference:', error);
      });
      return;
    }
    if (!isPushSupported()) {
      Alert.alert(t.beginnerCalc.guidedNotifications, t.beginnerCalc.guidedNotificationsUnavailable);
      return;
    }
    Alert.alert(t.beginnerCalc.guidedPermissionTitle, t.beginnerCalc.guidedPermissionBody, [
      { text: t.beginnerCalc.guidedNotNow, style: 'cancel' },
      {
        text: t.beginnerCalc.guidedAllow,
        onPress: () => {
          void requestNotificationPermissions().then((granted) => {
            if (!granted) {
              Alert.alert(t.beginnerCalc.guidedNotifications, t.beginnerCalc.guidedPermissionDenied);
              return;
            }
            setGuidedNotificationsEnabled(true);
            AsyncStorage.setItem(GUIDED_NOTIFICATIONS_ENABLED_KEY, 'true').catch((error) => {
              console.error('Unable to save the guided notification preference:', error);
            });
          }).catch((error) => {
            console.error('Unable to request notification permission:', error);
            Alert.alert(t.beginnerCalc.guidedNotifications, t.beginnerCalc.guidedPermissionDenied);
          });
        },
      },
    ]);
  };

  const guidedNextTimeLabel = nextGuidedEvent ? (() => {
    const locale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
    const dayOffset = getLocalDayOffset(new Date(guidedNow), nextGuidedEvent.at);
    const dayLabel = dayOffset === 0
      ? t.beginnerCalc.guidedToday
      : dayOffset === 1
        ? t.beginnerCalc.guidedTomorrow
        : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(nextGuidedEvent.at);
    const timeLabel = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(nextGuidedEvent.at);
    const countdown = getGuidedCountdown(nextGuidedEvent.at, guidedNow);
    if (countdown.status === 'due') return `${dayLabel} · ${timeLabel}\n${t.beginnerCalc.guidedDue}`;
    const minutes = Math.ceil(countdown.milliseconds / 60_000);
    const duration = formatDuration(minutes * 60, lang);
    const message = countdown.status === 'overdue'
      ? t.beginnerCalc.guidedOverdue
      : t.beginnerCalc.guidedCountdown;
    return `${dayLabel} · ${timeLabel}\n${message.replace('{DURATION}', duration)}`;
  })() : '';
  useEffect(() => {
    if (focus !== 'plan' && focus !== 'guided' && focus !== 'style') {
      lastBeginnerPlanFocus.current = null;
      return;
    }
    const focusKey = `${focus}:${guidedPlanId ?? 'plan'}:${stepId ?? ''}`;
    if (!isBeginner || (focus !== 'style' && !beginnerHomeRecipeLayout) || lastBeginnerPlanFocus.current === focusKey) return;
    const targetSection: BeginnerSection = focus === 'style' ? 'style' : 'plan';
    if (beginnerSectionY.current[targetSection] === undefined) return;
    lastBeginnerPlanFocus.current = focusKey;
    requestAnimationFrame(() => {
      scrollToBeginnerSection(targetSection);
      router.replace('/(tabs)');
    });
  }, [isBeginner, focus, stepId, guidedPlanId, beginnerHomeRecipeLayout, beginnerLayoutVersion, router, scrollToBeginnerSection]);
  const dough = useMemo(() => doughCalc({
    pizzas, ballWeight: effectiveBall, hydration,
    saltPct, oilPct, method, bigaPct, poolishPct,
    roomHours: legacyDoughHours.roomHours, roomTemp, fridgeHours: legacyDoughHours.fridgeHours, fridgeTemp,
    prefermentHours,
    mixing: mixing === 'mixer' ? 'spiral' : 'hand',
    beginnerDirectStyle: isBeginner && flour !== 'glutenFree'
      ? isRomanTeglia
        ? 'romanaTeglia'
        : pizzaStyle === 'romana'
          ? 'romanaTonda'
          : pizzaStyle === 'ny_style'
            ? 'newYork'
            : 'neapolitan'
      : undefined,
    beginnerDirectMixing: isBeginner ? mixing === 'mixer' ? 'home' : 'hand' : undefined,
    yeastType: preferredYeastType,
    flourType: flour,
    bigaHomeSchedule: bigaHomePlan?.schedule,
    poolishHomeSchedule: poolishHomePlan?.schedule,
  }), [pizzas, effectiveBall, hydration, saltPct, oilPct, method, bigaPct, poolishPct, prefermentHours, legacyDoughHours.roomHours, roomTemp, legacyDoughHours.fridgeHours, fridgeTemp, mixing, flour, pizzaStyle, isRomanTeglia, isBeginner, preferredYeastType, bigaHomePlan, poolishHomePlan]);
  const selectedPrefermentHours = fermentationSchedule.prefermentHours;
  const prefermentRoomHours = fermentationSchedule.prefermentRoomHours;
  const prefermentFridgeHours = fermentationSchedule.prefermentFridgeHours;
  const psylliumGrams = flour === 'glutenFree' ? (dough.total.psyllium ?? 0) : 0;
  const beginnerDisplayFlour = beginnerDirectHome
    ? Math.round((dough.totalDough - dough.total.water - dough.total.salt - dough.total.oil - dough.total.yeast - psylliumGrams) * 100) / 100
    : dough.total.flour;
  const bigaHomeDisplayMainFlour = beginnerNeapolitanBigaHome && dough.preferment
    ? Math.round((dough.totalDough - dough.preferment.flour - dough.preferment.water - dough.preferment.yeast - dough.main.water - dough.main.salt - dough.main.oil - dough.main.yeast - psylliumGrams) * 100) / 100
    : dough.main.flour;
  const bigaHomeDisplayTotalFlour = beginnerNeapolitanBigaHome && dough.preferment
    ? dough.preferment.flour + bigaHomeDisplayMainFlour
    : dough.total.flour;
  const yeastShortLabel = preferredYeastType === 'dry' ? t.calc.dryYeastShort : t.calc.freshYeastShort;
  const weight = (grams: number, precise = false) => formatWeight(grams, measurementSystem, precise);
  const beginnerBallInfo = ({
    hr: 'Promjer i gramaža su povezani. Ako promijeniš veličinu pizze, PizzaBook prilagođava količinu tijesta. Ako promijeniš gramažu, PizzaBook prilagođava odgovarajući promjer.',
    en: 'Diameter and dough weight are connected. When you change the pizza size, PizzaBook adjusts the dough amount. When you change the dough weight, PizzaBook adjusts the matching diameter.',
    de: 'Durchmesser und Teiggewicht gehören zusammen. Wenn du die Pizzagröße änderst, passt PizzaBook die Teigmenge an. Wenn du das Teiggewicht änderst, passt PizzaBook den passenden Durchmesser an.',
    sl: 'Premer in količina testa sta povezana. Če spremeniš velikost pice, PizzaBook prilagodi količino testa. Če spremeniš količino testa, PizzaBook prilagodi ustrezen premer.',
  }[lang]) + `\n\n${t.beginnerCalc.ballInfo}\n${t.calc.styleInfo.diameter}: ${formatLength(styleProfile.defaultDiameter, measurementSystem)} · ${t.calc.styleInfo.ball}: ${weight(styleProfile.ballWeight)}`;
  const ballWeightDisplay = weight(effectiveBall);
  const ballWeightInputUnit = ballWeightDisplay.endsWith(' lb') ? 'lb' : measurementSystem === 'us' ? 'oz' : 'g';
  const ballInputValue = customBallInput !== '' && customBallInputSystem === measurementSystem
    ? customBallInput
    : ballWeightDisplay.split(' ')[0];
  const idealFermentationText = method === 'biga'
    ? ({
      hr: `Idealno za Bigu: 8 sati RT na 18–20 °C + 16 sati hladnjak na 4–6 °C. Ukupno: 24 sata.`,
      en: `Ideal for Biga: 8 hours at 18–20 °C + 16 hours refrigerated at 4–6 °C. Total: 24 hours.`,
      de: `Ideal für Biga: 8 Stunden bei 18–20 °C + 16 Stunden im Kühlschrank bei 4–6 °C. Gesamt: 24 Stunden.`,
      sl: `Idealno za Bigo: 8 ur pri 18–20 °C + 16 ur v hladilniku pri 4–6 °C. Skupaj: 24 ur.`,
    }[lang])
    : ({
      hr: `Idealno za Poolish: 1 sat RT + 16–24 sata hladnjak.`,
      en: `Ideal for Poolish: 1 hour at room temperature + 16–24 hours refrigerated.`,
      de: `Ideal für Poolish: 1 Stunde bei Raumtemperatur + 16–24 Stunden im Kühlschrank.`,
      sl: `Idealno za Poolish: 1 ura pri sobni temperaturi + 16–24 ur v hladilniku.`,
    }[lang]);
  const idealPreferment = method === 'biga'
    ? selectedPrefermentHours === 24
    : selectedPrefermentHours >= 16 && selectedPrefermentHours <= 24;
  const fermentationInfoTitle = ({ hr: 'Fermentacija i kvasac', en: 'Fermentation and yeast', de: 'Fermentation und Hefe', sl: 'Fermentacija in kvas' }[lang]);
  const fermentationInfoBody = ({
    hr: `Predferment: ${selectedPrefermentHours} h\nZavršno RT: ${roomHours} h\nZavršni hladnjak: ${fridgeHours} h\nUkupno: ${selectedPrefermentHours + roomHours + fridgeHours} h\n\n${idealFermentationText}\n\nIzračunati svježi kvasac: ${dough.yeastPct}%`,
    en: `Preferment: ${selectedPrefermentHours} h\nFinal room temperature: ${roomHours} h\nFinal refrigerator: ${fridgeHours} h\nTotal: ${selectedPrefermentHours + roomHours + fridgeHours} h\n\n${idealFermentationText}\n\nCalculated fresh yeast: ${dough.yeastPct}%`,
    de: `Vorteig: ${selectedPrefermentHours} Std.\nEndgare Raumtemperatur: ${roomHours} Std.\nEndgare Kühlschrank: ${fridgeHours} Std.\nGesamt: ${selectedPrefermentHours + roomHours + fridgeHours} Std.\n\n${idealFermentationText}\n\nBerechnete Frischhefe: ${dough.yeastPct}%`,
    sl: `Predtesto: ${selectedPrefermentHours} h\nKončna sobna temperatura: ${roomHours} h\nKončni hladilnik: ${fridgeHours} h\nSkupaj: ${selectedPrefermentHours + roomHours + fridgeHours} h\n\n${idealFermentationText}\n\nIzračunani sveži kvas: ${dough.yeastPct}%`,
  }[lang]);
  const ice = useMemo(() => !isBeginner && useIce ? iceCalc(dough.total.water, roomTemp, 4) : null, [isBeginner, useIce, dough.total.water, roomTemp]);
  const waterTemperatureCalculation = dough.waterTemperature;
  const isBeginnerDirectPhaseAStyle = pizzaStyle === 'neapolitan'
    || (pizzaStyle === 'romana' && romanFormat === 'tonda');
  const isTargetNeapolitanHandPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'caputo00'
    && mixing === 'hand';
  const isTargetNeapolitanGlutenFreeHandPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'glutenFree'
    && mixing === 'hand';
  const isTargetNeapolitanGlutenFreeMixerPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'glutenFree'
    && mixing === 'mixer';
  const isTargetTegliaGlutenFreeHandPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'glutenFree'
    && mixing === 'hand';
  const isTargetTegliaGlutenFreeMixerPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'glutenFree'
    && mixing === 'mixer';
  const isTargetTegliaManitobaHandPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'manitoba'
    && mixing === 'hand';
  const isTargetTegliaManitobaMixerPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'manitoba'
    && mixing === 'mixer';
  const isTargetTegliaSpeltHandPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'spelt'
    && mixing === 'hand';
  const isTargetTegliaSpeltMixerPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'spelt'
    && mixing === 'mixer';
  const isTargetTegliaWholeWheatHandPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'wholeWheat'
    && mixing === 'hand';
  const isTargetTegliaWholeWheatMixerPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'wholeWheat'
    && mixing === 'mixer';
  const isTargetTegliaCustomHandPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'custom'
    && mixing === 'hand';
  const isTargetTegliaCustomMixerPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'custom'
    && mixing === 'mixer';
  const isTargetNeapolitanCustomHandPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'custom'
    && mixing === 'hand';
  const isTargetNeapolitanCustomMixerPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'custom'
    && mixing === 'mixer';
  const isTargetNeapolitanMixerPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'caputo00'
    && mixing === 'mixer';
  const isTargetNeapolitanManitobaHandPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'manitoba'
    && mixing === 'hand';
  const isTargetNeapolitanManitobaMixerPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'manitoba'
    && mixing === 'mixer';
  const isTargetNeapolitanSpeltHandPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'spelt'
    && mixing === 'hand';
  const isTargetNeapolitanSpeltMixerPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'spelt'
    && mixing === 'mixer';
  const isTargetNeapolitanWholeWheatHandPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'wholeWheat'
    && mixing === 'hand';
  const isTargetNeapolitanWholeWheatMixerPhaseA = isBeginner
    && method === 'direct'
    && isBeginnerDirectPhaseAStyle
    && flour === 'wholeWheat'
    && mixing === 'mixer';
  const isTargetTegliaTipo00HandPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'caputo00'
    && mixing === 'hand';
  const isTargetTegliaTipo00MixerPhaseA = isBeginner
    && method === 'direct'
    && pizzaStyle === 'romana'
    && romanFormat === 'teglia'
    && flour === 'caputo00'
    && mixing === 'mixer';
  const waterTemperatureMixingLabel = waterTemperatureCalculation?.mixing === 'hand'
    ? ({ hr: 'ručno', en: 'by hand', de: 'von Hand', sl: 'ročno' }[lang])
    : ({ hr: 'mikserom', en: 'with a mixer', de: 'mit dem Mixer', sl: 'z mešalnikom' }[lang]);
  const waterTemperatureClampExplanation = waterTemperatureCalculation?.wasClamped
    ? ({
      hr: `Izračunata vrijednost bila je ${formatTemperature(waterTemperatureCalculation.calculatedWaterTemp, temperatureUnit)}; preporuka je ograničena na praktični raspon od ${formatTemperature(waterTemperatureCalculation.minimumWaterTemp, temperatureUnit)} do ${formatTemperature(waterTemperatureCalculation.maximumWaterTemp, temperatureUnit)}.`,
      en: `The calculated value was ${formatTemperature(waterTemperatureCalculation.calculatedWaterTemp, temperatureUnit)}; the recommendation was limited to the practical range of ${formatTemperature(waterTemperatureCalculation.minimumWaterTemp, temperatureUnit)} to ${formatTemperature(waterTemperatureCalculation.maximumWaterTemp, temperatureUnit)}.`,
      de: `Der berechnete Wert betrug ${formatTemperature(waterTemperatureCalculation.calculatedWaterTemp, temperatureUnit)}; die Empfehlung wurde auf den praktikablen Bereich von ${formatTemperature(waterTemperatureCalculation.minimumWaterTemp, temperatureUnit)} bis ${formatTemperature(waterTemperatureCalculation.maximumWaterTemp, temperatureUnit)} begrenzt.`,
      sl: `Izračunana vrednost je bila ${formatTemperature(waterTemperatureCalculation.calculatedWaterTemp, temperatureUnit)}; priporočilo je omejeno na praktični razpon od ${formatTemperature(waterTemperatureCalculation.minimumWaterTemp, temperatureUnit)} do ${formatTemperature(waterTemperatureCalculation.maximumWaterTemp, temperatureUnit)}.`,
    }[lang])
    : '';
  const beginnerWaterInfo = (isTargetNeapolitanHandPhaseA || isTargetNeapolitanMixerPhaseA || isTargetNeapolitanManitobaHandPhaseA || isTargetNeapolitanManitobaMixerPhaseA || isTargetNeapolitanSpeltHandPhaseA || isTargetNeapolitanSpeltMixerPhaseA || isTargetNeapolitanWholeWheatHandPhaseA || isTargetNeapolitanWholeWheatMixerPhaseA || isTargetTegliaTipo00HandPhaseA || isTargetTegliaTipo00MixerPhaseA || isTargetTegliaManitobaHandPhaseA || isTargetTegliaManitobaMixerPhaseA || isTargetTegliaSpeltHandPhaseA || isTargetTegliaSpeltMixerPhaseA || isTargetTegliaWholeWheatHandPhaseA || isTargetTegliaWholeWheatMixerPhaseA || isTargetTegliaCustomHandPhaseA || isTargetTegliaCustomMixerPhaseA) && waterTemperatureCalculation
    ? ({
      hr: `ⓘ Temperatura vode\n\nPreporučena temperatura vode: ${formatTemperature(waterTemperatureCalculation.recommendedWaterTemp, temperatureUnit)}\n\nTemperatura je automatski izračunata prema uvjetima vašeg recepta.`,
      en: `ⓘ Water temperature\n\nRecommended water temperature: ${formatTemperature(waterTemperatureCalculation.recommendedWaterTemp, temperatureUnit)}\n\nThe temperature is calculated automatically from your recipe conditions.`,
      de: `ⓘ Wassertemperatur\n\nEmpfohlene Wassertemperatur: ${formatTemperature(waterTemperatureCalculation.recommendedWaterTemp, temperatureUnit)}\n\nDie Temperatur wird automatisch anhand der Bedingungen Ihres Rezepts berechnet.`,
      sl: `ⓘ Temperatura vode\n\nPriporočena temperatura vode: ${formatTemperature(waterTemperatureCalculation.recommendedWaterTemp, temperatureUnit)}\n\nTemperatura se samodejno izračuna glede na pogoje vašega recepta.`,
    }[lang])
    : isBeginner && flour === 'glutenFree'
    ? ({
      hr: 'Upotrijebite hladnu vodu. To je postojeća preporuka za bezglutenski Beginner recept.',
      en: 'Use cold water. This is the existing recommendation for the Beginner gluten-free recipe.',
      de: 'Verwenden Sie kaltes Wasser. Dies ist die bestehende Empfehlung für das glutenfreie Beginner-Rezept.',
      sl: 'Uporabite hladno vodo. To je obstoječe priporočilo za brezglutenski Beginner recept.',
    }[lang])
    : isBeginner && waterTemperatureCalculation
      ? ({
        hr: `Temperatura vode: ${formatTemperature(waterTemperatureCalculation.recommendedWaterTemp, temperatureUnit)}\n\nKoristite ovu temperaturu vode kako bi tijesto nakon zamjesa završilo na odgovarajućoj temperaturi.`,
        en: `Water temperature: ${formatTemperature(waterTemperatureCalculation.recommendedWaterTemp, temperatureUnit)}\n\nUse this water temperature so the dough finishes mixing at the appropriate temperature.`,
        de: `Wassertemperatur: ${formatTemperature(waterTemperatureCalculation.recommendedWaterTemp, temperatureUnit)}\n\nVerwenden Sie diese Wassertemperatur, damit der Teig nach dem Mischen die passende Temperatur erreicht.`,
        sl: `Temperatura vode: ${formatTemperature(waterTemperatureCalculation.recommendedWaterTemp, temperatureUnit)}\n\nUporabite to temperaturo vode, da testo po mešanju doseže ustrezno temperaturo.`,
      }[lang])
    : ice
    ? ({
      hr: `Kalkulator je podijelio ukupno ${weight(dough.total.water)} vode na ${weight(ice.water)} vode i ${weight(ice.ice)} leda. Koristite te količine bez dodatne vode ili leda.`,
      en: `The calculator splits ${weight(dough.total.water)} total water into ${weight(ice.water)} water and ${weight(ice.ice)} ice. Use these amounts without adding extra water or ice.`,
      de: `Der Rechner teilt ${weight(dough.total.water)} Gesamtwasser in ${weight(ice.water)} Wasser und ${weight(ice.ice)} Eis auf. Verwenden Sie diese Mengen ohne zusätzliches Wasser oder Eis.`,
      sl: `Kalkulator razdeli skupno ${weight(dough.total.water)} vode na ${weight(ice.water)} vode in ${weight(ice.ice)} ledu. Uporabite ti količini brez dodatne vode ali ledu.`,
    }[lang])
    : waterTemperatureCalculation
      ? ({
        hr: `PizzaBook prilagođava temperaturu vode kako bi tijesto nakon miješanja završilo blizu ciljane temperature od ${formatTemperature(waterTemperatureCalculation.targetFinalDoughTemp, temperatureUnit)}. U izračun ulaze temperatura prostorije (${formatTemperature(waterTemperatureCalculation.roomTemp, temperatureUnit)}), procijenjena temperatura brašna (${formatTemperature(waterTemperatureCalculation.flourTemp, temperatureUnit)}, pretpostavljena jednaka sobnoj) i način miješanja (${waterTemperatureMixingLabel}). ${mixing === 'mixer' ? 'Mikser tijekom rada dodatno zagrijava tijesto, pa PizzaBook može preporučiti hladniju vodu. ' : ''}${waterTemperatureClampExplanation}`,
        en: `PizzaBook adjusts the water temperature to help the dough finish mixing near its target temperature of ${formatTemperature(waterTemperatureCalculation.targetFinalDoughTemp, temperatureUnit)}. The calculation uses room temperature (${formatTemperature(waterTemperatureCalculation.roomTemp, temperatureUnit)}), estimated flour temperature (${formatTemperature(waterTemperatureCalculation.flourTemp, temperatureUnit)}, assumed equal to room temperature), and mixing method (${waterTemperatureMixingLabel}). ${mixing === 'mixer' ? 'A mixer adds heat while running, so PizzaBook may recommend cooler water. ' : ''}${waterTemperatureClampExplanation}`,
        de: `PizzaBook passt die Wassertemperatur an, damit der Teig nach dem Kneten möglichst nahe an seiner Zieltemperatur von ${formatTemperature(waterTemperatureCalculation.targetFinalDoughTemp, temperatureUnit)} liegt. In die Berechnung fließen Raumtemperatur (${formatTemperature(waterTemperatureCalculation.roomTemp, temperatureUnit)}), geschätzte Mehltemperatur (${formatTemperature(waterTemperatureCalculation.flourTemp, temperatureUnit)}, wie die Raumtemperatur angenommen) und Knetmethode (${waterTemperatureMixingLabel}) ein. ${mixing === 'mixer' ? 'Ein Mixer erwärmt den Teig während des Betriebs zusätzlich; deshalb empfiehlt PizzaBook möglicherweise kühleres Wasser. ' : ''}${waterTemperatureClampExplanation}`,
        sl: `PizzaBook prilagodi temperaturo vode, da testo po gnetenju doseže temperaturo blizu ciljne ${formatTemperature(waterTemperatureCalculation.targetFinalDoughTemp, temperatureUnit)}. Izračun upošteva temperaturo prostora (${formatTemperature(waterTemperatureCalculation.roomTemp, temperatureUnit)}), ocenjeno temperaturo moke (${formatTemperature(waterTemperatureCalculation.flourTemp, temperatureUnit)}, predpostavljeno enako temperaturi prostora) in način gnetenja (${waterTemperatureMixingLabel}). ${mixing === 'mixer' ? 'Mešalnik med delovanjem dodatno segreva testo, zato lahko PizzaBook priporoči hladnejšo vodo. ' : ''}${waterTemperatureClampExplanation}`,
      }[lang])
    : ({
      hr: `Upotrijebite svih ${weight(dough.total.water)} vode na izračunatoj temperaturi od ${formatTemperature(dough.waterTemp, temperatureUnit)}.`,
      en: `Use all ${weight(dough.total.water)} water at the calculated temperature of ${formatTemperature(dough.waterTemp, temperatureUnit)}.`,
      de: `Verwenden Sie die gesamten ${weight(dough.total.water)} Wasser bei der berechneten Temperatur von ${formatTemperature(dough.waterTemp, temperatureUnit)}.`,
      sl: `Uporabite vseh ${weight(dough.total.water)} vode pri izračunani temperaturi ${formatTemperature(dough.waterTemp, temperatureUnit)}.`,
    }[lang]);

  // Auto-adjust hydration when flour changes to that flour's ideal
  // (uses changeFlour above)
  const step = (fn: () => void) => { try { Haptics.selectionAsync(); } catch {}; fn(); };

  const commitCustomDiameter = () => {
    const v = parseFloat(customDiameter);
    if (v >= 15 && v <= 60) {
      const nextDiameter = Math.round(v);
      setDiameter(nextDiameter);
      if (isBeginner && !isRomanTeglia) setCustomBallWeight(null);
      setCustomBallInput('');
    }
    setCustomDiameter('');
  };

  const setBeginnerDiameter = (nextDiameter: number) => {
    setDiameter(nextDiameter);
    if (isBeginner && !isRomanTeglia) setCustomBallWeight(null);
  };

  const setBeginnerBallWeight = (nextBallWeight: number) => {
    const diameterFromWeight = Math.max(20, Math.min(60, beginnerDiameterForBallWeight(pizzaStyle, nextBallWeight)));
    setDiameter(diameterFromWeight);
    setCustomBallWeight(nextBallWeight);
  };

  const buildRecipe = () => ({
    settings: {
      pizzaStyle, romanFormat, trayWidth, trayLength, flour, blendA, blendB, blendPctA,
      flourStrengthSource,
      ...(flourStrengthSource === 'w' && Number.isFinite(parsedFlourStrength) && parsedFlourStrength > 0 ? { flourW: parsedFlourStrength } : {}),
      ...(flourStrengthSource === 'protein' && Number.isFinite(parsedFlourStrength) && parsedFlourStrength > 0 ? { flourProteinPct: parsedFlourStrength } : {}),
      pizzas, diameter, customBallWeight, method, bigaPct, poolishPct, bigaHours, poolishHours,
      hydration, saltPct, oilPct, roomTemp, roomHours, fridgeTemp, fridgeHours, useIce, oven, ovenTemp, mixing,
    },
    pizzas, diameter, hydration, method, flourType: flourName(lang, flour),
    style_id: pizzaStyle,
    style_params: { ballWeight: effectiveBall, hydration, saltPct, oilPct, diameter, bigaPct, poolishPct },
    ballWeight: effectiveBall,
    flour: dough.total.flour, water: dough.total.water,
    salt: dough.total.salt, oil: dough.total.oil, yeast: dough.total.yeast,
    psyllium: dough.total.psyllium ?? 0,
    sauce: dims.sauce * pizzas, cheese: dims.cheese * pizzas,
  });

  const saveRecipe = async () => {
    const recipe = buildRecipe();
    await AsyncStorage.setItem('lastRecipe', JSON.stringify(recipe));
    return recipe;
  };

  const applyBeginnerNormalized = (saved: Record<string, any>) => {
    const normalized = normalizeBeginnerSavedState(saved);
    const normalizedDiameter = normalized.customBallWeight !== null && normalized.pizzaStyle !== 'romana'
      ? beginnerDiameterForBallWeight(normalized.pizzaStyle, normalized.customBallWeight)
      : normalized.diameter;
    const normalizedBallWeight = normalized.customBallWeight !== null && normalized.pizzaStyle !== 'romana'
      ? beginnerBallWeightForDiameter(normalized.pizzaStyle, normalizedDiameter)
      : normalized.customBallWeight;
    setFlour(normalized.flour);
    setBlendA(normalized.blendA);
    setBlendB(normalized.blendB);
    setBlendPctA(normalized.blendPctA);
    setPizzaStyle(normalized.pizzaStyle);
    setRomanFormat(normalized.romanFormat);
    setDiameter(normalizedDiameter);
    setTrayWidth(normalized.trayWidth);
    setTrayLength(normalized.trayLength);
    setTrayWidthInput(String(normalized.trayWidth));
    setTrayLengthInput(String(normalized.trayLength));
    setCustomBallWeight(normalizedBallWeight);
    setCustomBallInput(normalizedBallWeight === null ? '' : String(normalizedBallWeight));
    setHydration(normalized.hydration);
    setSaltPct(normalized.saltPct);
    setOilPct(normalized.oilPct);
    setOven(normalized.oven);
    setOvenTemp(normalized.ovenTemp);
    setOvenTempInput(String(normalized.ovenTemp));
    setMethod(normalized.method);
    setUseIce(normalized.useIce);
  };

  const applyRecipe = (recipe: any) => {
    const settings = recipe.settings || recipe;
    if (settings.pizzaStyle) setPizzaStyle(settings.pizzaStyle);
    if (settings.romanFormat) setRomanFormat(settings.romanFormat);
    if (typeof settings.trayWidth === 'number') { setTrayWidth(settings.trayWidth); setTrayWidthInput(String(settings.trayWidth)); }
    if (typeof settings.trayLength === 'number') { setTrayLength(settings.trayLength); setTrayLengthInput(String(settings.trayLength)); }
    if (settings.flour) setFlour(settings.flour);
    if (settings.flourStrengthSource === 'w' || settings.flourStrengthSource === 'protein' || settings.flourStrengthSource === 'unknown') {
      setFlourStrengthSource(settings.flourStrengthSource);
      const strength = settings.flourStrengthSource === 'w' ? settings.flourW : settings.flourProteinPct;
      setFlourStrengthValue(typeof strength === 'number' ? String(strength) : '');
    } else {
      setFlourStrengthSource('unknown');
      setFlourStrengthValue('');
    }
    if (settings.blendA) setBlendA(settings.blendA);
    if (settings.blendB) setBlendB(settings.blendB);
    if (typeof settings.blendPctA === 'number') setBlendPctA(settings.blendPctA);
    if (typeof settings.pizzas === 'number') setPizzas(settings.pizzas);
    if (typeof settings.diameter === 'number') setDiameter(settings.diameter);
    if (settings.customBallWeight !== undefined) setCustomBallWeight(settings.customBallWeight);
    if (settings.method) setMethod(settings.method);
    if (typeof settings.bigaPct === 'number') setBigaPct(settings.bigaPct);
    if (typeof settings.poolishPct === 'number') setPoolishPct(settings.poolishPct);
    if (typeof settings.bigaHours === 'number') setBigaHours(settings.bigaHours);
    if (typeof settings.poolishHours === 'number') setPoolishHours(settings.poolishHours);
    if (typeof settings.hydration === 'number') setHydration(settings.hydration);
    if (typeof settings.saltPct === 'number') setSaltPct(settings.saltPct);
    if (typeof settings.oilPct === 'number') setOilPct(settings.oilPct);
    if (typeof settings.roomTemp === 'number') setRoomTemp(settings.roomTemp);
    if (typeof settings.roomHours === 'number') setRoomHours(settings.roomHours);
    if (typeof settings.fridgeTemp === 'number') setFridgeTemp(settings.fridgeTemp);
    if (typeof settings.fridgeHours === 'number') setFridgeHours(settings.fridgeHours);
    if (typeof settings.useIce === 'boolean') setUseIce(settings.useIce);
    if (settings.oven) setOven(settings.oven);
    if (typeof settings.ovenTemp === 'number') { setOvenTemp(settings.ovenTemp); setOvenTempInput(String(settings.ovenTemp)); }
    if (settings.mixing) setMixing(settings.mixing);
    if (isBeginner) applyBeginnerNormalized(settings);
  };

  const saveNamedRecipe = async (name: string, recipeId?: string | null) => {
    const recipe = await saveRecipe();
    const saved = recipeId
      ? await api(`/api/recipes/${recipeId}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim(), recipe }) })
      : await api('/api/recipes', { method: 'POST', body: JSON.stringify({ name: name.trim(), recipe }) });
    setEditingRecipe({ id: saved.recipe_id, name: saved.name });
    return saved as SavedRecipe;
  };

  const openSavedRecipes = () => {
    if (!user) { router.push('/login'); return; }
    setMoreTool('savedRecipes');
  };

  const onShare = async () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    await saveRecipe();
    if (!user) { router.push('/login'); return; }
    router.push('/new-post');
  };

  const onShopping = async () => {
    try { Haptics.selectionAsync(); } catch {}
    await saveRecipe();
    setMoreTool('shopping');
  };

  const bakingTimeRange = formatBakingTimeRange(oven, ovenTemp, lang);
  const bakingDuration = `${formatTemperature(ovenTemp, temperatureUnit)} · ${bakingTimeRange}`;
  const ovenTempLabel = { hr: 'Temperatura pećnice', en: 'Oven temperature', de: 'Ofentemperatur', sl: 'Temperatura pečice' }[lang];
  const directStepIngredients = { ...dough.total, flour: beginnerDisplayFlour };
  const detailedDirectSteps = method === 'direct' && lang === 'hr'
    ? getDetailedDirectSteps(mixing, directStepIngredients, dough.totalDough, pizzas, effectiveBall, diameter, directRecipeFridgeHours, directRecipeRoomHours, oven, ovenTemp, roomTemp, dims.cheese, undefined, undefined, flour, pizzaStyle === 'romana' && romanFormat === 'tonda', isRomanTeglia, pizzaStyle === 'ny_style' && isBeginner, pizzaStyle === 'neapolitan', { width: trayWidth, length: trayLength }, bakingTimeRange, isBeginner && pizzaStyle === 'neapolitan', waterTemperatureCalculation?.recommendedWaterTemp, isBeginner, isBeginner ? getBeginnerPhaseAFlourBehavior(flour, blendA, blendB) : undefined, waterTemperatureCalculation?.targetFinalDoughTemp)
    : method === 'biga' && lang === 'hr'
      ? getDetailedDirectSteps(mixing, dough.total, dough.totalDough, pizzas, effectiveBall, diameter, fridgeHours, roomHours, oven, ovenTemp, roomTemp, dims.cheese, {
        flour: dough.preferment?.flour ?? 0,
        water: dough.preferment?.water ?? 0,
        yeast: dough.preferment?.yeast ?? 0,
        remainingFlour: dough.main.flour,
        remainingWater: dough.main.water,
        pct: bigaPct,
      }, undefined, flour, pizzaStyle === 'romana' && romanFormat === 'tonda', isRomanTeglia, false, pizzaStyle === 'neapolitan', { width: trayWidth, length: trayLength }, bakingTimeRange)
    : method === 'poolish' && lang === 'hr'
      ? getDetailedDirectSteps(mixing, dough.total, dough.totalDough, pizzas, effectiveBall, diameter, fridgeHours, roomHours, oven, ovenTemp, roomTemp, dims.cheese, undefined, {
        flour: dough.preferment?.flour ?? 0,
        water: dough.preferment?.water ?? 0,
        yeast: dough.preferment?.yeast ?? 0,
        remainingFlour: dough.main.flour,
        remainingWater: dough.main.water,
        pct: poolishPct,
      }, flour, pizzaStyle === 'romana' && romanFormat === 'tonda', isRomanTeglia, false, pizzaStyle === 'neapolitan', { width: trayWidth, length: trayLength }, bakingTimeRange)
    : method === 'direct' && (lang === 'de' || lang === 'en' || lang === 'sl') && (oven === 'homeStone' || oven === 'ooni' || oven === 'homePan')
      ? getDetailedDirectStepsLocalized(lang, directStepIngredients, dough.totalDough, pizzas, effectiveBall, diameter, directRecipeFridgeHours, directRecipeRoomHours, roomTemp, dims.cheese, oven, ovenTemp, bakingTimeRange, mixing, isRomanTeglia ? 'romanaTeglia' : pizzaStyle === 'romana' ? 'romanaTonda' : pizzaStyle === 'ny_style' && isBeginner ? 'newYork' : 'napolitana', flour, { width: trayWidth, length: trayLength }, isBeginner && pizzaStyle === 'neapolitan', waterTemperatureCalculation?.recommendedWaterTemp, isBeginner, isBeginner ? getBeginnerPhaseAFlourBehavior(flour, blendA, blendB) : undefined, waterTemperatureCalculation?.targetFinalDoughTemp)
    : null;
  const beginnerDirectRecipeSteps = isBeginner && method === 'direct' && detailedDirectSteps
    ? detailedDirectSteps.map((phase, phaseIndex) => ({
      ...phase,
      steps: phase.steps.map((step) => {
        const labelled = labelSelectedYeast(step, lang, preferredYeastType);
        if (!isCustom || phaseIndex !== 0) return labelled;
        const blendAmountA = Math.round(dough.main.flour * blendPctA / 100);
        const blendDetail = ` (${blendAmountA} g ${flourName(lang, blendA)} + ${Math.round(dough.main.flour) - blendAmountA} g ${flourName(lang, blendB)})`;
        const blendFlourLabel = {
          hr: 'mješavine brašna',
          en: 'flour blend',
          de: 'Mehlmischung',
          sl: 'mešanice moke',
        }[lang];
        const neutralLabelled = labelled.replace(
          /(\d+(?:\.\d+)? g )(?:of flour|(?:pirovog )?brašna|Mehl|moke)/,
          `$1${blendFlourLabel}`,
        );
        return neutralLabelled.replace(/(\d+(?:\.\d+)? g (?:mješavine brašna|flour blend|Mehlmischung|mešanice moke))/, `$1${blendDetail}`);
      }),
    }))
    : null;
  const beginnerDirectHomeSteps = beginnerDirectHome && beginnerDirectRecipeSteps
    ? isRomanTeglia
      ? buildBeginnerTegliaHomeSteps(beginnerDirectRecipeSteps, directHomeSchedule, beginnerPhaseBPlan!, roomTemp, lang, ovenTemp, bakingTimeRange, { width: trayWidth, length: trayLength }, flour, dims.sauce, dims.cheese, temperatureUnit)
      : buildBeginnerDirectHomeSteps(beginnerDirectRecipeSteps, directHomeSchedule, beginnerPhaseBPlan!, roomTemp, fridgeTemp, ovenTemp, oven, bakingTimeRange, lang, preferredYeastType, pizzaStyle, diameter, dims.sauce, dims.cheese, flour, weight(dough.totalDough), weight(effectiveBall), pizzas)
    : null;
  const beginnerUnscheduledDirectSteps = beginnerDirectRecipeSteps && !directHomeSchedule
    ? buildBeginnerUnscheduledDirectSteps(beginnerDirectRecipeSteps, fridgeTemp, lang)
    : null;
  const bigaPreparation = method === 'biga'
    ? {
      title: ({ hr: 'Faza A: Priprema Bige', en: 'Phase A: Biga preparation', de: 'Phase A: Biga-Vorbereitung', sl: 'Faza A: Priprava bige' }[lang]),
      info: ({ hr: `Biga čini ${bigaPct}% ukupnog brašna.`, en: `The biga makes up ${bigaPct}% of the total flour.`, de: `Die Biga enthält ${bigaPct}% des Gesamtmehls.`, sl: `Biga predstavlja ${bigaPct}% celotne moke.` }[lang]),
      steps: [
        ({ hr: 'Operite i temeljito osušite ruke.', en: 'Wash and thoroughly dry your hands.', de: 'Waschen und trocknen Sie Ihre Hände gründlich.', sl: 'Umijte in temeljito osušite roke.' }[lang]),
        ({ hr: `Pripremite ${dough.preferment?.flour ?? 0} g brašna, ${dough.preferment?.water ?? 0} g vode i ${dough.preferment?.yeast ?? 0} g kvasca.`, en: `Prepare ${dough.preferment?.flour ?? 0} g flour, ${dough.preferment?.water ?? 0} g water, and ${dough.preferment?.yeast ?? 0} g yeast.`, de: `Bereiten Sie ${dough.preferment?.flour ?? 0} g Mehl, ${dough.preferment?.water ?? 0} g Wasser und ${dough.preferment?.yeast ?? 0} g Hefe vor.`, sl: `Pripravite ${dough.preferment?.flour ?? 0} g moke, ${dough.preferment?.water ?? 0} g vode in ${dough.preferment?.yeast ?? 0} g kvasa.` }[lang]),
        ({ hr: `Rukama kratko povežite sastojke; smjesa treba ostati mrvičasta. Ostavite Bigu ${croatianHours(prefermentRoomHours)} na ${roomTemp} °C.`, en: `Briefly combine the ingredients; keep the mixture crumbly. Leave the Biga for ${prefermentRoomHours} hours at ${roomTemp} °C.`, de: `Vermengen Sie die Zutaten kurz; die Masse soll krümelig bleiben. Lassen Sie die Biga ${prefermentRoomHours} Stunden bei ${roomTemp} °C stehen.`, sl: `Sestavine na kratko povežite; zmes naj ostane drobtinasta. Bigo pustite ${prefermentRoomHours} ur pri ${roomTemp} °C.` }[lang]),
        ({ hr: `Pokrijte Bigu i prebacite je u hladnjak na ${croatianHours(prefermentFridgeHours)} pri ${fridgeTemp} °C. Ukupno: ${croatianHours(bigaHours)}.`, en: `Cover the Biga and refrigerate it for ${prefermentFridgeHours} hours at ${fridgeTemp} °C. Total: ${bigaHours} hours.`, de: `Decken Sie die Biga ab und stellen Sie sie ${prefermentFridgeHours} Stunden bei ${fridgeTemp} °C in den Kühlschrank. Gesamt: ${bigaHours} Stunden.`, sl: `Bigo pokrijte in jo prestavite v hladilnik za ${prefermentFridgeHours} ur pri ${fridgeTemp} °C. Skupaj: ${bigaHours} ur.` }[lang]),
      ],
      timers: [{ id: `biga-fermentation-${mixing}`, seconds: bigaHours * 3600, kind: 'preferment' as const }],
    }
    : null;
  const bigaHomePreparationSteps = beginnerNeapolitanBigaHome && bigaPreparation ? (() => {
    const duration = (hours: number) => formatDuration(hours * 3600, lang);
    const bigaIngredients = ({
      hr: `Prije planiranog početka izmjerite ${weight(dough.preferment?.flour ?? 0)} brašna, ${weight(dough.preferment?.water ?? 0)} vode i ${weight(dough.preferment?.yeast ?? 0, true)} (${yeastShortLabel}) za Bigu.`,
      en: `Before scheduled Start, measure ${weight(dough.preferment?.flour ?? 0)} flour, ${weight(dough.preferment?.water ?? 0)} water, and ${weight(dough.preferment?.yeast ?? 0, true)} (${yeastShortLabel}) for the Biga.`,
      de: `Wiegen Sie vor dem geplanten Start ${weight(dough.preferment?.flour ?? 0)} Mehl, ${weight(dough.preferment?.water ?? 0)} Wasser und ${weight(dough.preferment?.yeast ?? 0, true)} (${yeastShortLabel}) für die Biga ab.`,
      sl: `Pred načrtovanim začetkom odmerite ${weight(dough.preferment?.flour ?? 0)} moke, ${weight(dough.preferment?.water ?? 0)} vode in ${weight(dough.preferment?.yeast ?? 0, true)} (${yeastShortLabel}) za bigo.`,
    }[lang]);
    const noBigaFridgePhase = ({
      hr: 'Plan ne uključuje sazrijevanje Bige u hladnjaku; nastavite sa završnim zamjesom u planirano vrijeme.',
      en: 'The schedule has no Biga refrigerator phase; continue with the final mix at its scheduled time.',
      de: 'Der Plan sieht keine Kühlschrankphase für die Biga vor; fahren Sie zum geplanten Zeitpunkt mit dem Hauptteig fort.',
      sl: 'Načrt ne vključuje hlajenja bige; ob načrtovanem času nadaljujte s končnim mešanjem.',
    }[lang]);
    const mixBiga = ({
      hr: {
        hand: 'U planirano vrijeme početka ravnomjerno rasporedite kvasac po brašnu, dodajte vodu i rukama kratko povežite sastojke u grubu, mrvičastu smjesu; nemojte mijesiti glatko tijesto.',
        mixer: 'U planirano vrijeme početka ravnomjerno rasporedite kvasac po brašnu u posudi miksera, dodajte vodu, postavite kuku za tijesto i kratko miješajte u 1. brzini; zaustavite dok je smjesa još gruba i mrvičasta.',
      },
      en: {
        hand: 'At scheduled Start, distribute the yeast through the flour, add the water and briefly combine by hand into a rough, crumbly mixture; do not knead it smooth.',
        mixer: 'At scheduled Start, distribute the yeast through the flour in the mixer bowl, add the water, fit the dough hook, and briefly mix on speed 1; stop while the mixture is still rough and crumbly.',
      },
      de: {
        hand: 'Verteilen Sie die Hefe zum geplanten Start im Mehl, geben Sie das Wasser dazu und vermengen Sie alles kurz von Hand zu einer groben, krümeligen Masse; kneten Sie sie nicht glatt.',
        mixer: 'Verteilen Sie die Hefe zum geplanten Start im Mehl in der Mixerschüssel, geben Sie das Wasser dazu, setzen Sie den Knethaken ein und mischen Sie kurz auf Stufe 1; stoppen Sie, solange die Masse grob und krümelig ist.',
      },
      sl: {
        hand: 'Ob načrtovanem začetku kvas enakomerno razporedite po moki, dodajte vodo in sestavine na kratko povežite z roko v grobo, drobtinasto zmes; ne gnetite je do gladkega.',
        mixer: 'Ob načrtovanem začetku kvas enakomerno razporedite po moki v posodi mešalnika, dodajte vodo, namestite kavelj za testo in na kratko mešajte pri hitrosti 1; ustavite, ko je zmes še groba in drobtinasta.',
      },
    }[lang][mixing]);
    const roomMaturation = ({
      hr: `Pokrijte Bigu. Sobna faza traje ${duration(bigaHomeSchedule.bigaRoomHours)} pri ${formatTemperature(roomTemp, temperatureUnit)} od planiranog početka do sljedećeg prijelaza; miješanje je unutar tog vremena.`,
      en: `Cover the Biga. Its room phase runs for ${duration(bigaHomeSchedule.bigaRoomHours)} at ${formatTemperature(roomTemp, temperatureUnit)} from scheduled Start to the next stage; mixing is included in this window.`,
      de: `Decken Sie die Biga ab. Ihre Raumphase dauert ${duration(bigaHomeSchedule.bigaRoomHours)} bei ${formatTemperature(roomTemp, temperatureUnit)} vom geplanten Start bis zum nächsten Schritt; das Mischen ist in diesem Zeitfenster enthalten.`,
      sl: `Bigo pokrijte. Sobna faza traja ${duration(bigaHomeSchedule.bigaRoomHours)} pri ${formatTemperature(roomTemp, temperatureUnit)} od načrtovanega začetka do naslednje faze; mešanje je vključeno v ta čas.`,
    }[lang]);
    const fridgeMaturation = ({
      hr: `Nakon sobne faze stavite pokrivenu Bigu u hladnjak na ${duration(bigaHomeSchedule.bigaFridgeHours)} pri ${formatTemperature(fridgeTemp, temperatureUnit)}.`,
      en: `After the room phase, refrigerate the covered Biga for ${duration(bigaHomeSchedule.bigaFridgeHours)} at ${formatTemperature(fridgeTemp, temperatureUnit)}.`,
      de: `Stellen Sie die abgedeckte Biga nach der Raumphase für ${duration(bigaHomeSchedule.bigaFridgeHours)} bei ${formatTemperature(fridgeTemp, temperatureUnit)} in den Kühlschrank.`,
      sl: `Po sobni fazi pokrito bigo prestavite v hladilnik za ${duration(bigaHomeSchedule.bigaFridgeHours)} pri ${formatTemperature(fridgeTemp, temperatureUnit)}.`,
    }[lang]);
    return [
      ({ hr: 'Pred planiranim početkom operite i temeljito osušite ruke.', en: 'Before scheduled Start, wash and thoroughly dry your hands.', de: 'Waschen und trocknen Sie Ihre Hände vor dem geplanten Start gründlich.', sl: 'Pred načrtovanim začetkom si temeljito umijte in osušite roke.' }[lang]),
      bigaIngredients,
      mixBiga,
      roomMaturation,
      ...(bigaHomeSchedule.bigaFridgeHours > 0 ? [fridgeMaturation] : []),
      ...(bigaHomeSchedule.bigaFridgeHours === 0 ? [noBigaFridgePhase] : []),
    ];
  })() : null;
  const poolishPreparation = method === 'poolish'
    ? {
      title: ({ hr: 'Faza A: Priprema Poolisha', en: 'Phase A: Poolish preparation', de: 'Phase A: Poolish-Vorbereitung', sl: 'Faza A: Priprava Poolisha' }[lang]),
      info: ({
        hr: `Poolish čini ${poolishPct}% ukupnog brašna uz 100% hidrataciju predfermenta.`,
        en: `The Poolish uses ${poolishPct}% of the total flour at 100% preferment hydration.`,
        de: `Der Poolish enthält ${poolishPct}% des Gesamtmehls bei 100% Vorteighydration.`,
        sl: `Poolish vsebuje ${poolishPct}% celotne moke pri 100% hidraciji predtesta.`,
      }[lang]),
      steps: [
        ({ hr: 'Operite i temeljito osušite ruke.', en: 'Wash and thoroughly dry your hands.', de: 'Waschen und trocknen Sie Ihre Hände gründlich.', sl: 'Umijte in temeljito osušite roke.' }[lang]),
        ...((mixing !== 'hand' && !isRomanTeglia) ? [({ hr: 'Pripremite posudu i pjenjaču ili vilicu.', en: 'Prepare a bowl and a whisk or fork.', de: 'Bereiten Sie eine Schüssel und einen Schneebesen oder eine Gabel vor.', sl: 'Pripravite skledo in metlico ali vilice.' }[lang])] : []),
        ({
          hr: `Pripremite ${dough.preferment?.flour ?? 0} g brašna, ${dough.preferment?.water ?? 0} g vode i ${dough.preferment?.yeast ?? 0} g kvasca za Poolish.`,
          en: `Prepare ${dough.preferment?.flour ?? 0} g flour, ${dough.preferment?.water ?? 0} g water, and ${dough.preferment?.yeast ?? 0} g yeast for the Poolish.`,
          de: `Bereiten Sie ${dough.preferment?.flour ?? 0} g Mehl, ${dough.preferment?.water ?? 0} g Wasser und ${dough.preferment?.yeast ?? 0} g Hefe für den Poolish vor.`,
          sl: `Pripravite ${dough.preferment?.flour ?? 0} g moke, ${dough.preferment?.water ?? 0} g vode in ${dough.preferment?.yeast ?? 0} g kvasa za Poolish.`,
        }[lang]),
        ({
          hr: `U vodi za Poolish otopite ${dough.preferment?.yeast ?? 0} g kvasca.`,
          en: `Dissolve ${dough.preferment?.yeast ?? 0} g yeast in the Poolish water.`,
          de: `Lösen Sie ${dough.preferment?.yeast ?? 0} g Hefe im Poolish-Wasser auf.`,
          sl: `V vodi za Poolish raztopite ${dough.preferment?.yeast ?? 0} g kvasa.`,
        }[lang]),
        ({
          hr: `Dodajte ${dough.preferment?.flour ?? 0} g brašna i miješajte pjenjačom ili vilicom dok smjesa ne bude glatka i tekuća.`,
          en: `Add ${dough.preferment?.flour ?? 0} g flour and mix with a whisk or fork until smooth and liquid.`,
          de: `Geben Sie ${dough.preferment?.flour ?? 0} g Mehl dazu und mischen Sie, bis die Masse glatt und flüssig ist.`,
          sl: `Dodajte ${dough.preferment?.flour ?? 0} g moke in mešajte, dokler zmes ni gladka in tekoča.`,
        }[lang]),
        ({
          hr: `Pokrijte Poolish i ostavite ga ${croatianHours(prefermentRoomHours)} na ${roomTemp} °C.`,
          en: `Cover the Poolish and leave it at ${roomTemp} °C for ${prefermentRoomHours} hours.`,
          de: `Decken Sie den Poolish ab und lassen Sie ihn ${prefermentRoomHours} Stunden bei ${roomTemp} °C stehen.`,
          sl: `Poolish pokrijte in ga pustite ${prefermentRoomHours} ur pri ${roomTemp} °C.`,
        }[lang]),
        ({
          hr: `Prebacite Poolish u hladnjak na ${croatianHours(prefermentFridgeHours)} pri ${fridgeTemp} °C. Ukupna fermentacija Poolisha traje ${croatianHours(poolishHours)}.`,
          en: `Move the Poolish to the refrigerator at ${fridgeTemp} °C for ${prefermentFridgeHours} hours. Total Poolish fermentation: ${poolishHours} hours.`,
          de: `Stellen Sie den Poolish für ${prefermentFridgeHours} Stunden bei ${fridgeTemp} °C in den Kühlschrank. Gesamte Poolish-Fermentation: ${poolishHours} Stunden.`,
          sl: `Poolish prestavite v hladilnik pri ${fridgeTemp} °C za ${prefermentFridgeHours} ur. Skupna fermentacija Poolisha traja ${poolishHours} ur.`,
        }[lang]),
      ],
      timers: [
        { id: 'poolish-fermentation', seconds: poolishHours * 3600, kind: 'preferment' as const },
      ],
    }
    : null;
  const poolishMixSteps = method === 'poolish' ? ({
    hr: [
      'Operite i temeljito osušite ruke.',
      'Zreli Poolish prelijte u posudu za ručni zamjes.',
      `Dodajte preostalih ${dough.main.flour} g brašna i lagano povežite Poolish s brašnom.`,
      `Dodajte ${Math.round(dough.main.water * 0.9)} g preostale vode, zatim postupno dodajte još ${Math.max(0, dough.main.water - Math.round(dough.main.water * 0.9))} g vode.`,
      `Dodajte ${dough.total.salt} g soli kao zaseban korak i nastavite mijesiti.`,
      `Dodajte ${dough.total.oil} g maslinovog ulja i mijesite dok ga tijesto potpuno ne upije.`,
    ],
    en: [
      'Wash and thoroughly dry your hands.',
      'Pour the mature Poolish into the hand-mixing bowl.',
      `Add the remaining ${dough.main.flour} g of flour and gently combine it with the Poolish.`,
      `Add ${Math.round(dough.main.water * 0.9)} g of the remaining water, then gradually add the final ${Math.max(0, dough.main.water - Math.round(dough.main.water * 0.9))} g.`,
      `Add ${dough.total.salt} g of salt as a separate step and continue kneading.`,
      `Add ${dough.total.oil} g of olive oil and knead until fully absorbed.`,
    ],
    de: [
      'Waschen und trocknen Sie Ihre Hände gründlich.',
      'Gießen Sie den reifen Poolish in die Knetschüssel.',
      `Geben Sie ${dough.main.flour} g restliches Mehl dazu und verbinden Sie es vorsichtig mit dem Poolish.`,
      `Geben Sie ${Math.round(dough.main.water * 0.9)} g des restlichen Wassers hinzu und anschließend die letzten ${Math.max(0, dough.main.water - Math.round(dough.main.water * 0.9))} g nach und nach.`,
      `Geben Sie ${dough.total.salt} g Salz als separaten Schritt hinzu und kneten Sie weiter.`,
      `Geben Sie ${dough.total.oil} g Olivenöl hinzu und kneten Sie, bis es vollständig aufgenommen ist.`,
    ],
    sl: [
      'Umijte in temeljito osušite roke.',
      'Zreli Poolish prelijte v posodo za ročno gnetenje.',
      `Dodajte preostalih ${dough.main.flour} g moke in jo nežno povežite s Poolishem.`,
      `Dodajte ${Math.round(dough.main.water * 0.9)} g preostale vode, nato postopoma še zadnjih ${Math.max(0, dough.main.water - Math.round(dough.main.water * 0.9))} g.`,
      `Dodajte ${dough.total.salt} g soli kot ločen korak in nadaljujte z gnetenjem.`,
      `Dodajte ${dough.total.oil} g oljčnega olja in gnetite, dokler se popolnoma ne vpije.`,
    ],
  }[lang]) : null;
  const bigaHomeRecipePhases = beginnerNeapolitanBigaHome ? (() => {
    const schedule = bigaHomeSchedule;
    const duration = (hours: number) => formatDuration(hours * 3600, lang);
    const roomTemperature = formatTemperature(roomTemp, temperatureUnit);
    const coldTemperature = formatTemperature(fridgeTemp, temperatureUnit);
    const bakeTemperature = formatTemperature(ovenTemp, temperatureUnit);
    const preheatMinutes = oven === 'homeStone' ? 60 : 20;
    const shapingWindowHours = Math.min(0.25, schedule.finalBallRestHours);
    const finalRestBeforeShaping = Math.max(0, schedule.finalBallRestHours - shapingWindowHours);
    const remainingWater = ice
      ? ({
        hr: `Postupno dodajte preostalih ${weight(Math.max(0, dough.main.water - ice.ice))} vode i ${weight(ice.ice)} leda; zajedno čine ${weight(dough.main.water)} preostale vode.`,
        en: `Gradually add ${weight(Math.max(0, dough.main.water - ice.ice))} remaining water and ${weight(ice.ice)} ice; together they equal ${weight(dough.main.water)} remaining water.`,
        de: `Geben Sie nach und nach ${weight(Math.max(0, dough.main.water - ice.ice))} restliches Wasser und ${weight(ice.ice)} Eis hinzu; zusammen ergeben sie ${weight(dough.main.water)} restliches Wasser.`,
        sl: `Postopoma dodajte ${weight(Math.max(0, dough.main.water - ice.ice))} preostale vode in ${weight(ice.ice)} ledu; skupaj je to ${weight(dough.main.water)} preostale vode.`,
      }[lang])
      : ({
        hr: `Postupno dodajte svih ${weight(dough.main.water)} preostale vode na ${formatTemperature(dough.waterTemp, temperatureUnit)}.`,
        en: `Gradually add all ${weight(dough.main.water)} remaining water at ${formatTemperature(dough.waterTemp, temperatureUnit)}.`,
        de: `Geben Sie die gesamten ${weight(dough.main.water)} restliches Wasser nach und nach bei ${formatTemperature(dough.waterTemp, temperatureUnit)} hinzu.`,
        sl: `Postopoma dodajte vseh ${weight(dough.main.water)} preostale vode pri ${formatTemperature(dough.waterTemp, temperatureUnit)}.`,
      }[lang]);
    const copy = ({
      hr: {
        finalMixTitle: 'Faza B: Završni zamjes',
        finalDoughTitle: 'Faza C: Fermentacija završnog tijesta',
        ballingTitle: 'Faza D: Oblikovanje kuglica',
        bakeTitle: 'Faza E: Završni odmor, oblikovanje i pečenje',
        finalMixStart: 'U planirano vrijeme završnog zamjesa narežite ili natrgajte zrelu Bigu u posudu za zamjes.',
        flourAndYeast: `Dodajte ${weight(bigaHomeDisplayMainFlour)} preostalog brašna i ${weight(dough.main.yeast, true)} završnog kvasca (${yeastShortLabel}); povežite ih s Bigom.`,
        salt: `Kad se brašno i voda povežu, dodajte ${weight(dough.main.salt)} soli i nastavite mijesiti.`,
        oil: `Na kraju dodajte ${weight(dough.main.oil)} maslinovog ulja i mijesite dok se potpuno ne upije.`,
        roomBulk: (time: string) => `Pokrijte završno tijesto. Sobna faza traje ${time} pri ${roomTemperature} od planiranog završnog zamjesa; zamjes je dio ovog prozora. Prebacite tijesto u hladnjak u planirano vrijeme.`,
        fridgeBulk: (time: string) => `Prebacite pokriveno završno tijesto u hladnjak na ${time} pri ${coldTemperature}; završite ovu fazu u planirano vrijeme oblikovanja kuglica.`,
        ball: `Točno u planirano vrijeme oblikovanja podijelite ${weight(dough.totalDough)} tijesta na ${pizzas} kuglica od ${weight(effectiveBall)} i zategnite ih u glatke kugle.`,
        finalRest: (before: string, total: string) => `Držite kuglice pokrivene. Završni odmor traje ${total} na ${roomTemperature} od planiranog vremena kuglanja do pečenja; oblikujte i nadjenite ih tijekom zadnjih ${duration(shapingWindowHours)} nakon ${before} odmora te lansirajte u planirano vrijeme.`,
        preheatStone: (minutes: number) => `U planirano vrijeme zagrijavanja postavite kamen ili čelik dvije rešetke ispod gornjeg grijača i zagrijte ga ${minutes} minuta na ${bakeTemperature} uz uključen grill.`,
        preheatOther: (minutes: number) => `U planirano vrijeme zagrijavanja zagrijte pećnicu ${minutes} minuta na ${bakeTemperature}.`,
        shape: `Na semoli razvucite kuglu prstima od sredine prema rubu, ostavite rub oko 1–2 cm i oblikujte pizzu promjera ${diameter} cm; ne koristite valjak.`,
        sauce: `Ravnomjerno rasporedite ${weight(dims.sauce)} umaka po sredini i ostavite rub bez nadjeva.`,
        cheese: `Dodajte približno ${weight(dims.cheese)} mozzarelle i nemojte preopteretiti pizzu.`,
        launch: 'Lansirajte pizzu u pećnicu točno u planirano vrijeme pečenja.',
        stoneBake: (time: string) => `Isključite grill i koristite Pizza program ako je dostupan; inače odaberite gornji i donji grijač bez ventilatora. Pecite ukupno ${time} na ${bakeTemperature}, koristeći grill pri kraju za boju.` ,
        ooniBake: (time: string) => `Pecite ukupno ${time} na ${bakeTemperature} i rotirajte pizzu svakih 20–30 sekundi.`,
        panBake: (time: string) => `Pecite ukupno ${time} na ${bakeTemperature}; provjerite da je dno pečeno.`,
      },
      en: {
        finalMixTitle: 'Phase B: Final dough mix',
        finalDoughTitle: 'Phase C: Final dough fermentation',
        ballingTitle: 'Phase D: Balling',
        bakeTitle: 'Phase E: Final rest, shaping and baking',
        finalMixStart: 'At the scheduled final-mix time, cut or tear the mature Biga into the mixing bowl.',
        flourAndYeast: `Add ${weight(bigaHomeDisplayMainFlour)} remaining flour and ${weight(dough.main.yeast, true)} final-dough yeast (${yeastShortLabel}); combine with the Biga.`,
        salt: `Once the flour and water come together, add ${weight(dough.main.salt)} salt and continue mixing.`,
        oil: `Add ${weight(dough.main.oil)} olive oil at the end and mix until fully absorbed.`,
        roomBulk: (time: string) => `Cover the final dough. Its room phase runs for ${time} at ${roomTemperature} from scheduled Final Mix; mixing is included in this window. Move the dough to the fridge at the scheduled transition.`,
        fridgeBulk: (time: string) => `Refrigerate the covered final dough for ${time} at ${coldTemperature}; finish this phase at the scheduled balling time.`,
        ball: `At the scheduled balling time, divide ${weight(dough.totalDough)} dough into ${pizzas} balls of ${weight(effectiveBall)} and shape each into a smooth, tight ball.`,
        finalRest: (before: string, total: string) => `Keep the dough balls covered. The scheduled final ball rest runs for ${total} at ${roomTemperature} from Balling time to bake time; shape and top during the final ${duration(shapingWindowHours)} after ${before} of rest, then launch at T.`,
        preheatStone: (minutes: number) => `At the scheduled preheat time, place the stone or steel two rack positions below the upper heating element and preheat it for ${minutes} minutes at ${bakeTemperature} with the grill on.`,
        preheatOther: (minutes: number) => `At the scheduled preheat time, preheat the oven for ${minutes} minutes to ${bakeTemperature}.`,
        shape: `Stretch the dough on semolina from the center outward, leave a 1–2 cm rim, and shape to ${diameter} cm; do not use a rolling pin.`,
        sauce: `Spread ${weight(dims.sauce)} sauce over the center, leaving the rim clear.`,
        cheese: `Add approximately ${weight(dims.cheese)} mozzarella without overloading the pizza.`,
        launch: 'Launch the pizza into the oven exactly at the scheduled bake time.',
        stoneBake: (time: string) => `Turn off the grill and select the Pizza program if available; otherwise use top and bottom heat without a fan. Bake for ${time} total at ${bakeTemperature}, using the grill near the end for color.`,
        ooniBake: (time: string) => `Bake for ${time} total at ${bakeTemperature} and rotate the pizza every 20–30 seconds.`,
        panBake: (time: string) => `Bake for ${time} total at ${bakeTemperature}; check that the base is cooked through.`,
      },
      de: {
        finalMixTitle: 'Phase B: Hauptteig mischen',
        finalDoughTitle: 'Phase C: Fermentation des Hauptteigs',
        ballingTitle: 'Phase D: Teiglinge formen',
        bakeTitle: 'Phase E: Endgare, Formen und Backen',
        finalMixStart: 'Zerteilen Sie die reife Biga zum geplanten Zeitpunkt für den Hauptteig in der Knetschüssel.',
        flourAndYeast: `Geben Sie ${weight(bigaHomeDisplayMainFlour)} restliches Mehl und ${weight(dough.main.yeast, true)} Hefe für den Hauptteig (${yeastShortLabel}) dazu und verbinden Sie alles mit der Biga.`,
        salt: `Sobald Mehl und Wasser verbunden sind, geben Sie ${weight(dough.main.salt)} Salz dazu und kneten Sie weiter.`,
        oil: `Geben Sie ${weight(dough.main.oil)} Olivenöl zuletzt dazu und kneten Sie, bis es vollständig aufgenommen ist.`,
        roomBulk: (time: string) => `Decken Sie den Hauptteig ab. Die Raumphase dauert ${time} bei ${roomTemperature} ab dem geplanten Hauptteig-Mischen; das Mischen ist in diesem Zeitfenster enthalten. Stellen Sie den Teig zum geplanten Übergang kalt.`,
        fridgeBulk: (time: string) => `Stellen Sie den abgedeckten Hauptteig für ${time} bei ${coldTemperature} in den Kühlschrank; beenden Sie diese Phase zum geplanten Zeitpunkt fürs Ballen.`,
        ball: `Teilen Sie zum geplanten Ballzeitpunkt ${weight(dough.totalDough)} Teig in ${pizzas} Teiglinge zu je ${weight(effectiveBall)} und formen Sie glatte, straffe Kugeln.`,
        finalRest: (before: string, total: string) => `Halten Sie die Teiglinge abgedeckt. Die geplante Endgare dauert ${total} bei ${roomTemperature} von der Ballzeit bis zum Backen; formen und belegen Sie sie nach ${before} Ruhezeit in den letzten ${duration(shapingWindowHours)} und backen Sie zur geplanten Zeit.`,
        preheatStone: (minutes: number) => `Platzieren Sie den Stein oder Stahl zum geplanten Zeitpunkt zwei Einschubebenen unter dem oberen Heizelement und heizen Sie ihn ${minutes} Minuten bei ${bakeTemperature} mit eingeschaltetem Grill vor.`,
        preheatOther: (minutes: number) => `Heizen Sie den Ofen zum geplanten Zeitpunkt ${minutes} Minuten lang auf ${bakeTemperature} vor.`,
        shape: `Drücken und ziehen Sie den Teig auf Semola von der Mitte nach außen, lassen Sie einen 1–2 cm breiten Rand und formen Sie ihn auf ${diameter} cm; verwenden Sie kein Nudelholz.`,
        sauce: `Verteilen Sie ${weight(dims.sauce)} Sauce in der Mitte und lassen Sie den Rand frei.`,
        cheese: `Belegen Sie die Pizza mit ungefähr ${weight(dims.cheese)} Mozzarella, ohne sie zu überladen.`,
        launch: 'Schieben Sie die Pizza genau zur geplanten Backzeit in den Ofen.',
        stoneBake: (time: string) => `Schalten Sie den Grill aus und wählen Sie, falls vorhanden, das Pizza-Programm; andernfalls Ober-/Unterhitze ohne Umluft. Backen Sie insgesamt ${time} bei ${bakeTemperature} und bräunen Sie am Ende mit dem Grill.`,
        ooniBake: (time: string) => `Backen Sie insgesamt ${time} bei ${bakeTemperature} und drehen Sie die Pizza alle 20–30 Sekunden.`,
        panBake: (time: string) => `Backen Sie insgesamt ${time} bei ${bakeTemperature}; prüfen Sie, ob der Boden durchgebacken ist.`,
      },
      sl: {
        finalMixTitle: 'Faza B: Končno mešanje testa',
        finalDoughTitle: 'Faza C: Fermentacija končnega testa',
        ballingTitle: 'Faza D: Oblikovanje kroglic',
        bakeTitle: 'Faza E: Končni počitek, oblikovanje in peka',
        finalMixStart: 'Ob načrtovanem času končnega mešanja zrelo bigo narežite ali natrgajte v posodo za gnetenje.',
        flourAndYeast: `Dodajte ${weight(bigaHomeDisplayMainFlour)} preostale moke in ${weight(dough.main.yeast, true)} kvasa za končno testo (${yeastShortLabel}) ter povežite z bigo.`,
        salt: `Ko se moka in voda povežeta, dodajte ${weight(dough.main.salt)} soli in nadaljujte z gnetenjem.`,
        oil: `Na koncu dodajte ${weight(dough.main.oil)} oljčnega olja in gnetite, dokler se popolnoma ne vpije.`,
        roomBulk: (time: string) => `Končno testo pokrijte. Sobna faza traja ${time} pri ${roomTemperature} od načrtovanega končnega mešanja; mešanje je vključeno v ta čas. Testo prestavite v hladilnik ob načrtovanem prehodu.`,
        fridgeBulk: (time: string) => `Pokrito končno testo hladite ${time} pri ${coldTemperature}; to fazo zaključite ob načrtovanem času oblikovanja kroglic.`,
        ball: `Ob načrtovanem času oblikovanja razdelite ${weight(dough.totalDough)} testa na ${pizzas} kroglic po ${weight(effectiveBall)} in jih oblikujte v gladke, napete krogle.`,
        finalRest: (before: string, total: string) => `Kroglice hranite pokrite. Načrtovani končni počitek traja ${total} pri ${roomTemperature} od oblikovanja do peke; po ${before} počitka jih v zadnjih ${duration(shapingWindowHours)} oblikujte in obložite ter pico vstavite ob načrtovanem času.`,
        preheatStone: (minutes: number) => `Ob načrtovanem času segrevanja postavite kamen ali jeklo dve rešetki pod zgornji grelni element in ga ${minutes} minut segrevajte pri ${bakeTemperature} z vklopljenim žarom.`,
        preheatOther: (minutes: number) => `Ob načrtovanem času segrevajte pečico ${minutes} minut na ${bakeTemperature}.`,
        shape: `Na zdrobu testo razprite od sredine navzven, pustite rob 1–2 cm in oblikujte pico premera ${diameter} cm; ne uporabljajte valjarja.`,
        sauce: `Po sredini enakomerno razporedite ${weight(dims.sauce)} omake in pustite rob prost.`,
        cheese: `Dodajte približno ${weight(dims.cheese)} mocarele in pice ne preobložite.`,
        launch: 'Pico vstavite v pečico točno ob načrtovanem času peke.',
        stoneBake: (time: string) => `Izklopite žar in izberite program Pizza, če je na voljo; sicer zgornje in spodnje gretje brez ventilatorja. Pecite skupaj ${time} pri ${bakeTemperature} in na koncu zapečite z žarom.`,
        ooniBake: (time: string) => `Pecite skupaj ${time} pri ${bakeTemperature} in pico obračajte vsakih 20–30 sekund.`,
        panBake: (time: string) => `Pecite skupaj ${time} pri ${bakeTemperature}; preverite, ali je dno pečeno.`,
      },
    }[lang]);
    const mixerWaterStep = `${remainingWater} ${({
      hr: 'Mikser cijelo vrijeme držite u 1. brzini.',
      en: 'Keep the mixer on speed 1 while adding the water.',
      de: 'Lassen Sie den Mixer während der Wasserzugabe auf Stufe 1 laufen.',
      sl: 'Med dodajanjem vode naj mešalnik deluje pri hitrosti 1.',
    }[lang])}`;
    const mixerFinalMixSteps = [
      ({
        hr: 'U planirano vrijeme završnog zamjesa natrgajte Bigu u posudu miksera, postavite kuku za tijesto i pokrenite 1. brzinu.',
        en: 'At scheduled Final Mix, tear the Biga into the mixer bowl, fit the dough hook, and start on speed 1.',
        de: 'Zerteilen Sie die Biga zum geplanten Hauptteig-Zeitpunkt in der Mixerschüssel, setzen Sie den Knethaken ein und starten Sie auf Stufe 1.',
        sl: 'Ob načrtovanem končnem mešanju bigo natrgajte v posodo mešalnika, namestite kavelj za testo in začnite pri hitrosti 1.',
      }[lang]),
      ({
        hr: `Dodajte ${weight(bigaHomeDisplayMainFlour)} preostalog brašna i ${weight(dough.main.yeast, true)} završnog kvasca (${yeastShortLabel}); miješajte s Bigom u 1. brzini.`,
        en: `Add ${weight(bigaHomeDisplayMainFlour)} remaining flour and ${weight(dough.main.yeast, true)} final-dough yeast (${yeastShortLabel}); mix with the Biga on speed 1.`,
        de: `Geben Sie ${weight(bigaHomeDisplayMainFlour)} restliches Mehl und ${weight(dough.main.yeast, true)} Hefe für den Hauptteig (${yeastShortLabel}) dazu und mischen Sie mit der Biga auf Stufe 1.`,
        sl: `Dodajte ${weight(bigaHomeDisplayMainFlour)} preostale moke in ${weight(dough.main.yeast, true)} kvasa za končno testo (${yeastShortLabel}) ter mešajte z bigo pri hitrosti 1.`,
      }[lang]),
      mixerWaterStep,
      ({
        hr: `Kad je voda gotovo upijena, dodajte ${weight(dough.main.salt)} soli i prebacite mikser u 2. brzinu.`,
        en: `When the water is almost absorbed, add ${weight(dough.main.salt)} salt and switch the mixer to speed 2.`,
        de: `Wenn das Wasser fast aufgenommen ist, geben Sie ${weight(dough.main.salt)} Salz dazu und schalten Sie den Mixer auf Stufe 2.`,
        sl: `Ko je voda skoraj vpita, dodajte ${weight(dough.main.salt)} soli in preklopite mešalnik na hitrost 2.`,
      }[lang]),
      ({
        hr: `Na kraju dodajte ${weight(dough.main.oil)} maslinovog ulja; zaustavite mikser čim ga tijesto potpuno upije.`,
        en: `Add ${weight(dough.main.oil)} olive oil at the end; stop the mixer as soon as the dough absorbs it.`,
        de: `Geben Sie ${weight(dough.main.oil)} Olivenöl zuletzt dazu; stoppen Sie den Mixer, sobald der Teig es aufgenommen hat.`,
        sl: `Na koncu dodajte ${weight(dough.main.oil)} oljčnega olja; mešalnik ustavite takoj, ko ga testo vpije.`,
      }[lang]),
    ];
    const finalMixSteps = mixing === 'mixer'
      ? mixerFinalMixSteps
      : [copy.finalMixStart, copy.flourAndYeast, remainingWater, copy.salt, copy.oil];
    const finalDoughSteps = [
      ...(schedule.finalDoughRoomHours > 0 ? [copy.roomBulk(duration(schedule.finalDoughRoomHours))] : []),
      ...(schedule.finalDoughFridgeHours > 0 ? [copy.fridgeBulk(duration(schedule.finalDoughFridgeHours))] : []),
    ];
    const finalRest = duration(schedule.finalBallRestHours);
    const beforeShape = duration(finalRestBeforeShaping);
    const preheat = oven === 'homeStone'
      ? copy.preheatStone(preheatMinutes)
      : copy.preheatOther(preheatMinutes);
    const baking = oven === 'homeStone'
      ? copy.stoneBake(bakingTimeRange)
      : oven === 'ooni'
        ? copy.ooniBake(bakingTimeRange)
        : copy.panBake(bakingTimeRange);
    return [
      { title: copy.finalMixTitle, steps: finalMixSteps },
      { title: copy.finalDoughTitle, steps: finalDoughSteps },
      { title: copy.ballingTitle, steps: [copy.ball] },
      {
        title: copy.bakeTitle,
        steps: [
          copy.finalRest(beforeShape, finalRest),
          preheat,
          copy.shape,
          copy.sauce,
          copy.cheese,
          copy.launch,
          baking,
        ],
      },
    ];
  })() : null;
  const recipeIngredients = (
    <>
      {dough.preferment ? (
        <>
          <Text style={styles.recipeSection}>
            {beginnerHomeRecipeLayout ? t.calc.preferment : `7 · ${t.calc.preferment}`} · {method === 'biga' ? `BIGA ${bigaPct}%` : `POOLISH ${poolishPct}%`}
          </Text>
          <ResultRow label={t.calc.totalFlour} value={weight(dough.preferment.flour)} highlight />
          <ResultRow label={t.calc.totalWater} value={weight(dough.preferment.water)} highlight />
          <ResultRow label={t.calc.yeastAmount + ' (' + yeastShortLabel + ')'} value={weight(dough.preferment.yeast, true)} />
              {method === 'poolish' ? <Text style={styles.hint}>{t.calc.poolishHint}</Text> : <Text style={styles.hint}>{bigaHomeScheduleHint ?? t.calc.bigaHint}</Text>}

          <Text style={[styles.recipeSection, { marginTop: SPACING.md }]}>{t.calc.mainDough}</Text>
          <ResultRow label={t.calc.remainingFlour} value={weight(beginnerNeapolitanBigaHome ? bigaHomeDisplayMainFlour : dough.main.flour)} highlight />
          {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={weight(psylliumGrams)} highlight /> : null}
          {ice ? (
            <>
              <ResultRow label={`${t.calc.coldWater} (${t.calc.remainingLabel})`} value={weight(Math.max(0, dough.main.water - ice.ice))} />
              <ResultRow label={`🧊 ${t.calc.iceAmount}`} value={weight(ice.ice)} highlight />
            </>
          ) : (
            <ResultRow label={`${t.calc.remainingWater} (${formatTemperature(dough.waterTemp, temperatureUnit)})`} value={weight(dough.main.water)} highlight />
          )}
          <ResultRow label={t.calc.saltAmount} value={weight(dough.main.salt, true)} />
          <ResultRow label={t.calc.oilAmount} value={weight(dough.main.oil)} />
          <ResultRow label={t.calc.yeastAmount + ' (' + yeastShortLabel + ')'} value={weight(dough.main.yeast, true)} />
          <View style={styles.subBlock}>
            <Text style={styles.subhead}>{t.calc.totals} · {pizzas} × {formatWeight(effectiveBall, measurementSystem)} = {formatWeight(dough.totalDough, measurementSystem)}</Text>
            <ResultRow label={t.calc.totalFlour} value={weight(beginnerNeapolitanBigaHome ? bigaHomeDisplayTotalFlour : beginnerDirectHome ? beginnerDisplayFlour : dough.total.flour)} />
            {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={weight(psylliumGrams)} /> : null}
            <ResultRow label={t.calc.totalWater} value={weight(dough.total.water)} />
            <ResultRow label={t.calc.saltAmount} value={weight(dough.total.salt, true)} />
            <ResultRow label={t.calc.yeastAmount} value={weight(dough.total.yeast, true)} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.recipeSection}>
            {beginnerHomeRecipeLayout ? t.calc.totalDough : `7 · ${t.calc.totalDough}`} · {pizzas} × {formatWeight(effectiveBall, measurementSystem)} = {formatWeight(dough.totalDough, measurementSystem)}
          </Text>
          {isCustom ? (
            <>
              <ResultRow label={`${flourName(lang, blendA)} (${blendPctA}%)`} value={weight(Math.round(dough.main.flour * blendPctA / 100))} highlight />
              <ResultRow label={`${flourName(lang, blendB)} (${100 - blendPctA}%)`} value={weight(Math.round(dough.main.flour * (100 - blendPctA) / 100))} highlight />
              <ResultRow label={t.calc.totalFlour} value={weight(dough.main.flour)} />
            </>
          ) : (
            <ResultRow label={`${t.calc.flourLabel} (${flourName(lang, flour)})`} value={weight(beginnerDirectHome ? beginnerDisplayFlour : dough.main.flour)} highlight />
          )}
          {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={weight(psylliumGrams)} highlight /> : null}
          {ice ? (
            <>
              <ResultRow label={t.calc.coldWater} value={weight(ice.water)} />
              <ResultRow label={`🧊 ${t.calc.iceAmount}`} value={weight(ice.ice)} highlight />
            </>
          ) : (
            <ResultRow label={`${t.calc.totalWater} (${formatTemperature(dough.waterTemp, temperatureUnit)})`} value={weight(dough.main.water)} highlight />
          )}
          <ResultRow label={t.calc.saltAmount} value={weight(dough.main.salt, true)} />
          <ResultRow label={`${t.calc.yeastAmount} (${yeastShortLabel}, ${dough.yeastPct}%)`} value={weight(dough.main.yeast, true)} />
          <ResultRow label={t.calc.oilAmount} value={weight(dough.main.oil)} />
        </>
      )}
      <Text style={[styles.recipeSection, { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider }]}>
        {isBeginner && isRomanTeglia ? t.calc.perTray : `${t.calc.perPizza} · ${formatLength(diameter, measurementSystem)}`}
      </Text>
      <ResultRow label={isBeginner && isRomanTeglia ? t.calc.trayDoughMass : t.calc.doughBall} value={weight(effectiveBall)} />
      <ResultRow
        label={beginnerDirectHome ? `${t.calc.sauce} · ${weight(dims.sauce)} × ${pizzas}` : t.calc.sauce}
        value={weight(beginnerDirectHome ? dims.sauce * pizzas : dims.sauce)}
      />
      <ResultRow
        label={beginnerDirectHome ? `${t.calc.cheese} · ${weight(dims.cheese)} × ${pizzas}` : t.calc.cheese}
        value={weight(beginnerDirectHome ? dims.cheese * pizzas : dims.cheese)}
      />
    </>
  );
  const renderBeginnerBakeCard = () => isBeginner ? (
    <View ref={(node) => { beginnerSectionRefs.current.bake = node; }} style={styles.card} testID="beginner-bake-plan" onLayout={(event) => recordBeginnerSection('bake', event.nativeEvent.layout.y)}>
      <Text style={styles.cardTitle}>{t.beginnerCalc.stepBake}</Text>
      {sharedBakeAt ? (
        <Text style={styles.subLabel}>
          {t.beginnerCalc.bakeTime}: {new Intl.DateTimeFormat({ hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang], { dateStyle: 'medium', timeStyle: 'short' }).format(sharedBakeAt)}
        </Text>
      ) : null}
      <Pressable testID="beginner-choose-bake-time" onPress={() => router.push(`/(tabs)/planner?returnTo=beginner&returnToken=${Date.now()}&returnSection=style`)} style={styles.expandBtn}>
        <Icon name="calendar-outline" size={17} color={COLORS.brand} />
        <Text style={styles.expandText}>{t.beginnerCalc.setBakeTime}</Text>
      </Pressable>
      {beginnerDirectHome ? (directHomeSchedule?.limitations ?? [])
        .map((limitation) => localizeBeginnerScheduleNotice(limitation, lang))
        .filter((limitation): limitation is string => !!limitation)
        .map((limitation) => <Text key={limitation} style={styles.hint}>{limitation}</Text>) : null}
      {method === 'direct' && !directHomeSchedule ? (
        <Text style={styles.hint}>{sharedBakeAt ? t.beginnerCalc.homePlanUnavailable : t.beginnerCalc.setBakeTime}</Text>
      ) : method !== 'direct' ? (
        <Text style={styles.hint}>{t.beginnerCalc.noHomeSchedule}</Text>
      ) : null}
    </View>
  ) : null;

  return (
    <ImageBackground
      source={require('../../assets/images/bg-wood-flour.png')}
      style={[styles.root, { paddingTop: insets.top }]}
      imageStyle={styles.rootBgImage}
      resizeMode="cover"
    >
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <View style={styles.logo}><Text style={{ fontSize: 20 }}>🍕</Text></View>
          <Text style={styles.title} accessibilityLabel="PizzaBook">
            <Text style={styles.titlePizza}>Pizza</Text>
            <Text style={styles.titleBook}>Book</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <Text style={styles.subtitle}>{t.calc.title}</Text>
          <Pressable testID="open-settings" onPress={() => router.push('/settings')} hitSlop={8}>
            <Icon name="settings-outline" size={22} color={COLORS.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView ref={calculatorScrollRef} onScroll={(event) => { beginnerScrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2, gap: SPACING.lg }} keyboardShouldPersistTaps="handled">

        {renderBeginnerBakeCard()}

        {/* 2. PIZZA STYLE */}
        <View ref={(node) => { beginnerSectionRefs.current.style = node; }} style={styles.card} onLayout={(event) => recordBeginnerSection('style', event.nativeEvent.layout.y)}>
          <Pressable testID="style-header" onPress={() => isBeginner ? toggleBeginnerSection('style') : setStyleExpanded((value) => !value)} style={styles.styleHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{isBeginner ? t.beginnerCalc.stepStyle : `1 · ${t.calc.pizzaStyle}`}</Text>
              {!styleExpanded ? <Text style={styles.hint}>{selectedPizzaStyleName}</Text> : null}
            </View>
            {hydration !== styleProfile.hydration || saltPct !== styleProfile.saltPct || oilPct !== styleProfile.oilPct || diameter !== styleProfile.defaultDiameter ? (
              <Pressable testID="style-reset" onPress={resetStyleDefaults} style={styles.resetInlineBtn}>
                <Icon name="refresh" size={12} color={COLORS.muted} />
                <Text style={styles.resetInlineText}>{t.calc.pizzaStyleCustom}</Text>
              </Pressable>
            ) : null}
            <Icon name={styleExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
          </Pressable>
          {styleExpanded ? isBeginner ? (
            <View style={styles.beginnerStylePicker}>
              <View style={styles.beginnerStyleGrid}>
                {(['neapolitan', 'romana', 'ny_style'] as PizzaStyle[]).map((key) => {
                  const active = pizzaStyle === key;
                  const item = t.calc.pizzaStyles[key];
                  return (
                    <View key={key} style={styles.beginnerStyleCell}>
                      <Pressable
                        testID={`style-${key}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => changeStyle(key)}
                        style={[styles.beginnerStyleCard, active && styles.beginnerStyleCardActive]}
                      >
                        <Image source={styleImages[key]} style={styles.beginnerStyleImage} resizeMode="contain" />
                        <View style={styles.beginnerStyleLabelRow}>
                          <Text style={styles.beginnerStyleName} allowFontScaling={false}>{item.name}</Text>
                          {active ? <Icon name="checkmark-circle" size={16} color={COLORS.brand} /> : null}
                        </View>
                      </Pressable>
                      <Pressable testID={`style-info-${key}`} onPress={() => setStyleInfo(key)} hitSlop={8} style={styles.beginnerStyleInfo}>
                        <Icon name="information-circle-outline" size={17} color={COLORS.muted} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              {pizzaStyle === 'romana' ? (
                <View style={styles.beginnerSubtypeBlock}>
                  <Text style={styles.beginnerSubtypeLabel}>{t.beginnerCalc.romanaQuestion}</Text>
                  <View style={styles.beginnerSubtypeControl}>
                    <Pressable testID="romana-tonda" onPress={() => step(() => {
                      setRomanFormat('tonda');
                      if (romanFormat === 'teglia') {
                        setCustomBallWeight(null);
                        setCustomBallInput('');
                        setOven('homeStone');
                        setOvenTemp(300);
                        setOvenTempInput('300');
                      }
                      transitionBeginnerTo('flour');
                    })} style={[styles.beginnerSubtypeOption, romanFormat === 'tonda' && styles.beginnerSubtypeOptionActive]}>
                      <Text style={[styles.beginnerSubtypeText, romanFormat === 'tonda' && styles.beginnerSubtypeTextActive]}>Tonda</Text>
                    </Pressable>
                    <Pressable testID="romana-teglia" onPress={() => step(() => {
                      setRomanFormat('teglia');
                      setCustomBallWeight(null);
                      setCustomBallInput('');
                      setOven('homePan');
                      setOvenTemp(250);
                      setOvenTempInput('250');
                      transitionBeginnerTo('flour');
                    })} style={[styles.beginnerSubtypeOption, romanFormat === 'teglia' && styles.beginnerSubtypeOptionActive]}>
                      <Text style={[styles.beginnerSubtypeText, romanFormat === 'teglia' && styles.beginnerSubtypeTextActive]}>Teglia</Text>
                    </Pressable>
                  </View>
                  <View style={styles.beginnerSubtypeInfoRow}>
                    <Pressable testID="romana-tonda-info" onPress={() => Alert.alert('Romana Tonda', ROMANA_FORMAT_INFO[lang].tonda)} hitSlop={8} style={styles.beginnerSubtypeInfo}>
                      <Icon name="information-circle-outline" size={16} color={COLORS.muted} />
                      <Text style={styles.beginnerSubtypeInfoText}>Tonda</Text>
                    </Pressable>
                    <Pressable testID="romana-teglia-info" onPress={() => Alert.alert('Romana Teglia', ROMANA_FORMAT_INFO[lang].teglia)} hitSlop={8} style={styles.beginnerSubtypeInfo}>
                      <Icon name="information-circle-outline" size={16} color={COLORS.muted} />
                      <Text style={styles.beginnerSubtypeInfoText}>Teglia</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ) : <View style={{ gap: 6 }}>
            {(['neapolitan', 'romana', 'ny_style'] as PizzaStyle[]).map((key) => {
              const active = pizzaStyle === key;
              const locked = !isPremiumUnlocked && !isBeginner && key !== FREE_PIZZA_STYLE;
              const item = t.calc.pizzaStyles[key];
              return (
                <View key={key} style={styles.styleRowWrap}>
                  <Pressable testID={`style-${key}`} onPress={() => changeStyle(key)} style={[styles.styleRow, active && styles.styleRowActive, locked && styles.lockedOption]}>
                    <Image source={styleImages[key]} style={styles.styleThumb} resizeMode="cover" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.styleName, active && styles.styleNameActive]}>{item.name}</Text>
                      <Text style={[styles.styleDescription, active && styles.styleDescriptionActive]} numberOfLines={2}>{item.description}</Text>
                    </View>
                    {locked ? <Icon name="lock-closed" size={17} color={COLORS.muted} /> : active ? <Icon name="checkmark-circle" size={18} color="#fff" /> : null}
                  </Pressable>
                  <Pressable testID={`style-info-${key}`} onPress={() => setStyleInfo(key)} hitSlop={8} style={styles.infoBtn}>
                    <Icon name="information-circle-outline" size={19} color={active ? COLORS.brand : COLORS.muted} />
                  </Pressable>
                </View>
              );
            })}
            </View> : null}
        </View>

        {/* 2. FLOUR - collapsed header, expands on tap, auto-closes on select */}
        <View ref={(node) => { beginnerSectionRefs.current.flour = node; }} style={styles.card} onLayout={(event) => recordBeginnerSection('flour', event.nativeEvent.layout.y)}>
          <Pressable
            testID="flour-header"
            onPress={() => isBeginner ? toggleBeginnerSection('flour') : setFlourExpanded((v) => !v)}
            style={styles.flourHeader}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.flourHeaderText}>{isBeginner ? t.beginnerCalc.stepFlour : `2 · ${t.flourSection.headerCollapsed}`}</Text>
              {!flourExpanded ? <Text style={styles.hint}>{FLOURS_BY_LANG[lang].find((entry) => entry.key === flour)?.label}</Text> : null}
            </View>
            <Icon name={flourExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
          </Pressable>

          {flourExpanded || !isBeginner ? (
            <View style={[{ gap: 6, marginTop: SPACING.md }, isBeginner && styles.beginnerFlourGrid]}>
              {FLOURS_BY_LANG[lang].map((f) => {
                const active = flour === f.key;
                const locked = !isPremiumUnlocked && !isBeginner && !FREE_FLOUR_TYPES.includes(f.key);
                return (
                  <View key={f.key} style={[styles.flourRowWrap, isBeginner && styles.beginnerFlourCell]}>
                    <Pressable
                      testID={`flour-${f.key}`}
                      onPress={() => { changeFlour(f.key); if (isBeginner) transitionBeginnerTo('quantity'); else setFlourExpanded(false); }}
                      style={[styles.flourCompact, isBeginner && styles.beginnerFlourCard, active && (isBeginner ? styles.beginnerFlourCardActive : styles.flourCompactActive), locked && styles.lockedOption]}
                    >
                      <Image source={FLOUR_IMAGES[f.key]} style={[styles.flourIcon, isBeginner && styles.beginnerFlourImage]} resizeMode="contain" />
                      <Text style={[styles.flourCompactLabel, isBeginner && styles.beginnerFlourName, active && { color: isBeginner ? COLORS.onSurface : '#fff' }]} numberOfLines={isBeginner ? undefined : 1}>{f.label}</Text>
                      {isBeginner && f.key === PIZZA_STYLE_PROFILES[pizzaStyle].flourTypes[0] ? <Text style={styles.beginnerRecommendedBadge}>{t.beginnerCalc.recommendedFlour}</Text> : null}
                      {locked ? <Icon name="lock-closed" size={16} color={COLORS.muted} style={isBeginner ? styles.beginnerFlourStatus : { marginLeft: 4 }} /> : active ? <Icon name="checkmark-circle" size={16} color={isBeginner ? COLORS.brand : '#fff'} style={isBeginner ? styles.beginnerFlourStatus : { marginLeft: 4 }} /> : null}
                    </Pressable>
                    {f.info ? (
                      <Pressable
                        testID={`flour-info-${f.key}`}
                        onPress={() => setFlourInfo({ label: f.label, info: isBeginner && f.key !== 'glutenFree' ? (f.key === 'custom' ? BEGINNER_BLEND_INFO[lang] : `${f.info}\n\n${BEGINNER_FLOUR_NOTE[lang]}`).replace('{N}', String(beginnerHydrationFor(pizzaStyle, f.key))) : f.info! })}
                        hitSlop={8}
                        style={styles.infoBtn}
                      >
                        <Icon name="information-circle-outline" size={18} color={active ? COLORS.brand : COLORS.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
              {!isBeginner ? (
              <View style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
                <Text style={styles.label}>{({ hr: 'Snaga brašna', en: 'Flour strength', de: 'Mehlstärke', sl: 'Moč moke' }[lang])}</Text>
                <View style={styles.chipRow}>
                  {([
                    { key: 'w' as const, label: 'W' },
                    { key: 'protein' as const, label: 'Protein %' },
                    { key: 'unknown' as const, label: ({ hr: 'Ne znam', en: "I don't know", de: 'Unbekannt', sl: 'Ne vem' }[lang]) },
                  ]).map((option) => (
                    <Pressable
                      key={option.key}
                      testID={`flour-strength-${option.key}`}
                      onPress={() => {
                        setFlourStrengthSource(option.key);
                        setFlourStrengthValue('');
                      }}
                      style={[styles.chip, flourStrengthSource === option.key && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, flourStrengthSource === option.key && styles.chipTextActive]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.hint}>
                  {flourStrengthCategory === 'specific'
                    ? ({ hr: 'Ovo brašno ima poznatu snagu — možete ostaviti "Ne znam" ili unijeti točnu vrijednost ako je imate.', en: 'This flour has known strength data — you can leave "I don\u2019t know" or enter the exact value if you have it.', de: 'Für dieses Mehl liegen bekannte Stärkedaten vor — Sie können "Unbekannt" lassen oder den genauen Wert eingeben.', sl: 'Ta moka ima znano moč — lahko pustite "Ne vem" ali vnesete natančno vrednost, če jo imate.' }[lang])
                    : flourStrengthCategory === 'custom'
                      ? ({ hr: 'Mješavina brašna: ako znate W ili protein sastojka, unesite ga radi preciznijeg rasporeda.', en: 'Flour blend: if you know the W or protein of an ingredient, enter it for a more precise schedule.', de: 'Mehlmischung: Wenn Sie W oder Protein einer Zutat kennen, geben Sie es für einen präziseren Zeitplan ein.', sl: 'Mešanica moke: če poznate W ali beljakovine sestavine, jo vnesite za natančnejši urnik.' }[lang])
                      : ({ hr: 'Generička kategorija brašna bez potvrđene snage — ako ne znate W ili protein, ostavite "Ne znam"; Pizzabook koristi siguran standardni pristup.', en: "Generic flour category with no verified strength — if you don't know W or protein, leave \"I don't know\"; Pizzabook uses a safe standard approach.", de: 'Generische Mehlkategorie ohne bestätigte Stärke — wenn Sie W oder Protein nicht kennen, lassen Sie "Unbekannt"; Pizzabook verwendet einen sicheren Standardansatz.', sl: 'Generična kategorija moke brez potrjene moči — če ne poznate W ali beljakovin, pustite "Ne vem"; Pizzabook uporabi varen standardni pristop.' }[lang])}
                </Text>
                {flourStrengthSource !== 'unknown' ? (
                  <TextInput
                    testID={`flour-strength-value-${flourStrengthSource}`}
                    value={flourStrengthValue}
                    onChangeText={(value) => setFlourStrengthValue(value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder={flourStrengthSource === 'w' ? 'W' : 'Protein %'}
                    placeholderTextColor={COLORS.muted}
                    style={styles.customInput}
                  />
                ) : null}
              </View>
              ) : null}
            </View>
          ) : null}

          {/* Blend controls stay visible when custom is selected, even if the list is collapsed */}
          {isCustom ? (
            <View style={styles.blendPanel}>
              <Text style={styles.blendTitle}>{t.flourSection.blendTitle}</Text>

              <Text style={styles.label}>{t.flourSection.blendA} ({blendPctA}%)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {BASE_FLOURS.filter((k) => !isBeginner || k !== 'glutenFree').map((k) => (
                  <Pressable key={k} testID={`blendA-${k}`} onPress={() => changeBlend('a', k)} style={[styles.chip, blendA === k && styles.chipActive]}>
                    <Text style={[styles.chipText, blendA === k && styles.chipTextActive]}>{flourName(lang, k)}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.label, { marginTop: SPACING.sm }]}>{t.flourSection.blendB} ({100 - blendPctA}%)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {BASE_FLOURS.filter((k) => !isBeginner || k !== 'glutenFree').map((k) => (
                  <Pressable key={k} testID={`blendB-${k}`} onPress={() => changeBlend('b', k)} style={[styles.chip, blendB === k && styles.chipActive]}>
                    <Text style={[styles.chipText, blendB === k && styles.chipTextActive]}>{flourName(lang, k)}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={[styles.row, { marginTop: SPACING.sm }]}>
                <Text style={styles.label}>{t.flourSection.blendPct}</Text>
                <View style={[styles.stepper, idealPreferment && styles.stepperIdeal]}>
                  <Pressable testID="blendPct-minus" onPress={() => changeBlend('pct', Math.max(5, blendPctA - 5))} style={styles.stepBtn}>
                    <Icon name="remove" size={20} color={COLORS.brand} />
                  </Pressable>
                  <Text style={styles.stepVal}>{blendPctA}%</Text>
                  <Pressable testID="blendPct-plus" onPress={() => changeBlend('pct', Math.min(95, blendPctA + 5))} style={styles.stepBtn}>
                    <Icon name="add" size={20} color={COLORS.brand} />
                  </Pressable>
                </View>
              </View>

              {!isBeginner ? <Text style={styles.hint}>
                {t.flourSection.blendIdealHint.replace('{N}', String(customIdeal))} ({FLOUR_PROFILES[blendA].ideal}% × {blendPctA}% + {FLOUR_PROFILES[blendB].ideal}% × {100 - blendPctA}%)
              </Text> : null}
            </View>
          ) : null}
        </View>

        {/* 2. VELIČINA PIZZE */}
        <View ref={(node) => { beginnerSectionRefs.current.quantity = node; }} style={styles.card} onLayout={(event) => recordBeginnerSection('quantity', event.nativeEvent.layout.y)}>
          {isBeginner ? (
            <Pressable testID="quantity-header" onPress={() => toggleBeginnerSection('quantity')} style={styles.styleHeaderRow}>
              <Text style={styles.cardTitle}>{t.beginnerCalc.stepPizzas}</Text>
              <Icon name={quantityExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
            </Pressable>
          ) : <Text style={styles.cardTitle}>{`3 · ${t.calc.dimensions}`}</Text>}
          {(!isBeginner || quantityExpanded) ? <>
          {pizzaStyle === 'romana' && !isBeginner ? (
            <>
              <Text style={[styles.label, { marginTop: SPACING.sm }]}>Romana</Text>
              <View style={styles.pillGroup}>
                <View style={[styles.pill, romanFormat === 'tonda' && styles.pillActive]}>
                  <Pressable testID="romana-tonda" onPress={() => step(() => {
                    setRomanFormat('tonda');
                    if (isBeginner && romanFormat === 'teglia') {
                      setCustomBallWeight(null);
                      setCustomBallInput('');
                      setOven('homeStone');
                      setOvenTemp(300);
                      setOvenTempInput('300');
                    }
                  })} style={styles.pillSelect}>
                    <Text style={[styles.pillText, romanFormat === 'tonda' && styles.pillTextActive]}>Romana Tonda</Text>
                  </Pressable>
                  <Pressable testID="romana-tonda-info" onPress={() => Alert.alert('Romana Tonda', ROMANA_FORMAT_INFO[lang].tonda)} hitSlop={8} style={styles.infoBtn}>
                    <Icon name="information-circle-outline" size={18} color={romanFormat === 'tonda' ? '#fff' : COLORS.muted} />
                  </Pressable>
                </View>
                <View style={[styles.pill, romanFormat === 'teglia' && styles.pillActive]}>
                  <Pressable testID="romana-teglia" onPress={() => step(() => {
                    setRomanFormat('teglia');
                    setCustomBallWeight(null);
                    setCustomBallInput('');
                    setOven('homePan');
                    setOvenTemp(250);
                    setOvenTempInput('250');
                  })} style={styles.pillSelect}>
                    <Text style={[styles.pillText, romanFormat === 'teglia' && styles.pillTextActive]}>Romana Teglia</Text>
                  </Pressable>
                  <Pressable testID="romana-teglia-info" onPress={() => Alert.alert('Romana Teglia', ROMANA_FORMAT_INFO[lang].teglia)} hitSlop={8} style={styles.infoBtn}>
                    <Icon name="information-circle-outline" size={18} color={romanFormat === 'teglia' ? '#fff' : COLORS.muted} />
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>{t.calc.pizzas}</Text>
            <View style={styles.stepper}>
              <Pressable testID="pizza-minus" onPress={() => step(() => setPizzas(Math.max(1, pizzas - 1)))} style={styles.stepBtn}>
                <Icon name="remove" size={22} color={COLORS.brand} />
              </Pressable>
              <Text style={styles.stepVal}>{pizzas}</Text>
              <Pressable testID="pizza-plus" onPress={() => step(() => setPizzas(Math.min(50, pizzas + 1)))} style={styles.stepBtn}>
                <Icon name="add" size={22} color={COLORS.brand} />
              </Pressable>
            </View>
          </View>

          {/* Ball weight (grams) — manual override */}
          {!isRomanTeglia ? <View style={[styles.ballRow, { marginTop: SPACING.sm }]}>
            <View style={styles.ballLabelCol}>
              <View style={styles.labelWithInfo}>
                <Text style={styles.label}>{isBeginner ? t.beginnerCalc.stepBall : t.ballWeight.label}</Text>
                {isBeginner ? <Pressable testID="ball-weight-info" onPress={() => Alert.alert(t.beginnerCalc.stepBall, beginnerBallInfo)} hitSlop={8} style={styles.infoBtn}>
                  <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
                </Pressable> : null}
              </View>
              {!isBeginner || customBallWeight != null ? <Text style={styles.subLabel} numberOfLines={2}>
                {customBallWeight != null
                  ? t.ballWeight.manualHint.replace('{N}g', weight(dims.doughBall))
                  : t.ballWeight.autoHint.replace('{N}g', weight(dims.doughBall))}
              </Text> : null}
            </View>
            <View style={styles.ballStepper}>
              <Pressable
                testID="ball-minus"
                onPress={() => step(() => isBeginner
                  ? setBeginnerBallWeight(Math.max(50, effectiveBall - 5))
                  : setCustomBallWeight(Math.max(50, (customBallWeight ?? dims.doughBall) - 5)))}
                style={styles.stepBtn}
              >
                <Icon name="remove" size={20} color={COLORS.brand} />
              </Pressable>
              <TextInput
                testID="ball-input"
                value={ballInputValue}
                onChangeText={(txt) => {
                  const clean = txt.replace(/[^0-9.]/g, '').slice(0, 6);
                  setCustomBallInput(clean);
                  setCustomBallInputSystem(measurementSystem);
                  const entered = Number(clean);
                  const n = Math.round(weightInputToGrams(entered, ballWeightInputUnit));
                  if (!isNaN(n) && n >= 50 && n <= 600) {
                    if (isBeginner) setBeginnerBallWeight(n);
                    else setCustomBallWeight(n);
                  }
                }}
                onBlur={() => setCustomBallInput('')}
                keyboardType={measurementSystem === 'us' ? 'decimal-pad' : 'number-pad'}
                style={styles.stepInput}
                selectTextOnFocus
              />
              <Text style={styles.stepUnit}>{ballWeightInputUnit}</Text>
              <Pressable
                testID="ball-plus"
                onPress={() => step(() => isBeginner
                  ? setBeginnerBallWeight(Math.min(600, effectiveBall + 5))
                  : setCustomBallWeight(Math.min(600, (customBallWeight ?? dims.doughBall) + 5)))}
                style={styles.stepBtn}
              >
                <Icon name="add" size={20} color={COLORS.brand} />
              </Pressable>
            </View>
          </View> : null}
          {!isRomanTeglia && customBallWeight != null ? (
            <Pressable
              testID="ball-reset"
              onPress={() => { setCustomBallWeight(null); setCustomBallInput(''); try { Haptics.selectionAsync(); } catch {} }}
              style={styles.resetInlineBtn}
            >
              <Icon name="refresh" size={12} color={COLORS.muted} />
              <Text style={styles.resetInlineText}>{t.ballWeight.reset}</Text>
            </Pressable>
          ) : null}

          {isRomanTeglia ? (
            <>
              <View style={[styles.ballRow, { marginTop: SPACING.md }] }>
                <View style={styles.ballLabelCol}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.label}>{t.calc.trayDoughMass}</Text>
                    {isBeginner ? <Pressable testID="tray-dough-info" onPress={() => Alert.alert(t.calc.trayDoughMass, t.beginnerCalc.trayBallInfo)} hitSlop={8} style={styles.infoBtn}>
                      <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
                    </Pressable> : null}
                  </View>
                  <Text style={styles.subLabel}>{t.calc.automaticTrayWeight}</Text>
                </View>
                <View style={styles.ballStepper}>
                  <Pressable testID="tray-dough-minus" onPress={() => step(() => setCustomBallWeight(Math.max(100, effectiveBall - 5)))} style={styles.stepBtn}>
                    <Icon name="remove" size={20} color={COLORS.brand} />
                  </Pressable>
                  <TextInput
                    testID="tray-dough-weight"
                        value={ballInputValue}
                    onChangeText={(value) => {
                      const clean = value.replace(/[^0-9.]/g, '').slice(0, 6);
                      setCustomBallInput(clean);
                          setCustomBallInputSystem(measurementSystem);
                      const next = Number(clean);
                      const grams = Math.round(weightInputToGrams(next, ballWeightInputUnit));
                      if (grams >= 100 && grams <= 2000) setCustomBallWeight(grams);
                    }}
                    onBlur={() => setCustomBallInput('')}
                    keyboardType={measurementSystem === 'us' ? 'decimal-pad' : 'number-pad'}
                    style={styles.stepInput}
                  />
                  <Text style={styles.stepUnit}>{ballWeightInputUnit}</Text>
                  <Pressable testID="tray-dough-plus" onPress={() => step(() => setCustomBallWeight(Math.min(2000, effectiveBall + 5)))} style={styles.stepBtn}>
                    <Icon name="add" size={20} color={COLORS.brand} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.hint}>{t.calc.automaticCalculation}: {weight(trayDoughWeight)}</Text>
              <Text style={[styles.label, { marginTop: SPACING.sm }]}>{t.calc.trayDimensions}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <TextInput
                  testID="tray-width"
                  value={trayWidthInput}
                  onChangeText={(value) => {
                    const clean = value.replace(/[^0-9]/g, '').slice(0, 2);
                    setTrayWidthInput(clean);
                    const next = Number(clean);
                    if (next >= 20 && next <= 60) { setTrayWidth(next); setCustomBallWeight(null); setCustomBallInput(''); }
                  }}
                  onBlur={() => { if (trayWidth < 20 || trayWidth > 60) setTrayWidthInput(String(trayWidth)); }}
                  keyboardType="number-pad"
                  style={styles.customInput}
                />
                <Text style={styles.stepUnit}>×</Text>
                <TextInput
                  testID="tray-length"
                  value={trayLengthInput}
                  onChangeText={(value) => {
                    const clean = value.replace(/[^0-9]/g, '').slice(0, 2);
                    setTrayLengthInput(clean);
                    const next = Number(clean);
                    if (next >= 20 && next <= 60) { setTrayLength(next); setCustomBallWeight(null); setCustomBallInput(''); }
                  }}
                  onBlur={() => { if (trayLength < 20 || trayLength > 60) setTrayLengthInput(String(trayLength)); }}
                  keyboardType="number-pad"
                  style={styles.customInput}
                />
                <Text style={styles.stepUnit}>cm</Text>
              </View>
              {customBallWeight != null ? (
                <Pressable testID="tray-dough-reset" onPress={() => { setCustomBallWeight(null); setCustomBallInput(''); }} style={styles.resetInlineBtn}>
                  <Icon name="refresh" size={12} color={COLORS.muted} />
                  <Text style={styles.resetInlineText}>Vrati automatski izračun</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <View style={[styles.labelWithInfo, { marginTop: SPACING.md }]}>
                <Text style={styles.label}>{t.calc.diameter}</Text>
                {isBeginner ? <Pressable testID="diameter-info" onPress={() => Alert.alert(t.calc.diameter, t.beginnerCalc.diameterInfo)} hitSlop={8} style={styles.infoBtn}>
                  <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
                </Pressable> : null}
              </View>
              <View style={styles.diameterRow}>
                {DIAMETERS.map((d) => (
                  <Pressable key={d} testID={`diam-${d}`} onPress={() => step(() => { setBeginnerDiameter(d); setCustomBallInput(''); })} style={[styles.chip, diameter === d && styles.chipActive]}>
                    <Text style={[styles.chipText, diameter === d && styles.chipTextActive]}>{d} cm</Text>
                  </Pressable>
                ))}
                <TextInput
                  testID="custom-diameter"
                  value={customDiameter}
                  onChangeText={setCustomDiameter}
                  onBlur={commitCustomDiameter}
                  onSubmitEditing={commitCustomDiameter}
                  keyboardType="number-pad"
                  placeholder="cm"
                  placeholderTextColor={COLORS.muted}
                  style={styles.customInput}
                />
              </View>
            </>
          )}
          </> : null}
        </View>

            {/* 4. METHOD + HYDRATION + TEMP */}
        <View ref={(node) => { beginnerSectionRefs.current.method = node; }} style={styles.card} onLayout={(event) => recordBeginnerSection('method', event.nativeEvent.layout.y)}>
          <Pressable testID="method-header" onPress={() => isBeginner ? toggleBeginnerSection('method') : setMethodExpanded((value) => !value)} style={styles.styleHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{isBeginner ? t.beginnerCalc.stepMethod : `4 · ${t.calc.method} + ${t.calc.hydration}`}</Text>
              {!methodExpanded ? <Text style={styles.hint}>{method === 'direct' ? t.calc.direct : method === 'biga' ? t.calc.biga : t.calc.poolish}</Text> : null}
            </View>
            <Icon name={methodExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
          </Pressable>
          {isBeginner && methodExpanded ? (
            <View style={{ gap: SPACING.xs, marginTop: SPACING.sm }}>
              <View style={styles.labelWithInfo}>
                <Text style={styles.label}>{t.calc.mixingTitle}</Text>
                <Pressable testID="mixing-info" onPress={() => Alert.alert(t.beginnerCalc.stepMethod, t.beginnerCalc.mixingInfo)} hitSlop={8} style={styles.infoBtn}>
                  <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
                </Pressable>
              </View>
              <View style={styles.segmentedRow}>
                <Pressable testID="mix-hand" onPress={() => step(() => { setMixing('hand'); setShowMixSteps(true); transitionBeginnerTo('oven'); })} style={[styles.segBtn, mixing === 'hand' && styles.segBtnActive]}>
                  <Image source={require('../../assets/images/hand-left-outline.png')} style={styles.mixIcon} resizeMode="contain" />
                  <Text style={[styles.segText, mixing === 'hand' && { color: '#fff' }]}>{t.calc.handMixTitle}</Text>
                </Pressable>
                <Pressable testID="mix-mixer" onPress={() => step(() => { setMixing('mixer'); setShowMixSteps(true); transitionBeginnerTo('oven'); })} style={[styles.segBtn, mixing === 'mixer' && styles.segBtnActive]}>
                  <Image source={require('../../assets/images/hardware-chip-outline.png')} style={styles.mixIcon} resizeMode="contain" />
                  <Text style={[styles.segText, mixing === 'mixer' && { color: '#fff' }]}>{t.calc.mixerTitle}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'column-reverse', gap: SPACING.sm }}>
              {beginnerScheduleSelectionVisible ? (
                <View testID="beginner-direct-schedule-mode" style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.label}>{lang === 'hr' ? 'Način fermentacije' : lang === 'de' ? 'Fermentationsart' : lang === 'sl' ? 'Način fermentacije' : 'Fermentation mode'}</Text>
                    <Pressable
                      testID="beginner-fermentation-mode-info"
                      accessibilityRole="button"
                      accessibilityLabel={lang === 'hr' ? 'Informacije o načinu fermentacije' : lang === 'de' ? 'Informationen zur Fermentationsart' : lang === 'sl' ? 'Informacije o načinu fermentacije' : 'Fermentation mode information'}
                      onPress={() => setFermentationInfoOpen(true)} /*
                        lang === 'hr' ? 'Koji način fermentacije odabrati?' : lang === 'de' ? 'Welche Fermentationsart wählen?' : lang === 'sl' ? 'Kateri način fermentacije izbrati?' : 'Which fermentation method should you choose?',
                        lang === 'hr'
                          ? '❄️ Fermentacija u hladnjaku\n\nFermentacija u hladnjaku odvija se sporije, što omogućuje bolju kontrolu tijesta tijekom duljeg vremena. Tijesto može razviti bogatiji okus i aromu.\n\nKuglice se prije pečenja vade iz hladnjaka kako bi se postupno zagrijale i bile spremne za oblikovanje.\n\n🌡️ Fermentacija na sobnoj temperaturi\n\nTijesto fermentira na sobnoj temperaturi, bez korištenja hladnjaka. Ovaj način posebno je praktičan kada imaš manje vremena do pečenja.\n\nŠto je prostorija toplija, fermentacija je brža. Zato je važno pravilno prilagoditi količinu kvasca i vrijeme fermentacije.\n\n🍕 Što preporučuje PizzaBook?\n\nPizzaBook uzima u obzir vrijeme do pečenja, sobnu temperaturu i temperaturu hladnjaka te izračunava količinu kvasca i raspored fermentacije.\n\nNa temelju tih podataka preporučuje prikladniji način fermentacije. Ako nema dovoljno vremena za hladnjak, dostupna je samo fermentacija na sobnoj temperaturi.\n\nVažno: Izračun je procjena. Stvarna spremnost tijesta ovisi i o temperaturi samog tijesta te njegovu razvoju tijekom fermentacije.'
                          : lang === 'de'
                            ? '❄️ Gärung im Kühlschrank\n\nDie Gärung im Kühlschrank verläuft langsamer und lässt sich über längere Zeit besser kontrollieren. Der Teig kann ein komplexeres Aroma entwickeln.\n\nDie Teiglinge werden vor dem Backen aus dem Kühlschrank genommen, damit sie sich langsam erwärmen und formbar werden.\n\n🌡️ Gärung bei Raumtemperatur\n\nDer Teig gärt ohne Kühlschrank bei Raumtemperatur. Diese Methode eignet sich besonders, wenn bis zum Backen weniger Zeit bleibt.\n\nJe wärmer der Raum, desto schneller die Gärung. Hefemenge und Gärzeit sollten deshalb angepasst werden.\n\n🍕 Was empfiehlt PizzaBook?\n\nPizzaBook berücksichtigt die Zeit bis zum Backen sowie Raum- und Kühlschranktemperatur und berechnet Hefemenge und Gärplan.\n\nAuf dieser Grundlage wird die passendere Methode empfohlen. Reicht die Zeit für den Kühlschrank nicht aus, steht nur die Raumtemperaturgärung zur Verfügung.\n\nWichtig: Die Berechnung ist eine Schätzung. Die tatsächliche Reife hängt auch von der Teigtemperatur und seiner Entwicklung ab.'
                            : lang === 'sl'
                              ? '❄️ Fermentacija v hladilniku\n\nFermentacija v hladilniku poteka počasneje, zato je testo dlje časa bolj obvladljivo. Testo lahko razvije bogatejši okus in aromo.\n\nKroglice pred peko vzamemo iz hladilnika, da se postopoma segrejejo in so pripravljene za oblikovanje.\n\n🌡️ Fermentacija pri sobni temperaturi\n\nTesto fermentira pri sobni temperaturi brez hladilnika. Ta način je posebej praktičen, ko je do peke manj časa.\n\nToplejši prostor pospeši fermentacijo, zato je treba prilagoditi količino kvasa in čas fermentacije.\n\n🍕 Kaj priporoča PizzaBook?\n\nPizzaBook upošteva čas do peke ter temperaturo prostora in hladilnika ter izračuna količino kvasa in razpored fermentacije.\n\nNa podlagi teh podatkov priporoči primernejši način. Če za hladilnik ni dovolj časa, je na voljo le fermentacija pri sobni temperaturi.\n\nPomembno: Izračun je ocena. Dejanska pripravljenost testa je odvisna tudi od temperature testa in njegovega razvoja.'
                              : '❄️ Refrigerator fermentation\n\nRefrigerator fermentation is slower and easier to control over a longer period. The dough may develop richer flavour and aroma.\n\nRemove the dough balls from the refrigerator before baking so they can warm gradually and be ready to shape.\n\n🌡️ Room-temperature fermentation\n\nThe dough ferments at room temperature without refrigeration. This is especially practical when less time remains before baking.\n\nThe warmer the room, the faster fermentation proceeds. Adjust yeast quantity and fermentation time accordingly.\n\n🍕 What does PizzaBook recommend?\n\nPizzaBook considers time until baking, room temperature and refrigerator temperature, then calculates yeast quantity and a fermentation schedule.\n\nIt recommends the more suitable method based on these inputs. If there is not enough time for refrigeration, only room-temperature fermentation is available.\n\nImportant: This calculation is an estimate. Actual dough readiness also depends on dough temperature and its development during fermentation.',
                      ) */
                      hitSlop={8}
                      style={styles.infoBtn}
                    >
                      <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
                    </Pressable>
                  </View>
                  {beginnerSelectableModes.length > 0 ? (
                    <View style={styles.fermentationModeOptions}>
                    {beginnerSelectableModes.map((evaluation) => {
                      const mode = (evaluation.candidate as unknown as { mode: BeginnerDirectScheduleMode }).mode;
                      const selected = beginnerScheduleMode === mode;
                      const label = mode === 'fridgeRoom'
                        ? (lang === 'hr' ? 'Fermentacija u hladnjaku' : lang === 'de' ? 'Gärung im Kühlschrank' : lang === 'sl' ? 'Fermentacija v hladilniku' : 'Refrigerator fermentation')
                        : (lang === 'hr' ? 'Fermentacija na sobnoj temperaturi' : lang === 'de' ? 'Gärung bei Raumtemperatur' : lang === 'sl' ? 'Fermentacija pri sobni temperaturi' : 'Room-temperature fermentation');
                      return (
                        <Pressable
                          key={mode}
                          testID={`beginner-mode-${mode}`}
                          onPress={() => {
                            beginnerScheduleModeUserSelected.current = true;
                            setBeginnerScheduleMode(mode);
                            setNighttimeWarningRequest((request) => request + 1);
                          }}
                          style={[
                            styles.fermentationModeOption,
                            selected && styles.fermentationModeOptionSelected,
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fermentationModeOptionText}>{label}</Text>
                            {mode === 'fridgeRoom' ? <Text style={styles.hint}>{lang === 'hr' ? 'Uključuje završno odmaranje na sobnoj temperaturi' : lang === 'de' ? 'Mit abschließender Ruhezeit bei Raumtemperatur' : lang === 'sl' ? 'Vključuje končni počitek pri sobni temperaturi' : 'Includes a final room-temperature rest'}</Text> : null}
                            {evaluation.recommended ? <Text style={styles.fermentationRecommendation}>{lang === 'hr' ? 'Preporučeno' : lang === 'de' ? 'Empfohlen' : lang === 'sl' ? 'Priporočeno' : 'Recommended'}</Text> : null}
                          </View>
                          {selected ? <Icon name="checkmark" size={22} color={COLORS.brand} /> : null}
                        </Pressable>
                      );
                    })}
                    </View>
                  ) : (
                    <Text style={styles.hint}>
                      {lang === 'hr'
                        ? 'Za odabrano vrijeme nije moguće sigurno izračunati fermentaciju. Odaberite kasnije vrijeme pečenja.'
                        : lang === 'de'
                          ? 'Für das gewählte Zeitfenster konnte keine sichere Gärung berechnet werden. Wählen Sie eine spätere Backzeit.'
                          : lang === 'sl'
                            ? 'Za izbrani čas ni mogoče izračunati varne fermentacije. Izberite poznejši čas peke.'
                            : 'No safe fermentation schedule can be calculated for the selected time window. Choose a later bake time.'}
                    </Text>
                  )}
                </View>
              ) : null}
              <View style={{ gap: SPACING.sm }}>
              <View style={styles.hydRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.label}>{t.beginnerCalc.stepHydration}</Text>
                    <Pressable testID="hydration-info" onPress={() => Alert.alert(t.beginnerCalc.stepHydration, t.beginnerCalc.hydrationInfo)} hitSlop={8} style={styles.infoBtn}>
                      <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
                    </Pressable>
                  </View>
                  <Text style={styles.subLabel}>{t.beginnerCalc.hydrationIdeal}: {idealHydration}%</Text>
                </View>
                <View style={[styles.stepper, isIdealHydration && styles.stepperIdeal]}>
                  <Pressable testID="hyd-minus" onPress={() => step(() => setHydration(Math.max(50, hydration - 1)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
                  <Text accessibilityLabel={`${hydration}%${isIdealHydration ? `, ${t.beginnerCalc.hydrationIdealState}` : ''}`} style={[styles.stepVal, isIdealHydration && { color: COLORS.success }]}>{hydration}%{isIdealHydration ? ` ✓ ${t.beginnerCalc.hydrationIdealState}` : ''}</Text>
                  <Pressable testID="hyd-plus" onPress={() => step(() => setHydration(Math.min(95, hydration + 1)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
                </View>
              </View>
              <View style={[styles.row, { marginTop: SPACING.sm }]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.label}>{t.calc.roomTemp}</Text>
                    <Pressable testID="room-temperature-info" onPress={() => Alert.alert(t.calc.roomTemp, t.beginnerCalc.roomTemperatureInfo)} hitSlop={8} style={styles.infoBtn}>
                      <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.stepper}>
                  <Pressable testID="rt-minus" onPress={() => step(() => setRoomTemp(Math.max(10, roomTemp - 1)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
                  <Text style={styles.stepVal}>{formatTemperature(roomTemp, temperatureUnit)}</Text>
                  <Pressable testID="rt-plus" onPress={() => step(() => setRoomTemp(Math.min(35, roomTemp + 1)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
                </View>
              </View>
              <View style={[styles.row, { marginTop: SPACING.sm }]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.label}>{t.calc.fridgeTempShort}</Text>
                    <Pressable testID="fridge-temperature-info" onPress={() => Alert.alert(t.calc.fridgeTempShort, t.beginnerCalc.fridgeTemperatureInfo)} hitSlop={8} style={styles.infoBtn}>
                      <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.stepper}>
                  <Pressable testID="ft-minus" onPress={() => step(() => setFridgeTemp(Math.max(2, fridgeTemp - 1)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
                  <Text style={styles.stepVal}>{formatTemperature(fridgeTemp, temperatureUnit)}</Text>
                  <Pressable testID="ft-plus" onPress={() => step(() => setFridgeTemp(Math.min(10, fridgeTemp + 1)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
                </View>
              </View>
              <Text style={styles.hint}>{t.beginnerCalc.directInfo}</Text>
              </View>
              </View>
            </View>
          ) : null}
          {methodExpanded && !isBeginner ? <>
          <Text style={styles.label}>{t.calc.method}</Text>
          {flour === 'glutenFree' ? <Text style={styles.hint}>Za bezglutensko brašno dostupna je samo direktna metoda.</Text> : null}
          <View style={styles.pillGroup}>
            {[
              { k: 'direct' as const, l: t.calc.direct },
              { k: 'biga' as const, l: t.calc.biga },
              { k: 'poolish' as const, l: t.calc.poolish },
            ].filter((m) => isBeginner ? m.k === 'direct' : flour !== 'glutenFree' || m.k === 'direct').map((m) => (
              <View
                key={m.k}
                style={[styles.pill, method === m.k && styles.pillActive]}
              >
                <Pressable
                  testID={`method-${m.k}`}
                  onPress={() => { try { Haptics.selectionAsync(); } catch {}; setMethod(m.k); setShowMixSteps(true); }}
                  style={styles.pillSelect}
                >
                  <Text style={[styles.pillText, method === m.k && styles.pillTextActive]}>{m.l}</Text>
                </Pressable>
                <Pressable testID={`method-info-${m.k}`} onPress={() => setMethodInfo(m.k)} hitSlop={8} style={styles.infoBtn}>
                  <Icon name="information-circle-outline" size={18} color={method === m.k ? '#fff' : COLORS.muted} />
                </Pressable>
              </View>
            ))}
          </View>

          {method === 'biga' ? (
            <>
            <View style={[styles.row, { marginTop: SPACING.md }] }>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{({ hr: 'Biga u zamjesu', en: 'Biga in final mix', de: 'Biga im Hauptteig', sl: 'Biga v končnem testu' }[lang])} ({bigaPct}%)</Text>
                <Text style={styles.subLabel}>{({ hr: 'Postotak brašna koji ide u bigu', en: 'Percentage of flour used in the biga', de: 'Mehlanteil für die Biga', sl: 'Odstotek moke za bigo' }[lang])}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable testID="biga-minus" onPress={() => step(() => setBigaPct(Math.max(20, bigaPct - 5)))} style={styles.stepBtn}>
                  <Icon name="remove" size={20} color={COLORS.brand} />
                </Pressable>
                <Text style={styles.stepVal}>{bigaPct}%</Text>
                <Pressable testID="biga-plus" onPress={() => step(() => setBigaPct(Math.min(100, bigaPct + 5)))} style={styles.stepBtn}>
                  <Icon name="add" size={20} color={COLORS.brand} />
                </Pressable>
              </View>
            </View>
            {method === 'biga' ? (
              <Text style={[styles.hint, { color: COLORS.warning }]}>
                {bigaPct === 100
                  ? ({ hr: 'Upozorenje: nema preostalog brašna. U završni zamjes dodaje se samo preostala voda.', en: 'Warning: no flour remains. Only the remaining water is added to the final mix.', de: 'Warnung: Es bleibt kein Mehl übrig. Zum Hauptteig wird nur das restliche Wasser gegeben.', sl: 'Opozorilo: preostale moke ni. V končno mešanico dodate samo preostalo vodo.' }[lang])
                  : ({ hr: 'Upozorenje: provjerite postotak bige i količine za završni zamjes.', en: 'Warning: check the biga percentage and final-mix quantities.', de: 'Warnung: Prüfen Sie den Biga-Anteil und die Mengen für den Hauptteig.', sl: 'Opozorilo: preverite odstotek bige in količine za končno mešanico.' }[lang])}
              </Text>
            ) : null}
            <View style={[styles.row, { marginTop: SPACING.sm }] }>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithInfo}>
                  <Text style={styles.label}>{({ hr: 'Trajanje fermentacije Bige', en: 'Biga fermentation time', de: 'Biga-Fermentationszeit', sl: 'Čas fermentacije Bige' }[lang])}</Text>
                  <Pressable testID="biga-fermentation-info" onPress={() => Alert.alert(fermentationInfoTitle, formatUnitText(fermentationInfoBody, temperatureUnit, measurementSystem))} style={styles.infoBtn} hitSlop={8}><Icon name="information-circle-outline" size={18} color={COLORS.brand} /></Pressable>
                </View>
                <Text style={styles.subLabel}>{({ hr: 'Ovo vrijeme ulazi u izračun kvasca', en: 'This time is included in the yeast calculation', de: 'Diese Zeit wird in die Hefeberechnung einbezogen', sl: 'Ta čas je vključen v izračun kvasa' }[lang])}</Text>
              </View>
              <View style={[styles.stepper, idealPreferment && styles.stepperIdeal]}>
                <Pressable testID="biga-hours-minus" onPress={() => step(() => setBigaHours(Math.max(4, bigaHours - 1)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
                <Text style={[styles.stepVal, idealPreferment && styles.stepValIdeal]}>{bigaHours}h</Text>
                <Pressable testID="biga-hours-plus" onPress={() => step(() => setBigaHours(Math.min(48, bigaHours + 1)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
              </View>
            </View>
            </>
          ) : null}

          {method === 'poolish' ? (
            <>
              <View style={[styles.row, { marginTop: SPACING.md }] }>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{({ hr: 'Poolish u zamjesu', en: 'Poolish in final mix', de: 'Poolish im Hauptteig', sl: 'Poolish v končnem testu' }[lang])} ({poolishPct}%)</Text>
                  <Text style={styles.subLabel}>{({ hr: 'Postotak brašna koji ide u Poolish', en: 'Percentage of flour used in the Poolish', de: 'Mehlanteil für den Poolish', sl: 'Odstotek moke za Poolish' }[lang])}</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable testID="poolish-minus" onPress={() => step(() => setPoolishPct(Math.max(20, poolishPct - 5)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
                  <Text style={styles.stepVal}>{poolishPct}%</Text>
                  <Pressable testID="poolish-plus" onPress={() => step(() => setPoolishPct(Math.min(100, poolishPct + 5)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
                </View>
              </View>
              <View style={[styles.row, { marginTop: SPACING.sm }] }>
                <View style={{ flex: 1 }}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.label}>{({ hr: 'Trajanje fermentacije Poolisha', en: 'Poolish fermentation time', de: 'Poolish-Fermentationszeit', sl: 'Čas fermentacije Poolisha' }[lang])}</Text>
                    <Pressable testID="poolish-fermentation-info" onPress={() => Alert.alert(fermentationInfoTitle, formatUnitText(fermentationInfoBody, temperatureUnit, measurementSystem))} style={styles.infoBtn} hitSlop={8}><Icon name="information-circle-outline" size={18} color={COLORS.brand} /></Pressable>
                  </View>
                  <Text style={styles.subLabel}>{({ hr: 'Ovo vrijeme ulazi u izračun kvasca', en: 'This time is included in the yeast calculation', de: 'Diese Zeit wird in die Hefeberechnung einbezogen', sl: 'Ta čas je vključen v izračun kvasa' }[lang])}</Text>
                </View>
                <View style={[styles.stepper, idealPreferment && styles.stepperIdeal]}>
                  <Pressable testID="poolish-hours-minus" onPress={() => step(() => setPoolishHours(Math.max(4, poolishHours - 1)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
                  <Text style={[styles.stepVal, idealPreferment && styles.stepValIdeal]}>{poolishHours}h</Text>
                  <Pressable testID="poolish-hours-plus" onPress={() => step(() => setPoolishHours(Math.min(48, poolishHours + 1)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.hydRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{isBeginner ? t.beginnerCalc.stepHydration : t.calc.hydration}</Text>
              <Text style={styles.subLabel}>{isBeginner ? `${t.beginnerCalc.hydrationIdeal}: ${idealHydration}%` : `${t.calc.idealHydration}: ${flourProfile.min}–${flourProfile.max}% (◎ ${styleProfile.hydration}%)`}</Text>
            </View>
            <View style={[styles.stepper, isIdealHydration && styles.stepperIdeal, !isIdealHydration && inRange && styles.stepperInRange]}>
              <Pressable testID="hyd-minus" onPress={() => step(() => setHydration(Math.max(50, hydration - 1)))} style={styles.stepBtn}>
                <Icon name="remove" size={20} color={isIdealHydration ? COLORS.success : COLORS.brand} />
              </Pressable>
              <Text accessibilityLabel={`${hydration}%${isBeginner && isIdealHydration ? `, ${t.beginnerCalc.hydrationIdealState}` : ''}`} style={[styles.stepVal, isIdealHydration && { color: COLORS.success }]}>{hydration}%{isBeginner && isIdealHydration ? ` ✓ ${t.beginnerCalc.hydrationIdealState}` : ''}</Text>
              <Pressable testID="hyd-plus" onPress={() => step(() => setHydration(Math.min(95, hydration + 1)))} style={styles.stepBtn}>
                <Icon name="add" size={20} color={isIdealHydration ? COLORS.success : COLORS.brand} />
              </Pressable>
            </View>
          </View>

          {!isBeginner ? <View style={[styles.row, { marginTop: SPACING.md }] }>
            <Text style={styles.label}>{t.calc.salt}</Text>
            <View style={[styles.stepper, isIdealSalt && styles.stepperIdeal]}>
              <Pressable testID="salt-minus" onPress={() => step(() => setSaltPct(Math.max(0, Math.round((saltPct - 0.1) * 10) / 10)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
              <Text style={[styles.stepVal, isIdealSalt && styles.stepValIdeal]}>{saltPct}%</Text>
              <Pressable testID="salt-plus" onPress={() => step(() => setSaltPct(Math.min(6, Math.round((saltPct + 0.1) * 10) / 10)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
            </View>
          </View> : null}

          {!isBeginner ? <View style={[styles.row, { marginTop: SPACING.sm }] }>
            <Text style={styles.label}>{t.calc.oil}</Text>
            <View style={[styles.stepper, isIdealOil && styles.stepperIdeal]}>
              <Pressable testID="oil-minus" onPress={() => step(() => setOilPct(Math.max(0, Math.round((oilPct - 0.5) * 10) / 10)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
              <Text style={[styles.stepVal, isIdealOil && styles.stepValIdeal]}>{oilPct}%</Text>
              <Pressable testID="oil-plus" onPress={() => step(() => setOilPct(Math.min(10, Math.round((oilPct + 0.5) * 10) / 10)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
            </View>
          </View> : null}

          {!isBeginner ? <View style={[styles.row, { marginTop: SPACING.md }]}>
            <Text style={styles.label}>{t.calc.roomTemp}</Text>
            <View style={styles.stepper}>
              <Pressable testID="rt-minus" onPress={() => step(() => setRoomTemp(Math.max(10, roomTemp - 1)))} style={styles.stepBtn}>
                <Icon name="remove" size={20} color={COLORS.brand} />
              </Pressable>
              <Text style={styles.stepVal}>{formatTemperature(roomTemp, temperatureUnit)}</Text>
              <Pressable testID="rt-plus" onPress={() => step(() => setRoomTemp(Math.min(35, roomTemp + 1)))} style={styles.stepBtn}>
                <Icon name="add" size={20} color={COLORS.brand} />
              </Pressable>
            </View>
          </View> : null}

          {!(isBeginner && method === 'direct') ? <View style={[styles.row, { marginTop: SPACING.sm }] }>
            <Text style={styles.label}>{t.calc.roomHours}</Text>
            <View style={styles.stepper}>
              <Pressable testID="rh-minus" onPress={() => step(() => setRoomHours(Math.max(0, roomHours - 1)))} style={styles.stepBtn}>
                <Icon name="remove" size={20} color={COLORS.brand} />
              </Pressable>
              <Text style={styles.stepVal}>{roomHours}h</Text>
              <Pressable testID="rh-plus" onPress={() => step(() => setRoomHours(Math.min(24, roomHours + 1)))} style={styles.stepBtn}>
                <Icon name="add" size={20} color={COLORS.brand} />
              </Pressable>
            </View>
          </View> : null}

          {!(isBeginner && method === 'direct') ? <View style={[styles.row, { marginTop: SPACING.sm }] }>
            <Text style={styles.label}>{t.calc.fridgeHours}</Text>
            <View style={styles.stepper}>
              <Pressable testID="fh-minus" onPress={() => step(() => setFridgeHours(Math.max(0, fridgeHours - 2)))} style={styles.stepBtn}>
                <Icon name="remove" size={20} color={COLORS.brand} />
              </Pressable>
              <Text style={styles.stepVal}>{fridgeHours}h</Text>
              <Pressable testID="fh-plus" onPress={() => step(() => setFridgeHours(Math.min(72, fridgeHours + 2)))} style={styles.stepBtn}>
                <Icon name="add" size={20} color={COLORS.brand} />
              </Pressable>
            </View>
          </View> : null}

          {!isBeginner ? <View style={[styles.row, { marginTop: SPACING.sm }]}>
            <Text style={styles.label}>{t.calc.fridgeTempShort}</Text>
            <View style={styles.stepper}>
              <Pressable testID="ft-minus" onPress={() => step(() => setFridgeTemp(Math.max(2, fridgeTemp - 1)))} style={styles.stepBtn}>
                <Icon name="remove" size={20} color={COLORS.brand} />
              </Pressable>
              <Text style={styles.stepVal}>{formatTemperature(fridgeTemp, temperatureUnit)}</Text>
              <Pressable testID="ft-plus" onPress={() => step(() => setFridgeTemp(Math.min(10, fridgeTemp + 1)))} style={styles.stepBtn}>
                <Icon name="add" size={20} color={COLORS.brand} />
              </Pressable>
            </View>
          </View> : null}

          {!isBeginner ? <Pressable
            testID="use-ice-toggle"
            onPress={() => step(() => setUseIce((value) => !value))}
            style={[styles.row, { marginTop: SPACING.md }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Koristi led</Text>
              <Text style={styles.subLabel}>Opcionalno; led zamjenjuje dio ukupne vode.</Text>
            </View>
            <Icon name={useIce ? 'checkbox' : 'square-outline'} size={24} color={useIce ? COLORS.brand : COLORS.muted} />
          </Pressable> : null}
          </> : null}
        </View>

        <View ref={(node) => { beginnerSectionRefs.current.oven = node; }} style={styles.card} onLayout={(event) => recordBeginnerSection('oven', event.nativeEvent.layout.y)}>
          <View style={styles.labelWithInfo}>
            <Text style={styles.cardTitle}>{isBeginner ? t.beginnerCalc.stepOven : `6 · ${t.calc.baking}`}</Text>
            {isBeginner ? (
              <Pressable
                testID="beginner-oven-info"
                onPress={() => Alert.alert(t.beginnerCalc.stepOven, buildBeginnerOvenInfo(lang, oven, ovenTemp, isRomanTeglia))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.ovenRow}>
            {isRomanTeglia ? (
              <OvenCard active={oven === 'homePan'} onPress={() => step(() => selectOven('homePan', 250))} imageSrc={require('../../assets/images/oven-home-pan.png')} title={t.calc.homePan} testID="oven-homePan" />
            ) : (
              <>
                <OvenCard active={oven === 'homeStone'} onPress={() => step(() => selectOven('homeStone', 300))} imageSrc={require('../../assets/images/oven-home-stone.png')} title={t.calc.homeStone} testID="oven-homeStone" />
                <OvenCard active={oven === 'ooni'} onPress={() => step(() => selectOven('ooni', 450))} imageSrc={require('../../assets/images/oven-ooni.png')} title={t.calc.ooni} testID="oven-ooni" />
                <OvenCard active={oven === 'homePan'} onPress={() => step(() => selectOven('homePan', 250))} imageSrc={require('../../assets/images/oven-home-pan.png')} title={t.calc.homePan} testID="oven-homePan" />
              </>
            )}
          </View>
          <View style={styles.bakeInstructions}>
            <View style={styles.bakeTemperatureInputRow}>
              <Text style={styles.bakeTempLabel}>{ovenTempLabel}</Text>
              <TextInput
                testID="oven-temperature"
                value={ovenTempEditing ? ovenTempInput : String(displayTemperature(ovenTemp, temperatureUnit))}
                onChangeText={(value) => {
                  const clean = value.replace(/[^0-9]/g, '').slice(0, 4);
                  setOvenTempInput(clean);
                  setOvenTempEditing(true);
                  const parsed = Number(clean);
                  const celsius = temperatureInputToCelsius(parsed, temperatureUnit);
                  if (clean !== '' && Number.isFinite(celsius) && celsius >= 200 && celsius <= 500) setOvenTemp(Math.round(celsius));
                }}
                onBlur={commitOvenTemperature}
                keyboardType="numeric"
                style={styles.customInput}
              />
              <Text style={styles.bakeTempUnit}>{temperatureUnit === 'fahrenheit' ? '°F' : '°C'}</Text>
            </View>
            <Text style={styles.bakeText}>{bakingDuration}</Text>
          </View>
        </View>

        {beginnerHomeRecipeLayout ? (
          <View style={styles.recipeCard} testID="beginner-ingredients">
            <Pressable
              testID="beginner-ingredients-toggle"
              accessibilityRole="button"
              accessibilityState={{ expanded: beginnerIngredientsExpanded }}
              onPress={() => setBeginnerIngredientsExpanded((expanded) => !expanded)}
              style={styles.recipeAccordionHeader}
            >
              <Text style={styles.recipeSection}>1. {t.beginnerCalc.ingredientList}</Text>
              <Icon name={beginnerIngredientsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
            </Pressable>
            {beginnerIngredientsExpanded ? recipeIngredients : null}
          </View>
        ) : isBeginner ? (
          <View style={styles.recipeCard} testID="beginner-ingredients">
            <Pressable
              testID="beginner-ingredients-toggle"
              accessibilityRole="button"
              accessibilityState={{ expanded: beginnerIngredientsExpanded }}
              onPress={() => setBeginnerIngredientsExpanded((expanded) => !expanded)}
              style={styles.recipeAccordionHeader}
            >
              <Text style={styles.recipeSection}>{t.beginnerCalc.ingredientList}</Text>
              <Icon name={beginnerIngredientsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
            </Pressable>
            {beginnerIngredientsExpanded ? recipeIngredients : null}
          </View>
        ) : null}

        {beginnerHomeRecipeLayout ? (
          <View ref={(node) => { beginnerSectionRefs.current.plan = node; }} onLayout={(event) => recordBeginnerSection('plan', event.nativeEvent.layout.y)} style={styles.recipeCard} testID="beginner-final-recipe">
            <View style={styles.labelWithInfo}>
              <Pressable
                testID="beginner-plan-toggle"
                accessibilityRole="button"
                accessibilityState={{ expanded: beginnerPlanExpanded }}
                onPress={() => setBeginnerPlanExpanded((expanded) => !expanded)}
                style={[styles.recipeAccordionHeader, { flex: 1 }]}
              >
                <Text style={styles.recipeSection}>2. {t.beginnerCalc.homePlan}</Text>
                <Icon name={beginnerPlanExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
              </Pressable>
              <Pressable testID="plan-info" onPress={() => Alert.alert(t.beginnerCalc.homePlan, t.beginnerCalc.planInfo)} hitSlop={8} style={styles.infoBtn}>
                <Icon name="information-circle-outline" size={18} color={COLORS.brand} />
              </Pressable>
            </View>
            {beginnerPlanExpanded ? (
              guidedPlanId && guidedProgressPlanId === guidedPlanId ? (
                <GuidedRecipeSchedule
                  groups={guidedDateGroups}
                  completedAt={guidedCompletedAt}
                  nextEvent={nextGuidedEvent}
                  dateLocale={{ hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang]}
                  labels={{
                    complete: t.beginnerCalc.guidedComplete,
                    completed: t.beginnerCalc.guidedCompleted,
                  }}
                  onComplete={completeGuidedStep}
                />
              ) : beginnerHomePlanMilestones.map((milestone, index) => (
                <Text key={`${index}-${milestone}`} style={styles.hint}>{milestone}</Text>
              ))
            ) : null}
          </View>
        ) : null}

        {guidedPlanId && guidedProgressPlanId === guidedPlanId ? (
          <GuidedRecipePanel
            nextEvent={nextGuidedEvent}
            nextTimeLabel={guidedNextTimeLabel}
            progress={guidedProgress}
            notificationsEnabled={guidedNotificationsEnabled}
            notificationsAvailable={Platform.OS !== 'web' && isPushSupported()}
            labels={{
              progress: t.beginnerCalc.guidedProgress,
              progressCount: t.beginnerCalc.guidedProgressCount,
              next: t.beginnerCalc.guidedNext,
              notifications: t.beginnerCalc.guidedNotifications,
              notificationsOn: t.beginnerCalc.guidedNotificationsOn,
              notificationsOff: t.beginnerCalc.guidedNotificationsOff,
              notificationsUnavailable: t.beginnerCalc.guidedNotificationsUnavailable,
              noNext: t.beginnerCalc.guidedNoNext,
            }}
            onToggleNotifications={toggleGuidedNotifications}
          />
        ) : null}

        {/* 4. MIXING */}
        {(!isBeginner || beginnerDirectHome) ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isBeginner ? (beginnerHomeRecipeLayout ? `3. ${t.beginnerCalc.recipeSteps}` : t.beginnerCalc.recipeSteps) : `5 · ${t.calc.mixingTitle}`}</Text>
          {!isBeginner ? (
          <>
          <View style={styles.segmentedRow}>
            <Pressable testID="mix-hand" onPress={() => step(() => { setMixing('hand'); setShowMixSteps(true); })} style={[styles.segBtn, mixing === 'hand' && styles.segBtnActive]}>
              <Image source={require('../../assets/images/hand-left-outline.png')} style={styles.mixIcon} resizeMode="contain" />
              <Text style={[styles.segText, mixing === 'hand' && { color: '#fff' }]}>{t.calc.handMixTitle}</Text>
            </Pressable>
            <Pressable testID="mix-mixer" onPress={() => step(() => { setMixing('mixer'); setShowMixSteps(true); })} style={[styles.segBtn, mixing === 'mixer' && styles.segBtnActive]}>
              <Image source={require('../../assets/images/hardware-chip-outline.png')} style={styles.mixIcon} resizeMode="contain" />
              <Text style={[styles.segText, mixing === 'mixer' && { color: '#fff' }]}>{t.calc.mixerTitle}</Text>
            </Pressable>
          </View>
          {!isBeginner ? (
            <Pressable testID="mix-toggle" onPress={() => setShowMixSteps(!showMixSteps)} style={styles.expandBtn}>
              <Text style={styles.expandText}>{showMixSteps ? t.calc.hideSteps : t.calc.showSteps}</Text>
              <Icon name={showMixSteps ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.brand} />
            </Pressable>
          ) : null}
          </>
          ) : null}
          {showMixSteps || isBeginner ? (
            <View style={styles.stepsBox}>
              {directHomeScheduleDisplay && !beginnerHomeRecipeLayout ? (
                <PhaseBlock
                  title={directHomeScheduleDisplay.title}
                  steps={directHomeScheduleDisplay.steps}
                  phaseKey="direct-home-schedule"
                  timers={directHomeScheduleDisplay.timers}
                  completed={completedSteps}
                  onToggle={toggleStep}
                  activeTimers={activeTimers}
                  onStartTimer={startTimer}
                  onStopTimer={stopTimer}
                  lang={lang}
                />
              ) : null}
              {((bigaPreparation && !bigaHomeSchedule) || (poolishPreparation && !poolishHomeSchedule)) ? (
                <PhaseBlock
                  title={(bigaPreparation || poolishPreparation)!.title}
                  steps={(bigaPreparation || poolishPreparation)!.steps}
                  bigaInfo={(bigaPreparation || poolishPreparation)!.info}
                  infoTitleOverrides={{ biga: bigaPreparation ? ({ hr: 'Postotak bige', en: 'Biga percentage', de: 'Biga-Anteil', sl: 'Odstotek bige' }[lang]) : ({ hr: 'Postotak Poolisha', en: 'Poolish percentage', de: 'Poolish-Anteil', sl: 'Odstotek Poolisha' }[lang]) }}
                  phaseKey={`${method}-${mixing}-preparation`}
                  timers={bigaPreparation ? [
                    { id: `biga-fermentation-${mixing}`, seconds: bigaHours * 3600, kind: 'rt' as const },
                  ] : (poolishPreparation || { timers: [] }).timers}
                  completed={completedSteps}
                  onToggle={toggleStep}
                  activeTimers={activeTimers}
                  onStartTimer={startTimer}
                  onStopTimer={stopTimer}
                  lang={lang}
                />
              ) : null}
              {bigaPreparation && bigaHomeSchedule ? (
                <PhaseBlock
                  title={bigaPreparation.title}
                  steps={bigaHomePreparationSteps ?? bigaPreparation.steps.slice(0, 2)}
                  bigaInfo={bigaPreparation.info}
                  phaseKey={`${method}-${mixing}-preparation`}
                  timers={[]}
                  completed={completedSteps}
                  onToggle={toggleStep}
                  activeTimers={activeTimers}
                  onStartTimer={startTimer}
                  onStopTimer={stopTimer}
                  lang={lang}
                />
              ) : null}
              {poolishPreparation && poolishHomeSchedule ? (
                <PhaseBlock
                  title={poolishPreparation.title}
                  steps={poolishPreparation.steps.slice(0, -2)}
                  bigaInfo={poolishPreparation.info}
                  infoTitleOverrides={{ biga: ({ hr: 'Poolish', en: 'Poolish', de: 'Poolish', sl: 'Poolish' }[lang]) }}
                  phaseKey={`${method}-${mixing}-preparation`}
                  timers={[]}
                  completed={completedSteps}
                  onToggle={toggleStep}
                  activeTimers={activeTimers}
                  onStartTimer={startTimer}
                  onStopTimer={stopTimer}
                  lang={lang}
                />
              ) : null}
              {bigaHomeScheduleDisplay && !beginnerHomeRecipeLayout ? (
                <PhaseBlock
                  title={bigaHomeScheduleDisplay.title}
                  steps={bigaHomeScheduleDisplay.steps}
                  phaseKey="biga-home-schedule"
                  timers={[]}
                  completed={completedSteps}
                  onToggle={toggleStep}
                  activeTimers={activeTimers}
                  onStartTimer={startTimer}
                  onStopTimer={stopTimer}
                  lang={lang}
                />
              ) : null}
              {poolishHomeScheduleDisplay && !beginnerHomeRecipeLayout ? (
                <PhaseBlock
                  title={poolishHomeScheduleDisplay.title}
                  steps={poolishHomeScheduleDisplay.steps}
                  phaseKey="poolish-home-schedule"
                  timers={[]}
                  completed={completedSteps}
                  onToggle={toggleStep}
                  activeTimers={activeTimers}
                  onStartTimer={startTimer}
                  onStopTimer={stopTimer}
                  lang={lang}
                />
              ) : null}
              {bigaHomeRecipePhases ? (
                bigaHomeRecipePhases.map((phase, index) => (
                  <PhaseBlock
                    key={`biga-home-recipe-${index}`}
                    title={phase.title}
                    steps={phase.steps}
                    phaseKey={`biga-home-recipe-${index}`}
                    timers={[]}
                    completed={completedSteps}
                    onToggle={toggleStep}
                    activeTimers={activeTimers}
                    onStartTimer={startTimer}
                    onStopTimer={stopTimer}
                    lang={lang}
                  />
                ))
              ) : detailedDirectSteps ? (
                (beginnerDirectHomeSteps ?? beginnerUnscheduledDirectSteps ?? beginnerDirectRecipeSteps ?? detailedDirectSteps).map((phase, index) => (
                  <PhaseBlock
                    key={`detailed-direct-${pizzaStyle}-${mixing}-${index}`}
                    title={phase.title}
                    steps={beginnerDirectHomeSteps ? phase.steps : directHomeSchedule ? withoutDirectScheduleTiming(phase.steps) : phase.steps}
                    stepInfo={beginnerDirectHomeSteps
                      ? phase.stepInfo ?? (index === 1 && beginnerPhaseBPlan ? buildBeginnerPhaseBStepInfo(beginnerPhaseBPlan, lang, isRomanTeglia, flour) : undefined)
                      : undefined}
                    waterInfo={isBeginner && index === 0 ? beginnerWaterInfo : phase.waterInfo}
                    waterInfoStepIndex={(isTargetNeapolitanHandPhaseA || isTargetNeapolitanGlutenFreeHandPhaseA || isTargetNeapolitanGlutenFreeMixerPhaseA || isTargetTegliaGlutenFreeHandPhaseA || isTargetTegliaGlutenFreeMixerPhaseA || isTargetNeapolitanCustomHandPhaseA || isTargetNeapolitanCustomMixerPhaseA || isTargetNeapolitanMixerPhaseA || isTargetNeapolitanManitobaHandPhaseA || isTargetNeapolitanManitobaMixerPhaseA || isTargetNeapolitanSpeltHandPhaseA || isTargetNeapolitanSpeltMixerPhaseA || isTargetNeapolitanWholeWheatHandPhaseA || isTargetNeapolitanWholeWheatMixerPhaseA || isTargetTegliaTipo00HandPhaseA || isTargetTegliaTipo00MixerPhaseA || isTargetTegliaManitobaHandPhaseA || isTargetTegliaManitobaMixerPhaseA || isTargetTegliaSpeltHandPhaseA || isTargetTegliaSpeltMixerPhaseA || isTargetTegliaWholeWheatHandPhaseA || isTargetTegliaWholeWheatMixerPhaseA || isTargetTegliaCustomHandPhaseA || isTargetTegliaCustomMixerPhaseA) && index === 0 ? 2 : undefined}
                    containerOilInfo={phase.containerOilInfo}
                    fermentationInfo={beginnerDirectHomeSteps ? undefined : directHomeSchedule ? withoutDirectScheduleTimingText(phase.fermentationInfo) : phase.fermentationInfo}
                    fermentationSignsInfo={phase.fermentationSignsInfo}
                    degassingInfo={phase.degassingInfo}
                    doughHandlingInfo={phase.doughHandlingInfo}
                    doughHandlingInfoStepIndex={((isTargetNeapolitanGlutenFreeHandPhaseA || isTargetNeapolitanGlutenFreeMixerPhaseA || isTargetTegliaGlutenFreeHandPhaseA || isTargetTegliaGlutenFreeMixerPhaseA) ? index === 0 ? 6 : undefined : (isTargetNeapolitanHandPhaseA || isTargetNeapolitanCustomHandPhaseA || isTargetNeapolitanCustomMixerPhaseA || isTargetNeapolitanMixerPhaseA || isTargetNeapolitanManitobaHandPhaseA || isTargetNeapolitanManitobaMixerPhaseA || isTargetNeapolitanSpeltHandPhaseA || isTargetNeapolitanSpeltMixerPhaseA || isTargetNeapolitanWholeWheatHandPhaseA || isTargetNeapolitanWholeWheatMixerPhaseA || isTargetTegliaTipo00HandPhaseA || isTargetTegliaTipo00MixerPhaseA || isTargetTegliaManitobaHandPhaseA || isTargetTegliaManitobaMixerPhaseA || isTargetTegliaSpeltHandPhaseA || isTargetTegliaSpeltMixerPhaseA || isTargetTegliaWholeWheatHandPhaseA || isTargetTegliaWholeWheatMixerPhaseA || isTargetTegliaCustomHandPhaseA || isTargetTegliaCustomMixerPhaseA) && index === 0 ? 7 : undefined)}
                    temperingInfo={beginnerDirectHomeSteps ? undefined : directHomeSchedule ? withoutDirectScheduleTimingText(phase.temperingInfo) : phase.temperingInfo}
                    proofingInfo={phase.proofingInfo}
                    ovenTimingInfo={beginnerDirectHomeSteps ? undefined : phase.ovenTimingInfo}
                    ovenProgramInfo={phase.ovenProgramInfo}
                    bakingCheckInfo={phase.bakingCheckInfo}
                    bakingInfo={phase.bakingInfo}
                    infoTitleOverrides={beginnerDirectHome && index === 0
                        ? { ...phase.infoTitleOverrides, water: ({ hr: 'Temperatura vode', en: 'Water temperature', de: 'Wassertemperatur', sl: 'Temperatura vode' }[lang]) }
                        : phase.infoTitleOverrides}
                    doughTemperatureStyle={beginnerDirectHome ? (isRomanTeglia ? 'romanaTeglia' : pizzaStyle === 'romana' ? 'romanaTonda' : pizzaStyle === 'ny_style' ? 'newYork' : 'napolitana') : undefined}
                    phaseKey={`detailed-direct-${pizzaStyle}-${mixing}-${index}`}
                    timers={beginnerDirectHomeSteps ? phase.timers : directHomeSchedule ? [] : phase.timers}
                    phaseGuide={isBeginner && flour === 'glutenFree' && !isRomanTeglia && index === (directRecipeFridgeHours > 0 ? 4 : 3)
                      ? { kind: 'bakingGlutenFree', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('bakingGlutenFree'); } }
                      : isBeginner && flour !== 'glutenFree' && index === 0 && mixing === 'mixer'
                      ? { kind: mixing, onPress: () => setMixingGuideKind(mixing) }
                      : isBeginner && flour !== 'glutenFree' && index === 1 && phase.steps.some((step) => /stretch\s*&?\s*fold|preklop|pregib|fold/i.test(step))
                        ? { kind: 'stretchFold', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('stretchFold'); } }
                        : isBeginner && flour !== 'glutenFree' && !isRomanTeglia && index === 2
                          ? { kind: 'balling', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('balling'); } }
                          : isBeginner && pizzaStyle === 'neapolitan' && flour !== 'glutenFree' && !isRomanTeglia && index === (directRecipeFridgeHours > 0 ? 4 : 3)
                            ? { kind: 'baking', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('baking'); } }
                          : isBeginner && pizzaStyle === 'romana' && !isRomanTeglia && flour !== 'glutenFree' && index === (directRecipeFridgeHours > 0 ? 4 : 3)
                            ? { kind: 'bakingRomanaTonda', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('bakingRomanaTonda'); } }
                          : isBeginner && pizzaStyle === 'ny_style' && flour !== 'glutenFree' && index === (directRecipeFridgeHours > 0 ? 4 : 3)
                            ? { kind: 'bakingNewYork', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('bakingNewYork'); } }
                          : isBeginner && isRomanTeglia && flour !== 'glutenFree' && index === (directRecipeFridgeHours > 0 ? 4 : 3)
                            ? { kind: 'bakingRomanaTeglia', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('bakingRomanaTeglia'); } }
                          : undefined}
                    completed={completedSteps}
                    onToggle={toggleStep}
                    activeTimers={activeTimers}
                    onStartTimer={startTimer}
                    onStopTimer={stopTimer}
                    lang={lang}
                  />
                ))
              ) : method === 'direct' ? (
                mixing === 'hand' ? (
                  <>
                    <PhaseBlock title={t.calc.handMixSteps.A.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptFermentationSteps(t.calc.handMixSteps.A.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptFermentationSteps(t.calc.handMixSteps.A.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-A`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-hand-A', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.handMixSteps.B.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptFermentationSteps(t.calc.handMixSteps.B.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptFermentationSteps(t.calc.handMixSteps.B.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-B`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-hand-B', roomHours, fridgeHours)} phaseGuide={{ kind: 'stretchFold', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('stretchFold'); } }} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.handMixSteps.C.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptDirectPhaseSteps('C', t.calc.handMixSteps.C.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptDirectPhaseSteps('C', t.calc.handMixSteps.C.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-C`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-hand-C', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.handMixSteps.D.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptDirectPhaseSteps('D', t.calc.handMixSteps.D.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptDirectPhaseSteps('D', t.calc.handMixSteps.D.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-D`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-hand-D', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                  </>
                ) : (
                  <>
                    <PhaseBlock title={t.calc.mixerSteps.A.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptFermentationSteps(t.calc.mixerSteps.A.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptFermentationSteps(t.calc.mixerSteps.A.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-A`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-mixer-A', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.mixerSteps.B.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptFermentationSteps(t.calc.mixerSteps.B.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptFermentationSteps(t.calc.mixerSteps.B.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-B`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-mixer-B', roomHours, fridgeHours)} phaseGuide={{ kind: 'stretchFold', onPress: () => { setVisualGuideSlide(0); setMixingGuideKind('stretchFold'); } }} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.mixerSteps.C.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptDirectPhaseSteps('C', t.calc.mixerSteps.C.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptDirectPhaseSteps('C', t.calc.mixerSteps.C.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-C`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-mixer-C', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.mixerSteps.D.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptDirectPhaseSteps('D', t.calc.mixerSteps.D.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptDirectPhaseSteps('D', t.calc.mixerSteps.D.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-D`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-mixer-D', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                  </>
                )
              ) : method === 'biga' ? (
                (() => {
                  const path = BIGA_STEPS[lang][mixing];
                  return (
                    <>
                      {!bigaPreparation ? <PhaseBlock title={path.p1.title} steps={adaptFermentationSteps(path.p1.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`biga-${mixing}-P1`} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} /> : null}
                      <PhaseBlock title={path.p2.title} steps={bigaHomeSchedule ? withoutBigaScheduleTiming(path.p2.steps) : adaptFermentationSteps(path.p2.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`biga-${mixing}-P2`} timers={bigaHomeSchedule ? [] : undefined} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                      <PhaseBlock title={path.p3.title} steps={bigaHomeSchedule ? withoutBigaScheduleTiming(path.p3.steps) : adaptFermentationSteps(path.p3.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`biga-${mixing}-P3`} timers={bigaHomeSchedule ? [] : undefined} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    </>
                  );
                })()
              ) : (
                (() => {
                  const path = POOLISH_STEPS[lang][mixing];
                  return (
                    <>
                      <PhaseBlock title={path.p1.title} steps={poolishHomeSchedule ? withoutBigaScheduleTiming(path.p1.steps) : adaptFermentationSteps(path.p1.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`poolish-${mixing}-P1`} timers={poolishHomeSchedule ? [] : [...(roomHours > 0 ? [{ id: 'room-custom', seconds: roomHours * 3600, kind: 'rt' as const }] : []), ...(fridgeHours > 0 ? [{ id: 'fridge-custom', seconds: fridgeHours * 3600, kind: 'fridge' as const }] : [])]} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                      <PhaseBlock title={path.p2.title} steps={poolishMixSteps ?? adaptFermentationSteps(path.p2.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`poolish-${mixing}-P2`} timers={poolishHomeSchedule ? [] : undefined} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                      <PhaseBlock title={path.p3.title} steps={poolishHomeSchedule ? withoutBigaScheduleTiming(path.p3.steps) : adaptFermentationSteps(path.p3.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`poolish-${mixing}-P3`} timers={poolishHomeSchedule ? [] : undefined} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    </>
                  );
                })()
              )}
              <Pressable testID="reset-steps" onPress={resetStepsForCurrent} style={styles.resetBtn}>
                <Icon name="refresh" size={14} color={COLORS.muted} />
                <Text style={styles.resetBtnText}>{t.resetStepsBtn}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        ) : null}

        {/* 6. RESULT - AT BOTTOM: Total FIRST, then per-pizza */}
        {!isBeginner ? (
        <View style={styles.recipeCard}>
          {dough.preferment ? (
            <>
              <Text style={styles.recipeSection}>
                7 · {t.calc.preferment} · {method === 'biga' ? `BIGA ${bigaPct}%` : `POOLISH ${poolishPct}%`}
              </Text>
              <ResultRow label={t.calc.totalFlour} value={weight(dough.preferment.flour)} highlight />
              <ResultRow label={t.calc.totalWater} value={weight(dough.preferment.water)} highlight />
              <ResultRow label={t.calc.yeastAmount + ' (' + yeastShortLabel + ')'} value={weight(dough.preferment.yeast, true)} />
              {method === 'poolish' ? (
                <Text style={styles.hint}>{t.calc.poolishHint}</Text>
              ) : (
                <Text style={styles.hint}>{t.calc.bigaHint}</Text>
              )}

              <Text style={[styles.recipeSection, { marginTop: SPACING.md }]}>{t.calc.mainDough}</Text>
              <ResultRow label={t.calc.remainingFlour} value={weight(dough.main.flour)} highlight />
              {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={weight(psylliumGrams)} highlight /> : null}
              {ice ? (
                <>
                  <ResultRow label={`${t.calc.coldWater} (${t.calc.remainingLabel})`} value={weight(Math.max(0, dough.main.water - ice.ice))} />
                  <ResultRow label={`🧊 ${t.calc.iceAmount}`} value={weight(ice.ice)} highlight />
                </>
              ) : (
                <ResultRow label={`${t.calc.remainingWater} (${formatTemperature(dough.waterTemp, temperatureUnit)})`} value={weight(dough.main.water)} highlight />
              )}
              <ResultRow label={t.calc.saltAmount} value={weight(dough.main.salt, true)} />
              <ResultRow label={t.calc.oilAmount} value={weight(dough.main.oil)} />
              <ResultRow label={t.calc.yeastAmount + ' (' + yeastShortLabel + ')'} value={weight(dough.main.yeast, true)} />

              <View style={styles.subBlock}>
                <Text style={styles.subhead}>{t.calc.totals} · {pizzas} × {formatWeight(effectiveBall, measurementSystem)} = {formatWeight(dough.totalDough, measurementSystem)}</Text>
                <ResultRow label={t.calc.totalFlour} value={weight(dough.total.flour)} />
                {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={weight(psylliumGrams)} /> : null}
                <ResultRow label={t.calc.totalWater} value={weight(dough.total.water)} />
                <ResultRow label={t.calc.saltAmount} value={weight(dough.total.salt, true)} />
                <ResultRow label={t.calc.yeastAmount} value={weight(dough.total.yeast, true)} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.recipeSection}>
                7 · {t.calc.totalDough} · {pizzas} × {formatWeight(effectiveBall, measurementSystem)} = {formatWeight(dough.totalDough, measurementSystem)}
              </Text>
              {isCustom ? (
                <>
                  <ResultRow label={`${flourName(lang, blendA)} (${blendPctA}%)`} value={weight(Math.round(dough.main.flour * blendPctA / 100))} highlight />
                  <ResultRow label={`${flourName(lang, blendB)} (${100 - blendPctA}%)`} value={weight(Math.round(dough.main.flour * (100 - blendPctA) / 100))} highlight />
                  <ResultRow label={t.calc.totalFlour} value={weight(dough.main.flour)} />
                </>
              ) : (
                <ResultRow label={`${t.calc.flourLabel} (${flourName(lang, flour)})`} value={weight(dough.main.flour)} highlight />
              )}
              {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={weight(psylliumGrams)} highlight /> : null}
              {ice ? (
                <>
                  <ResultRow label={t.calc.coldWater} value={weight(ice.water)} />
                  <ResultRow label={`🧊 ${t.calc.iceAmount}`} value={weight(ice.ice)} highlight />
                </>
              ) : (
                <ResultRow label={`${t.calc.totalWater} (${formatTemperature(dough.waterTemp, temperatureUnit)})`} value={weight(dough.main.water)} highlight />
              )}
              <ResultRow label={t.calc.saltAmount} value={weight(dough.main.salt, true)} />
              <ResultRow label={`${t.calc.yeastAmount} (${yeastShortLabel}, ${dough.yeastPct}%)`} value={weight(dough.main.yeast, true)} />
              <ResultRow label={t.calc.oilAmount} value={weight(dough.main.oil)} />
            </>
          )}

          {/* Per-pizza normative — BELOW total */}
          <Text style={[styles.recipeSection, { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider }]}>
            {isBeginner && isRomanTeglia ? t.calc.perTray : `${t.calc.perPizza} · ${formatLength(diameter, measurementSystem)}`}
          </Text>
          <ResultRow label={isBeginner && isRomanTeglia ? t.calc.trayDoughMass : t.calc.doughBall} value={weight(effectiveBall)} />
          <ResultRow label={t.calc.sauce} value={weight(dims.sauce)} />
          <ResultRow label={t.calc.cheese} value={weight(dims.cheese)} />
        </View>
        ) : null}

        {/* 7. ACTIONS */}
        <View style={styles.actionsRow}>
          <Pressable testID="add-shopping" style={[styles.actionBtn, { backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border }]} onPress={onShopping}>
            <Icon name="cart" size={18} color={COLORS.brand} />
            <Text style={[styles.actionBtnText, { color: COLORS.brand }]}>{t.shopping.title}</Text>
          </Pressable>
          <Pressable testID="share-community" style={[styles.actionBtn, { backgroundColor: COLORS.brand }]} onPress={onShare}>
            <Icon name="share" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>{t.calc.shareToFeed}</Text>
          </Pressable>
        </View>
        <Pressable testID="save-recipe" style={styles.saveRecipeBtn} onPress={openSavedRecipes}>
          <Icon name="bookmark" size={18} color={COLORS.brand} />
          <Text style={styles.saveRecipeBtnText}>{t.calc.saveRecipe}</Text>
        </Pressable>

        {/* Footer links */}
        <View style={styles.moreRow}>
          <MoreLink icon="bookmark" label={t.calc.savedRecipes} onPress={openSavedRecipes} testID="more-saved-recipes" />
          <MoreLink icon="book" label={t.calc.school} onPress={() => setMoreTool('school')} testID="more-school" />
          <MoreLink icon="restaurant-outline" label={t.calc.leftover} onPress={() => setMoreTool('leftover')} testID="more-leftover" />
        </View>

      </ScrollView>

      {/* Floating active-timers bar */}
      {Object.keys(activeTimers).length > 0 ? (
        <View style={[styles.floatingTimers, { bottom: insets.bottom + 70 }]} pointerEvents="box-none">
          <View style={styles.floatingTimersInner}>
            <Icon name="alarm" size={16} color={COLORS.brand} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center', paddingRight: 6 }}>
              {Object.entries(activeTimers).map(([key, val]) => {
                const remaining = val.endsAt - now;
                return (
                  <Pressable
                    key={key}
                    testID={`floating-timer-${key}`}
                    onPress={() => {
                      const idx = key.lastIndexOf('-');
                      const pk = key.substring(0, idx);
                      const tid = key.substring(idx + 1);
                      stopTimer(pk, tid);
                    }}
                    style={styles.floatingChip}
                  >
                    <Text style={styles.floatingChipLabel} numberOfLines={1}>{val.label}</Text>
                    <Text style={styles.floatingChipTime}>{formatCountdown(remaining)}</Text>
                    <Icon name="close" size={12} color="#fff" />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}

      <Modal visible={!!moreTool} animationType="slide" onRequestClose={() => setMoreTool(null)}>
        {moreTool === 'school' && <SchoolModal onClose={() => setMoreTool(null)} />}
        {moreTool === 'leftover' && <LeftoverModal onClose={() => setMoreTool(null)} />}
        {moreTool === 'shopping' && <ShoppingModal onClose={() => setMoreTool(null)} />}
        {moreTool === 'savedRecipes' && (
          <SavedRecipesModal
            editingRecipe={editingRecipe}
            onClose={() => setMoreTool(null)}
            onLoad={(saved) => {
              applyRecipe(saved.recipe);
              setEditingRecipe({ id: saved.recipe_id, name: saved.name });
              setMoreTool(null);
            }}
            onSave={saveNamedRecipe}
          />
        )}
      </Modal>

      {/* Flour info tooltip modal */}
      <Modal visible={!!flourInfo} animationType="fade" transparent onRequestClose={() => setFlourInfo(null)}>
        <Pressable style={styles.tooltipBackdrop} onPress={() => setFlourInfo(null)}>
          <Pressable style={styles.tooltipCard} onPress={() => {}}>
            <View style={styles.tooltipHeader}>
              <Icon name="information-circle" size={20} color={COLORS.brand} />
              <Text style={styles.tooltipTitle}>{flourInfo?.label}</Text>
              <Pressable onPress={() => setFlourInfo(null)} hitSlop={8}>
                <Icon name="close" size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            <Text style={styles.tooltipBody}>{flourInfo?.info}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={fermentationInfoOpen} animationType="fade" transparent onRequestClose={() => setFermentationInfoOpen(false)}>
        <Pressable style={styles.tooltipBackdrop} onPress={() => setFermentationInfoOpen(false)}>
          <Pressable style={styles.tooltipCard} onPress={() => {}}>
            <View style={styles.tooltipHeader}>
              <Icon name="information-circle" size={20} color={COLORS.brand} />
              <Text style={styles.tooltipTitle}>{beginnerFermentationInfoTitle}</Text>
              <Pressable testID="close-beginner-fermentation-info" onPress={() => setFermentationInfoOpen(false)} hitSlop={8}>
                <Icon name="close" size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: SPACING.md }}>
              <Text style={styles.tooltipBody}>
                {beginnerFermentationInfoBody}
                {beginnerFlourGuidance ? `\n\n🍕 ${beginnerFlourGuidance}` : ''}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!styleInfo} animationType="fade" transparent onRequestClose={() => setStyleInfo(null)}>
        <Pressable style={styles.tooltipBackdrop} onPress={() => setStyleInfo(null)}>
          <Pressable style={styles.tooltipCard} onPress={() => {}}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipTitle}>{styleInfo ? t.calc.pizzaStyles[styleInfo].name : ''}</Text>
              <Pressable onPress={() => setStyleInfo(null)} hitSlop={8}>
                <Icon name="close-circle" size={22} color={COLORS.muted} />
              </Pressable>
            </View>
            {styleInfo ? (
              <ScrollView style={{ maxHeight: 460 }}>
                <Image source={styleImages[styleInfo]} style={styles.styleInfoImage} resizeMode="cover" />
                <Text style={styles.tooltipBody}>{t.calc.pizzaStyles[styleInfo].description}</Text>
                <Text style={styles.styleInfoLine}>{t.calc.styleInfo.diameter}: {formatLength(PIZZA_STYLE_PROFILES[styleInfo].defaultDiameter, measurementSystem)}</Text>
                <Text style={styles.styleInfoLine}>{t.calc.styleInfo.ball}: {weight(PIZZA_STYLE_PROFILES[styleInfo].ballWeight)}</Text>
                <Text style={styles.styleInfoLine}>{t.calc.styleInfo.hydration}: {PIZZA_STYLE_PROFILES[styleInfo].hydration}%</Text>
                <Text style={styles.styleInfoLine}>{t.calc.styleInfo.salt}: {PIZZA_STYLE_PROFILES[styleInfo].saltPct}%</Text>
                <Text style={styles.styleInfoLine}>{t.calc.styleInfo.oil}: {PIZZA_STYLE_PROFILES[styleInfo].oilPct}%</Text>
                <Text style={styles.styleInfoLine}>{t.calc.styleInfo.fermentation}: {isBeginner ? t.calc.styleInfo.fermentationPlanned : PIZZA_STYLE_PROFILES[styleInfo].fermentation === 'coldLong' ? t.calc.styleInfo.fermentationCold : t.calc.styleInfo.fermentationSameDay}</Text>
                <Text style={styles.styleInfoLine}>{t.calc.styleInfo.baking}: {styleInfo === 'ny_style' ? `${formatTemperature(ovenTemp, temperatureUnit)} · ${bakingTimeRange}` : formatUnitText(`${PIZZA_STYLE_PROFILES[styleInfo].bakeTemp} · ${PIZZA_STYLE_PROFILES[styleInfo].bakeTime}`, temperatureUnit, measurementSystem)}</Text>
                <Text style={styles.styleInfoLine}>{t.calc.styleInfo.shaping}: {styleInfo === 'ny_style' ? ({
                  hr: 'Veća kugla, tanka sredina i ujednačena debljina; kriška se lako savija bez visokog, napuhnutog ruba.',
                  en: 'Use a larger dough ball, a thin center, and even thickness for a foldable slice without a tall, puffy rim.',
                  de: 'Größeren Teigballen mit dünner Mitte und gleichmäßiger Dicke formen; das Stück soll faltbar sein, ohne hohen, aufgeblähten Rand.',
                  sl: 'Uporabite večjo kepico, tanko sredino in enakomerno debelino; rezina naj se zlahka prepogne brez visokega, napihnjenega roba.',
                }[lang]) : styleInfo === 'romana' ? t.calc.styleInfo.shapingRomana : t.calc.styleInfo.shapingNeapolitan}</Text>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!visibleMethodInfo} animationType="fade" transparent onRequestClose={() => setMethodInfo(null)}>
        <Pressable style={styles.tooltipBackdrop} onPress={() => setMethodInfo(null)}>
          <Pressable style={styles.tooltipCard} onPress={() => {}}>
            <View style={styles.tooltipHeader}>
              <Icon name="information-circle" size={20} color={COLORS.brand} />
              <Text style={styles.tooltipTitle}>{visibleMethodInfo ? METHOD_INFO[lang][visibleMethodInfo].title : ''}</Text>
              <Pressable onPress={() => setMethodInfo(null)} hitSlop={8}>
                <Icon name="close" size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 460 }}>
              <Text style={styles.tooltipBody}>{visibleMethodInfo ? METHOD_INFO[lang][visibleMethodInfo].body : ''}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={mixingGuideKind !== null} animationType="fade" transparent onRequestClose={() => setMixingGuideKind(null)}>
        <View style={styles.visualGuideBackdrop}>
          <View
            accessibilityViewIsModal
            style={styles.visualGuideCard}
            testID={mixingGuideKind === 'stretchFold'
              ? 'phase-b-visual-guide-modal'
              : mixingGuideKind === 'balling'
                ? 'phase-c-visual-guide-modal'
                : mixingGuideKind === 'baking'
                  ? 'phase-e-visual-guide-modal'
                : 'phase-a-visual-guide-modal'}
          >
            <ScrollView
              style={styles.visualGuideContent}
              contentContainerStyle={styles.visualGuideContentInner}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.visualGuideHeader}>
                <View style={styles.visualGuideHeading}>
                  <Text style={styles.visualGuideEyebrow}>{mixingGuideKind === 'stretchFold'
                    ? ({ hr: 'FAZA B', en: 'PHASE B', de: 'PHASE B', sl: 'FAZA B' }[lang])
                    : mixingGuideKind === 'balling'
                      ? ({ hr: 'FAZA C', en: 'PHASE C', de: 'PHASE C', sl: 'FAZA C' }[lang])
                    : mixingGuideKind === 'baking' || mixingGuideKind === 'bakingRomanaTonda' || mixingGuideKind === 'bakingNewYork' || mixingGuideKind === 'bakingRomanaTeglia'
                        ? ({ hr: 'FAZA E', en: 'PHASE E', de: 'PHASE E', sl: 'FAZA E' }[lang])
                    : mixingGuideKind === 'bakingGlutenFree'
                      ? ({ hr: 'FAZA E', en: 'PHASE E', de: 'PHASE E', sl: 'FAZA E' }[lang])
                      : ({ hr: 'FAZA A', en: 'PHASE A', de: 'PHASE A', sl: 'FAZA A' }[lang])}</Text>
                  <Text style={styles.visualGuideTitle}>{mixingGuideKind === 'stretchFold'
                    ? ({ hr: 'Preklapanje tijesta', en: 'Stretch & fold', de: 'Stretch & Fold', sl: 'Razteg in prepogib' }[lang])
                    : mixingGuideKind === 'balling'
                      ? ({ hr: 'Podjela i oblikovanje kuglica', en: 'Dividing and shaping dough balls', de: 'Teilen und Formen von Teigkugeln', sl: 'Delitev in oblikovanje kroglic' }[lang])
                    : mixingGuideKind === 'baking' || mixingGuideKind === 'bakingRomanaTonda' || mixingGuideKind === 'bakingNewYork' || mixingGuideKind === 'bakingRomanaTeglia'
                        ? ({ hr: 'Temperiranje, oblikovanje i pečenje', en: 'Tempering, shaping and baking', de: 'Temperieren, Formen und Backen', sl: 'Temperiranje, oblikovanje in peka' }[lang])
                    : mixingGuideKind === 'bakingGlutenFree'
                      ? ({ hr: 'Temperiranje, oblikovanje i pečenje', en: 'Tempering, shaping and baking', de: 'Temperieren, Formen und Backen', sl: 'Temperiranje, oblikovanje in peka' }[lang])
                      : ({ hr: 'Priprema i zamjes', en: 'Preparation and mixing', de: 'Vorbereitung und Kneten', sl: 'Priprava in gnetenje' }[lang])}</Text>
                </View>
                <Pressable
                  accessibilityLabel={({ hr: 'Zatvori vodič', en: 'Close guide', de: 'Anleitung schließen', sl: 'Zapri vodič' }[lang])}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setMixingGuideKind(null)}
                  style={styles.visualGuideCloseIcon}
                  testID={mixingGuideKind === 'stretchFold'
                    ? 'phase-b-visual-guide-close-icon'
                    : mixingGuideKind === 'balling'
                      ? 'phase-c-visual-guide-close-icon'
                      : mixingGuideKind === 'baking'
                        ? 'phase-e-visual-guide-close-icon'
                      : mixingGuideKind === 'bakingRomanaTonda'
                        ? 'phase-e-romana-tonda-visual-guide-close-icon'
                      : mixingGuideKind === 'bakingNewYork'
                        ? 'phase-e-new-york-visual-guide-close-icon'
                      : mixingGuideKind === 'bakingRomanaTeglia'
                        ? 'phase-e-romana-teglia-visual-guide-close-icon'
                      : mixingGuideKind === 'bakingGlutenFree'
                        ? 'phase-e-gluten-free-visual-guide-close-icon'
                      : 'phase-a-visual-guide-close-icon'}
                >
                  <Icon name="close" size={21} color={COLORS.onSurface} />
                </Pressable>
              </View>
              {mixingGuideKind === 'mixer' ? <MixingGuideCarousel lang={lang} kind={mixingGuideKind} /> : null}
              {mixingGuideKind === 'stretchFold' ? (
                <MixingGuideCarousel
                  lang={lang}
                  kind="stretchFold"
                  onSlideChange={setVisualGuideSlide}
                />
              ) : null}
              {mixingGuideKind === 'balling' ? (
                <MixingGuideCarousel
                  lang={lang}
                  kind="balling"
                  onSlideChange={setVisualGuideSlide}
                />
              ) : null}
              {mixingGuideKind === 'baking' ? (
                <MixingGuideCarousel
                  lang={lang}
                  kind="baking"
                  onSlideChange={setVisualGuideSlide}
                />
              ) : null}
              {mixingGuideKind === 'bakingRomanaTonda' ? (
                <MixingGuideCarousel
                  lang={lang}
                  kind="bakingRomanaTonda"
                  onSlideChange={setVisualGuideSlide}
                />
              ) : null}
              {mixingGuideKind === 'bakingNewYork' ? (
                <MixingGuideCarousel
                  lang={lang}
                  kind="bakingNewYork"
                  onSlideChange={setVisualGuideSlide}
                />
              ) : null}
              {mixingGuideKind === 'bakingRomanaTeglia' ? (
                <MixingGuideCarousel
                  lang={lang}
                  kind="bakingRomanaTeglia"
                  onSlideChange={setVisualGuideSlide}
                />
              ) : null}
              {mixingGuideKind === 'bakingGlutenFree' ? (
                <MixingGuideCarousel
                  lang={lang}
                  kind="bakingGlutenFree"
                  onSlideChange={setVisualGuideSlide}
                />
              ) : null}
              <View style={styles.visualGuideCopyBlock}>
                <Text style={styles.visualGuideSectionTitle}>{({ hr: 'KAKO NAPRAVITI', en: 'HOW TO DO IT', de: 'SO GEHT’S', sl: 'KAKO NAREDITI' }[lang])}</Text>
                <Text style={styles.visualGuideBody}>
                  {mixingGuideKind === 'stretchFold'
                    ? getStretchFoldGuideCopy(lang, visualGuideSlide).how
                    : mixingGuideKind === 'balling'
                      ? getBallingGuideCopy(lang, visualGuideSlide).how
                    : mixingGuideKind === 'baking'
                      ? getNapoletanaBakingGuideCopy(lang, visualGuideSlide).how
                    : mixingGuideKind === 'bakingRomanaTonda'
                      ? getRomanaTondaBakingGuideCopy(lang, visualGuideSlide).how
                    : mixingGuideKind === 'bakingNewYork'
                      ? getNewYorkBakingGuideCopy(lang, visualGuideSlide).how
                    : mixingGuideKind === 'bakingRomanaTeglia'
                      ? getRomanaTegliaBakingGuideCopy(lang, visualGuideSlide).how
                    : mixingGuideKind === 'bakingGlutenFree'
                      ? getGlutenFreeBakingGuideCopy(lang, visualGuideSlide).how
                    : mixingGuideKind === 'mixer'
                    ? ({
                      hr: 'Počni sporije kako bi se brašno i voda spojili bez prskanja. Kad više nema suhih dijelova, nastavi prema uputama recepta.',
                      en: 'Start slowly so the flour and water come together without splashing. Once no dry patches remain, continue with the recipe instructions.',
                      de: 'Beginnen Sie langsam, damit sich Mehl und Wasser ohne Spritzen verbinden. Sobald keine trockenen Stellen mehr zu sehen sind, folgen Sie den Rezeptanweisungen.',
                      sl: 'Začnite počasi, da se moka in voda povežeta brez škropljenja. Ko ni več suhih delov, nadaljujte po navodilih recepta.',
                    }[lang])
                    : ({
                      hr: 'Rukama nježno poveži brašno i vodu te prati kako se smjesa ujednačava. Vodu dodaj postupno, prema uputama recepta.',
                      en: 'Gently bring the flour and water together by hand and notice how the mixture becomes uniform. Add the water gradually as directed in the recipe.',
                      de: 'Verbinden Sie Mehl und Wasser behutsam mit der Hand und achten Sie darauf, wie die Masse gleichmäßiger wird. Geben Sie das Wasser nach Rezept schrittweise hinzu.',
                      sl: 'Z roko nežno povežite moko in vodo ter opazujte, kako zmes postaja enakomerna. Vodo dodajajte postopoma po navodilih recepta.',
                    }[lang])}
                </Text>
              </View>
              <View style={styles.visualGuideCopyBlock}>
                <Text style={styles.visualGuideSectionTitle}>{({ hr: 'KAKO TREBA IZGLEDATI', en: 'WHAT IT SHOULD LOOK LIKE', de: 'SO SOLL ES AUSSEHEN', sl: 'KAKO NAJ IZGLEDA' }[lang])}</Text>
                <Text style={styles.visualGuideBody}>
                  {mixingGuideKind === 'stretchFold'
                    ? getStretchFoldGuideCopy(lang, visualGuideSlide).look
                    : mixingGuideKind === 'balling'
                      ? getBallingGuideCopy(lang, visualGuideSlide).look
                    : mixingGuideKind === 'baking'
                      ? getNapoletanaBakingGuideCopy(lang, visualGuideSlide).look
                    : mixingGuideKind === 'bakingRomanaTonda'
                      ? getRomanaTondaBakingGuideCopy(lang, visualGuideSlide).look
                    : mixingGuideKind === 'bakingNewYork'
                      ? getNewYorkBakingGuideCopy(lang, visualGuideSlide).look
                    : mixingGuideKind === 'bakingRomanaTeglia'
                      ? getRomanaTegliaBakingGuideCopy(lang, visualGuideSlide).look
                    : mixingGuideKind === 'bakingGlutenFree'
                      ? getGlutenFreeBakingGuideCopy(lang, visualGuideSlide).look
                    : ({
                    hr: 'Tijesto treba biti povezano i ujednačeno, bez suhih dijelova brašna.',
                    en: 'The dough should be cohesive and even, with no dry flour remaining.',
                    de: 'Der Teig sollte verbunden und gleichmäßig sein, ohne trockene Mehlstellen.',
                    sl: 'Testo naj bo povezano in enakomerno, brez suhih delov moke.',
                  }[lang])}
                </Text>
              </View>
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMixingGuideKind(null)}
              style={({ pressed }) => [styles.visualGuideCloseButton, pressed && { opacity: 0.84 }]}
              testID={mixingGuideKind === 'stretchFold'
                ? 'phase-b-visual-guide-close'
                : mixingGuideKind === 'balling'
                  ? 'phase-c-visual-guide-close'
                  : mixingGuideKind === 'baking'
                    ? 'phase-e-visual-guide-close'
                  : mixingGuideKind === 'bakingRomanaTonda'
                    ? 'phase-e-romana-tonda-visual-guide-close'
                  : mixingGuideKind === 'bakingNewYork'
                    ? 'phase-e-new-york-visual-guide-close'
                  : mixingGuideKind === 'bakingRomanaTeglia'
                    ? 'phase-e-romana-teglia-visual-guide-close'
                  : mixingGuideKind === 'bakingGlutenFree'
                    ? 'phase-e-gluten-free-visual-guide-close'
                  : 'phase-a-visual-guide-close'}
            >
              <Text style={styles.visualGuideCloseText}>{({ hr: 'ZATVORI', en: 'CLOSE', de: 'SCHLIESSEN', sl: 'ZAPRI' }[lang])}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

// ============= HELPERS =============
function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.resRow}>
      <Text style={styles.resLabel}>{label}</Text>
      <Text style={[styles.resValue, highlight && { color: COLORS.brand, fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

function getBeginnerOvenTimers(oven: OvenType, ovenTemp: number, useBakeEstimate: boolean, isRomanTeglia = false): BaseTimer[] {
  const preheatMinutes = isRomanTeglia ? 20 : oven === 'homeStone' ? 52.5 : 20;
  const timers: BaseTimer[] = [
    { id: 'preheat', seconds: Math.round(preheatMinutes * 60), kind: 'preheat' },
  ];

  if (isRomanTeglia) return timers;

  if (useBakeEstimate) {
    const range = getBakingTimeRange(oven, ovenTemp);
    timers.push({ id: 'bake', seconds: Math.round(((range.min + range.max) / 2) * 60), kind: 'bake' });
  } else if (oven === 'ooni') {
    timers.push({ id: 'bake', seconds: 75, kind: 'bake' });
  } else if (oven === 'homePan') {
    timers.push(
      { id: 'bake', seconds: 6 * 60, kind: 'bake' },
      { id: 'bake-finish', seconds: 150, kind: 'bakeFinish' },
    );
  } else {
    timers.push({ id: 'bake', seconds: 270, kind: 'bake' });
  }

  if (oven === 'ooni') timers.push({ id: 'rotate', seconds: 25, kind: 'rotate' });
  return timers;
}

function getDetailedDirectSteps(
  mixing: 'hand' | 'mixer',
  ingredients: { flour: number; water: number; salt: number; oil: number; yeast: number },
  totalDough: number,
  pizzas: number,
  ballWeight: number,
  diameter: number,
  fridgeHours: number,
  roomHours: number,
  oven: OvenType,
  ovenTemp: number,
  roomTemp: number,
  cheesePerPizza: number,
  biga?: { flour: number; water: number; yeast: number; remainingFlour: number; remainingWater: number; pct: number },
  poolish?: { flour: number; water: number; yeast: number; remainingFlour: number; remainingWater: number; pct: number },
  flourType?: FlourType,
  romanTonda = false,
  romanTeglia = false,
  newYork = false,
  napolitana = false,
  trayDimensions = { width: 30, length: 40 },
  bakingTimeRange = '4–5 min',
  estimatedBake = false,
  waterTemperature?: number,
  beginnerMode = false,
  beginnerPhaseAFlourBehavior?: BeginnerPhaseAFlourBehavior,
  targetFinalDoughTemp?: number,
): DetailedPhase[] {
  const hand = mixing === 'hand';
  const instructionFlour = flourType === 'custom' ? 'caputo00' : flourType;
  const phaseAFlourBehavior = beginnerPhaseAFlourBehavior
    ?? (instructionFlour === 'spelt' ? 'spelt' : instructionFlour === 'wholeWheat' ? 'wholeWheat' : 'standard');
  const isSpelt = phaseAFlourBehavior === 'spelt';
  const isWholeWheat = phaseAFlourBehavior === 'wholeWheat';
  const isGlutenFree = instructionFlour === 'glutenFree';
  const isRomanTonda = romanTonda;
  const isRomanTeglia = romanTeglia;
  const isTegliaTipo00BeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'caputo00';
  const isTegliaTipo00BeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'caputo00';
  const isTegliaManitobaBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'manitoba';
  const isTegliaManitobaBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'manitoba';
  const isTegliaSpeltBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'spelt';
  const isTegliaSpeltBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'spelt';
  const isTegliaWholeWheatBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'wholeWheat';
  const isTegliaWholeWheatBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'wholeWheat';
  const isTegliaCustomBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'custom';
  const isTegliaCustomBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'custom';
  const isNewYork = newYork;
  const isNapolitana = napolitana;
  const pick = (_de: string, _en: string, hr: string) => hr;
  const isNeapolitanBeginner = beginnerMode && (isNapolitana || isRomanTonda);
  const isNeapolitanTipo00BeginnerHand = isNeapolitanBeginner && hand && flourType === 'caputo00';
  const isNeapolitanTipo00BeginnerMixer = isNeapolitanBeginner && !hand && flourType === 'caputo00';
  const isNeapolitanManitobaBeginnerMixer = isNeapolitanBeginner && !hand && flourType === 'manitoba';
  const isNeapolitanSpeltBeginnerHand = isNeapolitanBeginner && hand && flourType === 'spelt';
  const isNeapolitanSpeltBeginnerMixer = isNeapolitanBeginner && !hand && flourType === 'spelt';
  const isNeapolitanWholeWheatBeginnerHand = isNeapolitanBeginner && hand && flourType === 'wholeWheat';
  const isNeapolitanWholeWheatBeginnerMixer = isNeapolitanBeginner && !hand && flourType === 'wholeWheat';
  const isNeapolitanGlutenFreeBeginnerHand = isNeapolitanBeginner && hand && flourType === 'glutenFree';
  const isNeapolitanGlutenFreeBeginnerMixer = isNeapolitanBeginner && !hand && flourType === 'glutenFree';
  const isTegliaGlutenFreeBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'glutenFree';
  const isTegliaGlutenFreeBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'glutenFree';
  const isNeapolitanCustomBeginnerHand = isNeapolitanBeginner && hand && flourType === 'custom';
  const isNeapolitanCustomBeginnerMixer = isNeapolitanBeginner && !hand && flourType === 'custom';
  const useBakeEstimate = isNewYork || estimatedBake;
  const coldFermentationDuration = formatDuration(fridgeHours * 3600, 'hr');
  const cheeseAmount = Math.round(cheesePerPizza);
  const psylliumAmount = flourType === 'glutenFree' ? Math.round(ingredients.flour * 0.02) : 0;
  const initialWater = Math.round(ingredients.water * 0.9);
  const remainingWater = Math.max(0, ingredients.water - initialWater);
  const tegliaInitialWater = Math.round(ingredients.water * 0.8);
  const tegliaRemainingWater = Math.max(0, ingredients.water - tegliaInitialWater);
  const bigaWaterStart = biga ? Math.round(biga.remainingWater * 0.9) : 0;
  const bigaWaterFinal = biga ? Math.max(0, biga.remainingWater - bigaWaterStart) : 0;
  const poolishWaterStart = poolish ? Math.round(poolish.remainingWater * 0.9) : 0;
  const poolishWaterFinal = poolish ? Math.max(0, poolish.remainingWater - poolishWaterStart) : 0;
  const hasPreferment = !!biga || !!poolish;
  const hasColdFermentation = fridgeHours > 0;
  const idealIce = roomTemp > 19
    ? Math.min(Math.round(ingredients.water * 0.25), Math.max(0, Math.round((ingredients.water * (roomTemp - 19)) / 99)))
    : 0;
  const idealWater = ingredients.water - idealIce;
  const ovenSteps = oven === 'ooni'
    ? [`Zagrijte pizza peć najmanje 20 minuta na ${ovenTemp} °C.`, 'Ubacite pizzu u zagrijanu pizza peć.', 'Tijekom pečenja rotirajte pizzu svakih 20–30 sekundi.', useBakeEstimate ? `Pecite pizzu ${bakingTimeRange} i izvadite je kada je gotova.` : 'Pecite približno 60–90 sekundi i izvadite kada rub dobije tamne mrlje.']
    : oven === 'homePan'
      ? [`Zagrijte kućnu pećnicu na ${ovenTemp} °C s ventilacijom.`, useBakeEstimate ? `Pecite pizzu ukupno ${bakingTimeRange} na donjoj rešetki; završno zapečenje grillom uračunajte u taj raspon.` : 'Pecite pizzu na dnu pećnice 5–7 minuta.', useBakeEstimate ? 'Provjerite dno i vrh prije vađenja.' : 'Prebacite je pod gornji grill još 2–3 minute.']
      : [`Zagrijte kamen ili čelik 45–60 minuta na ${ovenTemp} °C uz uključen grill.`, `Isključite grill i prebacite pećnicu na Pizza program, ako je dostupan. Ako Pizza program nije dostupan, odaberite gornji i donji grijač bez ventilatora te postavite maksimalnu temperaturu. Pecite pizzu približno ${useBakeEstimate ? bakingTimeRange : '4–5 minuta'}.`, useBakeEstimate ? 'Provjerite boju unutar navedenog raspona; ne dodajte zasebno vrijeme pečenja.' : 'Zatim uključite grill i pecite dok rub i vrh ne dobiju željenu boju.'];
  const bulkRestMinutes = Math.max(15, Math.round(30 * (22 / Math.max(10, roomTemp))));
  const mixRestMinutes = isTegliaCustomBeginnerHand || isTegliaCustomBeginnerMixer || isTegliaTipo00BeginnerHand || isTegliaTipo00BeginnerMixer || isTegliaManitobaBeginnerHand || isTegliaManitobaBeginnerMixer || isTegliaSpeltBeginnerHand || isTegliaSpeltBeginnerMixer || isTegliaWholeWheatBeginnerHand || isTegliaWholeWheatBeginnerMixer || isNeapolitanTipo00BeginnerHand || isNeapolitanTipo00BeginnerMixer || isNeapolitanWholeWheatBeginnerHand || isNeapolitanWholeWheatBeginnerMixer
    ? 5
    : isGlutenFree && beginnerMode
      ? 5
      : beginnerMode
        ? 5.5
        : hand
          ? 15
          : 5;
  const mixRestLabel = isGlutenFree && beginnerMode ? '5 minuta' : isNeapolitanBeginner ? '5 minuta' : beginnerMode ? '5–6 minuta' : `${mixRestMinutes} minuta`;
  const napolitanaGlutenFreeRemainingMinutes = isNapolitana && isGlutenFree
    ? Math.max(0, Math.round(roomHours * 60))
    : 0;
  const temperingMin = Math.min(120, Math.max(15, Math.round(30 + (22 - roomTemp) * 7.5)));
  const temperingMax = Math.min(120, temperingMin + 15);
  const ovenPreheatMin = oven === 'homeStone' ? 45 : 20;
  const ovenPreheatMax = oven === 'homeStone' ? 60 : 20;
  const temperingMidpoint = Math.round(((temperingMin + temperingMax) / 2) * 60);
  const timer = (id: string, seconds: number, kind: BaseTimer['kind']): BaseTimer => ({ id, seconds, kind });
  const ballCount = Math.round(totalDough / ballWeight);
  const ballWord = ballCount % 10 === 1 && ballCount % 100 !== 11 ? 'kuglu' : ballCount % 10 >= 2 && ballCount % 10 <= 4 && (ballCount % 100 < 10 || ballCount % 100 >= 20) ? 'kugle' : 'kugli';
  const pizzaWord = pizzas % 10 === 1 && pizzas % 100 !== 11 ? 'pizzu' : pizzas % 10 >= 2 && pizzas % 10 <= 4 && (pizzas % 100 < 10 || pizzas % 100 >= 20) ? 'pizze' : 'pizza';
  const ballTemperingStep = hasColdFermentation
    ? `Nakon ${croatianHours(fridgeHours)} u hladnjaku izvadite kugle i ostavite ih ${roomHours > 0 ? croatianHours(roomHours) : '15–30 minuta'} na sobnoj temperaturi da se opuste. Pazite da se ne prefermentiraju, zatim nastavite s oblikovanjem.`
    : 'Ostavite kugle 15–30 minuta na sobnoj temperaturi da se opuste. Pazite da se ne prefermentiraju, zatim nastavite s oblikovanjem.';
  const tegliaTemperingStep = hasColdFermentation
    ? `Nakon ${croatianHours(fridgeHours)} u hladnjaku izvadite tijesto i ostavite ga ${roomHours > 0 ? croatianHours(roomHours) : '15–30 minuta'} na sobnoj temperaturi da se opusti. Pazite da ne prefermentira, zatim nastavite s utiskivanjem.`
    : `Ostavite tijesto ${temperingMin}–${temperingMax} minuta na sobnoj temperaturi da se opusti, zatim nastavite s utiskivanjem.`;
  const doughReadinessInfo = 'Lagano pritisnite kuglu prstom. Ako se udubljenje polako vraća, spremna je za oblikovanje; ako se odmah vrati, ostavite je još malo.';
  const approvedHandPhaseAInfo = 'Ručno miješenje obično traje oko 10 minuta, ali vodite se stanjem tijesta. Završite kada je tijesto glatko, povezano i elastično.\n\nAko tijesto postane previše ljepljivo i teško za rad, pokrijte ga i ostavite da odmori oko 20 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.\n\nNakon toga nastavite s receptom.';
  const approvedManitobaHandPhaseAInfo = 'Ručno miješenje Manitoba brašna obično traje oko 10–15 minuta, ali vodite se stanjem tijesta. Završite kada je tijesto glatko, povezano i elastično.\n\nAko tijesto postane previše ljepljivo i teško za rad, pokrijte ga i ostavite da odmori oko 20 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.\n\nNakon toga nastavite s receptom.';
  const approvedSpeltHandPhaseAInfo = 'Ručno miješenje obično traje oko 6–8 minuta. Pirovo tijesto mijesite nježnije i nemojte ga nepotrebno dugo mijesiti.\n\nZašto? Gluten u pirovom tijestu je osjetljiviji nego kod klasičnog pšeničnog brašna. Predugo ili prejako miješenje može oslabiti glutensku mrežu, pa tijesto postaje mekše, ljepljivije i teže zadržava oblik.\n\nZavršite kada je tijesto povezano, glatko i elastično.\n\nAko tijesto postane previše ljepljivo i teško za rad, pokrijte ga i ostavite da odmori oko 15 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.\n\nNakon toga nastavite s receptom.';
  const approvedSpeltMixerPhaseAInfo = 'Miješanje pirovog tijesta mikserom obično traje oko 5–7 minuta. Koristite sporu brzinu i nemojte tijesto nepotrebno dugo ili intenzivno mijesiti.\n\nZašto? Gluten u pirovom tijestu je osjetljiviji nego kod klasičnog pšeničnog brašna. Predugo ili prebrzo miješanje može oslabiti glutensku mrežu, pa tijesto postaje mekše, ljepljivije i teže zadržava oblik.\n\nZavršite kada je tijesto povezano, glatko i elastično.\n\nAko tijesto postane previše ljepljivo i teško za rad, zaustavite mikser, pokrijte tijesto i ostavite ga da odmori oko 10 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.\n\nNakon toga nastavite s receptom.';
  const approvedWholeWheatHandPhaseAInfo = 'Ručno miješenje integralnog tijesta obično traje oko 8–10 minuta, ali vodite se stanjem tijesta.\n\nIntegralno brašno upija vodu nešto sporije od bijelog brašna, pa tijestu može trebati malo više vremena da se pravilno poveže. Nemojte očekivati jednako glatku površinu kao kod tijesta od Tipo 00 brašna.\n\nAko je tijesto tvrdo, suho ili teško za mijesiti, pokrijte ga i ostavite da odmori oko 10–15 minuta, a zatim nastavite mijesiti.\n\nAko je nakon odmora tijesto i dalje slabo povezano, lako se razvlači bez napetosti i ne zadržava oblik, napravite nekoliko nježnih Stretch & Fold preklapanja kako biste ojačali strukturu tijesta.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.';
  const approvedWholeWheatMixerPhaseAInfo = 'Miješanje integralnog tijesta mikserom obično traje oko 7–10 minuta, ali vodite se stanjem tijesta, a ne samo vremenom.\n\nIntegralno brašno upija vodu nešto sporije od bijelog brašna. Nemojte pokušavati postići jednako glatku površinu kao kod tijesta od Tipo 00 brašna produžavanjem ili ubrzavanjem miješanja.\n\nAko je tijesto tvrdo, suho ili teško za miješanje, zaustavite mikser, pokrijte tijesto i ostavite ga da odmori oko 10–15 minuta, a zatim nastavite miješati na sporoj brzini.\n\nAko je nakon odmora tijesto i dalje slabo povezano, lako se razvlači bez napetosti i ne zadržava oblik, izvadite ga iz miksera i napravite nekoliko nježnih Stretch & Fold preklapanja kako biste ojačali strukturu tijesta.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.';
  const approvedMixerPhaseAInfo = 'Miješanje obično traje oko 8–10 minuta, ali vodite se stanjem tijesta. Završite kada je tijesto glatko, povezano i elastično.\n\nAko tijesto postane previše ljepljivo i teško za rad, pokrijte ga i ostavite da odmori oko 10 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.\n\nNakon toga nastavite s receptom.';
  const approvedTegliaHandPhaseAInfo = 'ⓘ Ručno miješenje tijesta za Tegliu\n\nZbog više hidratacije tijesto za Tegliu bit će mekše i ljepljivije od tijesta za klasičnu okruglu pizzu. Nemojte dodavati dodatno brašno samo zato što je tijesto ljepljivo.\n\nPreostalu vodu dodajte postupno. Ako tijesto više ne prihvaća vodu, prestanite je dodavati i nastavite tek kada se prethodno dodana voda poveže s tijestom.\n\nNe pokušavajte postići čvrsto tijesto dugim i agresivnim miješenjem. Struktura će se dodatno razvijati tijekom kasnijih odmora i preklapanja.';
  const approvedTegliaMixerPhaseAInfo = 'ⓘ Miješanje tijesta za Tegliu mikserom\n\nZbog više hidratacije tijesto za Tegliu bit će mekše i ljepljivije od tijesta za klasičnu okruglu pizzu. Nemojte dodavati dodatno brašno samo zato što je tijesto ljepljivo.\n\nPreostalu vodu dodajte postupno. Ako tijesto više ne prihvaća vodu, prestanite je dodavati i nastavite tek kada se prethodno dodana voda poveže s tijestom.\n\nNemojte povećavati brzinu niti nepotrebno produžavati miješanje samo kako biste dobili čvršće tijesto. Struktura će se dodatno razvijati tijekom kasnijih odmora i preklapanja.';
  const approvedManitobaTegliaHandPhaseAInfo = 'ⓘ Ručno miješenje tijesta s Manitoba brašnom\n\nZbog više hidratacije tijesto za Tegliu bit će mekše i ljepljivije od tijesta za klasičnu okruglu pizzu. Manitoba brašno ima snažnu glutensku strukturu i dobro podnosi višu hidrataciju, ali vodu ipak dodajte postupno.\n\nPreostalu vodu dodajte u nekoliko manjih dodavanja. Svaki dio dobro povežite s tijestom prije nego dodate sljedeći.\n\nAko tijesto postane previše ljepljivo i teško za rad, pokrijte ga i ostavite da odmori oko 15–20 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.';
  const approvedManitobaTegliaMixerPhaseAInfo = 'ⓘ Miješanje tijesta s Manitoba brašnom mikserom\n\nZbog više hidratacije tijesto za Tegliu bit će mekše i ljepljivije od tijesta za klasičnu okruglu pizzu. Manitoba brašno ima snažnu glutensku strukturu i dobro podnosi višu hidrataciju, ali vodu ipak dodajte postupno.\n\nPreostalu vodu dodajte u nekoliko manjih dodavanja. Svaki dio pustite da se poveže s tijestom prije nego dodate sljedeći.\n\nAko tijesto postane previše ljepljivo i teško za miješanje, zaustavite mikser, pokrijte tijesto i ostavite ga da odmori oko 10–15 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.';
  const approvedSpeltTegliaHandPhaseAInfo = 'ⓘ Ručno miješenje pirovog tijesta za Tegliu\n\nRučno miješenje obično traje oko 6–8 minuta. Pirovo tijesto mijesite nježnije i nemojte ga nepotrebno dugo mijesiti.\n\nZašto? Gluten u pirovom tijestu osjetljiviji je nego kod klasičnog pšeničnog brašna. Predugo ili prejako miješenje može oslabiti glutensku mrežu, pa tijesto postaje mekše, ljepljivije i teže zadržava oblik.\n\nZbog više hidratacije tijesto za Tegliu bit će mekše i ljepljivije. Preostalih 20% vode dodajte postupno i svaki dio dobro povežite prije sljedećeg dodavanja.\n\nZavršite kada je tijesto povezano, glatko i elastično.\n\nAko tijesto postane previše ljepljivo i teško za rad, pokrijte ga i ostavite da odmori oko 15 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.';
  const approvedSpeltTegliaMixerPhaseAInfo = 'ⓘ Miješanje pirovog tijesta za Tegliu mikserom\n\nMiješanje obično traje oko 5–7 minuta. Koristite sporu brzinu i nemojte tijesto nepotrebno dugo ili intenzivno mijesiti.\n\nZašto? Gluten u pirovom tijestu osjetljiviji je nego kod klasičnog pšeničnog brašna. Predugo ili prebrzo miješanje može oslabiti glutensku mrežu, pa tijesto postaje mekše, ljepljivije i teže zadržava oblik.\n\nZbog više hidratacije tijesto za Tegliu bit će mekše i ljepljivije. Preostalih 20% vode dodajte postupno i svaki dio pustite da se poveže prije sljedećeg dodavanja.\n\nZavršite kada je tijesto povezano, glatko i elastično.\n\nAko tijesto postane previše ljepljivo i teško za rad, zaustavite mikser, pokrijte ga i ostavite da odmori oko 10 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.';
  const approvedWholeWheatTegliaHandPhaseAInfo = 'ⓘ Ručno miješenje integralnog tijesta za Tegliu\n\nRučno miješenje obično traje oko 8–10 minuta, ali vodite se stanjem tijesta.\n\nIntegralno brašno vodu upija sporije, zato tijestu dajte vremena da je primi. Nemojte očekivati jednako glatko tijesto kao kod Tipo 00 brašna.\n\nZbog više hidratacije tijesto za Tegliu bit će mekše i ljepljivije, ali integralnom brašnu treba više vremena da potpuno upije vodu. Preostalih 20% vode dodajte postupno i svaki dio dobro povežite prije sljedećeg dodavanja.\n\nAko tijesto tijekom miješenja još uvijek djeluje tvrdo ili suho, nemojte odmah dodavati još vode. Pokrijte ga i ostavite da odmori oko 10–15 minuta kako bi brašno nastavilo upijati vodu, a zatim nastavite s nježnim miješenjem.\n\nAko nakon toga tijesto još uvijek djeluje slabo, nema dovoljno napetosti ili teško zadržava oblik, napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.';
  const approvedWholeWheatTegliaMixerPhaseAInfo = 'ⓘ Miješanje integralnog tijesta za Tegliu mikserom\n\nMiješanje obično traje oko 7–10 minuta, ali vodite se stanjem tijesta.\n\nIntegralno brašno vodu upija sporije, zato tijestu dajte vremena da je primi. Nemojte očekivati jednako glatko tijesto kao kod Tipo 00 brašna.\n\nZbog više hidratacije tijesto za Tegliu bit će mekše i ljepljivije, ali integralnom brašnu treba više vremena da potpuno upije vodu. Preostalih 20% vode dodajte postupno i svaki dio pustite da se poveže prije sljedećeg dodavanja.\n\nAko tijesto tijekom miješanja još uvijek djeluje tvrdo ili suho, nemojte odmah dodavati još vode. Zaustavite mikser, pokrijte tijesto i ostavite ga da odmori oko 10–15 minuta kako bi brašno nastavilo upijati vodu. Nakon odmora nastavite miješati na sporoj brzini.\n\nAko nakon toga tijesto još uvijek djeluje slabo, nema dovoljno napetosti ili teško zadržava oblik, izvadite ga iz miksera i napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.';
  const approvedManitobaMixerPhaseAInfo = 'Miješanje Manitoba brašna obično traje oko 10–12 minuta, ali vodite se stanjem tijesta. Završite kada je tijesto glatko, povezano i elastično.\n\nAko tijesto postane previše ljepljivo i teško za rad, zaustavite mikser, pokrijte tijesto i ostavite ga da odmori oko 10 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.\n\nNakon toga nastavite s receptom.';

  return [
    {
      title: biga
        ? (hand ? 'Faza B: Dodavanje Bige i ručni zamjes' : 'Faza B: Dodavanje Bige i zamjes mikserom')
        : poolish
          ? (hand ? 'Faza B: Dodavanje Poolisha i ručni zamjes' : 'Faza B: Dodavanje Poolisha i zamjes mikserom')
        : (isTegliaGlutenFreeBeginnerHand ? 'Teglia Romana – Bez glutena – Ručni zamjes' : isTegliaGlutenFreeBeginnerMixer ? 'Teglia Romana – Bez glutena – Zamjes mikserom' : isTegliaCustomBeginnerHand ? 'Teglia Romana – Miješano brašno – Ručni zamjes' : isTegliaCustomBeginnerMixer ? 'Teglia Romana – Miješano brašno – Zamjes mikserom' : isTegliaWholeWheatBeginnerHand ? 'Teglia Romana – Integralno brašno – Ručni zamjes' : isTegliaWholeWheatBeginnerMixer ? 'Teglia Romana – Integralno brašno – Zamjes mikserom' : isTegliaSpeltBeginnerHand ? 'Teglia Romana – Pir – Ručni zamjes' : isTegliaSpeltBeginnerMixer ? 'Teglia Romana – Pir – Zamjes mikserom' : isTegliaManitobaBeginnerHand ? 'Teglia Romana – Manitoba – Ručni zamjes' : isTegliaManitobaBeginnerMixer ? 'Teglia Romana – Manitoba – Zamjes mikserom' : isTegliaTipo00BeginnerHand ? 'Teglia Romana – Tipo 00 – Ručni zamjes' : isTegliaTipo00BeginnerMixer ? 'Teglia Romana – Tipo 00 – Zamjes mikserom' : isNeapolitanGlutenFreeBeginnerHand ? 'Faza A: Priprema i ručni zamjes' : isNeapolitanGlutenFreeBeginnerMixer ? 'Faza A: Priprema i zamjes mikserom' : isNeapolitanCustomBeginnerHand ? 'Faza A: Priprema i ručni zamjes' : isNeapolitanCustomBeginnerMixer ? 'Faza A: Priprema i zamjes mikserom' : isNeapolitanWholeWheatBeginnerHand ? 'Faza A: Priprema i ručni zamjes' : hand ? 'Faza A: Priprema i ručni zamjes' : 'Faza A: Priprema i zamjes mikserom'),
      waterInfo: isTegliaGlutenFreeBeginnerHand || isTegliaGlutenFreeBeginnerMixer || isNeapolitanGlutenFreeBeginnerHand || isNeapolitanGlutenFreeBeginnerMixer
        ? 'ⓘ Temperatura vode\n\nKoristite hladnu vodu.'
        : isTegliaTipo00BeginnerHand || isTegliaTipo00BeginnerMixer || isTegliaSpeltBeginnerHand || isTegliaSpeltBeginnerMixer
        ? `ⓘ Temperatura vode\n\nPreporučena temperatura vode: ${waterTemperature ?? 24} °C\n\nTemperatura je automatski izračunata prema uvjetima vašeg recepta.`
        : isNeapolitanBeginner
        ? `Preporučena temperatura vode: ${waterTemperature ?? 24} °C. Ciljna završna temperatura tijesta: ${targetFinalDoughTemp ?? 24} °C. Precizno vaganje održava omjer recepta, a završna temperatura pomaže da fermentacija slijedi plan. Upotrijebite ukupno ${ingredients.water} g vode; led se računa u ukupnu količinu vode.`
        : `Idealna temperatura vode je 18–20 °C. Led je opcionalan: po potrebi zamijenite dio ukupne vode s približno ${idealIce} g leda i ${idealWater} g vode. Ako ne koristite led, upotrijebite svih ${ingredients.water} g hladne vode. Led se uvijek računa u ukupnu količinu vode.`,
      doughHandlingInfo: isTegliaManitobaBeginnerHand
        ? approvedManitobaTegliaHandPhaseAInfo
        : isTegliaManitobaBeginnerMixer
        ? approvedManitobaTegliaMixerPhaseAInfo
        : isTegliaSpeltBeginnerHand
        ? approvedSpeltTegliaHandPhaseAInfo
        : isTegliaSpeltBeginnerMixer
        ? approvedSpeltTegliaMixerPhaseAInfo
        : isTegliaGlutenFreeBeginnerHand
        ? pick('Teglia Romana – Glutenfrei – Handmischung', 'Teglia Romana – Gluten-Free – Hand Mixing', 'Teglia Romana – Brez glutena – Ročno mešanje')
        : isTegliaGlutenFreeBeginnerMixer
        ? pick('Teglia Romana – Glutenfrei – Mischen mit dem Mixer', 'Teglia Romana – Gluten-Free – Mixer Mixing', 'Teglia Romana – Brez glutena – Mešanje z mešalnikom')
        : isTegliaCustomBeginnerHand
        ? pick('Teglia Romana – Gemischtes Mehl – Handmischung', 'Teglia Romana – Flour Blend – Hand Mixing', 'Teglia Romana – Mešanica moke – Ročno mešanje')
        : isTegliaCustomBeginnerMixer
        ? pick('Teglia Romana – Gemischtes Mehl – Mischen mit dem Mixer', 'Teglia Romana – Flour Blend – Mixer Mixing', 'Teglia Romana – Mešanica moke – Mešanje z mešalnikom')
        : isTegliaCustomBeginnerHand
        ? pick('Teglia Romana – Gemischtes Mehl – Handmischung', 'Teglia Romana – Flour Blend – Hand Mixing', 'Teglia Romana – Mešanica moke – Ročno mešanje')
        : isTegliaCustomBeginnerMixer
        ? pick('Teglia Romana – Gemischtes Mehl – Mischen mit dem Mixer', 'Teglia Romana – Flour Blend – Mixer Mixing', 'Teglia Romana – Mešanica moke – Mešanje z mešalnikom')
        : isTegliaWholeWheatBeginnerHand
        ? approvedWholeWheatTegliaHandPhaseAInfo
        : isTegliaWholeWheatBeginnerMixer
        ? approvedWholeWheatTegliaMixerPhaseAInfo
        : isTegliaTipo00BeginnerHand
        ? approvedTegliaHandPhaseAInfo
        : isTegliaTipo00BeginnerMixer
        ? approvedTegliaMixerPhaseAInfo
        : isNeapolitanCustomBeginnerMixer
        ? 'ⓘ Miješanje tijesta mikserom\n\nMiješanje obično traje oko 8–10 minuta, ali vodite se stanjem tijesta. Završite kada je tijesto glatko, povezano i elastično.\n\nBudući da svojstva tijesta ovise o brašnima koja se koriste u mješavini, vrijeme potrebno da se tijesto pravilno poveže može se razlikovati.\n\nAko tijesto postane previše ljepljivo i teško za rad, zaustavite mikser, pokrijte tijesto i ostavite ga da odmori oko 10 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.'
        : isNeapolitanCustomBeginnerHand
        ? 'ⓘ Ručno miješenje tijesta\n\nMiješenje obično traje oko 10 minuta, ali vodite se stanjem tijesta. Završite kada je tijesto glatko, povezano i elastično.\n\nBudući da svojstva tijesta ovise o brašnima koja se koriste u mješavini, vrijeme potrebno da se tijesto pravilno poveže može se razlikovati.\n\nAko tijesto postane previše ljepljivo i teško za rad, pokrijte ga i ostavite da odmori oko 20 minuta. Nakon odmora napravite nekoliko nježnih Stretch & Fold preklapanja.\n\nStretch & Fold: Uhvatite jedan rub tijesta, lagano ga razvucite prema gore i preklopite preko sredine. Okrenite tijesto i ponovite sa svih strana.'
        : isTegliaGlutenFreeBeginnerMixer || isNeapolitanGlutenFreeBeginnerMixer
        ? 'ⓘ Miješanje bezglutenskog tijesta mikserom\n\nBezglutensko tijesto ne razvija klasičnu glutensku mrežu, zato ga nije potrebno dugo ili intenzivno miješati niti pokušavati postići elastičnost kao kod klasičnog tijesta.\n\nCilj je ravnomjerno povezati sastojke. Tijesto će biti mekše i ljepljivije od klasičnog tijesta za pizzu.\n\nNemojte povećavati brzinu niti produžavati miješanje samo zato što tijesto ostaje ljepljivo. Također nemojte dodavati dodatno brašno. Psyllium će tijekom završnog odmora nastaviti vezati vodu i dati tijestu čvršću strukturu.'
        : isTegliaGlutenFreeBeginnerHand || isNeapolitanGlutenFreeBeginnerHand
        ? 'Bezglutensko tijesto ne razvija klasičnu glutensku mrežu, zato ga nije potrebno dugo mijesiti niti pokušavati postići elastičnost kao kod klasičnog tijesta.\n\nCilj je ravnomjerno povezati sastojke. Tijesto će biti mekše i ljepljivije od klasičnog tijesta za pizzu.\n\nNemojte dodavati dodatno brašno samo zato što je tijesto ljepljivo. Psyllium će tijekom završnog odmora nastaviti vezati vodu i dati tijestu čvršću strukturu.'
        : isGlutenFree
        ? `Bezglutensko brašno ne razvija klasičan gluten, pa je važno dodati psyllium u iznosu od ${psylliumAmount} g (2% od ukupnog brašna) i miješati vrlo kratko, na nižoj brzini, bez agresivnog razvijanja glutena.`
        : isNeapolitanWholeWheatBeginnerMixer
          ? approvedWholeWheatMixerPhaseAInfo
        : isWholeWheat && !isNeapolitanWholeWheatBeginnerHand
          ? 'Integralno brašno sadrži mekinje koje brže upijaju vodu i osjetljivije su na toplinu. Koristite hladnu vodu i miješajte kraće te na nižoj brzini; ne pretjerujte s dodavanjem vode i ne pokušavajte razviti agresivan gluten.'
        : isTegliaGlutenFreeBeginnerHand || isNeapolitanGlutenFreeBeginnerHand
        ? 'Bezglutensko tijesto ne razvija klasičnu glutensku mrežu, zato ga nije potrebno dugo mijesiti niti pokušavati postići elastičnost kao kod klasičnog tijesta.'
        : isNeapolitanWholeWheatBeginnerHand
          ? approvedWholeWheatHandPhaseAInfo
          : isNeapolitanSpeltBeginnerHand
            ? approvedSpeltHandPhaseAInfo
            : isNeapolitanSpeltBeginnerMixer
              ? approvedSpeltMixerPhaseAInfo
            : isSpelt
              ? 'Pir ima osjetljiv gluten. Mijesite kraće i blaže, približno 5 minuta; cilj je samo ujednačiti smjesu, a ne razviti pretjerano napetu strukturu.'
            : isNeapolitanTipo00BeginnerMixer
              ? approvedMixerPhaseAInfo
              : isNeapolitanManitobaBeginnerMixer
                ? approvedManitobaMixerPhaseAInfo
              : isNeapolitanTipo00BeginnerHand
              ? approvedHandPhaseAInfo
              : isNeapolitanBeginner && hand && flourType === 'manitoba'
                ? approvedManitobaHandPhaseAInfo
              : isNeapolitanBeginner
                ? 'Precizno vaganje održava omjer recepta. Ciljna završna temperatura važna je jer utječe na brzinu fermentacije; ako je tijesto pretoplo, stanite ranije. Kod visoke hidratacije nemojte automatski dodavati brašno.'
              : 'Kod visoke hidratacije tijesto može biti ljepljivo. Nemojte automatski dodavati brašno. Lagano nauljite ili navlažite ruke i ostavite tijesto nekoliko minuta da se opusti. Zatim nastavite prema sljedećem koraku recepta.',
      steps: biga ? [
        'Operite i temeljito osušite ruke.',
        ...(hand ? [] : ['Pripremite mikser i njegovu posudu.']),
        hand ? 'Bigu natrgajte na manje komade i ubacite je u posudu za ručni zamjes.' : 'Bigu natrgajte na manje komade i ubacite je u posudu miksera.',
        hand ? `Dodajte ${bigaWaterStart} g vode da se Biga otpusti, pa je lagano povežite rukama.` : `Dodajte ${bigaWaterStart} g vode da se Biga otpusti, pa pokrenite mikser na sporoj brzini.`,
        biga.remainingFlour > 0
          ? (hand ? `Zatim dodajte preostalih ${biga.remainingFlour} g brašna i nastavite povezivati tijesto.` : `Zatim dodajte preostalih ${biga.remainingFlour} g brašna i nastavite miješati.`)
          : 'Nema preostalog brašna; nastavite samo s vodom i Bigom.',
        `Postupno dodajte preostalih ${bigaWaterFinal} g vode, ne sve odjednom, dok se tijesto ne poveže.`,
        `Kada je tijesto povezano i voda gotovo upijena, dodajte ${ingredients.salt} g soli kao zaseban korak.`,
        hand ? 'Nastavite mijesiti dok tijesto ne postane glatko, elastično i povezano.' : isSpelt ? 'Nastavite miješati na sporijoj do umjerenoj brzini, kraće nego obično, samo dok tijesto ne postane glatko, homogeno i povezano. Nemojte ga premijesiti.' : 'Nastavite miješati na većoj brzini dok tijesto ne razvije gluten i postane glatko, elastično i povezano.',
        ...(ingredients.oil > 0 ? [hand ? `Dodajte ${ingredients.oil} g maslinovog ulja i mijesite dok ga tijesto potpuno ne upije.` : `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok ga tijesto potpuno ne upije.`] : []),
        ...(isGlutenFree ? [`Obavezno dodajte ${psylliumAmount} g psylliuma (2% od ukupne količine brašna) kako bi smjesa zadržala strukturu.`] : []),
        ...(!isGlutenFree && hand ? [isSpelt ? 'Mijesite kratko i nježno, samo dok se tijesto ne poveže i postane ujednačeno; ne premijesite.' : isWholeWheat ? 'Mijesite umjereno i bez agresivnog rastezanja dok se tijesto ne poveže i razvije dovoljnu strukturu.' : 'Prebacite tijesto na radnu površinu i mijesite dlanovima 10–15 minuta dok površina ne postane glatka.'] : []),
        'Zamjes je gotov kada je tijesto glatko, elastično i homogeno.',
        !isGlutenFree && hand ? `Pokrijte tijesto i ostavite ga ${mixRestMinutes} minuta da se gluten opusti.` : hand ? `Ostavite tijesto da odmori ${mixRestMinutes} minuta.` : `Ostavite tijesto da odmori ${mixRestMinutes} minuta u posudi miksera.`,
      ] : poolish ? [
        'Operite i temeljito osušite ruke.',
        ...(hand ? [] : ['Pripremite mikser i njegovu posudu.']),
        hand ? 'Zreli Poolish prelijte u posudu za ručni zamjes.' : 'Zreli Poolish prelijte u posudu miksera.',
        poolish.remainingFlour > 0
          ? (hand ? `Dodajte preostalih ${poolish.remainingFlour} g brašna i lagano povežite Poolish s brašnom.` : `Dodajte preostalih ${poolish.remainingFlour} g brašna i pokrenite mikser na sporoj brzini.`)
          : 'Nema preostalog brašna; nastavite samo s Poolishom i vodom.',
        hand ? `Dodajte ${poolishWaterStart} g preostale vode i nastavite povezivati tijesto.` : `Dodajte ${poolishWaterStart} g preostale vode i nastavite miješati.`,
        poolishWaterFinal > 0 ? `Postupno dodajte preostalih ${poolishWaterFinal} g vode, ne sve odjednom.` : 'Preostala voda je dodana u prethodnom koraku.',
        `Kada je tijesto povezano, dodajte ${ingredients.salt} g soli kao zaseban korak.`,
        hand ? 'Nastavite mijesiti dok tijesto ne postane glatko, elastično i povezano.' : isSpelt ? 'Nastavite miješati na sporijoj do umjerenoj brzini, kraće nego obično, samo dok tijesto ne postane glatko, homogeno i povezano. Nemojte ga premijesiti.' : 'Nastavite miješati na većoj brzini dok tijesto ne razvije gluten i postane glatko, elastično i povezano.',
        ...(ingredients.oil > 0 ? [hand ? `Dodajte ${ingredients.oil} g maslinovog ulja i mijesite dok ga tijesto potpuno ne upije.` : `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok ga tijesto potpuno ne upije.`] : []),
        ...(isGlutenFree ? [`Obavezno dodajte ${psylliumAmount} g psylliuma (2% od ukupne količine brašna) kako bi smjesa zadržala strukturu.`] : []),
        ...(!isGlutenFree && hand ? [isSpelt ? 'Mijesite kratko i nježno, samo dok se tijesto ne poveže i postane ujednačeno; ne premijesite.' : isWholeWheat ? 'Mijesite umjereno i bez agresivnog rastezanja dok se tijesto ne poveže i razvije dovoljnu strukturu.' : 'Prebacite tijesto na radnu površinu i mijesite dlanovima 10–15 minuta dok površina ne postane glatka.'] : []),
        'Zamjes je gotov kada je tijesto glatko, elastično i homogeno.',
        !isGlutenFree && hand ? `Pokrijte tijesto i ostavite ga ${mixRestMinutes} minuta da se gluten opusti.` : hand ? `Ostavite tijesto da odmori ${mixRestMinutes} minuta.` : `Ostavite tijesto da odmori ${mixRestMinutes} minuta u posudi miksera.`,
      ]       : isTegliaWholeWheatBeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Mijesite dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nježno mijesite dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ]       : isTegliaCustomBeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode dobro povežite s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Mijesite dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nježno mijesite dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isTegliaCustomBeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode pustite da se poveže s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nastavite miješati na sporoj do srednjoj brzini dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko nastavite miješati na sporoj brzini dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ]       : isTegliaSpeltBeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode dobro povežite s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nježno mijesite dok tijesto ne postane povezano, glatko i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nježno mijesite dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ]       : isTegliaManitobaBeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode dobro povežite s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Mijesite dok tijesto ne postane povezano, glatko i dovoljno čvrsto da zadržava strukturu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nježno mijesite dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ]       : isTegliaTipo00BeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode dobro povežite s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Mijesite dok tijesto ne postane povezano, glatko i dovoljno čvrsto da zadržava strukturu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nježno mijesite dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isTegliaWholeWheatBeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode pustite da se poveže s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nastavite miješati na sporoj do srednjoj brzini dok tijesto ne postane povezano, elastično i može zadržati strukturu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko nastavite miješati na sporoj brzini dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isTegliaSpeltBeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode pustite da se poveže s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nastavite miješati na sporoj brzini dok tijesto ne postane povezano, glatko i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko nastavite miješati na sporoj brzini dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isTegliaManitobaBeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode pustite da se poveže s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nastavite miješati na sporoj do srednjoj brzini dok tijesto ne postane povezano, glatko i dovoljno čvrsto da zadržava strukturu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko nastavite miješati na sporoj brzini dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isTegliaTipo00BeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 80% vode, odnosno ${tegliaInitialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno, u nekoliko manjih dodavanja, dodajte preostalih 20% vode, odnosno ${tegliaRemainingWater} g. Svaki dio vode pustite da se poveže s tijestom prije nego dodate sljedeći.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nastavite miješati na sporoj do srednjoj brzini dok tijesto ne postane povezano, glatko i dovoljno čvrsto da zadržava strukturu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko nastavite miješati na sporoj brzini dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isNeapolitanTipo00BeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Mijesite dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nastavite mijesiti dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isNeapolitanTipo00BeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i njegovu posudu.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Miješajte na sporoj do srednjoj brzini dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ]       : isNeapolitanWholeWheatBeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g integralnog brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Mijesite dok tijesto ne postane povezano, elastično i može zadržati oblik.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nježno mijesite dok se potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isNeapolitanWholeWheatBeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g integralnog brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nastavite miješati na sporoj brzini dok tijesto ne postane povezano, elastično i može zadržati oblik.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko miješajte na sporoj brzini dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isNeapolitanBeginner && hand && flourType === 'manitoba' ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Mijesite dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nastavite mijesiti dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isNeapolitanSpeltBeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nježno mijesite dok tijesto ne postane povezano, glatko i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nježno mijesite dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isNeapolitanSpeltBeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i njegovu posudu.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Miješajte na sporoj brzini dok tijesto ne postane povezano, glatko i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko miješajte na sporoj brzini dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isNeapolitanManitobaBeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i njegovu posudu.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Miješajte na sporoj do srednjoj brzini dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isTegliaManitobaBeginnerHand ? [
      ] : isTegliaManitobaBeginnerMixer ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie den Mixer und die Schüssel zum Mischen vor.', 'Prepare the mixer and mixing bowl.', 'Pripravite mešalnik in posodo za mešanje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 80 % des Wassers, also ${tegliaInitialWater} g, auf.`, `Dissolve the yeast in approximately 80% of the water, or ${tegliaInitialWater} g.`, `V približno 80 % vode oziroma ${tegliaInitialWater} g vode raztopite kvas.`),
        pick('Gießen Sie das Hefewasser in die Mixerschüssel, geben Sie das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis die Zutaten verbunden sind.', 'Pour the yeast water into the mixer bowl, add the flour, and mix at low speed until the ingredients come together.', 'Vodo s kvasom vlijte v posodo mešalnika, dodajte moko in mešajte pri nizki hitrosti, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie nach und nach in mehreren kleinen Zugaben die restlichen 20 % Wasser, also ${tegliaRemainingWater} g, hinzu. Lassen Sie jeden Teil des Wassers mit dem Teig verbinden, bevor Sie den nächsten hinzufügen.`, `Gradually add the remaining 20% of the water, or ${tegliaRemainingWater} g, in several small additions. Let each part of the water incorporate into the dough before adding the next.`, `Postopoma v več manjših dodajanjih dodajte preostalih 20 % vode oziroma ${tegliaRemainingWater} g. Vsak del vode naj se poveže s testom, preden dodate naslednjega.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie bei niedriger bis mittlerer Geschwindigkeit weiter, bis der Teig verbunden, glatt und fest genug ist, um seine Struktur zu halten.', 'Continue mixing at low to medium speed until the dough is cohesive, smooth, and firm enough to hold its structure.', 'Nadaljujte z mešanjem pri nizki do srednji hitrosti, dokler testo ni povezano, gladko in dovolj čvrsto, da ohrani strukturo.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie kurz bei niedriger Geschwindigkeit weiter, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and continue mixing briefly at low speed until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in kratek čas nadaljujte z mešanjem pri nizki hitrosti, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in pustite počivati 5 minut.'),
      ] : isNeapolitanCustomBeginnerHand ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Dodajte brašno u vodu s kvascem i miješajte rukom dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Mijesite dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i nježno mijesite dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : isNeapolitanCustomBeginnerMixer ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        'Ulijte vodu s kvascem u posudu miksera, dodajte brašno i miješajte na sporoj brzini dok se sastojci ne povežu.',
        `Postupno dodajte preostalih 10% vode, odnosno ${remainingWater} g.`,
        `Kada je voda gotovo potpuno upijena, dodajte ${ingredients.salt} g soli.`,
        'Nastavite miješati na sporoj do srednjoj brzini dok tijesto ne postane glatko, povezano i elastično.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko nastavite miješati dok ga tijesto potpuno ne upije.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta.',
      ] : (isTegliaGlutenFreeBeginnerMixer || isNeapolitanGlutenFreeBeginnerMixer) ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite mikser i posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g bezglutenskog brašna, ${psylliumAmount} g psyllium ljuskica, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `Ulijte svu vodu, odnosno ${ingredients.water} g, u posudu miksera i u njoj otopite kvasac.`,
        'Dodajte bezglutensko brašno i psyllium ljuskice te počnite miješati na sporoj brzini dok ne nestanu suhi dijelovi.',
        `Kada je smjesa povezana, dodajte ${ingredients.salt} g soli.`,
        'Nastavite miješati na sporoj brzini samo dok se svi sastojci ne povežu u homogenu, ljepljivu masu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i kratko nastavite miješati na sporoj brzini dok se potpuno ne sjedini sa smjesom.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta kako bi psyllium upio vodu i tijesto dobilo potrebnu čvrstoću.',
      ] : (isTegliaGlutenFreeBeginnerHand || isNeapolitanGlutenFreeBeginnerHand) ? [
        'Operite i temeljito osušite ruke.',
        'Pripremite veliku posudu za zamjes.',
        `Izmjerite ${ingredients.flour} g bezglutenskog brašna, ${psylliumAmount} g psyllium ljuskica, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasca, ${ingredients.water} g vode i ${ingredients.oil} g maslinovog ulja.`,
        `U svu vodu, odnosno ${ingredients.water} g, otopite kvasac.`,
        'Dodajte bezglutensko brašno i psyllium ljuskice te miješajte rukom ili špatulom dok ne nestanu suhi dijelovi.',
        `Kada je smjesa povezana, dodajte ${ingredients.salt} g soli.`,
        'Miješajte samo dok se svi sastojci ne povežu u homogenu, ljepljivu masu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok se potpuno ne sjedini sa smjesom.`,
        'Pokrijte tijesto i ostavite ga da odmori 5 minuta kako bi psyllium upio vodu i tijesto dobilo potrebnu čvrstoću.',
      ] : isGlutenFree ? [
        'Operite i temeljito osušite ruke.',
        ...(hand ? [] : ['Pripremite mikser i njegovu posudu.']),
        `Pripremite ${ingredients.flour} g bezglutenskog brašna, ${psylliumAmount} g psyllium ljuskica, ${ingredients.salt} g soli, ${ingredients.yeast} g svježeg kvasca, ${ingredients.oil} g maslinovog ulja i ukupno ${ingredients.water} g hladne vode (visoka hidratacija).`,
        `U približno 90% ukupne hladne vode, odnosno ${initialWater} g, otopite kvasac.`,
        hand ? 'Dodajte bezglutensko brašno i psyllium ljuskice te miješajte rukom ili špatulom dok ne nestanu suhi dijelovi.' : 'Dodajte bezglutensko brašno i psyllium ljuskice u posudu te miješajte samo na najnižoj brzini dok ne nestanu suhi dijelovi.',
        `Postupno dodajte preostalih ${remainingWater} g hladne vode, ne odjednom.`,
        `Kada je smjesa povezana, dodajte ${ingredients.salt} g soli kao zaseban korak.`,
        'Bezglutenska smjesa se ne mijesi za razvoj glutena; miješajte je samo dok se svi sastojci ne povežu u homogenu, ljepljivu masu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok se potpuno ne sjedini sa smjesom.`,
        'Zamjes je gotov kada je masa ujednačena, glatka i ljepljiva.',
        'Ostavite smjesu 5 minuta kako bi psyllium povukao vlagu i dao joj potrebnu čvrstoću.',
      ] : [
        'Operite i temeljito osušite ruke.',
        ...(hand ? [] : ['Pripremite mikser i njegovu posudu.']),
        `Prosijte i precizno izmjerite ${ingredients.flour} g ${isSpelt ? 'pirovog ' : ''}brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g svježeg kvasca i ukupno ${ingredients.water} g vode${isGlutenFree ? ` te ${psylliumAmount} g psylliuma` : ''}.`,
        `U približno 90% vode, odnosno ${initialWater} g, otopite kvasac.`,
        hand ? 'Postupno dodajte brašno u vodu s kvascem i miješajte rukom dok ne nestanu suhi dijelovi.' : 'Ulijte vodu s otopljenim kvascem u posudu miksera, zatim dodajte brašno i miješajte na sporoj brzini dok ne nestanu suhi dijelovi.',
        `Postupno dodajte preostalih ${remainingWater} g vode, ne odjednom.`,
        `Kada je tijesto povezano i voda gotovo upijena, dodajte ${ingredients.salt} g soli kao zaseban korak.`,
        hand
          ? isSpelt || isWholeWheat
            ? 'Mijesite kratko i nježno, samo dok se tijesto ne ujednači i poveže; ne pokušavajte razviti snažnu elastičnost.'
            : isNeapolitanBeginner
              ? 'Mijesite dok tijesto ne postane glatko, elastično i povezano; stanite ranije ako se tijesto počne pregrijavati.'
              : 'Nastavite mijesiti dok tijesto ne postane glatko, elastično i povezano.'
          : isSpelt || isWholeWheat
            ? 'Miješajte kratko pri niskoj do srednjoj brzini, samo dok se tijesto ne ujednači i poveže; nemojte ga prekomjerno miješati.'
            : isNeapolitanBeginner
              ? 'Miješajte najprije na sporoj, zatim na sporoj do srednjoj brzini; stanite ranije ako se tijesto počne pregrijavati i završite kada postane glatko, povezano i elastično te se počne prikladno odvajati od stijenki posude.'
              : 'Nastavite miješati dok tijesto ne postane glatko, povezano i elastično ter se počne prikladno odvajati od stijenki posude.',
        ...(ingredients.oil > 0 ? [hand ? `Dodajte ${ingredients.oil} g maslinovog ulja i mijesite dok ga tijesto potpuno ne upije.` : `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok ga tijesto potpuno ne upije.`] : []),
        ...(isNeapolitanBeginner ? [`Provjerite da je završna temperatura tijesta približno ${targetFinalDoughTemp ?? 24} °C.`] : []),
        ...(isGlutenFree ? [`Obavezno dodajte ${psylliumAmount} g psylliuma (2% od ukupne količine brašna) kako bi smjesa zadržala strukturu.`] : []),
        ...(!isGlutenFree && hand && !beginnerMode ? [isSpelt ? 'Mijesite kratko i nježno, samo dok se tijesto ne poveže i postane ujednačeno; ne premijesite.' : isWholeWheat ? 'Mijesite umjereno i bez agresivnog rastezanja dok se tijesto ne poveže i razvije dovoljnu strukturu.' : 'Prebacite tijesto na radnu površinu i mijesite dlanovima 10–15 minuta dok površina ne postane glatka.'] : []),
        ...(!beginnerMode ? ['Zamjes je gotov kada je tijesto glatko, elastično i homogeno.'] : []),
        !isGlutenFree && hand && !isSpelt && !isWholeWheat
          ? `Pokrijte tijesto i ostavite ga ${mixRestLabel} da se gluten opusti.`
          : hand
            ? `Pokrijte tijesto i ostavite ga da odmori ${mixRestLabel}.`
            : `Ostavite tijesto da odmori ${mixRestLabel} u posudi miksera.`,
      ],
      timers: isNeapolitanBeginner
        ? [timer('post-mix-rest', mixRestMinutes * 60, 'rest')]
        : [timer(hand && !isGlutenFree ? 'post-mix-rest15m' : 'post-mix-rest', mixRestMinutes * 60, 'rest')],
    },
    {
      title: isRomanTeglia && isGlutenFree ? 'Faza B: Kratki odmor' : isRomanTeglia ? 'Faza B: Fermentacija i preklapanje' : isGlutenFree ? 'Faza B: Kratki odmor' : hasPreferment ? 'Faza C: Prva fermentacija (Bulking)' : 'Faza B: Prva fermentacija (Bulking)',
      infoTitleOverrides: isRomanTeglia
        ? { room: 'Fermentacija i preklapanje' }
        : isGlutenFree
          ? { room: 'Fermentacija bez glutena' }
          : isWholeWheat || isSpelt
            ? { room: 'Posebnosti brašna i preklapanje' }
            : undefined,
      fermentationInfo: isRomanTeglia && isGlutenFree
        ? 'Bezglutenska Teglia ne radi Stretch & Fold. Ostavite smjesu 15 minuta da psyllium poveže strukturu prije utiskivanja u tepsiju.'
        : isRomanTeglia
        ? 'Teglia koristi vlažnije tijesto koje ostaje kao jedna masa. Napravite dva nježna Stretch & Fold preklapanja u posudi prije hladne fermentacije.'
        : isNapolitana && isGlutenFree
        ? 'Početni odmor služi hidrataciji psylliuma. Nakon njega tijesto nastavlja fermentirati bez Stretch & Fold preklapanja.'
        : isWholeWheat
        ? `Integralno tijesto ima slabiju elastičnost i lakše se lomi, pa budite vrlo nježni sa Stretch & Fold. Ponavljajte je ukupno 3 puta svakih približno ${bulkRestMinutes} minuta, bez agresivnih pokreta.`
        : isSpelt
          ? `Pir fermentira nježnije. Radite vrlo nježan Stretch & Fold i ponovite ga ukupno 3 puta svakih približno ${bulkRestMinutes} minuta; tijesto se lako trga.`
          : `Temperatura prostorije utječe na brzinu fermentacije. Ljeti, kada je prostorija toplija, bulk se skraćuje; zimi, kada je hladnija, bulk se produžuje. Za unesenu temperaturu od ${roomTemp} °C aplikacija je prilagodila odmor na približno ${bulkRestMinutes} minuta.`,
      fermentationSignsInfo: 'Provjerite znakove aktivne fermentacije: sitne mjehuriće, blago povećanje volumena, glađu i napetiju površinu te elastičniju i prozračniju strukturu tijesta.',
      containerOilInfo: 'Koristite čistu posudu sigurnu za hranu koja je dovoljno velika da tijesto naraste. Posudu pokrijte poklopcem ili folijom, ali je nemojte hermetički zatvoriti: fermentacija stvara plinove i posuda ne smije biti pod pritiskom. Možete uzeti plastičnu posudu s poklopcem, staklenu zdjelu s folijom, posudu za tijesto ili fermentacijsku kutiju s poklopcem koji nije potpuno zrakonepropusan. Posudu samo lagano premažite pomoćnim uljem; to ulje ne ulazi u izračun recepta i nije isto što i ulje u tijestu.',
      steps: isRomanTeglia && isGlutenFree ? [
        'Lagano nauljite fermentacijsku posudu i prebacite smjesu u nju.',
        'Pokrijte posudu i ostavite smjesu 15 minuta na sobnoj temperaturi da psyllium poveže strukturu.',
      ] : isNapolitana && isGlutenFree ? [
        'Prebacite smjesu u fermentacijsku posudu i pokrijte je.',
        ...(napolitanaGlutenFreeRemainingMinutes > 0 ? [`Nakon početnog odmora nastavite fermentirati smjesu još ${croatianMinutes(napolitanaGlutenFreeRemainingMinutes)} na sobnoj temperaturi. Ne radite Stretch & Fold.`] : ['Početni odmor je zaseban korak. Ne radite Stretch & Fold.']),
      ] : isRomanTeglia ? [
        'Lagano nauljite fermentacijsku posudu i prebacite tijesto u nju.',
        `Pokrijte posudu i ostavite tijesto ${bulkRestMinutes} minuta na sobnoj temperaturi.`,
        'Napravite prvi Stretch & Fold.',
        `Ostavite tijesto ponovno ${bulkRestMinutes} minuta.`,
        'Napravite drugi Stretch & Fold.',
        `Ostavite tijesto još ${bulkRestMinutes} minuta na sobnoj temperaturi.`,
      ] : isGlutenFree ? [
        'Lagano nauljite fermentacijsku posudu i prebacite smjesu u nju.',
        `Pokrijte posudu i ostavite smjesu 15 minuta na sobnoj temperaturi da se kratko opusti prije dijeljenja.`,
      ] : [
        'Lagano nauljite fermentacijsku posudu i prebacite tijesto u nju.',
        `Pokrijte posudu i ostavite tijesto ${bulkRestMinutes} minuta na sobnoj temperaturi.`,
        'Napravite prvi Stretch & Fold.',
        `Ostavite tijesto ponovno ${bulkRestMinutes} minuta.`,
        'Napravite drugi Stretch & Fold.',
        `Ostavite završni bulk još ${bulkRestMinutes} minuta na sobnoj temperaturi.`,
        'Provjerite jesu li vidljivi prvi znakovi fermentacije.',
      ],
      timers: isRomanTeglia && isGlutenFree
        ? [timer('gluten-free-teglia-rest', 15 * 60, 'rt')]
        : isNapolitana && isGlutenFree
        ? napolitanaGlutenFreeRemainingMinutes > 0
          ? [timer('gluten-free-napolitana-rest', napolitanaGlutenFreeRemainingMinutes * 60, 'rt')]
          : []
        : isRomanTeglia
        ? [timer('roman-tray-bulk-1', bulkRestMinutes * 60, 'rt'), timer('roman-tray-bulk-2', bulkRestMinutes * 60, 'rt'), timer('roman-tray-bulk-final', bulkRestMinutes * 60, 'rt')]
        : isGlutenFree
        ? [timer('gluten-free-short-rest', 15 * 60, 'rt')]
        : [
          timer('bulk-rest-1', bulkRestMinutes * 60, 'rt'),
          timer('bulk-rest-2', bulkRestMinutes * 60, 'rt'),
          timer('bulk-final', bulkRestMinutes * 60, 'rt'),
          ],
    },
    {
      title: isRomanTeglia ? 'Faza C: Masa za tepsiju' : isGlutenFree ? 'Faza C: Podjela i oblikovanje loptica (Bulice)' : hasPreferment ? 'Faza D: Podjela i oblikovanje loptica (Bulice)' : 'Faza C: Podjela i oblikovanje loptica (Bulice)',
      degassingInfo: 'Degaziranje znači izbacivanje plinova iz tijesta nastalih tijekom fermentacije.',
      steps: isRomanTeglia ? [
        `Pripremite jednu masu od ${totalDough} g za tepsiju prema unesenoj gramaži od ${ballWeight} g.`,
        'Ne oblikujte kugle; tijesto ostaje kao jedna masa.',
      ] : isGlutenFree ? [
        'Radnu površinu obilno pospite bezglutenskim ili rižinim brašnom. Brašno za radnu površinu ne ulazi u izračun recepta.',
        'Nježno izvadite ljepljivu smjesu iz posude uz minimalno degaziranje.',
        `Podijelite ukupnu masu tijesta od ${totalDough} g na jednake dijelove od ${ballWeight} g.`,
        `Dobit ćete približno ${ballCount} ${ballWord} za ${pizzas} ${pizzaWord}.`,
        'Uz pomoć pobrašnjenih ili nauljenih ruku oblikujte kugle.',
      ] : [
        'Lagano pospite radnu površinu brašnom. Brašno za radnu površinu ne ulazi u izračun recepta.',
        'Nježno izvadite tijesto iz posude uz minimalno degaziranje.',
        `Podijelite ukupno ${totalDough} g tijesta na kugle od ${ballWeight} g.`,
        `Dobit ćete približno ${ballCount} ${ballWord} za ${pizzas} ${pizzaWord}.`,
        'Svaki komad oblikujte u glatku i zategnutu kuglu.',
      ],
    },
    ...(hasColdFermentation ? [{
      title: isRomanTeglia ? 'Faza D: Hladna fermentacija' : hasPreferment ? 'Faza E: Hladna fermentacija' : 'Faza D: Hladna fermentacija',
      temperingInfo: isRomanTeglia
        ? 'Teglia ostaje kao jedna masa u zatvorenoj posudi. Nakon hladne fermentacije pripremite je za utiskivanje u tepsiju, bez kuglanja.'
        : isGlutenFree
        ? 'Bezglutenske kugle držite pokrivene kako se ne bi osušile. Nakon hladne fermentacije ostavite ih samo dovoljno dugo da omekšaju; bez predizanja i bez agresivnog razvlačenja.'
        : isWholeWheat
        ? 'Integralno tijesto ne podnosi pretjerano proširenje i ne voli duže zadržavanje u hladnjaku. Nakon hladne fermentacije kugle ostavite samo dovoljno dugo da se opuste, bez predizanja i bez agresivnog razvlačenja.'
        : isSpelt
          ? 'Pir je osjetljiviji i ne podnosi prekoračenje vremena u hladnjaku. Nakon hladne fermentacije kugle ostavite samo dovoljno dugo da se opuste, bez predizanja.'
          : 'Temperiranje znači da nakon hladne fermentacije izvadite kuglice tijesta iz hladnjaka i ostavite ih neko vrijeme na sobnoj temperaturi prije razvlačenja i pečenja.',
      containerOilInfo: isRomanTeglia
        ? 'Masu držite u posudi koja štiti od isušivanja, ali je nemojte hermetički zatvoriti. Poklopac treba samo prianjati ili imati mogućnost izlaska plinova; posuda ne smije biti pod pritiskom.'
        : 'Kugle držite u kutiji koja štiti od isušivanja, ali je nemojte hermetički zatvoriti. Poklopac treba samo prianjati ili imati mogućnost izlaska plinova; kutija ne smije biti pod pritiskom.',
      steps: isRomanTeglia ? [
        'Pokrijte fermentacijsku posudu i prebacite cijelu masu u hladnjak.',
        `Masa fermentira u hladnjaku ${coldFermentationDuration} pri približno 4–6 °C. Vrijeme hladne fermentacije računa se samo jednom.`,
        'Nakon isteka odabranog vremena prijeđite na utiskivanje u tepsiju.',
      ] : [
        'Stavite kugle u zatvorenu fermentacijsku kutiju i prebacite ih u hladnjak.',
        `Kugle fermentiraju u hladnjaku ${fridgeHours} sati pri približno 4–6 °C. Vrijeme hladne fermentacije računa se samo jednom.`,
        'Nakon isteka odabranog vremena prijeđite na temperiranje.',
      ],
      timers: [timer('cold-fermentation', fridgeHours * 3600, 'fridge')],
    }] : []),
    {
      title: isRomanTeglia
        ? 'Faza E: Utiskivanje u tepsiju i pečenje'
        : isNapolitana
          ? (hasColdFermentation ? 'Faza E: Temperiranje, oblikovanje i pečenje' : 'Faza D: Temperiranje, oblikovanje i pečenje')
          : hasPreferment ? (hasColdFermentation ? 'Faza F: Temperiranje i oblikovanje' : 'Faza E: Temperiranje i oblikovanje') : (hasColdFermentation ? 'Faza E: Temperiranje i oblikovanje' : 'Faza D: Temperiranje i oblikovanje'),
      temperingInfo: isRomanTeglia
        ? 'Teglia se nakon hladne fermentacije nježno utiskuje u nauljenu tepsiju. Ne oblikujte kuglu i ne rastežite tijesto u zraku.'
        : hasColdFermentation
          ? `Vrijeme temperiranja automatski se prilagođava temperaturi prostorije od ${roomTemp} °C: približno ${temperingMin}–${temperingMax} minuta. Na hladnijoj temperaturi može trebati 1–2 sata. Pazite da se kugle ne predignu.`
          : roomHours === 0
            ? `Ostavite kugle ${temperingMin}–${temperingMax} minuta na sobnoj temperaturi prije oblikovanja.`
            : `Nakon završetka odabranog odmora od ${croatianHours(roomHours)} prijeđite na oblikovanje.`,
      proofingInfo: isRomanTeglia ? undefined : doughReadinessInfo,
      ovenTimingInfo: isRomanTeglia ? undefined : oven === 'ooni'
        ? `Pizza peći treba približno ${ovenPreheatMin}–${ovenPreheatMax} minuta da se zagrije. Da se vrijeme uskladi s temperiranjem kugli, uključite pizza peć ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minuta prije nego što izvadite kugle iz hladnjaka.`
        : `Pećnici treba približno ${ovenPreheatMin}–${ovenPreheatMax} minuta da se zagrije. Da se vrijeme uskladi s temperiranjem kugli, uključite pećnicu ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minuta prije nego što izvadite kugle iz hladnjaka.`,
      ovenProgramInfo: oven === 'homePan' ? 'Ako imate Pizza program, koristite njega; ako nemate Pizza program, koristite gornji i donji grijač bez ventilatora.' : undefined,
      bakingInfo: oven === 'homeStone' ? 'Kao početnu poziciju postavite kamen ili čelik otprilike dvije razine ispod gornjeg grijača. Ako vrh ili dno pizze prebrzo tamne, prilagodite položaj svojoj pećnici.' : undefined,
      bakingCheckInfo: oven === 'homePan' ? 'Podignite rub pizze i provjerite je li dno dovoljno pečeno i zlatno-smeđe.' : undefined,
      steps: isRomanTeglia ? [
        `Uključite pećnicu 20 minuta prije pečenja i dobro je zagrijte na ${ovenTemp} °C.`,
        tegliaTemperingStep,
        'Lagano nauljite tepsiju.',
        `Istresite masu u tepsiju ${trayDimensions.width}×${trayDimensions.length} cm i nježno je utisnite prstima do rubova bez rastezanja u zraku.`,
        'Ostavite tijesto kratko da se opusti ako se vraća prema sredini.',
        'Dodajte umak i nadjev.',
        'Pecite bez grilla dok se dno i rub dobro ne ispeku.',
        'Na kraju uključite grill ako želite jače zapečenu gornju stranu.',
      ] : oven === 'homePan' ? [
        `Uključite pećnicu 20 minuta prije pečenja i dobro je zagrijte na ${ovenTemp} °C.`,
        isRomanTeglia ? tegliaTemperingStep : ballTemperingStep,
        ...(!isGlutenFree ? ['Površinu lagano pospite minimalnom količinom semole.'] : []),
        isGlutenFree ? 'Brzim i nježnim pokretom izvadite kuglu iz posude i stavite je na pobrašnjenu podlogu.' : 'Brzim i nježnim pokretom izvadite kuglu iz posude i stavite je naopako na semolu.',
        isRomanTonda ? 'Oblikujte tanku i ravnu Romanu pritiskanjem prstima ili valjkom; ne rastežite je agresivno u zraku.' : 'Vrhovima prstiju potiskujte zrak iz sredine prema rubovima. Ne koristite valjak.',
        'Lagano nauljite tepsiju.',
        isRomanTonda ? `Stavite tijesto direktno na podlogu i oblikujte tanku, ravnu Romanu do ${diameter} cm.` : isNewYork ? `Stavite tijesto u tepsiju i oblikujte tanku sredinu i ujednačenu debljinu do ${diameter} cm.` : isGlutenFree ? `Stavite smjesu direktno u tepsiju i nježno je utapkajte do ciljnog promjera od ${diameter} cm.` : `Stavite oblikovano tijesto direktno u tepsiju i razvucite ga do ciljnog promjera od ${diameter} cm.`,
        ...(!isRomanTonda && !isNewYork ? ['Ostavite cornicione približno 1–2 cm kao vizualnu preporuku.'] : []),
        'Ostavite tijesto u tepsiji da se kratko opusti i prilagodi obliku ako se vraća natrag.',
        'Dodajte umak i nadjev.',
        `Za pizzu od ${diameter} cm zadana količina mozzarelle je približno ${cheeseAmount} g.`,
        'Ubacite pizzu u zagrijanu pećnicu.',
        'Pecite bez grilla dok se dno i rub dobro ne ispeku.',
        'Na kraju uključite grill ako želite jače zapečenu gornju stranu.',
        'Izvadite pizzu iz pećnice i ostavite je kratko prije rezanja.',
      ] : [
        ovenSteps[0],
        isRomanTeglia ? tegliaTemperingStep : ballTemperingStep,
        isRomanTonda ? 'Radnu površinu lagano pospite brašnom ili semolom.' : isGlutenFree ? 'Radnu površinu obilno pospite bezglutenskim ili rižinim brašnom.' : 'Površinu lagano pospite minimalnom količinom semole.',
        isRomanTonda ? 'Brzim i nježnim pokretom izvadite kuglu i stavite je na pobrašnjenu podlogu.' : isGlutenFree ? 'Brzim i nježnim pokretom izvadite kuglu i stavite je na pobrašnjenu podlogu.' : 'Brzim i nježnim pokretom izvadite kuglu iz posude i stavite je naopako na semolu.',
        isRomanTonda ? 'Oblikujte tanku i ravnu Romanu pritiskanjem prstima ili valjkom; ne rastežite je agresivno u zraku.' : isNewYork ? 'Oblikujte veću kuglu u tankom središtu i što ujednačenijoj debljini. Nemojte namjerno stvarati visok, napuhnut napolitanski rub; kriška treba biti savitljiva.' : isGlutenFree ? 'Nema rastezanja u zraku. Vrhovima prstiju nježno tapkajte i potiskujte smjesu od sredine prema rubovima kako biste formirali krug. Ne koristite valjak.' : 'Vrhovima prstiju potiskujte zrak iz sredine prema rubovima. Ne koristite valjak.',
        ...(!isRomanTonda && !isNewYork ? ['Ostavite cornicione približno 1–2 cm kao vizualnu preporuku.'] : []),
        isRomanTonda ? `Oblikujte Romanu Tonda do ciljnog promjera od ${diameter} cm.` : isGlutenFree ? `Nježno utapkajte smjesu do ciljnog promjera od ${diameter} cm.` : `Razvucite tijesto do ciljnog promjera od ${diameter} cm.`,
        isGlutenFree ? 'Otresite višak bezglutenskog ili rižinog brašna i prebacite podlogu na lopaticu.' : 'Otresite višak semole i prebacite tijesto na lopaticu.',
        'Dodajte nadjev prema promjeru pizze, a rub ostavite bez nadjeva.',
        `Za pizzu od ${diameter} cm zadana količina mozzarelle je približno ${cheeseAmount} g.`,
        oven === 'ooni' ? ovenSteps[1] : 'Ubacite pizzu u zagrijanu pećnicu.',
        oven === 'ooni' ? ovenSteps[2] : ovenSteps[1],
        oven === 'ooni' ? ovenSteps[3] : ovenSteps[2],
      ],
      timers: [
        timer('tempering', temperingMidpoint, 'preBake'),
        ...(beginnerMode ? getBeginnerOvenTimers(oven, ovenTemp, useBakeEstimate, isRomanTeglia) : []),
      ],
    },
  ];
}

function getDetailedDirectStepsLocalized(
  lang: 'de' | 'en' | 'sl',
  ingredients: { flour: number; water: number; salt: number; oil: number; yeast: number },
  totalDough: number,
  pizzas: number,
  ballWeight: number,
  diameter: number,
  fridgeHours: number,
  roomHours: number,
  roomTemp: number,
  cheesePerPizza: number,
  oven: OvenType,
  ovenTemp: number,
  bakingTimeRange: string,
  mixing: 'hand' | 'mixer',
  variant: RecipeVariant,
  flourType: FlourType,
  trayDimensions: { width: number; length: number },
  estimatedBake = false,
  waterTemperature?: number,
  beginnerMode = false,
  beginnerPhaseAFlourBehavior?: BeginnerPhaseAFlourBehavior,
  targetFinalDoughTemp?: number,
): DetailedPhase[] {
  const hand = mixing === 'hand';
  const isGlutenFree = flourType === 'glutenFree';
  const phaseAFlourBehavior = beginnerPhaseAFlourBehavior
    ?? (flourType === 'spelt' ? 'spelt' : flourType === 'wholeWheat' ? 'wholeWheat' : 'standard');
  const isSpelt = phaseAFlourBehavior === 'spelt';
  const isWholeWheat = phaseAFlourBehavior === 'wholeWheat';
  const isRomanTonda = variant === 'romanaTonda';
  const isRomanTeglia = variant === 'romanaTeglia';
  const isTegliaTipo00BeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'caputo00';
  const isTegliaTipo00BeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'caputo00';
  const isTegliaManitobaBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'manitoba';
  const isTegliaManitobaBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'manitoba';
  const isTegliaSpeltBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'spelt';
  const isTegliaSpeltBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'spelt';
  const isTegliaWholeWheatBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'wholeWheat';
  const isTegliaWholeWheatBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'wholeWheat';
  const isTegliaCustomBeginnerHand = beginnerMode && isRomanTeglia && hand && flourType === 'custom';
  const isTegliaCustomBeginnerMixer = beginnerMode && isRomanTeglia && !hand && flourType === 'custom';
  const isNewYork = variant === 'newYork';
  const useBakeEstimate = isNewYork || estimatedBake;
  const isNeapolitanTipo00BeginnerHand = beginnerMode && variant === 'napolitana' && hand && flourType === 'caputo00';
  const isNeapolitanTipo00BeginnerMixer = beginnerMode && variant === 'napolitana' && !hand && flourType === 'caputo00';
  const isNeapolitanManitobaBeginnerHand = beginnerMode && variant === 'napolitana' && hand && flourType === 'manitoba';
  const isNeapolitanManitobaBeginnerMixer = beginnerMode && variant === 'napolitana' && !hand && flourType === 'manitoba';
  const isNeapolitanSpeltBeginnerHand = beginnerMode && variant === 'napolitana' && hand && flourType === 'spelt';
  const isNeapolitanSpeltBeginnerMixer = beginnerMode && variant === 'napolitana' && !hand && flourType === 'spelt';
  const isNeapolitanWholeWheatBeginnerHand = beginnerMode && variant === 'napolitana' && hand && flourType === 'wholeWheat';
  const isNeapolitanWholeWheatBeginnerMixer = beginnerMode && variant === 'napolitana' && !hand && flourType === 'wholeWheat';
  const isNeapolitanGlutenFreeBeginnerHand = beginnerMode && variant === 'napolitana' && hand && flourType === 'glutenFree';
  const isNeapolitanGlutenFreeBeginnerMixer = beginnerMode && variant === 'napolitana' && !hand && flourType === 'glutenFree';
  const isTegliaGlutenFreeBeginnerHand = beginnerMode && variant === 'romanaTeglia' && hand && flourType === 'glutenFree';
  const isTegliaGlutenFreeBeginnerMixer = beginnerMode && variant === 'romanaTeglia' && !hand && flourType === 'glutenFree';
  const isNeapolitanCustomBeginnerHand = beginnerMode && variant === 'napolitana' && hand && flourType === 'custom';
  const isNeapolitanCustomBeginnerMixer = beginnerMode && variant === 'napolitana' && !hand && flourType === 'custom';
  const coldFermentationDuration = formatDuration(fridgeHours * 3600, lang);
  const initialWater = Math.round(ingredients.water * 0.9);
  const remainingWater = Math.max(0, ingredients.water - initialWater);
  const tegliaInitialWater = Math.round(ingredients.water * 0.8);
  const tegliaRemainingWater = Math.max(0, ingredients.water - tegliaInitialWater);
  const idealIce = roomTemp > 19
    ? Math.min(Math.round(ingredients.water * 0.25), Math.max(0, Math.round((ingredients.water * (roomTemp - 19)) / 99)))
    : 0;
  const idealWater = ingredients.water - idealIce;
  const bulkRestMinutes = Math.max(15, Math.round(30 * (22 / Math.max(10, roomTemp))));
  const isNeapolitanBeginner = beginnerMode && (variant === 'napolitana' || variant === 'romanaTonda');
  const mixRestMinutes = isGlutenFree ? 5 : isNeapolitanBeginner || isTegliaCustomBeginnerHand || isTegliaCustomBeginnerMixer || isTegliaTipo00BeginnerHand || isTegliaTipo00BeginnerMixer || isTegliaManitobaBeginnerHand || isTegliaManitobaBeginnerMixer || isTegliaSpeltBeginnerHand || isTegliaSpeltBeginnerMixer || isTegliaWholeWheatBeginnerHand || isTegliaWholeWheatBeginnerMixer ? 5 : beginnerMode ? 5.5 : 5;
  const pick = (de: string, en: string, sl: string) => lang === 'de' ? de : lang === 'en' ? en : sl;
  const approvedTegliaHandPhaseAInfo = pick(
    'ⓘ Handmischen des Teigs für Teglia\n\nAufgrund der höheren Hydration ist Teglia-Teig weicher und klebriger als Teig für eine klassische runde Pizza. Fügen Sie nicht nur wegen der Klebrigkeit zusätzliches Mehl hinzu.\n\nGeben Sie das restliche Wasser schrittweise hinzu. Wenn der Teig kein Wasser mehr aufnimmt, hören Sie auf und machen Sie erst weiter, wenn das zuvor hinzugefügte Wasser mit dem Teig verbunden ist.\n\nVersuchen Sie nicht, durch langes und aggressives Mischen einen festen Teig zu erreichen. Die Struktur entwickelt sich während der späteren Ruhezeiten und Faltungen weiter.',
    'ⓘ Hand mixing dough for Teglia\n\nBecause of its higher hydration, Teglia dough will be softer and stickier than dough for a classic round pizza. Do not add extra flour just because the dough is sticky.\n\nAdd the remaining water gradually. If the dough no longer accepts water, stop adding it and continue only after the previously added water has incorporated into the dough.\n\nDo not try to achieve a firm dough through long, aggressive mixing. The structure will continue to develop during the later rests and folds.',
    'ⓘ Ročno mešanje testa za Teglio\n\nZaradi višje hidracije bo testo za Teglio mehkejše in bolj lepljivo kot testo za klasično okroglo pico. Ne dodajajte dodatne moke samo zato, ker je testo lepljivo.\n\nPreostalo vodo dodajajte postopoma. Če testo vode ne sprejema več, jo nehajte dodajati in nadaljujte šele, ko se prej dodana voda poveže s testom.\n\nNe poskušajte doseči čvrstega testa z dolgim in agresivnim mešanjem. Struktura se bo še naprej razvijala med poznejšimi počitki in prepogibanjem.',
  );
  const approvedTegliaMixerPhaseAInfo = pick(
    'ⓘ Mischen des Teigs für Teglia mit dem Mixer\n\nAufgrund der höheren Hydration ist Teglia-Teig weicher und klebriger als Teig für eine klassische runde Pizza. Fügen Sie nicht nur wegen der Klebrigkeit zusätzliches Mehl hinzu.\n\nGeben Sie das restliche Wasser schrittweise hinzu. Wenn der Teig kein Wasser mehr aufnimmt, hören Sie auf und machen Sie erst weiter, wenn das zuvor hinzugefügte Wasser mit dem Teig verbunden ist.\n\nErhöhen Sie die Geschwindigkeit nicht und verlängern Sie das Mischen nicht unnötig, nur um einen festeren Teig zu erhalten. Die Struktur entwickelt sich während der späteren Ruhezeiten und Faltungen weiter.',
    'ⓘ Mixing Teglia dough with a mixer\n\nBecause of its higher hydration, Teglia dough will be softer and stickier than dough for a classic round pizza. Do not add extra flour just because the dough is sticky.\n\nAdd the remaining water gradually. If the dough no longer accepts water, stop adding it and continue only after the previously added water has incorporated into the dough.\n\nDo not increase the speed or unnecessarily extend mixing just to obtain a firmer dough. The structure will continue to develop during the later rests and folds.',
    'ⓘ Mešanje testa za Teglio z mešalnikom\n\nZaradi višje hidracije bo testo za Teglio mehkejše in bolj lepljivo kot testo za klasično okroglo pico. Ne dodajajte dodatne moke samo zato, ker je testo lepljivo.\n\nPreostalo vodo dodajajte postopoma. Če testo vode ne sprejema več, jo nehajte dodajati in nadaljujte šele, ko se prej dodana voda poveže s testom.\n\nNe povečujte hitrosti in po nepotrebnem ne podaljšujte mešanja samo zato, da bi dobili čvrstejše testo. Struktura se bo še naprej razvijala med poznejšimi počitki in prepogibanjem.',
  );
  const approvedManitobaTegliaHandPhaseAInfo = pick(
    'ⓘ Handmischen des Teigs mit Manitoba-Mehl\n\nAufgrund der höheren Hydration ist Teglia-Teig weicher und klebriger als Teig für eine klassische runde Pizza. Manitoba-Mehl hat eine starke Glutenstruktur und verträgt eine höhere Hydration gut, aber geben Sie das Wasser trotzdem schrittweise hinzu.\n\nGeben Sie das restliche Wasser in mehreren kleinen Zugaben hinzu. Verbinden Sie jeden Teil gut mit dem Teig, bevor Sie den nächsten hinzufügen.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, decken Sie ihn ab und lassen Sie ihn etwa 15–20 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
    'ⓘ Hand kneading dough with Manitoba flour\n\nBecause of its higher hydration, Teglia dough will be softer and stickier than dough for a classic round pizza. Manitoba flour has a strong gluten structure and handles higher hydration well, but still add the water gradually.\n\nAdd the remaining water in several small additions. Incorporate each part well into the dough before adding the next.\n\nIf the dough becomes too sticky and difficult to work with, cover it and let it rest for about 15–20 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: Take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
    'ⓘ Ročno gnetenje testa z moko Manitoba\n\nZaradi višje hidracije bo testo za Teglio mehkejše in bolj lepljivo kot testo za klasično okroglo pico. Manitoba moka ima močno glutensko strukturo in dobro prenaša višjo hidracijo, vendar vodo vseeno dodajajte postopoma.\n\nPreostalo vodo dodajte v več manjših dodajanjih. Vsak del dobro povežite s testom, preden dodate naslednjega.\n\nČe testo postane preveč lepljivo in ga je težko obdelovati, ga pokrijte in pustite počivati približno 15–20 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: Primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
  );
  const approvedManitobaTegliaMixerPhaseAInfo = pick(
    'ⓘ Mischen des Teigs mit Manitoba-Mehl im Mixer\n\nAufgrund der höheren Hydration ist Teglia-Teig weicher und klebriger als Teig für eine klassische runde Pizza. Manitoba-Mehl hat eine starke Glutenstruktur und verträgt eine höhere Hydration gut, aber geben Sie das Wasser trotzdem schrittweise hinzu.\n\nGeben Sie das restliche Wasser in mehreren kleinen Zugaben hinzu. Lassen Sie jeden Teil mit dem Teig verbinden, bevor Sie den nächsten hinzufügen.\n\nWenn der Teig zu klebrig und schwer zu mischen wird, stoppen Sie den Mixer, decken Sie den Teig ab und lassen Sie ihn etwa 10–15 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
    'ⓘ Mixing dough with Manitoba flour in a mixer\n\nBecause of its higher hydration, Teglia dough will be softer and stickier than dough for a classic round pizza. Manitoba flour has a strong gluten structure and handles higher hydration well, but still add the water gradually.\n\nAdd the remaining water in several small additions. Let each part incorporate into the dough before adding the next.\n\nIf the dough becomes too sticky and difficult to mix, stop the mixer, cover the dough, and let it rest for about 10–15 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: Take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
    'ⓘ Mešanje testa z moko Manitoba z mešalnikom\n\nZaradi višje hidracije bo testo za Teglio mehkejše in bolj lepljivo kot testo za klasično okroglo pico. Manitoba moka ima močno glutensko strukturo in dobro prenaša višjo hidracijo, vendar vodo vseeno dodajajte postopoma.\n\nPreostalo vodo dodajte v več manjših dodajanjih. Vsak del pustite, da se poveže s testom, preden dodate naslednjega.\n\nČe testo postane preveč lepljivo in ga je težko mešati, ustavite mešalnik, testo pokrijte in ga pustite počivati približno 10–15 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: Primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
  );
  const approvedSpeltTegliaHandPhaseAInfo = pick(
    'ⓘ Handkneten von Dinkelteig für Teglia\n\nDas Kneten von Hand dauert normalerweise etwa 6–8 Minuten. Kneten Sie Dinkelteig sanfter und nicht unnötig lange.\n\nWarum? Das Gluten in Dinkelteig ist empfindlicher als das von klassischem Weizenmehl. Zu langes oder zu kräftiges Kneten kann das Glutengerüst schwächen, sodass der Teig weicher, klebriger wird und seine Form schlechter hält.\n\nAufgrund der höheren Hydration wird der Teglia-Teig weicher und klebriger. Geben Sie die restlichen 20 % Wasser schrittweise hinzu und verbinden Sie jeden Teil gut, bevor Sie den nächsten hinzufügen.\n\nBeenden Sie das Kneten, wenn der Teig verbunden, glatt und elastisch ist.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, decken Sie ihn ab und lassen Sie ihn etwa 15 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
    'ⓘ Hand kneading spelt dough for Teglia\n\nHand kneading usually takes about 6–8 minutes. Knead spelt dough gently and do not knead it unnecessarily long.\n\nWhy? Gluten in spelt dough is more delicate than in classic wheat flour. Kneading for too long or too vigorously can weaken the gluten network, making the dough softer, stickier, and less able to hold its shape.\n\nBecause of the higher hydration, Teglia dough will be softer and stickier. Add the remaining 20% of the water gradually and incorporate each part well before the next addition.\n\nFinish when the dough is cohesive, smooth, and elastic.\n\nIf the dough becomes too sticky and difficult to work with, cover it and let it rest for about 15 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: Take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
    'ⓘ Ročno gnetenje pirinega testa za Teglio\n\nRočno gnetenje običajno traja približno 6–8 minut. Pirino testo gnetite nežneje in ne po nepotrebnem dolgo.\n\nZakaj? Gluten v pirinem testu je občutljivejši kot pri klasični pšenični moki. Predolgo ali premočno gnetenje lahko oslabi glutensko mrežo, zato testo postane mehkejše, bolj lepljivo in težje ohrani obliko.\n\nZaradi višje hidracije bo testo za Teglio mehkejše in bolj lepljivo. Preostalih 20 % vode dodajajte postopoma in vsak del dobro povežite, preden dodate naslednjega.\n\nKončajte, ko je testo povezano, gladko in elastično.\n\nČe testo postane preveč lepljivo in ga je težko obdelovati, ga pokrijte in pustite počivati približno 15 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: Primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
  );
  const approvedSpeltTegliaMixerPhaseAInfo = pick(
    'ⓘ Mischen von Dinkelteig für Teglia mit dem Mixer\n\nDas Mischen dauert normalerweise etwa 5–7 Minuten. Verwenden Sie eine niedrige Geschwindigkeit und mischen Sie den Teig nicht unnötig lange oder intensiv.\n\nWarum? Das Gluten in Dinkelteig ist empfindlicher als das von klassischem Weizenmehl. Zu langes oder zu schnelles Mischen kann das Glutengerüst schwächen, sodass der Teig weicher, klebriger wird und seine Form schlechter hält.\n\nAufgrund der höheren Hydration wird der Teglia-Teig weicher und klebriger. Geben Sie die restlichen 20 % Wasser schrittweise hinzu und lassen Sie jeden Teil verbinden, bevor Sie den nächsten hinzufügen.\n\nBeenden Sie das Mischen, wenn der Teig verbunden, glatt und elastisch ist.\n\nWenn der Teig zu klebrig und schwer zu mischen wird, stoppen Sie den Mixer, decken Sie ihn ab und lassen Sie ihn etwa 10 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
    'ⓘ Mixing spelt dough for Teglia with a mixer\n\nMixing usually takes about 5–7 minutes. Use a slow speed and do not mix the dough unnecessarily long or intensely.\n\nWhy? Gluten in spelt dough is more delicate than in classic wheat flour. Mixing for too long or too fast can weaken the gluten network, making the dough softer, stickier, and less able to hold its shape.\n\nBecause of the higher hydration, Teglia dough will be softer and stickier. Add the remaining 20% of the water gradually and let each part incorporate before the next addition.\n\nFinish when the dough is cohesive, smooth, and elastic.\n\nIf the dough becomes too sticky and difficult to mix, stop the mixer, cover it, and let it rest for about 10 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: Take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
    'ⓘ Mešanje pirinega testa za Teglio z mešalnikom\n\nMešanje običajno traja približno 5–7 minut. Uporabite nizko hitrost in testa ne mešajte po nepotrebnem dolgo ali intenzivno.\n\nZakaj? Gluten v pirinem testu je občutljivejši kot pri klasični pšenični moki. Predolgo ali prehitro mešanje lahko oslabi glutensko mrežo, zato testo postane mehkejše, bolj lepljivo in težje ohrani obliko.\n\nZaradi višje hidracije bo testo za Teglio mehkejše in bolj lepljivo. Preostalih 20 % vode dodajajte postopoma in vsak del pustite, da se poveže, preden dodate naslednjega.\n\nKončajte, ko je testo povezano, gladko in elastično.\n\nČe testo postane preveč lepljivo in ga je težko mešati, ustavite mešalnik, testo pokrijte in ga pustite počivati približno 10 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: Primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
  );
  const approvedWholeWheatTegliaHandPhaseAInfo = pick(
    'ⓘ Handkneten von Vollkornteig für Teglia\n\nDas Kneten von Hand dauert normalerweise etwa 8–10 Minuten; richten Sie sich aber nach dem Zustand des Teigs.\n\nVollkornmehl nimmt Wasser langsamer auf, geben Sie dem Teig daher Zeit. Erwarten Sie nicht dieselbe Glätte wie bei Tipo-00-Mehl.\n\nAufgrund der höheren Hydration wird der Teglia-Teig weicher und klebriger, aber Vollkornmehl braucht länger, um das Wasser vollständig aufzunehmen. Geben Sie die restlichen 20 % Wasser schrittweise hinzu und verbinden Sie jeden Teil gut, bevor Sie den nächsten hinzufügen.\n\nWenn der Teig beim Kneten noch hart oder trocken wirkt, geben Sie nicht sofort mehr Wasser hinzu. Decken Sie ihn ab und lassen Sie ihn etwa 10–15 Minuten ruhen, damit das Mehl weiter Wasser aufnehmen kann, und kneten Sie dann sanft weiter.\n\nWenn der Teig danach noch schwach ist, zu wenig Spannung hat oder seine Form schlecht hält, führen Sie einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
    'ⓘ Hand kneading whole-wheat dough for Teglia\n\nHand kneading usually takes about 8–10 minutes, but use the condition of the dough as your guide.\n\nWhole-wheat flour absorbs water more slowly, so give the dough time to take it in. Do not expect the dough to be as smooth as dough made with Tipo 00 flour.\n\nBecause of the higher hydration, Teglia dough will be softer and stickier, but whole-wheat flour needs more time to fully absorb the water. Add the remaining 20% of the water gradually and incorporate each part well before the next addition.\n\nIf the dough still seems hard or dry while kneading, do not immediately add more water. Cover it and let it rest for about 10–15 minutes so the flour can continue absorbing water, then continue kneading gently.\n\nIf the dough is still weak, lacks tension, or has difficulty holding its shape, do several gentle Stretch & Fold folds.\n\nStretch & Fold: Take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
    'ⓘ Ročno gnetenje polnozrnatega testa za Teglio\n\nRočno gnetenje običajno traja približno 8–10 minut, vendar se ravnajte po stanju testa.\n\nPolnozrnata moka vodo vpija počasneje, zato dajte testu čas, da jo sprejme. Ne pričakujte enako gladkega testa kot pri moki Tipo 00.\n\nZaradi višje hidracije bo testo za Teglio mehkejše in bolj lepljivo, vendar polnozrnata moka potrebuje več časa, da popolnoma vpije vodo. Preostalih 20 % vode dodajajte postopoma in vsak del dobro povežite, preden dodate naslednjega.\n\nČe je testo med gnetenjem še vedno trdo ali suho, ne dodajajte takoj več vode. Pokrijte ga in pustite počivati približno 10–15 minut, da moka nadaljuje vpijanje vode, nato nežno nadaljujte z gnetenjem.\n\nČe je testo po tem še vedno šibko, nima dovolj napetosti ali težko ohranja obliko, naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: Primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
  );
  const approvedWholeWheatTegliaMixerPhaseAInfo = pick(
    'ⓘ Mischen von Vollkornteig für Teglia mit dem Mixer\n\nDas Mischen dauert normalerweise etwa 7–10 Minuten; richten Sie sich aber nach dem Zustand des Teigs.\n\nVollkornmehl nimmt Wasser langsamer auf, geben Sie dem Teig daher Zeit. Erwarten Sie nicht dieselbe Glätte wie bei Tipo-00-Mehl.\n\nAufgrund der höheren Hydration wird der Teglia-Teig weicher und klebriger, aber Vollkornmehl braucht länger, um das Wasser vollständig aufzunehmen. Geben Sie die restlichen 20 % Wasser schrittweise hinzu und lassen Sie jeden Teil verbinden, bevor Sie den nächsten hinzufügen.\n\nWenn der Teig beim Mischen noch hart oder trocken wirkt, geben Sie nicht sofort mehr Wasser hinzu. Stoppen Sie den Mixer, decken Sie den Teig ab und lassen Sie ihn etwa 10–15 Minuten ruhen, damit das Mehl weiter Wasser aufnehmen kann. Mischen Sie danach bei niedriger Geschwindigkeit weiter.\n\nWenn der Teig danach noch schwach ist, zu wenig Spannung hat oder seine Form schlecht hält, nehmen Sie ihn aus dem Mixer und führen Sie einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
    'ⓘ Mixing whole-wheat dough for Teglia with a mixer\n\nMixing usually takes about 7–10 minutes, but use the condition of the dough as your guide.\n\nWhole-wheat flour absorbs water more slowly, so give the dough time to take it in. Do not expect the dough to be as smooth as dough made with Tipo 00 flour.\n\nBecause of the higher hydration, Teglia dough will be softer and stickier, but whole-wheat flour needs more time to fully absorb the water. Add the remaining 20% of the water gradually and let each part incorporate before the next addition.\n\nIf the dough still seems hard or dry while mixing, do not immediately add more water. Stop the mixer, cover the dough, and let it rest for about 10–15 minutes so the flour can continue absorbing water. After the rest, resume mixing at low speed.\n\nIf the dough is still weak, lacks tension, or has difficulty holding its shape, remove it from the mixer and do several gentle Stretch & Fold folds.\n\nStretch & Fold: Take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
    'ⓘ Mešanje polnozrnatega testa za Teglio z mešalnikom\n\nMešanje običajno traja približno 7–10 minut, vendar se ravnajte po stanju testa.\n\nPolnozrnata moka vodo vpija počasneje, zato dajte testu čas, da jo sprejme. Ne pričakujte enako gladkega testa kot pri moki Tipo 00.\n\nZaradi višje hidracije bo testo za Teglio mehkejše in bolj lepljivo, vendar polnozrnata moka potrebuje več časa, da popolnoma vpije vodo. Preostalih 20 % vode dodajajte postopoma in vsak del pustite, da se poveže, preden dodate naslednjega.\n\nČe je testo med mešanjem še vedno trdo ali suho, ne dodajajte takoj več vode. Ustavite mešalnik, testo pokrijte in ga pustite počivati približno 10–15 minut, da moka nadaljuje vpijanje vode. Po počitku nadaljujte z mešanjem pri nizki hitrosti.\n\nČe je testo po tem še vedno šibko, nima dovolj napetosti ali težko ohranja obliko, ga vzemite iz mešalnika in naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: Primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
  );
  const mixRestLabel = isGlutenFree
    ? pick('5 Minuten', '5 minutes', '5 minut')
    : isNeapolitanBeginner
      ? pick('5 Minuten', '5 minutes', '5 minut')
      : beginnerMode
        ? pick('5 Minuten', '5 minutes', '5 minut')
      : pick('5 Minuten', '5 minutes', '5 minut');
  const approvedHandPhaseAInfo = pick(
    'Das Kneten von Hand dauert normalerweise etwa 10 Minuten, richten Sie sich aber nach dem Zustand des Teigs. Beenden Sie den Vorgang, wenn der Teig glatt, verbunden und elastisch ist.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, decken Sie ihn ab und lassen Sie ihn etwa 20 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.\n\nDanach fahren Sie mit dem Rezept fort.',
    'Hand kneading usually takes about 10 minutes, but use the condition of the dough as your guide. Finish when the dough is smooth, cohesive, and elastic.\n\nIf the dough becomes too sticky and difficult to work with, cover it and let it rest for about 20 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.\n\nThen continue with the recipe.',
    'Ročno gnetenje običajno traja približno 10 minut, vendar se ravnajte po stanju testa. Končajte, ko je testo gladko, povezano in elastično.\n\nČe testo postane preveč lepljivo in ga je težko obdelovati, ga pokrijte in pustite počivati približno 20 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.\n\nNato nadaljujte po receptu.',
  );
  const approvedWholeWheatHandPhaseAInfo = pick(
    'Das Kneten von Hand dauert bei Vollkornteig normalerweise etwa 8–10 Minuten, richten Sie sich aber nach dem Zustand des Teigs.\n\nVollkornmehl nimmt Wasser etwas langsamer auf als Weißmehl, daher kann der Teig etwas mehr Zeit brauchen, um sich richtig zu verbinden. Erwarten Sie nicht dieselbe glatte Oberfläche wie bei Teig aus Tipo-00-Mehl.\n\nWenn der Teig hart, trocken oder schwer zu kneten ist, decken Sie ihn ab und lassen Sie ihn etwa 10–15 Minuten ruhen; kneten Sie danach weiter.\n\nWenn der Teig nach dieser Ruhe weiterhin schwach verbunden ist, sich leicht ohne Spannung dehnt und seine Form nicht hält, führen Sie einige sanfte Stretch-&-Fold-Faltungen durch, um die Struktur zu stärken.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
    'Hand kneading whole-wheat dough usually takes about 8–10 minutes, but use the condition of the dough as your guide.\n\nWhole wheat flour absorbs water more slowly than white flour, so the dough may need a little more time to come together properly. Do not expect the same smooth surface as Tipo 00 dough.\n\nIf the dough is hard, dry, or difficult to knead, cover it and let it rest for about 10–15 minutes, then continue kneading.\n\nIf after that rest the dough is still weakly connected, stretches easily without tension, and does not hold its shape, do several gentle Stretch & Fold folds to strengthen the dough structure.\n\nStretch & Fold: take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
    'Ročno gnetenje polnozrnatega testa običajno traja približno 8–10 minut, vendar se ravnajte po stanju testa.\n\nPolnozrnata moka vodo vpija nekoliko počasneje kot bela moka, zato testo morda potrebuje nekaj več časa, da se pravilno poveže. Ne pričakujte enako gladke površine kot pri testu iz moke Tipo 00.\n\nČe je testo trdo, suho ali ga je težko gnesti, ga pokrijte in pustite počivati približno 10–15 minut, nato nadaljujte z gnetenjem.\n\nČe je testo tudi po tem počitku še vedno šibko povezano, se zlahka razteza brez napetosti in ne ohranja oblike, naredite nekaj nežnih prepogibov Stretch & Fold, da okrepite strukturo testa.\n\nStretch & Fold: primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
  );
  const approvedWholeWheatMixerPhaseAInfo = pick(
    'Das Mischen von Vollkornteig dauert normalerweise etwa 7–10 Minuten, richten Sie sich aber nach dem Zustand des Teigs und nicht nur nach der Zeit.\n\nVollkornmehl nimmt Wasser etwas langsamer auf als Weißmehl. Versuchen Sie nicht, durch längeres oder schnelleres Mischen dieselbe glatte Oberfläche wie bei Tipo-00-Teig zu erreichen.\n\nWenn der Teig hart, trocken oder schwer zu mischen ist, stoppen Sie den Mixer, decken Sie den Teig ab und lassen Sie ihn etwa 10–15 Minuten ruhen; mischen Sie danach bei niedriger Geschwindigkeit weiter.\n\nWenn der Teig nach dieser Ruhe weiterhin schwach verbunden ist, sich leicht ohne Spannung dehnt und seine Form nicht hält, nehmen Sie ihn aus dem Mixer und führen Sie einige sanfte Stretch-&-Fold-Faltungen durch, um die Struktur zu stärken.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
    'Mixer mixing whole-wheat dough usually takes about 7–10 minutes, but use the condition of the dough as your guide, not only the time.\n\nWhole wheat flour absorbs water more slowly than white flour. Do not try to achieve the same smooth surface as Tipo 00 dough by mixing longer or faster.\n\nIf the dough is hard, dry, or difficult to mix, stop the mixer, cover the dough, and let it rest for about 10–15 minutes, then continue mixing at low speed.\n\nIf after that rest the dough is still weakly connected, stretches easily without tension, and does not hold its shape, remove it from the mixer and do several gentle Stretch & Fold folds to strengthen the dough structure.\n\nStretch & Fold: take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
    'Mešanje polnozrnatega testa običajno traja približno 7–10 minut, vendar se ravnajte po stanju testa in ne samo po času.\n\nPolnozrnata moka vodo vpija nekoliko počasneje kot bela moka. Ne poskušajte doseči enako gladke površine kot pri testu iz moke Tipo 00 z daljšim ali hitrejšim mešanjem.\n\nČe je testo trdo, suho ali ga je težko mešati, ustavite mešalnik, testo pokrijte in pustite počivati približno 10–15 minut, nato nadaljujte z mešanjem pri nizki hitrosti.\n\nČe je testo tudi po tem počitku še vedno šibko povezano, se zlahka razteza brez napetosti in ne ohranja oblike, ga vzemite iz mešalnika in naredite nekaj nežnih prepogibov Stretch & Fold, da okrepite strukturo testa.\n\nStretch & Fold: primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
  );
  const approvedManitobaHandPhaseAInfo = pick(
    'Das Kneten von Manitoba-Mehl dauert normalerweise etwa 10–15 Minuten, richten Sie sich aber nach dem Zustand des Teigs. Beenden Sie den Vorgang, wenn der Teig glatt, verbunden und elastisch ist.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, decken Sie ihn ab und lassen Sie ihn etwa 20 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.\n\nDanach fahren Sie mit dem Rezept fort.',
    'Hand kneading Manitoba flour usually takes about 10–15 minutes, but use the condition of the dough as your guide. Finish when the dough is smooth, cohesive, and elastic.\n\nIf the dough becomes too sticky and difficult to work with, cover it and let it rest for about 20 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.\n\nThen continue with the recipe.',
    'Ročno gnetenje moke Manitoba običajno traja približno 10–15 minut, vendar se ravnajte po stanju testa. Končajte, ko je testo gladko, povezano in elastično.\n\nČe testo postane preveč lepljivo in ga je težko obdelovati, ga pokrijte in pustite počivati približno 20 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.\n\nNato nadaljujte po receptu.',
  );
  const approvedSpeltHandPhaseAInfo = pick(
    'Das Kneten von Hand dauert normalerweise etwa 6–8 Minuten. Dinkelteig sollte sanfter geknetet werden; kneten Sie ihn nicht unnötig lange.\n\nWarum? Das Gluten in Dinkelteig ist empfindlicher als bei klassischem Weizenmehl. Zu langes oder zu kräftiges Kneten kann das Glutengerüst schwächen, sodass der Teig weicher und klebriger wird und seine Form schlechter hält.\n\nBeenden Sie das Kneten, wenn der Teig verbunden, glatt und elastisch ist.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, decken Sie ihn ab und lassen Sie ihn etwa 15 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.\n\nDanach fahren Sie mit dem Rezept fort.',
    'Hand kneading usually takes about 6–8 minutes. Knead spelt dough gently and do not knead it longer than necessary.\n\nWhy? The gluten in spelt dough is more sensitive than in conventional wheat flour. Kneading for too long or too intensely can weaken the gluten network, making the dough softer, stickier, and less able to hold its shape.\n\nFinish when the dough is cohesive, smooth, and elastic.\n\nIf the dough becomes too sticky and difficult to work with, cover it and let it rest for about 15 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.\n\nThen continue with the recipe.',
    'Ročno gnetenje običajno traja približno 6–8 minut. Pirino testo gnetite nežneje in ne dlje, kot je potrebno.\n\nZakaj? Gluten v pirinem testu je občutljivejši kot pri klasični pšenični moki. Predolgo ali premočno gnetenje lahko oslabi glutensko mrežo, zato testo postane mehkejše, bolj lepljivo in slabše ohranja obliko.\n\nKončajte, ko je testo povezano, gladko in elastično.\n\nČe testo postane preveč lepljivo in ga je težko obdelovati, ga pokrijte in pustite počivati približno 15 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.\n\nNato nadaljujte po receptu.',
  );
  const approvedManitobaMixerPhaseAInfo = pick(
    'Das Mischen von Manitoba-Mehl dauert normalerweise etwa 10–12 Minuten, richten Sie sich aber nach dem Zustand des Teigs. Beenden Sie den Vorgang, wenn der Teig glatt, verbunden und elastisch ist.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, stoppen Sie den Mixer, decken Sie den Teig ab und lassen Sie ihn etwa 10 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.\n\nDanach fahren Sie mit dem Rezept fort.',
    'Mixer mixing Manitoba flour usually takes about 10–12 minutes, but use the condition of the dough as your guide. Finish when the dough is smooth, cohesive, and elastic.\n\nIf the dough becomes too sticky and difficult to work with, stop the mixer, cover the dough, and let it rest for about 10 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.\n\nThen continue with the recipe.',
    'Mešanje moke Manitoba običajno traja približno 10–12 minut, vendar se ravnajte po stanju testa. Končajte, ko je testo gladko, povezano in elastično.\n\nČe testo postane preveč lepljivo in ga je težko obdelovati, ustavite mešalnik, testo pokrijte in pustite počivati približno 10 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.\n\nNato nadaljujte po receptu.',
  );
  const approvedSpeltMixerPhaseAInfo = pick(
    'Das Mischen von Dinkelteig dauert normalerweise etwa 5–7 Minuten. Verwenden Sie eine niedrige Geschwindigkeit und kneten Sie den Teig nicht unnötig lange oder intensiv.\n\nWarum? Das Gluten in Dinkelteig ist empfindlicher als bei klassischem Weizenmehl. Zu langes oder zu schnelles Mischen kann das Glutengerüst schwächen, sodass der Teig weicher und klebriger wird und seine Form schlechter hält.\n\nBeenden Sie das Mischen, wenn der Teig verbunden, glatt und elastisch ist.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, stoppen Sie den Mixer, decken Sie den Teig ab und lassen Sie ihn etwa 10 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.\n\nDanach fahren Sie mit dem Rezept fort.',
    'Mixer mixing spelt dough usually takes about 5–7 minutes. Use a slow speed and do not mix the dough longer or more intensely than necessary.\n\nWhy? The gluten in spelt dough is more sensitive than in conventional wheat flour. Mixing for too long or too fast can weaken the gluten network, making the dough softer, stickier, and less able to hold its shape.\n\nFinish when the dough is cohesive, smooth, and elastic.\n\nIf the dough becomes too sticky and difficult to work with, stop the mixer, cover the dough, and let it rest for about 10 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.\n\nThen continue with the recipe.',
    'Mešanje pirinega testa običajno traja približno 5–7 minut. Uporabite počasno hitrost in testa ne mešajte dlje ali bolj intenzivno, kot je potrebno.\n\nZakaj? Gluten v pirinem testu je občutljivejši kot pri klasični pšenični moki. Predolgo ali prehitro mešanje lahko oslabi glutensko mrežo, zato testo postane mehkejše, lepljivejše in slabše zadržuje obliko.\n\nKončajte, ko je testo povezano, gladko in elastično.\n\nČe testo postane preveč lepljivo in ga je težko obdelovati, ustavite mešalnik, testo pokrijte in pustite počivati približno 10 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.\n\nNato nadaljujte po receptu.',
  );
  const approvedMixerPhaseAInfo = pick(
    'Das Mischen dauert normalerweise etwa 8–10 Minuten, richten Sie sich aber nach dem Zustand des Teigs. Beenden Sie den Vorgang, wenn der Teig glatt, verbunden und elastisch ist.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, decken Sie ihn ab und lassen Sie ihn etwa 10 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Fassen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und schlagen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.\n\nDanach fahren Sie mit dem Rezept fort.',
    'Mixer mixing usually takes about 8–10 minutes, but use the condition of the dough as your guide. Finish when the dough is smooth, cohesive, and elastic.\n\nIf the dough becomes too sticky and difficult to work with, cover it and let it rest for about 10 minutes. After the rest, do several gentle Stretch & Fold folds.\n\nStretch & Fold: take one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.\n\nThen continue with the recipe.',
    'Mešanje običajno traja približno 8–10 minut, vendar se ravnajte po stanju testa. Končajte, ko je testo gladko, povezano in elastično.\n\nČe testo postane preveč lepljivo in ga je težko obdelovati, ga pokrijte in pustite počivati približno 10 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: primite en rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.\n\nNato nadaljujte po receptu.',
  );
  const temperingMin = Math.min(120, Math.max(15, Math.round(30 + (22 - roomTemp) * 7.5)));
  const temperingMax = Math.min(120, temperingMin + 15);
  const ovenPreheatMin = oven === 'homeStone' ? 45 : 20;
  const ovenPreheatMax = oven === 'homeStone' ? 60 : 20;
  const temperingMidpoint = Math.round(((temperingMin + temperingMax) / 2) * 60);
  const cheeseAmount = Math.round(cheesePerPizza);
  const psylliumAmount = isGlutenFree ? Math.round(ingredients.flour * 0.02) : 0;
  const ballCount = Math.round(totalDough / ballWeight);
  const timer = (id: string, seconds: number, kind: BaseTimer['kind']): BaseTimer => ({ id, seconds, kind });
  const recipeSentenceEnd = useBakeEstimate && lang === 'de' ? '' : '.';
  const finalRoomDuration = roomHours > 0
    ? pick(
        `${roomHours} ${roomHours === 1 ? 'Stunde' : 'Stunden'}`,
        `${roomHours} ${roomHours === 1 ? 'hour' : 'hours'}`,
        `${roomHours} ${roomHours === 1 ? 'uro' : roomHours === 2 ? 'uri' : roomHours < 5 ? 'ure' : 'ur'}`,
      )
    : pick('15–30 Minuten', '15–30 minutes', '15–30 minut');
  const tegliaTemperingStep = fridgeHours > 0
    ? pick(
        `Nehmen Sie den Teig nach ${coldFermentationDuration} aus dem Kühlschrank und lassen Sie ihn ${finalRoomDuration} bei Raumtemperatur entspannen. Achten Sie darauf, dass er nicht überfermentiert, und drücken Sie ihn anschließend in das Blech.`,
        `After ${coldFermentationDuration} in the refrigerator, take the dough out and let it relax at room temperature for ${finalRoomDuration}. Make sure it does not over-ferment, then press it into the tray.`,
        `Po ${coldFermentationDuration} v hladilniku vzemite testo ven in ga pustite ${finalRoomDuration} počivati pri sobni temperaturi. Pazite, da ne fermentira preveč, nato ga vtisnite v pekač.`,
      )
    : pick(
        `Lassen Sie den Teig ${temperingMin}–${temperingMax} Minuten bei Raumtemperatur entspannen und drücken Sie ihn anschließend in das Blech.`,
        `Let the dough relax at room temperature for ${temperingMin}–${temperingMax} minutes, then press it into the tray.`,
        `Testo pustite ${temperingMin}–${temperingMax} minut počivati pri sobni temperaturi, nato ga vtisnite v pekač.`,
      );
  const ovenSteps = oven === 'ooni'
    ? [
      pick(`Heizen Sie den Pizzaofen mindestens 20 Minuten auf ${ovenTemp} °C vor.`, `Preheat the pizza oven for at least 20 minutes at ${ovenTemp} °C.`, `Pizza pečico segrevajte vsaj 20 minut pri ${ovenTemp} °C.`),
      pick('Schieben Sie die Pizza hinein und drehen Sie sie alle 20–30 Sekunden.', 'Launch the pizza and rotate it every 20–30 seconds.', 'Vstavite pico in jo obračajte vsakih 20–30 sekund.'),
      isNewYork
        ? pick(`Backen Sie die New-York-Pizza ${bakingTimeRange} und nehmen Sie sie heraus, wenn sie fertig ist.`, `Bake the New York pizza for ${bakingTimeRange} and remove it when done.`, `Newyorško pico pecite ${bakingTimeRange} in jo vzemite iz pečice, ko je pečena.`)
        : estimatedBake
          ? pick(`Backen Sie die Pizza ${bakingTimeRange} und nehmen Sie sie heraus, sobald der Rand dunkle Flecken bekommt.`, `Bake the pizza for ${bakingTimeRange} and remove it when the rim develops dark spots.`, `Pico pecite ${bakingTimeRange} in jo vzemite iz pečice, ko rob dobi temne lise.`)
        : pick('Backen Sie die Pizza etwa 60–90 Sekunden und nehmen Sie sie heraus, sobald der Rand dunkle Flecken bekommt.', 'Bake the pizza for approximately 60–90 seconds and remove it when the rim develops dark spots.', 'Pico pecite približno 60–90 sekund in jo vzemite iz pečice, ko rob dobi temne lise.'),
    ]
    : oven === 'homePan'
      ? [
        pick(`Heizen Sie den Haushaltsbackofen auf ${ovenTemp} °C mit Umluft vor.`, `Preheat the home oven to ${ovenTemp} °C with convection.`, `Domačo pečico segrejte na ${ovenTemp} °C z ventilacijo.`),
        useBakeEstimate
          ? pick(`Backen Sie die Pizza insgesamt ${bakingTimeRange}; ein abschließendes Grillen ist in dieser Zeit enthalten.`, `Bake the pizza for ${bakingTimeRange} total, including any brief grill finish.`, `Pico pecite skupaj ${bakingTimeRange}; čas vključuje morebitno kratko zapečenje pod žarom.`)
          : pick('Backen Sie die Pizza auf der untersten Schiene des Ofens 5–7 Minuten.', 'Bake the pizza on the bottom of the oven for 5–7 minutes.', 'Pico pecite na dnu pečice 5–7 minut.'),
        useBakeEstimate
          ? pick('Prüfen Sie Boden und Belag, bevor Sie die Pizza herausnehmen.', 'Check the base and top before removing the pizza.', 'Preden pico vzamete iz pečice, preverite dno in vrh.')
          : pick('Schieben Sie die Pizza anschließend für weitere 2–3 Minuten unter den oberen Grill.', 'Then move the pizza under the upper grill for another 2–3 minutes.', 'Nato pico za nadaljnji 2–3 minuti prestavite pod zgornji žar.'),
      ] : [
      pick(`Heizen Sie den Pizzastein oder Pizzastahl 45–60 Minuten auf ${ovenTemp} °C mit eingeschaltetem Grill vor.`, `Preheat the pizza stone or steel for 45–60 minutes at ${ovenTemp} °C with the grill on.`, `Kamen ali jeklo za pico segrevajte 45–60 minut pri ${ovenTemp} °C z vklopljenim žarom.`),
      pick(`Schalten Sie den Grill aus und wechseln Sie auf das Pizza-Programm, falls vorhanden. Wenn kein Pizza-Programm verfügbar ist, wählen Sie Ober-/Unterhitze ohne Umluft und stellen Sie die maximale Temperatur ein. Backen Sie die Pizza ungefähr ${useBakeEstimate ? bakingTimeRange : '4–5 Minuten'}${recipeSentenceEnd}`, `Turn off the grill and switch the oven to the Pizza program, if available. If no Pizza program is available, select top and bottom heat without a fan and set the oven to its maximum temperature. Bake the pizza for approximately ${useBakeEstimate ? bakingTimeRange : '4–5 minutes'}.`, `Izklopite žar in preklopite pečico na program Pizza, če je na voljo. Če program Pizza ni na voljo, izberite zgornje in spodnje gretje brez ventilatorja ter nastavite najvišjo temperaturo. Pico pecite približno ${useBakeEstimate ? bakingTimeRange : '4–5 minut'}.`),
      useBakeEstimate
        ? pick('Prüfen Sie die Bräunung innerhalb der angegebenen Backzeit.', 'Check the browning within the stated bake time.', 'Zapečenost preverite znotraj navedenega časa peke.')
        : pick('Schalten Sie anschließend den Grill ein und backen Sie die Pizza weiter, bis Rand und Oberfläche die gewünschte Bräunung erreicht haben.', 'Then turn on the grill and continue baking until the rim and top reach the desired browning.', 'Nato vklopite žar in pecite, dokler rob in vrh ne dosežeta želene zapečenosti.'),
    ];

  return [
    {
      title: isNeapolitanCustomBeginnerMixer
        ? pick('Neapolitan – Gemischtes Mehl – Mischen mit dem Mixer', 'Neapolitan – Flour Blend – Mixer Mixing', 'Neapolitanska – mešanica moke – mešanje z mešalnikom')
        : isNeapolitanCustomBeginnerHand
        ? pick('Neapolitan – Gemischtes Mehl – Handmischung', 'Neapolitan – Flour Blend – Hand Mixing', 'Neapolitanska – mešanica moke – ročno mešanje')
        : isTegliaGlutenFreeBeginnerMixer || isNeapolitanGlutenFreeBeginnerMixer
        ? pick('Neapolitan – Glutenfreies Mehl – Mischen mit dem Mixer', 'Neapolitan – Gluten-Free Flour – Mixer Mixing', 'Neapolitanska – brezglutenska moka – mešanje z mešalnikom')
        : isTegliaGlutenFreeBeginnerHand || isNeapolitanGlutenFreeBeginnerHand
        ? pick('Neapolitan – Glutenfreies Mehl – Handmischung', 'Neapolitan – Gluten-Free Flour – Hand Mixing', 'Neapel – brezglutenska moka – ročno mešanje')
        : isNeapolitanWholeWheatBeginnerHand
        ? pick('Phase A: Vorbereitung und Handmischung', 'Phase A: Preparation and Hand Mixing', 'Faza A: Priprava in ročno mešanje')
        : isTegliaManitobaBeginnerHand
        ? pick('Teglia Romana – Manitoba – Handmischung', 'Teglia Romana – Manitoba – Hand Mixing', 'Teglia Romana – Manitoba – Ročno mešanje')
        : isTegliaManitobaBeginnerMixer
        ? pick('Teglia Romana – Manitoba – Mischen mit dem Mixer', 'Teglia Romana – Manitoba – Mixer Mixing', 'Teglia Romana – Manitoba – Mešanje z mešalnikom')
        : isTegliaSpeltBeginnerHand
        ? pick('Teglia Romana – Dinkel – Handmischung', 'Teglia Romana – Spelt – Hand Mixing', 'Teglia Romana – Pira – Ročno mešanje')
        : isTegliaSpeltBeginnerMixer
        ? pick('Teglia Romana – Dinkel – Mischen mit dem Mixer', 'Teglia Romana – Spelt – Mixer Mixing', 'Teglia Romana – Pira – Mešanje z mešalnikom')
        : isTegliaWholeWheatBeginnerHand
        ? pick('Teglia Romana – Vollkornmehl – Handmischung', 'Teglia Romana – Whole Wheat Flour – Hand Mixing', 'Teglia Romana – Polnozrnata moka – Ročno mešanje')
        : isTegliaWholeWheatBeginnerMixer
        ? pick('Teglia Romana – Vollkornmehl – Mischen mit dem Mixer', 'Teglia Romana – Whole Wheat Flour – Mixer Mixing', 'Teglia Romana – Polnozrnata moka – Mešanje z mešalnikom')
        : isTegliaTipo00BeginnerHand
        ? pick('Teglia Romana – Tipo 00 – Handmischung', 'Teglia Romana – Tipo 00 – Hand Mixing', 'Teglia Romana – Tipo 00 – Ročno mešanje')
        : isTegliaTipo00BeginnerMixer
        ? pick('Teglia Romana – Tipo 00 – Mischen mit dem Mixer', 'Teglia Romana – Tipo 00 – Mixer Mixing', 'Teglia Romana – Tipo 00 – Mešanje z mešalnikom')
        : hand
        ? pick('Phase A: Vorbereitung und Handmischung', 'Phase A: Preparation and Hand Mixing', 'Faza A: Priprava in ročno mešanje')
        : pick('Phase A: Vorbereitung und Mischen mit dem Mixer', 'Phase A: Preparation and Mixer Mixing', 'Faza A: Priprava in mešanje z mešalnikom'),
      waterInfo: isTegliaGlutenFreeBeginnerMixer || isTegliaGlutenFreeBeginnerHand || isNeapolitanGlutenFreeBeginnerMixer || isNeapolitanGlutenFreeBeginnerHand
        ? pick(
            'ⓘ Wassertemperatur\n\nVerwenden Sie kaltes Wasser.',
            'ⓘ Water temperature\n\nUse cold water.',
            'ⓘ Temperatura vode\n\nUporabite hladno vodo.',
          )
        : isTegliaCustomBeginnerHand || isTegliaCustomBeginnerMixer || isTegliaTipo00BeginnerHand || isTegliaTipo00BeginnerMixer || isTegliaManitobaBeginnerHand || isTegliaManitobaBeginnerMixer || isTegliaSpeltBeginnerHand || isTegliaSpeltBeginnerMixer || isTegliaWholeWheatBeginnerHand || isTegliaWholeWheatBeginnerMixer
        ? pick(
            `ⓘ Wassertemperatur\n\nEmpfohlene Wassertemperatur: ${waterTemperature ?? 24} °C\n\nDie Temperatur wird automatisch anhand der Bedingungen Ihres Rezepts berechnet.`,
            `ⓘ Water temperature\n\nRecommended water temperature: ${waterTemperature ?? 24} °C\n\nThe temperature is calculated automatically from your recipe conditions.`,
            `ⓘ Temperatura vode\n\nPriporočena temperatura vode: ${waterTemperature ?? 24} °C\n\nTemperatura se samodejno izračuna glede na pogoje vašega recepta.`,
          )
        : isNeapolitanBeginner
        ? pick(
            `Empfohlene Wassertemperatur: ${waterTemperature ?? 24} °C. Zieltemperatur des fertigen Teigs: ${targetFinalDoughTemp ?? 24} °C. Genaues Wiegen hält das Rezeptverhältnis ein; die Endtemperatur beeinflusst die Fermentationsgeschwindigkeit. Verwenden Sie insgesamt ${ingredients.water} g Wasser.`,
            `Recommended water temperature: ${waterTemperature ?? 24} °C. Target final dough temperature: ${targetFinalDoughTemp ?? 24} °C. Precise weighing preserves the recipe ratio, and final dough temperature affects fermentation speed. Use ${ingredients.water} g total water.`,
            `Priporočena temperatura vode: ${waterTemperature ?? 24} °C. Ciljna končna temperatura testa: ${targetFinalDoughTemp ?? 24} °C. Natančno tehtanje ohrani razmerje recepta, končna temperatura pa vpliva na hitrost fermentacije. Uporabite skupno ${ingredients.water} g vode.`,
          )
        : pick(
            `Die ideale Wassertemperatur beträgt 18–20 °C. Das empfohlene Verhältnis für dieses Rezept beträgt ungefähr ${Math.round((idealWater / ingredients.water) * 100)}% Wasser (${idealWater} g) und ${Math.round((idealIce / ingredients.water) * 100)}% Eis (${idealIce} g). Das Eis wird zur Gesamtwassermenge gerechnet.`,
            `The ideal water temperature is 18–20 °C. The recommended ratio for this recipe is approximately ${Math.round((idealWater / ingredients.water) * 100)}% water (${idealWater} g) and ${Math.round((idealIce / ingredients.water) * 100)}% ice (${idealIce} g). Ice is included in the total water amount.`,
            `Idealna temperatura vode je 18–20 °C. Priporočeno razmerje za ta recept je približno ${Math.round((idealWater / ingredients.water) * 100)}% vode (${idealWater} g) in ${Math.round((idealIce / ingredients.water) * 100)}% ledu (${idealIce} g). Led se všteva v skupno količino vode.`,
          ),
      doughHandlingInfo: isTegliaManitobaBeginnerHand || isTegliaManitobaBeginnerMixer || isTegliaTipo00BeginnerHand || isTegliaTipo00BeginnerMixer
        ? isTegliaManitobaBeginnerHand ? approvedManitobaTegliaHandPhaseAInfo : isTegliaManitobaBeginnerMixer ? approvedManitobaTegliaMixerPhaseAInfo : (isTegliaTipo00BeginnerHand ? approvedTegliaHandPhaseAInfo : approvedTegliaMixerPhaseAInfo)
        : isTegliaSpeltBeginnerHand ? approvedSpeltTegliaHandPhaseAInfo : isTegliaSpeltBeginnerMixer ? approvedSpeltTegliaMixerPhaseAInfo
        : isTegliaWholeWheatBeginnerHand ? approvedWholeWheatTegliaHandPhaseAInfo : isTegliaWholeWheatBeginnerMixer ? approvedWholeWheatTegliaMixerPhaseAInfo
        : isNeapolitanCustomBeginnerMixer
        ? pick(
            'ⓘ Mischen von Teig mit dem Mixer\n\nDas Mischen dauert gewöhnlich etwa 8–10 Minuten, aber orientieren Sie sich am Zustand des Teigs. Beenden Sie das Mischen, wenn der Teig glatt, verbunden und elastisch ist.\n\nDa die Teigeigenschaften von den verwendeten Mehlen in der Mischung abhängen, kann die benötigte Zeit zum Verbinden des Teigs variieren.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, stoppen Sie den Mixer, decken Sie den Teig ab und lassen Sie ihn etwa 10 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Greifen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und legen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
            'ⓘ Mixing dough with a mixer\n\nMixing usually takes about 8–10 minutes, but follow the state of the dough. Finish when the dough is smooth, cohesive, and elastic.\n\nBecause dough properties depend on the flours used in the blend, the time needed for the dough to come together properly may vary.\n\nIf the dough becomes too sticky and difficult to work with, stop the mixer, cover the dough, and let it rest for about 10 minutes. After resting, perform a few gentle Stretch & Fold folds.\n\nStretch & Fold: Grab one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
            'ⓘ Mešanje testa z mešalnikom\n\nMešanje običajno traja približno 8–10 minut, vendar se ravnajte po stanju testa. Končajte, ko je testo gladko, povezano in elastično.\n\nKer so lastnosti testa odvisne od mok, uporabljenih v mešanici, se lahko čas, potreben za pravilno povezovanje testa, razlikuje.\n\nČe testo postane preveč lepljivo in težko za delo, ustavite mešalnik, testo pokrijte in pustite počivati približno 10 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: Primite rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
          )
        : isNeapolitanCustomBeginnerHand
        ? pick(
            'ⓘ Handmischen des Teigs\n\nDas Mischen dauert gewöhnlich etwa 10 Minuten, aber orientieren Sie sich am Zustand des Teigs. Beenden Sie das Mischen, wenn der Teig glatt, verbunden und elastisch ist.\n\nDa die Teigeigenschaften von den verwendeten Mehlen in der Mischung abhängen, kann die benötigte Zeit zum Verbinden des Teigs variieren.\n\nWenn der Teig zu klebrig und schwer zu bearbeiten wird, decken Sie ihn ab und lassen Sie ihn etwa 20 Minuten ruhen. Führen Sie danach einige sanfte Stretch-&-Fold-Faltungen durch.\n\nStretch & Fold: Greifen Sie einen Rand des Teigs, ziehen Sie ihn vorsichtig nach oben und legen Sie ihn über die Mitte. Drehen Sie den Teig und wiederholen Sie dies an allen Seiten.',
            'ⓘ Hand mixing dough\n\nMixing usually takes about 10 minutes, but follow the state of the dough. Finish when the dough is smooth, cohesive, and elastic.\n\nBecause dough properties depend on the flours used in the blend, the time needed for the dough to come together properly may vary.\n\nIf the dough becomes too sticky and difficult to work with, cover it and let it rest for about 20 minutes. After resting, perform a few gentle Stretch & Fold folds.\n\nStretch & Fold: Grab one edge of the dough, gently stretch it upward, and fold it over the center. Turn the dough and repeat on all sides.',
            'ⓘ Ročno mešanje testa\n\nMešanje običajno traja približno 10 minut, vendar se ravnajte po stanju testa. Končajte, ko je testo gladko, povezano in elastično.\n\nKer so lastnosti testa odvisne od mok, uporabljenih v mešanici, se lahko čas, potreben za pravilno povezovanje testa, razlikuje.\n\nČe testo postane preveč lepljivo in težko za delo, ga pokrijte in pustite počivati približno 20 minut. Po počitku naredite nekaj nežnih prepogibov Stretch & Fold.\n\nStretch & Fold: Primite rob testa, ga nežno raztegnite navzgor in prepognite čez sredino. Testo obrnite in ponovite na vseh straneh.',
          )
        : isNeapolitanGlutenFreeBeginnerMixer
        ? pick(
            'ⓘ Mischen von glutenfreiem Teig mit dem Mixer\n\nGlutenfreier Teig entwickelt kein klassisches Glutennetz. Deshalb muss er nicht lange oder intensiv gemischt werden und es muss keine Elastizität wie bei herkömmlichem Teig entwickelt werden.\n\nDas Ziel ist, die Zutaten gleichmäßig zu verbinden. Der Teig wird weicher und klebriger sein als herkömmlicher Pizzateig.\n\nErhöhen Sie die Geschwindigkeit nicht und verlängern Sie das Mischen nicht nur, weil der Teig klebrig bleibt. Fügen Sie auch kein zusätzliches Mehl hinzu. Psyllium bindet während der abschließenden Ruhezeit weiterhin Wasser und verleiht dem Teig eine festere Struktur.',
            'ⓘ Mixing gluten-free dough with a mixer\n\nGluten-free dough does not develop a classic gluten network, so it does not need to be mixed for a long time or intensely, and there is no need to develop elasticity like conventional dough.\n\nThe goal is to combine the ingredients evenly. The dough will be softer and stickier than conventional pizza dough.\n\nDo not increase the speed or extend the mixing just because the dough remains sticky. Do not add extra flour either. Psyllium will continue binding water during the final rest and give the dough a firmer structure.',
            'ⓘ Mešanje brezglutenskega testa z mešalnikom\n\nBrezglutensko testo ne razvije klasične glutenske mreže, zato ga ni treba dolgo ali intenzivno mešati niti poskušati doseči elastičnost kot pri klasičnem testu.\n\nCilj je enakomerno povezati sestavine. Testo bo mehkejše in lepljivejše od klasičnega testa za pico.\n\nNe povečujte hitrosti in ne podaljšujte mešanja samo zato, ker testo ostaja lepljivo. Prav tako ne dodajajte dodatne moke. Psilium bo med končnim počitkom še naprej vezal vodo in testu dal čvrstejšo strukturo.',
          )
        : isNeapolitanGlutenFreeBeginnerHand
        ? pick(
            'Glutenfreier Teig entwickelt kein klassisches Glutennetz. Deshalb muss er nicht lange geknetet werden und es muss keine Elastizität wie bei herkömmlichem Teig entwickelt werden.\n\nDas Ziel ist, die Zutaten gleichmäßig zu verbinden. Der Teig wird weicher und klebriger sein als herkömmlicher Pizzateig.\n\nFügen Sie nicht einfach zusätzliches Mehl hinzu, nur weil der Teig klebrig ist. Psyllium bindet während der abschließenden Ruhezeit weiterhin Wasser und verleiht dem Teig eine festere Struktur.',
            'Gluten-free dough does not develop a classic gluten network, so it does not need long kneading or an attempt to develop elasticity like conventional dough.\n\nThe goal is to combine the ingredients evenly. The dough will be softer and stickier than conventional pizza dough.\n\nDo not add extra flour just because the dough is sticky. Psyllium will continue binding water during the final rest and give the dough a firmer structure.',
            'Brezglutensko testo ne razvije klasične glutenske mreže, zato ga ni treba dolgo gnesti ali poskušati doseči elastičnost kot pri klasičnem testu.\n\nCilj je enakomerno povezati sestavine. Testo bo mehkejše in lepljivejše od klasičnega testa za pico.\n\nNe dodajajte dodatne moke samo zato, ker je testo lepljivo. Psilium bo med končnim počitkom še naprej vezal vodo in testu dal čvrstejšo strukturo.',
          )
        : isNeapolitanWholeWheatBeginnerMixer
        ? approvedWholeWheatMixerPhaseAInfo
        : isNeapolitanWholeWheatBeginnerHand
        ? approvedWholeWheatHandPhaseAInfo
        : isNeapolitanTipo00BeginnerMixer
        ? approvedMixerPhaseAInfo
        : isNeapolitanSpeltBeginnerMixer
        ? approvedSpeltMixerPhaseAInfo
        : isNeapolitanSpeltBeginnerHand
        ? approvedSpeltHandPhaseAInfo
        : isNeapolitanManitobaBeginnerMixer
        ? approvedManitobaMixerPhaseAInfo
        : isNeapolitanManitobaBeginnerHand
        ? approvedManitobaHandPhaseAInfo
        : isNeapolitanTipo00BeginnerHand
        ? approvedHandPhaseAInfo
        : isGlutenFree
        ? pick(
            'Glutenfreier Teig entwickelt kein klassisches Gluten. Verwenden Sie Psyllium und mischen Sie nur kurz, bis eine homogene, klebrige Masse entsteht.',
            'Gluten-free dough does not develop traditional gluten. Use psyllium and mix only until a homogeneous, sticky mass forms.',
            'Brezglutensko testo ne razvije klasičnega glutena. Uporabite psilium in mešajte le toliko časa, da nastane homogena, lepljiva masa.',
          )
        : isWholeWheat
          ? pick(
              'Vollkornteig kann klebrig sein und nimmt Wasser langsam auf. Fügen Sie nicht automatisch Mehl hinzu und behandeln Sie ihn sanft.',
              'Whole-wheat dough may be sticky and absorbs water slowly. Do not automatically add flour and handle it gently.',
              'Polnozrnato testo je lahko lepljivo in vodo vpija počasi. Ne dodajajte samodejno moke in ravnajte z njim nežno.',
            )
          : isSpelt
            ? pick(
                'Dinkelteig hat ein empfindlicheres Gluten. Kneten Sie kürzer und sanfter und fügen Sie nicht automatisch Mehl hinzu.',
                'Spelt dough has more delicate gluten. Knead briefly and gently, and do not automatically add flour.',
                'Pirino testo ima občutljivejši gluten. Gnetite krajše in nežneje ter ne dodajajte samodejno moke.',
              )
            : isNeapolitanBeginner
              ? pick(
                  'Genaues Wiegen hält das Rezeptverhältnis ein. Die Zieltemperatur des fertigen Teigs beeinflusst die Fermentationsgeschwindigkeit; hören Sie früher auf, wenn der Teig zu warm wird.',
                  'Precise weighing preserves the recipe ratio. Target final dough temperature affects fermentation speed; stop earlier if the dough overheats.',
                  'Natančno tehtanje ohrani razmerje recepta. Ciljna končna temperatura vpliva na hitrost fermentacije; prenehajte prej, če se testo pregreva.',
                )
              : pick(
                  'Bei hoher Hydration kann der Teig klebrig sein. Nicht automatisch Mehl hinzufügen. Ölen oder befeuchten Sie Ihre Hände leicht und lassen Sie den Teig einige Minuten entspannen. Fahren Sie danach mit dem nächsten Rezeptschritt fort.',
                  'With high hydration, the dough may be sticky. Do not automatically add flour. Lightly oil or wet your hands and let the dough relax for a few minutes. Then continue with the next Recipe step.',
                  'Pri visoki hidraciji je lahko testo lepljivo. Ne dodajajte samodejno moke. Roke rahlo naoljite ali navlažite in testo nekaj minut pustite, da se sprosti. Nato nadaljujte z naslednjim korakom recepta.',
                ),
      steps: (isTegliaCustomBeginnerHand || isTegliaTipo00BeginnerHand || isTegliaManitobaBeginnerHand || isTegliaSpeltBeginnerHand || isTegliaWholeWheatBeginnerHand) ? [
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 80 % des Wassers, also ${tegliaInitialWater} g, auf.`, `Dissolve the yeast in approximately 80% of the water, or ${tegliaInitialWater} g.`, `V približno 80 % vode oziroma ${tegliaInitialWater} g vode raztopite kvas.`),
        pick('Geben Sie das Mehl in das Hefewasser und mischen Sie von Hand, bis die Zutaten verbunden sind.', 'Add the flour to the yeast water and mix by hand until the ingredients come together.', 'Dodajte moko v vodo s kvasom in ročno mešajte, dokler se sestavine ne povežejo.'),
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie eine große Schüssel zum Mischen vor.', 'Prepare a large mixing bowl.', 'Pripravite veliko posodo za mešanje.'),
        pick(`Geben Sie nach und nach in mehreren kleinen Zugaben die restlichen 20 % Wasser, also ${tegliaRemainingWater} g, hinzu.`, `Gradually add the remaining 20% of the water, or ${tegliaRemainingWater} g, in several small additions.`, `Postopoma v več manjših dodajanjih dodajte preostalih 20 % vode oziroma ${tegliaRemainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Kneten Sie, bis der Teig glatt, verbunden und elastisch ist.', 'Knead until the dough is smooth, cohesive, and elastic.', 'Gnetite, dokler testo ni gladko, povezano in elastično.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie vorsichtig, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and knead gently until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in nežno gnetite, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in pustite počivati 5 minut.'),
      ] : (isTegliaCustomBeginnerMixer || isTegliaTipo00BeginnerMixer || isTegliaManitobaBeginnerMixer || isTegliaSpeltBeginnerMixer || isTegliaWholeWheatBeginnerMixer) ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie den Mixer und die Schüssel zum Mischen vor.', 'Prepare the mixer and mixing bowl.', 'Pripravite mešalnik in posodo za mešanje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 80 % des Wassers, also ${tegliaInitialWater} g, auf.`, `Dissolve the yeast in approximately 80% of the water, or ${tegliaInitialWater} g.`, `V približno 80 % vode oziroma ${tegliaInitialWater} g vode raztopite kvas.`),
        pick('Gießen Sie das Hefewasser in die Mixerschüssel, geben Sie das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis die Zutaten verbunden sind.', 'Pour the yeast water into the mixer bowl, add the flour, and mix at low speed until the ingredients come together.', 'Vodo s kvasom vlijte v posodo mešalnika, dodajte moko in mešajte pri nizki hitrosti, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie nach und nach in mehreren kleinen Zugaben die restlichen 20 % Wasser, also ${tegliaRemainingWater} g, hinzu.`, `Gradually add the remaining 20% of the water, or ${tegliaRemainingWater} g, in several small additions.`, `Postopoma v več manjših dodajanjih dodajte preostalih 20 % vode oziroma ${tegliaRemainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie bei niedriger bis mittlerer Geschwindigkeit weiter, bis der Teig glatt, verbunden und elastisch ist.', 'Continue mixing at low to medium speed until the dough is smooth, cohesive, and elastic.', 'Nadaljujte z mešanjem pri nizki do srednji hitrosti, dokler testo ni gladko, povezano in elastično.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie kurz bei niedriger Geschwindigkeit weiter, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and continue briefly at low speed until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in kratek čas nadaljujte pri nizki hitrosti, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in pustite počivati 5 minut.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 80 % des Wassers, also ${tegliaInitialWater} g, auf.`, `Dissolve the yeast in approximately 80% of the water, or ${tegliaInitialWater} g.`, `V približno 80 % vode oziroma ${tegliaInitialWater} g vode raztopite kvas.`),
        pick('Geben Sie das Mehl in das Hefewasser und mischen Sie von Hand, bis die Zutaten verbunden sind.', 'Add the flour to the yeast water and mix by hand until the ingredients come together.', 'Dodajte moko v vodo s kvasom in ročno mešajte, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie nach und nach in mehreren kleinen Zugaben die restlichen 20 % Wasser, also ${tegliaRemainingWater} g, hinzu. Verbinden Sie jeden Teil des Wassers gut mit dem Teig, bevor Sie den nächsten hinzufügen.`, `Gradually add the remaining 20% of the water, or ${tegliaRemainingWater} g, in several small additions. Incorporate each part of the water well into the dough before adding the next.`, `Postopoma v več manjših dodajanjih dodajte preostalih 20 % vode oziroma ${tegliaRemainingWater} g. Vsak del vode dobro povežite s testom, preden dodate naslednjega.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Kneten Sie, bis der Teig verbunden, glatt und fest genug ist, um seine Struktur zu halten.', 'Knead until the dough is cohesive, smooth, and firm enough to hold its structure.', 'Gnetite, dokler testo ni povezano, gladko in dovolj čvrsto, da ohrani strukturo.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie vorsichtig, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and knead gently until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in nežno gnetite, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in pustite počivati 5 minut.'),
      ] : (isTegliaTipo00BeginnerMixer || isTegliaManitobaBeginnerMixer || isTegliaSpeltBeginnerMixer || isTegliaWholeWheatBeginnerMixer) ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie den Mixer und die Schüssel zum Mischen vor.', 'Prepare the mixer and mixing bowl.', 'Pripravite mešalnik in posodo za mešanje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 80 % des Wassers, also ${tegliaInitialWater} g, auf.`, `Dissolve the yeast in approximately 80% of the water, or ${tegliaInitialWater} g.`, `V približno 80 % vode oziroma ${tegliaInitialWater} g vode raztopite kvas.`),
        pick('Gießen Sie das Hefewasser in die Mixerschüssel, geben Sie das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis die Zutaten verbunden sind.', 'Pour the yeast water into the mixer bowl, add the flour, and mix at low speed until the ingredients come together.', 'Vodo s kvasom vlijte v posodo mešalnika, dodajte moko in mešajte pri nizki hitrosti, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie nach und nach in mehreren kleinen Zugaben die restlichen 20 % Wasser, also ${tegliaRemainingWater} g, hinzu. Lassen Sie jeden Teil des Wassers mit dem Teig verbinden, bevor Sie den nächsten hinzufügen.`, `Gradually add the remaining 20% of the water, or ${tegliaRemainingWater} g, in several small additions. Let each part of the water incorporate into the dough before adding the next.`, `Postopoma v več manjših dodajanjih dodajte preostalih 20 % vode oziroma ${tegliaRemainingWater} g. Vsak del vode naj se poveže s testom, preden dodate naslednjega.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie bei niedriger bis mittlerer Geschwindigkeit weiter, bis der Teig verbunden, glatt und fest genug ist, um seine Struktur zu halten.', 'Continue mixing at low to medium speed until the dough is cohesive, smooth, and firm enough to hold its structure.', 'Nadaljujte z mešanjem pri nizki do srednji hitrosti, dokler testo ni povezano, gladko in dovolj čvrsto, da ohrani strukturo.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie kurz bei niedriger Geschwindigkeit weiter, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and continue mixing briefly at low speed until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in kratek čas nadaljujte z mešanjem pri nizki hitrosti, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in pustite počivati 5 minut.'),
      ] : isNeapolitanCustomBeginnerHand ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie eine große Rührschüssel vor.', 'Prepare a large mixing bowl.', 'Pripravite veliko posodo za mešanje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `V približno 90 % vode oziroma ${initialWater} g vode raztopite kvas.`),
        pick('Geben Sie das Mehl in das Hefewasser und mischen Sie von Hand, bis die Zutaten verbunden sind.', 'Add the flour to the yeast water and mix by hand until the ingredients come together.', 'Dodajte moko v vodo s kvasom in ročno mešajte, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie nach und nach die restlichen 10 % Wasser, also ${remainingWater} g, hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Kneten Sie, bis der Teig glatt, verbunden und elastisch ist.', 'Knead until the dough is smooth, cohesive, and elastic.', 'Gnetite, dokler testo ni gladko, povezano in elastično.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie vorsichtig, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and knead gently until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in nežno gnetite, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in pustite počivati 5 minut.'),
      ] : isNeapolitanCustomBeginnerMixer ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie den Mixer und die Schüssel zum Mischen vor.', 'Prepare the mixer and mixing bowl.', 'Pripravite mešalnik in posodo za mešanje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `V približno 90 % vode oziroma ${initialWater} g vode raztopite kvas.`),
        pick('Gießen Sie das Hefewasser in die Mixerschüssel, geben Sie das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis die Zutaten verbunden sind.', 'Pour the yeast water into the mixer bowl, add the flour, and mix at low speed until the ingredients come together.', 'Vodo s kvasom vlijte v posodo mešalnika, dodajte moko in mešajte pri nizki hitrosti, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie nach und nach die restlichen 10 % Wasser, also ${remainingWater} g, hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie bei niedriger bis mittlerer Geschwindigkeit weiter, bis der Teig glatt, verbunden und elastisch ist.', 'Continue mixing at low to medium speed until the dough is smooth, cohesive, and elastic.', 'Nadaljujte z mešanjem pri nizki do srednji hitrosti, dokler testo ni gladko, povezano in elastično.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie kurz weiter, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and continue mixing briefly until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in kratek čas nadaljujte z mešanjem, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in pustite počivati 5 minut.'),
      ] : (isTegliaGlutenFreeBeginnerMixer || isNeapolitanGlutenFreeBeginnerMixer) ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie den Mixer und die Schüssel zum Mischen vor.', 'Prepare the mixer and mixing bowl.', 'Pripravite mešalnik in posodo za mešanje.'),
        pick(`Wiegen Sie ${ingredients.flour} g glutenfreies Mehl, ${psylliumAmount} g Flohsamenschalen, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g gluten-free flour, ${psylliumAmount} g psyllium husks, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g brezglutenske moke, ${psylliumAmount} g psiliuma, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Gießen Sie das gesamte Wasser, also ${ingredients.water} g, in die Mixerschüssel und lösen Sie darin die Hefe auf.`, `Pour all the water, or ${ingredients.water} g, into the mixer bowl and dissolve the yeast in it.`, `V posodo mešalnika vlijte vso vodo oziroma ${ingredients.water} g in v njej raztopite kvas.`),
        pick('Geben Sie das glutenfreie Mehl und die Flohsamenschalen hinzu und beginnen Sie, bei niedriger Geschwindigkeit zu mischen, bis keine trockenen Stellen mehr vorhanden sind.', 'Add the gluten-free flour and psyllium husks and start mixing at low speed until no dry parts remain.', 'Dodajte brezglutensko moko in psilium ter začnite mešati pri nizki hitrosti, dokler ne izginejo suhi deli.'),
        pick(`Wenn die Masse verbunden ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the mixture has come together, add ${ingredients.salt} g salt.`, `Ko je zmes povezana, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie bei niedriger Geschwindigkeit weiter, bis sich alle Zutaten zu einer homogenen, klebrigen Masse verbunden haben.', 'Continue mixing at low speed only until all ingredients come together into a homogeneous, sticky mass.', 'Nadaljujte z mešanjem pri nizki hitrosti samo toliko časa, da se vse sestavine povežejo v homogeno, lepljivo maso.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie kurz bei niedriger Geschwindigkeit weiter, bis es vollständig mit der Masse verbunden ist.`, `Add ${ingredients.oil} g olive oil and continue mixing briefly at low speed until it is fully incorporated into the mixture.`, `Dodajte ${ingredients.oil} g oljčnega olja in kratek čas nadaljujte z mešanjem pri nizki hitrosti, dokler se popolnoma ne vključi v zmes.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen, damit das Psyllium Wasser aufnehmen kann und der Teig die nötige Festigkeit erhält.', 'Cover the dough and let it rest for 5 minutes so the psyllium can absorb water and the dough can gain the required firmness.', 'Testo pokrijte in pustite počivati 5 minut, da psilium vpije vodo in testo dobi potrebno čvrstost.'),
      ] : (isTegliaGlutenFreeBeginnerHand || isNeapolitanGlutenFreeBeginnerHand) ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie eine große Schüssel zum Mischen vor.', 'Prepare a large mixing bowl.', 'Pripravite veliko posodo za mešanje.'),
        pick(`Wiegen Sie ${ingredients.flour} g glutenfreies Mehl, ${psylliumAmount} g Flohsamenschalen, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g gluten-free flour, ${psylliumAmount} g psyllium husks, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g brezglutenske moke, ${psylliumAmount} g psiliuma, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in der gesamten Wassermenge, also ${ingredients.water} g, auf.`, `Dissolve the yeast in all the water, or ${ingredients.water} g.`, `V vsej vodi oziroma ${ingredients.water} g vode raztopite kvas.`),
        pick('Geben Sie das glutenfreie Mehl und die Flohsamenschalen hinzu und mischen Sie von Hand oder mit einem Spatel, bis keine trockenen Stellen mehr vorhanden sind.', 'Add the gluten-free flour and psyllium husks and mix by hand or with a spatula until no dry parts remain.', 'Dodajte brezglutensko moko in psilium ter mešajte z roko ali lopatico, dokler ne izginejo suhi deli.'),
        pick(`Wenn die Masse verbunden ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the mixture has come together, add ${ingredients.salt} g salt.`, `Ko je zmes povezana, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie nur, bis sich alle Zutaten zu einer homogenen, klebrigen Masse verbunden haben.', 'Mix only until all ingredients come together into a homogeneous, sticky mass.', 'Mešajte le toliko časa, da se vse sestavine povežejo v homogeno, lepljivo maso.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie, bis es vollständig mit der Masse verbunden ist.`, `Add ${ingredients.oil} g olive oil and mix until it is fully incorporated into the mixture.`, `Dodajte ${ingredients.oil} g oljčnega olja in mešajte, dokler se popolnoma ne vključi v zmes.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen, damit das Psyllium Wasser aufnehmen kann und der Teig die nötige Festigkeit erhält.', 'Cover the dough and let it rest for 5 minutes so the psyllium can absorb water and the dough can gain the required firmness.', 'Testo pokrijte in pustite počivati 5 minut, da psilium vpije vodo in testo dobi potrebno čvrstost.'),
      ] : isNeapolitanWholeWheatBeginnerHand ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie eine große Schüssel zum Kneten vor.', 'Prepare a large mixing bowl.', 'Pripravite veliko posodo za gnetenje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Vollkornmehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g whole wheat flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g polnozrnate moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        pick('Geben Sie das Mehl in das Hefewasser und mischen Sie von Hand, bis die Zutaten verbunden sind.', 'Add the flour to the yeast water and mix by hand until the ingredients come together.', 'Dodajte moko v vodo s kvasom in ročno mešajte, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie nach und nach die restlichen 10 % Wasser, also ${remainingWater} g, hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Kneten Sie, bis der Teig verbunden und elastisch ist und seine Form halten kann.', 'Knead until the dough is cohesive and elastic and can hold its shape.', 'Gnetite, dokler testo ni povezano in elastično ter lahko ohrani obliko.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie vorsichtig, bis es vollständig aufgenommen ist.`, `Add ${ingredients.oil} g olive oil and knead gently until it is fully absorbed.`, `Dodajte ${ingredients.oil} g oljčnega olja in nežno gnetite, dokler se popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in ga pustite počivati 5 minut.'),
      ] : isNeapolitanWholeWheatBeginnerMixer ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie den Mixer und die Schüssel zum Kneten vor.', 'Prepare the mixer and its mixing bowl.', 'Pripravite mešalnik in posodo za gnetenje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Vollkornmehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g whole wheat flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g polnozrnate moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        pick('Gießen Sie das Hefewasser in die Mixerschüssel, geben Sie das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis die Zutaten verbunden sind.', 'Pour the yeast water into the mixer bowl, add the flour, and mix at low speed until the ingredients come together.', 'Vodo s kvasom vlijte v posodo mešalnika, dodajte moko in mešajte pri nizki hitrosti, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie nach und nach die restlichen 10 % Wasser, also ${remainingWater} g, hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie bei niedriger Geschwindigkeit weiter, bis der Teig verbunden und elastisch ist und seine Form halten kann.', 'Continue mixing at low speed until the dough is cohesive and elastic and can hold its shape.', 'Nadaljujte z mešanjem pri nizki hitrosti, dokler testo ni povezano in elastično ter lahko ohrani obliko.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie kurz bei niedriger Geschwindigkeit, bis der Teig es vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and mix briefly at low speed until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in na kratko mešajte pri nizki hitrosti, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in ga pustite počivati 5 minut.'),
      ] : isNeapolitanTipo00BeginnerHand ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie eine große Schüssel zum Kneten vor.', 'Prepare a large mixing bowl.', 'Pripravite veliko posodo za gnetenje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        pick('Geben Sie das Mehl zum Hefewasser und mischen Sie mit der Hand, bis die Zutaten verbunden sind.', 'Add the flour to the yeast water and mix by hand until the ingredients come together.', 'Moko dodajte v vodo s kvasom in mešajte z roko, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie die restlichen 10 % Wasser, also ${remainingWater} g, nach und nach hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Kneten Sie, bis der Teig glatt, verbunden und elastisch ist.', 'Knead until the dough is smooth, cohesive, and elastic.', 'Gnetite, dokler testo ni gladko, povezano in elastično.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie weiter, bis es vollständig aufgenommen ist.`, `Add ${ingredients.oil} g olive oil and continue kneading until it is fully absorbed.`, `Dodajte ${ingredients.oil} g oljčnega olja in nadaljujte z gnetenjem, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in ga pustite počivati 5 minut.'),
      ] : isNeapolitanSpeltBeginnerHand ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie eine große Schüssel zum Kneten vor.', 'Prepare a large mixing bowl.', 'Pripravite veliko posodo za gnetenje.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        pick('Geben Sie das Mehl in das Hefewasser und mischen Sie von Hand, bis die Zutaten verbunden sind.', 'Add the flour to the yeast water and mix by hand until the ingredients come together.', 'Dodajte moko v vodo s kvasom in ročno mešajte, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie die restlichen 10 % Wasser, also ${remainingWater} g, nach und nach hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Kneten Sie vorsichtig, bis der Teig verbunden, glatt und elastisch ist.', 'Gently knead until the dough is cohesive, smooth, and elastic.', 'Nežno gnetite, dokler testo ni povezano, gladko in elastično.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie vorsichtig weiter, bis der Teig es vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and continue kneading gently until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in nežno nadaljujte z gnetenjem, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in ga pustite počivati 5 minut.'),
      ] : isNeapolitanTipo00BeginnerMixer ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie den Mixer und seine Schüssel vor.', 'Prepare the mixer and its bowl.', 'Pripravite mešalnik in njegovo posodo.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        pick('Geben Sie das Hefewasser in die Mixerschüssel, fügen Sie das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis die Zutaten verbunden sind.', 'Pour the yeast water into the mixer bowl, add the flour, and mix on low speed until the ingredients come together.', 'Vodo s kvasom vlijte v posodo mešalnika, dodajte moko in mešajte pri nizki hitrosti, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie die restlichen 10 % Wasser, also ${remainingWater} g, nach und nach hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie bei niedriger bis mittlerer Geschwindigkeit, bis der Teig glatt, verbunden und elastisch ist.', 'Mix on low to medium speed until the dough is smooth, cohesive, and elastic.', 'Mešajte pri nizki do srednji hitrosti, dokler testo ni gladko, povezano in elastično.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie, bis der Teig es vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and mix until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in mešajte, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in ga pustite počivati 5 minut.'),
      ] : isNeapolitanSpeltBeginnerMixer ? [
         pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
         pick('Bereiten Sie den Mixer und seine Schüssel vor.', 'Prepare the mixer and its bowl.', 'Pripravite mešalnik in njegovo posodo.'),
         pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
         pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
         pick('Geben Sie das Hefewasser in die Mixerschüssel, fügen Sie das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis die Zutaten verbunden sind.', 'Pour the yeast water into the mixer bowl, add the flour, and mix on low speed until the ingredients come together.', 'Vodo s kvasom vlijte v posodo mešalnika, dodajte moko in mešajte pri nizki hitrosti, dokler se sestavine ne povežejo.'),
         pick(`Geben Sie die restlichen 10 % Wasser, also ${remainingWater} g, nach und nach hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
         pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
         pick('Mischen Sie bei niedriger Geschwindigkeit, bis der Teig verbunden, glatt und elastisch ist.', 'Mix on low speed until the dough is cohesive, smooth, and elastic.', 'Mešajte pri nizki hitrosti, dokler testo ni povezano, gladko in elastično.'),
         pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie kurz bei niedriger Geschwindigkeit, bis der Teig es vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and mix briefly on low speed until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in na kratko mešajte pri nizki hitrosti, dokler ga testo popolnoma ne vpije.`),
         pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in ga pustite počivati 5 minut.'),
      ] : isNeapolitanManitobaBeginnerMixer ? [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
        pick('Bereiten Sie den Mixer und seine Schüssel vor.', 'Prepare the mixer and its bowl.', 'Pripravite mešalnik in njegovo posodo.'),
        pick(`Wiegen Sie ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Hefe, ${ingredients.water} g Wasser und ${ingredients.oil} g Olivenöl ab.`, `Measure ${ingredients.flour} g flour, ${ingredients.salt} g salt, ${ingredients.yeast} g yeast, ${ingredients.water} g water, and ${ingredients.oil} g olive oil.`, `Odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g kvasa, ${ingredients.water} g vode in ${ingredients.oil} g oljčnega olja.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        pick('Geben Sie das Hefewasser in die Mixerschüssel, fügen Sie das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis die Zutaten verbunden sind.', 'Pour the yeast water into the mixer bowl, add the flour, and mix on low speed until the ingredients come together.', 'Vodo s kvasom vlijte v posodo mešalnika, dodajte moko in mešajte pri nizki hitrosti, dokler se sestavine ne povežejo.'),
        pick(`Geben Sie die restlichen 10 % Wasser, also ${remainingWater} g, nach und nach hinzu.`, `Gradually add the remaining 10% of the water, or ${remainingWater} g.`, `Postopoma dodajte preostalih 10 % vode oziroma ${remainingWater} g.`),
        pick(`Wenn das Wasser fast vollständig aufgenommen ist, geben Sie ${ingredients.salt} g Salz hinzu.`, `When the water is almost fully absorbed, add ${ingredients.salt} g salt.`, `Ko je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli.`),
        pick('Mischen Sie bei niedriger bis mittlerer Geschwindigkeit, bis der Teig glatt, verbunden und elastisch ist.', 'Mix on low to medium speed until the dough is smooth, cohesive, and elastic.', 'Mešajte pri nizki do srednji hitrosti, dokler testo ni gladko, povezano in elastično.'),
        pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie, bis der Teig es vollständig aufgenommen hat.`, `Add ${ingredients.oil} g olive oil and mix until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in mešajte, dokler ga testo popolnoma ne vpije.`),
        pick('Decken Sie den Teig ab und lassen Sie ihn 5 Minuten ruhen.', 'Cover the dough and let it rest for 5 minutes.', 'Testo pokrijte in ga pustite počivati 5 minut.'),
      ] : [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
          ...(!hand ? [pick('Bereiten Sie den Mixer und seine Schüssel vor.', 'Prepare the mixer and its bowl.', 'Pripravite mešalnik in njegovo posodo.')] : []),
        isGlutenFree
          ? pick(`Wiegen Sie genau ${ingredients.flour} g glutenfreies Mehl, ${psylliumAmount} g Flohsamenschalen (Psyllium), ${ingredients.salt} g Salz, ${ingredients.yeast} g Frischhefe und insgesamt ${ingredients.water} g Wasser ab.`, `Accurately measure ${ingredients.flour} g of gluten-free flour, ${psylliumAmount} g of psyllium husk, ${ingredients.salt} g of salt, ${ingredients.yeast} g of fresh yeast, and ${ingredients.water} g of total water.`, `Natančno odmerite ${ingredients.flour} g brezglutenske moke, ${psylliumAmount} g luskin trpotca (psyllium), ${ingredients.salt} g soli, ${ingredients.yeast} g svežega kvasa in skupno ${ingredients.water} g vode.`)
          : pick(
            `Sieben und wiegen Sie genau ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Frischhefe und insgesamt ${ingredients.water} g Wasser ab.`,
            `Sift and accurately measure ${ingredients.flour} g of flour, ${ingredients.salt} g of salt, ${ingredients.yeast} g of fresh yeast, and ${ingredients.water} g of total water.`,
            `Presejte in natančno odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g svežega kvasa in skupno ${ingredients.water} g vode.`,
          ),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        isGlutenFree
          ? (hand
            ? pick('Geben Sie glutenfreies Mehl und Psyllium zum Wasser mit der Hefe und mischen Sie mit der Hand oder einem Spatel, bis keine trockenen Stellen mehr vorhanden sind.', 'Add the gluten-free flour and psyllium to the yeast water and mix by hand or with a spatula until no dry flour remains.', 'Brezglutensko moko in psyllium dodajte v vodo s kvasom ter mešajte z roko ali lopatko, dokler ne izginejo suhi deli.')
            : pick('Geben Sie glutenfreies Mehl und Psyllium in die Mixerschüssel und mischen Sie nur bei niedrigster Geschwindigkeit, bis keine trockenen Stellen mehr vorhanden sind.', 'Add the gluten-free flour and psyllium to the mixer bowl and mix on the lowest speed only until no dry flour remains.', 'Brezglutensko moko in psyllium dodajte v posodo mešalnika in mešajte samo pri najnižji hitrosti, dokler ne izginejo suhi deli.'))
          : hand
          ? pick('Geben Sie das Mehl nach und nach zum Wasser mit der Hefe und mischen Sie es mit der Hand, bis keine trockenen Stellen mehr vorhanden sind.', 'Gradually add the flour to the water and yeast mixture and mix by hand until no dry flour remains.', 'Postopoma dodajajte moko v vodo s kvasom in mešajte z roko, dokler ne izginejo suhi deli.')
          : pick('Geben Sie das Wasser mit der aufgelösten Hefe in die Mixerschüssel, fügen Sie dann das Mehl hinzu und mischen Sie bei niedriger Geschwindigkeit, bis keine trockenen Stellen mehr vorhanden sind.', 'Pour the water with the dissolved yeast into the mixer bowl, then add the flour and mix on low speed until no dry flour remains.', 'Vodo z raztopljenim kvasom vlijte v posodo mešalnika, nato dodajte moko in mešajte pri nizki hitrosti, dokler ne izginejo suhi deli.'),
        pick(`Geben Sie die restlichen ${remainingWater} g Wasser nach und nach hinzu, nicht auf einmal.`, `Gradually add the remaining ${remainingWater} g of water, not all at once.`, `Postopoma dodajte preostalih ${remainingWater} g vode, ne vse naenkrat.`),
        pick(`Wenn der Teig verbunden ist und das Wasser fast vollständig aufgenommen wurde, geben Sie ${ingredients.salt} g Salz als separaten Schritt hinzu.`, `When the dough has come together and the water is almost fully absorbed, add ${ingredients.salt} g of salt as a separate step.`, `Ko je testo povezano in je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli kot ločen korak.`),
        isGlutenFree
          ? pick('Glutenfreier Teig wird nicht geknetet, um Gluten zu entwickeln; mischen Sie nur, bis sich alle Zutaten zu einer homogenen, klebrigen Masse verbinden.', 'Gluten-free dough is not kneaded to develop gluten; mix only until all ingredients form a homogeneous, sticky mass.', 'Brezglutensko testo se ne gnete za razvoj glutena; mešajte samo, dokler se vse sestavine ne povežejo v homogeno, lepljivo maso.')
          : isSpelt || isWholeWheat
          ? (hand
            ? pick('Kneten Sie kurz und sanft, nur bis der Teig verbunden und gleichmäßig ist; nicht überkneten.', 'Knead briefly and gently, only until the dough is combined and even; do not over-knead.', 'Gnetite kratko in nežno, samo dokler se testo ne poveže in postane enakomerno; ne pregnetite.')
            : pick('Mischen Sie bei niedriger bis mittlerer Geschwindigkeit nur kurz, bis der Teig verbunden und gleichmäßig ist; nicht übermischen.', 'Mix at low to medium speed only briefly, until the dough is combined and even; do not over-mix.', 'Mešajte kratko pri nizki do srednji hitrosti, samo dokler se testo ne poveže in postane enakomerno; ne premešajte.'))
          : hand
          ? isNeapolitanBeginner
            ? pick('Kneten Sie, bis der Teig glatt, elastisch und gut verbunden ist; hören Sie früher auf, wenn er zu warm wird.', 'Knead until the dough is smooth, elastic, and well connected; stop earlier if it overheats.', 'Gnetite, dokler testo ni gladko, elastično in povezano; prenehajte prej, če se pregreva.')
            : pick('Kneten Sie weiter, bis der Teig glatt, elastisch und gut verbunden ist.', 'Continue kneading until the dough becomes smooth, elastic, and well connected.', 'Nadaljujte z gnetenjem, dokler testo ne postane gladko, elastično in povezano.')
          : isNeapolitanBeginner
            ? pick('Mischen Sie zunächst bei niedriger, dann bei niedriger bis mittlerer Geschwindigkeit; hören Sie früher auf, wenn der Teig zu warm wird, und beenden Sie den Vorgang, wenn er glatt, verbunden und elastisch ist und sich angemessen von der Schüssel löst.', 'Mix first on low, then on low to medium speed; stop earlier if the dough overheats and finish when it is smooth, cohesive, and elastic and begins to pull away from the bowl appropriately.', 'Mešajte najprej pri nizki, nato pri nizki do srednji hitrosti; prenehajte prej, če se testo pregreva, in končajte, ko je gladko, povezano in elastično ter se začne primerno ločevati od posode.')
            : pick('Mischen Sie weiter, bis der Teig glatt, verbunden und elastisch wird und sich angemessen von der Schüssel löst.', 'Continue mixing until the dough becomes smooth, cohesive, and elastic and begins to pull away from the bowl appropriately.', 'Nadaljujte z mešanjem, dokler testo ne postane gladko, povezano in elastično ter se začne primerno ločevati od posode.'),
        ...(ingredients.oil > 0 ? [isGlutenFree
          ? pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie, bis es vollständig eingearbeitet ist.`, `Add ${ingredients.oil} g of olive oil and mix until it is fully incorporated.`, `Dodajte ${ingredients.oil} g oljčnega olja in mešajte, dokler se popolnoma ne vmeša.`)
          : hand
          ? pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g of olive oil and knead until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in gnetite, dokler ga testo popolnoma ne vpije.`)
          : pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g of olive oil and mix until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in mešajte, dokler ga testo popolnoma ne vpije.`)] : []),
        ...(isNeapolitanBeginner ? [pick(`Prüfen Sie, dass die Endtemperatur des Teigs ungefähr ${targetFinalDoughTemp ?? 24} °C beträgt.`, `Check that the final dough temperature is approximately ${targetFinalDoughTemp ?? 24} °C.`, `Preverite, da je končna temperatura testa približno ${targetFinalDoughTemp ?? 24} °C.`)] : []),
        ...(isGlutenFree || !beginnerMode ? [
          isGlutenFree
            ? pick('Das Mischen ist beendet, wenn die Masse gleichmäßig, glatt und klebrig ist.', 'Mixing is finished when the mass is even, smooth, and sticky.', 'Mešanje je končano, ko je masa enakomerna, gladka in lepljiva.')
            : pick('Der Teig ist fertig geknetet, wenn er glatt, elastisch und homogen ist.', 'The dough is fully mixed when it is smooth, elastic, and homogeneous.', 'Gnetenje je končano, ko je testo gladko, elastično in homogeno.'),
        ] : []),
        isGlutenFree
          ? (hand
            ? pick('Lassen Sie die Masse 5 Minuten ruhen, damit das Psyllium Feuchtigkeit bindet und Struktur gibt.', 'Let the mass rest for 5 minutes so the psyllium absorbs moisture and builds structure.', 'Maso pustite počivati 5 minut, da psyllium vpije vlago in da strukturo.')
            : pick('Lassen Sie die Masse 5 Minuten in der Mixerschüssel ruhen, damit das Psyllium Feuchtigkeit bindet und Struktur gibt.', 'Let the mass rest for 5 minutes in the mixer bowl so the psyllium absorbs moisture and builds structure.', 'Maso pustite počivati 5 minut v posodi mešalnika, da psyllium vpije vlago in da strukturo.'))
          : hand
          ? pick(`Lassen Sie den Teig ${mixRestLabel} ruhen.`, `Let the dough rest for ${mixRestLabel}.`, `Testo pustite počivati ${mixRestLabel}.`)
          : pick(`Lassen Sie den Teig ${mixRestLabel} in der Mixerschüssel ruhen.`, `Let the dough rest for ${mixRestLabel} in the mixer bowl.`, `Testo pustite počivati ${mixRestLabel} v posodi mešalnika.`),
      ],
      timers: isNeapolitanBeginner
        ? [
          timer('post-mix-rest', Math.round(mixRestMinutes * 60), 'rest'),
        ]
        : [timer('post-mix-rest', Math.round(mixRestMinutes * 60), 'rest')],
    },
    {
      title: isGlutenFree
        ? pick('Phase B: Kurze Ruhe', 'Phase B: Short Rest', 'Faza B: Kratek počitek')
        : pick('Phase B: Stockgare und Stretch & Fold', 'Phase B: Bulk Fermentation and Folds', 'Faza B: Prva fermentacija in pregibi'),
      fermentationInfo: pick(`Die Raumtemperatur beeinflusst die Geschwindigkeit der Fermentation. Im Sommer, wenn der Raum wärmer ist, wird die Stockgare verkürzt; im Winter, wenn es kühler ist, wird sie verlängert. Für die eingegebene Raumtemperatur von ${roomTemp} °C hat die App die Ruhezeit auf ungefähr ${bulkRestMinutes} Minuten angepasst.`, `Room temperature affects the speed of fermentation. In summer, when the room is warmer, bulk fermentation is shortened; in winter, when it is cooler, it is extended. For the entered room temperature of ${roomTemp} °C, the app has adjusted the resting time to approximately ${bulkRestMinutes} minutes.`, `Sobna temperatura vpliva na hitrost fermentacije. Poleti, ko je prostor toplejši, se prva fermentacija skrajša; pozimi, ko je hladneje, se podaljša. Za vneseno sobno temperaturo ${roomTemp} °C je aplikacija čas počitka prilagodila na približno ${bulkRestMinutes} minut.`),
      fermentationSignsInfo: pick('Achten Sie auf Anzeichen einer aktiven Fermentation: kleine Bläschen, eine leichte Volumenzunahme, eine glattere und leicht gespannte Oberfläche sowie eine elastischere und luftigere Teigstruktur.', 'Check for signs of active fermentation: small bubbles, a slight increase in volume, a smoother and slightly taut surface, and a more elastic and airy dough structure.', 'Preverite znake aktivne fermentacije: majhne mehurčke, rahlo povečanje prostornine, bolj gladko in rahlo napeto površino ter bolj elastično in zračno strukturo testa.'),
      containerOilInfo: pick('Verwenden Sie einen sauberen, lebensmittelechten Behälter, der groß genug ist, damit der Teig aufgehen kann. Decken Sie den Behälter mit einem Deckel oder einer Folie ab, verschließen Sie ihn jedoch nicht luftdicht: Bei der Fermentation entstehen Gase und der Behälter darf nicht unter Druck stehen. Sie können eine Kunststoffbox mit Deckel, eine Glasschüssel mit Folie, eine Teigwanne oder eine Gärbox mit nicht vollständig luftdichtem Deckel verwenden. Bestreichen Sie den Behälter nur leicht mit etwas Hilfsöl. Dieses Öl wird nicht in die Rezeptberechnung einbezogen und ist nicht dasselbe Öl wie das Öl im Teig.', 'Use a clean, food-safe container that is large enough for the dough to rise. Cover the container with a lid or plastic wrap, but do not seal it airtight: fermentation produces gases, and the container must not become pressurized. You can use a plastic container with a lid, a glass bowl covered with plastic wrap, a dough tub, or a fermentation box with a lid that is not completely airtight. Lightly coat the container with a small amount of auxiliary oil. This oil is not included in the recipe calculation and is not the same as the oil in the dough.', 'Uporabite čisto posodo, primerno za stik z živili, ki je dovolj velika, da lahko testo vzhaja. Posodo pokrijte s pokrovom ali folijo, vendar je ne zaprite nepredušno: pri fermentaciji nastajajo plini in posoda ne sme biti pod pritiskom. Uporabite lahko plastično posodo s pokrovom, stekleno skledo s folijo, posodo za testo ali fermentacijsko posodo s pokrovom, ki ni popolnoma neprepusten. Posodo rahlo premažite s pomožnim oljem. To olje ni vključeno v izračun recepta in ni isto kot olje v testu.'),
      steps: isGlutenFree ? [
        pick('Ölen Sie den Fermentationsbehälter leicht und geben Sie die Masse hinein.', 'Lightly oil the fermentation container and transfer the mixture into it.', 'Fermentacijsko posodo rahlo naoljite in vanjo prenesite maso.'),
        pick('Decken Sie den Behälter ab und lassen Sie die Masse 15 Minuten bei Raumtemperatur ruhen, bevor Sie sie teilen. Kein Stretch & Fold.', 'Cover the container and let the mixture rest for 15 minutes at room temperature before dividing. Do not do Stretch & Fold.', 'Posodo pokrijte in maso pred delitvijo 15 minut pustite pri sobni temperaturi. Ne izvajajte Stretch & Fold.'),
      ] : [
        pick('Ölen Sie den Fermentationsbehälter leicht und geben Sie den Teig hinein.', 'Lightly oil the fermentation container and transfer the dough into it.', 'Fermentacijsko posodo rahlo naoljite in vanjo prenesite testo.'),
        pick(`Decken Sie den Behälter ab und lassen Sie den Teig ${bulkRestMinutes} Minuten bei Raumtemperatur ruhen.`, `Cover the container and let the dough rest for ${bulkRestMinutes} minutes at room temperature.`, `Posodo pokrijte in testo pustite ${bulkRestMinutes} minut počivati pri sobni temperaturi.`),
        pick('Führen Sie das erste Stretch & Fold durch.', 'Perform the first Stretch & Fold.', 'Izvedite prvi Stretch & Fold.'),
        pick(`Lassen Sie den Teig erneut ${bulkRestMinutes} Minuten ruhen.`, `Let the dough rest for another ${bulkRestMinutes} minutes.`, `Testo ponovno pustite počivati ${bulkRestMinutes} minut.`),
        pick('Führen Sie das zweite Stretch & Fold durch.', 'Perform the second Stretch & Fold.', 'Izvedite drugi Stretch & Fold.'),
        pick(`Lassen Sie die abschließende Stockgare weitere ${bulkRestMinutes} Minuten bei Raumtemperatur laufen.`, `Let the dough complete its final bulk fermentation for another ${bulkRestMinutes} minutes at room temperature.`, `Končno prvo fermentacijo pustite potekati še ${bulkRestMinutes} minut pri sobni temperaturi.`),
        pick('Prüfen Sie, ob erste Anzeichen der Fermentation sichtbar sind.', 'Check whether the first signs of fermentation are visible.', 'Preverite, ali so vidni prvi znaki fermentacije.'),
      ],
      timers: isGlutenFree
        ? [timer('gluten-free-short-rest', 15 * 60, 'rt')]
        : [timer('bulk-rest-1', bulkRestMinutes * 60, 'rt'), timer('bulk-rest-2', bulkRestMinutes * 60, 'rt'), timer('bulk-final', bulkRestMinutes * 60, 'rt')],
    },
    {
      title: isRomanTeglia
        ? pick('Phase C: Teigmasse für das Blech', 'Phase C: Tray Dough Mass', 'Faza C: Masa za pekač')
        : pick('Phase C: Teilen und Ballen', 'Phase C: Dividing and Balling', 'Faza C: Delitev in oblikovanje kroglic'),
      degassingInfo: pick('Entgasen bedeutet, die während der Fermentation entstandenen Gase aus dem Teig zu entfernen.', 'Degassing means removing the gases produced in the dough during fermentation.', 'Degaziranje pomeni odstranjevanje plinov, ki so nastali v testu med fermentacijo.'),
      steps: isRomanTeglia ? [
        pick(`Bereiten Sie eine einzelne Teigmasse von ${totalDough} g für das Blech vor.`, `Prepare one ${totalDough} g dough mass for the tray.`, `Pripravite eno maso testa ${totalDough} g za pekač.`),
        pick('Formen Sie keine Teigkugeln; die Masse bleibt bis zum Einlegen in das Blech zusammen.', 'Do not shape dough balls; keep the dough as one mass until it goes into the tray.', 'Ne oblikujte kroglic; testo naj do prenosa v pekač ostane ena masa.'),
      ] : [
        isGlutenFree
          ? pick('Bestäuben Sie die Arbeitsfläche großzügig mit glutenfreiem oder Reismehl. Dieses Mehl wird nicht in die Rezeptberechnung einbezogen.', 'Generously dust the work surface with gluten-free or rice flour. This flour is not included in the recipe calculation.', 'Delovno površino obilno posujte z brezglutensko ali riževo moko. Ta moka ni vključena v izračun recepta.')
          : pick('Bestäuben Sie die Arbeitsfläche leicht mit Mehl. Das Mehl für die Arbeitsfläche wird nicht in die Rezeptberechnung einbezogen.', 'Lightly flour the work surface. Flour used for the work surface is not included in the recipe calculation.', 'Delovno površino rahlo posujte z moko. Moka za delovno površino ni vključena v izračun recepta.'),
        pick('Nehmen Sie den Teig vorsichtig aus dem Behälter und vermeiden Sie dabei möglichst starkes Entgasen.', 'Gently remove the dough from the container while minimizing degassing.', 'Testo nežno vzemite iz posode in pri tem čim manj iztisnite plin.'),
        pick(`Teilen Sie insgesamt ${totalDough} g Teig in Teiglinge mit jeweils ${ballWeight} g.`, `Divide a total of ${totalDough} g of dough into balls weighing ${ballWeight} g each.`, `Skupno ${totalDough} g testa razdelite na kroglice po ${ballWeight} g.`),
        pick(`Sie erhalten ungefähr ${ballCount} Teiglinge für ${pizzas} Pizzen.`, `You will get approximately ${ballCount} dough balls for ${pizzas} pizzas.`, `Dobili boste približno ${ballCount} kroglic za ${pizzas} pic.`),
        isGlutenFree
          ? pick('Formen Sie die Teiglinge mit bemehlten oder geölten Händen sanft zu Kugeln; die Masse bleibt weich und klebrig.', 'Shape the pieces into balls gently with floured or oiled hands; the dough stays soft and sticky.', 'Kose z pomokanimi ali naoljenimi rokami nežno oblikujte v kroglice; testo ostane mehko in lepljivo.')
          : pick('Formen Sie jedes Stück zu einer glatten und gespannten Teigkugel.', 'Shape each piece into a smooth and tight dough ball.', 'Vsak kos oblikujte v gladko in napeto kroglico.'),
      ],
    },
    {
      title: pick('Phase D: Kalte Fermentation', 'Phase D: Cold Fermentation', 'Faza D: Hladna fermentacija'),
      temperingInfo: isRomanTeglia
        ? pick('Temperieren bedeutet, dass die Teigmasse nach der kalten Fermentation aus dem Kühlschrank genommen und vor dem Einlegen in das Blech einige Zeit bei Raumtemperatur stehen gelassen wird.', 'Tempering means taking the dough mass out of the refrigerator after cold fermentation and leaving it at room temperature for some time before pressing it into the tray.', 'Temperiranje pomeni, da po hladni fermentaciji maso testa vzamete iz hladilnika in jo pred vtiskanjem v pekač nekaj časa pustite na sobni temperaturi.')
        : pick('Temperieren bedeutet, dass die Teigkugeln nach der kalten Fermentation aus dem Kühlschrank genommen und vor dem Ausformen und Backen einige Zeit bei Raumtemperatur stehen gelassen werden.', 'Tempering means taking the dough balls out of the refrigerator after cold fermentation and leaving them at room temperature for some time before stretching and baking.', 'Temperiranje pomeni, da po hladni fermentaciji kroglice testa vzamete iz hladilnika in jih pred raztezanjem in peko nekaj časa pustite na sobni temperaturi.'),
      containerOilInfo: isRomanTeglia
        ? pick('Bewahren Sie die Teigmasse in einem Behälter auf, der sie vor dem Austrocknen schützt, aber nicht luftdicht verschlossen ist.', 'Keep the dough mass in a container that protects it from drying out but is not sealed airtight.', 'Maso testa hranite v posodi, ki jo ščiti pred izsušitvijo, vendar ni nepredušno zaprta.')
        : pick('Bewahren Sie die Teigkugeln in einer Box auf, die sie vor dem Austrocknen schützt, aber nicht luftdicht verschlossen ist. Der Deckel sollte nur aufliegen oder eine Möglichkeit zum Druckausgleich bieten. Die Box darf nicht unter Druck stehen.', 'Keep the dough balls in a box that protects them from drying out but is not sealed airtight. The lid should simply rest on the box or allow pressure to escape. The box must not become pressurized.', 'Kroglice testa hranite v posodi, ki jih ščiti pred izsušitvijo, vendar ni nepredušno zaprta. Pokrov naj bo samo položen na posodo ali naj omogoča izhod plinov. Posoda ne sme biti pod pritiskom.'),
      steps: isRomanTeglia ? [
        pick('Legen Sie die Teigmasse in einen abgedeckten Behälter und stellen Sie sie in den Kühlschrank.', 'Place the dough mass in a covered container and transfer it to the refrigerator.', 'Maso testa položite v pokrito posodo in jo prestavite v hladilnik.'),
        pick(`Lassen Sie die Teigmasse ${coldFermentationDuration} bei ungefähr 4–6 °C im Kühlschrank fermentieren. Die Zeit der kalten Fermentation wird nur einmal berechnet.`, `Ferment the dough mass in the refrigerator for ${coldFermentationDuration} at approximately 4–6 °C. Cold fermentation time is counted only once.`, `Masa testa naj fermentira v hladilniku ${coldFermentationDuration} pri približno 4–6 °C. Čas hladne fermentacije se šteje samo enkrat.`),
        pick('Nach Ablauf der gewählten Zeit fahren Sie mit dem Temperieren und dem Einlegen in das Blech fort.', 'After the selected time has elapsed, continue with tempering and pressing the dough into the tray.', 'Po poteku izbranega časa nadaljujte s temperiranjem in vtiskanjem testa v pekač.'),
      ] : [
        pick('Legen Sie die Teigkugeln in eine verschlossene Teigbox und stellen Sie sie in den Kühlschrank.', 'Place the dough balls in a closed fermentation box and transfer them to the refrigerator.', 'Kroglice testa položite v zaprto fermentacijsko posodo in jih prestavite v hladilnik.'),
        pick(`Lassen Sie die Teigkugeln ${fridgeHours} Stunden bei ungefähr 4–6 °C im Kühlschrank fermentieren. Die Zeit der kalten Fermentation wird nur einmal berechnet.`, `Ferment the dough balls in the refrigerator for ${fridgeHours} hours at approximately 4–6 °C. Cold fermentation time is counted only once.`, `Kroglice naj fermentirajo v hladilniku ${fridgeHours} ur pri približno 4–6 °C. Čas hladne fermentacije se šteje samo enkrat.`),
        pick('Nach Ablauf der gewählten Zeit fahren Sie mit dem Temperieren fort.', 'After the selected time has elapsed, proceed to tempering.', 'Po poteku izbranega časa nadaljujte s temperiranjem.'),
      ],
      timers: [timer('cold-fermentation', fridgeHours * 3600, 'fridge')],
    },
    {
      title: isRomanTeglia
        ? pick('Phase E: In das Blech drücken und backen', 'Phase E: Pressing Into the Tray and Baking', 'Faza E: Vtiskovanje v pekač in peka')
        : variant === 'napolitana'
          ? pick('Phase E: Temperieren, Formen und Backen', 'Phase E: Tempering, Shaping and Baking', 'Faza E: Temperiranje, oblikovanje in peka')
          : pick('Phase E: Temperieren und Formen', 'Phase E: Tempering and Shaping', 'Faza E: Temperiranje in oblikovanje'),
      temperingInfo: isRomanTeglia
        ? pick(`Die Teigmasse wird nach ${coldFermentationDuration} aus dem Kühlschrank genommen und vor dem Einlegen in das Blech ${finalRoomDuration} bei Raumtemperatur entspannt.`, `After ${coldFermentationDuration} in the refrigerator, take the dough mass out and let it relax at room temperature for ${finalRoomDuration} before pressing it into the tray.`, `Po ${coldFermentationDuration} vzemite maso testa iz hladilnika in jo pred vtiskanjem v pekač ${finalRoomDuration} pustite počivati pri sobni temperaturi.`)
        : pick(`Die Temperierzeit wird automatisch an die Raumtemperatur von ${roomTemp} °C angepasst: ungefähr ${temperingMin}–${temperingMax} Minuten. Bei niedrigeren Temperaturen kann es 1–2 Stunden dauern. Achten Sie darauf, dass die Teigkugeln nicht überfermentieren.`, `Tempering time is automatically adjusted to the room temperature of ${roomTemp} °C: approximately ${temperingMin}–${temperingMax} minutes. At lower temperatures, it may take 1–2 hours. Make sure the dough balls do not over-ferment.`, `Čas temperiranja se samodejno prilagodi sobni temperaturi ${roomTemp} °C: približno ${temperingMin}–${temperingMax} minut. Pri nižjih temperaturah lahko traja 1–2 uri. Pazite, da kroglice ne fermentirajo preveč.`),
      proofingInfo: isRomanTeglia ? undefined : pick('Drücken Sie die Teigkugel leicht mit dem Finger. Wenn die Vertiefung langsam zurückfedert, ist sie bereit zum Formen; wenn sie sofort zurückfedert, braucht sie noch etwas Zeit.', 'Gently press the dough ball with your finger. If the indentation slowly springs back, it is ready for shaping; if it springs back immediately, it needs more time.', 'Kroglico rahlo pritisnite s prstom. Če se vdolbina počasi vrne, je pripravljena za oblikovanje; če se takoj vrne, potrebuje še nekaj časa.'),
      ovenTimingInfo: isRomanTeglia ? undefined : oven === 'ooni'
        ? pick(`Der Pizzaofen benötigt ungefähr ${ovenPreheatMin}–${ovenPreheatMax} Minuten zum Aufheizen. Damit die Aufheizzeit mit dem Temperieren der Teigkugeln abgestimmt ist, schalten Sie den Pizzaofen ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} Minuten vor dem Herausnehmen der Teigkugeln aus dem Kühlschrank ein.`, `The pizza oven needs approximately ${ovenPreheatMin}–${ovenPreheatMax} minutes to heat up. To coordinate the heating time with the tempering of the dough balls, turn on the pizza oven ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minutes before taking the dough balls out of the refrigerator.`, `Pizza pečica potrebuje približno ${ovenPreheatMin}–${ovenPreheatMax} minut, da se segreje. Za uskladitev časa segrevanja s temperiranjem kroglic vklopite pizza pečico ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minut, preden kroglice vzamete iz hladilnika.`)
        : pick(`Der Ofen benötigt ungefähr ${ovenPreheatMin}–${ovenPreheatMax} Minuten zum Aufheizen. Damit die Aufheizzeit mit dem Temperieren der Teigkugeln abgestimmt ist, schalten Sie den Ofen ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} Minuten vor dem Herausnehmen der Teigkugeln aus dem Kühlschrank ein.`, `The oven needs approximately ${ovenPreheatMin}–${ovenPreheatMax} minutes to heat up. To coordinate the oven heating time with the tempering of the dough balls, turn on the oven ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minutes before taking the dough balls out of the refrigerator.`, `Pečica potrebuje približno ${ovenPreheatMin}–${ovenPreheatMax} minut, da se segreje. Za uskladitev časa segrevanja pečice s temperiranjem kroglic pečico vklopite ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minut, preden kroglice vzamete iz hladilnika.`),
      bakingInfo: oven === 'homeStone' ? pick('Platzieren Sie den Pizzastein oder Pizzastahl als Ausgangsposition etwa zwei Einschubebenen unterhalb des oberen Heizelements. Wenn Oberseite oder Boden der Pizza zu schnell dunkel werden, passen Sie die Position an Ihren Ofen an.', 'As a starting position, place the pizza stone or steel about two rack positions below the upper heating element. If the top or bottom of the pizza darkens too quickly, adjust the position for your oven.', 'Kot izhodiščni položaj postavite kamen ali jeklo za pico približno dve ravni pod zgornji grelnik. Če se vrh ali dno pice prehitro zatemni, položaj prilagodite svoji pečici.') : undefined,
      bakingCheckInfo: oven === 'homePan' ? pick('Heben Sie den Pizzarand an und prüfen Sie, ob der Boden ausreichend gebacken und goldbraun ist.', 'Lift the pizza rim and check whether the bottom is sufficiently baked and golden brown.', 'Dvignite rob pice in preverite, ali je dno dovolj pečeno in zlato-rjavo.') : undefined,
      steps: isRomanTeglia ? [
        pick(`Heizen Sie den Ofen auf ${ovenTemp} °C vor.`, `Preheat the oven to ${ovenTemp} °C.`, `Pečico segrejte na ${ovenTemp} °C.`),
        tegliaTemperingStep,
        pick(`Ölen Sie das Blech ${trayDimensions.width}×${trayDimensions.length} cm leicht ein, geben Sie die Masse hinein und drücken Sie sie mit den Fingerspitzen bis zu den Rändern.`, `Lightly oil the ${trayDimensions.width}×${trayDimensions.length} cm tray, place the dough mass inside, and press it to the edges with your fingertips.`, `Pekač ${trayDimensions.width}×${trayDimensions.length} cm rahlo naoljite, položite vanj maso in jo s konicami prstov nežno potisnite do robov.`),
        pick('Geben Sie Sauce und Belag darauf und backen Sie die Pizza, bis Boden und Rand gut gebacken sind.', 'Add sauce and toppings, then bake until the bottom and rim are well baked.', 'Dodajte omako in nadev ter pecite, dokler dno in rob nista dobro pečena.'),
      ] : oven === 'homePan' ? [
        pick(`Nehmen Sie die Teigkugeln aus dem Kühlschrank und lassen Sie sie ${finalRoomDuration} vor dem Formen temperieren. Achten Sie darauf, dass die Teigkugeln nicht überfermentieren.`, `Take the dough balls out of the refrigerator and let them temper for ${finalRoomDuration} before shaping. Make sure the dough balls do not over-ferment.`, `Kroglice vzemite iz hladilnika in jih pred oblikovanjem pustite ${finalRoomDuration} temperirati. Pazite, da kroglice ne fermentirajo preveč.`),
        ...(!isGlutenFree ? [pick('Bestäuben Sie die Fläche leicht mit einer minimalen Menge Semola.', 'Lightly dust the surface with a minimal amount of semolina.', 'Površino rahlo posujte z minimalno količino zdroba.')] : []),
        pick('Nehmen Sie die Teigkugel mit einer schnellen und vorsichtigen Bewegung aus dem Behälter und legen Sie sie mit der Oberseite nach unten auf die Semola.', 'Quickly and gently remove the dough ball from the container and place it upside down on the semolina.', 'Kroglico hitro in nežno vzemite iz posode ter jo položite obrnjeno na zdrob.'),
        isRomanTonda ? pick('Formen Sie die Romana Tonda dünn und flach durch Drücken mit den Fingern oder mit dem Nudelholz; dehnen Sie sie nicht aggressiv in der Luft.', 'Shape the Romana Tonda thin and flat by pressing with your fingers or using a rolling pin; do not stretch it aggressively in the air.', 'Romano Tondo oblikujte tanko in ravno s pritiskanjem prstov ali z valjarjem; ne raztezajte je agresivno v zraku.') : pick('Drücken Sie mit den Fingerspitzen die Luft von der Mitte in Richtung Rand. Verwenden Sie kein Nudelholz.', 'Using your fingertips, push the air from the center toward the edges. Do not use a rolling pin.', 'S konicami prstov potiskajte zrak iz sredine proti robovom. Ne uporabljajte valjarja.'),
        pick('Fetten Sie das Backblech leicht ein.', 'Lightly oil the baking tray.', 'Pekač rahlo naoljite.'),
        pick(`Legen Sie den geformten Teig direkt auf das Backblech und ziehen Sie ihn auf den Zieldurchmesser von ${diameter} cm.`, `Place the shaped dough directly in the baking tray and stretch it to the target diameter of ${diameter} cm.`, `Oblikovano testo položite neposredno v pekač in ga raztegnite na ciljni premer ${diameter} cm.`),
        ...(!isRomanTonda && !isNewYork ? [pick('Lassen Sie den Cornicione als optische Orientierung ungefähr 1–2 cm breit.', 'Leave approximately 1–2 cm of Cornicione as a visual guideline.', 'Rob Cornicione pustite približno 1–2 cm širok kot vizualno priporočilo.')] : []),
        pick('Lassen Sie den Teig im Backblech kurz entspannen und sich an die Form anpassen, falls er sich zurückzieht.', 'Let the dough briefly relax and adjust to the shape of the tray if it springs back.', 'Če se testo vrača nazaj, ga v pekaču pustite kratek čas počivati, da se sprosti in prilagodi obliki.'),
        pick('Geben Sie die Sauce und den Belag darauf.', 'Add the sauce and toppings.', 'Dodajte omako in nadev.'),
        pick(`Für eine Pizza mit ${diameter} cm beträgt die voreingestellte Mozzarella-Menge ungefähr ${cheeseAmount} g.`, `For a ${diameter} cm pizza, the default mozzarella amount is approximately ${cheeseAmount} g.`, `Za pico premera ${diameter} cm je privzeta količina mocarele približno ${cheeseAmount} g.`),
        pick('Schieben Sie die Pizza in den vorgeheizten Ofen.', 'Put the pizza in the preheated oven.', 'Pico vstavite v predhodno segreto pečico.'),
        pick('Heizen Sie den Ofen gründlich auf die maximale Temperatur vor.', 'Preheat the oven thoroughly to its maximum temperature.', 'Pečico dobro segrejte na najvišjo temperaturo.'),
        pick('Wenn ein Pizza-Programm vorhanden ist, verwenden Sie es; wenn kein Pizza-Programm vorhanden ist, verwenden Sie Ober-/Unterhitze ohne Umluft.', 'If you have a Pizza program, use it; if you do not, use top and bottom heat without a fan.', 'Če imate program Pizza, ga uporabite; če ga nimate, uporabite zgornje in spodnje gretje brez ventilatorja.'),
        pick('Backen Sie ohne Grill, bis der Boden und der Rand gut durchgebacken sind.', 'Bake without the grill until the bottom and rim are well baked.', 'Pecite brez žara, dokler dno in rob nista dobro pečena.'),
        pick('Schalten Sie am Ende den Grill ein, wenn Sie die Oberseite stärker bräunen möchten.', 'Turn on the grill at the end if you want the top more deeply browned.', 'Na koncu vklopite žar, če želite močneje zapečeno zgornjo stran.'),
        pick('Nehmen Sie die Pizza aus dem Ofen und lassen Sie sie kurz ruhen, bevor Sie sie schneiden.', 'Remove the pizza from the oven and let it rest briefly before slicing.', 'Pico vzemite iz pečice in jo pred rezanjem pustite kratek čas počivati.'),
      ] : [
        ovenSteps[0],
        pick(`Nehmen Sie die Teigkugeln aus dem Kühlschrank und lassen Sie sie ${finalRoomDuration} vor dem Formen temperieren. Achten Sie darauf, dass die Teigkugeln nicht überfermentieren.`, `Take the dough balls out of the refrigerator and let them temper for ${finalRoomDuration} before shaping. Make sure the dough balls do not over-ferment.`, `Kroglice vzemite iz hladilnika in jih pred oblikovanjem pustite ${finalRoomDuration} temperirati. Pazite, da kroglice ne fermentirajo preveč.`),
        pick('Bestäuben Sie die Arbeitsfläche leicht mit einer minimalen Menge Semola.', 'Lightly dust the work surface with a minimal amount of semolina.', 'Delovno površino rahlo posujte z minimalno količino zdroba.'),
        pick('Nehmen Sie die Teigkugel mit einer schnellen und vorsichtigen Bewegung aus dem Behälter und legen Sie sie mit der Oberseite nach unten auf die Semola.', 'Quickly and gently remove the dough ball from the container and place it upside down on the semolina.', 'Kroglico hitro in nežno vzemite iz posode ter jo položite obrnjeno na zdrob.'),
        isRomanTonda
          ? pick('Formen Sie die Romana Tonda dünn und flach durch Drücken mit den Fingern; verwenden Sie kein aggressives Dehnen in der Luft.', 'Shape the Romana Tonda thin and flat by pressing with your fingers; do not stretch it aggressively in the air.', 'Romano Tondo oblikujte tanko in ravno s pritiskanjem prstov; ne raztezajte je agresivno v zraku.')
          : isNewYork
            ? pick('Formen Sie den größeren Teigballen mit dünner Mitte und möglichst gleichmäßiger Dicke. Formen Sie keinen bewusst hohen, aufgeblähten neapolitanischen Rand; das Stück soll faltbar sein.', 'Shape the larger dough ball with a thin center and as even a thickness as possible. Do not intentionally create a tall, puffy Neapolitan-style rim; the slice should fold easily.', 'Večjo kepico oblikujte s tanko sredino in čim bolj enakomerno debelino. Ne oblikujte namerno visokega, napihnjenega neapeljskega roba; rezina naj se zlahka prepogne.')
            : pick('Drücken Sie mit den Fingerspitzen die Luft von der Mitte in Richtung Rand. Verwenden Sie kein Nudelholz.', 'Using your fingertips, push the air from the center toward the edges. Do not use a rolling pin.', 'S konicami prstov potiskajte zrak iz sredine proti robovom. Ne uporabljajte valjarja.'),
        ...(!isRomanTonda && !isNewYork ? [pick('Lassen Sie den Cornicione als optische Orientierung ungefähr 1–2 cm breit.', 'Leave approximately 1–2 cm of Cornicione as a visual guideline.', 'Rob Cornicione pustite približno 1–2 cm širok kot vizualno priporočilo.')] : []),
        pick(`Dehnen Sie den Teig auf den Ziel-Durchmesser von ${diameter} cm.`, `Stretch the dough to the target diameter of ${diameter} cm.`, `Testo raztegnite na ciljni premer ${diameter} cm.`),
        pick('Schütteln Sie überschüssige Semola ab und legen Sie den Teig auf den Pizzaschieber.', 'Shake off excess semolina and transfer the dough onto the pizza peel.', 'Otresite odvečni zdrob in testo prenesite na lopar za pico.'),
        pick('Belegen Sie die Pizza entsprechend ihrem Durchmesser und lassen Sie den Rand frei.', 'Add the toppings according to the pizza diameter, leaving the rim free of toppings.', 'Dodajte nadev glede na premer pice, rob pa pustite brez nadeva.'),
        pick(`Für eine Pizza mit ${diameter} cm beträgt die voreingestellte Mozzarella-Menge ungefähr ${cheeseAmount} g.`, `For a ${diameter} cm pizza, the default mozzarella amount is approximately ${cheeseAmount} g.`, `Za pico premera ${diameter} cm je privzeta količina mocarele približno ${cheeseAmount} g.`),
        pick('Schieben Sie die Pizza in den vorgeheizten Ofen.', 'Launch the pizza into the preheated oven.', 'Pico vstavite v predhodno segreto pečico.'),
        ovenSteps[1],
        ovenSteps[2],
      ],
      timers: [
        timer('tempering', temperingMidpoint, 'preBake'),
        ...(beginnerMode ? getBeginnerOvenTimers(oven, ovenTemp, useBakeEstimate, isRomanTeglia) : []),
      ],
    },
  ];
}

const DURATION_PATTERN = /\b\d+(?:\s*(?:do|to|bis|[-–])\s*\d+)?\s*(?:sat|sata|sati|ur|ura|ure|hours?|hrs?|stunden?|h)\b/gi;
const FRIDGE_PATTERN = /hladnjak|hladnjaku|hladnjaka|fridge|kühlschrank|hladilnik/i;
const ROOM_PATTERN = /sobnoj temperaturi|sobnoj temp\.?|sobni temperaturi|room temperature|room temp\.?|raumtemperatur|raumtemp\.?/i;

function hourLabel(lang: Lang) {
  if (lang === 'en') return 'hours';
  if (lang === 'de') return 'Stunden';
  if (lang === 'sl') return 'ur';
  return 'sati';
}

function replaceDurationBefore(text: string, phrase: RegExp, hours: number, label: string) {
  const match = phrase.exec(text);
  if (!match || match.index === undefined) return text;
  const before = text.slice(0, match.index);
  const durations = [...before.matchAll(DURATION_PATTERN)];
  const duration = durations.at(-1);
  if (!duration || duration.index === undefined || match.index - (duration.index + duration[0].length) > 80) return text;
  return `${text.slice(0, duration.index)}${hours} ${label}${text.slice(duration.index + duration[0].length)}`;
}

function replaceDurationAfter(text: string, phrase: RegExp, hours: number, label: string) {
  const match = phrase.exec(text);
  if (!match || match.index === undefined) return text;
  const afterStart = match.index + match[0].length;
  const after = text.slice(afterStart);
  const duration = DURATION_PATTERN.exec(after);
  if (!duration || duration.index === undefined || duration.index > 80) return text;
  const start = afterStart + duration.index;
  return `${text.slice(0, start)}${hours} ${label}${text.slice(start + duration[0].length)}`;
}

function adaptFermentationSteps(steps: readonly string[], roomHours: number, fridgeHours: number, fridgeTemp: number, lang: Lang) {
  const label = hourLabel(lang);
  return steps
    .filter((step) => fridgeHours > 0 || !FRIDGE_PATTERN.test(step))
    .map((step) => {
      let adapted = replaceDurationBefore(step, ROOM_PATTERN, roomHours, label);
      if (fridgeHours > 0) {
        adapted = replaceDurationAfter(adapted, FRIDGE_PATTERN, fridgeHours, label);
        adapted = adapted.replace(/\d+(?:\s*[-–]\s*\d+)?\s*°C/g, `${fridgeTemp}°C`);
      }
      return adapted;
    });
}

function adaptDirectPhaseSteps(phase: 'C' | 'D', steps: readonly string[], roomHours: number, fridgeHours: number, fridgeTemp: number, lang: Lang) {
  const adapted = adaptFermentationSteps(steps, roomHours, fridgeHours, fridgeTemp, lang);
  if (fridgeHours > 0) return adapted;

  if (phase === 'D') {
    return adapted.filter((step) => !/1\.5\s*[–-]\s*2\s*(?:sata|h|hours?|Stunden|ur)/i.test(step));
  }
  const roomStep = {
    hr: `Ostavite loptice na sobnoj temperaturi ${roomHours} sati prije pečenja.`,
    en: `Leave the dough balls at room temperature for ${roomHours} hours before baking.`,
    de: `Lassen Sie die Teigkugeln ${roomHours} Stunden bei Raumtemperatur vor dem Backen stehen.`,
    sl: `Kroglice pustite ${roomHours} ur na sobni temperaturi pred peko.`,
  }[lang];
  return [...adapted, roomStep];
}

function formatDirectHomeSchedule(schedule: HomePizzaPlanSchedule, roomTemp: number, fridgeTemp: number, lang: Lang) {
  const labels = {
    hr: { title: 'Kućni raspored fermentacije', before: 'Sobna fermentacija prije hladnjaka', fridge: 'Fermentacija u hladnjaku', after: 'Sobna fermentacija nakon hladnjaka', bake: 'Pečenje', at: 'na' },
    en: { title: 'Home fermentation schedule', before: 'Room fermentation before fridge', fridge: 'Refrigerator fermentation', after: 'Room fermentation after fridge', bake: 'Bake at', at: 'at' },
    de: { title: 'Home-Fermentationsplan', before: 'Raumgare vor dem Kühlschrank', fridge: 'Fermentation im Kühlschrank', after: 'Raumgare nach dem Kühlschrank', bake: 'Backen um', at: 'bei' },
    sl: { title: 'Domači načrt fermentacije', before: 'Fermentacija na sobni temperaturi pred hladilnikom', fridge: 'Fermentacija v hladilniku', after: 'Fermentacija na sobni temperaturi po hladilniku', bake: 'Peka ob', at: 'pri' },
  }[lang];
  const hours = (value: number) => formatDuration(value * 3600, lang);
  const dateLocale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
  const isV1 = schedule.phaseAMinutes !== undefined;
  const steps = [
      `${labels.before}: ${hours(schedule.roomBeforeFridgeHours)} ${labels.at} ${roomTemp} °C.`,
      ...(schedule.fridgeHours > 0 ? [`${labels.fridge}: ${hours(schedule.fridgeHours)} ${labels.at} ${fridgeTemp} °C.`] : []),
      ...(schedule.roomAfterFridgeHours > 0 ? [`${labels.after}: ${hours(schedule.roomAfterFridgeHours)} ${labels.at} ${roomTemp} °C.`] : []),
      `${labels.bake}: ${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(schedule.bakeAt)}.`,
      ...(isV1 && schedule.doughReadyAt ? [`Dough ready / oven entry: ${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(schedule.doughReadyAt)}.`] : []),
    ];
  return {
    title: labels.title,
    steps,
    timers: [
      { id: 'direct-home-before-fridge', seconds: schedule.roomBeforeFridgeHours * 3600, kind: 'rt' as const },
      { id: 'direct-home-fridge', seconds: schedule.fridgeHours * 3600, kind: 'fridge' as const },
      { id: 'direct-home-after-fridge', seconds: schedule.roomAfterFridgeHours * 3600, kind: 'ballsRt' as const },
    ].filter((timer) => timer.seconds > 0),
  };
}

function formatBigaHomeSchedule(schedule: BigaHomePizzaSchedule, lang: Lang) {
  const labels = {
    hr: { title: 'Kućni raspored Bige', bigaStart: 'Početak Bige', finalMix: 'Završni zamjes', balling: 'Oblikovanje kuglica', preheat: 'Zagrijavanje pećnice', bake: 'Pečenje' },
    en: { title: 'Biga Home schedule', bigaStart: 'Start Biga', finalMix: 'Final dough mix', balling: 'Divide and ball', preheat: 'Preheat oven', bake: 'Bake' },
    de: { title: 'Biga-Backplan für Zuhause', bigaStart: 'Biga ansetzen', finalMix: 'Hauptteig mischen', balling: 'Teiglinge formen', preheat: 'Ofen vorheizen', bake: 'Backen' },
    sl: { title: 'Domači načrt za bigo', bigaStart: 'Začetek bige', finalMix: 'Končno gnetenje', balling: 'Oblikovanje kroglic', preheat: 'Segrevanje pečice', bake: 'Peka' },
  }[lang];
  const dateLocale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
  const duration = (hours: number) => formatDuration(Math.round(hours * 60) * 60, lang);
  const details = {
    bigaStart: `${duration(schedule.bigaRoomHours)} room + ${duration(schedule.bigaFridgeHours)} fridge`,
    finalMix: `${duration(schedule.finalDoughRoomHours)} room + ${duration(schedule.finalDoughFridgeHours)} fridge`,
    balling: `${duration(schedule.finalBallRestHours)} final rest`,
    preheat: '',
    bake: '',
  };
  return {
    title: labels.title,
    steps: getBigaHomeScheduleMilestones(schedule).map(({ stage, at }) => (
      `${labels[stage]}: ${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(at)}${details[stage] ? ` · ${details[stage]}` : ''}.`
    )),
  };
}

function formatPoolishHomeSchedule(schedule: PoolishHomePizzaSchedule, lang: Lang) {
  const labels = {
    hr: { title: 'Kućni raspored Poolisha', poolishStart: 'Početak Poolisha', finalMix: 'Završni zamjes', balling: 'Oblikovanje kuglica', preheat: 'Zagrijavanje pećnice', bake: 'Pečenje' },
    en: { title: 'Poolish Home schedule', poolishStart: 'Start Poolish', finalMix: 'Final dough mix', balling: 'Divide and ball', preheat: 'Preheat oven', bake: 'Bake' },
    de: { title: 'Poolish-Backplan für Zuhause', poolishStart: 'Poolish ansetzen', finalMix: 'Hauptteig mischen', balling: 'Teiglinge formen', preheat: 'Ofen vorheizen', bake: 'Backen' },
    sl: { title: 'Domači načrt za Poolish', poolishStart: 'Začetek Poolisha', finalMix: 'Končno gnetenje', balling: 'Oblikovanje kroglic', preheat: 'Segrevanje pečice', bake: 'Peka' },
  }[lang];
  const dateLocale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
  const duration = (hours: number) => formatDuration(hours * 3600, lang);
  const details = {
    poolishStart: `${duration(schedule.poolishRoomHours)} room + ${duration(schedule.poolishFridgeHours)} fridge`,
    finalMix: `${duration(schedule.finalDoughRoomHours)} room + ${duration(schedule.finalDoughFridgeHours)} fridge`,
    balling: `${duration(schedule.finalBallRestHours)} final rest`,
    preheat: '',
    bake: '',
  };
  return {
    title: labels.title,
    steps: getPoolishHomeScheduleMilestones(schedule).map(({ stage, at }) => (
      `${labels[stage]}: ${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(at)}${details[stage] ? ` · ${details[stage]}` : ''}.`
    )),
  };
}

function withoutBigaScheduleTiming(steps: readonly string[]): string[] {
  const duration = /\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*(?:hours?|hrs?|h|stunden?|stund|sati|sata|sat|ur|ure|uri|uro|minutes?|mins?|minuten?|minut(?:a|e|i)?)/i;
  return steps.flatMap((step) => step.split(/(?<=[.!?])\s+/).filter((sentence) => !duration.test(sentence)));
}

function withoutDirectScheduleTimingText(text?: string): string | undefined {
  if (!text) return text;
  const duration = /\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*(?:hours?|hrs?|h|stunden?|stund|sati|sata|sat|ur|ure|uri|uro|minutes?|mins?|minuten?|minut(?:a|e|i)?)/i;
  const phaseContext = /fridge|refrigerator|room temperature|at room|cold|tempering|temperieren|kühlschrank|raumtemperatur|vor dem ausrollen|vor dem formen|temperiranje|hladn|sobn|hladilnik|hladnj|prije razvlačenja|prije oblikovanja|prije valjanja|pred oblikovanjem/i;
  const remaining = text.split(/(?<=[.!?])\s+/).filter((sentence) => !(duration.test(sentence) && phaseContext.test(sentence)));
  return remaining.join(' ').trim() || undefined;
}

function withoutDirectScheduleTiming(steps: readonly string[]): string[] {
  return steps.map(withoutDirectScheduleTimingText).filter((step): step is string => !!step);
}

function buildBeginnerUnscheduledDirectSteps(phases: DetailedPhase[], fridgeTemp: number, lang: Lang): DetailedPhase[] {
  const copy = {
    hr: {
      pending: 'Točno vrijeme fermentacije još nije određeno: odaberite datum i vrijeme pečenja da dobijete svoj raspored.',
      fridge: `Ako vaš raspored uključuje hladnjak, oblikovane kugle stavite u zatvorenu kutiju i držite ih u hladnjaku pri ${fridgeTemp} °C do planiranog vremena vađenja.`,
      takeOut: 'Ako su kugle bile u hladnjaku, izvadite kugle u vrijeme navedeno u vašem rasporedu i ostavite ih da dosegnu sobnu temperaturu prije oblikovanja. Pazite da se ne prefermentiraju.',
    },
    en: {
      pending: 'Exact fermentation timing is not set yet: choose a bake date and time to get your schedule.',
      fridge: `If your schedule includes refrigeration, place the shaped dough balls in a closed box and keep them in the refrigerator at ${fridgeTemp} °C until the scheduled fridge-out time.`,
      takeOut: 'If the dough balls were refrigerated, take the dough balls out at the time given in your schedule and let them come to room temperature before shaping. Make sure they do not over-ferment.',
    },
    de: {
      pending: 'Die genaue Fermentationszeit ist noch nicht festgelegt: Wählen Sie Backdatum und -zeit, um Ihren Zeitplan zu erhalten.',
      fridge: `Wenn Ihr Zeitplan den Kühlschrank vorsieht, legen Sie die geformten Teigkugeln in eine geschlossene Box und lagern Sie sie bei ${fridgeTemp} °C im Kühlschrank bis zur geplanten Entnahme.`,
      takeOut: 'Wenn die Teigkugeln im Kühlschrank waren, nehmen Sie die Teigkugeln zum Zeitpunkt aus Ihrem Zeitplan heraus und lassen Sie sie vor dem Formen Raumtemperatur annehmen. Achten Sie darauf, dass sie nicht überfermentieren.',
    },
    sl: {
      pending: 'Natančen čas fermentacije še ni določen: izberite datum in uro peke, da dobite svoj načrt.',
      fridge: `Če vaš načrt vključuje hladilnik, oblikovane kroglice položite v zaprto posodo in jih hranite v hladilniku pri ${fridgeTemp} °C do načrtovanega časa odvzema.`,
      takeOut: 'Če so bile kroglice v hladilniku, kroglice vzemite ven ob času iz vašega načrta in jih pred oblikovanjem pustite, da dosežejo sobno temperaturo. Pazite, da ne fermentirajo preveč.',
    },
  }[lang];
  const coldPhase = /cold fermentation|kalte fermentation|hladna fermentacija/i;
  const fridgeStep = /refrigerat|fridge|kühlschrank|hladnjak|hladilnik/i;
  return phases.map((phase, index) => {
    if (coldPhase.test(phase.title)) {
      return { title: phase.title, containerOilInfo: phase.containerOilInfo, steps: [copy.pending, copy.fridge], timers: [] };
    }
    if (index === phases.length - 1) {
      return {
        ...phase,
        steps: phase.steps.map((step) => fridgeStep.test(step) ? copy.takeOut : step),
        temperingInfo: undefined,
        ovenTimingInfo: undefined,
      };
    }
    return phase;
  });
}

function buildBeginnerPhaseBSteps(
  plan: BeginnerPhaseBPlan,
  lang: Lang,
  isTeglia: boolean,
  flourType: FlourType = 'caputo00',
): string[] {
  const duration = (minutes: number) => formatDuration(minutes * 60, lang);
  const isCustomBlend = flourType === 'custom';
  const foldBehavior = isCustomBlend ? 'custom' : plan.behavior;
  const copy = {
    hr: {
      transfer: 'Uljem lagano premažite fermentacijsku posudu i prebacite tijesto u nju.',
      transferGf: 'Lagano nauljite fermentacijsku posudu, prebacite smjesu u nju i pokrijte je.',
      coverRest: (minutes: string) => `Pokrijte tijesto i ostavite ga da odmori ${minutes}.`,
      ferment: (minutes: string) => plan.foldCount === 0
        ? `Pokrijte tijesto i ostavite ga da fermentira ${minutes}.`
        : `Pokrijte tijesto i ostavite ga da fermentira još ${minutes}.`,
      gfFerment: (minutes: string) => `Ostavite smjesu da fermentira ${minutes}.`,
      fold: (index: number) => foldBehavior === 'gentle'
        ? index === 1 ? 'Napravite prvi nježni Stretch & Fold.' : 'Napravite drugi nježni Stretch & Fold.'
        : index === 1 ? 'Napravite prvi Stretch & Fold.' : 'Napravite drugi Stretch & Fold.',
      check: 'Provjerite tijesto prije nastavka.',
      next: 'Kad je prva fermentacija gotova, podijelite tijesto, oblikujte kuglice i stavite ih u hladnjak prema rasporedu.',
    },
    en: {
      transfer: 'Lightly oil the fermentation container and transfer the dough into it.',
      transferGf: 'Lightly oil the fermentation container, transfer the mixture into it, and cover it.',
      coverRest: (minutes: string) => `Cover the dough and let it rest for ${minutes}.`,
      ferment: (minutes: string) => `Cover the dough and let it ferment undisturbed for ${minutes}.`,
      gfFerment: (minutes: string) => `Leave the mixture to ferment for ${minutes}.`,
      fold: (index: number) => foldBehavior === 'gentle'
        ? index === 1 ? 'Perform the first gentle Stretch & Fold.' : 'Perform the second gentle Stretch & Fold.'
        : index === 1 ? 'Perform the first Stretch & Fold.' : 'Perform the second Stretch & Fold.',
      check: 'Check the dough before continuing.',
      next: 'When first fermentation is complete, divide the dough, form the balls, and refrigerate them according to the schedule.',
    },
    de: {
      transfer: 'Ölen Sie den Gärbehälter leicht ein und geben Sie den Teig hinein.',
      transferGf: 'Ölen Sie den Gärbehälter leicht ein, geben Sie die Masse hinein und decken Sie sie ab.',
      coverRest: (minutes: string) => `Decken Sie den Teig ab und lassen Sie ihn ${minutes} ruhen.`,
      ferment: (minutes: string) => `Decken Sie den Teig ab und lassen Sie ihn ${minutes} ungestört fermentieren.`,
      gfFerment: (minutes: string) => `Lassen Sie die Masse ${minutes} fermentieren.`,
      fold: (index: number) => foldBehavior === 'gentle'
        ? index === 1 ? 'Führen Sie das erste sanfte Stretch & Fold durch.' : 'Führen Sie das zweite sanfte Stretch & Fold durch.'
        : index === 1 ? 'Führen Sie das erste Stretch & Fold durch.' : 'Führen Sie das zweite Stretch & Fold durch.',
      check: 'Prüfen Sie den Teig, bevor Sie fortfahren.',
      next: 'Wenn die erste Fermentation abgeschlossen ist, teilen Sie den Teig, formen Sie die Kugeln und stellen Sie sie nach Plan in den Kühlschrank.',
    },
    sl: {
      transfer: 'Fermentacijsko posodo rahlo naoljite in vanjo prenesite testo.',
      transferGf: 'Fermentacijsko posodo rahlo naoljite, prenesite maso vanjo in jo pokrijte.',
      coverRest: (minutes: string) => `Testo pokrijte in ga pustite počivati ${minutes}.`,
      ferment: (minutes: string) => `Testo pokrijte in ga pustite nemoteno fermentirati ${minutes}.`,
      gfFerment: (minutes: string) => `Maso pustite fermentirati ${minutes}.`,
      fold: (index: number) => foldBehavior === 'gentle'
        ? index === 1 ? 'Naredite prvi nežni Stretch & Fold.' : 'Naredite drugi nežni Stretch & Fold.'
        : index === 1 ? 'Naredite prvi Stretch & Fold.' : 'Naredite drugi Stretch & Fold.',
      check: 'Pred nadaljevanjem preverite testo.',
      next: 'Ko je prva fermentacija končana, testo razdelite, oblikujte kroglice in jih po načrtu postavite v hladilnik.',
    },
  }[lang];

  if (plan.behavior === 'glutenFree') {
    return [
      copy.transferGf,
      copy.gfFerment(duration(plan.durationMinutes)),
    ];
  }

  const steps = [copy.transfer];
  if (plan.foldCount === 0) {
    steps.push(copy.ferment(duration(plan.durationMinutes)));
  } else {
    if (plan.folds[0].offsetMinutes > 0) {
      steps.push(copy.coverRest(duration(plan.folds[0].offsetMinutes)));
    }
    plan.folds.forEach((fold, index) => {
      steps.push(copy.fold(fold.index));
      const nextFold = plan.folds[index + 1];
      if (nextFold) {
        steps.push(copy.coverRest(duration(nextFold.offsetMinutes - fold.offsetMinutes)));
      }
    });
    if (plan.finalRestMinutes > 0) steps.push(copy.ferment(duration(plan.finalRestMinutes)));
  }
  if (!isTeglia) steps.push(copy.check);
  return steps;
}

function buildBeginnerPhaseBStepInfo(
  plan: BeginnerPhaseBPlan,
  lang: Lang,
  isTeglia: boolean,
  flourType: FlourType = 'caputo00',
): Array<{ title: string; body: string } | undefined> {
  const isCustomBlend = flourType === 'custom';
  const foldBehavior = isCustomBlend ? 'custom' : plan.behavior;
  const copy = {
    hr: {
      container: ['Priprema posude', 'Nekoliko kapi ulja razmažite po dnu i stijenkama posude. Tako se tijesto neće lijepiti i lakše ćete ga izvaditi. Posudu pokrijte poklopcem ili folijom kako se površina tijesta ne bi osušila.'],
      gfContainer: ['Priprema posude', 'Nekoliko kapi ulja razmažite po dnu i stijenkama posude. Tako se smjesa neće lijepiti i lakše ćete je izvaditi. Posudu pokrijte poklopcem ili folijom kako se površina smjese ne bi osušila.'],
      first: ['Prvo preklapanje', 'Lagano navlažite ruke. Uhvatite jedan rub tijesta, pažljivo ga podignite i preklopite prema sredini. Ponovite sa svih strana. Nemojte rastezati tijesto do pucanja.'],
      firstGentle: ['Prvo nježno preklapanje', 'Lagano navlažite ruke. Pažljivo podignite rub tijesta i nježno ga preklopite prema sredini. Ponovite sa svih strana bez snažnog rastezanja ili trganja.'],
      firstCustom: ['Prvo preklapanje', 'Lagano navlažite ruke. Uhvatite jedan rub tijesta, pažljivo ga podignite i preklopite prema sredini. Ponovite sa svih strana. Ako mješavina sadrži više pira ili integralnog brašna, radite vrlo nježno. Nemojte rastezati tijesto do pucanja.'],
      rest: ['Početni odmor', 'Tijekom odmora tijesto se opušta, a brašno nastavlja upijati vodu. Posudu držite na temperaturi prostorije koju ste odabrali u kalkulatoru.'],
      betweenFolds: ['Odmor između preklapanja', 'Ovaj odmor omogućuje tijestu da se opusti nakon prvog preklapanja. Nemojte ga dodatno mijesiti niti pritiskati.'],
      final: ['Završna fermentacija', 'Ostavite tijesto pokriveno i nemojte ga više obrađivati. Tijekom ovog razdoblja fermentacija se nastavlja, a tijesto postupno postaje podatnije.'],
      second: ['Drugo preklapanje', 'Ponovite postupak iz prvog preklapanja. Cilj je ojačati strukturu tijesta bez nepotrebnog pritiskanja ili trganja.'],
      secondGentle: ['Drugo nježno preklapanje', 'Ponovite nježno preklapanje. Ako tijesto pruža jak otpor ili se počinje trgati, nemojte ga forsirati.'],
      secondCustom: ['Drugo preklapanje', 'Ponovite postupak iz prvog preklapanja. Ako je tijesto već dovoljno povezano i pruža jak otpor ili se počinje trgati, preskočite dodatno preklapanje.'],
      check: ['Provjera tijesta', 'Tijesto bi trebalo biti nešto opuštenije, povezano i pokazivati znakove fermentacije, primjerice sitne mjehuriće. Ne mora se udvostručiti. Ako je vrlo mekano ili ljepljivo, rukujte njime pažljivo u sljedećoj fazi.'],
      gfFinal: ['Fermentacija smjese', 'Ostavite smjesu pokrivenu i nemojte je više obrađivati. Tijekom ovog razdoblja fermentacija se nastavlja, a smjesa se postupno stabilizira.'],
    },
    en: {
      container: ['Container preparation', 'Spread a few drops of oil over the bottom and sides of the container. This prevents sticking and makes the dough easier to remove. Cover the container with a lid or film so the dough surface does not dry out.'],
      gfContainer: ['Container preparation', 'Spread a few drops of oil over the bottom and sides of the container. This prevents the mixture from sticking and makes it easier to remove. Cover the container with a lid or film so the mixture surface does not dry out.'],
      first: ['First fold', 'Lightly wet your hands. Carefully lift one edge of the dough and fold it toward the centre. Repeat on all sides. Do not stretch the dough until it tears.'],
      firstGentle: ['First gentle fold', 'Lightly wet your hands. Carefully lift an edge of the dough and gently fold it toward the centre. Repeat on all sides without strong stretching or tearing.'],
      firstCustom: ['First fold', 'Lightly wet your hands. Carefully lift one edge of the dough and fold it toward the centre. Repeat on all sides. If the blend contains more spelt or whole-wheat flour, work very gently. Do not stretch the dough until it tears.'],
      rest: ['Initial rest', 'During the rest the dough relaxes while the flour continues absorbing water. Keep the container at the room temperature selected in the calculator.'],
      betweenFolds: ['Rest between folds', 'This rest allows the dough to relax after the first fold. Do not knead or press it further.'],
      final: ['Final fermentation', 'Keep the dough covered and do not work it further. Fermentation continues during this period and the dough gradually becomes more supple.'],
      second: ['Second fold', 'Repeat the first folding process. The aim is to strengthen the dough without unnecessary pressing or tearing.'],
      secondGentle: ['Second gentle fold', 'Repeat the gentle fold. If the dough offers strong resistance or begins to tear, do not force it.'],
      secondCustom: ['Second fold', 'Repeat the first folding process. If the dough is already sufficiently developed and offers strong resistance or begins to tear, skip the additional fold.'],
      check: ['Dough readiness check', 'The dough should be somewhat more relaxed, cohesive, and show signs of fermentation such as small bubbles. It does not have to double. If it is very soft or sticky, handle it carefully in the next phase.'],
      gfFinal: ['Mixture fermentation', 'Keep the mixture covered and do not work it further. Fermentation continues during this period and the mixture gradually stabilizes.'],
    },
    de: {
      container: ['Behälter vorbereiten', 'Verteilen Sie einige Tropfen Öl auf Boden und Wänden des Behälters. So klebt der Teig nicht fest und lässt sich leichter herausnehmen. Decken Sie den Behälter mit einem Deckel oder einer Folie ab, damit die Teigoberfläche nicht austrocknet.'],
      gfContainer: ['Behälter vorbereiten', 'Verteilen Sie einige Tropfen Öl auf Boden und Wänden des Behälters. So klebt die Masse nicht fest und lässt sich leichter herausnehmen. Decken Sie den Behälter mit einem Deckel oder einer Folie ab, damit die Oberfläche der Masse nicht austrocknet.'],
      first: ['Erste Faltung', 'Befeuchten Sie Ihre Hände leicht. Heben Sie eine Teigkante vorsichtig an und falten Sie sie zur Mitte. Wiederholen Sie dies an allen Seiten. Dehnen Sie den Teig nicht bis zum Reißen.'],
      firstGentle: ['Erste sanfte Faltung', 'Befeuchten Sie Ihre Hände leicht. Heben Sie eine Teigkante vorsichtig an und falten Sie sie sanft zur Mitte. Wiederholen Sie dies an allen Seiten, ohne stark zu dehnen oder zu reißen.'],
      firstCustom: ['Erste Faltung', 'Befeuchten Sie Ihre Hände leicht. Heben Sie eine Teigkante vorsichtig an und falten Sie sie zur Mitte. Wiederholen Sie dies an allen Seiten. Wenn die Mischung mehr Dinkel- oder Vollkornmehl enthält, arbeiten Sie sehr vorsichtig. Dehnen Sie den Teig nicht bis zum Reißen.'],
      rest: ['Erste Ruhezeit', 'Während der Ruhe entspannt sich der Teig, während das Mehl weiter Wasser aufnimmt. Lassen Sie den Behälter bei der im Rechner gewählten Raumtemperatur stehen.'],
      betweenFolds: ['Ruhe zwischen den Faltungen', 'Diese Ruhezeit lässt den Teig nach der ersten Faltung entspannen. Kneten oder drücken Sie ihn nicht weiter.'],
      final: ['Endgültige Fermentation', 'Lassen Sie den Teig abgedeckt und bearbeiten Sie ihn nicht weiter. Während dieser Zeit läuft die Fermentation weiter und der Teig wird allmählich geschmeidiger.'],
      second: ['Zweite Faltung', 'Wiederholen Sie den Ablauf der ersten Faltung. Ziel ist, die Teigstruktur zu stärken, ohne unnötig zu drücken oder zu reißen.'],
      secondGentle: ['Zweite sanfte Faltung', 'Wiederholen Sie die sanfte Faltung. Wenn der Teig starken Widerstand leistet oder zu reißen beginnt, erzwingen Sie nichts.'],
      secondCustom: ['Zweite Faltung', 'Wiederholen Sie den Ablauf der ersten Faltung. Wenn der Teig bereits ausreichend entwickelt ist und starken Widerstand leistet oder zu reißen beginnt, lassen Sie die zusätzliche Faltung aus.'],
      check: ['Teig prüfen', 'Der Teig sollte etwas entspannter und verbunden sein und Anzeichen der Fermentation, zum Beispiel kleine Blasen, zeigen. Er muss sich nicht verdoppeln. Wenn er sehr weich oder klebrig ist, behandeln Sie ihn in der nächsten Phase vorsichtig.'],
      gfFinal: ['Fermentation der Masse', 'Lassen Sie die Masse abgedeckt und bearbeiten Sie sie nicht weiter. Während dieser Zeit läuft die Fermentation weiter und die Masse stabilisiert sich allmählich.'],
    },
    sl: {
      container: ['Priprava posode', 'Po dnu in stenah posode razmažite nekaj kapljic olja. Tako se testo ne bo prijemalo in ga boste lažje vzeli iz posode. Posodo pokrijte s pokrovom ali folijo, da se površina testa ne izsuši.'],
      gfContainer: ['Priprava posode', 'Po dnu in stenah posode razmažite nekaj kapljic olja. Tako se masa ne bo prijemala in jo boste lažje vzeli iz posode. Posodo pokrijte s pokrovom ali folijo, da se površina mase ne izsuši.'],
      first: ['Prvi pregib', 'Rahlo navlažite roke. Previdno dvignite rob testa in ga prepognite proti sredini. Ponovite na vseh straneh. Testa ne raztegujte do trganja.'],
      firstGentle: ['Prvi nežni pregib', 'Rahlo navlažite roke. Previdno dvignite rob testa in ga nežno prepognite proti sredini. Ponovite na vseh straneh brez močnega raztezanja ali trganja.'],
      firstCustom: ['Prvi pregib', 'Rahlo navlažite roke. Previdno dvignite rob testa in ga prepognite proti sredini. Ponovite na vseh straneh. Če mešanica vsebuje več pira ali polnozrnate moke, delajte zelo nežno. Testa ne raztegujte do trganja.'],
      rest: ['Začetni počitek', 'Med počitkom se testo sprosti, moka pa še naprej vpija vodo. Posodo hranite pri sobni temperaturi, ki ste jo izbrali v kalkulatorju.'],
      betweenFolds: ['Počitek med pregibi', 'Ta počitek omogoči, da se testo po prvem pregibu sprosti. Testa ne gnetite in ne pritiskajte nanj.'],
      final: ['Končna fermentacija', 'Testo pustite pokrito in ga ne obdelujte več. V tem obdobju se fermentacija nadaljuje, testo pa postopoma postaja bolj prožno.'],
      second: ['Drugi pregib', 'Ponovite postopek prvega pregiba. Cilj je okrepiti strukturo testa brez nepotrebnega pritiskanja ali trganja.'],
      secondGentle: ['Drugi nežni pregib', 'Ponovite nežni pregib. Če testo močno upira ali se začne trgati, ga ne silite.'],
      secondCustom: ['Drugi pregib', 'Ponovite postopek prvega pregiba. Če je testo že dovolj povezano in se močno upira ali se začne trgati, dodatni pregib izpustite.'],
      check: ['Preverjanje testa', 'Testo naj bo nekoliko bolj sproščeno in povezano ter naj kaže znake fermentacije, na primer majhne mehurčke. Ni se mu treba podvojiti. Če je zelo mehko ali lepljivo, z njim v naslednji fazi ravnajte previdno.'],
      gfFinal: ['Fermentacija mase', 'Maso pustite pokrito in je ne obdelujte več. V tem obdobju se fermentacija nadaljuje, masa pa se postopoma stabilizira.'],
    },
  }[lang];
  const result: Array<{ title: string; body: string } | undefined> = [{
    title: (plan.behavior === 'glutenFree' ? copy.gfContainer : copy.container)[0],
    body: (plan.behavior === 'glutenFree' ? copy.gfContainer : copy.container)[1],
  }];
  if (plan.behavior === 'glutenFree') {
    result.push({ title: copy.gfFinal[0], body: copy.gfFinal[1] });
    return result;
  }
  if (plan.foldCount === 0) result.push({ title: copy.final[0], body: copy.final[1] });
  else {
    if (plan.folds[0].offsetMinutes > 0) result.push({ title: copy.rest[0], body: copy.rest[1] });
    plan.folds.forEach((fold, index) => {
      const first = index === 0;
      const info = first
        ? foldBehavior === 'gentle' ? copy.firstGentle : foldBehavior === 'custom' ? copy.firstCustom : copy.first
        : foldBehavior === 'gentle' ? copy.secondGentle : foldBehavior === 'custom' ? copy.secondCustom : copy.second;
      result.push({ title: info[0], body: info[1] });
      if (plan.folds[index + 1]) result.push({ title: copy.betweenFolds[0], body: copy.betweenFolds[1] });
    });
    if (plan.finalRestMinutes > 0) result.push({ title: copy.final[0], body: copy.final[1] });
  }
  if (!isTeglia) result.push({ title: copy.check[0], body: copy.check[1] });
  return result;
}

type BeginnerRoomOnlyEnd = { endAt: Date; minutes: number };

// Room-only: Phase C ends at fridgeAt (or bakeAt - roomAfterFridgeHours); the final phase starts with its first scheduled event.
function getBeginnerRoomOnlyEnd(schedule: HomePizzaPlanSchedule, preheatAt: Date): BeginnerRoomOnlyEnd | null {
  if (schedule.fridgeHours > 0) return null;
  const phaseCEnd = schedule.fridgeAt ?? new Date(schedule.bakeAt.getTime() - schedule.roomAfterFridgeHours * 3600000);
  const shapeStart = new Date(schedule.bakeAt.getTime() - 15 * 60000);
  const endAt = preheatAt.getTime() < shapeStart.getTime() ? preheatAt : shapeStart;
  const minutes = Math.round((endAt.getTime() - phaseCEnd.getTime()) / 60000);
  return Number.isFinite(minutes) && minutes >= 1 ? { endAt, minutes } : null;
}

function getBeginnerFridgeOutAt(schedule: HomePizzaPlanSchedule): Date {
  return new Date(schedule.startAt.getTime() + (schedule.roomBeforeFridgeHours + schedule.fridgeHours) * 3600000);
}

function formatBeginnerScheduledTime(at: Date, reference: Date, lang: Lang): string {
  const locale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
  const sameDate = at.getFullYear() === reference.getFullYear()
    && at.getMonth() === reference.getMonth()
    && at.getDate() === reference.getDate();
  return new Intl.DateTimeFormat(locale, sameDate
    ? { timeStyle: 'short' }
    : { dateStyle: 'medium', timeStyle: 'short' }).format(at);
}

function buildBeginnerColdPhaseD(schedule: HomePizzaPlanSchedule, lang: Lang, teglia: boolean) {
  const fridgeOutAt = getBeginnerFridgeOutAt(schedule);
  const time = formatBeginnerScheduledTime(fridgeOutAt, schedule.bakeAt, lang);
  const duration = formatDuration(schedule.fridgeHours * 3600, lang);
  const copy = {
    hr: {
      step: teglia
        ? `Ostavite zatvorenu fermentacijsku posudu s jednom masom tijesta u hladnjaku ${duration}, do ${time}.`
        : `Ostavite zatvorenu fermentacijsku kutiju s kuglicama u hladnjaku ${duration}, do ${time}.`,
      title: 'Hladna fermentacija',
      body: teglia
        ? 'Tijekom hladne fermentacije jedna masa tijesta polako razvija okus i strukturu. Zatvorenu posudu držite u hladnjaku kako se površina ne bi osušila. Preporučena temperatura hladnjaka je približno 3–5 °C. Nemojte nepotrebno otvarati posudu.'
        : 'Tijekom hladne fermentacije tijesto polako razvija okus i strukturu. Kutiju držite zatvorenom kako se površina kuglica ne bi osušila. Preporučena temperatura hladnjaka je približno 3–5 °C. Nemojte nepotrebno otvarati kutiju.',
    },
    en: {
      step: teglia
        ? `Leave the closed fermentation container with the single dough mass in the refrigerator for ${duration}, until ${time}.`
        : `Leave the closed fermentation box with the dough balls in the refrigerator for ${duration}, until ${time}.`,
      title: 'Cold fermentation',
      body: teglia
        ? 'During cold fermentation, the single dough mass slowly develops flavor and structure. Keep the closed container refrigerated so its surface does not dry out. A refrigerator temperature of about 3–5 °C is recommended. Avoid opening the container unnecessarily.'
        : 'During cold fermentation, the dough slowly develops flavor and structure. Keep the box closed so the dough-ball surfaces do not dry out. A refrigerator temperature of about 3–5 °C is recommended. Avoid opening the box unnecessarily.',
    },
    de: {
      step: teglia
        ? `Lassen Sie den geschlossenen Gärbehälter mit der einzelnen Teigmasse ${duration} im Kühlschrank, bis ${time}.`
        : `Lassen Sie die geschlossene Gärbox mit den Teigkugeln ${duration} im Kühlschrank, bis ${time}.`,
      title: 'Kalte Fermentation',
      body: teglia
        ? 'Während der kalten Fermentation entwickelt die einzelne Teigmasse langsam Aroma und Struktur. Bewahren Sie den geschlossenen Behälter im Kühlschrank auf, damit die Oberfläche nicht austrocknet. Empfohlen werden etwa 3–5 °C. Öffnen Sie den Behälter nicht unnötig.'
        : 'Während der kalten Fermentation entwickelt der Teig langsam Aroma und Struktur. Halten Sie die Box geschlossen, damit die Oberfläche der Teigkugeln nicht austrocknet. Empfohlen werden etwa 3–5 °C. Öffnen Sie die Box nicht unnötig.',
    },
    sl: {
      step: teglia
        ? `Zaprto fermentacijsko posodo z eno maso testa pustite v hladilniku ${duration}, do ${time}.`
        : `Zaprto fermentacijsko posodo s kroglicami pustite v hladilniku ${duration}, do ${time}.`,
      title: 'Hladna fermentacija',
      body: teglia
        ? 'Med hladno fermentacijo ena masa testa počasi razvija okus in strukturo. Zaprto posodo hranite v hladilniku, da se površina ne izsuši. Priporočena temperatura hladilnika je približno 3–5 °C. Posode ne odpirajte po nepotrebnem.'
        : 'Med hladno fermentacijo testo počasi razvija okus in strukturo. Posodo hranite zaprto, da se površina kroglic ne izsuši. Priporočena temperatura hladilnika je približno 3–5 °C. Posode ne odpirajte po nepotrebnem.',
    },
  }[lang];
  return {
    step: copy.step,
    stepInfo: { title: copy.title, body: copy.body },
    fridgeOutAt,
  };
}

function buildBeginnerColdFinalStart(schedule: HomePizzaPlanSchedule, lang: Lang, teglia: boolean) {
  const fridgeOutAt = getBeginnerFridgeOutAt(schedule);
  const time = formatBeginnerScheduledTime(fridgeOutAt, schedule.bakeAt, lang);
  const duration = formatDuration(schedule.roomAfterFridgeHours * 3600, lang);
  const copy = {
    hr: {
      step: teglia
        ? `U ${time} izvadite zatvorenu posudu s tijestom iz hladnjaka ${duration} prije pečenja. Tijesto ostavite pokriveno kao jednu masu do pripreme za tepsiju.`
        : `U ${time} izvadite fermentacijsku kutiju iz hladnjaka ${duration} prije pečenja. Kuglice ostavite pokrivene na sobnoj temperaturi do oblikovanja pizze.`,
      title: 'Temperiranje tijesta',
      body: teglia
        ? 'Jedna masa tijesta postupno se zagrijava do sobne temperature. Držite posudu zatvorenom i tijesto pokriveno; nemojte ga ponovno mijesiti ni dijeliti na kuglice.'
        : 'Tijesto iz hladnjaka može biti hladno i manje rastezljivo. Tijekom temperiranja postupno se zagrijava i lakše oblikuje. Kuglice nemojte ponovno mijesiti niti pritiskati. Kutiju držite zatvorenom kako se površina ne bi osušila.',
    },
    en: {
      step: teglia
        ? `At ${time}, take the closed dough container out of the refrigerator ${duration} before baking. Keep the dough covered as one mass until tray preparation.`
        : `At ${time}, take the fermentation box out of the refrigerator ${duration} before baking. Keep the dough balls covered at room temperature until shaping.`,
      title: 'Tempering the dough',
      body: teglia
        ? 'The single dough mass gradually warms to room temperature. Keep the container closed and the dough covered; do not knead it again or divide it into balls.'
        : 'Dough from the refrigerator may be cold and less extensible. During tempering it gradually warms and becomes easier to shape. Do not knead or press the balls again. Keep the box closed so the surface does not dry out.',
    },
    de: {
      step: teglia
        ? `Nehmen Sie den geschlossenen Teigbehälter um ${time}, ${duration} vor dem Backen, aus dem Kühlschrank. Lassen Sie den Teig bis zur Blechvorbereitung als eine abgedeckte Masse.`
        : `Nehmen Sie die Gärbox um ${time}, ${duration} vor dem Backen, aus dem Kühlschrank. Lassen Sie die Teigkugeln bis zum Formen abgedeckt bei Raumtemperatur.`,
      title: 'Teig temperieren',
      body: teglia
        ? 'Die einzelne Teigmasse erwärmt sich allmählich auf Raumtemperatur. Halten Sie den Behälter geschlossen und den Teig abgedeckt; nicht erneut kneten oder in Kugeln teilen.'
        : 'Teig aus dem Kühlschrank kann kalt und weniger dehnbar sein. Beim Temperieren erwärmt er sich allmählich und lässt sich leichter formen. Kneten oder drücken Sie die Kugeln nicht erneut. Halten Sie die Box geschlossen, damit die Oberfläche nicht austrocknet.',
    },
    sl: {
      step: teglia
        ? `Ob ${time} vzemite zaprto posodo s testom iz hladilnika ${duration} pred peko. Testo naj ostane pokrito v eni masi do priprave pekača.`
        : `Ob ${time} vzemite fermentacijsko posodo iz hladilnika ${duration} pred peko. Kroglice naj ostanejo pokrite pri sobni temperaturi do oblikovanja pice.`,
      title: 'Temperiranje testa',
      body: teglia
        ? 'Ena masa testa se postopoma segreje na sobno temperaturo. Posodo pustite zaprto in testo pokrito; ne gnetite ga znova in ga ne delite na kroglice.'
        : 'Testo iz hladilnika je lahko hladno in manj raztegljivo. Med temperiranjem se postopoma ogreje in lažje oblikuje. Kroglic ne gnetite ali pritiskajte znova. Posodo pustite zaprto, da se površina ne izsuši.',
    },
  }[lang];
  return { step: copy.step, stepInfo: { title: copy.title, body: copy.body } };
}

function buildBeginnerTegliaPreheat(
  schedule: HomePizzaPlanSchedule,
  preheatAt: Date,
  preheatMinutes: number,
  ovenTemp: number,
  lang: Lang,
  temperatureUnit: 'celsius' | 'fahrenheit',
): string {
  const oven = schedule.ovenType ?? 'homePan';
  const time = formatBeginnerClockTime(preheatAt, lang);
  const temperature = formatTemperature(ovenTemp, temperatureUnit);
  return ({
    hr: oven === 'homeStone'
      ? `U ${time} uključite pećnicu i zagrijavajte kamen ili čelik za pizzu ${preheatMinutes} minuta na ${temperature} s uključenim grillom.`
      : oven === 'ooni'
        ? `U ${time} uključite pizza peć i zagrijavajte je ${preheatMinutes} minuta na ${temperature} prema uputama proizvođača.`
        : `U ${time} uključite kućnu pećnicu s ventilacijom i zagrijte je ${preheatMinutes} minuta na ${temperature}.`,
    en: oven === 'homeStone'
      ? `At ${time}, turn on the oven and preheat the pizza stone or steel for ${preheatMinutes} minutes to ${temperature} with the grill on.`
      : oven === 'ooni'
        ? `At ${time}, turn on the pizza oven and preheat it for ${preheatMinutes} minutes to ${temperature} according to the manufacturer’s instructions.`
        : `At ${time}, turn on the convection oven and preheat it for ${preheatMinutes} minutes to ${temperature}.`,
    de: oven === 'homeStone'
      ? `Schalten Sie um ${time} den Ofen ein und heizen Sie Pizzastein oder -stahl ${preheatMinutes} Minuten lang auf ${temperature} mit eingeschaltetem Grill vor.`
      : oven === 'ooni'
        ? `Schalten Sie um ${time} den Pizzaofen ein und heizen Sie ihn ${preheatMinutes} Minuten lang gemäß Herstellerangaben auf ${temperature} vor.`
        : `Schalten Sie um ${time} den Umluftofen ein und heizen Sie ihn ${preheatMinutes} Minuten lang auf ${temperature} vor.`,
    sl: oven === 'homeStone'
      ? `Ob ${time} vklopite pečico in kamen ali jeklo za pico segrevajte ${preheatMinutes} minut na ${temperature} z vklopljenim žarom.`
      : oven === 'ooni'
        ? `Ob ${time} vklopite pizza pečico in jo segrevajte ${preheatMinutes} minut na ${temperature} po navodilih proizvajalca.`
        : `Ob ${time} vklopite domačo pečico z ventilacijo in jo segrevajte ${preheatMinutes} minut na ${temperature}.`,
  }[lang]);
}

function buildBeginnerFinalPhaseInfo(
  lang: Lang,
  style: PizzaStyle,
  flourType: FlourType,
  oven: OvenType,
  teglia = false,
): Array<{ title: string; body: string }> {
  const round = !teglia;
  const ny = style === 'ny_style';
  const romana = style === 'romana';
  const copy = {
    hr: [
      [teglia ? 'Odmor tijesta' : 'Temperiranje', teglia ? 'Tijesto ostaje jedna pokrivena masa. Ne dijelite ga na kuglice; slijedite raspored do pripreme tepsije.' : 'Hladne kuglice postupno se zagrijavaju i lakše oblikuju. Držite kutiju zatvorenom i kuglice pokrivene; nemojte ih ponovno mijesiti ni pritiskati.'],
      ['Predgrijavanje pećnice', oven === 'homeStone' && !teglia ? 'Kamen ili čelik stavite u hladnu pećnicu prije zagrijavanja. Kamen ili čelik postavite približno dvije razine ispod gornjeg grijača (grilla) kako bi se dobro zagrijali i primali snažnu toplinu odozgo. Ako predgrijavate s grillom, prije pečenja prijeđite na program Pizza ili gornji i donji grijač bez ventilatora. Koristite samo temperaturu koju dopuštaju pećnica i podloga.' : oven === 'ooni' ? 'Slijedite upute proizvođača pizza peći za sigurno zagrijavanje i provjerite temperaturu podloge prije pečenja. Ne dodirujte vruću unutrašnjost.' : 'Koristite lim za pečenje i način rada koji odgovara vašoj pećnici. Ne postavljajte prazan lim pod grill ako proizvođač to ne dopušta.'],
      ['Radna površina', flourType === 'glutenFree' ? 'Koristite certificirano bezglutensko brašno ili rižino brašno, ne pšeničnu semolu. Pospite umjereno; višak može zagorjeti ili isušiti tijesto.' : oven === 'homePan' || teglia ? 'Pripremite i lagano nauljite lim ili tepsiju prema receptu; nemojte dodavati nepotrebno brašno.' : 'Semola pomaže da se tijesto ne lijepi. Koristite je umjereno jer višak može zagorjeti na vrućem kamenu ili čeliku. Brašno za radnu površinu nije uključeno u izračun recepta.'],
      [teglia ? 'Rukovanje masom' : 'Vađenje kuglice', teglia ? 'Tijesto nježno odvojite strugačem i premjestite kao jednu masu. Ostavite ostale dijelove tijesta pokrivene; koristite lagano nauljene ruke ili strugač ako je masa ljepljiva.' : `${flourType === 'glutenFree' ? 'Upotrijebite strugač ili lagano nauljene ruke za nježno podizanje mekše kuglice. Ne pokušavajte je vući ili rastezati.' : 'Koristite lopaticu za tijesto ili lagano pobrašnjene ruke. Nemojte vući ili trgati tijesto.'} Ostale kuglice ostavite pokrivene dok ne dođu na red.`],
      [teglia ? 'Razvlačenje u tepsiji' : 'Oblikovanje', teglia ? 'Masu nježno rasporedite u nauljenoj tepsiji. Ako se skuplja, ostavite je pokrivenu da se opusti pa nastavite; kod ljepljivog tijesta koristite lagano nauljene prste ili strugač.' : flourType === 'glutenFree' ? 'Bezglutensko tijesto nježno pritisnite i oblikujte na bezglutenskoj ili rižinoj podlozi, uz strugač ili nauljene prste. Ne rastežite ga kao pšenično tijesto i ne pokušavajte oblikovati napuhani rub.' : romana ? 'Romanu oblikujte tanko i ravno pritiskanjem ili valjkom. Ako se tijesto opire, ostavite ga kratko pokriveno da se opusti; ne rastežite ga silom u zraku.' : ny ? 'New York pizzu oblikujte ujednačene debljine s tanjom sredinom i umjerenim rubom. Ne razvijajte visoki napuhani rub napolitane; ako se tijesto opire, ostavite ga kratko pokriveno.' : `Nježno potiskujte tijesto od sredine prema rubu i sačuvajte zrak u rubu. ${flourType === 'manitoba' ? 'Manitoba tijesto može biti elastično; pustite ga da se opusti ako se vraća.' : flourType === 'spelt' ? 'Pirovo tijesto je osjetljivije; izbjegavajte opetovano rastezanje.' : flourType === 'wholeWheat' ? 'Integralno tijesto može biti manje glatko i ljepljivije; oblikujte ga nježno.' : flourType === 'custom' ? 'Silu oblikovanja prilagodite stvarnoj elastičnosti i ljepljivosti mješavine.' : 'Ostavite rub približno 1–2 cm i nemojte koristiti valjak.'}`],
      ['Nadjev', 'Umak rasporedite tanko. Mozzarellu dobro ocijedite i ravnomjerno rasporedite. Ostavite rub bez nadjeva; kod tepsije nadjev rasporedite po površini prema receptu.'],
      ['Prijenos u pećnicu', teglia || oven === 'homePan' ? 'Premjestite pizzu u pripremljenu tepsiju ili ostavite pizzu u limu; koristite rukavice i ne dodirujte vrući lim.' : 'Provjerite da se pizza slobodno pomiče na lopati. Lagano je protresite i pažljivo prenesite na potpuno zagrijani kamen ili čelik. Oslobodite zalijepljeni dio uz minimalno semole; nikad ne dodirujte vruću podlogu rukom.'],
      ['Pečenje', oven === 'homeStone' ? 'Pratite boju ruba i dna te postojeći raspon pečenja. Koristite odobreni program ili gornji i donji grijač; grill uključite kratko samo ako je sigurno i potrebno.' : oven === 'ooni' ? 'Pratite pizzu cijelo vrijeme; u pizza peći se peče brzo. Rotirajte je prema postojećoj uputi i izvadite kada rub i dno dobiju odgovarajuću boju.' : 'Pratite boju vrha i dna u postojećem vremenskom rasponu. Grill koristite za završno rumenjenje samo ako je sigurno; ne ostavljajte pizzu bez nadzora.'],
    ],
    en: [
      [teglia ? 'Dough rest' : 'Tempering', teglia ? 'Keep the dough as one covered mass. Do not divide it into balls; follow the schedule until tray preparation.' : 'Cold dough balls warm gradually and become easier to shape. Keep the box closed and balls covered; do not knead or press them again.'],
      ['Oven preheating', oven === 'homeStone' && !teglia ? 'Place the stone or steel in the cold oven before heating. Position the stone or steel approximately two levels below the upper heating element (grill) so it heats thoroughly and receives strong heat from above. If preheating with the grill, switch to the Pizza program or top-and-bottom heat without a fan before baking. Use only temperatures allowed by the oven and baking surface.' : oven === 'ooni' ? 'Follow the pizza-oven manufacturer’s safe preheating instructions and check the baking surface before baking. Do not touch the hot interior.' : 'Use the baking tray and oven mode appropriate for your oven. Do not place an empty tray under the grill unless the manufacturer allows it.'],
      ['Work surface', flourType === 'glutenFree' ? 'Use certified gluten-free flour or rice flour, not wheat semolina. Dust lightly; excess can burn or dry the dough.' : oven === 'homePan' || teglia ? 'Prepare and lightly oil the tray as directed by the recipe; avoid adding unnecessary flour.' : 'Semolina helps prevent sticking. Use it sparingly because excess can burn on hot stone or steel. Work-surface flour is not included in the recipe calculation.'],
      [teglia ? 'Handle the dough mass' : 'Lift one dough ball', teglia ? 'Loosen the dough gently with a scraper and transfer it as one mass. Keep other dough covered; use lightly oiled hands or a scraper if it is sticky.' : `${flourType === 'glutenFree' ? 'Use a scraper or lightly oiled hands to lift the soft ball gently. Do not pull or stretch it.' : 'Use a dough spatula or lightly floured hands. Do not pull or tear the dough.'} Keep the remaining balls covered until needed.`],
      [teglia ? 'Stretch in the tray' : 'Shape the pizza', teglia ? 'Gently spread the mass in the oiled tray. If it springs back, cover and let it relax briefly before continuing; use lightly oiled fingers or a scraper for sticky dough.' : flourType === 'glutenFree' ? 'Gently press and shape gluten-free dough on a gluten-free or rice-floured surface, using a scraper or oiled fingers. Do not stretch it like wheat dough or try to form an airy rim.' : romana ? 'Shape Romana thin and flat by pressing or rolling. If the dough resists, cover it briefly to relax; do not force an airborne stretch.' : ny ? 'Shape New York pizza to an even thickness with a thinner center and moderate rim. Do not form a tall Neapolitan rim; cover briefly if the dough resists.' : `Gently press the dough from the center toward the edge, preserving gas in the rim. ${flourType === 'manitoba' ? 'Manitoba dough can be elastic; let it relax if it springs back.' : flourType === 'spelt' ? 'Spelt dough is more delicate; avoid repeated stretching.' : flourType === 'wholeWheat' ? 'Whole-wheat dough may be less smooth and stickier; shape gently.' : flourType === 'custom' ? 'Adjust shaping pressure to the blend’s actual elasticity and stickiness.' : 'Leave a rim about 1–2 cm wide and do not use a rolling pin.'}`],
      ['Toppings', 'Spread the sauce thinly. Drain the mozzarella well and distribute it evenly. Keep the rim clear; for tray pizza, distribute toppings over the surface as directed by the recipe.'],
      ['Transfer to the oven', teglia || oven === 'homePan' ? 'Move the pizza into the prepared tray or keep it in the baking tray; use oven gloves and do not touch a hot tray.' : 'Check that the pizza moves freely on the peel. Shake it gently and transfer it carefully to the fully heated stone or steel. Free any sticking with minimal semolina; never touch the hot surface by hand.'],
      ['Bake', oven === 'homeStone' ? 'Watch the rim and base and follow the existing bake range. Use the approved program or top-and-bottom heat; use the grill briefly only if safe and needed.' : oven === 'ooni' ? 'Watch the pizza continuously; pizza ovens bake quickly. Rotate it as directed and remove it when the rim and base have the right color.' : 'Watch the top and base within the existing bake range. Use the grill for browning only if safe; do not leave the pizza unattended.'],
    ],
    de: [
      [teglia ? 'Teigruhe' : 'Temperieren', teglia ? 'Lassen Sie den Teig als eine abgedeckte Masse. Teilen Sie ihn nicht in Kugeln; folgen Sie dem Zeitplan bis zur Blechvorbereitung.' : 'Kalte Teigkugeln erwärmen sich allmählich und lassen sich leichter formen. Halten Sie die Box geschlossen und die Kugeln abgedeckt; kneten oder drücken Sie sie nicht erneut.'],
      ['Ofen vorheizen', oven === 'homeStone' && !teglia ? 'Legen Sie Stein oder Stahl in den kalten Ofen, bevor Sie ihn aufheizen. Positionieren Sie Stein oder Stahl etwa zwei Ebenen unter dem oberen Heizelement (Grill), damit sie gut aufgeheizt werden und starke Hitze von oben aufnehmen. Wenn Sie mit Grill vorheizen, wechseln Sie vor dem Backen zum Pizza-Programm oder zu Ober-/Unterhitze ohne Umluft. Verwenden Sie nur Temperaturen, die Ofen und Backfläche erlauben.' : oven === 'ooni' ? 'Befolgen Sie die sicheren Aufheizanweisungen des Pizzaofen-Herstellers und prüfen Sie die Backfläche. Berühren Sie nicht den heißen Innenraum.' : 'Verwenden Sie Blech und Ofenmodus passend zu Ihrem Ofen. Stellen Sie ein leeres Blech nur dann unter den Grill, wenn der Hersteller dies erlaubt.'],
      ['Arbeitsfläche', flourType === 'glutenFree' ? 'Verwenden Sie zertifiziert glutenfreies Mehl oder Reismehl, keine Weizensemola. Sparsam bestäuben; zu viel Mehl kann verbrennen oder den Teig austrocknen.' : oven === 'homePan' || teglia ? 'Bereiten und ölen Sie das Blech leicht gemäß Rezept vor; verwenden Sie kein unnötiges zusätzliches Mehl.' : 'Semola verhindert das Kleben. Verwenden Sie sie sparsam, da Überschuss auf heißem Stein oder Stahl verbrennen kann. Arbeitsflächenmehl ist nicht in der Rezeptberechnung enthalten.'],
      [teglia ? 'Teigmasse handhaben' : 'Eine Teigkugel aufnehmen', teglia ? 'Lösen Sie den Teig vorsichtig mit einem Schaber und bewegen Sie ihn als eine Masse. Halten Sie den übrigen Teig abgedeckt; bei Klebrigkeit leicht geölte Hände oder einen Schaber verwenden.' : `${flourType === 'glutenFree' ? 'Heben Sie die weiche Kugel vorsichtig mit einem Schaber oder leicht geölten Händen an. Nicht ziehen oder dehnen.' : 'Verwenden Sie einen Teigspatel oder leicht bemehlte Hände. Ziehen oder reißen Sie den Teig nicht.'} Lassen Sie die übrigen Kugeln bis zur Verwendung abgedeckt.`],
      [teglia ? 'Im Blech ausbreiten' : 'Pizza formen', teglia ? 'Verteilen Sie die Masse vorsichtig im geölten Blech. Zieht sie sich zusammen, decken Sie sie kurz ab und lassen Sie sie entspannen; bei klebrigem Teig leicht geölte Finger oder Schaber verwenden.' : flourType === 'glutenFree' ? 'Drücken und formen Sie glutenfreien Teig vorsichtig auf einer glutenfreien oder mit Reismehl bestäubten Fläche, mit Schaber oder geölten Fingern. Nicht wie Weizenteig dehnen und keinen luftigen Rand erzwingen.' : romana ? 'Formen Sie Romana dünn und flach durch Drücken oder Rollen. Deckt sich der Teig, kurz abgedeckt entspannen lassen; nicht gewaltsam in der Luft dehnen.' : ny ? 'Formen Sie New York gleichmäßig dick mit dünnerer Mitte und mäßigem Rand. Keinen hohen neapolitanischen Rand formen; bei Widerstand kurz abgedeckt entspannen lassen.' : `Drücken Sie den Teig vorsichtig von der Mitte zum Rand und bewahren Sie das Gas im Rand. ${flourType === 'manitoba' ? 'Manitoba-Teig kann elastisch sein; bei Rückfedern entspannen lassen.' : flourType === 'spelt' ? 'Dinkelteig ist empfindlicher; wiederholtes Dehnen vermeiden.' : flourType === 'wholeWheat' ? 'Vollkornteig kann weniger glatt und klebriger sein; vorsichtig formen.' : flourType === 'custom' ? 'Passen Sie den Druck an Elastizität und Klebrigkeit der Mischung an.' : 'Lassen Sie etwa 1–2 cm Rand und verwenden Sie kein Nudelholz.'}`],
      ['Belag', 'Verteilen Sie die Sauce dünn. Lassen Sie den Mozzarella gut abtropfen und verteilen Sie ihn gleichmäßig. Lassen Sie den Rand frei; bei Blechpizza den Belag gemäß Rezept auf der Fläche verteilen.'],
      ['In den Ofen geben', teglia || oven === 'homePan' ? 'Legen Sie die Pizza in das vorbereitete Blech oder lassen Sie sie auf dem Backblech; verwenden Sie Ofenhandschuhe und berühren Sie kein heißes Blech.' : 'Prüfen Sie, ob sich die Pizza frei auf dem Schieber bewegt. Rütteln Sie leicht und legen Sie sie vorsichtig auf den vollständig aufgeheizten Stein oder Stahl. Lösen Sie klebende Stellen mit wenig Semola; berühren Sie die heiße Fläche niemals mit der Hand.'],
      ['Backen', oven === 'homeStone' ? 'Beobachten Sie Rand und Boden und beachten Sie den bestehenden Backzeitbereich. Nutzen Sie das freigegebene Programm oder Ober-/Unterhitze; den Grill nur bei Bedarf und sicher kurz verwenden.' : oven === 'ooni' ? 'Beobachten Sie die Pizza durchgehend; Pizzaöfen backen schnell. Drehen Sie sie wie angegeben und nehmen Sie sie heraus, wenn Rand und Boden passend gebräunt sind.' : 'Beobachten Sie Oberseite und Boden innerhalb des bestehenden Zeitbereichs. Den Grill nur sicher zum Bräunen nutzen; Pizza nicht unbeaufsichtigt lassen.'],
    ],
    sl: [
      [teglia ? 'Počitek testa' : 'Temperiranje', teglia ? 'Testo naj ostane pokrito v eni masi. Ne delite ga na kroglice; upoštevajte načrt do priprave pekača.' : 'Hladne kroglice se postopoma ogrejejo in lažje oblikujejo. Posodo pustite zaprto, kroglice pokrite; ne gnetite jih ali pritiskajte znova.'],
      ['Segrevanje pečice', oven === 'homeStone' && !teglia ? 'Kamen ali jeklo položite v hladno pečico pred segrevanjem. Kamen ali jeklo postavite približno dve ravni pod zgornji grelec (žar), da se dobro segrejeta in sprejemata močno toploto od zgoraj. Če segrevate z žarom, pred peko preklopite na program Pizza ali zgornje/spodnje gretje brez ventilatorja. Uporabite le temperature, ki jih dovoljujeta pečica in podlaga.' : oven === 'ooni' ? 'Upoštevajte varna navodila proizvajalca pizza pečice in pred peko preverite podlago. Ne dotikajte se vroče notranjosti.' : 'Uporabite pekač in način pečice, primeren za svojo pečico. Praznega pekača ne postavljajte pod žar, razen če to dovoljuje proizvajalec.'],
      ['Delovna površina', flourType === 'glutenFree' ? 'Uporabite certificirano brezglutensko ali riževo moko, ne pšeničnega zdroba. Potresite zmerno; presežek se lahko zažge ali izsuši testo.' : oven === 'homePan' || teglia ? 'Pekač pripravite in rahlo naoljite po receptu; ne dodajajte nepotrebne moke.' : 'Zdrob preprečuje lepljenje. Uporabite ga zmerno, saj se presežek na vročem kamnu ali jeklu lahko zažge. Moka za površino ni vključena v izračun recepta.'],
      [teglia ? 'Ravnanje z maso' : 'Vzemite eno kroglico', teglia ? 'Testo nežno ločite s strgalom in ga prenesite kot eno maso. Preostalo testo naj ostane pokrito; pri lepljivem testu uporabite rahlo naoljene roke ali strgalo.' : `${flourType === 'glutenFree' ? 'Mehko kroglico nežno dvignite s strgalom ali rahlo naoljenimi rokami. Ne vlecite ali raztegujte je.' : 'Uporabite lopatico za testo ali rahlo pomokane roke. Testa ne vlecite in ne trgajte.'} Preostale kroglice naj ostanejo pokrite do uporabe.`],
      [teglia ? 'Razporedite v pekaču' : 'Oblikujte pico', teglia ? 'Maso nežno razporedite v naoljenem pekaču. Če se krči, jo pokrijte in pustite kratek čas počivati; pri lepljivem testu uporabite rahlo naoljene prste ali strgalo.' : flourType === 'glutenFree' ? 'Brezglutensko testo nežno pritiskajte in oblikujte na brezglutenski ali riževi podlagi s strgalom ali naoljenimi prsti. Ne raztegujte ga kot pšenično testo in ne poskušajte oblikovati zračnega roba.' : romana ? 'Romano oblikujte tanko in ravno s pritiskanjem ali valjarjem. Če se testo upira, ga za kratek čas pokrijte; ne raztegujte ga na silo v zraku.' : ny ? 'New York pico oblikujte enakomerno debelo s tanjšo sredino in zmernim robom. Ne oblikujte visokega neapeljskega roba; ob upiranju testo za kratek čas pokrijte.' : `Testo nežno pritiskajte od sredine proti robu in ohranite plin v robu. ${flourType === 'manitoba' ? 'Manitobsko testo je lahko elastično; če se vrača, naj se sprosti.' : flourType === 'spelt' ? 'Pirino testo je občutljivejše; izogibajte se ponavljajočemu raztezanju.' : flourType === 'wholeWheat' ? 'Polnozrnato testo je lahko manj gladko in bolj lepljivo; oblikujte nežno.' : flourType === 'custom' ? 'Pritisk prilagodite dejanski elastičnosti in lepljivosti mešanice.' : 'Pustite približno 1–2 cm roba in ne uporabljajte valjarja.'}`],
      ['Nadev', 'Omako razporedite v tankem sloju. Mocarelo dobro odcedite in enakomerno razporedite. Rob pustite brez nadeva; pri pici iz pekača nadev razporedite po površini po receptu.'],
      ['Prenos v pečico', teglia || oven === 'homePan' ? 'Pico prenesite v pripravljen pekač oziroma jo pustite na pekaču; uporabite rokavice in se ne dotikajte vročega pekača.' : 'Preverite, ali se pica na loparju prosto premika. Lopar rahlo stresite in pico previdno prenesite na popolnoma segret kamen ali jeklo. Če se lepi, jo previdno sprostite z malo zdroba; vroče podlage se nikoli ne dotikajte z roko.'],
      ['Peka', oven === 'homeStone' ? 'Opazujte barvo roba in dna ter upoštevajte obstoječi čas peke. Uporabite ustrezen program ali zgornje/spodnje gretje; žar na kratko vključite le, če je varno in potrebno.' : oven === 'ooni' ? 'Pico ves čas spremljajte, saj se v pizza pečici speče hitro. Obračajte jo po obstoječih navodilih in vzemite ven, ko sta rob in dno ustrezno zapečena.' : 'Opazujte vrh in dno v obstoječem časovnem razponu. Žar uporabite za zapečenje le, če je varno; pice ne puščajte brez nadzora.'],
    ],
  }[lang];
  if (round) {
    const titles = {
      hr: ['Zašto tijesto mora odstajati na sobnoj temperaturi?', 'Zašto je važno dobro zagrijati pećnicu?', 'Zašto koristiti semolu?', 'Kako izvaditi kuglicu bez oštećenja?', 'Kako dobiti prozračan rub?', 'Zašto je važna količina nadjeva?', 'Kako spriječiti lijepljenje pizze za lopatu?', 'Kako znati da je pizza pečena?'],
      en: ['Why must the dough rest at room temperature?', 'Why is thorough oven preheating important?', 'Why use semolina?', 'How do you remove a dough ball without damaging it?', 'How do you get an airy rim?', 'Why does the topping quantity matter?', 'How do you prevent the pizza from sticking to the peel?', 'How do you know when the pizza is baked?'],
      de: ['Warum muss der Teig bei Raumtemperatur ruhen?', 'Warum ist gründliches Vorheizen wichtig?', 'Warum Semola verwenden?', 'Wie nimmt man eine Teigkugel unbeschädigt heraus?', 'Wie bekommt man einen luftigen Rand?', 'Warum ist die Menge des Belags wichtig?', 'Wie verhindert man, dass die Pizza am Schieber klebt?', 'Woran erkennt man, dass die Pizza fertig gebacken ist?'],
      sl: ['Zakaj mora testo počivati pri sobni temperaturi?', 'Zakaj je pomembno dobro segreti pečico?', 'Zakaj uporabiti zdrob?', 'Kako vzeti kroglico brez poškodb?', 'Kako dobiti zračen rob?', 'Zakaj je količina nadeva pomembna?', 'Kako preprečiti, da bi se pica prijela loparja?', 'Kako vemo, da je pica pečena?'],
    }[lang];
    copy.forEach((entry, index) => {
      entry[0] = titles[index];
    });
    copy[3][1] = {
      hr: 'Lagano pobrašnite ruke ili upotrijebite lopaticu za tijesto. Pažljivo odvojite kuglicu od dna i podignite je bez snažnog povlačenja. Izbjegavajte ponovno gnječenje jer biste istisnuli plin nastao tijekom fermentacije.',
      en: 'Lightly flour your hands or use a dough spatula. Carefully loosen the dough ball from the bottom and lift it without pulling hard. Avoid kneading it again, because this would press out the gas formed during fermentation.',
      de: 'Bemehlen Sie Ihre Hände leicht oder verwenden Sie einen Teigschieber. Lösen Sie die Teigkugel vorsichtig vom Boden und heben Sie sie ohne kräftiges Ziehen an. Kneten Sie sie nicht erneut, da sonst das während der Fermentation entstandene Gas entweicht.',
      sl: 'Roke rahlo pomokajte ali uporabite lopatico za testo. Kroglico previdno ločite od dna in jo dvignite brez močnega vlečenja. Ne gnetite je znova, saj bi iztisnili plin, nastal med fermentacijo.',
    }[lang];
    copy[5][1] = {
      hr: 'Previše umaka ili vlažne mozzarelle može natopiti sredinu tijesta i otežati pečenje. Mozzarellu unaprijed ocijedite i ravnomjerno rasporedite. Nakon dodavanja nadjeva nemojte dugo čekati prije pečenja.',
      en: 'Too much sauce or wet mozzarella can soak the centre of the dough and make baking harder. Drain the mozzarella in advance and distribute it evenly. Do not wait long after topping before baking.',
      de: 'Zu viel Sauce oder feuchter Mozzarella kann die Teigmitte durchweichen und das Backen erschweren. Lassen Sie den Mozzarella vorher abtropfen und verteilen Sie ihn gleichmäßig. Warten Sie nach dem Belegen nicht lange mit dem Backen.',
      sl: 'Preveč omake ali mokra mocarela lahko namočita sredino testa in otežita peko. Mocarelo vnaprej odcedite in jo enakomerno razporedite. Po dodajanju nadeva ne čakajte dolgo pred peko.',
    }[lang];
    copy[6][1] = oven === 'homePan'
      ? {
        hr: 'Pizzu pažljivo prenesite na pripremljeni lim i ne dodirujte vruće površine. Koristite rukavice prema potrebi.',
        en: 'Move the pizza carefully onto the prepared tray and avoid touching hot surfaces. Use oven gloves when needed.',
        de: 'Legen Sie die Pizza vorsichtig auf das vorbereitete Blech und berühren Sie keine heißen Flächen. Verwenden Sie bei Bedarf Ofenhandschuhe.',
        sl: 'Pico previdno prenesite na pripravljen pekač in se ne dotikajte vročih površin. Po potrebi uporabite rokavice.',
      }[lang]
      : {
        hr: 'Prije prebacivanja lagano protresite lopatu. Pizza bi se trebala slobodno pomicati. Ako se zalijepila, pažljivo je odvojite uz vrlo malo semole i pazite na vruće površine.',
        en: 'Before launching, gently shake the peel. The pizza should move freely. If it sticks, loosen it carefully with a very small amount of semolina and watch for hot surfaces.',
        de: 'Schütteln Sie den Schieber vor dem Einschießen leicht. Die Pizza sollte sich frei bewegen. Wenn sie klebt, lösen Sie sie vorsichtig mit sehr wenig Semola und achten Sie auf heiße Flächen.',
        sl: 'Pred prenosom lopar rahlo stresite. Pica se mora prosto premikati. Če se lepi, jo previdno sprostite z zelo malo zdroba in pazite na vroče površine.',
      }[lang];
  }
  const tegliaHelpOrder = [0, 1, 2, 4, 4, 5, 7, 7];
  const ordered = teglia ? tegliaHelpOrder.map((index) => copy[index]) : copy;
  if (teglia) {
    ordered[7] = {
      hr: ['Završno rumenjenje', 'Grill uključite tek na kraju i samo ako je to sigurno za vašu pećnicu. Pratite gornju stranu tijesta i isključite ga čim postigne željenu boju.'],
      en: ['Optional grill finish', 'Use the grill only at the end and only if safe for your oven. Watch the top closely and turn it off as soon as it reaches the desired color.'],
      de: ['Optionales Grill-Finish', 'Verwenden Sie den Grill nur am Ende und nur, wenn dies für Ihren Ofen sicher ist. Beobachten Sie die Oberseite und schalten Sie ihn aus, sobald die gewünschte Bräunung erreicht ist.'],
      sl: ['Zaključno zapečenje z žarom', 'Žar vključite šele na koncu in samo, če je to varno za vašo pečico. Opazujte zgornjo stran in ga izključite, ko doseže želeno barvo.'],
    }[lang];
  }
  return ordered
    .map(([title, body]) => ({ title, body }));
}

function formatBeginnerRoomRemaining(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function getBeginnerRoomEndLabel(lang: Lang): string {
  return {
    hr: 'Završetak sobne fermentacije',
    en: 'End of room-temperature fermentation',
    de: 'Ende der Raumtemperatur-Fermentation',
    sl: 'Konec fermentacije pri sobni temperaturi',
  }[lang];
}

function buildBeginnerRoomOnlyPhaseCEnd(lang: Lang, teglia: boolean, roomEnd: BeginnerRoomOnlyEnd | null) {
  const body = {
    round: {
      hr: 'Kuglice držite pokrivene kako se površina ne bi osušila. Trajanje fermentacije izračunato je prema odabranim postavkama. Kada fermentacija završi, nastavite prema završnoj fazi.',
      en: 'Keep the dough balls covered so the surface does not dry out. The fermentation time is calculated from your selected settings. When fermentation is complete, continue with the final phase.',
      de: 'Halten Sie die Teigkugeln abgedeckt, damit die Oberfläche nicht austrocknet. Die Fermentationsdauer wurde anhand Ihrer gewählten Einstellungen berechnet. Wenn die Fermentation abgeschlossen ist, fahren Sie mit der Endphase fort.',
      sl: 'Kroglice naj ostanejo pokrite, da se površina ne izsuši. Trajanje fermentacije je izračunano glede na izbrane nastavitve. Ko je fermentacija končana, nadaljujte z zaključno fazo.',
    },
    teglia: {
      hr: 'Tijesto držite u zatvorenoj fermentacijskoj posudi kako se površina ne bi osušila. Tijesto ostaje u jednoj masi. Kada fermentacija završi, nastavite prema završnoj fazi.',
      en: 'Keep the dough in the closed fermentation container so the surface does not dry out. The dough stays as one mass. When fermentation is complete, continue with the final phase.',
      de: 'Halten Sie den Teig im geschlossenen Gärbehälter, damit die Oberfläche nicht austrocknet. Der Teig bleibt eine einzelne Masse. Wenn die Fermentation abgeschlossen ist, fahren Sie mit der Endphase fort.',
      sl: 'Testo naj ostane v zaprti fermentacijski posodi, da se površina ne izsuši. Testo ostane v eni masi. Ko je fermentacija končana, nadaljujte z zaključno fazo.',
    },
  }[teglia ? 'teglia' : 'round'][lang];
  if (!roomEnd) return { step: null, help: body };
  const duration = formatBeginnerRoomRemaining(roomEnd.minutes);
  const step = teglia
    ? {
      hr: `Ostavite zatvorenu fermentacijsku posudu s tijestom na sobnoj temperaturi još ${duration}, prema izračunatom rasporedu.`,
      en: `Keep the closed fermentation container with the dough at room temperature for another ${duration}, according to the calculated schedule.`,
      de: `Lassen Sie den geschlossenen Gärbehälter mit dem Teig noch ${duration} bei Raumtemperatur stehen, nach dem berechneten Zeitplan.`,
      sl: `Zaprto fermentacijsko posodo s testom pustite še ${duration} pri sobni temperaturi, po izračunanem načrtu.`,
    }[lang]
    : {
      hr: `Ostavite zatvorenu kutiju s kuglicama na sobnoj temperaturi još ${duration}, prema izračunatom rasporedu.`,
      en: `Keep the closed box with the dough balls at room temperature for another ${duration}, according to the calculated schedule.`,
      de: `Lassen Sie die geschlossene Box mit den Teigkugeln noch ${duration} bei Raumtemperatur stehen, nach dem berechneten Zeitplan.`,
      sl: `Zaprto posodo s kroglicami pustite še ${duration} pri sobni temperaturi, po izračunanem načrtu.`,
    }[lang];
  return { step: `${step}\n${getBeginnerRoomEndLabel(lang)} — ${formatBeginnerClockTime(roomEnd.endAt, lang)}`, help: body };
}

function buildBeginnerRoomOnlyFinalStart(lang: Lang, teglia: boolean) {
  const step = teglia
    ? {
      hr: 'Nastavite držati tijesto pokriveno na sobnoj temperaturi do početka pripreme za razvlačenje u tepsiji.',
      en: 'Keep the dough covered at room temperature until it is time to prepare it for the tray.',
      de: 'Halten Sie den Teig bei Raumtemperatur abgedeckt, bis die Vorbereitung für das Blech beginnt.',
      sl: 'Testo naj ostane pokrito pri sobni temperaturi do začetka priprave za pekač.',
    }[lang]
    : {
      hr: 'Nastavite držati kuglice pokrivene na sobnoj temperaturi do početka oblikovanja pizze.',
      en: 'Keep the dough balls covered at room temperature until it is time to shape the pizza.',
      de: 'Halten Sie die Teigkugeln bei Raumtemperatur abgedeckt, bis es Zeit ist, die Pizza zu formen.',
      sl: 'Kroglice naj ostanejo pokrite pri sobni temperaturi do začetka oblikovanja pice.',
    }[lang];
  const info = teglia
    ? {
      hr: ['Bez ponovnog temperiranja', 'Tijesto je već na sobnoj temperaturi i ostaje u jednoj masi do predviđene pripreme za tepsiju. Nije potrebno ponovno temperiranje.'],
      en: ['No re-tempering needed', 'The dough is already at room temperature and stays as one mass until the scheduled tray preparation. No re-tempering is needed.'],
      de: ['Kein erneutes Temperieren', 'Der Teig hat bereits Raumtemperatur und bleibt bis zur geplanten Blechvorbereitung eine einzelne Masse. Ein erneutes Temperieren ist nicht nötig.'],
      sl: ['Ponovno temperiranje ni potrebno', 'Testo je že pri sobni temperaturi in ostane v eni masi do načrtovane priprave za pekač. Ponovno temperiranje ni potrebno.'],
    }[lang]
    : {
      hr: ['Bez ponovnog temperiranja', 'Kuglice su već na sobnoj temperaturi. Nije potrebno ponovno temperiranje. Nemojte ih dodatno mijesiti ili oblikovati dok ne dođe vrijeme za pripremu pizze.'],
      en: ['No re-tempering needed', 'The dough balls are already at room temperature. No re-tempering is needed. Do not knead or shape them further until it is time to prepare the pizza.'],
      de: ['Kein erneutes Temperieren', 'Die Teigkugeln haben bereits Raumtemperatur. Ein erneutes Temperieren ist nicht nötig. Kneten oder formen Sie sie nicht weiter, bis es Zeit ist, die Pizza vorzubereiten.'],
      sl: ['Ponovno temperiranje ni potrebno', 'Kroglice so že pri sobni temperaturi. Ponovno temperiranje ni potrebno. Ne gnetite jih in ne oblikujte dodatno, dokler ni čas za pripravo pice.'],
    }[lang];
  return { step, info: { title: info[0], body: info[1] } };
}

function buildBeginnerTegliaHomeSteps(
  phases: DetailedPhase[],
  schedule: HomePizzaPlanSchedule,
  phaseBPlan: BeginnerPhaseBPlan,
  roomTemp: number,
  lang: Lang,
  ovenTemp: number,
  bakingTimeRange: string,
  trayDimensions: { width: number; length: number },
  flourType: FlourType,
  sauceGrams = 0,
  cheeseGrams = 0,
  temperatureUnit: 'celsius' | 'fahrenheit' = 'celsius',
): DetailedPhase[] {
  const phaseBTitle = {
    hr: 'Prva fermentacija',
    en: 'First fermentation',
    de: 'Erste Fermentation',
    sl: 'Prva fermentacija',
  }[lang];
  const refrigerated = schedule.fridgeHours > 0;
  const total = formatDuration(Math.round(schedule.roomAfterFridgeHours * 60) * 60, lang);
  const copy = {
    hr: {
      out: `Izvadite tijesto iz hladnjaka u planirano vrijeme i ostavite ga ukupno ${total}; zadnjih 15 minuta tog razdoblja koristite za utiskivanje u tepsiju i dodavanje nadjeva.`,
      room: `Držite pokriveno tijesto kao jednu masu ukupno ${total}; zadnjih 15 minuta tog razdoblja koristite za utiskivanje u tepsiju i dodavanje nadjeva.`,
      outNow: 'Izvadite tijesto iz hladnjaka u planirano vrijeme i nastavite s pripremom tepsije.',
      roomNow: 'Držite tijesto pokriveno kao jednu masu i nastavite prema planiranom vremenu pripreme tepsije.',
    },
    en: {
      out: `Take the dough out of the refrigerator at the scheduled time and let it relax for ${total} in total; use the last 15 minutes of that period to press it into the tray and top it.`,
      room: `Keep the covered dough as one mass for ${total} in total; use the last 15 minutes of that period to press it into the tray and top it.`,
      outNow: 'Take the dough out of the refrigerator at the scheduled time and continue with tray preparation.',
      roomNow: 'Keep the dough covered as one mass and continue at the scheduled tray-preparation time.',
    },
    de: {
      out: `Nehmen Sie den Teig zum geplanten Zeitpunkt aus dem Kühlschrank und lassen Sie ihn insgesamt ${total} entspannen; nutzen Sie die letzten 15 Minuten dieses Zeitraums zum Einlegen in das Blech und Belegen.`,
      room: `Lassen Sie die abgedeckte Teigmasse insgesamt ${total} ruhen; nutzen Sie die letzten 15 Minuten dieses Zeitraums zum Einlegen in das Blech und Belegen.`,
      outNow: 'Nehmen Sie den Teig zum geplanten Zeitpunkt aus dem Kühlschrank und fahren Sie mit der Blechvorbereitung fort.',
      roomNow: 'Lassen Sie den Teig abgedeckt als eine Masse und fahren Sie zum geplanten Zeitpunkt mit der Blechvorbereitung fort.',
    },
    sl: {
      out: `Testo ob načrtovanem času vzemite iz hladilnika in ga skupaj ${total} pustite; zadnjih 15 minut tega obdobja uporabite za vtiskovanje v pekač in oblaganje.`,
      room: `Pokrito testo kot eno maso skupaj ${total} pustite; zadnjih 15 minut tega obdobja uporabite za vtiskovanje v pekač in oblaganje.`,
      outNow: 'Testo ob načrtovanem času vzemite iz hladilnika in nadaljujte s pripravo pekača.',
      roomNow: 'Testo pustite pokrito kot eno maso in nadaljujte ob načrtovanem času priprave pekača.',
    },
  }[lang];
  const tray = `${trayDimensions.width}×${trayDimensions.length} cm`;
  const pressSteps = {
    hr: {
      oil: `Lagano nauljite tepsiju ${tray}.`,
      press: 'Istresite masu u tepsiju i nježno je utisnite prstima do rubova bez rastezanja u zraku.',
      relax: 'Ako se tijesto vraća prema sredini, ostavite ga kratko da se opusti i ponovno ga utisnite.',
      top: sauceGrams > 0 || cheeseGrams > 0 ? `Ravnomjerno rasporedite ${Math.round(sauceGrams)} g umaka i ${Math.round(cheeseGrams)} g dobro ocijeđene mozzarelle.` : 'Ravnomjerno dodajte umak i dobro ocijeđenu mozzarellu.',
      bake: `Ubacite tepsiju u pećnicu i pecite bez grilla ${bakingTimeRange} na ${ovenTemp} °C, dok se dno i rub dobro ne ispeku.`,
      grill: 'Na kraju uključite grill ako želite jače zapečenu gornju stranu.',
    },
    en: {
      oil: `Lightly oil the ${tray} tray.`,
      press: 'Transfer the dough mass into the tray and gently press it to the edges with your fingertips, without stretching it in the air.',
      relax: 'If the dough springs back toward the center, let it relax briefly and press it out again.',
      top: sauceGrams > 0 || cheeseGrams > 0 ? `Spread ${Math.round(sauceGrams)} g sauce and ${Math.round(cheeseGrams)} g well-drained mozzarella evenly over the dough.` : 'Spread the sauce and well-drained mozzarella evenly over the dough.',
      bake: `Put the tray in the oven and bake without the grill for ${bakingTimeRange} at ${ovenTemp} °C, until the bottom and rim are well baked.`,
      grill: 'Finally, switch on the grill if you want a more browned top.',
    },
    de: {
      oil: `Ölen Sie das Blech ${tray} leicht ein.`,
      press: 'Geben Sie die Teigmasse in das Blech und drücken Sie sie mit den Fingerspitzen vorsichtig bis zu den Rändern, ohne sie in der Luft zu dehnen.',
      relax: 'Zieht sich der Teig zur Mitte zurück, lassen Sie ihn kurz entspannen und drücken Sie ihn erneut aus.',
      top: sauceGrams > 0 || cheeseGrams > 0 ? `Verteilen Sie ${Math.round(sauceGrams)} g Sauce und ${Math.round(cheeseGrams)} g gut abgetropften Mozzarella gleichmäßig auf dem Teig.` : 'Verteilen Sie Sauce und gut abgetropften Mozzarella gleichmäßig auf dem Teig.',
      bake: `Schieben Sie das Blech in den Ofen und backen Sie ohne Grill ${bakingTimeRange} bei ${ovenTemp} °C, bis Boden und Rand gut gebacken sind.`,
      grill: 'Schalten Sie am Ende den Grill ein, wenn Sie eine stärker gebräunte Oberseite möchten.',
    },
    sl: {
      oil: `Pekač ${tray} rahlo naoljite.`,
      press: 'Maso testa prenesite v pekač in jo s konicami prstov nežno potisnite do robov, brez raztegovanja v zraku.',
      relax: 'Če se testo vrača proti sredini, ga pustite kratek čas počivati in ga ponovno potisnite.',
      top: sauceGrams > 0 || cheeseGrams > 0 ? `Enakomerno razporedite ${Math.round(sauceGrams)} g omake in ${Math.round(cheeseGrams)} g dobro odcejene mocarele.` : 'Enakomerno razporedite omako in dobro odcejeno mocarelo.',
      bake: `Pekač postavite v pečico in pecite brez žara ${bakingTimeRange} pri ${ovenTemp} °C, dokler dno in rob nista dobro pečena.`,
      grill: 'Na koncu vklopite žar, če želite bolj zapečeno zgornjo stran.',
    },
  }[lang];
  const coldTitle = /cold fermentation|kalte fermentation|hladna fermentacija/i;
  const teglaRoomEnd = getBeginnerRoomOnlyEnd(
    schedule,
    schedule.preheatAt ?? new Date(schedule.bakeAt.getTime() - getBeginnerPreheatMinutes(schedule.ovenType ?? 'homePan') * 60000),
  );
  const tegliaPhaseC = buildBeginnerTegliaPhaseC(lang, refrigerated, flourType, teglaRoomEnd, schedule.fridgeAt, schedule.fridgeTemp);
  const activeBase = refrigerated ? phases : phases.filter((phase) => !coldTitle.test(phase.title));
  const hasPhaseC = activeBase.some((phase) => /(?:Phase|Faza) C\b/i.test(phase.title));
  const active = refrigerated || hasPhaseC || activeBase.length < 1
    ? activeBase
    : [
      ...activeBase.slice(0, -1),
      { title: tegliaPhaseC.title, steps: [] },
      activeBase[activeBase.length - 1],
    ];
  const phasesWithoutEmptyB = phaseBPlan.durationMinutes === 0
    ? active.filter((_, index) => index !== 1)
    : active;
  const lastIndex = active.length - 1;
  const adapted = phasesWithoutEmptyB.map((phase, activeIndex) => {
    const index = phaseBPlan.durationMinutes === 0 && activeIndex >= 1 ? activeIndex + 1 : activeIndex;
    if (index === 2) {
      return { ...phase, title: tegliaPhaseC.title, steps: tegliaPhaseC.steps, stepInfo: tegliaPhaseC.stepInfo, timers: [] };
    }
    if (coldTitle.test(phase.title)) {
      const coldPhase = buildBeginnerColdPhaseD(schedule, lang, true);
      return {
        ...phase,
        steps: [coldPhase.step],
        stepInfo: [coldPhase.stepInfo],
        fermentationInfo: undefined,
        fermentationSignsInfo: undefined,
        proofingInfo: undefined,
        timers: [],
      };
    }
    if (index === 1) {
      return { ...phase, title: phaseBTitle, steps: buildBeginnerPhaseBSteps(phaseBPlan, lang, true, flourType), timers: getBeginnerPhaseBTimers(phaseBPlan) };
    }
    if (index !== lastIndex || phase.steps.length < 4) return phase;
    const preheatAt = schedule.preheatAt ?? new Date(schedule.bakeAt.getTime() - getBeginnerPreheatMinutes(schedule.ovenType ?? 'homePan') * 60000);
    const preheatMinutes = Math.round((schedule.bakeAt.getTime() - preheatAt.getTime()) / 60000);
    const preheat = buildBeginnerTegliaPreheat(schedule, preheatAt, preheatMinutes, ovenTemp, lang, temperatureUnit);
    const roomFinalStart = refrigerated ? null : buildBeginnerRoomOnlyFinalStart(lang, true);
    const finalStepInfo = buildBeginnerFinalPhaseInfo(lang, 'romana', flourType, schedule.ovenType ?? 'homePan', true);
    if (roomFinalStart) finalStepInfo[0] = roomFinalStart.info;
    const coldFinalStart = refrigerated ? buildBeginnerColdFinalStart(schedule, lang, true) : null;
    if (coldFinalStart) finalStepInfo[0] = coldFinalStart.stepInfo;
    return {
      ...phase,
      stepInfo: finalStepInfo,
      temperingInfo: undefined,
      bakingInfo: undefined,
      bakingCheckInfo: undefined,
      ovenTimingInfo: undefined,
      ovenProgramInfo: undefined,
      containerOilInfo: undefined,
      fermentationInfo: undefined,
      fermentationSignsInfo: undefined,
      proofingInfo: undefined,
      degassingInfo: undefined,
      doughHandlingInfo: undefined,
      steps: [
        refrigerated
          ? coldFinalStart!.step
          : roomFinalStart!.step,
        preheat,
        pressSteps.oil,
        pressSteps.press,
        pressSteps.relax,
        pressSteps.top,
        pressSteps.bake,
        pressSteps.grill,
      ],
      timers: getBeginnerPhaseCTimers(schedule, Math.round(schedule.roomAfterFridgeHours * 60)),
    };
  });
  return addSequentialBeginnerPhaseLetters(adapted, lang);
}

function buildBeginnerTegliaPhaseC(
  lang: Lang,
  refrigerated: boolean,
  flourType: FlourType,
  roomEnd: BeginnerRoomOnlyEnd | null = null,
  fridgeAt?: Date,
  fridgeTemp?: number,
) {
  const fridgeEntryTime = refrigerated && fridgeAt ? formatBeginnerClockTime(fridgeAt, lang) : '';
  const fridgeTemperature = fridgeTemp ?? 4;
  const copy = {
    hr: {
      title: 'Faza C: Priprema mase za tepsiju',
      steps: [
        flourType === 'glutenFree' ? 'Lagano pospite čistu radnu površinu bezglutenskim ili rižinim brašnom. Brašno za radnu površinu nije uključeno u izračun recepta.' : 'Lagano pospite čistu radnu površinu brašnom. Brašno za radnu površinu nije uključeno u izračun recepta.',
        'Nježno izvadite tijesto iz posude uz minimalno istiskivanje plina.',
        'Ostavite tijesto u jednoj masi. Nemojte ga dijeliti na pojedinačne komade.',
        flourType === 'glutenFree' ? 'Nježno skupite tijesto u jednu masu pomoću strugalice ili lagano nauljenih ruku. Nemojte ga rastezati ni pokušavati razviti površinsku napetost.' : flourType === 'manitoba' ? 'Nježno skupite tijesto u kompaktnu masu. Manitoba tijesto može biti elastičnije i opirati se oblikovanju; nemojte ga siliti ni trgati. Prestanite čim tijesto zadrži oblik.' : flourType === 'spelt' ? 'Nježno skupite tijesto u jednu masu. Izbjegavajte ponavljano rastezanje i pretjerano zatezanje osjetljivijeg pirovog tijesta.' : flourType === 'wholeWheat' ? 'Nježno skupite tijesto u kompaktnu masu. Manje nepravilnosti na površini su prihvatljive; nemojte ga pretjerano zatezati.' : flourType === 'custom' ? 'Nježno skupite tijesto u kompaktnu masu. Prilagodite rukovanje njegovoj stvarnoj čvrstoći i ljepljivosti.' : 'Nježno skupite tijesto u kompaktnu masu. Lagano podvucite rubove i prestanite kada tijesto zadrži oblik.',
        'Stavite tijesto u odgovarajuću fermentacijsku posudu. Ostavite dovoljno prostora za povećanje volumena i zatvorite posudu.',
        refrigerated ? `U ${fridgeEntryTime} premjestite zatvorenu fermentacijsku posudu s jednom masom tijesta u hladnjak na približno ${fridgeTemperature} °C.` : 'Ostavite zatvorenu fermentacijsku posudu na sobnoj temperaturi i nastavite fermentaciju prema izračunatom rasporedu.',
      ],
      info: [
        ['Radna površina', flourType === 'glutenFree' ? 'Pripremite čistu i suhu površinu, strugač i vagu. Koristite bezglutensko brašno ili certificirano bezglutensko rižino brašno, nikada obično pšenično brašno, i rasporedite ga u tanak sloj.' : 'Pripremite čistu i suhu površinu, strugač i vagu. Koristite malu količinu brašna u tankom sloju; višak može otežati rukovanje.'],
        ['Vađenje tijesta', 'Strugačem nježno odvojite tijesto, nagnite posudu i pustite da masa polako klizne van uz potporu ruku ili strugača. Ne vucite, ne udarajte i ne rastežite agresivno; gubitak malo plina je normalan.'],
        ['Jedna masa', 'Romana Teglia ostaje jedna masa tijekom ove faze. Nemojte vagati pojedinačne kuglice niti oblikovati konvencionalne kuglice; ukupna masa već je izračunata za odabranu tepsiju.'],
        ['Oblikovanje mase', 'Masu nježno skupite bez pretjeranog istiskivanja plina i bez rastezanja do dimenzija tepsije. Kod bezglutenske mase koristite strugač ili lagano nauljene ruke; kod ostalih vrsta prilagodite pritisak stvarnoj čvrstoći i ljepljivosti.'],
        ['Fermentacijska posuda', 'Upotrijebite čistu posudu prikladnu za kontakt s hranom, s dovoljno prostora za povećanje volumena. Po potrebi je lagano nauljite, stavite jednu masu unutra i zatvorite je da se tijesto ne osuši.'],
        refrigerated ? ['Nastavak fermentacije', 'Provjerite izračunato vrijeme premještanja u hladnjak, držite jednu masu pokrivenu u zatvorenoj posudi i slijedite izračunato vrijeme vađenja i završnog temperiranja.'] : ['Nastavak fermentacije', 'Držite zatvorenu posudu na stabilnom mjestu, dalje od sunca i izvora topline. Slijedite izračunati raspored i ne produljujte fermentaciju nepotrebno.'],
      ],
    },
    en: {
      title: 'Phase C: Preparing the Tray Dough Mass',
      steps: [
        flourType === 'glutenFree' ? 'Lightly dust a clean work surface with gluten-free flour or certified gluten-free rice flour. Flour used for the work surface is not included in the recipe calculation.' : 'Lightly flour a clean work surface. Flour used for the work surface is not included in the recipe calculation.',
        'Gently remove the dough from the container while minimizing degassing.',
        'Keep the dough as one mass. Do not divide it into individual pieces.',
        flourType === 'glutenFree' ? 'Gently gather the dough into one mass using a scraper or lightly oiled hands. Do not stretch it or try to develop surface tension.' : flourType === 'manitoba' ? 'Gently gather the dough into a compact mass. Manitoba dough may be more elastic and resist shaping; do not force or tear it. Stop as soon as it holds its shape.' : flourType === 'spelt' ? 'Gently gather the dough into one mass. Avoid repeated stretching and excessive tightening of the more delicate spelt dough.' : flourType === 'wholeWheat' ? 'Gently gather the dough into a compact mass. Minor surface irregularities are acceptable; do not over-tighten it.' : flourType === 'custom' ? 'Gently gather the dough into a compact mass. Adapt handling to its actual firmness and stickiness.' : 'Gently gather the dough into a compact mass. Tuck the edges lightly and stop when it holds its shape.',
        'Place the dough in a suitable fermentation container. Leave enough room for expansion and close the container.',
        refrigerated ? `At ${fridgeEntryTime}, transfer the closed fermentation container with the single dough mass to the refrigerator at approximately ${fridgeTemperature} °C.` : 'Keep the closed fermentation container at room temperature and continue fermentation according to the calculated schedule.',
      ],
      info: [
        ['Work surface', flourType === 'glutenFree' ? 'Prepare a clean, dry surface, scraper, and scale. Use gluten-free flour or certified gluten-free rice flour, never regular wheat flour, and spread it in a thin layer.' : 'Prepare a clean, dry surface, scraper, and scale. Use a small amount of flour in a thin layer; excess flour can make handling difficult.'],
        ['Remove the dough', 'Loosen the dough gently with a scraper, tilt the container, and let the mass slide out slowly while supporting it with your hands or scraper. Do not pull, punch, or stretch aggressively; some gas loss is normal.'],
        ['One dough mass', 'Romana Teglia remains one mass during this phase. Do not weigh individual balls or form conventional dough balls; the total mass is already calculated for the selected tray.'],
        ['Handle the mass', 'Gather the mass gently without aggressively degassing or stretching it to tray dimensions. For gluten-free dough use a scraper or lightly oiled hands; for other flours adapt pressure to the actual firmness and stickiness.'],
        ['Fermentation container', 'Use a clean, food-safe container with enough room for expansion. Lightly oil it if needed, place the single mass inside, and close it to prevent drying.'],
        refrigerated ? ['Continue fermentation', 'Check the calculated fridge-in time, keep the single mass covered in the closed container, and follow the calculated fridge-out time and final tempering.'] : ['Continue fermentation', 'Keep the closed container in a stable place away from sunlight and heat sources. Follow the calculated schedule and do not extend fermentation unnecessarily.'],
      ],
    },
    de: {
      title: 'Phase C: Teigmasse für das Blech vorbereiten',
      steps: [
        flourType === 'glutenFree' ? 'Bestäuben Sie eine saubere Arbeitsfläche leicht mit glutenfreiem Mehl oder zertifiziert glutenfreiem Reismehl. Das Mehl für die Arbeitsfläche ist nicht in der Rezeptberechnung enthalten.' : 'Bestäuben Sie eine saubere Arbeitsfläche leicht mit Mehl. Das Mehl für die Arbeitsfläche ist nicht in der Rezeptberechnung enthalten.',
        'Nehmen Sie den Teig vorsichtig aus dem Behälter und drücken Sie dabei möglichst wenig Gas heraus.',
        'Lassen Sie den Teig als eine Masse. Teilen Sie ihn nicht in einzelne Stücke.',
        flourType === 'glutenFree' ? 'Sammeln Sie den Teig vorsichtig mit einem Schaber oder leicht geölten Händen zu einer Masse. Dehnen Sie ihn nicht und versuchen Sie nicht, Oberflächenspannung zu entwickeln.' : flourType === 'manitoba' ? 'Sammeln Sie den Teig vorsichtig zu einer kompakten Masse. Manitoba-Teig kann elastischer sein und sich widersetzen; erzwingen oder reißen Sie ihn nicht. Hören Sie auf, sobald er seine Form hält.' : flourType === 'spelt' ? 'Sammeln Sie den Teig vorsichtig zu einer Masse. Vermeiden Sie wiederholtes Dehnen und starkes Straffen des empfindlicheren Dinkelteigs.' : flourType === 'wholeWheat' ? 'Sammeln Sie den Teig vorsichtig zu einer kompakten Masse. Kleine Unregelmäßigkeiten sind akzeptabel; straffen Sie ihn nicht übermäßig.' : flourType === 'custom' ? 'Sammeln Sie den Teig vorsichtig zu einer kompakten Masse. Passen Sie die Behandlung an seine tatsächliche Festigkeit und Klebrigkeit an.' : 'Sammeln Sie den Teig vorsichtig zu einer kompakten Masse. Schlagen Sie die Ränder leicht ein und hören Sie auf, sobald er seine Form hält.',
        'Geben Sie den Teig in einen geeigneten Gärbehälter. Lassen Sie ausreichend Platz zum Aufgehen und schließen Sie den Behälter.',
        refrigerated ? `Stellen Sie den geschlossenen Gärbehälter mit der einzelnen Teigmasse um ${fridgeEntryTime} bei etwa ${fridgeTemperature} °C in den Kühlschrank.` : 'Lassen Sie den geschlossenen Gärbehälter bei Raumtemperatur stehen und setzen Sie die Fermentation nach dem berechneten Zeitplan fort.',
      ],
      info: [
        ['Arbeitsfläche', flourType === 'glutenFree' ? 'Bereiten Sie eine saubere, trockene Fläche, Schaber und Waage vor. Verwenden Sie glutenfreies Mehl oder zertifiziert glutenfreies Reismehl, niemals normales Weizenmehl, und verteilen Sie es dünn.' : 'Bereiten Sie eine saubere, trockene Fläche, Schaber und Waage vor. Verwenden Sie wenig Mehl in einer dünnen Schicht; zu viel Mehl erschwert die Handhabung.'],
        ['Teig herausnehmen', 'Lösen Sie den Teig vorsichtig mit einem Schaber, neigen Sie den Behälter und lassen Sie die Masse langsam herausgleiten, während Sie sie mit Händen oder Schaber stützen. Nicht ziehen, schlagen oder aggressiv dehnen; etwas Gasverlust ist normal.'],
        ['Eine Masse', 'Romana Teglia bleibt in dieser Phase eine Masse. Wiegen Sie keine einzelnen Kugeln und formen Sie keine herkömmlichen Teigkugeln; die Gesamtmasse ist bereits für das ausgewählte Blech berechnet.'],
        ['Masse behandeln', 'Sammeln Sie die Masse vorsichtig, ohne sie stark zu entgasen oder auf Blechgröße zu dehnen. Verwenden Sie bei glutenfreiem Teig einen Schaber oder leicht geölte Hände; passen Sie bei anderen Mehlen den Druck an Festigkeit und Klebrigkeit an.'],
        ['Gärbehälter', 'Verwenden Sie einen sauberen, lebensmittelechten Behälter mit ausreichend Platz zum Aufgehen. Ölen Sie ihn bei Bedarf leicht, geben Sie die einzelne Masse hinein und schließen Sie ihn gegen Austrocknen.'],
        refrigerated ? ['Fermentation fortsetzen', 'Prüfen Sie den berechneten Zeitpunkt zum Einräumen, lassen Sie die einzelne Masse im geschlossenen Behälter und beachten Sie Herausnehmen und abschließendes Temperieren nach Plan.'] : ['Fermentation fortsetzen', 'Stellen Sie den geschlossenen Behälter an einen stabilen Ort ohne Sonne und Wärmequellen. Befolgen Sie den berechneten Zeitplan und verlängern Sie die Fermentation nicht unnötig.'],
      ],
    },
    sl: {
      title: 'Faza C: Priprava mase za pekač',
      steps: [
        flourType === 'glutenFree' ? 'Čisto delovno površino rahlo posujte z brezglutensko moko ali certificirano brezglutensko riževo moko. Moka za delovno površino ni vključena v izračun recepta.' : 'Čisto delovno površino rahlo posujte z moko. Moka za delovno površino ni vključena v izračun recepta.',
        'Testo nežno vzemite iz posode in pri tem čim manj iztisnite plin.',
        'Testo pustite v eni masi. Ne delite ga na posamezne kose.',
        flourType === 'glutenFree' ? 'Testo nežno zberite v eno maso s strgalom ali rahlo naoljenimi rokami. Ne raztegujte ga in ne poskušajte ustvariti površinske napetosti.' : flourType === 'manitoba' ? 'Testo nežno zberite v kompaktno maso. Manitobsko testo je lahko bolj elastično in se upira oblikovanju; ne silite vanj in ga ne trgajte. Končajte, ko drži obliko.' : flourType === 'spelt' ? 'Testo nežno zberite v eno maso. Izogibajte se ponavljanemu raztezanju in pretiranemu zategovanju občutljivega pirinega testa.' : flourType === 'wholeWheat' ? 'Testo nežno zberite v kompaktno maso. Manjše nepravilnosti na površini so sprejemljive; ne zategujte ga preveč.' : flourType === 'custom' ? 'Testo nežno zberite v kompaktno maso. Ravnanje prilagodite dejanski čvrstosti in lepljivosti.' : 'Testo nežno zberite v kompaktno maso. Robove rahlo spodvijte in končajte, ko drži obliko.',
        'Testo položite v ustrezno fermentacijsko posodo. Pustite dovolj prostora za širjenje in posodo zaprite.',
        refrigerated ? `Ob ${fridgeEntryTime} zaprto fermentacijsko posodo z eno maso testa prestavite v hladilnik na približno ${fridgeTemperature} °C.` : 'Zaprto fermentacijsko posodo pustite pri sobni temperaturi in nadaljujte fermentacijo po izračunanem načrtu.',
      ],
      info: [
        ['Delovna površina', flourType === 'glutenFree' ? 'Pripravite čisto in suho površino, strgalo in tehtnico. Uporabite brezglutensko moko ali certificirano brezglutensko riževo moko, nikoli navadne pšenične moke, ter jo razporedite v tanek sloj.' : 'Pripravite čisto in suho površino, strgalo in tehtnico. Uporabite malo moke v tankem sloju; preveč moke oteži delo.'],
        ['Odstranitev testa', 'Testo nežno ločite s strgalom, posodo nagnite in pustite, da masa počasi zdrsne ven, pri tem pa jo podprite z rokami ali strgalom. Ne vlecite, udarjajte ali agresivno raztegujte; nekaj izgube plina je normalne.'],
        ['Ena masa', 'Romana Teglia v tej fazi ostane ena masa. Ne tehtajte posameznih kroglic in ne oblikujte običajnih kroglic; skupna masa je že izračunana za izbrani pekač.'],
        ['Ravnanje z maso', 'Maso nežno zberite brez močnega iztiskanja plina in brez raztegovanja do mer pekača. Pri brezglutenskem testu uporabite strgalo ali rahlo naoljene roke; pri drugih mokah pritisk prilagodite dejanski čvrstosti in lepljivosti.'],
        ['Fermentacijska posoda', 'Uporabite čisto posodo, primerno za stik z živili, z dovolj prostora za širjenje. Po potrebi jo rahlo naoljite, vanjo položite eno maso in jo zaprite, da se testo ne izsuši.'],
        refrigerated ? ['Nadaljevanje fermentacije', 'Preverite izračunani čas za prestavitev, eno maso pustite pokrito v zaprti posodi ter upoštevajte čas odvzema in končnega temperiranja po načrtu.'] : ['Nadaljevanje fermentacije', 'Zaprto posodo hranite na stabilnem mestu brez sonca in virov toplote. Upoštevajte izračunani načrt in fermentacije ne podaljšujte po nepotrebnem.'],
      ],
    },
  }[lang];
  if (!refrigerated) {
    const roomPhaseCEnd = buildBeginnerRoomOnlyPhaseCEnd(lang, true, roomEnd);
    if (roomPhaseCEnd.step) copy.steps[5] = roomPhaseCEnd.step;
    copy.info[5][1] = roomPhaseCEnd.help;
  }
  return { title: copy.title, steps: copy.steps, stepInfo: copy.info.map(([title, body]) => ({ title, body })) };
}

function buildNeapolitanDirectPhaseC(
  lang: Lang,
  totalDoughLabel: string,
  ballWeightLabel: string,
  pizzas: number,
  refrigerated: boolean,
  flourType: FlourType,
  roomEnd: BeginnerRoomOnlyEnd | null = null,
  fridgeAt?: Date,
  fridgeTemp?: number,
) {
  const fridgeEntryTime = refrigerated && fridgeAt ? formatBeginnerClockTime(fridgeAt, lang) : '';
  const fridgeTemperature = fridgeTemp ?? 4;
  const croatianPieceForm = pizzas >= 5 ? 'jednakih komada' : 'jednaka komada';
  const copy = {
    hr: {
      title: 'Faza C: Podjela i oblikovanje kuglica',
      steps: [
        'Lagano pospite čistu radnu površinu brašnom. Brašno za radnu površinu nije uključeno u izračun recepta.',
        'Nježno izvadite tijesto iz posude uz minimalno istiskivanje plina.',
        `Podijelite ukupno ${totalDoughLabel} tijesta na ${pizzas} ${croatianPieceForm} od približno ${ballWeightLabel}.`,
        'Svaki komad nježno oblikujte u kuglicu. Podvucite rubove prema donjoj strani i zatvorite spoj kako biste stvorili blagu površinsku napetost bez trganja tijesta.',
        'Stavite kuglice u fermentacijsku kutiju sa spojem prema dolje. Ostavite dovoljno razmaka između njih i zatvorite kutiju.',
        refrigerated
          ? `U ${fridgeEntryTime} premjestite zatvorenu fermentacijsku kutiju s kuglicama u hladnjak na približno ${fridgeTemperature} °C.`
          : 'Ostavite zatvorenu kutiju s kuglicama na sobnoj temperaturi i nastavite fermentaciju prema izračunatom rasporedu.',
      ],
      info: [
        ['Priprema radne površine', 'Pripremite čistu i suhu radnu površinu, strugač za tijesto i kuhinjsku vagu. Pospite malu količinu brašna i razmažite je u tanak sloj. Izbjegavajte višak brašna jer može otežati zatvaranje kuglica.'],
        ['Vađenje tijesta', 'Strugačem nježno odvojite tijesto od stijenki posude. Nagnite posudu i pustite da tijesto polako klizne van, podupirući ga rukama ili strugačem. Nemojte ga vući, udarati ni agresivno rastezati; gubitak male količine plina je normalan.'],
        ['Podjela tijesta', 'Strugačem odrežite jedan dio, stavite ga na kuhinjsku vagu i provjerite težinu. Po potrebi nježno dodajte ili uklonite male komade, pa ponovite za sve porcije. Slične težine daju ujednačene veličine pizza i ravnomjernije pečenje.'],
        ['Oblikovanje kuglica', 'Stavite porciju na lagano pobrašnjenu površinu. Rubove nježno podvucite ispod, zatvorite spoj i okrenite kuglicu spojem prema dolje. Lagano je povucite prema sebi da stvorite blagu površinsku napetost. Stanite kada je površina relativno glatka i kuglica drži oblik. Ako je ljepljiva, koristite strugač i minimalno brašna; ako se trga, prestanite zatezati. Izbjegavajte snažan pritisak, degaziranje i predugo oblikovanje.'],
        ['Fermentacijska kutija', 'Upotrijebite čistu posudu prikladnu za kontakt s hranom. Kuglice stavite spojem prema dolje i ostavite dovoljno prostora za širenje. Zatvorite poklopac kako se tijesto ne bi osušilo; po potrebi koristite pojedinačne pokrivene posude.'],
        ['Nastavak fermentacije', refrigerated ? 'Provjerite izračunato vrijeme premještanja u hladnjak i zatvoren poklopac. Kutiju stavite na stabilnu policu hladnjaka, slijedite izračunato vrijeme vađenja i završite planirano temperiranje. Hladnoća usporava fermentaciju, ali je ne zaustavlja potpuno.' : 'Držite kutiju na stabilnom mjestu, dalje od izravnog sunca, radijatora i drugih izvora topline. Slijedite izračunati raspored i nemojte nepotrebno produljivati fermentaciju. Viša sobna temperatura općenito ubrzava fermentaciju.'],
      ],
    },
    en: {
      title: 'Phase C: Dividing and Shaping Dough Balls',
      steps: [
        'Lightly flour a clean work surface. Flour used for the work surface is not included in the recipe calculation.',
        'Gently remove the dough from the container while minimizing degassing.',
        `Divide the total ${totalDoughLabel} of dough into ${pizzas} equal pieces of approximately ${ballWeightLabel} each.`,
        'Gently shape each piece into a dough ball. Tuck the edges underneath and close the seam to create light surface tension without tearing the dough.',
        'Place the dough balls seam-side down in a fermentation box. Leave enough space between them and close the box.',
        refrigerated
          ? `At ${fridgeEntryTime}, transfer the closed fermentation box with the dough balls to the refrigerator at approximately ${fridgeTemperature} °C.`
          : 'Keep the closed box with the dough balls at room temperature and continue fermentation according to the calculated schedule.',
      ],
      info: [
        ['Prepare the work surface', 'Prepare a clean, dry work surface, a dough scraper, and a kitchen scale. Sprinkle a small amount of flour and spread it into a thin layer. Avoid excess flour because it can make sealing the dough balls difficult.'],
        ['Remove the dough', 'Gently loosen the dough from the container with a scraper. Tilt the container and let the dough slide out slowly, supporting it with your hands or scraper. Do not pull, punch, or stretch it aggressively; some gas loss is normal.'],
        ['Divide the dough', 'Cut one portion with the dough scraper, place it on the kitchen scale, and check its weight. Gently add or remove small pieces if needed, then repeat for all portions. Similar weights produce consistent pizza sizes and more even baking.'],
        ['Shape the dough balls', 'Place a portion on the lightly floured surface. Gently fold the edges underneath, close the seam, and turn the ball seam-side down. Pull it lightly toward yourself to create gentle surface tension. Stop when the surface is relatively smooth and the ball holds its shape. If sticky, use the scraper and minimal flour; if it tears, stop tightening. Avoid heavy pressure, degassing, and overworking.'],
        ['Fermentation container', 'Use a clean, food-safe container. Place the dough balls seam-side down and leave enough room for expansion. Close the lid to prevent drying; use individual covered containers if necessary.'],
        ['Continue fermentation', refrigerated ? 'Check the calculated fridge-in time and make sure the lid is closed. Place the box on a stable refrigerator shelf, follow the calculated fridge-out time, and complete the scheduled final tempering. Refrigeration slows fermentation but does not stop it completely.' : 'Keep the container in a stable location away from direct sunlight, radiators, and other heat sources. Follow the calculated schedule and do not extend fermentation unnecessarily. Warmer room temperatures generally accelerate fermentation.'],
      ],
    },
    de: {
      title: 'Phase C: Teilen und Formen der Teigkugeln',
      steps: [
        'Bestäuben Sie eine saubere Arbeitsfläche leicht mit Mehl. Das Mehl für die Arbeitsfläche ist nicht in der Rezeptberechnung enthalten.',
        'Nehmen Sie den Teig vorsichtig aus dem Behälter und drücken Sie dabei möglichst wenig Gas heraus.',
        `Teilen Sie insgesamt ${totalDoughLabel} Teig in ${pizzas} gleich große Stücke von jeweils ungefähr ${ballWeightLabel}.`,
        'Formen Sie jedes Stück vorsichtig zu einer Teigkugel. Schlagen Sie die Ränder nach unten ein und schließen Sie die Naht, um leichte Oberflächenspannung zu erzeugen, ohne den Teig zu reißen.',
        'Legen Sie die Teigkugeln mit der Naht nach unten in eine Gärbox. Lassen Sie ausreichend Abstand zwischen ihnen und schließen Sie die Box.',
        refrigerated
          ? `Stellen Sie die geschlossene Gärbox mit den Teigkugeln um ${fridgeEntryTime} bei etwa ${fridgeTemperature} °C in den Kühlschrank.`
          : 'Lassen Sie die geschlossene Box mit den Teigkugeln bei Raumtemperatur stehen und setzen Sie die Fermentation nach dem berechneten Zeitplan fort.',
      ],
      info: [
        ['Arbeitsfläche vorbereiten', 'Bereiten Sie eine saubere, trockene Arbeitsfläche, einen Teigschaber und eine Küchenwaage vor. Streuen Sie wenig Mehl darüber und verteilen Sie es dünn. Zu viel Mehl kann das Verschließen der Teigkugeln erschweren.'],
        ['Teig herausnehmen', 'Lösen Sie den Teig vorsichtig mit einem Teigschaber von den Wänden. Neigen Sie den Behälter und lassen Sie den Teig langsam herausgleiten, während Sie ihn mit Händen oder Schaber stützen. Ziehen, schlagen oder dehnen Sie ihn nicht aggressiv; etwas Gasverlust ist normal.'],
        ['Teig teilen', 'Schneiden Sie mit dem Teigschaber eine Portion ab, legen Sie sie auf die Küchenwaage und prüfen Sie ihr Gewicht. Fügen Sie bei Bedarf vorsichtig kleine Stücke hinzu oder entfernen Sie sie, und wiederholen Sie dies für alle Portionen. Ähnliche Gewichte sorgen für gleichmäßige Pizzagrößen und gleichmäßigeres Backen.'],
        ['Teigkugeln formen', 'Legen Sie eine Portion auf die leicht bemehlte Fläche. Schlagen Sie die Ränder vorsichtig nach unten ein, schließen Sie die Naht und drehen Sie die Kugel mit der Naht nach unten. Ziehen Sie sie leicht zu sich, um sanfte Oberflächenspannung zu erzeugen. Hören Sie auf, wenn die Oberfläche relativ glatt ist und die Kugel ihre Form hält. Bei Klebrigkeit Schaber und wenig Mehl verwenden; bei Rissen nicht weiter straffen. Vermeiden Sie starken Druck, Entgasen und Überarbeiten.'],
        ['Gärbehälter', 'Verwenden Sie einen sauberen, lebensmittelechten Behälter. Legen Sie die Teigkugeln mit der Naht nach unten hinein und lassen Sie ausreichend Platz zum Aufgehen. Schließen Sie den Deckel gegen Austrocknen; bei Bedarf können einzelne abgedeckte Behälter verwendet werden.'],
        ['Fermentation fortsetzen', refrigerated ? 'Prüfen Sie den berechneten Zeitpunkt zum Einräumen in den Kühlschrank und schließen Sie den Deckel. Stellen Sie die Box auf eine stabile Kühlschrankablage, beachten Sie den Zeitpunkt zum Herausnehmen und führen Sie das geplante Temperieren durch. Kälte verlangsamt die Fermentation, stoppt sie aber nicht vollständig.' : 'Stellen Sie den Behälter an einen stabilen Ort, fern von direkter Sonne, Heizkörpern und anderen Wärmequellen. Befolgen Sie den berechneten Zeitplan und verlängern Sie die Fermentation nicht unnötig. Höhere Raumtemperaturen beschleunigen die Fermentation im Allgemeinen.'],
      ],
    },
    sl: {
      title: 'Faza C: Delitev in oblikovanje kroglic',
      steps: [
        'Čisto delovno površino rahlo posujte z moko. Moka za delovno površino ni vključena v izračun recepta.',
        'Testo nežno vzemite iz posode in pri tem čim manj iztisnite plin.',
        `Skupno ${totalDoughLabel} testa razdelite na ${pizzas} enakih kosov po približno ${ballWeightLabel}.`,
        'Vsak kos nežno oblikujte v kroglico. Robove spodvijte na spodnjo stran in zaprite stik, da ustvarite rahlo površinsko napetost brez trganja testa.',
        'Kroglice položite v fermentacijsko posodo s stikom navzdol. Med njimi pustite dovolj prostora in posodo zaprite.',
        refrigerated
          ? `Ob ${fridgeEntryTime} zaprto fermentacijsko posodo s kroglicami prestavite v hladilnik na približno ${fridgeTemperature} °C.`
          : 'Zaprto posodo s kroglicami pustite pri sobni temperaturi in nadaljujte fermentacijo po izračunanem načrtu.',
      ],
      info: [
        ['Priprava delovne površine', 'Pripravite čisto in suho delovno površino, strgalo za testo in kuhinjsko tehtnico. Potresite majhno količino moke in jo razporedite v tanek sloj. Preveč moke lahko oteži zapiranje kroglic.'],
        ['Odstranitev testa', 'Testo s strgalom nežno ločite od sten posode. Posodo nagnite in pustite, da testo počasi zdrsne ven, pri tem pa ga podprite z rokami ali strgalom. Ne vlecite, udarjajte ali agresivno raztegujte; nekaj izgube plina je normalne.'],
        ['Delitev testa', 'S strgalom odrežite en kos, ga položite na kuhinjsko tehtnico in preverite težo. Po potrebi nežno dodajte ali odstranite majhne koščke, nato ponovite za vse porcije. Podobne teže omogočajo enako velike pice in enakomernejšo peko.'],
        ['Oblikovanje kroglic', 'Porcijo položite na rahlo pomokano površino. Robove nežno prepognite spodaj, zaprite stik in kroglico obrnite s stikom navzdol. Rahlo jo povlecite proti sebi, da ustvarite nežno površinsko napetost. Končajte, ko je površina razmeroma gladka in kroglica drži obliko. Če je lepljiva, uporabite strgalo in najmanj moke; če se trga, nehajte zategovati. Izogibajte se močnemu pritisku, degaziranju in predolgemu delu.'],
        ['Fermentacijska posoda', 'Uporabite čisto posodo, primerno za stik z živili. Kroglice položite s stikom navzdol in pustite dovolj prostora za širjenje. Zaprite pokrov, da se testo ne izsuši; po potrebi uporabite posamezne pokrite posode.'],
        ['Nadaljevanje fermentacije', refrigerated ? 'Preverite izračunani čas za prestavitev v hladilnik in poskrbite, da je pokrov zaprt. Posodo postavite na stabilno polico hladilnika, upoštevajte izračunani čas odvzema in dokončajte načrtovano temperiranje. Hlajenje fermentacijo upočasni, vendar je ne ustavi popolnoma.' : 'Posodo hranite na stabilnem mestu, stran od neposrednega sonca, radiatorjev in drugih virov toplote. Upoštevajte izračunani načrt in fermentacije ne podaljšujte po nepotrebnem. Višja sobna temperatura fermentacijo običajno pospeši.'],
      ],
    },
  }[lang];
  const flourStep4 = {
    caputo00: {
      hr: copy.steps[3],
      en: copy.steps[3],
      de: copy.steps[3],
      sl: copy.steps[3],
    },
    manitoba: {
      hr: 'Svaki komad nježno oblikujte u kuglicu. Manitoba tijesto može biti elastičnije i opirati se oblikovanju; nemojte ga siliti ni trgati. Podvucite rubove, zatvorite spoj i prestanite kada kuglica drži oblik.',
      en: 'Gently shape each piece into a dough ball. Manitoba dough may be more elastic and resist shaping; do not force or tear it. Tuck the edges underneath, close the seam, and stop when the ball holds its shape.',
      de: 'Formen Sie jedes Stück vorsichtig zu einer Teigkugel. Manitoba-Teig kann elastischer sein und sich beim Formen widersetzen; erzwingen oder reißen Sie ihn nicht. Schlagen Sie die Ränder ein, schließen Sie die Naht und hören Sie auf, sobald die Kugel ihre Form hält.',
      sl: 'Vsak kos nežno oblikujte v kroglico. Manitobsko testo je lahko bolj elastično in se upira oblikovanju; ne silite vanj in ga ne trgajte. Robove spodvijte, zaprite stik in končajte, ko kroglica drži obliko.',
    },
    spelt: {
      hr: 'Svaki komad nježno oblikujte u kuglicu bez pretjeranog zatezanja. Ako se površina počne trgati, stanite. Nemojte tijesto opetovano rastezati ni previše obrađivati.',
      en: 'Gently shape each piece into a dough ball without excessive tightening. Stop if the surface begins to tear. Do not repeatedly stretch or overwork the dough.',
      de: 'Formen Sie jedes Stück vorsichtig zu einer Teigkugel, ohne es stark zu straffen. Hören Sie auf, wenn die Oberfläche zu reißen beginnt. Dehnen oder überarbeiten Sie den Teig nicht wiederholt.',
      sl: 'Vsak kos nežno oblikujte v kroglico brez pretiranega zategovanja. Če se površina začne trgati, nehajte. Testa ne raztegujte večkrat in ga ne obdelujte preveč.',
    },
    wholeWheat: {
      hr: 'Svaki komad nježno oblikujte u kuglicu bez stvaranja prevelike površinske napetosti. Površina može biti manje glatka, a malo ljepljivosti ili nepravilnosti je normalno. Nemojte tijesto siliti u savršeno glatku kuglicu.',
      en: 'Gently shape each piece into a dough ball without creating excessive surface tension. The surface may be less smooth, and some stickiness or minor irregularities are normal. Do not force the dough into a perfectly smooth ball.',
      de: 'Formen Sie jedes Stück vorsichtig zu einer Teigkugel, ohne zu viel Oberflächenspannung zu erzeugen. Die Oberfläche kann weniger glatt sein; etwas Klebrigkeit oder kleine Unregelmäßigkeiten sind normal. Zwingen Sie den Teig nicht in eine vollkommen glatte Kugel.',
      sl: 'Vsak kos nežno oblikujte v kroglico brez prevelike površinske napetosti. Površina je lahko manj gladka, nekaj lepljivosti ali manjših nepravilnosti pa je normalnih. Testa ne silite v popolnoma gladko kroglico.',
    },
    custom: {
      hr: 'Svaki komad nježno oblikujte u kuglicu. Podvucite rubove prema donjoj strani i zatvorite spoj. Jačinu oblikovanja prilagodite stvarnoj elastičnosti tijesta i prestanite kada kuglica drži oblik.',
      en: 'Gently shape each piece into a dough ball. Tuck the edges underneath and close the seam. Adapt the firmness of shaping to the dough’s actual elasticity and stop when the ball holds its shape.',
      de: 'Formen Sie jedes Stück vorsichtig zu einer Teigkugel. Schlagen Sie die Ränder ein und schließen Sie die Naht. Passen Sie die Stärke des Formens an die tatsächliche Elastizität des Teigs an und hören Sie auf, sobald die Kugel ihre Form hält.',
      sl: 'Vsak kos nežno oblikujte v kroglico. Robove spodvijte in zaprite stik. Moč oblikovanja prilagodite dejanski elastičnosti testa in končajte, ko kroglica drži obliko.',
    },
    glutenFree: {
      hr: 'Svaki komad nježno oblikujte u mekanu kuglicu pomoću strugača ili lagano nauljenih ruku. Zatvorite spoj koliko je moguće, ali nemojte stvarati površinsku napetost, snažno pritiskati ni rastezati smjesu.',
      en: 'Gently shape each piece into a soft dough ball using a scraper or lightly oiled hands. Close the seam as much as practical, but do not build surface tension, press firmly, or stretch the mixture.',
      de: 'Formen Sie jedes Stück vorsichtig mit einem Schaber oder leicht geölten Händen zu einer weichen Teigkugel. Schließen Sie die Naht so gut wie möglich, aber erzeugen Sie keine Oberflächenspannung, drücken Sie nicht fest und dehnen Sie die Masse nicht.',
      sl: 'Vsak kos nežno oblikujte v mehko kroglico s strgalom ali rahlo naoljenimi rokami. Stik zaprite, kolikor je mogoče, vendar ne ustvarjajte površinske napetosti, močno pritiskajte ali raztegujte zmesi.',
    },
  }[flourType] ?? {
    hr: copy.steps[3],
    en: copy.steps[3],
    de: copy.steps[3],
    sl: copy.steps[3],
  };
  const flourStep4Help = {
    caputo00: copy.info[3][1],
    manitoba: {
      hr: `${copy.info[3][1]} Manitoba tijesto može biti elastičnije i opirati se oblikovanju. Radite nježno i nemojte ga siliti ili trgati. Ako je potrebno, ostavite ga kratko pokrivenog da se opusti prije nastavka, ali nemojte time mijenjati izračunati raspored.`,
      en: `${copy.info[3][1]} Manitoba dough may be more elastic and resist shaping. Work gently and do not force or tear it. If necessary, leave it covered briefly to relax before continuing, without changing the calculated schedule.`,
      de: `${copy.info[3][1]} Manitoba-Teig kann elastischer sein und sich beim Formen widersetzen. Arbeiten Sie vorsichtig und erzwingen oder reißen Sie ihn nicht. Lassen Sie ihn bei Bedarf kurz abgedeckt entspannen, ohne den berechneten Zeitplan zu ändern.`,
      sl: `${copy.info[3][1]} Manitobsko testo je lahko bolj elastično in se upira oblikovanju. Delajte nežno in ga ne silite ali trgajte. Po potrebi ga pred nadaljevanjem za kratek čas pokritega pustite počivati, ne da bi spremenili izračunani načrt.`,
    }[lang],
    spelt: {
      hr: 'Stavite porciju na lagano pobrašnjenu površinu i rubove nježno podvucite ispod. Ne zatežite kuglicu više nego što je potrebno. Ako se površina počne trgati, stanite; nemojte tijesto opetovano rastezati ili previše obrađivati.',
      en: 'Place a portion on the lightly floured surface and gently tuck the edges underneath. Do not tighten the ball more than necessary. If the surface starts tearing, stop; do not repeatedly stretch or overwork the dough.',
      de: 'Legen Sie eine Portion auf die leicht bemehlte Fläche und schlagen Sie die Ränder vorsichtig ein. Straffen Sie die Kugel nicht stärker als nötig. Wenn die Oberfläche zu reißen beginnt, hören Sie auf; dehnen oder überarbeiten Sie den Teig nicht wiederholt.',
      sl: 'Porcijo položite na rahlo pomokano površino in robove nežno spodvijte. Kroglice ne zategujte bolj, kot je potrebno. Če se površina začne trgati, nehajte; testa ne raztegujte večkrat in ga ne obdelujte preveč.',
    }[lang],
    wholeWheat: {
      hr: 'Porciju nježno oblikujte bez pretjeranog zatezanja. Površina može ostati manje glatka, a malo ljepljivosti ili nepravilnosti je normalno. Ne pritiskajte jače samo da biste dobili savršeno glatku kuglicu.',
      en: 'Shape the portion gently without excessive tightening. The surface may remain less smooth, and some stickiness or irregularity is normal. Do not press harder just to make a perfectly smooth ball.',
      de: 'Formen Sie die Portion vorsichtig, ohne sie stark zu straffen. Die Oberfläche kann weniger glatt bleiben; etwas Klebrigkeit oder Unregelmäßigkeit ist normal. Drücken Sie nicht stärker, nur um eine vollkommen glatte Kugel zu erhalten.',
      sl: 'Porcijo oblikujte nežno brez pretiranega zategovanja. Površina lahko ostane manj gladka, nekaj lepljivosti ali nepravilnosti je normalnih. Ne pritiskajte močneje samo zato, da bi dobili popolnoma gladko kroglico.',
    }[lang],
    custom: {
      hr: 'Stavite porciju na lagano pobrašnjenu površinu. Rubove nježno podvucite ispod i zatvorite spoj, ali jačinu oblikovanja prilagodite stvarnoj elastičnosti, čvrstoći i ljepljivosti tijesta. Prestanite kada kuglica drži oblik.',
      en: 'Place a portion on the lightly floured surface. Gently tuck the edges underneath and close the seam, adapting the firmness of shaping to the dough’s actual elasticity, firmness, and stickiness. Stop when the ball holds its shape.',
      de: 'Legen Sie eine Portion auf die leicht bemehlte Fläche. Schlagen Sie die Ränder vorsichtig ein und schließen Sie die Naht. Passen Sie die Stärke des Formens an die tatsächliche Elastizität, Festigkeit und Klebrigkeit des Teigs an. Hören Sie auf, sobald die Kugel ihre Form hält.',
      sl: 'Porcijo položite na rahlo pomokano površino. Robove nežno spodvijte in zaprite stik, moč oblikovanja pa prilagodite dejanski elastičnosti, čvrstosti in lepljivosti testa. Končajte, ko kroglica drži obliko.',
    }[lang],
    glutenFree: {
      hr: 'Porciju stavite na podlogu i nježno je skupite strugačem ili lagano nauljenim rukama. Zatvorite spoj koliko je moguće, ali ne pokušavajte razviti gluten, stvarati napetost ili rastezati smjesu kao pšenično tijesto. Ako je smjesa ljepljiva, koristite strugač i minimalno dodatne obrade.',
      en: 'Gather the portion gently with a scraper or lightly oiled hands. Close the seam as much as practical, but do not try to develop gluten, create surface tension, or stretch the mixture like wheat dough. If sticky, use the scraper and minimal extra handling.',
      de: 'Sammeln Sie die Portion vorsichtig mit einem Schaber oder leicht geölten Händen. Schließen Sie die Naht so gut wie möglich, aber versuchen Sie nicht, Gluten oder Oberflächenspannung zu entwickeln oder die Masse wie Weizenteig zu dehnen. Bei Klebrigkeit Schaber und möglichst wenig zusätzliche Bearbeitung verwenden.',
      sl: 'Porcijo nežno zberite s strgalom ali rahlo naoljenimi rokami. Stik zaprite, kolikor je mogoče, vendar ne poskušajte razviti glutena, ustvariti površinske napetosti ali zmesi raztegovati kot pšenično testo. Če je lepljiva, uporabite strgalo in čim manj dodatnega dela.',
    }[lang],
  }[flourType] ?? copy.info[3][1];
  if (flourType === 'glutenFree') {
    copy.steps[0] = {
      hr: 'Lagano pospite čistu radnu površinu bezglutenskim ili rižinim brašnom. Brašno za radnu površinu nije uključeno u izračun recepta.',
      en: 'Lightly dust a clean work surface with gluten-free flour or certified gluten-free rice flour. Flour used for the work surface is not included in the recipe calculation.',
      de: 'Bestäuben Sie eine saubere Arbeitsfläche leicht mit glutenfreiem Mehl oder zertifiziert glutenfreiem Reismehl. Das Mehl für die Arbeitsfläche ist nicht in der Rezeptberechnung enthalten.',
      sl: 'Čisto delovno površino rahlo posujte z brezglutensko moko ali certificirano brezglutensko riževo moko. Moka za delovno površino ni vključena v izračun recepta.',
    }[lang];
    copy.info[0][1] = {
      hr: 'Pripremite čistu i suhu radnu površinu, strugač za tijesto i kuhinjsku vagu. Upotrijebite bezglutensko brašno ili certificirano bezglutensko rižino brašno i pospite malu količinu u tanak sloj. Izbjegavajte obično pšenično brašno i višak brašna jer mogu otežati zatvaranje kuglica.',
      en: 'Prepare a clean, dry work surface, a dough scraper, and a kitchen scale. Use gluten-free flour or certified gluten-free rice flour and spread a small amount into a thin layer. Avoid regular wheat flour and excess flour because they can make sealing the dough balls difficult.',
      de: 'Bereiten Sie eine saubere, trockene Arbeitsfläche, einen Teigschaber und eine Küchenwaage vor. Verwenden Sie glutenfreies Mehl oder zertifiziert glutenfreies Reismehl und verteilen Sie wenig davon dünn. Vermeiden Sie normales Weizenmehl und zu viel Mehl, da dies das Verschließen der Teigkugeln erschweren kann.',
      sl: 'Pripravite čisto in suho delovno površino, strgalo za testo in kuhinjsko tehtnico. Uporabite brezglutensko moko ali certificirano brezglutensko riževo moko ter majhno količino razporedite v tanek sloj. Izogibajte se navadni pšenični moki in preveliki količini moke, saj lahko otežita zapiranje kroglic.',
    }[lang];
  }
  copy.steps[3] = flourStep4[lang];
  copy.info[3][1] = flourStep4Help;
  if (!refrigerated) {
    const roomPhaseCEnd = buildBeginnerRoomOnlyPhaseCEnd(lang, false, roomEnd);
    if (roomPhaseCEnd.step) copy.steps[5] = roomPhaseCEnd.step;
    copy.info[5][1] = roomPhaseCEnd.help;
  }
  return {
    title: copy.title,
    steps: copy.steps,
    stepInfo: copy.info.map(([title, body]) => ({ title, body })),
  };
}

function buildBeginnerDirectHomeSteps(
  phases: DetailedPhase[],
  schedule: HomePizzaPlanSchedule,
  phaseBPlan: BeginnerPhaseBPlan,
  roomTemp: number,
  fridgeTemp: number,
  ovenTemp: number,
  oven: OvenType,
  bakingTimeRange: string,
  lang: Lang,
  yeastType: 'fresh' | 'dry',
  pizzaStyle: PizzaStyle,
  diameter: number,
  saucePerPizza: number,
  cheesePerPizza: number,
  flourType: FlourType = 'caputo00',
  totalDoughLabel: string,
  ballWeightLabel: string,
  pizzas: number,
): DetailedPhase[] {
  const fridgeEntryTime = schedule.fridgeAt ? formatBeginnerClockTime(schedule.fridgeAt, lang) : '';
  const fridgeTemperature = schedule.fridgeTemp ?? fridgeTemp;
  const phaseBTitle = {
    hr: 'Prva fermentacija',
    en: 'First fermentation',
    de: 'Erste Fermentation',
    sl: 'Prva fermentacija',
  }[lang];
  const isGlutenFree = flourType === 'glutenFree';
  const ballingInstruction = {
    hr: `Podijelite ukupno ${totalDoughLabel} tijesta na ${pizzas} jednakih komada od približno ${ballWeightLabel}. Svaki komad oblikujte nježno: podvucite rubove prema donjoj strani i zatvorite spoj kako biste stvorili površinsku napetost bez snažnog istiskivanja plina ili trganja tijesta.`,
    en: `Divide the total ${totalDoughLabel} of dough into ${pizzas} equal pieces of approximately ${ballWeightLabel} each. Shape each piece gently: tuck the edges underneath and seal the seam to create surface tension without aggressively degassing or tearing the dough.`,
    de: `Teilen Sie insgesamt ${totalDoughLabel} Teig in ${pizzas} gleich große Stücke von jeweils ungefähr ${ballWeightLabel}. Formen Sie jedes Stück vorsichtig: schlagen Sie die Ränder nach unten ein und schließen Sie die Naht, um Oberflächenspannung zu erzeugen, ohne das Gas stark auszudrücken oder den Teig zu reißen.`,
    sl: `Skupno ${totalDoughLabel} testa razdelite na ${pizzas} enakih kosov po približno ${ballWeightLabel}. Vsak kos nežno oblikujte: robove spodvijte na spodnjo stran in zaprite stik, da ustvarite površinsko napetost brez močnega iztiskanja plina ali trganja testa.`,
  }[lang];
  const ballingContainerInstruction = (schedule.fridgeHours > 0 ? {
    hr: `U ${fridgeEntryTime} stavite kuglice u fermentacijsku kutiju s dovoljno razmaka između njih, zatvorite kutiju i premjestite je u hladnjak na približno ${fridgeTemperature} °C.`,
    en: `At ${fridgeEntryTime}, place the dough balls in a fermentation box with enough space between them, close the box, and transfer it to the refrigerator at approximately ${fridgeTemperature} °C.`,
    de: `Legen Sie die Teigkugeln um ${fridgeEntryTime} mit ausreichend Abstand zueinander in eine Gärbox, schließen Sie die Box und stellen Sie sie bei etwa ${fridgeTemperature} °C in den Kühlschrank.`,
    sl: `Ob ${fridgeEntryTime} kroglice položite v fermentacijsko posodo z dovolj prostora med njimi, posodo zaprite in jo pri približno ${fridgeTemperature} °C prestavite v hladilnik.`,
  } : {
    hr: 'Stavite kuglice u zatvorenu fermentacijsku kutiju, ostavite dovoljno razmaka između njih i nastavite fermentaciju na sobnoj temperaturi prema izračunatom rasporedu.',
    en: 'Place the dough balls in a closed fermentation box, leave enough space between them, and continue fermentation at room temperature according to the calculated schedule.',
    de: 'Legen Sie die Teigkugeln mit ausreichend Abstand zueinander in eine geschlossene Gärbox und setzen Sie die Fermentation bei Raumtemperatur nach dem berechneten Zeitplan fort.',
    sl: 'Kroglice položite v zaprto fermentacijsko posodo, med njimi pustite dovolj prostora in nadaljujte fermentacijo pri sobni temperaturi po izračunanem načrtu.',
  })[lang];
  const fallbackPreheatMinutes = getBeginnerPreheatMinutes(oven);
  const preheatAt = schedule.preheatAt ?? new Date(schedule.bakeAt.getTime() - fallbackPreheatMinutes * 60000);
  const preheatMinutes = Math.round((schedule.bakeAt.getTime() - preheatAt.getTime()) / 60000);
  const labels = {
    hr: {
      fridge: (hours: string) => `Oblikovane kuglice stavite u zatvorenu kutiju i hladite ${hours} pri ${fridgeTemp} °C.`,
      takeOut: (hours: string) => `Izvadite kuglice iz hladnjaka ${hours} prije pečenja i ostavite ih pokrivene na sobnoj temperaturi.`,
      roomOnlyRestStart: (hours: string) => `Držite oblikovane kuglice pokrivene na sobnoj temperaturi do ${hours} prije pečenja.`,
      takeOutNow: 'Izvadite kuglice iz hladnjaka u planirano vrijeme i nastavite s oblikovanjem.',
      roomOnlyNow: 'Nakon oblikovanja kuglica nastavite prema planiranom vremenu pripreme.',
      preheat: (minutes: number, time: string) => oven === 'homePan'
        ? `U ${time} uključite kućnu pećnicu s ventilacijom i zagrijte je ${minutes} minuta na ${ovenTemp} °C.`
        : oven === 'ooni'
          ? `U ${time} uključite pizza peć i zagrijte je ${minutes} minuta na ${ovenTemp} °C.`
          : `U ${time} uključite pećnicu i zagrijte kamen ili čelik za pizzu ${minutes} minuta na ${ovenTemp} °C s uključenim grillom.`,
      bake: (time: string) => pizzaStyle === 'ny_style'
        ? `Pecite pizzu ${time} i po potrebi kratko završite grillom unutar tog raspona.`
        : `Pecite pizzu ${time}.`,
      yeast: yeastType === 'dry' ? 'suhog kvasca' : 'svježeg kvasca',
      briefRest: 'Ostavite tijesto kratko da odmori.',
    },
    en: {
      fridge: (hours: string) => `Place the dough balls in a closed fermentation box and refrigerate for ${hours} at ${fridgeTemp} °C.`,
      takeOut: (hours: string) => `Take the dough balls out of the refrigerator ${hours} before baking and leave them covered at room temperature.`,
      roomOnlyRestStart: (hours: string) => `Keep the shaped dough balls covered at room temperature until ${hours} before baking.`,
      takeOutNow: 'Take the dough balls out of the refrigerator at the scheduled time and continue with shaping.',
      roomOnlyNow: 'After shaping the dough balls, continue according to the planned preparation time.',
      preheat: (minutes: number, time: string) => oven === 'homePan'
        ? `At ${time}, turn on the convection oven and preheat it for ${minutes} minutes to ${ovenTemp} °C.`
        : oven === 'ooni'
          ? `At ${time}, turn on the pizza oven and preheat it for ${minutes} minutes to ${ovenTemp} °C.`
          : `At ${time}, turn on the oven and preheat the pizza stone or steel to ${ovenTemp} °C with the grill on for ${minutes} minutes.`,
      bake: (time: string) => pizzaStyle === 'ny_style'
        ? `Bake the pizza for ${time}, including any brief grill finish.`
        : `Bake the pizza for ${time}.`,
      yeast: yeastType === 'dry' ? 'dry yeast' : 'fresh yeast',
      briefRest: 'Let the dough rest briefly.',
    },
    de: {
      fridge: (hours: string) => `Legen Sie die Teigkugeln in eine geschlossene Box und stellen Sie sie für ${hours} bei ${fridgeTemp} °C in den Kühlschrank.`,
      takeOut: (hours: string) => `Nehmen Sie die Teigkugeln ${hours} vor dem Backen aus dem Kühlschrank und lassen Sie sie abgedeckt bei Raumtemperatur stehen.`,
      roomOnlyRestStart: (hours: string) => `Lassen Sie die geformten Teigkugeln bis ${hours} vor dem Backen abgedeckt bei Raumtemperatur stehen.`,
      takeOutNow: 'Nehmen Sie die Teigkugeln zum geplanten Zeitpunkt aus dem Kühlschrank und fahren Sie mit dem Formen fort.',
      roomOnlyNow: 'Fahren Sie nach dem Formen der Teigkugeln zum geplanten Vorbereitungszeitpunkt fort.',
      preheat: (minutes: number, time: string) => oven === 'homePan'
        ? `Schalten Sie um ${time} den Umluftbackofen ein und heizen Sie ihn ${minutes} Minuten lang auf ${ovenTemp} °C vor.`
        : oven === 'ooni'
          ? `Schalten Sie um ${time} den Pizzaofen ein und heizen Sie ihn ${minutes} Minuten lang auf ${ovenTemp} °C vor.`
          : `Schalten Sie um ${time} den Ofen ein und heizen Sie den Pizzastein oder -stahl ${minutes} Minuten lang auf ${ovenTemp} °C mit eingeschaltetem Grill vor.`,
      bake: (time: string) => pizzaStyle === 'ny_style'
        ? `Backen Sie die Pizza ${time}${lang === 'de' ? '' : '.'} Ein kurzer Grillabschluss ist in diesem Zeitraum enthalten.`
        : `Backen Sie die Pizza ${time}.`,
      yeast: yeastType === 'dry' ? 'Trockenhefe' : 'Frischhefe',
      briefRest: 'Lassen Sie den Teig kurz ruhen.',
    },
    sl: {
      fridge: (hours: string) => `Kroglice položite v zaprto posodo in jih hladite ${hours} pri ${fridgeTemp} °C.`,
      takeOut: (hours: string) => `Kroglice vzemite iz hladilnika ${hours} pred peko in jih pustite pokrite pri sobni temperaturi.`,
      roomOnlyRestStart: (hours: string) => `Oblikovane kroglice naj ostanejo pokrite pri sobni temperaturi do ${hours} pred peko.`,
      takeOutNow: 'Kroglice ob načrtovanem času vzemite iz hladilnika in nadaljujte z oblikovanjem.',
      roomOnlyNow: 'Po oblikovanju kroglic nadaljujte ob načrtovanem času priprave.',
      preheat: (minutes: number, time: string) => oven === 'homePan'
        ? `Ob ${time} vklopite domačo pečico z ventilacijo in jo segrevajte ${minutes} minut na ${ovenTemp} °C.`
        : oven === 'ooni'
          ? `Ob ${time} vklopite pizza pečico in jo segrevajte ${minutes} minut na ${ovenTemp} °C.`
          : `Ob ${time} vklopite pečico in kamen ali jeklo za pico segrevajte ${minutes} minut na ${ovenTemp} °C z vklopljenim žarom.`,
      bake: (time: string) => pizzaStyle === 'ny_style'
        ? `Pico pecite ${time}; čas vključuje morebitno kratko zapečenje pod žarom.`
        : `Pico pecite ${time}.`,
      yeast: yeastType === 'dry' ? 'suhega kvasa' : 'svežega kvasa',
      briefRest: 'Testo pustite kratek čas počivati.',
    },
  }[lang];
  const duration = (hours: number) => formatDuration(Math.round(hours * 60) * 60, lang);
  const replaceYeastLabel = (text: string) => labelSelectedYeast(text, lang, yeastType);
  const shapingSteps = ({
    hr: {
      surface: oven === 'homePan' ? 'Lagano nauljite tepsiju.' : 'Neposredno prije oblikovanja lagano pospite radnu površinu semolom.',
      ball: 'Nježno izvadite jednu kuglicu iz fermentacijske kutije, bez nepotrebnog istiskivanja zraka. Ostale kuglice ostavite pokrivene.',
      shape: pizzaStyle === 'romana'
        ? `Romanu oblikujte tanko i ravno do ${diameter} cm pritiskanjem prstima ili valjkom, bez agresivnog rastezanja u zraku.`
        : pizzaStyle === 'ny_style'
          ? `New York oblikujte ujednačene debljine s tanjom sredinom do ${diameter} cm; nemojte stvarati visok, napuhan rub. Kriška treba biti savitljiva.`
          : `Prstima nježno potiskujte tijesto od sredine prema rubu, ostavite rub približno 1–2 cm i razvucite do ${diameter} cm; ne koristite valjak.`,
      toppings: `Ravnomjerno rasporedite ${saucePerPizza} g umaka i ${cheesePerPizza} g dobro ocijeđene mozzarelle; ostavite rub bez nadjeva.`,
      launch: oven === 'homePan' ? 'Pizzu pažljivo stavite na pripremljeni lim i lim stavite u pećnicu.' : oven === 'ooni' ? 'Provjerite da se pizza slobodno pomiče na lopati, zatim je pažljivo ubacite u zagrijanu pizza peć.' : 'Provjerite da se pizza slobodno pomiče na lopati, zatim je pažljivo prebacite na potpuno zagrijani kamen ili čelik.',
      bake: oven === 'homeStone'
        ? `Isključite grill, koristite Pizza program ili gornji i donji grijač bez ventilatora. Pecite ${bakingTimeRange} na ${ovenTemp} °C i završite grillom za boju.`
        : oven === 'ooni'
          ? `Pecite ${bakingTimeRange} na ${ovenTemp} °C i rotirajte svakih 20–30 sekundi.`
          : `Pecite ${bakingTimeRange} na ${ovenTemp} °C; provjerite dno i po potrebi kratko završite gornjim grillom.`,
    },
    en: {
      surface: oven === 'homePan' ? 'Lightly oil the baking tray.' : 'Immediately before shaping, lightly dust the work surface with semolina.',
      ball: 'Gently remove one dough ball from the fermentation box without unnecessarily pressing out its gas. Keep the remaining dough balls covered.',
      shape: pizzaStyle === 'romana'
        ? `Shape Romana thin and flat to ${diameter} cm by pressing or rolling; do not stretch it aggressively in the air.`
        : pizzaStyle === 'ny_style'
          ? `Shape New York pizza to an even thickness with a thinner center to ${diameter} cm; do not create a tall, puffy rim. The slice should fold easily.`
          : `Gently press the dough from the center toward the edge, leave a rim about 1–2 cm wide, and stretch to ${diameter} cm; do not use a rolling pin.`,
      toppings: `Spread ${saucePerPizza} g sauce and ${cheesePerPizza} g well-drained mozzarella evenly, leaving the rim clear.`,
      launch: oven === 'homePan' ? 'Place the pizza carefully on the prepared tray and put the tray in the oven.' : oven === 'ooni' ? 'Check that the pizza moves freely on the peel, then launch it carefully into the preheated pizza oven.' : 'Check that the pizza moves freely on the peel, then transfer it carefully to the fully heated stone or steel.',
      bake: oven === 'homeStone'
        ? `Turn off the grill and use the Pizza program or top and bottom heat without a fan. Bake ${bakingTimeRange} at ${ovenTemp} °C; finish under the grill for color.`
        : oven === 'ooni'
          ? `Bake ${bakingTimeRange} at ${ovenTemp} °C, rotating every 20–30 seconds.`
          : `Bake ${bakingTimeRange} at ${ovenTemp} °C; check the base and finish briefly under the upper grill if needed.`,
    },
    de: {
      surface: oven === 'homePan' ? 'Fetten Sie das Backblech leicht ein.' : 'Bestäuben Sie die Arbeitsfläche unmittelbar vor dem Formen leicht mit Semola.',
      ball: 'Nehmen Sie eine Teigkugel vorsichtig aus der Gärbox, ohne unnötig Gas herauszudrücken. Lassen Sie die übrigen Teigkugeln abgedeckt.',
      shape: pizzaStyle === 'romana'
        ? `Formen Sie die Romana dünn und flach auf ${diameter} cm, indem Sie sie drücken oder rollen; nicht aggressiv in der Luft dehnen.`
        : pizzaStyle === 'ny_style'
          ? `Formen Sie New York gleichmäßig dick mit dünnerer Mitte auf ${diameter} cm; keinen hohen, aufgeblähten Rand formen. Das Stück soll faltbar sein.`
          : `Drücken Sie den Teig vorsichtig von der Mitte zum Rand, lassen Sie etwa 1–2 cm Rand und ziehen Sie ihn auf ${diameter} cm; kein Nudelholz.`,
      toppings: `Verteilen Sie ${saucePerPizza} g Sauce und ${cheesePerPizza} g gut abgetropften Mozzarella gleichmäßig; lassen Sie den Rand frei.`,
      launch: oven === 'homePan' ? 'Legen Sie die Pizza vorsichtig auf das vorbereitete Blech und schieben Sie das Blech in den Ofen.' : oven === 'ooni' ? 'Prüfen Sie, ob sich die Pizza frei auf dem Schieber bewegt, und schieben Sie sie vorsichtig in den vorgeheizten Pizzaofen.' : 'Prüfen Sie, ob sich die Pizza frei auf dem Schieber bewegt, und legen Sie sie vorsichtig auf den vollständig aufgeheizten Stein oder Stahl.',
      bake: oven === 'homeStone'
        ? `Schalten Sie den Grill aus und verwenden Sie das Pizza-Programm oder Ober-/Unterhitze ohne Umluft. Backen Sie ${bakingTimeRange} bei ${ovenTemp} °C und bräunen Sie am Ende mit dem Grill.`
        : oven === 'ooni'
          ? `Backen Sie ${bakingTimeRange} bei ${ovenTemp} °C und drehen Sie die Pizza alle 20–30 Sekunden.`
          : `Backen Sie ${bakingTimeRange} bei ${ovenTemp} °C; prüfen Sie den Boden und bräunen Sie bei Bedarf kurz unter dem oberen Grill.`,
    },
    sl: {
      surface: oven === 'homePan' ? 'Pekač rahlo naoljite.' : 'Tik pred oblikovanjem delovno površino rahlo posujte z zdrobom.',
      ball: 'Nežno vzemite eno kroglico iz fermentacijske posode, ne da bi po nepotrebnem iztisnili plin. Preostale kroglice naj ostanejo pokrite.',
      shape: pizzaStyle === 'romana'
        ? `Romano oblikujte tanko in ravno do ${diameter} cm s pritiskanjem ali valjarjem; ne raztegujte je agresivno v zraku.`
        : pizzaStyle === 'ny_style'
          ? `New York oblikujte enakomerno debelo s tanjšo sredino do ${diameter} cm; ne oblikujte visokega, napihnjenega roba. Rezina naj se zlahka prepogne.`
          : `Testo nežno pritiskajte od sredine proti robu, pustite približno 1–2 cm roba in ga raztegnite do ${diameter} cm; ne uporabljajte valjarja.`,
      toppings: `Enakomerno razporedite ${saucePerPizza} g omake in ${cheesePerPizza} g dobro odcejene mocarele; rob pustite prost.`,
      launch: oven === 'homePan' ? 'Pico previdno položite na pripravljen pekač in ga postavite v pečico.' : oven === 'ooni' ? 'Preverite, ali se pica prosto premika na loparju, nato jo previdno vstavite v segreto pizza pečico.' : 'Preverite, ali se pica prosto premika na loparju, nato jo previdno prenesite na popolnoma segret kamen ali jeklo.',
      bake: oven === 'homeStone'
        ? `Izklopite žar in uporabite program Pizza ali zgornje/spodnje gretje brez ventilatorja. Pecite ${bakingTimeRange} pri ${ovenTemp} °C; na koncu zapečite z žarom.`
        : oven === 'ooni'
          ? `Pecite ${bakingTimeRange} pri ${ovenTemp} °C in pico obračajte vsakih 20–30 sekund.`
          : `Pecite ${bakingTimeRange} pri ${ovenTemp} °C; preverite dno in po potrebi na kratko zaključite pod zgornjim žarom.`,
    },
  }[lang]);
  const glutenFreeShape = {
    hr: pizzaStyle === 'romana' ? `Bezglutensko tijesto nježno pritisnite ili razvaljajte do ${diameter} cm.` : pizzaStyle === 'ny_style' ? `Bezglutensko tijesto nježno utisnite u ujednačen oblik do ${diameter} cm.` : `Bezglutensko tijesto nježno pritisnite do ${diameter} cm; nemojte ga rastezati kao pšenično tijesto.`,
    en: pizzaStyle === 'romana' ? `Gently press or roll the gluten-free dough to ${diameter} cm.` : pizzaStyle === 'ny_style' ? `Gently press the gluten-free dough into an even shape to ${diameter} cm.` : `Gently press the gluten-free dough to ${diameter} cm; do not stretch it like wheat dough.`,
    de: pizzaStyle === 'romana' ? `Drücken oder rollen Sie den glutenfreien Teig vorsichtig auf ${diameter} cm.` : pizzaStyle === 'ny_style' ? `Drücken Sie den glutenfreien Teig vorsichtig gleichmäßig auf ${diameter} cm.` : `Drücken Sie den glutenfreien Teig vorsichtig auf ${diameter} cm; dehnen Sie ihn nicht wie Weizenteig.`,
    sl: pizzaStyle === 'romana' ? `Brezglutensko testo nežno pritisnite ali razvaljajte do ${diameter} cm.` : pizzaStyle === 'ny_style' ? `Brezglutensko testo nežno pritisnite v enakomerno obliko do ${diameter} cm.` : `Brezglutensko testo nežno pritisnite do ${diameter} cm; ne raztegujte ga kot pšenično testo.`,
  }[lang];
  const flourShapeNotes: Partial<Record<FlourType, Record<Lang, string>>> = {
    manitoba: { hr: 'Ako se tijesto vraća, kratko ga pokrijte i pustite da se opusti; nemojte ga siliti.', en: 'If the dough springs back, cover it briefly to relax; do not force it.', de: 'Deckt sich der Teig, kurz abdecken und entspannen lassen; nicht erzwingen.', sl: 'Če se testo krči, ga za kratek čas pokrijte; ne silite ga.' },
    spelt: { hr: 'Pirovo tijesto oblikujte nježno i izbjegavajte ponavljano rastezanje.', en: 'Handle spelt dough gently and avoid repeated stretching.', de: 'Dinkelteig vorsichtig behandeln und wiederholtes Dehnen vermeiden.', sl: 'Pirino testo oblikujte nežno in se izogibajte ponavljajočemu raztezanju.' },
    wholeWheat: { hr: 'Manje nepravilnosti i ljepljivosti su normalne; nemojte pretjerano zatezati.', en: 'Minor irregularities and stickiness are normal; do not over-tighten.', de: 'Kleine Unregelmäßigkeiten und Klebrigkeit sind normal; nicht übermäßig straffen.', sl: 'Manjše nepravilnosti in lepljivost so običajne; testa ne zategujte preveč.' },
    custom: { hr: 'Jačinu oblikovanja prilagodite stvarnoj elastičnosti i ljepljivosti mješavine.', en: 'Adjust shaping pressure to the blend’s actual elasticity and stickiness.', de: 'Passen Sie den Formdruck an Elastizität und Klebrigkeit der Mischung an.', sl: 'Pritisk prilagodite dejanski elastičnosti in lepljivosti mešanice.' },
  };
  const flourShapeNote = flourShapeNotes[flourType]?.[lang];
  const finalShapeStep = flourType === 'glutenFree'
    ? glutenFreeShape
    : `${shapingSteps.shape}${flourShapeNote ? ` ${flourShapeNote}` : ''}`;
  const finalDoughBallStep = flourType === 'glutenFree'
    ? ({ hr: 'Nježno podignite mekanu kuglicu strugačem ili lagano nauljenim rukama, bez pritiskanja.', en: 'Gently lift the soft dough ball with a scraper or lightly oiled hands without pressing it.', de: 'Heben Sie die weiche Teigkugel vorsichtig mit einem Schaber oder leicht geölten Händen an, ohne sie zu drücken.', sl: 'Mehko kroglico nežno dvignite s strgalom ali rahlo naoljenimi rokami, ne da bi jo pritiskali.' }[lang])
    : shapingSteps.ball;
  const finalWorkSurfaceStep = isGlutenFree
    ? ({ hr: 'Radnu površinu lagano pospite certificiranim bezglutenskim brašnom ili rižinim brašnom.', en: 'Lightly dust the work surface with certified gluten-free flour or rice flour.', de: 'Bestäuben Sie die Arbeitsfläche leicht mit zertifiziert glutenfreiem Mehl oder Reismehl.', sl: 'Delovno površino rahlo posujte s certificirano brezglutensko ali riževo moko.' }[lang])
    : shapingSteps.surface;

  const neapolitanPhaseC = buildNeapolitanDirectPhaseC(
    lang,
    totalDoughLabel,
    ballWeightLabel,
    pizzas,
    schedule.fridgeHours > 0,
    flourType,
    getBeginnerRoomOnlyEnd(schedule, preheatAt),
    schedule.fridgeAt,
    fridgeTemp,
  );
  const tipo00ColdFermentationStep = {
    hr: `Nastavite hladnu fermentaciju zatvorene kutije u hladnjaku ${formatDuration(schedule.fridgeHours * 3600, lang)} prema izračunanom rasporedu.`,
    en: `Continue cold fermentation of the closed box in the refrigerator for ${formatDuration(schedule.fridgeHours * 3600, lang)} according to the calculated schedule.`,
    de: `Setzen Sie die kalte Fermentation der geschlossenen Box im Kühlschrank ${formatDuration(schedule.fridgeHours * 3600, lang)} nach dem berechneten Zeitplan fort.`,
    sl: `Nadaljujte hladno fermentacijo zaprte posode v hladilniku ${formatDuration(schedule.fridgeHours * 3600, lang)} po izračunanem načrtu.`,
  }[lang];
  const activePhases = schedule.fridgeHours > 0
    ? phases
    : phases.filter((phase) => !/cold fermentation|kalte fermentation|hladna fermentacija/i.test(phase.title));
  const phasesWithoutEmptyB = schedule.phaseBMinutes === 0
    ? activePhases.filter((_, index) => index !== 1)
    : activePhases;
  const adapted = phasesWithoutEmptyB.map((phase, activeIndex) => {
    const index = schedule.phaseBMinutes === 0 && activeIndex >= 1 ? activeIndex + 1 : activeIndex;
    const steps = phase.steps.map(replaceYeastLabel);
    if (index === 0) {
      return {
        ...phase,
        steps,
        timers: phase.timers,
      };
    }
    if (index === 1) {
      return { ...phase, title: phaseBTitle, steps: buildBeginnerPhaseBSteps(phaseBPlan, lang, false, flourType), timers: getBeginnerPhaseBTimers(phaseBPlan) };
    }
    if (index === 2) {
      return {
        ...phase,
        ...(neapolitanPhaseC
          ? { title: neapolitanPhaseC.title, steps: neapolitanPhaseC.steps, stepInfo: neapolitanPhaseC.stepInfo }
          : {
            steps: steps.length > 1
              ? [...steps.slice(0, 2), ballingInstruction, ballingContainerInstruction]
              : steps,
          }),
        timers: [],
      };
    }
    if (index === 3 && schedule.fridgeHours > 0) {
      const coldPhase = buildBeginnerColdPhaseD(schedule, lang, false);
      return {
        ...phase,
        steps: [coldPhase.step],
        stepInfo: [coldPhase.stepInfo],
        fermentationInfo: undefined,
        fermentationSignsInfo: undefined,
        proofingInfo: undefined,
        timers: [],
      };
    }
    const finalPhaseIndex = schedule.fridgeHours > 0 ? 4 : 3;
    if (index === finalPhaseIndex) {
      const finalRestHours = schedule.roomAfterFridgeHours;
      const roomFinalStart = schedule.fridgeHours > 0 ? null : buildBeginnerRoomOnlyFinalStart(lang, false);
      const coldFinalStart = schedule.fridgeHours > 0 ? buildBeginnerColdFinalStart(schedule, lang, false) : null;
      const finalStepInfo = buildBeginnerFinalPhaseInfo(lang, pizzaStyle, flourType, oven);
      if (roomFinalStart) finalStepInfo[0] = roomFinalStart.info;
      if (coldFinalStart) finalStepInfo[0] = coldFinalStart.stepInfo;
      return {
        ...phase,
        stepInfo: finalStepInfo,
        temperingInfo: undefined,
        bakingInfo: undefined,
        bakingCheckInfo: undefined,
        ovenTimingInfo: undefined,
        ovenProgramInfo: undefined,
        containerOilInfo: undefined,
        fermentationInfo: undefined,
        fermentationSignsInfo: undefined,
        proofingInfo: undefined,
        degassingInfo: undefined,
        doughHandlingInfo: undefined,
        steps: [
          schedule.fridgeHours > 0
            ? coldFinalStart!.step
            : roomFinalStart!.step,
          labels.preheat(preheatMinutes, formatBeginnerClockTime(preheatAt, lang)),
          finalWorkSurfaceStep,
          finalDoughBallStep,
          finalShapeStep,
          shapingSteps.toppings,
          shapingSteps.launch,
          shapingSteps.bake,
        ],
        timers: getBeginnerPhaseCTimers(schedule, schedule.fridgeHours > 0 || schedule.roomAfterFridgeHours > 0
          ? Math.round(schedule.roomAfterFridgeHours * 60)
          : 0),
      };
    }
    return { ...phase, steps };
  });
  return addSequentialBeginnerPhaseLetters(adapted, lang);
}

function addSequentialBeginnerPhaseLetters(phases: DetailedPhase[], lang: Lang): DetailedPhase[] {
  const prefix = { hr: 'Faza', en: 'Phase', de: 'Phase', sl: 'Faza' }[lang];
  return phases.map((phase, index) => ({
    ...phase,
    title: `${prefix} ${String.fromCharCode(65 + index)}: ${phase.title.replace(/^(?:Faza|Phase|Fase)\s+[A-Z]:?\s*/i, '')}`,
  }));
}

function getDirectPhaseTimers(phaseKey: string, roomHours: number, fridgeHours: number): BaseTimer[] {
  const timers = PHASE_TIMER_DURATIONS[phaseKey] || [];
  if (phaseKey.endsWith('-B')) {
    const rtTimers = timers.filter((timer) => timer.kind !== 'fridge');
    if (fridgeHours <= 0) return rtTimers;
    return [
      ...rtTimers,
      { id: 'fridge-custom', seconds: fridgeHours * 3600, kind: 'fridge' },
    ];
  }
  if (phaseKey.endsWith('-C')) {
    if (fridgeHours > 0) {
      return timers.map((timer) => timer.kind === 'ballsFridge'
        ? { ...timer, seconds: fridgeHours * 3600 }
        : timer);
    }
    return [{ id: 'ballsRtHours', seconds: roomHours * 3600, kind: 'ballsRt' }];
  }
  if (phaseKey.endsWith('-D') && fridgeHours === 0) return [];
  return timers;
}

function getBeginnerPhaseBTimers(plan: BeginnerPhaseBPlan): BaseTimer[] {
  if (plan.durationMinutes <= 0) return [];
  if (plan.behavior === 'glutenFree') {
    return [{ id: 'beginner-phase-b-fermentation', seconds: plan.durationMinutes * 60, kind: 'rt' }];
  }

  const timers: BaseTimer[] = [];
  if (plan.folds[0]?.offsetMinutes > 0) {
    timers.push({ id: 'beginner-phase-b-rest-initial', seconds: plan.folds[0].offsetMinutes * 60, kind: 'rt' });
  }
  plan.folds.forEach((fold, index) => {
    const nextFold = plan.folds[index + 1];
    if (nextFold) {
      timers.push({
        id: `beginner-phase-b-rest-between-${fold.index}`,
        seconds: (nextFold.offsetMinutes - fold.offsetMinutes) * 60,
        kind: 'rt',
      });
    }
  });
  if (plan.finalRestMinutes > 0) {
    timers.push({ id: 'beginner-phase-b-rest-final', seconds: plan.finalRestMinutes * 60, kind: 'rt' });
  }
  return timers;
}

function getBeginnerPhaseCTimers(schedule: HomePizzaPlanSchedule, temperingMinutes: number): BaseTimer[] {
  const timers: BaseTimer[] = [];
  if (temperingMinutes > 0) {
    timers.push({ id: 'beginner-phase-c-tempering', seconds: temperingMinutes * 60, kind: schedule.fridgeHours > 0 ? 'preBake' : 'roomToBake' });
  }
  if (schedule.preheatAt) {
    const preheatSeconds = Math.round((schedule.bakeAt.getTime() - schedule.preheatAt.getTime()) / 1000);
    if (preheatSeconds > 0) timers.push({ id: 'beginner-phase-c-preheat', seconds: preheatSeconds, kind: 'preheat' });
  }
  return timers;
}

function getStretchFoldGuideCopy(lang: Lang, slide: number) {
  const copy = [
    {
      hr: {
        how: 'Lagano navlažite ruke. Uhvatite tijesto objema rukama s dvije suprotne strane, bez snažnog stiskanja.',
        look: 'Tijesto treba biti povezano, glatko i dovoljno elastično za nježno podizanje.',
      },
      en: {
        how: 'Lightly wet your hands. Hold the dough with both hands from two opposite sides without squeezing it firmly.',
        look: 'The dough should be cohesive, smooth, and elastic enough to lift gently.',
      },
      de: {
        how: 'Befeuchten Sie Ihre Hände leicht. Fassen Sie den Teig mit beiden Händen an zwei gegenüberliegenden Seiten, ohne ihn fest zu drücken.',
        look: 'Der Teig sollte verbunden, glatt und elastisch genug sein, um ihn sanft anzuheben.',
      },
      sl: {
        how: 'Rahlo navlažite roke. Z obema rokama primite testo na dveh nasprotnih straneh, brez močnega stiskanja.',
        look: 'Testo naj bo povezano, gladko in dovolj elastično za nežno dviganje.',
      },
    },
    {
      hr: {
        how: 'Objema rukama polako podignite tijesto prema gore. Pustite da se pod vlastitom težinom nježno rastegne.',
        look: 'Tijesto se ravnomjerno rasteže, bez pucanja ili odvajanja dijelova.',
      },
      en: {
        how: 'Slowly lift the dough upward with both hands. Let it gently stretch under its own weight.',
        look: 'The dough stretches evenly without tearing or separating into pieces.',
      },
      de: {
        how: 'Heben Sie den Teig langsam mit beiden Händen an. Lassen Sie ihn sich durch sein eigenes Gewicht sanft dehnen.',
        look: 'Der Teig dehnt sich gleichmäßig, ohne zu reißen oder sich zu teilen.',
      },
      sl: {
        how: 'Z obema rokama počasi dvignite testo. Pustite, da se pod lastno težo nežno raztegne.',
        look: 'Testo se enakomerno raztegne, brez trganja ali ločevanja delov.',
      },
    },
    {
      hr: {
        how: 'Lagano spustite podignuto tijesto prema sredini posude tako da se preklopi preko ostatka tijesta.',
        look: 'Preklop treba biti mekan i uredan, bez snažnog pritiskanja tijesta.',
      },
      en: {
        how: 'Gently lower the lifted dough toward the center of the container so it folds over the remaining dough.',
        look: 'The fold should be soft and neat, without pressing the dough firmly.',
      },
      de: {
        how: 'Lassen Sie den angehobenen Teig sanft zur Mitte der Schüssel sinken, sodass er sich über den restlichen Teig legt.',
        look: 'Die Faltung sollte weich und ordentlich sein, ohne den Teig stark zu drücken.',
      },
      sl: {
        how: 'Dvignjeno testo nežno spustite proti sredini posode, da se prepogne čez preostalo testo.',
        look: 'Pregib naj bo mehak in urejen, brez močnega pritiskanja testa.',
      },
    },
    {
      hr: {
        how: 'Ponovite nježno podizanje i preklapanje prema postojećim uputama recepta. Nemojte nepotrebno gnječiti tijesto.',
        look: 'Tijesto postupno postaje glađe, povezanije i blago zategnuto.',
      },
      en: {
        how: 'Repeat the gentle lifting and folding according to the recipe instructions. Do not knead the dough unnecessarily.',
        look: 'The dough gradually becomes smoother, more cohesive, and lightly tightened.',
      },
      de: {
        how: 'Wiederholen Sie das sanfte Anheben und Falten gemäß den Rezeptanweisungen. Kneten Sie den Teig nicht unnötig.',
        look: 'Der Teig wird allmählich glatter, verbundener und leicht gestrafft.',
      },
      sl: {
        how: 'Nežno dviganje in prepogib ponovite po navodilih recepta. Testa ne gnetite po nepotrebnem.',
        look: 'Testo postopoma postaja bolj gladko, povezano in rahlo napeto.',
      },
    },
    {
      hr: {
        how: 'Ostavite tijesto u posudi i pokrijte ga prema uputama recepta.',
        look: 'Tijesto treba imati glatku, blago zategnutu površinu i ostati jedna povezana masa.',
      },
      en: {
        how: 'Leave the dough in the container and cover it according to the recipe instructions.',
        look: 'The dough should have a smooth, lightly tightened surface and remain one cohesive mass.',
      },
      de: {
        how: 'Lassen Sie den Teig in der Schüssel und decken Sie ihn gemäß den Rezeptanweisungen ab.',
        look: 'Der Teig sollte eine glatte, leicht gespannte Oberfläche haben und eine verbundene Masse bleiben.',
      },
      sl: {
        how: 'Testo pustite v posodi in ga pokrijte po navodilih recepta.',
        look: 'Testo naj ima gladko, rahlo napeto površino in ostane ena povezana masa.',
      },
    },
  ];
  return copy[Math.min(slide, copy.length - 1)][lang];
}

function getBallingGuideCopy(lang: Lang, slide: number) {
  const copy = [
    {
      hr: {
        how: 'Lagano pospite čistu radnu površinu brašnom. Koristite samo toliko brašna koliko je potrebno da se tijesto ne lijepi.',
        look: 'Radna površina treba biti lagano i ravnomjerno pobrašnjena, bez debelog sloja brašna.',
      },
      en: {
        how: 'Lightly dust a clean work surface with flour. Use only enough flour to prevent the dough from sticking.',
        look: 'The work surface should be lightly and evenly floured, without a thick layer of flour.',
      },
      de: {
        how: 'Bestäuben Sie eine saubere Arbeitsfläche leicht mit Mehl. Verwenden Sie nur so viel Mehl, dass der Teig nicht klebt.',
        look: 'Die Arbeitsfläche sollte leicht und gleichmäßig bemehlt sein, ohne eine dicke Mehlschicht.',
      },
      sl: {
        how: 'Čisto delovno površino rahlo posujte z moko. Uporabite le toliko moke, da se testo ne bo prijemalo.',
        look: 'Delovna površina naj bo rahlo in enakomerno pomokana, brez debele plasti moke.',
      },
    },
    {
      hr: {
        how: 'Nježno izvadite tijesto iz posude pomoću ruku ili lopatice za tijesto. Izbjegavajte snažno povlačenje i nepotrebno istiskivanje plina.',
        look: 'Tijesto treba ostati povezano i elastično, bez većih pukotina ili nepotrebnog gnječenja.',
      },
      en: {
        how: 'Gently remove the dough from the container using your hands or a dough scraper. Avoid pulling firmly or unnecessarily degassing it.',
        look: 'The dough should remain cohesive and elastic, without large cracks or unnecessary kneading.',
      },
      de: {
        how: 'Nehmen Sie den Teig vorsichtig mit den Händen oder einem Teigschaber aus dem Behälter. Ziehen Sie nicht kräftig und drücken Sie nicht unnötig Gas heraus.',
        look: 'Der Teig sollte verbunden und elastisch bleiben, ohne größere Risse oder unnötiges Kneten.',
      },
      sl: {
        how: 'Testo nežno vzemite iz posode z rokami ali strgalom za testo. Izogibajte se močnemu vlečenju in nepotrebnemu iztiskanju plina.',
        look: 'Testo naj ostane povezano in elastično, brez večjih razpok ali nepotrebnega gnetenja.',
      },
    },
    {
      hr: {
        how: 'Podijelite tijesto na jednake komade prema broju i težini kuglica iz izračunatog recepta. Za preciznost koristite kuhinjsku vagu.',
        look: 'Komadi trebaju biti približno jednake težine i spremni za oblikovanje kuglica.',
      },
      en: {
        how: 'Divide the dough into equal pieces according to the number and weight of balls in the calculated recipe. Use a kitchen scale for accuracy.',
        look: 'The pieces should be approximately equal in weight and ready to be shaped into dough balls.',
      },
      de: {
        how: 'Teilen Sie den Teig entsprechend der im berechneten Rezept angegebenen Anzahl und dem Gewicht der Kugeln in gleich große Stücke. Verwenden Sie für Genauigkeit eine Küchenwaage.',
        look: 'Die Stücke sollten ungefähr gleich schwer und zum Formen von Teigkugeln bereit sein.',
      },
      sl: {
        how: 'Testo razdelite na enake kose glede na število in težo kroglic iz izračunanega recepta. Za natančnost uporabite kuhinjsko tehtnico.',
        look: 'Kosi naj bodo približno enake teže in pripravljeni za oblikovanje kroglic.',
      },
    },
    {
      hr: {
        how: 'Rubove svakog komada nježno podvucite prema donjoj strani i zatvorite spoj. Zatim laganim pokretima oblikujte kuglicu bez trganja tijesta.',
        look: 'Kuglica treba biti glatka, zaobljena i blago zategnuta, sa zatvorenim spojem na donjoj strani.',
      },
      en: {
        how: 'Gently tuck the edges of each piece underneath and close the seam. Then shape a ball with light movements without tearing the dough.',
        look: 'The ball should be smooth, round, and lightly tightened, with the seam closed underneath.',
      },
      de: {
        how: 'Schlagen Sie die Ränder jedes Stücks vorsichtig nach unten ein und schließen Sie den Schluss. Formen Sie anschließend mit leichten Bewegungen eine Kugel, ohne den Teig zu reißen.',
        look: 'Die Kugel sollte glatt, rund und leicht gestrafft sein, mit einem geschlossenen Schluss an der Unterseite.',
      },
      sl: {
        how: 'Robove vsakega kosa nežno spodvijte na spodnjo stran in zaprite stik. Nato z rahlimi gibi oblikujte kroglico, ne da bi testo trgali.',
        look: 'Kroglica naj bo gladka, okrogla in rahlo napeta, z zaprtim stikom na spodnji strani.',
      },
    },
    {
      hr: {
        how: 'Stavite kuglice u fermentacijsku kutiju sa spojem prema dolje. Ostavite dovoljno razmaka između njih i zatvorite kutiju. Nastavite prema rasporedu fermentacije iz recepta.',
        look: 'Kuglice trebaju biti glatke, blago zategnute i uredno raspoređene, s dovoljno prostora za širenje. Površina tijesta mora ostati zaštićena od isušivanja.',
      },
      en: {
        how: 'Place the balls in the fermentation box with the seam facing down. Leave enough space between them and close the box. Continue according to the fermentation schedule in the recipe.',
        look: 'The balls should be smooth, lightly tightened, and neatly arranged with enough room to expand. The dough surface must remain protected from drying out.',
      },
      de: {
        how: 'Legen Sie die Kugeln mit dem Schluss nach unten in die Fermentationsbox. Lassen Sie genügend Abstand und schließen Sie die Box. Fahren Sie nach dem Fermentationsplan des Rezepts fort.',
        look: 'Die Kugeln sollten glatt, leicht gestrafft und ordentlich angeordnet sein, mit genügend Platz zum Aufgehen. Die Teigoberfläche muss vor dem Austrocknen geschützt bleiben.',
      },
      sl: {
        how: 'Kroglice položite v fermentacijsko škatlo s stikom navzdol. Med njimi pustite dovolj prostora in škatlo zaprite. Nadaljujte po urniku fermentacije iz recepta.',
        look: 'Kroglice naj bodo gladke, rahlo napete in urejeno razporejene z dovolj prostora za širjenje. Površina testa mora ostati zaščitena pred izsušitvijo.',
      },
    },
  ];
  return copy[Math.min(slide, copy.length - 1)][lang];
}

function getNapoletanaBakingGuideCopy(lang: Lang, slide: number) {
  const copy = [
    {
      hr: {
        how: 'Nježno izvadite jednu kuglicu tijesta iz fermentacijske kutije i stavite je na lagano posutu radnu površinu. Nemojte je ponovno mijesiti niti snažno pritiskati. Ostale kuglice ostavite pokrivene.',
        look: 'Kuglica treba biti mekana, elastična i blago opuštena, s glatkom površinom i bez većih pukotina.',
      },
      en: {
        how: 'Gently remove one dough ball from the fermentation box and place it on a lightly floured work surface. Do not knead or press it firmly again. Keep the remaining balls covered.',
        look: 'The ball should be soft, elastic, and slightly relaxed, with a smooth surface and no major cracks.',
      },
      de: {
        how: 'Nehmen Sie vorsichtig eine Teigkugel aus der Gärbox und legen Sie sie auf eine leicht bemehlte Arbeitsfläche. Kneten oder drücken Sie sie nicht erneut kräftig. Lassen Sie die übrigen Kugeln abgedeckt.',
        look: 'Die Kugel sollte weich, elastisch und leicht entspannt sein, mit glatter Oberfläche und ohne größere Risse.',
      },
      sl: {
        how: 'Nežno vzemite eno kroglico testa iz fermentacijske škatle in jo položite na rahlo pomokano delovno površino. Ne gnetite je znova in je ne pritiskajte močno. Preostale kroglice pustite pokrite.',
        look: 'Kroglica naj bo mehka, elastična in rahlo sproščena, z gladko površino in brez večjih razpok.',
      },
    },
    {
      hr: {
        how: 'Jagodicama prstiju nježno potiskujte tijesto od sredine prema rubovima. Ostavite vanjski rub približno 1–2 cm bez pritiskanja.',
        look: 'Sredina tijesta postaje tanja i ravnomjernija, dok rub ostaje nešto deblji i zadržava zrak nastao fermentacijom.',
      },
      en: {
        how: 'Gently press the dough from the center toward the edges with your fingertips. Leave the outer rim, approximately 1–2 cm, untouched.',
        look: 'The center becomes thinner and more even, while the rim remains thicker and retains the air created during fermentation.',
      },
      de: {
        how: 'Drücken Sie den Teig mit den Fingerspitzen vorsichtig von der Mitte zu den Rändern. Lassen Sie den äußeren Rand von etwa 1–2 cm unberührt.',
        look: 'Die Mitte wird dünner und gleichmäßiger, während der Rand etwas dicker bleibt und die bei der Fermentation entstandene Luft behält.',
      },
      sl: {
        how: 'S konicami prstov nežno potiskajte testo od sredine proti robovom. Zunanji rob približno 1–2 cm pustite nedotaknjen.',
        look: 'Sredina postane tanjša in enakomernejša, rob pa ostane nekoliko debelejši in zadrži zrak, ki je nastal med fermentacijo.',
      },
    },
    {
      hr: {
        how: 'Pažljivo razvlačite tijesto rukama, postupno povećavajući promjer. Izbjegavajte naglo povlačenje i nemojte koristiti valjak.',
        look: 'Tijesto treba biti tanko u sredini, elastično i bez pukotina. Rub ostaje povezan i prozračan.',
      },
      en: {
        how: 'Carefully stretch the dough with your hands, gradually increasing its diameter. Avoid sudden pulling and do not use a rolling pin.',
        look: 'The dough should be thin in the center, elastic, and free of cracks. The rim remains cohesive and airy.',
      },
      de: {
        how: 'Dehnen Sie den Teig vorsichtig mit den Händen und vergrößern Sie den Durchmesser schrittweise. Vermeiden Sie ruckartiges Ziehen und verwenden Sie kein Nudelholz.',
        look: 'Der Teig sollte in der Mitte dünn, elastisch und rissfrei sein. Der Rand bleibt verbunden und luftig.',
      },
      sl: {
        how: 'Testo previdno raztegujte z rokami in postopoma povečujte premer. Izogibajte se sunkovitemu vlečenju in ne uporabljajte valjarja.',
        look: 'Testo naj bo na sredini tanko, elastično in brez razpok. Rob ostane povezan in zračen.',
      },
    },
    {
      hr: {
        how: 'Nježno dovršite oblikovanje pizze do promjera navedenog u izračunatom receptu. Provjerite da je sredina ravnomjerna i da rub nije spljošten.',
        look: 'Pizza treba imati približno okrugao oblik, tanku sredinu i jasno oblikovan, blago povišen rub.',
      },
      en: {
        how: 'Gently finish shaping the pizza to the diameter specified in the calculated recipe. Check that the center is even and the rim is not flattened.',
        look: 'The pizza should be approximately round, with a thin center and a clearly formed, slightly raised rim.',
      },
      de: {
        how: 'Formen Sie die Pizza vorsichtig bis zum im berechneten Rezept angegebenen Durchmesser fertig. Achten Sie auf eine gleichmäßige Mitte und darauf, dass der Rand nicht flachgedrückt ist.',
        look: 'Die Pizza sollte annähernd rund sein, mit dünner Mitte und einem klar geformten, leicht erhöhten Rand.',
      },
      sl: {
        how: 'Pico nežno dokončno oblikujte do premera, navedenega v izračunanem receptu. Preverite, da je sredina enakomerna in rob ni sploščen.',
        look: 'Pica naj bo približno okrogla, s tanko sredino in jasno oblikovanim, rahlo dvignjenim robom.',
      },
    },
    {
      hr: {
        how: 'Ravnomjerno rasporedite količinu umaka i dobro ocijeđene mozzarelle navedenu u receptu. Ostavite rub bez nadjeva i pizzu što prije prebacite na pečenje.',
        look: 'Nadjev treba biti ravnomjerno raspoređen, bez previše tekućine u sredini. Rub pizze ostaje slobodan.',
      },
      en: {
        how: 'Distribute the recipe’s specified amount of sauce and well-drained mozzarella evenly. Leave the rim free of toppings and transfer the pizza to bake as soon as possible.',
        look: 'The toppings should be evenly distributed without excess liquid in the center. The pizza rim remains clear.',
      },
      de: {
        how: 'Verteilen Sie die im Rezept angegebene Menge Sauce und gut abgetropften Mozzarella gleichmäßig. Lassen Sie den Rand frei und schieben Sie die Pizza möglichst bald zum Backen ein.',
        look: 'Der Belag sollte gleichmäßig verteilt sein, ohne zu viel Flüssigkeit in der Mitte. Der Pizzarand bleibt frei.',
      },
      sl: {
        how: 'Enakomerno razporedite količino omake in dobro odcejene mocarele, navedeno v receptu. Rob pustite brez nadeva in pico čim prej prestavite v peko.',
        look: 'Nadev naj bo enakomerno razporejen, brez preveč tekočine na sredini. Rob pice ostane prost.',
      },
    },
  ];
  return copy[Math.min(slide, copy.length - 1)][lang];
}

function getRomanaTondaBakingGuideCopy(lang: Lang, slide: number) {
  const copy = [
    {
      hr: {
        how: 'Nježno izvadite jednu kuglicu iz fermentacijske kutije i položite je na lagano pobrašnjenu radnu površinu. Nemojte je ponovno mijesiti. Ostale kuglice ostavite pokrivene.',
        look: 'Tijesto treba biti glatko, opušteno i dovoljno elastično za oblikovanje, bez većih pukotina.',
      },
      en: {
        how: 'Gently remove one dough ball from the fermentation box and place it on a lightly floured work surface. Do not knead it again. Keep the remaining balls covered.',
        look: 'The dough should be smooth, relaxed, and elastic enough to shape, without major cracks.',
      },
      de: {
        how: 'Nehmen Sie vorsichtig eine Teigkugel aus der Gärbox und legen Sie sie auf eine leicht bemehlte Arbeitsfläche. Kneten Sie sie nicht erneut. Lassen Sie die übrigen Kugeln abgedeckt.',
        look: 'Der Teig sollte glatt, entspannt und elastisch genug zum Formen sein, ohne größere Risse.',
      },
      sl: {
        how: 'Nežno vzemite eno kroglico testa iz fermentacijske škatle in jo položite na rahlo pomokano delovno površino. Ne gnetite je znova. Preostale kroglice pustite pokrite.',
        look: 'Testo naj bo gladko, sproščeno in dovolj elastično za oblikovanje, brez večjih razpok.',
      },
    },
    {
      hr: {
        how: 'Jagodicama prstiju postupno pritišćite tijesto od sredine prema van. Za razliku od Napoletane, cilj nije stvoriti visok i prozračan rub.',
        look: 'Tijesto postaje ravnomjerno spljošteno, s tankom sredinom i niskim rubom.',
      },
      en: {
        how: 'Gradually press the dough outward from the center with your fingertips. Unlike Napoletana, the goal is not to create a high, airy rim.',
        look: 'The dough becomes evenly flattened, with a thin center and a low rim.',
      },
      de: {
        how: 'Drücken Sie den Teig mit den Fingerspitzen nach und nach von der Mitte nach außen. Anders als bei Napoletana soll kein hoher, luftiger Rand entstehen.',
        look: 'Der Teig wird gleichmäßig flach, mit dünner Mitte und niedrigem Rand.',
      },
      sl: {
        how: 'S konicami prstov postopoma potiskajte testo od sredine navzven. Za razliko od napolitanske pice cilj ni visok in zračen rob.',
        look: 'Testo se enakomerno splošči, s tanko sredino in nizkim robom.',
      },
    },
    {
      hr: {
        how: 'Nježno razvlačite tijesto rukama i postupno povećavajte promjer. Radite ravnomjerno kako bi tijesto ostalo tanko, bez trganja.',
        look: 'Tijesto treba biti tanko i ujednačeno, bez velikih razlika u debljini i bez pukotina.',
      },
      en: {
        how: 'Gently stretch the dough by hand and gradually increase its diameter. Work evenly so it stays thin without tearing.',
        look: 'The dough should be thin and even, without large differences in thickness or cracks.',
      },
      de: {
        how: 'Dehnen Sie den Teig vorsichtig mit den Händen und vergrößern Sie den Durchmesser schrittweise. Arbeiten Sie gleichmäßig, damit er dünn bleibt und nicht reißt.',
        look: 'Der Teig sollte dünn und gleichmäßig sein, ohne große Unterschiede in der Dicke oder Risse.',
      },
      sl: {
        how: 'Testo nežno raztegujte z rokami in postopoma povečujte premer. Delajte enakomerno, da ostane tanko in se ne strga.',
        look: 'Testo naj bo tanko in enakomerno, brez velikih razlik v debelini in brez razpok.',
      },
    },
    {
      hr: {
        how: 'Dovršite oblikovanje do promjera navedenog u receptu. Ravnomjerno oblikujte rub, bez stvaranja visokog napuljskog cornicionea.',
        look: 'Pizza treba biti okrugla, vrlo tanka i ravnomjerna, s niskim rubom, spremna za dodavanje nadjeva.',
      },
      en: {
        how: 'Finish shaping to the diameter specified in the recipe. Shape the rim evenly without creating a high Neapolitan cornicione.',
        look: 'The pizza should be round, very thin, and even, with a low rim, ready for toppings.',
      },
      de: {
        how: 'Formen Sie den Teig bis zum im Rezept angegebenen Durchmesser fertig. Formen Sie den Rand gleichmäßig, ohne einen hohen neapolitanischen Cornicione zu bilden.',
        look: 'Die Pizza sollte rund, sehr dünn und gleichmäßig sein, mit niedrigem Rand und bereit für den Belag.',
      },
      sl: {
        how: 'Oblikovanje dokončajte do premera, navedenega v receptu. Rob oblikujte enakomerno, brez visokega neapeljskega cornicioneja.',
        look: 'Pica naj bo okrogla, zelo tanka in enakomerna, z nizkim robom, pripravljena za nadev.',
      },
    },
    {
      hr: {
        how: 'Ravnomjerno rasporedite umak i ostale sastojke u količinama navedenima u receptu. Izbjegavajte previše vlažnog nadjeva kako bi tijesto ostalo hrskavo.',
        look: 'Nadjev treba biti ravnomjerno raspoređen, bez nakupljanja tekućine. Tanki rub ostaje slobodan.',
      },
      en: {
        how: 'Distribute the sauce and other ingredients evenly using the quantities specified in the recipe. Avoid overly wet toppings so the dough stays crisp.',
        look: 'The toppings should be evenly distributed without liquid pooling. The thin rim remains clear.',
      },
      de: {
        how: 'Verteilen Sie Sauce und übrige Zutaten gleichmäßig in den im Rezept angegebenen Mengen. Vermeiden Sie zu feuchten Belag, damit der Teig knusprig bleibt.',
        look: 'Der Belag sollte gleichmäßig verteilt sein, ohne Flüssigkeitsansammlungen. Der dünne Rand bleibt frei.',
      },
      sl: {
        how: 'Enakomerno razporedite omako in druge sestavine v količinah, navedenih v receptu. Izogibajte se premokremu nadevu, da testo ostane hrustljavo.',
        look: 'Nadev naj bo enakomerno razporejen, brez nabiranja tekočine. Tanek rob ostane prost.',
      },
    },
  ];
  return copy[Math.min(slide, copy.length - 1)][lang];
}

function getNewYorkBakingGuideCopy(lang: Lang, slide: number) {
  const copy = [
    {
      hr: {
        how: 'Nježno izvadite jednu kuglicu tijesta iz fermentacijske kutije i stavite je na lagano pobrašnjenu radnu površinu. Nemojte je ponovno mijesiti. Ostale kuglice ostavite pokrivene.',
        look: 'Tijesto treba biti glatko, elastično i dovoljno opušteno za oblikovanje, bez većih pukotina.',
      },
      en: {
        how: 'Gently remove one dough ball from the fermentation box and place it on a lightly floured work surface. Do not knead it again. Keep the remaining balls covered.',
        look: 'The dough should be smooth, elastic, and relaxed enough to shape, without major cracks.',
      },
      de: {
        how: 'Nehmen Sie vorsichtig eine Teigkugel aus der Gärbox und legen Sie sie auf eine leicht bemehlte Arbeitsfläche. Kneten Sie sie nicht erneut. Lassen Sie die übrigen Kugeln abgedeckt.',
        look: 'Der Teig sollte glatt, elastisch und entspannt genug zum Formen sein, ohne größere Risse.',
      },
      sl: {
        how: 'Nežno vzemite eno kroglico testa iz fermentacijske škatle in jo položite na rahlo pomokano delovno površino. Ne gnetite je znova. Preostale kroglice pustite pokrite.',
        look: 'Testo naj bo gladko, elastično in dovolj sproščeno za oblikovanje, brez večjih razpok.',
      },
    },
    {
      hr: {
        how: 'Jagodicama prstiju nježno pritišćite tijesto od sredine prema van. Postupno oblikujte ravnomjeran disk, ostavljajući umjereno izražen rub.',
        look: 'Sredina tijesta treba biti ravnomjerno spljoštena, dok rub ostaje nešto deblji, ali ne toliko izražen kao kod Napoletane.',
      },
      en: {
        how: 'Gently press the dough outward from the center with your fingertips. Gradually form an even disc while leaving a moderately defined rim.',
        look: 'The center should be evenly flattened, while the rim remains somewhat thicker but less pronounced than a Neapolitan rim.',
      },
      de: {
        how: 'Drücken Sie den Teig mit den Fingerspitzen vorsichtig von der Mitte nach außen. Formen Sie schrittweise eine gleichmäßige Scheibe und lassen Sie einen mäßig ausgeprägten Rand stehen.',
        look: 'Die Mitte sollte gleichmäßig flach sein. Der Rand bleibt etwas dicker, aber weniger ausgeprägt als bei Napoletana.',
      },
      sl: {
        how: 'S konicami prstov nežno potiskajte testo od sredine navzven. Postopoma oblikujte enakomeren disk in pustite zmerno izražen rob.',
        look: 'Sredina naj bo enakomerno sploščena, rob pa nekoliko debelejši, vendar manj izrazit kot pri napolitanski pici.',
      },
    },
    {
      hr: {
        how: 'Pažljivo razvlačite tijesto objema rukama i postupno povećavajte promjer. Tijesto razvlačite ravnomjerno, bez naglog povlačenja i trganja.',
        look: 'Tijesto treba biti tanko, elastično i ujednačeno, bez pukotina ili pretjerano tankih dijelova.',
      },
      en: {
        how: 'Carefully stretch the dough with both hands and gradually increase its diameter. Stretch it evenly without sudden pulling or tearing.',
        look: 'The dough should be thin, elastic, and even, without cracks or overly thin areas.',
      },
      de: {
        how: 'Dehnen Sie den Teig vorsichtig mit beiden Händen und vergrößern Sie den Durchmesser schrittweise. Dehnen Sie ihn gleichmäßig, ohne ruckartiges Ziehen oder Reißen.',
        look: 'Der Teig sollte dünn, elastisch und gleichmäßig sein, ohne Risse oder besonders dünne Stellen.',
      },
      sl: {
        how: 'Testo previdno raztegujte z obema rokama in postopoma povečujte premer. Raztegujte ga enakomerno, brez sunkovitega vlečenja in trganja.',
        look: 'Testo naj bo tanko, elastično in enakomerno, brez razpok ali pretirano tankih delov.',
      },
    },
    {
      hr: {
        how: 'Dovršite oblikovanje do promjera navedenog u izračunatom receptu. Zadržite tanku sredinu i umjereno izražen rub. Nemojte koristiti valjak.',
        look: 'Pizza treba biti velika i približno okrugla, s tankom sredinom i ravnomjernom debljinom koja nakon pečenja omogućuje savijanje kriške.',
      },
      en: {
        how: 'Finish shaping to the diameter specified in the calculated recipe. Keep a thin center and moderately defined rim. Do not use a rolling pin.',
        look: 'The pizza should be large and approximately round, with a thin center and even thickness that allows the slice to fold after baking.',
      },
      de: {
        how: 'Formen Sie den Teig bis zum im berechneten Rezept angegebenen Durchmesser fertig. Lassen Sie die Mitte dünn und den Rand mäßig ausgeprägt. Verwenden Sie kein Nudelholz.',
        look: 'Die Pizza sollte groß und annähernd rund sein, mit dünner Mitte und gleichmäßiger Dicke, sodass sich das Stück nach dem Backen falten lässt.',
      },
      sl: {
        how: 'Oblikovanje dokončajte do premera, navedenega v izračunanem receptu. Ohranite tanko sredino in zmerno izražen rob. Ne uporabljajte valjarja.',
        look: 'Pica naj bo velika in približno okrogla, s tanko sredino in enakomerno debelino, ki omogoča prepogib rezine po peki.',
      },
    },
    {
      hr: {
        how: 'Ravnomjerno rasporedite umak i mozzarellu u količinama navedenima u receptu. Izbjegavajte previše nadjeva i nakupljanje tekućine. Ostavite rub slobodan.',
        look: 'Nadjev treba biti ravnomjerno raspoređen po tankom tijestu. Rub ostaje slobodan, a sredina nije preopterećena sastojcima.',
      },
      en: {
        how: 'Distribute the sauce and mozzarella evenly using the quantities specified in the recipe. Avoid too much topping or pooling liquid. Leave the rim clear.',
        look: 'The toppings should be evenly distributed over the thin dough. The rim remains clear and the center is not overloaded.',
      },
      de: {
        how: 'Verteilen Sie Sauce und Mozzarella gleichmäßig in den im Rezept angegebenen Mengen. Vermeiden Sie zu viel Belag und Flüssigkeitsansammlungen. Lassen Sie den Rand frei.',
        look: 'Der Belag sollte gleichmäßig auf dem dünnen Teig verteilt sein. Der Rand bleibt frei und die Mitte wird nicht überladen.',
      },
      sl: {
        how: 'Enakomerno razporedite omako in mocarelo v količinah, navedenih v receptu. Izogibajte se preveč nadeva in nabiranju tekočine. Rob pustite prost.',
        look: 'Nadev naj bo enakomerno razporejen po tankem testu. Rob ostane prost, sredina pa ni preobremenjena s sestavinami.',
      },
    },
  ];
  return copy[Math.min(slide, copy.length - 1)][lang];
}

function getRomanaTegliaBakingGuideCopy(lang: Lang, slide: number) {
  const copy = [
    {
      hr: {
        how: 'Nježno izvadite cijelu masu tijesta iz fermentacijske posude i položite je na lagano nauljenu radnu površinu ili je pažljivo prebacite u pripremljenu tepsiju, prema uputama recepta. Nemojte je dijeliti na kuglice.',
        look: 'Tijesto treba biti mekano, elastično i povezano u jednu masu, s vidljivim znakovima fermentacije i bez većih pukotina.',
      },
      en: {
        how: 'Gently remove the entire dough mass from the fermentation container and place it on a lightly oiled work surface, or carefully transfer it to the prepared tray according to the recipe. Do not divide it into balls.',
        look: 'The dough should be soft, elastic, and cohesive as one mass, with visible signs of fermentation and no major cracks.',
      },
      de: {
        how: 'Nehmen Sie die gesamte Teigmasse vorsichtig aus dem Gärbehälter und legen Sie sie auf eine leicht geölte Arbeitsfläche oder geben Sie sie gemäß dem Rezept vorsichtig in das vorbereitete Blech. Teilen Sie sie nicht in Kugeln.',
        look: 'Der Teig sollte weich, elastisch und als eine zusammenhängende Masse verbunden sein, mit sichtbaren Fermentationszeichen und ohne größere Risse.',
      },
      sl: {
        how: 'Nežno vzemite celotno maso testa iz posode za fermentacijo in jo položite na rahlo naoljeno delovno površino ali jo po navodilih recepta previdno prenesite v pripravljen pekač. Ne delite je na kroglice.',
        look: 'Testo naj bo mehko, elastično in povezano v eno maso, z vidnimi znaki fermentacije in brez večjih razpok.',
      },
    },
    {
      hr: {
        how: 'Lagano nauljite tepsiju prema uputama recepta. Tijesto nježno pritišćite jagodicama prstiju, postupno ga šireći prema rubovima. Nemojte snažno istiskivati zrak iz tijesta.',
        look: 'Tijesto se postupno širi po tepsiji, zadržava mekanu i prozračnu strukturu te na površini ima blaga udubljenja od prstiju.',
      },
      en: {
        how: 'Lightly oil the tray according to the recipe. Gently press the dough with your fingertips, gradually spreading it toward the edges. Do not forcefully press the air out of the dough.',
        look: 'The dough gradually spreads across the tray, keeping a soft, airy structure with shallow fingertip dimples on the surface.',
      },
      de: {
        how: 'Ölen Sie das Blech gemäß dem Rezept leicht ein. Drücken Sie den Teig vorsichtig mit den Fingerspitzen und verteilen Sie ihn nach und nach bis zu den Rändern. Drücken Sie die Luft nicht kräftig heraus.',
        look: 'Der Teig breitet sich allmählich im Blech aus, behält seine weiche, luftige Struktur und zeigt leichte Fingerdellen auf der Oberfläche.',
      },
      sl: {
        how: 'Pekač rahlo naoljite po navodilih recepta. Testo nežno pritiskajte s konicami prstov in ga postopoma razporejajte proti robovom. Zraka iz testa ne iztiskajte na silo.',
        look: 'Testo se postopoma razširi po pekaču, ohrani mehko in zračno strukturo ter ima na površini rahle vdolbinice prstov.',
      },
    },
    {
      hr: {
        how: 'Ako tijesto još ne doseže rubove tepsije, nježno ga podignite i razvucite prema slobodnim dijelovima. Radite postupno, bez naglog povlačenja ili trganja. Ako se tijesto skuplja, ostavite ga kratko pokrivenog da se opusti pa nastavite.',
        look: 'Tijesto treba ostati povezano, elastično i približno ravnomjerne debljine, bez pukotina ili pretjerano tankih mjesta.',
      },
      en: {
        how: 'If the dough does not yet reach the edges of the tray, gently lift and stretch it toward the open areas. Work gradually without sudden pulling or tearing. If it contracts, cover it briefly to relax before continuing.',
        look: 'The dough should remain cohesive and elastic with an approximately even thickness, without cracks or overly thin spots.',
      },
      de: {
        how: 'Wenn der Teig die Blechränder noch nicht erreicht, heben und dehnen Sie ihn vorsichtig zu den freien Stellen. Arbeiten Sie schrittweise, ohne ruckartiges Ziehen oder Reißen. Wenn er sich zusammenzieht, decken Sie ihn kurz ab und lassen Sie ihn entspannen.',
        look: 'Der Teig sollte verbunden und elastisch bleiben und ungefähr gleichmäßig dick sein, ohne Risse oder besonders dünne Stellen.',
      },
      sl: {
        how: 'Če testo še ne dosega robov pekača, ga nežno dvignite in raztegnite proti praznim delom. Delajte postopoma, brez sunkovitega vlečenja ali trganja. Če se testo krči, ga za kratek čas pokrijte, da se sprosti, nato nadaljujte.',
        look: 'Testo naj ostane povezano in elastično ter približno enakomerno debelo, brez razpok ali pretirano tankih mest.',
      },
    },
    {
      hr: {
        how: 'Jagodicama prstiju nježno rasporedite tijesto prema kutovima tepsije. Nastojte postići ravnomjernu debljinu, bez snažnog pritiskanja i nepotrebnog istiskivanja zraka.',
        look: 'Tijesto treba prekrivati predviđenu površinu pravokutne tepsije. Površina je mekana, s blagim udubljenjima, a debljina približno ravnomjerna.',
      },
      en: {
        how: 'Gently spread the dough toward the corners of the tray with your fingertips. Aim for an even thickness without pressing firmly or unnecessarily removing air.',
        look: 'The dough should cover the intended rectangular tray area. The surface is soft with shallow dimples and approximately even thickness.',
      },
      de: {
        how: 'Verteilen Sie den Teig mit den Fingerspitzen vorsichtig bis in die Ecken des Blechs. Streben Sie eine gleichmäßige Dicke an, ohne kräftig zu drücken oder unnötig Luft herauszudrücken.',
        look: 'Der Teig sollte die vorgesehene rechteckige Fläche des Blechs bedecken. Die Oberfläche ist weich, leicht gedellt und ungefähr gleichmäßig dick.',
      },
      sl: {
        how: 'S konicami prstov nežno razporedite testo proti vogalom pekača. Prizadevajte si za enakomerno debelino, brez močnega pritiskanja in nepotrebnega iztiskanja zraka.',
        look: 'Testo naj pokriva predvideno pravokotno površino pekača. Površina je mehka z rahlimi vdolbinicami in približno enakomerno debela.',
      },
    },
    {
      hr: {
        how: 'Na sirovo tijesto rasporedite umak i ostale sastojke prema količinama i redoslijedu navedenima u receptu. Nemojte preopteretiti tijesto vlažnim nadjevom.',
        look: 'Sirovo tijesto nalazi se u pravokutnoj tepsiji. Nadjev je ravnomjerno raspoređen, bez velikog nakupljanja tekućine. Pizza još nije pečena.',
      },
      en: {
        how: 'Spread the sauce and other ingredients over the raw dough according to the quantities and order in the recipe. Do not overload the dough with wet toppings.',
        look: 'The raw dough is in a rectangular tray. The toppings are evenly distributed without a large buildup of liquid. The pizza is not baked yet.',
      },
      de: {
        how: 'Verteilen Sie Sauce und übrige Zutaten gemäß den im Rezept angegebenen Mengen und der Reihenfolge auf dem rohen Teig. Überladen Sie den Teig nicht mit feuchtem Belag.',
        look: 'Der rohe Teig liegt in einem rechteckigen Blech. Der Belag ist gleichmäßig verteilt, ohne große Flüssigkeitsansammlungen. Die Pizza ist noch nicht gebacken.',
      },
      sl: {
        how: 'Na surovo testo razporedite omako in druge sestavine po količinah in vrstnem redu iz recepta. Testa ne obložite s preveč mokrim nadevom.',
        look: 'Surovo testo je v pravokotnem pekaču. Nadev je enakomerno razporejen brez večjega nabiranja tekočine. Pica še ni pečena.',
      },
    },
  ];
  return copy[Math.min(slide, copy.length - 1)][lang];
}

function getGlutenFreeBakingGuideCopy(lang: Lang, slide: number) {
  const copy = [
    {
      hr: {
        how: 'Nježno izvadite bezglutensko tijesto iz posude i položite ga na radnu površinu pripremljenu prema uputama recepta. Ako je tijesto ljepljivo, lagano navlažite ili nauljite ruke. Nemojte ga snažno mijesiti.',
        look: 'Tijesto treba biti povezano i dovoljno mekano za oblikovanje. Površina može biti manje glatka nego kod pšeničnog tijesta, ali ne smije se raspadati.',
      },
      en: {
        how: 'Gently remove the gluten-free dough from the container and place it on a work surface prepared according to the recipe. If it is sticky, lightly wet or oil your hands. Do not knead it firmly.',
        look: 'The dough should be cohesive and soft enough to shape. The surface may be less smooth than wheat dough, but it should not fall apart.',
      },
      de: {
        how: 'Nehmen Sie den glutenfreien Teig vorsichtig aus dem Behälter und legen Sie ihn auf eine nach Rezept vorbereitete Arbeitsfläche. Wenn der Teig klebt, befeuchten oder ölen Sie Ihre Hände leicht. Kneten Sie ihn nicht kräftig.',
        look: 'Der Teig sollte verbunden und weich genug zum Formen sein. Die Oberfläche darf weniger glatt als bei Weizenteig sein, sollte aber nicht zerfallen.',
      },
      sl: {
        how: 'Brezglutensko testo nežno vzemite iz posode in ga položite na delovno površino, pripravljeno po navodilih recepta. Če je lepljivo, si rahlo navlažite ali naoljite roke. Ne gnetite ga močno.',
        look: 'Testo naj bo povezano in dovolj mehko za oblikovanje. Površina je lahko manj gladka kot pri pšeničnem testu, vendar ne sme razpadati.',
      },
    },
    {
      hr: {
        how: 'Lagano navlaženim ili nauljenim prstima nježno pritišćite sredinu tijesta i postupno ga širite prema van. Nemojte snažno pritiskati niti pokušavati rastezati tijesto kao klasično pšenično tijesto.',
        look: 'Tijesto se postupno širi u okrugli disk. Sredina postaje tanja, a rub ostaje nešto deblji, bez velikih pukotina.',
      },
      en: {
        how: 'With lightly moistened or oiled fingers, gently press the center of the dough and gradually spread it outward. Do not press firmly or try to stretch it like conventional wheat dough.',
        look: 'The dough gradually spreads into a round disc. The center becomes thinner while the rim remains somewhat thicker, without large cracks.',
      },
      de: {
        how: 'Drücken Sie die Teigmitte vorsichtig mit leicht befeuchteten oder geölten Fingern und verteilen Sie den Teig nach und nach nach außen. Drücken Sie nicht kräftig und dehnen Sie ihn nicht wie herkömmlichen Weizenteig.',
        look: 'Der Teig breitet sich allmählich zu einer runden Scheibe aus. Die Mitte wird dünner, während der Rand etwas dicker bleibt, ohne große Risse.',
      },
      sl: {
        how: 'Z rahlo navlaženimi ali naoljenimi prsti nežno pritiskajte sredino testa in ga postopoma širite navzven. Ne pritiskajte močno in ga ne poskušajte raztegovati kot klasično pšenično testo.',
        look: 'Testo se postopoma razširi v okrogel disk. Sredina postane tanjša, rob pa ostane nekoliko debelejši, brez večjih razpok.',
      },
    },
    {
      hr: {
        how: 'Nastavite oblikovati tijesto laganim pritiskanjem prstima i dlanovima. Postupno povećavajte promjer, podupirući rubove kako se tijesto ne bi trgalo. Nemojte ga podizati i razvlačiti u zraku.',
        look: 'Tijesto treba biti približno okruglo, ravnomjerne debljine i bez većih pukotina. Manje nepravilnosti na površini su normalne.',
      },
      en: {
        how: 'Continue shaping the dough with gentle pressure from your fingers and palms. Gradually increase its diameter while supporting the edges so it does not tear. Do not lift and stretch it in the air.',
        look: 'The dough should be approximately round, evenly thick, and free of major cracks. Minor surface irregularities are normal.',
      },
      de: {
        how: 'Formen Sie den Teig weiter, indem Sie ihn vorsichtig mit Fingern und Handflächen drücken. Vergrößern Sie den Durchmesser schrittweise und stützen Sie den Rand, damit der Teig nicht reißt. Heben und dehnen Sie ihn nicht in der Luft.',
        look: 'Der Teig sollte annähernd rund und gleichmäßig dick sein, ohne größere Risse. Kleine Unregelmäßigkeiten auf der Oberfläche sind normal.',
      },
      sl: {
        how: 'Nadaljujte oblikovanje testa z rahlim pritiskanjem prstov in dlani. Postopoma povečujte premer in podpirajte robove, da se testo ne strga. Ne dvigujte ga in ne raztegujte v zraku.',
        look: 'Testo naj bo približno okroglo, enakomerno debelo in brez večjih razpok. Manjše nepravilnosti na površini so normalne.',
      },
    },
    {
      hr: {
        how: 'Dovršite oblikovanje do promjera navedenog u receptu. Nježno poravnajte sredinu i rubove. Ako se pojave male pukotine, pažljivo ih spojite laganim pritiskom prstiju.',
        look: 'Oblikovana podloga treba biti okrugla, stabilna i dovoljno čvrsta da zadrži oblik. Sredina je ravnomjerno oblikovana, a rub ostaje cjelovit.',
      },
      en: {
        how: 'Finish shaping to the diameter specified in the recipe. Gently even out the center and edges. If small cracks appear, carefully close them with light fingertip pressure.',
        look: 'The shaped base should be round, stable, and firm enough to hold its shape. The center is even and the rim remains intact.',
      },
      de: {
        how: 'Beenden Sie die Formung bis zum im Rezept angegebenen Durchmesser. Glätten Sie Mitte und Rand vorsichtig. Wenn kleine Risse entstehen, schließen Sie sie behutsam mit leichtem Fingerdruck.',
        look: 'Der geformte Boden sollte rund und stabil sein und seine Form halten. Die Mitte ist gleichmäßig, der Rand bleibt intakt.',
      },
      sl: {
        how: 'Oblikovanje dokončajte do premera, navedenega v receptu. Sredino in robove nežno poravnajte. Če se pojavijo majhne razpoke, jih previdno zaprite z rahlim pritiskom prstov.',
        look: 'Oblikovana podlaga naj bo okrogla, stabilna in dovolj čvrsta, da ohrani obliko. Sredina je enakomerno oblikovana, rob pa ostane cel.',
      },
    },
    {
      hr: {
        how: 'Ravnomjerno rasporedite umak i ostale sastojke u količinama i redoslijedu navedenima u receptu. Nemojte preopteretiti tijesto vlažnim nadjevom jer bezglutenska podloga može biti osjetljivija.',
        look: 'Sirova bezglutenska pizza ima ravnomjerno raspoređen nadjev. Tijesto zadržava oblik, rub je cjelovit, a sredina nije natopljena tekućinom.',
      },
      en: {
        how: 'Spread the sauce and other ingredients evenly in the quantities and order specified by the recipe. Do not overload the dough with wet toppings, as a gluten-free base may be more delicate.',
        look: 'The raw gluten-free pizza has evenly distributed toppings. The dough holds its shape, the rim is intact, and the center is not soaked with liquid.',
      },
      de: {
        how: 'Verteilen Sie Sauce und übrige Zutaten gleichmäßig in den im Rezept angegebenen Mengen und der Reihenfolge. Überladen Sie den Teig nicht mit feuchtem Belag, da ein glutenfreier Boden empfindlicher sein kann.',
        look: 'Die rohe glutenfreie Pizza hat gleichmäßig verteilten Belag. Der Teig behält seine Form, der Rand ist intakt und die Mitte nicht mit Flüssigkeit durchweicht.',
      },
      sl: {
        how: 'Enakomerno razporedite omako in druge sestavine v količinah in vrstnem redu iz recepta. Testa ne obložite s preveč mokrim nadevom, saj je brezglutenska podlaga lahko občutljivejša.',
        look: 'Surova brezglutenska pica ima enakomerno razporejen nadev. Testo ohrani obliko, rob je cel, sredina pa ni prepojena s tekočino.',
      },
    },
  ];
  return copy[Math.min(slide, copy.length - 1)][lang];
}

function PhaseBlock({
  title, steps, stepInfo, phaseKey, timers: customTimers, bigaInfo, waterInfo, waterInfoStepIndex, containerOilInfo, fermentationInfo, fermentationSignsInfo, degassingInfo, doughHandlingInfo, doughHandlingInfoStepIndex, temperingInfo, proofingInfo, ovenTimingInfo, ovenProgramInfo, bakingCheckInfo, bakingInfo, infoTitleOverrides, doughTemperatureStyle, phaseGuide, completed, onToggle,
  activeTimers, onStartTimer, onStopTimer, lang,
}: {
  title: string;
  steps: readonly string[];
  stepInfo?: Array<{ title: string; body: string } | undefined>;
  phaseKey: string;
  timers?: BaseTimer[];
  bigaInfo?: string;
  waterInfo?: string;
  waterInfoStepIndex?: number;
  doughHandlingInfoStepIndex?: number;
  containerOilInfo?: string;
  fermentationInfo?: string;
  fermentationSignsInfo?: string;
  degassingInfo?: string;
  doughHandlingInfo?: string;
  temperingInfo?: string;
  proofingInfo?: string;
  ovenTimingInfo?: string;
  ovenProgramInfo?: string;
  bakingCheckInfo?: string;
  bakingInfo?: string;
  infoTitleOverrides?: Partial<Record<'handling' | 'room' | 'readiness' | 'baking' | 'biga' | 'water', string>>;
  doughTemperatureStyle?: 'napolitana' | 'newYork' | 'romanaTonda' | 'romanaTeglia';
  phaseGuide?: { kind: MixingGuideKind; onPress: () => void };
  completed: Record<string, boolean>;
  onToggle: (key: string) => void;
  activeTimers: Record<string, { endsAt: number; label: string; notifId?: string | null }>;
  onStartTimer: (phaseKey: string, t: BaseTimer) => void;
  onStopTimer: (phaseKey: string, timerId: string) => void;
  lang: Lang;
}) {
  const temperatureUnit = useSyncExternalStore(subscribeTemperatureUnit, getCachedTemperatureUnit, getCachedTemperatureUnit) ?? 'celsius';
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';
  const formatText = (text?: string) => text ? formatUnitText(text, temperatureUnit, measurementSystem) : text;
  const timers = customTimers || PHASE_TIMER_DURATIONS[phaseKey] || [];
  const toppingInfo = {
    hr: 'Nadjev možeš staviti po želji, ali ga nemoj previše natovariti. Ostavi dovoljno ruba bez nadjeva kako bi se rub mogao lijepo podignuti i ispeći.',
    en: 'Choose toppings according to preference, but do not overload the pizza. Leave enough of the rim without toppings so that it can rise and bake properly.',
    de: 'Wählen Sie den Belag nach Wunsch, verwenden Sie jedoch nicht zu viel davon. Lassen Sie genügend Rand ohne Belag, damit er schön aufgehen und gleichmäßig backen kann.',
    sl: 'Nadev izberite po želji, vendar pice ne obložite preveč. Pustite dovolj roba brez nadeva, da se lahko lepo dvigne in enakomerno speče.',
  }[lang];
  const toppingTitle = { hr: 'Nadjev', en: 'Toppings', de: 'Belag', sl: 'Nadev' }[lang];
  const doughTemperatureRange = doughTemperatureStyle === 'romanaTonda' || doughTemperatureStyle === 'romanaTeglia' ? [21, 23] : [23, 25];
  const doughTemperatureInfo = doughTemperatureStyle === 'newYork' ? {
    hr: 'Ako želite provjeriti konačnu temperaturu tijesta, koristite je kao provjeru ujednačenosti. Tijesto treba biti glatko, elastično i homogeno te ne smije djelovati pretjerano toplo.',
    en: 'If you measure the final dough temperature, use it as a consistency check. The dough should finish smooth, elastic and homogeneous and should not feel excessively warm.',
    de: 'Wenn Sie die endgültige Teigtemperatur messen, nutzen Sie sie als Kontrolle der Gleichmäßigkeit. Der Teig sollte glatt, elastisch und homogen sein und sich nicht übermäßig warm anfühlen.',
    sl: 'Če izmerite končno temperaturo testa, jo uporabite kot preverjanje enakomernosti. Testo naj bo gladko, elastično in homogeno ter naj ne deluje pretirano toplo.',
  }[lang] : {
    hr: `Ako želite provjeriti konačnu temperaturu tijesta, idealno je između ${doughTemperatureRange[0]} °C i ${doughTemperatureRange[1]} °C. Mjerenje nije obavezno; tijesto treba biti glatko, elastično i homogeno.`,
    en: `If you want to check the final dough temperature, it should ideally be between ${doughTemperatureRange[0]} °C and ${doughTemperatureRange[1]} °C. Measuring is optional; the dough should be smooth, elastic, and homogeneous.`,
    de: `Wenn Sie die endgültige Teigtemperatur überprüfen möchten, sollte sie idealerweise zwischen ${doughTemperatureRange[0]} °C und ${doughTemperatureRange[1]} °C liegen. Das Messen ist optional; der Teig sollte glatt, elastisch und homogen sein.`,
    sl: `Če želite preveriti končno temperaturo testa, naj bo idealno med ${doughTemperatureRange[0]} °C in ${doughTemperatureRange[1]} °C. Merjenje ni obvezno; testo mora biti gladko, elastično in homogeno.`,
  }[lang];
  const doughTemperatureTitle = { hr: 'Temperatura tijesta', en: 'Dough temperature', de: 'Teigtemperatur', sl: 'Temperatura testa' }[lang];
  const bakingCheckTitle = { hr: 'Provjera pečenosti', en: 'Baking check', de: 'Backkontrolle', sl: 'Preverjanje pečenosti' }[lang];
  const proofingTestInfo = {
    hr: 'Lagano pritisnite kuglu prstom. Ako se udubljenje polako vraća, spremna je za oblikovanje; ako se odmah vrati, ostavite je još malo.',
    en: 'Gently press the dough ball with your finger. If the indentation slowly springs back, it is ready for shaping; if it springs back immediately, it needs more time.',
    de: 'Drücken Sie die Teigkugel leicht mit dem Finger. Wenn die Vertiefung langsam zurückfedert, ist sie bereit zum Formen; wenn sie sofort zurückfedert, braucht sie noch etwas Zeit.',
    sl: 'Kroglico rahlo pritisnite s prstom. Če se vdolbina počasi vrne, je pripravljena za oblikovanje; če se takoj vrne, potrebuje še nekaj časa.',
  }[lang];
  const infoTitles = {
    biga: infoTitleOverrides?.biga ?? ({ hr: 'Postotak bige', en: 'Biga percentage', de: 'Biga-Anteil', sl: 'Odstotek bige' }[lang]),
    proofing: { hr: 'Test prstom', en: 'Finger test', de: 'Fingertest', sl: 'Test s prstom' }[lang],
    water: infoTitleOverrides?.water ?? ({ hr: 'Voda i led', en: 'Water and ice', de: 'Wasser und Eis', sl: 'Voda in led' }[lang]),
    container: { hr: 'Fermentacijska posuda', en: 'Fermentation container', de: 'Fermentationsbehälter', sl: 'Posoda za fermentacijo' }[lang],
    room: infoTitleOverrides?.room ?? ({ hr: 'Temperatura prostorije', en: 'Room temperature', de: 'Raumtemperatur', sl: 'Sobna temperatura' }[lang]),
    signs: { hr: 'Znakovi fermentacije', en: 'Fermentation signs', de: 'Fermentationszeichen', sl: 'Znaki fermentacije' }[lang],
    degassing: { hr: 'Degaziranje', en: 'Degassing', de: 'Entgasen', sl: 'Degaziranje' }[lang],
    baking: infoTitleOverrides?.baking ?? ({ hr: 'Položaj kamena ili čelika', en: 'Stone or steel position', de: 'Position von Stein oder Stahl', sl: 'Položaj kamna ali jekla' }[lang]),
    handling: infoTitleOverrides?.handling ?? ({ hr: 'Ljepljivo tijesto', en: 'Sticky dough', de: 'Klebriger Teig', sl: 'Lepljivo testo' }[lang]),
    tempering: { hr: 'Temperiranje', en: 'Tempering', de: 'Temperieren', sl: 'Temperiranje' }[lang],
    topping: toppingTitle,
    readiness: infoTitleOverrides?.readiness ?? ({ hr: 'Spremnost tijesta', en: 'Dough readiness', de: 'Teigreife', sl: 'Pripravljenost testa' }[lang]),
    ovenTiming: { hr: 'Usklađivanje vremena', en: 'Timing coordination', de: 'Zeitliche Abstimmung', sl: 'Časovna uskladitev' }[lang],
    ovenProgram: { hr: 'Program pećnice', en: 'Oven program', de: 'Ofenprogramm', sl: 'Program pečice' }[lang],
  };
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <View style={styles.phaseHeader}>
        <Text style={[styles.phaseTitle, phaseGuide && styles.phaseTitleWithGuide]}>{formatText(title)}</Text>
        {phaseGuide ? (
          <Pressable
            accessibilityLabel={(phaseGuide.kind === 'stretchFold'
              ? { hr: 'Vodič za preklapanje tijesta', en: 'Stretch and fold visual guide', de: 'Visuelle Anleitung für Stretch und Fold', sl: 'Slikovni vodič za razteg in prepogib' }
              : phaseGuide.kind === 'balling'
                ? { hr: 'Vodič za podjelu i oblikovanje kuglica', en: 'Dough ball dividing and shaping guide', de: 'Anleitung zum Teilen und Formen von Teigkugeln', sl: 'Vodič za delitev in oblikovanje kroglic' }
                : phaseGuide.kind === 'baking'
                  ? { hr: 'Vodič za temperiranje, oblikovanje i pečenje', en: 'Tempering, shaping and baking guide', de: 'Anleitung zum Temperieren, Formen und Backen', sl: 'Vodič za temperiranje, oblikovanje in peko' }
                : { hr: 'Vodič za pripremu i zamjes', en: 'Preparation and mixing visual guide', de: 'Visuelle Anleitung für Vorbereitung und Kneten', sl: 'Slikovni vodič za pripravo in gnetenje' })[lang]}
            accessibilityRole="button"
            hitSlop={10}
            onPress={phaseGuide.onPress}
            style={styles.phaseGuideButton}
            testID={phaseGuide.kind === 'stretchFold'
              ? 'phase-b-visual-guide-open'
              : phaseGuide.kind === 'balling'
                ? 'phase-c-visual-guide-open'
                : phaseGuide.kind === 'baking'
                  ? 'phase-e-visual-guide-open'
                : 'phase-a-visual-guide-open'}
          >
            <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
          </Pressable>
        ) : null}
      </View>
      {timers.length > 0 ? (
        <View style={styles.timerRow}>
          {timers.map((tm) => {
            const key = `${phaseKey}-${tm.id}`;
            const active = activeTimers[key];
            // eslint-disable-next-line react-hooks/purity
            const remaining = active ? active.endsAt - Date.now() : 0;
            const kindLabel = TIMER_KIND_LABEL[lang][tm.kind];
            return (
              <Pressable
                key={key}
                testID={`timer-${key}`}
                onPress={() => (active ? onStopTimer(phaseKey, tm.id) : onStartTimer(phaseKey, tm))}
                style={[styles.timerChip, active && styles.timerChipActive]}
              >
                <Icon
                  name={active ? 'stop-circle' : 'play-circle'}
                  size={14}
                  color={active ? '#fff' : COLORS.brand}
                />
                <Text style={[styles.timerChipText, active && { color: '#fff' }]}>
                  {kindLabel}
                </Text>
                <Text style={[styles.timerChipDuration, active && { color: '#fff' }]}>
                  {active ? formatCountdown(remaining) : formatDuration(tm.seconds, lang)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {steps.map((s, i) => {
        const key = `${phaseKey}-${i}`;
        const done = !!completed[key];
        const hasProofingInfo = !!proofingInfo && /izvadite kugle|izvadite tijesto|take the dough balls out|take the dough out|Nehmen Sie die Teigkugeln|Nehmen Sie den Teig|Kroglice vzemite|vzemite testo/i.test(s);
        const hasBigaInfo = !!bigaInfo && /Pripremite .*brašna|Prepare .*flour|Bereiten Sie .*Mehl|Pripravite .*moke/i.test(s);
        const hasWaterInfo = !!waterInfo && (waterInfoStepIndex !== undefined ? i === waterInfoStepIndex : /ukupno .*vode|total water|Sieben und wiegen Sie.*Wasser|skupno .*vode/i.test(s));
        const hasContainerOilInfo = !!containerOilInfo && (/nauljite fermentacijsku posudu|Pokrijte fermentacijsku posudu|Stavite kugle u zatvorenu fermentacijsku kutiju|Masa testa položite|oil the fermentation container|place the dough mass in a covered|Place the dough balls in a closed|Ölen Sie den Fermentationsbehälter|Legen Sie die Teigmasse in einen abgedeckten|Legen Sie die Teigkugeln in eine verschlossene|Fermentacijsko posodo rahlo|Maso testa položite/i.test(s));
        const hasFermentationInfo = !!fermentationInfo && /završni bulk|final bulk fermentation|abschließende Stockgare|Končno prvo fermentacijo|Lagano nauljite fermentacijsku posudu|Lightly oil the fermentation container|Ölen Sie den Fermentationsbehälter|Fermentacijsko posodo rahlo|Integralno tijesto|Whole wheat dough|Vollkornteig|Integralno testo|Prebacite tijesto u lagano nauljenu fermentacijsku posudu/i.test(s);
        const hasFermentationSignsInfo = !!fermentationSignsInfo && /Provjerite jesu li vidljivi|Check whether the first signs|Prüfen Sie, ob erste Anzeichen|Preverite, ali so vidni prvi znaki|^[^;]*(?:Miješanje i bulk traju|Mixing and bulk run|Mischen und Stockgare dauern|Mešanje in prva fermentacija trajata)[^;]*$|Pokrijte posudu i ostavite smjesu 15 minuta|Cover the container and let the mixture rest for 15 minutes|Decken Sie den Behälter ab und lassen Sie die Masse 15 Minuten|Posodo pokrijte in maso pred delitvijo 15 minut/i.test(s);
        const hasDegassingInfo = !!degassingInfo && /minimalno degaziranje|minimizing degassing|möglichst starkes Entgasen|čim manj iztisnite plin/i.test(s);
        const hasBakingInfo = !!bakingInfo && /Zagrijte kamen ili čelik|Zagrijte obrnuti lim|Preheat the pizza stone|Heizen Sie den Pizzastein|Kamen ali jeklo za pico segrevajte/i.test(s);
        const hasDoughHandlingInfo = !!doughHandlingInfo && (doughHandlingInfoStepIndex !== undefined ? i === doughHandlingInfoStepIndex : /Nastavite mijesiti|Nastavite miješati|Continue kneading|Continue mixing|Kneten Sie weiter|Mischen Sie weiter|Nadaljujte z gnetenjem|Nadaljujte z mešanjem|Bezglutenska smjesa se ne mijesi|Gluten-free dough is not kneaded|Glutenfreier Teig wird nicht geknetet|Brezglutensko testo se ne gnete/i.test(s));
        const hasTemperingInfo = !!temperingInfo && /prijeđite na temperiranje|Ostavite kugle .*sobnoj temperaturi|proceed to tempering|Let the dough balls .*room temperature|fahren Sie mit dem Temperieren|Lassen Sie die Teigkugeln .*Raumtemperatur|nadaljujte s temperiranjem|Kroglice .*sobni temperaturi/i.test(s);
        const hasDoughTemperatureInfo = /Zamjes je gotov|The dough is fully mixed|Der Teig ist fertig geknetet|Gnetenje je končano|Mixing is finished when|Das Mischen ist beendet|Mešanje je končano/i.test(s);
        const hasToppingInfo = /Dodajte nadjev|Add the toppings|Belegen Sie die Pizza|Dodajte nadev/i.test(s);
        const hasOvenTimingInfo = !!ovenTimingInfo && /Izvadite kugle iz hladnjaka|izvadite kugle|Take the dough balls out|take the dough out|Nehmen Sie die Teigkugeln|Kroglice vzemite iz hladilnika|Kroglice vzemite|vzemite testo/i.test(s);
        const hasOvenProgramInfo = !!ovenProgramInfo && /Pizza program|Pizza-Programm|program Pizza/i.test(s);
        const hasBakingCheckInfo = !!bakingCheckInfo && /Pecite bez grilla|Bake without the grill|Backen Sie ohne Grill|Pecite brez žara/i.test(s);
        const customStepInfo = stepInfo?.[i];
        return (
          <View key={i} style={styles.stepItem}>
            <Pressable
              testID={`step-${key}`}
              onPress={() => onToggle(key)}
              style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }, pressed && { opacity: 0.7 }]}
            >
            <View style={styles.stepCheckWrap}>
              {done ? (
                <View style={styles.stepCheckDone}>
                  <Icon name="checkmark" size={14} color="#fff" />
                </View>
              ) : (
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.stepText, done && styles.stepTextDone]}>{formatText(s)}</Text>
            </Pressable>
            {hasProofingInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.proofing}
                onPress={() => Alert.alert(infoTitles.proofing, formatText(proofingInfo ?? proofingTestInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasBigaInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.biga}
                onPress={() => Alert.alert(infoTitles.biga, formatText(bigaInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {customStepInfo ? (
              <Pressable
                accessibilityLabel={customStepInfo.title}
                onPress={() => Alert.alert(customStepInfo.title, formatText(customStepInfo.body))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasWaterInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.water}
                onPress={() => Alert.alert(infoTitles.water, formatText(waterInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasContainerOilInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.container}
                onPress={() => Alert.alert(infoTitles.container, formatText(containerOilInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasFermentationInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.room}
                onPress={() => Alert.alert(infoTitles.room, formatText(fermentationInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasFermentationSignsInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.signs}
                onPress={() => Alert.alert(infoTitles.signs, formatText(fermentationSignsInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasDegassingInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.degassing}
                onPress={() => Alert.alert(infoTitles.degassing, formatText(degassingInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasBakingInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.baking}
                onPress={() => Alert.alert(infoTitles.baking, formatText(bakingInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasDoughHandlingInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.handling}
                onPress={() => Alert.alert(infoTitles.handling, formatText(doughHandlingInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasTemperingInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.tempering}
                onPress={() => Alert.alert(infoTitles.tempering, formatText(temperingInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasDoughTemperatureInfo ? (
              <Pressable
                accessibilityLabel={doughTemperatureTitle}
                onPress={() => Alert.alert(doughTemperatureTitle, formatText(doughTemperatureInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasToppingInfo ? (
              <Pressable
                accessibilityLabel={toppingTitle}
                onPress={() => Alert.alert(toppingTitle, formatText(toppingInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasOvenTimingInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.ovenTiming}
                onPress={() => Alert.alert(infoTitles.ovenTiming, formatText(ovenTimingInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasOvenProgramInfo ? (
              <Pressable
                accessibilityLabel={infoTitles.ovenProgram}
                onPress={() => Alert.alert(infoTitles.ovenProgram, formatText(ovenProgramInfo))}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasBakingCheckInfo ? (
              <Pressable
                accessibilityLabel={bakingCheckTitle}
                onPress={() => Alert.alert(
                  bakingCheckTitle,
                  bakingCheckInfo!,
                )}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function OvenCard({ active, onPress, icon, imageSrc, title, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.ovenCard, active && styles.ovenCardActive]}>
      <View style={[styles.ovenIconWrap, active && styles.ovenIconWrapActive]}>
        {imageSrc ? (
          <Image source={imageSrc} style={styles.ovenImage} resizeMode="contain" />
        ) : (
          <Icon name={icon} size={28} color={active ? '#fff' : COLORS.brand} />
        )}
      </View>
      <Text style={[styles.ovenText, active && { color: '#fff' }]} numberOfLines={2}>{title}</Text>
    </Pressable>
  );
}

function MoreLink({ icon, imageSrc, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.moreLink}>
      {imageSrc ? (
        <Image source={imageSrc} style={styles.moreLinkImg} resizeMode="contain" />
      ) : (
        <Icon name={icon} size={16} color={COLORS.brand} />
      )}
      <Text style={styles.moreLinkText}>{label}</Text>
    </Pressable>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.modalHeader, { paddingTop: insets.top + SPACING.sm }]}>
      <Pressable onPress={onClose} testID="modal-close"><Icon name="close" size={26} color={COLORS.onSurface} /></Pressable>
      <Text style={styles.modalTitle}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

// ============= MODALS =============
function SchoolModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <View style={styles.modalRoot}>
      <ModalHeader title={t.school.title} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl }}>
        <View style={styles.schoolIntro}>
          <Icon name="school-outline" size={22} color={COLORS.brand} />
          <Text style={styles.schoolIntroText}>{t.school.subtitle}</Text>
        </View>
        {t.school.rules.map((r, i) => (
          <View key={i} style={styles.ruleCard}>
            <View style={styles.ruleNumber}><Text style={styles.ruleNumberText}>{String(i + 1).padStart(2, '0')}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleTitle}>{r.title}</Text>
              <Text style={styles.ruleBody}>{r.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function LeftoverModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <View style={styles.modalRoot}>
      <ModalHeader title={t.leftover.title} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl }}>
        <Text style={{ color: COLORS.muted, fontSize: 13 }}>{t.leftover.subtitle}</Text>
        {t.leftover.tips.map((tip, i) => (
          <View key={i} style={styles.ruleCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleTitle}>{tip.title}</Text>
              <Text style={styles.ruleBody}>{tip.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SavedRecipesModal({
  editingRecipe,
  onClose,
  onLoad,
  onSave,
}: {
  editingRecipe: { id: string; name: string } | null;
  onClose: () => void;
  onLoad: (recipe: SavedRecipe) => void;
  onSave: (name: string, recipeId?: string | null) => Promise<SavedRecipe>;
}) {
  const { t } = useT();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [name, setName] = useState(editingRecipe?.name || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    api('/api/recipes').then((data) => {
      if (mounted) setRecipes(data || []);
    }).catch(() => {
      if (mounted) setError(true);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(false);
    try {
      const saved = await onSave(name, editingRecipe?.id);
      setRecipes((previous) => editingRecipe
        ? previous.map((recipe) => recipe.recipe_id === saved.recipe_id ? saved : recipe)
        : [saved, ...previous]);
      setName(saved.name);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (recipeId: string) => {
    try {
      await api(`/api/recipes/${recipeId}`, { method: 'DELETE' });
      setRecipes((previous) => previous.filter((recipe) => recipe.recipe_id !== recipeId));
    } catch {
      setError(true);
    }
  };

  return (
    <View style={styles.modalRoot}>
      <ModalHeader title={t.calc.savedRecipes} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl }}>
        <TextInput
          testID="saved-recipe-name"
          value={name}
          onChangeText={setName}
          placeholder={t.calc.recipeNamePlaceholder}
          placeholderTextColor={COLORS.muted}
          style={styles.savedRecipeInput}
        />
        <Pressable testID="save-current-recipe" onPress={save} disabled={saving || !name.trim()} style={[styles.copyBtn, (saving || !name.trim()) && { opacity: 0.5 }]}>
          <Icon name={editingRecipe ? 'refresh' : 'bookmark'} size={17} color="#fff" />
          <Text style={styles.copyBtnText}>{editingRecipe ? t.calc.updateRecipe : t.calc.saveCurrentRecipe}</Text>
        </Pressable>
        {error ? <Text style={styles.savedRecipeError}>{t.feed.loadError}</Text> : null}
        {loading ? <ActivityIndicator color={COLORS.brand} /> : recipes.length === 0 ? (
          <Text style={styles.savedRecipeEmpty}>{t.calc.savedRecipeEmpty}</Text>
        ) : (
          recipes.map((recipe) => (
            <View key={recipe.recipe_id} style={styles.savedRecipeRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.savedRecipeName}>{recipe.name}</Text>
                <Text style={styles.savedRecipeMeta}>
                  {recipe.recipe?.pizzas || 0} · {recipe.recipe?.hydration || 0}% · {recipe.recipe?.method || ''}
                </Text>
              </View>
              <View style={styles.savedRecipeActions}>
                <Pressable testID={`load-recipe-${recipe.recipe_id}`} onPress={() => onLoad(recipe)} style={styles.savedRecipeAction}>
                  <Icon name="create-outline" size={18} color={COLORS.brand} />
                  <Text style={styles.savedRecipeActionText}>{t.calc.loadAndEdit}</Text>
                </Pressable>
                <Pressable testID={`delete-recipe-${recipe.recipe_id}`} onPress={() => { void remove(recipe.recipe_id); }} style={styles.savedRecipeDelete}>
                  <Icon name="trash-outline" size={18} color={COLORS.error} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ShoppingModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const measurementSystem = useSyncExternalStore(subscribeMeasurementSystem, getCachedMeasurementSystem, getCachedMeasurementSystem) ?? 'metric';
  const [recipe, setRecipe] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useMemo(() => {
    AsyncStorage.getItem('lastRecipe').then((v) => { if (v) setRecipe(JSON.parse(v)); });
  }, []);

  if (!recipe) {
    return (
      <View style={styles.modalRoot}>
        <ModalHeader title={t.shopping.title} onClose={onClose} />
      </View>
    );
  }

  const methodLabel = recipe.method === 'biga' ? t.calc.biga : recipe.method === 'poolish' ? t.calc.poolish : t.calc.direct;
  const ing = t.shopping.ingredients;

  const items = [
    { key: 'flour', qty: formatWeight(recipe.flour, measurementSystem), name: `${ing.flour} (${recipe.flourType || '00'})` },
    { key: 'water', qty: formatWeight(recipe.water, measurementSystem), name: ing.water },
    { key: 'salt', qty: formatWeight(recipe.salt, measurementSystem, true), name: ing.salt },
    { key: 'yeast', qty: formatWeight(recipe.yeast, measurementSystem, true), name: ing.yeast },
    ...(recipe.oil > 0 ? [{ key: 'oil', qty: formatWeight(recipe.oil, measurementSystem), name: ing.oil }] : []),
    ...(recipe.sauce ? [{ key: 'sauce', qty: formatWeight(recipe.sauce, measurementSystem), name: ing.sauce }] : []),
    ...(recipe.cheese ? [{ key: 'cheese', qty: formatWeight(recipe.cheese, measurementSystem), name: ing.cheese }] : []),
  ];

  const headerText = t.shopping.headerFmt
    .replace('{N}', String(recipe.pizzas))
    .replace('{H}', String(recipe.hydration))
    .replace('{M}', methodLabel);

  const copyHeader = t.shopping.copyHeaderFmt.replace('{N}', String(recipe.pizzas));

  const listText = `${copyHeader}\n\n` +
    items.map((it) => `☐ ${it.qty} — ${it.name}`).join('\n');

  const doCopy = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(listText);
      } else {
        const clip = await import('expo-clipboard').catch(() => null);
        if (clip?.setStringAsync) await clip.setStringAsync(listText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <View style={styles.modalRoot}>
      <ModalHeader title={t.shopping.title} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl }}>
        <Text style={{ color: COLORS.muted, fontSize: 13 }}>{t.shopping.subtitle}</Text>
        <View style={styles.recipeCard}>
          <Text style={styles.recipeSection}>{headerText}</Text>
          {items.map((it) => (
            <Pressable
              key={it.key}
              testID={`shop-${it.key}`}
              style={styles.checkRow}
              onPress={() => setChecked({ ...checked, [it.key]: !checked[it.key] })}
            >
              <Icon name={checked[it.key] ? 'checkbox' : 'square-outline'} size={22} color={checked[it.key] ? COLORS.brand : COLORS.muted} />
              <Text style={[styles.checkLabel, checked[it.key] && { textDecorationLine: 'line-through', color: COLORS.muted }]}>{it.name}</Text>
              <Text style={[styles.checkQty, checked[it.key] && { color: COLORS.muted }]}>{it.qty}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.copyBtn} onPress={doCopy} testID="copy-shopping-btn">
          <Icon name={copied ? 'checkmark' : 'copy'} size={16} color="#fff" />
          <Text style={styles.copyBtnText}>{copied ? t.shopping.copied : t.shopping.copy}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ============= STYLES =============
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  rootBgImage: { opacity: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '900', color: COLORS.onSurface, letterSpacing: -0.8 },
  titlePizza: { color: '#472212' },
  titleBook: { color: '#FB5516' },
  subtitle: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },

  card: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  cardTitle: { fontSize: 13, color: COLORS.brand, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  styleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  styleRowWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  beginnerStylePicker: { gap: SPACING.md, paddingTop: SPACING.sm },
  beginnerStyleGrid: { flexDirection: 'row', gap: SPACING.sm },
  beginnerStyleCell: { flex: 1, minWidth: 0, position: 'relative' },
  beginnerStyleCard: { height: 132, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, overflow: 'hidden' },
  beginnerStyleCardActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  beginnerStyleImage: { width: '100%', height: 78, padding: 4 },
  beginnerStyleLabelRow: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 4, paddingBottom: 4 },
  beginnerStyleName: { flexShrink: 1, color: COLORS.onSurface, fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  beginnerStyleInfo: { position: 'absolute', top: 3, right: 3, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  beginnerSubtypeBlock: { gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider },
  beginnerSubtypeLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  beginnerSubtypeControl: { flexDirection: 'row', gap: 6 },
  beginnerSubtypeOption: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  beginnerSubtypeOptionActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  beginnerSubtypeText: { color: COLORS.onSurface, fontSize: 13, fontWeight: '800' },
  beginnerSubtypeTextActive: { color: COLORS.brand },
  beginnerSubtypeInfoRow: { flexDirection: 'row', justifyContent: 'space-around' },
  beginnerSubtypeInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8 },
  beginnerSubtypeInfoText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  styleRow: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.sm, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  styleRowActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  lockedOption: { opacity: 0.62 },
  styleThumb: { width: 52, height: 52, borderRadius: RADIUS.md },
  styleCard: { width: 190, minHeight: 146, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 4 },
  styleCardActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  styleEmoji: { fontSize: 24 },
  styleName: { color: COLORS.onSurface, fontSize: 15, fontWeight: '800' },
  styleNameActive: { color: '#fff' },
  styleDescription: { color: COLORS.muted, fontSize: 11, lineHeight: 15 },
  styleDescriptionActive: { color: 'rgba(255,255,255,0.9)' },
  pizzaBadge: { width: 44, height: 44, marginBottom: SPACING.sm },
  mixingHero: { width: '100%', height: 100, marginBottom: SPACING.sm },
  mixIcon: { width: 24, height: 24 },
  // Proportional pizza preview
  pizzaPreviewWrap: { alignItems: 'center', marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider, gap: 6 },
  pizzaScale: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  pizzaCircleGhost: { position: 'absolute', borderRadius: 100, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: 'transparent' },
  pizzaCircle: { borderRadius: 100, backgroundColor: COLORS.brandTertiary, borderWidth: 2, borderColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  pizzaCircleText: { color: COLORS.brand, fontSize: 15, fontWeight: '800' },
  pizzaPreviewImage: { maxWidth: 180, maxHeight: 180 },
  pizzaPreviewLabel: { color: COLORS.brand, fontSize: 14, fontWeight: '800' },
  pizzaPreviewHint: { fontSize: 11, color: COLORS.muted, fontStyle: 'italic' },
  stepInput: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface, minWidth: 38, maxWidth: 46, textAlign: 'center', padding: 0 },
  stepUnit: { fontSize: 12, color: COLORS.muted, fontWeight: '700', marginLeft: -2 },
  ballRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  ballLabelCol: { flex: 1, minWidth: 0 },
  ballStepper: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 4, borderWidth: 1, borderColor: COLORS.border, flexShrink: 0 },
  resetInlineBtn: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  resetInlineText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  subLabel: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  flourRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  flourRowActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  flourRowEmoji: { fontSize: 28 },
  flourRowLabel: { fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  flourRowSub: { fontSize: 11, color: COLORS.muted, marginTop: 2, fontStyle: 'italic' },
  flourRowRange: { fontSize: 12, color: COLORS.muted, fontWeight: '600', marginTop: 2 },
  // NEW compact single-line flour row
  flourHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  flourHeaderText: { fontSize: 15, fontWeight: '700', color: COLORS.brand },
  flourRowWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  beginnerFlourGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  beginnerFlourCell: { width: '48%' },
  beginnerFlourCard: { minHeight: 86, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 7 },
  beginnerFlourCardActive: { backgroundColor: COLORS.brandTertiary, borderColor: COLORS.brand },
  beginnerFlourImage: { width: 44, height: 44, marginRight: 0, marginBottom: 2 },
  beginnerFlourName: { textAlign: 'center', lineHeight: 15 },
  beginnerRecommendedBadge: { color: COLORS.brand, fontSize: 9, fontWeight: '800', lineHeight: 12, textAlign: 'center' },
  beginnerFlourStatus: { position: 'absolute', top: 4, right: 4 },
  flourCompact: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, minHeight: 42 },
  flourCompactActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  flourIcon: { width: 28, height: 28, marginRight: 6 },
  flourCompactLabel: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface, flexShrink: 1 },
  flourCompactSuffix: { fontSize: 12, color: COLORS.muted, fontWeight: '600', marginLeft: 6, flexShrink: 0 },
  infoBtn: { width: 26, height: 32, alignItems: 'center', justifyContent: 'center' },
  tooltipBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  tooltipCard: { width: '100%', maxWidth: 360, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  visualGuideBackdrop: { flex: 1, backgroundColor: 'rgba(48,30,20,0.48)', alignItems: 'center', justifyContent: 'center', padding: SPACING.md },
  visualGuideCard: { width: '100%', maxWidth: 360, maxHeight: '90%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  visualGuideContent: { flexShrink: 1 },
  visualGuideContentInner: { gap: 12 },
  visualGuideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  visualGuideHeading: { flex: 1, gap: 2 },
  visualGuideEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: COLORS.brand },
  visualGuideTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: COLORS.onSurface },
  visualGuideCloseIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  visualGuideCopyBlock: { gap: 3 },
  visualGuideSectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 0.65, color: COLORS.brand },
  visualGuideBody: { fontSize: 13, lineHeight: 18, color: COLORS.onSurfaceTertiary },
  visualGuideCloseButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: RADIUS.md, backgroundColor: COLORS.brand, marginTop: 1 },
  visualGuideCloseText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  tooltipHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  tooltipTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.onSurface },
  tooltipBody: { fontSize: 13, color: COLORS.onSurfaceTertiary, lineHeight: 20 },
  styleInfoImage: { width: '100%', height: 150, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  styleInfoLine: { color: COLORS.onSurface, fontSize: 13, lineHeight: 20, paddingVertical: 2 },
  // Timer chips
  timerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  timerChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  timerChipActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  timerChipText: { color: COLORS.onSurface, fontSize: 11, fontWeight: '700' },
  timerChipDuration: { color: COLORS.brand, fontSize: 12, fontWeight: '800', marginLeft: 2 },
  // Floating timer bar
  floatingTimers: { position: 'absolute', left: SPACING.md, right: SPACING.md },
  floatingTimersInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.pill, paddingLeft: SPACING.md, paddingRight: 4, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  floatingChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.success },
  floatingChipLabel: { color: '#fff', fontSize: 11, fontWeight: '700', maxWidth: 110 },
  floatingChipTime: { color: '#fff', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  blendPanel: { marginTop: SPACING.md, padding: SPACING.md, backgroundColor: COLORS.brandTertiary, borderRadius: RADIUS.md, gap: SPACING.sm },
  blendTitle: { fontSize: 12, fontWeight: '800', color: COLORS.brand, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 4, borderWidth: 1, borderColor: COLORS.border },
  stepperIdeal: { borderColor: COLORS.success, backgroundColor: '#DCFCE7' },
  stepperInRange: { borderColor: COLORS.brand },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, minWidth: 42, textAlign: 'center' },
  stepValIdeal: { color: COLORS.success },

  chipRow: { gap: SPACING.sm, paddingRight: SPACING.md },
  diameterRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  chip: { flex: 1, minWidth: 0, paddingHorizontal: 4, height: 36, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { color: COLORS.onSurface, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  customInput: { width: 48, height: 36, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.borderStrong, borderStyle: 'dashed', paddingHorizontal: 4, fontSize: 13, color: COLORS.onSurface, textAlign: 'center' },

  pillGroup: { flexDirection: 'row', gap: SPACING.sm },
  pill: { flex: 1, flexDirection: 'row', borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  pillActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  pillSelect: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  pillText: { color: COLORS.onSurface, fontSize: 14, fontWeight: '700' },
  pillTextActive: { color: '#fff' },

  hydRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-end', marginTop: SPACING.md },
  labelWithInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recipeAccordionHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },

  segmentedRow: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: RADIUS.sm },
  segBtnActive: { backgroundColor: COLORS.brand },
  segText: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  expandBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  fermentationModeOptions: { width: '100%', gap: SPACING.sm },
  fermentationModeOption: { width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.surface },
  fermentationModeOptionSelected: { borderWidth: 2, borderColor: COLORS.brand, backgroundColor: '#FFF4E8' },
  fermentationModeOptionText: { flex: 1, minWidth: 0, color: COLORS.onSurface, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  fermentationRecommendation: { color: COLORS.brand, fontSize: 12, fontWeight: '800', marginTop: 3 },
  expandText: { color: COLORS.brand, fontSize: 13, fontWeight: '700' },
  stepsBox: { gap: SPACING.sm, paddingTop: SPACING.sm },
  stepItem: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start', marginBottom: 6, paddingVertical: 4 },
  stepCheckWrap: { marginTop: 2, marginRight: 4 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stepCheckDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, color: COLORS.onSurface, fontSize: 13, lineHeight: 19 },
  stepTextDone: { textDecorationLine: 'line-through', color: COLORS.muted },
  resetBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginTop: 4 },
  resetBtnText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  phaseTitle: { flex: 1, fontSize: 13, color: COLORS.brand, fontWeight: '800', marginBottom: 0, textTransform: 'uppercase' },
  phaseTitleWithGuide: { flexShrink: 1 },
  phaseGuideButton: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },

  ovenRow: { flexDirection: 'row', gap: SPACING.sm },
  ovenCard: { flex: 1, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', gap: 6, minHeight: 88 },
  ovenCardActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  ovenIconWrap: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  ovenIconWrapActive: { backgroundColor: 'transparent' },
  ovenImage: { width: 44, height: 44 },
  ovenEmoji: { fontSize: 30 },
  ovenText: { color: COLORS.onSurface, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  bakeInstructions: { marginTop: SPACING.md, gap: SPACING.sm, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider },
  bakeTemperatureInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  bakeTempLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  bakeTempUnit: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  bakeTimeTable: { alignSelf: 'center', gap: 4 },
  bakeTimeRow: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center' },
  bakeText: { width: '100%', alignSelf: 'center', textAlign: 'center', fontSize: 14, lineHeight: 21, color: COLORS.onSurface, fontWeight: '700' },
  bakeBody: { fontSize: 13, color: COLORS.onSurfaceTertiary, lineHeight: 19 },

  recipeCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  recipeSection: { fontSize: 13, color: COLORS.brand, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  resLabel: { color: COLORS.muted, fontSize: 14, flex: 1 },
  resValue: { color: COLORS.onSurface, fontSize: 15, fontWeight: '700' },
  subBlock: { marginTop: SPACING.md, gap: 4, paddingTop: SPACING.sm, borderTopWidth: 2, borderTopColor: COLORS.brand },
  subhead: { fontSize: 12, color: COLORS.brand, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  hint: { fontSize: 12, color: COLORS.muted, fontStyle: 'italic', marginTop: 4, marginBottom: 4 },

  actionsRow: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: { flex: 1, flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: RADIUS.md },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  saveRecipeBtn: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: COLORS.brandTertiary },
  saveRecipeBtnText: { color: COLORS.brand, fontSize: 14, fontWeight: '700' },

  moreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, justifyContent: 'center', paddingVertical: SPACING.md },
  moreLink: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  moreLinkImg: { width: 22, height: 22 },
  moreLinkText: { color: COLORS.brand, fontSize: 13, fontWeight: '600' },

  modalRoot: { flex: 1, backgroundColor: COLORS.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.onSurface },
  schoolIntro: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.brandTertiary, padding: SPACING.md, borderRadius: RADIUS.md },
  schoolIntroText: { flex: 1, color: COLORS.onBrandTertiary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  ruleCard: { flexDirection: 'row', gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  ruleNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  ruleNumberText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  ruleTitle: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface, marginBottom: 4 },
  ruleBody: { fontSize: 14, color: COLORS.onSurfaceTertiary, lineHeight: 20 },
  copyBtn: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brand, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  copyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  savedRecipeInput: { backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, color: COLORS.onSurface, fontSize: 15 },
  savedRecipeError: { color: COLORS.error, fontSize: 13 },
  savedRecipeEmpty: { color: COLORS.muted, textAlign: 'center', paddingVertical: SPACING.lg },
  savedRecipeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md },
  savedRecipeName: { color: COLORS.onSurface, fontSize: 15, fontWeight: '800' },
  savedRecipeMeta: { color: COLORS.muted, fontSize: 12 },
  savedRecipeActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  savedRecipeAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 6 },
  savedRecipeActionText: { color: COLORS.brand, fontSize: 12, fontWeight: '700' },
  savedRecipeDelete: { padding: 7 },
  checkRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  checkLabel: { flex: 1, color: COLORS.onSurface, fontSize: 14 },
  checkQty: { color: COLORS.brand, fontSize: 14, fontWeight: '700' },
});
