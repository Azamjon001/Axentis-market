import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Loader2, MessageCircle, Search, Users } from 'lucide-react';



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

interface Chat {
  company_id: number;
  company_name: string;
  company_phone: string;
  unread_count_for_admin: number;
  last_message_text: string;
  last_message_type: string;
  last_message_sender: string;
  last_message_at: string;
}

// 💾 In-memory cache
const chatsCache = { data: null as Chat[] | null, timestamp: 0 };
const messagesCache = new Map<number, Message[]>();

export default function AdminChatPanel() {
  const [chats, setChats] = useState<Chat[]>(() => chatsCache.data || []);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // WebSocket removed - using polling instead
  const hasLoadedChatsRef = useRef(false);
  const hasLoadedMessagesRef = useRef(new Set<number>());

  useEffect(() => {
    if (!hasLoadedChatsRef.current) {
      loadChats();
      hasLoadedChatsRef.current = true;
    }
    
    // 🔴 WebSocket удалён - используем polling
    // Удалён весь realtime код - используем периодическую загрузку

    return () => {
      // Cleanup if needed
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      // Загружаем из кеша или с сервера
      const cached = messagesCache.get(selectedChat.company_id);
      if (cached && !hasLoadedMessagesRef.current.has(selectedChat.company_id)) {
        setMessages(cached);
        setMessagesLoading(false);
      } else if (!hasLoadedMessagesRef.current.has(selectedChat.company_id)) {
        loadMessages(selectedChat.company_id);
        hasLoadedMessagesRef.current.add(selectedChat.company_id);
      }
      
      markMessagesAsRead(selectedChat.company_id);
      
      // 🔴 WebSocket удалён - используем polling
      // Удалён весь realtime код
      
      return () => {
        // Cleanup if needed
      };
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      // Используем кеш если свежий (менее 5 секунд)
      const now = Date.now();
      if (chatsCache.data && (now - chatsCache.timestamp) < 5000) {
        setChats(chatsCache.data);
        setLoading(false);
        return;
      }
      
      const response = await fetch(
        `/api/chat/list`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const loadedChats = data.chats || [];
        setChats(loadedChats);
        chatsCache.data = loadedChats;
        chatsCache.timestamp = now;
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (companyId: number) => {
    try {
      setMessagesLoading(true);
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
        messagesCache.set(companyId, loadedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const markMessagesAsRead = async (companyId: number) => {
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
            reader_type: 'admin'
          })
        }
      );
      
      // Обновляем счётчики непрочитанных
      setChats(prev => {
        const updated = prev.map(chat =>
          chat.company_id === companyId
            ? { ...chat, unread_count_for_admin: 0 }
            : chat
        );
        chatsCache.data = updated;
        return updated;
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (type: 'text' | 'voice' | 'image' | 'video' | 'file' = 'text', mediaData?: any) => {
    if (!selectedChat) return;

    try {
      const textToSend = type === 'text' ? messageText : null;
      
      setMessageText('');
      setSending(true);

      // 🟢 Создаём оптимистичное сообщение для мгновенного отображения
      const optimisticMessage: Message = {
        id: Date.now(), // Временный ID
        sender_type: 'admin',
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
        company_id: selectedChat.company_id,
        sender_type: 'admin',
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
          messagesCache.set(selectedChat.company_id, updated);
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
    if (!selectedChat) return;

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_id', selectedChat.company_id.toString());

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

  const filteredChats = chats.filter(chat => 
    chat.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.company_phone.includes(searchQuery)
  );

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unread_count_for_admin, 0);

  const renderMessage = (message: Message) => {
    const isOwnMessage = message.sender_type === 'admin';

    return (
      <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-[70%] ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} rounded-2xl px-4 py-2 shadow`}>
          {message.reply_to && (
            <div className={`text-xs ${isOwnMessage ? 'bg-blue-700' : 'bg-gray-300'} rounded-lg px-2 py-1 mb-2 opacity-80`}>
              <div className="font-semibold">{message.reply_to.sender_type === 'admin' ? 'Вы' : 'Компания'}</div>
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
    <div className="bg-white rounded-lg shadow-lg flex h-[700px]">
      {/* Chats List (Left Sidebar) */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Чаты с компаниями</h2>
              <p className="text-sm text-blue-200">{chats.length} диалогов</p>
            </div>
            {totalUnread > 0 && (
              <div className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {totalUnread}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск компаний..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-blue-700 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Chats */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
              <MessageCircle className="w-12 h-12 mb-2" />
              <p className="text-center">Нет чатов</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.company_id}
                onClick={() => setSelectedChat(chat)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedChat?.company_id === chat.company_id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{chat.company_name}</h3>
                  {chat.unread_count_for_admin > 0 && (
                    <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {chat.unread_count_for_admin}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate flex-1">
                    {chat.last_message_sender === 'admin' && <span className="text-blue-600">Вы: </span>}
                    {chat.last_message_text || `[${chat.last_message_type}]`}
                  </p>
                  {chat.last_message_at && (
                    <span className="text-xs text-gray-400 ml-2">
                      {formatMessageTime(chat.last_message_at)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Window (Right Side) */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-lg text-gray-900">{selectedChat.company_name}</h3>
              <p className="text-sm text-gray-600">{selectedChat.company_phone}</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageCircle className="w-16 h-16 mb-3" />
                  <p>Нет сообщений</p>
                </div>
              ) : (
                <>
                  {messages.map(renderMessage)}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4 bg-white">
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
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageCircle className="w-20 h-20 mb-4" />
            <p className="text-xl">Выберите чат для начала общения</p>
          </div>
        )}
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


