import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
    // The custom webpack hook disables this by default. Release compiler memory
    // before linting and type checking on Vercel's 8 GB build machines.
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
  },
  images: {
    remotePatterns: [],
    domains: [],
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async rewrites() {
    return [
      {
        source: "/feed.xml",
        destination: "/api/feed.xml",
      },
    ];
  },
  webpack: (config, { isServer, webpack: webpackInstance }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
      // @opensea/sdk pulls `node:events`; webpack treats `node:` as an unhandled URI scheme before `resolve.alias` runs.
      config.plugins.push(
        new webpackInstance.NormalModuleReplacementPlugin(
          /^node:events$/,
          require.resolve("events"),
        ),
      );
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };

    return config;
  },
};

export default nextConfig;
