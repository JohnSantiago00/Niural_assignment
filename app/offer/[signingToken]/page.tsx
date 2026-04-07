/**
 * Public tokenized offer signing page. The token identifies one offer and the
 * server action prevents double-signing, while the canvas component provides a
 * real drawn-signature experience for the candidate.
 */
import { notFound } from "next/navigation";
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
      <section className="mx-auto max-w-3xl px-6 py-14">
        <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-8 shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Offer signed successfully
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-emerald-950">
            Thank you, {view.candidate.full_name}.
          </h1>
          <p className="mt-4 text-base leading-7 text-emerald-900">
            Your offer for {view.offer.confirmed_job_title} has been signed. The
            hiring team has been notified and will follow up with next steps.
          </p>
          <div className="mt-8 rounded-3xl bg-white/80 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              Signed timestamp
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-950">
              {view.offer.signed_at ? formatDateTime(view.offer.signed_at) : "Signed successfully"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      <div className="rounded-[2rem] border border-line bg-panel p-8 shadow-card">
        {resolvedSearchParams.signed ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Your offer has been signed successfully.
          </div>
        ) : null}

        {resolvedSearchParams.alert === "failed" ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your offer is signed. The hiring team alert email may need follow-up.
          </div>
        ) : null}

        {resolvedSearchParams.error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resolvedSearchParams.error}
          </div>
        ) : null}

        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Niural Offer Letter
        </p>
        <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
              {view.offer.confirmed_job_title}
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Prepared for {view.candidate.full_name}
              {view.role ? ` · ${view.role.team}` : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Start date
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {formatDate(view.offer.start_date)}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <article className="rounded-[1.75rem] border border-line bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-950">Offer details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Base salary
                </p>
                <p className="mt-2 text-sm text-slate-800">{view.offer.base_salary}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Reporting manager
                </p>
                <p className="mt-2 text-sm text-slate-800">{view.offer.reporting_manager}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Equity / bonus
                </p>
                <p className="mt-2 text-sm text-slate-800">
                  {view.offer.equity_or_bonus ?? "Not included"}
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <h2 className="text-xl font-semibold text-slate-950">Offer letter</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {view.offer.generated_letter}
              </p>
            </div>
          </article>

          <aside className="rounded-[1.75rem] border border-line bg-white p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Accept and sign</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Draw your signature below and confirm that you agree to the offer terms.
              </p>
              <OfferSignatureForm action={signOfferAction.bind(null, signingToken)} />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
