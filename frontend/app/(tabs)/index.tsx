import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Platform, Alert, Image, ImageBackground, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
import { scheduleLocal, cancelLocal, cancelPlannerNotificationsForMethods, isPushSupported } from '../../src/notifications';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { getCachedExperienceLevel, loadExperienceLevel, subscribeExperienceLevel } from '../../src/experienceLevel';
import {
  getCachedTemperatureUnit, subscribeTemperatureUnit,
  getCachedMeasurementSystem, subscribeMeasurementSystem,
  getCachedPreferredYeastType, subscribePreferredYeastType,
} from '../../src/preferences';
import { displayTemperature, formatLength, formatTemperature, formatUnitText, formatWeight, temperatureInputToCelsius, weightInputToGrams } from '../../src/units';
import {
  dimensionsCalc, doughCalc, getFermentationSchedule, iceCalc, formatBakingTimeRange,
  Method, OvenType, FlourType, PizzaStyle, HomeFlourStrengthSource, PIZZA_STYLE_PROFILES, FLOUR_PROFILES, BASE_FLOURS, normalizeBeginnerSavedState, beginnerHydrationFor, blendIdealHydration,
  createDirectHomePizzaPlan, createBigaHomePizzaPlan, createPoolishHomePizzaPlan, getHomeFlourStrengthInput, getHomePlanLegacyFermentationHours,
  HomePizzaPlanSchedule, BigaHomePizzaSchedule, PoolishHomePizzaSchedule, getBigaHomeScheduleMilestones, getPoolishHomeScheduleMilestones, getSharedHomeBakeAt, subscribeSharedHomeBakeAt,
  setSharedHomeDirectSchedule, setSharedHomeBigaSchedule, setSharedHomePoolishSchedule,
} from '../../src/calculator';
import { api, useAuth } from '../../src/auth';

const DIAMETERS = [28, 30, 33, 35];
const CALCULATOR_SETTINGS_KEY = 'calculatorSettings';
const FREE_PIZZA_STYLE: PizzaStyle = 'neapolitan';
const FREE_FLOUR_TYPES: FlourType[] = ['caputo00', 'manitoba', 'spelt'];
const ALL_FLOUR_TYPES: FlourType[] = ['caputo00', 'manitoba', 'spelt', 'wholeWheat', 'glutenFree', 'custom'];
const isFlourType = (value: unknown): value is FlourType => ALL_FLOUR_TYPES.includes(value as FlourType);
type RecipeVariant = 'napolitana' | 'romanaTonda' | 'romanaTeglia' | 'newYork';
type SavedRecipe = { recipe_id: string; name: string; recipe: any };
type DetailedPhase = {
  title: string;
  steps: string[];
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
  { key: 'caputo00',   label: 'Tipo 0 / 00',           suffix: 'Idealno 68%', info: 'Klasično meko brašno za neapolitansku pizzu.\n\nPrimjeri: Caputo Pizzeria, Caputo Classica, Molino Dallagiovanna Rinforzato.\n\nW faktor ~ 260–300. Idealna hidracija 65–70%.' },
  { key: 'manitoba',   label: 'Manitoba / Visoki W',   suffix: 'Idealno 75%', info: 'Jače brašno s puno glutena za dugu hladnu fermentaciju i visoku hidraciju.\n\nPrimjeri: Caputo Cuoco, Caputo Oro, Manitoba Le 5 Stagioni.\n\nW faktor 320+. Idealna hidracija 70–80%.' },
  { key: 'spelt',      label: 'Pirovo brašno',         suffix: 'Idealno 62%', info: 'Aromatično brašno stare žitarice. Kraća fermentacija, niža hidracija.\n\nČesto se koristi u mješavini 30–50% s Tipo 00 za punoću okusa.' },
  { key: 'wholeWheat', label: 'Integralno brašno',     suffix: 'Idealno 72%', info: 'Integralno pšenično brašno. Više vlakana, tamnija boja, blago orašast okus.\n\nNajbolje u mješavini 20–40% s Tipo 00.' },
  { key: 'glutenFree', label: 'Bezglutensko brašno',   suffix: 'Idealno 80%', info: 'Poseban bezglutenski miks (npr. Caputo Fioreglut, Schär Mix B). Zahtijeva višu hidraciju i drukčiji zamjes.\n\nBez klasičnog razvoja glutena — pizza se često peče u kalupu.' },
  { key: 'custom',     label: 'Mješavina brašna (Blend)', suffix: 'Prilagođeno', info: 'Kombiniraj dva brašna A i B. Aplikacija automatski računa idealnu hidraciju kao ponderirani prosjek dvaju odabranih brašna.' },
];
const FLOURS_EN: FlourEntry[] = [
  { key: 'caputo00',   label: 'Tipo 0 / 00',       suffix: 'Ideal 68%', info: 'Classic soft wheat flour for Neapolitan pizza.\n\nExamples: Caputo Pizzeria, Caputo Classica, Molino Dallagiovanna Rinforzato.\n\nW factor ~ 260–300. Ideal hydration 65–70%.' },
  { key: 'manitoba',   label: 'Manitoba / High W', suffix: 'Ideal 75%', info: 'Strong flour with high gluten content for long cold fermentation and high hydration.\n\nExamples: Caputo Cuoco, Caputo Oro, Manitoba Le 5 Stagioni.\n\nW factor 320+. Ideal hydration 70–80%.' },
  { key: 'spelt',      label: 'Spelt flour',       suffix: 'Ideal 62%', info: 'Aromatic ancient grain flour. Shorter fermentation, lower hydration.\n\nOften used in 30–50% blend with Tipo 00 for rich flavor.' },
  { key: 'wholeWheat', label: 'Whole wheat flour', suffix: 'Ideal 72%', info: 'Whole wheat flour. Higher fiber, darker color, slightly nutty flavor.\n\nBest in a 20–40% blend with Tipo 00.' },
  { key: 'glutenFree', label: 'Gluten-free flour', suffix: 'Ideal 80%', info: 'Special gluten-free mix (e.g., Caputo Fioreglut, Schär Mix B). Requires higher hydration and different kneading.\n\nNo traditional gluten structure — pizza is often baked in a pan.' },
  { key: 'custom',     label: 'Flour Blend',        suffix: 'Custom',    info: 'Combine two flours A and B. The app automatically calculates the ideal hydration as a weighted average of the two selected flours.' },
];
const FLOURS_DE: FlourEntry[] = [
  { key: 'caputo00',   label: 'Tipo 0 / 00',           suffix: 'Ideal 68%', info: 'Klassisches Weichweizenmehl für neapolitanische Pizza.\n\nBeispiele: Caputo Pizzeria, Caputo Classica, Molino Dallagiovanna Rinforzato.\n\nW-Wert ~ 260–300. Ideale Hydratisierung 65–70%.' },
  { key: 'manitoba',   label: 'Manitoba / Hoher W-Wert', suffix: 'Ideal 75%', info: 'Starkes Mehl mit hohem Glutengehalt für lange kalte Fermentation und hohe Hydratisierung.\n\nBeispiele: Caputo Cuoco, Caputo Oro, Manitoba Le 5 Stagioni.\n\nW-Wert 320+. Ideale Hydratisierung 70–80%.' },
  { key: 'spelt',      label: 'Dinkelmehl',            suffix: 'Ideal 62%', info: 'Aromatisches Urgetreidemehl. Kürzere Fermentation, geringere Hydratisierung.\n\nOft in 30–50% Mischung mit Tipo 00 für vollen Geschmack.' },
  { key: 'wholeWheat', label: 'Vollkornmehl',          suffix: 'Ideal 72%', info: 'Weizenvollkornmehl. Mehr Ballaststoffe, dunklere Farbe, leicht nussiger Geschmack.\n\nAm besten in 20–40% Mischung mit Tipo 00.' },
  { key: 'glutenFree', label: 'Glutenfreies Mehl',     suffix: 'Ideal 80%', info: 'Spezielle glutenfreie Mischung (z.B. Caputo Fioreglut, Schär Mix B). Erfordert höhere Hydratisierung und anderes Kneten.\n\nOhne klassisches Glutennetzwerk – Pizza wird oft in der Form gebacken.' },
  { key: 'custom',     label: 'Mehlmischung (Blend)',  suffix: 'Angepasst', info: 'Kombiniere zwei Mehle A und B. Die App berechnet automatisch die ideale Hydratisierung als gewichteten Durchschnitt der beiden gewählten Mehle.' },
];
const FLOURS_SL: FlourEntry[] = [
  { key: 'caputo00',   label: 'Tipo 0 / 00',           suffix: 'Idealno 68%', info: 'Klasična mehka moka za neapeljsko pico.\n\nPrimeri: Caputo Pizzeria, Caputo Classica, Molino Dallagiovanna Rinforzato.\n\nW faktor ~ 260–300. Idealna hidracija 65–70%.' },
  { key: 'manitoba',   label: 'Manitoba / Visok W',    suffix: 'Idealno 75%', info: 'Močna moka z veliko glutena za dolgo hladno fermentacijo in visoko hidracijo.\n\nPrimeri: Caputo Cuoco, Caputo Oro, Manitoba Le 5 Stagioni.\n\nW faktor 320+. Idealna hidracija 70–80%.' },
  { key: 'spelt',      label: 'Pirova moka',           suffix: 'Idealno 62%', info: 'Aromatična moka iz pradavnih žit. Krajša fermentacija, nižja hidracija.\n\nPogosto uporabljena v mešanici 30–50% s Tipo 00 za bogat okus.' },
  { key: 'wholeWheat', label: 'Polnozrnata moka',      suffix: 'Idealno 72%', info: 'Polnozrnata pšenična moka. Več vlaknin, temnejša barva, rahlo oreškast okus.\n\nNajbolje v mešanici 20–40% s Tipo 00.' },
  { key: 'glutenFree', label: 'Brezglutenska moka',    suffix: 'Idealno 80%', info: 'Posebna brezglutenska mešanica (npr. Caputo Fioreglut, Schär Mix B). Zahteva višjo hidracijo in drugačno gnetenje.\n\nBrez klasičnega gluten mreževja — pica se pogosto peče v pekaču.' },
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
  const { t, lang } = useT();
  const sharedBakeAt = useSyncExternalStore(subscribeSharedHomeBakeAt, getSharedHomeBakeAt, getSharedHomeBakeAt);
  const { user } = useAuth();
  const experienceLevel = useSyncExternalStore(subscribeExperienceLevel, getCachedExperienceLevel, getCachedExperienceLevel);
  const experienceLoaded = experienceLevel !== undefined;
  const isBeginner = experienceLevel !== 'pro';

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
  const [hydration, setHydration] = useState(PIZZA_STYLE_PROFILES.neapolitan.hydration);
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
  const [showMixSteps, setShowMixSteps] = useState(false);
  const [moreTool, setMoreTool] = useState<null | 'school' | 'leftover' | 'shopping' | 'savedRecipes'>(null);
  const [editingRecipe, setEditingRecipe] = useState<{ id: string; name: string } | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [flourInfo, setFlourInfo] = useState<null | { label: string; info: string }>(null);
  const [styleInfo, setStyleInfo] = useState<PizzaStyle | null>(null);
  const [methodInfo, setMethodInfo] = useState<Method | null>(null);
  const visibleMethodInfo = isBeginner && methodInfo !== 'direct' ? null : methodInfo;
  const [styleExpanded, setStyleExpanded] = useState(false);
  const [flourExpanded, setFlourExpanded] = useState(false);
  const [activeTimers, setActiveTimers] = useState<Record<string, { endsAt: number; label: string; notifId?: string | null }>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const alertedRef = useRef<Set<string>>(new Set());
  // ticker: force re-render each second for countdowns AND check for expired timers
  const [now, setNow] = useState(() => Date.now());
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
  const isIdealHydration = hydration === flourProfile.ideal;
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
    // Beginner hydration is owned by the pizza style; flour choice must not override the displayed ideal.
    if (isBeginner) {
      if (f === 'glutenFree' || flour === 'glutenFree') setHydration(beginnerHydrationFor(pizzaStyle, f));
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
    setStyleExpanded(false);
    try { Haptics.selectionAsync(); } catch {}
  };

  const selectOven = (nextOven: OvenType, temperature: number) => {
    setOven(nextOven);
    setOvenTemp(temperature);
    setOvenTempEditing(false);
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
    setHydration(profile.hydration);
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
  const effectiveBall = isRomanTeglia ? customBallWeight ?? trayDoughWeight : customBallWeight ?? (diameter === styleProfile.defaultDiameter ? styleProfile.ballWeight : dims.doughBall);
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
    }, getHomeFlourStrengthInput(flour, explicitFlourStrength), hydration, preferredYeastType, new Date(), isBeginner);
  }, [isBeginner, method, sharedBakeAt, pizzaStyle, romanFormat, isRomanTeglia, pizzas, effectiveBall, roomTemp, fridgeTemp, oven, ovenTemp, flour, explicitFlourStrength, hydration, preferredYeastType]);
  const directHomeSchedule = method === 'direct' ? homePlan?.schedule ?? null : null;
  const beginnerDirectHome = isBeginner && method === 'direct' && !!directHomeSchedule;
  useEffect(() => {
    setSharedHomeDirectSchedule(directHomeSchedule && flour === 'glutenFree' ? { ...directHomeSchedule, glutenFree: true } : directHomeSchedule);
  }, [directHomeSchedule, flour]);
  const directRecipeRoomHours = directHomeSchedule?.roomAfterFridgeHours ?? roomHours;
  const directRecipeFridgeHours = directHomeSchedule?.fridgeHours ?? fridgeHours;
  const directHomeScheduleDisplay = directHomeSchedule ? formatDirectHomeSchedule(directHomeSchedule, roomTemp, fridgeTemp, lang) : null;
  const beginnerScheduleSteps = directHomeSchedule ? (() => {
    const dateLocale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
    const formatAt = (at: Date, previousAt?: Date) => {
      const sameDay = previousAt
        && at.getFullYear() === previousAt.getFullYear()
        && at.getMonth() === previousAt.getMonth()
        && at.getDate() === previousAt.getDate();
      return new Intl.DateTimeFormat(dateLocale, sameDay ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' }).format(at);
    };
    const { startAt, bakeAt, roomBeforeFridgeHours, fridgeHours, roomAfterFridgeHours } = directHomeSchedule;
    const steps = [{ label: t.beginnerCalc.timelineMix, at: startAt }];
    const ballingAt = directHomeSchedule.ballingAt ?? new Date(startAt.getTime() + roomBeforeFridgeHours * 3600000);
    if (fridgeHours > 0) {
      steps.push({
        label: isRomanTeglia ? t.beginnerCalc.timelineRefrigerateDough : t.beginnerCalc.timelineShapeBallsRefrigerate,
        at: ballingAt,
      });
      if (roomAfterFridgeHours > 0) {
        steps.push({ label: t.beginnerCalc.timelineRemoveFromFridge, at: new Date(startAt.getTime() + (roomBeforeFridgeHours + fridgeHours) * 3600000) });
      }
    } else {
      steps.push({ label: isRomanTeglia ? t.beginnerCalc.timelineRestDough : t.beginnerCalc.timelineShapeBalls, at: ballingAt });
    }
    const preheatAt = directHomeSchedule.preheatAt ?? new Date(bakeAt.getTime() - (oven === 'homeStone' ? 60 : 20) * 60000);
    const preheatMinutes = Math.round((bakeAt.getTime() - preheatAt.getTime()) / 60000);
    steps.push({
      label: `${t.beginnerCalc.preheat} · ${formatDuration(preheatMinutes * 60, lang)} · ${formatTemperature(ovenTemp, temperatureUnit)}`,
      at: preheatAt,
    });
    if (beginnerDirectHome) steps.push({
      label: isRomanTeglia ? t.beginnerCalc.timelineShapeTray : t.beginnerCalc.timelineShapeTop,
      at: new Date(bakeAt.getTime() - 15 * 60000),
    });
    steps.push({ label: t.beginnerCalc.bake, at: bakeAt });
    return steps
      .sort((left, right) => left.at.getTime() - right.at.getTime())
      .map((step, index, sorted) => ({
        ...step,
        time: formatAt(step.at, index > 0 ? sorted[index - 1].at : undefined),
      }));
  })() : [];
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
    }, new Date());
  }, [isBeginner, method, sharedBakeAt, pizzaStyle, pizzas, effectiveBall, roomTemp, fridgeTemp, oven]);
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
    }, new Date());
  }, [isBeginner, method, sharedBakeAt, pizzaStyle, pizzas, effectiveBall, roomTemp, fridgeTemp, oven, poolishHours]);
  const poolishHomeSchedule = isBeginner && method === 'poolish' ? poolishHomePlan?.schedule ?? null : null;
  useEffect(() => {
    setSharedHomePoolishSchedule(poolishHomeSchedule);
  }, [poolishHomeSchedule]);
  const poolishHomeScheduleDisplay = poolishHomeSchedule ? formatPoolishHomeSchedule(poolishHomeSchedule, lang) : null;
  const beginnerHomeRecipeLayout = isBeginner && !!(
    (method === 'direct' && directHomeSchedule)
    || (method === 'biga' && bigaHomeSchedule)
    || (method === 'poolish' && poolishHomeSchedule)
  );
  const beginnerHomePlanMilestones = directHomeSchedule
    ? [
      ...beginnerScheduleSteps.map(({ label, time }) => `${time} · ${label}`),
    ]
    : bigaHomeScheduleDisplay?.steps ?? poolishHomeScheduleDisplay?.steps ?? [];
  const dough = useMemo(() => doughCalc({
    pizzas, ballWeight: effectiveBall, hydration,
    saltPct, oilPct, method, bigaPct, poolishPct,
    roomHours: legacyDoughHours.roomHours, roomTemp, fridgeHours: legacyDoughHours.fridgeHours, fridgeTemp,
    prefermentHours,
    mixing: mixing === 'mixer' ? 'spiral' : 'hand',
    yeastType: preferredYeastType,
    flourType: flour,
    bigaHomeSchedule: bigaHomePlan?.schedule,
    poolishHomeSchedule: poolishHomePlan?.schedule,
  }), [pizzas, effectiveBall, hydration, saltPct, oilPct, method, bigaPct, poolishPct, prefermentHours, legacyDoughHours.roomHours, roomTemp, legacyDoughHours.fridgeHours, fridgeTemp, mixing, flour, preferredYeastType, bigaHomePlan, poolishHomePlan]);
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
  const beginnerHomeWaterInfo = ice
    ? ({
      hr: `Kalkulator je podijelio ukupno ${weight(dough.total.water)} vode na ${weight(ice.water)} vode i ${weight(ice.ice)} leda. Koristite te količine bez dodatne vode ili leda.`,
      en: `The calculator splits ${weight(dough.total.water)} total water into ${weight(ice.water)} water and ${weight(ice.ice)} ice. Use these amounts without adding extra water or ice.`,
      de: `Der Rechner teilt ${weight(dough.total.water)} Gesamtwasser in ${weight(ice.water)} Wasser und ${weight(ice.ice)} Eis auf. Verwenden Sie diese Mengen ohne zusätzliches Wasser oder Eis.`,
      sl: `Kalkulator razdeli skupno ${weight(dough.total.water)} vode na ${weight(ice.water)} vode in ${weight(ice.ice)} ledu. Uporabite ti količini brez dodatne vode ali ledu.`,
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
    if (v >= 15 && v <= 60) { setDiameter(Math.round(v)); setCustomBallWeight(null); setCustomBallInput(''); }
    setCustomDiameter('');
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
    setFlour(normalized.flour);
    setBlendA(normalized.blendA);
    setBlendB(normalized.blendB);
    setBlendPctA(normalized.blendPctA);
    setPizzaStyle(normalized.pizzaStyle);
    setRomanFormat(normalized.romanFormat);
    setDiameter(normalized.diameter);
    setTrayWidth(normalized.trayWidth);
    setTrayLength(normalized.trayLength);
    setTrayWidthInput(String(normalized.trayWidth));
    setTrayLengthInput(String(normalized.trayLength));
    setCustomBallWeight(normalized.customBallWeight);
    setCustomBallInput(normalized.customBallWeight === null ? '' : String(normalized.customBallWeight));
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
    ? getDetailedDirectSteps(mixing, directStepIngredients, dough.totalDough, pizzas, effectiveBall, diameter, directRecipeFridgeHours, directRecipeRoomHours, oven, ovenTemp, roomTemp, dims.cheese, undefined, undefined, flour, pizzaStyle === 'romana' && romanFormat === 'tonda', isRomanTeglia, pizzaStyle === 'ny_style' && isBeginner, pizzaStyle === 'neapolitan', { width: trayWidth, length: trayLength }, bakingTimeRange, isBeginner && pizzaStyle === 'neapolitan')
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
      ? getDetailedDirectStepsLocalized(lang, directStepIngredients, dough.totalDough, pizzas, effectiveBall, diameter, directRecipeFridgeHours, directRecipeRoomHours, roomTemp, dims.cheese, oven, ovenTemp, bakingTimeRange, mixing, isRomanTeglia ? 'romanaTeglia' : pizzaStyle === 'romana' ? 'romanaTonda' : pizzaStyle === 'ny_style' && isBeginner ? 'newYork' : 'napolitana', flour, { width: trayWidth, length: trayLength }, isBeginner && pizzaStyle === 'neapolitan')
    : null;
  const beginnerDirectRecipeSteps = isBeginner && method === 'direct' && detailedDirectSteps
    ? detailedDirectSteps.map((phase, phaseIndex) => ({
      ...phase,
      steps: phase.steps.map((step) => {
        const labelled = labelSelectedYeast(step, lang, preferredYeastType);
        if (!isCustom || phaseIndex !== 0) return labelled;
        const blendAmountA = Math.round(dough.main.flour * blendPctA / 100);
        const blendDetail = ` (${blendAmountA} g ${flourName(lang, blendA)} + ${Math.round(dough.main.flour) - blendAmountA} g ${flourName(lang, blendB)})`;
        return labelled.replace(/(\d+(?:\.\d+)? g (?:of flour|brašna|Mehl|moke))/, `$1${blendDetail}`);
      }),
    }))
    : null;
  const beginnerDirectHomeSteps = beginnerDirectHome && beginnerDirectRecipeSteps
    ? isRomanTeglia
      ? buildBeginnerTegliaHomeSteps(beginnerDirectRecipeSteps, directHomeSchedule, roomTemp, lang, ovenTemp, bakingTimeRange, { width: trayWidth, length: trayLength })
      : buildBeginnerDirectHomeSteps(beginnerDirectRecipeSteps, directHomeSchedule, roomTemp, fridgeTemp, ovenTemp, oven, bakingTimeRange, lang, preferredYeastType, mixing, pizzaStyle, diameter, dims.sauce, dims.cheese, flour)
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
          <Text style={styles.title}>{t.appName}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <Text style={styles.subtitle}>{t.calc.title}</Text>
          <Pressable testID="open-settings" onPress={() => router.push('/settings')} hitSlop={8}>
            <Icon name="settings-outline" size={22} color={COLORS.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2, gap: SPACING.lg }} keyboardShouldPersistTaps="handled">

        {/* 1. PIZZA STYLE */}
        <View style={styles.card}>
          <Pressable testID="style-header" onPress={() => setStyleExpanded((value) => !value)} style={styles.styleHeaderRow}>
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
          {styleExpanded ? <View style={{ gap: 6 }}>
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
        <View style={styles.card}>
          <Pressable
            testID="flour-header"
            onPress={() => setFlourExpanded((v) => !v)}
            style={styles.flourHeader}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.flourHeaderText}>{isBeginner ? t.beginnerCalc.stepFlour : `2 · ${t.flourSection.headerCollapsed}`}</Text>
              {!flourExpanded ? <Text style={styles.hint}>{FLOURS_BY_LANG[lang].find((entry) => entry.key === flour)?.label}</Text> : null}
            </View>
            <Icon name={flourExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
          </Pressable>

          {flourExpanded ? (
            <View style={{ gap: 6, marginTop: SPACING.md }}>
              {FLOURS_BY_LANG[lang].map((f) => {
                const active = flour === f.key;
                const locked = !isPremiumUnlocked && !isBeginner && !FREE_FLOUR_TYPES.includes(f.key);
                return (
                  <View key={f.key} style={styles.flourRowWrap}>
                    <Pressable
                      testID={`flour-${f.key}`}
                      onPress={() => { changeFlour(f.key); setFlourExpanded(false); }}
                      style={[styles.flourCompact, active && styles.flourCompactActive, locked && styles.lockedOption]}
                    >
                      <Image source={FLOUR_IMAGES[f.key]} style={styles.flourIcon} resizeMode="contain" />
                      <Text style={[styles.flourCompactLabel, active && { color: '#fff' }]} numberOfLines={1}>{f.label}</Text>
                      {locked ? <Icon name="lock-closed" size={16} color={COLORS.muted} style={{ marginLeft: 4 }} /> : active ? <Icon name="checkmark-circle" size={16} color="#fff" style={{ marginLeft: 4 }} /> : null}
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
        <View style={styles.card}>
              <Text style={styles.cardTitle}>{isBeginner ? t.beginnerCalc.stepPizzas : `3 · ${t.calc.dimensions}`}</Text>
          {pizzaStyle === 'romana' ? (
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
              <Text style={styles.label}>{isBeginner ? t.beginnerCalc.stepBall : t.ballWeight.label}</Text>
              {!isBeginner || customBallWeight != null ? <Text style={styles.subLabel} numberOfLines={2}>
                {customBallWeight != null
                  ? t.ballWeight.manualHint.replace('{N}g', weight(dims.doughBall))
                  : t.ballWeight.autoHint.replace('{N}g', weight(dims.doughBall))}
              </Text> : null}
            </View>
            <View style={styles.ballStepper}>
              <Pressable
                testID="ball-minus"
                onPress={() => step(() => setCustomBallWeight(Math.max(50, (customBallWeight ?? dims.doughBall) - 5)))}
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
                  if (!isNaN(n) && n >= 50 && n <= 600) setCustomBallWeight(n);
                }}
                onBlur={() => setCustomBallInput('')}
                keyboardType={measurementSystem === 'us' ? 'decimal-pad' : 'number-pad'}
                style={styles.stepInput}
                selectTextOnFocus
              />
              <Text style={styles.stepUnit}>{ballWeightInputUnit}</Text>
              <Pressable
                testID="ball-plus"
                onPress={() => step(() => setCustomBallWeight(Math.min(600, (customBallWeight ?? dims.doughBall) + 5)))}
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
                  <Text style={styles.label}>{t.calc.trayDoughMass}</Text>
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
              {!isBeginner ? <Text style={[styles.label, { marginTop: SPACING.md }]}>{t.calc.diameter}</Text> : null}
              {!isBeginner ? (
              <View style={styles.diameterRow}>
                {DIAMETERS.map((d) => (
                  <Pressable key={d} testID={`diam-${d}`} onPress={() => step(() => { setDiameter(d); setCustomBallWeight(null); setCustomBallInput(''); })} style={[styles.chip, diameter === d && styles.chipActive]}>
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
              ) : null}
            </>
          )}

        </View>

            {/* 4. METHOD + HYDRATION + TEMP */}
        <View style={styles.card}>
          <Pressable testID="method-header" onPress={() => setMethodExpanded((value) => !value)} style={styles.styleHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{isBeginner ? t.beginnerCalc.stepMethod : `4 · ${t.calc.method} + ${t.calc.hydration}`}</Text>
              {!methodExpanded ? <Text style={styles.hint}>{method === 'direct' ? t.calc.direct : method === 'biga' ? t.calc.biga : t.calc.poolish}</Text> : null}
            </View>
            <Icon name={methodExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
          </Pressable>
          {isBeginner ? (
            <View style={{ gap: SPACING.xs, marginTop: SPACING.sm }}>
              <Text style={styles.label}>{t.calc.mixingTitle}</Text>
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
            </View>
          ) : null}
          {methodExpanded ? <>
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
              <Text style={styles.subLabel}>{isBeginner ? `${t.calc.idealHydration}: ${beginnerHydrationFor(pizzaStyle, flour)}%` : `${t.calc.idealHydration}: ${flourProfile.min}–${flourProfile.max}% (◎ ${styleProfile.hydration}%)`}</Text>
            </View>
            <View style={[styles.stepper, isIdealHydration && styles.stepperIdeal, !isIdealHydration && inRange && styles.stepperInRange]}>
              <Pressable testID="hyd-minus" onPress={() => step(() => setHydration(Math.max(50, hydration - 1)))} style={styles.stepBtn}>
                <Icon name="remove" size={20} color={isIdealHydration ? COLORS.success : COLORS.brand} />
              </Pressable>
              <Text style={[styles.stepVal, isIdealHydration && { color: COLORS.success }]}>{hydration}%</Text>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isBeginner ? t.beginnerCalc.stepOven : `6 · ${t.calc.baking}`}</Text>
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

        {isBeginner ? (
          <View style={styles.card} testID="beginner-bake-plan">
            <Text style={styles.cardTitle}>{t.beginnerCalc.stepBake}</Text>
            {sharedBakeAt ? (
              <Text style={styles.subLabel}>
                {t.beginnerCalc.bakeTime}: {new Intl.DateTimeFormat({ hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang], { dateStyle: 'medium', timeStyle: 'short' }).format(sharedBakeAt)}
              </Text>
            ) : null}
            <Pressable testID="beginner-choose-bake-time" onPress={() => router.push('/(tabs)/planner')} style={styles.expandBtn}>
              <Icon name="calendar-outline" size={17} color={COLORS.brand} />
              <Text style={styles.expandText}>{t.beginnerCalc.setBakeTime}</Text>
            </Pressable>
            {method === 'direct' && !directHomeSchedule ? (
                <Text style={styles.hint}>{sharedBakeAt ? t.beginnerCalc.homePlanUnavailable : t.beginnerCalc.setBakeTime}</Text>
            ) : method !== 'direct' ? (
              <Text style={styles.hint}>{t.beginnerCalc.noHomeSchedule}</Text>
            ) : null}
          </View>
        ) : null}

        {isBeginner ? (
          <View style={styles.card} testID="beginner-home-conditions">
            <Text style={styles.cardTitle}>{t.beginnerCalc.stepConditions}</Text>
            <View style={styles.row}>
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
            </View>
            <View style={styles.row}>
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
            </View>
          </View>
        ) : null}

        {beginnerHomeRecipeLayout ? (
          <View style={styles.recipeCard} testID="beginner-final-recipe">
            <Text style={styles.recipeSection}>{t.beginnerCalc.homePlan}</Text>
            {beginnerHomePlanMilestones.map((milestone, index) => (
              <Text key={`${index}-${milestone}`} style={styles.hint}>{milestone}</Text>
            ))}
            <Text style={[styles.recipeSection, { marginTop: SPACING.md }]}>2. {t.beginnerCalc.ingredientList}</Text>
            {recipeIngredients}
          </View>
        ) : null}

        {/* 4. MIXING */}
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
                    waterInfo={beginnerDirectHome && index === 0 ? beginnerHomeWaterInfo : phase.waterInfo}
                    containerOilInfo={phase.containerOilInfo}
                    fermentationInfo={beginnerDirectHomeSteps ? undefined : directHomeSchedule ? withoutDirectScheduleTimingText(phase.fermentationInfo) : phase.fermentationInfo}
                    fermentationSignsInfo={phase.fermentationSignsInfo}
                    degassingInfo={phase.degassingInfo}
                    doughHandlingInfo={phase.doughHandlingInfo}
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
                    timers={directHomeSchedule ? [] : phase.timers}
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
                    <PhaseBlock title={t.calc.handMixSteps.B.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptFermentationSteps(t.calc.handMixSteps.B.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptFermentationSteps(t.calc.handMixSteps.B.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-B`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-hand-B', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.handMixSteps.C.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptDirectPhaseSteps('C', t.calc.handMixSteps.C.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptDirectPhaseSteps('C', t.calc.handMixSteps.C.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-C`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-hand-C', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.handMixSteps.D.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptDirectPhaseSteps('D', t.calc.handMixSteps.D.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptDirectPhaseSteps('D', t.calc.handMixSteps.D.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-D`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-hand-D', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                  </>
                ) : (
                  <>
                    <PhaseBlock title={t.calc.mixerSteps.A.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptFermentationSteps(t.calc.mixerSteps.A.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptFermentationSteps(t.calc.mixerSteps.A.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-A`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-mixer-A', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.mixerSteps.B.title} steps={directHomeSchedule ? withoutDirectScheduleTiming(adaptFermentationSteps(t.calc.mixerSteps.B.steps, directRecipeRoomHours, directRecipeFridgeHours, fridgeTemp, lang)) : adaptFermentationSteps(t.calc.mixerSteps.B.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-B`} timers={directHomeSchedule ? [] : getDirectPhaseTimers('direct-mixer-B', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
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

        {/* 6. RESULT - AT BOTTOM: Total FIRST, then per-pizza */}
        {!beginnerHomeRecipeLayout ? (
        <View style={styles.recipeCard}>
          {isBeginner ? <Text style={styles.recipeSection}>{t.beginnerCalc.ingredientList}</Text> : null}
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
): DetailedPhase[] {
  const hand = mixing === 'hand';
  const instructionFlour = flourType === 'custom' ? 'caputo00' : flourType;
  const isSpelt = instructionFlour === 'spelt';
  const isWholeWheat = instructionFlour === 'wholeWheat';
  const isGlutenFree = instructionFlour === 'glutenFree';
  const isRomanTonda = romanTonda;
  const isRomanTeglia = romanTeglia;
  const isNewYork = newYork;
  const isNapolitana = napolitana;
  const useBakeEstimate = isNewYork || estimatedBake;
  const coldFermentationDuration = formatDuration(fridgeHours * 3600, 'hr');
  const cheeseAmount = Math.round(cheesePerPizza);
  const psylliumAmount = flourType === 'glutenFree' ? Math.round(ingredients.flour * 0.02) : 0;
  const initialWater = Math.round(ingredients.water * 0.9);
  const remainingWater = Math.max(0, ingredients.water - initialWater);
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
  const mixRestMinutes = hand ? 15 : 5;
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

  return [
    {
      title: biga
        ? (hand ? 'Faza B: Dodavanje Bige i ručni zamjes' : 'Faza B: Dodavanje Bige i zamjes mikserom')
        : poolish
          ? (hand ? 'Faza B: Dodavanje Poolisha i ručni zamjes' : 'Faza B: Dodavanje Poolisha i zamjes mikserom')
        : (hand ? 'Faza A: Priprema i ručni zamjes' : 'Faza A: Priprema i zamjes mikserom'),
      waterInfo: `Idealna temperatura vode je 18–20 °C. Led je opcionalan: po potrebi zamijenite dio ukupne vode s približno ${idealIce} g leda i ${idealWater} g vode. Ako ne koristite led, upotrijebite svih ${ingredients.water} g hladne vode. Led se uvijek računa u ukupnu količinu vode.`,
      doughHandlingInfo: isGlutenFree
        ? `Bezglutensko brašno ne razvija klasičan gluten, pa je važno dodati psyllium u iznosu od ${psylliumAmount} g (2% od ukupnog brašna) i miješati vrlo kratko, na nižoj brzini, bez agresivnog razvijanja glutena.`
        : isWholeWheat
          ? 'Integralno brašno sadrži mekinje koje brže upijaju vodu i osjetljivije su na toplinu. Koristite hladnu vodu i miješajte kraće te na nižoj brzini; ne pretjerujte s dodavanjem vode i ne pokušavajte razviti agresivan gluten.'
          : isSpelt
            ? 'Pir ima osjetljiv gluten. Mijesite kraće i blaže, približno 5 minuta; cilj je samo ujednačiti smjesu, a ne razviti pretjerano napetu strukturu.'
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
        `Prosijte i precizno izmjerite ${ingredients.flour} g ${isSpelt ? 'pirovog ' : ''}brašna, ${ingredients.salt} g soli, ${ingredients.yeast} g svježeg kvasca i ukupno ${ingredients.water} g ${isSpelt ? 'hladne ' : ''}vode${isGlutenFree ? ` te ${psylliumAmount} g psylliuma` : ''}.`,
        `U približno 90% ${isSpelt ? 'hladne ' : ''}vode, odnosno ${initialWater} g, otopite kvasac.`,
        hand ? 'Postupno dodajte brašno u vodu s kvascem i miješajte rukom dok ne nestanu suhi dijelovi.' : 'Dodajte brašno u posudu miksera i miješajte na sporoj brzini dok ne nestanu suhi dijelovi.',
        `Postupno dodajte preostalih ${remainingWater} g ${isSpelt ? 'hladne ' : ''}vode, ne odjednom.`,
        `Kada je tijesto povezano i voda gotovo upijena, dodajte ${ingredients.salt} g soli kao zaseban korak.`,
        hand ? 'Nastavite mijesiti dok tijesto ne postane glatko, elastično i povezano.' : isSpelt ? 'Nastavite miješati na sporijoj do umjerenoj brzini, kraće nego obično, samo dok tijesto ne postane glatko, homogeno i povezano.' : 'Nastavite miješati na većoj brzini dok tijesto ne razvije gluten i postane glatko, elastično i povezano.',
        ...(ingredients.oil > 0 ? [hand ? `Dodajte ${ingredients.oil} g maslinovog ulja i mijesite dok ga tijesto potpuno ne upije.` : `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok ga tijesto potpuno ne upije.`] : []),
        ...(isGlutenFree ? [`Obavezno dodajte ${psylliumAmount} g psylliuma (2% od ukupne količine brašna) kako bi smjesa zadržala strukturu.`] : []),
        ...(!isGlutenFree && hand ? [isSpelt ? 'Mijesite kratko i nježno, samo dok se tijesto ne poveže i postane ujednačeno; ne premijesite.' : isWholeWheat ? 'Mijesite umjereno i bez agresivnog rastezanja dok se tijesto ne poveže i razvije dovoljnu strukturu.' : 'Prebacite tijesto na radnu površinu i mijesite dlanovima 10–15 minuta dok površina ne postane glatka.'] : []),
        'Zamjes je gotov kada je tijesto glatko, elastično i homogeno.',
        !isGlutenFree && hand ? `Pokrijte tijesto i ostavite ga ${mixRestMinutes} minuta da se gluten opusti.` : hand ? `Ostavite tijesto da odmori ${mixRestMinutes} minuta.` : `Ostavite tijesto da odmori ${mixRestMinutes} minuta u posudi miksera.`,
      ],
      timers: [timer(hand && !isGlutenFree ? 'post-mix-rest15m' : 'post-mix-rest', mixRestMinutes * 60, 'rest')],
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
        ? [timer('gluten-free-napolitana-rest', napolitanaGlutenFreeRemainingMinutes * 60, 'rt')]
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
      title: isRomanTeglia ? 'Faza E: Utiskivanje u tepsiju i pečenje' : hasPreferment ? (hasColdFermentation ? 'Faza F: Temperiranje i oblikovanje' : 'Faza E: Temperiranje i oblikovanje') : (hasColdFermentation ? 'Faza E: Temperiranje i oblikovanje' : 'Faza D: Temperiranje i oblikovanje'),
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
      timers: [timer('tempering', temperingMidpoint, 'preBake')],
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
): DetailedPhase[] {
  const hand = mixing === 'hand';
  const isGlutenFree = flourType === 'glutenFree';
  const isSpelt = flourType === 'spelt';
  const isWholeWheat = flourType === 'wholeWheat';
  const isRomanTonda = variant === 'romanaTonda';
  const isRomanTeglia = variant === 'romanaTeglia';
  const isNewYork = variant === 'newYork';
  const useBakeEstimate = isNewYork || estimatedBake;
  const coldFermentationDuration = formatDuration(fridgeHours * 3600, lang);
  const initialWater = Math.round(ingredients.water * 0.9);
  const remainingWater = Math.max(0, ingredients.water - initialWater);
  const idealIce = roomTemp > 19
    ? Math.min(Math.round(ingredients.water * 0.25), Math.max(0, Math.round((ingredients.water * (roomTemp - 19)) / 99)))
    : 0;
  const idealWater = ingredients.water - idealIce;
  const bulkRestMinutes = Math.max(15, Math.round(30 * (22 / Math.max(10, roomTemp))));
  const temperingMin = Math.min(120, Math.max(15, Math.round(30 + (22 - roomTemp) * 7.5)));
  const temperingMax = Math.min(120, temperingMin + 15);
  const ovenPreheatMin = oven === 'homeStone' ? 45 : 20;
  const ovenPreheatMax = oven === 'homeStone' ? 60 : 20;
  const temperingMidpoint = Math.round(((temperingMin + temperingMax) / 2) * 60);
  const cheeseAmount = Math.round(cheesePerPizza);
  const psylliumAmount = isGlutenFree ? Math.round(ingredients.flour * 0.02) : 0;
  const ballCount = Math.round(totalDough / ballWeight);
  const timer = (id: string, seconds: number, kind: BaseTimer['kind']): BaseTimer => ({ id, seconds, kind });
  const pick = (de: string, en: string, sl: string) => lang === 'de' ? de : lang === 'en' ? en : sl;
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
      title: hand
        ? pick('Phase A: Vorbereitung und Handmischung', 'Phase A: Preparation and Hand Mixing', 'Faza A: Priprava in ročno mešanje')
        : pick('Phase A: Vorbereitung und Mischen mit dem Mixer', 'Phase A: Preparation and Mixer Mixing', 'Faza A: Priprava in mešanje z mešalnikom'),
      waterInfo: pick(
        `Die ideale Wassertemperatur beträgt 18–20 °C. Das empfohlene Verhältnis für dieses Rezept beträgt ungefähr ${Math.round((idealWater / ingredients.water) * 100)}% Wasser (${idealWater} g) und ${Math.round((idealIce / ingredients.water) * 100)}% Eis (${idealIce} g). Das Eis wird zur Gesamtwassermenge gerechnet.`,
        `The ideal water temperature is 18–20 °C. The recommended ratio for this recipe is approximately ${Math.round((idealWater / ingredients.water) * 100)}% water (${idealWater} g) and ${Math.round((idealIce / ingredients.water) * 100)}% ice (${idealIce} g). Ice is included in the total water amount.`,
        `Idealna temperatura vode je 18–20 °C. Priporočeno razmerje za ta recept je približno ${Math.round((idealWater / ingredients.water) * 100)}% vode (${idealWater} g) in ${Math.round((idealIce / ingredients.water) * 100)}% ledu (${idealIce} g). Led se všteva v skupno količino vode.`,
      ),
      doughHandlingInfo: isGlutenFree
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
            : pick(
                'Bei hoher Hydration kann der Teig klebrig sein. Nicht automatisch Mehl hinzufügen. Ölen oder befeuchten Sie Ihre Hände leicht und lassen Sie den Teig einige Minuten entspannen. Fahren Sie danach mit dem nächsten Rezeptschritt fort.',
                'With high hydration, the dough may be sticky. Do not automatically add flour. Lightly oil or wet your hands and let the dough relax for a few minutes. Then continue with the next Recipe step.',
                'Pri visoki hidraciji je lahko testo lepljivo. Ne dodajajte samodejno moke. Roke rahlo naoljite ali navlažite in testo nekaj minut pustite, da se sprosti. Nato nadaljujte z naslednjim korakom recepta.',
              ),
      steps: [
        pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.'),
          ...(!hand ? [pick('Bereiten Sie den Mixer und seine Schüssel vor.', 'Prepare the mixer and its bowl.', 'Pripravite mešalnik in njegovo posodo.')] : []),
        isGlutenFree
          ? pick(`Wiegen Sie genau ${ingredients.flour} g glutenfreies Mehl, ${psylliumAmount} g Flohsamenschalen (Psyllium), ${ingredients.salt} g Salz, ${ingredients.yeast} g Frischhefe und insgesamt ${ingredients.water} g Wasser ab.`, `Accurately measure ${ingredients.flour} g of gluten-free flour, ${psylliumAmount} g of psyllium husk, ${ingredients.salt} g of salt, ${ingredients.yeast} g of fresh yeast, and ${ingredients.water} g of total water.`, `Natančno odmerite ${ingredients.flour} g brezglutenske moke, ${psylliumAmount} g luskin trpotca (psyllium), ${ingredients.salt} g soli, ${ingredients.yeast} g svežega kvasa in skupno ${ingredients.water} g vode.`)
          : pick(`Sieben und wiegen Sie genau ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Frischhefe und insgesamt ${ingredients.water} g Wasser ab.`, `Sift and accurately measure ${ingredients.flour} g of flour, ${ingredients.salt} g of salt, ${ingredients.yeast} g of fresh yeast, and ${ingredients.water} g of total water.`, `Presejte in natančno odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g svežega kvasa in skupno ${ingredients.water} g vode.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        isGlutenFree
          ? (hand
            ? pick('Geben Sie glutenfreies Mehl und Psyllium zum Wasser mit der Hefe und mischen Sie mit der Hand oder einem Spatel, bis keine trockenen Stellen mehr vorhanden sind.', 'Add the gluten-free flour and psyllium to the yeast water and mix by hand or with a spatula until no dry flour remains.', 'Brezglutensko moko in psyllium dodajte v vodo s kvasom ter mešajte z roko ali lopatko, dokler ne izginejo suhi deli.')
            : pick('Geben Sie glutenfreies Mehl und Psyllium in die Mixerschüssel und mischen Sie nur bei niedrigster Geschwindigkeit, bis keine trockenen Stellen mehr vorhanden sind.', 'Add the gluten-free flour and psyllium to the mixer bowl and mix on the lowest speed only until no dry flour remains.', 'Brezglutensko moko in psyllium dodajte v posodo mešalnika in mešajte samo pri najnižji hitrosti, dokler ne izginejo suhi deli.'))
          : hand
          ? pick('Geben Sie das Mehl nach und nach zum Wasser mit der Hefe und mischen Sie es mit der Hand, bis keine trockenen Stellen mehr vorhanden sind.', 'Gradually add the flour to the water and yeast mixture and mix by hand until no dry flour remains.', 'Postopoma dodajajte moko v vodo s kvasom in mešajte z roko, dokler ne izginejo suhi deli.')
          : pick('Geben Sie das Mehl in die Mixerschüssel und mischen Sie bei niedriger Geschwindigkeit, bis keine trockenen Stellen mehr vorhanden sind.', 'Add the flour to the mixer bowl and mix on low speed until no dry flour remains.', 'Moko dodajte v posodo mešalnika in mešajte pri nizki hitrosti, dokler ne izginejo suhi deli.'),
        pick(`Geben Sie die restlichen ${remainingWater} g Wasser nach und nach hinzu, nicht auf einmal.`, `Gradually add the remaining ${remainingWater} g of water, not all at once.`, `Postopoma dodajte preostalih ${remainingWater} g vode, ne vse naenkrat.`),
        pick(`Wenn der Teig verbunden ist und das Wasser fast vollständig aufgenommen wurde, geben Sie ${ingredients.salt} g Salz als separaten Schritt hinzu.`, `When the dough has come together and the water is almost fully absorbed, add ${ingredients.salt} g of salt as a separate step.`, `Ko je testo povezano in je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli kot ločen korak.`),
        isGlutenFree
          ? pick('Glutenfreier Teig wird nicht geknetet, um Gluten zu entwickeln; mischen Sie nur, bis sich alle Zutaten zu einer homogenen, klebrigen Masse verbinden.', 'Gluten-free dough is not kneaded to develop gluten; mix only until all ingredients form a homogeneous, sticky mass.', 'Brezglutensko testo se ne gnete za razvoj glutena; mešajte samo, dokler se vse sestavine ne povežejo v homogeno, lepljivo maso.')
          : isSpelt || isWholeWheat
          ? (hand
            ? pick('Kneten Sie kurz und sanft, nur bis der Teig verbunden und gleichmäßig ist; nicht überkneten.', 'Knead briefly and gently, only until the dough is combined and even; do not over-knead.', 'Gnetite kratko in nežno, samo dokler se testo ne poveže in postane enakomerno; ne pregnetite.')
            : pick('Mischen Sie bei niedriger bis mittlerer Geschwindigkeit nur kurz, bis der Teig verbunden und gleichmäßig ist; nicht übermischen.', 'Mix at low to medium speed only briefly, until the dough is combined and even; do not over-mix.', 'Mešajte kratko pri nizki do srednji hitrosti, samo dokler se testo ne poveže in postane enakomerno; ne premešajte.'))
          : hand
          ? pick('Kneten Sie weiter, bis der Teig glatt, elastisch und gut verbunden ist.', 'Continue kneading until the dough becomes smooth, elastic, and well connected.', 'Nadaljujte z gnetenjem, dokler testo ne postane gladko, elastično in povezano.')
          : pick('Mischen Sie bei höherer Geschwindigkeit weiter, bis sich Gluten entwickelt und der Teig glatt, elastisch und gut verbunden ist.', 'Continue mixing at a higher speed until gluten develops and the dough becomes smooth, elastic, and well connected.', 'Nadaljujte z mešanjem pri višji hitrosti, dokler se ne razvije gluten in testo postane gladko, elastično in povezano.'),
        ...(ingredients.oil > 0 ? [isGlutenFree
          ? pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie, bis es vollständig eingearbeitet ist.`, `Add ${ingredients.oil} g of olive oil and mix until it is fully incorporated.`, `Dodajte ${ingredients.oil} g oljčnega olja in mešajte, dokler se popolnoma ne vmeša.`)
          : hand
          ? pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g of olive oil and knead until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in gnetite, dokler ga testo popolnoma ne vpije.`)
          : pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie, bis der Teig das Öl vollständig aufgenommen hat.`, `Add ${ingredients.oil} g of olive oil and mix until the dough has fully absorbed it.`, `Dodajte ${ingredients.oil} g oljčnega olja in mešajte, dokler ga testo popolnoma ne vpije.`)] : []),
        isGlutenFree
          ? pick('Das Mischen ist beendet, wenn die Masse gleichmäßig, glatt und klebrig ist.', 'Mixing is finished when the mass is even, smooth, and sticky.', 'Mešanje je končano, ko je masa enakomerna, gladka in lepljiva.')
          : pick('Der Teig ist fertig geknetet, wenn er glatt, elastisch und homogen ist.', 'The dough is fully mixed when it is smooth, elastic, and homogeneous.', 'Gnetenje je končano, ko je testo gladko, elastično in homogeno.'),
        isGlutenFree
          ? (hand
            ? pick('Lassen Sie die Masse 5 Minuten ruhen, damit das Psyllium Feuchtigkeit bindet und Struktur gibt.', 'Let the mass rest for 5 minutes so the psyllium absorbs moisture and builds structure.', 'Maso pustite počivati 5 minut, da psyllium vpije vlago in da strukturo.')
            : pick('Lassen Sie die Masse 5 Minuten in der Mixerschüssel ruhen, damit das Psyllium Feuchtigkeit bindet und Struktur gibt.', 'Let the mass rest for 5 minutes in the mixer bowl so the psyllium absorbs moisture and builds structure.', 'Maso pustite počivati 5 minut v posodi mešalnika, da psyllium vpije vlago in da strukturo.'))
          : hand
          ? pick('Lassen Sie den Teig 5–6 Minuten ruhen.', 'Let the dough rest for 5–6 minutes.', 'Testo pustite počivati 5–6 minut.')
          : pick('Lassen Sie den Teig 5–6 Minuten in der Mixerschüssel ruhen.', 'Let the dough rest for 5–6 minutes in the mixer bowl.', 'Testo pustite počivati 5–6 minut v posodi mešalnika.'),
      ],
      timers: [timer('post-mix-rest', 5 * 60, 'rest')],
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
      timers: [timer('tempering', temperingMidpoint, 'preBake')],
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
  return {
    title: labels.title,
    steps: [
      `${labels.before}: ${hours(schedule.roomBeforeFridgeHours)} ${labels.at} ${roomTemp} °C.`,
      `${labels.fridge}: ${hours(schedule.fridgeHours)} ${labels.at} ${fridgeTemp} °C.`,
      `${labels.after}: ${hours(schedule.roomAfterFridgeHours)} ${labels.at} ${roomTemp} °C.`,
      `${labels.bake}: ${new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(schedule.bakeAt)}.`,
    ],
    timers: [
      { id: 'direct-home-before-fridge', seconds: schedule.roomBeforeFridgeHours * 3600, kind: 'rt' as const },
      { id: 'direct-home-fridge', seconds: schedule.fridgeHours * 3600, kind: 'fridge' as const },
      { id: 'direct-home-after-fridge', seconds: schedule.roomAfterFridgeHours * 3600, kind: 'ballsRt' as const },
    ],
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
        timers: [],
      };
    }
    return phase;
  });
}

function buildBeginnerTegliaHomeSteps(
  phases: DetailedPhase[],
  schedule: HomePizzaPlanSchedule,
  roomTemp: number,
  lang: Lang,
  ovenTemp: number,
  bakingTimeRange: string,
  trayDimensions: { width: number; length: number },
): DetailedPhase[] {
  const dateLocale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
  const formatAt = (time: Date) => new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
  const refrigerated = schedule.fridgeHours > 0;
  const ballingAt = schedule.ballingAt ?? new Date(schedule.startAt.getTime() + schedule.roomBeforeFridgeHours * 3600000);
  const fridgeOutAt = new Date(ballingAt.getTime() + schedule.fridgeHours * 3600000);
  const shapeAt = new Date(schedule.bakeAt.getTime() - 0.25 * 3600000);
  const total = formatDuration(Math.round(schedule.roomAfterFridgeHours * 60) * 60, lang);
  const copy = {
    hr: {
      out: `Izvadite tijesto iz hladnjaka u planirano vrijeme i ostavite ga ukupno ${total} na ${roomTemp} °C; zadnjih 15 minuta tog razdoblja koristite za utiskivanje u tepsiju i dodavanje nadjeva.`,
      room: `Držite pokriveno tijesto kao jednu masu ukupno ${total} na ${roomTemp} °C; zadnjih 15 minuta tog razdoblja koristite za utiskivanje u tepsiju i dodavanje nadjeva.`,
    },
    en: {
      out: `Take the dough out of the refrigerator at the scheduled time and let it relax at ${roomTemp} °C for ${total} in total; use the last 15 minutes of that period to press it into the tray and top it.`,
      room: `Keep the covered dough as one mass at ${roomTemp} °C for ${total} in total; use the last 15 minutes of that period to press it into the tray and top it.`,
    },
    de: {
      out: `Nehmen Sie den Teig zum geplanten Zeitpunkt aus dem Kühlschrank und lassen Sie ihn insgesamt ${total} bei ${roomTemp} °C entspannen; nutzen Sie die letzten 15 Minuten dieses Zeitraums zum Einlegen in das Blech und Belegen.`,
      room: `Lassen Sie die abgedeckte Teigmasse insgesamt ${total} bei ${roomTemp} °C ruhen; nutzen Sie die letzten 15 Minuten dieses Zeitraums zum Einlegen in das Blech und Belegen.`,
    },
    sl: {
      out: `Testo ob načrtovanem času vzemite iz hladilnika in ga skupaj ${total} pustite pri ${roomTemp} °C; zadnjih 15 minut tega obdobja uporabite za vtiskovanje v pekač in oblaganje.`,
      room: `Pokrito testo kot eno maso skupaj ${total} pustite pri ${roomTemp} °C; zadnjih 15 minut tega obdobja uporabite za vtiskovanje v pekač in oblaganje.`,
    },
  }[lang];
  const tray = `${trayDimensions.width}×${trayDimensions.length} cm`;
  const pressSteps = {
    hr: {
      oil: `Lagano nauljite tepsiju ${tray}.`,
      press: 'Istresite masu u tepsiju i nježno je utisnite prstima do rubova bez rastezanja u zraku.',
      relax: 'Ako se tijesto vraća prema sredini, ostavite ga kratko da se opusti i ponovno ga utisnite.',
      top: 'Dodajte umak i nadjev.',
      bake: `Ubacite tepsiju u pećnicu i pecite bez grilla ${bakingTimeRange} na ${ovenTemp} °C, dok se dno i rub dobro ne ispeku.`,
      grill: 'Na kraju uključite grill ako želite jače zapečenu gornju stranu.',
    },
    en: {
      oil: `Lightly oil the ${tray} tray.`,
      press: 'Transfer the dough mass into the tray and gently press it to the edges with your fingertips, without stretching it in the air.',
      relax: 'If the dough springs back toward the center, let it relax briefly and press it out again.',
      top: 'Add sauce and toppings.',
      bake: `Put the tray in the oven and bake without the grill for ${bakingTimeRange} at ${ovenTemp} °C, until the bottom and rim are well baked.`,
      grill: 'Finally, switch on the grill if you want a more browned top.',
    },
    de: {
      oil: `Ölen Sie das Blech ${tray} leicht ein.`,
      press: 'Geben Sie die Teigmasse in das Blech und drücken Sie sie mit den Fingerspitzen vorsichtig bis zu den Rändern, ohne sie in der Luft zu dehnen.',
      relax: 'Zieht sich der Teig zur Mitte zurück, lassen Sie ihn kurz entspannen und drücken Sie ihn erneut aus.',
      top: 'Geben Sie Sauce und Belag darauf.',
      bake: `Schieben Sie das Blech in den Ofen und backen Sie ohne Grill ${bakingTimeRange} bei ${ovenTemp} °C, bis Boden und Rand gut gebacken sind.`,
      grill: 'Schalten Sie am Ende den Grill ein, wenn Sie eine stärker gebräunte Oberseite möchten.',
    },
    sl: {
      oil: `Pekač ${tray} rahlo naoljite.`,
      press: 'Maso testa prenesite v pekač in jo s konicami prstov nežno potisnite do robov, brez raztegovanja v zraku.',
      relax: 'Če se testo vrača proti sredini, ga pustite kratek čas počivati in ga ponovno potisnite.',
      top: 'Dodajte omako in nadev.',
      bake: `Pekač postavite v pečico in pecite brez žara ${bakingTimeRange} pri ${ovenTemp} °C, dokler dno in rob nista dobro pečena.`,
      grill: 'Na koncu vklopite žar, če želite bolj zapečeno zgornjo stran.',
    },
  }[lang];
  const coldTitle = /cold fermentation|kalte fermentation|hladna fermentacija/i;
  const active = refrigerated ? phases : phases.filter((phase) => !coldTitle.test(phase.title));
  const lastIndex = active.length - 1;
  return active.map((phase, index) => {
    if (index !== lastIndex || phase.steps.length < 4) return phase;
    const [preheat] = phase.steps;
    return {
      ...phase,
      temperingInfo: refrigerated ? phase.temperingInfo : undefined,
      steps: [
        `${preheat} (${formatAt(schedule.preheatAt ?? new Date(schedule.bakeAt.getTime() - 20 * 60000))})`,
        `${refrigerated ? copy.out : copy.room} (${formatAt(refrigerated ? fridgeOutAt : ballingAt)})`,
        `${pressSteps.oil} (${formatAt(shapeAt)})`,
        `${pressSteps.press} (${formatAt(shapeAt)})`,
        pressSteps.relax,
        `${pressSteps.top} (${formatAt(shapeAt)})`,
        `${pressSteps.bake} (${formatAt(schedule.bakeAt)})`,
        pressSteps.grill,
      ],
    };
  });
}

function buildBeginnerDirectHomeSteps(
  phases: DetailedPhase[],
  schedule: HomePizzaPlanSchedule,
  roomTemp: number,
  fridgeTemp: number,
  ovenTemp: number,
  oven: OvenType,
  bakingTimeRange: string,
  lang: Lang,
  yeastType: 'fresh' | 'dry',
  mixing: 'hand' | 'mixer',
  pizzaStyle: PizzaStyle,
  diameter: number,
  saucePerPizza: number,
  cheesePerPizza: number,
  flourType: FlourType = 'caputo00',
): DetailedPhase[] {
  const isGlutenFree = flourType === 'glutenFree';
  const dateLocale = { hr: 'hr-HR', en: 'en-GB', de: 'de-DE', sl: 'sl-SI' }[lang];
  const formatAt = (time: Date) => new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
  const shapeWindowHours = 0.25;
  const fallbackPreheatMinutes = oven === 'homeStone' ? 60 : 20;
  const preheatAt = schedule.preheatAt ?? new Date(schedule.bakeAt.getTime() - fallbackPreheatMinutes * 60000);
  const ballingAt = schedule.ballingAt ?? new Date(schedule.startAt.getTime() + schedule.roomBeforeFridgeHours * 3600000);
  const fridgeOutAt = new Date(ballingAt.getTime() + schedule.fridgeHours * 3600000);
  const shapeAt = new Date(schedule.bakeAt.getTime() - shapeWindowHours * 3600000);
  const preheatMinutes = Math.round((schedule.bakeAt.getTime() - preheatAt.getTime()) / 60000);
  const labels = {
    hr: {
      room: (start: string, balling: string) => `Miješanje i bulk traju na ${roomTemp} °C od Start (${start}) do Kuglanja (${balling}); napravite 1–2 nježna preklapanja unutar ove faze.`,
      fridge: (hours: string) => `Oblikovane kuglice stavite u zatvorenu kutiju i hladite ${hours} pri ${fridgeTemp} °C.`,
      takeOut: (hours: string) => `Izvadite kuglice iz hladnjaka u planirano vrijeme i ostavite ih ukupno ${hours} na ${roomTemp} °C; zadnjih 15 minuta tog razdoblja koristite za oblikovanje i dodavanje nadjeva.`,
      roomOnlyRestStart: (hours: string) => `Nakon kuglanja držite pokrivene kuglice ukupno ${hours} na ${roomTemp} °C; zadnjih 15 minuta tog razdoblja koristite za oblikovanje i dodavanje nadjeva.`,
      shape: 'Oblikujte i dodajte nadjev u planiranih zadnjih 15 minuta; lansirajte pizzu u planirano vrijeme pečenja.',
      preheat: (minutes: number) => `U planirano vrijeme zagrijavanja zagrijte kamen ili čelik za pizzu na ${ovenTemp} °C s uključenim grillom; točno vrijeme predgrijavanja je ${minutes} minuta.`,
      bake: (time: string) => pizzaStyle === 'ny_style'
        ? `Pecite pizzu ${time} i po potrebi kratko završite grillom unutar tog raspona.`
        : `Pecite pizzu ${time}.`,
      yeast: yeastType === 'dry' ? 'suhog kvasca' : 'svježeg kvasca',
      briefRest: 'Ostavite tijesto kratko da odmori.',
    },
    en: {
      room: (start: string, balling: string) => `Mixing and bulk run at ${roomTemp} °C from Start (${start}) to Balling (${balling}); perform 1–2 gentle folds within this phase.`,
      fridge: (hours: string) => `Place the dough balls in a closed fermentation box and refrigerate for ${hours} at ${fridgeTemp} °C.`,
      takeOut: (hours: string) => `Take the dough balls out at the scheduled time and leave them at ${roomTemp} °C for ${hours} in total; the last 15 minutes of that period are for shaping and topping.`,
      roomOnlyRestStart: (hours: string) => `After balling, keep the covered dough balls at ${roomTemp} °C for ${hours} in total; the last 15 minutes of that period are for shaping and topping.`,
      shape: 'Shape and top during the scheduled final 15 minutes; launch the pizza at the scheduled bake time.',
      preheat: (minutes: number) => oven === 'homePan'
        ? `At the scheduled preheat time, preheat the home oven for ${minutes} minutes to ${ovenTemp} °C with convection.`
        : oven === 'ooni'
          ? `At the scheduled preheat time, preheat the pizza oven for ${minutes} minutes to ${ovenTemp} °C.`
          : `At the scheduled preheat time, preheat the pizza stone or steel to ${ovenTemp} °C with the grill on; the scheduled preheat duration is ${minutes} minutes.`,
      bake: (time: string) => pizzaStyle === 'ny_style'
        ? `Bake the pizza for ${time}, including any brief grill finish.`
        : `Bake the pizza for ${time}.`,
      yeast: yeastType === 'dry' ? 'dry yeast' : 'fresh yeast',
      briefRest: 'Let the dough rest briefly.',
    },
    de: {
      room: (start: string, balling: string) => `Mischen und Stockgare dauern bei ${roomTemp} °C vom Start (${start}) bis zum Ballen (${balling}); führen Sie 1–2 sanfte Faltungen innerhalb dieser Phase durch.`,
      fridge: (hours: string) => `Legen Sie die Teigkugeln in eine geschlossene Box und stellen Sie sie für ${hours} bei ${fridgeTemp} °C in den Kühlschrank.`,
      takeOut: (hours: string) => `Nehmen Sie die Teigkugeln zum geplanten Zeitpunkt heraus und lassen Sie sie insgesamt ${hours} bei ${roomTemp} °C ruhen; die letzten 15 Minuten dieses Zeitraums sind zum Formen und Belegen vorgesehen.`,
      roomOnlyRestStart: (hours: string) => `Lassen Sie die abgedeckten Teiglinge nach dem Ballen insgesamt ${hours} bei ${roomTemp} °C ruhen; die letzten 15 Minuten dieses Zeitraums sind zum Formen und Belegen vorgesehen.`,
      shape: 'Formen und belegen Sie die Pizza in den geplanten letzten 15 Minuten; schieben Sie sie zur geplanten Backzeit in den Ofen.',
      preheat: (minutes: number) => oven === 'homePan'
        ? `Heizen Sie den Haushaltsbackofen zum geplanten Zeitpunkt ${minutes} Minuten lang auf ${ovenTemp} °C mit Umluft vor.`
        : oven === 'ooni'
          ? `Heizen Sie den Pizzaofen zum geplanten Zeitpunkt ${minutes} Minuten lang auf ${ovenTemp} °C vor.`
          : `Heizen Sie den Pizzastein oder -stahl zum geplanten Zeitpunkt auf ${ovenTemp} °C mit eingeschaltetem Grill vor; die geplante Vorheizdauer beträgt ${minutes} Minuten.`,
      bake: (time: string) => pizzaStyle === 'ny_style'
        ? `Backen Sie die Pizza ${time}${lang === 'de' ? '' : '.'} Ein kurzer Grillabschluss ist in diesem Zeitraum enthalten.`
        : `Backen Sie die Pizza ${time}.`,
      yeast: yeastType === 'dry' ? 'Trockenhefe' : 'Frischhefe',
      briefRest: 'Lassen Sie den Teig kurz ruhen.',
    },
    sl: {
      room: (start: string, balling: string) => `Mešanje in prva fermentacija trajata pri ${roomTemp} °C od začetka (${start}) do oblikovanja kroglic (${balling}); znotraj te faze naredite 1–2 nežna pregiba.`,
      fridge: (hours: string) => `Kroglice položite v zaprto posodo in jih hladite ${hours} pri ${fridgeTemp} °C.`,
      takeOut: (hours: string) => `Kroglice vzemite iz hladilnika ob načrtovanem času in jih skupaj ${hours} pustite pri ${roomTemp} °C; zadnjih 15 minut tega obdobja je namenjenih oblikovanju in oblaganju.`,
      roomOnlyRestStart: (hours: string) => `Po oblikovanju pokrite kroglice skupaj ${hours} pustite pri ${roomTemp} °C; zadnjih 15 minut tega obdobja je namenjenih oblikovanju in oblaganju.`,
      shape: 'Oblikujte in obložite pico v načrtovanih zadnjih 15 minutah; v pečico jo vstavite ob načrtovanem času peke.',
      preheat: (minutes: number) => oven === 'homePan'
        ? `Ob načrtovanem času segrevajte domačo pečico ${minutes} minut na ${ovenTemp} °C z ventilacijo.`
        : oven === 'ooni'
          ? `Ob načrtovanem času segrevajte pizza pečico ${minutes} minut na ${ovenTemp} °C.`
          : `Ob načrtovanem času segrejte kamen ali jeklo za pico na ${ovenTemp} °C z vklopljenim žarom; načrtovano predgretje traja ${minutes} minut.`,
      bake: (time: string) => pizzaStyle === 'ny_style'
        ? `Pico pecite ${time}; čas vključuje morebitno kratko zapečenje pod žarom.`
        : `Pico pecite ${time}.`,
      yeast: yeastType === 'dry' ? 'suhega kvasa' : 'svežega kvasa',
      briefRest: 'Testo pustite kratek čas počivati.',
    },
  }[lang];
  const duration = (hours: number) => formatDuration(Math.round(hours * 60) * 60, lang);
  const timed = /\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*(?:hours?|hrs?|h|minutes?|mins?|seconds?|secs?|stunden?|minuten?|sekunden?|stunden?|sati|sata|sat|ur|ura|ure|minuta|minute|minuti|sekund|sekunde|sekundi)/i;
  const replaceYeastLabel = (text: string) => labelSelectedYeast(text, lang, yeastType);
  const shapingSteps = ({
    hr: {
      surface: oven === 'homePan' ? 'Lagano nauljite tepsiju.' : 'Radnu površinu lagano pospite semolom.',
      ball: 'Nježno uzmite jednu kuglu tijesta bez istiskivanja zraka.',
      shape: pizzaStyle === 'romana'
        ? `Tijekom zadnjih ${duration(shapeWindowHours)} oblikujte tanku i ravnu Romanu do ${diameter} cm; pritisnite prstima ili koristite valjak, bez agresivnog rastezanja u zraku.`
        : pizzaStyle === 'ny_style'
          ? `Tijekom zadnjih ${duration(shapeWindowHours)} oblikujte veću kuglu s tankom sredinom i ujednačenom debljinom do ${diameter} cm; nemojte stvarati visok, napuhan rub. Kriška treba biti savitljiva.`
          : `Tijekom zadnjih ${duration(shapeWindowHours)} prstima potiskujte zrak od sredine prema rubu, ostavite rub 1–2 cm i razvucite do ${diameter} cm; ne koristite valjak.`,
      toppings: `Dodajte ${saucePerPizza} g umaka i ${cheesePerPizza} g mozzarelle; ostavite rub bez nadjeva.`,
      launch: 'Lansirajte pizzu točno u planirano vrijeme pečenja.',
      bake: oven === 'homeStone'
        ? `Isključite grill, koristite Pizza program ili gornji i donji grijač bez ventilatora. Pecite ${bakingTimeRange} na ${ovenTemp} °C i završite grillom za boju.`
        : oven === 'ooni'
          ? `Pecite ${bakingTimeRange} na ${ovenTemp} °C i rotirajte svakih 20–30 sekundi.`
          : `Pecite ${bakingTimeRange} na ${ovenTemp} °C; provjerite dno i po potrebi kratko završite gornjim grillom.`,
    },
    en: {
      surface: oven === 'homePan' ? 'Lightly oil the baking tray.' : 'Lightly dust the work surface with semolina.',
      ball: 'Gently lift one dough ball without pressing out its gas.',
      shape: pizzaStyle === 'romana'
        ? `During the final ${duration(shapeWindowHours)}, press or roll the Romana thin and flat to ${diameter} cm; do not stretch it aggressively in the air.`
        : pizzaStyle === 'ny_style'
          ? `During the final ${duration(shapeWindowHours)}, shape the larger dough ball with a thin center and even thickness to ${diameter} cm; do not create a tall, puffy rim. The slice should fold easily.`
          : `During the final ${duration(shapeWindowHours)}, press air from the center toward the edge, leave a 1–2 cm rim, and stretch to ${diameter} cm; do not use a rolling pin.`,
      toppings: `Add ${saucePerPizza} g sauce and ${cheesePerPizza} g mozzarella, leaving the rim clear.`,
      launch: 'Launch the pizza exactly at the scheduled bake time.',
      bake: oven === 'homeStone'
        ? `Turn off the grill and use the Pizza program or top and bottom heat without a fan. Bake ${bakingTimeRange} at ${ovenTemp} °C; finish under the grill for color.`
        : oven === 'ooni'
          ? `Bake ${bakingTimeRange} at ${ovenTemp} °C, rotating every 20–30 seconds.`
          : `Bake ${bakingTimeRange} at ${ovenTemp} °C; check the base and finish briefly under the upper grill if needed.`,
    },
    de: {
      surface: oven === 'homePan' ? 'Fetten Sie das Backblech leicht ein.' : 'Bestäuben Sie die Arbeitsfläche leicht mit Semola.',
      ball: 'Heben Sie eine Teigkugel vorsichtig an, ohne das Gas herauszudrücken.',
      shape: pizzaStyle === 'romana'
        ? `Formen Sie die Romana in den letzten ${duration(shapeWindowHours)} dünn und flach auf ${diameter} cm; drücken oder rollen Sie sie, ohne sie aggressiv in der Luft zu dehnen.`
        : pizzaStyle === 'ny_style'
          ? `Formen Sie den größeren Teigballen in den letzten ${duration(shapeWindowHours)} mit dünner Mitte und gleichmäßiger Dicke auf ${diameter} cm; formen Sie keinen hohen, aufgeblähten Rand. Das Stück soll faltbar sein.`
          : `Drücken Sie in den letzten ${duration(shapeWindowHours)} die Luft von der Mitte zum Rand, lassen Sie 1–2 cm Rand und ziehen Sie den Teig auf ${diameter} cm; kein Nudelholz.`,
      toppings: `Geben Sie ${saucePerPizza} g Sauce und ${cheesePerPizza} g Mozzarella darauf; lassen Sie den Rand frei.`,
      launch: 'Schieben Sie die Pizza genau zur geplanten Backzeit in den Ofen.',
      bake: oven === 'homeStone'
        ? `Schalten Sie den Grill aus und verwenden Sie das Pizza-Programm oder Ober-/Unterhitze ohne Umluft. Backen Sie ${bakingTimeRange} bei ${ovenTemp} °C und bräunen Sie am Ende mit dem Grill.`
        : oven === 'ooni'
          ? `Backen Sie ${bakingTimeRange} bei ${ovenTemp} °C und drehen Sie die Pizza alle 20–30 Sekunden.`
          : `Backen Sie ${bakingTimeRange} bei ${ovenTemp} °C; prüfen Sie den Boden und bräunen Sie bei Bedarf kurz unter dem oberen Grill.`,
    },
    sl: {
      surface: oven === 'homePan' ? 'Pekač rahlo naoljite.' : 'Delovno površino rahlo posujte z zdrobom.',
      ball: 'Nežno dvignite eno kroglico, ne da bi iztisnili plin.',
      shape: pizzaStyle === 'romana'
        ? `V zadnjih ${duration(shapeWindowHours)} Romana oblikujte tanko in ravno do ${diameter} cm; pritiskajte ali uporabite valjar, brez agresivnega raztezanja v zraku.`
        : pizzaStyle === 'ny_style'
          ? `V zadnjih ${duration(shapeWindowHours)} večjo kepico oblikujte s tanko sredino in enakomerno debelino do ${diameter} cm; ne oblikujte visokega, napihnjenega roba. Rezina naj se zlahka prepogne.`
          : `V zadnjih ${duration(shapeWindowHours)} potisnite zrak od sredine proti robu, pustite rob 1–2 cm in testo raztegnite do ${diameter} cm; ne uporabljajte valjarja.`,
      toppings: `Dodajte ${saucePerPizza} g omake in ${cheesePerPizza} g mocarele; rob pustite prost.`,
      launch: 'Pico vstavite točno ob načrtovanem času peke.',
      bake: oven === 'homeStone'
        ? `Izklopite žar in uporabite program Pizza ali zgornje/spodnje gretje brez ventilatorja. Pecite ${bakingTimeRange} pri ${ovenTemp} °C; na koncu zapečite z žarom.`
        : oven === 'ooni'
          ? `Pecite ${bakingTimeRange} pri ${ovenTemp} °C in pico obračajte vsakih 20–30 sekund.`
          : `Pecite ${bakingTimeRange} pri ${ovenTemp} °C; preverite dno in po potrebi na kratko zaključite pod zgornjim žarom.`,
    },
  }[lang]);

  const activePhases = schedule.fridgeHours > 0
    ? phases
    : phases.filter((phase) => !/cold fermentation|kalte fermentation|hladna fermentacija/i.test(phase.title));
  return activePhases.map((phase, index) => {
    const steps = phase.steps.map(replaceYeastLabel);
    if (index === 0) {
      const startPrefix = ({ hr: 'Prije planiranog početka, ', en: 'Before scheduled Start, ', de: 'Vor dem geplanten Start ', sl: 'Pred načrtovanim začetkom ' }[lang]);
      const atStartPrefix = ({ hr: 'U planirano vrijeme početka, ', en: 'At scheduled Start, ', de: 'Zum geplanten Start ', sl: 'Ob načrtovanem začetku ' }[lang]);
      const startStepIndex = mixing === 'mixer' ? 3 : 2;
      return {
        ...phase,
        steps: steps.map((step, stepIndex) => stepIndex < 2
          ? `${startPrefix}${step.charAt(0).toLowerCase()}${step.slice(1)} (${formatAt(schedule.startAt)})`
          : stepIndex === startStepIndex
            ? `${atStartPrefix}${step.charAt(0).toLowerCase()}${step.slice(1)} (${formatAt(schedule.startAt)})`
            : step),
      };
    }
    if (index === 1) {
      const untimed = steps.filter((step) => !timed.test(step));
      return {
        ...phase,
        steps: isGlutenFree
          ? [untimed[0], `${labels.room(formatAt(schedule.startAt), formatAt(ballingAt)).split(';')[0]}.`]
          : [untimed[0], labels.room(formatAt(schedule.startAt), formatAt(ballingAt)), untimed[untimed.length - 1]],
      };
    }
    if (index === 2) {
      const ballingStep = schedule.fridgeHours > 0
        ? ({
          hr: 'Završite dijeljenje i oblikovanje kuglica prije planiranog stavljanja u hladnjak.',
          en: 'Finish dividing and balling before the scheduled Refrigerate time.',
          de: 'Teilen und formen Sie die Teiglinge vor dem geplanten Kühlen fertig.',
          sl: 'Deljenje in oblikovanje kroglic zaključite pred načrtovanim hlajenjem.',
        }[lang])
        : ({
          hr: 'Podijelite i oblikujte kuglice točno u planirano vrijeme kuglanja.',
          en: 'Divide and shape the dough balls at the scheduled Balling time.',
          de: 'Teilen und formen Sie die Teiglinge genau zum geplanten Ballzeitpunkt.',
          sl: 'Testo razdelite in oblikujte kroglice točno ob načrtovanem času oblikovanja.',
        }[lang]);
      return { ...phase, steps: [`${ballingStep} (${formatAt(ballingAt)})`, ...steps] };
    }
    if (index === 3 && schedule.fridgeHours > 0) {
      return { ...phase, steps: [`${labels.fridge(duration(schedule.fridgeHours))} (${formatAt(ballingAt)})`] };
    }
    const finalPhaseIndex = schedule.fridgeHours > 0 ? 4 : 3;
    if (index === finalPhaseIndex) {
      return {
        ...phase,
        steps: [
          schedule.fridgeHours > 0
            ? `${labels.takeOut(duration(Math.max(0, schedule.roomAfterFridgeHours)))} (${formatAt(fridgeOutAt)})`
            : `${labels.roomOnlyRestStart(duration(Math.max(0, schedule.roomAfterFridgeHours)))} (${formatAt(ballingAt)})`,
          `${labels.preheat(preheatMinutes)} (${formatAt(preheatAt)})`,
          `${isGlutenFree ? ({ hr: 'Radnu površinu obilno pospite bezglutenskim ili rižinim brašnom.', en: 'Generously dust the work surface with gluten-free or rice flour.', de: 'Bestäuben Sie die Arbeitsfläche großzügig mit glutenfreiem oder Reismehl.', sl: 'Delovno površino obilno posujte z brezglutensko ali riževo moko.' }[lang]) : shapingSteps.surface} (${formatAt(shapeAt)})`,
          shapingSteps.ball,
          `${shapingSteps.shape} (${formatAt(shapeAt)})`,
          `${shapingSteps.toppings} (${formatAt(shapeAt)})`,
          `${shapingSteps.launch} (${formatAt(schedule.bakeAt)})`,
          `${shapingSteps.bake} (${formatAt(schedule.bakeAt)})`,
        ],
      };
    }
    return { ...phase, steps };
  });
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

function PhaseBlock({
  title, steps, phaseKey, timers: customTimers, bigaInfo, waterInfo, containerOilInfo, fermentationInfo, fermentationSignsInfo, degassingInfo, doughHandlingInfo, temperingInfo, proofingInfo, ovenTimingInfo, ovenProgramInfo, bakingCheckInfo, bakingInfo, infoTitleOverrides, doughTemperatureStyle, completed, onToggle,
  activeTimers, onStartTimer, onStopTimer, lang,
}: {
  title: string;
  steps: readonly string[];
  phaseKey: string;
  timers?: BaseTimer[];
  bigaInfo?: string;
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
  infoTitleOverrides?: Partial<Record<'handling' | 'room' | 'readiness' | 'baking' | 'biga' | 'water', string>>;
  doughTemperatureStyle?: 'napolitana' | 'newYork' | 'romanaTonda' | 'romanaTeglia';
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
      <Text style={styles.phaseTitle}>{formatText(title)}</Text>
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
        const hasWaterInfo = !!waterInfo && /ukupno .*vode|total water|Sieben und wiegen Sie.*Wasser|skupno .*vode/i.test(s);
        const hasContainerOilInfo = !!containerOilInfo && (/nauljite fermentacijsku posudu|Pokrijte fermentacijsku posudu|Stavite kugle u zatvorenu fermentacijsku kutiju|Masa testa položite|oil the fermentation container|place the dough mass in a covered|Place the dough balls in a closed|Ölen Sie den Fermentationsbehälter|Legen Sie die Teigmasse in einen abgedeckten|Legen Sie die Teigkugeln in eine verschlossene|Fermentacijsko posodo rahlo|Maso testa položite/i.test(s));
        const hasFermentationInfo = !!fermentationInfo && /završni bulk|final bulk fermentation|abschließende Stockgare|Končno prvo fermentacijo|Lagano nauljite fermentacijsku posudu|Lightly oil the fermentation container|Ölen Sie den Fermentationsbehälter|Fermentacijsko posodo rahlo|Integralno tijesto|Whole wheat dough|Vollkornteig|Integralno testo|Prebacite tijesto u lagano nauljenu fermentacijsku posudu/i.test(s);
        const hasFermentationSignsInfo = !!fermentationSignsInfo && /Provjerite jesu li vidljivi|Check whether the first signs|Prüfen Sie, ob erste Anzeichen|Preverite, ali so vidni prvi znaki|^[^;]*(?:Miješanje i bulk traju|Mixing and bulk run|Mischen und Stockgare dauern|Mešanje in prva fermentacija trajata)[^;]*$|Pokrijte posudu i ostavite smjesu 15 minuta|Cover the container and let the mixture rest for 15 minutes|Decken Sie den Behälter ab und lassen Sie die Masse 15 Minuten|Posodo pokrijte in maso pred delitvijo 15 minut/i.test(s);
        const hasDegassingInfo = !!degassingInfo && /minimalno degaziranje|minimizing degassing|möglichst starkes Entgasen|čim manj iztisnite plin/i.test(s);
        const hasBakingInfo = !!bakingInfo && /Zagrijte kamen ili čelik|Zagrijte obrnuti lim|Preheat the pizza stone|Heizen Sie den Pizzastein|Kamen ali jeklo za pico segrevajte/i.test(s);
        const hasDoughHandlingInfo = !!doughHandlingInfo && /Nastavite mijesiti|Nastavite miješati|Continue kneading|Continue mixing|Kneten Sie weiter|Mischen Sie weiter|Nadaljujte z gnetenjem|Nadaljujte z mešanjem|Bezglutenska smjesa se ne mijesi|Gluten-free dough is not kneaded|Glutenfreier Teig wird nicht geknetet|Brezglutensko testo se ne gnete/i.test(s);
        const hasTemperingInfo = !!temperingInfo && /prijeđite na temperiranje|Ostavite kugle .*sobnoj temperaturi|proceed to tempering|Let the dough balls .*room temperature|fahren Sie mit dem Temperieren|Lassen Sie die Teigkugeln .*Raumtemperatur|nadaljujte s temperiranjem|Kroglice .*sobni temperaturi/i.test(s);
        const hasDoughTemperatureInfo = /Zamjes je gotov|The dough is fully mixed|Der Teig ist fertig geknetet|Gnetenje je končano|Mixing is finished when|Das Mischen ist beendet|Mešanje je končano/i.test(s);
        const hasToppingInfo = /Dodajte nadjev|Add the toppings|Belegen Sie die Pizza|Dodajte nadev/i.test(s);
        const hasOvenTimingInfo = !!ovenTimingInfo && /Izvadite kugle iz hladnjaka|izvadite kugle|Take the dough balls out|take the dough out|Nehmen Sie die Teigkugeln|Kroglice vzemite iz hladilnika|Kroglice vzemite|vzemite testo/i.test(s);
        const hasOvenProgramInfo = !!ovenProgramInfo && /Pizza program|Pizza-Programm|program Pizza/i.test(s);
        const hasBakingCheckInfo = !!bakingCheckInfo && /Pecite bez grilla|Bake without the grill|Backen Sie ohne Grill|Pecite brez žara/i.test(s);
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
  title: { fontSize: 22, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },

  card: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  cardTitle: { fontSize: 13, color: COLORS.brand, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  styleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  styleRowWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  flourCompact: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, minHeight: 42 },
  flourCompactActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  flourIcon: { width: 28, height: 28, marginRight: 6 },
  flourCompactLabel: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface, flexShrink: 1 },
  flourCompactSuffix: { fontSize: 12, color: COLORS.muted, fontWeight: '600', marginLeft: 6, flexShrink: 0 },
  infoBtn: { width: 26, height: 32, alignItems: 'center', justifyContent: 'center' },
  tooltipBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  tooltipCard: { width: '100%', maxWidth: 360, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
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

  segmentedRow: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: RADIUS.sm },
  segBtnActive: { backgroundColor: COLORS.brand },
  segText: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  expandBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
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
  phaseTitle: { fontSize: 13, color: COLORS.brand, fontWeight: '800', marginBottom: SPACING.sm, textTransform: 'uppercase' },

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
