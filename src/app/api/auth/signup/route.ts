import { NextRequest, NextResponse } from 'next/server';
import { validatePassword } from '@/lib/auth-utils';
import bcryptjs from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('Signup route called with DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'not set');
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

    const normalizedEmail = email.toLowerCase().trim();

    let userCount;
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }

      // Make first user admin
      userCount = await prisma.user.count();
    } catch (dbError: any) {
      console.error('Database connection error:', dbError.message);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    const isFirstUser = userCount === 0;
    const userRole = isFirstUser ? 'admin' : 'user';
    const userRoles = isFirstUser ? ['admin'] : ['user'];

    // Generate unique username
    const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const username = `${baseUsername}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Hash password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create user in Prisma
    const newUser = await prisma.user.create({
      data: {
        username,
        email: normalizedEmail,
        password: passwordHash,
        role: userRole,
        roles: JSON.stringify(userRoles),
        balance: 0,
        twoFactorEnabled: false,
        migrationStatus: 'migrated',
      }
    });

    if (!newUser) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Also create user in Supabase Auth for password reset
    const { error: supabaseError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (supabaseError) {
      console.error('Supabase signUp error:', supabaseError);
      // Don't fail the signup, just log the error
    }

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