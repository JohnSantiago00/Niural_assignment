# Phase 06 Slack Onboarding Notes

Phase 06 starts after an offer is signed and attempts to move the candidate into
Slack onboarding without pretending workspace admin capabilities exist when they
do not.

## What Phase 06 Adds

- A `slack_onboarding` record linked to the candidate and offer.
- An offer-signed trigger that starts Slack onboarding once, idempotently.
- Real Slack user lookup by email through `users.lookupByEmail`.
- Optional real workspace invite attempt through `admin.users.invite` when
  admin-capable Slack credentials are configured.
- Resend invite-link email fallback when admin invites are unavailable but
  `SLACK_WORKSPACE_INVITE_URL` is configured.
- Real Slack messages through `conversations.open` + `chat.postMessage` for the
  candidate welcome DM, and `chat.postMessage` for HR notification.
- A signed Slack Events API endpoint for `team_join` events.
- Admin visibility into invite, join, welcome-message, and HR-notification state.

## What Is Real Slack API Vs Environment-Limited

The app uses real Slack API calls:

- `users.lookupByEmail` to detect whether the candidate is already in Slack.
- `conversations.open` + `chat.postMessage` to send the candidate welcome DM.
- `chat.postMessage` to send HR/internal messages.
- `admin.users.invite` only if `SLACK_ADMIN_TOKEN` and `SLACK_TEAM_ID` are
  configured.

Slack workspace invitation is the sensitive part. In many workspaces, especially
non-Enterprise or non-admin app installs, invite APIs are blocked or require
admin/user tokens with specific scopes. When that happens, the app stores the
limitation as an admin-facing follow-up state instead of marking the invite as
sent.

The bot-token-only path is still useful: if `SLACK_WORKSPACE_INVITE_URL` is
configured, the app emails that Slack invite link to the candidate through
Resend. After the candidate joins, the admin `Retry Slack onboarding` action or
the `team_join` event can detect the candidate and send the real Slack
welcome/HR messages. Local testing usually uses the admin button because Slack
cannot reach a localhost Events API endpoint.

## AI Boundary

Gemini only drafts the Slack welcome message copy from explicit onboarding
context: candidate name, role, start date, manager, and configured resource
links. App logic still decides when the candidate has joined and whether Slack
messages should be sent.

## Join Detection

There are two real detection paths:

- Slack Events API `team_join` event at `/api/slack/events`.
- Admin-triggered lookup from the candidate detail page, using the candidate's
  email.

Both paths are idempotent. Once welcome and HR messages have been sent, repeated
events or manual checks do not spam Slack.

## Configuration

Required for Slack messaging and lookup:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET` for Events API verification

Optional for invite attempts:

- `SLACK_ADMIN_TOKEN`
- `SLACK_TEAM_ID`
- `SLACK_INVITE_CHANNEL_IDS`

Slack's admin invite method requires at least one channel id, so
`SLACK_INVITE_CHANNEL_IDS` is required whenever invite attempts are enabled.

Optional non-admin fallback:

- `SLACK_WORKSPACE_INVITE_URL`

Optional for message routing:

- `SLACK_HR_CHANNEL_ID`
- `SLACK_ONBOARDING_CHANNEL_ID`
- `SLACK_ONBOARDING_RESOURCE_LINKS`

After lookup/join detection, the app sends a public team welcome to
`SLACK_ONBOARDING_CHANNEL_ID` and a personal welcome DM to the joined candidate.
HR messages are sent to `SLACK_HR_CHANNEL_ID`; if the HR channel is the same as
the onboarding channel, the public welcome also satisfies the HR notification so
the app does not post an internal-looking duplicate message into the candidate
channel. The bot must be a member of any configured channel or Slack will return
a channel membership error.

## Known Limitations

- Invite capability depends on Slack workspace plan, scopes, and token type.
- This phase does not build full Slack OAuth setup or admin app installation.
- HR/channel notifications require the bot to have access to the configured
  channel.
- Slack email lookup requires appropriate Slack scopes, typically including
  user/email read access.
