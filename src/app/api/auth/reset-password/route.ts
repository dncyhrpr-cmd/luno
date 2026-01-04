import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import bcryptjs from 'bcryptjs';
import { validatePassword } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json();

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const passwordValidation = validatePassword(password);
    if (passwordValidation !== true) {
      return NextResponse.json({ error: passwordValidation }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const userQuery = await collections.users.where('email', '==', normalizedEmail).get();
    if (userQuery.empty) {
      return NextResponse.json({ error: 'Invalid reset token or email' }, { status: 400 });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // Check if reset token matches and is not expired
    if (!userData.resetToken || userData.resetToken !== token) {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 400 });
    }

    const now = new Date();
    const tokenExpiry = userData.resetTokenExpiry?.toDate();

    if (!tokenExpiry || tokenExpiry < now) {
      return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 });
    }

    // Hash new password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Update user password and clear reset token
    await collections.users.doc(userDoc.id).update({
      password: passwordHash,
      resetToken: null,
      resetTokenExpiry: null
    });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}