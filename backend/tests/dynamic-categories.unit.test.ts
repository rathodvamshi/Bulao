import { describe, it, expect } from "vitest";
import {
  MAIN_CATEGORIES,
  SUBCATEGORIES,
  sanitizeAnswersForSubcategory,
  validateSubcategoryAnswers,
  generateDynamicJobTitle,
  generateDynamicJobDescription,
} from "../../mobile/src/features/post-work/dynamicCategories";

describe("Bulao — Dynamic Post Job System Specification Tests", () => {
  it("defines Tuition and Education & Training as distinct main categories", () => {
    expect(MAIN_CATEGORIES.map((c) => c.id)).toEqual(["tuition", "education-training", "other"]);
    expect(MAIN_CATEGORIES.find((c) => c.id === "tuition")?.name).toBe("Tuition");
    expect(MAIN_CATEGORIES.find((c) => c.id === "education-training")?.name).toBe("Education & Training");
    expect(MAIN_CATEGORIES.find((c) => c.id === "other")?.name).toBe("Other");
  });

  it("subcategories are strictly grouped under their respective main category", () => {
    const tuitionSubs = SUBCATEGORIES.filter((s) => s.categoryId === "tuition");
    expect(tuitionSubs.map((s) => s.id)).toEqual(["school-tuition", "college-tuition"]);

    const eduSubs = SUBCATEGORIES.filter((s) => s.categoryId === "education-training");
    expect(eduSubs.map((s) => s.id)).toEqual([
      "competitive-exams",
      "computer-it-courses",
      "vocational-skills",
      "languages-creative",
    ]);
  });

  it("Case 1: User posts School Tuition with multiple subjects", () => {
    const answers = {
      schoolClasses: ["Class 10"],
      schoolBoard: "CBSE",
      schoolSubjects: ["Mathematics", "Physics", "Chemistry"],
      teachingMode: "home" as const,
      tutorGender: "male" as const,
      tutorExperience: "5+",
      preferredTiming: "Evening",
      exactStartTime: "6:00 PM",
      exactEndTime: "7:30 PM",
      budgetAmount: "15000",
      budgetUnit: "month",
      additionalRequirements: "Experienced tutor preferred",
    };

    const valid = validateSubcategoryAnswers("school-tuition", answers);
    expect(valid.valid).toBe(true);

    const title = generateDynamicJobTitle("tuition", "school-tuition", answers);
    expect(title).toContain("Experienced Male Tutor for Class 10 (Mathematics)");

    const desc = generateDynamicJobDescription("Tuition", "School Tuition", answers, "Manikonda");
    expect(desc).toContain("Category: Tuition → School Tuition");
    expect(desc).toContain("• Class: Class 10");
    expect(desc).toContain("• Syllabus / Board: CBSE");
    expect(desc).toContain("• Subject(s): Mathematics, Physics, Chemistry");
    expect(desc).toContain("• Preferred Tutor Gender: Male");
    expect(desc).toContain("• Preferred Experience: 5+ years");
    expect(desc).toContain("• Timings: Evening (6:00 PM - 7:30 PM)");
    expect(desc).toContain("• Location: Manikonda");
    expect(desc).toContain("• Budget: ₹15,000 per month");
    expect(desc).toContain("• Additional requirements: Experienced tutor preferred");
    expect(desc).toContain("Interested providers can connect through Bulao.");
  });

  it("Case 2: User posts College & University Tuition", () => {
    const answers = {
      collegeCourse: "B.Tech / B.E.",
      collegeBranch: "Computer Science (CSE)",
      collegeSemester: "3rd Year",
      collegeSubjects: ["Data Structures & Algorithms"],
      teachingMode: "online" as const,
    };

    const valid = validateSubcategoryAnswers("college-tuition", answers);
    expect(valid.valid).toBe(true);

    const title = generateDynamicJobTitle("tuition", "college-tuition", answers);
    expect(title).toBe("Need a Tutor for B.Tech / B.E. (Data Structures & Algorithms)");

    const desc = generateDynamicJobDescription("Tuition", "College & University Tuition", answers);
    expect(desc).toContain("Category: Tuition → College & University Tuition");
    expect(desc).toContain("• Course / Qualification: B.Tech / B.E.");
    expect(desc).toContain("• Branch / Specialization: Computer Science (CSE)");
    expect(desc).toContain("• Teaching Mode: Online");
    expect(desc).not.toContain("• Location:");
  });

  it("Case 3: User posts Competitive Exam Coaching", () => {
    const answers = {
      examName: "NEET",
      examFocus: ["Physics"],
      targetYear: "2027",
      prepLevel: "Intermediate / Concept Revision",
      teachingMode: "hybrid" as const,
    };

    const valid = validateSubcategoryAnswers("competitive-exams", answers);
    expect(valid.valid).toBe(true);

    const title = generateDynamicJobTitle("education-training", "competitive-exams", answers);
    expect(title).toBe("Looking for NEET Coach (Physics)");

    const desc = generateDynamicJobDescription("Education & Training", "Competitive Exam Coaching", answers, "Tolichowki");
    expect(desc).toContain("• Examination: NEET");
    expect(desc).toContain("• Subject / Focus: Physics");
    expect(desc).toContain("• Target Year: 2027");
    expect(desc).toContain("• Teaching Mode: Hybrid");
    expect(desc).toContain("• Location: Tolichowki");
  });

  it("Case 4: User posts Computer & IT Courses", () => {
    const answers = {
      itCourse: "Python Programming",
      itSkillLevel: "Beginner",
      teachingMode: "online" as const,
      preferredTiming: "Flexible",
    };

    const valid = validateSubcategoryAnswers("computer-it-courses", answers);
    expect(valid.valid).toBe(true);

    const title = generateDynamicJobTitle("education-training", "computer-it-courses", answers);
    expect(title).toBe("Looking for a Python Programming Trainer");

    const desc = generateDynamicJobDescription("Education & Training", "Computer & IT Courses", answers);
    expect(desc).toContain("Category: Education & Training → Computer & IT Courses");
    expect(desc).toContain("• Course / Technology: Python Programming");
    expect(desc).toContain("• Skill Level: Beginner");
    expect(desc).toContain("• Teaching Mode: Online");
    expect(desc).toContain("• Timings: Flexible");
    expect(desc).toContain("• Budget: Not specified");
  });

  it("Case 5: User posts Professional & Vocational Skills", () => {
    const answers = {
      vocationalSkill: "Tally with GST",
      vocationalObjective: "Start Freelancing / Business",
      vocationalExperience: "Beginner",
      teachingMode: "home" as const,
    };

    const valid = validateSubcategoryAnswers("vocational-skills", answers);
    expect(valid.valid).toBe(true);

    const title = generateDynamicJobTitle("education-training", "vocational-skills", answers);
    expect(title).toBe("Need a Trainer for Tally with GST");
  });

  it("Case 6: User posts Languages & Creative Skills", () => {
    const answers = {
      creativeSkill: "Spoken English & Communication",
      creativeProficiency: "Beginner / From Scratch",
      creativeGoal: "Daily Conversation Fluency",
      teachingMode: "online" as const,
    };

    const valid = validateSubcategoryAnswers("languages-creative", answers);
    expect(valid.valid).toBe(true);

    const title = generateDynamicJobTitle("education-training", "languages-creative", answers);
    expect(title).toBe("Need an Instructor for Spoken English & Communication");
  });

  it("Case 11: Changing subcategory cleanses incompatible answers without retaining hidden data", () => {
    const schoolAnswers = {
      schoolClasses: ["Class 10"],
      schoolBoard: "CBSE",
      schoolSubjects: ["Mathematics"],
      itCourse: "Python", // Incompatible lingering field
      examName: "JEE", // Incompatible lingering field
      teachingMode: "home" as const,
    };

    const sanitized = sanitizeAnswersForSubcategory("school-tuition", schoolAnswers as any);
    expect(sanitized.schoolClasses).toEqual(["Class 10"]);
    expect(sanitized.schoolBoard).toBe("CBSE");
    expect(sanitized.schoolSubjects).toEqual(["Mathematics"]);
    expect((sanitized as any).itCourse).toBeUndefined();
    expect((sanitized as any).examName).toBeUndefined();
  });

  it("Case 12: User selects Other and provides custom text", () => {
    const answers = {
      schoolClasses: ["Class 10"],
      schoolSubjects: ["Other"],
      customSchoolSubject: "Sanskrit",
      schoolBoard: "Other",
      customSchoolBoard: "State Open Board",
    };

    const valid = validateSubcategoryAnswers("school-tuition", answers);
    expect(valid.valid).toBe(true);

    const title = generateDynamicJobTitle("tuition", "school-tuition", answers);
    expect(title).toContain("Sanskrit");

    const desc = generateDynamicJobDescription("Tuition", "School Tuition", answers);
    expect(desc).toContain("• Subject(s): Sanskrit");
    expect(desc).toContain("• Syllabus / Board: State Open Board");
  });
});
