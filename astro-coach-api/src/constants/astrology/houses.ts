export interface AstrologicalHouse {
  number: number;
  name: string;
  lifeArea: string[];
  keywords: string[];
  planetHereMeans: string;
  transitHereMeans: string;
  naturalRuler: string;
}

export const HOUSES: AstrologicalHouse[] = [
  {
    number: 1,
    name: "House of Self",
    lifeArea: ["physical appearance", "personal identity", "first impressions", "the body and its vitality", "how you initiate", "your mask and presence"],
    keywords: ["identity", "appearance", "beginnings", "self-expression", "first impressions", "vitality"],
    planetHereMeans: "A planet in the 1st house colors your entire personality and how the world receives you. It sits right on the Ascendant's energy — meaning its themes are visible, often before you even open your mouth. Sun here brings natural charisma; Saturn here may create a more reserved or mature presentation; Mars here gives drive and physical energy that others notice immediately.",
    transitHereMeans: "Transits through the 1st house bring identity themes to the foreground. You may feel a renewed sense of self, a desire to change your appearance or presentation, or a new chapter of personal beginnings. This is a period of becoming — something about how you show up in the world is shifting.",
    naturalRuler: "Aries",
  },
  {
    number: 2,
    name: "House of Resources",
    lifeArea: ["personal finances and income", "material possessions", "self-worth and values", "what you own", "earning capacity", "security through tangible means"],
    keywords: ["money", "values", "possessions", "self-worth", "security", "earning"],
    planetHereMeans: "A planet in the 2nd house shapes your relationship to money, material security, and self-worth — because these three are intimately linked here. Venus here may create natural abundance and comfort with money; Pluto here may bring intense financial cycles and deep questions about power and self-worth. The planet shows how you earn, spend, and value yourself.",
    transitHereMeans: "Transits through the 2nd house activate your financial landscape and sense of personal worth. Income, resources, and what you own may shift — but more deeply, your relationship to your own value is under review. These periods often bring questions like: what do I actually need to feel secure? What am I worth?",
    naturalRuler: "Taurus",
  },
  {
    number: 3,
    name: "House of Communication",
    lifeArea: ["communication and speech", "siblings and close neighbors", "short-distance travel", "learning and early education", "everyday thinking and perception", "writing and media"],
    keywords: ["communication", "learning", "siblings", "short trips", "writing", "local environment"],
    planetHereMeans: "A planet in the 3rd house influences how you think, speak, and learn. Mercury here intensifies mental agility and verbal expression; Neptune here can bring poetic communication but also misunderstandings; Saturn here may mean slower, more deliberate communication and a serious relationship with learning. This house also governs sibling relationships.",
    transitHereMeans: "Transits through the 3rd house stir up communication, local activity, and mental processing. This can be a busy time for conversations, learning, short travel, or a significant development with a sibling. The mind is more active — it's a good time to write, study, or have important conversations.",
    naturalRuler: "Gemini",
  },
  {
    number: 4,
    name: "House of Home and Roots",
    lifeArea: ["home and family life", "roots and ancestry", "emotional foundations", "the mother or primary caregiver", "private life and inner world", "real estate and the end of life"],
    keywords: ["home", "family", "roots", "foundation", "emotional security", "ancestry"],
    planetHereMeans: "A planet in the 4th house sits at the very base of the chart — the roots. It shapes your experience of home, family, and emotional security. The Moon here deepens emotional connection to family and home; Pluto here may indicate a family dynamic with intense undercurrents or generational transformation; Saturn here can mean a more serious or difficult relationship with the childhood home.",
    transitHereMeans: "Transits through the 4th house bring home, family, and foundation into focus. There may be literal changes — a move, renovations, family transitions — but more often these transits activate deep inner work around the roots of your emotional patterns. Something about where and how you feel at home is being examined.",
    naturalRuler: "Cancer",
  },
  {
    number: 5,
    name: "House of Creativity and Joy",
    lifeArea: ["creative self-expression", "romance and love affairs", "children", "play and recreation", "performing arts and performance", "risk-taking and speculation"],
    keywords: ["creativity", "romance", "play", "children", "expression", "joy"],
    planetHereMeans: "A planet in the 5th house shapes how you express yourself creatively, how you play, and what brings you joy. Venus here brings romantic charm and artistic gifts; Jupiter here can indicate an exuberant, expansive approach to pleasure and creativity; Saturn here may make it harder to let go and play freely, though when the work is done, it can indicate deep, serious creative mastery.",
    transitHereMeans: "Transits through the 5th house awaken the heart's desire to play, create, and love. Romantic encounters, creative breakthroughs, and a genuine reinvigoration of joy are common under these transits. If life has felt heavy or obligatory, this transit offers a portal back to lightness.",
    naturalRuler: "Leo",
  },
  {
    number: 6,
    name: "House of Health and Service",
    lifeArea: ["daily health and wellness practices", "work environment and coworkers", "routines and habits", "service and helping others", "pets", "the body's daily functioning"],
    keywords: ["health", "service", "routine", "work", "habits", "wellness"],
    planetHereMeans: "A planet in the 6th house colors your relationship to health, daily work, and service. Mars here brings drive and sometimes stress to the work environment; Neptune here can bring sensitivity in health or a calling toward healing and spiritual service; Virgo's natural energy here means this house rewards consistent, attentive care of the body and work.",
    transitHereMeans: "Transits through the 6th house bring attention to the body, health routines, and work life. This is often when health improvements begin in earnest, when a job changes, or when the quality of daily life demands attention. The question being asked: are the structures of your everyday life actually supporting you?",
    naturalRuler: "Virgo",
  },
  {
    number: 7,
    name: "House of Partnership",
    lifeArea: ["committed romantic partnerships", "legal partnerships and contracts", "open enemies and rivals", "how we complement others", "marriage and long-term union", "the qualities we seek and project in others"],
    keywords: ["partnership", "marriage", "contracts", "balance", "others", "commitment"],
    planetHereMeans: "A planet in the 7th house shapes your relationship to committed partnership — and can describe both the qualities you seek in a partner and qualities you may project onto others. Venus here brings grace and harmony-seeking to partnerships; Pluto here can create intense, transformative relationship dynamics; Saturn here demands maturity and may delay but ultimately deepen commitment.",
    transitHereMeans: "Transits through the 7th house activate partnership in all its forms — romantic, legal, and interpersonal. Major commitments, separations, or recalibrations in key relationships often coincide with significant 7th house transits. Your understanding of what you seek in partnership is evolving.",
    naturalRuler: "Libra",
  },
  {
    number: 8,
    name: "House of Transformation",
    lifeArea: ["shared resources and finances", "sexuality and intimate vulnerability", "death and rebirth", "inheritance and legacies", "the occult and hidden knowledge", "psychological depth and transformation"],
    keywords: ["transformation", "shared resources", "death", "rebirth", "depth", "power"],
    planetHereMeans: "A planet in the 8th house brings depth, intensity, and transformation to the themes it governs. Mars here brings intensity to sexuality and can indicate conflict over shared resources; Neptune here may bring spiritual depth and idealization in intimate bonds; Pluto in its own natural house intensifies all 8th house themes — the capacity for profound transformation but also difficulty with power and control.",
    transitHereMeans: "Transits through the 8th house take us underground — into the territory of death, rebirth, shared resources, and deep psychological transformation. These periods are rarely light. They strip away what is no longer essential and ask us to face what we've been avoiding. Something ends so something else can be born.",
    naturalRuler: "Scorpio",
  },
  {
    number: 9,
    name: "House of Philosophy and Expansion",
    lifeArea: ["higher education and philosophy", "long-distance travel and foreign cultures", "spiritual and religious beliefs", "publishing and broadcasting", "teachers and mentors", "the search for meaning"],
    keywords: ["philosophy", "travel", "expansion", "belief", "wisdom", "higher learning"],
    planetHereMeans: "A planet in the 9th house shapes how you seek meaning, expand your worldview, and connect with wisdom beyond the familiar. Jupiter here is in its natural house — a beautiful placement for growth, opportunity, and philosophical joy; Saturn here asks that beliefs be earned through experience rather than inherited; Moon here suggests emotional wellbeing is tied to spiritual and philosophical exploration.",
    transitHereMeans: "Transits through the 9th house open doors to expansion — through travel, education, spiritual exploration, or a fundamental shift in what you believe. These are often life-expanding periods: a course of study, a journey that changes everything, or a crisis of faith that ultimately leads to deeper conviction.",
    naturalRuler: "Sagittarius",
  },
  {
    number: 10,
    name: "House of Career and Legacy",
    lifeArea: ["career and professional life", "public reputation and standing", "achievement and ambition", "the father or authority figures", "your life's work and contribution", "how the world sees you"],
    keywords: ["career", "reputation", "ambition", "authority", "legacy", "achievement"],
    planetHereMeans: "A planet at the top of the chart — the Midheaven — shapes how you're seen by the world and what you're here to build professionally. The Sun here brings public visibility and a strong drive to lead; Saturn here demands that reputation be earned slowly through integrity; Uranus here may indicate an unconventional career that surprises or disrupts the norms of their field.",
    transitHereMeans: "Transits through the 10th house bring career and public life into sharp focus. Promotions, public recognition, professional challenges, and significant reputation shifts often occur here. The world is watching — and what you've been building is being evaluated and exposed to a wider audience.",
    naturalRuler: "Capricorn",
  },
  {
    number: 11,
    name: "House of Community and Vision",
    lifeArea: ["friendships and social networks", "groups and community", "long-term hopes and dreams", "humanitarian ideals", "technology and the future", "the collective and belonging"],
    keywords: ["community", "friendship", "hopes", "social networks", "ideals", "belonging"],
    planetHereMeans: "A planet in the 11th house shapes how you relate to community, friendship networks, and the collective vision. Venus here brings social grace and ease in groups; Uranus here can indicate unconventional friendships and a visionary, future-oriented social life; Saturn here may indicate fewer but more deeply committed friendships, and hopes that mature slowly into reality.",
    transitHereMeans: "Transits through the 11th house activate your social world, community belonging, and future visions. New friendships, group projects, and sudden clarity about what you're actually hoping for in the long term often emerge under these transits. The question being asked: who are your people, and what future are you collectively building?",
    naturalRuler: "Aquarius",
  },
  {
    number: 12,
    name: "House of the Unseen",
    lifeArea: ["the unconscious and hidden self", "spiritual retreat and solitude", "hidden enemies and self-undoing", "institutions and places of withdrawal", "karma and soul lessons", "compassionate service to the marginalized"],
    keywords: ["unconscious", "spirituality", "hidden", "solitude", "karma", "dissolution"],
    planetHereMeans: "A planet in the 12th house operates from beneath the surface — from the unconscious, the hidden, and the spiritual. It often describes themes that are felt but not easily articulated, or gifts that take time to surface. Neptune here is in its natural house — profound spiritual access and creative depth; Jupiter here can indicate spiritual grace and hidden luck; Mars here may show a drive that has been suppressed or operates covertly.",
    transitHereMeans: "Transits through the 12th house invite retreat, inner work, and a confrontation with the unconscious. These are often quiet, internal periods — or they appear quiet while something significant reorganizes beneath the surface. Dreams, intuition, and spiritual practice become more potent. Things hidden come to light — sometimes gently, sometimes dramatically.",
    naturalRuler: "Pisces",
  },
];
