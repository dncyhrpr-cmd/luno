'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Users, ArrowLeft } from 'lucide-react';
import { useAuthFetch } from '@/lib/authFetch';

interface Chat {
  id: string;
  user: { id: string; username: string; email: string };
  messages: Message[];
  _count: { messages: number };
  status: string;
  updatedAt: string;
}

interface Message {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
}

const ChatSupport: React.FC = () => {
  const authFetch = useAuthFetch();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    try {
      const result = await authFetch('/api/admin/support');
      if (result.ok && result.data) {
        setChats(result.data);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagesForChat = async (chatId: string) => {
    try {
      // For admin, we can use the user API but as admin, or create a separate endpoint
      // For now, assume admin can access user messages
      // Actually, let's create messages for the selected chat
      const chat = chats.find(c => c.id === chatId);
      if (chat) {
        setMessages(chat.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const result = await authFetch('/api/admin/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId: selectedChat.id, text: newMessage.trim() }),
      });

      if (result.ok && result.data) {
        setMessages(prev => [...prev, result.data]);
        setNewMessage('');
        scrollToBottom();
        // Refresh chats to update latest message
        fetchChats();
      }
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

  const selectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMessages(chat.messages || []);
  };

  useEffect(() => {
    fetchChats();

    // Polling for new chats every 10 seconds
    intervalRef.current = setInterval(fetchChats, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-t-4 border-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg md:flex-row dark:bg-gray-800">
      {/* Chat List */}
      <div className={`w-full md:w-1/3 ${selectedChat ? 'hidden md:block' : 'block'} border-r border-gray-200 dark:border-gray-700 md:border-r-0`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
            <Users className="w-5 h-5 mr-2" />
            Support Chats
          </h3>
        </div>
        <div className="h-full overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No chats yet
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`p-4 border-b border-gray-100 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  selectedChat?.id === chat.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                }`}
                onClick={() => selectChat(chat)}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {chat.user.username}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {chat.user.email}
                </div>
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {chat._count.messages} messages • {new Date(chat.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex flex-col flex-1">
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <button onClick={() => setSelectedChat(null)} className="p-2 mr-2 rounded-full md:hidden hover:bg-gray-100 dark:hover:bg-gray-700">
                  <ArrowLeft size={20} />
                </button>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Chat with {selectedChat.user.username}
                </h4>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
                </div>
              ) : (
                messages
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'support' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.sender === 'support'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="text-sm">{message.text}</p>
                        <p className="mt-1 text-xs opacity-70">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
              )}
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
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                Select a Chat
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Choose a chat from the list to start responding
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSupport;