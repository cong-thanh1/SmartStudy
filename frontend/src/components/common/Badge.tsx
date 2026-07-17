import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral' | 'ai';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, className, variant = 'primary', size = 'md', ...props }) => {
  const variantStyles = {
    primary: 'bg-[#E0EEE8] text-[#275A4A]',
    secondary: 'bg-[#FFE7DE] text-[#A34225]',
    ai: 'bg-[#E5EFEA] text-[#285D4C] border border-[#C9DDD4]',
    success: 'bg-[#E4F4EA] text-[#247044]',
    warning: 'bg-[#FFF1D6] text-[#8A5B12]',
    error: 'bg-[#FEE4E2] text-[#9B251C]',
    neutral: 'bg-[#EEF1EF] text-[#5C6964]',
  };
  const sizeStyles = { sm: 'px-2.5 py-1 text-[11px] gap-1', md: 'px-3 py-1.5 text-xs gap-1.5' };

  return <span className={twMerge(clsx('inline-flex items-center rounded-full font-semibold', variantStyles[variant], sizeStyles[size], className))} {...props}>{children}</span>;
};
