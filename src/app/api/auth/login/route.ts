import { NextRequest, NextResponse } from 'next/server';
import { generateAuthTokens } from '@/lib/auth-utils';
import bcryptjs from 'bcryptjs';

function createCORSResponse(data: any, status: number = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return createCORSResponse({ error: 'Email and password are required' }, 400);
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return createCORSResponse({ error: 'Invalid email format' }, 400);
    }

    if (typeof password !== 'string' || password.length === 0) {
      return createCORSResponse({ error: 'Invalid password format' }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Lazy import to avoid webpack issues
    const { collections } = await import('@/lib/db');

    // Fetch user from Firestore by email
    const userSnapshot = await collections.users.where('email', '==', normalizedEmail).get();
    const user = !userSnapshot.empty ? { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() } as any : null;

    if (!user) {
      return createCORSResponse({ error: 'Invalid email or password' }, 401);
    }

    // Verify password hash
    const passwordField = user.password;
    if (!passwordField) {
      return createCORSResponse(
        {
          error: 'Password not set for this account. Please use password reset functionality.',
          code: 'NO_PASSWORD_SET'
        },
        401
      );
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcryptjs.compare(password, passwordField);
    } catch (bcryptError: any) {
      console.error('Password comparison error:', bcryptError);
      return createCORSResponse({ error: 'Invalid email or password' }, 401);
    }
    if (!isPasswordValid) {
      return createCORSResponse({ error: 'Invalid email or password' }, 401);
    }

    // Ensure roles is an array
    let userRoles: string[] = [];
    if (Array.isArray(user.roles)) {
      userRoles = user.roles;
    } else if (typeof user.roles === 'string') {
      try {
        userRoles = JSON.parse(user.roles);
      } catch {
        userRoles = [user.roles];
      }
    } else {
      userRoles = [user.role || 'trader'];
    }

    console.log('User roles parsed:', userRoles);

    const tokens = await generateAuthTokens({
      id: user.id,
      roles: JSON.stringify(userRoles),
      migrationStatus: user.migrationStatus as any,
    });

    console.log('Generated tokens for user:', user.id, 'roles:', userRoles);

    // Update last login timestamp
    try {
      await collections.users.doc(user.id).update({
        lastLogin: new Date()
      });
    } catch (error) {
      console.error('Failed to update last login:', error);
    }
    return createCORSResponse({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        roles: userRoles,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }, 200);

  } catch (error: any) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    return createCORSResponse({ error: 'Login failed' }, 500);
  }
}