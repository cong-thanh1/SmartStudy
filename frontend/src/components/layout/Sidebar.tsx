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
        'h-screen bg-[#232F3E] text-white flex flex-col transition-all duration-300 relative z-30 shadow-xl border-r border-white/10 select-none',
        isCollapsed ? 'w-20' : 'w-[280px]'
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 h-20 border-b border-white/10">
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
          className="p-1.5 rounded-lg text-[#C0C7D2] hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#707882]">
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
                  'flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium text-sm transition-all relative group',
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
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#8A2BE2] rounded-r-full animate-fadeIn" />
                  )}
                  <Icon className={clsx('w-5 h-5 shrink-0 transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-[#9CCAFF]')} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile & Logout Bottom Section */}
      <div className="p-4 border-t border-white/10 bg-black/20">
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
