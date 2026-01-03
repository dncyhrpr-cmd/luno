import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import NodeCache from 'node-cache';

const adminUsersCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

// GET - Fetch all users with pagination
export async function GET(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const includeDetails = searchParams.get('includeDetails') === 'true';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const cacheKey = `admin_users_${includeDetails}_${page}_${limit}`;
        
        // Skip cache if requested
        const noCache = searchParams.get('noCache') === 'true';
        if (!noCache) {
            const cachedData = adminUsersCache.get(cacheKey);
            if (cachedData) {
                return NextResponse.json({ ...cachedData, correlationId: reqId });
            }
        }

        structuredLog('INFO', reqId, 'Fetching users', { adminId: adminPayload.userId, includeDetails, page, limit });
        
        // Fetch users with assets, orders, and transaction history
        const usersWithDetails = await prisma.user.findMany({
          include: {
            assets: true,
            orders: {
              where: {
                status: {
                  in: ['pending', 'executed']
                }
              }
            },
            transactionHistory: {
              where: {
                type: {
                  in: ['deposit', 'withdraw']
                }
              },
              select: {
                type: true,
                amount: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        const total = usersWithDetails.length;

        // Implement pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const users = usersWithDetails.slice(startIndex, endIndex);

        const responseData = {
          users,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        };

        // Cache the response
        adminUsersCache.set(cacheKey, responseData);

        structuredLog('INFO', reqId, 'Successfully fetched users', { count: users.length, total, page, limit });
        return NextResponse.json({ ...responseData, correlationId: reqId });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to fetch users');
    }
}

// POST - Create a new user (admin only) - DISABLED
export async function POST(request: NextRequest) {
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}

// PUT - Update user status or role - DISABLED
export async function PUT(request: NextRequest) {
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
