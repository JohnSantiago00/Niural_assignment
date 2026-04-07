/**
 * Interview slot generation backed by Google Calendar free/busy plus our own
 * DB hold set. Google tells us when the shared interviewer calendar is busy;
 * the DB still decides which open slots are currently reserved in-app.
 */
import { getCalendarBusyWindows } from "@/lib/scheduling/google-calendar";
import type { CalendarHoldRecord, ReschedulePreferences } from "@/types/database";

export type InterviewerConfig = {
  name: string;
  email: string;
  workdayStartHour: number;
  workdayEndHour: number;
};

export type CandidateSlot = {
  interviewerName: string;
  interviewerEmail: string;
  start: string;
  end: string;
};

const SLOT_DURATION_MINUTES = 45;
const OFFER_LIMIT = 5;
const BUSINESS_DAYS = 5;
const DEFAULT_WORKDAY_START_HOUR = 10;
const DEFAULT_WORKDAY_END_HOUR = 17;
const GENERATION_POOL_LIMIT = 20;

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function setLocalHour(date: Date, hour: number, minutes: number) {
  const copy = new Date(date);
  copy.setHours(hour, minutes, 0, 0);
  return copy;
}

function overlapsBusyWindow(slotStart: Date, slotEnd: Date, busyWindows: Array<{ start: string; end: string }>) {
  return busyWindows.some((window) => {
    const busyStart = new Date(window.start);
    const busyEnd = new Date(window.end);
    return slotStart < busyEnd && slotEnd > busyStart;
  });
}

/**
 * Because holds carry the interviewer and slot window, we can filter out any
 * overlapping active slot before offering it to another candidate.
 */
function overlapsActiveHold(
  interviewerEmail: string,
  slotStart: Date,
  slotEnd: Date,
  activeHolds: CalendarHoldRecord[]
) {
  return activeHolds.some((hold) => {
    if (hold.interviewer_email !== interviewerEmail) {
      return false;
    }

    const holdStart = new Date(hold.slot_start);
    const holdEnd = new Date(hold.slot_end);
    return slotStart < holdEnd && slotEnd > holdStart;
  });
}

function normalizeWeekday(value: string) {
  return value.trim().toLowerCase();
}

function getTimeOfDay(date: Date) {
  const hour = date.getHours();

  if (hour < 12) {
    return "morning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
}

function getSlotPreferenceScore(slot: CandidateSlot, preferences: ReschedulePreferences | null) {
  if (!preferences) {
    return 0;
  }

  const slotStart = new Date(slot.start);
  const slotDay = normalizeWeekday(
    new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(slotStart)
  );
  let score = 0;

  if (preferences.preferred_time_of_day && getTimeOfDay(slotStart) === preferences.preferred_time_of_day) {
    score += 3;
  }

  if (preferences.preferred_days.map(normalizeWeekday).includes(slotDay)) {
    score += 2;
  }

  if (preferences.avoid_days.map(normalizeWeekday).includes(slotDay)) {
    score -= 4;
  }

  return score;
}

export async function generateInterviewSlots(
  activeHolds: CalendarHoldRecord[],
  preferences: ReschedulePreferences | null = null
) {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() + 1);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);
  endDate.setHours(DEFAULT_WORKDAY_END_HOUR, 0, 0, 0);

  const googleAvailability = await getCalendarBusyWindows({
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString()
  });
  const slots: CandidateSlot[] = [];
  const interviewer: InterviewerConfig = {
    name: googleAvailability.interviewerName,
    email: googleAvailability.interviewerEmail,
    workdayStartHour: DEFAULT_WORKDAY_START_HOUR,
    workdayEndHour: DEFAULT_WORKDAY_END_HOUR
  };
  const dayCursor = new Date(startDate);

  let businessDaysCount = 0;

  while (businessDaysCount < BUSINESS_DAYS && slots.length < GENERATION_POOL_LIMIT) {
    if (!isBusinessDay(dayCursor)) {
      dayCursor.setDate(dayCursor.getDate() + 1);
      continue;
    }

    businessDaysCount += 1;

    for (
      let hour = interviewer.workdayStartHour;
      hour < interviewer.workdayEndHour;
      hour += 1
    ) {
      const slotStart = setLocalHour(dayCursor, hour, 0);
      const slotEnd = addMinutes(slotStart, SLOT_DURATION_MINUTES);

      if (slotEnd.getHours() > interviewer.workdayEndHour) {
        continue;
      }

      if (overlapsBusyWindow(slotStart, slotEnd, googleAvailability.busyWindows)) {
        continue;
      }

      if (overlapsActiveHold(interviewer.email, slotStart, slotEnd, activeHolds)) {
        continue;
      }

      if (preferences?.earliest_date) {
        const earliestDate = new Date(preferences.earliest_date);

        if (!Number.isNaN(earliestDate.getTime()) && slotStart < earliestDate) {
          continue;
        }
      }

      slots.push({
        interviewerName: interviewer.name,
        interviewerEmail: interviewer.email,
        start: slotStart.toISOString(),
        end: slotEnd.toISOString()
      });
    }

    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  return slots
    .sort((left, right) => {
      const scoreDiff =
        getSlotPreferenceScore(right, preferences) - getSlotPreferenceScore(left, preferences);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return new Date(left.start).getTime() - new Date(right.start).getTime();
    })
    .slice(0, OFFER_LIMIT);
}
