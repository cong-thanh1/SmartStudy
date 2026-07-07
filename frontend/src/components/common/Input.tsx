import React, { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="font-medium text-sm text-[#181C1E]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#707882]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={twMerge(
              clsx(
                'w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-[#181C1E] placeholder-[#707882] transition-colors focus:outline-none focus:ring-2',
                leftIcon ? 'pl-10' : 'pl-4',
                rightIcon ? 'pr-10' : 'pr-4',
                error
                  ? 'border-[#BA1A1A] focus:border-[#BA1A1A] focus:ring-[#BA1A1A]/20'
                  : 'border-[#C0C7D2] focus:border-[#0073BB] focus:ring-[#0073BB]/20',
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[#707882]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-[#BA1A1A] font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-[#707882]">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
