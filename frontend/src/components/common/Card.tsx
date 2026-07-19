import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive' | 'outline' | 'ai-glow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ children, className, variant = 'default', padding = 'md', ...props }) => {
  const variantStyles = {
    default: 'border border-rule bg-surface text-ink shadow-[var(--shadow-whisper)]',
    glass: 'glass-panel',
    interactive: 'group cursor-pointer border border-rule bg-surface text-ink hover:border-rule-strong hover:bg-paper-2 focus-within:border-accent',
    outline: 'border border-rule-strong bg-transparent text-ink hover:bg-paper-2',
    'ai-glow': 'border border-accent bg-surface text-ink',
  };
  const paddingStyles = { none: 'p-0', sm: 'p-4', md: 'p-6', lg: 'p-8' };

  return (
    <div className={twMerge(clsx('relative overflow-hidden rounded-xl transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)]', variantStyles[variant], paddingStyles[padding], className))} {...props}>
      {children}
    </div>
  );
};
