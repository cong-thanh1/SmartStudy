import React from 'react';

interface FormattedTextProps extends React.HTMLAttributes<HTMLDivElement> { readonly content: string; }
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

export const FormattedText: React.FC<FormattedTextProps> = ({ className, content, ...props }) => (
  <div className={className} {...props}>
    {content.split(/\r?\n/).map((line, lineIndex) => {
      const heading = line.match(/^###\s+(.+)$/);
      if (heading) return <h5 key={lineIndex} className="mt-4 text-sm font-bold text-ink">{renderInline(heading[1] ?? '')}</h5>;
      const listItem = line.match(/^[-•]\s+(.+)$/);
      if (listItem) return <p key={lineIndex} className="flex items-start gap-2"><span aria-hidden="true" className="mt-[.65em] h-1 w-1 shrink-0 rounded-full bg-accent" /><span>{renderInline(listItem[1] ?? '')}</span></p>;
      return line ? <p key={lineIndex}>{renderInline(line)}</p> : <br key={lineIndex} />;
    })}
  </div>
);

function renderInline(value: string): React.ReactNode[] {
  return value.split(INLINE_PATTERN).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-bold text-current">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-[.92em]">{part.slice(1, -1)}</code>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
