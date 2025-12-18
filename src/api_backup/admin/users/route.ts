import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import { auth } from '../../../../lib/firestore-admin';
import { getRequestId, handleApiError, structuredLog } from '../../../../lib/correlation';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '../../../../lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// Middleware to verify admin privileges
async function verifyAdmin(request: NextRequest, reqId: string): Promise<AuthTokenPayload | null> {
    const token = extractTokenFromRequest(request);
    if (!token) {
        structuredLog('WARN', reqId, 'Unauthorized: Missing token for admin user action', { status: 401 });
        return null;
    }

    try {
        const payload = await verifyAccessToken(token);
        if (!payload.roles?.includes('admin')) {
            structuredLog('WARN', reqId, 'Forbidden: User is not an admin', { userId: payload.userId, status: 403 });
            return null;
        }
        return payload;
    } catch (error: any) {
        structuredLog('WARN', reqId, 'Auth token error on admin user action', { error: error.message, status: 401 });
        return null;
    }
}

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

        structuredLog('INFO', reqId, 'Fetching users', { adminId: adminPayload.userId });
        const { users, total } = await firestoreDB.getUsers();

        structuredLog('INFO', reqId, 'Successfully fetched users', { count: users.length, total });
        return NextResponse.json({ users, total, correlationId: reqId });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to fetch users');
    }
}

// POST - Create a new user (admin only)
export async function POST(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { username, email, password, role = 'user' } = await request.json();

        if (!username || !email || !password) {
            structuredLog('WARN', reqId, 'Missing required fields for user creation', { status: 400 });
            return NextResponse.json({ error: 'Username, email, and password are required', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Attempting to create new user', { adminId: adminPayload.userId, username, email, role });
        
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: username,
        });

        const newUser = await firestoreDB.createUser({
            username,
            email,
            role,
            roles: [role],
            balance: 0,
            twoFactorEnabled: false,
            migrationStatus: 'migrated'
        }, userRecord.uid);

        if (!newUser) {
            return NextResponse.json({ error: 'Failed to create user', correlationId: reqId }, { status: 500 });
        }

        await firestoreDB.createAuditLog({
            adminId: adminPayload.userId,
            action: 'user_created',
            resourceType: 'user',
            resourceId: newUser.id,
            changes: { email, role },
            status: 'success'
        });

        structuredLog('INFO', reqId, 'Successfully created new user', { newUserId: newUser.id });
        return NextResponse.json({ message: 'User created successfully', user: newUser, correlationId: reqId }, { status: 201 });

    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            structuredLog('WARN', reqId, 'User creation conflict', { error: error.message, status: 409 });
            return NextResponse.json({ error: 'User with this email already exists', correlationId: reqId }, { status: 409 });
        }
        return handleApiError(reqId, error, route, 'Failed to create user');
    }
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
        const { userId, status, role } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required', correlationId: reqId }, { status: 400 });
        }

        let changes: any = {};
        if (status) {
            if (!['active', 'inactive', 'banned'].includes(status)) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }
            await firestoreDB.updateUser(userId, { status });
            changes.status = status;
        }

        if (role) {
            if (!['user', 'trader', 'admin'].includes(role)) {
                return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
            }
            await firestoreDB.updateUser(userId, { roles: [role] });
            changes.role = role;
        }

        if (Object.keys(changes).length === 0) {
            return NextResponse.json({ error: 'No updateable fields provided' }, { status: 400 });
        }

        await firestoreDB.createAuditLog({
            adminId: adminPayload.userId,
            action: 'user_updated',
            resourceType: 'user',
            resourceId: userId,
            changes,
            status: 'success'
        });

        structuredLog('INFO', reqId, 'Successfully updated user', { adminId: adminPayload.userId, targetUserId: userId, changes });
        return NextResponse.json({ message: 'User updated successfully', correlationId: reqId });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to update user');
    }
}
