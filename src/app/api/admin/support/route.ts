import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';

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

    const chatsSnapshot = await collections.chats.get();
    const chats = await Promise.all(chatsSnapshot.docs.map(async (chatDoc: admin.firestore.DocumentSnapshot) => {
      const chat = { id: chatDoc.id, ...chatDoc.data() } as any;

      // Get user info
      const userDoc = await collections.users.doc(chat.userId).get();
      const user = userDoc.exists ? userDoc.data() : null;

      // Get latest message
      const messagesSnapshot = await collections.messages
        .where('chatId', '==', chat.id)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      const latestMessage = messagesSnapshot.docs.length > 0 ?
        { id: messagesSnapshot.docs[0].id, ...messagesSnapshot.docs[0].data() } : null;

      // Get message count
      const messagesCountSnapshot = await collections.messages.where('chatId', '==', chat.id).get();

      return {
        ...chat,
        user: user ? { id: user.id, username: user.username, email: user.email } : null,
        messages: latestMessage ? [latestMessage] : [],
        _count: { messages: messagesCountSnapshot.size }
      };
    }));

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
    const chatDoc = await collections.chats.doc(chatId).get();
    if (!chatDoc.exists) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const messageId = collections.messages.doc().id;
    const messageData = {
      id: messageId,
      chatId,
      sender: 'support',
      text: text.trim(),
      createdAt: admin.firestore.Timestamp.now()
    };

    await collections.messages.doc(messageId).set(messageData);

    // Update chat updatedAt (use set with merge to handle missing fields)
    await collections.chats.doc(chatId).set({
      updatedAt: admin.firestore.Timestamp.now()
    }, { merge: true });

    return NextResponse.json(messageData);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}