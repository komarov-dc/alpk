import type { Config } from 'tailwindcss';

const config: Config = {
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
        'data-flow': 'data-flow 2s linear infinite',
        'arrow-pulse': 'arrow-pulse 2s ease-in-out infinite',
        'executing-glow': 'executing-glow 2s ease-in-out infinite alternate',
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
        'data-flow': {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '10' },
        },
        'arrow-pulse': {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.1)' },
        },
        'executing-glow': {
          '0%': {
            borderColor: '#32CD32',
            boxShadow: '0 0 2px #32CD32, 0 0 4px #32CD32',
          },
          '100%': {
            borderColor: '#00FF00',
            boxShadow: '0 0 3px #00FF00, 0 0 6px #00FF00',
          },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;