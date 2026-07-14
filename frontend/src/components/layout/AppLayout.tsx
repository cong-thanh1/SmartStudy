import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F4F7F9]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="relative flex-1 overflow-y-auto p-4 pb-20 sm:p-6 md:p-8 md:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
