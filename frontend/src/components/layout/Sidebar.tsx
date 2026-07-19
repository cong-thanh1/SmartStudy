import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, BookOpenText, ClipboardCheck, ChartNoAxesColumnIncreasing, LogOut, X } from 'lucide-react';
import { authService, getStoredUser } from '../../services';
import { clsx } from 'clsx';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutGrid },
  { to: '/learning', label: 'Phòng học', icon: BookOpenText },
  { to: '/exam-center', label: 'Luyện tập', icon: ClipboardCheck },
  { to: '/results', label: 'Kết quả', icon: ChartNoAxesColumnIncreasing },
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
      {isMobileOpen && <button className="fixed inset-0 z-[var(--z-dropdown)] bg-ink/55 lg:hidden" onClick={onMobileClose} aria-label="Đóng menu" />}
      <aside className={clsx('fixed inset-y-0 left-0 z-[var(--z-sticky)] flex w-60 flex-col border-r border-rule bg-paper-2 p-4 transition-transform duration-300 ease-[var(--ease-out)] lg:translate-x-0', isMobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-14 items-center justify-between px-1">
          <NavLink to="/dashboard" onClick={onMobileClose} className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-ink bg-ink text-paper">
              <BookOpenText size={18} />
            </div>
            <div>
              <p className="font-display text-[17px] font-bold leading-none tracking-[-0.03em] text-ink">SmartStudy</p>
              <p className="mt-1 font-mono text-[10px] text-muted">study/workspace</p>
            </div>
          </NavLink>
          <button onClick={onMobileClose} className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-paper-3 lg:hidden" aria-label="Đóng menu"><X size={18} /></button>
        </div>

        <nav className="mt-8 flex-1 space-y-1" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} onClick={onMobileClose} className={({ isActive }) => clsx('group flex min-h-12 items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 transition-[background-color,color,border-color] duration-150', isActive ? 'border-accent bg-accent-soft text-ink' : 'border-transparent text-muted hover:bg-paper-3 hover:text-ink')}>
                {({ isActive }) => (
                  <>
                    <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors duration-150', isActive ? 'text-accent' : 'text-muted group-hover:text-ink')}><Icon size={18} /></span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 border-t border-rule px-1 pt-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-signal-soft text-sm font-bold text-signal-ink">{displayName.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-2">{displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button data-testid="logout-button" onClick={handleLogout} className="grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-error-soft hover:text-error" title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={16} /></button>
        </div>
      </aside>
    </>
  );
};
