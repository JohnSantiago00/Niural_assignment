/**
 * Small Slack Web API client. Lookup and messaging use regular bot scopes,
 * while workspace invites are kept separate because Slack requires admin-level
 * capabilities that are not available in every workspace.
 */
import crypto from "node:crypto";
import { getOptionalEnv } from "@/lib/utils/env";

type SlackApiResult<TData extends Record<string, unknown> = Record<string, unknown>> =
  | ({ ok: true } & TData)
  | { ok: false; error: string; needed?: string; provided?: string };

export type SlackResult =
  | { status: "sent" | "found" | "invited" | "already_joined"; value?: string | null }
  | { status: "skipped" | "failed" | "not_found"; error: string };

function getSlackBotToken() {
  return getOptionalEnv("SLACK_BOT_TOKEN");
}

function getSlackAdminToken() {
  return getOptionalEnv("SLACK_ADMIN_TOKEN");
}

function normalizeSlackError(error: string) {
  const messages: Record<string, string> = {
    missing_scope: "Slack app is missing a required permission scope.",
    not_allowed_token_type: "Slack invite requires an admin-capable token.",
    not_authed: "Slack token is not configured.",
    invalid_auth: "Slack token is invalid.",
    channel_not_found: "Slack channel was not found or the bot cannot access it.",
    not_in_channel: "Slack app is not in the configured channel. Add the app to that channel, then retry.",
    users_not_found: "Candidate is not currently a Slack workspace member.",
    already_in_team: "Candidate already appears to be in Slack.",
    restricted_action: "Slack workspace settings blocked this action."
  };

  return messages[error] ?? `Slack returned: ${error}`;
}

async function slackApi<TData extends Record<string, unknown>>(
  method: string,
  token: string,
  body: Record<string, unknown>
): Promise<SlackApiResult<TData>> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  });

  const data = (await response.json()) as SlackApiResult<TData>;

  if (!data.ok) {
    return {
      ...data,
      error: normalizeSlackError(data.error)
    };
  }

  return data;
}

async function slackApiGet<TData extends Record<string, unknown>>(
  method: string,
  token: string,
  params: Record<string, string>
): Promise<SlackApiResult<TData>> {
  const url = new URL(`https://slack.com/api/${method}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = (await response.json()) as SlackApiResult<TData>;

  if (!data.ok) {
    return {
      ...data,
      error: normalizeSlackError(data.error)
    };
  }

  return data;
}

export function verifySlackRequest(input: {
  body: string;
  timestamp: string | null;
  signature: string | null;
}) {
  const signingSecret = getOptionalEnv("SLACK_SIGNING_SECRET");

  if (!signingSecret || !input.timestamp || !input.signature) {
    return false;
  }

  const ageInSeconds = Math.abs(Date.now() / 1000 - Number(input.timestamp));

  if (!Number.isFinite(ageInSeconds) || ageInSeconds > 60 * 5) {
    return false;
  }

  const base = `v0:${input.timestamp}:${input.body}`;
  const expected = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(base)
    .digest("hex")}`;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(input.signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function lookupSlackUserByEmail(email: string) {
  const token = getSlackBotToken();

  if (!token) {
    return { status: "skipped" as const, error: "Slack bot token is not configured." };
  }

  const result = await slackApiGet<{ user?: { id?: string } }>("users.lookupByEmail", token, {
    email
  });

  if (!result.ok) {
    if (result.error.includes("not currently a Slack workspace member")) {
      return { status: "not_found" as const, error: result.error };
    }

    return { status: "failed" as const, error: result.error };
  }

  const userId = result.user?.id;

  if (!userId) {
    return { status: "failed" as const, error: "Slack lookup succeeded without a user id." };
  }

  return { status: "found" as const, value: userId };
}

export async function inviteSlackUser(input: {
  email: string;
  candidateName: string;
}) {
  const adminToken = getSlackAdminToken();
  const teamId = getOptionalEnv("SLACK_TEAM_ID");
  const channelIds = getOptionalEnv("SLACK_INVITE_CHANNEL_IDS");
  const missingInviteEnv = [
    ["SLACK_TEAM_ID", teamId],
    ["SLACK_INVITE_CHANNEL_IDS", channelIds]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (!adminToken) {
    return {
      status: "skipped" as const,
      error:
        "Manual Slack invite required. Invite the candidate through your Slack workspace, then click Retry Slack onboarding after they join."
    };
  }

  if (missingInviteEnv.length > 0) {
    return {
      status: "skipped" as const,
      error:
        `Slack invite was skipped because ${missingInviteEnv.join(", ")} ${
          missingInviteEnv.length === 1 ? "is" : "are"
        } not configured. Configure Slack admin invite credentials to attempt real workspace invites.`
    };
  }

  const inviteToken = adminToken as string;
  const inviteTeamId = teamId as string;
  const inviteChannelIds = channelIds as string;
  const result = await slackApi("admin.users.invite", inviteToken, {
    email: input.email,
    team_id: inviteTeamId,
    channel_ids: inviteChannelIds,
    real_name: input.candidateName,
    resend: true
  });

  if (!result.ok) {
    if (result.error.includes("already appears to be in Slack")) {
      return { status: "already_joined" as const, value: "already_in_team" };
    }

    return { status: "failed" as const, error: result.error };
  }

  return { status: "invited" as const, value: null };
}

export async function postSlackMessage(input: {
  channel: string;
  text: string;
}) {
  const token = getSlackBotToken();

  if (!token) {
    return { status: "skipped" as const, error: "Slack bot token is not configured." };
  }

  const result = await slackApi("chat.postMessage", token, {
    channel: input.channel,
    text: input.text,
    unfurl_links: false,
    unfurl_media: false
  });

  if (!result.ok) {
    return { status: "failed" as const, error: result.error };
  }

  return { status: "sent" as const };
}

export async function sendSlackDirectMessage(input: {
  slackUserId: string;
  text: string;
}) {
  const token = getSlackBotToken();

  if (!token) {
    return { status: "skipped" as const, error: "Slack bot token is not configured." };
  }

  const opened = await slackApi<{ channel?: { id?: string } }>("conversations.open", token, {
    users: input.slackUserId
  });

  if (!opened.ok) {
    return { status: "failed" as const, error: opened.error };
  }

  const channelId = opened.channel?.id;

  if (!channelId) {
    return { status: "failed" as const, error: "Slack DM opened without a channel id." };
  }

  return postSlackMessage({
    channel: channelId,
    text: input.text
  });
}
