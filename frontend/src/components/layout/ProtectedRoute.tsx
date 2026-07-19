import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { getAccessToken } from '../../services';

export const ProtectedRoute: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  if (!getAccessToken()) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};
