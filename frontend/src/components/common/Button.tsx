import React, { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'ai' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  state?: 'default' | 'error' | 'success';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  state = 'default',
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles = 'hm-affordance inline-flex items-center justify-center rounded-[var(--radius-control)] font-semibold leading-none tracking-[-0.01em] transition-[background-color,color,transform,border-color,box-shadow] duration-200 ease-[var(--ease-out)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]';

  const variantStyles = {
    primary: 'border border-ink bg-ink text-paper shadow-[0_10px_30px_-18px_rgb(24_26_24/0.8)] hover:-translate-y-0.5 hover:bg-ink-2',
    secondary: 'border border-accent/25 bg-accent-soft text-signal-ink hover:border-accent/45 hover:bg-surface',
    ai: 'border border-accent bg-accent text-accent-ink shadow-[0_12px_32px_-20px_rgb(49_89_216/0.9)] hover:-translate-y-0.5 hover:bg-ink',
    outline: 'border border-rule-strong bg-surface/80 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] hover:border-ink hover:bg-surface',
    ghost: 'border border-transparent bg-transparent text-muted hover:bg-paper-2 hover:text-ink',
    danger: 'border border-error bg-error text-paper hover:-translate-y-0.5 hover:bg-ink',
  };

  const stateStyles = {
    default: '',
    error: 'border-error outline-error',
    success: 'border-success outline-success',
  };

  const sizeStyles = {
    sm: 'min-h-11 gap-1.5 px-3 py-2 text-xs',
    md: 'min-h-11 gap-2 px-4 py-2.5 text-sm',
    lg: 'min-h-12 gap-2.5 px-6 py-3 text-base',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variantStyles[variant], stateStyles[state], sizeStyles[size], className))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      data-state={isLoading ? 'loading' : state}
      {...props}
    >
      {isLoading ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
        </svg>
      ) : leftIcon}
      <span className="whitespace-nowrap">{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
