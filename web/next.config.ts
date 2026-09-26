import path from 'node:path';
import type { NextConfig } from 'next';

// engine/ と data/ は web/ の外にあるので、リポジトリのルートを基準にする
const root = path.join(__dirname, '..');

const nextConfig: NextConfig = {
  transpilePackages: ['@moshimo/engine'],
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
