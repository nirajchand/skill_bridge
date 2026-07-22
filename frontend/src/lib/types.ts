export type Role = 'client' | 'freelancer' | 'admin';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export type TaskCategory = 'writing' | 'design' | 'development' | 'marketing' | 'data' | 'other';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'disputed' | 'cancelled';

export interface Task {
  id: string;
  client_id: string;
  client_name?: string;
  title: string;
  description: string;
  category: TaskCategory;
  price: string;
  status: TaskStatus;
  deadline: string | null;
  skills_required: string | null;
  applicant_count?: number;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Application {
  id: string;
  task_id: string;
  freelancer_id: string;
  freelancer_name?: string;
  cover_letter: string | null;
  proposed_price: string | null;
  status: ApplicationStatus;
  created_at: string;
  // present on freelancer's "my applications" view
  task_title?: string;
  task_price?: string;
  task_status?: TaskStatus;
  client_name?: string;
}

export type ContractStatus =
  | 'pending'
  | 'funded'
  | 'in_progress'
  | 'submitted'
  | 'completed'
  | 'disputed'
  | 'cancelled';
export type EscrowStatus = 'not_funded' | 'funded' | 'released' | 'refunded';

export interface WorkSubmission {
  id: string;
  contract_id: string;
  description: string | null;
  files_url: string | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'requested_revision';
  submitted_at: string;
}

export interface Contract {
  id: string;
  task_id: string;
  task_title?: string;
  client_id: string;
  client_name?: string;
  freelancer_id: string;
  freelancer_name?: string;
  agreed_price: string;
  status: ContractStatus;
  escrow_status: EscrowStatus;
  revision_notes: string | null;
  created_at: string;
  submissions?: WorkSubmission[];
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface Profile {
  id: string;
  email?: string;
  role: Role;
  display_name: string;
  profile_image_url: string | null;
  bio: string | null;
  location: string | null;
  skills: string[];
  hourly_rate: string | null;
  portfolio_url: string | null;
  cv_url: string | null;
  company_name: string | null;
  company_website: string | null;
  is_verified: boolean;
  completed_contracts?: number;
  // private-only
  profile_completion_percentage?: number;
  profile_completed?: boolean;
  checklist?: ChecklistItem[];
}

export interface UserSearchResult {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  role: Role;
  skills: string[];
}

export type DisputeStatus = 'open' | 'in_progress' | 'resolved' | 'escalated';

export interface Dispute {
  id: string;
  contract_id: string;
  task_title?: string;
  raised_by: string;
  reason: string;
  description: string | null;
  status: DisputeStatus;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  client_id?: string;
  freelancer_id?: string;
}
