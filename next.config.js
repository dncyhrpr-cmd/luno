/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // Removed for Netlify Functions deployment
  compress: true, // Enable gzip/brotli compression
  images: {
    unoptimized: false, // Enable image optimization for Netlify
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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

      // Add Firebase Admin SDK to externals using non-deprecated syntax
      config.externals.push(({ context, request }, callback) => {
        if (request && (request.startsWith('firebase-admin') ||
            request.startsWith('@google-cloud/firestore') ||
            request.startsWith('@firebase/'))) {
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
