import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />
      <div className="min-h-dvh lg:pl-[17rem]">
        <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="scrollbar-subtle min-h-[calc(100dvh-4.75rem)] px-4 py-7 sm:px-8 sm:py-10 xl:px-12 xl:py-12">
          <div className="mx-auto w-full max-w-[87.5rem]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
