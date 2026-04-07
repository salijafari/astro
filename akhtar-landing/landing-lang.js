/**
 * Marketing landing page only — EN / FA toggle, localStorage, no app dependency.
 * @type {Record<'en'|'fa', Record<string, string>>}
 */
var LANDING_I18N = {
  en: {
    aria_lang: "Language",
    aria_logo_home: "Akhtar home",
    aria_menu_open: "Open menu",
    aria_menu_close: "Close menu",
    skip_content: "Skip to content",
    nav_features: "Features",
    nav_pricing: "Pricing",
    nav_faq: "FAQ",
    cta_join: "Check your Transit",
    hero_title: "Your personal guide to the stars — and yourself.",
    hero_lead:
      "Akhtar blends thoughtful astrology with coaching-style clarity: your chart, daily context, and space to reflect — without the fluff.",
    hero_cta_primary: "Ask Akhtar Today",
    hero_get_app: "Get the app",
    hero_rating: "4.8/5 average rating",
    hero_moments: "1M+ guided moments",
    hero_img_alt:
      "Illustration of a serene celestial figure in a star-patterned robe, floating — Akhtar",
    walk_kicker: "Inside the app",
    walk_title: "See what awaits you inside",
    walk_sub: "A calm, guided walkthrough — four screens, four moments of clarity.",
    walk_0_h: "Ask Akhtar",
    walk_0_p:
      "Receive thoughtful guidance shaped by your chart, memory, and present moment.",
    walk_1_h: "Your Daily Transit",
    walk_1_p: "See how the current sky influences your mood, timing, and energy today.",
    walk_2_h: "Relationship Energy",
    walk_2_p:
      "Discover how your connection flows across attraction, emotion, and long-term alignment.",
    walk_3_h: "Read Your Coffee Cup",
    walk_3_p:
      "Reveal hidden symbols and intuitive messages from the patterns left in your coffee.",
    test_title: "What our users say",
    test_sub: "Early voices from people who wanted depth without the noise.",
    test_1_q: "“Finally something that feels respectful of astrology and of me. The identity card alone was worth it.”",
    test_1_a: "— Mira, Toronto",
    test_2_q: "“Daily insights are short but they land. It’s like the week makes sense before it steamrolls me.”",
    test_2_a: "— Jordan, Vancouver",
    test_3_q: "“I use it with therapy and journaling. The chart data is there; the app doesn’t preach.”",
    test_3_a: "— Sam, Montreal",
    pricing_title: "Simple, transparent pricing",
    pricing_sub: "Start free. Upgrade when you want the full rhythm.",
    price_free: "Free",
    price_free_amt: "$0",
    price_per_month: "/ month",
    price_li_free_1: "Core chart overview",
    price_li_free_2: "Limited daily insight",
    price_li_free_3: "Identity card preview",
    price_cta_start: "Get started",
    badge_popular: "Most popular",
    price_premium: "Premium",
    price_premium_amt: "$10",
    price_li_pr_1: "Full cosmic identity card",
    price_li_pr_2: "Unlimited daily insights",
    price_li_pr_3: "Ask anything & deeper transits",
    price_li_pr_4: "Priority new features",
    price_cta_premium: "Get Premium",
    faq_title: "Common questions",
    faq_sub: "Straight answers — no mystique for its own sake.",
    faq1_q: "How does Akhtar work?",
    faq1_a:
      "You add accurate birth data. We compute your chart with standard Western techniques, then layer coaching-style prompts and interpretations — always tied to that data, never invented from thin air.",
    faq2_q: "Is it free?",
    faq2_a:
      "Yes — there’s a free tier with core features. Premium unlocks the full daily rhythm, deeper questions, and your complete identity card.",
    faq3_q: "What about privacy?",
    faq3_a:
      "Birth data is sensitive. We’re built for consent, export, and deletion — aligned with how we’d want our own data treated.",
    footer_tagline: "Clarity from the cosmos — for your real life.",
    footer_product: "Product",
    footer_company: "Company",
    footer_legal: "Legal",
    footer_features: "Features",
    footer_pricing: "Pricing",
    footer_faq: "FAQ",
    footer_about: "About",
    footer_careers: "Careers",
    footer_contact: "Contact",
    footer_privacy: "Privacy Policy",
    footer_terms: "Terms of Service",
    footer_refund: "Refund Policy",
    footer_delete_account: "Delete account",
    /** delete-account.html only (title / meta switched when path matches) */
    delete_doc_title: "Delete Your Akhtar Account — Akhtar",
    delete_meta_description:
      "How to delete your Akhtar account and associated data from the app. Contact support@akhtar.today if you need help.",
    delete_howto_title: "How to Delete Your Akhtar Account",
    delete_title: "Delete Your Akhtar Account",
    delete_intro: "To delete your account and all associated data:",
    delete_step_1: "Open the Akhtar app",
    delete_step_2: "Go to Settings",
    delete_step_3: "Tap \"Account\"",
    delete_step_4: "Tap \"Delete Account\"",
    delete_step_5: "Confirm deletion",
    delete_deleted_title: "What gets deleted:",
    delete_deleted_1: "Your account and profile information",
    delete_deleted_2: "Your birth chart and astrological data",
    delete_deleted_3: "Your saved people and compatibility reports",
    delete_deleted_4: "Your chat and reading history",
    delete_deleted_5: "All personal preferences and settings",
    delete_retained_title: "What is retained:",
    delete_retained_1:
      "Anonymized, non-identifiable usage data may be retained for up to 30 days for fraud prevention and legal compliance purposes.",
    delete_contact:
      "If you have trouble deleting your account in the app, contact us at: support@akhtar.today",
    delete_contact_html:
      'If you have trouble deleting your account in the app, contact us at: <a href="mailto:support@akhtar.today">support@akhtar.today</a>',
    delete_warning: "Account deletion is permanent and cannot be undone.",
    sticky_cta: "Ask Akhtar Today",
    aria_sticky: "Get Akhtar",
    /** Shown only when the EN control is visible (page is Persian). */
    aria_switch_en: "Switch to English",
    /** Shown only when the FA control is visible (page is English). */
    aria_switch_fa: "Switch to Persian (Farsi)",
    copyright: "© {year} Akhtar. All rights reserved.",
  },
  fa: {
    aria_lang: "زبان",
    aria_logo_home: "صفحه اصلی اختر",
    aria_menu_open: "باز کردن منو",
    aria_menu_close: "بستن منو",
    skip_content: "پرش به محتوا",
    nav_features: "امکانات",
    nav_pricing: "قیمت‌گذاری",
    nav_faq: "سوالات متداول",
    cta_join: "ترنزیت رو چک کن",
    hero_title: "راهنمای شخصی شما برای ستاره‌ها و خودتان",
    hero_lead:
      "اختر، نجوم آگاهانه را با شفافیتی شبیه کوچینگ ترکیب می‌کند: چارت شما، وضعیت روزانه شما، و فضایی برای تأمل، بدون حاشیه و اضافه‌گویی",
    hero_cta_primary: "از اختر بپرس",
    hero_get_app: "دریافت اپلیکیشن",
    hero_rating: "میانگین امتیاز ۴.۸ از ۵",
    hero_moments: "بیش از ۱ میلیون تجربه هدایت‌شده",
    hero_img_alt:
      "تصویری از یک شخصیت آرام در حال شناوری با لباسی ستاره‌دار — اختر",
    walk_kicker: "داخل اپلیکیشن",
    walk_title: "ببینید چه چیزی در انتظار شماست",
    walk_sub: "یک تجربه آرام و هدایت‌شده، چهار صفحه، چهار لحظه از شفافیت",
    walk_0_h: "از اختر بپرس",
    walk_0_p:
      "هر چیزی که توی ذهنت هست بپرس؛ جواب‌ها بر اساس چارتت، حرف‌های قبلی‌تون و حال و هوای این لحظه بهت داده می‌شن.",
    walk_1_h: "ترنزیت امروز تو",
    walk_1_p:
      "ببین انرژی امروز آسمون چه تأثیری روی حال دلت، تصمیم‌هات و اتفاق‌های روزت می‌ذاره.",
    walk_2_h: "انرژی رابطه",
    walk_2_p:
      "بفهم بین شما چه انرژی‌ای جریان داره؛ از کشش و احساس گرفته تا هماهنگی برای آینده.",
    walk_3_h: "فنجان قهوه را بخوان",
    walk_3_p:
      "نقش‌های فنجونت رو به پیام‌ها و نشونه‌هایی تبدیل کن که بهت حس روشن‌تری از مسیرت می‌ده.",
    test_title: "کاربران ما چه می‌گویند",
    test_sub: "بازخوردهای اولیه از افرادی که به دنبال عمق بدون شلوغی بودند",
    test_1_q:
      "«بالاخره چیزی که هم به نجوم احترام می‌گذارد و هم به من. فقط کارت هویتی‌اش هم ارزشش را داشت.»",
    test_1_a: "— میرا، تورنتو",
    test_2_q:
      "«بینش‌های روزانه کوتاه‌اند اما اثرگذار. انگار قبل از این‌که هفته از رویم رد شود، قابل فهم می‌شود.»",
    test_2_a: "— جردن، ونکوور",
    test_3_q:
      "«همراه با تراپی و نوشتن از آن استفاده می‌کنم. داده‌های چارت هست، اما اپلیکیشن نصیحت نمی‌کند.»",
    test_3_a: "— سم، مونترال",
    pricing_title: "قیمت‌گذاری ساده و شفاف",
    pricing_sub: "رایگان شروع کنید و هر زمان خواستید ارتقا دهید",
    price_free: "رایگان",
    price_free_amt: "۰ دلار",
    price_per_month: "در ماه",
    price_li_free_1: "نمای کلی چارت",
    price_li_free_2: "بینش روزانه محدود",
    price_li_free_3: "پیش‌نمایش کارت هویتی",
    price_cta_start: "شروع کنید",
    badge_popular: "محبوب‌ترین",
    price_premium: "پریمیوم",
    price_premium_amt: "۱۰ دلار",
    price_li_pr_1: "کارت هویتی کامل کیهانی",
    price_li_pr_2: "بینش روزانه نامحدود",
    price_li_pr_3: "پرسش نامحدود و تحلیل عمیق‌تر ترنزیت‌ها",
    price_li_pr_4: "دسترسی زودتر به قابلیت‌های جدید",
    price_cta_premium: "دریافت پریمیوم",
    faq_title: "سوالات متداول",
    faq_sub: "پاسخ‌های مستقیم، بدون پیچیدگی بی‌دلیل",
    faq1_q: "اختر چگونه کار می‌کند؟",
    faq1_a:
      "اطلاعات دقیق تولد را وارد می‌کنید. ما چارت شما را با تکنیک‌های استاندارد نجوم غربی محاسبه می‌کنیم و سپس پرسش‌ها و تفسیرهایی شبیه کوچینگ اضافه می‌کنیم — همیشه مبتنی بر همان داده‌ها، نه ساختگی.",
    faq2_q: "آیا رایگان است؟",
    faq2_a:
      "بله — یک سطح رایگان با امکانات اصلی وجود دارد. پریمیوم ریتم روزانه کامل، پرسش‌های عمیق‌تر و کارت هویتی کامل را باز می‌کند.",
    faq3_q: "حریم خصوصی چگونه حفظ می‌شود؟",
    faq3_a:
      "داده‌های تولد حساس است. ما برای رضایت، صادرات و حذف داده‌ها ساخته شده‌ایم — همان‌طور که دوست داریم با داده‌های خودمان برخورد شود.",
    footer_tagline: "شفافیت از کیهان، برای زندگی واقعی شما",
    footer_product: "محصول",
    footer_company: "شرکت",
    footer_legal: "قوانین",
    footer_features: "ویژگی‌ها",
    footer_pricing: "قیمت‌گذاری",
    footer_faq: "سوالات متداول",
    footer_about: "درباره",
    footer_careers: "فرصت‌های شغلی",
    footer_contact: "تماس با ما",
    footer_privacy: "سیاست حریم خصوصی",
    footer_terms: "شرایط استفاده از خدمات",
    footer_refund: "سیاست بازپرداخت",
    footer_delete_account: "حذف حساب",
    delete_doc_title: "حذف حساب اختر — اختر",
    delete_meta_description:
      "نحوه حذف حساب اختر و داده‌های مرتبط از طریق اپلیکیشن. در صورت نیاز با support@akhtar.today تماس بگیرید.",
    delete_howto_title: "نحوه حذف حساب اختر",
    delete_title: "حذف حساب اختر",
    delete_intro: "برای حذف حساب و تمام اطلاعات مرتبط:",
    delete_step_1: "اپ اختر را باز کن",
    delete_step_2: "به تنظیمات برو",
    delete_step_3: "روی «حساب» ضربه بزن",
    delete_step_4: "روی «حذف حساب» ضربه بزن",
    delete_step_5: "حذف را تأیید کن",
    delete_deleted_title: "چه چیزی حذف می‌شود:",
    delete_deleted_1: "حساب و اطلاعات پروفایل",
    delete_deleted_2: "نقشه تولد و داده‌های اختربینی",
    delete_deleted_3: "افراد ذخیره‌شده و گزارش‌های سازگاری",
    delete_deleted_4: "تاریخچه چت و قرائت‌ها",
    delete_deleted_5: "تمام تنظیمات و ترجیحات شخصی",
    delete_retained_title: "چه چیزی نگه داشته می‌شود:",
    delete_retained_1:
      "داده‌های ناشناس و غیرقابل شناسایی ممکن است تا ۳۰ روز برای پیشگیری از تقلب و رعایت قوانین نگه داشته شوند.",
    delete_contact:
      "اگر در حذف حساب از طریق اپ مشکل داشتی، با ما تماس بگیر: support@akhtar.today",
    delete_contact_html:
      'اگر در حذف حساب از طریق اپ مشکل داشتی، با ما تماس بگیر: <a href="mailto:support@akhtar.today">support@akhtar.today</a>',
    delete_warning: "حذف حساب دائمی است و قابل بازگشت نیست.",
    sticky_cta: "از اختر بپرس",
    aria_sticky: "دریافت اختر",
    aria_switch_en: "English",
    aria_switch_fa: "فا",
    copyright: "© {year} اختر. تمامی حقوق محفوظ است.",
  },
};

var LANDING_LANG_STORAGE = "akhtar-landing-locale";

function landingGetPreferredLocale() {
  try {
    var s = localStorage.getItem(LANDING_LANG_STORAGE);
    if (typeof s === "string") s = s.trim();
    if (s === "fa" || s === "en") return s;
  } catch (e) {}
  return "fa";
}

function landingApplyLocale(code) {
  window.__landingLang = code;
  var dict = LANDING_I18N[code] || LANDING_I18N.en;
  document.documentElement.lang = code === "fa" ? "fa" : "en";
  document.documentElement.dir = code === "fa" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    if (!key || dict[key] == null) return;
    el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
    var key = el.getAttribute("data-i18n-html");
    if (!key || dict[key] == null) return;
    el.innerHTML = dict[key];
  });

  document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
    var spec = el.getAttribute("data-i18n-attr");
    if (!spec) return;
    var ci = spec.indexOf(":");
    if (ci < 1) return;
    var attr = spec.slice(0, ci);
    var key = spec.slice(ci + 1);
    if (!attr || !key || dict[key] == null) return;
    el.setAttribute(attr, dict[key]);
  });

  var year = String(new Date().getFullYear());
  var copyEl = document.getElementById("copyrightLine");
  if (copyEl && dict.copyright) {
    copyEl.textContent = dict.copyright.replace("{year}", year);
  }

  var path = typeof location !== "undefined" && location.pathname ? location.pathname : "";
  var isDeleteAccountPage = /delete-account/.test(path);
  if (isDeleteAccountPage && dict.delete_doc_title != null) {
    document.title = dict.delete_doc_title;
  }
  var metaDesc = document.querySelector('meta[name="description"]');
  if (isDeleteAccountPage && metaDesc && dict.delete_meta_description != null) {
    metaDesc.setAttribute("content", dict.delete_meta_description);
  }

  var enBtn = document.getElementById("langEn");
  var faBtn = document.getElementById("langFa");
  if (enBtn) {
    enBtn.classList.remove("is-active");
    enBtn.removeAttribute("aria-pressed");
    if (code === "fa") {
      enBtn.setAttribute(
        "aria-label",
        (LANDING_I18N.fa && LANDING_I18N.fa.aria_switch_en) || "Switch to English",
      );
    } else {
      enBtn.removeAttribute("aria-label");
    }
  }
  if (faBtn) {
    faBtn.classList.remove("is-active");
    faBtn.removeAttribute("aria-pressed");
    if (code === "en") {
      faBtn.setAttribute(
        "aria-label",
        (LANDING_I18N.en && LANDING_I18N.en.aria_switch_fa) || "Switch to Persian (Farsi)",
      );
    } else {
      faBtn.removeAttribute("aria-label");
    }
  }

  var menuToggle = document.getElementById("menuToggle");
  var siteNav = document.getElementById("siteNav");
  if (menuToggle && dict.aria_menu_open) {
    var menuOpen = siteNav && siteNav.classList.contains("is-open");
    menuToggle.setAttribute(
      "aria-label",
      menuOpen ? dict.aria_menu_close || "Close menu" : dict.aria_menu_open,
    );
  }

  try {
    localStorage.setItem(LANDING_LANG_STORAGE, code);
  } catch (e) {}
}

function landingInitLangToggle() {
  var code = landingGetPreferredLocale();
  landingApplyLocale(code);

  var enBtn = document.getElementById("langEn");
  var faBtn = document.getElementById("langFa");
  if (enBtn) {
    enBtn.addEventListener("click", function () {
      landingApplyLocale("en");
      window.location.reload();
    });
  }
  if (faBtn) {
    faBtn.addEventListener("click", function () {
      landingApplyLocale("fa");
      window.location.reload();
    });
  }
}
