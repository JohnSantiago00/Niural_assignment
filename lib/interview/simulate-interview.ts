/**
 * Phase 04 transcript generator for the admin-only simulated completion path.
 * It intentionally does not pretend a real meeting happened; it creates a
 * grounded transcript-shaped artifact that can later be replaced by a provider.
 */
import type {
  CandidateRecord,
  ResearchProfileRecord,
  RoleRecord,
  ScreeningResultRecord
} from "@/types/database";

export function buildSimulatedInterviewTranscript(input: {
  candidate: CandidateRecord;
  role: RoleRecord;
  screeningResult: ScreeningResultRecord | null;
  researchProfile: ResearchProfileRecord | null;
}) {
  const { candidate, role, screeningResult, researchProfile } = input;
  const requirements = role.requirements.slice(0, 4).join("; ");
  const screeningStrengths =
    screeningResult?.strengths.slice(0, 3).join("; ") ?? "screening has not been run yet";
  const screeningGaps =
    screeningResult?.gaps.slice(0, 3).join("; ") ?? "no screening gaps are available";
  const candidateBrief =
    researchProfile?.candidate_brief ??
    "No enrichment brief is available, so the simulated discussion focuses on resume and role fit.";

  return [
    `[Transcript source: simulated interview completion, not a live meeting recording.]`,
    `Interviewer: Thanks for speaking with us, ${candidate.full_name}. Today we are discussing the ${role.title} role on the ${role.team} team.`,
    `${candidate.full_name}: Thanks for having me. I am excited to talk about how my background maps to this role.`,
    `Interviewer: The role emphasizes these requirements: ${requirements || "the published role requirements"}. Can you walk me through the most relevant parts of your experience?`,
    `${candidate.full_name}: I would focus on the experience that connects most directly to the role expectations and the problems this team is trying to solve.`,
    `Interviewer: Our screening review highlighted these potential strengths: ${screeningStrengths}. Which of those feel most representative of your work?`,
    `${candidate.full_name}: The strongest overlap is in the areas where I have had to combine execution, communication, and judgment. I can share concrete examples of how I approached those situations.`,
    `Interviewer: We also noted these possible gaps or follow-up areas: ${screeningGaps}. How would you address those?`,
    `${candidate.full_name}: I would want to clarify the expectations and show where adjacent experience applies. If there is a gap, I would ramp by pairing with the team and setting clear milestones.`,
    `Interviewer: Here is the current profile context from enrichment: ${candidateBrief}`,
    `${candidate.full_name}: That context is broadly aligned with how I would describe my background, and I would be happy to expand on any area that needs more evidence.`,
    `Interviewer: Final question: what would you want the hiring team to know after this conversation?`,
    `${candidate.full_name}: I am interested in the role because it blends practical execution with structured thinking, and I would want the team to evaluate me on both role fit and ability to learn quickly.`,
    `Interviewer: Thanks. We will capture notes and follow up with next steps.`
  ].join("\n\n");
}
