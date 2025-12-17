/**
 * ScrollIndicator Component
 * Shows a visual indicator when content is scrollable
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScrollIndicatorProps {
  containerRef: React.RefObject<HTMLElement>;
  className?: string;
}

export const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({ 
  containerRef, 
  className = '' 
}) => {
  const [canScroll, setCanScroll] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkScrollable = useCallback(() => {
    if (containerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = containerRef.current;
      const isScrollable = scrollHeight > clientHeight;
      setCanScroll(isScrollable);
      
      if (isScrollable) {
        const progress = scrollTop / (scrollHeight - clientHeight);
        setScrollProgress(Math.min(1, Math.max(0, progress)));
      }
    }
  }, [containerRef]);

  const handleScroll = useCallback(() => {
    checkScrollable();
    setIsScrolling(true);
    
    // Hide indicator after scrolling stops
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1500);
  }, [checkScrollable]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial check
    checkScrollable();

    // Add listeners
    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', checkScrollable);

    // Observe content changes
    const observer = new ResizeObserver(checkScrollable);
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkScrollable);
      observer.disconnect();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [containerRef, checkScrollable, handleScroll]);

  if (!canScroll) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isScrolling ? 1 : 0.4 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`absolute right-1 top-0 bottom-0 w-2 pointer-events-none z-10 ${className}`}
      >
        {/* Track */}
        <div className="absolute inset-0 bg-gray-800 rounded-full opacity-50" />
        
        {/* Thumb */}
        <motion.div
          className="absolute left-0 right-0 bg-gradient-to-b from-blue-400 to-purple-400 rounded-full min-h-[30px]"
          style={{
            top: `${scrollProgress * (100 - 30)}%`,
            height: '30%',
          }}
          animate={{
            opacity: isScrolling ? 1 : 0.6,
          }}
        />
        
        {/* Scroll hint arrows */}
        {!isScrolling && (
          <>
            {scrollProgress < 0.95 && (
              <motion.div
                className="absolute bottom-1 left-1/2 -translate-x-1/2"
                animate={{ y: [0, 3, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                  <path d="M3 0L6 3L3 6L0 3L3 0Z" fill="rgba(156, 163, 175, 0.6)" />
                </svg>
              </motion.div>
            )}
            {scrollProgress > 0.05 && (
              <motion.div
                className="absolute top-1 left-1/2 -translate-x-1/2 rotate-180"
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                  <path d="M3 0L6 3L3 6L0 3L3 0Z" fill="rgba(156, 163, 175, 0.6)" />
                </svg>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};