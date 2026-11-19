import type { Lang } from './translations';

export type ProKamadoPizzaStyle = 'neapolitan' | 'romana' | 'ny_style';

export type ProKamadoGuidance = {
  preheat: string;
  bake: string;
};

const COPY: Record<Lang, Record<ProKamadoPizzaStyle, ProKamadoGuidance>> = {
  hr: {
    neapolitan: {
      preheat: 'Kamen za pizzu postavite iznad deflektora prema uputama proizvođača. Postupno zagrijavajte Kamado sa zatvorenim poklopcem dok se peć ne stabilizira, a zatim pričekajte da se zagrije i kamen; termometar poklopca ne mora pokazivati temperaturu kamena.',
      bake: 'Trajanje pečenja ovisi o stvarnoj temperaturi kamena i peći. Pratite boju dna i ruba pizze te je po potrebi okrećite; izvadite je kada su dno i rub pečeni prema željenom izgledu.',
    },
    romana: {
      preheat: 'Kamen za pizzu postavite iznad deflektora prema uputama proizvođača. Postupno zagrijavajte Kamado sa zatvorenim poklopcem dok se peć i kamen ne stabiliziraju; temperatura poklopca ne mora odgovarati temperaturi kamena.',
      bake: 'Trajanje pečenja Romane ovisi o stvarnoj temperaturi kamena i peći. Pratite ravnomjernu boju dna i tankog ruba te po potrebi okrenite pizzu kako bi se ispekla ujednačeno.',
    },
    ny_style: {
      preheat: 'Kamen za pizzu postavite iznad deflektora prema uputama proizvođača. Postupno zagrijavajte Kamado sa zatvorenim poklopcem dok se peć i kamen ne stabiliziraju; temperatura poklopca ne mora odgovarati temperaturi kamena.',
      bake: 'Trajanje pečenja New York pizze ovisi o stvarnoj temperaturi kamena i peći. Pratite boju dna, sredine i izraženog ruba te po potrebi okrenite pizzu radi ravnomjernog pečenja.',
    },
  },
  en: {
    neapolitan: {
      preheat: 'Position the pizza stone above the deflector according to the manufacturer’s instructions. Gradually heat the Kamado with the lid closed until the cooker stabilizes, then allow the stone to heat through; the lid thermometer may not match the stone temperature.',
      bake: 'Bake duration depends on the actual temperature of the stone and cooker. Watch the pizza’s bottom and rim color and rotate it as needed; remove it when the base and rim are baked to the desired appearance.',
    },
    romana: {
      preheat: 'Position the pizza stone above the deflector according to the manufacturer’s instructions. Gradually heat the Kamado with the lid closed until the cooker and stone stabilize; the lid temperature may differ from the stone temperature.',
      bake: 'Romana baking duration depends on the actual temperature of the stone and cooker. Watch for even color on the base and thin edge, and rotate the pizza if needed for even baking.',
    },
    ny_style: {
      preheat: 'Position the pizza stone above the deflector according to the manufacturer’s instructions. Gradually heat the Kamado with the lid closed until the cooker and stone stabilize; the lid temperature may differ from the stone temperature.',
      bake: 'New York pizza baking duration depends on the actual temperature of the stone and cooker. Watch the base, center, and raised rim, and rotate the pizza as needed for even baking.',
    },
  },
  de: {
    neapolitan: {
      preheat: 'Setzen Sie den Pizzastein gemäß Herstelleranleitung über den Deflektor. Heizen Sie den Kamado bei geschlossenem Deckel langsam auf, bis sich der Grill stabilisiert hat, und lassen Sie anschließend auch den Stein durchheizen; die Deckeltemperatur kann von der Steintemperatur abweichen.',
      bake: 'Die Backdauer hängt von der tatsächlichen Temperatur des Steins und des Grills ab. Beobachten Sie die Bräunung von Boden und Rand und drehen Sie die Pizza bei Bedarf; nehmen Sie sie heraus, wenn Boden und Rand wie gewünscht gebacken sind.',
    },
    romana: {
      preheat: 'Setzen Sie den Pizzastein gemäß Herstelleranleitung über den Deflektor. Heizen Sie den Kamado bei geschlossenem Deckel langsam auf, bis Grill und Stein stabil aufgeheizt sind; die Deckeltemperatur kann von der Steintemperatur abweichen.',
      bake: 'Die Backdauer der Romana hängt von der tatsächlichen Temperatur des Steins und des Grills ab. Achten Sie auf eine gleichmäßige Bräunung des Bodens und des dünnen Randes und drehen Sie die Pizza bei Bedarf.',
    },
    ny_style: {
      preheat: 'Setzen Sie den Pizzastein gemäß Herstelleranleitung über den Deflektor. Heizen Sie den Kamado bei geschlossenem Deckel langsam auf, bis Grill und Stein stabil aufgeheizt sind; die Deckeltemperatur kann von der Steintemperatur abweichen.',
      bake: 'Die Backdauer der New-York-Pizza hängt von der tatsächlichen Temperatur des Steins und des Grills ab. Beobachten Sie Boden, Mitte und den ausgeprägten Rand und drehen Sie die Pizza bei Bedarf für gleichmäßiges Backen.',
    },
  },
  sl: {
    neapolitan: {
      preheat: 'Kamen za pico namestite nad deflektor po navodilih proizvajalca. Kamado postopoma segrevajte z zaprtim pokrovom, dokler se peč ne stabilizira, nato naj se segreje še kamen; temperatura na pokrovu se lahko razlikuje od temperature kamna.',
      bake: 'Trajanje peke je odvisno od dejanske temperature kamna in peči. Spremljajte barvo dna in roba ter pico po potrebi obrnite; vzemite jo iz peči, ko sta dno in rob pečena do želene barve.',
    },
    romana: {
      preheat: 'Kamen za pico namestite nad deflektor po navodilih proizvajalca. Kamado postopoma segrevajte z zaprtim pokrovom, dokler se peč in kamen ne stabilizirata; temperatura na pokrovu se lahko razlikuje od temperature kamna.',
      bake: 'Trajanje peke Romane je odvisno od dejanske temperature kamna in peči. Spremljajte enakomerno zapečenost dna in tankega roba ter pico po potrebi obrnite.',
    },
    ny_style: {
      preheat: 'Kamen za pico namestite nad deflektor po navodilih proizvajalca. Kamado postopoma segrevajte z zaprtim pokrovom, dokler se peč in kamen ne stabilizirata; temperatura na pokrovu se lahko razlikuje od temperature kamna.',
      bake: 'Trajanje peke New York pice je odvisno od dejanske temperature kamna in peči. Spremljajte dno, sredino in izrazit rob ter pico po potrebi obrnite za enakomerno peko.',
    },
  },
};

export function getProKamadoGuidance(lang: Lang, style: ProKamadoPizzaStyle): ProKamadoGuidance {
  return COPY[lang][style];
}
