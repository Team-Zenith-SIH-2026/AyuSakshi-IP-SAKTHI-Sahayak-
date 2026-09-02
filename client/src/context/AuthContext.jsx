import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ayusakshi_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('ayusakshi_token') || null);
  const [loading, setLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (token && !user) {
      authAPI.getProfile()
        .then((res) => {
          if (res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('ayusakshi_user', JSON.stringify(res.data.user));
          }
        })
        .catch(() => {
          logout();
        });
    }
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      const { token: jwtToken, user: userData } = res.data;
      setToken(jwtToken);
      setUser(userData);
      localStorage.setItem('ayusakshi_token', jwtToken);
      localStorage.setItem('ayusakshi_user', JSON.stringify(userData));
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Login failed. Please check your credentials.',
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, role = 'user') => {
    setLoading(true);
    try {
      const res = await authAPI.register({ name, email, password, role });
      const { token: jwtToken, user: userData } = res.data;
      setToken(jwtToken);
      setUser(userData);
      localStorage.setItem('ayusakshi_token', jwtToken);
      localStorage.setItem('ayusakshi_user', JSON.stringify(userData));
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Registration failed. Please try again.',
      };
    } finally {
      setLoading(false);
    }
  };

  const socialLogin = async (provider, email, name, avatar_url) => {
    setLoading(true);
    try {
      const res = await authAPI.socialAuth({ provider, email, name, avatar_url });
      const { token: jwtToken, user: userData } = res.data;
      setToken(jwtToken);
      setUser(userData);
      localStorage.setItem('ayusakshi_token', jwtToken);
      localStorage.setItem('ayusakshi_user', JSON.stringify(userData));
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || `${provider} authentication failed.`,
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('ayusakshi_token');
    localStorage.removeItem('ayusakshi_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token,
        isAuthModalOpen,
        setIsAuthModalOpen,
        login,
        register,
        socialLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
