import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive' | 'outline' | 'ai-glow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ children, className, variant = 'default', padding = 'md', ...props }) => {
  const variantStyles = {
    default: 'bg-white border border-[#E2E7E3] shadow-[0_10px_35px_rgba(28,49,42,0.055)]',
    glass: 'glass-panel shadow-[0_18px_50px_rgba(28,49,42,0.08)]',
    interactive: 'bg-white border border-[#E2E7E3] shadow-[0_8px_28px_rgba(28,49,42,0.05)] hover:-translate-y-0.5 hover:border-[#AFC7BD] hover:shadow-[0_16px_38px_rgba(28,49,42,0.1)] cursor-pointer group',
    outline: 'bg-transparent border border-[#D7DEDA] hover:bg-white/70',
    'ai-glow': 'bg-white border border-[#CCE0D8] shadow-[0_18px_50px_rgba(47,107,88,0.12)]',
  };
  const paddingStyles = { none: 'p-0', sm: 'p-4', md: 'p-6', lg: 'p-8' };

  return (
    <div className={twMerge(clsx('relative overflow-hidden rounded-3xl transition-all duration-200', variantStyles[variant], paddingStyles[padding], className))} {...props}>
      {children}
    </div>
  );
};
