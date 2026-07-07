import React from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, Sparkles, ShieldCheck } from 'lucide-react';
import { Badge } from '../common';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const getPageTitle = (pathname: string): { title: string; subtitle: string } => {
    if (pathname.startsWith('/dashboard')) {
      return {
        title: 'Bảng điều khiển & Thư viện tài liệu',
        subtitle: 'Quản lý tài liệu học tập, PDF giáo trình và theo dõi tiến độ học tập RAG.',
      };
    }
    if (pathname.startsWith('/learning')) {
      return {
        title: 'Không gian học tập AI',
        subtitle: 'Đọc tài liệu, hỏi đáp RAG với trích dẫn, tóm tắt Map-Reduce và Gia sư 1-kèm-1.',
      };
    }
    if (pathname.startsWith('/exam-center')) {
      return {
        title: 'Trung tâm Khảo thí AI',
        subtitle: 'Tự động tạo bài trắc nghiệm ôn tập và đề thi chuẩn chỉnh theo chương từ tài liệu PDF.',
      };
    }
    if (pathname.startsWith('/results')) {
      return {
        title: 'Kết quả & Phân tích AI',
        subtitle: 'Chấm điểm tức thì, giải thích đáp án sai và lời khuyên cải thiện cá nhân hóa từ AI.',
      };
    }
    return {
      title: 'SmartStudy AI Assistant',
      subtitle: 'Hệ thống học tập thông minh dựa trên kiến trúc Hexagonal (Ports & Adapters).',
    };
  };

  const { title, subtitle } = getPageTitle(location.pathname);

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#E0E3E5] px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      {/* Title & Subtitle */}
      <div>
        <h1 className="font-bold text-xl text-[#181C1E] flex items-center gap-2.5">
          {title}
          <Badge variant="ai" size="sm">
            <Sparkles className="w-3 h-3 mr-1 inline animate-spin text-[#8A2BE2]" style={{ animationDuration: '4s' }} />
            AI RAG v2.0
          </Badge>
        </h1>
        <p className="text-xs text-[#707882] mt-0.5">{subtitle}</p>
      </div>

      {/* Right Toolbar */}
      <div className="flex items-center gap-4">
        {/* System Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Local Engine: 100% Ready</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </div>

        {/* Global Search Bar */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-[#707882] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu, câu hỏi..."
            className="w-64 bg-[#F4F7F9] border border-[#E0E3E5] rounded-xl pl-9 pr-4 py-2 text-xs text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]/30 focus:border-[#0073BB] transition-all"
          />
        </div>

        {/* Notification Button */}
        <button
          className="p-2.5 rounded-xl bg-[#F4F7F9] text-[#404751] hover:text-[#0073BB] hover:bg-[#D0E4FF]/40 transition-colors relative"
          title="Thông báo mới"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#BA1A1A]" />
        </button>
      </div>
    </header>
  );
};
