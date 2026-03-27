export interface ConflictType {
  id: "misunderstanding" | "jealousy" | "communication" | "distance" | "trust" | "recurring";
  label: string;
  description: string;
  likelyDynamic: string;
  whatPersonANeeds: string;
  whatPersonBMightNeed: string;
  escalates: string[];
  deEscalates: string[];
  betterPhrasing: Array<{ instead: string; tryThis: string }>;
  astrologicalLens: string;
}

export const CONFLICT_FRAMEWORK: ConflictType[] = [
  {
    id: "misunderstanding",
    label: "Misunderstanding",
    description: "A situation where something was interpreted differently than intended — words, actions, or tone got lost in translation.",
    likelyDynamic: "Most misunderstandings occur not because people don't care, but because they carry different assumptions about what words and behaviors mean. One person said X; the other heard Y — and both interpretations feel completely logical from their own frame. The misunderstanding itself is rarely the problem; the problem is usually the speed with which assumptions harden into certainties.",
    whatPersonANeeds: "Person A needs to feel heard and genuinely understood — not just accepted in the moment, but actually met with curiosity about what they actually meant. The experience of being repeatedly misunderstood can feel profoundly isolating, so what matters most is the sense that their intent is being taken seriously.",
    whatPersonBMightNeed: "Person B likely needs acknowledgment that their interpretation made sense from where they were standing — that their reaction was understandable, even if it was based on a misread. Being told 'you heard it wrong' without acknowledgment of why that interpretation felt plausible will create further disconnection.",
    escalates: ["Insisting on who was 'right' instead of exploring what actually happened", "Assuming the worst interpretation of intent", "Bringing in past misunderstandings as evidence of a pattern", "Shutting down communication before the issue is resolved"],
    deEscalates: ["Starting with curiosity: 'Can I ask what you heard?'", "Sharing the intent without defensiveness: 'What I meant was...'", "Acknowledging the other's interpretation: 'I can see why that landed that way'", "Focusing on understanding rather than correcting"],
    betterPhrasing: [
      { instead: "That's not what I said.", tryThis: "I want to understand what you heard — can you tell me? What I was trying to say was different." },
      { instead: "You always misunderstand me.", tryThis: "I feel like something got lost between us. Can we start over and I'll try to be clearer?" },
      { instead: "Why would you even think that?", tryThis: "I'm genuinely curious what I said or did that led to that impression." },
    ],
    astrologicalLens: "Mercury-Neptune aspects in either person's chart can make communication naturally poetic but also naturally prone to misinterpretation. Mercury retrograde periods are particularly prone to bringing misunderstandings to the surface — what feels like a new problem often has older roots worth examining.",
  },
  {
    id: "jealousy",
    label: "Jealousy",
    description: "Feelings of insecurity, fear of loss, or comparison that are creating tension in the relationship.",
    likelyDynamic: "Jealousy almost always points to something beneath itself — typically a fear of not being enough, a wound from past abandonment or betrayal, or a genuine unmet need for reassurance that hasn't been explicitly named. It is rarely as simple as possessiveness; it is usually pain looking for a place to land. At the same time, jealousy can distort perception significantly, causing the jealous person to interpret neutral behavior as threatening.",
    whatPersonANeeds: "The person experiencing jealousy needs genuine reassurance — not performed reassurance, but the kind that addresses the specific fear. 'You are enough' matters less than 'You matter to me in these specific ways.' They also need space to examine where this fear originates, because it is often older than this relationship.",
    whatPersonBMightNeed: "The person on the receiving end of jealousy needs acknowledgment that their behavior is being looked at through a lens they didn't choose. They need clear communication about what would feel more reassuring — but also compassion for the person in fear, without enabling behavior that is invasive or controlling.",
    escalates: ["Dismissing the jealousy as irrational without curiosity about its origin", "Excessive secrecy or vagueness that feeds the fear", "Using the jealousy to control the other person's behavior", "Retaliating with counter-jealousy"],
    deEscalates: ["Offering specific, genuine reassurance — not just 'you're being silly'", "Examining whether there is a legitimate unmet need beneath the jealousy", "Establishing clear agreements about what behavior feels honoring rather than threatening", "The jealous person doing their own inner work on the fear's origin"],
    betterPhrasing: [
      { instead: "You're being ridiculous — nothing is going on.", tryThis: "I understand you're feeling unsettled. Can you help me understand what specifically is triggering this, so I can address it?" },
      { instead: "You're so jealous and controlling.", tryThis: "I feel like my autonomy is being constrained here. Can we talk about what you're actually afraid of?" },
      { instead: "Why do you always get jealous?", tryThis: "I notice this comes up for you. Is there something I'm doing that makes you feel less secure?" },
    ],
    astrologicalLens: "Scorpio placements, Pluto in the 7th house, or Venus-Pluto aspects in either person's chart can create an intensity in attachment that makes jealousy feel more visceral and consuming. Examining whether this pattern was present before this relationship — and whether it is truly about the present situation — is often the most useful lens.",
  },
  {
    id: "communication",
    label: "Communication Breakdown",
    description: "A pattern where conversations feel stuck, unheard, or circular — like talking but not connecting.",
    likelyDynamic: "Communication breakdowns often persist not because either person is uncaring but because both people have developed different default communication styles — and neither has been made explicit. One person processes externally and needs to talk through things; the other processes internally and feels overwhelmed by the volume. One person leads with emotion; the other leads with logic. Both feel unheard because neither is receiving in the form the other is sending.",
    whatPersonANeeds: "To feel genuinely heard — which may require the other person to slow down, reflect back what they heard, and resist the impulse to respond or fix immediately. The experience of being truly listened to is often more healing than any solution.",
    whatPersonBMightNeed: "Clarity about what kind of communication is being asked for. Many communication breakdowns stem from ambiguity: is this person looking for advice, validation, silence, or co-problem-solving? Asking 'what do you need from me right now?' before responding is often transformative.",
    escalates: ["Interrupting before the person has finished", "Responding to the emotion rather than the content (or vice versa)", "Withdrawing from the conversation entirely when it gets difficult", "Turning the conversation into a debate about who is the better communicator"],
    deEscalates: ["Reflecting back what was heard before responding", "Asking 'what do you need from me right now?'", "Choosing timing carefully — hard conversations go better when both people are calm and not hungry or tired", "Separating the topic from the relationship: 'I love you AND I need to address this'"],
    betterPhrasing: [
      { instead: "You never listen to me.", tryThis: "I'm not feeling heard right now. Can I try to explain this differently?" },
      { instead: "You're not making any sense.", tryThis: "I want to understand — can you help me see it from your side?" },
      { instead: "We never communicate.", tryThis: "I feel like our conversations about this topic get stuck. Can we try a different approach?" },
    ],
    astrologicalLens: "Mercury-Saturn aspects can create communication that feels heavy or restricted; Mercury-Uranus can make conversations feel electric but scattered. When two people have very different Mercury signs — especially across element boundaries — conscious communication adaptation is often necessary.",
  },
  {
    id: "distance",
    label: "Emotional Distance",
    description: "A sense of drift, disconnection, or growing apart — the feeling that the closeness has dimmed.",
    likelyDynamic: "Emotional distance in relationships rarely happens through a single dramatic event — it typically accumulates through many small moments of missed connection. Busy schedules, unaddressed small resentments, unspoken needs, and the slow drift of parallel lives can create a significant gap without either person intending it. The distance often feels more painful than any specific argument, because it seems harder to name.",
    whatPersonANeeds: "Genuine presence — not just physical presence, but the feeling that the other person is actually attending to them. Shared experiences, eye contact, conversations where both people are actually present rather than distracted.",
    whatPersonBMightNeed: "Understanding of what is causing them to pull back — often this is not about the relationship at all, but about an internal struggle, work stress, or something that has nothing to do with the other person. Space to share what is going on for them, without immediately having to fix the distance.",
    escalates: ["Interpreting the distance as rejection or abandonment without checking", "Increasing demands for closeness when the person needs space", "Allowing the distance to solidify into resentment without addressing it", "Assuming the distance means the relationship is over"],
    deEscalates: ["Naming what you notice gently: 'I've been feeling less connected lately — is that something you've noticed too?'", "Scheduling dedicated one-on-one time", "Asking about the other person's inner world rather than the relationship", "Rebuilding connection through small acts of appreciation and attention"],
    betterPhrasing: [
      { instead: "You're always so distant.", tryThis: "I miss feeling close to you. Is something going on for you, or is there something I've done?" },
      { instead: "You don't care anymore.", tryThis: "I've been feeling disconnected, and I want to understand if that's something we can talk about." },
      { instead: "Why won't you open up?", tryThis: "I'd love to know what's going on inside for you lately — whenever you're ready." },
    ],
    astrologicalLens: "Saturn transiting the 7th house or heavy outer planet activity can create natural periods of emotional withdrawal that feel concerning but are actually part of a deeper relational renegotiation. Aquarius or Capricorn placements in Venus or Moon can also create a natural tendency toward emotional distance that is not about the relationship specifically.",
  },
  {
    id: "trust",
    label: "Trust Issue",
    description: "A situation where honesty, reliability, or fidelity has been questioned — affecting the sense of safety in the relationship.",
    likelyDynamic: "Trust issues in relationships operate on two distinct levels: the current situation that has broken trust, and the layer beneath it — the accumulated experiences (often from childhood) that make this particular breach feel so significant. Rebuilding trust requires addressing both layers. The surface layer responds to consistent, observable changed behavior over time; the deeper layer responds to genuine understanding of the wound that was touched.",
    whatPersonANeeds: "Consistent, observable evidence over time — not promises. The person whose trust has been broken needs to see changed behavior, appropriate transparency, and the sincere acknowledgment of harm done. Rushing this process does not rebuild trust; it re-damages it.",
    whatPersonBMightNeed: "A specific understanding of what rebuilding trust requires — vague goodwill isn't enough. Clear, explicit communication about what behavior would demonstrate trustworthiness is essential. The person working to rebuild trust also needs acknowledgment when they are making genuine effort.",
    escalates: ["Demanding immediate forgiveness", "Minimizing the harm: 'It wasn't that big a deal'", "Asking the betrayed person to trust more without providing evidence for it", "Using the betrayal as permanent leverage in unrelated conflicts"],
    deEscalates: ["Taking full responsibility without qualification", "Asking: 'What would help you feel safer?' and actually doing it", "Consistent, patient behavior over time", "Therapy or structured support for both people"],
    betterPhrasing: [
      { instead: "You need to just trust me.", tryThis: "I understand I need to earn your trust back. What would help?" },
      { instead: "You're always suspicious of me.", tryThis: "I notice you're checking in a lot. I want you to feel safe — is there something specific I can do differently?" },
      { instead: "Are you ever going to get over this?", tryThis: "I know this takes time. I'm committed to staying with this process." },
    ],
    astrologicalLens: "Saturn-Venus or Pluto-Venus aspects in either person's natal chart can create deep, sometimes archetypal fears around betrayal and loss in love. When trust is broken, the inner story often activates something older than the current relationship — understanding that dimension is crucial to healing.",
  },
  {
    id: "recurring",
    label: "Recurring Pattern",
    description: "The same argument, issue, or dynamic keeps repeating — it feels like you've been here before, many times.",
    likelyDynamic: "Recurring patterns in relationships are the most psychologically significant of all conflict types. When the same argument repeats — sometimes across years, sometimes in different forms with different surface content — it is pointing toward a deeper, structural dynamic that has not yet been addressed at its root. Both people are usually participating in the repetition, even if it doesn't look that way from inside it. The same conflict keeps appearing because the underlying need has not been met or the underlying wound has not been addressed.",
    whatPersonANeeds: "The experience of something genuinely changing — not just better resolution of the surface conflict, but evidence that the dynamic itself is shifting. Often this requires one person to make a unilateral change in their own pattern first, even before the other reciprocates.",
    whatPersonBMightNeed: "The same: evidence that something different is actually possible. And likely, the space to look honestly at their own contribution to the repetition — which usually feels less obvious than the other person's contribution.",
    escalates: ["Focusing on the surface argument rather than the underlying pattern", "'You always' and 'you never' language", "Assuming the other person is intentionally causing the repetition", "Giving up rather than getting curious about the depth of the pattern"],
    deEscalates: ["Naming the pattern explicitly: 'I notice we keep coming back to this area'", "Getting curious about what need is repeatedly not being met", "Seeking professional support — recurring patterns often need a skilled third party", "Each person taking responsibility for their own side of the dance"],
    betterPhrasing: [
      { instead: "Here we go again.", tryThis: "I notice this feels familiar. I wonder if there's something underneath this we haven't addressed yet." },
      { instead: "We always fight about this.", tryThis: "This keeps coming up between us — I think there might be something important in it. Can we really look at it together?" },
      { instead: "Nothing ever changes with you.", tryThis: "I feel like we're in a loop that neither of us wants. What do you think is really at the center of it?" },
    ],
    astrologicalLens: "Recurring patterns in relationships often mirror natal chart dynamics — particularly Pluto, Saturn, and the Moon's node axis. When a relationship repeatedly activates the same themes, it may be pointing toward soul-level material that both people are here to work through together.",
  },
];
