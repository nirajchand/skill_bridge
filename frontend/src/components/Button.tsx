'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '@/components/ui';

type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost'
};

const sizeClass: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-xs',
  md: '',
  lg: 'px-6 py-3 text-base'
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const spinnerTone = variant === 'secondary' || variant === 'ghost' ? '' : 'border-white/30 border-t-white';
  return (
    <button
      className={`${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className={`h-4 w-4 ${spinnerTone}`} />}
      {children}
    </button>
  );
}
