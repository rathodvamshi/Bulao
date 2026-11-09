# Bulao — Dynamic Post Job System Implementation

## 1. Overview
The Bulao Dynamic Post Job System provides a streamlined, configuration-driven job posting experience for service seekers. It eliminates lengthy, cluttered forms by dynamically adapting to user selections, displaying only the fields relevant to the chosen service.

---

## 2. Category & Subcategory Structure

### A. Tuition (`tuition`)
*Purpose: Academic subject teaching for school and college learners.*
- **School Tuition (`school-tuition`)**:
  - Class or education level (Nursery through Class 12 / Intermediate 2nd Year, multi-selection supported)
  - Board / Syllabus (CBSE, ICSE, SSC / State Board, IB, IGCSE, Other write-in)
  - Subject(s) (Mathematics, Physics, Chemistry, Biology, General Science, Social Studies, English, Telugu, Hindi, All Subjects, Other write-in)
  - Teaching Mode (At learner's home, At provider's location, Online, Hybrid)
  - Preferred Timing (Morning, Afternoon, Evening, Flexible + optional exact time range)
  - Optional Tutor Preferences (Gender: No preference, Male, Female; Experience: Any, 1+, 3+, 5+, 10+ years)
  - Optional Budget & Demo Preference
  - Additional Requirements (optional free text)
- **College & University Tuition (`college-tuition`)**:
  - Course or Qualification (B.Tech / B.E., B.Sc, B.Com, BBA, BCA, MBBS, Pharmacy, Diploma, M.Tech, MBA, Other write-in)
  - Branch or Specialization (CSE, ECE, EEE, Mechanical, Civil, IT, AI & Data Science, Accounts, General, Other write-in)
  - Semester / Academic Level (1st Year, 2nd Year, 3rd Year, 4th Year, Semesters 1-8, Other)
  - Subject(s) (Engineering Mathematics, DSA, Circuit Theory, Digital Electronics, Thermodynamics, Financial Accounting, Programming, Other write-in)
  - Teaching Mode, Timing, Preferences & Budget

### B. Education & Training (`education-training`)
*Purpose: Competitive-exam preparation, structured courses and specialized skill development.*
- **Competitive Exam Coaching (`competitive-exams`)**:
  - Examination (JEE, NEET, GATE, EAMCET / EAPCET, UPSC Civil Services, State PSC, SSC, Banking, CAT, GRE/GMAT, Other write-in)
  - Preparation Focus / Subject(s) (Full Syllabus, Quantitative Aptitude, Logical Reasoning, English, Physics, Chemistry, Biology, General Studies, Specific Paper, Other write-in)
  - Target Year (optional: 2026, 2027, 2028, Immediate, Other)
  - Current Preparation Level (optional: Beginner, Intermediate, Advanced)
  - Teaching Mode, Timing & Budget
- **Computer & IT Courses (`computer-it-courses`)**:
  - Course or Technology (Python, Java Full Stack, Web Dev, React/React Native, AI/ML, Data Science, AWS/Cloud, DevOps, Cyber Security, SQL, Advanced Excel, C++, Other write-in)
  - Current Skill Level (Complete Beginner, Basic Knowledge, Intermediate, Advanced)
  - Learning Goal (optional: Job Placement Prep, College Project, Upskilling, Certification, Personal Interest, Other write-in)
  - Teaching Mode, Timing & Budget
- **Professional & Vocational Skills (`vocational-skills`)**:
  - Skill or Course (Tally with GST, Accounting, Digital Marketing, Graphic Design & UI/UX, Video Editing, Tailoring, Photography, Beautician, Other write-in)
  - Learning Objective (optional: Freelancing/Business, Job seeking, Hobby, Certification, Other write-in)
  - Experience Level (optional: Beginner, Some Exposure, Intermediate)
  - Teaching Mode, Timing & Budget
- **Languages & Creative Skills (`languages-creative`)**:
  - Language or Skill (Spoken English, Hindi, Telugu, German, French, Spanish, Japanese, Classical Music, Guitar/Keyboard, Classical Dance, Western Dance, Drawing & Painting, Other write-in)
  - Proficiency Level (optional: Beginner, Elementary, Intermediate)
  - Learning Goal (optional: Daily Fluency, Work Communication, Foreign Travel, Hobby, Exam Prep, Other write-in)
  - Teaching Mode, Timing & Budget

---

## 3. Architecture & Data Flow

1. **Centralized Configuration (`mobile/src/features/post-work/dynamicCategories.ts`)**:
   - Single source of truth for categories, subcategories, field configurations, and option lists.
   - `sanitizeAnswersForSubcategory`: Sanitizes answer state when the user changes subcategory, preventing silent leakage of incompatible fields.
   - `validateSubcategoryAnswers`: Enforces minimal required fields without making optional fields mandatory.
   - `generateDynamicJobTitle`: Generates natural, high-intent titles from user answers.
   - `generateDynamicJobDescription`: Automatically constructs formatted structured job descriptions.

2. **Stage Progression (`mobile/app/post-work/`)**:
   - **Stage 1 (`index.tsx`)**: Main category selection (`tuition` vs `education-training`). No "create category" button.
   - **Stage 2 (`index.tsx`)**: Service / Subcategory selection. Loads only subcategories belonging to the chosen main category.
   - **Stage 3 (`details.tsx`)**: Dynamic job details. Renders service-specific questions, teaching mode, preferred timing, tutor preferences, and live title/description preview card.
   - **Stage 4 (`location.tsx`)**: In-person location selector. If teaching mode is "online", mandatory in-person location fields are hidden and bypassed.
   - **Stage 5 (`schedule.tsx`)**: Adaptive schedule with quick presets (Morning, Afternoon, Evening, Flexible) and custom time range support.
   - **Stage 6 (`pay.tsx`)**: Flexible budget configuration supporting monthly, hourly, per session, per course, negotiable, or demo-first / budget to be discussed.
   - **Stage 7 (`review.tsx`)**: Comprehensive preview with automatically formatted title & structured description, edit jump-points, and resilient submission.

3. **Database & API Synchronization**:
   - Remote Cloudflare D1 database seeded with `tuition` and `education-training` categories and all 6 subcategory roles.
   - Backend `resolveJobCategoryAndRole` guarantees foreign key integrity and supports dynamic subcategories.

---

## 4. Automated Test Coverage
- Verified with Vitest unit tests in `backend/tests/dynamic-categories.unit.test.ts`.
- Verified TypeScript compilation across `@bulao/domain`, `backend`, and `mobile` (`pnpm run typecheck`).
- Verified full monorepo test suite (15 passed test suites, 150 tests passing with 0 errors).
