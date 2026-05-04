import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthStatus } from "../../services/authApi";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    getAuthStatus()
      .then((response) => {
        if (active) {
          setAuthenticated(response.authenticated);
        }
      })
      .catch(() => {
        if (active) {
          setAuthenticated(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (authenticated === null) {
    return <div className="text-sm text-slate-500">Loading...</div>;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
