import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components';
import {
  WelcomePage,
  DashboardPage,
  LearningSpacePage,
  ExamCenterPage,
  ResultsPage,
} from './pages';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public / Welcome Landing Page */}
        <Route path="/" element={<Navigate to="/welcome" replace />} />
        <Route path="/welcome" element={<WelcomePage />} />

        {/* Main Application Layout with Sidebar & Navbar */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/learning" element={<LearningSpacePage />} />
          <Route path="/exam-center" element={<ExamCenterPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
