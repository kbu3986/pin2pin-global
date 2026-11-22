import path from 'node:path';
import type { NextConfig } from 'next';

const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');
const basePath = rawBasePath && rawBasePath !== '/' ? (rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`) : '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
