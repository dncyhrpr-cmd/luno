/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        http2: false,
        child_process: false,
        events: false,
        process: false,
        stream: false,
        util: false,
      };
    }
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;
