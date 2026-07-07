import React from 'react';
import { Sparkles, User as UserIcon } from 'lucide-react';
import { Message, Citation } from '../../types';
import { CitationBadge } from './CitationBadge';
import { clsx } from 'clsx';

export interface ChatBubbleProps {
  message: Message;
  onSelectCitation?: (citation: Citation) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onSelectCitation }) => {
  const isAi = message.role === 'assistant';

  // Simple formatter to convert markdown bold (**text**) and bullet lists to HTML
  const renderFormattedContent = (content: string) => {
    const formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-current">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-black/10 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');

    return (
      <div
        className="space-y-2 leading-relaxed text-sm whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  };

  return (
    <div className={clsx('flex gap-3.5 max-w-[85%] animate-fadeIn', isAi ? 'self-start' : 'self-end flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-semibold text-white',
          isAi ? 'ai-gradient ai-glow' : 'bg-[#232F3E]'
        )}
      >
        {isAi ? <Sparkles className="w-4 h-4 animate-pulse" /> : <UserIcon className="w-4 h-4" />}
      </div>

      {/* Bubble Box */}
      <div
        className={clsx(
          'p-4 rounded-2xl flex flex-col gap-2.5 shadow-sm relative',
          isAi
            ? 'bg-white border border-[#E0E3E5] text-[#181C1E] rounded-tl-none'
            : 'bg-[#0073BB] text-white rounded-tr-none'
        )}
      >
        {/* Role Header */}
        <div className="flex items-center justify-between gap-4 text-xs font-semibold opacity-80">
          <span>{isAi ? 'SmartStudy AI Engine' : 'Bạn'}</span>
          <span className="text-[10px] font-normal opacity-70">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Content Body */}
        {renderFormattedContent(message.content)}

        {/* Citations List if available */}
        {isAi && message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-3 border-t border-[#E0E3E5] flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[#404751] flex items-center gap-1">
              <span>📚 Nguồn trích dẫn từ tài liệu:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((cite, idx) => (
                <CitationBadge
                  key={`${cite.chunkId}-${idx}`}
                  citation={cite}
                  index={idx}
                  onSelect={onSelectCitation}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
