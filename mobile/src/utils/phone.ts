import { formatDirectPhone as domainFormatDirectPhone } from "@bulao/domain";

/**
 * Formats a phone number for direct user-facing display by removing country codes
 * (e.g. 91 or +91 for India) and returning the clean 10-digit direct number.
 */
export function formatDirectPhone(phone?: string | null): string {
  return domainFormatDirectPhone(phone);
}
