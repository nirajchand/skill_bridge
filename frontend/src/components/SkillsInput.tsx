'use client';

import { useState } from 'react';

const SUGGESTIONS = [
  'React', 'Vue.js', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Next.js',
  'UI Design', 'UX Design', 'Figma', 'Adobe XD', 'Branding',
  'SEO', 'Content Marketing', 'Social Media', 'Copywriting', 'Blogging',
  'Data Analysis', 'SQL', 'Tableau', 'Project Management'
];

export default function SkillsInput({
  value,
  onChange,
  max = 10
}: {
  value: string[];
  onChange: (skills: string[]) => void;
  max?: number;
}) {
  const [input, setInput] = useState('');

  const add = (skill: string) => {
    const clean = skill.trim();
    if (!clean || clean.length < 2 || clean.length > 50) return;
    if (value.length >= max) return;
    if (value.some((s) => s.toLowerCase() === clean.toLowerCase())) return;
    onChange([...value, clean]);
    setInput('');
  };

  const remove = (skill: string) => onChange(value.filter((s) => s !== skill));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && !input && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const suggestions = SUGGESTIONS.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.some((v) => v.toLowerCase() === s.toLowerCase())
  ).slice(0, 6);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 focus-within:border-indigo-500/60 focus-within:ring-4 focus-within:ring-indigo-500/10">
        {value.map((skill) => (
          <span key={skill} className="flex items-center gap-1.5 rounded-lg bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-200">
            {skill}
            <button type="button" onClick={() => remove(skill)} className="text-indigo-300/70 hover:text-white" aria-label={`Remove ${skill}`}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" className="h-3 w-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-neutral-100 placeholder-neutral-600 outline-none"
            placeholder={value.length ? 'Add another…' : 'Type a skill and press Enter'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
        )}
      </div>

      {input && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-white/20 hover:text-neutral-200"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs text-neutral-600">
        {value.length}/{max} skills
      </p>
    </div>
  );
}
