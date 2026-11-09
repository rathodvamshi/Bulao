import type { AppNotification } from "../api/types";

/** Short inbox copy for known server templates; full original copy stays in details. */
export function notificationPreview(item: AppNotification) {
  const message = item.message.trim();
  const fallback = {
    title: item.title,
    subject: message,
    note: "",
    formatted: false,
  };
  const jobTitle = (value: string) => value.replace(/^Wanted:\s*/i, "").trim();
  let match: RegExpMatchArray | null;

  switch (item.type) {
    case "APPLICATION_CREATED":
      match = message.match(/^(.+) applied for "(.+)"\.$/s);
      return match
        ? {
            formatted: true,
            title: `${match[1]} applied`,
            subject: jobTitle(match[2]!),
            note: "",
          }
        : fallback;
    case "APPLICATION_CANCELLED_BY_SEEKER":
    case "APPLICATION_CANCELLED_BY_PROVIDER":
      match = message.match(
        /^The (?:seeker|provider) cancelled the job "(.+)"\. Reason: (.*)$/s,
      );
      return match
        ? {
            formatted: true,
            title:
              item.type === "APPLICATION_CANCELLED_BY_SEEKER"
                ? "Worker cancelled"
                : "Employer cancelled",
            subject: jobTitle(match[1]!),
            note: match[2]?.trim() ? `Reason: ${match[2].trim()}` : "",
          }
        : fallback;
    case "APPLICATION_ACCEPTED":
      match = message.match(
        /^Your application for "(.+)" was accepted! You can now view the provider's contact details and exact worksite location\.$/s,
      );
      return match
        ? {
            formatted: true,
            title: "Application accepted",
            subject: jobTitle(match[1]!),
            note: "Contact details and worksite directions are now available",
          }
        : fallback;
    case "APPLICATION_REJECTED":
      match = message.match(
        /^Your application for "(.+)" was rejected by the provider\.$/s,
      );
      return match
        ? {
            formatted: true,
            title: "Application not selected",
            subject: jobTitle(match[1]!),
            note: "",
          }
        : fallback;
    case "JOB_COMPLETED":
      match = message.match(
        /^"(.+)" was marked completed\. Please rate your experience!$/s,
      );
      return match
        ? {
            formatted: true,
            title: "Job completed",
            subject: jobTitle(match[1]!),
            note: "You can now leave a review",
          }
        : fallback;
    case "JOB_COMPLETION_CONFIRMATION":
      match = message.match(
        /^The provider marked "(.+)" complete\. Open your request to confirm the work\.$/s,
      );
      return match
        ? {
            formatted: true,
            title: "Confirm completed work",
            subject: jobTitle(match[1]!),
            note: "Confirm this request after checking the work is complete",
          }
        : fallback;
    case "SERVICE_REQUEST":
      return message === "A customer requested your service."
        ? {
            formatted: true,
            title: "New service request",
            subject: "A customer is interested in your service",
            note: "",
          }
        : fallback;
    case "SERVICE_REQUEST_UPDATED": {
      const statuses: Record<string, string> = {
        PENDING: "Service request pending",
        ACCEPTED: "Service request accepted",
        IN_PROGRESS: "Service started",
        COMPLETED: "Service completed",
        REJECTED: "Service request declined",
        CANCELLED: "Service request cancelled",
        WITHDRAWN: "Service request withdrawn",
        CANCELLED_BY_SEEKER: "Customer cancelled",
        CANCELLED_BY_PROVIDER: "Service provider cancelled",
      };
      const status = message.match(/^Request status: ([A-Z_]+)$/)?.[1];
      return status && statuses[status]
        ? {
            formatted: true,
            title: statuses[status],
            subject: "View your request for details",
            note: "",
          }
        : fallback;
    }
    default:
      return fallback;
  }
}

export interface NotificationDetailField {
  label: string;
  value: string;
  emphasis?: boolean;
}

/** Use only information in the event. Unknown copy stays intact in readable blocks. */
export function notificationDetails(
  item: AppNotification,
): NotificationDetailField[] {
  const preview = notificationPreview(item);
  if (!preview.formatted) {
    return item.message
      .trim()
      .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n")
      .split(/\n+/)
      .filter(Boolean)
      .map((value, index) => ({
        label: index === 0 ? "Update" : "Details",
        value,
      }));
  }
  const fields: NotificationDetailField[] = [];
  if (item.type.startsWith("SERVICE_")) {
    fields.push({
      label: item.type === "SERVICE_REQUEST" ? "Request" : "Next step",
      value: preview.subject,
    });
  } else {
    fields.push({ label: "Job", value: preview.subject });
  }
  if (preview.note.startsWith("Reason: ")) {
    fields.push({
      label: "Reason for cancellation",
      value: preview.note.slice(8),
      emphasis: true,
    });
  } else if (preview.note) {
    fields.push({ label: "Next step", value: preview.note });
  }
  return fields;
}
