export function apiBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  if (!value) throw new Error("Bulao API setup is incomplete. Configure the HTTPS API URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.hostname.endsWith(".invalid") || url.hostname.includes("your-")) {
    throw new Error("Bulao API setup requires a valid HTTPS URL.");
  }
  return value;
}
