import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const isAuth = await base44.auth.isAuthenticated();

      if (!isAuth) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        return;
      }

      // Authenticated — fetch user profile
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (meError) {
        // Authenticated by the platform but not registered in this app
        if (meError.status === 403 && meError.data?.extra_data?.reason === 'user_not_registered') {
          setIsAuthenticated(true);
          setAuthError({ type: 'user_not_registered' });
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoadingAuth,
      isAuthenticated,
      authError,
      logout,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};