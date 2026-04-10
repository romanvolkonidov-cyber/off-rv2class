import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://158.220.94.77:4000/api/:path*', // Hardcode to be 100% sure
      },
    ];
  },
};

export default nextConfig;
