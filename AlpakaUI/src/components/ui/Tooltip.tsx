'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface TooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
  delay?: number;
}

export function Tooltip({ 
  content, 
  position = 'top', 
  children,
  delay = 200 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800',
  };

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children || (
        <InformationCircleIcon 
          className="w-4 h-4 text-gray-400 hover:text-gray-300 cursor-help transition-colors" 
        />
      )}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
          >
            <div className="relative">
              <div className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 
                            shadow-lg border border-gray-700 max-w-xs whitespace-normal">
                {content}
              </div>
              {/* Arrow */}
              <div 
                className={`absolute w-0 h-0 border-4 border-transparent ${arrowClasses[position]}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Help text component for inline help
interface HelpTextProps {
  text: string;
  className?: string;
}

export function HelpText({ text, className = "" }: HelpTextProps) {
  return (
    <div className={`flex items-start gap-2 text-sm text-gray-400 ${className}`}>
      <InformationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}