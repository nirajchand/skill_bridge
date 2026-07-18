'use client';

/* eslint-disable @next/next/no-img-element */

const SIZES: Record<string, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl'
};

// Deterministic gradient from the name so avatars are stable per user.
// Green-family palette so generated avatars stay on-brand while still being
// visually distinct per user. All are dark enough for white initials to read.
const GRADIENTS = [
  'from-emerald-500 to-green-600',
  'from-emerald-600 to-teal-500',
  'from-teal-500 to-emerald-600',
  'from-green-500 to-emerald-700',
  'from-lime-600 to-emerald-600',
  'from-emerald-500 to-cyan-600'
];

function initials(name: string) {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function gradientFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export default function ProfileAvatar({
  name,
  src,
  size = 'md'
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
}) {
  const sizeClass = SIZES[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-neutral-200`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(
        name
      )} font-semibold text-neutral-900 ring-1 ring-neutral-200`}
    >
      {initials(name)}
    </span>
  );
}
