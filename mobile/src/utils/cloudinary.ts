export const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "japfuiuz";

export const CONTENT_IMAGES = {
  auth: {
    loginHero: "bulao/auth/login_hero",
    otpHero: "bulao/auth/otp_hero",
  },
} as const;

export function getOptimizedImageUrl(publicId: string, format = "auto"): string {
  if (!publicId) return "";
  if (publicId.startsWith("http://") || publicId.startsWith("https://")) {
    return publicId;
  }
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto/${publicId}`;
}
