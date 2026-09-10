export type VerificationResult = {
  isValid: boolean;
  sanitizedName: string;
  errorReason?: string;
};

// ----------------------------------------------------
// COMPREHENSIVE MULTI-LANGUAGE SECURITY & PROFANITY DICTIONARY
// (English, Hindi, Devanagari, Telugu, Telugu script, Tamil, Kannada, Punjabi, Hinglish, Teluglish)
// ----------------------------------------------------

const ENGLISH_PROFANITY: string[] = [
  "fuck", "fck", "fuk", "fuxk", "fckin", "fucking", "fucked", "fucker", "fukker", 
  "shit", "sht", "shity", "shitting", "shitted", "bullshit", "bitch", "btch", "bitching", 
  "bastard", "bstrd", "asshole", "ass", "arse", "arsehole", "cunt", "cnt", "dick", "dik", 
  "pussy", "puss", "cock", "whore", "slut", "slutty", "nigga", "nigger", "motherfucker", 
  "motherfukker", "mf", "wtf", "bs", "twat", "prick", "wanker", "dumbass", "jackass", 
  "idiot", "stupid", "moron", "retard", "pervert", "douche", "douchebag", "crap", 
  "horny", "sex", "sexy", "porn", "porno", "boobs", "boob", "tit", "tits", "penis", 
  "vagina", "clitoris", "ejaculation", "orgasm", "masturbate", "nude", "naked", "erotic"
];

const HINDI_HINGLISH_PROFANITY: string[] = [
  // Devanagari Script
  "चूतिया", "चूतिये", "चूतियापा", "भेंचोध", "मादरचोद", "मादरचोध", "भोसडीके", "भोसडीवााला", 
  "गांड", "गांडू", "गांडमारा", "लौड़ा", "लौड़े", "लंड", "लौंडे", "रंडी", "रांड", "साला", 
  "साले", "हरामी", "कमीना", "कमीने", "कुतिया", "हरामजादा", "चोदना", "चुदाई", "छिनाल", 
  "छिछोरा", "झांट", "टट्टे", "बकचोदी", "मुठ मारना", "गांड चाटना",

  // Romanized Hindi / Hinglish Transliterations
  "chutiya", "chutiye", "chutya", "chutiyapa", "bhenchod", "benchod", "bhchod", "bhnchod", 
  "bc", "mc", "madarchod", "maderchod", "madrchod", "bhosdike", "bhosdi", "bhosda", "bhosdiwala", 
  "gand", "gaand", "gandu", "gandmara", "gandfat", "gandmasti", "laund", "lauda", "laude", 
  "loda", "lode", "lund", "lundly", "chut", "choot", "chudai", "chod", "chodo", "chodna", 
  "randi", "raand", "randiwaala", "saala", "saale", "saley", "harami", "haramzada", "kamina", 
  "kamine", "kuttiya", "kutta", "kutti", "harambhada", "jhant", "jhaant", "tatte", "tatta", 
  "bakchodi", "bakchod", "muth", "muthmaar", "gandchatu", "chinal", "chichora"
];

const TELUGU_TELUGLISH_PROFANITY: string[] = [
  // Telugu Script
  "లంజ", "లంజకొడుకా", "లంజముండా", "పూకు", "మొడ్డ", "గుద్ద", "దెంగు", "దెంగేయ్", "ఎర్రిపూకు", 
  "ఎదవ", "బోకు", "దొంగ", "సుల్లి", "సుళ్ల", "ముండా", "సూతుడి", "లంజదానా", "సావు",

  // Romanized Telugu / Teluglish Transliterations
  "dengey", "dengei", "dengeo", "dengay", "dengu", "dengedhedi", "laja", "lanja", "lanjakodaka", 
  "lanja kodaka", "lanjakodka", "lanjamunda", "lanjadana", "pooku", "poku", "puku", "pookupola", 
  "modda", "mdda", "modda gudupu", "modagoodu", "gudha", "guda", "guddha", "gudhamar", "bolli", 
  "sulla", "sulley", "sulli", "erri pooku", "erripooku", "erri paku", "erripaku", "boku", "boku munda", 
  "donga", "donga naa dash", "yedava", "yedhava", "edava", "munda", "chetha", "lavada", "lawada", 
  "laawada", "santu", "sulley", "saavu"
];

const REGIONAL_INDIAN_PROFANITY: string[] = [
  // Tamil, Kannada, Malayalam, Punjabi
  "punda", "pundai", "sunni", "koothi", "thootu", "thevadiya", "ombu", "othu", 
  "sule", "sule munde", "bolli", "khanki", "bhosadi", "madarchodh", "penchod", 
  "fuddi", "bund", "lora", "kanja", "chutiye", "bhenchod", "bsdk", "mcf", "bcf"
];

const SCAM_ABUSE_KEYWORDS: string[] = [
  "hack", "crypto", "bitcoin", "free money", "telegram", "whatsapp", "loan scam", 
  "mod apk", "cheat", "gambling", "casino", "betting", "bribe", "illegal", 
  "escort", "call girl", "massage parlor", "drug", "weed", "cocaine", "heroin", 
  "fake job", "earn online", "deposit first", "investment scam", "multi level"
];

const REPETITIVE_GIBBERISH_PATTERNS: string[] = [
  "ddd", "eee", "fff", "ggg", "hhh", "iii", "jjj", "kkk", "lll", "mmm", 
  "nnn", "ooo", "ppp", "qqq", "rrr", "sss", "ttt", "uuu", "vvv", "www", 
  "xxx", "yyy", "zzz", "aaa", "bbb", "ccc", "xyz", "abc", "qwe", "asd", 
  "zxc", "asdf", "qwerty", "zxcv", "12345", "testtest", "abcd", "fghj", 
  "hjkl", "mnbv", "lkjh", "poiu", "uytr", "wery", "sasa", "dada", "fafa", 
  "gaga", "haha", "jaja", "kaka", "lala", "popo", "titi", "yaya", "zaza"
];

// Combine all prohibited seed words
const ALL_PROFANITY_SEEDS: string[] = Array.from(
  new Set([
    ...ENGLISH_PROFANITY,
    ...HINDI_HINGLISH_PROFANITY,
    ...TELUGU_TELUGLISH_PROFANITY,
    ...REGIONAL_INDIAN_PROFANITY,
    ...SCAM_ABUSE_KEYWORDS,
    ...REPETITIVE_GIBBERISH_PATTERNS,
  ])
);

/**
 * Normalizes text to catch character substitution & obfuscation evasions:
 * e.g., "c.h.u.t.i.y.a" -> "chutiya", "f**k" -> "fuck", "d3ng3y" -> "dengey", "p00ku" -> "pooku"
 */
function normalizeLeetSpeak(str: string): string {
  return str
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/!/g, "i")
    .replace(/\|/g, "i")
    .replace(/\*/g, "")
    .replace(/[-_.\s,;:/\\]/g, ""); // Remove all separators to catch spaced/punctuated bad words
}

/**
 * Advanced Multi-Language Verification & Security Engine.
 * Features:
 * 1. Deep single-character repetition detection ("ddd", "eee", "d-d-d", "e.e.e")
 * 2. Multi-language profanity detection across English, Hindi, Telugu, Tamil, Kannada, Punjabi, Hinglish, Teluglish
 * 3. Leet-speak obfuscation unraveling
 * 4. Contact details & URL protection
 * 5. Keyboard mashing & gibberish elimination
 */
export function verifyCustomName(input: string): VerificationResult {
  if (!input) {
    return {
      isValid: false,
      sanitizedName: "",
      errorReason: "Name cannot be empty.",
    };
  }

  // 1. XSS Sanitization & Whitespace Normalization
  let clean = input
    .replace(/<[^>]*>?/g, "") // Strip HTML tags
    .replace(/[\x00-\x1F\x7F]/g, "") // Strip control characters
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();

  // 2. Length Boundaries
  if (clean.length < 3) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Minimum 3 letters required.",
    };
  }

  if (clean.length > 40) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Maximum 40 characters allowed.",
    };
  }

  // 3. Security Check: Contact Info (Phone numbers, URLs, Emails)
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10,12}\b/;
  const urlRegex = /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|in|org|net|co|io|app|dev))/i;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  if (phoneRegex.test(clean)) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Phone numbers are not allowed in work names.",
    };
  }

  if (urlRegex.test(clean) || emailRegex.test(clean)) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Links or email addresses are not allowed.",
    };
  }

  // 4. Character Quality & Symbol Check
  const invalidSymbolsRegex = /[#$%^*()_+=\[\]{}|\\;:<>?~`!]/;
  if (invalidSymbolsRegex.test(clean)) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Prohibited symbols used (use letters, &, -, / only).",
    };
  }

  // Require at least 3 alphabetic letters (supports international unicode letters)
  const letterMatches = clean.match(/[\p{L}]/gu);
  if (!letterMatches || letterMatches.length < 3) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Must contain at least 3 alphabetic letters.",
    };
  }

  // 5. Random Single-Letter & Repetition Detection (e.g. "ddd", "eee", "d d d", "e-e-e")
  const lower = clean.toLowerCase();
  const normalized = normalizeLeetSpeak(clean);

  // Catch 3+ identical consecutive characters
  if (/(.)\1{2,}/i.test(clean)) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Random letter repetition detected (e.g. 'ddd'). Please enter a real work name.",
    };
  }

  // Catch spaced out or punctuated single letter repetition (e.g. "d d d", "e.e.e")
  const alphabeticOnly = lower.replace(/[^a-z]/g, "");
  if (alphabeticOnly.length >= 3) {
    const uniqueChars = new Set(alphabeticOnly.split(""));
    if (uniqueChars.size === 1) {
      return {
        isValid: false,
        sanitizedName: clean,
        errorReason: "Single character repeated. Please enter a valid work name.",
      };
    }
  }

  // 6. Multi-Language Vulgarity, Harassment & Scam Seed Filter
  const lowerWords = lower.split(/[\s\-_/.]+/);
  const isProfane = ALL_PROFANITY_SEEDS.some((seedWord) => {
    const seedLower = seedWord.toLowerCase();
    
    // Short seeds (2-3 chars like "bc", "mc", "mf", "ddd", "eee") require exact word/token match
    if (seedLower.length <= 3) {
      return (
        lower === seedLower ||
        lowerWords.includes(seedLower) ||
        normalized === seedLower
      );
    }
    
    // Longer seed words (4+ chars): substring check in raw, word-list, or normalized text
    return (
      lower.includes(seedLower) ||
      lowerWords.some((w) => w.includes(seedLower)) ||
      normalized.includes(seedLower)
    );
  });

  if (isProfane) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Inappropriate, profane, or invalid name detected. Please enter a clean work name.",
    };
  }

  return {
    isValid: true,
    sanitizedName: clean,
  };
}

// ----------------------------------------------------
// JOB TITLE VERIFICATION & CONTEXT CHECK
// ----------------------------------------------------
export function verifyJobTitle(
  input: string,
  categoryName?: string,
  roleName?: string
): VerificationResult & { hasContextMatch?: boolean } {
  if (!input || input.trim().length === 0) {
    return {
      isValid: false,
      sanitizedName: "",
      errorReason: "Job title is required.",
    };
  }

  // 1. Sanitize
  let clean = input
    .replace(/<[^>]*>?/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 2. Length Checks
  if (clean.length < 4) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Job title must be at least 4 characters.",
    };
  }

  if (clean.length > 80) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Job title cannot exceed 80 characters.",
    };
  }

  // 3. Check for minimum 2 words
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Please enter at least 2 words (e.g. '" + (roleName || "Worker") + " needed').",
    };
  }

  // 4. Security Check: Contact info / URLs
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10,12}\b/;
  const urlRegex = /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|in|org|net|co|io|app|dev))/i;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  if (phoneRegex.test(clean)) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Phone numbers are not allowed in job titles.",
    };
  }

  if (urlRegex.test(clean) || emailRegex.test(clean)) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Links and email addresses are not allowed.",
    };
  }

  // 5. Check for repetitive gibberish patterns
  if (/(.)\1{2,}/i.test(clean)) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Repeated random letters detected (e.g. 'ddd'). Please enter a clear job title.",
    };
  }

  // 6. Profanity / Vulgarity verification
  const lower = clean.toLowerCase();
  const normalized = normalizeLeetSpeak(clean);
  const lowerWords = lower.split(/[\s\-_/.]+/);

  const isProfane = ALL_PROFANITY_SEEDS.some((seedWord) => {
    const seedLower = seedWord.toLowerCase();
    if (seedLower.length <= 3) {
      return (
        lower === seedLower ||
        lowerWords.includes(seedLower) ||
        normalized === seedLower
      );
    }
    return (
      lower.includes(seedLower) ||
      lowerWords.some((w) => w.includes(seedLower)) ||
      normalized.includes(seedLower)
    );
  });

  if (isProfane) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Inappropriate language or prohibited words detected. Please enter a clean title.",
    };
  }

  // 7. Context Match Verification (Role + Category relevance check)
  const cleanLower = clean.toLowerCase();
  const catTokens = (categoryName || "").toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const roleTokens = (roleName || "").toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  const commonWorkKeywords = [
    "work", "worker", "workers", "needed", "required", "urgent", "hire", "looking", "help", 
    "helper", "daily", "monthly", "emergency", "service", "job", "cook", "maid", "clean", 
    "paint", "plumb", "wire", "electric", "drive", "driver", "guard", "tutor", "shift",
    "repair", "fitting", "mason", "carpenter", "kitchen", "delivery", "shop", "office"
  ];

  const hasRoleMatch = roleTokens.some(tok => cleanLower.includes(tok));
  const hasCatMatch = catTokens.some(tok => cleanLower.includes(tok));
  const hasWorkKeyword = commonWorkKeywords.some(kw => cleanLower.includes(kw));

  const hasContextMatch = hasRoleMatch || hasCatMatch || hasWorkKeyword;

  return {
    isValid: true,
    sanitizedName: clean,
    hasContextMatch,
  };
}

// ----------------------------------------------------
// OPTIONAL JOB DESCRIPTION SECURITY VERIFICATION
// ----------------------------------------------------
export function verifyJobDescription(input: string): VerificationResult {
  if (!input || input.trim().length === 0) {
    return {
      isValid: true,
      sanitizedName: "",
    };
  }

  let clean = input
    .replace(/<[^>]*>?/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // If user entered something, enforce min 10 chars, max 500 chars
  if (clean.length < 10) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Description should be at least 10 characters if provided.",
    };
  }

  if (clean.length > 500) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Description cannot exceed 500 characters.",
    };
  }

  // URLs and Email checks
  const urlRegex = /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|in|org|net|co|io|app|dev))/i;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  if (urlRegex.test(clean) || emailRegex.test(clean)) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Links or email addresses are not allowed.",
    };
  }

  // Profanity check
  const lower = clean.toLowerCase();
  const normalized = normalizeLeetSpeak(clean);
  const lowerWords = lower.split(/[\s\-_/.]+/);

  const isProfane = ALL_PROFANITY_SEEDS.some((seedWord) => {
    const seedLower = seedWord.toLowerCase();
    if (seedLower.length <= 3) {
      return (
        lowerWords.includes(seedLower) ||
        normalized === seedLower
      );
    }
    return (
      lower.includes(seedLower) ||
      lowerWords.some((w) => w.includes(seedLower)) ||
      normalized.includes(seedLower)
    );
  });

  if (isProfane) {
    return {
      isValid: false,
      sanitizedName: clean,
      errorReason: "Inappropriate language or prohibited keywords detected in description.",
    };
  }

  return {
    isValid: true,
    sanitizedName: clean,
  };
}

// ----------------------------------------------------
// DYNAMIC EXPERIENCE OPTIONS BASED ON CATEGORY & ROLE
// ----------------------------------------------------
export type DynamicExperienceOption = {
  value: "any" | "some" | "expert";
  badge: string;
  label: string;
  subtext: string;
  icon: string;
};

export function getExperienceOptionsForRole(
  roleId: string,
  roleName: string,
  categoryId: string
): DynamicExperienceOption[] {
  const r = (roleId || "").toLowerCase();
  const rName = (roleName || "").toLowerCase();
  const c = (categoryId || "").toLowerCase();

  // Skilled Construction / Trades
  if (
    c.includes("construction") ||
    r.includes("mason") ||
    r.includes("plumb") ||
    r.includes("electr") ||
    r.includes("carpent") ||
    r.includes("paint") ||
    r.includes("weld")
  ) {
    return [
      {
        value: "any",
        badge: "Entry / Helper",
        label: "Basic / 1 yr",
        subtext: "Can do basic site work & assistance",
        icon: "🛠️",
      },
      {
        value: "some",
        badge: "Skilled Worker",
        label: "2–4 Years",
        subtext: "Independent, knows full tool work",
        icon: "⚡",
      },
      {
        value: "expert",
        badge: "Master / Mistri",
        label: "5+ Years",
        subtext: "Expert craftsman, leads complex work",
        icon: "👑",
      },
    ];
  }

  // Food / Cooking / Chef
  if (c.includes("food") || r.includes("cook") || r.includes("chef") || rName.includes("cook")) {
    return [
      {
        value: "any",
        badge: "Home Cooking",
        label: "Any Experience",
        subtext: "Everyday home style meals & helpers",
        icon: "🍳",
      },
      {
        value: "some",
        badge: "Experienced Cook",
        label: "1–3 Years",
        subtext: "Fast cooking, multi-cuisine recipes",
        icon: "🍲",
      },
      {
        value: "expert",
        badge: "Head Chef / Master",
        label: "4+ Years",
        subtext: "Catering, restaurant & large orders",
        icon: "👨‍🍳",
      },
    ];
  }

  // Driving & Logistics
  if (c.includes("transport") || r.includes("driver") || rName.includes("driver")) {
    return [
      {
        value: "any",
        badge: "Valid License",
        label: "1+ Year Driving",
        subtext: "Knows local routes & basic driving",
        icon: "🚗",
      },
      {
        value: "some",
        badge: "Experienced Driver",
        label: "2–4 Years",
        subtext: "City navigation, clean safety record",
        icon: "🛣️",
      },
      {
        value: "expert",
        badge: "Commercial Pro",
        label: "5+ Years",
        subtext: "Highway, commercial & luxury vehicles",
        icon: "⭐",
      },
    ];
  }

  // Security
  if (c.includes("security") || r.includes("guard") || rName.includes("security")) {
    return [
      {
        value: "any",
        badge: "General Guard",
        label: "Fresh / Entry",
        subtext: "Gate monitoring & basic patrolling",
        icon: "🛡️",
      },
      {
        value: "some",
        badge: "Trained Guard",
        label: "1–3 Years",
        subtext: "Trained in registry & visitor management",
        icon: "🎖️",
      },
      {
        value: "expert",
        badge: "Senior / Ex-Defense",
        label: "3+ Years",
        subtext: "Armed / high-alert safety protocols",
        icon: "🌟",
      },
    ];
  }

  // Household / Domestic
  if (c.includes("household") || r.includes("maid") || r.includes("clean") || rName.includes("maid")) {
    return [
      {
        value: "any",
        badge: "Freshers Welcome",
        label: "Any / Fresh",
        subtext: "Basic cleaning & housekeeping help",
        icon: "🧹",
      },
      {
        value: "some",
        badge: "Experienced Help",
        label: "1–2 Years",
        subtext: "Independent, trustworthy home help",
        icon: "✨",
      },
      {
        value: "expert",
        badge: "Senior Housekeeper",
        label: "3+ Years",
        subtext: "Full house maintenance & care",
        icon: "💎",
      },
    ];
  }

  // Default / General
  return [
    {
      value: "any",
      badge: "No Minimum",
      label: "Any Level",
      subtext: "Freshers & willing learners welcome",
      icon: "🌱",
    },
    {
      value: "some",
      badge: "Some Experience",
      label: "1–2 Years",
      subtext: "Good knowledge of regular tasks",
      icon: "🙂",
    },
    {
      value: "expert",
      badge: "Experienced Pro",
      label: "3+ Years",
      subtext: "Highly skilled & quick turnarounds",
      icon: "🏅",
    },
  ];
}

// ----------------------------------------------------
// ROLE-SPECIFIC GENDER AVATARS & DRESS CODES
// ----------------------------------------------------
export type RoleGenderIcons = {
  maleIcon: string;
  femaleIcon: string;
  anyIcon: string;
  customIcon: string;
  roleWorkIcon: string;
};

export function getRoleGenderIcons(
  roleId: string,
  roleName: string,
  categoryId: string
): RoleGenderIcons {
  const r = (roleId || "").toLowerCase();
  const rName = (roleName || "").toLowerCase();
  const c = (categoryId || "").toLowerCase();

  // Construction / Site / Skilled Trades (Hardhat, overalls)
  if (
    c.includes("construction") ||
    r.includes("mason") ||
    r.includes("plumb") ||
    r.includes("electr") ||
    r.includes("carpent") ||
    r.includes("paint") ||
    r.includes("weld") ||
    r.includes("labor") ||
    r.includes("helper")
  ) {
    return {
      maleIcon: "👷‍♂️",
      femaleIcon: "👷‍♀️",
      anyIcon: "👥",
      customIcon: "🚻",
      roleWorkIcon: "🏗️",
    };
  }

  // Cooking / Kitchen / Chef (Chef hat & Apron)
  if (c.includes("food") || r.includes("cook") || r.includes("chef") || rName.includes("cook")) {
    return {
      maleIcon: "👨‍🍳",
      femaleIcon: "👩‍🍳",
      anyIcon: "👥",
      customIcon: "🚻",
      roleWorkIcon: "🍳",
    };
  }

  // Household / Cleaning / Maid / Housekeeper
  if (
    c.includes("household") ||
    r.includes("maid") ||
    r.includes("clean") ||
    r.includes("housekeep") ||
    rName.includes("maid")
  ) {
    return {
      maleIcon: "👨‍🌾",
      femaleIcon: "👩‍🌾",
      anyIcon: "👥",
      customIcon: "🚻",
      roleWorkIcon: "🧹",
    };
  }

  // Driving / Logistics / Transport (Uniformed Driver)
  if (
    c.includes("transport") ||
    r.includes("driver") ||
    rName.includes("driver") ||
    r.includes("rider")
  ) {
    return {
      maleIcon: "👨‍✈️",
      femaleIcon: "👩‍✈️",
      anyIcon: "👥",
      customIcon: "🚻",
      roleWorkIcon: "🚗",
    };
  }

  // Security / Guard (Uniformed Officer)
  if (
    c.includes("security") ||
    r.includes("guard") ||
    r.includes("bouncer") ||
    rName.includes("security")
  ) {
    return {
      maleIcon: "👮‍♂️",
      femaleIcon: "👮‍♀️",
      anyIcon: "👥",
      customIcon: "🚻",
      roleWorkIcon: "🛡️",
    };
  }

  // Office / Retail / Sales / Shop / Tutor (Professional / Formal)
  if (
    c.includes("office") ||
    c.includes("education") ||
    c.includes("shop") ||
    r.includes("shop") ||
    r.includes("teacher") ||
    r.includes("reception")
  ) {
    return {
      maleIcon: "👨‍💼",
      femaleIcon: "👩‍💼",
      anyIcon: "👥",
      customIcon: "🚻",
      roleWorkIcon: "💼",
    };
  }

  // Healthcare / Caretaker / Nursing (Medical Scrub / Uniform)
  if (
    c.includes("health") ||
    r.includes("care") ||
    r.includes("nurse") ||
    r.includes("elderly")
  ) {
    return {
      maleIcon: "👨‍⚕️",
      femaleIcon: "👩‍⚕️",
      anyIcon: "👥",
      customIcon: "🚻",
      roleWorkIcon: "🩺",
    };
  }

  // Default / Mechanic / General technician
  return {
    maleIcon: "👨‍🔧",
    femaleIcon: "👩‍🔧",
    anyIcon: "👥",
    customIcon: "🚻",
    roleWorkIcon: "🛠️",
  };
}

// ----------------------------------------------------
// ROLE & CATEGORY-SPECIFIC TITLE SUGGESTIONS WITH PREMIUM ICONS
// ----------------------------------------------------
export type TitleSuggestionItem = {
  text: string;
  icon: string;
  color: string;
  badge: string;
};

// Comprehensive mapping for EVERY role in the seed database & platform catalog
export const ROLE_EXACT_ICONS: Record<string, string> = {
  // Construction & Trades
  "construction-helper": "👷",
  "helper": "👷",
  "laborer": "👷",
  "mason": "🧱",
  "painter": "🎨",
  "carpenter": "🪚",
  "electrician": "⚡",
  "plumber": "🔧",
  "tile-worker": "🔲",
  "tile_worker": "🔲",
  "centering_worker": "🏗️",
  "welder": "🔥",

  // Home Services & Household
  "housekeeper": "🧹",
  "maid": "🧹",
  "cook-home": "🍳",
  "nanny": "👶",
  "babysitter": "👶",
  "personal-driver": "🚗",
  "gardener": "🌱",
  "car_washer": "🧼",

  // Food & Hospitality
  "chef": "👨‍🍳",
  "cook": "👨‍🍳",
  "kitchen-helper": "🥘",
  "waiter": "🍽️",
  "server": "🍽️",
  "barista": "☕",
  "baker": "🥐",
  "catering-staff": "🍱",
  "dishwasher": "🧽",
  "food-packer": "📦",

  // Transport & Delivery
  "delivery-person": "📦",
  "delivery_boy": "📦",
  "bike-rider": "🏍️",
  "driver": "🚗",
  "auto_driver": "🛺",
  "loader": "🏋️",
  "courier": "✉️",

  // Retail & Sales
  "sales-assistant": "🛍️",
  "salesperson": "🛍️",
  "cashier": "💳",
  "shop-helper": "🏪",
  "shop_assistant": "🏪",
  "inventory-manager": "📊",
  "storekeeper": "📊",
  "merchandiser": "🛒",

  // Events & Functions
  "event-helper": "🙋",
  "event-server": "🍽️",
  "decorator": "🎈",
  "event-coordinator": "📋",
  "photographer": "📸",
  "dj": "🎧",

  // Security & Safety
  "security-guard": "💂",
  "guard": "💂",
  "watchman": "🔐",
  "bouncer": "🕴️",
  "security_supervisor": "🛡️",

  // Education & Tuition
  "tutor-maths": "➗",
  "tutor-science": "🔬",
  "tutor-english": "📖",
  "tutor-all-subjects": "📚",
  "tutor": "📚",
  "teacher": "📚",
  "music-teacher": "🎵",
  "dance-teacher": "💃",
  "yoga-instructor": "🧘",
  "computer-teacher": "💻",
  "language-tutor": "🗣️",
  "sports-coach": "🏅",

  // Healthcare & Caregiving
  "elderly-caretaker": "🧓",
  "elderly_care": "🧓",
  "home-nurse": "👩‍⚕️",
  "patient-attendant": "🧑‍⚕️",
  "physiotherapist": "🩺",
  "baby-care-nurse": "👶",

  // Beauty & Wellness
  "beautician": "💄",
  "mehendi-artist": "🤲",
  "makeup-artist": "💋",
  "hair-stylist": "💇‍♀️",
  "massage-therapist": "💆",

  // Marketing & Promotion
  "promoter": "📣",
  "brand-ambassador": "⭐",
  "leaflet-distributor": "📄",
  "survey-collector": "📝",

  // Office & Admin
  "office-boy": "🧑‍💼",
  "receptionist": "🛎️",
  "data-entry": "⌨️",
  "telecaller": "📞",

  // Custom / Other
  "other": "✨",
  "other-role": "✨",
};

export function getExactRoleIcon(
  roleId: string,
  roleName: string,
  categoryId?: string
): string {
  const rId = (roleId || "").toLowerCase();
  if (ROLE_EXACT_ICONS[rId]) return ROLE_EXACT_ICONS[rId];

  const name = (roleName || "").toLowerCase();
  if (name.includes("mason") || name.includes("brick")) return "🧱";
  if (name.includes("paint")) return "🎨";
  if (name.includes("plumb") || name.includes("pipe")) return "🔧";
  if (name.includes("electr") || name.includes("wire")) return "⚡";
  if (name.includes("carpent") || name.includes("wood")) return "🪚";
  if (name.includes("weld")) return "🔥";
  if (name.includes("tile")) return "🔲";
  if (name.includes("cook") || name.includes("chef")) return "👨‍🍳";
  if (name.includes("clean") || name.includes("maid") || name.includes("housekeep")) return "🧹";
  if (name.includes("driv") || name.includes("cab") || name.includes("ride")) return "🚗";
  if (name.includes("guard") || name.includes("secur") || name.includes("watchman")) return "💂";
  if (name.includes("teach") || name.includes("tutor") || name.includes("learn")) return "📚";
  if (name.includes("baby") || name.includes("nanny")) return "👶";
  if (name.includes("nurse") || name.includes("doctor") || name.includes("health")) return "🩺";
  if (name.includes("beaut") || name.includes("makeup") || name.includes("hair")) return "💄";
  if (name.includes("shop") || name.includes("cash") || name.includes("sales")) return "🛍️";
  if (name.includes("pack") || name.includes("load") || name.includes("deliver")) return "📦";
  if (name.includes("event") || name.includes("decor")) return "🎈";
  if (name.includes("photo") || name.includes("camera")) return "📸";
  if (name.includes("music") || name.includes("sound")) return "🎵";
  if (name.includes("garden") || name.includes("plant")) return "🌱";

  // Category fallback
  const c = (categoryId || "").toLowerCase();
  if (c.includes("construction")) return "🏗️";
  if (c.includes("food")) return "🍳";
  if (c.includes("transport")) return "🚚";
  if (c.includes("household")) return "🏠";
  if (c.includes("security")) return "🛡️";
  if (c.includes("education")) return "🎓";
  if (c.includes("health")) return "🩺";
  if (c.includes("beauty")) return "💇‍♀️";
  if (c.includes("office")) return "💼";
  if (c.includes("shop")) return "🏪";
  if (c.includes("event")) return "🎉";

  return "🛠️";
}

export function getTitleSuggestionsForRole(
  roleId: string,
  roleName: string,
  categoryId: string,
  categoryName: string
): TitleSuggestionItem[] {
  const r = roleName || "Worker";
  const c = categoryName || "work";
  const roleWorkIcon = getExactRoleIcon(roleId, roleName, categoryId);

  return [
    {
      text: `${r} needed`,
      icon: roleWorkIcon,
      color: "#1A6645",
      badge: "Standard",
    },
    {
      text: `Urgent ${r} required`,
      icon: "⚡",
      color: "#D97706",
      badge: "Urgent",
    },
    {
      text: `${r} for ${c}`,
      icon: "📋",
      color: "#2563EB",
      badge: "Category",
    },
    {
      text: `Experienced ${r} wanted`,
      icon: "⭐",
      color: "#7C3AED",
      badge: "Skilled",
    },
  ];
}
