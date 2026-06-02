import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Pin workspace root to this app directory (parent repo also has a package-lock.json).
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  outputFileTracingIncludes: {
    '/app/sssa/frameworks': ['./data/sqaaf/**/*'],
  },
};

export default withNextIntl(nextConfig);
