'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuthFetch } from '@/lib/authFetch';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

const SupportPage: React.FC = () => {
  const { user, logout } = useAuth();
  const authFetch = useAuthFetch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const result = await authFetch('/api/support/messages');
      if (result.ok && result.data) {
        setMessages(result.data.messages || []);
        setError(null);
      } else if (result.status === 401) {
        setError('Session expired. Please log in again.');
        logout();
      } else {
        setError('Failed to load messages. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || text.length > 1000) return;

    try {
      const result = await authFetch('/api/support/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (result.ok && result.data) {
        setMessages(prev => [...prev, result.data]);
        setNewMessage('');
        setError(null);
        scrollToBottom();
      } else if (result.status === 401) {
        setError('Session expired. Please log in again.');
        logout();
      } else {
        setError('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Network error. Please check your connection.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (user) {
      fetchMessages();

      // Polling for new messages every 5 seconds
      intervalRef.current = setInterval(fetchMessages, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Please log in to access support chat.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen bg-white rounded-lg shadow-lg dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <MessageCircle className="w-6 h-6 mr-3 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Support Chat</h1>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 mx-4 border border-red-200 rounded-lg bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-t-4 border-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500 dark:text-gray-400">No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className="mt-1 text-xs opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString()}
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
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || newMessage.length > 1000}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;