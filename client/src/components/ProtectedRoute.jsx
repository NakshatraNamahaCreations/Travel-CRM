import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';

export default function ProtectedRoute({ children, roles, redirectOwner = false }) {
  const { isAuthenticated, loading, hasRole, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // The platform owner never uses the tenant app — send them to their panel.
  if (redirectOwner && user?.role === 'owner') {
    return <Navigate to="/owner/companies" replace />;
  }

  if (roles && !hasRole(...roles)) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-lg font-semibold text-gray-800">Access denied</p>
        <p className="text-sm text-gray-500">You don’t have permission to view this page.</p>
      </div>
    );
  }

  return children;
}
