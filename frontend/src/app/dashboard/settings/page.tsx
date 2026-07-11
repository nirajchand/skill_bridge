'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { usersApi, type ProfileUpdate } from '@/lib/api';
import ProfileAvatar from '@/components/ProfileAvatar';
import ProfileCompletionBar from '@/components/ProfileCompletionBar';
import SkillsInput from '@/components/SkillsInput';
import { Spinner } from '@/components/ui';
import type { Profile } from '@/lib/types';

const inputClass =
  'block w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-indigo-500/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10';

type FormState = {
  display_name: string;
  location: string;
  bio: string;
  skills: string[];
  hourly_rate: string;
  portfolio_url: string;
  company_name: string;
  company_website: string;
};

function toForm(p: Profile): FormState {
  return {
    display_name: p.display_name ?? '',
    location: p.location ?? '',
    bio: p.bio ?? '',
    skills: p.skills ?? [],
    hourly_rate: p.hourly_rate ?? '',
    portfolio_url: p.portfolio_url ?? '',
    company_name: p.company_name ?? '',
    company_website: p.company_website ?? ''
  };
}

export default function SettingsProfilePage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'cv' | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const cvInput = useRef<HTMLInputElement>(null);

  const isFreelancer = user?.role === 'freelancer';

  const load = useCallback(async () => {
    try {
      const p = await usersApi.myProfile();
      setProfile(p);
      setForm(toForm(p));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load profile');
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload: ProfileUpdate = {
        display_name: form.display_name,
        bio: form.bio,
        location: form.location
      };
      if (isFreelancer) {
        payload.skills = form.skills;
        payload.hourly_rate = form.hourly_rate ? Number(form.hourly_rate) : null;
        payload.portfolio_url = form.portfolio_url;
      } else {
        payload.company_name = form.company_name;
        payload.company_website = form.company_website;
      }
      const updated = await usersApi.updateProfile(payload);
      setProfile(updated);
      setForm(toForm(updated));
      setEditing(false);
      await refreshProfile();
      toast.success(`Profile saved! You're ${updated.profile_completion_percentage}% complete.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const onImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
    setUploading('image');
    try {
      await usersApi.uploadImage(file);
      await load();
      await refreshProfile();
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const onCvPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('CV must be under 10MB');
    setUploading('cv');
    try {
      await usersApi.uploadCv(file);
      await load();
      await refreshProfile();
      toast.success('CV uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async () => {
    try {
      await usersApi.deleteImage();
      await load();
      await refreshProfile();
      toast.info('Photo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  const removeCv = async () => {
    try {
      await usersApi.deleteCv();
      await load();
      await refreshProfile();
      toast.info('CV removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  if (!profile || !form) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">Profile settings</h2>
          <p className="mt-1 text-sm text-neutral-500">This is how others see you on SkillBridge.</p>
        </div>
        <Link
          href={`/users/${profile.id}`}
          className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white"
        >
          View public profile
        </Link>
      </div>

      <ProfileCompletionBar percentage={profile.profile_completion_percentage ?? 0} checklist={profile.checklist} />

      {/* Avatar */}
      <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <ProfileAvatar name={profile.display_name} src={profile.profile_image_url} size="xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => imageInput.current?.click()}
              disabled={uploading === 'image'}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-60"
            >
              {uploading === 'image' && <Spinner className="h-4 w-4 border-black/30 border-t-black" />}
              {profile.profile_image_url ? 'Change photo' : 'Upload photo'}
            </button>
            {profile.profile_image_url && (
              <button onClick={removeImage} className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-neutral-300 transition hover:bg-white/5">
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-600">JPEG, PNG, WebP or GIF · max 5MB</p>
          <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={onImagePick} />
        </div>
      </div>

      {/* Details */}
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-white">Basic information</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5">
              Edit
            </button>
          )}
        </div>

        {!editing ? (
          <dl className="space-y-3 text-sm">
            <Row label="Display name" value={profile.display_name} />
            <Row label="Email" value={profile.email} />
            <Row label="Location" value={profile.location} />
            <Row label="Bio" value={profile.bio} />
            {isFreelancer ? (
              <>
                <Row label="Skills" value={profile.skills.length ? profile.skills.join(', ') : null} />
                <Row label="Hourly rate" value={profile.hourly_rate ? `$${Number(profile.hourly_rate)}/hr` : null} />
                <Row label="Portfolio" value={profile.portfolio_url} link />
              </>
            ) : (
              <>
                <Row label="Company" value={profile.company_name} />
                <Row label="Website" value={profile.company_website} link />
              </>
            )}
          </dl>
        ) : (
          <div className="space-y-4">
            <Field label="Display name">
              <input className={inputClass} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </Field>
            <Field label="Location">
              <input className={inputClass} placeholder="City, Country" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label={`Bio (${form.bio.length}/500)`}>
              <textarea className={`${inputClass} min-h-[90px] resize-y`} maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </Field>

            {isFreelancer ? (
              <>
                <Field label="Skills">
                  <SkillsInput value={form.skills} onChange={(skills) => setForm({ ...form, skills })} />
                </Field>
                <Field label="Hourly rate (USD)">
                  <input className={inputClass} type="number" min={5} max={500} placeholder="65" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
                </Field>
                <Field label="Portfolio URL">
                  <input className={inputClass} placeholder="https://…" value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Company name">
                  <input className={inputClass} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                </Field>
                <Field label="Company website">
                  <input className={inputClass} placeholder="https://…" value={form.company_website} onChange={(e) => setForm({ ...form, company_website: e.target.value })} />
                </Field>
              </>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => {
                  setForm(toForm(profile));
                  setEditing(false);
                }}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-60"
              >
                {saving && <Spinner className="h-4 w-4 border-black/30 border-t-black" />}
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CV (freelancer) */}
      {isFreelancer && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="font-display text-sm font-semibold text-white">CV / Resume</h3>
          {profile.cv_url ? (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <a href={profile.cv_url} target="_blank" rel="noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300">
                View uploaded CV
              </a>
              <button onClick={removeCv} className="text-xs text-neutral-400 transition hover:text-neutral-200">
                Remove
              </button>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No CV uploaded yet.</p>
          )}
          <div>
            <button
              onClick={() => cvInput.current?.click()}
              disabled={uploading === 'cv'}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-sm text-neutral-200 transition hover:bg-white/5 disabled:opacity-60"
            >
              {uploading === 'cv' && <Spinner className="h-4 w-4" />}
              {profile.cv_url ? 'Replace CV' : 'Upload CV'}
            </button>
            <p className="mt-1.5 text-xs text-neutral-600">PDF or Word · max 10MB</p>
            <input ref={cvInput} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onCvPick} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, link }: { label: string; value?: string | null; link?: boolean }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-neutral-200">
        {value ? (
          link ? (
            <a href={value} target="_blank" rel="noreferrer" className="break-all text-indigo-400 hover:text-indigo-300">
              {value}
            </a>
          ) : (
            <span className="whitespace-pre-wrap">{value}</span>
          )
        ) : (
          <span className="text-neutral-600">Not set</span>
        )}
      </dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-300">{label}</label>
      {children}
    </div>
  );
}
