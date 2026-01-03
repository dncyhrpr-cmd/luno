import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

const prisma = new PrismaClient();

// GET /api/admin/support - get all chats
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    // Check if admin - assuming roles include 'admin'
    // For now, assume any authenticated user can access, but in production check roles

    const chats = await prisma.chat.findMany({
      include: {
        user: {
          select: { id: true, username: true, email: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get latest message
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/support - send message to a chat
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const { chatId, text } = await request.json();

    if (!chatId || !text?.trim()) {
      return NextResponse.json({ error: 'chatId and text are required' }, { status: 400 });
    }

    if (text.length > 1000) {
      return NextResponse.json({ error: 'Message too long (max 1000 characters)' }, { status: 400 });
    }

    // Verify chat exists
    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        chatId,
        sender: 'support',
        text: text.trim()
      }
    });

    // Update chat updatedAt
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}