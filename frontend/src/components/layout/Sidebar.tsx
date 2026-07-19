import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpenText,
  ChartLineUp,
  ClipboardText,
  UserCircle,
  SignOut,
  SquaresFour,
  X,
} from '@phosphor-icons/react';
import { clsx } from 'clsx';
import { authService, getStoredUser } from '../../services';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems = [
  { to: '/dashboard', label: 'Tổng quan', icon: SquaresFour, code: '01' },
  { to: '/learning', label: 'Phòng học', icon: BookOpenText, code: '02' },
  { to: '/exam-center', label: 'Luyện tập', icon: ClipboardText, code: '03' },
  { to: '/results', label: 'Kết quả', icon: ChartLineUp, code: '04' },
  { to: '/profile', label: 'Hồ sơ', icon: UserCircle, code: '05' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onMobileClose }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser() || { name: 'Người học', email: 'student@smartstudy.ai' });
  const displayName = user.name || user.fullName || 'Người học';

  useEffect(() => {
    const refreshUser = () => setUser(getStoredUser() || { name: 'Người học', email: 'student@smartstudy.ai' });
    window.addEventListener('smartstudy:user-updated', refreshUser);
    return () => window.removeEventListener('smartstudy:user-updated', refreshUser);
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      navigate('/welcome');
    }
  };

  return (
    <>
      {isMobileOpen && (
        <button
          className="fixed inset-0 z-[var(--z-dropdown)] bg-ink/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-label="Đóng menu"
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-[var(--z-sticky)] flex w-[17rem] flex-col border-r border-white/10 bg-ink px-4 py-5 text-paper transition-transform duration-300 ease-[var(--ease-out)] lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-2">
          <NavLink to="/dashboard" onClick={onMobileClose} className="group flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[0.7rem] border border-white/15 bg-white/8 text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] transition-transform duration-300 group-hover:-rotate-3">
              <BookOpenText size={20} weight="duotone" />
            </span>
            <span>
              <span className="block font-display text-[17px] font-semibold leading-none tracking-[-0.04em]">SmartStudy</span>
              <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-[0.15em] text-paper/45">learning signal</span>
            </span>
          </NavLink>
          <button onClick={onMobileClose} className="grid h-11 w-11 place-items-center rounded-lg text-paper/65 hover:bg-white/8 hover:text-paper lg:hidden" aria-label="Đóng menu">
            <X size={19} weight="bold" />
          </button>
        </div>

        <div className="mt-9 flex items-center gap-3 border-y border-white/10 px-3 py-4">
          <span className="dt-status-pulse shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/45">Workspace</p>
            <p className="mt-0.5 truncate text-sm font-medium text-paper/90">Sẵn sàng để học</p>
          </div>
        </div>

        <nav className="mt-7 flex-1 space-y-1" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onMobileClose}
                className={({ isActive }) => clsx(
                  'group grid min-h-12 grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition-[background-color,color,transform] duration-200',
                  isActive ? 'bg-paper text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]' : 'text-paper/58 hover:translate-x-1 hover:bg-white/7 hover:text-paper',
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={19} weight={isActive ? 'fill' : 'regular'} />
                    <span className="min-w-0 text-sm font-semibold">{item.label}</span>
                    <span className={clsx('font-mono text-[9px]', isActive ? 'text-accent' : 'text-paper/28')}>{item.code}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 pt-4">
          <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-xl px-2 py-2">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/8 text-sm font-semibold text-paper">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p data-testid="sidebar-user-name" className="truncate text-sm font-semibold text-paper">{displayName}</p>
              <p className="truncate text-[11px] text-paper/45">{user.email}</p>
            </div>
            <button data-testid="logout-button" onClick={handleLogout} className="grid h-11 w-11 place-items-center rounded-lg text-paper/45 transition-colors duration-200 hover:bg-white/8 hover:text-paper" title="Đăng xuất" aria-label="Đăng xuất">
              <SignOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
