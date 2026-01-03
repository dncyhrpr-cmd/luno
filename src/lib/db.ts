import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const getPrismaClient = () => prisma;

export async function logUserActivity(userId: string, action: string, details: string) {
    // For now, we'll log to console. In future, this could be stored in a dedicated activity table
    console.log(`User Activity - UserID: ${userId}, Action: ${action}, Details: ${details}, Time: ${new Date().toISOString()}`);
}
