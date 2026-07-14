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
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        title="Bấm để xem vị trí trong tài liệu PDF"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>Trích dẫn #{index + 1}</span>
        {citation.pageNumber && <span className="text-[10px] bg-white/80 px-1.5 py-0.2 rounded text-[#0073BB] font-bold">Tr.{citation.pageNumber}</span>}
        <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {/* Hover Preview Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-[#232F3E] text-white text-xs rounded-xl shadow-xl border border-white/20 z-50 animate-fadeIn pointer-events-none">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10 font-semibold text-[#9CCAFF]">
            <span>Đoạn nhúng: {citation.chunkId}</span>
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
