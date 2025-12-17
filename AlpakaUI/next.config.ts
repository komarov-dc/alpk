import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Enable standalone output for Docker/deployment
  output: "standalone",

  // Image optimization configuration
  images: {
    domains: ["localhost"],
    formats: ["image/avif", "image/webp"],
  },

  // Enable compression
  compress: true,

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // API rewrites to Backend processing system
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://localhost:3000/api/:path*", // Backend Processing API
      },
    ];
  },

  // Environment variables to expose to the browser
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "0.1.0",
    NEXT_PUBLIC_BACKEND_URL: process.env.BACKEND_URL || "http://localhost:3000",
  },
};

export default nextConfig;
