import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// Middleware to verify admin privileges
async function verifyAdmin(request: NextRequest): Promise<AuthTokenPayload | null> {
    const token = extractTokenFromRequest(request);
    if (!token) {
        return null;
    }

    try {
        const payload = await verifyAccessToken(token);
        if (!payload.roles?.includes('admin')) {
            return null;
        }
        return payload;
    } catch (error: any) {
        return null;
    }
}

// PUT - Update KYC status
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const kycId = params.id;

    const adminPayload = await verifyAdmin(request);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
    }

    try {
        const { status, reason } = await request.json();

        if (!status || !['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
        }

        if (status === 'rejected' && !reason) {
            return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
        }

        await firestoreDB.updateKYCStatus(kycId, status, adminPayload.userId, reason);

        // Audit log
        await firestoreDB.createAuditLog({
            adminId: adminPayload.userId,
            action: `kyc_${status}`,
            resourceType: 'kyc',
            resourceId: kycId,
            changes: { status, reason },
            status: 'success'
        });

        return NextResponse.json({ message: `KYC request ${status} successfully.` });
    } catch (error: any) {
        console.error('Failed to update KYC status:', error);
        return NextResponse.json({ error: 'Failed to update KYC status' }, { status: 500 });
    }
}