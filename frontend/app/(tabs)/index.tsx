import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Platform, Alert, Image, ImageBackground } from 'react-native';
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
import { scheduleLocal, cancelLocal, isPushSupported } from '../../src/notifications';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import {
  dimensionsCalc, doughCalc, iceCalc,
  Method, OvenType, FlourType, PizzaStyle, PIZZA_STYLE_PROFILES, FLOUR_PROFILES, BASE_FLOURS, blendIdealHydration,
} from '../../src/calculator';
import { useAuth } from '../../src/auth';

const DIAMETERS = [28, 30, 33, 35];
const CALCULATOR_SETTINGS_KEY = 'calculatorSettings';

type CalculatorSettings = {
  pizzaStyle: PizzaStyle;
  romanFormat: 'tonda' | 'teglia';
  trayWidth: number;
  trayLength: number;
  flour: FlourType;
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

type BakingPoint = { temperature: number; min: number; max: number };

function bakingTimeForTemperature(temperature: number, points: BakingPoint[]) {
  const value = Math.max(points[0].temperature, Math.min(points[points.length - 1].temperature, temperature));
  const upperIndex = points.findIndex((point) => point.temperature >= value);
  if (upperIndex <= 0) return points[0];
  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  const ratio = (value - lower.temperature) / (upper.temperature - lower.temperature);
  return {
    temperature,
    min: lower.min + (upper.min - lower.min) * ratio,
    max: lower.max + (upper.max - lower.max) * ratio,
  };
}

function formatBakingMinutes(minutes: number, lang: Lang) {
  const rounded = Math.round(minutes * 4) / 4;
  const secondsUnit = lang === 'de' ? 'Sek.' : 's';
  const minutesUnit = lang === 'de' ? 'Min.' : 'min';
  if (rounded < 2) return `${Math.round(rounded * 60)} ${secondsUnit}`;
  return `${Number.isInteger(rounded) ? rounded : rounded.toString().replace('.', ',')} ${minutesUnit}`;
}

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
      body: 'Poolish je tekući predferment s jednakom količinom brašna i vode (100% hidratacija) uz dodatak kvasca. Nakon fermentacije dodaje se ostatak brašna, vode i soli. Daje mekano i elastično tijesto koje se lako razvlači, lijepu zlatnu boju i nježan, blago orašast okus.',
    },
  },
  en: {
    direct: {
      title: 'Direct Dough',
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
  const { user } = useAuth();

  const [pizzaStyle, setPizzaStyle] = useState<PizzaStyle>('neapolitan');
  const [romanFormat, setRomanFormat] = useState<'tonda' | 'teglia'>('tonda');
  const [trayWidth, setTrayWidth] = useState(30);
  const [trayLength, setTrayLength] = useState(40);
  const [trayWidthInput, setTrayWidthInput] = useState('30');
  const [trayLengthInput, setTrayLengthInput] = useState('40');
  const [flour, setFlour] = useState<FlourType>('caputo00');
  const [blendA, setBlendA] = useState<Exclude<FlourType, 'custom'>>('caputo00');
  const [blendB, setBlendB] = useState<Exclude<FlourType, 'custom'>>('wholeWheat');
  const [blendPctA, setBlendPctA] = useState(70);
  const [pizzas, setPizzas] = useState(4);
  const [diameter, setDiameter] = useState(30);
  const [customDiameter, setCustomDiameter] = useState('');
  const [customBallWeight, setCustomBallWeight] = useState<number | null>(null);
  const [customBallInput, setCustomBallInput] = useState<string>('');
  const [method, setMethod] = useState<Method>('direct');
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
  const [mixing, setMixing] = useState<'hand' | 'mixer'>('hand');
  const [showMixSteps, setShowMixSteps] = useState(false);
  const [moreTool, setMoreTool] = useState<null | 'school' | 'leftover' | 'shopping'>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [flourInfo, setFlourInfo] = useState<null | { label: string; info: string }>(null);
  const [styleInfo, setStyleInfo] = useState<PizzaStyle | null>(null);
  const [methodInfo, setMethodInfo] = useState<Method | null>(null);
  const [styleExpanded, setStyleExpanded] = useState(false);
  const [flourExpanded, setFlourExpanded] = useState(false);
  const [activeTimers, setActiveTimers] = useState<Record<string, { endsAt: number; label: string; notifId?: string | null }>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const alertedRef = useRef<Set<string>>(new Set());
  // ticker: force re-render each second for countdowns AND check for expired timers
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    AsyncStorage.getItem(CALCULATOR_SETTINGS_KEY).then((value) => {
      if (value) {
        try {
          const saved = JSON.parse(value) as Partial<CalculatorSettings>;
          if (saved.pizzaStyle) setPizzaStyle(saved.pizzaStyle);
          if (saved.romanFormat) setRomanFormat(saved.romanFormat);
          if (typeof saved.trayWidth === 'number') {
            setTrayWidth(saved.trayWidth);
            setTrayWidthInput(String(saved.trayWidth));
          }
          if (typeof saved.trayLength === 'number') {
            setTrayLength(saved.trayLength);
            setTrayLengthInput(String(saved.trayLength));
          }
          if (saved.flour) setFlour(saved.flour);
          if (saved.blendA) setBlendA(saved.blendA);
          if (saved.blendB) setBlendB(saved.blendB);
          if (typeof saved.blendPctA === 'number') setBlendPctA(saved.blendPctA);
          if (typeof saved.pizzas === 'number') setPizzas(saved.pizzas);
          if (typeof saved.diameter === 'number') setDiameter(saved.diameter);
          if (saved.customBallWeight !== undefined) setCustomBallWeight(saved.customBallWeight);
          if (saved.method) setMethod(saved.method);
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
          if (saved.mixing) setMixing(saved.mixing);
        } catch {}
      }
      setSettingsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    const settings: CalculatorSettings = {
      pizzaStyle, romanFormat, trayWidth, trayLength, flour, blendA, blendB, blendPctA, pizzas, diameter,
      customBallWeight, method, bigaPct, poolishPct, bigaHours, poolishHours, hydration, saltPct, oilPct,
      roomTemp, roomHours, fridgeTemp, fridgeHours, useIce, oven, ovenTemp, mixing,
    };
    AsyncStorage.setItem(CALCULATOR_SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settingsLoaded, pizzaStyle, romanFormat, trayWidth, trayLength, flour, blendA, blendB, blendPctA, pizzas, diameter, customBallWeight, method, bigaPct, poolishPct, bigaHours, poolishHours, hydration, saltPct, oilPct, roomTemp, roomHours, fridgeTemp, fridgeHours, useIce, oven, ovenTemp, mixing]);

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
        for (const [k, val] of Object.entries(parsed)) {
          if (val && val.endsAt > now) fresh[k] = val;
        }
        setActiveTimers(fresh);
        AsyncStorage.setItem('activeTimers', JSON.stringify(fresh)).catch(() => {});
      } catch {}
    });
  }, []);

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
  const styleProfile = PIZZA_STYLE_PROFILES[pizzaStyle];
  const isRomanTeglia = pizzaStyle === 'romana' && romanFormat === 'teglia';
  const trayDoughWeight = Math.round(trayWidth * trayLength * 0.4);
  useEffect(() => {
    if (isRomanTeglia && oven !== 'homePan') {
      setOven('homePan');
      setOvenTemp(250);
      setOvenTempInput('250');
    }
  }, [isRomanTeglia, oven]);
  const isIdealSalt = saltPct === styleProfile.saltPct;
  const isIdealOil = oilPct === styleProfile.oilPct;
  const styleImages: Record<PizzaStyle, any> = {
    neapolitan: require('../../assets/images/pizza-neapolitan.png'),
    romana: require('../../assets/images/pizza-romana.png'),
    ny_style: require('../../assets/images/pizza-new-york.png'),
  };
  const isCustom = flour === 'custom';
  const customIdeal = useMemo(() => blendIdealHydration(blendA, blendB, blendPctA), [blendA, blendB, blendPctA]);
  const isIdealHydration = hydration === flourProfile.ideal;
  const inRange = isCustom
    ? Math.abs(hydration - customIdeal) <= 3
    : (hydration >= flourProfile.min && hydration <= flourProfile.max);

  // Auto-adjust hydration when custom blend changes
  const changeFlour = (f: FlourType) => {
    setFlour(f);
    if (f === 'glutenFree') setMethod('direct');
    if (f === 'custom') {
      setHydration(blendIdealHydration(blendA, blendB, blendPctA));
    } else {
      setHydration(FLOUR_PROFILES[f].ideal);
    }
    try { Haptics.selectionAsync(); } catch {}
  };

  useEffect(() => {
    if (flour === 'glutenFree' && method !== 'direct') setMethod('direct');
  }, [flour, method]);

  const changeStyle = (nextStyle: PizzaStyle) => {
    const next = PIZZA_STYLE_PROFILES[nextStyle];
    setPizzaStyle(nextStyle);
    setHydration(next.hydration);
    setSaltPct(next.saltPct);
    setOilPct(next.oilPct);
    setOven(nextStyle === 'neapolitan' ? 'ooni' : 'homeStone');
    setCustomBallWeight(null);
    setCustomBallInput('');
    setStyleExpanded(false);
    try { Haptics.selectionAsync(); } catch {}
  };

  const selectOven = (nextOven: OvenType, temperature: number) => {
    setOven(nextOven);
    setOvenTemp(temperature);
    setOvenTempInput(String(temperature));
  };

  const commitOvenTemperature = () => {
    const parsed = Number(ovenTempInput.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 200 && parsed <= 500) {
      const temperature = Math.round(parsed);
      setOvenTemp(temperature);
      setOvenTempInput(String(temperature));
    } else {
      setOvenTempInput(String(ovenTemp));
    }
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

  const changeBlend = (which: 'a' | 'b' | 'pct', value: any) => {
    let a = blendA, b = blendB, p = blendPctA;
    if (which === 'a') { a = value; setBlendA(value); }
    if (which === 'b') { b = value; setBlendB(value); }
    if (which === 'pct') { p = value; setBlendPctA(value); }
    if (flour === 'custom') setHydration(blendIdealHydration(a, b, p));
    try { Haptics.selectionAsync(); } catch {}
  };

  // Reactive calculations - RE-COMPUTE on any input change
  const dims = useMemo(() => dimensionsCalc(diameter, pizzas), [diameter, pizzas]);
  const effectiveBall = isRomanTeglia ? customBallWeight ?? trayDoughWeight : customBallWeight ?? (diameter === styleProfile.defaultDiameter ? styleProfile.ballWeight : dims.doughBall);
  const dough = useMemo(() => doughCalc({
    pizzas, ballWeight: effectiveBall, hydration,
    saltPct, oilPct, method, bigaPct, poolishPct,
    roomHours, roomTemp, fridgeHours, fridgeTemp,
    prefermentHours: method === 'biga' ? bigaHours : method === 'poolish' ? poolishHours : 0,
    prefermentRoomHours: method === 'direct' ? 0 : (method === 'biga' ? Math.min(8, bigaHours) : Math.min(1, poolishHours)),
    prefermentFridgeHours: method === 'direct' ? 0 : (method === 'biga' ? Math.max(0, bigaHours - Math.min(8, bigaHours)) : Math.max(0, poolishHours - Math.min(1, poolishHours))),
    mixing: mixing === 'mixer' ? 'spiral' : 'hand',
    yeastType: 'fresh',
    flourType: flour,
  }), [pizzas, effectiveBall, hydration, saltPct, oilPct, method, bigaPct, poolishPct, bigaHours, poolishHours, roomHours, roomTemp, fridgeHours, fridgeTemp, mixing, flour]);
  const selectedPrefermentHours = method === 'biga' ? bigaHours : poolishHours;
  const prefermentRoomHours = method === 'biga' ? Math.min(8, selectedPrefermentHours) : Math.min(1, selectedPrefermentHours);
  const prefermentFridgeHours = Math.max(0, selectedPrefermentHours - prefermentRoomHours);
  const psylliumGrams = flour === 'glutenFree' ? (dough.total.psyllium ?? 0) : 0;
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
  const ice = useMemo(() => useIce ? iceCalc(dough.total.water, roomTemp, 4) : null, [useIce, dough.total.water, roomTemp]);

  // Auto-adjust hydration when flour changes to that flour's ideal
  // (uses changeFlour above)
  const step = (fn: () => void) => { try { Haptics.selectionAsync(); } catch {}; fn(); };

  const commitCustomDiameter = () => {
    const v = parseFloat(customDiameter);
    if (v >= 15 && v <= 60) { setDiameter(Math.round(v)); setCustomBallWeight(null); setCustomBallInput(''); }
    setCustomDiameter('');
  };

  const saveRecipe = async () => {
    const recipe = {
      pizzas, diameter, hydration, method, flourType: flourProfile.label,
      style_id: pizzaStyle,
      style_params: { ballWeight: effectiveBall, hydration, saltPct, oilPct, diameter, bigaPct, poolishPct },
      ballWeight: effectiveBall,
      flour: dough.total.flour, water: dough.total.water,
      salt: dough.total.salt, oil: dough.total.oil, yeast: dough.total.yeast,
      psyllium: dough.total.psyllium ?? 0,
      sauce: dims.sauce * pizzas, cheese: dims.cheese * pizzas,
    };
    await AsyncStorage.setItem('lastRecipe', JSON.stringify(recipe));
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

  const bakingSteps =
    oven === 'homeStone' ? t.calc.homeStoneSteps :
    oven === 'ooni' ? t.calc.ooniSteps : t.calc.homePanSteps;
  const bakingPoints = oven === 'homePan'
    ? [{ temperature: 200, min: 15, max: 20 }, { temperature: 220, min: 13, max: 17 }, { temperature: 230, min: 12, max: 15 }, { temperature: 250, min: 10, max: 14 }, { temperature: 270, min: 8, max: 12 }, { temperature: 280, min: 7, max: 11 }, { temperature: 300, min: 6, max: 9 }]
    : oven === 'ooni'
      ? [{ temperature: 350, min: 3, max: 4 }, { temperature: 400, min: 2, max: 3 }, { temperature: 450, min: 1, max: 1.5 }, { temperature: 480, min: 0.75, max: 1.25 }]
      : [{ temperature: 200, min: 9, max: 13 }, { temperature: 220, min: 8, max: 11 }, { temperature: 230, min: 7, max: 10 }, { temperature: 250, min: 5, max: 8 }, { temperature: 270, min: 4, max: 6 }, { temperature: 280, min: 3.5, max: 5 }, { temperature: 300, min: 3, max: 4.5 }];
  const calculatedBakingTime = bakingTimeForTemperature(ovenTemp, bakingPoints);
  const bakingDuration = `${ovenTemp} °C · ${formatBakingMinutes(calculatedBakingTime.min, lang)}–${formatBakingMinutes(calculatedBakingTime.max, lang)}`;
  const ovenTempLabel = { hr: 'Temperatura pećnice', en: 'Oven temperature', de: 'Ofentemperatur', sl: 'Temperatura pečice' }[lang];
  const detailedDirectSteps = method === 'direct' && lang === 'hr'
    ? getDetailedDirectSteps(mixing, dough.total, dough.totalDough, pizzas, effectiveBall, diameter, fridgeHours, roomHours, oven, ovenTemp, roomTemp, dims.cheese, undefined, undefined, flour, pizzaStyle === 'romana' && romanFormat === 'tonda', isRomanTeglia, pizzaStyle === 'ny_style', pizzaStyle === 'neapolitan')
    : method === 'biga' && lang === 'hr'
      ? getDetailedDirectSteps(mixing, dough.total, dough.totalDough, pizzas, effectiveBall, diameter, fridgeHours, roomHours, oven, ovenTemp, roomTemp, dims.cheese, {
        flour: dough.preferment?.flour ?? 0,
        water: dough.preferment?.water ?? 0,
        yeast: dough.preferment?.yeast ?? 0,
        remainingFlour: dough.main.flour,
        remainingWater: dough.main.water,
        pct: bigaPct,
      }, undefined, flour, pizzaStyle === 'romana' && romanFormat === 'tonda', isRomanTeglia, pizzaStyle === 'ny_style', pizzaStyle === 'neapolitan')
    : method === 'poolish' && lang === 'hr'
      ? getDetailedDirectSteps(mixing, dough.total, dough.totalDough, pizzas, effectiveBall, diameter, fridgeHours, roomHours, oven, ovenTemp, roomTemp, dims.cheese, undefined, {
        flour: dough.preferment?.flour ?? 0,
        water: dough.preferment?.water ?? 0,
        yeast: dough.preferment?.yeast ?? 0,
        remainingFlour: dough.main.flour,
        remainingWater: dough.main.water,
        pct: poolishPct,
      }, flour, pizzaStyle === 'romana' && romanFormat === 'tonda', isRomanTeglia, pizzaStyle === 'ny_style', pizzaStyle === 'neapolitan')
    : method === 'direct' && (lang === 'de' || lang === 'en' || lang === 'sl') && (oven === 'homeStone' || oven === 'ooni' || oven === 'homePan')
      ? getDetailedDirectStepsLocalized(lang, dough.total, dough.totalDough, pizzas, effectiveBall, diameter, fridgeHours, roomTemp, dims.cheese, oven, ovenTemp, mixing)
    : null;
  const bigaPreparation = method === 'biga'
    ? {
      title: ({ hr: 'Faza A: Priprema Bige', en: 'Phase A: Biga preparation', de: 'Phase A: Biga-Vorbereitung', sl: 'Faza A: Priprava bige' }[lang]),
      info: ({ hr: `Biga čini ${bigaPct}% ukupnog brašna.`, en: `The biga makes up ${bigaPct}% of the total flour.`, de: `Die Biga enthält ${bigaPct}% des Gesamtmehls.`, sl: `Biga predstavlja ${bigaPct}% celotne moke.` }[lang]),
      steps: [
        ({ hr: 'Operite i temeljito osušite ruke.', en: 'Wash and thoroughly dry your hands.', de: 'Waschen und trocknen Sie Ihre Hände gründlich.', sl: 'Umijte in temeljito osušite roke.' }[lang]),
        ({ hr: `Pripremite ${dough.preferment?.flour ?? 0} g brašna, ${dough.preferment?.water ?? 0} g vode i ${dough.preferment?.yeast ?? 0} g kvasca.`, en: `Prepare ${dough.preferment?.flour ?? 0} g flour, ${dough.preferment?.water ?? 0} g water, and ${dough.preferment?.yeast ?? 0} g yeast.`, de: `Bereiten Sie ${dough.preferment?.flour ?? 0} g Mehl, ${dough.preferment?.water ?? 0} g Wasser und ${dough.preferment?.yeast ?? 0} g Hefe vor.`, sl: `Pripravite ${dough.preferment?.flour ?? 0} g moke, ${dough.preferment?.water ?? 0} g vode in ${dough.preferment?.yeast ?? 0} g kvasa.` }[lang]),
        ({ hr: `Rukama kratko povežite sastojke; smjesa treba ostati mrvičasta. Ostavite Bigu ${prefermentRoomHours} sati na ${roomTemp} °C.`, en: `Briefly combine the ingredients; keep the mixture crumbly. Leave the Biga for ${prefermentRoomHours} hours at ${roomTemp} °C.`, de: `Vermengen Sie die Zutaten kurz; die Masse soll krümelig bleiben. Lassen Sie die Biga ${prefermentRoomHours} Stunden bei ${roomTemp} °C stehen.`, sl: `Sestavine na kratko povežite; zmes naj ostane drobtinasta. Bigo pustite ${prefermentRoomHours} ur pri ${roomTemp} °C.` }[lang]),
        ({ hr: `Pokrijte Bigu i prebacite je u hladnjak na ${prefermentFridgeHours} sati pri ${fridgeTemp} °C. Ukupno: ${bigaHours} sati.`, en: `Cover the Biga and refrigerate it for ${prefermentFridgeHours} hours at ${fridgeTemp} °C. Total: ${bigaHours} hours.`, de: `Decken Sie die Biga ab und stellen Sie sie ${prefermentFridgeHours} Stunden bei ${fridgeTemp} °C in den Kühlschrank. Gesamt: ${bigaHours} Stunden.`, sl: `Bigo pokrijte in jo prestavite v hladilnik za ${prefermentFridgeHours} ur pri ${fridgeTemp} °C. Skupaj: ${bigaHours} ur.` }[lang]),
      ],
      timers: [{ id: `biga-fermentation-${mixing}`, seconds: bigaHours * 3600, kind: 'preferment' as const }],
    }
    : null;
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
        ((mixing === 'hand' || isRomanTeglia)
          ? ({ hr: 'Operite i temeljito osušite ruke.', en: 'Wash and thoroughly dry your hands.', de: 'Waschen und trocknen Sie Ihre Hände gründlich.', sl: 'Umijte in temeljito osušite roke.' }[lang])
          : ({ hr: 'Pripremite posudu i pjenjaču ili vilicu.', en: 'Prepare a bowl and a whisk or fork.', de: 'Bereiten Sie eine Schüssel und einen Schneebesen oder eine Gabel vor.', sl: 'Pripravite skledo in metlico ali vilice.' }[lang])),
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
          hr: `Pokrijte Poolish i ostavite ga ${prefermentRoomHours} sati na ${roomTemp} °C.`,
          en: `Cover the Poolish and leave it at ${roomTemp} °C for ${prefermentRoomHours} hours.`,
          de: `Decken Sie den Poolish ab und lassen Sie ihn ${prefermentRoomHours} Stunden bei ${roomTemp} °C stehen.`,
          sl: `Poolish pokrijte in ga pustite ${prefermentRoomHours} ur pri ${roomTemp} °C.`,
        }[lang]),
        ({
          hr: `Prebacite Poolish u hladnjak na ${prefermentFridgeHours} sati pri ${fridgeTemp} °C. Ukupna fermentacija Poolisha traje ${poolishHours} sati.`,
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
      'Nakon fermentacije Poolish prelijte u posudu za ručni zamjes.',
      `Dodajte preostalih ${dough.main.flour} g brašna i lagano povežite Poolish s brašnom.`,
      `Dodajte ${Math.round(dough.main.water * 0.9)} g preostale vode, zatim postupno dodajte još ${Math.max(0, dough.main.water - Math.round(dough.main.water * 0.9))} g vode.`,
      `Dodajte ${dough.total.salt} g soli kao zaseban korak i nastavite mijesiti.`,
      `Dodajte ${dough.total.oil} g maslinovog ulja i mijesite dok ga tijesto potpuno ne upije.`,
    ],
    en: [
      'Wash and thoroughly dry your hands.',
      'Pour the cold Poolish into the hand-mixing bowl.',
      `Add the remaining ${dough.main.flour} g of flour and gently combine it with the Poolish.`,
      `Add ${Math.round(dough.main.water * 0.9)} g of the remaining water, then gradually add the final ${Math.max(0, dough.main.water - Math.round(dough.main.water * 0.9))} g.`,
      `Add ${dough.total.salt} g of salt as a separate step and continue kneading.`,
      `Add ${dough.total.oil} g of olive oil and knead until fully absorbed.`,
    ],
    de: [
      'Waschen und trocknen Sie Ihre Hände gründlich.',
      'Gießen Sie den kalten Poolish in die Knetschüssel.',
      `Geben Sie ${dough.main.flour} g restliches Mehl dazu und verbinden Sie es vorsichtig mit dem Poolish.`,
      `Geben Sie ${Math.round(dough.main.water * 0.9)} g des restlichen Wassers hinzu und anschließend die letzten ${Math.max(0, dough.main.water - Math.round(dough.main.water * 0.9))} g nach und nach.`,
      `Geben Sie ${dough.total.salt} g Salz als separaten Schritt hinzu und kneten Sie weiter.`,
      `Geben Sie ${dough.total.oil} g Olivenöl hinzu und kneten Sie, bis es vollständig aufgenommen ist.`,
    ],
    sl: [
      'Umijte in temeljito osušite roke.',
      'Hladni Poolish prelijte v posodo za ročno gnetenje.',
      `Dodajte preostalih ${dough.main.flour} g moke in jo nežno povežite s Poolishem.`,
      `Dodajte ${Math.round(dough.main.water * 0.9)} g preostale vode, nato postopoma še zadnjih ${Math.max(0, dough.main.water - Math.round(dough.main.water * 0.9))} g.`,
      `Dodajte ${dough.total.salt} g soli kot ločen korak in nadaljujte z gnetenjem.`,
      `Dodajte ${dough.total.oil} g oljčnega olja in gnetite, dokler se popolnoma ne vpije.`,
    ],
  }[lang]) : null;
  const bakingTemp =
    oven === 'homeStone' ? '270–300°C · 4–5 min + grill 30–90 s' :
    oven === 'ooni' ? '430–480°C · 60–90 s' : '280°C · 8–10 min';
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
        <Text style={styles.subtitle}>{t.calc.title}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2, gap: SPACING.lg }} keyboardShouldPersistTaps="handled">

        {/* 1. PIZZA STYLE */}
        <View style={styles.card}>
          <Pressable testID="style-header" onPress={() => setStyleExpanded((value) => !value)} style={styles.styleHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>1 · {t.calc.pizzaStyle}</Text>
              {!styleExpanded ? <Text style={styles.hint}>{t.calc.pizzaStyles[pizzaStyle].name}</Text> : null}
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
              const item = t.calc.pizzaStyles[key];
              return (
                <View key={key} style={styles.styleRowWrap}>
                  <Pressable testID={`style-${key}`} onPress={() => changeStyle(key)} style={[styles.styleRow, active && styles.styleRowActive]}>
                    <Image source={styleImages[key]} style={styles.styleThumb} resizeMode="cover" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.styleName, active && styles.styleNameActive]}>{item.name}</Text>
                      <Text style={[styles.styleDescription, active && styles.styleDescriptionActive]} numberOfLines={2}>{item.description}</Text>
                    </View>
                    {active ? <Icon name="checkmark-circle" size={18} color="#fff" /> : null}
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
              <Text style={styles.flourHeaderText}>2 · {t.flourSection.headerCollapsed}</Text>
              {!flourExpanded ? <Text style={styles.hint}>{FLOURS_BY_LANG[lang].find((entry) => entry.key === flour)?.label}</Text> : null}
            </View>
            <Icon name={flourExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
          </Pressable>

          {flourExpanded ? (
            <View style={{ gap: 6, marginTop: SPACING.md }}>
              {FLOURS_BY_LANG[lang].map((f) => {
                const active = flour === f.key;
                return (
                  <View key={f.key} style={styles.flourRowWrap}>
                    <Pressable
                      testID={`flour-${f.key}`}
                      onPress={() => { changeFlour(f.key); setFlourExpanded(false); }}
                      style={[styles.flourCompact, active && styles.flourCompactActive]}
                    >
                      <Image source={FLOUR_IMAGES[f.key]} style={styles.flourIcon} resizeMode="contain" />
                      <Text style={[styles.flourCompactLabel, active && { color: '#fff' }]} numberOfLines={1}>{f.label}</Text>
                      {active ? <Icon name="checkmark-circle" size={16} color="#fff" style={{ marginLeft: 4 }} /> : null}
                    </Pressable>
                    {f.info ? (
                      <Pressable
                        testID={`flour-info-${f.key}`}
                        onPress={() => setFlourInfo({ label: f.label, info: f.info! })}
                        hitSlop={8}
                        style={styles.infoBtn}
                      >
                        <Icon name="information-circle-outline" size={18} color={active ? COLORS.brand : COLORS.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Blend controls stay visible when custom is selected, even if the list is collapsed */}
          {isCustom ? (
            <View style={styles.blendPanel}>
              <Text style={styles.blendTitle}>{t.flourSection.blendTitle}</Text>

              <Text style={styles.label}>{t.flourSection.blendA} ({blendPctA}%)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {BASE_FLOURS.map((k) => (
                  <Pressable key={k} testID={`blendA-${k}`} onPress={() => changeBlend('a', k)} style={[styles.chip, blendA === k && styles.chipActive]}>
                    <Text style={[styles.chipText, blendA === k && styles.chipTextActive]}>{FLOUR_PROFILES[k].label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.label, { marginTop: SPACING.sm }]}>{t.flourSection.blendB} ({100 - blendPctA}%)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {BASE_FLOURS.map((k) => (
                  <Pressable key={k} testID={`blendB-${k}`} onPress={() => changeBlend('b', k)} style={[styles.chip, blendB === k && styles.chipActive]}>
                    <Text style={[styles.chipText, blendB === k && styles.chipTextActive]}>{FLOUR_PROFILES[k].label}</Text>
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

              <Text style={styles.hint}>
                {t.flourSection.blendIdealHint.replace('{N}', String(customIdeal))} ({FLOUR_PROFILES[blendA].ideal}% × {blendPctA}% + {FLOUR_PROFILES[blendB].ideal}% × {100 - blendPctA}%)
              </Text>
            </View>
          ) : null}
        </View>

        {/* 2. VELIČINA PIZZE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3 · {t.calc.dimensions}</Text>
          {pizzaStyle === 'romana' ? (
            <>
              <Text style={[styles.label, { marginTop: SPACING.sm }]}>Romana</Text>
              <View style={styles.pillGroup}>
                <View style={[styles.pill, romanFormat === 'tonda' && styles.pillActive]}>
                  <Pressable testID="romana-tonda" onPress={() => step(() => setRomanFormat('tonda'))} style={styles.pillSelect}>
                    <Text style={[styles.pillText, romanFormat === 'tonda' && styles.pillTextActive]}>Romana Tonda</Text>
                  </Pressable>
                  <Pressable testID="romana-tonda-info" onPress={() => Alert.alert('Romana Tonda', 'Okrugla, tanka i hrskava pizza. Tijesto se oblikuje iz kugle i rasteže ručno prije pečenja.')} hitSlop={8} style={styles.infoBtn}>
                    <Icon name="information-circle-outline" size={18} color={romanFormat === 'tonda' ? '#fff' : COLORS.muted} />
                  </Pressable>
                </View>
                <View style={[styles.pill, romanFormat === 'teglia' && styles.pillActive]}>
                  <Pressable testID="romana-teglia" onPress={() => step(() => { setRomanFormat('teglia'); setOven('homePan'); setOvenTemp(250); setOvenTempInput('250'); })} style={styles.pillSelect}>
                    <Text style={[styles.pillText, romanFormat === 'teglia' && styles.pillTextActive]}>Romana Teglia</Text>
                  </Pressable>
                  <Pressable testID="romana-teglia-info" onPress={() => Alert.alert('Romana Teglia', 'Pravokutna pizza iz tepsije. Tijesto se utiskuje u nauljenu tepsiju prema unesenim dimenzijama.')} hitSlop={8} style={styles.infoBtn}>
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
              <Text style={styles.label}>{t.ballWeight.label}</Text>
              <Text style={styles.subLabel} numberOfLines={2}>
                {customBallWeight != null
                  ? t.ballWeight.manualHint.replace('{N}', String(dims.doughBall))
                  : t.ballWeight.autoHint.replace('{N}', String(dims.doughBall))}
              </Text>
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
                value={customBallInput !== '' ? customBallInput : String(effectiveBall)}
                onChangeText={(txt) => {
                  const clean = txt.replace(/[^0-9]/g, '').slice(0, 4);
                  setCustomBallInput(clean);
                  const n = parseInt(clean, 10);
                  if (!isNaN(n) && n >= 50 && n <= 600) setCustomBallWeight(n);
                }}
                onBlur={() => setCustomBallInput('')}
                keyboardType="number-pad"
                style={styles.stepInput}
                selectTextOnFocus
              />
              <Text style={styles.stepUnit}>g</Text>
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
                  <Text style={styles.label}>Gramaža tijesta</Text>
                  <Text style={styles.subLabel}>Automatski prema dimenzijama tepsije</Text>
                </View>
                <View style={styles.ballStepper}>
                  <Pressable testID="tray-dough-minus" onPress={() => step(() => setCustomBallWeight(Math.max(100, effectiveBall - 5)))} style={styles.stepBtn}>
                    <Icon name="remove" size={20} color={COLORS.brand} />
                  </Pressable>
                  <TextInput
                    testID="tray-dough-weight"
                    value={customBallInput !== '' ? customBallInput : String(effectiveBall)}
                    onChangeText={(value) => {
                      const clean = value.replace(/[^0-9]/g, '').slice(0, 4);
                      setCustomBallInput(clean);
                      const next = Number(clean);
                      if (next >= 100 && next <= 2000) setCustomBallWeight(next);
                    }}
                    onBlur={() => setCustomBallInput('')}
                    keyboardType="number-pad"
                    style={styles.stepInput}
                  />
                  <Text style={styles.stepUnit}>g</Text>
                  <Pressable testID="tray-dough-plus" onPress={() => step(() => setCustomBallWeight(Math.min(2000, effectiveBall + 5)))} style={styles.stepBtn}>
                    <Icon name="add" size={20} color={COLORS.brand} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.hint}>Automatski izračun: {trayDoughWeight} g</Text>
              <Text style={[styles.label, { marginTop: SPACING.sm }]}>Dimenzije tepsije (cm)</Text>
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
              <Text style={[styles.label, { marginTop: SPACING.md }]}>{t.calc.diameter}</Text>
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
            </>
          )}

        </View>

            {/* 4. METHOD + HYDRATION + TEMP */}
        <View style={styles.card}>
          <Pressable testID="method-header" onPress={() => setMethodExpanded((value) => !value)} style={styles.styleHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>4 · {t.calc.method} + {t.calc.hydration}</Text>
              {!methodExpanded ? <Text style={styles.hint}>{method === 'direct' ? t.calc.direct : method === 'biga' ? t.calc.biga : t.calc.poolish}</Text> : null}
            </View>
            <Icon name={methodExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.brand} />
          </Pressable>
          {methodExpanded ? <>
          <Text style={styles.label}>{t.calc.method}</Text>
          {flour === 'glutenFree' ? <Text style={styles.hint}>Za bezglutensko brašno dostupna je samo direktna metoda.</Text> : null}
          <View style={styles.pillGroup}>
            {[
              { k: 'direct' as const, l: t.calc.direct },
              { k: 'biga' as const, l: t.calc.biga },
              { k: 'poolish' as const, l: t.calc.poolish },
            ].filter((m) => flour !== 'glutenFree' || m.k === 'direct').map((m) => (
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
                  <Pressable testID="biga-fermentation-info" onPress={() => Alert.alert(fermentationInfoTitle, fermentationInfoBody)} style={styles.infoBtn} hitSlop={8}><Icon name="information-circle-outline" size={18} color={COLORS.brand} /></Pressable>
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
                    <Pressable testID="poolish-fermentation-info" onPress={() => Alert.alert(fermentationInfoTitle, fermentationInfoBody)} style={styles.infoBtn} hitSlop={8}><Icon name="information-circle-outline" size={18} color={COLORS.brand} /></Pressable>
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
              <Text style={styles.label}>{t.calc.hydration}</Text>
              <Text style={styles.subLabel}>{t.calc.idealHydration}: {flourProfile.min}–{flourProfile.max}% (◎ {styleProfile.hydration}%)</Text>
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

          <View style={[styles.row, { marginTop: SPACING.md }] }>
            <Text style={styles.label}>{t.calc.salt}</Text>
            <View style={[styles.stepper, isIdealSalt && styles.stepperIdeal]}>
              <Pressable testID="salt-minus" onPress={() => step(() => setSaltPct(Math.max(0, Math.round((saltPct - 0.1) * 10) / 10)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
              <Text style={[styles.stepVal, isIdealSalt && styles.stepValIdeal]}>{saltPct}%</Text>
              <Pressable testID="salt-plus" onPress={() => step(() => setSaltPct(Math.min(6, Math.round((saltPct + 0.1) * 10) / 10)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
            </View>
          </View>

          <View style={[styles.row, { marginTop: SPACING.sm }] }>
            <Text style={styles.label}>{t.calc.oil}</Text>
            <View style={[styles.stepper, isIdealOil && styles.stepperIdeal]}>
              <Pressable testID="oil-minus" onPress={() => step(() => setOilPct(Math.max(0, Math.round((oilPct - 0.5) * 10) / 10)))} style={styles.stepBtn}><Icon name="remove" size={20} color={COLORS.brand} /></Pressable>
              <Text style={[styles.stepVal, isIdealOil && styles.stepValIdeal]}>{oilPct}%</Text>
              <Pressable testID="oil-plus" onPress={() => step(() => setOilPct(Math.min(10, Math.round((oilPct + 0.5) * 10) / 10)))} style={styles.stepBtn}><Icon name="add" size={20} color={COLORS.brand} /></Pressable>
            </View>
          </View>

          <View style={[styles.row, { marginTop: SPACING.md }]}>
            <Text style={styles.label}>{t.calc.roomTemp}</Text>
            <View style={styles.stepper}>
              <Pressable testID="rt-minus" onPress={() => step(() => setRoomTemp(Math.max(10, roomTemp - 1)))} style={styles.stepBtn}>
                <Icon name="remove" size={20} color={COLORS.brand} />
              </Pressable>
              <Text style={styles.stepVal}>{roomTemp}°C</Text>
              <Pressable testID="rt-plus" onPress={() => step(() => setRoomTemp(Math.min(35, roomTemp + 1)))} style={styles.stepBtn}>
                <Icon name="add" size={20} color={COLORS.brand} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.row, { marginTop: SPACING.sm }] }>
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
          </View>

          <View style={[styles.row, { marginTop: SPACING.sm }] }>
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
          </View>

          <View style={[styles.row, { marginTop: SPACING.sm }]}>
            <Text style={styles.label}>{t.calc.fridgeTempShort}</Text>
            <View style={styles.stepper}>
              <Pressable testID="ft-minus" onPress={() => step(() => setFridgeTemp(Math.max(2, fridgeTemp - 1)))} style={styles.stepBtn}>
                <Icon name="remove" size={20} color={COLORS.brand} />
              </Pressable>
              <Text style={styles.stepVal}>{fridgeTemp}°C</Text>
              <Pressable testID="ft-plus" onPress={() => step(() => setFridgeTemp(Math.min(10, fridgeTemp + 1)))} style={styles.stepBtn}>
                <Icon name="add" size={20} color={COLORS.brand} />
              </Pressable>
            </View>
          </View>

          <Pressable
            testID="use-ice-toggle"
            onPress={() => step(() => setUseIce((value) => !value))}
            style={[styles.row, { marginTop: SPACING.md }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Koristi led</Text>
              <Text style={styles.subLabel}>Opcionalno; led zamjenjuje dio ukupne vode.</Text>
            </View>
            <Icon name={useIce ? 'checkbox' : 'square-outline'} size={24} color={useIce ? COLORS.brand : COLORS.muted} />
          </Pressable>
          </> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>6 · {t.calc.baking}</Text>
          <View style={styles.ovenRow}>
            {isRomanTeglia ? (
              <OvenCard active={oven === 'homePan'} onPress={() => step(() => selectOven('homePan', 250))} imageSrc={require('../../assets/images/oven-home-pan.png')} title="Pećnica" testID="oven-homePan" />
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
                value={ovenTempInput}
                onChangeText={(value) => {
                  const clean = value.replace(/[^0-9]/g, '').slice(0, 3);
                  setOvenTempInput(clean);
                  const parsed = Number(clean);
                  if (clean !== '' && Number.isFinite(parsed) && parsed >= 200 && parsed <= 500) setOvenTemp(parsed);
                }}
                onBlur={commitOvenTemperature}
                keyboardType="numeric"
                style={styles.customInput}
              />
              <Text style={styles.bakeTempUnit}>°C</Text>
            </View>
            <Text style={styles.bakeText}>{bakingDuration}</Text>
          </View>
        </View>

        {/* 4. MIXING */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>5 · {t.calc.mixingTitle}</Text>
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
          <Pressable testID="mix-toggle" onPress={() => setShowMixSteps(!showMixSteps)} style={styles.expandBtn}>
            <Text style={styles.expandText}>{showMixSteps ? t.calc.hideSteps : t.calc.showSteps}</Text>
            <Icon name={showMixSteps ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.brand} />
          </Pressable>
          {showMixSteps ? (
            <View style={styles.stepsBox}>
              {(bigaPreparation || poolishPreparation) ? (
                <PhaseBlock
                  title={(bigaPreparation || poolishPreparation)!.title}
                  steps={(bigaPreparation || poolishPreparation)!.steps}
                  bigaInfo={(bigaPreparation || poolishPreparation)!.info}
                  phaseKey={`${method}-${mixing}-preparation`}
                  timers={bigaPreparation ? [
                    { id: `biga-fermentation-${mixing}`, seconds: bigaHours * 3600, kind: 'preferment' as const },
                  ] : (poolishPreparation || { timers: [] }).timers}
                  completed={completedSteps}
                  onToggle={toggleStep}
                  activeTimers={activeTimers}
                  onStartTimer={startTimer}
                  onStopTimer={stopTimer}
                  lang={lang}
                />
              ) : null}
              {detailedDirectSteps ? (
                detailedDirectSteps.map((phase, index) => (
                  <PhaseBlock
                    key={`detailed-direct-${pizzaStyle}-${mixing}-${index}`}
                    title={phase.title}
                    steps={phase.steps}
                    waterInfo={phase.waterInfo}
                    containerOilInfo={phase.containerOilInfo}
                    fermentationInfo={phase.fermentationInfo}
                    fermentationSignsInfo={phase.fermentationSignsInfo}
                    degassingInfo={phase.degassingInfo}
                    doughHandlingInfo={phase.doughHandlingInfo}
                    temperingInfo={phase.temperingInfo}
                    proofingInfo={phase.proofingInfo}
                    ovenTimingInfo={phase.ovenTimingInfo}
                    bakingCheckInfo={phase.bakingCheckInfo}
                    bakingInfo={phase.bakingInfo}
                    phaseKey={`detailed-direct-${pizzaStyle}-${mixing}-${index}`}
                    timers={phase.timers}
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
                    <PhaseBlock title={t.calc.handMixSteps.A.title} steps={adaptFermentationSteps(t.calc.handMixSteps.A.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-A`} timers={getDirectPhaseTimers('direct-hand-A', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.handMixSteps.B.title} steps={adaptFermentationSteps(t.calc.handMixSteps.B.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-B`} timers={getDirectPhaseTimers('direct-hand-B', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.handMixSteps.C.title} steps={adaptDirectPhaseSteps('C', t.calc.handMixSteps.C.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-C`} timers={getDirectPhaseTimers('direct-hand-C', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.handMixSteps.D.title} steps={adaptDirectPhaseSteps('D', t.calc.handMixSteps.D.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-hand-D`} timers={getDirectPhaseTimers('direct-hand-D', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                  </>
                ) : (
                  <>
                    <PhaseBlock title={t.calc.mixerSteps.A.title} steps={adaptFermentationSteps(t.calc.mixerSteps.A.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-A`} timers={getDirectPhaseTimers('direct-mixer-A', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.mixerSteps.B.title} steps={adaptFermentationSteps(t.calc.mixerSteps.B.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-B`} timers={getDirectPhaseTimers('direct-mixer-B', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.mixerSteps.C.title} steps={adaptDirectPhaseSteps('C', t.calc.mixerSteps.C.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-C`} timers={getDirectPhaseTimers('direct-mixer-C', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    <PhaseBlock title={t.calc.mixerSteps.D.title} steps={adaptDirectPhaseSteps('D', t.calc.mixerSteps.D.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`direct-mixer-D`} timers={getDirectPhaseTimers('direct-mixer-D', roomHours, fridgeHours)} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                  </>
                )
              ) : method === 'biga' ? (
                (() => {
                  const path = BIGA_STEPS[lang][mixing];
                  return (
                    <>
                      {!bigaPreparation ? <PhaseBlock title={path.p1.title} steps={adaptFermentationSteps(path.p1.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`biga-${mixing}-P1`} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} /> : null}
                      <PhaseBlock title={path.p2.title} steps={adaptFermentationSteps(path.p2.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`biga-${mixing}-P2`} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                      <PhaseBlock title={path.p3.title} steps={adaptFermentationSteps(path.p3.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`biga-${mixing}-P3`} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                    </>
                  );
                })()
              ) : (
                (() => {
                  const path = POOLISH_STEPS[lang][mixing];
                  return (
                    <>
                      <PhaseBlock title={path.p1.title} steps={adaptFermentationSteps(path.p1.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`poolish-${mixing}-P1`} timers={[...(roomHours > 0 ? [{ id: 'room-custom', seconds: roomHours * 3600, kind: 'rt' as const }] : []), ...(fridgeHours > 0 ? [{ id: 'fridge-custom', seconds: fridgeHours * 3600, kind: 'fridge' as const }] : [])]} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                      <PhaseBlock title={path.p2.title} steps={poolishMixSteps ?? adaptFermentationSteps(path.p2.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`poolish-${mixing}-P2`} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
                      <PhaseBlock title={path.p3.title} steps={adaptFermentationSteps(path.p3.steps, roomHours, fridgeHours, fridgeTemp, lang)} phaseKey={`poolish-${mixing}-P3`} completed={completedSteps} onToggle={toggleStep} activeTimers={activeTimers} onStartTimer={startTimer} onStopTimer={stopTimer} lang={lang} />
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
        <View style={styles.recipeCard}>
          {dough.preferment ? (
            <>
              <Text style={styles.recipeSection}>
                7 · {t.calc.preferment} · {method === 'biga' ? `BIGA ${bigaPct}%` : `POOLISH ${poolishPct}%`}
              </Text>
              <ResultRow label={t.calc.totalFlour} value={`${dough.preferment.flour} g`} highlight />
              <ResultRow label={t.calc.totalWater} value={`${dough.preferment.water} g`} highlight />
              <ResultRow label={t.calc.yeastAmount + ' (' + t.calc.freshYeastShort + ')'} value={`${dough.preferment.yeast} g`} />
              {method === 'poolish' ? (
                <Text style={styles.hint}>{t.calc.poolishHint}</Text>
              ) : (
                <Text style={styles.hint}>{t.calc.bigaHint}</Text>
              )}

              <Text style={[styles.recipeSection, { marginTop: SPACING.md }]}>{t.calc.mainDough}</Text>
              <ResultRow label={t.calc.remainingFlour} value={`${dough.main.flour} g`} highlight />
              {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={`${psylliumGrams} g`} highlight /> : null}
              {ice ? (
                <>
                  <ResultRow label={`${t.calc.coldWater} (${t.calc.remainingLabel})`} value={`${Math.max(0, dough.main.water - ice.ice)} g`} />
                  <ResultRow label={`🧊 ${t.calc.iceAmount}`} value={`${ice.ice} g`} highlight />
                </>
              ) : (
                <ResultRow label={`${t.calc.remainingWater} (${dough.waterTemp}°C)`} value={`${dough.main.water} g`} highlight />
              )}
              <ResultRow label={t.calc.saltAmount} value={`${dough.main.salt} g`} />
              <ResultRow label={t.calc.oilAmount} value={`${dough.main.oil} g`} />
              <ResultRow label={t.calc.yeastAmount + ' (' + t.calc.freshYeastShort + ')'} value={`${dough.main.yeast} g`} />

              <View style={styles.subBlock}>
                <Text style={styles.subhead}>{t.calc.totals} · {pizzas} × {effectiveBall}g = {dough.totalDough}g</Text>
                <ResultRow label={t.calc.totalFlour} value={`${dough.total.flour} g`} />
                {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={`${psylliumGrams} g`} /> : null}
                <ResultRow label={t.calc.totalWater} value={`${dough.total.water} g`} />
                <ResultRow label={t.calc.saltAmount} value={`${dough.total.salt} g`} />
                <ResultRow label={t.calc.yeastAmount} value={`${dough.total.yeast} g`} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.recipeSection}>
                7 · {t.calc.totalDough} · {pizzas} × {effectiveBall}g = {dough.totalDough}g
              </Text>
              {isCustom ? (
                <>
                  <ResultRow label={`${FLOUR_PROFILES[blendA].label} (${blendPctA}%)`} value={`${Math.round(dough.main.flour * blendPctA / 100)} g`} highlight />
                  <ResultRow label={`${FLOUR_PROFILES[blendB].label} (${100 - blendPctA}%)`} value={`${Math.round(dough.main.flour * (100 - blendPctA) / 100)} g`} highlight />
                  <ResultRow label={t.calc.totalFlour} value={`${dough.main.flour} g`} />
                </>
              ) : (
                <ResultRow label={`${t.calc.flourLabel} (${flourProfile.label})`} value={`${dough.main.flour} g`} highlight />
              )}
              {psylliumGrams > 0 ? <ResultRow label="Psyllium" value={`${psylliumGrams} g`} highlight /> : null}
              {ice ? (
                <>
                  <ResultRow label={t.calc.coldWater} value={`${ice.water} g`} />
                  <ResultRow label={`🧊 ${t.calc.iceAmount}`} value={`${ice.ice} g`} highlight />
                </>
              ) : (
                <ResultRow label={`${t.calc.totalWater} (${dough.waterTemp}°C)`} value={`${dough.main.water} g`} highlight />
              )}
              <ResultRow label={t.calc.saltAmount} value={`${dough.main.salt} g`} />
              <ResultRow label={`${t.calc.yeastAmount} (${t.calc.freshYeastShort}, ${dough.yeastPct}%)`} value={`${dough.main.yeast} g`} />
              <ResultRow label={t.calc.oilAmount} value={`${dough.main.oil} g`} />
            </>
          )}

          {/* Per-pizza normative — BELOW total */}
          <Text style={[styles.recipeSection, { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider }]}>
            {t.calc.perPizza} · {diameter} cm
          </Text>
          <ResultRow label={t.calc.doughBall} value={`${effectiveBall} g`} />
          <ResultRow label={t.calc.sauce} value={`${dims.sauce} g`} />
          <ResultRow label={t.calc.cheese} value={`${dims.cheese} g`} />
        </View>

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

        {/* Footer links */}
        <View style={styles.moreRow}>
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
                <Text style={styles.styleInfoLine}>Promjer: {PIZZA_STYLE_PROFILES[styleInfo].defaultDiameter} cm</Text>
                <Text style={styles.styleInfoLine}>Kugla: {PIZZA_STYLE_PROFILES[styleInfo].ballWeight} g</Text>
                <Text style={styles.styleInfoLine}>Hidratacija: {PIZZA_STYLE_PROFILES[styleInfo].hydration}%</Text>
                <Text style={styles.styleInfoLine}>Sol: {PIZZA_STYLE_PROFILES[styleInfo].saltPct}%</Text>
                <Text style={styles.styleInfoLine}>Ulje / masti: {PIZZA_STYLE_PROFILES[styleInfo].oilPct}%</Text>
                <Text style={styles.styleInfoLine}>Fermentacija: {PIZZA_STYLE_PROFILES[styleInfo].fermentation === 'coldLong' ? '24–48 h, hladnjak' : 'Isti dan'}</Text>
                <Text style={styles.styleInfoLine}>Pečenje: {PIZZA_STYLE_PROFILES[styleInfo].bakeTemp} · {PIZZA_STYLE_PROFILES[styleInfo].bakeTime}</Text>
                <Text style={styles.styleInfoLine}>Oblikovanje: {PIZZA_STYLE_PROFILES[styleInfo].shaping}</Text>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!methodInfo} animationType="fade" transparent onRequestClose={() => setMethodInfo(null)}>
        <Pressable style={styles.tooltipBackdrop} onPress={() => setMethodInfo(null)}>
          <Pressable style={styles.tooltipCard} onPress={() => {}}>
            <View style={styles.tooltipHeader}>
              <Icon name="information-circle" size={20} color={COLORS.brand} />
              <Text style={styles.tooltipTitle}>{methodInfo ? METHOD_INFO[lang][methodInfo].title : ''}</Text>
              <Pressable onPress={() => setMethodInfo(null)} hitSlop={8}>
                <Icon name="close" size={20} color={COLORS.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 460 }}>
              <Text style={styles.tooltipBody}>{methodInfo ? METHOD_INFO[lang][methodInfo].body : ''}</Text>
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
) {
  const hand = mixing === 'hand';
  const instructionFlour = flourType === 'custom' ? 'caputo00' : flourType;
  const isSpelt = instructionFlour === 'spelt';
  const isWholeWheat = instructionFlour === 'wholeWheat';
  const isGlutenFree = instructionFlour === 'glutenFree';
  const isRomanTonda = romanTonda;
  const isRomanTeglia = romanTeglia;
  const isNewYork = newYork;
  const isNapolitana = napolitana;
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
    ? [`Zagrijte pizza peć najmanje 20 minuta na ${ovenTemp} °C.`, 'Ubacite pizzu u zagrijanu pizza peć.', 'Tijekom pečenja rotirajte pizzu svakih 20–30 sekundi.', 'Pecite približno 60–90 sekundi i izvadite kada rub dobije tamne mrlje.']
    : oven === 'homePan'
      ? [`Zagrijte kućnu pećnicu na ${ovenTemp} °C s ventilacijom.`, 'Pecite pizzu na dnu pećnice 5–7 minuta.', 'Prebacite je pod gornji grill još 2–3 minute.']
      : [`Zagrijte kamen ili čelik 45–60 minuta na ${ovenTemp} °C.`, 'Isključite grill i prebacite pećnicu na Pizza program, ako je dostupan. Ako Pizza program nije dostupan, odaberite gornji i donji grijač bez ventilatora te postavite maksimalnu temperaturu. Pecite pizzu približno 4–5 minuta.', 'Zatim uključite grill i pecite dok rub i vrh ne dobiju željenu boju.'];
  const bulkRestMinutes = Math.max(15, Math.round(30 * (22 / Math.max(10, roomTemp))));
  const napolitanaRoomMinutes = Math.max(0, Math.round(roomHours * 60));
  const napolitanaMixRestMinutes = isNapolitana && isGlutenFree
    ? Math.min(15, napolitanaRoomMinutes)
    : isNapolitana
      ? Math.min(hand ? 15 : 5, napolitanaRoomMinutes)
      : hand ? 15 : 5;
  const napolitanaRemainingMinutes = Math.max(0, napolitanaRoomMinutes - napolitanaMixRestMinutes);
  const napolitanaRequiredRest = Math.min(15, Math.floor(napolitanaRemainingMinutes / 3));
  const napolitanaFinalRest = Math.max(0, napolitanaRemainingMinutes - (napolitanaRequiredRest * 2));
  const firstBulkRestMinutes = isNapolitana && !isGlutenFree ? napolitanaRequiredRest : bulkRestMinutes;
  const secondBulkRestMinutes = isNapolitana && !isGlutenFree ? napolitanaRequiredRest : bulkRestMinutes;
  const finalBulkRestMinutes = isNapolitana && !isGlutenFree ? napolitanaFinalRest : bulkRestMinutes;
  const temperingMin = Math.min(120, Math.max(15, Math.round(30 + (22 - roomTemp) * 7.5)));
  const temperingMax = Math.min(120, temperingMin + 15);
  const ovenPreheatMin = oven === 'homeStone' ? 45 : 20;
  const ovenPreheatMax = oven === 'homeStone' ? 60 : 20;
  const temperingMidpoint = Math.round(((temperingMin + temperingMax) / 2) * 60);
  const timer = (id: string, seconds: number, kind: BaseTimer['kind']): BaseTimer => ({ id, seconds, kind });
  const ballCount = Math.round(totalDough / ballWeight);
  const ballWord = ballCount % 10 === 1 && ballCount % 100 !== 11 ? 'kuglu' : ballCount % 10 >= 2 && ballCount % 10 <= 4 && (ballCount % 100 < 10 || ballCount % 100 >= 20) ? 'kugle' : 'kugli';
  const pizzaWord = pizzas % 10 === 1 && pizzas % 100 !== 11 ? 'pizzu' : pizzas % 10 >= 2 && pizzas % 10 <= 4 && (pizzas % 100 < 10 || pizzas % 100 >= 20) ? 'pizze' : 'pizza';

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
            : 'Kod visoke hidratacije tijesto može biti ljepljivo. Nemojte automatski dodavati brašno. Nauljite ili lagano smočite ruke, napravite kratki odmor, a zatim Stretch & Fold.',
      steps: biga ? [
        hand ? 'Operite i temeljito osušite ruke.' : 'Pripremite mikser i njegovu posudu.',
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
        !isGlutenFree && hand ? `Pokrijte tijesto i ostavite ga ${napolitanaMixRestMinutes} minuta da se gluten opusti.` : hand ? `Ostavite tijesto da odmori ${napolitanaMixRestMinutes} minuta.` : `Ostavite tijesto da odmori ${napolitanaMixRestMinutes} minuta u posudi miksera.`,
      ] : poolish ? [
        hand ? 'Operite i temeljito osušite ruke.' : 'Pripremite mikser i njegovu posudu.',
        hand ? 'Nakon fermentacije Poolish prelijte u posudu za ručni zamjes.' : 'Nakon fermentacije Poolish prelijte u posudu miksera.',
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
        !isGlutenFree && hand ? `Pokrijte tijesto i ostavite ga ${napolitanaMixRestMinutes} minuta da se gluten opusti.` : hand ? `Ostavite tijesto da odmori ${napolitanaMixRestMinutes} minuta.` : `Ostavite tijesto da odmori ${napolitanaMixRestMinutes} minuta u posudi miksera.`,
      ] : isGlutenFree ? [
        hand ? 'Operite i temeljito osušite ruke.' : 'Pripremite mikser i njegovu posudu.',
        `Pripremite ${ingredients.flour} g bezglutenskog brašna, ${psylliumAmount} g psyllium ljuskica, ${ingredients.salt} g soli, ${ingredients.yeast} g svježeg kvasca, ${ingredients.oil} g maslinovog ulja i ukupno ${ingredients.water} g hladne vode (visoka hidratacija).`,
        `U približno 90% ukupne hladne vode, odnosno ${initialWater} g, otopite kvasac.`,
        hand ? 'Dodajte bezglutensko brašno i psyllium ljuskice te miješajte rukom ili špatulom dok ne nestanu suhi dijelovi.' : 'Dodajte bezglutensko brašno i psyllium ljuskice u posudu te miješajte samo na najnižoj brzini dok ne nestanu suhi dijelovi.',
        `Postupno dodajte preostalih ${remainingWater} g hladne vode, ne odjednom.`,
        `Kada je smjesa povezana, dodajte ${ingredients.salt} g soli kao zaseban korak.`,
        'Bezglutenska smjesa se ne mijesi za razvoj glutena; miješajte je samo dok se svi sastojci ne povežu u homogenu, ljepljivu masu.',
        `Dodajte ${ingredients.oil} g maslinovog ulja i miješajte dok ga smjesa potpuno ne upije.`,
        'Zamjes je gotov kada je masa ujednačena, glatka i ljepljiva.',
        `Ostavite smjesu ${isNapolitana ? napolitanaMixRestMinutes : 5} minuta kako bi psyllium povukao vlagu i dao joj potrebnu čvrstoću.`,
      ] : [
        hand ? 'Operite i temeljito osušite ruke.' : 'Pripremite mikser i njegovu posudu.',
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
        !isGlutenFree && hand ? `Pokrijte tijesto i ostavite ga ${napolitanaMixRestMinutes} minuta da se gluten opusti.` : hand ? `Ostavite tijesto da odmori ${napolitanaMixRestMinutes} minuta.` : `Ostavite tijesto da odmori ${napolitanaMixRestMinutes} minuta u posudi miksera.`,
      ],
      timers: [timer(hand && !isGlutenFree ? 'post-mix-rest15m' : 'post-mix-rest', napolitanaMixRestMinutes * 60, 'rest')],
    },
    {
      title: isRomanTeglia && isGlutenFree ? 'Faza B: Kratki odmor' : isRomanTeglia ? 'Faza B: Fermentacija i preklapanje' : isGlutenFree ? 'Faza B: Kratki odmor' : hasPreferment ? 'Faza C: Bulk fermentacija i foldovi' : 'Faza B: Bulk fermentacija i foldovi',
      fermentationInfo: isRomanTeglia && isGlutenFree
        ? 'Bezglutenska Teglia ne radi Stretch & Fold. Ostavite smjesu 15 minuta da psyllium poveže strukturu prije utiskivanja u tepsiju.'
        : isRomanTeglia
        ? 'Teglia koristi vlažnije tijesto koje ostaje kao jedna masa. Napravite dva nježna Stretch & Fold preklapanja u posudi prije hladne fermentacije.'
        : isNapolitana && isGlutenFree
        ? `Početni odmor od ${napolitanaMixRestMinutes} minuta služi hidrataciji psylliuma i uračunat je u ukupno odabrano vrijeme od ${napolitanaRoomMinutes} minuta. Nakon njega tijesto samo nastavlja fermentirati još ${napolitanaRemainingMinutes} minuta bez preklapanja.`
        : isNapolitana && !isGlutenFree
        ? `Završna fermentacija počinje nakon završetka zamjesa i ukupno traje ${napolitanaRoomMinutes} minuta prema korisničkom odabiru: početni odmor ${firstBulkRestMinutes} minuta, odmor između preklapanja ${secondBulkRestMinutes} minuta i završni odmor ${finalBulkRestMinutes} minuta prije podjele na kugle. Biga ili Poolish fermentiraju se zasebno.`
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
        ...(napolitanaRemainingMinutes > 0 ? [`Nakon početnog odmora nastavite fermentirati smjesu još ${napolitanaRemainingMinutes} minuta na sobnoj temperaturi. Ne radite Stretch & Fold.`] : ['Početni odmor pokriva ukupno odabrano vrijeme fermentacije. Ne radite Stretch & Fold.']),
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
        `Pokrijte posudu i ostavite tijesto ${firstBulkRestMinutes} minuta na sobnoj temperaturi.`,
        'Napravite prvi Stretch & Fold.',
        `Ostavite tijesto ponovno ${secondBulkRestMinutes} minuta.`,
        'Napravite drugi Stretch & Fold.',
        `Ostavite završni bulk još ${finalBulkRestMinutes} minuta na sobnoj temperaturi.`,
        'Provjerite jesu li vidljivi prvi znakovi fermentacije.',
      ],
      timers: isRomanTeglia && isGlutenFree
        ? [timer('gluten-free-teglia-rest', 15 * 60, 'rt')]
        : isNapolitana && isGlutenFree
        ? [timer('gluten-free-napolitana-rest', napolitanaRemainingMinutes * 60, 'rt')]
        : isRomanTeglia
        ? [timer('roman-tray-bulk-1', bulkRestMinutes * 60, 'rt'), timer('roman-tray-bulk-2', bulkRestMinutes * 60, 'rt'), timer('roman-tray-bulk-final', bulkRestMinutes * 60, 'rt')]
        : isGlutenFree
        ? [timer('gluten-free-short-rest', 15 * 60, 'rt')]
        : [
          timer('bulk-rest-1', firstBulkRestMinutes * 60, 'rt'),
          timer('bulk-rest-2', secondBulkRestMinutes * 60, 'rt'),
          timer('bulk-final', finalBulkRestMinutes * 60, 'rt'),
          ],
    },
    {
      title: isRomanTeglia ? 'Faza C: Masa za tepsiju' : isGlutenFree ? 'Faza C: Podjela i oblikovanje kugli' : hasPreferment ? 'Faza D: Podjela i kugle' : 'Faza C: Podjela i kugle',
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
      containerOilInfo: 'Kugle držite u kutiji koja štiti od isušivanja, ali je nemojte hermetički zatvoriti. Poklopac treba samo prianjati ili imati mogućnost izlaska plinova; kutija ne smije biti pod pritiskom.',
      steps: isRomanTeglia ? [
        'Pokrijte fermentacijsku posudu i prebacite cijelu masu u hladnjak.',
        `Masa fermentira u hladnjaku ${fridgeHours} sati pri približno 4–6 °C. Vrijeme hladne fermentacije računa se samo jednom.`,
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
          : `Nakon završetka završnog odmora prijeđite na oblikovanje. Vrijeme odmora automatski je prilagođeno korisničkom odabiru od ${roomHours} sati.`,
      proofingInfo: isRomanTonda
        ? 'Romana Tonda treba ostati tanka i ravna. Nježno je otvorite prstima ili valjkom, bez agresivnog rastezanja u zraku.'
        : isGlutenFree
        ? 'Nema rastezanja u zraku. Vrhovima prstiju nježno tapkajte i potiskujte smjesu od sredine prema rubovima; bezglutenska podloga je ljepljiva i treba ostati ravnomjerno poduprta.'
        : isWholeWheat
          ? 'Kod integralnog tijesta vrhovima prstiju vrlo nježno pritisnite centar. Brzo istiskivanje zraka može dovesti do pucanja gornjeg sloja, a rub neće imati visok, šupljikav cornicione kao bijelo brašno.'
        : isSpelt
          ? 'Kod pira vrhovima prstiju vrlo nježno pritisnite centar. Pir ima manje elastičnosti, zato izbjegavajte naglo istiskivanje zraka; rub se možda neće jako napuhnuti.'
          : 'Provjerite je li tijesto spremno za oblikovanje: kugla treba biti mekana, podatna i lagano napuhnuta. Lagano pritisnite površinu prstom; tijesto se treba polako vraćati. Ako je još vrlo čvrsto i brzo vraća oblik, ostavite ga još malo na sobnoj temperaturi.',
      ovenTimingInfo: oven === 'ooni'
        ? `Pizza peći treba približno ${ovenPreheatMin}–${ovenPreheatMax} minuta da se zagrije. Da se vrijeme uskladi s temperiranjem kugli, uključite pizza peć ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minuta prije nego što izvadite kugle iz hladnjaka.`
        : `Pećnici treba približno ${ovenPreheatMin}–${ovenPreheatMax} minuta da se zagrije. Da se vrijeme uskladi s temperiranjem kugli, uključite pećnicu ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minuta prije nego što izvadite kugle iz hladnjaka.`,
      bakingInfo: oven === 'homeStone' ? 'Kamen ili čelik postavite dvije rešetke ispod gornjeg grijača.' : undefined,
      bakingCheckInfo: oven === 'homePan' ? 'Podignite rub pizze i provjerite je li dno dovoljno pečeno i zlatno-smeđe.' : undefined,
      steps: isRomanTeglia ? [
        `Pećnicu dobro zagrijte na ${ovenTemp} °C.`,
        `Izvadite masu iz hladnjaka i ostavite je ${temperingMin}–${temperingMax} minuta da se opusti.`,
        'Lagano nauljite tepsiju.',
        `Istresite masu u tepsiju ${diameter} cm i nježno je utisnite prstima do rubova bez rastezanja u zraku.`,
        'Ostavite tijesto kratko da se opusti ako se vraća prema sredini.',
        'Dodajte umak i nadjev.',
        'Ako imate Pizza program, koristite njega; ako nemate Pizza program, koristite gornji i donji grijač bez ventilatora.',
        'Pecite bez grilla dok se dno i rub dobro ne ispeku.',
        'Na kraju uključite grill ako želite jače zapečenu gornju stranu.',
      ] : oven === 'homePan' ? [
        hasColdFermentation ? `Izvadite kugle iz hladnjaka i ostavite ih ${temperingMin}–${temperingMax} minuta prije oblikovanja. Pazite da se kugle ne predignu.` : `Ostavite kugle na sobnoj temperaturi do završetka odabranog odmora prije oblikovanja.`,
        'Brzim i nježnim pokretom izvadite kuglu iz posude i stavite je na pobrašnjenu podlogu.',
        'Lagano nauljite tepsiju.',
        isRomanTonda ? `Stavite tijesto direktno na podlogu i oblikujte tanku, ravnu Romanu do ${diameter} cm.` : isGlutenFree ? `Stavite smjesu direktno u tepsiju i nježno je utapkajte do ciljnog promjera od ${diameter} cm.` : `Stavite oblikovano tijesto direktno u tepsiju i razvucite ga do ciljnog promjera od ${diameter} cm.`,
        isRomanTonda ? 'Nježno pritisnite tijesto prstima ili ga tanko otvorite valjkom; ne rastežite ga agresivno u zraku.' : isNewYork ? 'Otvorite kuglu tako da centar ostane tanak, a rub ostane mekan i blago izražen.' : isGlutenFree ? 'Vrhovima prstiju nježno tapkajte i potiskujte smjesu od sredine prema rubovima. Nema rastezanja u zraku i ne koristite valjak.' : 'Lagano ga prstima raširite prema rubovima. Nemojte jako pritiskati da ne izbacite sav zrak.',
        'Ostavite tijesto u tepsiji da se kratko opusti i prilagodi obliku ako se vraća natrag.',
        'Dodajte umak i nadjev.',
        `Pećnicu dobro zagrijte na ${ovenTemp} °C.`,
        'Ako imate Pizza program, koristite njega; ako nemate Pizza program, koristite gornji i donji grijač bez ventilatora.',
        'Pecite bez grilla dok se dno i rub dobro ne ispeku.',
        'Na kraju uključite grill ako želite jače zapečenu gornju stranu.',
        'Izvadite pizzu iz pećnice i ostavite je kratko prije rezanja.',
      ] : [
        ovenSteps[0],
        hasColdFermentation ? `Izvadite kugle iz hladnjaka i ostavite ih ${temperingMin}–${temperingMax} minuta prije oblikovanja. Pazite da se kugle ne predignu.` : `Ostavite kugle na sobnoj temperaturi do završetka odabranog odmora prije oblikovanja.`,
        isRomanTonda ? 'Radnu površinu lagano pospite brašnom ili semolom.' : isGlutenFree ? 'Radnu površinu obilno pospite bezglutenskim ili rižinim brašnom.' : 'Površinu lagano pospite minimalnom količinom semole.',
        isRomanTonda ? 'Brzim i nježnim pokretom izvadite kuglu i stavite je na pobrašnjenu podlogu.' : isGlutenFree ? 'Brzim i nježnim pokretom izvadite kuglu i stavite je na pobrašnjenu podlogu.' : 'Brzim i nježnim pokretom izvadite kuglu iz posude i stavite je naopako na semolu.',
        isRomanTonda ? 'Oblikujte tanku i ravnu Romanu pritiskanjem prstima ili valjkom; ne rastežite je agresivno u zraku.' : isNewYork ? 'Otvorite kuglu tako da centar ostane tanak, a rub ostane mekan i blago izražen.' : isGlutenFree ? 'Nema rastezanja u zraku. Vrhovima prstiju nježno tapkajte i potiskujte smjesu od sredine prema rubovima kako biste formirali krug. Ne koristite valjak.' : 'Vrhovima prstiju potiskujte zrak iz sredine prema rubovima. Ne koristite valjak.',
        'Ostavite cornicione približno 1–2 cm kao vizualnu preporuku.',
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
  roomTemp: number,
  cheesePerPizza: number,
  oven: OvenType,
  ovenTemp: number,
  mixing: 'hand' | 'mixer',
) {
  const hand = mixing === 'hand';
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
  const ballCount = Math.round(totalDough / ballWeight);
  const timer = (id: string, seconds: number, kind: BaseTimer['kind']): BaseTimer => ({ id, seconds, kind });
  const pick = (de: string, en: string, sl: string) => lang === 'de' ? de : lang === 'en' ? en : sl;
  const ovenSteps = oven === 'ooni'
    ? [
      pick(`Heizen Sie den Pizzaofen mindestens 20 Minuten auf ${ovenTemp} °C vor.`, `Preheat the pizza oven for at least 20 minutes at ${ovenTemp} °C.`, `Pizza pečico segrevajte vsaj 20 minut pri ${ovenTemp} °C.`),
      pick('Schieben Sie die Pizza hinein und drehen Sie sie alle 20–30 Sekunden.', 'Launch the pizza and rotate it every 20–30 seconds.', 'Vstavite pico in jo obračajte vsakih 20–30 sekund.'),
      pick('Backen Sie die Pizza etwa 60–90 Sekunden und nehmen Sie sie heraus, sobald der Rand dunkle Flecken bekommt.', 'Bake the pizza for approximately 60–90 seconds and remove it when the rim develops dark spots.', 'Pico pecite približno 60–90 sekund in jo vzemite iz pečice, ko rob dobi temne lise.'),
    ]
    : oven === 'homePan'
      ? [
        pick(`Heizen Sie den Haushaltsbackofen auf ${ovenTemp} °C mit Umluft vor.`, `Preheat the home oven to ${ovenTemp} °C with convection.`, `Domačo pečico segrejte na ${ovenTemp} °C z ventilacijo.`),
        pick('Backen Sie die Pizza auf der untersten Schiene des Ofens 5–7 Minuten.', 'Bake the pizza on the bottom of the oven for 5–7 minutes.', 'Pico pecite na dnu pečice 5–7 minut.'),
        pick('Schieben Sie die Pizza anschließend für weitere 2–3 Minuten unter den oberen Grill.', 'Then move the pizza under the upper grill for another 2–3 minutes.', 'Nato pico za nadaljnji 2–3 minuti prestavite pod zgornji žar.'),
      ] : [
      pick(`Heizen Sie den Pizzastein oder Pizzastahl 45–60 Minuten auf ${ovenTemp} °C vor.`, `Preheat the pizza stone or steel for 45–60 minutes at ${ovenTemp} °C.`, `Kamen ali jeklo za pico segrevajte 45–60 minut pri ${ovenTemp} °C.`),
      pick('Schalten Sie den Grill aus und wechseln Sie auf das Pizza-Programm, falls vorhanden. Wenn kein Pizza-Programm verfügbar ist, wählen Sie Ober-/Unterhitze ohne Umluft und stellen Sie die maximale Temperatur ein. Backen Sie die Pizza ungefähr 4–5 Minuten.', 'Turn off the grill and switch the oven to the Pizza program, if available. If no Pizza program is available, select top and bottom heat without a fan and set the oven to its maximum temperature. Bake the pizza for approximately 4–5 minutes.', 'Izklopite žar in preklopite pečico na program Pizza, če je na voljo. Če program Pizza ni na voljo, izberite zgornje in spodnje gretje brez ventilatorja ter nastavite najvišjo temperaturo. Pico pecite približno 4–5 minut.'),
      pick('Schalten Sie anschließend den Grill ein und backen Sie die Pizza weiter, bis Rand und Oberfläche die gewünschte Bräunung erreicht haben.', 'Then turn on the grill and continue baking until the rim and top reach the desired browning.', 'Nato vklopite žar in pecite, dokler rob in vrh ne dosežeta želene zapečenosti.'),
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
      doughHandlingInfo: pick(
        'Bei hoher Hydration kann der Teig klebrig sein. Nicht automatisch Mehl hinzufügen. Ölen oder befeuchten Sie Ihre Hände leicht, lassen Sie den Teig kurz ruhen und führen Sie anschließend ein Stretch & Fold durch.',
        'With high hydration, the dough may be sticky. Do not automatically add flour. Lightly oil or wet your hands, let the dough rest briefly, and then perform a Stretch & Fold.',
        'Pri visoki hidraciji je lahko testo lepljivo. Ne dodajajte samodejno moke. Roke rahlo naoljite ali navlažite, testo pustite kratek čas počivati, nato izvedite Stretch & Fold.',
      ),
      steps: [
        hand
          ? pick('Waschen und trocknen Sie Ihre Hände gründlich.', 'Wash and thoroughly dry your hands.', 'Umijte in temeljito osušite roke.')
          : pick('Bereiten Sie den Mixer und seine Schüssel vor.', 'Prepare the mixer and its bowl.', 'Pripravite mešalnik in njegovo posodo.'),
        pick(`Sieben und wiegen Sie genau ${ingredients.flour} g Mehl, ${ingredients.salt} g Salz, ${ingredients.yeast} g Frischhefe und insgesamt ${ingredients.water} g Wasser ab.`, `Sift and accurately measure ${ingredients.flour} g of flour, ${ingredients.salt} g of salt, ${ingredients.yeast} g of fresh yeast, and ${ingredients.water} g of total water.`, `Presejte in natančno odmerite ${ingredients.flour} g moke, ${ingredients.salt} g soli, ${ingredients.yeast} g svežega kvasa in skupno ${ingredients.water} g vode.`),
        pick(`Lösen Sie die Hefe in ungefähr 90 % des Wassers, also ${initialWater} g, auf.`, `Dissolve the yeast in approximately 90% of the water, or ${initialWater} g.`, `Kvas raztopite v približno 90 % vode oziroma v ${initialWater} g vode.`),
        hand
          ? pick('Geben Sie das Mehl nach und nach zum Wasser mit der Hefe und mischen Sie es mit der Hand, bis keine trockenen Stellen mehr vorhanden sind.', 'Gradually add the flour to the water and yeast mixture and mix by hand until no dry flour remains.', 'Postopoma dodajajte moko v vodo s kvasom in mešajte z roko, dokler ne izginejo suhi deli.')
          : pick('Geben Sie das Mehl in die Mixerschüssel und mischen Sie bei niedriger Geschwindigkeit, bis keine trockenen Stellen mehr vorhanden sind.', 'Add the flour to the mixer bowl and mix on low speed until no dry flour remains.', 'Moko dodajte v posodo mešalnika in mešajte pri nizki hitrosti, dokler ne izginejo suhi deli.'),
        pick(`Geben Sie die restlichen ${remainingWater} g Wasser nach und nach hinzu, nicht auf einmal.`, `Gradually add the remaining ${remainingWater} g of water, not all at once.`, `Postopoma dodajte preostalih ${remainingWater} g vode, ne vse naenkrat.`),
        pick(`Wenn der Teig verbunden ist und das Wasser fast vollständig aufgenommen wurde, geben Sie ${ingredients.salt} g Salz als separaten Schritt hinzu.`, `When the dough has come together and the water is almost fully absorbed, add ${ingredients.salt} g of salt as a separate step.`, `Ko je testo povezano in je voda skoraj v celoti vpita, dodajte ${ingredients.salt} g soli kot ločen korak.`),
        hand
          ? pick('Kneten Sie weiter, bis der Teig glatt, elastisch und gut verbunden ist.', 'Continue kneading until the dough becomes smooth, elastic, and well connected.', 'Nadaljujte z gnetenjem, dokler testo ne postane gladko, elastično in povezano.')
          : pick('Mischen Sie bei höherer Geschwindigkeit weiter, bis sich Gluten entwickelt und der Teig glatt, elastisch und gut verbunden ist.', 'Continue mixing at a higher speed until gluten develops and the dough becomes smooth, elastic, and well connected.', 'Nadaljujte z mešanjem pri višji hitrosti, dokler se ne razvije gluten in testo postane gladko, elastično in povezano.'),
        ...(ingredients.oil > 0 ? [hand
          ? pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und kneten Sie, bis der Teig das Öl vollständig aufgenommen hat.`, `If oil is used: Add ${ingredients.oil} g of olive oil and knead until the dough has fully absorbed it.`, `Če uporabljate olje: Dodajte ${ingredients.oil} g oljčnega olja in gnetite, dokler ga testo popolnoma ne vpije.`)
          : pick(`Geben Sie ${ingredients.oil} g Olivenöl hinzu und mischen Sie, bis der Teig das Öl vollständig aufgenommen hat.`, `If oil is used: Add ${ingredients.oil} g of olive oil and mix until the dough has fully absorbed it.`, `Če uporabljate olje: Dodajte ${ingredients.oil} g oljčnega olja in mešajte, dokler ga testo popolnoma ne vpije.`)] : []),
        pick('Der Teig ist fertig geknetet, wenn er glatt, elastisch und homogen ist.', 'The dough is fully mixed when it is smooth, elastic, and homogeneous.', 'Gnetenje je končano, ko je testo gladko, elastično in homogeno.'),
        hand
          ? pick('Lassen Sie den Teig 5–6 Minuten ruhen.', 'Let the dough rest for 5–6 minutes.', 'Testo pustite počivati 5–6 minut.')
          : pick('Lassen Sie den Teig 5–6 Minuten in der Mixerschüssel ruhen.', 'Let the dough rest for 5–6 minutes in the mixer bowl.', 'Testo pustite počivati 5–6 minut v posodi mešalnika.'),
      ],
      timers: [timer('post-mix-rest', 5 * 60, 'rest')],
    },
    {
      title: pick('Phase B: Stockgare und Stretch & Fold', 'Phase B: Bulk Fermentation and Folds', 'Faza B: Prva fermentacija in pregibi'),
      fermentationInfo: pick(`Die Raumtemperatur beeinflusst die Geschwindigkeit der Fermentation. Im Sommer, wenn der Raum wärmer ist, wird die Stockgare verkürzt; im Winter, wenn es kühler ist, wird sie verlängert. Für die eingegebene Raumtemperatur von ${roomTemp} °C hat die App die Ruhezeit auf ungefähr ${bulkRestMinutes} Minuten angepasst.`, `Room temperature affects the speed of fermentation. In summer, when the room is warmer, bulk fermentation is shortened; in winter, when it is cooler, it is extended. For the entered room temperature of ${roomTemp} °C, the app has adjusted the resting time to approximately ${bulkRestMinutes} minutes.`, `Sobna temperatura vpliva na hitrost fermentacije. Poleti, ko je prostor toplejši, se prva fermentacija skrajša; pozimi, ko je hladneje, se podaljša. Za vneseno sobno temperaturo ${roomTemp} °C je aplikacija čas počitka prilagodila na približno ${bulkRestMinutes} minut.`),
      fermentationSignsInfo: pick('Achten Sie auf Anzeichen einer aktiven Fermentation: kleine Bläschen, eine leichte Volumenzunahme, eine glattere und leicht gespannte Oberfläche sowie eine elastischere und luftigere Teigstruktur.', 'Check for signs of active fermentation: small bubbles, a slight increase in volume, a smoother and slightly taut surface, and a more elastic and airy dough structure.', 'Preverite znake aktivne fermentacije: majhne mehurčke, rahlo povečanje prostornine, bolj gladko in rahlo napeto površino ter bolj elastično in zračno strukturo testa.'),
      containerOilInfo: pick('Verwenden Sie einen sauberen, lebensmittelechten Behälter, der groß genug ist, damit der Teig aufgehen kann. Decken Sie den Behälter mit einem Deckel oder einer Folie ab, verschließen Sie ihn jedoch nicht luftdicht: Bei der Fermentation entstehen Gase und der Behälter darf nicht unter Druck stehen. Sie können eine Kunststoffbox mit Deckel, eine Glasschüssel mit Folie, eine Teigwanne oder eine Gärbox mit nicht vollständig luftdichtem Deckel verwenden. Bestreichen Sie den Behälter nur leicht mit etwas Hilfsöl. Dieses Öl wird nicht in die Rezeptberechnung einbezogen und ist nicht dasselbe Öl wie das Öl im Teig.', 'Use a clean, food-safe container that is large enough for the dough to rise. Cover the container with a lid or plastic wrap, but do not seal it airtight: fermentation produces gases, and the container must not become pressurized. You can use a plastic container with a lid, a glass bowl covered with plastic wrap, a dough tub, or a fermentation box with a lid that is not completely airtight. Lightly coat the container with a small amount of auxiliary oil. This oil is not included in the recipe calculation and is not the same as the oil in the dough.', 'Uporabite čisto posodo, primerno za stik z živili, ki je dovolj velika, da lahko testo vzhaja. Posodo pokrijte s pokrovom ali folijo, vendar je ne zaprite nepredušno: pri fermentaciji nastajajo plini in posoda ne sme biti pod pritiskom. Uporabite lahko plastično posodo s pokrovom, stekleno skledo s folijo, posodo za testo ali fermentacijsko posodo s pokrovom, ki ni popolnoma neprepusten. Posodo rahlo premažite s pomožnim oljem. To olje ni vključeno v izračun recepta in ni isto kot olje v testu.'),
      steps: [
        pick('Ölen Sie den Fermentationsbehälter leicht und geben Sie den Teig hinein.', 'Lightly oil the fermentation container and transfer the dough into it.', 'Fermentacijsko posodo rahlo naoljite in vanjo prenesite testo.'),
        pick(`Decken Sie den Behälter ab und lassen Sie den Teig ${bulkRestMinutes} Minuten bei Raumtemperatur ruhen.`, `Cover the container and let the dough rest for ${bulkRestMinutes} minutes at room temperature.`, `Posodo pokrijte in testo pustite ${bulkRestMinutes} minut počivati pri sobni temperaturi.`),
        pick('Führen Sie das erste Stretch & Fold durch.', 'Perform the first Stretch & Fold.', 'Izvedite prvi Stretch & Fold.'),
        pick(`Lassen Sie den Teig erneut ${bulkRestMinutes} Minuten ruhen.`, `Let the dough rest for another ${bulkRestMinutes} minutes.`, `Testo ponovno pustite počivati ${bulkRestMinutes} minut.`),
        pick('Führen Sie das zweite Stretch & Fold durch.', 'Perform the second Stretch & Fold.', 'Izvedite drugi Stretch & Fold.'),
        pick(`Lassen Sie die abschließende Stockgare weitere ${bulkRestMinutes} Minuten bei Raumtemperatur laufen.`, `Let the dough complete its final bulk fermentation for another ${bulkRestMinutes} minutes at room temperature.`, `Končno prvo fermentacijo pustite potekati še ${bulkRestMinutes} minut pri sobni temperaturi.`),
        pick('Prüfen Sie, ob erste Anzeichen der Fermentation sichtbar sind.', 'Check whether the first signs of fermentation are visible.', 'Preverite, ali so vidni prvi znaki fermentacije.'),
      ],
      timers: [timer('bulk-rest-1', bulkRestMinutes * 60, 'rt'), timer('bulk-rest-2', bulkRestMinutes * 60, 'rt'), timer('bulk-final', bulkRestMinutes * 60, 'rt')],
    },
    {
      title: pick('Phase C: Teilen und Ballen', 'Phase C: Dividing and Balling', 'Faza C: Delitev in oblikovanje kroglic'),
      degassingInfo: pick('Entgasen bedeutet, die während der Fermentation entstandenen Gase aus dem Teig zu entfernen.', 'Degassing means removing the gases produced in the dough during fermentation.', 'Degaziranje pomeni odstranjevanje plinov, ki so nastali v testu med fermentacijo.'),
      steps: [
        pick('Bestäuben Sie die Arbeitsfläche leicht mit Mehl. Das Mehl für die Arbeitsfläche wird nicht in die Rezeptberechnung einbezogen.', 'Lightly flour the work surface. Flour used for the work surface is not included in the recipe calculation.', 'Delovno površino rahlo posujte z moko. Moka za delovno površino ni vključena v izračun recepta.'),
        pick('Nehmen Sie den Teig vorsichtig aus dem Behälter und vermeiden Sie dabei möglichst starkes Entgasen.', 'Gently remove the dough from the container while minimizing degassing.', 'Testo nežno vzemite iz posode in pri tem čim manj iztisnite plin.'),
        pick(`Teilen Sie insgesamt ${totalDough} g Teig in Teiglinge mit jeweils ${ballWeight} g.`, `Divide a total of ${totalDough} g of dough into balls weighing ${ballWeight} g each.`, `Skupno ${totalDough} g testa razdelite na kroglice po ${ballWeight} g.`),
        pick(`Sie erhalten ungefähr ${ballCount} Teiglinge für ${pizzas} Pizzen.`, `You will get approximately ${ballCount} dough balls for ${pizzas} pizzas.`, `Dobili boste približno ${ballCount} kroglic za ${pizzas} pic.`),
        pick('Formen Sie jedes Stück zu einer glatten und gespannten Teigkugel.', 'Shape each piece into a smooth and tight dough ball.', 'Vsak kos oblikujte v gladko in napeto kroglico.'),
      ],
    },
    {
      title: pick('Phase D: Kalte Fermentation', 'Phase D: Cold Fermentation', 'Faza D: Hladna fermentacija'),
      temperingInfo: pick('Temperieren bedeutet, dass die Teigkugeln nach der kalten Fermentation aus dem Kühlschrank genommen und vor dem Ausformen und Backen einige Zeit bei Raumtemperatur stehen gelassen werden.', 'Tempering means taking the dough balls out of the refrigerator after cold fermentation and leaving them at room temperature for some time before stretching and baking.', 'Temperiranje pomeni, da po hladni fermentaciji kroglice testa vzamete iz hladilnika in jih pred raztezanjem in peko nekaj časa pustite na sobni temperaturi.'),
      containerOilInfo: pick('Bewahren Sie die Teigkugeln in einer Box auf, die sie vor dem Austrocknen schützt, aber nicht luftdicht verschlossen ist. Der Deckel sollte nur aufliegen oder eine Möglichkeit zum Druckausgleich bieten. Die Box darf nicht unter Druck stehen.', 'Keep the dough balls in a box that protects them from drying out but is not sealed airtight. The lid should simply rest on the box or allow pressure to escape. The box must not become pressurized.', 'Kroglice testa hranite v posodi, ki jih ščiti pred izsušitvijo, vendar ni nepredušno zaprta. Pokrov naj bo samo položen na posodo ali naj omogoča izhod plinov. Posoda ne sme biti pod pritiskom.'),
      steps: [
        pick('Legen Sie die Teigkugeln in eine verschlossene Teigbox und stellen Sie sie in den Kühlschrank.', 'Place the dough balls in a closed fermentation box and transfer them to the refrigerator.', 'Kroglice testa položite v zaprto fermentacijsko posodo in jih prestavite v hladilnik.'),
        pick(`Lassen Sie die Teigkugeln ${fridgeHours} Stunden bei ungefähr 4–6 °C im Kühlschrank fermentieren. Die Zeit der kalten Fermentation wird nur einmal berechnet.`, `Ferment the dough balls in the refrigerator for ${fridgeHours} hours at approximately 4–6 °C. Cold fermentation time is counted only once.`, `Kroglice naj fermentirajo v hladilniku ${fridgeHours} ur pri približno 4–6 °C. Čas hladne fermentacije se šteje samo enkrat.`),
        pick('Nach Ablauf der gewählten Zeit fahren Sie mit dem Temperieren fort.', 'After the selected time has elapsed, proceed to tempering.', 'Po poteku izbranega časa nadaljujte s temperiranjem.'),
      ],
      timers: [timer('cold-fermentation', fridgeHours * 3600, 'fridge')],
    },
    {
      title: pick('Phase E: Temperieren und Formen', 'Phase E: Tempering and Shaping', 'Faza E: Temperiranje in oblikovanje'),
      temperingInfo: pick(`Die Temperierzeit wird automatisch an die Raumtemperatur von ${roomTemp} °C angepasst: ungefähr ${temperingMin}–${temperingMax} Minuten. Bei niedrigeren Temperaturen kann es 1–2 Stunden dauern. Achten Sie darauf, dass die Teigkugeln nicht überfermentieren.`, `Tempering time is automatically adjusted to the room temperature of ${roomTemp} °C: approximately ${temperingMin}–${temperingMax} minutes. At lower temperatures, it may take 1–2 hours. Make sure the dough balls do not over-ferment.`, `Čas temperiranja se samodejno prilagodi sobni temperaturi ${roomTemp} °C: približno ${temperingMin}–${temperingMax} minut. Pri nižjih temperaturah lahko traja 1–2 uri. Pazite, da kroglice ne fermentirajo preveč.`),
      proofingInfo: pick('Prüfen Sie, ob der Teig zum Formen bereit ist: Die Teigkugel sollte weich, geschmeidig und leicht aufgegangen sein. Drücken Sie die Oberfläche leicht mit einem Finger ein. Der Teig sollte langsam zurückfedern. Wenn er noch sehr fest ist und sofort in seine ursprüngliche Form zurückkehrt, lassen Sie ihn noch etwas bei Raumtemperatur stehen.', 'Check whether the dough is ready for shaping: the dough ball should be soft, pliable, and slightly puffed. Gently press the surface with a finger; the dough should slowly spring back. If it is still very firm and immediately returns to its original shape, leave it at room temperature for a little longer.', 'Preverite, ali je testo pripravljeno za oblikovanje: kroglica mora biti mehka, prožna in rahlo napihnjena. Površino rahlo pritisnite s prstom; testo se mora počasi vrniti nazaj. Če je še zelo čvrsto in se takoj vrne v prvotno obliko, ga pustite še nekaj časa na sobni temperaturi.'),
      ovenTimingInfo: oven === 'ooni'
        ? pick(`Der Pizzaofen benötigt ungefähr ${ovenPreheatMin}–${ovenPreheatMax} Minuten zum Aufheizen. Damit die Aufheizzeit mit dem Temperieren der Teigkugeln abgestimmt ist, schalten Sie den Pizzaofen ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} Minuten vor dem Herausnehmen der Teigkugeln aus dem Kühlschrank ein.`, `The pizza oven needs approximately ${ovenPreheatMin}–${ovenPreheatMax} minutes to heat up. To coordinate the heating time with the tempering of the dough balls, turn on the pizza oven ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minutes before taking the dough balls out of the refrigerator.`, `Pizza pečica potrebuje približno ${ovenPreheatMin}–${ovenPreheatMax} minut, da se segreje. Za uskladitev časa segrevanja s temperiranjem kroglic vklopite pizza pečico ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minut, preden kroglice vzamete iz hladilnika.`)
        : pick(`Der Ofen benötigt ungefähr ${ovenPreheatMin}–${ovenPreheatMax} Minuten zum Aufheizen. Damit die Aufheizzeit mit dem Temperieren der Teigkugeln abgestimmt ist, schalten Sie den Ofen ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} Minuten vor dem Herausnehmen der Teigkugeln aus dem Kühlschrank ein.`, `The oven needs approximately ${ovenPreheatMin}–${ovenPreheatMax} minutes to heat up. To coordinate the oven heating time with the tempering of the dough balls, turn on the oven ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minutes before taking the dough balls out of the refrigerator.`, `Pečica potrebuje približno ${ovenPreheatMin}–${ovenPreheatMax} minut, da se segreje. Za uskladitev časa segrevanja pečice s temperiranjem kroglic pečico vklopite ${Math.max(0, ovenPreheatMin - temperingMax)}–${Math.max(0, ovenPreheatMax - temperingMin)} minut, preden kroglice vzamete iz hladilnika.`),
      bakingInfo: oven === 'homeStone' ? pick('Platzieren Sie den Pizzastein oder Pizzastahl zwei Einschubebenen unterhalb des oberen Heizelements.', 'Place the pizza stone or steel two rack positions below the upper heating element.', 'Kamen ali jeklo za pico postavite dve rešetki pod zgornji grelni element.') : undefined,
      bakingCheckInfo: oven === 'homePan' ? pick('Heben Sie den Pizzarand an und prüfen Sie, ob der Boden ausreichend gebacken und goldbraun ist.', 'Lift the pizza rim and check whether the bottom is sufficiently baked and golden brown.', 'Dvignite rob pice in preverite, ali je dno dovolj pečeno in zlato-rjavo.') : undefined,
      steps: oven === 'homePan' ? [
        pick(`Nehmen Sie die Teigkugeln aus dem Kühlschrank und lassen Sie sie ${temperingMin}–${temperingMax} Minuten vor dem Formen temperieren. Achten Sie darauf, dass die Teigkugeln nicht überfermentieren.`, `Take the dough balls out of the refrigerator and let them temper for ${temperingMin}–${temperingMax} minutes before shaping. Make sure the dough balls do not over-ferment.`, `Kroglice vzemite iz hladilnika in jih pred oblikovanjem pustite ${temperingMin}–${temperingMax} minut temperirati. Pazite, da kroglice ne fermentirajo preveč.`),
        pick('Nehmen Sie die Teigkugel mit einer schnellen und vorsichtigen Bewegung aus dem Behälter und legen Sie sie mit der Oberseite nach unten auf die Semola.', 'Quickly and gently remove the dough ball from the container and place it upside down on the semolina.', 'Kroglico hitro in nežno vzemite iz posode ter jo položite obrnjeno na zdrob.'),
        pick('Fetten Sie das Backblech leicht ein.', 'Lightly oil the baking tray.', 'Pekač rahlo naoljite.'),
        pick(`Legen Sie den geformten Teig direkt auf das Backblech und ziehen Sie ihn auf den Zieldurchmesser von ${diameter} cm.`, `Place the shaped dough directly in the baking tray and stretch it to the target diameter of ${diameter} cm.`, `Oblikovano testo položite neposredno v pekač in ga raztegnite na ciljni premer ${diameter} cm.`),
        pick('Breiten Sie ihn vorsichtig mit den Fingern zu den Rändern aus. Drücken Sie nicht zu stark, damit Sie nicht die gesamte Luft herausdrücken.', 'Gently spread it toward the edges with your fingers. Do not press too hard so you do not push out all the air.', 'S prsti ga rahlo razširite proti robovom. Ne pritiskajte močno, da ne iztisnete vsega zraka.'),
        pick('Lassen Sie den Teig im Backblech kurz entspannen und sich an die Form anpassen, falls er sich zurückzieht.', 'Let the dough briefly relax and adjust to the shape of the tray if it springs back.', 'Če se testo vrača nazaj, ga v pekaču pustite kratek čas počivati, da se sprosti in prilagodi obliki.'),
        pick('Geben Sie die Sauce und den Belag darauf.', 'Add the sauce and toppings.', 'Dodajte omako in nadev.'),
        pick('Heizen Sie den Ofen gründlich auf die maximale Temperatur vor.', 'Preheat the oven thoroughly to its maximum temperature.', 'Pečico dobro segrejte na najvišjo temperaturo.'),
        pick('Wenn ein Pizza-Programm vorhanden ist, verwenden Sie es; wenn kein Pizza-Programm vorhanden ist, verwenden Sie Ober-/Unterhitze ohne Umluft.', 'If you have a Pizza program, use it; if you do not, use top and bottom heat without a fan.', 'Če imate program Pizza, ga uporabite; če ga nimate, uporabite zgornje in spodnje gretje brez ventilatorja.'),
        pick('Backen Sie ohne Grill, bis der Boden und der Rand gut durchgebacken sind.', 'Bake without the grill until the bottom and rim are well baked.', 'Pecite brez žara, dokler dno in rob nista dobro pečena.'),
        pick('Schalten Sie am Ende den Grill ein, wenn Sie die Oberseite stärker bräunen möchten.', 'Turn on the grill at the end if you want the top more deeply browned.', 'Na koncu vklopite žar, če želite močneje zapečeno zgornjo stran.'),
        pick('Nehmen Sie die Pizza aus dem Ofen und lassen Sie sie kurz ruhen, bevor Sie sie schneiden.', 'Remove the pizza from the oven and let it rest briefly before slicing.', 'Pico vzemite iz pečice in jo pred rezanjem pustite kratek čas počivati.'),
      ] : [
        ovenSteps[0],
        pick(`Nehmen Sie die Teigkugeln aus dem Kühlschrank und lassen Sie sie ${temperingMin}–${temperingMax} Minuten vor dem Formen temperieren. Achten Sie darauf, dass die Teigkugeln nicht überfermentieren.`, `Take the dough balls out of the refrigerator and let them temper for ${temperingMin}–${temperingMax} minutes before shaping. Make sure the dough balls do not over-ferment.`, `Kroglice vzemite iz hladilnika in jih pred oblikovanjem pustite ${temperingMin}–${temperingMax} minut temperirati. Pazite, da kroglice ne fermentirajo preveč.`),
        pick('Bestäuben Sie die Arbeitsfläche leicht mit einer minimalen Menge Semola.', 'Lightly dust the work surface with a minimal amount of semolina.', 'Delovno površino rahlo posujte z minimalno količino zdroba.'),
        pick('Nehmen Sie die Teigkugel mit einer schnellen und vorsichtigen Bewegung aus dem Behälter und legen Sie sie mit der Oberseite nach unten auf die Semola.', 'Quickly and gently remove the dough ball from the container and place it upside down on the semolina.', 'Kroglico hitro in nežno vzemite iz posode ter jo položite obrnjeno na zdrob.'),
        pick('Drücken Sie mit den Fingerspitzen die Luft von der Mitte in Richtung Rand. Verwenden Sie kein Nudelholz.', 'Using your fingertips, push the air from the center toward the edges. Do not use a rolling pin.', 'S konicami prstov potiskajte zrak iz sredine proti robovom. Ne uporabljajte valjarja.'),
        pick('Lassen Sie den Cornicione als optische Orientierung ungefähr 1–2 cm breit.', 'Leave approximately 1–2 cm of Cornicione as a visual guideline.', 'Rob Cornicione pustite približno 1–2 cm širok kot vizualno priporočilo.'),
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
  title, steps, phaseKey, timers: customTimers, bigaInfo, waterInfo, containerOilInfo, fermentationInfo, fermentationSignsInfo, degassingInfo, doughHandlingInfo, temperingInfo, proofingInfo, ovenTimingInfo, bakingCheckInfo, bakingInfo, infoTitleOverrides, completed, onToggle,
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
  bakingCheckInfo?: string;
  bakingInfo?: string;
  infoTitleOverrides?: Partial<Record<'handling' | 'room' | 'readiness' | 'baking', string>>;
  completed: Record<string, boolean>;
  onToggle: (key: string) => void;
  activeTimers: Record<string, { endsAt: number; label: string; notifId?: string | null }>;
  onStartTimer: (phaseKey: string, t: BaseTimer) => void;
  onStopTimer: (phaseKey: string, timerId: string) => void;
  lang: Lang;
}) {
  const timers = customTimers || PHASE_TIMER_DURATIONS[phaseKey] || [];
  const toppingInfo = {
    hr: 'Nadjev možeš staviti po želji, ali ga nemoj previše natovariti. Ostavi dovoljno ruba bez nadjeva kako bi se rub mogao lijepo podignuti i ispeći.',
    en: 'Choose toppings according to preference, but do not overload the pizza. Leave enough of the rim without toppings so that it can rise and bake properly.',
    de: 'Wählen Sie den Belag nach Wunsch, verwenden Sie jedoch nicht zu viel davon. Lassen Sie genügend Rand ohne Belag, damit er schön aufgehen und gleichmäßig backen kann.',
    sl: 'Nadev izberite po želji, vendar pice ne obložite preveč. Pustite dovolj roba brez nadeva, da se lahko lepo dvigne in enakomerno speče.',
  }[lang];
  const toppingTitle = { hr: 'Nadjev', en: 'Toppings', de: 'Belag', sl: 'Nadev' }[lang];
  const doughTemperatureInfo = {
    hr: 'Ako želite provjeriti konačnu temperaturu tijesta, idealno je između 23 °C i 25 °C. Mjerenje nije obavezno; tijesto treba biti glatko, elastično i homogeno.',
    en: 'If you want to check the final dough temperature, it should ideally be between 23 °C and 25 °C. Measuring is optional; the dough should be smooth, elastic, and homogeneous.',
    de: 'Wenn Sie die endgültige Teigtemperatur überprüfen möchten, sollte sie idealerweise zwischen 23 °C und 25 °C liegen. Das Messen ist optional; der Teig sollte glatt, elastisch und homogen sein.',
    sl: 'Če želite preveriti končno temperaturo testa, naj bo idealno med 23 °C in 25 °C. Merjenje ni obvezno; testo mora biti gladko, elastično in homogeno.',
  }[lang];
  const doughTemperatureTitle = { hr: 'Temperatura tijesta', en: 'Dough temperature', de: 'Teigtemperatur', sl: 'Temperatura testa' }[lang];
  const proofingTestInfo = {
    hr: 'Lagano pritisnite lopticu prstom. Ako se udubljenje polako vraća, spremna je za razvlačenje. Ako se odmah vrati, treba joj još vremena. Ako udubljenje ostane, loptica je prezrela i treba je odmah koristiti.',
    en: 'Gently press the dough ball with your finger. If the indentation slowly springs back, it is ready to stretch. If it springs back immediately, it needs more time. If the indentation remains, the dough ball is over-proofed and should be used immediately.',
    de: 'Drücken Sie die Teigkugel leicht mit dem Finger ein. Wenn die Vertiefung langsam zurückfedert, ist sie zum Ausformen bereit. Wenn sie sofort zurückfedert, braucht sie noch Zeit. Wenn die Vertiefung bleibt, ist die Teigkugel überfermentiert und sollte sofort verwendet werden.',
    sl: 'Kroglico rahlo pritisnite s prstom. Če se vdolbina počasi vrne, je pripravljena za raztezanje. Če se takoj vrne, potrebuje še nekaj časa. Če vdolbina ostane, je kroglica preveč fermentirana in jo je treba takoj uporabiti.',
  }[lang];
  const infoTitles = {
    biga: { hr: 'Postotak bige', en: 'Biga percentage', de: 'Biga-Anteil', sl: 'Odstotek bige' }[lang],
    proofing: { hr: 'Test prstom', en: 'Finger test', de: 'Fingertest', sl: 'Test s prstom' }[lang],
    water: { hr: 'Voda i led', en: 'Water and ice', de: 'Wasser und Eis', sl: 'Voda in led' }[lang],
    container: { hr: 'Ulje za posudu', en: 'Container oil', de: 'Öl für den Behälter', sl: 'Olje za posodo' }[lang],
    room: infoTitleOverrides?.room ?? ({ hr: 'Temperatura prostorije', en: 'Room temperature', de: 'Raumtemperatur', sl: 'Sobna temperatura' }[lang]),
    signs: { hr: 'Znakovi fermentacije', en: 'Fermentation signs', de: 'Fermentationszeichen', sl: 'Znaki fermentacije' }[lang],
    degassing: { hr: 'Degaziranje', en: 'Degassing', de: 'Entgasen', sl: 'Degaziranje' }[lang],
    baking: infoTitleOverrides?.baking ?? ({ hr: 'Položaj kamena ili čelika', en: 'Stone or steel position', de: 'Position von Stein oder Stahl', sl: 'Položaj kamna ali jekla' }[lang]),
    handling: infoTitleOverrides?.handling ?? ({ hr: 'Ljepljivo tijesto', en: 'Sticky dough', de: 'Klebriger Teig', sl: 'Lepljivo testo' }[lang]),
    tempering: { hr: 'Temperiranje', en: 'Tempering', de: 'Temperieren', sl: 'Temperiranje' }[lang],
    topping: toppingTitle,
    readiness: infoTitleOverrides?.readiness ?? ({ hr: 'Spremnost tijesta', en: 'Dough readiness', de: 'Teigreife', sl: 'Pripravljenost testa' }[lang]),
    ovenTiming: { hr: 'Usklađivanje vremena', en: 'Timing coordination', de: 'Zeitliche Abstimmung', sl: 'Časovna uskladitev' }[lang],
  };
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={styles.phaseTitle}>{title}</Text>
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
        const hasProofingInfo = /30[–-]60 minuta|30 do 60 minuta/i.test(s);
        const hasBigaInfo = !!bigaInfo && i === 0;
        const hasWaterInfo = !!waterInfo && /ukupno .*vode|total water|Wasser|skupno .*vode/i.test(s);
        const hasContainerOilInfo = !!containerOilInfo && (/nauljite fermentacijsku posudu|Stavite kugle u zatvorenu fermentacijsku kutiju|oil the fermentation container|Ölen Sie den Fermentationsbehälter|Fermentacijsko posodo rahlo/i.test(s));
        const hasFermentationInfo = !!fermentationInfo && /završni bulk|final bulk fermentation|abschließende Stockgare|Končno prvo fermentacijo|Lagano nauljite fermentacijsku posudu|Lightly oil the fermentation container|Ölen Sie den Fermentationsbehälter|Fermentacijsko posodo rahlo|Integralno tijesto|Whole wheat dough|Vollkornteig|Integralno testo|Prebacite tijesto u lagano nauljenu fermentacijsku posudu|Napravite prvi Stretch & Fold/i.test(s);
        const hasFermentationSignsInfo = !!fermentationSignsInfo && /Provjerite jesu li vidljivi|Check whether the first signs|Prüfen Sie, ob erste Anzeichen|Preverite, ali so vidni prvi znaki/i.test(s);
        const hasDegassingInfo = !!degassingInfo && /minimalno degaziranje|minimizing degassing|möglichst starkes Entgasen|čim manj iztisnite plin/i.test(s);
        const hasBakingInfo = !!bakingInfo && /Zagrijte kamen ili čelik|Zagrijte obrnuti lim|Zagrijte peć|Preheat the pizza stone|Heizen Sie den Pizzastein|Kamen ali jeklo za pico segrevajte|pecite prema odabranoj pećnici|peče u kućnoj pećnici/i.test(s);
        const hasDoughHandlingInfo = !!doughHandlingInfo && (i === 0 || /Nastavite mijesiti|Nastavite miješati|Continue kneading|Continue mixing|Kneten Sie weiter|Mischen Sie weiter|Nadaljujte z gnetenjem|Nadaljujte z mešanjem/i.test(s));
        const hasTemperingInfo = !!temperingInfo && /prijeđite na temperiranje|proceed to tempering|fahren Sie mit dem Temperieren|nadaljujte s temperiranjem|Stavite kugle u zatvorenu fermentacijsku kutiju|Place the dough balls in a closed fermentation box|Legen Sie die Teigkugeln in eine verschlossene Teigbox|Kroglice testa položite v zaprto/i.test(s);
        const hasDoughTemperatureInfo = /Zamjes je gotov|The dough is fully mixed|Der Teig ist fertig geknetet|Gnetenje je končano/i.test(s);
        const hasToppingInfo = /Dodajte nadjev|Add the toppings|Belegen Sie die Pizza|Dodajte nadev/i.test(s);
        const hasProofingReadinessInfo = !!proofingInfo && /Izvadite kugle iz hladnjaka|Take the dough balls out|Nehmen Sie die Teigkugeln|Kroglice vzemite iz hladilnika|Vrhovima prstiju vrlo nježno|Using your fingertips very gently|Mit den Fingerspitzen sehr sanft|S konicami prstov zelo nežno|Integralnog|Integralno|Whole wheat|Vollkorn|Ne oblikujte kugle za tondu|jednu masu od|Tepsiju .*obilno/i.test(s);
        const hasOvenTimingInfo = !!ovenTimingInfo && /Izvadite kugle iz hladnjaka|Take the dough balls out|Nehmen Sie die Teigkugeln|Kroglice vzemite iz hladilnika/i.test(s);
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
            <Text style={[styles.stepText, done && styles.stepTextDone]}>{s}</Text>
            </Pressable>
            {hasProofingInfo ? (
              <Pressable
                accessibilityLabel="Informacije o testu prstom"
                onPress={() => Alert.alert(infoTitles.proofing, proofingTestInfo)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasBigaInfo ? (
              <Pressable
                accessibilityLabel="Informacije o postotku bige"
                onPress={() => Alert.alert(infoTitles.biga, bigaInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasWaterInfo ? (
              <Pressable
                accessibilityLabel="Informacije o temperaturi vode i ledu"
                onPress={() => Alert.alert(infoTitles.water, waterInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasContainerOilInfo ? (
              <Pressable
                accessibilityLabel="Informacije o ulju za fermentacijsku posudu"
                onPress={() => Alert.alert(infoTitles.container, containerOilInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasFermentationInfo ? (
              <Pressable
                accessibilityLabel="Informacije o temperaturi prostorije i fermentaciji"
                onPress={() => Alert.alert(infoTitles.room, fermentationInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasFermentationSignsInfo ? (
              <Pressable
                accessibilityLabel="Informacije o znakovima fermentacije"
                onPress={() => Alert.alert(infoTitles.signs, fermentationSignsInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasDegassingInfo ? (
              <Pressable
                accessibilityLabel="Informacije o degaziranju"
                onPress={() => Alert.alert(infoTitles.degassing, degassingInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasBakingInfo ? (
              <Pressable
                accessibilityLabel="Informacije o položaju kamena ili čelika"
                onPress={() => Alert.alert(infoTitles.baking, bakingInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasDoughHandlingInfo ? (
              <Pressable
                accessibilityLabel="Informacije o ljepljivom tijestu"
                onPress={() => Alert.alert(infoTitles.handling, doughHandlingInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasTemperingInfo ? (
              <Pressable
                accessibilityLabel="Informacije o temperiranju"
                onPress={() => Alert.alert(infoTitles.tempering, temperingInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasDoughTemperatureInfo ? (
              <Pressable
                accessibilityLabel="Informacije o temperaturi tijesta"
                onPress={() => Alert.alert(doughTemperatureTitle, doughTemperatureInfo)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasToppingInfo ? (
              <Pressable
                accessibilityLabel="Informacije o nadjevu"
                onPress={() => Alert.alert(toppingTitle, toppingInfo)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasProofingReadinessInfo ? (
              <Pressable
                accessibilityLabel="Informacije o spremnosti tijesta za oblikovanje"
                onPress={() => Alert.alert(infoTitles.readiness, proofingInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasOvenTimingInfo ? (
              <Pressable
                accessibilityLabel="Informacije o vremenu zagrijavanja pećnice"
                onPress={() => Alert.alert(infoTitles.ovenTiming, ovenTimingInfo!)}
                hitSlop={8}
                style={styles.infoBtn}
              >
                <Icon name="information-circle-outline" size={19} color={COLORS.brand} />
              </Pressable>
            ) : null}
            {hasBakingCheckInfo ? (
              <Pressable
                accessibilityLabel="Informacije o provjeri pečenosti dna"
                onPress={() => Alert.alert(
                  { hr: 'Provjera pečenosti', en: 'Baking check', de: 'Backkontrolle', sl: 'Preverjanje pečenosti' }[lang],
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
        {t.school.rules.map((r, i) => (
          <View key={i} style={styles.ruleCard}>
            <Icon name="star" size={16} color={COLORS.brand} />
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

function ShoppingModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
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
    { key: 'flour', qty: `${recipe.flour} g`, name: `${ing.flour} (${recipe.flourType || '00'})` },
    { key: 'water', qty: `${recipe.water} g`, name: ing.water },
    { key: 'salt', qty: `${recipe.salt} g`, name: ing.salt },
    { key: 'yeast', qty: `${recipe.yeast} g`, name: ing.yeast },
    ...(recipe.oil > 0 ? [{ key: 'oil', qty: `${recipe.oil} g`, name: ing.oil }] : []),
    ...(recipe.sauce ? [{ key: 'sauce', qty: `${recipe.sauce} g`, name: ing.sauce }] : []),
    ...(recipe.cheese ? [{ key: 'cheese', qty: `${recipe.cheese} g`, name: ing.cheese }] : []),
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

  moreRow: { flexDirection: 'row', gap: SPACING.md, justifyContent: 'center', paddingVertical: SPACING.md },
  moreLink: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  moreLinkImg: { width: 22, height: 22 },
  moreLinkText: { color: COLORS.brand, fontSize: 13, fontWeight: '600' },

  modalRoot: { flex: 1, backgroundColor: COLORS.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.onSurface },
  ruleCard: { flexDirection: 'row', gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  ruleTitle: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface, marginBottom: 4 },
  ruleBody: { fontSize: 14, color: COLORS.onSurfaceTertiary, lineHeight: 20 },
  copyBtn: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brand, paddingVertical: 14, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  copyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  checkRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  checkLabel: { flex: 1, color: COLORS.onSurface, fontSize: 14 },
  checkQty: { color: COLORS.brand, fontSize: 14, fontWeight: '700' },
});
