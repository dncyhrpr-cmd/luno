import { PrismaClient } from '@prisma/client';

// Try to import optimize extension
let withOptimize: any = null;
try {
  withOptimize = require('@prisma/extension-optimize').withOptimize;
} catch (e) {
  console.warn('Prisma Optimize extension not available');
}

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

let prisma: any;

// Only create real client if DATABASE_URL is available and we're not in a build environment
const shouldCreateRealClient = process.env.DATABASE_URL &&
  process.env.DATABASE_URL.startsWith('postgresql://') &&
  !process.env.CI; // Don't create in CI/build environments

if (shouldCreateRealClient) {
  try {
    let client = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : [],
    });

    // Extend with optimize if available and API key is provided
    if (withOptimize && process.env.OPTIMIZE_API_KEY) {
      client = client.$extends(
        withOptimize({ apiKey: process.env.OPTIMIZE_API_KEY })
      );
      console.log('Prisma Optimize extension enabled');
    }

    prisma = client;
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  } catch (error) {
    console.warn('Prisma client creation failed, using fallback');
    prisma = createFallbackClient();
  }
} else {
  // During build or when DATABASE_URL is not available, use fallback
  console.warn('Using fallback Prisma client (build time or missing DATABASE_URL)');
  prisma = createFallbackClient();
}

function createFallbackClient(): PrismaClient {
  // Create a mock client that won't fail during build
  return new Proxy({} as PrismaClient, {
    get(target, prop) {
      if (prop === '$connect' || prop === '$disconnect') {
        return async () => {};
      }
      // Return a function that throws an error if actually called during runtime
      return () => {
        throw new Error('Database not connected. Please check DATABASE_URL environment variable.');
      };
    }
  });
}

export { prisma };

export const getPrismaClient = () => prisma;

export async function logUserActivity(userId: string, action: string, details: string) {
    // For now, we'll log to console. In future, this could be stored in a dedicated activity table
    console.log(`User Activity - UserID: ${userId}, Action: ${action}, Details: ${details}, Time: ${new Date().toISOString()}`);
}

