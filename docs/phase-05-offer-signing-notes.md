# Phase 05 Offer Letter + E-Signature Notes

Phase 05 adds the offer workflow after interview completion.

## What This Phase Builds

- Admin-only offer generation after a candidate reaches the post-interview stage.
- A short hiring-manager input form for title, start date, compensation, manager, and custom terms.
- Gemini-generated offer letter drafts that admins review before sending.
- A public tokenized `/offer/[signingToken]` candidate signing page.
- A custom in-app canvas signature pad.
- Signature capture with timestamp and request IP.
- Resend delivery for the candidate offer email.
- Resend alert email when the candidate signs.

## Why AI Is Used Here

Gemini drafts the professional offer letter from explicit admin inputs and candidate context. It does not decide whether the candidate should receive an offer, does not send the offer, and does not mark the offer signed. Those workflow transitions remain deterministic app logic.

## Why Custom Signing

The assignment allows a custom signing UI if signature, timestamp, and IP address are captured. This prototype uses a canvas signature pad instead of DocuSign/PandaDoc so the signing flow is easy to demo without external signing vendor setup.

## Signature Storage Tradeoff

The drawn signature is stored as a PNG data URL on the `offers` row. For this prototype, that is the smallest clear implementation because signatures are small and stay attached to the offer record. A production version would likely upload the PNG/PDF artifact to private storage and store only a path plus an immutable signing audit record.

## Signing Workflow

1. Admin generates an offer draft from required offer inputs.
2. The app saves the draft and creates a signing token.
3. Admin sends the offer email through Resend.
4. Candidate opens the tokenized signing page.
5. Candidate reviews the offer letter and draws a signature.
6. Candidate must check the agreement box before submit is enabled.
7. The server validates the signature payload and token.
8. The first successful signature wins; repeated signing attempts do not overwrite the signed record.
9. The app records `signed_at`, `signer_ip`, and the signature image.
10. Resend sends an immediate signed-offer alert to the hiring team when configured.

## Limitations

- No third-party e-signature vendor is integrated yet.
- The offer letter is not rendered into a PDF in this phase.
- Signature image data is stored directly in Postgres for MVP simplicity.
- Email delivery is best-effort and does not control offer truth.
- The signing token does not currently expire because demo reliability is prioritized.

## What Phase 06 Builds Next

Phase 06 should handle onboarding handoff after the offer is signed, including Slack onboarding or other internal team setup flows.
