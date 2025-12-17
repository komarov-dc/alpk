import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'blue' | 'purple' | 'gray';
  text?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12'
};

const colorClasses = {
  white: 'text-white',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  gray: 'text-gray-400'
};

export function Loading({ 
  size = 'md', 
  color = 'white', 
  text,
  className = '' 
}: LoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && (
        <p className={`mt-2 text-sm ${colorClasses[color]}`}>{text}</p>
      )}
    </div>
  );
}

// Dots animation variant
export function LoadingDots({ 
  size = 'md',
  color = 'white',
  className = ''
}: Omit<LoadingProps, 'text'>) {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3';
  
  return (
    <div className={`flex space-x-1 ${className}`}>
      <div className={`${dotSize} ${colorClasses[color]} rounded-full animate-pulse`} style={{ animationDelay: '0ms' }} />
      <div className={`${dotSize} ${colorClasses[color]} rounded-full animate-pulse`} style={{ animationDelay: '150ms' }} />
      <div className={`${dotSize} ${colorClasses[color]} rounded-full animate-pulse`} style={{ animationDelay: '300ms' }} />
    </div>
  );
}