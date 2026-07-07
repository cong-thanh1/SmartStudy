import React, { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className,
  rounded = '2xl',
  ...props
}) => {
  const roundedStyles = {
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
  };

  return (
    <div
      className={twMerge(
        clsx('glass-panel shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60', roundedStyles[rounded], className)
      )}
      {...props}
    >
      {children}
    </div>
  );
};
