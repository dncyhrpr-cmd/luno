/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true, // Enable gzip/brotli compression
  images: {
    unoptimized: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  webpack: (config, { isServer }) => {
    // Resolve Node.js modules for server-side only
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
        crypto: false,
        path: false,
        os: false,
        url: false,
        querystring: false,
        http: false,
        https: false,
        zlib: false,
        assert: false,
        constants: false,
      };
    }

    // Completely exclude Firebase Admin SDK from client-side bundles
    if (!isServer) {
      config.externals = config.externals || [];

      // Add Firebase Admin SDK to externals
      config.externals.push((context, request, callback) => {
        if (request.startsWith('firebase-admin') ||
            request.startsWith('@google-cloud/firestore') ||
            request.startsWith('@firebase/')) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
    }

    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;
