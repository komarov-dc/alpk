import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/utils/logger';
import { SESSION } from '@/config/constants';

interface UseAutoLogoutOptions {
  timeout?: number; // in milliseconds
  onLogout?: () => void;
  enabled?: boolean;
}

export function useAutoLogout({
  timeout = parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT || String(SESSION.AUTO_LOGOUT_TIMEOUT), 10),
  onLogout,
  enabled = true,
}: UseAutoLogoutOptions = {}) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(() => {
    // Clear tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Call custom logout handler if provided
    if (onLogout) {
      onLogout();
    }
    
    // Redirect to login
    router.push('/auth/login');
  }, [router, onLogout]);

  const resetTimeout = useCallback(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Don't set timeout if not enabled or no token
    if (!enabled || typeof window === 'undefined') return;
    
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Update last activity time
    lastActivityRef.current = Date.now();

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      // Check if there was any recent activity
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      
      if (timeSinceLastActivity >= timeout) {
        logger.info('Session expired due to inactivity');
        logout();
      } else {
        // Reset timeout if there was recent activity
        resetTimeout();
      }
    }, timeout);
  }, [timeout, logout, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Events to track user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown',
    ];

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      resetTimeout();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Start timeout
    resetTimeout();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetTimeout, enabled]);

  return {
    resetTimeout,
    logout,
  };
}