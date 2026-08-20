import type { NextConfig } from 'next';

const config: NextConfig = {
  // The core package ships TypeScript source so the analyser, the CLI and the tests all
  // run against exactly the same code with no build step in between.
  transpilePackages: ['@savedyouatoken/core'],
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
