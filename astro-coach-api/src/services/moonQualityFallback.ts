import type { QualityTag } from "./transitQualityMap.js";

export const MOON_SIGN_QUALITY: Record<string, QualityTag> = {
  aries: "courage",
  taurus: "groundedness",
  gemini: "clarity",
  cancer: "softness",
  leo: "worth",
  virgo: "discipline",
  libra: "connection",
  scorpio: "letting-go",
  sagittarius: "expansion",
  capricorn: "discipline",
  aquarius: "courage",
  pisces: "softness",
};

export const QUALITY_LABELS: Record<QualityTag, { en: string; fa: string }> = {
  patience: { en: "Patience", fa: "صبر" },
  boundaries: { en: "Boundaries", fa: "مرزها" },
  rebuilding: { en: "Rebuilding", fa: "بازسازی" },
  discipline: { en: "Discipline", fa: "انضباط" },
  clarity: { en: "Clarity", fa: "وضوح" },
  courage: { en: "Courage", fa: "شجاعت" },
  "letting-go": { en: "Letting Go", fa: "رها کردن" },
  softness: { en: "Softness", fa: "مهربانی با خود" },
  expansion: { en: "Expansion", fa: "گسترش" },
  groundedness: { en: "Groundedness", fa: "ثبات" },
  worth: { en: "Worth", fa: "ارزش" },
  connection: { en: "Connection", fa: "پیوند" },
};

// Per-quality fallback tie-back strings — used ONLY when LLM fails.
// Never use the old "reflects your planetary energy" generic string.
export const FALLBACK_TIEBACK_EN: Record<QualityTag, string> = {
  patience: "Today asks a slower pace than you'd like. That's okay.",
  boundaries: "Something is asking you to protect your energy right now.",
  rebuilding: "You're in a rebuilding season. Steady work matters more than speed.",
  discipline: "Small, consistent effort is enough. You don't need a grand move today.",
  clarity: "There's something you already know. Let yourself say it plainly.",
  courage: "The step you keep postponing is asking to be taken.",
  "letting-go": "Something you've held for a long time is ready to be set down.",
  softness: "You can be tired and still be okay. Rest is not a step back.",
  expansion: "A door you're not used to opening is slightly ajar right now.",
  groundedness: "You are already here. That's enough to start with.",
  worth: "You deserve the same care you would give someone you love.",
  connection: "You don't have to carry this alone. Someone would want to know.",
};

export const FALLBACK_TIEBACK_FA: Record<QualityTag, string> = {
  patience: "امروز از تو می‌خواهد آرام‌تر از آنچه دوست داری پیش بروی. اشکالی ندارد.",
  boundaries: "چیزی هست که می‌خواهد انرژی‌ات را حفظ کنی.",
  rebuilding: "در دوره‌ای از نوسازی هستی. کار آرام مهم‌تر از سرعت است.",
  discipline: "تلاش کوچک و مداوم کافی است. امروز نیازی به حرکت بزرگ نداری.",
  clarity: "چیزی هست که از قبل می‌دانی. بگذار خودت را آزاد کنی تا آن را بگویی.",
  courage: "قدمی که مدام به تعویق می‌اندازی می‌خواهد برداشته شود.",
  "letting-go": "چیزی که مدت‌هاست نگهش داشته‌ای آماده است که رها شود.",
  softness: "می‌توانی خسته باشی و باز هم خوب باشی. استراحت عقب‌نشینی نیست.",
  expansion: "دری که به آن عادت نداری باز شدن دارد، الان کمی باز است.",
  groundedness: "تو همین جایی. همین برای شروع کافی است.",
  worth: "لایق همان مراقبتی هستی که به کسی که دوستش داری می‌دهی.",
  connection: "مجبور نیستی این را تنها حمل کنی. کسی هست که می‌خواهد بداند.",
};
