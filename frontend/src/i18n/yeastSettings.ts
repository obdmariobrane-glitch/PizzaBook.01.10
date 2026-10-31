import type { Lang } from './translations';

export type YeastSettingError = 'empty' | 'invalid' | 'zero' | 'negative' | 'unreasonable';

export const YEAST_SETTINGS_COPY: Record<Lang, {
  title: string;
  mode: string;
  automatic: string;
  manual: string;
  type: string;
  fresh: string;
  activeDry: string;
  instantDry: string;
  quantity: string;
  manualQuantity: string;
  percentage: string;
  automaticHelp: string;
  conversionHelp: string;
  spongeHelp: string;
  errors: Record<YeastSettingError, string>;
}> = {
  hr: {
    title: 'Postavke kvasca',
    mode: 'Izračun kvasca',
    automatic: 'Automatski',
    manual: 'Ručno',
    type: 'Vrsta kvasca',
    fresh: 'Svježi kvasac',
    activeDry: 'Aktivni suhi kvasac',
    instantDry: 'Instant suhi kvasac',
    quantity: 'Količina kvasca',
    manualQuantity: 'Ručno uneseni kvasac (g)',
    percentage: 'Postotak pekara',
    automaticHelp: 'Automatska količina koristi postojeći izračun fermentacije za odabranu metodu.',
    conversionHelp: 'Automatski izračun pretvara svježi kvasac u suhu vrstu faktorom 0,40 (aktivni) ili 0,33 (instant). Ručni unos je točna količina odabrane vrste kvasca.',
    spongeHelp: 'Ova količina ide u Sponge; kvasac za završno tijesto prikazan je zasebno.',
    errors: {
      empty: 'Unesite količinu kvasca.',
      invalid: 'Unesite valjanu količinu kvasca u gramima.',
      zero: 'Količina kvasca mora biti veća od nule.',
      negative: 'Količina kvasca ne može biti negativna.',
      unreasonable: 'Količina kvasca mora biti najviše 10% brašna.',
    },
  },
  en: {
    title: 'Yeast settings',
    mode: 'Yeast calculation',
    automatic: 'Automatic',
    manual: 'Manual',
    type: 'Yeast type',
    fresh: 'Fresh yeast',
    activeDry: 'Active dry yeast',
    instantDry: 'Instant dry yeast',
    quantity: 'Yeast quantity',
    manualQuantity: 'Manual yeast quantity (g)',
    percentage: "Baker's percentage",
    automaticHelp: 'Automatic quantity uses the existing fermentation calculation for the selected method.',
    conversionHelp: 'Automatic calculation converts fresh yeast to dry yeast using 0.40 (active dry) or 0.33 (instant). Manual entry is the exact quantity of the selected yeast type.',
    spongeHelp: 'This quantity goes into the Sponge; final-dough yeast is shown separately.',
    errors: {
      empty: 'Enter the yeast quantity.',
      invalid: 'Enter a valid yeast quantity in grams.',
      zero: 'Yeast quantity must be greater than zero.',
      negative: 'Yeast quantity cannot be negative.',
      unreasonable: 'Yeast quantity must be no more than 10% of flour.',
    },
  },
  de: {
    title: 'Hefe-Einstellungen',
    mode: 'Hefeberechnung',
    automatic: 'Automatisch',
    manual: 'Manuell',
    type: 'Hefeart',
    fresh: 'Frischhefe',
    activeDry: 'Aktiv-Trockenhefe',
    instantDry: 'Instant-Trockenhefe',
    quantity: 'Hefemenge',
    manualQuantity: 'Manuelle Hefemenge (g)',
    percentage: 'Bäckerprozentsatz',
    automaticHelp: 'Die automatische Menge verwendet die vorhandene Gärungsberechnung der ausgewählten Methode.',
    conversionHelp: 'Die automatische Berechnung rechnet Frischhefe mit dem Faktor 0,40 (aktiv) oder 0,33 (Instant) in Trockenhefe um. Die manuelle Eingabe ist die genaue Menge der ausgewählten Hefeart.',
    spongeHelp: 'Diese Menge kommt in den Sponge; die Hefe für den Hauptteig wird separat angezeigt.',
    errors: {
      empty: 'Geben Sie die Hefemenge ein.',
      invalid: 'Geben Sie eine gültige Hefemenge in Gramm ein.',
      zero: 'Die Hefemenge muss größer als null sein.',
      negative: 'Die Hefemenge darf nicht negativ sein.',
      unreasonable: 'Die Hefemenge darf höchstens 10 % des Mehls betragen.',
    },
  },
  sl: {
    title: 'Nastavitve kvasa',
    mode: 'Izračun kvasa',
    automatic: 'Samodejno',
    manual: 'Ročno',
    type: 'Vrsta kvasa',
    fresh: 'Sveži kvas',
    activeDry: 'Aktivni suhi kvas',
    instantDry: 'Instant suhi kvas',
    quantity: 'Količina kvasa',
    manualQuantity: 'Ročno vnesena količina kvasa (g)',
    percentage: 'Pekovski odstotek',
    automaticHelp: 'Samodejna količina uporablja obstoječi izračun fermentacije za izbrano metodo.',
    conversionHelp: 'Samodejni izračun pretvori sveži kvas v suhi kvas s faktorjem 0,40 (aktivni) ali 0,33 (instant). Ročni vnos je natančna količina izbrane vrste kvasa.',
    spongeHelp: 'Ta količina gre v Sponge; kvas za končno testo je prikazan ločeno.',
    errors: {
      empty: 'Vnesite količino kvasa.',
      invalid: 'Vnesite veljavno količino kvasa v gramih.',
      zero: 'Količina kvasa mora biti večja od nič.',
      negative: 'Količina kvasa ne sme biti negativna.',
      unreasonable: 'Količina kvasa je lahko največ 10 % moke.',
    },
  },
};
