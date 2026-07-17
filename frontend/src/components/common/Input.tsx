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
          <label htmlFor={inputId} className="font-semibold text-sm text-[#26332F]">
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
                'w-full min-h-11 rounded-xl border bg-white px-4 py-2.5 text-sm text-[#17201E] placeholder-[#8B9792] shadow-sm transition-colors focus:outline-none focus:ring-4',
                leftIcon ? 'pl-10' : 'pl-4',
                rightIcon ? 'pr-10' : 'pr-4',
                error
                  ? 'border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]/12'
                  : 'border-[#D7DEDA] focus:border-[#2F6B58] focus:ring-[#2F6B58]/12',
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
        {error && <p className="text-xs text-[#B42318] font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-[#69756F]">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
