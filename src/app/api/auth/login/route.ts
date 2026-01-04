import { NextRequest, NextResponse } from 'next/server';
import { generateAuthTokens } from '@/lib/auth-utils';
import bcryptjs from 'bcryptjs';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    console.log('Login attempt for email:', email);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ error: 'Invalid password format' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log('Finding user by email');
    // Fetch user from Firestore by email
    const userSnapshot = await collections.users.where('email', '==', normalizedEmail).get();
    const user = !userSnapshot.empty ? { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() } as any : null;
    console.log('User found:', !!user, user ? user.email : 'none');

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify password hash
    const passwordField = user.password;
    if (!passwordField) {
      return NextResponse.json(
        {
          error: 'Password not set for this account. Please use password reset functionality.',
          code: 'NO_PASSWORD_SET'
        },
        { status: 401 }
      );
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcryptjs.compare(password, passwordField);
    } catch (bcryptError: any) {
      console.error('Password comparison error:', bcryptError);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
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

    console.log('About to generate tokens');
    const tokens = await generateAuthTokens({
      id: user.id,
      roles: JSON.stringify(userRoles),
      migrationStatus: user.migrationStatus as any,
    });
    console.log('Tokens generated successfully');

    console.log('Generated tokens for user:', user.id, 'roles:', userRoles);

    // Update last login timestamp
    try {
      await collections.users.doc(user.id).update({
        lastLogin: admin.firestore.Timestamp.now()
      });
    } catch (error) {
      console.error('Failed to update last login:', error);
    }

    return NextResponse.json({
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
    }, { status: 200 });

  } catch (error: any) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}