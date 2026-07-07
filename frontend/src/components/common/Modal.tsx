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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div
        className={twMerge(
          clsx(
            'w-full bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[#E0E3E5] overflow-hidden transform transition-all',
            sizeStyles[size],
            className
          )
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E3E5] bg-[#F4F7F9]/50">
            <h3 className="font-semibold text-lg text-[#181C1E]">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#707882] hover:text-[#181C1E] hover:bg-black/5 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
