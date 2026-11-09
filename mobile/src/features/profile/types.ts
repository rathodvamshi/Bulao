export type ProfileRole = "provider" | "seeker" | "service";

export type CommonProfileData = {
  id: string;
  name: string;
  area: string;
  phone?: string;
  phoneVerified?: number | boolean;
  photoUrl: string | null;
  createdAt?: number;
  rating?: number | null;
};

export type WorkerFeedbackTag = {
  id: string;
  label: string;
  icon: string;
  percentage: number;
};

export type ProviderBadge = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

export type ReviewItem = {
  id?: string;
  stars: number;
  body: string;
  author: string;
  createdAt?: number | string;
  jobTitle?: string;
};

export type StarDistribution = {
  stars5: number;
  stars4: number;
  stars3: number;
  stars2: number;
  stars1: number;
};

export type ProviderRoleData = {
  jobsPosted: number;
  active: number;
  interested: number;
  hired: number;
  currentHires?: number;
  completed: number;
  rating: number | null;
  totalReviews: number;
  starDistribution?: StarDistribution;
  feedbackTags: WorkerFeedbackTag[];
  badges: ProviderBadge[];
  reviews: ReviewItem[];
};

export type SeekerRoleData = {
  rating: number | null;
  totalReviews: number;
  completed: number;
  starDistribution?: StarDistribution;
  reviews: ReviewItem[];
};

export type ServiceFeedbackReview = {
  id: string;
  stars: number;
  body: string;
  feedback?: string;
  createdAt: number;
  authorName: string;
  authorPhoto?: string | null;
  images?: string[];
};

export type ServiceItem = {
  wizardState?: {
    serviceId?: string;
    businessName?: string;
    offeredServices?: string[];
    customServices?: string[];
    shopPhotos?: string[];
    servicePhotos?: string[];
    website?: string;
    instagram?: string;
    facebook?: string;
    is24x7?: boolean;
    selectedDays?: import("../../components/service/ServiceAvailabilityStep").DayKey[];
    hoursMode?: "same" | "different";
    sameFromTime?: string;
    sameToTime?: string;
    hasBreakSlot?: boolean;
    breakFromTime?: string;
    breakToTime?: string;
    daySchedules?: Record<import("../../components/service/ServiceAvailabilityStep").DayKey, import("../../components/service/ServiceAvailabilityStep").DaySchedule>;
  };
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  title: string;
  description?: string;
  offeredServices?: string[];
  socialLinks?: Record<string, string>;
  phoneVisible?: boolean;
  area: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  experienceYears: number;
  available: boolean;
  serviceMode: "doorstep" | "at_center" | "both";
  pricingModel?: "fixed" | "hourly" | "visit_quote";
  basePricePaise?: number;
  operatingHours: string;
  portfolioUrls: string[];
  rating: number | null;
  totalReviews: number;
  isNew: boolean;
  completedBookings: number;
  offerings?: import("@bulao/domain").ServiceOffering[];
  dynamicAnswers?: Record<string, any>;
  ratingBreakdown?: StarDistribution;
  provider?: {
    id: string;
    name: string;
    photoUrl: string | null;
    phone: string | null;
    verified: boolean;
    memberSince?: number;
  };
  reviews?: ServiceFeedbackReview[];
};

export type ServiceRoleData = {
  rating: number | null;
  totalReviews: number;
  completed: number;
  radiusKm: number | null;
  services: ServiceItem[];
  recentFeedback: (ServiceFeedbackReview & { serviceTitle: string })[];
  starDistribution?: StarDistribution;
  activeRequests?: number;
  pendingRequests?: number;
};
