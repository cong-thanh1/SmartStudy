import React, { useState } from 'react';
import { Check, Copy, Sparkles, ThumbsDown, ThumbsUp, User as UserIcon } from 'lucide-react';
import { Message, Citation } from '../../types';
import { CitationBadge } from './CitationBadge';
import { clsx } from 'clsx';

export interface ChatBubbleProps {
  message: Message;
  onSelectCitation?: (citation: Citation) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onSelectCitation }) => {
  const isAi = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    await navigator.clipboard?.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  };

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
    <div
      data-testid={isAi ? 'chat-assistant-message' : 'chat-user-message'}
      className={clsx('flex max-w-[92%] gap-3 sm:max-w-[86%] animate-fadeIn', isAi ? 'self-start' : 'self-end flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-semibold text-white',
          isAi ? 'bg-[#2F6B58]' : 'bg-[#18312A]'
        )}
      >
        {isAi ? <Sparkles className="w-4 h-4 animate-pulse" /> : <UserIcon className="w-4 h-4" />}
      </div>

      {/* Bubble Box */}
      <div
        className={clsx(
          'relative flex flex-col gap-2.5 rounded-2xl p-4 shadow-sm',
          isAi
            ? 'rounded-tl-md border border-[#E0E6E2] bg-white text-[#17201E]'
            : 'rounded-tr-md bg-[#18312A] text-white'
        )}
      >
        {/* Role Header */}
        <div className="flex items-center justify-between gap-4 text-xs font-semibold opacity-80">
          <span>{isAi ? 'Trợ lý SmartStudy' : 'Bạn'}</span>
          <span className="text-[10px] font-normal opacity-70">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Content Body */}
        {renderFormattedContent(message.content)}

        {/* Citations List if available */}
        {isAi && message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-[#E0E3E5] pt-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-[#404751]">
              <span>Nguồn trong tài liệu</span>
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
        {isAi && (
          <div className="mt-1 flex items-center gap-1 border-t border-[#EEF1EF] pt-2 text-[#6F7975]">
            <button type="button" onClick={copyMessage} className="rounded-md p-1.5 hover:bg-[#F0F5F2] hover:text-[#18312A] focus:outline-none focus:ring-2 focus:ring-[#2F6B58]" aria-label="Sao chép câu trả lời">
              {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            </button>
            <button type="button" className="rounded-md p-1.5 hover:bg-[#F0F5F2] hover:text-[#18312A] focus:outline-none focus:ring-2 focus:ring-[#2F6B58]" aria-label="Câu trả lời hữu ích"><ThumbsUp size={15} /></button>
            <button type="button" className="rounded-md p-1.5 hover:bg-[#F0F5F2] hover:text-[#18312A] focus:outline-none focus:ring-2 focus:ring-[#2F6B58]" aria-label="Câu trả lời chưa hữu ích"><ThumbsDown size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
};
