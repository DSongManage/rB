import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { API_URL } from '../config';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/status/`, { credentials: 'include' });
      const data = await response.json();
      setIsAuthenticated(!!data?.authenticated);
    } catch {
      setIsAuthenticated(false);
    }
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        color: '#94a3b8',
        fontSize: 16,
      }}>
        Checking authentication...
      </div>
    );
  }

  // Not authenticated - redirect to auth page
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Authenticated - render children
  return <>{children}</>;
}
