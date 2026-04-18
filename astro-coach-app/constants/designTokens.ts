/**
 * AKHTAR DESIGN TOKENS
 * Single source of truth for all visual values.
 * Import this file in components — never use hardcoded hex values.
 *
 * Usage (NativeWind): reference token values in style props
 * Usage (StyleSheet): import constants and use in StyleSheet.create()
 */

// ─────────────────────────────────────────────
// BACKGROUNDS — 4 elevation levels
// ─────────────────────────────────────────────
export const BG = {
  base:     '#09090f',   // screen background
  surface1: '#0f1120',   // default card background
  surface2: '#141726',   // elevated card, input fields
  surface3: '#1a1f30',   // active state, selected tab
} as const;

// ─────────────────────────────────────────────
// TEXT — 4 hierarchy levels
// ─────────────────────────────────────────────
export const TEXT = {
  primary:   '#f0eee8',  // headings, card titles
  secondary: '#a8a4b8',  // body copy, descriptions
  tertiary:  '#6b6780',  // metadata, dates, labels
  muted:     '#403d52',  // section caps, disabled
} as const;

// ─────────────────────────────────────────────
// BORDERS — 3 intensity levels (always 0.5px width)
// ─────────────────────────────────────────────
export const BORDER = {
  subtle:  'rgba(255,255,255,0.07)',  // default card border
  default: 'rgba(255,255,255,0.12)', // inputs, interactive elements
  strong:  'rgba(255,255,255,0.18)', // focus rings, active borders
} as const;

// ─────────────────────────────────────────────
// LIFECYCLE STATE COLORS — semantic only, never decorative
// ─────────────────────────────────────────────
export const STATE = {
  peak:        '#34d399',  // peaking now
  building:    '#818cf8',  // applying / building
  approaching: '#fb923c',  // approaching / coming
  separating:  '#94a3b8',  // integrating / separating
  fading:      '#64748b',  // fading
  lunation:    '#fcd34d',  // new moon / full moon / eclipse
} as const;

// Badge fill: rgba(<state>, 0.12)  |  Border: rgba(<state>, 0.25)
// Compute tints dynamically — do not hardcode per-state tints as constants

// ─────────────────────────────────────────────
// BRAND ACCENT — 2 colors only
// ─────────────────────────────────────────────
export const BRAND = {
  rose: '#f9a8d4',  // mantra, primary CTAs
  mint: '#6ee7b7',  // positive aspects, soft transits
} as const;

// ─────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────
export const FONT = {
  serif: 'PlayfairDisplay-Regular',          // all titles and emotional content
  serifItalic: 'PlayfairDisplay-Italic',     // moon ambient line only
  sans: 'DMSans-Regular',                    // all UI, body, labels
  sansMedium: 'DMSans-Medium',               // weight 500 — tabs, badges, buttons
} as const;

export const FONT_SIZE = {
  bannerTitle:   28,  // Playfair, banner headline (tablet/web)
  bannerTitleSm: 20,  // Playfair, banner headline (mobile)
  cardHero:      20,  // Playfair, hero card title
  cardCompact:   16,  // Playfair, compact card title
  italicAccent:  14,  // Playfair italic, moon ambient line
  body:          14,  // DM Sans, body copy
  uiLabel:       12,  // DM Sans 500, tabs, buttons
  metadata:      11,  // DM Sans, dates, house labels, fine print
  sectionCaps:   10,  // DM Sans 500, section headers
} as const;

export const LINE_HEIGHT = {
  tight:    1.2,   // banner titles
  snug:     1.3,   // card titles
  body:     1.65,  // body copy
  ui:       1.4,   // ui labels and metadata
} as const;

export const LETTER_SPACING = {
  sectionCaps: 0.09, // em — section header caps
  badge:       0.03, // em — lifecycle badges
} as const;

// ─────────────────────────────────────────────
// SPACING — 4px base unit, multiples only
// ─────────────────────────────────────────────
export const SPACE = {
  1:  4,    // icon gaps, tight inline
  2:  8,    // badge gap, chip gap
  3:  12,   // internal card gap
  4:  16,   // screen horizontal padding
  5:  20,   // banner internal padding
  6:  24,   // vertical section gap
  8:  32,   // large vertical rhythm
  14: 56,   // header top (status bar safe area)
} as const;

// ─────────────────────────────────────────────
// BORDER RADIUS — do not use values not in this set
// ─────────────────────────────────────────────
export const RADIUS = {
  sm:   4,   // fine tags
  md:   8,   // tabs, pills, buttons
  lg:   12,  // compact cards, strips
  xl:   18,  // hero cards, banners
  xxl:  24,  // bottom sheets, modal containers
  pill: 99,  // chips, lifecycle badges — always
} as const;

// ─────────────────────────────────────────────
// PLANET AURORA PALETTES
// Each planet: deep (base), mid (aurora band), glow (accent)
// ─────────────────────────────────────────────
export const PLANET_PALETTE = {
  Sun: {
    deep: '#1a0f04',
    mid:  '#d97706',
    glow: '#fbbf24',
    motion: 'radial-expansion',
  },
  Moon: {
    deep: '#0f1220',
    mid:  '#94a3b8',
    glow: '#e0e7ff',
    motion: 'slow-tidal-flow',
  },
  Mercury: {
    deep: '#0c1a1e',
    mid:  '#67e8f9',
    glow: '#a5f3fc',
    motion: 'fast-horizontal-streaks',
  },
  Venus: {
    deep: '#1a0c1a',
    mid:  '#f9a8d4',
    glow: '#bbf7d0',
    motion: 'curved-gentle-arcs',
  },
  Mars: {
    deep: '#1a0404',
    mid:  '#dc2626',
    glow: '#fb923c',
    motion: 'sharp-diagonals',
  },
  Jupiter: {
    deep: '#1a1004',
    mid:  '#d97706',
    glow: '#fde68a',
    motion: 'expansive-slow-waves',
  },
  Saturn: {
    deep: '#0f1a16',
    mid:  '#b45309',
    glow: '#115e59',
    motion: 'crystalline-slow-motion',
  },
  Uranus: {
    deep: '#0a0f1f',
    mid:  '#3b82f6',
    glow: '#c4b5fd',
    motion: 'jittered-pulses',
  },
  Neptune: {
    deep: '#05141a',
    mid:  '#059669',
    glow: '#8b5cf6',
    motion: 'misty-dissolve',
  },
  Pluto: {
    deep: '#140510',
    mid:  '#7c2d12',
    glow: '#581c87',
    motion: 'subterranean-churn',
  },
  Chiron: {
    deep: '#1a1410',
    mid:  '#be185d',
    glow: '#65a30d',
    motion: 'gentle-spiral',
  },
} as const;

export type PlanetName = keyof typeof PLANET_PALETTE;

// ─────────────────────────────────────────────
// AURORA LIFECYCLE MOTION MULTIPLIERS
// ─────────────────────────────────────────────
export const AURORA_MOTION = {
  approaching: { speedMultiplier: 0.6,  amplitudeMultiplier: 0.7  },
  applying:    { speedMultiplier: 0.85, amplitudeMultiplier: 0.9  },
  peak:        { speedMultiplier: 1.0,  amplitudeMultiplier: 1.1  }, // + 4s breath pulse
  separating:  { speedMultiplier: 0.7,  amplitudeMultiplier: 0.95 },
  fading:      { speedMultiplier: 0.4,  amplitudeMultiplier: 0.6  },
} as const;

// Aspect modifier on top of lifecycle:
// Hard aspects: speedMultiplier * 1.15, saturate mid by 10%
// Soft aspects: speedMultiplier * 0.90, desaturate mid by 5%

// ─────────────────────────────────────────────
// SCREEN AURORA ASSIGNMENTS
// ─────────────────────────────────────────────
export const SCREEN_AURORA: Record<string, { planet: PlanetName | 'dominant' | 'none'; opacity: number }> = {
  personalTransits:      { planet: 'dominant', opacity: 1.0 },
  transitDetail:         { planet: 'dominant', opacity: 1.0 }, // isStill: true
  mantra:                { planet: 'dominant', opacity: 1.0 }, // quality → planet mapping
  dashboard:             { planet: 'dominant', opacity: 0.5 },
  ama:                   { planet: 'Mercury',  opacity: 0.7 },
  dreamInterpreter:      { planet: 'Neptune',  opacity: 0.8 },
  coffeeReading:         { planet: 'Jupiter',  opacity: 0.7 },
  romanticCompatibility: { planet: 'Venus',    opacity: 0.8 },
  peopleInYourLife:      { planet: 'Moon',     opacity: 0.7 },
  journal:               { planet: 'dominant', opacity: 0.6 },
  onboarding:            { planet: 'dominant', opacity: 1.0 }, // cycles all planets
  profileSettings:       { planet: 'none',     opacity: 0.0 },
} as const;

// ─────────────────────────────────────────────
// MOTION DURATIONS (milliseconds)
// ─────────────────────────────────────────────
export const DURATION = {
  instant:     80,   // card press tactile
  fast:        150,  // tab switch, badge state change
  standard:    200,  // content fade in/out
  slow:        300,  // bottom sheet, page transitions
  auroraStill: 600,  // aurora halt when detail view opens
} as const;

// ─────────────────────────────────────────────
// SPRING PRESETS (react-native-reanimated)
// ─────────────────────────────────────────────
export const SPRING = {
  card:   { damping: 15, stiffness: 200 },  // card press scale
  sheet:  { damping: 20, stiffness: 300 },  // bottom sheet open
  badge:  { damping: 12, stiffness: 180 },  // badge appear on mount
} as const;

// ─────────────────────────────────────────────
// QUALITY TAG → PLANET MAPPING (for Mantra aurora)
// ─────────────────────────────────────────────
export const QUALITY_PLANET_MAP: Record<string, PlanetName> = {
  patience:    'Saturn',
  discipline:  'Saturn',
  rebuilding:  'Pluto',
  courage:     'Mars',
  'letting-go':'Pluto',
  expansion:   'Jupiter',
  clarity:     'Mercury',
  connection:  'Venus',
  softness:    'Neptune',
  worth:       'Sun',
  groundedness:'Saturn',
  boundaries:  'Mars',
} as const;

// ─────────────────────────────────────────────
// PLANET NAMES IN FARSI
// ─────────────────────────────────────────────
export const PLANET_NAME_FA: Record<PlanetName, string> = {
  Sun:     'خورشید',
  Moon:    'ماه',
  Mercury: 'عطارد',
  Venus:   'زهره',
  Mars:    'مریخ',
  Jupiter: 'مشتری',
  Saturn:  'زحل',
  Uranus:  'اورانوس',
  Neptune: 'نپتون',
  Pluto:   'پلوتو',
  Chiron:  'کایرون',
} as const;

// ─────────────────────────────────────────────
// MOON PHASE NAMES
// ─────────────────────────────────────────────
export const MOON_PHASE = {
  new:            { emoji: '🌑', en: 'New Moon',        fa: 'ماه نو'            },
  waxingCrescent: { emoji: '🌒', en: 'Waxing Crescent', fa: 'هلال رو به رشد'   },
  firstQuarter:   { emoji: '🌓', en: 'First Quarter',   fa: 'ربع اول'           },
  waxingGibbous:  { emoji: '🌔', en: 'Waxing Gibbous',  fa: 'هلال کامل‌شونده'  },
  full:           { emoji: '🌕', en: 'Full Moon',       fa: 'ماه کامل'          },
  waningGibbous:  { emoji: '🌖', en: 'Waning Gibbous',  fa: 'هلال رو به کاهش'  },
  lastQuarter:    { emoji: '🌗', en: 'Last Quarter',    fa: 'ربع آخر'           },
  waningCrescent: { emoji: '🌘', en: 'Waning Crescent', fa: 'هلال محو‌شونده'   },
} as const;

// ─────────────────────────────────────────────
// SECTION HEADER LABELS
// Never use "UPCOMING TRANSITS" — always use state-specific labels
// ─────────────────────────────────────────────
export const SECTION_LABEL = {
  peak:       { en: 'PEAKING NOW',        fa: 'در اوج',              color: STATE.peak        },
  building:   { en: 'BUILDING',           fa: 'در حال شکل‌گیری',    color: STATE.building    },
  approaching:{ en: 'COMING THIS WEEK',   fa: 'این هفته',            color: STATE.approaching },
  month:      { en: 'COMING THIS MONTH',  fa: 'این ماه',             color: STATE.approaching },
  separating: { en: 'INTEGRATING',        fa: 'در حال حل‌شدن',      color: STATE.separating  },
  ingress:    { en: 'INGRESSES',          fa: 'ورود به برج جدید',    color: STATE.building    },
  lunation:   { en: 'LUNATIONS',          fa: 'ماه نو / ماه کامل',  color: STATE.lunation    },
  retrograde: { en: 'RETROGRADES',        fa: 'بازگشت‌ها',           color: STATE.approaching },
} as const;

// ─────────────────────────────────────────────
// HOUSE THEMES (bilingual)
// ─────────────────────────────────────────────
export const HOUSE_THEME: Record<number, { en: string; fa: string }> = {
  1:  { en: 'self and identity',           fa: 'خود و هویت'              },
  2:  { en: 'resources and worth',          fa: 'منابع و ارزش'            },
  3:  { en: 'communication and learning',   fa: 'ارتباط و یادگیری'        },
  4:  { en: 'home and roots',               fa: 'خانه و ریشه‌ها'          },
  5:  { en: 'creativity and joy',           fa: 'خلاقیت و شادی'           },
  6:  { en: 'health and daily life',        fa: 'سلامت و زندگی روزمره'   },
  7:  { en: 'relationships and partnership',fa: 'روابط و مشارکت'          },
  8:  { en: 'transformation and depth',     fa: 'تحول و عمق'              },
  9:  { en: 'meaning and expansion',        fa: 'معنا و گسترش'            },
  10: { en: 'career and purpose',           fa: 'شغل و هدف'               },
  11: { en: 'community and vision',         fa: 'جامعه و چشم‌انداز'       },
  12: { en: 'solitude and inner world',     fa: 'تنهایی و دنیای درونی'   },
} as const;

// ─────────────────────────────────────────────
// BRAND — logo and global identity
// ─────────────────────────────────────────────
export const BRAND_LOGO = '#d4af37'; // Akhtar gold — used for the wordmark/logomark only

// ─────────────────────────────────────────────
// FEATURE IDENTITY COLORS
// Fixed per-feature gradients. Used on:
//   1. Dashboard feature cards (gradient fill, top → bottom)
//   2. Feature screen accent: chip borders, active tab underline,
//      CTA button background, icon background within that feature
//
// These do NOT replace the aurora system.
// Aurora = environmental (planet-driven, data-reactive)
// Feature gradient = identity (fixed, always this feature = these colors)
//
// Usage pattern:
//   card background: LinearGradient colors={[FEATURE.askAnything.top, FEATURE.askAnything.bottom]}
//   chip border:     rgba(FEATURE.askAnything.top, 0.35)
//   chip bg:         rgba(FEATURE.askAnything.top, 0.12)
//   CTA button bg:   rgba(FEATURE.askAnything.top, 0.15)
// ─────────────────────────────────────────────
export const FEATURE = {
  askAnything: {
    top:    '#D4AF37',
    bottom: '#B8932C',
    // Same as brand logo color — AMA is the flagship feature
    // FA name: «از هر چیزی بپرس»
  },
  tarot: {
    top:    '#5C3B6F',
    bottom: '#7B4C91',
    // FA name: «تاروت»
  },
  astrologicalEvents: {
    top:    '#4E6AA8',
    bottom: '#2F4273',
    // FA name: «رویدادهای نجومی»
  },
  romanticCompatibility: {
    top:    '#9D6B6B',
    bottom: '#C58A7A',
    // FA name: «سازگاری عاشقانه»
  },
  coffeeReading: {
    top:    '#8E5B3A',
    bottom: '#B97842',
    // FA name: «فال قهوه»
  },
  dreamInterpreter: {
    top:    '#7D74B2',
    bottom: '#A79AD9',
    // FA name: «تعبیر خواب»
  },
  mantra: {
    top:    '#4FA89D',
    bottom: '#2B6E6A',
    // FA name: «مانترا»
  },
} as const;

export type FeatureKey = keyof typeof FEATURE;

// Helper: derive tinted accent from a feature's top color
// Usage: featureTint('askAnything', 0.12) → card chip background
// Implementation in component:
//   const hex = FEATURE[featureKey].top  →  parse r,g,b  →  rgba(r,g,b,opacity)
// We don't store pre-computed rgba strings as constants because opacity
// varies by context (0.12 fill, 0.25 border, 0.15 CTA button).

// ─────────────────────────────────────────────
// FEATURE → AURORA PLANET OVERRIDE
// When a feature has a strong identity color that clashes with its
// assigned aurora planet, the feature color takes priority for chips/CTAs.
// The aurora still plays behind it — these are two separate layers.
// ─────────────────────────────────────────────
export const FEATURE_SCREEN_MAP: Record<FeatureKey, {
  screen: string;
  auroraplanet: string;
  accentSource: 'feature' | 'aurora'; // which color system drives chips/CTAs
}> = {
  askAnything:           { screen: 'ama',                   auroraplanet: 'Mercury', accentSource: 'feature'  },
  tarot:                 { screen: 'tarot',                 auroraplanet: 'Neptune', accentSource: 'feature'  },
  astrologicalEvents:    { screen: 'personalTransits',      auroraplanet: 'dominant',accentSource: 'aurora'   },
  romanticCompatibility: { screen: 'romanticCompatibility', auroraplanet: 'Venus',   accentSource: 'feature'  },
  coffeeReading:         { screen: 'coffeeReading',         auroraplanet: 'Jupiter', accentSource: 'feature'  },
  dreamInterpreter:      { screen: 'dreamInterpreter',      auroraplanet: 'Neptune', accentSource: 'feature'  },
  mantra:                { screen: 'mantra',                auroraplanet: 'dominant',accentSource: 'aurora'   },
} as const;
// Note: astrologicalEvents and mantra use 'aurora' as accent source because
// their identity is driven by the user's live planetary data, not a fixed color.
// All other features use their fixed gradient top color for chips and CTAs.
