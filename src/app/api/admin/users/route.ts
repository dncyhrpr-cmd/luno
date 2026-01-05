import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import NodeCache from 'node-cache';
import admin from 'firebase-admin';

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
        
        // Fetch users from Firestore
        const usersSnapshot = await collections.users.orderBy('createdAt', 'desc').get();
        let usersWithDetails = usersSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

        const total = usersWithDetails.length;

        // Implement pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = usersWithDetails.slice(startIndex, endIndex);

        // Add balance calculations to all users
        const usersWithBalances = usersWithDetails.map((user: any) => {
            const totalBalance = user.balance || 0;
            const frozenBalance = user.frozenBalance || 0;
            const availableBalance = totalBalance - frozenBalance;
            return {
                ...user,
                totalBalance,
                availableBalance,
                frozenBalance
            };
        });

        // If includeDetails, fetch related data
        let users = usersWithBalances.slice(startIndex, endIndex);
        if (includeDetails) {
            users = await Promise.all(usersWithBalances.slice(startIndex, endIndex).map(async (user: any) => {
                // Fetch assets
                const assetsSnapshot = await collections.assets.where('userId', '==', user.id).get();
                const assets = assetsSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

                // Fetch orders (active ones, perhaps limit to recent)
                const ordersSnapshot = await collections.orders.where('userId', '==', user.id).orderBy('createdAt', 'desc').limit(10).get();
                const orders = ordersSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

                // Fetch transaction history (recent deposits/withdraws)
                const txSnapshot = await collections.transactionHistory.where('userId', '==', user.id).orderBy('createdAt', 'desc').limit(20).get();
                const transactionHistory = txSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

                return {
                    ...user,
                    assets,
                    orders,
                    transactionHistory
                };
            }));
        } else {
            users = usersWithBalances.slice(startIndex, endIndex);
        }

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

// PUT - Update user status or role
export async function PUT(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { userId, status, score } = await request.json();
        console.log('DEBUG: Admin users PUT received:', { userId, status, score });

        if (!userId) {
            structuredLog('WARN', reqId, 'Missing userId for user update', { status: 400 });
            return NextResponse.json({ error: 'userId is required', correlationId: reqId }, { status: 400 });
        }

        if (status && !['active', 'inactive', 'banned'].includes(status)) {
            structuredLog('WARN', reqId, 'Invalid status for user update', { status: 400 });
            return NextResponse.json({ error: 'Invalid status. Must be active, inactive, or banned', correlationId: reqId }, { status: 400 });
        }

        if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 100)) {
            structuredLog('WARN', reqId, 'Invalid score for user update', { status: 400 });
            return NextResponse.json({ error: 'Invalid score. Must be a number between 0 and 100', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Updating user', { adminId: adminPayload.userId, userId, status, score });

        // Check if user exists
        const userDoc = await collections.users.doc(userId).get();
        if (!userDoc.exists) {
            structuredLog('WARN', reqId, 'User not found for update', { userId, status: 404 });
            return NextResponse.json({ error: 'User not found', correlationId: reqId }, { status: 404 });
        }

        console.log('DEBUG: User exists, current data:', userDoc.data());

        // Prepare update object
        const updateData: any = { updatedAt: admin.firestore.Timestamp.now() };
        if (status) updateData.status = status;
        if (score !== undefined) updateData.clientScore = score;

        // Update user
        console.log('DEBUG: Updating user', userId, 'with data:', updateData);
        const updateResult = await collections.users.doc(userId).update(updateData);
        console.log('DEBUG: Update result:', updateResult);
        console.log('DEBUG: User updated successfully, fetching to verify...');

        // Verify the update
        const updatedDoc = await collections.users.doc(userId).get();
        const updatedData = updatedDoc.data();
        console.log('DEBUG: Updated user data:', { id: updatedDoc.id, clientScore: updatedData?.clientScore, status: updatedData?.status });

        // Clear cache to ensure updated data is fetched
        adminUsersCache.flushAll();

        // Create audit log
        const auditId = collections.auditLogs.doc().id;
        await collections.auditLogs.doc(auditId).set({
            id: auditId,
            userId,
            adminId: adminPayload.userId,
            action: status && score !== undefined ? 'user_update' : status ? 'user_status_update' : 'user_score_update',
            resourceType: 'user',
            resourceId: userId,
            changes: JSON.stringify(updateData),
            status: 'success',
            createdAt: admin.firestore.Timestamp.now()
        });

        structuredLog('INFO', reqId, 'User updated successfully', { userId, status, score, adminId: adminPayload.userId });
        const messageParts = [];
        if (status) messageParts.push(`status updated to ${status}`);
        if (score !== undefined) messageParts.push(`score set to ${score}`);
        return NextResponse.json({
            message: `User ${messageParts.join(' and ')}`,
            success: true,
            correlationId: reqId
        });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to update user status');
    }
}
