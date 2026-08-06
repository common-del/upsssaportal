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
  async redirects() {
    return [
      // The flow lives under /public so it inherits the public nav and footer.
      // These keep the bare path working, and /public/rating was briefly live
      // under that name.
      { source: '/find-your-school', destination: '/public/find-your-school', permanent: false },
      { source: '/public/rating', destination: '/public/find-your-school', permanent: false },
      // Compare Schools was retired; the comparison now lives on State Overview.
      { source: '/public/compare', destination: '/public/state-overview', permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
