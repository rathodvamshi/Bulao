/**
 * Smart Job Title Generator & Academic Taxonomies
 * 
 * Generates clear, high-intent job titles based on Category, Role, and dynamic details.
 * Supports individual school classes (Nursery, LKG, UKG, 1-10) with multi-selection,
 * shortcut names for Intermediate (MPC, BiPC, CEC, MEC, HEC),
 * and concise board names (SSC, CBSE, ICSE, IB, IGCSE).
 */

export interface EducationDetails {
  academicTier?: 'school' | 'intermediate' | 'college' | 'competitive';
  educationLevel?: string[];
  subjects?: string[];
  customSubject?: string;
  board?: string;
  stream?: string;
  exam?: string;
  teachingFormat?: 'home' | 'online' | 'center' | 'flexible';
  numberOfStudents?: number;
  studentLevel?: string;
  teachingLanguage?: string[];
  tutorQualification?: string;
  demoRequired?: 'required' | 'preferred' | 'none';
  specialRequirements?: string[];
}

export interface TradeDetails {
  tradeSpecialty?: string;
  materialsProvided?: 'poster' | 'worker' | 'discuss';
  taskType?: string;
}

export interface DeliveryDetails {
  vehicleType?: string;
  deliveryType?: string;
  licenseRequired?: boolean;
}

export interface CategoryDetails extends EducationDetails, TradeDetails, DeliveryDetails {
  [key: string]: any;
}

/**
 * Format selected school classes into a clean, human-friendly phrase
 */
export function formatSelectedClasses(classes: string[]): string {
  if (!classes || classes.length === 0) return "";
  if (classes.length === 1) return classes[0] || "";

  // Check if purely pre-primary
  const prePrimary = ["Nursery", "LKG", "UKG"];
  const allPrePrimary = classes.every((c) => prePrimary.includes(c));
  if (allPrePrimary) {
    if (classes.length === 3) return "Pre-Primary (Nursery–UKG)";
    return classes.join(" & ");
  }

  // Extract class numbers if classes are "Class X"
  const classNums = classes
    .filter((c) => c.startsWith("Class "))
    .map((c) => parseInt(c.replace("Class ", ""), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  if (classNums.length === classes.length) {
    // If consecutive range e.g. 1 to 5
    const isConsecutive =
      classNums.length > 2 &&
      classNums[classNums.length - 1]! - classNums[0]! === classNums.length - 1;

    if (isConsecutive) {
      return `Classes ${classNums[0]} to ${classNums[classNums.length - 1]}`;
    }
    if (classNums.length === 2) {
      return `Classes ${classNums[0]} & ${classNums[1]}`;
    }
    if (classNums.length <= 4) {
      return `Classes ${classNums.join(", ")}`;
    }
    return `Classes ${classNums[0]}–${classNums[classNums.length - 1]} (${classNums.length} Classes)`;
  }

  return classes.length <= 3 ? classes.join(" & ") : `${classes[0]}, ${classes[1]} +${classes.length - 2}`;
}

/**
 * Generate a smart, human-friendly title
 */
export function generateSmartTitle(
  category: string,
  categoryName: string,
  role: string,
  roleName: string,
  details?: CategoryDetails
): string {
  const cat = (category || "").toLowerCase();
  const catName = categoryName || "";
  const rName = roleName || "Worker";

  // 1. EDUCATION CATEGORY
  if (cat.includes("edu") || catName.toLowerCase().includes("edu")) {
    const isTutor = rName.toLowerCase().includes("tutor") || rName.toLowerCase().includes("teach");
    const roleLabel = isTutor ? (rName.toLowerCase().includes("teacher") ? "Teacher" : "Tutor") : rName;

    // Check subjects
    const subjects = details?.subjects || [];
    let subjectText = "";
    if (subjects.length > 0) {
      if (subjects.includes("Other") && details?.customSubject) {
        const filtered = subjects.filter((s) => s !== "Other");
        subjectText = filtered.length > 0 ? `${filtered.join(", ")} & ${details.customSubject}` : details.customSubject;
      } else if (subjects.includes("All Subjects") || subjects.includes("All School Subjects")) {
        subjectText = "All Subjects";
      } else if (subjects.length === 1) {
        subjectText = subjects[0] || "";
      } else if (subjects.length === 2) {
        subjectText = `${subjects[0]} & ${subjects[1]}`;
      } else if (subjects.length >= 3) {
        subjectText = `${subjects[0]}, ${subjects[1]} +${subjects.length - 2}`;
      }
    }

    // Check class/level
    const levels = details?.educationLevel || [];
    const formattedClassText = formatSelectedClasses(levels);

    // Check curriculum/board (Short name: SSC, CBSE, ICSE, IB, IGCSE)
    const board = details?.board && details.board !== "Other" ? details.board : "";
    
    // Check stream (MPC, BiPC, CEC, MEC) or exam (JEE, NEET, EAMCET)
    const stream = details?.stream && details.stream !== "Other" ? details.stream : "";
    const exam = details?.exam && details.exam !== "Other" ? details.exam : "";

    const parts: string[] = [];

    if (details?.academicTier === "intermediate" || (!details?.academicTier && stream)) {
      if (stream) parts.push(`Inter ${stream}`);
      if (board) parts.push(board);
    } else if (details?.academicTier === "competitive" || (!details?.academicTier && exam)) {
      if (exam) parts.push(exam);
    } else if (details?.academicTier === "college") {
      if (details?.degree) parts.push(details.degree);
    } else {
      if (formattedClassText) parts.push(formattedClassText);
      if (board) parts.push(board);
    }

    // Subjects are displayed in specifications, not in title per user design requirements

    // Add format if home tuition
    if (details?.teachingFormat === "home") {
      parts.push(`Home ${roleLabel}`);
    } else if (details?.teachingFormat === "online") {
      parts.push(`Online ${roleLabel}`);
    } else {
      parts.push(roleLabel);
    }

    if (parts.length > 1) {
      return `Need a ${parts.join(" ")}`;
    }
    return `Need a ${roleLabel}`;
  }

  // 2. CONSTRUCTION & TRADES
  if (cat.includes("construct") || catName.toLowerCase().includes("build")) {
    if (details?.tradeSpecialty) {
      return `${rName} Needed for ${details.tradeSpecialty}`;
    }
    return `${rName} Needed for Construction Work`;
  }

  // 3. HOUSEHOLD & CLEANING
  if (cat.includes("house") || catName.toLowerCase().includes("clean") || catName.toLowerCase().includes("home")) {
    if (details?.taskType) {
      return `${rName} Needed for ${details.taskType}`;
    }
    return `${rName} Needed for Home Services`;
  }

  // 4. TRANSPORT & DELIVERY
  if (cat.includes("trans") || cat.includes("deliv") || catName.toLowerCase().includes("transport")) {
    if (details?.vehicleType) {
      return `${rName} Needed (${details.vehicleType})`;
    }
    if (details?.deliveryType) {
      return `${rName} Needed for ${details.deliveryType}`;
    }
    return `${rName} Needed for Delivery Work`;
  }

  // 5. FOOD & RESTAURANT
  if (cat.includes("food") || catName.toLowerCase().includes("cook")) {
    if (details?.taskType) {
      return `${rName} Needed for ${details.taskType}`;
    }
    return `${rName} Needed for Kitchen & Food`;
  }

  // 6. DEFAULT FALLBACK
  return `${rName} Needed`;
}

/**
 * Individual School Classes (Nursery, LKG, UKG, Class 1 to Class 10)
 */
export const SCHOOL_PRE_PRIMARY = ["Nursery", "LKG", "UKG"] as const;
export const SCHOOL_PRIMARY = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"] as const;
export const SCHOOL_MIDDLE = ["Class 6", "Class 7", "Class 8"] as const;
export const SCHOOL_HIGH = ["Class 9", "Class 10"] as const;

export const ALL_SCHOOL_CLASSES = [
  ...SCHOOL_PRE_PRIMARY,
  ...SCHOOL_PRIMARY,
  ...SCHOOL_MIDDLE,
  ...SCHOOL_HIGH,
] as const;

/**
 * Common Education Board / Curriculum Options (Clean short names)
 */
export const EDUCATION_BOARDS = [
  "SSC",
  "CBSE",
  "ICSE",
  "IB",
  "IGCSE",
  "Other",
] as const;

export const BOARD_DESCRIPTIONS: Record<string, string> = {
  SSC: "Telangana / State Board",
  CBSE: "Central Board",
  ICSE: "ICSE / ISC",
  IB: "International Baccalaureate",
  IGCSE: "Cambridge Board",
  Other: "Other Curriculum",
};

/**
 * Intermediate Streams (Clean short names)
 */
export const INTERMEDIATE_STREAMS = [
  "MPC",
  "BiPC",
  "CEC",
  "MEC",
  "HEC",
  "Other",
] as const;

export const STREAM_DESCRIPTIONS: Record<string, string> = {
  MPC: "Maths, Physics, Chemistry",
  BiPC: "Biology, Physics, Chemistry",
  CEC: "Civics, Economics, Commerce",
  MEC: "Maths, Economics, Commerce",
  HEC: "History, Economics, Civics",
  Other: "Other Groups / Vocational",
};

/**
 * Intermediate Years
 */
export const INTERMEDIATE_YEARS = [
  "Inter 1st Year (11th)",
  "Inter 2nd Year (12th)",
  "Both Years (11th & 12th)",
] as const;

/**
 * Competitive Exams (Clean short names)
 */
export const COMPETITIVE_EXAMS = [
  "JEE",
  "NEET",
  "EAMCET",
  "CA Foundation",
  "CLAT",
  "GATE",
  "UPSC",
  "Other",
] as const;

export const EXAM_DESCRIPTIONS: Record<string, string> = {
  JEE: "Main & Advanced",
  NEET: "Medical Entrance",
  EAMCET: "TG / AP EAPCET",
  "CA Foundation": "Commerce & CPT",
  CLAT: "Law Entrance",
  GATE: "Engineering & PSU",
  UPSC: "Civil Services / Govt",
  Other: "Other Competitive Exam",
};

/**
 * College / Degree Options
 */
export const COLLEGE_DEGREES = [
  "B.Tech / Engineering",
  "Degree (B.Sc / B.Com / B.A)",
  "BBA / BBM",
  "B.Pharmacy",
  "Postgraduate / Masters",
  "Other Degree",
] as const;

/**
 * Common Subjects by Level
 */
export const SUBJECT_OPTIONS: Record<string, string[]> = {
  school: [
    "All Subjects",
    "Mathematics",
    "Science",
    "Physics",
    "Chemistry",
    "Biology",
    "English",
    "Social Studies",
    "Hindi",
    "Telugu",
    "Computer Science",
    "Sanskrit",
    "Other",
  ],
  inter_mpc: [
    "All MPC Subjects",
    "Mathematics (1A/1B/2A/2B)",
    "Physics",
    "Chemistry",
    "English",
    "Sanskrit / Telugu",
    "Other",
  ],
  inter_bipc: [
    "All BiPC Subjects",
    "Botany",
    "Zoology",
    "Physics",
    "Chemistry",
    "English",
    "Other",
  ],
  inter_commerce: [
    "All Group Subjects",
    "Commerce & Accountancy",
    "Economics",
    "Civics / Political Science",
    "Mathematics",
    "English",
    "Other",
  ],
  college: [
    "Engineering Mathematics (M1/M2/M3)",
    "Data Structures & Algorithms",
    "Programming (Python / Java / C++)",
    "Financial Accounting",
    "Statistics & Quantitative Methods",
    "Micro / Macro Economics",
    "Organic / Inorganic Chemistry",
    "Other",
  ],
  competitive: [
    "Quantitative Aptitude",
    "Logical Reasoning",
    "Physics (JEE / NEET)",
    "Chemistry (JEE / NEET)",
    "Mathematics (JEE / EAMCET)",
    "Biology (NEET)",
    "General Studies & Current Affairs",
    "English & Verbal Ability",
    "Other",
  ],
};
