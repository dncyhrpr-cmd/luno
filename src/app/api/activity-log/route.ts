import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    // TODO: Implement activity log with authentication and Prisma
    // For now, return empty array during development
    return NextResponse.json([]);
}