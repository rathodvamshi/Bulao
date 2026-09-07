export interface Env {
  DB: D1Database;
  AUTH_COORDINATOR: DurableObjectNamespace;
  AUTH_EVENTS: Queue<import("../modules/auth/audit").AuthEvent>;
  AUTH_HASH_KEY: string;
  APP_ENV: "development" | "staging" | "production";
  OTP_PROVIDER: string;
  ALLOWED_ORIGIN: string;
  ADMIN_USER_IDS?: string;
  MSG91_AUTH_KEY?: string;
  MSG91_TEMPLATE_ID?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_UPLOAD_PRESET?: string;
}
export type AppEnv = {
  Bindings: Env;
  Variables: { userId: string; requestId: string };
};
