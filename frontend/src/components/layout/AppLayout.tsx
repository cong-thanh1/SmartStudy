import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F7F2] text-[#17201E]">
      <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />
      <div className="min-h-screen lg:pl-[252px]">
        <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="scrollbar-subtle min-h-[calc(100vh-80px)] px-4 py-5 sm:px-6 sm:py-7 xl:px-10 xl:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
