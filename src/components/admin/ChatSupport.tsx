'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Users } from 'lucide-react';
import { getDb } from '@/lib/client-db';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, getDocs, limit, doc, setDoc, getDoc } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'admin';
  timestamp: Timestamp;
}

interface ChatUser {
  id: string;
  name: string;
  email: string;
  lastMessage?: Message;
}

const ChatSupport: React.FC = () => {
  const db = getDb();
  const [chats, setChats] = useState<ChatUser[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Listen to all chats in real-time
  useEffect(() => {
    const chatsRef = collection(db, 'chats');

    const unsubscribe = onSnapshot(chatsRef, async (snapshot) => {
      const chatUsers: ChatUser[] = [];

      for (const chatDoc of snapshot.docs) {
        const userId = chatDoc.id;
        // Get the most recent message for this chat
        const messagesRef = collection(db, 'chats', userId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
        const lastMessageSnap = await getDocs(q);
        const lastMessage = lastMessageSnap.docs[0]?.data() as Message | undefined;

        // Get actual user data from users collection
        let userName = `User ${userId.slice(-4)}`;
        let userEmail = `${userId}@example.com`;

        try {
          const userDocRef = doc(db, 'users', userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data() as { username?: string; email?: string };
            userName = userData.username || userName;
            userEmail = userData.email || userEmail;
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }

        chatUsers.push({
          id: userId,
          name: userName,
          email: userEmail,
          lastMessage
        });
      }

      // Sort chats by most recent message
      chatUsers.sort((a, b) => {
        const aTime = a.lastMessage?.timestamp?.toMillis() || 0;
        const bTime = b.lastMessage?.timestamp?.toMillis() || 0;
        return bTime - aTime;
      });

      setChats(chatUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to selected chat messages
  useEffect(() => {
    if (!selectedChat) return;

    const chatRef = collection(db, 'chats', selectedChat, 'messages');
    const q = query(chatRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [selectedChat]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const chatRef = collection(db, 'chats', selectedChat, 'messages');
      await addDoc(chatRef, {
        text: newMessage.trim(),
        sender: 'admin',
        timestamp: Timestamp.now()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full bg-white rounded-lg shadow-lg dark:bg-gray-800">
      {/* Chat List */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
            <Users className="w-5 h-5 mr-2" />
            Support Chats
          </h2>
        </div>
        <div className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-t-4 border-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No active chats
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat.id)}
                className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  selectedChat === chat.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="font-semibold text-gray-900 dark:text-white">{chat.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{chat.email}</div>
                {chat.lastMessage && (
                  <div className="mt-1 text-xs text-gray-400 truncate">
                    {chat.lastMessage.text}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex flex-col flex-1">
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Chat with {chats.find(c => c.id === selectedChat)?.name}
              </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender === 'admin'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {message.timestamp.toDate().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your response..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 dark:text-gray-400">Select a chat to start responding</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSupport;