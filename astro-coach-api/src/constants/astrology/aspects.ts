export interface Aspect {
  name: string;
  symbol: string;
  degrees: number;
  orb: number;
  nature: "harmonious" | "challenging" | "neutral";
  basicTone: string;
  supportiveRead: string;
  challengingRead: string;
  inSynastry: string;
  growthAngle: string;
}

export const ASPECTS: Aspect[] = [
  {
    name: "conjunction",
    symbol: "☌",
    degrees: 0,
    orb: 8,
    nature: "neutral",
    basicTone: "Two energies merge and intensify each other — a fusion that can be powerfully unified or overwhelming depending on the planets involved.",
    supportiveRead: "When harmonious planets conjoin — like Venus and Jupiter — the result is a beautiful amplification of both energies. Abundance, affection, and ease flow naturally. The conjunction in supportive territory can mark natural gifts, peak experiences, and areas of life where effort feels effortless.",
    challengingRead: "When difficult planets conjoin — like Saturn and Mars — or when the fusion creates too much of one energy, the conjunction can feel like pressure without outlet. The themes of both planets become inseparable, which can be consuming. Learning to work with rather than fight this intensity is the key.",
    inSynastry: "A conjunction between two people's charts creates a powerful resonance — these people feel immediately familiar, magnetically drawn, or intensely activated by each other. The planets involved describe the nature of the connection.",
    growthAngle: "The conjunction asks us to integrate two forces into one coherent expression — to find the third thing that neither planet alone could produce.",
  },
  {
    name: "trine",
    symbol: "△",
    degrees: 120,
    orb: 8,
    nature: "harmonious",
    basicTone: "A natural, flowing ease between two energies that share the same element — a gift of alignment that can be drawn on without effort.",
    supportiveRead: "The trine represents natural talent, effortless flow, and areas where life moves with grace. Planets in trine work together harmoniously — creativity flows, love comes easily, ambition finds clear channels. These are the gifts in the chart that can be taken for granted.",
    challengingRead: "Precisely because the trine is so easy, it can lead to complacency. The energy is available — but it requires intention to develop into mastery. A life built only on trines can lack the friction that produces depth.",
    inSynastry: "A trine between two people's planets creates ease, comfort, and natural support. These connections feel effortless and supportive — but benefit from both people consciously investing, since the ease can remove urgency.",
    growthAngle: "The trine asks us to take our gifts seriously — to honor them with practice and intention, and to share what flows naturally with others.",
  },
  {
    name: "sextile",
    symbol: "⚹",
    degrees: 60,
    orb: 6,
    nature: "harmonious",
    basicTone: "An opportunity aspect — two energies that can work together well when engaged, but require conscious activation to realize their potential.",
    supportiveRead: "The sextile is sometimes called the 'opportunity aspect' because it creates ease of flow between two energies that complement each other — but it's slightly more active than a trine. When you make the effort, sextile energy pays off reliably. These are doors that open when you knock.",
    challengingRead: "Unlike the trine, the sextile doesn't operate by itself. It requires engagement. If ignored, these energies never fully integrate — the potential remains potential. The shadow is missed opportunity.",
    inSynastry: "A sextile between two people's charts creates friendly, productive energy. These connections are supportive and easy to work with — particularly good for friendships and collaborative partnerships.",
    growthAngle: "The sextile asks us to take action — to walk through the doors that are clearly open rather than waiting for a more dramatic invitation.",
  },
  {
    name: "square",
    symbol: "□",
    degrees: 90,
    orb: 8,
    nature: "challenging",
    basicTone: "A tension between two energies that push against each other, creating friction that demands resolution — the primary growth aspect of the chart.",
    supportiveRead: "Squares produce strength through struggle. The tension between two squared planets creates the internal pressure that, when engaged with consciously, leads to the most remarkable growth and achievement. Many of the most accomplished people have prominent squares — the drive to resolve the tension fuels their work.",
    challengingRead: "Unworked squares manifest as recurring conflict, frustration, or blockages in the life areas of both planets. The person may feel perpetually torn, thwarted, or forced to confront the same crisis until they develop the integration that the square is calling for.",
    inSynastry: "A square between two people's charts creates friction, challenge, and often undeniable chemistry. These relationships feel activating and growth-producing — but can also exhaust both people. The tension demands something from each person.",
    growthAngle: "The square asks us to stop avoiding the tension and instead develop the strength, flexibility, and creativity needed to hold two forces without letting either dominate.",
  },
  {
    name: "opposition",
    symbol: "☍",
    degrees: 180,
    orb: 8,
    nature: "challenging",
    basicTone: "Two energies pull in opposite directions, creating awareness through polarity — the tension of two extremes seeking balance.",
    supportiveRead: "The opposition creates awareness. Because the two energies are directly facing each other, the person cannot ignore either one — they're forced into consciousness of both. When integrated, oppositions produce remarkable wholeness, balance, and the capacity to hold nuance.",
    challengingRead: "Unintegrated oppositions manifest as projection — seeing the suppressed energy in others, or swinging between two extremes without landing in the middle. The person may feel consistently pulled in two directions, unable to commit fully to either path.",
    inSynastry: "An opposition between two people's charts creates a magnetic, mirror-like dynamic. These people see something of themselves in each other — often the parts they've suppressed or projected. Intense attraction and friction frequently coexist.",
    growthAngle: "The opposition asks us to stop identifying with one pole and rejecting the other — to find the dynamic balance point where both energies can coexist and inform each other.",
  },
];
