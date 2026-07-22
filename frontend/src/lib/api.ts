import apiClient from '@/lib/api-client';
import type {
  Application,
  Contract,
  Dispute,
  Profile,
  Task,
  UserSearchResult,
  WorkSubmission
} from '@/lib/types';

// Unwrap the { success, data, error } envelope; throw the API's message on failure.
async function unwrap<T>(promise: Promise<{ data: { success: boolean; data: T; error: string | null } }>): Promise<T> {
  try {
    const res = await promise;
    if (!res.data.success) throw new Error(res.data.error || 'Request failed');
    return res.data.data;
  } catch (err) {
    if (err && typeof err === 'object' && 'response' in err) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      if (response?.data?.error) throw new Error(response.data.error);
    }
    throw err instanceof Error ? err : new Error('Request failed');
  }
}

export type TaskFilters = {
  category?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  search?: string;
  sort?: string;
};

export const tasksApi = {
  browse: (filters: TaskFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params.append(k, String(v));
    });
    const qs = params.toString();
    return unwrap<Task[]>(apiClient.get(`/tasks${qs ? `?${qs}` : ''}`));
  },
  mine: () => unwrap<Task[]>(apiClient.get('/tasks/mine')),
  stats: () => unwrap<Record<string, number>>(apiClient.get('/tasks/stats')),
  detail: (id: string) => unwrap<Task>(apiClient.get(`/tasks/${id}`)),
  create: (payload: {
    title: string;
    description: string;
    category: string;
    price: number;
    deadline?: string | null;
    skills_required?: string | null;
  }) => unwrap<Task>(apiClient.post('/tasks', payload)),
  update: (id: string, payload: Partial<Task>) => unwrap<Task>(apiClient.patch(`/tasks/${id}`, payload)),
  cancel: (id: string) => unwrap<{ id: string; cancelled: boolean }>(apiClient.delete(`/tasks/${id}`)),
  applications: (id: string) => unwrap<Application[]>(apiClient.get(`/tasks/${id}/applications`))
};

export const applicationsApi = {
  mine: () => unwrap<Application[]>(apiClient.get('/applications/mine')),
  apply: (payload: { task_id: string; cover_letter?: string; proposed_price?: number | null }) =>
    unwrap<Application>(apiClient.post('/applications', payload)),
  handle: (id: string, action: 'accept' | 'reject') =>
    unwrap<{ application: Application; contract?: Contract }>(apiClient.patch(`/applications/${id}`, { action })),
  withdraw: (id: string) => unwrap<Application>(apiClient.delete(`/applications/${id}`))
};

export const contractsApi = {
  list: () => unwrap<Contract[]>(apiClient.get('/contracts')),
  detail: (id: string) => unwrap<Contract>(apiClient.get(`/contracts/${id}`)),
  approve: (id: string) => unwrap<Contract>(apiClient.patch(`/contracts/${id}/approve-work`)),
  requestRevision: (id: string, revision_notes: string) =>
    unwrap<Contract>(apiClient.patch(`/contracts/${id}/request-revision`, { revision_notes })),
  submitWork: (id: string, payload: { description: string; files_url?: string }) =>
    unwrap<WorkSubmission>(apiClient.post(`/contracts/${id}/submissions`, payload))
};

export const disputesApi = {
  list: () => unwrap<Dispute[]>(apiClient.get('/disputes')),
  detail: (id: string) => unwrap<Dispute>(apiClient.get(`/disputes/${id}`)),
  raise: (payload: { contract_id: string; reason: string; description: string }) =>
    unwrap<Dispute>(apiClient.post('/disputes', payload))
};

export type ProfileUpdate = {
  display_name?: string;
  bio?: string;
  location?: string;
  skills?: string[];
  hourly_rate?: number | null;
  portfolio_url?: string;
  company_name?: string;
  company_website?: string;
};

export type Earnings = {
  total_earned: number;
  this_month: number;
  pending_payout: number;
  available_to_withdraw: number;
};

export type Payout = {
  id: string;
  amount: string;
  payout_status: 'pending' | 'processing' | 'paid' | 'failed';
  requested_at: string;
  completed_at: string | null;
};

export const paymentsApi = {
  createIntent: (contractId: string) =>
    unwrap<{ clientSecret: string; paymentIntentId: string; amount: string }>(
      apiClient.post(`/payments/contracts/${contractId}/intent`)
    ),
  confirm: (contractId: string, paymentIntentId: string) =>
    unwrap<Contract>(apiClient.post(`/payments/contracts/${contractId}/confirm`, { payment_intent_id: paymentIntentId })),
  earnings: () => unwrap<Earnings>(apiClient.get('/payments/earnings')),
  payouts: () => unwrap<Payout[]>(apiClient.get('/payments/payouts')),
  requestPayout: (amount?: number) => unwrap<Payout>(apiClient.post('/payments/payouts/request', amount ? { amount } : {}))
};

export type AdminDispute = {
  id: string;
  task_title: string;
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  resolution_type: string | null;
  agreed_price: string;
  client_email: string;
  freelancer_email: string;
  created_at: string;
};

export type AdminPayout = {
  id: string;
  freelancer_email: string;
  amount: string;
  payout_status: string;
  requested_at: string;
};

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_verified: boolean;
  mfa_enabled: boolean;
  created_at: string;
};

export const adminApi = {
  disputes: (status?: string) =>
    unwrap<AdminDispute[]>(apiClient.get(`/admin/disputes${status ? `?status=${status}` : ''}`)),
  resolveDispute: (id: string, payload: { resolution_type: string; split_freelancer_percentage?: number; admin_notes: string }) =>
    unwrap<{ dispute: AdminDispute; freelancer_amount: number; refund_amount: number }>(
      apiClient.post(`/admin/disputes/${id}/resolve`, payload)
    ),
  payouts: (status?: string) =>
    unwrap<AdminPayout[]>(apiClient.get(`/admin/payouts${status ? `?status=${status}` : ''}`)),
  processPayout: (id: string) => unwrap<AdminPayout>(apiClient.post(`/admin/payouts/${id}/process`)),
  users: () => unwrap<AdminUser[]>(apiClient.get('/admin/users')),
  auditLogs: () => unwrap<AuditLogEntry[]>(apiClient.get('/admin/audit-logs'))
};

export type AuditLogEntry = {
  id: string;
  user_email: string | null;
  event: string;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export const mfaApi = {
  status: () => unwrap<{ enabled: boolean }>(apiClient.get('/auth/mfa/status')),
  setup: () => unwrap<{ qr: string; secret: string }>(apiClient.post('/auth/mfa/setup')),
  enable: (token: string) => unwrap<{ enabled: boolean; backupCodes: string[] }>(apiClient.post('/auth/mfa/enable', { token })),
  disable: (token: string) => unwrap<{ enabled: boolean }>(apiClient.post('/auth/mfa/disable', { token }))
};

export const usersApi = {
  myProfile: () => unwrap<Profile>(apiClient.get('/users/me/profile')),
  publicProfile: (id: string) => unwrap<Profile>(apiClient.get(`/users/${id}/profile`)),
  updateProfile: (payload: ProfileUpdate) => unwrap<Profile>(apiClient.patch('/users/me/profile', payload)),
  search: (q: string, role?: string) =>
    unwrap<UserSearchResult[]>(apiClient.get(`/users/search?q=${encodeURIComponent(q)}${role ? `&role=${role}` : ''}`)),
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap<{ avatar_url: string }>(
      apiClient.post('/users/me/profile/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    );
  },
  uploadCv: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap<{ cv_url: string }>(
      apiClient.post('/users/me/profile/upload-cv', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    );
  },
  deleteImage: () => unwrap<{ message: string }>(apiClient.delete('/users/me/profile/image')),
  deleteCv: () => unwrap<{ message: string }>(apiClient.delete('/users/me/profile/cv'))
};
