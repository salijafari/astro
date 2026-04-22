// Bilingual astrology glossary for Akhtar
// Persian names use traditional Arabic-derived astrological terms — NOT solar month names

export const ZODIAC_EN_TO_FA: Record<string, string> = {
  Aries: "حمل",
  Taurus: "ثور",
  Gemini: "جوزا",
  Cancer: "سرطان",
  Leo: "اسد",
  Virgo: "سنبله",
  Libra: "میزان",
  Scorpio: "عقرب",
  Sagittarius: "قوس",
  Capricorn: "جدی",
  Aquarius: "دلو",
  Pisces: "حوت",
  Unknown: "—",
};

export const PLANET_EN_TO_FA: Record<string, string> = {
  Sun: "خورشید",
  Moon: "ماه",
  Mercury: "عطارد",
  Venus: "زهره",
  Mars: "مریخ",
  Jupiter: "مشتری",
  Saturn: "زحل",
  Uranus: "اورانوس",
  Neptune: "نپتون",
  "North Node": "رأس",
};

export const ASPECT_EN_TO_FA: Record<string, string> = {
  conjunction: "مقارنه",
  opposition: "مقابله",
  square: "تربیع",
  trine: "تثلیث",
  sextile: "تسدیس",
};

export const ANGLE_EN_TO_FA: Record<string, string> = {
  Ascendant: "طالع",
  Midheaven: "وسط‌السماء",
  Descendant: "غروب",
  IC: "قعر السماء",
};

export const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  "North Node": "☊",
};

export const SIGN_RULER: Record<string, string> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

export function localizeSign(sign: string, lang: "en" | "fa"): string {
  if (lang === "fa") return ZODIAC_EN_TO_FA[sign] ?? sign;
  return sign;
}

export function localizePlanet(planet: string, lang: "en" | "fa"): string {
  if (lang === "fa") return PLANET_EN_TO_FA[planet] ?? planet;
  return planet;
}

/** House number → short label (EN uses `NH`; FA uses Persian ordinal). */
export function localizeHouse(houseNum: number, lang: "en" | "fa"): string {
  if (lang === "en") return `${houseNum}H`;
  const ordinals: Record<number, string> = {
    1: "خانهٔ اول",
    2: "خانهٔ دوم",
    3: "خانهٔ سوم",
    4: "خانهٔ چهارم",
    5: "خانهٔ پنجم",
    6: "خانهٔ ششم",
    7: "خانهٔ هفتم",
    8: "خانهٔ هشتم",
    9: "خانهٔ نهم",
    10: "خانهٔ دهم",
    11: "خانهٔ یازدهم",
    12: "خانهٔ دوازدهم",
  };
  return ordinals[houseNum] ?? `خانهٔ ${houseNum}`;
}
