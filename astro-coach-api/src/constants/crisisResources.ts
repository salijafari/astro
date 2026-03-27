export interface CrisisResource {
  country: string;
  countryName: string;
  resources: Array<{
    name: string;
    type: "phone" | "text" | "chat" | "website";
    contact: string;
    availability: string;
    description: string;
    languages: string[];
  }>;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    country: "CA",
    countryName: "Canada",
    resources: [
      {
        name: "Talk Suicide Canada",
        type: "phone",
        contact: "1-833-456-4566",
        availability: "24/7",
        description: "National crisis and suicide prevention line staffed by trained counselors.",
        languages: ["English", "French"],
      },
      {
        name: "Talk Suicide Canada",
        type: "text",
        contact: "45645",
        availability: "Daily 4pm–midnight ET",
        description: "Text-based crisis support. Send a text to connect with a counselor.",
        languages: ["English"],
      },
      {
        name: "Crisis Services Canada",
        type: "chat",
        contact: "crisisservicescanada.ca",
        availability: "24/7",
        description: "Online chat crisis support for Canadians in distress.",
        languages: ["English", "French"],
      },
      {
        name: "Kids Help Phone",
        type: "phone",
        contact: "1-800-668-6868",
        availability: "24/7",
        description: "Crisis support for youth under 20. Also serves young adults.",
        languages: ["English", "French"],
      },
      {
        name: "Kids Help Phone",
        type: "text",
        contact: "686868 (HELLO)",
        availability: "24/7",
        description: "Text-based crisis support for youth.",
        languages: ["English", "French"],
      },
      {
        name: "Assaulted Women's Helpline",
        type: "phone",
        contact: "1-866-863-0511",
        availability: "24/7",
        description: "Support for women experiencing violence or abuse. Confidential.",
        languages: ["English", "French", "Multiple via interpreter"],
      },
    ],
  },
  {
    country: "US",
    countryName: "United States",
    resources: [
      {
        name: "988 Suicide & Crisis Lifeline",
        type: "phone",
        contact: "988",
        availability: "24/7",
        description: "National crisis line — call or text 988 to reach a counselor.",
        languages: ["English", "Spanish"],
      },
      {
        name: "988 Suicide & Crisis Lifeline",
        type: "text",
        contact: "988",
        availability: "24/7",
        description: "Text 988 for crisis support.",
        languages: ["English", "Spanish"],
      },
      {
        name: "Crisis Text Line",
        type: "text",
        contact: "Text HOME to 741741",
        availability: "24/7",
        description: "Free, confidential crisis counseling via text.",
        languages: ["English"],
      },
      {
        name: "National Domestic Violence Hotline",
        type: "phone",
        contact: "1-800-799-7233",
        availability: "24/7",
        description: "Support for anyone experiencing domestic violence or abuse.",
        languages: ["English", "Spanish", "200+ via interpreter"],
      },
      {
        name: "National Domestic Violence Hotline",
        type: "text",
        contact: "Text START to 88788",
        availability: "24/7",
        description: "Text-based support for domestic violence situations.",
        languages: ["English"],
      },
      {
        name: "SAMHSA National Helpline",
        type: "phone",
        contact: "1-800-662-4357",
        availability: "24/7",
        description: "Mental health and substance use support — free, confidential, treatment referral.",
        languages: ["English", "Spanish"],
      },
    ],
  },
  {
    country: "GB",
    countryName: "United Kingdom",
    resources: [
      {
        name: "Samaritans",
        type: "phone",
        contact: "116 123",
        availability: "24/7",
        description: "Free confidential crisis support. No judgment, just listening.",
        languages: ["English", "Welsh"],
      },
      {
        name: "Samaritans",
        type: "chat",
        contact: "samaritans.org",
        availability: "24/7",
        description: "Online chat or email support through the Samaritans website.",
        languages: ["English"],
      },
      {
        name: "Crisis Text Line UK",
        type: "text",
        contact: "Text SHOUT to 85258",
        availability: "24/7",
        description: "Free crisis support via text — anonymous and confidential.",
        languages: ["English"],
      },
      {
        name: "National Domestic Abuse Helpline",
        type: "phone",
        contact: "0808 2000 247",
        availability: "24/7",
        description: "Free helpline run by Refuge for anyone experiencing domestic abuse.",
        languages: ["English"],
      },
      {
        name: "Mind Infoline",
        type: "phone",
        contact: "0300 123 3393",
        availability: "Mon-Fri 9am-6pm",
        description: "Mental health information and signposting for people in England and Wales.",
        languages: ["English"],
      },
    ],
  },
  {
    country: "AU",
    countryName: "Australia",
    resources: [
      {
        name: "Lifeline",
        type: "phone",
        contact: "13 11 14",
        availability: "24/7",
        description: "National crisis support and suicide prevention line.",
        languages: ["English"],
      },
      {
        name: "Lifeline",
        type: "chat",
        contact: "lifeline.org.au",
        availability: "7pm-midnight AEDT daily",
        description: "Online crisis chat support.",
        languages: ["English"],
      },
      {
        name: "Beyond Blue",
        type: "phone",
        contact: "1300 22 4636",
        availability: "24/7",
        description: "Support for anxiety, depression, and mental health concerns.",
        languages: ["English"],
      },
      {
        name: "1800RESPECT",
        type: "phone",
        contact: "1800 737 732",
        availability: "24/7",
        description: "National sexual assault, domestic and family violence counseling service.",
        languages: ["English", "Multiple via interpreter"],
      },
      {
        name: "Kids Helpline",
        type: "phone",
        contact: "1800 55 1800",
        availability: "24/7",
        description: "Free private counseling for children and young people aged 5-25.",
        languages: ["English"],
      },
    ],
  },
  {
    country: "IR",
    countryName: "Iran",
    resources: [
      {
        name: "Social Emergency Line (اورژانس اجتماعی)",
        type: "phone",
        contact: "123",
        availability: "24/7",
        description: "Iran's national social emergency line for crises including domestic violence and mental health emergencies.", // VERIFY BEFORE LAUNCH
        languages: ["Farsi"],
      },
      {
        name: "Welfare Organization Crisis Line (خط اضطراری سازمان بهزیستی)",
        type: "phone",
        contact: "1480",
        availability: "24/7",
        description: "Mental health and social crisis support through Iran's welfare organization.", // VERIFY BEFORE LAUNCH
        languages: ["Farsi"],
      },
      {
        name: "Persian Speaking Counselors — CAMH (Canada)",
        type: "phone",
        contact: "1-800-463-2338",
        availability: "Mon-Fri 9am-5pm ET",
        description: "For Persian-speaking individuals in Canada, CAMH offers cultural consultation. May be able to connect with Farsi-speaking counselors.", // VERIFY BEFORE LAUNCH
        languages: ["Farsi", "English"],
      },
      {
        name: "Befrienders Worldwide",
        type: "website",
        contact: "befrienders.org",
        availability: "24/7",
        description: "International directory of crisis support centers. May include resources accessible to those in or from Iran.",
        languages: ["Multiple"],
      },
    ],
  },
];
