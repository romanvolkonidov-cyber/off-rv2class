import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://158.220.94.77.sslip.io/api/:path*', // Secure endpoint
      },
    ];
  },
};

export default nextConfig;
