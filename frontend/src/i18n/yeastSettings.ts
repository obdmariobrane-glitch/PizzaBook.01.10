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
  bigaBudgetSummary: string;
  bigaBudgetWarning: string;
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
    quantity: 'Idealna količina kvasca',
    manualQuantity: 'Ručno uneseni kvasac (g)',
    bigaBudgetSummary: 'Ukupni budžet: {BUDGET} g · Biga: {BIGA} g · završni zamjes: {FINAL} g',
    bigaBudgetWarning: 'Informacija: Biga zahtijeva {REQUIRED} g, a u Bigu ide {BIGA} g. Razlika prema ukupnom Direct budžetu iznosi {EXCESS} g, ali ne smanjuje količinu Bige. Završnom zamjesu dodaje se {FINAL} g. Ako je Biga osigurala svu potrebnu količinu, završni zamjes dobiva 0 g.',
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
    quantity: 'Ideal yeast quantity',
    manualQuantity: 'Manual yeast quantity (g)',
    bigaBudgetSummary: 'Total budget: {BUDGET} g · Biga: {BIGA} g · final dough: {FINAL} g',
    bigaBudgetWarning: 'Information: Biga requires {REQUIRED} g, and {BIGA} g goes into the Biga. The difference from the total Direct budget is {EXCESS} g, but it does not reduce the Biga quantity. The final dough receives an additional {FINAL} g. If the Biga already provides the full required amount, the final dough receives 0 g.',
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
    quantity: 'Ideale Hefemenge',
    manualQuantity: 'Manuelle Hefemenge (g)',
    bigaBudgetSummary: 'Gesamtbudget: {BUDGET} g · Biga: {BIGA} g · Hauptteig: {FINAL} g',
    bigaBudgetWarning: 'Information: Die Biga benötigt {REQUIRED} g, und {BIGA} g kommen in die Biga. Die Differenz zum gesamten Direct-Budget beträgt {EXCESS} g, reduziert aber nicht die Biga-Menge. Der Hauptteig erhält zusätzlich {FINAL} g. Wenn die Biga bereits die gesamte benötigte Menge liefert, erhält der Hauptteig 0 g.',
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
    quantity: 'Idealna količina kvasa',
    manualQuantity: 'Ročno vnesena količina kvasa (g)',
    bigaBudgetSummary: 'Skupni proračun: {BUDGET} g · Biga: {BIGA} g · končno testo: {FINAL} g',
    bigaBudgetWarning: 'Informacija: biga potrebuje {REQUIRED} g, v bigo pa gre {BIGA} g. Razlika glede na skupni Direct proračun je {EXCESS} g, vendar ne zmanjša količine bige. Končno testo prejme dodatnih {FINAL} g. Če biga že zagotovi celotno potrebno količino, končno testo prejme 0 g.',
    errors: {
      empty: 'Vnesite količino kvasa.',
      invalid: 'Vnesite veljavno količino kvasa v gramih.',
      zero: 'Količina kvasa mora biti večja od nič.',
      negative: 'Količina kvasa ne sme biti negativna.',
      unreasonable: 'Količina kvasa je lahko največ 10 % moke.',
    },
  },
};
