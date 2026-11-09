export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "single_select"
  | "multi_select"
  | "searchable_select"
  | "radio_cards"
  | "toggle";

export type PricingModelType =
  | "fixed"
  | "hourly"
  | "per_day"
  | "per_session"
  | "per_month"
  | "per_task"
  | "price_range"
  | "quote"
  | "inspection";

export interface FieldOption {
  label: string;
  value: string;
  icon?: string;
  hint?: string;
}

export interface FieldCondition {
  field: string;
  operator: "equals" | "not_equals" | "in" | "contains";
  value: string | string[] | number | boolean;
}

export interface FormFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  placeholder?: string;
  options?: FieldOption[];
  condition?: FieldCondition;
  min?: number;
  max?: number;
  defaultValue?: unknown;
}

export interface FormSectionConfig {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldConfig[];
}

export interface CategoryFormSchema {
  categoryId: string;
  slug: string;
  displayName: string;
  schemaVersion: number;
  subcategories: FieldOption[];
  sections: FormSectionConfig[];
}

export interface ServiceOffering {
  id: string;
  serviceId?: string;
  categoryId: string;
  name: string;
  description: string;
  pricingModel: PricingModelType;
  pricePaise?: number;
  minPricePaise?: number;
  maxPricePaise?: number;
  pricingUnit: string;
  includedWork?: string;
  additionalCharges?: string;
  isActive: boolean;
  sortOrder?: number;
}

export interface ProviderCommonProfile {
  userId: string;
  providerType: "individual" | "business" | "team";
  displayName: string;
  avatarUrl?: string;
  introduction: string;
  overallExperience: number;
  languages: string[];
  alternatePhone?: string;
  businessName?: string;
  teamSize?: number;
  businessDescription?: string;
}

export interface CategoryAnswers {
  categoryId: string;
  schemaVersion: number;
  answers: Record<string, unknown>;
  categoryExperience?: number;
  qualifications?: string[];
  serviceMode?: "doorstep" | "at_center" | "both" | "online";
}
