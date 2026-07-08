import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Loader2, MessageCircle } from 'lucide-react';
import { useResponsive, useResponsiveClasses } from '../hooks/useResponsive';



interface Message {
  id: number;
  sender_type: 'admin' | 'company';
  message_type: 'text' | 'voice' | 'image' | 'video' | 'file';
  message_text: string | null;
  media_url: string | null;
  media_filename: string | null;
  voice_duration: number | null;
  video_duration: number | null;
  created_at: string;
  is_read: boolean;
  reply_to?: {
    id: number;
    message_text: string;
    message_type: string;
    sender_type: string;
  } | null;
}

interface CompanyChatPanelProps {
  companyId: number;
  companyName: string;
}

// 💾 In-memory cache для сообщений
const messagesCache = new Map<number, Message[]>();

export default function CompanyChatPanel({ companyId, companyName }: CompanyChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    // Загружаем из кеша при инициализации
    return messagesCache.get(companyId) || [];
  });
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  
  // 📱 Адаптивность
  const { isMobile, isTablet } = useResponsive();
  const responsive = useResponsiveClasses();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // WebSocket removed - using polling instead
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      loadMessages();
      markMessagesAsRead();
      hasLoadedRef.current = true;
    }
    
    // 🔴 WebSocket удалён - используем polling вместо realtime subscriptions
    console.log(`🔌 [CompanyChat] Polling режим для chat_${companyId}`);
    
    // Удалён весь realtime код - используем периодическую загрузку сообщений

    return () => {
      // Cleanup if needed
    };
  }, [companyId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `/api/chat/${companyId}/messages`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const loadedMessages = data.messages || [];
        setMessages(loadedMessages);
        messagesCache.set(companyId, loadedMessages); // Сохраняем в кеш
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await fetch(
        `/api/chat/mark-read`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            company_id: companyId,
            reader_type: 'company'
          })
        }
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (type: 'text' | 'voice' | 'image' | 'video' | 'file' = 'text', mediaData?: any) => {
    try {
      const textToSend = type === 'text' ? messageText : null;
      
      setMessageText('');
      setSending(true);

      // 🟢 Создаём оптимистичное сообщение для мгновенного отображения
      const optimisticMessage: Message = {
        id: Date.now(), // Временный ID
        sender_type: 'company',
        message_type: type,
        message_text: textToSend,
        media_url: mediaData?.url || null,
        media_filename: mediaData?.media_filename || null,
        voice_duration: mediaData?.voice_duration || null,
        video_duration: mediaData?.video_duration || null,
        created_at: new Date().toISOString(),
        is_read: false,
        reply_to: null
      };

      // Сразу добавляем в UI
      setMessages(prev => [...prev, optimisticMessage]);

      const messageData: any = {
        company_id: companyId,
        sender_type: 'company',
        message_type: type,
        message_text: textToSend,
        ...mediaData
      };

      const response = await fetch(
        `/api/chat/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messageData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Заменяем оптимистичное сообщение на реальное из сервера
        setMessages(prev => {
          const updated = prev.map(m => 
            m.id === optimisticMessage.id ? data.message : m
          );
          messagesCache.set(companyId, updated);
          return updated;
        });
      } else {
        // Если ошибка - убираем оптимистичное сообщение
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        alert('Ошибка отправки сообщения');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Ошибка отправки сообщения');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'video' | 'file') => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_id', companyId.toString());

      const response = await fetch(
        `/api/chat/upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: formData
        }
      );

      if (response.ok) {
        const data = await response.json();
        await sendMessage(type, {
          media_filepath: data.filepath,
          media_filename: data.filename,
          media_size: data.size,
          media_mimetype: data.mimetype,
          url: data.url
        });
      } else {
        alert('Ошибка загрузки файла');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    // Добавляем UTC+5 смещение (5 часов = 5 * 60 * 60 * 1000 мс)
    const utcPlus5 = new Date(date.getTime() + (5 * 60 * 60 * 1000));
    const hours = utcPlus5.getUTCHours().toString().padStart(2, '0');
    const minutes = utcPlus5.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const renderMessage = (message: Message) => {
    const isOwnMessage = message.sender_type === 'company';

    return (
      <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[70%] ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} rounded-2xl px-4 py-2 shadow`}>
          {message.reply_to && (
            <div className={`text-xs ${isOwnMessage ? 'bg-blue-700' : 'bg-gray-300'} rounded-lg px-2 py-1 mb-2 opacity-80`}>
              <div className="font-semibold">{message.reply_to.sender_type === 'admin' ? 'Админ' : 'Вы'}</div>
              <div className="truncate">{message.reply_to.message_text || `[${message.reply_to.message_type}]`}</div>
            </div>
          )}

          {message.message_type === 'text' && (
            <div className="text-sm whitespace-pre-wrap break-words">{message.message_text}</div>
          )}

          {message.message_type === 'image' && message.media_url && (
            <div>
              <img 
                src={message.media_url} 
                alt="Изображение" 
                className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                onClick={() => setFullscreenMedia({ url: message.media_url!, type: 'image' })}
              />
              {message.message_text && <div className="text-sm mt-2">{message.message_text}</div>}
            </div>
          )}

          {message.message_type === 'video' && message.media_url && (
            <div>
              <video 
                src={message.media_url} 
                className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                onClick={() => setFullscreenMedia({ url: message.media_url!, type: 'video' })}
              />
              {message.message_text && <div className="text-sm mt-2">{message.message_text}</div>}
            </div>
          )}

          {(message.message_type === 'voice' || message.message_type === 'file') && message.media_url && (
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                {message.media_filename || 'Файл'}
              </a>
            </div>
          )}

          <div className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-200' : 'text-gray-500'} flex items-center gap-1`}>
            {formatMessageTime(message.created_at)}
            {isOwnMessage && (
              <span>{message.is_read ? '✓✓' : '✓'}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-[600px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold">Чат с администратором</h2>
            <p className="text-sm text-blue-200">{companyName}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageCircle className="w-16 h-16 mb-3" />
            <p>Нет сообщений. Начните диалог!</p>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const type = file.type.startsWith('image/') ? 'image' : 
                             file.type.startsWith('video/') ? 'video' : 'file';
                handleFileUpload(file, type);
              }
            }}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            className="p-3 text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            title="Прикрепить файл"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !sending && messageText.trim()) {
                e.preventDefault(); // ⚠️ Предотвращаем перезагрузку страницы
                sendMessage();
              }
            }}
            placeholder="Введите сообщение..."
            disabled={uploading || sending}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />

          <button
            onClick={() => sendMessage()}
            disabled={!messageText.trim() || sending || uploading}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending || uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* 🖼️ Fullscreen Media Modal */}
      {fullscreenMedia && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={() => setFullscreenMedia(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            {fullscreenMedia.type === 'image' ? (
              <img 
                src={fullscreenMedia.url} 
                alt="Полноэкранный просмотр" 
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <video 
                src={fullscreenMedia.url} 
                controls 
                autoPlay
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <button 
              onClick={() => setFullscreenMedia(null)}
              className="absolute top-4 right-4 bg-white text-gray-900 rounded-full p-2 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


