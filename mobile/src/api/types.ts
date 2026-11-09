export type Category = {
  id: string;
  kind: "job" | "service";
  name: string;
  icon: string;
};
export type CategoryService = {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  isPopular?: boolean;
};
export type ServiceOption = {
  id: string;
  name: string;
  icon?: string;
  sortOrder?: number;
  isPopular?: boolean;
};
export type ServiceOptionsResponse = {
  serviceId: string;
  defaultTitle: string;
  options: ServiceOption[];
};

export type Catalog = {
  categories: Category[];
  roles: { id: string; categoryId: string; name: string }[];
  locations: {
    id: string;
    area: string;
    latitude: number;
    longitude: number;
  }[];
};
export type ApplicationState =
  | "PENDING"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "WITHDRAWN"
  | "CANCELLED"
  | "CANCELLED_BY_SEEKER"
  | "CANCELLED_BY_PROVIDER";

export type JobApplicant = {
  applicationId?: string;
  id: string;
  name: string;
  phone?: string | null;
  area?: string;
  photoUrl?: string | null;
  appliedAt?: number;
  rating?: number | null;
  totalReviews?: number;
  reviewedByProvider?: boolean | number;
  ownerConfirmedAt?: number | null;
  workerConfirmedAt?: number | null;
  completionRejectedAt?: number | null;
  completionRejectedBy?: string | null;
  completionRejectionReason?: string | null;
  cancellationReason?: string | null;
  status?: ApplicationState | string;
};

export type Job = {
  id: string;
  ownerId: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  roleId?: string;
  roleName?: string;
  roleIcon?: string;
  title: string;
  customTitle?: string;
  area: string;
  address?: string;
  /** Exact worksite coordinates are only present for the provider or an accepted seeker. */
  latitude?: number | null;
  longitude?: number | null;
  /** Deliberately coarse city-scale coordinates used only for the no-pin map preview. */
  mapLatitude?: number | null;
  mapLongitude?: number | null;
  startsAt: number;
  duration?: string;
  endsAt?: number | null;
  hours?: string;
  startTime?: string;
  endTime?: string;
  workers: number;
  /** Accepted, in-progress, and completed applications reserve a seat. */
  acceptedCount?: number;
  remainingWorkers?: number;
  completedCount?: number;
  archivedAt?: number;
  deletedAt?: number;
  lastCompletedAt?: number;
  completedWorkers?: any[];
  experience?: string;
  payPaise: number;
  payUnit: string;
  paidWhen?: string;
  extras?: string[];
  details: string;
  status: string;
  ownerName: string;
  ownerPhone?: string | null;
  ownerPhotoUrl?: string;
  ownerVerified?: boolean | number;
  ownerRating?: number | null;
  ownerReviewsCount?: number;
  images?: string[];
  applicantCount?: number;
  applicants?: JobApplicant[];
  distanceKm?: number;
  createdAt?: number;
  myApplication?: {
    id: string;
    status: ApplicationState | string;
  } | null;
};
export type Professional = {
  userId: string;
  id: string;
  title: string;
  category: string;
  area: string;
  distanceKm: number;
  experience: number;
  rating: number | null;
  completed: number;
};
export type Connection = {
  id: string;
  kind: "job" | "service";
  jobId?: string;
  status: ApplicationState | string;
  title: string;
  otherName: string;
  otherPhone?: string | null;
  otherPhotoUrl?: string;
  ownerId: string;
  workerId: string;
  ownerConfirmedAt: number | null;
  workerConfirmedAt: number | null;
  reviewed: number;
  createdAt?: number;
  acceptedAt?: number | null;
  rejectedAt?: number | null;
  cancelledAt?: number | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  payPaise?: number;
  payUnit?: string;
  area?: string;
  startsAt?: number;
};

export type ApplicationItem = {
  id: string;
  kind: "job" | "service";
  jobId?: string;
  serviceId?: string;
  status: ApplicationState | string;
  ownerId: string;
  workerId: string;
  ownerConfirmedAt?: number | null;
  workerConfirmedAt?: number | null;
  completionRejectedAt?: number | null;
  completionRejectedBy?: string | null;
  completionRejectionReason?: string | null;
  details?: string;
  scheduledAt?: number | null;
  createdAt?: number;
  acceptedAt?: number | null;
  rejectedAt?: number | null;
  cancelledAt?: number | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  title: string;
  roleName?: string;
  categoryName?: string;
  payPaise: number;
  payUnit: string;
  area: string;
  startsAt?: number;
  otherId: string;
  otherName: string;
  otherPhone?: string | null;
  otherPhotoUrl?: string;
  otherRating?: number | null;
  otherTotalReviews?: number;
  reviewed?: number | boolean;
  completedAt?: number;
  myRating?: number | null;
  myFeedback?: string | null;
  receivedRating?: number | null;
  receivedFeedback?: string | null;
};

export type ServiceRequestItem = {
  id: string;
  kind: "service";
  serviceId?: string | null;
  jobId?: string | null;
  status: ApplicationState | string;
  ownerId: string;
  workerId: string;
  ownerConfirmedAt?: number | null;
  workerConfirmedAt?: number | null;
  details?: string;
  scheduledAt?: number | null;
  createdAt: number;
  acceptedAt?: number | null;
  rejectedAt?: number | null;
  cancelledAt?: number | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  title: string;
  roleName?: string;
  categoryName?: string;
  payPaise?: number;
  payUnit?: string;
  area: string;
  otherId: string;
  otherName: string;
  otherPhone?: string | null;
  otherPhotoUrl?: string | null;
  otherRating?: number | null;
  otherTotalReviews?: number;
  reviewed?: number | boolean;
  completedAt?: number;
  myRating?: number | null;
  myFeedback?: string | null;
  receivedRating?: number | null;
  receivedFeedback?: string | null;
};

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: number;
  recipientRole?: "seeker" | "provider";
};
