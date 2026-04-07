/**
 * Public tokenized interview selection page. The token maps to a set of held
 * options for one candidate, so we can avoid requiring candidate auth while
 * still keeping the selection flow specific and deterministic.
 */
import { notFound } from "next/navigation";
import {
  confirmInterviewSlotAction,
  requestInterviewRescheduleAction
} from "@/lib/scheduling/actions";
import { getInterviewSelectionView } from "@/lib/scheduling/queries";
import {
  getInterviewStatusClasses,
  getInterviewStatusLabel
} from "@/lib/scheduling/status";

type InterviewSelectionPageProps = {
  params: Promise<{
    selectionToken: string;
  }>;
  searchParams: Promise<{
    scheduled?: string;
    reschedule?: string;
    error?: string;
    warning?: string;
    confirmationEmail?: string;
    confirmationEmailError?: string;
  }>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(value));
}

export const revalidate = 0;

export default async function InterviewSelectionPage({
  params,
  searchParams
}: InterviewSelectionPageProps) {
  const { selectionToken } = await params;
  const resolvedSearchParams = await searchParams;
  const view = await getInterviewSelectionView(selectionToken);

  if (!view) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-14">
      <div className="rounded-[2rem] border border-line bg-panel p-8 shadow-card">
        {resolvedSearchParams.scheduled ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Your interview slot has been confirmed successfully.
          </div>
        ) : null}

        {resolvedSearchParams.reschedule ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Your request for different times has been sent to the hiring team.
          </div>
        ) : null}

        {resolvedSearchParams.error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resolvedSearchParams.error}
          </div>
        ) : null}

        {resolvedSearchParams.warning ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {resolvedSearchParams.warning}
          </div>
        ) : null}

        {!resolvedSearchParams.warning && view.interview.calendar_warning && view.confirmedHold ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Your slot was confirmed. The hiring team will follow up if a separate calendar invite needs to be added manually.
          </div>
        ) : null}

        {resolvedSearchParams.confirmationEmail === "sent" ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            A confirmation email has also been sent with your interview details.
          </div>
        ) : null}

        {resolvedSearchParams.confirmationEmail === "skipped" ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Your interview is confirmed, but the human-readable confirmation email was skipped because Resend is not configured.
          </div>
        ) : null}

        {resolvedSearchParams.confirmationEmail === "failed" ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Your interview is confirmed, but the confirmation email could not be delivered. {resolvedSearchParams.confirmationEmailError ?? ""}
          </div>
        ) : null}

        <p className="text-sm uppercase tracking-[0.18em] text-accent">
          Interview Scheduling
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
          Choose an interview time
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {view.role
            ? `You are selecting an interview slot for the ${view.role.title} role.`
            : "Choose one of the reserved interview slots below."}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] ${getInterviewStatusClasses(view.interview.interview_status)}`}
          >
            {getInterviewStatusLabel(view.interview.interview_status)}
          </span>
          <span className="text-sm text-slate-500">{view.candidate.full_name}</span>
        </div>

        {view.confirmedHold ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="text-lg font-semibold text-emerald-900">Confirmed interview</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-900">
                {formatDateTime(view.confirmedHold.slot_start)} with {view.confirmedHold.interviewer_name}
              </p>
            </div>

            <div className="rounded-3xl border border-line bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Need to reschedule?</h2>
              <p className="mt-2 text-sm text-slate-600">
                If this confirmed slot no longer works, send a short note and the hiring team can offer a new set of times.
              </p>
              <form
                action={requestInterviewRescheduleAction.bind(null, selectionToken)}
                className="mt-4 space-y-4"
              >
                <textarea
                  name="note"
                  rows={4}
                  className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-slate-700"
                  placeholder="Please share any timing constraints or preferred windows."
                />
                <button
                  type="submit"
                  className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
                >
                  Request a different time
                </button>
              </form>
            </div>
          </div>
        ) : view.activeHolds.length > 0 ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-3xl border border-line bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Available held slots</h2>
              <p className="mt-2 text-sm text-slate-600">
                These options are temporarily reserved so other candidates cannot take them while you choose.
              </p>

              <div className="mt-5 space-y-4">
                {view.activeHolds.map((hold) => (
                  <form
                    key={hold.id}
                    action={confirmInterviewSlotAction.bind(null, selectionToken)}
                    className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDateTime(hold.slot_start)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {hold.interviewer_name} · {hold.interviewer_email}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">
                        Reserved until {formatDateTime(hold.expires_at)}
                      </p>
                    </div>
                    <input type="hidden" name="holdId" value={hold.id} />
                    <button
                      type="submit"
                      className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accentDark"
                    >
                      Select this slot
                    </button>
                  </form>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">Need a different time?</h2>
              <p className="mt-2 text-sm text-slate-600">
                If none of the held slots work, you can request a different set of options.
              </p>
              <form
                action={requestInterviewRescheduleAction.bind(null, selectionToken)}
                className="mt-4 space-y-4"
              >
                <textarea
                  name="note"
                  rows={4}
                  className="w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-slate-700"
                  placeholder="Please share any timing constraints or preferred windows."
                />
                <button
                  type="submit"
                  className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
                >
                  Request a different time
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-line bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Scheduling update</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {view.expiredHoldCount > 0
                ? "The held interview options have expired. The hiring team can generate a fresh set of slots for you."
                : "There are no active interview options on this link right now."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
