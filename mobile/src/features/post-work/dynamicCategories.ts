import { Ionicons } from "@expo/vector-icons";

export type MainCategoryId = "tuition" | "education-training" | "other";

export type SubcategoryId =
  | "school-tuition"
  | "college-tuition"
  | "competitive-exams"
  | "computer-it-courses"
  | "vocational-skills"
  | "languages-creative";

export interface MainCategoryConfig {
  id: MainCategoryId;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

export interface SubcategoryConfig {
  id: SubcategoryId;
  categoryId: MainCategoryId;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

export const MAIN_CATEGORIES: MainCategoryConfig[] = [
  {
    id: "tuition",
    name: "Tuition",
    icon: "school-outline",
    description: "Academic subject teaching for school and college learners.",
  },
  {
    id: "education-training",
    name: "Education & Training",
    icon: "ribbon-outline",
    description: "Competitive-exam preparation, structured courses and specialized skill development.",
  },
  {
    id: "other",
    name: "Other",
    icon: "ellipsis-horizontal-circle-outline",
    description: "Post a job that does not fit the categories above.",
  },
];

export const SUBCATEGORIES: SubcategoryConfig[] = [
  // A. Tuition
  {
    id: "school-tuition",
    categoryId: "tuition",
    name: "School Tuition",
    icon: "school-outline",
    description: "Classes Nursery to 12th / Inter, Board syllabus & academic coaching",
  },
  {
    id: "college-tuition",
    categoryId: "tuition",
    name: "College & University Tuition",
    icon: "business-outline",
    description: "Degree, engineering, diploma & university academic subjects",
  },
  // B. Education & Training
  {
    id: "competitive-exams",
    categoryId: "education-training",
    name: "Competitive Exam Coaching",
    icon: "trophy-outline",
    description: "JEE, NEET, GATE, EAMCET, UPSC, State PSC, SSC, Banking, etc.",
  },
  {
    id: "computer-it-courses",
    categoryId: "education-training",
    name: "Computer & IT Courses",
    icon: "laptop-outline",
    description: "Python, Java, Web Dev, Mobile Dev, AI/ML, Data Science, Excel, etc.",
  },
  {
    id: "vocational-skills",
    categoryId: "education-training",
    name: "Professional & Vocational Skills",
    icon: "briefcase-outline",
    description: "Tally, Accounting, Digital Marketing, Graphic Design, Tailoring, etc.",
  },
  {
    id: "languages-creative",
    categoryId: "education-training",
    name: "Languages & Creative Skills",
    icon: "language-outline",
    description: "Spoken English, Foreign Languages, Music, Dance, Drawing, etc.",
  },
];

// Common Teaching Modes
export const TEACHING_MODES = [
  { id: "home", label: "At learner's home", icon: "home-outline", requiresLocation: true },
  { id: "center", label: "At provider's location", icon: "business-outline", requiresLocation: true },
  { id: "online", label: "Online", icon: "laptop-outline", requiresLocation: false },
  { id: "hybrid", label: "Hybrid", icon: "sync-outline", requiresLocation: true },
] as const;

// Quick Timing Slots
export const PREFERRED_TIMINGS = [
  { id: "Morning", label: "Morning", defaultTime: "8:00 AM - 12:00 PM", icon: "sunny-outline" },
  { id: "Afternoon", label: "Afternoon", defaultTime: "12:00 PM - 4:00 PM", icon: "partly-sunny-outline" },
  { id: "Evening", label: "Evening", defaultTime: "5:00 PM - 7:30 PM", icon: "moon-outline" },
  { id: "Flexible", label: "Flexible", defaultTime: "To be discussed", icon: "time-outline" },
] as const;

// Tutor Preferences
export const TUTOR_GENDERS = [
  { id: "any", label: "No preference" },
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
] as const;

export const TUTOR_EXPERIENCES = [
  { id: "any", label: "Any" },
  { id: "1+", label: "1+ years" },
  { id: "3+", label: "3+ years" },
  { id: "5+", label: "5+ years" },
  { id: "10+", label: "10+ years" },
] as const;

// Pricing Units
export const PRICING_UNITS = [
  { id: "month", label: "Monthly" },
  { id: "hour", label: "Per hour" },
  { id: "session", label: "Per session" },
  { id: "course", label: "Per course" },
  { id: "negotiable", label: "Negotiable" },
  { id: "demo_first", label: "Demo first / discuss" },
] as const;

// School Tuition Options
export const SCHOOL_CLASSES = [
  "Nursery",
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11 / Inter 1st Year",
  "Class 12 / Inter 2nd Year",
];

export const SCHOOL_BOARDS = [
  "CBSE",
  "ICSE",
  "SSC / State Board",
  "IB",
  "IGCSE",
  "Other",
];

export const SCHOOL_SUBJECTS = [
  "All Subjects",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "General Science",
  "Social Studies",
  "English",
  "Hindi",
  "Telugu",
  "Computer Science",
  "Other",
];

// College & University Tuition Options
export const COLLEGE_COURSES = [
  "B.Tech / B.E.",
  "B.Sc",
  "B.Com",
  "BBA",
  "BCA",
  "MBBS",
  "Pharmacy",
  "Diploma / Polytechnic",
  "M.Tech",
  "MBA",
  "MCA",
  "Other",
];

export const COLLEGE_BRANCHES = [
  "Computer Science (CSE)",
  "Electronics & Comm (ECE)",
  "Electrical & Electronics (EEE)",
  "Mechanical Engineering",
  "Civil Engineering",
  "Information Technology (IT)",
  "Data Science / AI",
  "Commerce / Accounts",
  "Management / Finance",
  "General",
  "Other",
];

export const COLLEGE_SEMESTERS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8",
  "Other",
];

export const COLLEGE_SUBJECTS = [
  "Engineering Mathematics",
  "Data Structures & Algorithms",
  "Circuit Theory & Networks",
  "Digital Electronics",
  "Operating Systems",
  "Thermodynamics",
  "Mechanics of Solids",
  "Financial Accounting",
  "Cost & Management Accounting",
  "Programming (C / C++ / Java / Python)",
  "Other",
];

// Competitive Exam Coaching Options
export const COMPETITIVE_EXAMS = [
  "JEE (Mains & Advanced)",
  "NEET",
  "GATE",
  "EAMCET / EAPCET",
  "UPSC Civil Services",
  "State PSC (Group 1 / 2)",
  "SSC (CGL / CHSL)",
  "Banking (IBPS / SBI PO & Clerk)",
  "CAT / Management",
  "GRE / GMAT / IELTS",
  "Other",
];

export const EXAM_SUBJECT_FOCUS = [
  "Full Syllabus / All Subjects",
  "Quantitative Aptitude / Maths",
  "Logical Reasoning",
  "English / Verbal Ability",
  "Physics",
  "Chemistry",
  "Biology / Botany / Zoology",
  "General Studies (GS)",
  "Specific Subject / Paper",
  "Other",
];

export const TARGET_YEARS = ["2026", "2027", "2028", "Immediate / Ongoing", "Other"];

export const PREPARATION_LEVELS = [
  "Beginner / Starting Out",
  "Intermediate / Concept Revision",
  "Advanced / Problem Solving & Mock Tests",
];

// Computer & IT Courses Options
export const IT_COURSES = [
  "Python Programming",
  "Java Full Stack",
  "Full Stack Web Development",
  "React & React Native",
  "AI & Machine Learning",
  "Data Science & Analytics",
  "AWS & Cloud Computing",
  "DevOps",
  "Cyber Security & Ethical Hacking",
  "SQL & Databases",
  "Advanced Excel",
  "C / C++ Programming",
  "Other",
];

export const IT_SKILL_LEVELS = [
  "Complete Beginner",
  "Basic Knowledge",
  "Intermediate",
  "Advanced",
];

export const IT_LEARNING_GOALS = [
  "Job / Placement Preparation",
  "College Project",
  "Career Transition / Upskilling",
  "Professional Certification",
  "Personal Interest",
  "Other",
];

// Professional & Vocational Skills Options
export const VOCATIONAL_SKILLS = [
  "Tally with GST",
  "Accounting & Bookkeeping",
  "Digital Marketing & SEO",
  "Graphic Design & UI/UX",
  "Video Editing & VFX",
  "Tailoring & Fashion Design",
  "Photography & Videography",
  "Beautician & Makeup Artistry",
  "Mobile Repairing",
  "Electrician / Wiring",
  "Other",
];

export const VOCATIONAL_OBJECTIVES = [
  "Start Freelancing / Business",
  "Job Seeking / Placement",
  "Hobby & Personal Growth",
  "Professional Certification",
  "Other",
];

export const VOCATIONAL_EXPERIENCE = [
  "Beginner",
  "Some Exposure",
  "Intermediate",
];

// Languages & Creative Skills Options
export const CREATIVE_LANGUAGES = [
  "Spoken English & Communication",
  "Hindi",
  "Telugu",
  "German",
  "French",
  "Spanish",
  "Japanese",
  "Classical Music (Carnatic / Hindustani)",
  "Guitar / Keyboard",
  "Classical Dance (Bharatanatyam / Kuchipudi)",
  "Western Dance",
  "Drawing, Painting & Sketching",
  "Other",
];

export const CREATIVE_PROFICIENCY = [
  "Beginner / From Scratch",
  "Elementary / Basic Vocabulary",
  "Intermediate / Conversational",
];

export const CREATIVE_GOALS = [
  "Daily Conversation Fluency",
  "Career & Work Communication",
  "Foreign Travel & Immigration",
  "Hobby & Passion",
  "Exam Prep (IELTS / TOEFL / Certifications)",
  "Other",
];

// Data structure for dynamic answers
export interface DynamicJobAnswers {
  // Common
  teachingMode?: "home" | "center" | "online" | "hybrid";
  preferredTiming?: string;
  exactStartTime?: string;
  exactEndTime?: string;
  budgetAmount?: string;
  budgetUnit?: string;
  demoPreference?: "requested" | "not_requested" | "discuss";
  additionalRequirements?: string;

  // School Tuition
  schoolClasses?: string[];
  schoolBoard?: string;
  customSchoolBoard?: string;
  schoolSubjects?: string[];
  customSchoolSubject?: string;
  tutorGender?: "any" | "male" | "female" | "both";
  tutorCount?: number;
  tutorGenders?: Array<"male" | "female">;
  maleTutorCount?: number;
  femaleTutorCount?: number;
  anyTutorCount?: number;
  tutorExperience?: string;

  // College Tuition
  collegeCourse?: string;
  customCollegeCourse?: string;
  collegeBranch?: string;
  customCollegeBranch?: string;
  collegeSemester?: string;
  collegeSubjects?: string[];
  customCollegeSubject?: string;

  // Competitive Exams
  examName?: string;
  customExamName?: string;
  examFocus?: string[];
  customExamFocus?: string;
  targetYear?: string;
  customTargetYear?: string;
  prepLevel?: string;

  // Computer & IT
  itCourse?: string;
  customItCourse?: string;
  itSkillLevel?: string;
  itLearningGoal?: string;
  customItLearningGoal?: string;

  // Vocational
  vocationalSkill?: string;
  customVocationalSkill?: string;
  vocationalObjective?: string;
  customVocationalObjective?: string;
  vocationalExperience?: string;

  // Languages & Creative
  creativeSkill?: string;
  customCreativeSkill?: string;
  creativeProficiency?: string;
  creativeGoal?: string;
  customCreativeGoal?: string;
}

/**
 * Prunes incompatible answers when subcategory changes to prevent silent data retention.
 */
export function sanitizeAnswersForSubcategory(
  subcategoryId: SubcategoryId,
  answers: DynamicJobAnswers
): DynamicJobAnswers {
  const common = {
    teachingMode: answers.teachingMode,
    preferredTiming: answers.preferredTiming,
    exactStartTime: answers.exactStartTime,
    exactEndTime: answers.exactEndTime,
    budgetAmount: answers.budgetAmount,
    budgetUnit: answers.budgetUnit,
    demoPreference: answers.demoPreference,
    additionalRequirements: answers.additionalRequirements,
  };

  switch (subcategoryId) {
    case "school-tuition":
      return {
        ...common,
        schoolClasses: answers.schoolClasses,
        schoolBoard: answers.schoolBoard,
        customSchoolBoard: answers.customSchoolBoard,
        schoolSubjects: answers.schoolSubjects,
        customSchoolSubject: answers.customSchoolSubject,
        tutorGender: answers.tutorGender,
        tutorExperience: answers.tutorExperience,
      };
    case "college-tuition":
      return {
        ...common,
        collegeCourse: answers.collegeCourse,
        customCollegeCourse: answers.customCollegeCourse,
        collegeBranch: answers.collegeBranch,
        customCollegeBranch: answers.customCollegeBranch,
        collegeSemester: answers.collegeSemester,
        collegeSubjects: answers.collegeSubjects,
        customCollegeSubject: answers.customCollegeSubject,
        tutorGender: answers.tutorGender,
        tutorExperience: answers.tutorExperience,
      };
    case "competitive-exams":
      return {
        ...common,
        examName: answers.examName,
        customExamName: answers.customExamName,
        examFocus: answers.examFocus,
        customExamFocus: answers.customExamFocus,
        targetYear: answers.targetYear,
        customTargetYear: answers.customTargetYear,
        prepLevel: answers.prepLevel,
      };
    case "computer-it-courses":
      return {
        ...common,
        itCourse: answers.itCourse,
        customItCourse: answers.customItCourse,
        itSkillLevel: answers.itSkillLevel,
        itLearningGoal: answers.itLearningGoal,
        customItLearningGoal: answers.customItLearningGoal,
      };
    case "vocational-skills":
      return {
        ...common,
        vocationalSkill: answers.vocationalSkill,
        customVocationalSkill: answers.customVocationalSkill,
        vocationalObjective: answers.vocationalObjective,
        customVocationalObjective: answers.customVocationalObjective,
        vocationalExperience: answers.vocationalExperience,
      };
    case "languages-creative":
      return {
        ...common,
        creativeSkill: answers.creativeSkill,
        customCreativeSkill: answers.customCreativeSkill,
        creativeProficiency: answers.creativeProficiency,
        creativeGoal: answers.creativeGoal,
        customCreativeGoal: answers.customCreativeGoal,
      };
    default:
      return common;
  }
}

/**
 * Validates minimum required answers before continuing
 */
export function validateSubcategoryAnswers(
  subcategoryId: SubcategoryId,
  answers: DynamicJobAnswers
): { valid: boolean; error?: string } {
  switch (subcategoryId) {
    case "school-tuition":
      if (!answers.schoolClasses || answers.schoolClasses.length === 0) {
        return { valid: false, error: "Please select at least one class." };
      }
      if (!answers.schoolSubjects || answers.schoolSubjects.length === 0) {
        return { valid: false, error: "Please select at least one subject." };
      }
      if (answers.schoolSubjects.includes("Other") && !answers.customSchoolSubject?.trim()) {
        return { valid: false, error: "Please enter the custom subject." };
      }
      return { valid: true };

    case "college-tuition":
      if (!answers.collegeCourse || (answers.collegeCourse === "Other" && !answers.customCollegeCourse?.trim())) {
        return { valid: false, error: "Please select or specify your course." };
      }
      if (!answers.collegeSubjects || answers.collegeSubjects.length === 0) {
        return { valid: false, error: "Please select or specify at least one subject." };
      }
      if (answers.collegeSubjects.includes("Other") && !answers.customCollegeSubject?.trim()) {
        return { valid: false, error: "Please enter the custom subject." };
      }
      return { valid: true };

    case "competitive-exams":
      if (!answers.examName || (answers.examName === "Other" && !answers.customExamName?.trim())) {
        return { valid: false, error: "Please select or specify the competitive exam." };
      }
      return { valid: true };

    case "computer-it-courses":
      if (!answers.itCourse || (answers.itCourse === "Other" && !answers.customItCourse?.trim())) {
        return { valid: false, error: "Please select or specify the IT course / technology." };
      }
      return { valid: true };

    case "vocational-skills":
      if (!answers.vocationalSkill || (answers.vocationalSkill === "Other" && !answers.customVocationalSkill?.trim())) {
        return { valid: false, error: "Please select or specify the vocational skill." };
      }
      return { valid: true };

    case "languages-creative":
      if (!answers.creativeSkill || (answers.creativeSkill === "Other" && !answers.customCreativeSkill?.trim())) {
        return { valid: false, error: "Please select or specify the language or creative skill." };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
}

/**
 * Automatically generates job title according to Specification Section 8
 */
export function generateDynamicJobTitle(
  mainCategoryId: string,
  subcategoryId: string,
  answers: DynamicJobAnswers
): string {
  if (subcategoryId === "school-tuition") {
    const classText = answers.schoolClasses && answers.schoolClasses.length > 0
      ? answers.schoolClasses.length === 1
        ? answers.schoolClasses[0]
        : answers.schoolClasses.length === 2
        ? `${answers.schoolClasses[0]} & ${answers.schoolClasses[1]}`
        : `${answers.schoolClasses[0]} +${answers.schoolClasses.length - 1}`
      : "";

    const subjects = answers.schoolSubjects || [];
    const subjectText = subjects.length > 0
      ? subjects.includes("Other") && answers.customSchoolSubject
        ? answers.customSchoolSubject
        : subjects[0]
      : "";

    const genderPrefix = answers.tutorGender === "both"
      ? "Male or Female "
      : answers.tutorGender === "male"
      ? "Male "
      : answers.tutorGender === "female"
      ? "Female "
      : "";

    const expPrefix = answers.tutorExperience && answers.tutorExperience !== "any"
      ? "Experienced "
      : "";

    const subjectSuffix = subjectText ? ` (${subjectText})` : "";
    if (classText) {
      return `Wanted: ${expPrefix}${genderPrefix}Tutor for ${classText}${subjectSuffix}`;
    }
    return `Wanted: ${expPrefix}${genderPrefix}School Tutor${subjectSuffix}`;
  }

  if (subcategoryId === "college-tuition") {
    const subjects = answers.collegeSubjects || [];
    const subjectText = subjects.length > 0
      ? subjects.includes("Other") && answers.customCollegeSubject
        ? answers.customCollegeSubject
        : subjects[0]
      : "";
    const subjectSuffix = subjectText ? ` (${subjectText})` : "";
    const course = answers.collegeCourse === "Other"
      ? answers.customCollegeCourse || "College"
      : answers.collegeCourse || "College";
    return `Need a Tutor for ${course}${subjectSuffix}`;
  }

  if (subcategoryId === "competitive-exams") {
    const focus = answers.examFocus || [];
    const focusText = focus.length > 0
      ? focus.includes("Other") && answers.customExamFocus
        ? answers.customExamFocus
        : focus[0]
      : "";
    const exam = answers.examName === "Other"
      ? answers.customExamName || "Competitive Exam"
      : answers.examName || "Competitive Exam";
    if (focusText) {
      return `Looking for ${exam} Coach (${focusText})`;
    }
    return `Looking for ${exam} Coaching`;
  }

  if (subcategoryId === "computer-it-courses") {
    const course = answers.itCourse === "Other"
      ? answers.customItCourse || "IT Course"
      : answers.itCourse || "IT Course";
    return `Looking for a ${course} Trainer`;
  }

  if (subcategoryId === "vocational-skills") {
    const skill = answers.vocationalSkill === "Other"
      ? answers.customVocationalSkill || "Vocational Skill"
      : answers.vocationalSkill || "Vocational Skill";
    return `Need a Trainer for ${skill}`;
  }

  if (subcategoryId === "languages-creative") {
    const skill = answers.creativeSkill === "Other"
      ? answers.customCreativeSkill || "Language / Creative Skill"
      : answers.creativeSkill || "Language / Creative Skill";
    return `Need an Instructor for ${skill}`;
  }

  return "Service Provider Needed";
}

/**
 * Automatically formats full job description according to Specification Section 8
 */
export function generateDynamicJobDescription(
  mainCategoryName: string,
  subcategoryName: string,
  answers: DynamicJobAnswers,
  locationArea?: string
): string {
  const lines: string[] = [];
  lines.push(`Category: ${mainCategoryName} → ${subcategoryName}`);
  lines.push("");

  // Subcategory specific bullets
  if (answers.schoolClasses && answers.schoolClasses.length > 0) {
    lines.push(`• Class: ${answers.schoolClasses.join(", ")}`);
  }
  if (answers.schoolBoard) {
    const board = answers.schoolBoard === "Other" && answers.customSchoolBoard
      ? answers.customSchoolBoard
      : answers.schoolBoard;
    lines.push(`• Syllabus / Board: ${board}`);
  }
  if (answers.schoolSubjects && answers.schoolSubjects.length > 0) {
    const subList = answers.schoolSubjects.map((s) =>
      s === "Other" && answers.customSchoolSubject ? answers.customSchoolSubject : s
    );
    lines.push(`• Subject(s): ${subList.join(", ")}`);
  }

  if (answers.collegeCourse) {
    const course = answers.collegeCourse === "Other" && answers.customCollegeCourse
      ? answers.customCollegeCourse
      : answers.collegeCourse;
    lines.push(`• Course / Qualification: ${course}`);
  }
  if (answers.collegeBranch) {
    const branch = answers.collegeBranch === "Other" && answers.customCollegeBranch
      ? answers.customCollegeBranch
      : answers.collegeBranch;
    lines.push(`• Branch / Specialization: ${branch}`);
  }
  if (answers.collegeSemester) {
    lines.push(`• Semester / Year: ${answers.collegeSemester}`);
  }
  if (answers.collegeSubjects && answers.collegeSubjects.length > 0) {
    const subList = answers.collegeSubjects.map((s) =>
      s === "Other" && answers.customCollegeSubject ? answers.customCollegeSubject : s
    );
    lines.push(`• Subject(s): ${subList.join(", ")}`);
  }

  if (answers.examName) {
    const exam = answers.examName === "Other" && answers.customExamName
      ? answers.customExamName
      : answers.examName;
    lines.push(`• Examination: ${exam}`);
  }
  if (answers.examFocus && answers.examFocus.length > 0) {
    const focusList = answers.examFocus.map((f) =>
      f === "Other" && answers.customExamFocus ? answers.customExamFocus : f
    );
    lines.push(`• Subject / Focus: ${focusList.join(", ")}`);
  }
  if (answers.targetYear) {
    const yr = answers.targetYear === "Other" && answers.customTargetYear
      ? answers.customTargetYear
      : answers.targetYear;
    lines.push(`• Target Year: ${yr}`);
  }
  if (answers.prepLevel) {
    lines.push(`• Current Level: ${answers.prepLevel}`);
  }

  if (answers.itCourse) {
    const course = answers.itCourse === "Other" && answers.customItCourse
      ? answers.customItCourse
      : answers.itCourse;
    lines.push(`• Course / Technology: ${course}`);
  }
  if (answers.itSkillLevel) {
    lines.push(`• Skill Level: ${answers.itSkillLevel}`);
  }
  if (answers.itLearningGoal) {
    const goal = answers.itLearningGoal === "Other" && answers.customItLearningGoal
      ? answers.customItLearningGoal
      : answers.itLearningGoal;
    lines.push(`• Learning Goal: ${goal}`);
  }

  if (answers.vocationalSkill) {
    const skill = answers.vocationalSkill === "Other" && answers.customVocationalSkill
      ? answers.customVocationalSkill
      : answers.vocationalSkill;
    lines.push(`• Skill / Course: ${skill}`);
  }
  if (answers.vocationalObjective) {
    const obj = answers.vocationalObjective === "Other" && answers.customVocationalObjective
      ? answers.customVocationalObjective
      : answers.vocationalObjective;
    lines.push(`• Learning Objective: ${obj}`);
  }
  if (answers.vocationalExperience) {
    lines.push(`• Experience Level: ${answers.vocationalExperience}`);
  }

  if (answers.creativeSkill) {
    const skill = answers.creativeSkill === "Other" && answers.customCreativeSkill
      ? answers.customCreativeSkill
      : answers.creativeSkill;
    lines.push(`• Language / Skill: ${skill}`);
  }
  if (answers.creativeProficiency) {
    lines.push(`• Proficiency Level: ${answers.creativeProficiency}`);
  }
  if (answers.creativeGoal) {
    const goal = answers.creativeGoal === "Other" && answers.customCreativeGoal
      ? answers.customCreativeGoal
      : answers.creativeGoal;
    lines.push(`• Learning Goal: ${goal}`);
  }

  // Common preferences
  if (answers.teachingMode) {
    const modeLabel = answers.teachingMode === "online"
      ? "Online"
      : answers.teachingMode === "home"
      ? "In-Person (At Learner's Home)"
      : answers.teachingMode === "center"
      ? "In-Person (At Provider's Location)"
      : "Hybrid";
    lines.push(`• Teaching Mode: ${modeLabel}`);
  }

  const selectedTutorGenders = answers.tutorGenders || (answers.tutorGender === "both" ? ["male", "female"] : answers.tutorGender && answers.tutorGender !== "any" ? [answers.tutorGender] : []);
  if (selectedTutorGenders.length > 0) {
    lines.push(`• Preferred Tutor Gender: ${selectedTutorGenders.map((gender) => gender === "male" ? "Male" : "Female").join(" and ")}`);
    if (selectedTutorGenders.includes("male")) {
      lines.push(`• Male Tutors Required: ${Math.max(1, Math.min(100, Number(answers.maleTutorCount ?? answers.tutorCount) || 1))}`);
    }
    if (selectedTutorGenders.includes("female")) {
      lines.push(`• Female Tutors Required: ${Math.max(1, Math.min(100, Number(answers.femaleTutorCount ?? answers.tutorCount) || 1))}`);
    }
  } else if (answers.tutorGender === "any" || !answers.tutorGender) {
    lines.push(`• Tutors Required (Any Gender): ${Math.max(1, Math.min(100, Number(answers.anyTutorCount ?? answers.tutorCount) || 1))}`);
  }
  if (answers.tutorExperience && answers.tutorExperience !== "any") {
    lines.push(`• Preferred Experience: ${answers.tutorExperience} years`);
  }

  if (answers.preferredTiming) {
    if (answers.exactStartTime && answers.exactEndTime) {
      lines.push(`• Timings: ${answers.preferredTiming} (${answers.exactStartTime} - ${answers.exactEndTime})`);
    } else {
      lines.push(`• Timings: ${answers.preferredTiming}`);
    }
  }

  if (locationArea && answers.teachingMode !== "online") {
    lines.push(`• Location: ${locationArea}`);
  }

  if (answers.demoPreference === "requested") {
    lines.push(`• Demo Session: Requested before finalizing`);
  }

  if (answers.budgetAmount && parseFloat(answers.budgetAmount) > 0) {
    const unitStr = answers.budgetUnit ? ` per ${answers.budgetUnit}` : "";
    lines.push(`• Budget: ₹${Number(answers.budgetAmount).toLocaleString("en-IN")}${unitStr}`);
  } else if (answers.budgetUnit === "negotiable") {
    lines.push(`• Budget: Negotiable / Open to discuss`);
  } else if (answers.budgetUnit === "demo_first" || answers.demoPreference === "discuss") {
    lines.push(`• Budget: Decided after demo trial`);
  } else {
    lines.push(`• Budget: Not specified`);
  }

  if (answers.additionalRequirements?.trim()) {
    lines.push(`• Additional requirements: ${answers.additionalRequirements.trim()}`);
  }

  lines.push("");
  lines.push("Interested providers can connect through Bulao.");

  return lines.join("\n");
}
