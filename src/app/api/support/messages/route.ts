import { NextRequest, NextResponse } from 'next/server';
import { Message } from '@prisma/client';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    // Find or create chat for user
    let chat = await prisma.chat.findFirst({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: { userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });
    }

    return NextResponse.json({
      chatId: chat.id,
      messages: chat.messages.map((msg: Message) => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;
    const { text } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    if (text.length > 1000) {
      return NextResponse.json({ error: 'Message too long (max 1000 characters)' }, { status: 400 });
    }

    // Find or create chat
    let chat = await prisma.chat.findFirst({ where: { userId } });
    if (!chat) {
      chat = await prisma.chat.create({ data: { userId } });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        sender: 'user',
        text: text.trim()
      }
    });

    return NextResponse.json({
      id: message.id,
      sender: message.sender,
      text: message.text,
      timestamp: message.createdAt
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}