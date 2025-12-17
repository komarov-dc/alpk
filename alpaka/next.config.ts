import type { NextConfig } from "next";
import crypto from 'crypto';

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Create a standalone folder which can be deployed without node_modules
  // This is critical for university/offline deployments
  output: 'standalone',

  // Image optimization configuration
  images: {
    domains: ['localhost', 'api.openai.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Enable compression
  compress: true,

  // Security headers
  async headers() {
    // Get frontend origin from .env for CORS
    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:4000';

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0'
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: frontendOrigin
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Alpaka-Secret, X-Alpaka-Internal-Secret'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          }
        ]
      }
    ];
  },

  // Webpack configuration (only used when not using Turbopack)
  // These optimizations are for production builds with standard Webpack
  webpack: process.env.TURBOPACK ? undefined : (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      // Enable tree shaking
      config.optimization.usedExports = true;

      // Optimize chunk splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Framework chunk
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // Library chunk
          lib: {
            test(module: { size: () => number; identifier: () => string }) {
              return module.size() > 160000 &&
                /node_modules[\\/]/.test(module.identifier());
            },
            name(module: { identifier: () => string }) {
              const hash = crypto.createHash('sha1');
              hash.update(module.identifier());
              return hash.digest('hex').substring(0, 8);
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          // Common chunk
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
          // Shared chunk
          shared: {
            name() {
              return 'shared';
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      };

      // Minimize bundle size
      config.optimization.minimize = true;
    }

    // Bundle analyzer (only when ANALYZE=true)
    if (process.env.ANALYZE === 'true') {
      // Dynamic import for optional dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer ? '../analyze/server.html' : '../analyze/client.html',
          openAnalyzer: false,
        })
      );
    }

    return config;
  },

  // Environment variables to expose to the browser
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.0.1',
  },

  // Server external packages - don't bundle these server-side dependencies
  serverExternalPackages: ['pm2'],

  // Experimental features
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: ['@heroicons/react', 'framer-motion', 'zustand'],
  },
};

export default nextConfig;
