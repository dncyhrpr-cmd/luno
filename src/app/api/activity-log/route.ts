import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
    const token = extractTokenFromRequest(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await verifyAccessToken(token);
        // TODO: Implement activity log with Prisma
        // For now, return empty array during migration
        return NextResponse.json([]);
    } catch (error: any) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
}