/**
 * Public tokenized interview selection page. The token maps to a set of held
 * options for one candidate, so we can avoid requiring candidate auth while
 * still keeping the selection flow specific and deterministic.
 */
import { notFound } from "next/navigation";
import { Button, Eyebrow, Pill, PublicContainer, SurfaceCard } from "@/components/public-ui";
import {
  confirmInterviewSlotAction,
  requestInterviewRescheduleAction
} from "@/lib/scheduling/actions";
import { getInterviewSelectionView } from "@/lib/scheduling/queries";

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

function getFriendlyInterviewError(message: string) {
  if (/short note/i.test(message)) {
    return "Please add a short note so the hiring team can send better times.";
  }

  return "That slot may no longer be available. Please choose another time or request a fresh set of options.";
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

  const friendlyRole = view.role?.title ?? "the role";
  const showConfirmedMessage = Boolean(
    resolvedSearchParams.scheduled || view.confirmedHold
  );

  return (
    <PublicContainer className="py-12 sm:py-14">
      <div className="mx-auto max-w-5xl">
        {showConfirmedMessage ? (
          <SurfaceCard className="mb-6 border-emerald-200 bg-emerald-50/90 px-5 py-4 text-emerald-900">
            <p className="text-sm font-semibold">Your interview is confirmed.</p>
            <p className="mt-1 text-sm leading-6">
              We’ve sent you a confirmation email with all the details.
            </p>
          </SurfaceCard>
        ) : null}

        {resolvedSearchParams.reschedule ? (
          <SurfaceCard className="mb-6 border-emerald-200 bg-emerald-50/90 px-5 py-4 text-sm text-emerald-900">
            Your request for different times has been sent to the hiring team.
          </SurfaceCard>
        ) : null}

        {resolvedSearchParams.error ? (
          <SurfaceCard className="mb-6 border-red-200 bg-red-50/90 px-5 py-4 text-sm text-red-800">
            {getFriendlyInterviewError(resolvedSearchParams.error)}
          </SurfaceCard>
        ) : null}

        {resolvedSearchParams.confirmationEmail === "failed" ? (
          <SurfaceCard className="mb-6 border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900">
            Your interview is confirmed. If the confirmation email does not arrive shortly, the hiring team will follow up.
          </SurfaceCard>
        ) : null}

        <SurfaceCard className="relative overflow-hidden bg-hero p-8 sm:p-10">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <Eyebrow>Interview scheduling</Eyebrow>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-ink sm:text-5xl">
              Choose a time that works for you.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              You’re scheduling an interview for {friendlyRole}. Pick one of the times below,
              and we’ll send the details to your inbox.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Pill>{view.candidate.full_name}</Pill>
              <Pill>{friendlyRole}</Pill>
            </div>
          </div>
        </SurfaceCard>

        {view.confirmedHold ? (
          <div className="mt-8 space-y-6">
            <SurfaceCard className="border-emerald-200 bg-emerald-50/90 p-6">
              <Eyebrow className="text-emerald-700">Confirmed interview</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-emerald-950">
                You’re all set.
              </h2>
              <p className="mt-3 text-base leading-7 text-emerald-900">
                {formatDateTime(view.confirmedHold.slot_start)} with {view.confirmedHold.interviewer_name}
              </p>
            </SurfaceCard>

            <SurfaceCard className="p-6">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-ink">Need to reschedule?</h2>
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
                  className="w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                  placeholder="Please share any timing constraints or preferred windows."
                />
                <Button type="submit" variant="secondary">
                  Request a different time
                </Button>
              </form>
            </SurfaceCard>
          </div>
        ) : view.activeHolds.length > 0 ? (
          <div className="mt-8 space-y-6">
            <SurfaceCard className="p-6">
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-ink">Available times</h2>
              <p className="mt-2 text-sm text-slate-600">
                These options are reserved briefly for you. Choose the one that fits best.
              </p>

              <div className="mt-6 grid gap-4">
                {view.activeHolds.map((hold) => (
                  <form
                    key={hold.id}
                    action={confirmInterviewSlotAction.bind(null, selectionToken)}
                    className="group flex flex-col gap-4 rounded-[1.5rem] border border-line/80 bg-hero/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white hover:shadow-soft md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-base font-semibold tracking-[-0.02em] text-ink">
                        {formatDateTime(hold.slot_start)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        With {hold.interviewer_name}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">
                        Reserved until {formatDateTime(hold.expires_at)}
                      </p>
                    </div>
                    <input type="hidden" name="holdId" value={hold.id} />
                    <Button type="submit" className="bg-ink hover:bg-slate-800">
                      Select this slot
                    </Button>
                  </form>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-6">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-ink">Need a different time?</h2>
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
                  className="w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                  placeholder="Please share any timing constraints or preferred windows."
                />
                <Button type="submit" variant="secondary">
                  Request a different time
                </Button>
              </form>
            </SurfaceCard>
          </div>
        ) : (
          <SurfaceCard className="mt-8 p-6">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-ink">Scheduling update</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {view.expiredHoldCount > 0
                ? "These interview options have expired. The hiring team can send you a fresh set of times."
                : "There are no active interview options on this link right now."}
            </p>
          </SurfaceCard>
        )}
      </div>
    </PublicContainer>
  );
}
