import type { Ionicons } from "@expo/vector-icons";

export type CategoryFilter =
  | "all"
  | "plumber"
  | "electrician"
  | "mechanic"
  | "automotive"
  | "appliance"
  | "carpenter"
  | "carpentry"
  | "cleaner"
  | "cleaning"
  | "beauty-service"
  | "beauty"
  | "painter"
  | "painting"
  | "tutoring"
  | "education"
  | "computer-repair"
  | "technology"
  | "mobile-repair"
  | "food-catering"
  | "cooking"
  | "gardener"
  | "gardening"
  | "driver"
  | "security"
  | "pest"
  | "ac"
  | "health"
  | "other";

export interface CategoryMeta {
  id: CategoryFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}

export const ALL_CATEGORIES_LIST: CategoryMeta[] = [
  { id: "all", label: "All Services", icon: "grid-outline", color: "#047857", bg: "#ECFDF5" },
  { id: "plumber", label: "Plumbing", icon: "water-outline", color: "#0284C7", bg: "#E0F2FE" },
  { id: "electrician", label: "Electrical", icon: "flash-outline", color: "#D97706", bg: "#FEF3C7" },
  { id: "mechanic", label: "Automotive", icon: "car-sport-outline", color: "#E11D48", bg: "#FFF0F3" },
  { id: "appliance", label: "AC & Appliance", icon: "snow-outline", color: "#0891B2", bg: "#ECFEFF" },
  { id: "cleaner", label: "Cleaning", icon: "sparkles-outline", color: "#16A34A", bg: "#F0FDF4" },
  { id: "carpenter", label: "Carpentry", icon: "hammer-outline", color: "#B45309", bg: "#FEF3C7" },
  { id: "painter", label: "Painting", icon: "color-palette-outline", color: "#7C3AED", bg: "#F5F3FF" },
  { id: "beauty-service", label: "Beauty & Salon", icon: "cut-outline", color: "#C026D3", bg: "#FDF2F8" },
  { id: "tutoring", label: "Tuition & Coaching", icon: "school-outline", color: "#9333EA", bg: "#F5F3FF" },
  { id: "computer-repair", label: "Computer & IT", icon: "laptop-outline", color: "#0284C7", bg: "#F0F9FF" },
  { id: "mobile-repair", label: "Mobile Repair", icon: "phone-portrait-outline", color: "#DB2777", bg: "#FDF2F8" },
  { id: "food-catering", label: "Food & Catering", icon: "restaurant-outline", color: "#EA580C", bg: "#FFF7ED" },
  { id: "gardener", label: "Gardening", icon: "leaf-outline", color: "#16A34A", bg: "#F0FDF4" },
  { id: "driver", label: "Driver & Transit", icon: "car-outline", color: "#2563EB", bg: "#EFF6FF" },
  { id: "health", label: "Home Health Care", icon: "medkit-outline", color: "#DC2626", bg: "#FEE2E2" },
  { id: "security", label: "Security & CCTV", icon: "shield-checkmark-outline", color: "#059669", bg: "#D1FAE5" },
  { id: "other", label: "Other Services", icon: "construct-outline", color: "#475569", bg: "#F8FAFC" },
];

export const ALL_PILL = ALL_CATEGORIES_LIST[0]!;
