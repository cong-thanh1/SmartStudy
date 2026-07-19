import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout, ProtectedRoute } from './components';

const WelcomePage = lazy(() => import('./pages/WelcomePage').then((module) => ({ default: module.WelcomePage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const LearningSpacePage = lazy(() => import('./pages/LearningSpacePage').then((module) => ({ default: module.LearningSpacePage })));
const ExamCenterPage = lazy(() => import('./pages/ExamCenterPage').then((module) => ({ default: module.ExamCenterPage })));
const ResultsPage = lazy(() => import('./pages/ResultsPage').then((module) => ({ default: module.ResultsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));

const RouteSkeleton = () => (
  <div className="min-h-[100dvh] bg-paper px-4 py-8 sm:px-8" role="status" aria-label="Đang mở không gian học">
    <div className="mx-auto max-w-[87.5rem] animate-pulse space-y-8">
      <div className="h-3 w-28 rounded-full bg-paper-3" />
      <div className="h-14 max-w-xl rounded-xl bg-paper-3" />
      <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
        <div className="h-72 rounded-[var(--radius-panel)] bg-paper-3" />
        <div className="h-72 rounded-[var(--radius-panel)] bg-paper-2" />
      </div>
    </div>
  </div>
);

export const App: React.FC = () => (
  <BrowserRouter>
    <Suspense fallback={<RouteSkeleton />}>
      <Routes>
        <Route path="/" element={<Navigate to="/welcome" replace />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/learning" element={<LearningSpacePage />} />
          <Route path="/learning-space" element={<LearningSpacePage />} />
          <Route path="/exam-center" element={<ExamCenterPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;
