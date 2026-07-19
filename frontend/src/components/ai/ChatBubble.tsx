import React, { useState } from 'react';
import { Check, Copy, Robot as Bot, ThumbsDown, ThumbsUp, User as UserIcon } from '@phosphor-icons/react';
import { Message, Citation } from '../../types';
import { CitationBadge } from './CitationBadge';
import { FormattedText } from '../common/FormattedText';
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

  return (
    <div
      data-testid={isAi ? 'chat-assistant-message' : 'chat-user-message'}
      className={clsx('flex max-w-[92%] gap-3 sm:max-w-[86%] animate-fadeIn', isAi ? 'self-start' : 'self-end flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-semibold text-paper',
          isAi ? 'bg-accent' : 'bg-ink'
        )}
      >
        {isAi ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
      </div>

      {/* Bubble Box */}
      <div
        className={clsx(
          'relative flex flex-col gap-2.5 rounded-2xl p-4 shadow-sm',
          isAi
            ? 'rounded-tl-md border border-[var(--color-rule)] bg-surface text-[var(--color-ink)]'
            : 'rounded-tr-md bg-[var(--color-ink)] text-paper'
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
        <FormattedText content={message.content} className="space-y-2 text-sm leading-relaxed whitespace-pre-wrap" />

        {/* Citations List if available */}
        {isAi && message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-[var(--color-rule)] pt-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-2)]">
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
          <div className="mt-1 flex items-center gap-1 border-t border-[var(--color-paper-3)] pt-2 text-[var(--color-muted)]">
            <button type="button" onClick={copyMessage} className="grid h-11 w-11 place-items-center rounded-md hover:bg-accent-soft hover:text-ink" aria-label="Sao chép câu trả lời">
              {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
            </button>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-md hover:bg-accent-soft hover:text-ink" aria-label="Câu trả lời hữu ích"><ThumbsUp size={15} /></button>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-md hover:bg-accent-soft hover:text-ink" aria-label="Câu trả lời chưa hữu ích"><ThumbsDown size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
};
