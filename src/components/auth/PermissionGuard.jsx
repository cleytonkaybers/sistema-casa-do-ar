import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export function usePermissions() {
  const { user, isLoading: loading } = useAuth();

  const isAdmin = user?.role === 'admin';  
  
  const hasPermission = (permission) => {
    if (isAdmin) return true;
    if (!user?.permissoes) return false;
    return user.permissoes[permission] === true;
  };

  return { user, loading, isAdmin, hasPermission };
}

export function PermissionGuard({ permission, children, fallback = null }) {
  const { loading, hasPermission } = usePermissions();

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }

  if (!hasPermission(permission)) {
    return fallback;
  }

  return children;
}