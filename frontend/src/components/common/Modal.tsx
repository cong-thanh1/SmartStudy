import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10231D]/55 p-4 backdrop-blur-sm page-enter" role="dialog" aria-modal="true">
      <div
        className={twMerge(
          clsx(
            'w-full overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(16,35,29,0.24)] transition-all',
            sizeStyles[size],
            className
          )
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[#E5EAE7] bg-[#FAFBF8] px-6 py-5">
            <h3 className="font-bold text-lg text-[#17201E]">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-[#69756F] transition-colors hover:bg-[#E9EFEB] hover:text-[#18312A]"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="scrollbar-subtle max-h-[82vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};
