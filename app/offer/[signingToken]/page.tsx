/**
 * Public tokenized offer signing page. The token identifies one offer and the
 * server action prevents double-signing, while the canvas component provides a
 * real drawn-signature experience for the candidate.
 */
import { notFound } from "next/navigation";
import { Eyebrow, Pill, PublicContainer, SurfaceCard } from "@/components/public-ui";
import { OfferSignatureForm } from "@/components/signature-pad";
import { signOfferAction } from "@/lib/offers/actions";
import { getOfferSigningView } from "@/lib/offers/workflow";

type OfferSigningPageProps = {
  params: Promise<{
    signingToken: string;
  }>;
  searchParams: Promise<{
    signed?: string;
    error?: string;
    alert?: string;
    alertError?: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getFriendlySigningError(message: string) {
  if (/agree/i.test(message)) {
    return "Please confirm your agreement before signing.";
  }

  if (/signature/i.test(message)) {
    return "Please draw your signature before submitting.";
  }

  return "We couldn’t complete the signature just now. Please review the form and try again.";
}

function OfferLetter({ letter }: { letter: string }) {
  return (
    <div className="space-y-5">
      {letter
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-sm leading-7 text-slate-700">
            {paragraph}
          </p>
        ))}
    </div>
  );
}

export const revalidate = 0;

export default async function OfferSigningPage({
  params,
  searchParams
}: OfferSigningPageProps) {
  const { signingToken } = await params;
  const resolvedSearchParams = await searchParams;
  const view = await getOfferSigningView(signingToken);

  if (!view) {
    notFound();
  }

  const isSigned = view.offer.offer_status === "signed";

  if (isSigned) {
    return (
      <PublicContainer className="py-14">
        <div className="mx-auto max-w-3xl">
          <SurfaceCard className="relative overflow-hidden border-emerald-200 bg-emerald-50/90 p-8 shadow-soft sm:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl" />
            <div className="relative">
              <Eyebrow className="text-emerald-700">Offer signed successfully</Eyebrow>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-emerald-950 sm:text-5xl">
                Thank you, {view.candidate.full_name}.
              </h1>
              <p className="mt-5 text-base leading-8 text-emerald-900">
                We’re excited to have you join the team. The hiring team has been notified and will follow up with next steps.
              </p>
              <div className="mt-8 rounded-3xl border border-emerald-200 bg-white/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Signed timestamp
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-950">
                  {view.offer.signed_at ? formatDateTime(view.offer.signed_at) : "Signed successfully"}
                </p>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </PublicContainer>
    );
  }

  return (
    <PublicContainer className="py-12 sm:py-14">
      <div className="mx-auto max-w-6xl">
        {resolvedSearchParams.error ? (
          <SurfaceCard className="mb-6 border-red-200 bg-red-50/90 px-5 py-4 text-sm text-red-800">
            {getFriendlySigningError(resolvedSearchParams.error)}
          </SurfaceCard>
        ) : null}

        <SurfaceCard className="relative overflow-hidden bg-hero p-8 sm:p-10">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Eyebrow>Offer letter</Eyebrow>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-ink sm:text-5xl">
                {view.offer.confirmed_job_title}
              </h1>
              <p className="mt-5 text-base leading-8 text-slate-600">
                Prepared for {view.candidate.full_name}
                {view.role ? ` · ${view.role.team}` : ""}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Pill>Start {formatDate(view.offer.start_date)}</Pill>
                <Pill>{view.offer.base_salary}</Pill>
                <Pill>Manager: {view.offer.reporting_manager}</Pill>
              </div>
            </div>
            <div className="rounded-3xl border border-line/70 bg-white/80 px-5 py-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Next step
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">Review and sign</p>
            </div>
          </div>
        </SurfaceCard>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <SurfaceCard className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-ink">Offer details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line/70 bg-hero/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Base salary
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">{view.offer.base_salary}</p>
              </div>
              <div className="rounded-2xl border border-line/70 bg-hero/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Reporting manager
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">{view.offer.reporting_manager}</p>
              </div>
              <div className="rounded-2xl border border-line/70 bg-hero/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Equity / bonus
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {view.offer.equity_or_bonus ?? "Not included"}
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-line/70 pt-6">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">Offer letter</h2>
              <div className="mt-5 rounded-[1.5rem] border border-line/70 bg-white/80 p-5 shadow-sm">
                <OfferLetter letter={view.offer.generated_letter} />
              </div>
            </div>
          </SurfaceCard>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <SurfaceCard className="p-6">
              <div>
                <Eyebrow>Accept offer</Eyebrow>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-ink">Review, agree, sign.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Please review the letter, confirm your agreement, and draw your signature below.
                </p>
                <OfferSignatureForm action={signOfferAction.bind(null, signingToken)} />
              </div>
            </SurfaceCard>
          </aside>
        </div>
      </div>
    </PublicContainer>
  );
}
