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
        clsx('glass-panel border border-white/70 shadow-[0_18px_48px_rgba(28,49,42,0.09)]', roundedStyles[rounded], className)
      )}
      {...props}
    >
      {children}
    </div>
  );
};
