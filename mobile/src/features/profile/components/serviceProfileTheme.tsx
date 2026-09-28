import { Text as NativeText, Platform, type TextProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ServiceItem } from "../types";

export const serviceTheme = {
  ink: "#10233F",
  muted: "#61718A",
  green: "#034E3B",
  pale: "#EEF9F1",
  lighter: "#0B6B55",
  subtle: "#F5FBF7",
  gold: "#F4B928",
  background: "#F8F3EB",
  border: "#E5EAE6",
  font: Platform.OS === "android" ? "sans-serif" : "System",
};
export function ServiceText({ style, ...props }: TextProps) {
  return (
    <NativeText
      {...props}
      style={[
        { fontFamily: serviceTheme.font, color: serviceTheme.ink },
        style,
      ]}
    />
  );
}
export function servicePrice(service: ServiceItem) {
  if (service.pricingModel === "visit_quote")
    return "Quote on request";
  if (!service.pricingModel || service.basePricePaise == null) return "Price not provided";
  return `₹${(service.basePricePaise / 100).toLocaleString("en-IN")}${service.pricingModel === "hourly" ? " / hour" : " onwards"}`;
}
export function serviceModeLabel(service: ServiceItem) {
  if (service.serviceMode === "at_center") {
    return "Customer Visits";
  }
  const radius = service.radiusKm;
  if (service.serviceMode === "both") {
    return `Shop + Home (${radius} km)`;
  }
  return service.serviceMode === "doorstep" ? `Home Service (${radius} km)` : "Service mode not provided";
}

export function serviceModeIcon(service: ServiceItem): keyof typeof Ionicons.glyphMap {
  if (service.serviceMode === "at_center") return "storefront-outline";
  if (service.serviceMode === "both") return "sync-outline";
  return "home-outline";
}

export function servicePhotos(service: ServiceItem) {
  return [...new Set(service.portfolioUrls ?? [])].filter(
    uri => typeof uri === "string" && /^https?:\/\//i.test(uri)
  );
}

export function serviceCategoryFallbackIcon(
  service: ServiceItem
): keyof typeof Ionicons.glyphMap {
  const text = `${service.title || ""} ${service.categoryName || ""} ${service.categoryId || ""}`.toLowerCase();

  if (text.includes("bike") || text.includes("two wheeler") || text.includes("scooter")) {
    return "construct-outline";
  }
  if (text.includes("car") || text.includes("auto") || text.includes("automotive") || text.includes("vehicle")) {
    return "car-sport-outline";
  }
  if (text.includes("plumb") || text.includes("water") || text.includes("pipe") || text.includes("leak")) {
    return "water-outline";
  }
  if (text.includes("electric") || text.includes("ac") || text.includes("air condition") || text.includes("wiring")) {
    return "flash-outline";
  }
  if (text.includes("clean") || text.includes("maid") || text.includes("wash") || text.includes("housekeep")) {
    return "sparkles-outline";
  }
  if (text.includes("paint") || text.includes("wall") || text.includes("color")) {
    return "color-palette-outline";
  }
  if (text.includes("carpenter") || text.includes("wood") || text.includes("furniture")) {
    return "hammer-outline";
  }
  if (text.includes("salon") || text.includes("hair") || text.includes("beauty") || text.includes("barber")) {
    return "cut-outline";
  }
  if (text.includes("appliance") || text.includes("repair") || text.includes("tv") || text.includes("fridge")) {
    return "tv-outline";
  }

  return "storefront-outline";
}

export function serviceTaskLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
