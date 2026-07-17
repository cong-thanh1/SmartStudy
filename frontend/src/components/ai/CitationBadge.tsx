import React, { useState } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
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

  return (
    <div className="inline-block relative">
      <button
        data-testid="chat-citation"
        onClick={() => onSelect?.(citation)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#CDE0D7] bg-[#E9F3EE] px-2.5 py-1 text-xs font-semibold text-[#285D4C] transition-all duration-150 hover:bg-[#DCECE4] active:scale-95"
        title="Xem đoạn liên quan trong tài liệu"
      >
        <BookOpen className="h-3.5 w-3.5 text-[#2F6B58]" />
        <span>Nguồn {index + 1}</span>
        {citation.pageNumber && <span className="rounded bg-white/80 px-1.5 text-[10px] font-bold text-[#2F6B58]">Trang {citation.pageNumber}</span>}
        <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {/* Hover Preview Tooltip */}
      {showTooltip && (
        <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-white/20 bg-[#18312A] p-3 text-xs text-white shadow-xl">
          <div className="mb-1.5 flex items-center justify-between border-b border-white/10 pb-1.5 font-semibold text-[#B9E0D0]">
            <span>Đoạn liên quan</span>
            {citation.pageNumber && <span>Trang {citation.pageNumber}</span>}
          </div>
          <p className="italic line-clamp-4 leading-relaxed text-[#E0E3E5]">
            &ldquo;{citation.snippet}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
};
