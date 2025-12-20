import { NextRequest, NextResponse } from 'next/server';
import { validatePassword } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // 1. Validate input
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

    // 2. Generate unique username
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const username = `${baseUsername}${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

    // 3. Create user (in production, save to database)
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return NextResponse.json(
      {
        message: 'User created successfully',
        userId: userId
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Signup route error:', error);
    return NextResponse.json({ error: 'Signup failed. An unexpected error occurred.' }, { status: 500 });
  }
}