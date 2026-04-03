export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
