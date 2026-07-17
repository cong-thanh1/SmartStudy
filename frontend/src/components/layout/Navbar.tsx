import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, MessageCircleMore, Sparkles } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

const pageContent = (pathname: string) => {
  if (pathname.startsWith('/dashboard')) {
    return { eyebrow: 'Không gian của bạn', title: 'Tổng quan học tập', subtitle: 'Quản lý tài liệu và chọn việc bạn muốn làm tiếp theo.' };
  }
  if (pathname.startsWith('/learning')) {
    return { eyebrow: 'Học cùng tài liệu', title: 'Phòng học tập trung', subtitle: 'Đọc, đặt câu hỏi và ghi nhớ những ý quan trọng.' };
  }
  if (pathname.startsWith('/exam-center')) {
    return { eyebrow: 'Ôn luyện', title: 'Tạo bài luyện tập', subtitle: 'Chọn tài liệu, số câu và mức độ phù hợp với bạn.' };
  }
  if (pathname.startsWith('/results')) {
    return { eyebrow: 'Tiến bộ của bạn', title: 'Kết quả học tập', subtitle: 'Xem lại câu trả lời và biết mình nên ôn phần nào.' };
  }
  return { eyebrow: 'SmartStudy', title: 'Học thông minh hơn', subtitle: 'Mọi công cụ học tập trong một nơi.' };
};

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const content = pageContent(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#E1E6E2] bg-[#F6F7F2]/92 px-4 backdrop-blur-xl sm:px-6 xl:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenuClick} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#DCE2DE] bg-white text-[#26332F] shadow-sm lg:hidden" aria-label="Mở menu">
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2F6B58] sm:text-[11px]">{content.eyebrow}</p>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-extrabold tracking-[-0.02em] text-[#17201E] sm:text-xl">{content.title}</h1>
          </div>
          <p className="hidden truncate text-xs text-[#69756F] sm:block">{content.subtitle}</p>
        </div>
      </div>

      <Link to="/learning" className="hidden items-center gap-2 rounded-xl border border-[#D4E3DC] bg-white px-3.5 py-2 text-xs font-semibold text-[#285D4C] shadow-sm transition hover:border-[#AFC7BD] hover:bg-[#F1F7F4] sm:flex">
        <MessageCircleMore size={16} />
        Hỏi từ tài liệu
        <Sparkles size={13} className="text-[#ED7148]" />
      </Link>
    </header>
  );
};
