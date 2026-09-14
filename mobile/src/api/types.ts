export type Category = {
  id: string;
  kind: "job" | "service";
  name: string;
  icon: string;
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
  photoUrl?: string;
  appliedAt?: number;
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
  latitude?: number;
  longitude?: number;
  startsAt: number;
  duration?: string;
  endsAt?: number | null;
  hours?: string;
  startTime?: string;
  endTime?: string;
  workers: number;
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
  reviewed?: number | boolean;
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
};
