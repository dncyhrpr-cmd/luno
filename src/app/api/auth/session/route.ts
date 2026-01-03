import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

async function handleSessionCheck(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Safely parse roles string to array
    let roles: string[] = [];
    try {
      if (typeof user.roles === 'string') {
        roles = JSON.parse(user.roles);
      } else if (Array.isArray(user.roles)) {
        roles = user.roles;
      }
    } catch (e) {
      roles = [user.role || 'user'];
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        roles: roles,
        status: user.status,
      },
      authenticated: true,
    }, { status: 200 });

  } catch (error: any) {
    if (error.message?.includes('Token has been revoked')) {
      return NextResponse.json({ error: 'Token has been revoked' }, { status: 401 });
    }
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'Session validation failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleSessionCheck(request);
}

export async function POST(request: NextRequest) {
  return handleSessionCheck(request);
}
