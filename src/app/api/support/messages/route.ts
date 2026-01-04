import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    // Find or create chat for user
    let chatQuery = await collections.chats.where('userId', '==', userId).limit(1).get();
    let chat: any = null;

    if (!chatQuery.empty) {
      chat = { id: chatQuery.docs[0].id, ...chatQuery.docs[0].data() };
    } else {
      // Create new chat
      const chatRef = await collections.chats.add({
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      chat = { id: chatRef.id, userId };
    }

    // Get messages for this chat
    const messagesQuery = await collections.messages
      .where('chatId', '==', chat.id)
      .orderBy('createdAt', 'asc')
      .get();

    const messages = messagesQuery.docs.map(doc => ({
      id: doc.id,
      sender: doc.data().sender,
      text: doc.data().text,
      timestamp: doc.data().createdAt
    }));

    return NextResponse.json({
      chatId: chat.id,
      messages
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
    let chatQuery = await collections.chats.where('userId', '==', userId).limit(1).get();
    let chatId: string;

    if (!chatQuery.empty) {
      chatId = chatQuery.docs[0].id;
    } else {
      const chatRef = await collections.chats.add({
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      chatId = chatRef.id;
    }

    // Create message
    const messageRef = await collections.messages.add({
      chatId,
      sender: 'user',
      text: text.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      id: messageRef.id,
      sender: 'user',
      text: text.trim(),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}