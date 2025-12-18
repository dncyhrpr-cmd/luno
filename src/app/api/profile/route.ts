import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore-admin';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
    const token = extractTokenFromRequest(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await verifyAccessToken(token);
        const userId = payload.userId;
        const db = getDb();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // Create a sample profile for the user if no data is found
            const sampleProfile = {
                tier: 'Platinum Trader',
                feeDiscount: '20%',
                since: 'Oct 2025',
                authStatus: 'Verified (Level 2 KYC)',
                securityScore: 'High',
            };

            await userRef.set(sampleProfile);
            return NextResponse.json(sampleProfile);
        }

        return NextResponse.json(userDoc.data());
    } catch (error: any) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
}