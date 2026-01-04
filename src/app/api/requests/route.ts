import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { prisma } from '@/lib/db';

// GET - Fetch user's transaction requests
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const requests = await prisma.transactionRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ requests });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to fetch requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// POST - Create new transaction request
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { type, amount, bankName, holderName, accountNumber, ifscCode } = await request.json();

    if (!type || !amount) {
      return NextResponse.json({ error: 'Type and amount are required' }, { status: 400 });
    }

    if (!['deposit', 'withdraw'].includes(type)) {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    // For withdrawals, require bank details
    if (type === 'withdraw') {
      if (!bankName || !holderName || !accountNumber || !ifscCode) {
        return NextResponse.json({ error: 'Bank details required for withdrawal' }, { status: 400 });
      }
    }

    const transactionRequest = await prisma.transactionRequest.create({
      data: {
        userId,
        type,
        amount,
        bankName: bankName || null,
        holderName: holderName || null,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        status: 'pending'
      }
    });

    return NextResponse.json({ request: transactionRequest, message: 'Request created successfully' });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to create request:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}

// PUT - Cancel transaction request
export async function PUT(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { requestId } = await request.json();

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const transactionRequest = await prisma.transactionRequest.findFirst({
      where: { id: requestId, userId }
    });

    if (!transactionRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (transactionRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
    }

    const updatedRequest = await prisma.transactionRequest.update({
      where: { id: requestId },
      data: { status: 'cancelled' }
    });

    return NextResponse.json({ request: updatedRequest, message: 'Request cancelled successfully' });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to cancel request:', error);
    return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 });
  }
}