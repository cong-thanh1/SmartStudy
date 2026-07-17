import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, BookOpenText, ClipboardCheck, ChartNoAxesColumnIncreasing, LogOut, Sparkles, X, ArrowUpRight } from 'lucide-react';
import { authService, getStoredUser } from '../../services';
import { clsx } from 'clsx';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems = [
  { to: '/dashboard', label: 'Tổng quan', description: 'Tài liệu của bạn', icon: LayoutGrid },
  { to: '/learning', label: 'Học cùng tài liệu', description: 'Đọc và đặt câu hỏi', icon: BookOpenText },
  { to: '/exam-center', label: 'Luyện tập', description: 'Tạo bài kiểm tra', icon: ClipboardCheck },
  { to: '/results', label: 'Kết quả', description: 'Xem lại tiến bộ', icon: ChartNoAxesColumnIncreasing },
];

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onMobileClose }) => {
  const navigate = useNavigate();
  const user = getStoredUser() || { name: 'Người học', email: 'student@smartstudy.ai' };
  const displayName = user.name || user.fullName || 'Người học';

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      navigate('/welcome');
    }
  };

  return (
    <>
      {isMobileOpen && <button className="fixed inset-0 z-40 bg-[#10231D]/45 backdrop-blur-sm lg:hidden" onClick={onMobileClose} aria-label="Đóng menu" />}
      <aside className={clsx('fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-[#DCE2DE] bg-[#FBFCF8] p-4 transition-transform duration-300 lg:translate-x-0', isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full')}>
        <div className="flex h-14 items-center justify-between px-2">
          <NavLink to="/dashboard" onClick={onMobileClose} className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#18312A] text-white shadow-[0_8px_20px_rgba(24,49,42,0.2)]">
              <Sparkles size={19} />
            </div>
            <div>
              <p className="text-[17px] font-extrabold leading-none tracking-[-0.03em] text-[#17201E]">SmartStudy</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ED7148]">Học theo cách của bạn</p>
            </div>
          </NavLink>
          <button onClick={onMobileClose} className="rounded-lg p-2 text-[#69756F] hover:bg-[#E9EFEB] lg:hidden" aria-label="Đóng menu"><X size={18} /></button>
        </div>

        <nav className="mt-7 flex-1 space-y-1.5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A9691]">Học tập</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} onClick={onMobileClose} className={({ isActive }) => clsx('group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all', isActive ? 'bg-[#E1EEE8] text-[#204D3F]' : 'text-[#5E6A66] hover:bg-[#EFF3EF] hover:text-[#18312A]')}>
                {({ isActive }) => (
                  <>
                    <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl transition', isActive ? 'bg-[#2F6B58] text-white shadow-sm' : 'bg-white text-[#61716B] ring-1 ring-[#E0E6E2] group-hover:text-[#2F6B58]')}><Icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span className="block truncate text-[11px] font-medium opacity-70">{item.description}</span>
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="mb-3 rounded-2xl bg-[#18312A] p-4 text-white">
          <p className="text-xs font-bold">Mẹo học nhanh</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/65">Đặt câu hỏi ngay khi gặp phần chưa hiểu, câu trả lời sẽ kèm nguồn để bạn kiểm tra.</p>
          <NavLink to="/learning" onClick={onMobileClose} className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#B9E0D0] hover:text-white">Thử ngay <ArrowUpRight size={13} /></NavLink>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-[#E1E6E2] bg-white p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFE5DA] text-sm font-extrabold text-[#A34225]">{displayName.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#26332F]">{displayName}</p>
            <p className="truncate text-[10px] text-[#7A8681]">{user.email}</p>
          </div>
          <button data-testid="logout-button" onClick={handleLogout} className="rounded-lg p-2 text-[#8A9691] transition hover:bg-[#FEE4E2] hover:text-[#B42318]" title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={16} /></button>
        </div>
      </aside>
    </>
  );
};
