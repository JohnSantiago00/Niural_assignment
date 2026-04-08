# Phase 05 Offer Letter + E-Signature Notes

Phase 05 adds the offer workflow after interview completion.

## What This Phase Builds

- Admin-only offer generation after a candidate reaches the post-interview stage.
- A short hiring-manager input form for title, start date, compensation, manager, and custom terms.
- Gemini-generated offer letter content created behind the admin's `Send offer` action.
- A public tokenized `/offer/[signingToken]` candidate signing page.
- A custom in-app canvas signature pad.
- Signature capture with timestamp and request IP.
- Resend delivery for the candidate offer email.
- Resend alert email when the candidate signs.

## Why AI Is Used Here

Gemini drafts the professional offer letter from explicit admin inputs and candidate context. It does not decide whether the candidate should receive an offer, does not send the offer, and does not mark the offer signed. Those workflow transitions remain deterministic app logic.

If Gemini is temporarily quota-limited or unavailable, the send-offer
flow falls back to a deterministic plain-English offer letter built only from
the hiring-manager inputs. This keeps the end-to-end signing/onboarding path
testable while still preserving the normal Gemini path when the provider is
available.

## Why Custom Signing

The signing flow uses a custom canvas signature pad that captures signature, timestamp, and IP address without requiring an external signing vendor.

## Signature Storage Tradeoff

The drawn signature is stored as a PNG data URL on the `offers` row. That keeps the signature attached to the offer record. A production version would likely upload the PNG/PDF artifact to private storage and store only a path plus an immutable signing audit record.

## Signing Workflow

1. Admin enters the required offer inputs and clicks `Send offer`.
2. The app validates the start date against the completed interview date.
3. The app generates and stores the offer letter content.
4. The app creates a signing token and sends the offer email through Resend.
4. Candidate opens the tokenized signing page.
5. Candidate reviews the offer letter and draws a signature.
6. Candidate must check the agreement box before submit is enabled.
7. The server validates the signature payload and token.
8. The first successful signature wins; repeated signing attempts do not overwrite the signed record.
9. The app records `signed_at`, `signer_ip`, and the signature image.
10. Resend sends an immediate signed-offer alert to the hiring team when configured.

## Limitations

- No third-party e-signature vendor is integrated yet.
- The offer letter is not rendered into a PDF.
- Signature image data is stored directly in Postgres for implementation simplicity.
- Email delivery is best-effort and does not control offer truth.
- Admin review shows offer status, recipient, sent time, and signed state rather than the full letter body.
- The signing token does not currently expire because demo reliability is prioritized.

## How This Connects To Phase 06

After the offer is signed, the app starts Slack onboarding by creating or
reusing a `slack_onboarding` record. Depending on the configured Slack
capabilities, it can send an invite-link email, detect the candidate by Slack
email lookup, post a team welcome, send a candidate DM, and notify HR.
