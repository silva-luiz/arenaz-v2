import type { NextConfig } from 'next';

// Same-origin proxy: the browser only ever talks to the web origin, so the
// session cookie stays first-party. The destination is baked into the build
// (routes manifest), so API_URL must be set when running `next build`.
const API_URL = process.env.API_URL || 'http://localhost:4000';

const nextConfig: NextConfig = {
  typedRoutes: true,
  // @arenaz/ui ships TypeScript source (no build step).
  transpilePackages: ['@arenaz/ui'],
  // Demo mode is fixed per build: with the variable undefined at build time
  // Next would leave `process.env.NEXT_PUBLIC_DEMO_MODE` in the client chunks
  // to be read at runtime, and a server started with another value would
  // render something the browser then disagrees with (hydration mismatch).
  // Setting it here always inlines 'true' or 'false', on server and client.
  env: {
    NEXT_PUBLIC_DEMO_MODE:
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? 'true' : 'false',
  },
  // `next dev` otherwise writes an AGENTS.md when it detects an AI agent.
  agentRules: false,
  rewrites() {
    return Promise.resolve([
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
    ]);
  },
};

export default nextConfig;
