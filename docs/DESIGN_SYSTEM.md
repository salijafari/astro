# AKHTAR DESIGN SYSTEM

**Version 1.0 — the single source of truth for all UI work**

---

## HOW CURSOR USES THIS FILE

Read this entire document before writing any UI code, any component, any screen, or any style. This is not optional context — it is the mandatory foundation for all frontend work on Akhtar. Every screen in the app shares the same token set, the same component library, and the same motion rules defined here.

When a prompt says "following DESIGN_SYSTEM.md", this is the file it means.

**Three things that will be wrong without reading this first:**

1. You will invent border radii, spacing, and colors that don't match the rest of the app
2. You will fork `CosmicBackground` or invent a parallel full-screen background instead of extending the existing system
3. You will write copy that violates the voice rules, which are enforced server-side

---

## 1. FOUNDATIONAL PRINCIPLES

**Principle A — Dark celestial, always.** Akhtar is always dark mode. There is no light mode. The visual world is deep space: dark surfaces, translucent cards, an ambient animated gradient background. Cards are always translucent so the background breathes through them. Never add a bright background. Never use white as a fill color.

**Principle B — Background is ambient, not decorative.** The animated gradient background (CosmicBackground) is a functional element that creates depth and atmosphere. It is not a blank fill. Every content screen uses CosmicBackground behind all content. Screens that are purely utilitarian (settings, profile edit) may omit it. Planet palette colors are used for accents, chips, and card borders — not as full-screen backgrounds.

**Principle C — Specificity over atmosphere.** Every piece of copy names the specific transiting planet and the specific natal target. Every card tells the user exactly what is happening to them, not a vague cosmic mood. This principle applies to all generated copy and to all hardcoded UI strings.

---

## 2. COLOR TOKENS

All colors are defined here. Components must import from `designTokens.ts` — never use hardcoded hex values inside components. These values are used via NativeWind classes or `StyleSheet.create` referencing the token constants.

### 2.1 Background system

The screen background is always `CosmicBackground` — a layered animated gradient defined in `components/CosmicBackground.tsx`. It is not a flat color.

**Canvas base:** `#06080f` — the outermost root fill, defined as `AURORA_BASE_DARK` in `lib/auroraPalette.ts`.

**Web implementation:** CSS `@keyframes` animation cycling through gradient stops `#0f0c29 → #302b63 → #24243e → #0d3b2e → #0f2a4a` at 400% background-size. Radial overlays add depth: `rgba(48,43,99,0.25)` top-left, `rgba(13,59,46,0.2)` bottom-right.

**Native implementation:** Four stacked `expo-linear-gradient` layers on `#06080f` base:

- Layer 1 (full opacity): `#0d3b2e → #06080f`
- Layer 2 (opacity 0.7): `#0f2a4a → #06080f`
- Layer 3 (opacity 0.5): `#2d1047 → #06080f`
- Bottom fade: `transparent → rgba(6,8,15,0.65)`

**Surface tokens** (for content ON TOP of CosmicBackground):

| Token | Value | Use |
| --- | --- | --- |
| `BG.base` | `#06080f` | Screen canvas — matches CosmicBackground base |
| `BG.card` | `rgba(30,28,60,0.90)` | Cards, feature rows — translucent over background |
| `BG.cardBare` | `rgba(255,255,255,0.08)` | Minimal surfaces, metadata containers |
| `BG.elevated` | `rgba(15,17,32,0.96)` | Bottom sheets, modals, input fields |
| `BG.active` | `rgba(255,255,255,0.05)` | Pressed/active states |

**Rule:** Never use an opaque solid background color on a content screen. All surfaces must be translucent so CosmicBackground shows through.

### 2.2 Text — 4 hierarchy levels


| Token | Value | Use |
| --- | --- | --- |
| `text.primary` | `rgba(255,255,255,0.92)` | Headings, card titles, key content |
| `text.secondary` | `rgba(255,255,255,0.60)` | Body copy, descriptions, metadata |
| `text.tertiary` | `rgba(255,255,255,0.35)` | Supporting metadata, dates, house labels |
| `text.muted` | `rgba(255,255,255,0.25)` | Section caps labels, disabled states |


### 2.3 Borders — 3 intensity levels


| Token | Value | Use |
| --- | --- | --- |
| `border.subtle` | `rgba(255,255,255,0.06)` | Default card border |
| `border.default` | `rgba(255,255,255,0.10)` | Input fields, interactive elements |
| `border.strong` | `rgba(255,255,255,0.18)` | Focus rings, active borders, hover states |


All borders are `0.5px` width. Never `1px` or `2px` except for the single case of a featured/recommended card accent, which uses `1px border.strong`.

### 2.4 Semantic — lifecycle states

These colors encode meaning. Never use them decoratively.


| Token               | Hex       | Lifecycle state                       |
| ------------------- | --------- | ------------------------------------- |
| `state.peak`        | `#34d399` | Peaking now — within ±1° of exact     |
| `state.building`    | `#818cf8` | Applying — moving toward exact        |
| `state.approaching` | `#fb923c` | Approaching — not yet in orb          |
| `state.separating`  | `#94a3b8` | Separating / integrating — past exact |
| `state.fading`      | `#64748b` | Fading — last 20% of orb              |
| `state.lunation`    | `#fcd34d` | New Moon / Full Moon / Eclipse events |


### 2.5 Brand accent


| Token        | Hex       | Use                                              |
| ------------ | --------- | ------------------------------------------------ |
| `brand.rose` | `#f9a8d4` | Mantra feature, primary CTAs, Mantra action pill |
| `brand.mint` | `#6ee7b7` | Positive aspects, soft transit confirmation      |


Brand rose is the only color used for primary CTAs and the Mantra action pill. Do not repurpose it for other features.

### 2.6 Translucent tints — for card backgrounds and badge fills

These are not stored as flat tokens. They are computed at usage: `rgba(<state.color>, 0.10)` for fills, `rgba(<state.color>, 0.25)` for borders. For example, a peaking badge fill is `rgba(52, 211, 153, 0.10)` with border `rgba(52, 211, 153, 0.25)`.

---

## 3. TYPOGRAPHY

Two fonts only. No third font is permitted anywhere in the app.

### 3.1 Font families


| Token        | Family             | Use                                                     |
| ------------ | ------------------ | ------------------------------------------------------- |
| `font.serif` | `Playfair Display` | All titles, banners, card headings, emotional content   |
| `font.sans`  | `DM Sans`          | All UI: body, labels, chips, pills, nav, metadata, tabs |


Persian text uses DM Sans. Farsi glyphs render correctly from this family and it supports RTL layout correctly.

### 3.2 Type scale


| Role                      | Font                    | Size | Weight | Line height | Letter spacing |
| ------------------------- | ----------------------- | ---- | ------ | ----------- | -------------- |
| Banner title              | Playfair Display        | 28px | 400    | 1.2         | —              |
| Card title hero           | Playfair Display        | 20px | 400    | 1.3         | —              |
| Card title compact        | Playfair Display        | 16px | 400    | 1.35        | —              |
| Italic accent (moon line) | Playfair Display italic | 14px | 400    | 1.5         | —              |
| Body                      | DM Sans                 | 14px | 400    | 1.65        | —              |
| UI label (tabs, buttons)  | DM Sans                 | 12px | 500    | 1.4         | —              |
| Metadata                  | DM Sans                 | 11px | 400    | 1.4         | —              |
| Section caps              | DM Sans                 | 10px | 500    | —           | 0.09em         |
| Fine print / italic note  | DM Sans italic          | 11px | 400    | 1.5         | —              |


**Rules:**

- Never use font weight 600 or 700. Only 400 (regular) and 500 (medium).
- Never use a font size below 10px.
- Playfair Display italic is reserved for the moon ambient line in banners — not for body emphasis.
- Bold within body copy uses `font-weight: 500` in DM Sans, not Playfair. Example: "**Venus squaring your Moon** creates..."

---

## 4. SPACING & RADIUS

All spacing uses the 4px base unit. All values are multiples of 4.

### 4.1 Spacing scale


| Token      | Value | Typical use                                            |
| ---------- | ----- | ------------------------------------------------------ |
| `space.1`  | 4px   | Icon gaps, tight inline spacing                        |
| `space.2`  | 8px   | Gap between badge and planet label, chip gap           |
| `space.3`  | 12px  | Internal card gap between elements                     |
| `space.4`  | 16px  | Screen horizontal padding (left/right edge)            |
| `space.5`  | 20px  | Banner internal padding                                |
| `space.6`  | 24px  | Vertical gap between sections                          |
| `space.8`  | 32px  | Large vertical rhythm between major blocks             |
| `space.14` | 56px  | Header top padding (accounts for status bar safe area) |


### 4.2 Border radius


| Token    | Value | Use                                        |
| -------- | ----- | ------------------------------------------ |
| `r.sm`   | 4px   | Fine tags, code labels                     |
| `r.md`   | 8px   | Tabs, pills, action buttons                |
| `r.lg`   | 12px  | Compact cards, strips, bottom sheet handle |
| `r.xl`   | 18px  | Hero cards, banners, elevated surfaces     |
| `r.2xl`  | 24px  | Bottom sheets, modal containers            |
| `r.pill` | 99px  | All chips, all lifecycle badges — always   |


**Rule:** Border radius is not a creative choice per screen. Use the token that matches the component type, every time.

---

## 5. PLANET AURORA PALETTES

Each planet has three color tokens: `deep` (darkest), `mid` (accent band), `glow` (highlight). These drive accent treatments (chips, borders, lifecycle tints) and the thin `PlanetaryAurora` ribbon in Personal Transits — not the full-screen background (`CosmicBackground`).


| Planet  | Token            | Deep      | Mid       | Glow      | Motion signature        |
| ------- | ---------------- | --------- | --------- | --------- | ----------------------- |
| Sun     | `planet.sun`     | `#1a0f04` | `#d97706` | `#fbbf24` | Radial expansion        |
| Moon    | `planet.moon`    | `#0f1220` | `#94a3b8` | `#e0e7ff` | Slow tidal flow         |
| Mercury | `planet.mercury` | `#0c1a1e` | `#67e8f9` | `#a5f3fc` | Fast horizontal streaks |
| Venus   | `planet.venus`   | `#1a0c1a` | `#f9a8d4` | `#bbf7d0` | Curved gentle arcs      |
| Mars    | `planet.mars`    | `#1a0404` | `#dc2626` | `#fb923c` | Sharp diagonals         |
| Jupiter | `planet.jupiter` | `#1a1004` | `#d97706` | `#fde68a` | Expansive slow waves    |
| Saturn  | `planet.saturn`  | `#0f1a16` | `#b45309` | `#115e59` | Crystalline slow motion |
| Uranus  | `planet.uranus`  | `#0a0f1f` | `#3b82f6` | `#c4b5fd` | Jittered pulses         |
| Neptune | `planet.neptune` | `#05141a` | `#059669` | `#8b5cf6` | Misty dissolve          |
| Pluto   | `planet.pluto`   | `#140510` | `#7c2d12` | `#581c87` | Subterranean churn      |
| Chiron  | `planet.chiron`  | `#1a1410` | `#be185d` | `#65a30d` | Gentle spiral           |


**Aspect modifiers:**

- Hard aspects (conjunction, square, opposition): saturate `mid` by 10%, increase motion speed by 15%
- Soft aspects (trine, sextile): desaturate `mid` by 5%, slow motion by 10%

---

## 6. BACKGROUND & AURORA SYSTEM

### 6.1 CosmicBackground — the actual background

File: `astro-coach-app/components/CosmicBackground.tsx`

This is the background for every content screen. It renders differently per platform:

- **Web:** CSS animated gradient (`akhtarGradientShift`) using `@keyframes` with deep purple/green/navy tones
- **Native:** Stacked `expo-linear-gradient` layers on `AURORA_BASE_DARK (#06080f)` base

**Props:**

```typescript
interface CosmicBackgroundProps {
  colorSchemeOverride?: ColorSchemeName | null;
  subtleDrift?: boolean;      // API compat only — no visual effect
  mantraMode?: boolean;       // Slows animation + dim overlay
  practiceStillness?: boolean; // Nearly freezes animation + stronger dim
}
```

**Usage:** Place as first child of the screen root View. The root View must have `backgroundColor: 'transparent'` or `BG.base`.

```tsx
<View style={{ flex: 1, backgroundColor: BG.base }}>
  <CosmicBackground />
  {/* screen content */}
</View>
```

CosmicBackground layered gradient uses `StyleSheet.absoluteFillObject`; it does not set an explicit `zIndex` — stack order places it behind foreground content.

### 6.2 AuroraSafeArea — CosmicBackground with safe area

File: `astro-coach-app/components/CosmicBackground.tsx` (exported from same file)

Wraps `CosmicBackground` with `SafeAreaView`. Used by feature screens inside `feature/[id].tsx` via `FeatureAuroraSafeArea`.

### 6.3 Planet palette accents

Planet palettes from `PLANET_PALETTE` in `designTokens.ts` are used for:

- Feature chip borders and backgrounds: `rgba(<planet.mid>, 0.12)` fill, `rgba(<planet.mid>, 0.25)` border
- Lifecycle badge colors on transit cards
- The thin `PlanetaryAurora` ribbon accent — **not** a full-screen planet fill; `CosmicBackground` remains the layered gradient behind all content
- Future: full-screen planetary tinting per screen (**planned** — not yet implemented)

Planet palettes do NOT replace or modify CosmicBackground. CosmicBackground is fixed. Planet palettes are accent layers only.

### 6.4 Screen background assignments

Every content screen uses `CosmicBackground`. The props differ by screen:

| Screen | CosmicBackground props | Planet accent source |
| --- | --- | --- |
| Dashboard | `subtleDrift` (default) | `PLANET_PALETTE` dominant transit (chips only) |
| Personal Transits | default | `PLANET_PALETTE` dominant transit |
| Mantra | `mantraMode` during reading | `QUALITY_PLANET_MAP` → planet |
| Mantra Practice | `practiceStillness` | Same as mantra |
| Coffee Reading | default | `PLANET_PALETTE.Jupiter` |
| AMA | default | `PLANET_PALETTE.Mercury` |
| Dream Interpreter | default | `PLANET_PALETTE.Neptune` |
| Romantic Compat. | default | `PLANET_PALETTE.Venus` |
| Profile / Settings | none | none |

---

## 7. COMPONENT LIBRARY

These are the canonical components shared across all screens. Cursor must implement these specs exactly. Do not invent variants not listed here.

---

### 7.1 `<LifecycleBadge />`

The single badge on every transit card that communicates state. One badge per card. Always the first element inside the card header row.

**Variants and styling:**


| Lifecycle   | Label (EN)  | Label (FA)      | Fill                     | Border                   | Text color |
| ----------- | ----------- | --------------- | ------------------------ | ------------------------ | ---------- |
| peak        | Peaking now | در اوج          | `rgba(52,211,153,0.12)`  | `rgba(52,211,153,0.3)`   | `#34d399`  |
| applying    | Building    | در حال شکل‌گیری | `rgba(129,140,248,0.12)` | `rgba(129,140,248,0.3)`  | `#818cf8`  |
| approaching | Approaching | در راه          | `rgba(251,146,60,0.12)`  | `rgba(251,146,60,0.3)`   | `#fb923c`  |
| separating  | Integrating | در حال حل‌شدن   | `rgba(148,163,184,0.10)` | `rgba(148,163,184,0.2)`  | `#94a3b8`  |
| fading      | Fading      | در حال محو شدن  | `rgba(100,116,139,0.08)` | `rgba(100,116,139,0.15)` | `#64748b`  |


**Dimensions:** `border-radius: r.pill`, `padding: 5px 11px`, `font-size: 11px`, `font-weight: 500`, `letter-spacing: 0.03em`

**Rule:** Never show a "Now" label anywhere in the app. The lifecycle badge is the only state indicator. If the current state is `peak`, the badge already communicates "now".

---

### 7.2 `<LunationBadge />`

Distinct from lifecycle badges. Used only on New Moon / Full Moon / Eclipse cards.


| Kind          | Label (EN)    | Label (FA)   | Color                     |
| ------------- | ------------- | ------------ | ------------------------- |
| new_moon      | New Moon      | ماه نو       | `#94a3b8`                 |
| full_moon     | Full Moon     | ماه کامل     | `#fcd34d`                 |
| solar_eclipse | Solar Eclipse | خسوف خورشیدی | `#fcd34d` + eclipse badge |
| lunar_eclipse | Lunar Eclipse | خسوف ماه     | `#94a3b8` + eclipse badge |


Eclipse events additionally show a small "Eclipse" badge in `rgba(252,211,77,0.15)` and apply slightly dimmed glow treatment on the card.

---

### 7.3 `<LifecycleDurationBar />`

Replaces the old anonymous two-date stack. Appears on hero `TransitCard` variant only.

**Props:**

```typescript
interface LifecycleDurationBarProps {
  startAt: string;        // ISO date
  peakAt: string;         // ISO date
  endAt: string;          // ISO date
  lifecycle: TransitLifecycle;
  lifecycleProgress: number;  // 0–1
}
```

**Visual structure:**

- Horizontal track: `height: 4px`, `background: rgba(255,255,255,0.07)`, `border-radius: 99px`
- Fill: gradient from planet `mid` color at 40% opacity to 70% opacity, covers `lifecycleProgress * 100%` of track
- Today marker: circle `10×10px`, `border: 2px solid <state color>`, `box-shadow: 0 0 8px rgba(<state color>, 0.5)`, positioned at `lifecycleProgress`
- Peak marker: rotated 45° square `7×7px`, filled with `<state color>`, positioned at `(peakAt - startAt) / (endAt - startAt)`
- Labels above bar: start date (left), "◆ Peak [date]" in state color (center-ish), end date (right) — all `10px`, `text.tertiary`
- Below bar: one line `"<State label> · peaks/ends [date] · N days total"` — `11px`, `text.secondary`

**RTL:** Mirror the bar horizontally when `I18nManager.isRTL`. Today circle and peak diamond positions recalculate from the right. The text below uses right-to-left date ordering.

---

### 7.4 `<TransitCard />`

Three size variants. The variant is passed as a prop — never derive it from content length.

**Props:**

```typescript
interface TransitCardProps {
  variant: "hero" | "compact" | "strip";
  event: TransitEventV2;
  onPress: () => void;
  onMantra?: () => void;    // hero only
  onJournal?: () => void;   // hero only
  onAMA?: () => void;       // hero only
}
```

**Hero variant** (dominant transit — full width):

- Background: `rgba(<planet.mid>, 0.07)`, border: `rgba(<planet.mid>, 0.22)`, `border-radius: r.xl`
- Internal padding: `space.5` (20px)
- Header row: `LifecycleBadge` left, planet tag `"Mercury ◻ Moon"` right in `text.tertiary`
- Title: `Playfair Display`, `20px`, `text.primary`
- Body: `DM Sans`, `14px`, `text.secondary`, `line-height: 1.65`
- `LifecycleDurationBar` component
- House chip: `🏠 7th house · relationships` — `r.pill`, `BG.active`, `border.subtle`, `11px`, `text.secondary`
- Action pills: always all three, in order: Mantra / Journal this / Ask Akhtar
- Divider above action pills: `0.5px`, `border.subtle`

**Compact variant** (supporting transits):

- Background: `BG.elevated`, border: `border.subtle`, `border-radius: r.lg`
- Internal padding: `14px 16px`
- Row layout: content left, `›` right in `text.tertiary`
- Header row: `LifecycleBadge` (smaller: `9px`, `padding: 3px 7px`) + planet tag
- Title: `Playfair Display`, `16px` (compact scale), `text.primary`
- Metadata line: `11px`, `text.tertiary` — lifecycle state · peak/end date · house · theme

**Strip variant** (retrogrades, ingresses — single line):

- Background: semantic tint (retrograde: `rgba(251,146,60,0.06)`, ingress: `rgba(129,140,248,0.06)`)
- Border: matching semantic color at 0.15 opacity
- `border-radius: r.lg`, `padding: 10px 14px`
- Row: icon + text + phase badge
- Never more than one line of text

---

### 7.5 `<ActionPills />`

Three pills always appear together as a unit at the bottom of the hero `TransitCard`. Never show fewer than three. Never re-order them.


| Position | Label (EN)   | Label (FA)   | Color treatment                                                                                     |
| -------- | ------------ | ------------ | --------------------------------------------------------------------------------------------------- |
| 1st      | Mantra       | مانترا       | `brand.rose` tint — `rgba(249,168,212,0.12)` bg, `rgba(249,168,212,0.25)` border, `brand.rose` text |
| 2nd      | Journal this | بنویس        | Default — `BG.active`, `border.default`, `text.secondary`                                         |
| 3rd      | Ask Akhtar   | از اختر بپرس | Default — `BG.active`, `border.default`, `text.secondary`                                         |


**Dimensions:** `flex: 1`, `border-radius: r.md`, `padding: 10px 4px`, `font-size: 11px`, `font-weight: 500`, icon above label with `font-size: 13px`

**Navigation behavior:**

- Mantra pill: navigates to Mantra tab with `?seedQualityTag=<tag>`. If today's mantra not yet generated, biases template selection toward seeded tag. If already generated, opens normally without override.
- Journal pill: opens Journal composer with `journalPromptEn` or `journalPromptFa` prefilled (from `/transits/detail/:id` `relatedActions`).
- AMA pill: opens AMA with `amaSeedQuestionEn/Fa` prefilled as first user turn.

**RTL:** In Farsi mode, pill order mirrors — Ask Akhtar becomes first, Mantra becomes last.

---

### 7.6 `<DominantBanner />`

The top content block on every astrological feature screen. Sits above the tab bar, inside a translucent card with `backdrop-filter: blur(20px)`.

**Structure (top to bottom):**

1. `banner-top` row: title (flex: 1) + quality chip (flex-shrink: 0, no wrap)
2. Body paragraph
3. Moon ambient line (italic, `border-top: 0.5px border.subtle`, `padding-top: 12px`)

**Title rules:**

- Font: `Playfair Display`, `20px` on mobile, `28px` on tablet/web
- Must name the specific transiting planet
- Must contain a concrete verb or image — not an abstract adjective
- Length: 8–12 words
- Never starts with a banned phrase (see Section 9.1)

**Body rules:**

- First sentence bolds the transiting planet + natal target: `**Venus squaring your Moon`**
- When birth time is known: includes the house theme
- Length: 2–3 sentences only
- Never a list — always flowing prose

**Moon ambient line:**

- `Playfair Display italic`, `14px`, `text.tertiary`
- Format: `🌙 Moon in [Sign] tonight · [tone keyword], [tone keyword]`
- Farsi format: `ماه در [برج] · [کلمات کلیدی]`

**When `dominant === null`:** Banner uses Moon-only framing. Never a fake or synthetic banner.

---

### 7.7 `<MoonAmbientStrip />`

One line, below the tab bar on every transit tab. Never more than one line.

**Format:** `[Moon phase emoji] Moon in [Sign] · [Date if relevant] · [house context]`
**Farsi format:** `ماه در [برج] · [خانه اگر زمان تولد معلوم است]`

**Moon phase emoji map:**

- New Moon → 🌑 / `ماه نو`
- Waxing Crescent → 🌒 / `هلال رو به رشد`
- First Quarter → 🌓 / `ربع اول`
- Waxing Gibbous → 🌔 / `هلال کامل‌شونده`
- Full Moon → 🌕 / `ماه کامل`
- Waning Gibbous → 🌖 / `هلال رو به کاهش`
- Last Quarter → 🌗 / `ربع آخر`
- Waning Crescent → 🌘 / `هلال محو‌شونده`

**Styling:** `background: rgba(255,255,255,0.03)`, `border: 0.5px border.subtle`, `border-radius: r.lg`, `padding: 10px 14px`, `font-size: 12px`, `text.secondary`. Moon sign name in `text.primary font-weight: 500`.

---

### 7.8 `<ContextChips />`

Row of identity chips below the banner on transit-aware screens.

**Chips in order (EN):** `☉ [Sun sign]` · `☽ [Moon sign or "Unknown rising"]`
**Chips in order (FA):** `☉ [برج خورشیدی]` · `☽ [برج ماه یا "طالع نامشخص"]`

Below chips, when birth time is missing: `"Birth time missing. Rising sign and timing may be less precise."` in `DM Sans italic`, `11px`, `text.tertiary`. This line is tappable — opens the `<PrecisionNoteSheet />` bottom sheet.

---

### 7.9 `<SectionHeader />`

Replaces the old `"UPCOMING TRANSITS"` catch-all. State-specific only.

**Structure:** A colored dot (5px circle) + caps label


| State       | Label (EN)             | Label (FA)         | Dot color           |
| ----------- | ---------------------- | ------------------ | ------------------- |
| peak        | PEAKING NOW            | در اوج             | `state.peak`        |
| applying    | BUILDING               | در حال شکل‌گیری    | `state.building`    |
| approaching | COMING THIS WEEK/MONTH | این هفته / این ماه | `state.approaching` |
| separating  | INTEGRATING            | در حال حل‌شدن      | `state.separating`  |
| lunation    | LUNATIONS              | ماه نو / ماه کامل  | `state.lunation`    |
| ingress     | INGRESSES              | ورود به برج جدید   | `state.building`    |
| retrograde  | RETROGRADES            | بازگشت‌ها          | `state.approaching` |


**Styling:** `font-size: 10px`, `font-weight: 500`, `letter-spacing: 0.09em`, `text.muted`. Dot is `5px × 5px` circle. Gap between dot and label: `8px`.

---

### 7.10 `<RetrogradeStrip />`

Thin strip shown when any planet is retrograde. Mercury retrograde gets special treatment with a tri-state phase bar.

**Standard strip:** Planet glyph + `"[Planet] retrograde · [Date range] · [keyword]"` + phase badge

**Mercury retrograde phase badge values:**

- Pre-shadow: `"Pre-shadow"` / `"پیش‌سایه"` — `state.approaching` colors
- Retrograde: `"Retrograde"` / `"رجعی"` — `state.approaching` colors
- Post-shadow: `"Post-shadow"` / `"پس‌سایه"` — `state.separating` colors

---

### 7.11 `<LunationCard />`

Distinct visual from transit cards. Appears in week and month tabs when a New or Full Moon falls within the window.

**Structure:** Circular Moon phase icon (large, centered above content) + sign + degree + natal house + emotional body copy.

**Styling:** `background: rgba(252,211,77,0.05)`, `border: rgba(252,211,77,0.15)`, `border-radius: r.xl`

Eclipse events: additional small "Eclipse" badge (`rgba(252,211,77,0.15)` fill) + slightly reduced glow opacity on the card border.

---

### 7.12 `<EmptyState />`

Shown when user has no birth profile or when a screen genuinely has no content to show.

**Structure:** Large icon (40px, `opacity: 0.5`) + serif title (`18px`) + body (`13px`, `text.tertiary`) + single CTA

**Styling:** `background: BG.card`, `border: border.subtle`, `border-radius: r.xl`, `padding: 32px 20px`, `text-align: center`

**Rule:** Always `CosmicBackground` behind the empty state (Moon palette accents on top when applicable) — never a blank screen. CTA navigates to the most logical next action (usually profile completion or onboarding).

---

### 7.13 `<PrecisionNoteSheet />`

Bottom sheet opened when user taps the `"Birth time missing"` precision note.

**Sheet content:**

- Title: `"Why birth time matters"` / `"چرا ساعت تولد مهم است"`
- Body: Explanation of rising sign, house placement, and lunation accuracy
- CTA button: `"Add birth time"` / `"ساعت تولد را اضافه کنید"` → navigates to profile edit

**Sheet styling:** `background: BG.elevated`, `border-radius: r.2xl` on top corners only, handle bar (`36×4px`, `border.strong`, `border-radius: r.pill`, centered, `margin: 12px auto`), `padding: 0 20px 32px`

---

### 7.14 `<Tabs />`

Three-tab bar used on the Transits screen and any screen with timeframe selection.

**Variants:** Today / This Week / This Month (EN) · امروز / این هفته / این ماه (FA)

**Active tab:** `background: rgba(<brand.rose>, 0.12)`, `border: rgba(<brand.rose>, 0.25)`, `color: brand.rose`

**Inactive tab:** `background: transparent`, `border: border.subtle`, `color: text.tertiary`

**Transitions:** 150ms fade on active state change. CosmicBackground does not change on tab switch.

---

## 8. MOTION SYSTEM

All animations in the React Native app use `react-native-reanimated` exclusively. The core `Animated` API is never used. This is a hard rule — violations cause jank on lower-end Android devices.

### 8.1 Spring presets


| Name           | Damping | Stiffness | Use                   |
| -------------- | ------- | --------- | --------------------- |
| `spring.card`  | 15      | 200       | Card press scale      |
| `spring.sheet` | 20      | 300       | Bottom sheet open     |
| `spring.badge` | 12      | 180       | Badge appear on mount |


### 8.2 Easing presets


| Name              | Value                               | Use                      |
| ----------------- | ----------------------------------- | ------------------------ |
| `ease.standard`   | `Easing.bezier(0.25, 0.1, 0.25, 1)` | Most transitions         |
| `ease.decelerate` | `Easing.out(Easing.cubic)`          | Elements entering screen |
| `ease.accelerate` | `Easing.in(Easing.quad)`            | Elements leaving screen  |


### 8.3 Duration presets


| Name                    | Duration | Use                                |
| ----------------------- | -------- | ---------------------------------- |
| `duration.instant`      | 80ms     | Card press tactile                 |
| `duration.fast`         | 150ms    | Tab switch, badge state change     |
| `duration.standard`     | 200ms    | Content fade in/out                |
| `duration.slow`         | 300ms    | Bottom sheet, page transitions     |
| `duration.aurora.still` | 600ms    | Aurora halt when detail view opens |


### 8.4 Interaction transitions

**Card press:** `scale: 0.985` over 80ms on press-in using `spring.card`. Returns over 120ms on release.

**PlanetaryAurora ribbon → still mode (planned):** When a detail view opens (`isStill = true`), the ribbon accent motion aims to halt within `duration.aurora.still` (600ms) using `ease.standard`. CosmicBackground layered gradient continues independently (CSS / LinearGradient — not Reanimated). Full-screen planetary blur layers are not part of CosmicBackground.

**Tab switch:** Content fades out over 150ms (`ease.accelerate`), new content fades in over 200ms (`ease.decelerate`). No slide. CosmicBackground is unaffected by tab switching.

**Bottom sheet:** Slides up over 300ms using `ease.decelerate`. Backdrop fades to `rgba(0,0,0,0.6)` over the same duration. Dismisses with `ease.accelerate` over 250ms.

**Skeleton loaders:** Every zone and card variant has a skeleton that matches its exact shape. Skeletons pulse at 1.5s intervals between `opacity: 0.4` and `opacity: 0.7`. Never use a generic spinner.

---

## 9. COPY VOICE

Copy rules apply to all generated content (LLM output) and all hardcoded UI strings.

### 9.1 Banned openings — server rejects and regenerates

The server performs a string check on all LLM output. If output starts with any of these, it is rejected and regenerated:

- `"The stars suggest…"`
- `"The universe is…"`
- `"Based on your chart…"`
- `"This transit brings…"`
- `"You are entering…"`
- `"A powerful alignment…"`
- `"Based on"`
- `"This mantra"`

### 9.2 Banned words — anywhere in generated copy

`doom` · `crisis` · `inevitable` · `warning` · `"you will"` (predictive) · `powerful` (overused) · `manifest` · `destiny` · `cosmic forces` · `the universe wants` · `the stars say`

### 9.3 Banner title rules

- Length: 8–12 words
- Must name the specific transiting planet by name
- Must contain a concrete verb or image — not an abstract adjective
- Never Title Case — sentence case only
- Good: `"Saturn asks you to redraw a boundary at home"`
- Good: `"Venus asks you to soften a pattern in how you love yourself"`
- Good: `"Jupiter opens a door you weren't expecting to walk through"`
- Bad: `"Deep Emotional Alchemy and Creative Magic"` (no planet, abstract)
- Bad: `"Subtle Shifts Bring Great Power"` (no planet, vague, title case)
- Bad: `"Your Inner Light Shines Bright"` (no planet, no specificity)

### 9.4 Body copy rules

- First sentence bolds the transiting planet + natal target in format: `**[Planet] [aspect] your [natal target]`**
- When birth time is known: includes house theme in first or second sentence
- Length: 2–3 sentences maximum
- Framing: challenging transits are always framed as restructuring, not as threats
- Never: diagnostic, predictive certainty, or fear-based language

### 9.5 Ethics footer

On all detail view screens (Transit Detail, Mantra detail), below the body copy:

EN: `"Akhtar offers reflection, not diagnosis. For medical, legal, or financial decisions, consult a professional."`
FA: `«اختر برای تأمل است، نه تشخیص. برای تصمیمات پزشکی، حقوقی یا مالی، با متخصص مشورت کنید.»`

Styling: `11px`, `text.muted`, `font-style: italic`, dismissible after first read.

---

## 10. RTL & BILINGUAL RULES

These apply at both the backend prompt assembly layer AND the frontend rendering layer. Never assume RTL is handled in only one place.

### 10.1 Farsi copy generation

All Farsi copy is generated from a **native Farsi system prompt**, never translated from English. Every Farsi system prompt must include this safety-classifier mitigation phrase:

> `«متن‌های سلامت روان، خودآگاهی، و مراقبت از خود کاملاً مجاز و مطلوب هستند.»`

This prevents false positives on legitimate Persian wellness content.

### 10.2 Date and number formatting


| Context    | English         | Farsi          |
| ---------- | --------------- | -------------- |
| Short date | `Mar 8`         | `۸ اسفند`      |
| Long date  | `March 8, 2025` | `۸ اسفند ۱۴۰۳` |
| Numerals   | 0123456789      | ۰۱۲۳۴۵۶۷۸۹     |


### 10.3 Planet names in Farsi


| Planet  | Farsi   |
| ------- | ------- |
| Sun     | خورشید  |
| Moon    | ماه     |
| Mercury | عطارد   |
| Venus   | زهره    |
| Mars    | مریخ    |
| Jupiter | مشتری   |
| Saturn  | زحل     |
| Uranus  | اورانوس |
| Neptune | نپتون   |
| Pluto   | پلوتو   |
| Chiron  | کایرون  |


### 10.4 RTL component rules

- `LifecycleDurationBar`: mirror horizontally when `I18nManager.isRTL`. Peak marker repositions from right.
- `ActionPills`: order reverses in Farsi — Ask Akhtar becomes first, Mantra becomes last.
- All `flexDirection: 'row'` layouts must be tested in RTL.
- All text alignment must use `textAlign: 'auto'` or locale-aware values — never hardcoded `'left'`.
- Section headers: dot appears on the right side of the label in RTL.

### 10.5 Content field naming convention

Every content model that has user-facing text must have both `En` and `Fa` variants:

- `titleEn`, `titleFa`
- `bodyEn`, `bodyFa`
- `journalPromptEn`, `journalPromptFa`
- `amaSeedQuestionEn`, `amaSeedQuestionFa`

No hardcoded English strings in any component that a Farsi user would see.

---

## 11. SCREEN-BY-SCREEN IMPLEMENTATION NOTES

### Personal Transits (V2 — in progress)

**Background:** `CosmicBackground` layered gradient — not a planet-filled full-screen.
**Planet accents:** Dominant transit palette (`PLANET_PALETTE`; chips, badges, thin ribbon — full opacity mapping per `SCREEN_AURORA`).
**Layout:** Header → Banner → Chips → PrecisionNote → Tabs → MoonStrip → Content zones
**Today tab:** ≤3 event cards (1 hero + up to 2 compact) + retrograde strip if active
**Week tab:** Horizontal timeline visual + ≤5 cards grouped by lifecycle + ingresses + lunations
**Month tab:** Vertical timeline + ≤7 cards grouped by week + ingresses + lunations + retrogrades
**Empty state:** CosmicBackground + Moon-phase framing + explanation + CTA to complete birth profile

### Mantra

**Background:** `CosmicBackground`; use `mantraMode` / `practiceStillness` props where implemented.
**Planet accents:** Quality tag maps to planet (patience→Saturn, expansion→Jupiter, connection→Venus, clarity→Mercury, courage→Mars, softness→Neptune, worth→Sun, rebuilding→Pluto, letting-go→Pluto, groundedness→Saturn, boundaries→Mars).
**Practice mode:** `practiceStillness` on CosmicBackground when practice begins (`isStill=true` for ribbon motion where applicable — **planned**).
**Swipe-up gesture:** `react-native-reanimated` only — never `PanResponder` or core `Animated`.

### Dashboard

**Background:** `CosmicBackground` (e.g. `subtleDrift` on dashboard for API compatibility).
**Planet accents:** Same mapping as dominant transit for chips (`SCREEN_AURORA.dashboard`, `opacity: 0.5`) — accents only; full-screen remains CosmicBackground layered gradient.
**Rule:** Dashboard surfaces today's dominant transit state and today's mantra quality — it does not duplicate the full transit list. Link to full Transits screen.

### AMA

**Background:** `CosmicBackground`.
**Planet accents:** Mercury palette (`#0c1a1e` / `#67e8f9` / `#a5f3fc`), `opacity: 0.7` per `SCREEN_AURORA`.
**Transit seed:** When opened from a Transits action pill, shows a dismissible transit context chip above the input. The chip shows the planet glyph + short title. This context is sent with the first message.

### Dream Interpreter

**Background:** `CosmicBackground`.
**Planet accents:** Neptune palette (`#05141a` / `#059669` / `#8b5cf6`), `opacity: 0.8` per `SCREEN_AURORA`.
**Result card:** Same `DominantBanner` pattern — title in Playfair Display, body in DM Sans, with a save/journal action at the bottom.

### Journal

**Background:** `CosmicBackground`.
**Planet accents:** Current dominant transit planet, `opacity: 0.6` per `SCREEN_AURORA`.
**Transit chip on entries:** Each journal entry card shows which transit was active when it was written — a small strip below the entry date.

---

## 12. BANNED PATTERNS

These are things Cursor must never do. If a prompt could lead to any of these, stop and re-read this document.

### Visual

- ❌ Hardcoded hex values inside components — always use design tokens
- ❌ Using `Animated` API (core React Native) — always use `react-native-reanimated`
- ❌ Forking `CosmicBackground` or parallel full-screen gradient systems — extend the existing component
- ❌ Opaque card backgrounds over CosmicBackground — always translucent
- ❌ Blank dark screen for any state — always CosmicBackground + graceful empty state (Moon palette accents where specified)
- ❌ Font weights 600 or 700
- ❌ Font sizes below 10px
- ❌ `border-radius` values not in the `r.`* token set
- ❌ A third font family
- ❌ Light backgrounds or white fills

### UX

- ❌ A "Now" badge on any card — lifecycle badge is the state indicator
- ❌ A generic spinner — every loading state has a skeleton that matches the component shape
- ❌ A blank or broken state — every error path has a graceful empty state
- ❌ Action pills with fewer than three pills — always all three
- ❌ Action pills in a different order than Mantra / Journal / Ask Akhtar
- ❌ The section header `"UPCOMING TRANSITS"` — use state-specific headers only

### Copy

- ❌ Any of the banned opening phrases (Section 9.1)
- ❌ Any of the banned words (Section 9.2)
- ❌ A banner title without the specific planet name
- ❌ A banner body without naming the natal target
- ❌ Fear-based framing of challenging transits
- ❌ Farsi copy generated by translating from English — always native Farsi prompt
- ❌ English numerals in Farsi-locale date displays

### Architecture

- ❌ Computing astrological positions in the LLM — only `sweph` performs calculations
- ❌ Using `gpt-4o`, `claude`, or any model other than `google/gemini-3-flash-preview` (primary) / `moonshotai/kimi-k2.5` (fallback) via OpenRouter
- ❌ Registering a new route after a wildcard in `app.ts` — always before any catch-all
- ❌ Using `firstName` or `displayName` — the correct field is `user.name`
- ❌ Firebase `Clerk` — removed from the project, never suggest it

---

## 13. ADDING A NEW SCREEN

When building any new screen, follow this checklist:

1. **Read this document first** — all of it, not just the relevant sections
2. **Determine planet accent needs** — which planet or context drives chips, borders, and `SCREEN_AURORA`? See Section 6.4. Full-screen background is always `CosmicBackground` on content screens. If the screen is utilitarian (settings, profile edit), skip `CosmicBackground` only if the spec says so — not a different planet “background fill.”
3. **Reuse existing components** — check the component library (Section 7) before building anything new. If a component doesn't exist for what you need, check with the product owner before inventing one.
4. **Use tokens, not hex** — import from `designTokens.ts`. If a token doesn't exist, add it to the token file, don't hardcode.
5. **Test in RTL** — set `I18nManager.isRTL = true` and verify the layout is correct in Farsi mode.
6. **Test empty and error states** — every screen must have a graceful empty state with `CosmicBackground` and Moon-palette accent fallback where applicable.
7. **Verify typography** — only Playfair Display and DM Sans, only weights 400 and 500.
8. **Verify motion** — if you used `Animated` anywhere, replace it with `reanimated`.
9. **Verify copy** — no banned phrases, no hardcoded English visible to Farsi users.

---

*Last updated: April 2026 — AKHTAR DESIGN SYSTEM v1.0*
*Maintained by: product owner. Update this file when any token, component, or rule changes.*
*Cursor: this file takes precedence over all other style or design guidance.*

---

## 14. BRAND LOGO COLOR

`#d4af37` — Akhtar gold. Used only for the wordmark and logomark. This is intentionally the same as the `ask-anything` feature color because AMA is the flagship feature closest to the Akhtar brand identity.

---

## 15. FEATURE IDENTITY COLORS

These are fixed per-feature colors. They answer "which feature is this?" — distinct from `PLANET_PALETTE` / `SCREEN_AURORA`, which drive planet **accents** (not the full-screen `CosmicBackground` gradient).


| Feature                | Top       | Bottom    | Accent source        |
| ---------------------- | --------- | --------- | -------------------- |
| Ask Anything (AMA)     | `#D4AF37` | `#B8932C` | Feature gradient     |
| Tarot                  | `#5C3B6F` | `#7B4C91` | Feature gradient     |
| Astrological Events    | `#4E6AA8` | `#2F4273` | Feature gradient     |
| Romantic Compatibility | `#9D6B6B` | `#C58A7A` | Feature gradient     |
| Coffee Reading         | `#8E5B3A` | `#B97842` | Feature gradient     |
| Dream Interpreter      | `#7D74B2` | `#A79AD9` | Feature gradient     |
| Mantra                 | `#4FA89D` | `#2B6E6A` | Planet palette accents (live planet) |
| Personal Transits      | —         | —         | Planet palette accents (live planet) |


**Note on Mantra and Personal Transits:** These two features use planet palette accents as their accent source, not a fixed feature gradient for chips and CTAs. Their visual identity is driven by the user's live planetary data. Full-screen behind them remains `CosmicBackground`. All other features use their fixed top gradient color on cards.

### 15.1 Where feature colors are used

**Dashboard feature cards:**

```
LinearGradient colors={[FEATURE.askAnything.top, FEATURE.askAnything.bottom]}
direction: top → bottom (or top-left → bottom-right for diagonal)
border-radius: r.xl (18px)
```

**Within the feature's own screen — chip borders and fills:**

```
chip background:  rgba(<feature.top>, 0.12)
chip border:      rgba(<feature.top>, 0.25)
active tab color: <feature.top>
CTA button bg:    rgba(<feature.top>, 0.15)
CTA button border:rgba(<feature.top>, 0.30)
CTA text color:   <feature.top>
```

**What feature colors do NOT affect:**

- CosmicBackground (fixed layered gradient — not replaced by feature or planet fills)
- Lifecycle badge colors (still driven by STATE tokens)
- Body copy and titles (still driven by TEXT tokens)
- Any screen where `accentSource === 'aurora'` (Mantra, Transits)

### 15.2 Dashboard card pattern

Each feature card on the dashboard uses:

- Gradient fill: `FEATURE.<key>.top → FEATURE.<key>.bottom`
- Icon: feature-specific glyph, `text.primary`
- Title: `DM Sans`, `14px`, `font-weight: 500`, `text.primary`
- Subtitle: `DM Sans`, `12px`, `text.secondary` — one line max
- Border: `rgba(<feature.top>, 0.15)` — a subtle tint of the feature color
- Border radius: `r.xl` (18px)
- Press state: `scale: 0.985` spring

**Rule:** Feature cards on the dashboard never embed planet aurora fills. The gradient fill is the identity. Behind the dashboard as a whole: `CosmicBackground` layered gradient; planet accents for chips map per `SCREEN_AURORA.dashboard` (`opacity: 0.5`) — not inside individual feature card bodies.

### 15.3 Consistency rule

When a user navigates from a dashboard feature card into that feature's screen, the same top color must appear as the accent on chips and CTAs inside the screen. This creates a visual continuity — tap the gold card → enter a screen with gold chips. The transition makes the feature feel cohesive even as `CosmicBackground` stays the ambient base and planet accent treatments may change.