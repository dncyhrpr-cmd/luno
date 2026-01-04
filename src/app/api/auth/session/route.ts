import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { collections } from '@/lib/db';

async function handleSessionCheck(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);

    const userId = payload.userId;

    // Fetch user data from Firestore
    const userDoc = await collections.users.doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userData = userDoc.data() as any;

    // Parse roles
    let userRoles: string[] = [];
    if (Array.isArray(userData.roles)) {
      userRoles = userData.roles;
    } else if (typeof userData.roles === 'string') {
      try {
        userRoles = JSON.parse(userData.roles);
      } catch {
        userRoles = [userData.role || 'trader'];
      }
    } else {
      userRoles = [userData.role || 'trader'];
    }

    return NextResponse.json({
      user: {
        id: userId,
        email: userData.email,
        username: userData.username,
        role: userData.role || 'trader',
        roles: userRoles,
        migrationStatus: userData.migrationStatus || 'migrated',
        status: 'active',
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
