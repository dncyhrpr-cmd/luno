

import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '@/lib/auth-utils';
import { bucket } from '@/lib/gcs';

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

// GET - Get file download URL
export async function GET(request: NextRequest) {
    const adminPayload = await verifyAdmin(request);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
    }

    const filePath = request.nextUrl.searchParams.get('path');
    if (!filePath) {
        return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    try {
        const file = bucket.file(filePath);
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        });
        return NextResponse.json({ downloadURL: url });
    } catch (error: any) {
        console.error('Failed to generate file download URL:', error);
        return NextResponse.json({ error: 'Failed to generate file download URL' }, { status: 500 });
    }
}