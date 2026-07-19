import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChatCenteredText, List } from '@phosphor-icons/react';

interface NavbarProps { onMenuClick: () => void; }

const pageContent = (pathname: string) => {
  if (pathname.startsWith('/dashboard')) return { eyebrow: 'Library / 01', title: 'Tổng quan', subtitle: 'Tài liệu và nhịp học hôm nay.' };
  if (pathname.startsWith('/learning')) return { eyebrow: 'Workspace / 02', title: 'Phòng học', subtitle: 'Đọc, hỏi và kiểm chứng nguồn.' };
  if (pathname.startsWith('/exam-center')) return { eyebrow: 'Practice / 03', title: 'Luyện tập', subtitle: 'Tạo bài kiểm tra từ nội dung đã học.' };
  if (pathname.startsWith('/results')) return { eyebrow: 'Review / 04', title: 'Kết quả', subtitle: 'Nhìn lại câu trả lời và khoảng trống kiến thức.' };
  return { eyebrow: 'SmartStudy', title: 'Không gian học', subtitle: 'Biến tài liệu thành trí nhớ có thể kiểm tra.' };
};

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const content = pageContent(location.pathname);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-rule bg-paper/88 backdrop-blur-xl">
      <div className="flex min-h-[4.75rem] items-center justify-between gap-4 px-4 sm:px-8 xl:px-12">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onMenuClick} className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-rule bg-surface text-ink lg:hidden" aria-label="Mở menu">
            <List size={21} weight="bold" />
          </button>
          <div className="min-w-0">
            <p className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-accent sm:block">{content.eyebrow}</p>
            <div className="flex items-baseline gap-3">
              <h1 className="truncate text-xl text-ink sm:text-2xl">{content.title}</h1>
              <p className="hidden truncate text-sm text-muted xl:block">{content.subtitle}</p>
            </div>
          </div>
        </div>
        <Link to="/learning" className="hm-affordance hidden items-center gap-2 rounded-[var(--radius-control)] border border-rule-strong bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:border-ink sm:flex">
          <ChatCenteredText size={17} />
          Hỏi tài liệu
        </Link>
      </div>
    </header>
  );
};
