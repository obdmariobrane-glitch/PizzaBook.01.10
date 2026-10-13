import type { Lang } from './translations';
import type { PreferredYeastType } from '../preferences';

export type SpiralMixingContext = {
  method: 'direct' | 'biga' | 'poolish';
  hasOil: boolean;
  directStyle?: 'napolitana' | 'romanaTonda' | 'romanaTeglia' | 'newYork';
  directInitialWaterGrams?: number;
  directInitialWaterPct?: 80 | 90;
};

export function getSpiralMixingTitle(lang: Lang, method: SpiralMixingContext['method']): string {
  const copy = {
    hr: {
      direct: 'Faza A: Priprema i zamjes spiralnim mikserom',
      biga: 'Faza B: Završni zamjes spiralnim mikserom',
      poolish: 'Faza B: Dodavanje Poolisha i zamjes spiralnim mikserom',
    },
    en: {
      direct: 'Phase A: Preparation and spiral mixing',
      biga: 'Phase B: Final spiral mix',
      poolish: 'Phase B: Adding the Poolish and spiral mixing',
    },
    de: {
      direct: 'Phase A: Vorbereitung und Kneten im Spiralkneter',
      biga: 'Phase B: Hauptteig im Spiralkneter kneten',
      poolish: 'Phase B: Poolish zugeben und im Spiralkneter kneten',
    },
    sl: {
      direct: 'Faza A: Priprava in gnetenje s spiralnim mešalnikom',
      biga: 'Faza B: Končno gnetenje s spiralnim mešalnikom',
      poolish: 'Faza B: Dodajanje Poolisha in gnetenje s spiralnim mešalnikom',
    },
  }[lang];
  return copy[method];
}

export function getSpiralMixingSteps(
  lang: Lang,
  yeastType: PreferredYeastType,
  context: SpiralMixingContext,
): string[] {
  const hrDirectYeastWaterStep = context.method === 'direct' && typeof context.directInitialWaterGrams === 'number' && typeof context.directInitialWaterPct === 'number'
    ? `U približno ${context.directInitialWaterPct}% vode, odnosno ${context.directInitialWaterGrams} g, otopite kvasac.`
    : null;

  const text = {
    hr: {
      bowl: context.method === 'direct'
        ? 'U posudu spiralnog miksera stavite brašno.'
        : `U posudu spiralnog miksera stavite zrelu ${context.method === 'biga' ? 'Bigu' : 'Poolish'}, zatim preostalo brašno.`,
      yeast: context.method === 'direct' && hrDirectYeastWaterStep
        ? hrDirectYeastWaterStep
        : yeastType === 'fresh'
          ? 'Upotrijebite količinu svježeg kvasca navedenu u sastojcima; ravnomjerno ga izmrvite po brašnu ili otopite u manjem dijelu izmjerene vode.'
        : yeastType === 'activeDry'
          ? 'Upotrijebite količinu aktivnog suhog kvasca navedenu u sastojcima i pripremite ga prema uputama na pakiranju u dijelu izmjerene vode; tu vodu uračunajte u ukupnu količinu.'
          : 'Upotrijebite količinu instant suhog kvasca navedenu u sastojcima i ravnomjerno ga umiješajte u brašno.',
      water: 'Odvojite dio izmjerene vode, a ostatak dodajte brašnu i sastojcima u posudi.',
      mix: 'Pokrenite mikser prema uputama proizvođača. Brzina i trajanje ovise o konkretnom mikseru.',
      addWater: 'Kad se tijesto počne povezivati i upijati vodu, postupno dodajte sačuvanu vodu.',
      salt: 'Kad se brašno navlaži i tijesto počne povezivati, dodajte sol.',
      oil: 'Ako recept sadrži ulje, dodajte ga pri kraju i pričekajte da ga tijesto upije.',
      finish: 'Za brzinu i trajanje zamjesa slijedite priručnik konkretnog miksera; ne postoji jedna postavka koja vrijedi za sve modele.',
    },
    en: {
      bowl: context.method === 'direct'
        ? 'Place the flour in the spiral mixer bowl.'
        : `Place the mature ${context.method === 'biga' ? 'Biga' : 'Poolish'} and then the remaining flour in the spiral mixer bowl.`,
      yeast: yeastType === 'fresh'
        ? 'Use the fresh-yeast amount shown in the ingredients; crumble it evenly through the flour or dissolve it in a small part of the measured water.'
        : yeastType === 'activeDry'
          ? 'Use the active-dry-yeast amount shown in the ingredients and prepare it in part of the measured water according to the package directions; count that water toward the total.'
          : 'Use the instant-dry-yeast amount shown in the ingredients and mix it evenly into the flour.',
      water: 'Set aside part of the measured water; add the rest to the flour and ingredients in the bowl.',
      mix: 'Start the mixer according to its manufacturer instructions. Speed and mixing time depend on the specific mixer.',
      addWater: 'As the dough starts to come together and absorb water, add the reserved water gradually.',
      salt: 'Once the flour is hydrated and the dough begins to come together, add the salt.',
      oil: 'If the recipe contains oil, add it near the end and let the dough absorb it.',
      finish: 'Follow the specific mixer manual for speed and mixing time; there is no single setting that applies to every model.',
    },
    de: {
      bowl: context.method === 'direct'
        ? 'Geben Sie das Mehl in die Schüssel des Spiralkneters.'
        : `Geben Sie den reifen ${context.method === 'biga' ? 'Biga' : 'Poolish'} und anschließend das restliche Mehl in die Schüssel des Spiralkneters.`,
      yeast: yeastType === 'fresh'
        ? 'Die in den Zutaten angegebene Frischhefemenge verwenden; gleichmäßig über das Mehl bröseln oder in einem kleinen Teil des abgemessenen Wassers auflösen.'
        : yeastType === 'activeDry'
          ? 'Die in den Zutaten angegebene Aktiv-Trockenhefemenge verwenden und nach Packungsanleitung in einem Teil des abgemessenen Wassers vorbereiten; dieses Wasser zur Gesamtmenge zählen.'
          : 'Die in den Zutaten angegebene Instant-Trockenhefemenge verwenden und gleichmäßig unter das Mehl mischen.',
      water: 'Einen Teil des abgemessenen Wassers zurückhalten; den Rest zu Mehl und Zutaten in der Schüssel geben.',
      mix: 'Den Kneter nach Herstellerangaben starten. Geschwindigkeit und Knetdauer hängen vom jeweiligen Gerät ab.',
      addWater: 'Sobald sich der Teig verbindet und Wasser aufnimmt, das zurückgehaltene Wasser nach und nach zugeben.',
      salt: 'Sobald das Mehl befeuchtet ist und der Teig beginnt, sich zu verbinden, das Salz zugeben.',
      oil: 'Wenn das Rezept Öl enthält, dieses gegen Ende zugeben und vom Teig aufnehmen lassen.',
      finish: 'Geschwindigkeit und Knetdauer gemäß der Anleitung des jeweiligen Kneters einstellen; eine universelle Einstellung gibt es nicht.',
    },
    sl: {
      bowl: context.method === 'direct'
        ? 'Moko dajte v posodo spiralnega mešalnika.'
        : `Zreli ${context.method === 'biga' ? 'bigi' : 'Poolishu'} dodajte preostalo moko v posodo spiralnega mešalnika.`,
      yeast: yeastType === 'fresh'
        ? 'Uporabite količino svežega kvasa iz sestavin; enakomerno ga nadrobite po moki ali raztopite v manjšem delu odmerjene vode.'
        : yeastType === 'activeDry'
          ? 'Uporabite količino aktivnega suhega kvasa iz sestavin in ga pripravite v delu odmerjene vode po navodilih na embalaži; to vodo vštejte v skupno količino.'
          : 'Uporabite količino instant suhega kvasa iz sestavin in ga enakomerno vmešajte v moko.',
      water: 'Del odmerjene vode prihranite; preostanek dodajte moki in sestavinam v posodi.',
      mix: 'Mešalnik zaženite po navodilih proizvajalca. Hitrost in čas gnetenja sta odvisna od konkretnega mešalnika.',
      addWater: 'Ko se testo začne povezovati in vpijati vodo, postopoma dodajte prihranjeno vodo.',
      salt: 'Ko se moka navlaži in se testo začne povezovati, dodajte sol.',
      oil: 'Če recept vsebuje olje, ga dodajte proti koncu in počakajte, da ga testo vpije.',
      finish: 'Hitrost in čas gnetenja določite po navodilih konkretnega mešalnika; enaka nastavitev ne velja za vse modele.',
    },
  }[lang];

  return [
    text.bowl,
    text.yeast,
    text.water,
    text.mix,
    text.addWater,
    text.salt,
    ...(context.hasOil ? [text.oil] : []),
    text.finish,
  ];
}

export function getSpiralPlannerNote(lang: Lang): string {
  return ({
    hr: 'Spiralni mikser: vodu dodaj postupno nakon početnog povezivanja; sol dodaj kad se brašno navlaži, a ulje pred kraj samo ako ga recept sadrži. Brzinu i trajanje odredi prema priručniku miksera.',
    en: 'Spiral mixer: add water gradually after the initial mix comes together; add salt once the flour is hydrated, and oil near the end only if the recipe includes it. Follow the mixer manual for speed and duration.',
    de: 'Spiralkneter: Wasser nach dem ersten Verbinden nach und nach zugeben; Salz nach dem Befeuchten des Mehls und Öl gegen Ende nur dann, wenn es im Rezept steht. Geschwindigkeit und Dauer gemäß Geräteanleitung wählen.',
    sl: 'Spiralni mešalnik: vodo postopoma dodajajte, ko se zmes začne povezovati; sol dodajte, ko je moka navlažena, olje pa proti koncu le, če ga recept vsebuje. Hitrost in čas določite po navodilih mešalnika.',
  }[lang]);
}
