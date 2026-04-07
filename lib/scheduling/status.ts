/**
 * Explicit scheduling statuses keep the calendar workflow deterministic and
 * separate from AI logic. Interview state is managed by application code, not
 * by model output or ad hoc UI branching.
 */
import type { HoldStatus, InterviewStatus } from "@/types/database";

export function getInterviewStatusLabel(status: InterviewStatus) {
  return (
    {
      pending: "Pending",
      options_sent: "Options Sent",
      scheduled: "Scheduled",
      reschedule_requested: "Reschedule Requested",
      completed: "Completed",
      cancelled: "Cancelled"
    } satisfies Record<InterviewStatus, string>
  )[status];
}

export function getInterviewStatusClasses(status: InterviewStatus) {
  return (
    {
      pending: "border-slate-200 bg-slate-100 text-slate-700",
      options_sent: "border-amber-200 bg-amber-100 text-amber-700",
      scheduled: "border-emerald-200 bg-emerald-100 text-emerald-700",
      reschedule_requested: "border-orange-200 bg-orange-100 text-orange-700",
      completed: "border-violet-200 bg-violet-100 text-violet-700",
      cancelled: "border-rose-200 bg-rose-100 text-rose-700"
    } satisfies Record<InterviewStatus, string>
  )[status];
}

export function getHoldStatusLabel(status: HoldStatus) {
  return (
    {
      held: "Held",
      confirmed: "Confirmed",
      released: "Released",
      expired: "Expired"
    } satisfies Record<HoldStatus, string>
  )[status];
}

export function getHoldStatusClasses(status: HoldStatus) {
  return (
    {
      held: "border-amber-200 bg-amber-50 text-amber-700",
      confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
      released: "border-slate-200 bg-slate-100 text-slate-600",
      expired: "border-rose-200 bg-rose-50 text-rose-700"
    } satisfies Record<HoldStatus, string>
  )[status];
}
