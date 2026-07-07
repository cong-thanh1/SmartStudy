import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive' | 'outline' | 'ai-glow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  padding = 'md',
  ...props
}) => {
  const baseStyles = 'rounded-2xl transition-all duration-200 overflow-hidden relative';

  const variantStyles = {
    default: 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E0E3E5]',
    glass: 'glass-panel shadow-[0_8px_32px_rgba(0,0,0,0.06)]',
    interactive: 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E0E3E5] hover:shadow-md hover:border-[#0073BB]/40 cursor-pointer group',
    outline: 'bg-transparent border border-[#C0C7D2]/60 hover:bg-white/50',
    'ai-glow': 'bg-white border border-[#8A2BE2]/30 ai-glow',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={twMerge(clsx(baseStyles, variantStyles[variant], paddingStyles[padding], className))}
      {...props}
    >
      {children}
    </div>
  );
};
