import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, MessageCircleMore } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

const pageContent = (pathname: string) => {
  if (pathname.startsWith('/dashboard')) {
    return { title: 'Tổng quan', subtitle: 'Tài liệu và tiến trình học tập của bạn.' };
  }
  if (pathname.startsWith('/learning')) {
    return { title: 'Phòng học', subtitle: 'Đọc, hỏi và ghi lại điều quan trọng.' };
  }
  if (pathname.startsWith('/exam-center')) {
    return { title: 'Luyện tập', subtitle: 'Tạo bài kiểm tra từ tài liệu đã học.' };
  }
  if (pathname.startsWith('/results')) {
    return { title: 'Kết quả', subtitle: 'Xem câu trả lời và phần cần ôn lại.' };
  }
  return { title: 'SmartStudy', subtitle: 'Từ tài liệu đến một phiên học rõ ràng.' };
};

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const content = pageContent(location.pathname);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] flex h-[4.5rem] items-center justify-between border-b border-rule bg-paper px-4 sm:px-7 xl:px-12">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenuClick} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-rule bg-surface text-ink-2 lg:hidden" aria-label="Mở menu">
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg text-ink sm:text-xl">{content.title}</h1>
          <p className="hidden truncate text-sm text-muted sm:block">{content.subtitle}</p>
        </div>
      </div>

      <Link to="/learning" className="hm-affordance hidden items-center gap-2 rounded-lg border border-rule-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-paper-2 sm:flex">
        <MessageCircleMore size={16} />
        Hỏi tài liệu
      </Link>
    </header>
  );
};
