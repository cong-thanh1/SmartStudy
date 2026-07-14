import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  FileQuestion,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { authService, getStoredUser } from '../../services';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const user = getStoredUser() || { name: 'Giảng viên AI', email: 'teacher@smartstudy.ai' };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      navigate('/welcome');
    }
  };

  const navItems = [
    { to: '/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
    { to: '/learning', label: 'Không gian học tập AI', icon: BookOpen },
    { to: '/exam-center', label: 'Trung tâm Khảo thí', icon: FileQuestion },
    { to: '/results', label: 'Kết quả & Phân tích', icon: BarChart2 },
  ];

  return (
    <aside
      className={clsx(
        'fixed inset-x-0 bottom-0 z-30 flex h-16 w-full flex-row border-t border-white/10 bg-[#232F3E] text-white shadow-xl transition-all duration-300 select-none md:relative md:h-screen md:flex-col md:border-r md:border-t-0',
        isCollapsed ? 'md:w-[72px]' : 'md:w-[232px]'
      )}
    >
      {/* Brand Header */}
      <div className="hidden h-20 items-center justify-between border-b border-white/10 px-5 md:flex">
        <NavLink to="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0073BB] to-[#8A2BE2] flex items-center justify-center shrink-0 shadow-md">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-tight text-white">SmartStudy</span>
              <span className="text-[11px] text-[#9CCAFF] font-medium uppercase tracking-wider">AI Assistant</span>
            </div>
          )}
        </NavLink>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden shrink-0 rounded-lg p-1.5 text-[#C0C7D2] transition-colors hover:bg-white/10 hover:text-white md:block"
          title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-1 items-center justify-around gap-1 px-2 py-1 md:flex-col md:items-stretch md:justify-start md:space-y-1.5 md:px-3 md:py-6">
        {!isCollapsed && (
          <div className="mb-3 hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-[#707882] md:block">
            Học tập &amp; Khảo thí
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'group relative flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all md:flex-row md:gap-3.5 md:px-3.5 md:py-3 md:text-sm',
                  isActive
                    ? 'bg-[#0073BB] text-white shadow-md font-semibold'
                    : 'text-[#C0C7D2] hover:bg-white/5 hover:text-white'
                )
              }
              title={isCollapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && !isCollapsed && (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[#8A2BE2] animate-fadeIn md:bottom-2 md:left-0 md:top-2 md:h-auto md:w-1 md:translate-x-0 md:rounded-r-full" />
                  )}
                  <Icon className={clsx('w-5 h-5 shrink-0 transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-[#9CCAFF]')} />
                  <span className={clsx('truncate', isCollapsed && 'md:hidden')}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile & Logout Bottom Section */}
      <div className="hidden border-t border-white/10 bg-black/20 p-4 md:block">
        <div className={clsx('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="w-10 h-10 rounded-full bg-[#0073BB]/30 border border-[#0073BB] flex items-center justify-center shrink-0 text-white font-semibold">
            {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={18} />}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name || 'Người dùng AI'}</p>
              <p className="text-xs text-[#C0C7D2] truncate">{user.email}</p>
            </div>
          )}
          <button
            data-testid="logout-button"
            onClick={handleLogout}
            className="p-2 rounded-lg text-[#FFDAD6] hover:bg-[#BA1A1A]/20 transition-colors shrink-0"
            title="Đăng xuất"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};
