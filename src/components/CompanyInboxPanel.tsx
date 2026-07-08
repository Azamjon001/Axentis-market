import { useState, useEffect } from 'react';
import { MessageSquare, Mail, MailOpen, Clock, X, CheckCheck } from 'lucide-react';
import api from '../utils/api';

interface CompanyMessage {
  id: number;
  company_id: number;
  title: string;
  message: string;
  sender_name: string;
  created_at: string;
  is_read: boolean;
}

interface CompanyInboxPanelProps {
  companyId: number;
  onClose: () => void;
}

export default function CompanyInboxPanel({ companyId, onClose }: CompanyInboxPanelProps) {
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<CompanyMessage | null>(null);

  useEffect(() => {
    loadMessages();
  }, [companyId]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      // ✅ auth-aware api-хелпер (раньше «голый» fetch без JWT → 401)
      const data = await api.companyMessages.list(companyId);
      setMessages(Array.isArray(data) ? data : (data?.messages || []));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: number) => {
    try {
      await api.companyMessages.markRead(messageId);
      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, is_read: true } : m
      ));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.companyMessages.markAllRead(companyId);
      setMessages(messages.map(m => ({ ...m, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleMessageClick = (message: CompanyMessage) => {
    setSelectedMessage(message);
    if (!message.is_read) {
      markAsRead(message.id);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  if (selectedMessage) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="text-white">
                <div className="font-semibold">{selectedMessage.sender_name}</div>
                <div className="text-xs text-blue-100">{formatDate(selectedMessage.created_at)}</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedMessage(null)}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Message Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {selectedMessage.title}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {selectedMessage.message}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <button
              onClick={() => setSelectedMessage(null)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Входящие сообщения</h2>
              <p className="text-blue-100 text-sm">
                {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все прочитаны'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Все прочитано</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Mail className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Сообщений пока нет</p>
              <p className="text-sm">Здесь будут отображаться сообщения от Axis</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    message.is_read
                      ? 'bg-white border-gray-200 hover:border-gray-300'
                      : 'bg-blue-50 border-blue-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      message.is_read ? 'bg-gray-100' : 'bg-blue-500'
                    }`}>
                      {message.is_read ? (
                        <MailOpen className="w-6 h-6 text-gray-500" />
                      ) : (
                        <Mail className="w-6 h-6 text-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className={`font-semibold truncate ${
                          message.is_read ? 'text-gray-700' : 'text-blue-900'
                        }`}>
                          {message.title}
                        </div>
                        {!message.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      
                      <div className={`text-sm line-clamp-2 mb-2 ${
                        message.is_read ? 'text-gray-500' : 'text-gray-700'
                      }`}>
                        {message.message}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDate(message.created_at)}</span>
                        </div>
                        <div>
                          от: <span className="font-medium text-blue-600">{message.sender_name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
