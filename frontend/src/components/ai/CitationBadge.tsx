import React, { useRef, useState } from 'react';
import { ArrowSquareOut as ExternalLink, BookOpen } from '@phosphor-icons/react';
import { Citation } from '../../types';

export interface CitationBadgeProps {
  citation: Citation;
  index: number;
  onSelect?: (citation: Citation) => void;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  citation,
  index,
  onSelect,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  const showAfterDelay = () => {
    hoverTimer.current = window.setTimeout(() => setShowTooltip(true), 800);
  };

  const hideTooltip = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setShowTooltip(false);
  };

  return (
    <div className="relative inline-block" onMouseEnter={showAfterDelay} onMouseLeave={hideTooltip}>
      <button
        data-testid="chat-citation"
        onClick={() => onSelect?.(citation)}
        onFocus={() => setShowTooltip(true)}
        onBlur={hideTooltip}
        onKeyDown={(event) => { if (event.key === 'Escape') hideTooltip(); }}
        className="hm-affordance inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rule bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent transition-colors duration-150 hover:bg-paper-3 active:translate-y-px"
        title="Xem đoạn liên quan trong tài liệu"
      >
        <BookOpen className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <span>Nguồn {index + 1}</span>
        {citation.pageNumber && <span className="rounded bg-surface/80 px-1.5 text-[10px] font-bold text-[var(--color-accent)]">Trang {citation.pageNumber}</span>}
        <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {/* Hover Preview Tooltip */}
      {showTooltip && (
        <div role="tooltip" className="absolute bottom-full left-0 z-[var(--z-tooltip)] mb-2 w-72 rounded-lg border border-ink-2 bg-ink p-3 text-xs text-paper">
          <div className="mb-1.5 flex items-center justify-between border-b border-paper/10 pb-1.5 font-semibold text-[var(--color-accent-soft)]">
            <span>Đoạn liên quan</span>
            {citation.pageNumber && <span>Trang {citation.pageNumber}</span>}
          </div>
          <p className="italic line-clamp-4 leading-relaxed text-[var(--color-rule)]">
            &ldquo;{citation.snippet}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
};
