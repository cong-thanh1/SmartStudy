import React, { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  success?: string;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, success, isLoading = false, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    const messageId = inputId ? `${inputId}-message` : undefined;
    const message = error || success || helperText || ' ';

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-ink-2">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3.5 flex items-center text-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={twMerge(
              clsx(
                'min-h-12 w-full rounded-[var(--radius-control)] border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-subtle outline-2 outline-transparent outline-offset-1 transition-[background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out)] hover:border-ink/40 focus-visible:border-accent focus-visible:bg-surface focus-visible:shadow-[0_0_0_4px_rgb(49_89_216/0.08)] focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55',
                leftIcon ? 'pl-10' : 'pl-4',
                rightIcon || isLoading ? 'pr-10' : 'pr-4',
                error
                  ? 'border-error'
                  : success
                    ? 'border-success'
                    : 'border-rule-strong',
                className
              )
            )}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={messageId}
            aria-busy={isLoading || undefined}
            {...props}
          />
          {(rightIcon || isLoading) && (
            <div className="absolute right-3.5 flex items-center text-muted" aria-hidden="true">
              {isLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-accent" /> : rightIcon}
            </div>
          )}
        </div>
        <p id={messageId} className={clsx('min-h-[1lh] text-xs', error ? 'font-medium text-error' : success ? 'font-medium text-success' : 'text-muted')}>
          {message}
        </p>
      </div>
    );
  }
);

Input.displayName = 'Input';
