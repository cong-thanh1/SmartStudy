import React, { useEffect, useRef } from 'react';
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled):not([data-modal-close])')?.focus();
      });
    }
    if (!isOpen && dialog.open) dialog.close();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isOpen]);

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 z-[var(--z-modal)] m-auto max-h-[min(82dvh,48rem)] w-[calc(100%-2rem)] overflow-visible bg-transparent p-0 text-ink backdrop:bg-ink/65 open:grid open:place-items-center"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className={twMerge(
          clsx(
            'w-full overflow-hidden rounded-xl border border-rule bg-surface shadow-[var(--shadow-whisper)]',
            sizeStyles[size],
            className
          )
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-rule bg-paper-2 px-6 py-5">
            <h3 id="modal-title" className="text-lg text-ink">{title}</h3>
            <button
              data-modal-close
              onClick={onClose}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-paper-3 hover:text-ink"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="scrollbar-subtle max-h-[82vh] overflow-y-auto p-6">{children}</div>
      </div>
    </dialog>
  );
};
