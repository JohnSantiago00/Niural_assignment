import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

function loadEnvFile(fileName) {
  const filePath = resolve(root, fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resumeBucket = process.env.SUPABASE_RESUME_BUCKET || "candidate-resumes";
const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill the minimal Supabase values first."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const now = new Date();
const iso = (offsetDays, hour = 14) => {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};
const dateOnly = (offsetDays) => iso(offsetDays).slice(0, 10);

const ids = {
  applications: [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
    "10000000-0000-4000-8000-000000000003",
    "10000000-0000-4000-8000-000000000004",
    "10000000-0000-4000-8000-000000000005"
  ],
  candidates: [
    "20000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002",
    "20000000-0000-4000-8000-000000000003",
    "20000000-0000-4000-8000-000000000004",
    "20000000-0000-4000-8000-000000000005"
  ],
  interviews: [
    "30000000-0000-4000-8000-000000000003",
    "30000000-0000-4000-8000-000000000004",
    "30000000-0000-4000-8000-000000000005"
  ],
  offers: [
    "40000000-0000-4000-8000-000000000004",
    "40000000-0000-4000-8000-000000000005"
  ]
};

async function failOnError(label, response) {
  if (response.error) {
    throw new Error(`${label}: ${response.error.message}`);
  }

  return response.data;
}

async function upsertRows(table, rows, options = { onConflict: "id" }) {
  if (rows.length === 0) {
    return [];
  }

  return failOnError(
    `Failed to upsert ${table}`,
    await supabase.from(table).upsert(rows, options).select("*")
  );
}

async function deleteByIds(table, idsToDelete) {
  if (idsToDelete.length === 0) {
    return;
  }

  await failOnError(
    `Failed to clear ${table}`,
    await supabase.from(table).delete().in("id", idsToDelete)
  );
}

async function ensureResumeBucket() {
  const existing = await supabase.storage.getBucket(resumeBucket);

  if (!existing.error) {
    return;
  }

  await supabase.storage.createBucket(resumeBucket, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
  });
}

async function ensureRole(role) {
  const existing = await failOnError(
    `Failed to load role ${role.title}`,
    await supabase.from("roles").select("*").eq("title", role.title).maybeSingle()
  );

  if (existing) {
    const updated = await failOnError(
      `Failed to update role ${role.title}`,
      await supabase.from("roles").update(role).eq("id", existing.id).select("*").single()
    );
    return updated;
  }

  return failOnError(
    `Failed to create role ${role.title}`,
    await supabase.from("roles").insert(role).select("*").single()
  );
}

function resumePath(roleId, email, fileName) {
  return `${roleId}/${email}/${Date.now()}-${fileName}`;
}

function audit(candidateId, actionType, actionDetail, actor = "system") {
  return {
    candidate_id: candidateId,
    action_type: actionType,
    action_detail: actionDetail,
    actor
  };
}

async function main() {
  await ensureResumeBucket();

  await deleteByIds("slack_onboarding", ["50000000-0000-4000-8000-000000000005"]);
  await deleteByIds("offers", ids.offers);
  await deleteByIds("interview_feedback", ["60000000-0000-4000-8000-000000000004"]);
  await deleteByIds("interview_transcripts", [
    "70000000-0000-4000-8000-000000000004",
    "70000000-0000-4000-8000-000000000005"
  ]);
  await deleteByIds("calendar_holds", [
    "80000000-0000-4000-8000-000000000031",
    "80000000-0000-4000-8000-000000000032",
    "80000000-0000-4000-8000-000000000041",
    "80000000-0000-4000-8000-000000000051"
  ]);
  await deleteByIds("interviews", ids.interviews);
  await deleteByIds("research_profiles", [
    "90000000-0000-4000-8000-000000000002",
    "90000000-0000-4000-8000-000000000004"
  ]);
  await deleteByIds("screening_results", [
    "91000000-0000-4000-8000-000000000002",
    "91000000-0000-4000-8000-000000000003",
    "91000000-0000-4000-8000-000000000004",
    "91000000-0000-4000-8000-000000000005"
  ]);
  await failOnError(
    "Failed to clear demo audit logs",
    await supabase.from("audit_logs").delete().in("candidate_id", ids.candidates)
  );
  await deleteByIds("candidates", ids.candidates);
  await deleteByIds("applications", ids.applications);

  const roles = {
    aiOperator: await ensureRole({
      title: "AI Product Operator",
      team: "Operations",
      location: "New York, NY",
      remote_status: "Hybrid",
      experience_level: "Mid-Level",
      responsibilities: [
        "Own daily orchestration across internal hiring workflows and identify points where automation should replace manual work.",
        "Translate process ambiguity into deterministic operating playbooks that engineering and recruiting can trust.",
        "Measure funnel health, triage operational issues quickly, and keep stakeholders informed with concise updates."
      ],
      requirements: [
        "3+ years in product operations, recruiting operations, or a similar systems-heavy role.",
        "Strong written communication and comfort working directly with engineers on workflow design.",
        "Evidence of building scalable processes with a bias for practical execution."
      ],
      status: "open"
    }),
    engineer: await ensureRole({
      title: "Founding Full-Stack Engineer",
      team: "Engineering",
      location: "San Francisco, CA",
      remote_status: "Remote",
      experience_level: "Senior",
      responsibilities: [
        "Ship end-to-end features across frontend, backend, and data layers with a high degree of autonomy.",
        "Design simple, production-ready systems that can evolve without unnecessary platform complexity.",
        "Partner closely with product and operations to improve speed, observability, and reliability."
      ],
      requirements: [
        "5+ years building web applications in TypeScript and modern React frameworks.",
        "Experience with PostgreSQL-backed products and pragmatic API design.",
        "Comfort making architecture tradeoffs in ambiguous startup environments."
      ],
      status: "open"
    }),
    recruiter: await ensureRole({
      title: "Technical Recruiter",
      team: "Talent",
      location: "Austin, TX",
      remote_status: "Onsite",
      experience_level: "Mid-Level",
      responsibilities: [
        "Run full-cycle recruiting for technical roles while maintaining a high-quality candidate experience.",
        "Collaborate with hiring managers to improve role calibration, outreach quality, and feedback speed.",
        "Use structured processes and lightweight automation to keep pipelines organized and responsive."
      ],
      requirements: [
        "2+ years recruiting technical talent in-house or at a recruiting agency.",
        "Strong candidate communication and stakeholder management skills.",
        "A systems mindset with interest in improving recruiting operations through better tooling."
      ],
      status: "open"
    }),
    closed: await ensureRole({
      title: "People Operations Analyst",
      team: "People",
      location: "Remote",
      remote_status: "Remote",
      experience_level: "Entry-Level",
      responsibilities: [
        "Support reporting and people operations process documentation.",
        "Maintain clean onboarding and hiring workflow data.",
        "Partner with operations teammates on lightweight process improvements."
      ],
      requirements: [
        "Interest in people operations and structured process design.",
        "Strong attention to detail and comfort working with spreadsheets or internal tools.",
        "Clear written communication."
      ],
      status: "closed"
    })
  };

  const applicants = [
    {
      applicationId: ids.applications[0],
      candidateId: ids.candidates[0],
      role: roles.aiOperator,
      name: "Maya Chen",
      email: "maya.demo@example.com",
      status: "applied",
      score: null,
      submittedAt: iso(-8, 16)
    },
    {
      applicationId: ids.applications[1],
      candidateId: ids.candidates[1],
      role: roles.engineer,
      name: "Jordan Lee",
      email: "jordan.demo@example.com",
      status: "shortlisted",
      score: 88,
      submittedAt: iso(-7, 15)
    },
    {
      applicationId: ids.applications[2],
      candidateId: ids.candidates[2],
      role: roles.recruiter,
      name: "Priya Shah",
      email: "priya.demo@example.com",
      status: "interview_scheduled",
      score: 82,
      submittedAt: iso(-6, 14)
    },
    {
      applicationId: ids.applications[3],
      candidateId: ids.candidates[3],
      role: roles.aiOperator,
      name: "Ted Mosby",
      email: "ted.demo@example.com",
      status: "offer_sent",
      score: 91,
      submittedAt: iso(-5, 13)
    },
    {
      applicationId: ids.applications[4],
      candidateId: ids.candidates[4],
      role: roles.engineer,
      name: "Robin Santos",
      email: "robin.demo@example.com",
      status: "offer_signed",
      score: 94,
      submittedAt: iso(-4, 12)
    }
  ];

  await upsertRows(
    "applications",
    applicants.map((applicant) => ({
      id: applicant.applicationId,
      role_id: applicant.role.id,
      full_name: applicant.name,
      email: applicant.email,
      linkedin_url: `https://linkedin.com/in/${applicant.name.toLowerCase().replaceAll(" ", "-")}`,
      portfolio_url: `https://${applicant.name.toLowerCase().replaceAll(" ", "")}.example.com`,
      github_url: `https://github.com/${applicant.name.toLowerCase().replaceAll(" ", "")}`,
      resume_file_path: resumePath(applicant.role.id, applicant.email, "resume.pdf"),
      submission_status: "submitted",
      submitted_at: applicant.submittedAt
    }))
  );

  await upsertRows(
    "candidates",
    applicants.map((applicant) => ({
      id: applicant.candidateId,
      application_id: applicant.applicationId,
      role_id: applicant.role.id,
      full_name: applicant.name,
      email: applicant.email,
      linkedin_url: `https://linkedin.com/in/${applicant.name.toLowerCase().replaceAll(" ", "-")}`,
      portfolio_url: `https://${applicant.name.toLowerCase().replaceAll(" ", "")}.example.com`,
      github_url: `https://github.com/${applicant.name.toLowerCase().replaceAll(" ", "")}`,
      current_status: applicant.status,
      ai_score: applicant.score,
      shortlist_threshold: 75,
      admin_override: applicant.status !== "applied",
      admin_override_note:
        applicant.status === "applied" ? null : "Seeded candidate status note."
    }))
  );

  await upsertRows("screening_results", [
    {
      id: "91000000-0000-4000-8000-000000000002",
      candidate_id: ids.candidates[1],
      parsed_resume_text: "Senior full-stack engineer with TypeScript, React, PostgreSQL, and early-stage product experience.",
      extracted_skills: ["TypeScript", "React", "PostgreSQL", "System design"],
      years_experience: 7,
      education: [{ institution: "Demo University", degree: "BS", field: "Computer Science", year: 2016 }],
      past_employers: [{ company: "Orbit Labs", title: "Senior Engineer", duration: "2020-2025" }],
      key_achievements: ["Built a hiring workflow dashboard", "Led migration to PostgreSQL-backed services"],
      strengths: ["Strong product engineering ownership", "Comfortable with ambiguous systems work"],
      gaps: ["Would need to ramp on Niural-specific compliance context"],
      fit_score: 88,
      rationale: "Jordan shows strong alignment with the founding engineering role and the product/system ownership required.",
      shortlist_recommendation: true,
      model_name: "deterministic-seed",
      input_fingerprint: "demo-screening-jordan-v1",
      prompt_version: "demo-v1",
      generated_at: iso(-6, 16)
    },
    {
      id: "91000000-0000-4000-8000-000000000003",
      candidate_id: ids.candidates[2],
      parsed_resume_text: "Technical recruiter with full-cycle hiring experience, structured candidate communication, and process improvement work.",
      extracted_skills: ["Technical recruiting", "Candidate communication", "Hiring manager calibration"],
      years_experience: 4,
      education: [{ institution: "State College", degree: "BA", field: "Communications", year: 2019 }],
      past_employers: [{ company: "TalentLoop", title: "Technical Recruiter", duration: "2021-2025" }],
      key_achievements: ["Improved interview scheduling SLA", "Built structured feedback templates"],
      strengths: ["Clear communication", "Strong recruiting operations instincts"],
      gaps: ["Less direct exposure to AI tooling"],
      fit_score: 82,
      rationale: "Priya is a strong recruiter profile with relevant technical hiring experience.",
      shortlist_recommendation: true,
      model_name: "deterministic-seed",
      input_fingerprint: "demo-screening-priya-v1",
      prompt_version: "demo-v1",
      generated_at: iso(-5, 16)
    },
    {
      id: "91000000-0000-4000-8000-000000000004",
      candidate_id: ids.candidates[3],
      parsed_resume_text: "AI product operations candidate with strong process design, stakeholder communication, and workflow execution experience.",
      extracted_skills: ["Product operations", "Workflow design", "Stakeholder communication"],
      years_experience: 5,
      education: [{ institution: "Columbia University", degree: "MA", field: "Architecture", year: 2017 }],
      past_employers: [{ company: "ArcOps", title: "Product Operations Lead", duration: "2020-2025" }],
      key_achievements: ["Reduced manual triage time", "Designed recruiting workflow scorecards"],
      strengths: ["Strong operator mindset", "Clear written communication"],
      gaps: ["Needs structured technical onboarding"],
      fit_score: 91,
      rationale: "Ted fits the AI Product Operator profile and demonstrated strong workflow judgment.",
      shortlist_recommendation: true,
      model_name: "deterministic-seed",
      input_fingerprint: "demo-screening-ted-v1",
      prompt_version: "demo-v1",
      generated_at: iso(-4, 16)
    },
    {
      id: "91000000-0000-4000-8000-000000000005",
      candidate_id: ids.candidates[4],
      parsed_resume_text: "Founding engineer candidate with full-stack delivery, infrastructure pragmatism, and team leadership experience.",
      extracted_skills: ["Next.js", "Supabase", "Postgres", "Technical leadership"],
      years_experience: 8,
      education: [{ institution: "Demo Institute", degree: "BS", field: "Software Engineering", year: 2015 }],
      past_employers: [{ company: "BuildWell", title: "Staff Engineer", duration: "2019-2025" }],
      key_achievements: ["Shipped full hiring workflow", "Mentored early engineering team"],
      strengths: ["High autonomy", "Excellent full-stack execution"],
      gaps: ["May prefer broad product ownership over narrow platform work"],
      fit_score: 94,
      rationale: "Robin is a strong founding engineer candidate with relevant product and technical depth.",
      shortlist_recommendation: true,
      model_name: "deterministic-seed",
      input_fingerprint: "demo-screening-robin-v1",
      prompt_version: "demo-v1",
      generated_at: iso(-3, 16)
    }
  ]);

  await upsertRows("research_profiles", [
    {
      id: "90000000-0000-4000-8000-000000000002",
      candidate_id: ids.candidates[1],
      linkedin_url_used: "https://linkedin.com/in/jordan-lee",
      github_url_used: "https://github.com/jordanlee",
      portfolio_url_used: "https://jordanlee.example.com",
      x_url_used: null,
      linkedin_summary: "Profile supports senior full-stack engineering experience.",
      github_summary: "Public projects show TypeScript and Postgres-heavy product work.",
      portfolio_summary: "Portfolio highlights pragmatic system design and product shipping.",
      x_summary: null,
      discrepancy_flags: [],
      confidence_score: 82,
      linkedin_source_status: "fetched_direct",
      linkedin_source_note: "Seeded profile summary for demo review.",
      candidate_brief: "Jordan looks like a strong founding engineering candidate with relevant full-stack product experience.",
      model_name: "deterministic-seed"
    },
    {
      id: "90000000-0000-4000-8000-000000000004",
      candidate_id: ids.candidates[3],
      linkedin_url_used: "https://linkedin.com/in/ted-mosby",
      github_url_used: "https://github.com/tedmosby",
      portfolio_url_used: "https://tedmosby.example.com",
      x_url_used: null,
      linkedin_summary: "Profile supports product operations and structured workflow experience.",
      github_summary: "No engineering portfolio required for this operator role.",
      portfolio_summary: "Portfolio describes workflow playbooks and hiring process improvements.",
      x_summary: null,
      discrepancy_flags: [
        {
          type: "missing_supporting_evidence",
          severity: "low",
          description: "Some AI tooling claims should be explored in interview follow-up.",
          source: "portfolio"
        }
      ],
      confidence_score: 78,
      linkedin_source_status: "fetched_direct",
      linkedin_source_note: "Seeded profile summary for demo review.",
      candidate_brief: "Ted has strong product operations signal and is far enough along for offer review.",
      model_name: "deterministic-seed"
    }
  ]);

  await upsertRows("interviews", [
    {
      id: ids.interviews[0],
      candidate_id: ids.candidates[2],
      interviewer_name: "Avery Nguyen",
      interviewer_email: "avery@example.com",
      scheduled_start: iso(3, 15),
      scheduled_end: iso(3, 16),
      meeting_link: "https://meet.example.com/demo-priya",
      calendar_event_id: "demo-calendar-priya",
      calendar_warning: null,
      interview_status: "scheduled",
      scheduling_note: null,
      reschedule_preferences: null
    },
    {
      id: ids.interviews[1],
      candidate_id: ids.candidates[3],
      interviewer_name: "Sam Rivera",
      interviewer_email: "sam@example.com",
      scheduled_start: iso(-2, 15),
      scheduled_end: iso(-2, 16),
      meeting_link: "https://meet.example.com/demo-ted",
      calendar_event_id: "demo-calendar-ted",
      calendar_warning: null,
      interview_status: "completed",
      scheduling_note: null,
      reschedule_preferences: null
    },
    {
      id: ids.interviews[2],
      candidate_id: ids.candidates[4],
      interviewer_name: "Morgan Lee",
      interviewer_email: "morgan@example.com",
      scheduled_start: iso(-3, 15),
      scheduled_end: iso(-3, 16),
      meeting_link: "https://meet.example.com/demo-robin",
      calendar_event_id: "demo-calendar-robin",
      calendar_warning: null,
      interview_status: "completed",
      scheduling_note: null,
      reschedule_preferences: null
    }
  ]);

  await upsertRows("calendar_holds", [
    {
      id: "80000000-0000-4000-8000-000000000031",
      candidate_id: ids.candidates[2],
      interview_id: ids.interviews[0],
      interviewer_name: "Avery Nguyen",
      interviewer_email: "avery@example.com",
      slot_start: iso(3, 15),
      slot_end: iso(3, 16),
      hold_status: "confirmed",
      expires_at: iso(2, 20),
      selection_token: "demo-priya-selection-token"
    },
    {
      id: "80000000-0000-4000-8000-000000000032",
      candidate_id: ids.candidates[2],
      interview_id: ids.interviews[0],
      interviewer_name: "Avery Nguyen",
      interviewer_email: "avery@example.com",
      slot_start: iso(4, 17),
      slot_end: iso(4, 18),
      hold_status: "released",
      expires_at: iso(2, 20),
      selection_token: "demo-priya-selection-token"
    },
    {
      id: "80000000-0000-4000-8000-000000000041",
      candidate_id: ids.candidates[3],
      interview_id: ids.interviews[1],
      interviewer_name: "Sam Rivera",
      interviewer_email: "sam@example.com",
      slot_start: iso(-2, 15),
      slot_end: iso(-2, 16),
      hold_status: "confirmed",
      expires_at: iso(-3, 20),
      selection_token: "demo-ted-selection-token"
    },
    {
      id: "80000000-0000-4000-8000-000000000051",
      candidate_id: ids.candidates[4],
      interview_id: ids.interviews[2],
      interviewer_name: "Morgan Lee",
      interviewer_email: "morgan@example.com",
      slot_start: iso(-3, 15),
      slot_end: iso(-3, 16),
      hold_status: "confirmed",
      expires_at: iso(-4, 20),
      selection_token: "demo-robin-selection-token"
    }
  ]);

  await upsertRows("interview_transcripts", [
    {
      id: "70000000-0000-4000-8000-000000000004",
      candidate_id: ids.candidates[3],
      interview_id: ids.interviews[1],
      transcript_text: "Interviewer: Tell me about a workflow you improved.\nCandidate: I mapped the process, removed duplicate handoffs, and created a weekly signal review.",
      transcript_source: "simulated",
      overall_assessment: "Strong operator profile with clear workflow judgment and communication.",
      strengths_observed: ["Structured thinking", "Strong written communication", "Bias toward practical execution"],
      concerns_observed: ["Would benefit from deeper AI product tooling exposure"],
      key_topics_discussed: ["Hiring workflow triage", "Operational metrics", "Stakeholder updates"],
      recommended_follow_up: ["Clarify first 30-day goals", "Pair with engineering on system constraints"],
      concise_summary: "Ted showed strong product operations judgment and is recommended for offer review.",
      model_name: "deterministic-seed",
      input_fingerprint: "demo-interview-ted-v1",
      prompt_version: "demo-v1",
      generated_at: iso(-2, 17),
      completed_at: iso(-2, 17)
    },
    {
      id: "70000000-0000-4000-8000-000000000005",
      candidate_id: ids.candidates[4],
      interview_id: ids.interviews[2],
      transcript_text: "Interviewer: How do you approach early architecture?\nCandidate: I start simple, define the data boundaries, and avoid platform work until product signals justify it.",
      transcript_source: "simulated",
      overall_assessment: "Excellent founding engineer signal with pragmatic technical judgment.",
      strengths_observed: ["High autonomy", "Strong architecture tradeoffs", "Product-minded communication"],
      concerns_observed: ["Needs clear ownership boundaries in a small team"],
      key_topics_discussed: ["Next.js architecture", "Postgres workflow state", "Product velocity"],
      recommended_follow_up: ["Align on first milestone", "Define ownership for integration reliability"],
      concise_summary: "Robin is a strong founding engineering hire and has already signed the offer in this demo state.",
      model_name: "deterministic-seed",
      input_fingerprint: "demo-interview-robin-v1",
      prompt_version: "demo-v1",
      generated_at: iso(-3, 17),
      completed_at: iso(-3, 17)
    }
  ]);

  await upsertRows("interview_feedback", [
    {
      id: "60000000-0000-4000-8000-000000000004",
      candidate_id: ids.candidates[3],
      interview_id: ids.interviews[1],
      rating: 4,
      comments: "Strong operator signal. Recommend moving to offer with clear onboarding milestones.",
      actor: "admin",
      submitted_at: iso(-2, 18)
    }
  ]);

  await upsertRows("offers", [
    {
      id: ids.offers[0],
      candidate_id: ids.candidates[3],
      application_id: ids.applications[3],
      offer_status: "sent",
      confirmed_job_title: "AI Product Operator",
      start_date: dateOnly(21),
      base_salary: "$135,000",
      compensation_structure: "Full-time",
      equity_or_bonus: "Eligible for annual performance bonus",
      reporting_manager: "Sam Rivera",
      custom_terms: "Standard company benefits apply.",
      generated_letter: "Dear Ted,\n\nWe are pleased to offer you the position of AI Product Operator. Your experience improving structured workflows and communicating clearly across teams stood out throughout the interview process.\n\nYour start date is listed in this offer and your role will report to Sam Rivera. We are excited about the operational judgment you would bring to the team.\n\nSincerely,\nNiural Hiring Team",
      generated_model_name: "deterministic-seed",
      input_fingerprint: "demo-offer-ted-v1",
      prompt_version: "demo-v1",
      generated_at: iso(-1, 16),
      signing_token: "demo-ted-offer-token",
      signing_token_expires_at: null,
      offer_email_status: "sent",
      offer_email_error: null,
      offer_email_recipient: "ted.demo@example.com",
      sent_at: iso(-1, 16),
      signed_at: null,
      signer_ip: null,
      signer_name: null,
      signature_image_data: null
    },
    {
      id: ids.offers[1],
      candidate_id: ids.candidates[4],
      application_id: ids.applications[4],
      offer_status: "signed",
      confirmed_job_title: "Founding Full-Stack Engineer",
      start_date: dateOnly(14),
      base_salary: "$175,000",
      compensation_structure: "Full-time",
      equity_or_bonus: "Equity grant to be finalized in the employment packet",
      reporting_manager: "Morgan Lee",
      custom_terms: "Standard company benefits apply.",
      generated_letter: "Dear Robin,\n\nWe are pleased to offer you the position of Founding Full-Stack Engineer. Your full-stack judgment, product orientation, and pragmatic approach to early architecture stood out throughout the process.\n\nYour start date is listed in this offer and your role will report to Morgan Lee. We are excited to have you join the team.\n\nSincerely,\nNiural Hiring Team",
      generated_model_name: "deterministic-seed",
      input_fingerprint: "demo-offer-robin-v1",
      prompt_version: "demo-v1",
      generated_at: iso(-2, 16),
      signing_token: "demo-robin-offer-token",
      signing_token_expires_at: null,
      offer_email_status: "sent",
      offer_email_error: null,
      offer_email_recipient: "robin.demo@example.com",
      sent_at: iso(-2, 16),
      signed_at: iso(-1, 18),
      signer_ip: "127.0.0.1",
      signer_name: "Robin Santos",
      signature_image_data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l8cM9QAAAABJRU5ErkJggg=="
    }
  ]);

  await upsertRows("slack_onboarding", [
    {
      id: "50000000-0000-4000-8000-000000000005",
      candidate_id: ids.candidates[4],
      offer_id: ids.offers[1],
      onboarding_status: "completed",
      slack_invite_email: "robin.demo@example.com",
      slack_user_id: "UDEMO12345",
      invite_attempted_at: iso(-1, 18),
      invite_status: "already_joined",
      invite_error: null,
      joined_at: iso(-1, 19),
      welcome_sent_at: iso(-1, 19),
      welcome_status: "sent",
      welcome_error: null,
      hr_notified_at: iso(-1, 19),
      hr_notification_status: "sent",
      hr_notification_error: null
    }
  ]);

  await upsertRows("audit_logs", [
    audit(ids.candidates[0], "application_created", "Demo application submitted for AI Product Operator.", "candidate"),
    audit(ids.candidates[1], "application_created", "Demo application submitted for Founding Full-Stack Engineer.", "candidate"),
    audit(ids.candidates[1], "screening_completed", "Screening completed and candidate shortlisted.", "admin"),
    audit(ids.candidates[2], "interview_slot_confirmed", "Interview slot confirmed for demo candidate.", "candidate"),
    audit(ids.candidates[3], "interview_completed", "Interview summary completed for demo candidate.", "admin"),
    audit(ids.candidates[3], "offer_sent", "Offer sent to demo candidate.", "admin"),
    audit(ids.candidates[4], "offer_signed", "Offer signed by demo candidate.", "candidate"),
    audit(ids.candidates[4], "slack_onboarding_completed", "Slack onboarding completed for demo candidate.", "system")
  ]);

  if (demoAdminEmail) {
    await failOnError(
      "Failed to seed admin allowlist",
      await supabase
        .from("admin_users")
        .upsert({ email: demoAdminEmail.toLowerCase() }, { onConflict: "email" })
    );
  }

  console.log("Demo seed complete.");
  console.log("Open /admin and start with Ted Mosby or Robin Santos for later-stage seeded data.");
  if (!demoAdminEmail) {
    console.log("Optional: set DEMO_ADMIN_EMAIL in .env.local to add an admin email to public.admin_users.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
