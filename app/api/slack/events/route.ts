/**
 * Slack Events API endpoint. The route validates Slack's request signature
 * before accepting join events, then lets deterministic app logic decide
 * whether the event matches an active onboarding record.
 */
import { NextRequest, NextResponse } from "next/server";
import { handleSlackTeamJoinEvent } from "@/lib/slack/workflow";
import { verifySlackRequest } from "@/lib/slack/client";

type SlackEventPayload = {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    user?: {
      id?: string;
      profile?: {
        email?: string;
      };
    };
  };
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const isValid = verifySlackRequest({
    body,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature")
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid Slack signature." }, { status: 401 });
  }

  const payload = JSON.parse(body) as SlackEventPayload;

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.event?.type === "team_join") {
    const email = payload.event.user?.profile?.email;
    const slackUserId = payload.event.user?.id;

    if (email && slackUserId) {
      await handleSlackTeamJoinEvent({ email, slackUserId });
    }
  }

  return NextResponse.json({ ok: true });
}
