import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['var(--font-jetbrains-mono)', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
        'pulse-purple': 'pulse-purple 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'typing': 'typing 1.5s steps(40, end)',
        'blink': 'blink 1s ease-in-out infinite',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': {
            boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.2), 0 0 20px rgba(34, 197, 94, 0.3)',
          },
          '50%': {
            boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.4), 0 0 30px rgba(34, 197, 94, 0.5)',
          },
        },
        'pulse-purple': {
          '0%, 100%': {
            boxShadow: '0 0 0 2px rgba(147, 51, 234, 0.2), 0 0 20px rgba(147, 51, 234, 0.3)',
          },
          '50%': {
            boxShadow: '0 0 0 4px rgba(147, 51, 234, 0.4), 0 0 30px rgba(147, 51, 234, 0.5)',
          },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { 
            transform: 'translateY(10px)',
            opacity: '0' 
          },
          '100%': { 
            transform: 'translateY(0)',
            opacity: '1' 
          },
        },
        'typing': {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
} satisfies Config;

export default config;