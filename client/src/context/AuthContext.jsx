import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);
// Sesi bergulir: token berlaku 6 hari dan diperbarui setiap kali token berumur > 1 jam saat web dikunjungi/dipakai.
const REFRESH_AFTER_AGE = 60 * 60 * 1000;
const REFRESH_CHECK_INTERVAL = 5 * 60 * 1000;

function getTokenPayload(token) {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
}

function shouldRefreshToken(token) {
  const payload = getTokenPayload(token);
  if (!payload || !Number.isFinite(payload.iat)) return true;
  return Date.now() - payload.iat * 1000 >= REFRESH_AFTER_AGE;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef(null);

  useEffect(() => {
    async function checkAuth() {
      if (token) {
        try {
          const res = await api.getMe();
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('user', JSON.stringify(res.user));
          }
        } catch (err) {
          console.error('Session expired or invalid:', err);
          logout();
        }
      }
      setLoading(false);
    }

    checkAuth();

    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;

    const refreshIfNeeded = async () => {
      const currentToken = localStorage.getItem('token') || token;
      if (!shouldRefreshToken(currentToken)) return;
      if (refreshInFlight.current) return refreshInFlight.current;

      refreshInFlight.current = api.refreshToken().then((res) => {
        if (!res.success || !res.token) throw new Error('Sesi tidak dapat diperbarui.');
        setToken(res.token);
        localStorage.setItem('token', res.token);
      }).catch(() => {
        logout();
      }).finally(() => {
        refreshInFlight.current = null;
      });

      return refreshInFlight.current;
    };

    refreshIfNeeded();
    const refreshInterval = window.setInterval(refreshIfNeeded, REFRESH_CHECK_INTERVAL);
    const handleActivity = () => {
      refreshIfNeeded();
    };

    window.addEventListener('focus', handleActivity);
    document.addEventListener('visibilitychange', handleActivity);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('visibilitychange', handleActivity);
    };
  }, [token]);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      return res;
    }
    throw new Error(res.message || 'Login gagal.');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
