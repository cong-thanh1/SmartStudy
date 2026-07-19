import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral' | 'ai';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, className, variant = 'primary', size = 'md', ...props }) => {
  const variantStyles = {
    primary: 'bg-accent-soft text-accent',
    secondary: 'bg-signal-soft text-signal-ink',
    ai: 'border border-rule bg-paper-2 text-accent',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    error: 'bg-error-soft text-error',
    neutral: 'bg-paper-2 text-muted',
  };
  const sizeStyles = { sm: 'gap-1 px-2.5 py-1 text-xs', md: 'gap-1.5 px-3 py-1.5 text-sm' };

  return <span className={twMerge(clsx('inline-flex items-center rounded-full font-medium leading-none', variantStyles[variant], sizeStyles[size], className))} {...props}>{children}</span>;
};
