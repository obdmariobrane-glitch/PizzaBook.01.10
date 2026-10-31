export type EnergyType = 'electricity' | 'naturalGas' | 'lpg';

export type ReferenceEnergyPrice = {
  amount: number;
  currency: string;
  source: string;
  date: string;
};

export type EnergyCountry = {
  code: string;
  currency: string | null;
};

const countryCurrencyGroups: Record<string, string> = {
  EUR: 'AD AT AX BE BG BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MT MQ NL PM PT RE SI SK SM TF VA XK YT',
  USD: 'AS EC FM GU IO MH MP PR PW SV TC TL UM US VG VI',
  XOF: 'BJ BF CI GW ML NE SN TG',
  XAF: 'CF CG CM GA GQ TD',
  XCD: 'AI AG DM GD KN LC MS VC',
  XPF: 'NC PF WF',
  AUD: 'AU CC CX HM KI NF NR TV',
  GBP: 'GB GS',
  CHF: 'CH LI',
  NZD: 'CK NZ NU PN TK',
  CAD: 'CA',
  JPY: 'JP',
  CNY: 'CN',
  INR: 'IN',
  RUB: 'RU',
  BRL: 'BR',
  KRW: 'KR',
  MXN: 'MX',
  IDR: 'ID',
  SAR: 'SA',
  TRY: 'TR',
  ZAR: 'ZA',
  SEK: 'SE',
  NOK: 'BV NO SJ',
  DKK: 'DK FO GL',
  PLN: 'PL',
  CZK: 'CZ',
  HUF: 'HU',
  RON: 'RO',
  ISK: 'IS',
  UAH: 'UA',
  GEL: 'GE',
  TWD: 'TW',
  SGD: 'SG',
  HKD: 'HK',
  THB: 'TH',
  VND: 'VN',
  PHP: 'PH',
  MYR: 'MY',
  PKR: 'PK',
  BDT: 'BD',
  LKR: 'LK',
  NPR: 'NP',
  AFN: 'AF',
  IRR: 'IR',
  IQD: 'IQ',
  ILS: 'IL PS',
  AED: 'AE',
  QAR: 'QA',
  KWD: 'KW',
  BHD: 'BH',
  OMR: 'OM',
  JOD: 'JO',
  EGP: 'EG',
  MAD: 'EH MA',
  DZD: 'DZ',
  TND: 'TN',
  LYD: 'LY',
  ETB: 'ET',
  KES: 'KE',
  UGX: 'UG',
  TZS: 'TZ',
  GHS: 'GH',
  NGN: 'NG',
  CDF: 'CD',
  AOA: 'AO',
  MZN: 'MZ',
  ZMW: 'ZM',
  BWP: 'BW',
  NAD: 'NA',
  SZL: 'SZ',
  LSL: 'LS',
  MWK: 'MW',
  MUR: 'MU',
  SCR: 'SC',
  RWF: 'RW',
  BIF: 'BI',
  SOS: 'SO',
  DJF: 'DJ',
  ERN: 'ER',
  SDG: 'SD',
  SSP: 'SS',
  MRU: 'MR',
  GMD: 'GM',
  SLE: 'SL',
  LRD: 'LR',
  GNF: 'GN',
  CVE: 'CV',
  STN: 'ST',
  KMF: 'KM',
  MGA: 'MG',
  ARS: 'AR',
  CLP: 'CL',
  COP: 'CO',
  PEN: 'PE',
  BOB: 'BO',
  PYG: 'PY',
  UYU: 'UY',
  VES: 'VE',
  GYD: 'GY',
  SRD: 'SR',
  JMD: 'JM',
  TTD: 'TT',
  BBD: 'BB',
  BSD: 'BS',
  BZD: 'BZ',
  DOP: 'DO',
  HTG: 'HT',
  CUP: 'CU',
  CRC: 'CR',
  GTQ: 'GT',
  HNL: 'HN',
  NIO: 'NI',
  PAB: 'PA',
  FJD: 'FJ',
  PGK: 'PG',
  SBD: 'SB',
  VUV: 'VU',
  WST: 'WS',
  TOP: 'TO',
  BTN: 'BT',
  MVR: 'MV',
  KZT: 'KZ',
  UZS: 'UZ',
  TJS: 'TJ',
  KGS: 'KG',
  TMT: 'TM',
  AZN: 'AZ',
  AMD: 'AM',
  MNT: 'MN',
  LAK: 'LA',
  KHR: 'KH',
  MMK: 'MM',
  BND: 'BN',
  KPW: 'KP',
  YER: 'YE',
  SYP: 'SY',
  LBP: 'LB',
  MOP: 'MO',
  MDL: 'MD',
  BYN: 'BY',
  ALL: 'AL',
  BAM: 'BA',
  MKD: 'MK',
  RSD: 'RS',
  IMP: 'IM',
  JEP: 'JE',
  GGP: 'GG',
  SHP: 'SH',
  FKP: 'FK',
  GIP: 'GI',
  AWG: 'AW',
  XCG: 'BQ CW SX',
  BMD: 'BM',
  KYD: 'KY',
  CUC: 'CU',
  ZWG: 'ZW',
};

const currencyByCountry = new Map<string, string>();
for (const [currency, countryCodes] of Object.entries(countryCurrencyGroups)) {
  for (const code of countryCodes.split(' ')) {
    if (!currencyByCountry.has(code)) currencyByCountry.set(code, currency);
  }
}

const countryCodes = (
  'AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW XK'
    .split(' ')
);

export const ENERGY_COUNTRIES: readonly EnergyCountry[] = countryCodes.map((code) => ({
  code,
  currency: currencyByCountry.get(code) ?? null,
}));

export const PRIORITY_ENERGY_COUNTRIES = ['AT', 'DE', 'HR', 'SI'] as const;

export function isEnergyCountryCode(value: unknown): value is string {
  return typeof value === 'string' && ENERGY_COUNTRIES.some((country) => country.code === value);
}

export function getEnergyCountryLabel(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function getCountriesForEnergyPicker(locale: string): EnergyCountry[] {
  const priority = PRIORITY_ENERGY_COUNTRIES.map((code) =>
    ENERGY_COUNTRIES.find((country) => country.code === code)!);
  const priorityCodes = new Set(PRIORITY_ENERGY_COUNTRIES);
  const remaining = ENERGY_COUNTRIES
    .filter((country) => !priorityCodes.has(country.code as (typeof PRIORITY_ENERGY_COUNTRIES)[number]))
    .sort((a, b) => getEnergyCountryLabel(a.code, locale).localeCompare(getEnergyCountryLabel(b.code, locale), locale));
  return [...priority, ...remaining];
}

export function getEnergyCurrency(countryCode: string): string | null {
  return ENERGY_COUNTRIES.find((country) => country.code === countryCode)?.currency ?? null;
}

export function getReferenceEnergyPrice(
  _countryCode: string,
  _energyType: EnergyType,
): ReferenceEnergyPrice | null {
  return null;
}
