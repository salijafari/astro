/**
 * One-off generator: writes src/data/tarot-cards.json (78 Rider–Waite–Smith cards).
 * Run: node scripts/generate-tarot-cards-json.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src/data/tarot-cards.json");

const BASE =
  "https://storage.googleapis.com/akhtar-assets/tarotcardimages/v1";

/** @param {string} id two-digit major id */
const majUrl = (id) => `${BASE}/maj${id}.jpg`;
const suitFile = (suit, n) =>
  `${BASE}/${suit}${String(n).padStart(2, "0")}.jpg`;

const majors = [
  {
    id: "00",
    displayNumber: "0",
    sortOrder: 1,
    astrologySign: "🜁",
    en: {
      title: "The Fool",
      description:
        "The Fool marks a threshold where innocence and curiosity open doors that caution would keep shut. It invites you to trust the next step even when the path is unclear, carrying hope without demanding guarantees.",
      keywords: ["beginnings", "innocence", "potential", "freedom", "spontaneity"],
    },
    fa: {
      title: "دیوانه",
      description:
        "دیوانه آغاز یک سفر تازه است؛ جایی که کودکیِ روح و شجاعتِ ساده، درهایی را می‌گشاید که ترس آن‌ها را می‌بندد. این کارت می‌گوید با اعتماد به گام بعدی، حتی در مه، می‌توان امید را حفظ کرد.",
      keywords: ["آغاز", "معصومیت", "پتانسیل", "آزادی", "خودانگیختگی"],
    },
  },
  {
    id: "01",
    displayNumber: "I",
    sortOrder: 2,
    astrologySign: "☿",
    en: {
      title: "The Magician",
      description:
        "The Magician channels focused will into tangible results by aligning tools, skill, and intention. It speaks to a moment when you have more agency than you think—if you choose deliberately and act with clarity.",
      keywords: ["manifestation", "skill", "focus", "resourcefulness", "power"],
    },
    fa: {
      title: "جادوگر",
      description:
        "جادوگر نماد هم‌راست‌کردن اراده، مهارت و ابزار است تا آگاهی به عمل بدل شود. این کارت می‌گوید اگر هدف را روشن کنی، همین حالا بیش از آن‌چه تصور می‌کنی دست‌تان برای آغاز باز است.",
      keywords: ["آفرینش", "مهارت", "تمرکز", "ابتکار", "قدرت"],
    },
  },
  {
    id: "02",
    displayNumber: "II",
    sortOrder: 3,
    astrologySign: "☽",
    en: {
      title: "The High Priestess",
      description:
        "The High Priestess guards the quiet archive of intuition and inner knowing beneath surface noise. She asks you to listen before you speak, and to trust patterns you feel before you can prove them.",
      keywords: ["intuition", "mystery", "inner wisdom", "patience", "sacred knowledge"],
    },
    fa: {
      title: "کاهنه اعظم",
      description:
        "کاهنه اعظم نگهبان دانسته‌های خاموش و شهودی است که از زیر پوست حوادث می‌آید. این کارت ترغیب می‌کند پیش از هر اقدامی به درون گوش کنی و به الگوهایی اعتماد کنی که هنوز در قالب منطق نیامده‌اند.",
      keywords: ["شهود", "راز", "دانش درونی", "صبر", "معنویت"],
    },
  },
  {
    id: "03",
    displayNumber: "III",
    sortOrder: 4,
    astrologySign: "♀",
    en: {
      title: "The Empress",
      description:
        "The Empress embodies fertile creativity, sensual comfort, and the steady nurture that helps life expand. She reminds you that care—of body, relationships, and ideas—is not indulgence; it is how abundance actually grows.",
      keywords: ["abundance", "creativity", "nurture", "beauty", "nature"],
    },
    fa: {
      title: "ملکه",
      description:
        "ملکه پدیدآورنده‌ی سرسبزی و لطافت است؛ جایی که مراقبت و خلاقیت با هم رشد می‌کنند. این کارت می‌گوید با مهربانی به خود و دیگران، فضای زندگی گسترده‌تر و پربارتر می‌شود.",
      keywords: ["فراوانی", "خلاقیت", "مراقبت", "زیبایی", "طبیعت"],
    },
  },
  {
    id: "04",
    displayNumber: "IV",
    sortOrder: 5,
    astrologySign: "♈️",
    en: {
      title: "The Emperor",
      description:
        "The Emperor stands for structure, responsibility, and the protective order that keeps chaos from eroding what matters. It is a call to lead with consistency—clear boundaries today prevent bigger fractures tomorrow.",
      keywords: ["authority", "structure", "discipline", "stability", "leadership"],
    },
    fa: {
      title: "امپراتور",
      description:
        "امپراتور نماد چارچوب، مسئولیت و نظمی است که از ارزش‌ها پاسداری می‌کند. این کارت یادآوری می‌کند رهبری واقعی با ثبات و مرزهای روشن ساخته می‌شود، نه با کنترل آسیب‌زا.",
      keywords: ["سلطه", "ساختار", "انضباط", "ثبات", "رهبری"],
    },
  },
  {
    id: "05",
    displayNumber: "V",
    sortOrder: 6,
    astrologySign: "♉",
    en: {
      title: "The Hierophant",
      description:
        "The Hierophant bridges inherited wisdom—teachings, rituals, and shared ethics—with your lived questions. It can signal mentorship and tradition, and also the discernment to honor what still serves while releasing what does not.",
      keywords: ["tradition", "belief", "mentorship", "study", "community"],
    },
    fa: {
      title: "کاهن اعظم",
      description:
        "کاهن اعظم پیونددهنده‌ی سنت و معناست؛ جایی که آموزه‌ها و آیین‌ها به پرسش‌های امروز پاسخ می‌دهند. این کارت می‌گوید از راهنما و جمع معنادار بیاموز، اما با خردی که بدانی چه چیزی هنوز زنده است.",
      keywords: ["سنت", "باور", "راهنما", "آموختن", "جامعه"],
    },
  },
  {
    id: "06",
    displayNumber: "VI",
    sortOrder: 7,
    astrologySign: "Gemini",
    en: {
      title: "The Lovers",
      description:
        "The Lovers highlights honest alignment—between values, desires, and the commitments you make to others. It is not only romance; it is the integrity of choosing with your whole self, even when the choice is difficult.",
      keywords: ["love", "choice", "union", "harmony", "values"],
    },
    fa: {
      title: "عاشقان",
      description:
        "عاشقان از هم‌راستی قلب و ارزش‌ها سخن می‌گوید؛ جایی که انتخاب، تعهد واقعی می‌سازد. این کارت فراتر از عاشقانه است: درباره‌ی این است که با تمام وجود انتخاب کنی، حتی وقتی راه ساده نیست.",
      keywords: ["عشق", "انتخاب", "یگانگی", "هماهنگی", "ارزش‌ها"],
    },
  },
  {
    id: "07",
    displayNumber: "VII",
    sortOrder: 8,
    astrologySign: "♋",
    en: {
      title: "The Chariot",
      description:
        "The Chariot is momentum born from inner resolve—opposing pulls held in balance by a clear aim. Victory here is not luck; it is the disciplined focus that turns obstacles into something you can steer through.",
      keywords: ["willpower", "momentum", "victory", "determination", "control"],
    },
    fa: {
      title: "ارابه",
      description:
        "ارابه نماد حرکت رو به جلو با اراده‌ای متمرکز است؛ وقتی نیروهای متضاد را هدایت می‌کنی. پیروزی اینجا از تمرکز پایدار می‌آید، نه از شانس ناگهانی.",
      keywords: ["اراده", "شتاب", "پیروزی", "تصمیم", "هدایت"],
    },
  },
  {
    id: "08",
    displayNumber: "VIII",
    sortOrder: 9,
    astrologySign: "♌",
    en: {
      title: "Strength",
      description:
        "Strength is courage with gentleness—softening fear without pretending danger away. It asks for compassionate endurance: steadying yourself so you can meet life’s intensity without cruelty or collapse.",
      keywords: ["courage", "compassion", "patience", "resilience", "influence"],
    },
    fa: {
      title: "قدرت",
      description:
        "قدرت ترکیبی از شجاعت و ملایمت است؛ روبه‌رو شدن با ترس بدون خشونت به خود یا دیگران. این کارت می‌گوید پایداری مهربانانه، راه را برای نفوذ واقعی باز می‌کند.",
      keywords: ["شجاعت", "مهربانی", "صبر", "تاب‌آوری", "نفوذ"],
    },
  },
  {
    id: "09",
    displayNumber: "IX",
    sortOrder: 10,
    astrologySign: "♍",
    en: {
      title: "The Hermit",
      description:
        "The Hermit turns the lamp inward, seeking truth away from performance and noise. Solitude becomes medicine here—not escape, but a deliberate retreat to hear what you already know beneath the crowd’s opinions.",
      keywords: ["introspection", "wisdom", "solitude", "guidance", "truth"],
    },
    fa: {
      title: "ناسک",
      description:
        "ناسک چراغ را به سوی درون می‌چرخاند تا از هیاهو دور شود و راستی را بشنود. تنهایی اینجا فرار نیست؛ آگاهانه‌ست برای شنیدن صدایی که جمع آن را خاموش می‌کند.",
      keywords: ["درون‌نگری", "دانایی", "تنهایی", "راهنما", "راستی"],
    },
  },
  {
    id: "10",
    displayNumber: "X",
    sortOrder: 11,
    astrologySign: "♃",
    en: {
      title: "Wheel of Fortune",
      description:
        "The Wheel of Fortune reminds you that seasons change—what lifts you today may test you tomorrow, and setbacks can pivot back into opportunity. The lesson is responsiveness: work with cycles instead of demanding a frozen outcome.",
      keywords: ["change", "luck", "cycles", "destiny", "turning point"],
    },
    fa: {
      title: "چرخ بخت",
      description:
        "چرخ بخت یادآور گردش فصل‌های زندگی است؛ بالا و پایینِ طبیعی که از کنترل مطلق بیرون است. پیامش این است که با چرخه‌ها هماهنگ شوی و انعطاف، تبدیل به فرصت شود.",
      keywords: ["تغییر", "شانس", "چرخه", "سرنوشت", "پیچیدگی"],
    },
  },
  {
    id: "11",
    displayNumber: "XI",
    sortOrder: 12,
    astrologySign: "♎",
    en: {
      title: "Justice",
      description:
        "Justice calls for clear-eyed fairness—measuring actions against principles and accepting consequences with maturity. It is not punishment for drama’s sake; it is the restoration of balance through honest accountability.",
      keywords: ["fairness", "truth", "law", "clarity", "consequence"],
    },
    fa: {
      title: "عدالت",
      description:
        "عدالت خواستار انصاف روشن و پذیرش پیامدهای راستین است. این کارت می‌گوید تعادل وقتی برمی‌گردد که راستی را ببینی و مسئولیت را جایی که لازم است بپذیری.",
      keywords: ["انصاف", "راستی", "قانون", "شفافیت", "پیامد"],
    },
  },
  {
    id: "12",
    displayNumber: "XII",
    sortOrder: 13,
    astrologySign: "🜄",
    en: {
      title: "The Hanged Man",
      description:
        "The Hanged Man asks for a willing pause—seeing from an unfamiliar angle until a stubborn problem loosens. Surrender here is strategic: you release the need to force, and insight arrives where struggle produced only noise.",
      keywords: ["pause", "perspective", "surrender", "release", "insight"],
    },
    fa: {
      title: "آویخته",
      description:
        "آویخته از توقف آگاهانه می‌گوید؛ دیدن از زاویه‌ای تازه تا گره‌ها باز شوند. تسلیم اینجا شکست نیست؛ رها کردن اصرار بی‌فایده است تا بینش جای جنگ را بگیرد.",
      keywords: ["توقف", "زاویه دید", "رها کردن", "آزادسازی", "بینش"],
    },
  },
  {
    id: "13",
    displayNumber: "XIII",
    sortOrder: 14,
    astrologySign: "♏",
    en: {
      title: "Death",
      description:
        "Death names an ending that clears space for a new shape of life—habits, identities, or situations that can no longer stay half-alive. It is transformation more than loss: grief may be present, but so is the honesty required for renewal.",
      keywords: ["transformation", "release", "closure", "renewal", "change"],
    },
    fa: {
      title: "مرگ",
      description:
        "مرگ پایان چیزی است که دیگر نمی‌تواند نیمه‌جان بماند تا فضا برای تازگی باز شود. این کارت بیش از ترس، دعوت به دگرگونی است؛ گاه با اندوه، اما همراه با امکان آغاز تازه.",
      keywords: ["دگرگونی", "رها کردن", "پایان", "تازگی", "تغییر"],
    },
  },
  {
    id: "14",
    displayNumber: "XIV",
    sortOrder: 15,
    astrologySign: "♐",
    en: {
      title: "Temperance",
      description:
        "Temperance blends opposites with patience—mixing hope with realism, action with rest, until something sustainable emerges. Healing is gradual here: small adjustments repeated until life feels steadier and kinder.",
      keywords: ["balance", "moderation", "healing", "patience", "integration"],
    },
    fa: {
      title: "اعتدال",
      description:
        "اعتدال ترکیب آگاهانه‌ی نیروهای متضاد است تا چیزی پایدار ساخته شود. بهبود اینجا تدریجی است؛ با تنظیم‌های کوچک که آرام‌آرام زندگی را متعادل‌تر می‌کنند.",
      keywords: ["تعادل", "میانه‌روی", "شفا", "صبر", "یکپارچگی"],
    },
  },
  {
    id: "15",
    displayNumber: "XV",
    sortOrder: 16,
    astrologySign: "♑",
    en: {
      title: "The Devil",
      description:
        "The Devil exposes bindings—patterns of craving, shame, or control that pretend to be inevitable. Naming the chain is the first freedom: once seen, the same energy can be redirected instead of running you in circles.",
      keywords: ["attachment", "shadow", "temptation", "restriction", "pattern"],
    },
    fa: {
      title: "شیطان",
      description:
        "شیطان گره‌های پنهان را نشان می‌دهد؛ وابستگی، ترس یا کنترلی که وابسته به آن شده‌ای. آگاهی نخستین گشایش است؛ وقتی ببینی، می‌توانی الگو را بشکنی یا جهتش را عوض کنی.",
      keywords: ["وابستگی", "سایه", "وسوسه", "محدودیت", "الگو"],
    },
  },
  {
    id: "16",
    displayNumber: "XVI",
    sortOrder: 17,
    astrologySign: "♂",
    en: {
      title: "The Tower",
      description:
        "The Tower brings sudden clarity through disruption—structures built on denial can crack open fast. Though jarring, the fall reveals what was unsustainable and frees you to rebuild on truer ground.",
      keywords: ["upheaval", "revelation", "breakthrough", "truth", "release"],
    },
    fa: {
      title: "برج",
      description:
        "برج ناگهان ساختارهای لرزان را فرو می‌ریزد تا راستی پدیدار شود. اگرچه شوک‌آور است، اغلب همان چیزی را باز می‌کند که بر پایه‌ی انکار بنا شده بود.",
      keywords: ["آشوب", "آشکار شدن", "شکستن", "راستی", "رهایی"],
    },
  },
  {
    id: "17",
    displayNumber: "XVII",
    sortOrder: 18,
    astrologySign: "♒",
    en: {
      title: "The Star",
      description:
        "The Star is quiet hope after difficulty—a gentle renewal of faith in purpose and belonging. It does not promise perfection, only sincerity: small steps toward healing that feel honest in the body and heart.",
      keywords: ["hope", "renewal", "inspiration", "healing", "calm"],
    },
    fa: {
      title: "ستاره",
      description:
        "ستاره نور آرامِ امید پس از سختی است؛ بازگشت ایمان به مسیر و جایگاه. وعده‌ی کمال نمی‌دهد؛ صداقت و شفابخشی تدریجی را می‌آورد.",
      keywords: ["امید", "تازگی", "الهام", "شفا", "آرامش"],
    },
  },
  {
    id: "18",
    displayNumber: "XVIII",
    sortOrder: 19,
    astrologySign: "♓",
    en: {
      title: "The Moon",
      description:
        "The Moon walks the border between intuition and illusion—dreams, anxieties, and half-seen truths swirling together. Move slowly: verify feelings without shaming them, and seek grounding facts when imagination runs wild.",
      keywords: ["intuition", "dreams", "uncertainty", "subconscious", "fear"],
    },
    fa: {
      title: "ماه",
      description:
        "ماه مرز شهود و توهم را می‌پیماید؛ جایی که رویا، ترس و حقیقتِ نیمه‌پنهان درهم می‌آمیزند. آهسته برو؛ احساس را بشناس، اما برای آرامش، زمینِ واقعیت را هم زیر پا نگه دار.",
      keywords: ["شهود", "رویا", "ابهام", "ناخودآگاه", "ترس"],
    },
  },
  {
    id: "19",
    displayNumber: "XIX",
    sortOrder: 20,
    astrologySign: "☉",
    en: {
      title: "The Sun",
      description:
        "The Sun radiates warmth, vitality, and the simple joy of being seen as you are. Confidence grows naturally here—success feels embodied rather than performative, and life’s color returns after gray seasons.",
      keywords: ["joy", "vitality", "success", "clarity", "warmth"],
    },
    fa: {
      title: "خورشید",
      description:
        "خورشید گرمی، جان و شادیِ دیده شدنِ راستین را می‌آورد. اعتماد اینجا در بدن حس می‌شود؛ موفقیت نمایش نیست، حضور زنده است.",
      keywords: ["شادی", "سرزندگی", "موفقیت", "روشنی", "گرمی"],
    },
  },
  {
    id: "20",
    displayNumber: "XX",
    sortOrder: 21,
    astrologySign: "🜂",
    en: {
      title: "Judgement",
      description:
        "Judgement sounds a call to rise—reviewing the past without drowning in it, and answering a deeper sense of purpose. It is rebirth through honest reckoning: integrating lessons so you can move forward unburdened.",
      keywords: ["rebirth", "calling", "forgiveness", "awakening", "integration"],
    },
    fa: {
      title: "داوری",
      description:
        "داوری بیدارکننده‌ی مسئولیت روحی است؛ نگاهی دوباره به گذشته بدون غرق شدن در آن. تولدی دوباره از روی پاسخ به صدای درونی که می‌گوید حالا وقت جهش است.",
      keywords: ["تولد دوباره", "ندا", "آمرزش", "بیداری", "یکپارچگی"],
    },
  },
  {
    id: "21",
    displayNumber: "XXI",
    sortOrder: 22,
    astrologySign: "♄",
    en: {
      title: "The World",
      description:
        "The World completes a cycle with integration—you carry wisdom forward instead of repeating the same lesson on loop. It speaks of wholeness and movement at once: closure that does not cage you, but launches the next chapter.",
      keywords: ["completion", "wholeness", "travel", "achievement", "integration"],
    },
    fa: {
      title: "جهان",
      description:
        "جهان پایان یک دور با یکپارچگی است؛ حکمتی که همراهت می‌ماند تا دوباره همان داستان تکرار نشود. کامل شدن اینجا باز شدن در به فصل تازه است، نه ایستادن.",
      keywords: ["کمال نسبی", "یکپارچگی", "سفر", "دستاورد", "پیوند"],
    },
  },
];

/** Traditional two-sentence blurbs per minor id (w01..w14, c01.., s01.., p01..). */
const MINOR = {
  w01: {
    en: "A bold spark of inspiration asks for a courageous first move. Creative energy is available—channel it before the moment cools.",
    fa: "جرقه‌ای از الهام می‌خواهد جرأتِ اولین گام را داشته باشی. انرژی آفرینش هست؛ پیش از خاموشی، آن را به کار بند.",
    enKw: ["spark", "inspiration", "will", "creativity", "potential"],
    faKw: ["جرقه", "الهام", "اراده", "خلاقیت", "پتانسیل"],
  },
  w02: {
    en: "You weigh a path between comfort and expansion, holding power you have not fully claimed. Planning matters, but so does committing before options multiply into paralysis.",
    fa: "میان امنیت و گسترش در می‌زنی؛ قدرتی داری که هنوز کامل نپذیرفته‌ای. اندیشیدن خوب است، اما تعهد پیش از انبوه شدن گزینه‌ها ضروری است.",
    enKw: ["planning", "choice", "power", "vision", "tension"],
    faKw: ["برنامه", "انتخاب", "قدرت", "چشم‌انداز", "کشش"],
  },
  w03: {
    en: "Momentum builds as allies gather and horizons widen. Keep communication clear so shared excitement becomes real progress.",
    fa: "شتاب می‌گیرد؛ همراهان و افق‌ها گسترده می‌شوند. گفتگوی روشن، هیجان مشترک را به پیشروی واقعی بدل می‌کند.",
    enKw: ["expansion", "collaboration", "foresight", "progress", "trade"],
    faKw: ["گسترش", "همکاری", "دوراندیشی", "پیشروی", "تبادل"],
  },
  w04: {
    en: "Stability and celebration meet—home, community, or a milestone worth honoring. Gratitude anchors the joy so it lasts beyond a single moment.",
    fa: "ثبات و شادی با هم می‌آیند؛ خانه، جمع یا دستاوردی که باید دیده شود. سپاس، شادی را نگه می‌دارد تا فقط یک لحظه نماند.",
    enKw: ["celebration", "home", "harmony", "community", "gratitude"],
    faKw: ["جشن", "خانه", "هماهنگی", "جمع", "سپاس"],
  },
  w05: {
    en: "Friction surfaces as different agendas compete for the same space. Healthy conflict can sharpen you—just avoid turning every debate into identity warfare.",
    fa: "اصطکاک می‌آید؛ دستورکارهای مختلف در یک فضا رقابت می‌کنند. کشمکش سالم می‌تواند تیزتان کند؛ اگر هر بحث به جنگ هویت نشود.",
    enKw: ["conflict", "competition", "tension", "rivalry", "energy"],
    faKw: ["تنش", "رقابت", "کشمکش", "رقیب", "انرژی"],
  },
  w06: {
    en: "Recognition arrives—visibility for effort and a chance to lead by example. Stay generous in victory so success does not isolate you.",
    fa: "دیده شدن می‌آید؛ تلاش به رسمیت می‌رسد و الگو بودن ممکن می‌شود. در پیروزی سخاوت بورز تا موفقیتت تنهایت نکند.",
    enKw: ["recognition", "victory", "pride", "leadership", "visibility"],
    faKw: ["دیده شدن", "پیروزی", "افتخار", "رهبری", "نمایان بودن"],
  },
  w07: {
    en: "You stand your ground while pressure tests your resolve. Courage is maintaining boundaries without needless aggression.",
    fa: "زیر فشار ایستاده‌ای؛ مرزها آزمایش می‌شوند. شجاعت یعنی نگه داشتن خط قرمزها بی‌خشونت اضافه.",
    enKw: ["defense", "perseverance", "boundaries", "challenge", "resolve"],
    faKw: ["دفاع", "پایداری", "مرزها", "چالش", "اراده"],
  },
  w08: {
    en: "Movement accelerates—messages, travel, or ideas arriving in a rush. Stay nimble: speed rewards focus, but scatter splits results.",
    fa: "حرکت تند می‌شود؛ پیام، سفر یا ایده‌ها پشت‌سرهم می‌رسند. چابک باش؛ سرعت با تمرکز خوب است، پراکندگی نتیجه را می‌شکند.",
    enKw: ["speed", "travel", "news", "momentum", "action"],
    faKw: ["سرعت", "سفر", "خبر", "شتاب", "اقدام"],
  },
  w09: {
    en: "Resilience is tested; you may feel guarded after past battles. Strength here is knowing when to rest without surrendering the mission.",
    fa: "تاب‌آوری محک می‌خورد؛ شاید محتاط شده‌ای پس از نبردها. قدرت این است بدانی کی استراحت کنی بی‌آن‌که هدف را رها کنی.",
    enKw: ["resilience", "caution", "stamina", "boundaries", "courage"],
    faKw: ["تاب‌آوری", "احتیاط", "استقامت", "مرزها", "شجاعت"],
  },
  w10: {
    en: "Burden accumulates—responsibilities carried past a healthy limit. Delegation and prioritization are not luxuries; they are how you protect your fire.",
    fa: "بار سنگین می‌شود؛ مسئولیت‌هایی فراتر از حد سالم. واگذاری و اولویت‌بندی تجمل نیست؛ حفظ آتش درون است.",
    enKw: ["burden", "stress", "responsibility", "overload", "completion"],
    faKw: ["بار", "استرس", "مسئولیت", "فرسودگی", "پایان"],
  },
  w11: {
    en: "Curious energy explores new skills and messages worth sharing. Stay teachable—enthusiasm opens doors when paired with follow-through.",
    fa: "انرژی کنجکاو مهارت تازه و پیامی برای گفتن می‌جوید. پذیرای یادگیری بمان؛ شوق با پیگیری، درها را باز می‌کند.",
    enKw: ["exploration", "learning", "curiosity", "messages", "discovery"],
    faKw: ["کاوش", "یادگیری", "کنجکاوی", "پیام", "کشف"],
  },
  w12: {
    en: "Passion charges forward—adventure, charisma, and a willingness to chase the horizon. Channel impulsiveness into purposeful motion.",
    fa: "شور به پیش می‌رود؛ ماجراجویی، جذابیت و تعقیب افق. تکان ناگهانی را به حرکت هدفمند بدل کن.",
    enKw: ["adventure", "passion", "charisma", "action", "courage"],
    faKw: ["ماجراجویی", "شور", "جذابیت", "اقدام", "شجاعت"],
  },
  w13: {
    en: "Magnetism and confidence lead with warmth. Nurture what you influence—leadership is care sustained over time.",
    fa: "جذابیت و اطمینان با گرمی پیش می‌روند. آنچه تحت تأثیر داری پرورش بده؛ رهبری یعنی مراقبت پایدار.",
    enKw: ["confidence", "warmth", "leadership", "charisma", "nurture"],
    faKw: ["اعتماد به نفس", "گرمی", "رهبری", "جذابیت", "مراقبت"],
  },
  w14: {
    en: "Vision meets responsibility—you shape outcomes and set tone for others. Integrity turns authority into service instead of control.",
    fa: "بینش با مسئولیت می‌آید؛ بر نتیجه و فضا اثر می‌گذاری. یکپارچگی، قدرت را به خدمت بدل می‌کند نه کنترل.",
    enKw: ["authority", "vision", "mastery", "integrity", "leadership"],
    faKw: ["صلاحیت", "چشم‌انداز", "تسلط", "یکپارچگی", "رهبری"],
  },
  c01: {
    en: "A new emotional beginning stirs—love, healing, or creative feeling opening in the heart. Let it be sincere rather than performative.",
    fa: "آغاز احساسی تازه؛ عشق، شفا یا خلاقیت در دل. بگذار صمیمی باشد نمایشی نه.",
    enKw: ["love", "new feeling", "intimacy", "healing", "openness"],
    faKw: ["عشق", "احساس تازه", "صمیمیت", "شفا", "گشودگی"],
  },
  c02: {
    en: "Connection deepens through mutual recognition and gentle balance. Vulnerability becomes strength when met with respect.",
    fa: "پیوند با دیده شدن متقابل و تعادل لطیف عمیق می‌شود. آسیب‌پذیری وقتی با احترام همراه است، قوت می‌گیرد.",
    enKw: ["partnership", "union", "attraction", "harmony", "trust"],
    faKw: ["همراهی", "پیوند", "جذابیت", "هماهنگی", "اعتماد"],
  },
  c03: {
    en: "Joy shared multiplies—friendship, celebration, and creative collaboration bloom. Community reminds you that you do not have to carry happiness alone.",
    fa: "شادی که تقسیم شود می‌بالد؛ دوستی، جشن و هم‌سازی. جمع به تو یادآوری می‌کند شادی را تنها حمل نکنی.",
    enKw: ["friendship", "joy", "community", "creativity", "celebration"],
    faKw: ["دوستی", "شادی", "جمع", "خلاقیت", "جشن"],
  },
  c04: {
    en: "Emotional fatigue or apathy may dull what once felt meaningful. Name what you avoid—honest rest can refill the cup better than numb scrolling.",
    fa: "خستگی یا بی‌تفاوتی رنگ می‌برد. آنچه را طفره می‌روی نام ببر؛ استراحت راستین بهتر از بی‌حسی است.",
    enKw: ["apathy", "reevaluation", "contemplation", "stagnation", "withdrawal"],
    faKw: ["بی‌تفاوتی", "بازاندیشی", "تأمل", "رکود", "کناره‌گیری"],
  },
  c05: {
    en: "Loss colors the scene, yet not everything valuable is gone. Grief acknowledged becomes a bridge—not a permanent residence.",
    fa: "غم صحنه را رنگ می‌زند اما همه چیز نیست. غمی که دیده شود پل می‌شود، نه اقامتگاه دائم.",
    enKw: ["grief", "regret", "loss", "acceptance", "perspective"],
    faKw: ["غم", "پشیمانی", "از دست دادن", "پذیرش", "دید"],
  },
  c06: {
    en: "Memory and tenderness return—nostalgia, childhood echoes, or kindness revisited. Let the past teach without trapping you there.",
    fa: "خاطره و لطافت برمی‌گردد؛ نوستالژی یا مهربانی قدیمی. بگذار گذشته درس بدهد بدون زندان کردنت.",
    enKw: ["nostalgia", "innocence", "memories", "reunion", "kindness"],
    faKw: ["نوستالژی", "معصومیت", "خاطره", "دیدار", "مهربانی"],
  },
  c07: {
    en: "Many possibilities shimmer—desire, fantasy, and distraction compete. Discernment turns imagination into a map instead of a fog.",
    fa: "گزینه‌ها می‌درخشند؛ آرزو، خیال و حواس‌پرتی رقابت می‌کنند. تشخیص، خیال را به نقشه بدل می‌کند نه مه.",
    enKw: ["choices", "illusion", "wishful thinking", "imagination", "clarity"],
    faKw: ["انتخاب", "توهم", "آرزو", "خیال", "روشنی"],
  },
  c08: {
    en: "Walking away can be wisdom when a situation no longer feeds the soul. Release guilt for choosing integrity over comfort.",
    fa: "کناره‌گیری گاه حکمت است وقتی چیزی جان نمی‌دهد. احساس گناه نکن اگر یکپارچگی را به راحتی ترجیح دادی.",
    enKw: ["departure", "letting go", "seeking meaning", "courage", "transition"],
    faKw: ["ترک", "رها کردن", "معنا", "شجاعت", "گذار"],
  },
  c09: {
    en: "Emotional satisfaction and gratitude settle in—wishes met enough to notice. Enjoy without clinging; contentment grows in open hands.",
    fa: "رضایت و سپاس می‌نشیند؛ آرزوها به اندازه‌ای برآورده شده‌اند. بدون چسبندگی لذت ببر؛ قناعت در دستان باز رشد می‌کند.",
    enKw: ["satisfaction", "gratitude", "comfort", "wish fulfillment", "joy"],
    faKw: ["رضایت", "سپاس", "آسایش", "برآورده شدن", "شادی"],
  },
  c10: {
    en: "Harmony at home and heart—family, chosen kin, or emotional security fulfilled. Blessings multiply when shared openly.",
    fa: "هماهنگی در خانه و دل؛ خانواده، خویشاگان برگزیده یا امنیت احساسی. نعمت با شفافیت بیشتر می‌شود.",
    enKw: ["family", "harmony", "emotional security", "legacy", "love"],
    faKw: ["خانواده", "هماهنگی", "امنیت احساسی", "میراث", "عشق"],
  },
  c11: {
    en: "Sensitive curiosity and gentle messages arrive—learning love’s language in small gestures. Listening opens doors that force cannot.",
    fa: "کنجکاوی لطیف و پیام‌های نرم می‌آید؛ زبان عشق در حرکات کوچک. شنیدن درهایی را باز می‌کند که زور نمی‌تواند.",
    enKw: ["sensitivity", "messages", "learning", "gentleness", "curiosity"],
    faKw: ["حساسیت", "پیام", "یادگیری", "ملایمت", "کنجکاوی"],
  },
  c12: {
    en: "Romance and idealism surge—following the heart toward beauty or risk. Balance dreams with a compass so you do not lose the shore.",
    fa: "عاشقانه و آرمان بالا می‌گیرد؛ دنبال کردن دل به سوی زیبایی یا خطر. رویا را با قطب‌نما متعادل کن تا ساحل را گم نکنی.",
    enKw: ["romance", "idealism", "charm", "adventure", "heart"],
    faKw: ["عاشقانه", "آرمان", "جذابیت", "ماجراجویی", "قلب"],
  },
  c13: {
    en: "Deep empathy and intuitive care hold space for others. Boundaries keep compassion from becoming self-erasure.",
    fa: "همدلی عمیق و مراقبت شهودی فضا می‌سازد. مرزها مهربانی را از محو شدنت نگه می‌دارند.",
    enKw: ["compassion", "intuition", "nurture", "empathy", "calm"],
    faKw: ["مهربانی", "شهود", "مراقبت", "همدلی", "آرامش"],
  },
  c14: {
    en: "Emotional maturity steadies the room—support without drama, leadership with tenderness. You model stability others can trust.",
    fa: "بلوغ احساسی فضا را آرام می‌کند؛ حمایت بی‌غوغا، رهبری با لطافت. ثباتی را نمایش می‌دهی که دیگران به آن اعتماد کنند.",
    enKw: ["maturity", "support", "calm", "leadership", "generosity"],
    faKw: ["بلوغ", "حمایت", "آرامش", "رهبری", "سخاوت"],
  },
  s01: {
    en: "A breakthrough of mental clarity cuts through confusion like a clean blade. Truth arrives with force—use it to protect integrity, not to wound for sport.",
    fa: "روشنی تازه‌ی ذهن مه را می‌شکافد. راستی با قدرت می‌آید؛ برای پاسداری از یکپارچگی به کارش ببر، نه برای زخم زدن بی‌مورد.",
    enKw: ["clarity", "truth", "breakthrough", "focus", "justice"],
    faKw: ["روشنی", "راستی", "شکستن مه", "تمرکز", "انصاف"],
  },
  s02: {
    en: "Stalemate protects you until you are ready to see. Blindfolds fall when you stop debating and start listening inward.",
    fa: "بن‌بست تا آماده‌ی دیدن شوی نگهت می‌دارد. وقتی بحث را رها کنی و به درون گوش کنی، چشم‌بند می‌افتد.",
    enKw: ["indecision", "avoidance", "stalemate", "peace", "inner truth"],
    faKw: ["تردید", "اجتناب", "بن‌بست", "صلح", "راستی درونی"],
  },
  s03: {
    en: "Heartache and harsh truths arrive—painful, but clarifying. Naming the wound is how healing begins.",
    fa: "دل‌شکستگی و راستی‌های تلخ می‌آیند؛ دردناک اما روشنگر. نامیدن زخم، آغاز شفاست.",
    enKw: ["heartbreak", "sorrow", "truth", "release", "clarity"],
    faKw: ["شکست قلب", "اندوه", "راستی", "رها شدن", "روشنی"],
  },
  s04: {
    en: "Rest restores the mind—recovery after strain, truce after conflict. Peace is productive when it is chosen, not imposed by fear.",
    fa: "استراحت ذهن را می‌آورد؛ بهبود پس از فشار، آتش‌بس پس از کشمکش. آرامش وقتی سازنده است که انتخاب شود نه از ترس تحمیل.",
    enKw: ["rest", "recovery", "contemplation", "peace", "healing"],
    faKw: ["استراحت", "بهبود", "تأمل", "صلح", "شفا"],
  },
  s05: {
    en: "A hollow win may cost trust—victory without honor rings empty. Consider what you are willing to sacrifice for being right.",
    fa: "پیروزی توخالی اعتماد را می‌خورد؛ برتری بی‌شرافت تهی است. ببین برای «حق بودن» چه می‌فروشی.",
    enKw: ["conflict", "defeat", "ego", "tension", "consequence"],
    faKw: ["کشمکش", "شکست", "منیت", "تنش", "پیامد"],
  },
  s06: {
    en: "Transition across troubled water—moving toward calmer shores even while grief lingers. Help can appear if you accept passage rather than fighting the current.",
    fa: "گذار از آب‌های آشفته به ساحل آرام‌تر؛ حتی اگر غم بماند. اگر جریان را بپذیری، کمک می‌رسد.",
    enKw: ["transition", "healing", "travel", "recovery", "hope"],
    faKw: ["گذار", "شفا", "سفر", "بهبود", "امید"],
  },
  s07: {
    en: "Strategy and subtlety—choosing timing over brute force. Not everything honest must be shouted; discernment is its own protection.",
    fa: "راهبرد و ظرافت؛ زمان‌سنجی به‌جای زور. همه‌ی راستی‌ها را نباید فریاد زد؛ تشخیص خود محافظت است.",
    enKw: ["strategy", "stealth", "caution", "planning", "independence"],
    faKw: ["راهبرد", "محتاطی", "احتیاط", "برنامه", "استقلال"],
  },
  s08: {
    en: "Feeling trapped is often mental—options exist but fear narrows the lens. Gentle steps loosen bonds faster than panic.",
    fa: "احساس تله اغلب ذهنی است؛ گزینه هست اما ترس لنز را تنگ می‌کند. گام‌های آرام، گره را بازتر از هراس می‌کند.",
    enKw: ["restriction", "anxiety", "victim mindset", "fear", "liberation"],
    faKw: ["محدودیت", "اضطراب", "ذهنیت قربانی", "ترس", "رهایی"],
  },
  s09: {
    en: "Anxiety and sleepless worry spiral—mind rehearsing worst cases. Compassion for fear calms the storm better than self-attack.",
    fa: "نگرانی و خواب‌آشفتهگی؛ ذهن بدترین‌ها را تمرین می‌کند. مهربانی با ترس، طوفان را آرام‌تر از سرزنش خود می‌کند.",
    enKw: ["anxiety", "worry", "fear", "nightmares", "stress"],
    faKw: ["اضطراب", "نگرانی", "ترس", "کابوس", "استرس"],
  },
  s10: {
    en: "An ending hits rock bottom—and that can be the honest floor to rebuild from. Surrender the story that you must suffer alone.",
    fa: "پایانی به تهِ ته می‌رسد؛ کف راستی برای ساختن دوباره. روایت «باید تنها رنج ببرم» را رها کن.",
    enKw: ["endings", "collapse", "release", "truth", "renewal"],
    faKw: ["پایان", "فروپاشی", "رها کردن", "راستی", "تازگی"],
  },
  s11: {
    en: "Keen observation and honest questions—curiosity without cruelty. Words can heal when chosen with precision.",
    fa: "نگاه تیز و پرسش راست؛ کنجکاوی بی‌قساوت. واژه‌ها وقتی دقیق‌اند، شفابخش می‌شوند.",
    enKw: ["curiosity", "truth-seeking", "communication", "alertness", "learning"],
    faKw: ["کنجکاوی", "جستجوی راستی", "ارتباط", "هوشیاری", "یادگیری"],
  },
  s12: {
    en: "Intellect charges ahead—debate, drive, and a hunger for justice. Channel intensity so truth does not become a weapon.",
    fa: "خرد با شتاب می‌آید؛ بحث، حرکت و تشنگی عدالت. شدت را هدایت کن تا راستی سلاح نشود.",
    enKw: ["assertiveness", "action", "intellect", "courage", "debate"],
    faKw: ["جسارت", "اقدام", "خرد", "شجاعت", "مناظره"],
  },
  s13: {
    en: "Clear boundaries and candid insight—compassion with edges. You protect what matters by speaking plainly.",
    fa: "مرزهای روشن و دید رک؛ مهربانی با حد. با گفتن صریح از چیزهای مهم پاسداری می‌کنی.",
    enKw: ["independence", "objectivity", "boundaries", "honesty", "clarity"],
    faKw: ["استقلال", "بی‌طرفی", "مرزها", "راستگویی", "روشنی"],
  },
  s14: {
    en: "Mental authority and ethical judgment—decisions that weigh consequences for everyone. Lead with reason guided by fairness.",
    fa: "صلاحیت فکری و داوری اخلاقی؛ تصمیم با پیامد برای همه. با عقل همراه انصاف رهبری کن.",
    enKw: ["authority", "truth", "decision", "logic", "justice"],
    faKw: ["صلاحیت", "راستی", "تصمیم", "منطق", "عدالت"],
  },
  p01: {
    en: "A tangible opportunity arrives—seed money, a job thread, or health momentum worth nurturing. Ground inspiration in practical next steps.",
    fa: "فرصت ملموس می‌آید؛ سرمایه‌ی کوچک، سرنخ کاری یا شروعی برای سلامت. الهام را به گام‌های عملی ببند.",
    enKw: ["opportunity", "manifestation", "resources", "prosperity", "grounding"],
    faKw: ["فرصت", "آفرینش", "منابع", "رزق", "زمین‌کردن"],
  },
  p02: {
    en: "Juggling demands teaches rhythm—adaptability keeps the coins in the air. Balance is motion, not frozen perfection.",
    fa: "ژاگل کردن مسئولیت‌ها ریتم می‌آموزد؛ انعطاف سکه‌ها را بالا نگه می‌دارد. تعادل حرکت است نه کمال یخی.",
    enKw: ["adaptability", "balance", "multitasking", "flexibility", "priorities"],
    faKw: ["انعطاف", "تعادل", "چندوظیفگی", "چابکی", "اولویت‌ها"],
  },
  p03: {
    en: "Craft, teamwork, and skill-building elevate a shared project. Mastery grows through repetition and honest feedback.",
    fa: "صنعت، همکاری و ساختن مهارت پروژه را بالا می‌برد. تسلط با تکرار و بازخورد راستین رشد می‌کند.",
    enKw: ["collaboration", "skill", "craft", "teamwork", "quality"],
    faKw: ["همکاری", "مهارت", "صنعت", "کار جمعی", "کیفیت"],
  },
  p04: {
    en: "Holding tight may protect what you have, yet also limit growth. Security and generosity can coexist with clear boundaries.",
    fa: "چسبیدن سفت می‌تواند دارایی را نگه دارد و رشد را محدود کند. امنیت و سخاوت با مرز روشن کنار هم‌اند.",
    enKw: ["security", "control", "conservation", "stability", "attachment"],
    faKw: ["امنیت", "کنترل", "نگهداری", "ثبات", "وابستگی"],
  },
  p05: {
    en: "Hardship highlights what needs care—health, money, or belonging under strain. Ask for help; pride is expensive in winter.",
    fa: "سختی آنچه نیاز به مراقبت دارد را نشان می‌دهد؛ سلامت، مالی یا جا ماندن. کمک بخواه؛ غرور در زمستان گران است.",
    enKw: ["hardship", "poverty", "health", "isolation", "compassion"],
    faKw: ["سختی", "تنگدستی", "سلامت", "تنهایی", "همدلی"],
  },
  p06: {
    en: "Giving and receiving find balance—charity with dignity, aid that restores agency. Fair exchange heals more than one-sided rescue.",
    fa: "بخشش و گرفتن متعادل می‌شود؛ کمک با حرمت و بازگرداندن اختیار. تبادل عادلانه بیش از نجات یک‌طرفه شفا می‌دهد.",
    enKw: ["generosity", "charity", "fairness", "sharing", "recovery"],
    faKw: ["سخاوت", "نیکوکاری", "انصاف", "تقسیم", "بهبود"],
  },
  p07: {
    en: "Patient investment—results ripen slowly like a tended garden. Pause to assess progress instead of yanking roots in doubt.",
    fa: "سرمایه‌گذاری صبور؛ نتیجه مثل باغ آرام می‌رسد. برای ارزیابی توقف کن؛ ریشه را از تردید نکش.",
    enKw: ["patience", "long-term", "investment", "assessment", "growth"],
    faKw: ["صبر", "بلندمدت", "سرمایه‌گذاری", "ارزیابی", "رشد"],
  },
  p08: {
    en: "Dedication to craft—apprenticeship, repetition, and pride in doing the work well. Mastery is love expressed through practice.",
    fa: "وفاداری به کار؛ شاگردی، تکرار و غرورِ درست انجام دادن. تسلط عشق است که در تمرین نشان داده می‌شود.",
    enKw: ["mastery", "diligence", "skill", "craft", "commitment"],
    faKw: ["تسلط", "سخت‌کوشی", "مهارت", "صنعت", "تعهد"],
  },
  p09: {
    en: "Self-sufficiency bears fruit—comfort earned through effort and self-respect. Independence shines when paired with gratitude.",
    fa: "خودکفایی بار می‌دهد؛ آسایش با تلاش و احترام به خود. استقلال وقتی درخشد که با سپاس همراه است.",
    enKw: ["independence", "comfort", "luxury", "discipline", "gratitude"],
    faKw: ["استقلال", "آسایش", "رفاه", "انضباط", "سپاس"],
  },
  p10: {
    en: "Legacy and lineage—wealth as responsibility, family continuity, and long-term security. Share the table; abundance is meant to circulate.",
    fa: "میراث و پیوستگی؛ ثروت به‌مثابه مسئولیت، امنیت خانوادگی. سفره را بشکن؛ فراوانی باید بچرخد.",
    enKw: ["legacy", "family", "wealth", "stability", "inheritance"],
    faKw: ["میراث", "خانواده", "ثروت", "ثبات", "ارث"],
  },
  p11: {
    en: "Curious diligence explores practical learning—studying systems that improve daily life. Small experiments compound into skill.",
    fa: "کوشش کنجکاوانه‌ی عملی؛ یادگیری سامانه‌هایی که زندگی روزانه را بهتر می‌کنند. آزمایش‌های کوچک، مهارت می‌سازند.",
    enKw: ["study", "ambition", "learning", "practicality", "curiosity"],
    faKw: ["آموختن", "جاه‌طلبی", "یادگیری", "عملی بودن", "کنجکاوی"],
  },
  p12: {
    en: "Steady effort moves the material world—reliable, patient, and thorough. Slow progress still crosses the finish line.",
    fa: "تلاش پیوسته دنیا را جابه‌جا می‌کند؛ مطمئن، صبور و دقیق. پیشروی آهسته هم به خط پایان می‌رسد.",
    enKw: ["diligence", "routine", "reliability", "patience", "progress"],
    faKw: ["سخت‌کوشی", "روال", "اعتماد", "صبر", "پیشرفت"],
  },
  p13: {
    en: "Nurturing abundance—practical care that helps everyone thrive. Resourcefulness turns limits into sustainable comfort.",
    fa: "پرورش فراوانی؛ مراقبت عملی که به همه رسد. ابتکار، محدودیت را به آسایش پایدار بدل می‌کند.",
    enKw: ["nurture", "practical care", "abundance", "generosity", "grounding"],
    faKw: ["مراقبت", "عملی", "فراوانی", "سخاوت", "زمین‌گیری"],
  },
  p14: {
    en: "Mastery of resources—security without greed, leadership through stewardship. You build a foundation others can rely on.",
    fa: "تسلط بر منابع؛ امنیت بی‌حریص‌گری، رهبری با نگهبانی. بنایی می‌سازی که دیگران بتوانند به آن تکیه کنند.",
    enKw: ["security", "leadership", "prosperity", "discipline", "generosity"],
    faKw: ["امنیت", "رهبری", "رزق", "انضباط", "سخاوت"],
  },
};

const rankDisplay = [
  "Ace",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "Page",
  "Knight",
  "Queen",
  "King",
];
const rankFa = [
  "آس",
  "دو",
  "سه",
  "چهار",
  "پنج",
  "شش",
  "هفت",
  "هشت",
  "نه",
  "ده",
  "صفحه",
  "شوالیه",
  "ملکه",
  "پادشاه",
];

const suits = [
  { key: "w", suit: "wands", file: "wands", faSuit: "عصاها", sortBase: 23 },
  { key: "c", suit: "cups", file: "cups", faSuit: "جام‌ها", sortBase: 37 },
  { key: "s", suit: "swords", file: "swords", faSuit: "شمشیرها", sortBase: 51 },
  { key: "p", suit: "pentacles", file: "pents", faSuit: "سکه‌ها", sortBase: 65 },
];

const enTitles = {
  w01: "Ace of Wands",
  w02: "Two of Wands",
  w03: "Three of Wands",
  w04: "Four of Wands",
  w05: "Five of Wands",
  w06: "Six of Wands",
  w07: "Seven of Wands",
  w08: "Eight of Wands",
  w09: "Nine of Wands",
  w10: "Ten of Wands",
  w11: "Page of Wands",
  w12: "Knight of Wands",
  w13: "Queen of Wands",
  w14: "King of Wands",
  c01: "Ace of Cups",
  c02: "Two of Cups",
  c03: "Three of Cups",
  c04: "Four of Cups",
  c05: "Five of Cups",
  c06: "Six of Cups",
  c07: "Seven of Cups",
  c08: "Eight of Cups",
  c09: "Nine of Cups",
  c10: "Ten of Cups",
  c11: "Page of Cups",
  c12: "Knight of Cups",
  c13: "Queen of Cups",
  c14: "King of Cups",
  s01: "Ace of Swords",
  s02: "Two of Swords",
  s03: "Three of Swords",
  s04: "Four of Swords",
  s05: "Five of Swords",
  s06: "Six of Swords",
  s07: "Seven of Swords",
  s08: "Eight of Swords",
  s09: "Nine of Swords",
  s10: "Ten of Swords",
  s11: "Page of Swords",
  s12: "Knight of Swords",
  s13: "Queen of Swords",
  s14: "King of Swords",
  p01: "Ace of Pentacles",
  p02: "Two of Pentacles",
  p03: "Three of Pentacles",
  p04: "Four of Pentacles",
  p05: "Five of Pentacles",
  p06: "Six of Pentacles",
  p07: "Seven of Pentacles",
  p08: "Eight of Pentacles",
  p09: "Nine of Pentacles",
  p10: "Ten of Pentacles",
  p11: "Page of Pentacles",
  p12: "Knight of Pentacles",
  p13: "Queen of Pentacles",
  p14: "King of Pentacles",
};

const deck = [];

for (const m of majors) {
  deck.push({
    id: m.id,
    arcana: "major",
    suit: null,
    displayNumber: m.displayNumber,
    sortOrder: m.sortOrder,
    astrologySign: m.astrologySign,
    imageUrl: majUrl(m.id),
    en: {
      title: m.en.title,
      description: m.en.description,
      keywords: m.en.keywords,
    },
    fa: {
      title: m.fa.title,
      description: m.fa.description,
      keywords: m.fa.keywords,
    },
  });
}

for (const su of suits) {
  for (let i = 0; i < 14; i++) {
    const id = `${su.key}${String(i + 1).padStart(2, "0")}`;
    const bl = MINOR[id];
    if (!bl) throw new Error(`Missing minor ${id}`);
    const titleFa = `${rankFa[i]} ${su.faSuit}`;
    deck.push({
      id,
      arcana: "minor",
      suit: su.suit,
      displayNumber: rankDisplay[i],
      sortOrder: su.sortBase + i,
      astrologySign: null,
      imageUrl: suitFile(su.file, i + 1),
      en: {
        title: enTitles[id],
        description: bl.en,
        keywords: bl.enKw,
      },
      fa: {
        title: titleFa,
        description: bl.fa,
        keywords: bl.faKw,
      },
    });
  }
}

if (deck.length !== 78) throw new Error(`Expected 78 cards, got ${deck.length}`);

writeFileSync(OUT, JSON.stringify(deck, null, 2) + "\n", "utf8");
console.log(`Wrote ${deck.length} cards to ${OUT}`);
