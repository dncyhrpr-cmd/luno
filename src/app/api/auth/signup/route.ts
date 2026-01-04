import { NextRequest, NextResponse } from 'next/server';
import { validatePassword } from '@/lib/auth-utils';
import bcryptjs from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  console.time('signup-total');
  try {
    console.log('Signup route called with DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'not set');
    console.time('signup-validation');
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, and password are required' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || !email.includes('@') || email.length < 5) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const validationResult = validatePassword(password);
    if (validationResult !== true) {
      return NextResponse.json({ error: validationResult }, { status: 400 });
    }
    console.timeEnd('signup-validation');

    const normalizedEmail = email.toLowerCase().trim();

    let userCount;
    console.time('signup-db-checks');
    try {
      // Check if user already exists
      const existingUserSnapshot = await collections.users.where('email', '==', normalizedEmail).get();
      if (!existingUserSnapshot.empty) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }

      // Make first user admin
      const allUsersSnapshot = await collections.users.get();
      userCount = allUsersSnapshot.size;
    } catch (dbError: any) {
      console.error('Database connection error:', dbError.message);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    console.timeEnd('signup-db-checks');
    const isFirstUser = userCount === 0;
    const userRole = isFirstUser ? 'admin' : 'user';
    const userRoles = isFirstUser ? ['admin'] : ['user'];

    // Generate unique username
    const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const username = `${baseUsername}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Hash password
    console.time('signup-hash');
    const passwordHash = await bcryptjs.hash(password, 10);
    console.timeEnd('signup-hash');

    // Create user in Firestore
    const userId = collections.users.doc().id;
    const userData = {
      id: userId,
      username,
      email: normalizedEmail,
      password: passwordHash,
      role: userRole,
      roles: JSON.stringify(userRoles),
      balance: 0,
      twoFactorEnabled: false,
      migrationStatus: 'migrated',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    await collections.users.doc(userId).set(userData);
    const newUser = { ...userData };

    if (!newUser) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // User created successfully in Firestore
    // Password reset functionality is handled through custom Firestore implementation

    console.timeEnd('signup-total');
    return NextResponse.json(
      {
        message: 'User created successfully',
        userId: newUser.id,
        email: newUser.email,
        username: newUser.username,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Signup route error:', error);
    return NextResponse.json({ error: 'Signup failed. An unexpected error occurred.' }, { status: 500 });
  }
}