/**
 * Google Calendar integration for scheduling. Google provides real free/busy
 * data and confirmed event creation, while the DB-backed hold system remains
 * the source of truth for temporary reservations and conflict prevention.
 */
import crypto from "node:crypto";
import { google } from "googleapis";
import { getOptionalEnv, getRequiredEnv } from "@/lib/utils/env";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export type GoogleBusyWindow = {
  start: string;
  end: string;
};

export type GoogleCalendarEventResult = {
  eventId: string | null;
  meetingLink: string | null;
  timezone: string;
  warning: NormalizedCalendarWarning | null;
  creationMode: "full" | "plain_fallback";
};

export type NormalizedCalendarWarning = {
  adminMessage: string;
  candidateMessage: string;
};

class GoogleCalendarSideEffectError extends Error {
  warning: NormalizedCalendarWarning;

  constructor(warning: NormalizedCalendarWarning) {
    super(warning.adminMessage);
    this.name = "GoogleCalendarSideEffectError";
    this.warning = warning;
  }
}

export type GoogleCalendarConfig = {
  calendarId: string;
  interviewerName: string;
  interviewerEmail: string;
  timezone: string;
};

function getGooglePrivateKey() {
  return getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function getCalendarConfig(): GoogleCalendarConfig {
  const calendarId = getRequiredEnv("GOOGLE_CALENDAR_ID");

  return {
    calendarId,
    interviewerName: getOptionalEnv("GOOGLE_CALENDAR_INTERVIEWER_NAME") ?? "Hiring Team",
    interviewerEmail: getOptionalEnv("GOOGLE_CALENDAR_INTERVIEWER_EMAIL") ?? calendarId,
    timezone: getOptionalEnv("GOOGLE_TIMEZONE") ?? "America/New_York"
  };
}

function getGoogleCalendarClient() {
  const auth = new google.auth.JWT({
    email: getRequiredEnv("GOOGLE_CLIENT_EMAIL"),
    key: getGooglePrivateKey(),
    scopes: [CALENDAR_SCOPE],
    subject: getOptionalEnv("GOOGLE_IMPERSONATED_USER_EMAIL") ?? undefined
  });

  return {
    calendar: google.calendar({
      version: "v3",
      auth
    }),
    config: getCalendarConfig()
  };
}

function getGoogleErrorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  ) {
    return (error as { code: number }).code;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { status?: unknown } }).response?.status === "number"
  ) {
    return (error as { response: { status: number } }).response.status;
  }

  return null;
}

function getGoogleErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const responseMessage =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { error?: { message?: unknown } } } }).response
        ?.data?.error?.message === "string"
        ? (error as { response: { data: { error: { message: string } } } }).response.data.error
            .message
        : null;

    return responseMessage ?? error.message;
  }

  return String(error);
}

export function isGoogleCalendarSideEffectError(
  error: unknown
): error is GoogleCalendarSideEffectError {
  return error instanceof GoogleCalendarSideEffectError;
}

function throwCalendarSideEffectError(error: unknown): never {
  const warning = normalizeGoogleCalendarWarning(error);
  logCalendarAttempt("fallback_plain_event", "failed", error, warning, null);
  throw new GoogleCalendarSideEffectError(warning);
}

function isServiceAccountAttendeeInviteError(error: unknown) {
  return /service accounts cannot invite attendees|domain-wide delegation/i.test(
    getGoogleErrorMessage(error)
  );
}

function getServiceAccountInviteDeliveryWarning(): NormalizedCalendarWarning {
  return {
    adminMessage:
      "Google Calendar created the event without attendees because service-account attendee invites require Workspace Domain-Wide Delegation. Use Resend/manual follow-up for candidate delivery or configure delegated Google Workspace access.",
    candidateMessage:
      "Your slot was confirmed and added to the hiring calendar, but Google invite delivery is not available in this setup. The hiring team will follow up if needed."
  };
}

function logCalendarAttempt(
  attemptType: "full_event_with_attendees" | "fallback_plain_event",
  result: "succeeded" | "failed",
  error: unknown,
  warning: NormalizedCalendarWarning | null,
  eventId: string | null
) {
  console[result === "succeeded" ? "info" : "error"]("Google Calendar event attempt", {
    attemptType,
    result,
    status: error ? getGoogleErrorStatus(error) : null,
    rawMessage: error ? getGoogleErrorMessage(error) : null,
    adminMessage: warning?.adminMessage ?? null,
    eventIdReturned: eventId
  });
}

function requireGoogleEventId(eventId: string | null, attemptType: string) {
  if (!eventId) {
    throw new Error(`Google Calendar ${attemptType} did not return an event id.`);
  }

  return eventId;
}

export function normalizeGoogleCalendarWarning(error: unknown): NormalizedCalendarWarning {
  const status = getGoogleErrorStatus(error);
  const rawMessage = getGoogleErrorMessage(error);

  if (/service accounts cannot invite attendees|domain-wide delegation/i.test(rawMessage)) {
    return {
      adminMessage:
        "Google Calendar could not create an attendee invite because service-account attendee invites require Workspace Domain-Wide Delegation.",
      candidateMessage:
        "Your slot was confirmed, but the calendar event could not be created automatically. The hiring team will follow up."
    };
  }

  if (rawMessage.includes("GOOGLE_") || rawMessage.includes("Missing required environment variable")) {
    return {
      adminMessage: "Calendar access is configured incorrectly. Required Google Calendar environment variables are missing or invalid.",
      candidateMessage:
        "Your slot was confirmed, but the calendar invite could not be created automatically. The hiring team has been notified and will follow up if needed."
    };
  }

  if (status === 401 || status === 403) {
    return {
      adminMessage:
        "Google Calendar returned a permission error. Check service-account sharing or delegated user access.",
      candidateMessage:
        "Your slot was confirmed, but the calendar invite could not be created automatically. The hiring team has been notified and will follow up if needed."
    };
  }

  if (status === 404 || /not found|requested entity was not found/i.test(rawMessage)) {
    return {
      adminMessage:
        "Calendar access is configured incorrectly. Google Calendar could not find the configured calendar or meeting-conference target.",
      candidateMessage:
        "Your slot was confirmed, but the calendar invite could not be created automatically. The hiring team has been notified and will follow up if needed."
    };
  }

  return {
    adminMessage: "Calendar event could not be created automatically.",
    candidateMessage:
      "Your slot was confirmed, but the calendar invite could not be created automatically. The hiring team has been notified and will follow up if needed."
  };
}

export async function getCalendarBusyWindows(input: {
  timeMin: string;
  timeMax: string;
}): Promise<{
  busyWindows: GoogleBusyWindow[];
  interviewerName: string;
  interviewerEmail: string;
  timezone: string;
}> {
  try {
    const { calendar, config } = getGoogleCalendarClient();
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        timeZone: config.timezone,
        items: [{ id: config.calendarId }]
      }
    });

    const calendarResult = response.data.calendars?.[config.calendarId];
    const calendarErrors = calendarResult?.errors ?? [];

    if (calendarErrors.length > 0) {
      throw new Error(
        `Google Calendar free/busy lookup failed for ${config.calendarId}: ${calendarErrors
          .map((error) => error.reason ?? "unknown")
          .join(", ")}`
      );
    }

    const busy =
      calendarResult?.busy?.map((slot) => ({
        start: slot.start ?? input.timeMin,
        end: slot.end ?? input.timeMax
      })) ?? [];

    return {
      busyWindows: busy,
      interviewerName: config.interviewerName,
      interviewerEmail: config.interviewerEmail,
      timezone: config.timezone
    };
  } catch (error) {
    const warning = normalizeGoogleCalendarWarning(error);
    throw new Error(warning.adminMessage);
  }
}

function getConferenceLink(event: {
  hangoutLink?: string | null;
  conferenceData?: {
    entryPoints?: Array<{
      uri?: string | null;
    }> | null;
  } | null;
}) {
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  return (
    event.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.uri)?.uri ?? null
  );
}

export async function createCalendarInterviewEvent(input: {
  candidateName: string;
  candidateEmail: string;
  roleTitle: string;
  scheduledStart: string;
  scheduledEnd: string;
}): Promise<GoogleCalendarEventResult> {
  const { calendar, config } = getGoogleCalendarClient();
  const baseRequestBody = {
    summary: `${input.roleTitle} interview · ${input.candidateName}`,
    description: [
      "Interview scheduled from the Niural hiring workflow.",
      `Candidate: ${input.candidateName}`,
      `Candidate email: ${input.candidateEmail}`,
      `Role: ${input.roleTitle}`
    ].join("\n"),
    start: {
      dateTime: input.scheduledStart,
      timeZone: config.timezone
    },
    end: {
      dateTime: input.scheduledEnd,
      timeZone: config.timezone
    },
    attendees: [{ email: config.interviewerEmail }, { email: input.candidateEmail }]
  };

  try {
    const response = await calendar.events.insert({
      calendarId: config.calendarId,
      conferenceDataVersion: 1,
      // Once a slot is confirmed in our DB workflow, Google Calendar becomes
      // the invite-delivery system of record for the actual calendar event.
      sendUpdates: "all",
      requestBody: {
        ...baseRequestBody,
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: {
              type: "hangoutsMeet"
            }
          }
        }
      }
    });
    const eventId = requireGoogleEventId(response.data.id ?? null, "full event creation");
    logCalendarAttempt("full_event_with_attendees", "succeeded", null, null, eventId);

    return {
      eventId,
      meetingLink: getConferenceLink(response.data),
      timezone: config.timezone,
      warning: null,
      creationMode: "full"
    };
  } catch (error) {
    const fullWarning = normalizeGoogleCalendarWarning(error);
    logCalendarAttempt("full_event_with_attendees", "failed", error, fullWarning, null);
    const fallbackWarning = isServiceAccountAttendeeInviteError(error)
      ? getServiceAccountInviteDeliveryWarning()
      : fullWarning;

    try {
      // Personal Gmail/shared-calendar setups can create events with a service
      // account, but Google blocks attendee invites without Workspace
      // Domain-Wide Delegation. The fallback is intentionally plain: no
      // attendees, no Meet, no sendUpdates. It only counts as success when
      // Google returns a real event id.
      const response = await calendar.events.insert({
        calendarId: config.calendarId,
        requestBody: {
          summary: baseRequestBody.summary,
          description: baseRequestBody.description,
          start: baseRequestBody.start,
          end: baseRequestBody.end
        }
      });
      const eventId = requireGoogleEventId(
        response.data.id ?? null,
        "fallback plain event creation"
      );
      logCalendarAttempt(
        "fallback_plain_event",
        "succeeded",
        null,
        fallbackWarning,
        eventId
      );

      return {
        eventId,
        meetingLink: getConferenceLink(response.data),
        timezone: config.timezone,
        warning: fallbackWarning,
        creationMode: "plain_fallback"
      };
    } catch (retryError) {
      throwCalendarSideEffectError(retryError);
    }
  }
}
