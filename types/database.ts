export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
export type EducationEntry = {
  institution: string;
  degree: string | null;
  field: string | null;
  year: number | null;
};
export type PastEmployerEntry = {
  company: string;
  title: string | null;
  duration: string | null;
};
export type InterviewStatus =
  | "pending"
  | "options_sent"
  | "scheduled"
  | "reschedule_requested"
  | "completed"
  | "cancelled";
export type HoldStatus = "held" | "confirmed" | "released" | "expired";
export type ReschedulePreferences = {
  preferred_time_of_day: "morning" | "afternoon" | "evening" | null;
  preferred_days: string[];
  avoid_days: string[];
  avoid_time_ranges: string[];
  earliest_date: string | null;
  notes_summary: string;
};
export type InterviewRecord = {
  id: string;
  candidate_id: string;
  interviewer_name: string | null;
  interviewer_email: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  meeting_link: string | null;
  calendar_event_id: string | null;
  calendar_warning: string | null;
  interview_status: InterviewStatus;
  scheduling_note: string | null;
  reschedule_preferences: ReschedulePreferences | null;
  created_at: string;
  updated_at: string;
};
export type CalendarHoldRecord = {
  id: string;
  candidate_id: string;
  interview_id: string;
  interviewer_name: string;
  interviewer_email: string;
  slot_start: string;
  slot_end: string;
  hold_status: HoldStatus;
  expires_at: string;
  selection_token: string;
  created_at: string;
};
export type TranscriptSource =
  | "simulated"
  | "fireflies_mock"
  | "fireflies_real_ready";
export type InterviewTranscriptRecord = {
  id: string;
  candidate_id: string;
  interview_id: string;
  transcript_text: string;
  transcript_source: TranscriptSource;
  overall_assessment: string;
  strengths_observed: string[];
  concerns_observed: string[];
  key_topics_discussed: string[];
  recommended_follow_up: string[];
  concise_summary: string;
  model_name: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
};
export type InterviewFeedbackRecord = {
  id: string;
  candidate_id: string;
  interview_id: string;
  rating: number;
  comments: string;
  actor: string;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};
export type ResearchProfileRecord = {
  id: string;
  candidate_id: string;
  linkedin_url_used: string | null;
  linkedin_source_status:
    | "missing"
    | "fetched_direct"
    | "blocked"
    | "unavailable";
  linkedin_source_note: string | null;
  github_url_used: string | null;
  portfolio_url_used: string | null;
  x_url_used: string | null;
  linkedin_summary: string | null;
  github_summary: string | null;
  portfolio_summary: string | null;
  x_summary: string | null;
  discrepancy_flags: {
    type:
      | "experience_mismatch"
      | "role_scope_mismatch"
      | "missing_supporting_evidence"
      | "timeline_inconsistency"
      | "project_claim_unverified";
    severity: "low" | "medium" | "high";
    description: string;
    source: string | null;
  }[];
  confidence_score: number;
  candidate_brief: string;
  model_name: string;
  created_at: string;
  updated_at: string;
};

export type RoleRecord = {
  id: string;
  title: string;
  team: string;
  location: string;
  remote_status: string;
  experience_level: string;
  responsibilities: string[];
  requirements: string[];
  status: string;
  created_at: string;
};

export type ApplicationRecord = {
  id: string;
  role_id: string;
  full_name: string;
  email: string;
  linkedin_url: string;
  portfolio_url: string | null;
  github_url: string | null;
  resume_file_path: string;
  submission_status: string;
  submitted_at: string;
};

export type CandidateRecord = {
  id: string;
  application_id: string;
  role_id: string;
  full_name: string;
  email: string;
  linkedin_url: string;
  portfolio_url: string | null;
  github_url: string | null;
  current_status: string;
  ai_score: number | null;
  shortlist_threshold: number;
  admin_override: boolean;
  admin_override_note: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRecord = {
  id: string;
  candidate_id: string;
  action_type: string;
  action_detail: string | null;
  actor: string;
  created_at: string;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  created_at: string;
};

export type ScreeningResultRecord = {
  id: string;
  candidate_id: string;
  parsed_resume_text: string;
  extracted_skills: string[];
  years_experience: number | null;
  education: EducationEntry[];
  past_employers: PastEmployerEntry[];
  key_achievements: string[];
  strengths: string[];
  gaps: string[];
  fit_score: number;
  rationale: string;
  shortlist_recommendation: boolean;
  model_name: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      roles: {
        Row: RoleRecord;
        Insert: {
          id?: string;
          title: string;
          team: string;
          location: string;
          remote_status: string;
          experience_level: string;
          responsibilities?: string[];
          requirements?: string[];
          status?: string;
          created_at?: string;
        };
        Update: Partial<RoleRecord>;
        Relationships: [];
      };
      applications: {
        Row: ApplicationRecord;
        Insert: {
          id?: string;
          role_id: string;
          full_name: string;
          email: string;
          linkedin_url: string;
          portfolio_url?: string | null;
          github_url?: string | null;
          resume_file_path: string;
          submission_status?: string;
          submitted_at?: string;
        };
        Update: Partial<ApplicationRecord>;
        Relationships: [];
      };
      candidates: {
        Row: CandidateRecord;
        Insert: {
          id?: string;
          application_id: string;
          role_id: string;
          full_name: string;
          email: string;
          linkedin_url: string;
          portfolio_url?: string | null;
          github_url?: string | null;
          current_status?: string;
          ai_score?: number | null;
          shortlist_threshold?: number;
          admin_override?: boolean;
          admin_override_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CandidateRecord>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRecord;
        Insert: {
          id?: string;
          candidate_id: string;
          action_type: string;
          action_detail?: string | null;
          actor: string;
          created_at?: string;
        };
        Update: Partial<AuditLogRecord>;
        Relationships: [];
      };
      admin_users: {
        Row: AdminUserRecord;
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
        };
        Update: Partial<AdminUserRecord>;
        Relationships: [];
      };
      interviews: {
        Row: InterviewRecord;
        Insert: {
          id?: string;
          candidate_id: string;
          interviewer_name?: string | null;
          interviewer_email?: string | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          meeting_link?: string | null;
          calendar_event_id?: string | null;
          calendar_warning?: string | null;
          interview_status?: InterviewStatus;
          scheduling_note?: string | null;
          reschedule_preferences?: ReschedulePreferences | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InterviewRecord>;
        Relationships: [];
      };
      calendar_holds: {
        Row: CalendarHoldRecord;
        Insert: {
          id?: string;
          candidate_id: string;
          interview_id: string;
          interviewer_name: string;
          interviewer_email: string;
          slot_start: string;
          slot_end: string;
          hold_status?: HoldStatus;
          expires_at: string;
          selection_token: string;
          created_at?: string;
        };
        Update: Partial<CalendarHoldRecord>;
        Relationships: [];
      };
      interview_transcripts: {
        Row: InterviewTranscriptRecord;
        Insert: {
          id?: string;
          candidate_id: string;
          interview_id: string;
          transcript_text: string;
          transcript_source?: TranscriptSource;
          overall_assessment: string;
          strengths_observed?: string[];
          concerns_observed?: string[];
          key_topics_discussed?: string[];
          recommended_follow_up?: string[];
          concise_summary: string;
          model_name: string;
          completed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InterviewTranscriptRecord>;
        Relationships: [];
      };
      interview_feedback: {
        Row: InterviewFeedbackRecord;
        Insert: {
          id?: string;
          candidate_id: string;
          interview_id: string;
          rating: number;
          comments: string;
          actor?: string;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InterviewFeedbackRecord>;
        Relationships: [];
      };
      screening_results: {
        Row: ScreeningResultRecord;
        Insert: {
          id?: string;
          candidate_id: string;
          parsed_resume_text: string;
          extracted_skills?: string[];
          years_experience?: number | null;
          education?: EducationEntry[];
          past_employers?: PastEmployerEntry[];
          key_achievements?: string[];
          strengths?: string[];
          gaps?: string[];
          fit_score: number;
          rationale: string;
          shortlist_recommendation: boolean;
          model_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ScreeningResultRecord>;
        Relationships: [];
      };
      research_profiles: {
        Row: ResearchProfileRecord;
        Insert: {
          id?: string;
          candidate_id: string;
          linkedin_url_used?: string | null;
          linkedin_source_status?: ResearchProfileRecord["linkedin_source_status"];
          linkedin_source_note?: string | null;
          github_url_used?: string | null;
          portfolio_url_used?: string | null;
          x_url_used?: string | null;
          linkedin_summary?: string | null;
          github_summary?: string | null;
          portfolio_summary?: string | null;
          x_summary?: string | null;
          discrepancy_flags?: ResearchProfileRecord["discrepancy_flags"];
          confidence_score: number;
          candidate_brief: string;
          model_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ResearchProfileRecord>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      expire_calendar_holds: {
        Args: Record<string, never>;
        Returns: number;
      };
      confirm_calendar_hold: {
        Args: {
          p_selection_token: string;
          p_hold_id: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
