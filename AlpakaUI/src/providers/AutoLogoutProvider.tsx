'use client';

import React, { createContext, useContext } from 'react';
import { useAutoLogout } from '@/hooks/useAutoLogout';

interface AutoLogoutContextType {
  resetTimeout: () => void;
  logout: () => void;
}

const AutoLogoutContext = createContext<AutoLogoutContextType | null>(null);

interface AutoLogoutProviderProps {
  children: React.ReactNode;
  timeout?: number;
  enabled?: boolean;
}

export function AutoLogoutProvider({
  children,
  timeout,
  enabled = true,
}: AutoLogoutProviderProps) {
  const { resetTimeout, logout } = useAutoLogout({
    timeout,
    enabled,
    onLogout: () => {
      // Additional cleanup when auto-logout happens
      // Trigger any global cleanup
      if (typeof window !== 'undefined') {
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('auto-logout'));
      }
    },
  });

  return (
    <AutoLogoutContext.Provider value={{ resetTimeout, logout }}>
      {children}
    </AutoLogoutContext.Provider>
  );
}

export function useAutoLogoutContext() {
  const context = useContext(AutoLogoutContext);
  if (!context) {
    throw new Error('useAutoLogoutContext must be used within AutoLogoutProvider');
  }
  return context;
}