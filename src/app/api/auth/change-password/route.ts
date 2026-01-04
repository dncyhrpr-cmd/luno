import { NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken, validatePassword } from '@/lib/auth-utils';
import bcryptjs from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const token = extractTokenFromRequest(request as any);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    // Find the user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const passwordHash = user.password;
    if (!passwordHash) {
      return NextResponse.json({ error: 'Password not set for this account' }, { status: 400 });
    }

    const isCurrentPasswordValid = await bcryptjs.compare(currentPassword, passwordHash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
    }

    // Validate new password
    const validationResult = validatePassword(newPassword);
    if (validationResult !== true) {
      return NextResponse.json({ error: validationResult }, { status: 400 });
    }

    // Hash the new password
    const newPasswordHash = await bcryptjs.hash(newPassword, 10);

    // Update user with new password hash
    await prisma.user.update({
      where: { id: userId },
      data: { password: newPasswordHash }
    });

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Password change failed' }, { status: 500 });
  }
}