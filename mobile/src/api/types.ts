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
export type Job = {
  hasApplied?: boolean;
  id: string;
  ownerId: string;
  title: string;
  area: string;
  startsAt: number;
  workers: number;
  payPaise: number;
  payUnit: string;
  details: string;
  status: string;
  ownerName: string;
  distanceKm?: number;
  experience?: string;
  address?: string;
  duration?: string;
  endsAt?: number | null;
  hours?: string;
  startTime?: string;
  endTime?: string;
  paidWhen?: string;
  extras?: string[];
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
  status: string;
  title: string;
  otherName: string;
  ownerId: string;
  workerId: string;
  ownerConfirmedAt: number | null;
  workerConfirmedAt: number | null;
  reviewed: number;
};

