/**
 * Coordinates Slack onboarding after a signed offer. Supabase stores the
 * durable onboarding state; Slack calls are external side effects whose
 * outcomes are recorded without rolling back the hiring workflow.
 */
import { generateSlackWelcomeMessage } from "@/lib/gemini/generate-slack-welcome";
import { sendSlackInviteEmail } from "@/lib/email/send-slack-invite-email";
import {
  inviteSlackUser,
  lookupSlackUserByEmail,
  postSlackMessage,
  sendSlackDirectMessage
} from "@/lib/slack/client";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOptionalEnv } from "@/lib/utils/env";
import type {
  CandidateRecord,
  OfferRecord,
  RoleRecord,
  SlackOnboardingRecord
} from "@/types/database";

type OnboardingContext = {
  onboarding: SlackOnboardingRecord;
  candidate: CandidateRecord;
  offer: OfferRecord;
  role: RoleRecord;
};

function parseResourceLinks() {
  return (getOptionalEnv("SLACK_ONBOARDING_RESOURCE_LINKS") ?? "")
    .split(/[\n,]/)
    .map((link) => link.trim())
    .filter(Boolean);
}

function formatStartDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long"
  }).format(new Date(`${value}T00:00:00`));
}

function formatResourceLine(resources: string[]) {
  if (resources.length === 0) {
    return null;
  }

  return `First-week resources: ${resources.join(" ")}`;
}

function buildPublicWelcomeMessage(input: {
  slackUserId: string;
  candidateName: string;
  roleTitle: string;
  startDate: string;
  managerName: string;
  resourceLinks: string[];
}) {
  return [
    `:wave: Please welcome <@${input.slackUserId}> to Niural!`,
    `${input.candidateName} is joining as ${input.roleTitle} starting ${input.startDate}.`,
    `${input.managerName} and the team are excited to have you here. Welcome aboard!`,
    formatResourceLine(input.resourceLinks)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDeterministicDirectWelcome(input: {
  candidateName: string;
  roleTitle: string;
  startDate: string;
  managerName: string;
  resourceLinks: string[];
}) {
  return [
    `Welcome to Niural, ${input.candidateName}!`,
    `We are excited to have you joining as ${input.roleTitle} starting ${input.startDate}.`,
    `${input.managerName} says: welcome aboard, and we are excited to get you set up for a strong first week.`,
    formatResourceLine(input.resourceLinks)
  ]
    .filter(Boolean)
    .join("\n\n");
}

function combineSlackErrors(errors: Array<string | null | undefined>) {
  return errors.filter(Boolean).join("\n");
}

async function writeAuditLog(candidateId: string, actionType: string, actionDetail: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    candidate_id: candidateId,
    action_type: actionType,
    action_detail: actionDetail,
    actor: "system"
  });

  if (error) {
    console.error("Failed to write Slack onboarding audit log", error);
  }
}

async function getOnboardingContextByCandidate(candidateId: string): Promise<OnboardingContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data: candidate } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle<CandidateRecord>();

  if (!candidate) {
    return null;
  }

  const [{ data: offer }, { data: role }, { data: onboarding }] = await Promise.all([
    supabase.from("offers").select("*").eq("candidate_id", candidate.id).maybeSingle<OfferRecord>(),
    supabase.from("roles").select("*").eq("id", candidate.role_id).maybeSingle<RoleRecord>(),
    supabase
      .from("slack_onboarding")
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle<SlackOnboardingRecord>()
  ]);

  if (!offer || !role || !onboarding) {
    return null;
  }

  return { onboarding, candidate, offer, role };
}

async function getOnboardingContextByEmail(email: string): Promise<OnboardingContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data: onboarding } = await supabase
    .from("slack_onboarding")
    .select("*")
    .eq("slack_invite_email", email)
    .maybeSingle<SlackOnboardingRecord>();

  if (!onboarding) {
    return null;
  }

  return getOnboardingContextByCandidate(onboarding.candidate_id);
}

async function upsertOnboardingForOffer(input: {
  offer: OfferRecord;
  candidate: CandidateRecord;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: existingOnboarding } = await supabase
    .from("slack_onboarding")
    .select("*")
    .eq("candidate_id", input.candidate.id)
    .maybeSingle<SlackOnboardingRecord>();

  if (existingOnboarding) {
    return existingOnboarding;
  }

  const { data, error } = await supabase
    .from("slack_onboarding")
    .insert({
      candidate_id: input.candidate.id,
      offer_id: input.offer.id,
      slack_invite_email: input.candidate.email,
      onboarding_status: "invite_pending"
    })
    .select("*")
    .single<SlackOnboardingRecord>();

  if (error) {
    throw new Error(`Failed to start Slack onboarding: ${error.message}`);
  }

  return data;
}

async function updateOnboarding(id: string, update: Partial<SlackOnboardingRecord>) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("slack_onboarding")
    .update(update)
    .eq("id", id)
    .select("*")
    .single<SlackOnboardingRecord>();

  if (error) {
    throw new Error(`Failed to update Slack onboarding: ${error.message}`);
  }

  return data;
}

async function attemptInviteOrEmailFallback(context: Omit<OnboardingContext, "onboarding"> & {
  onboarding: SlackOnboardingRecord;
}) {
  if (context.onboarding.invite_status === "invite_email_sent") {
    return context.onboarding;
  }

  const workspaceInviteUrl = getOptionalEnv("SLACK_WORKSPACE_INVITE_URL");
  const invite = await inviteSlackUser({
    email: context.candidate.email,
    candidateName: context.candidate.full_name
  });

  if (invite.status === "invited" || invite.status === "already_joined") {
    const onboarding = await updateOnboarding(context.onboarding.id, {
      invite_attempted_at: new Date().toISOString(),
      invite_status: invite.status === "invited" ? "sent" : "already_joined",
      invite_error: null,
      onboarding_status: invite.status === "invited" ? "invite_sent" : "needs_manual_follow_up"
    });

    await writeAuditLog(
      context.candidate.id,
      "slack_onboarding_started",
      invite.status === "invited"
        ? "Slack onboarding started and workspace invite was attempted."
        : "Slack onboarding started and Slack reported the candidate may already be in the workspace."
    );

    return onboarding;
  }

  if (workspaceInviteUrl) {
    const delivery = await sendSlackInviteEmail({
      candidateName: context.candidate.full_name,
      candidateEmail: context.candidate.email,
      roleTitle: context.offer.confirmed_job_title || context.role.title,
      inviteUrl: workspaceInviteUrl
    });
    const sent = delivery.status === "sent";
    const onboarding = await updateOnboarding(context.onboarding.id, {
      invite_attempted_at: new Date().toISOString(),
      invite_status: sent ? "invite_email_sent" : delivery.status,
      invite_error: "error" in delivery ? delivery.error : null,
      onboarding_status: sent ? "invite_sent" : "needs_manual_follow_up"
    });

    await writeAuditLog(
      context.candidate.id,
      "slack_onboarding_started",
      sent
        ? "Slack onboarding invite link email was sent to the candidate."
        : `Slack onboarding started, but invite link email needs follow-up. ${"error" in delivery ? delivery.error : ""}`
    );

    return onboarding;
  }

  const onboarding = await updateOnboarding(context.onboarding.id, {
    invite_attempted_at: new Date().toISOString(),
    invite_status: invite.status,
    invite_error: "error" in invite ? invite.error : null,
    onboarding_status: "needs_manual_follow_up"
  });

  await writeAuditLog(
    context.candidate.id,
    "slack_onboarding_started",
    `Slack onboarding started, but invite delivery needs manual follow-up. ${"error" in invite ? invite.error : ""}`
  );

  return onboarding;
}

async function sendWelcomeAndHrMessages(context: OnboardingContext, slackUserId: string) {
  if (context.onboarding.welcome_sent_at && context.onboarding.hr_notified_at) {
    return context.onboarding;
  }

  const resources = parseResourceLinks();
  const startDateText = formatStartDate(context.offer.start_date);
  const roleTitle = context.offer.confirmed_job_title || context.role.title;
  const publicWelcomeText = buildPublicWelcomeMessage({
    slackUserId,
    candidateName: context.candidate.full_name,
    roleTitle,
    startDate: startDateText,
    managerName: context.offer.reporting_manager,
    resourceLinks: resources
  });
  let directWelcomeText = buildDeterministicDirectWelcome({
    candidateName: context.candidate.full_name,
    roleTitle,
    startDate: startDateText,
    managerName: context.offer.reporting_manager,
    resourceLinks: resources
  });

  try {
    const generated = await generateSlackWelcomeMessage({
      candidateName: context.candidate.full_name,
      roleTitle,
      startDate: startDateText,
      managerName: context.offer.reporting_manager,
      resourceLinks: resources
    });
    directWelcomeText = generated.message;
  } catch (error) {
    console.error("Slack welcome message generation failed; using deterministic fallback", error);
  }

  let onboarding = context.onboarding;
  let publicWelcomeSent = false;

  if (!onboarding.welcome_sent_at) {
    // Send both a visible team welcome and a personal welcome. The public post
    // uses the configured onboarding channel, while the DM uses
    // conversations.open so the new hire receives a direct app message.
    const onboardingChannel = getOptionalEnv("SLACK_ONBOARDING_CHANNEL_ID");
    const channelDelivery = onboardingChannel
      ? await postSlackMessage({ channel: onboardingChannel, text: publicWelcomeText })
      : {
          status: "failed" as const,
          error: "Slack onboarding channel is not configured."
        };
    const directDelivery = await sendSlackDirectMessage({
      slackUserId,
      text: directWelcomeText
    });
    const welcomeDelivered =
      channelDelivery.status === "sent" && directDelivery.status === "sent";
    publicWelcomeSent = channelDelivery.status === "sent";

    onboarding = await updateOnboarding(onboarding.id, {
      welcome_status: welcomeDelivered ? "sent" : "failed",
      welcome_sent_at: welcomeDelivered ? new Date().toISOString() : null,
      welcome_error: welcomeDelivered
        ? null
        : combineSlackErrors([
            "error" in channelDelivery ? channelDelivery.error : null,
            "error" in directDelivery ? directDelivery.error : null
          ]),
      onboarding_status: welcomeDelivered ? "welcome_sent" : "joined"
    });
  } else {
    publicWelcomeSent = true;
  }

  if (!onboarding.hr_notified_at) {
    const hrChannel = getOptionalEnv("SLACK_HR_CHANNEL_ID");
    const onboardingChannel = getOptionalEnv("SLACK_ONBOARDING_CHANNEL_ID");
    const text = [
      `New hire onboarding update`,
      `${context.candidate.full_name} has joined Slack.`,
      `Role: ${roleTitle}`,
      `Start date: ${startDateText}`
    ].join("\n");
    const hrDelivery =
      hrChannel && hrChannel === onboardingChannel && publicWelcomeSent
        ? { status: "sent" as const }
        : hrChannel
          ? await postSlackMessage({ channel: hrChannel, text })
          : { status: "failed" as const, error: "Slack HR channel is not configured." };

    onboarding = await updateOnboarding(onboarding.id, {
      hr_notification_status: hrDelivery.status === "sent" ? "sent" : "failed",
      hr_notified_at: hrDelivery.status === "sent" ? new Date().toISOString() : null,
      hr_notification_error: "error" in hrDelivery ? hrDelivery.error : null,
      onboarding_status: hrDelivery.status === "sent" ? "completed" : onboarding.onboarding_status
    });
  }

  if (onboarding.welcome_sent_at && onboarding.hr_notified_at) {
    await createSupabaseAdminClient()
      .from("candidates")
      .update({ current_status: "onboarded" })
      .eq("id", context.candidate.id);
  }

  return onboarding;
}

export async function triggerSlackOnboardingAfterOfferSigned(input: {
  offer: OfferRecord;
  candidate: CandidateRecord;
  role: RoleRecord;
}) {
  let onboarding = await upsertOnboardingForOffer(input);

  if (onboarding.joined_at && onboarding.welcome_sent_at && onboarding.hr_notified_at) {
    return onboarding;
  }

  const lookup = await lookupSlackUserByEmail(input.candidate.email);

  if (lookup.status === "found" && lookup.value) {
    onboarding = await updateOnboarding(onboarding.id, {
      slack_user_id: lookup.value,
      joined_at: onboarding.joined_at ?? new Date().toISOString(),
      invite_status: "already_joined",
      invite_error: null,
      onboarding_status: "joined"
    });
    await writeAuditLog(input.candidate.id, "slack_onboarding_joined", "Candidate was found in Slack by email.");
    return sendWelcomeAndHrMessages({ ...input, onboarding }, lookup.value);
  }

  return attemptInviteOrEmailFallback({ ...input, onboarding });
}

export async function checkSlackJoinForCandidate(candidateId: string) {
  const context = await getOnboardingContextByCandidate(candidateId);

  if (!context) {
    throw new Error("Slack onboarding has not been started for this candidate.");
  }

  if (context.onboarding.joined_at && context.onboarding.slack_user_id) {
    return sendWelcomeAndHrMessages(context, context.onboarding.slack_user_id);
  }

  const lookup = await lookupSlackUserByEmail(context.candidate.email);

  if (lookup.status !== "found" || !lookup.value) {
    // Admin retry should re-evaluate current configuration and Slack state so
    // a previously skipped invite can recover after credentials or invite-link
    // settings are added.
    return attemptInviteOrEmailFallback(context);
  }

  const onboarding = await updateOnboarding(context.onboarding.id, {
    slack_user_id: lookup.value,
    joined_at: new Date().toISOString(),
    invite_status: "already_joined",
    invite_error: null,
    onboarding_status: "joined"
  });

  await writeAuditLog(context.candidate.id, "slack_onboarding_joined", "Candidate Slack join was detected by email lookup.");
  return sendWelcomeAndHrMessages({ ...context, onboarding }, lookup.value);
}

export async function handleSlackTeamJoinEvent(input: {
  email: string;
  slackUserId: string;
}) {
  const context = await getOnboardingContextByEmail(input.email);

  if (!context) {
    return null;
  }

  if (
    context.onboarding.joined_at &&
    context.onboarding.welcome_sent_at &&
    context.onboarding.hr_notified_at
  ) {
    return context.onboarding;
  }

  const onboarding = await updateOnboarding(context.onboarding.id, {
    slack_user_id: input.slackUserId,
    joined_at: context.onboarding.joined_at ?? new Date().toISOString(),
    invite_status: "already_joined",
    invite_error: null,
    onboarding_status: "joined"
  });

  await writeAuditLog(context.candidate.id, "slack_onboarding_joined", "Candidate Slack join was detected from a Slack event.");
  return sendWelcomeAndHrMessages({ ...context, onboarding }, input.slackUserId);
}
