import type { Env } from "../../config/env";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_BATCH = 100;
const MAX_NOTIFICATION_AGE = 7 * 24 * 60 * 60;

type DeliveryMessage = { deliveryId: string };
type DeliveryRow = {
  id: string;
  installation_id: string;
  expo_push_token: string;
  device_active: number;
  device_user_id: string;
  notification_user_id: string;
  notification_id: string;
  type: string;
  title: string;
  message: string;
  data: string | null;
  created_at: number;
  attempts: number;
  recipientRole: "seeker" | "provider" | null;
};
type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

const seconds = () => Math.floor(Date.now() / 1000);

function retryDelay(attempt: number) {
  const base = Math.min(6 * 60 * 60, 30 * 2 ** Math.min(attempt, 10));
  return Math.floor(base * (0.8 + Math.random() * 0.4));
}

function extractQuoted(text: string): string | null {
  if (!text) return null;
  const match = text.match(/"([^"]+)"/);
  if (!match || !match[1]) return null;
  const val = match[1].trim();
  const lower = val.toLowerCase();
  if (lower === "your job" || lower === "your job posting" || lower === "the work") return null;
  return val;
}

function extractApplicantName(text: string): string | null {
  if (!text) return null;
  const match = text.match(/^(.+?)\s+applied\s+for/i);
  if (!match || !match[1]) return null;
  const val = match[1].trim();
  if (val.toLowerCase() === "a seeker" || val.toLowerCase() === "a worker") return null;
  return val;
}

export function resolvePushCopy(row: DeliveryRow): { title: string; body: string } {
  const type = row.type;
  const role = row.recipientRole;
  const jobTitle = extractQuoted(row.message) || extractQuoted(row.title);
  const applicant = extractApplicantName(row.message);

  if (type === "JOB_COMPLETION_CONFIRMATION") {
    if (role === "seeker") {
      return {
        title: jobTitle ? `Confirm Work: ${jobTitle}` : "Confirm Work Done",
        body: "The provider marked the work complete. Tap to verify and close.",
      };
    }
    return {
      title: jobTitle ? `Verify Completion: ${jobTitle}` : "Verify Work Completion",
      body: "Worker marked the job complete. Tap to verify and release payment.",
    };
  }

  if (type === "JOB_COMPLETED") {
    if (role === "seeker") {
      return {
        title: jobTitle ? `Work Completed: ${jobTitle}` : "Work Completed 🎉",
        body: "Work is complete! Tap to rate your experience and leave a review.",
      };
    }
    return {
      title: jobTitle ? `Job Completed: ${jobTitle}` : "Job Completed 🎉",
      body: "Job was finished successfully! Tap to rate the worker.",
    };
  }

  if (type === "NEW_JOB_NEARBY") {
    return {
      title: row.title?.trim() || (jobTitle ? `New Work: ${jobTitle}` : "New Work Opportunity Nearby"),
      body: row.message?.trim() || "A new job matching your skills was posted nearby. Tap to apply.",
    };
  }

  if (type === "APPLICATION_CREATED") {
    return {
      title: jobTitle ? `New Applicant: ${jobTitle}` : "New Job Applicant",
      body: applicant
        ? `${applicant} applied for your job. Tap to review profile and hire.`
        : "A candidate applied for your job. Tap to review profile and hire.",
    };
  }

  if (type === "APPLICATION_ACCEPTED") {
    return {
      title: jobTitle ? `You're Hired for ${jobTitle}! 🎉` : "You're Hired! 🎉",
      body: "Your application was accepted! Tap to view worksite map & contact details.",
    };
  }

  if (type === "APPLICATION_REJECTED") {
    return {
      title: jobTitle ? `Update: ${jobTitle}` : "Application Update",
      body: "This position was filled. Tap to discover other active jobs near you.",
    };
  }

  if (type === "APPLICATION_CANCELLED_BY_SEEKER") {
    return {
      title: jobTitle ? `Applicant Withdrew: ${jobTitle}` : "Applicant Withdrew",
      body: applicant
        ? `${applicant} withdrew their application. Tap to view other applicants.`
        : "A candidate cancelled their application. Tap to view other applicants.",
    };
  }

  if (type === "APPLICATION_CANCELLED_BY_PROVIDER") {
    return {
      title: jobTitle ? `Cancelled: ${jobTitle}` : "Job Request Cancelled",
      body: "The provider cancelled this job engagement. Tap to find more nearby work.",
    };
  }

  if (type === "JOB_LOCATION_UPDATED") {
    return {
      title: jobTitle ? `Worksite Updated: ${jobTitle}` : "Worksite Location Updated",
      body: "The provider updated the worksite. Tap to view the updated map location.",
    };
  }

  if (type === "SERVICE_REQUEST") {
    const serviceTitle = extractQuoted(row.message) || extractQuoted(row.title);
    return {
      title: serviceTitle ? `New Booking: ${serviceTitle}` : "New Service Booking",
      body: "A customer requested your service. Tap to review and accept.",
    };
  }

  if (type === "SERVICE_REQUEST_UPDATED") {
    const serviceTitle = extractQuoted(row.message) || extractQuoted(row.title);
    return {
      title: serviceTitle ? `Booking Update: ${serviceTitle}` : "Service Booking Update",
      body: row.message?.trim() || "Your service booking was updated. Tap to view details.",
    };
  }

  if (type === "SERVICE_REVIEW_RECEIVED" || type === "REVIEW_RECEIVED") {
    return {
      title: "New Review Received ⭐",
      body: "You received a new rating and feedback! Tap to view your review.",
    };
  }

  if (type === "SERVICE_OFFLINE_PAYMENT_CONFIRMED") {
    return {
      title: "Payment Confirmed",
      body: "Offline/cash payment was confirmed. Tap to view receipt.",
    };
  }

  if (type === "SERVICE_OFFLINE_PAYMENT_UPDATED") {
    return {
      title: "Payment Updated",
      body: "Offline payment status was updated. Tap to verify payment details.",
    };
  }

  const fallbackTitle = row.title && !["Action needed", "Work completed", "Update available", "Important notification"].includes(row.title.trim())
    ? row.title.trim()
    : "Bulao Notification";
  const fallbackBody = row.message && !row.message.includes("Open Bulao to view your notification")
    ? row.message.trim()
    : "Tap to open Bulao and view the latest updates.";

  return { title: fallbackTitle, body: fallbackBody };
}

function channelFor(type: string) {
  return [
    "APPLICATION_CREATED", "APPLICATION_ACCEPTED", "APPLICATION_REJECTED",
    "APPLICATION_CANCELLED_BY_SEEKER", "APPLICATION_CANCELLED_BY_PROVIDER",
    "SERVICE_REQUEST", "JOB_COMPLETION_CONFIRMATION", "NEW_JOB_NEARBY",
  ].includes(type) ? "requests" : "updates";
}

function priorityFor(type: string) {
  return channelFor(type) === "requests" ? "high" : "default";
}

function expoHeaders(env: Env) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(env.EXPO_PUSH_ACCESS_TOKEN
      ? { Authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` }
      : {}),
  };
}

async function claimDelivery(env: Env, deliveryId: string): Promise<DeliveryRow | null> {
  const now = seconds();
  const claim = await env.DB.prepare(
    `UPDATE push_deliveries
        SET state='sending', attempts=attempts+1, lease_until=?, updated_at=?
      WHERE id=? AND (
        (state IN ('queued','pending') AND next_attempt_at<=?) OR
        (state='sending' AND lease_until<?)
      )`,
  ).bind(now + 300, now, deliveryId, now, now).run();
  if (!claim.meta.changes) return null;
  return env.DB.prepare(
    `SELECT d.id,d.installation_id,d.attempts,p.active AS device_active,p.user_id AS device_user_id,
            n.user_id AS notification_user_id,p.expo_push_token,n.id AS notification_id,
            n.type,n.title,n.message,n.data,n.created_at,
            COALESCE(
              json_extract(CASE WHEN json_valid(n.data) THEN n.data ELSE '{}' END,'$.recipientRole'),
              CASE
                WHEN n.type IN ('APPLICATION_CREATED','APPLICATION_CANCELLED_BY_SEEKER') THEN 'provider'
                WHEN n.type IN ('APPLICATION_ACCEPTED','APPLICATION_REJECTED','APPLICATION_CANCELLED_BY_PROVIDER') THEN 'seeker'
                WHEN n.type IN ('JOB_COMPLETED','JOB_COMPLETION_CONFIRMATION') THEN (
                  SELECT CASE WHEN i.owner_id=n.user_id THEN 'provider'
                              WHEN i.worker_id=n.user_id THEN 'seeker' END
                    FROM interactions i
                   WHERE i.id=json_extract(CASE WHEN json_valid(n.data) THEN n.data ELSE '{}' END,'$.interactionId')
                   LIMIT 1
                )
              END
            ) AS recipientRole
       FROM push_deliveries d
       JOIN push_devices p ON p.installation_id=d.installation_id
       JOIN notifications n ON n.id=d.notification_id
      WHERE d.id=? AND d.state='sending' AND d.lease_until=?`,
  ).bind(deliveryId, now + 300).first<DeliveryRow>();
}

async function retryDelivery(env: Env, row: DeliveryRow, code: string, message: string) {
  const now = seconds();
  const delay = retryDelay(row.attempts);
  await env.DB.prepare(
    `UPDATE push_deliveries
        SET state='pending', next_attempt_at=?, lease_until=NULL,
            expo_ticket_id=NULL, receipt_checked_at=NULL,
            last_error_code=?, last_error=?, updated_at=?
      WHERE id=? AND state='sending'`,
  ).bind(now + delay, code.slice(0, 100), message.slice(0, 500), now, row.id).run();
}

async function acceptTicket(env: Env, row: DeliveryRow, ticket: ExpoTicket) {
  const now = seconds();
  if (ticket.status === "ok" && ticket.id) {
    await env.DB.prepare(
      `UPDATE push_deliveries SET state='receipt_pending', expo_ticket_id=?,
              lease_until=NULL, receipt_checked_at=NULL, last_error_code=NULL,
              last_error=NULL, updated_at=? WHERE id=? AND state='sending'`,
    ).bind(ticket.id, now, row.id).run();
    return;
  }
  const code = ticket.details?.error || "EXPO_TICKET_ERROR";
  if (code === "DeviceNotRegistered") {
    await env.DB.batch([
      env.DB.prepare("UPDATE push_devices SET active=0, updated_at=? WHERE installation_id=?")
        .bind(now, row.installation_id),
      env.DB.prepare(
        `UPDATE push_deliveries SET state='disabled', lease_until=NULL,
                last_error_code=?, last_error=?, updated_at=? WHERE id=?`,
      ).bind(code, (ticket.message || "Device is no longer registered.").slice(0, 500), now, row.id),
    ]);
    return;
  }
  if (code.includes("Rate") || code.includes("Server") || code === "EXPO_TICKET_ERROR") {
    await retryDelivery(env, row, code, ticket.message || "Temporary push provider error.");
    return;
  }
  await env.DB.prepare(
    `UPDATE push_deliveries SET state='failed', lease_until=NULL,
            last_error_code=?, last_error=?, updated_at=? WHERE id=?`,
  ).bind(code.slice(0, 100), (ticket.message || "Push provider rejected the payload.").slice(0, 500), now, row.id).run();
  console.error(JSON.stringify({ event: "PUSH_PERMANENT_TICKET_FAILURE", code, deliveryId: row.id }));
}

async function consumePushDeliveries(batch: MessageBatch<DeliveryMessage>, env: Env) {
  for (const message of batch.messages) {
    try {
      const row = await claimDelivery(env, message.body?.deliveryId);
      if (!row) {
        message.ack();
        continue;
      }
      const now = seconds();
      if (!row.device_active || row.device_user_id !== row.notification_user_id) {
        await env.DB.prepare(
          "UPDATE push_deliveries SET state='disabled',lease_until=NULL,last_error_code=?,updated_at=? WHERE id=?",
        ).bind(row.device_active ? "ACCOUNT_CHANGED" : "DEVICE_DISABLED", now, row.id).run();
        message.ack();
        continue;
      }
      if (row.created_at < now - MAX_NOTIFICATION_AGE || !row.recipientRole) {
        await env.DB.prepare(
          `UPDATE push_deliveries SET state='failed', lease_until=NULL,
                  last_error_code=?, last_error=?, updated_at=? WHERE id=?`,
        ).bind(
          row.created_at < now - MAX_NOTIFICATION_AGE ? "NOTIFICATION_EXPIRED" : "RECIPIENT_ROLE_UNKNOWN",
          "Notification is too old or has no safe recipient route.", now, row.id,
        ).run();
        console.error(JSON.stringify({ event: "PUSH_DELIVERY_REQUIRES_REVIEW", deliveryId: row.id }));
        message.ack();
        continue;
      }
      let parsedData: Record<string, unknown> = {};
      if (row.data) {
        try {
          parsedData = typeof row.data === "string" ? JSON.parse(row.data) : (row.data as Record<string, unknown>);
        } catch {}
      }
      const jobId = typeof parsedData.jobId === "string" ? parsedData.jobId : undefined;
      const interactionId = typeof parsedData.interactionId === "string" ? parsedData.interactionId : undefined;
      const serviceId = typeof parsedData.serviceId === "string" ? parsedData.serviceId : undefined;

      const copy = resolvePushCopy(row);
      const context = row.type.startsWith("SERVICE_") ? "service" : row.recipientRole === "provider" ? "hire" : "work";
      let response: Response;
      try {
        response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: expoHeaders(env),
          body: JSON.stringify({
            to: row.expo_push_token,
            sound: "default",
            title: copy.title,
            body: copy.body,
            channelId: channelFor(row.type),
            priority: priorityFor(row.type),
            ttl: 60 * 60 * 24 * 7,
            data: {
              notificationId: row.notification_id,
              role: row.recipientRole,
              context,
              type: row.type,
              ...(jobId ? { jobId } : {}),
              ...(interactionId ? { interactionId } : {}),
              ...(serviceId ? { serviceId } : {}),
            },
          }),
        });
      } catch {
        await retryDelivery(env, row, "NETWORK_ERROR", "Push provider could not be reached.");
        message.ack();
        continue;
      }
      if (!response.ok) {
        console.error(JSON.stringify({ event: "PUSH_PROVIDER_HTTP_FAILURE", status: response.status, deliveryId: row.id }));
        await retryDelivery(env, row, `HTTP_${response.status}`, `Push provider returned HTTP ${response.status}.`);
        message.ack();
        continue;
      }
      const payload = await response.json().catch(() => null) as { data?: ExpoTicket } | null;
      if (!payload?.data || Array.isArray(payload.data)) {
        await retryDelivery(env, row, "INVALID_PROVIDER_RESPONSE", "Push provider returned an unreadable response.");
        message.ack();
        continue;
      }
      await acceptTicket(env, row, payload.data);
      message.ack();
    } catch (error) {
      console.error(JSON.stringify({ event: "PUSH_QUEUE_PROCESSING_ERROR", error: String(error) }));
      message.retry();
    }
  }
}

async function expandPendingOutbox(env: Env) {
  const events = await env.DB.prepare(
    "SELECT notification_id FROM notification_push_outbox WHERE state='pending' ORDER BY created_at LIMIT ?",
  ).bind(MAX_BATCH).all<{ notification_id: string }>();
  for (const event of events.results || []) {
    const now = seconds();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO push_deliveries
           (id,notification_id,installation_id,state,attempts,next_attempt_at,created_at,updated_at)
         SELECT lower(hex(randomblob(16))),n.id,p.installation_id,'pending',0,?,?,?
           FROM notifications n JOIN push_devices p ON p.user_id=n.user_id AND p.active=1
          WHERE n.id=?`,
      ).bind(now, now, now, event.notification_id),
      env.DB.prepare(
        "UPDATE notification_push_outbox SET state='expanded', expanded_at=? WHERE notification_id=? AND state='pending'",
      ).bind(now, event.notification_id),
    ]);
  }
}

async function enqueueDueDeliveries(env: Env) {
  const now = seconds();
  const due = await env.DB.prepare(
    `SELECT id FROM push_deliveries
      WHERE (state='pending' AND next_attempt_at<=?)
         OR (state='queued' AND updated_at<?)
         OR (state='sending' AND lease_until<?)
      ORDER BY next_attempt_at,created_at LIMIT ?`,
  ).bind(now, now - 600, now, MAX_BATCH).all<{ id: string }>();
  const deliveries = due.results || [];
  if (!deliveries.length) return;
  await env.DB.batch(deliveries.map((item) => env.DB.prepare(
    `UPDATE push_deliveries SET state='queued',lease_until=NULL,updated_at=?
      WHERE id=? AND (
        (state='pending' AND next_attempt_at<=?) OR
        (state='queued' AND updated_at<?) OR
        (state='sending' AND lease_until<?)
      )`,
  ).bind(now, item.id, now, now - 600, now)));
  const ready = await env.DB.prepare(
    `SELECT id FROM push_deliveries WHERE state='queued' AND updated_at=? ORDER BY id LIMIT ?`,
  ).bind(now, MAX_BATCH).all<{ id: string }>();
  const selected = ready.results || [];
  if (!selected.length) return;
  try {
    await env.PUSH_DELIVERIES.sendBatch(selected.map(({ id }) => ({ body: { deliveryId: id } })));
  } catch (error) {
    console.error(JSON.stringify({ event: "PUSH_QUEUE_ENQUEUE_FAILED", count: selected.length, error: String(error) }));
    await env.DB.batch(selected.map(({ id }) => env.DB.prepare(
      `UPDATE push_deliveries SET state='pending',next_attempt_at=?,updated_at=?,
              last_error_code='QUEUE_UNAVAILABLE',last_error='Delivery queue could not be reached.'
        WHERE id=? AND state='queued' AND updated_at=?`,
    ).bind(now + 60, now, id, now)));
  }
}

async function checkReceipts(env: Env) {
  const now = seconds();
  const result = await env.DB.prepare(
    `SELECT d.id,d.installation_id,d.expo_ticket_id,d.attempts,d.created_at
       FROM push_deliveries d
      WHERE d.state='receipt_pending' AND d.expo_ticket_id IS NOT NULL
        AND (d.receipt_checked_at IS NULL OR d.receipt_checked_at<?)
      ORDER BY d.created_at LIMIT ?`,
  ).bind(now - 900, MAX_BATCH).all<{
    id: string; installation_id: string; expo_ticket_id: string; attempts: number; created_at: number;
  }>();
  const rows = result.results || [];
  if (!rows.length) return;
  let response: Response;
  try {
    response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST", headers: expoHeaders(env),
      body: JSON.stringify({ ids: rows.map((row) => row.expo_ticket_id) }),
    });
  } catch {
    await env.DB.batch(rows.map((row) => env.DB.prepare(
      "UPDATE push_deliveries SET receipt_checked_at=?,updated_at=? WHERE id=? AND state='receipt_pending'",
    ).bind(now, now, row.id)));
    return;
  }
  if (!response.ok) {
    await env.DB.batch(rows.map((row) => env.DB.prepare(
      "UPDATE push_deliveries SET receipt_checked_at=?,updated_at=? WHERE id=? AND state='receipt_pending'",
    ).bind(now, now, row.id)));
    return;
  }
  const payload = await response.json().catch(() => null) as { data?: Record<string, ExpoTicket> } | null;
  if (!payload?.data) {
    await env.DB.batch(rows.map((row) => env.DB.prepare(
      "UPDATE push_deliveries SET receipt_checked_at=?,updated_at=? WHERE id=? AND state='receipt_pending'",
    ).bind(now, now, row.id)));
    return;
  }
  for (const row of rows) {
    const receipt = payload.data[row.expo_ticket_id];
    if (!receipt) {
      if (row.created_at < now - 20 * 60 * 60) {
        await env.DB.prepare(
          `UPDATE push_deliveries SET state='pending',next_attempt_at=?,expo_ticket_id=NULL,
                  receipt_checked_at=NULL,last_error_code='RECEIPT_MISSING',
                  last_error='No provider receipt was available; safely retrying.',updated_at=?
            WHERE id=? AND state='receipt_pending'`,
        ).bind(now + retryDelay(row.attempts), now, row.id).run();
      } else {
        await env.DB.prepare(
          "UPDATE push_deliveries SET receipt_checked_at=?,updated_at=? WHERE id=? AND state='receipt_pending'",
        ).bind(now, now, row.id).run();
      }
      continue;
    }
    if (receipt.status === "ok") {
      await env.DB.prepare(
        `UPDATE push_deliveries SET state='accepted',receipt_checked_at=?,lease_until=NULL,
                last_error_code=NULL,last_error=NULL,updated_at=? WHERE id=? AND state='receipt_pending'`,
      ).bind(now, now, row.id).run();
      continue;
    }
    const code = receipt.details?.error || "EXPO_RECEIPT_ERROR";
    if (code === "DeviceNotRegistered") {
      await env.DB.batch([
        env.DB.prepare("UPDATE push_devices SET active=0,updated_at=? WHERE installation_id=?")
          .bind(now, row.installation_id),
        env.DB.prepare(
          `UPDATE push_deliveries SET state='disabled',receipt_checked_at=?,
                  last_error_code=?,last_error=?,updated_at=? WHERE id=?`,
        ).bind(now, code, (receipt.message || "Device is no longer registered.").slice(0, 500), now, row.id),
      ]);
    } else if (code.includes("Rate") || code.includes("Server") || code === "EXPO_RECEIPT_ERROR") {
      await env.DB.prepare(
        `UPDATE push_deliveries SET state='pending',next_attempt_at=?,expo_ticket_id=NULL,
                receipt_checked_at=NULL,last_error_code=?,last_error=?,updated_at=? WHERE id=?`,
      ).bind(now + retryDelay(row.attempts), code.slice(0, 100), (receipt.message || "Temporary provider error.").slice(0, 500), now, row.id).run();
    } else {
      await env.DB.prepare(
        `UPDATE push_deliveries SET state='failed',receipt_checked_at=?,last_error_code=?,
                last_error=?,updated_at=? WHERE id=?`,
      ).bind(now, code.slice(0, 100), (receipt.message || "Provider rejected delivery.").slice(0, 500), now, row.id).run();
      console.error(JSON.stringify({ event: "PUSH_PERMANENT_RECEIPT_FAILURE", code, deliveryId: row.id }));
    }
  }
}

export async function dispatchPendingPushes(env: Env) {
  await expandPendingOutbox(env);
  await enqueueDueDeliveries(env);
}

export async function runPushMaintenance(env: Env) {
  await dispatchPendingPushes(env);
  await checkReceipts(env);
}

export async function consumePushQueue(batch: MessageBatch<DeliveryMessage>, env: Env) {
  await consumePushDeliveries(batch, env);
}
