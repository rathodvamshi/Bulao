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
  punctualityScore: number;
  available: boolean;
  skills: string[];
  feedbackTags: WorkerFeedbackTag[];
  reviews: ReviewItem[];
};

export type ServiceRoleData = {
  rating: number | null;
  totalReviews: number;
  completed: number;
  radiusKm: number;
  available: boolean;
  services: {
    id: string;
    category: string;
    experienceYears: number;
    available: boolean;
    radiusKm: number;
  }[];
  reviews: ReviewItem[];
};
