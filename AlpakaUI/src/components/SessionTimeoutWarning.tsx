'use client';

import React, { useState, useEffect } from 'react';
import { useAutoLogoutContext } from '@/providers/AutoLogoutProvider';

interface SessionTimeoutWarningProps {
  warningTime?: number; // Show warning X ms before timeout
  className?: string;
}

export function SessionTimeoutWarning({ 
  warningTime = 300000, // 5 minutes before timeout by default
  className = '' 
}: SessionTimeoutWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const { resetTimeout } = useAutoLogoutContext();
  
  const sessionTimeout = parseInt(
    process.env.NEXT_PUBLIC_SESSION_TIMEOUT || '1800000', 
    10
  );

  useEffect(() => {
    let warningTimeout: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;

    const startWarningTimer = () => {
      // Clear any existing timers
      if (warningTimeout) clearTimeout(warningTimeout);
      if (countdownInterval) clearInterval(countdownInterval);
      
      // Hide warning if it's showing
      setShowWarning(false);
      
      // Set timer to show warning
      warningTimeout = setTimeout(() => {
        setShowWarning(true);
        setRemainingTime(warningTime);
        
        // Start countdown
        countdownInterval = setInterval(() => {
          setRemainingTime(prev => {
            const newTime = prev - 1000;
            if (newTime <= 0) {
              clearInterval(countdownInterval);
              return 0;
            }
            return newTime;
          });
        }, 1000);
      }, sessionTimeout - warningTime);
    };

    // Listen for user activity
    const handleActivity = () => {
      startWarningTimer();
      setShowWarning(false);
      if (countdownInterval) clearInterval(countdownInterval);
    };

    // Activity events
    const events = ['mousedown', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Start initial timer
    startWarningTimer();

    // Cleanup
    return () => {
      if (warningTimeout) clearTimeout(warningTimeout);
      if (countdownInterval) clearInterval(countdownInterval);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [sessionTimeout, warningTime]);

  const handleStayLoggedIn = () => {
    resetTimeout();
    setShowWarning(false);
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!showWarning) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
        <div className="flex items-center mb-4">
          <svg
            className="w-6 h-6 text-yellow-500 mr-2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Сессия истекает
          </h3>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Ваша сессия истечет через <span className="font-mono font-bold">{formatTime(remainingTime)}</span>.
          Хотите продолжить работу?
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowWarning(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Выйти
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Продолжить работу
          </button>
        </div>
      </div>
    </div>
  );
}