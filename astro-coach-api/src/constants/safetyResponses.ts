export interface SafetyResponse {
  flagType: "crisis" | "medical" | "legal" | "financial" | "abuse" | "spam";
  title: string;
  message: string;
  redirectSuggestion: string;
  showCrisisResources: boolean;
}

export const SAFETY_RESPONSES: SafetyResponse[] = [
  {
    flagType: "crisis",
    title: "I'm here, and I want you to be safe",
    message: "What you're sharing sounds really heavy, and I don't want to brush past it. You deserve real support right now — the kind that comes from a real person who can truly be present with you. Akhtar is a guide for reflection, but it isn't equipped to be what you need in this moment.",
    redirectSuggestion: "Please reach out to a crisis support line where a real, compassionate person is ready to talk. You don't have to be in immediate danger to call — if you're struggling, that's enough reason.",
    showCrisisResources: true,
  },
  {
    flagType: "abuse",
    title: "Your safety matters first",
    message: "I want to gently set aside the astrology for a moment, because what you're describing sounds like it may be affecting your safety and wellbeing in ways that go beyond what I can address here. You deserve to be treated with care and respect, always.",
    redirectSuggestion: "If you feel unsafe or are experiencing harm in a relationship, please reach out to a support line where trained counselors can provide real, confidential guidance. You don't have to figure this out alone.",
    showCrisisResources: true,
  },
  {
    flagType: "medical",
    title: "A real conversation with a healthcare provider would serve you best here",
    message: "This sounds like something that deserves proper medical attention — not because your question isn't valid, but because your body and health deserve the care of someone who can actually assess you, ask the right questions, and give you reliable guidance. Astrological insight can complement healthcare, but it isn't a substitute for it.",
    redirectSuggestion: "Please reach out to a doctor, nurse practitioner, or healthcare clinic. If cost is a concern, many communities have low-cost or walk-in options available.",
    showCrisisResources: false,
  },
  {
    flagType: "legal",
    title: "This one really does need a lawyer",
    message: "I can offer perspective on timing, energy, and inner clarity around difficult situations — but legal matters have real-world consequences that require real-world expertise. Legal questions deserve the guidance of someone who knows the specific laws in your area and can actually protect your interests.",
    redirectSuggestion: "Many law societies offer free referrals or initial consultations. Legal aid clinics are available in most areas for those who need financial assistance with legal support.",
    showCrisisResources: false,
  },
  {
    flagType: "financial",
    title: "A financial professional can give you what this situation needs",
    message: "Financial decisions with significant stakes deserve qualified guidance — someone who knows the laws, regulations, and your specific situation. Astrology can offer insight into timing and themes, but for decisions involving real money, you deserve expert input.",
    redirectSuggestion: "Consider speaking with a certified financial advisor or credit counselor. Many non-profit organizations offer free financial counseling services.",
    showCrisisResources: false,
  },
  {
    flagType: "spam",
    title: "Let's bring this back to what actually matters for you",
    message: "It looks like the conversation may have drifted away from genuine reflection. I'm here to support your personal growth, self-understanding, and inner clarity — and I'd love to get back to that.",
    redirectSuggestion: "Is there something genuinely on your mind or heart that you'd like to explore?",
    showCrisisResources: false,
  },
];
