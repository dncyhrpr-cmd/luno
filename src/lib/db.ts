import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prisma: PrismaClient;

// Only create real client if DATABASE_URL is available and we're not in a build environment
const shouldCreateRealClient = process.env.DATABASE_URL &&
  process.env.DATABASE_URL.startsWith('postgresql://') &&
  !process.env.CI; // Don't create in CI/build environments

if (shouldCreateRealClient) {
  try {
    prisma = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : [],
    });
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
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

