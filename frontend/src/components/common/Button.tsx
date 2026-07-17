import React, { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'ai' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex min-h-10 items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px';

  const variantStyles = {
    primary: 'bg-[#2F6B58] text-white shadow-[0_8px_20px_rgba(47,107,88,0.18)] hover:bg-[#285B4B] hover:shadow-[0_10px_24px_rgba(47,107,88,0.24)] focus:ring-[#2F6B58]/20',
    secondary: 'bg-[#ED7148] text-white shadow-[0_8px_20px_rgba(237,113,72,0.18)] hover:bg-[#D9603A] focus:ring-[#ED7148]/20',
    ai: 'bg-[#18312A] text-white shadow-[0_10px_26px_rgba(24,49,42,0.2)] hover:bg-[#244A3F] focus:ring-[#2F6B58]/20',
    outline: 'border border-[#D7DEDA] bg-white text-[#26332F] shadow-sm hover:border-[#AEBBB5] hover:bg-[#F8FAF7] focus:ring-[#2F6B58]/15',
    ghost: 'bg-transparent text-[#55635E] hover:bg-[#E9EFEB] hover:text-[#18312A] focus:ring-[#2F6B58]/12',
    danger: 'bg-[#B42318] text-white shadow-sm hover:bg-[#912018] focus:ring-[#B42318]/20',
  };

  const sizeStyles = {
    sm: 'min-h-8 px-3 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'min-h-12 px-6 py-3 text-[15px] gap-2.5 rounded-2xl',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variantStyles[variant], sizeStyles[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
        </svg>
      ) : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
