import { User, LogOut, ArrowLeft, Heart, List, MessageCircle, X, Camera, Star, Search, UserPlus, UserCheck } from 'lucide-react';
import BottomNavigation from './BottomNavigation';
import LoyaltyCard from './LoyaltyCard'; // ⭐ Баланс баллов/кэшбэка
import { useState, useEffect, useRef } from 'react';
import { getCurrentLanguage, type Language, useTranslation } from '../utils/translations';
import api, { getImageUrl } from '../utils/api';
// Wired to the existing backend (/api/users/:phone/*).
const getUserReviews = async (phone: string) => {
  try { const r = await api.users.getReviews(phone); return Array.isArray(r) ? r : []; }
  catch { return []; }
};
const getUserStats = async (phone: string) => {
  try {
    const r: any = await api.users.getStats(phone);
    return { following: r?.following ?? 0, followers: r?.followers ?? 0, views: r?.views ?? 0 };
  } catch { return { following: 0, followers: 0, views: 0 }; }
};
const getUsers = async () => [];
const toggleSubscription = async (from: string, to: string) => {
  try { const r: any = await api.users.toggleSubscription(from, to); return { subscribed: r?.subscribed ?? false }; }
  catch { return { subscribed: false }; }
};
const checkSubscription = async (from: string, to: string) => {
  try { const r: any = await api.users.subscriptionStatus(from, to); return r?.subscribed ?? false; }
  catch { return false; }
};
import { ImageWithFallback } from './figma/ImageWithFallback';

interface SettingsPageProps {
  userName?: string;
  userPhone?: string;
  onLogout: () => void;
  onBackToHome: () => void;
  onNavigateTo?: (page: 'home' | 'cart' | 'likes' | 'settings') => void;
}

export type DisplayMode = 'day' | 'night';

interface Review {
  id: number;
  product_id: number;
  rating: number;
  comment: string;
  created_at: string;
  products?: {
    name: string;
    images?: Array<{ url: string }>;
  };
}

interface UserProfile {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  isSubscribed?: boolean;
}

export default function SettingsPage({ 
  userName, 
  userPhone,
  onLogout,
  onBackToHome,
  onNavigateTo
}: SettingsPageProps) {
  // 🌍 Язык приложения (заблокирован на русском)
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    return (localStorage.getItem('displayMode') as DisplayMode) || 'day';
  });

  // Profile Photo State
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reviews State
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Stats State
  const [stats, setStats] = useState({ following: 0, followers: 0, views: 0 });

  // Users Search State
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    localStorage.setItem('displayMode', displayMode);
    window.dispatchEvent(new CustomEvent('displayModeChange', { detail: displayMode }));
  }, [displayMode]);

  useEffect(() => {
    if (userPhone) {
      // Load avatar from backend
      loadProfilePhoto();
      loadStats();
    }
  }, [userPhone]);

  const loadProfilePhoto = async () => {
    if (!userPhone) return;
    try {
      const response = await api.get(`/users/${userPhone}/profile`);
      if (response.data.avatar_url) {
        setProfilePhoto(getImageUrl(response.data.avatar_url) || '');
      }
    } catch (error) {
      console.error('Error loading profile photo:', error);
    }
  };

  const loadStats = async () => {
    if (!userPhone) return;
    const data = await getUserStats(userPhone);
    setStats(data);
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && userPhone) {
      try {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await api.post(`/users/${userPhone}/avatar`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success && response.data.avatar_url) {
          setProfilePhoto(getImageUrl(response.data.avatar_url) || '');
          alert('Фото профиля обновлено!');
        }
      } catch (error) {
        console.error('Error uploading avatar:', error);
        alert('Ошибка при загрузке фото');
      }
    }
  };

  const handleOpenReviews = async () => {
    setShowReviews(true);
    if (userPhone) {
      setLoadingReviews(true);
      try {
        const data = await getUserReviews(userPhone);
        setReviews(data);
      } catch (error) {
        console.error('Error loading reviews:', error);
      } finally {
        setLoadingReviews(false);
      }
    }
  };

  const handleOpenSearch = async () => {
    setShowUserSearch(true);
    if (userPhone) {
      setLoadingUsers(true);
      try {
        // Fetch all users
        const users = await getUsers();
        // Filter out myself
        const others = users.filter((u: any) => u.phone_number !== userPhone);
        
        // Check subscriptions for each user
        // Note: In a real large app, we would fetch this more efficiently
        const usersWithStatus = await Promise.all(others.map(async (u: any) => {
          const isSub = await checkSubscription(userPhone, u.phone_number);
          return { ...u, isSubscribed: isSub };
        }));
        
        setAllUsers(usersWithStatus);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  const handleToggleSubscribe = async (targetUser: UserProfile) => {
    if (!userPhone) return;
    
    // Optimistic update
    setAllUsers(prev => prev.map(u => 
      u.phone_number === targetUser.phone_number 
        ? { ...u, isSubscribed: !u.isSubscribed }
        : u
    ));

    try {
      const newState = await toggleSubscription(userPhone, targetUser.phone_number);
      // Update stats after change
      loadStats();
      
      // Sync state if backend returned different (optional safety)
      setAllUsers(prev => prev.map(u => 
        u.phone_number === targetUser.phone_number 
          ? { ...u, isSubscribed: newState }
          : u
      ));
    } catch (error) {
      console.error('Error toggling subscription:', error);
      // Revert on error
      setAllUsers(prev => prev.map(u => 
        u.phone_number === targetUser.phone_number 
          ? { ...u, isSubscribed: !targetUser.isSubscribed }
          : u
      ));
    }
  };

  // Colors from the design
  // 🎨 Палитра Homepage (Luxury Dark Minimalism)
  const isNight = displayMode === 'night';
  const hp = {
    bg: isNight ? '#08090D' : '#FFFFFF',
    surface: isNight ? '#10131F' : '#F6F7F9',
    card: isNight ? '#171C2A' : '#FFFFFF',
    text: isNight ? '#FFFFFF' : '#0B0E16',
    textSec: isNight ? '#9CA3AF' : '#5B6472',
    border: isNight ? 'rgba(255,255,255,0.06)' : 'rgba(11,14,22,0.08)',
    primary: '#6D5DFB',
    error: '#EF4444',
  };
  const headerColor = hp.bg;        // совместимость со старыми ссылками (модалки)
  const darkCardColor = hp.surface;
  const lightCardColor = hp.card;
  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-[#08090D]' : 'bg-white';

  const filteredUsers = allUsers.filter(u => 
    `${u.first_name} ${u.last_name} ${u.phone_number}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen relative pb-24 transition-colors duration-500 ${bgColor}`}>
      {/* Header — как в Homepage (ProfileScreen) */}
      <header
        className="px-4 pb-3 flex items-center justify-between sticky top-0 z-10"
        style={{ backgroundColor: hp.bg, paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <button onClick={onBackToHome} className="p-2 -ml-2 rounded-full transition-colors" style={{ color: hp.text }}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: hp.text }}>Профиль</h1>
        <button onClick={onLogout} className="p-2 -mr-2 rounded-full transition-colors" style={{ color: hp.error }}>
          <LogOut className="w-6 h-6" />
        </button>
      </header>

      <div className="container mx-auto px-4 py-3">

        {/* User card: аватар + имя + телефон */}
        <div className="rounded-2xl p-4 mb-4 flex items-center gap-4" style={{ backgroundColor: hp.surface, border: `1px solid ${hp.border}` }}>
          <div onClick={handlePhotoClick} className="relative cursor-pointer flex-shrink-0">
            <div className="w-[72px] h-[72px] rounded-full overflow-hidden flex items-center justify-center" style={{ backgroundColor: hp.primary }}>
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold text-white">
                  {(userName || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2" style={{ backgroundColor: hp.primary, borderColor: hp.surface }}>
              <Camera className="w-3 h-3 text-white" />
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold truncate" style={{ color: hp.text }}>{userName || 'Пользователь'}</div>
            <div className="text-sm" style={{ color: hp.textSec }}>{userPhone ? `+${String(userPhone).replace(/^\+/, '')}` : ''}</div>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs" style={{ color: hp.textSec }}><b style={{ color: hp.text }}>{stats.followers}</b> подписчиков</span>
              <span className="text-xs" style={{ color: hp.textSec }}><b style={{ color: hp.text }}>{stats.following}</b> подписки</span>
            </div>
          </div>
        </div>

        {/* ⭐ Loyalty / cashback balance */}
        <div className="mb-4">
          <LoyaltyCard userPhone={userPhone} />
        </div>

        {/* Menu list (как в Homepage) */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: hp.surface, border: `1px solid ${hp.border}` }}>
          {[
            { icon: UserPlus, label: 'Подписаться на других', onClick: handleOpenSearch },
            { icon: Star, label: 'Мои отзывы', onClick: handleOpenReviews },
          ].map((item, i) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors active:opacity-70"
              style={{ borderTop: i === 0 ? 'none' : `1px solid ${hp.border}` }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: hp.primary + '22' }}>
                <item.icon className="w-[18px] h-[18px]" style={{ color: hp.primary }} />
              </div>
              <span className="flex-1 text-left text-[15px] font-medium" style={{ color: hp.text }}>{item.label}</span>
              <ArrowLeft className="w-4 h-4 rotate-180" style={{ color: hp.textSec }} />
            </button>
          ))}

          {/* Day/Night toggle */}
          <div className="w-full flex items-center gap-3 px-4 py-3.5" style={{ borderTop: `1px solid ${hp.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: hp.primary + '22' }}>
              <span className="text-base">{isNight ? '🌙' : '☀️'}</span>
            </div>
            <span className="flex-1 text-left text-[15px] font-medium" style={{ color: hp.text }}>Тёмная тема</span>
            <button
              onClick={() => setDisplayMode(displayMode === 'day' ? 'night' : 'day')}
              className="w-12 h-7 rounded-full p-0.5 transition-colors duration-300 relative"
              style={{ backgroundColor: isNight ? hp.primary : 'rgba(120,120,128,0.32)' }}
            >
              <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${isNight ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

      </div>

      {/* Reviews Modal Panel */}
      {showReviews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowReviews(false)}>
          <div 
            className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col ${
              displayMode === 'night' ? 'bg-[#2d1222]' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="p-4 flex items-center justify-between shrink-0"
              style={{ backgroundColor: headerColor }}
            >
              <h2 className="text-lg font-bold text-black">Moi otzivi</h2>
              <button 
                onClick={() => setShowReviews(false)}
                className="p-1 rounded-full bg-white/20 hover:bg-white/40 text-black"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingReviews ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
                </div>
              ) : reviews.length === 0 ? (
                <div className={`text-center py-8 ${displayMode === 'night' ? 'text-gray-400' : 'text-gray-500'}`}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>U vas poka net otzivov</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div 
                      key={review.id} 
                      className={`p-3 rounded-xl border ${
                        displayMode === 'night' 
                          ? 'bg-[#08090D] border-gray-700' 
                          : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      {/* Product Info */}
                      {review.products && (
                        <div className="flex items-center gap-3 mb-2 border-b border-gray-200/10 pb-2">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                            {review.products.images && review.products.images.length > 0 ? (
                              <ImageWithFallback 
                                src={review.products.images[0].url} 
                                alt={review.products.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-300 text-xs">IMG</div>
                            )}
                          </div>
                          <div className={`font-medium text-sm line-clamp-1 ${displayMode === 'night' ? 'text-white' : 'text-black'}`}>
                            {review.products.name}
                          </div>
                        </div>
                      )}

                      {/* Rating */}
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`w-4 h-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>

                      {/* Comment */}
                      <p className={`text-sm ${displayMode === 'night' ? 'text-gray-300' : 'text-gray-600'}`}>
                        {review.comment}
                      </p>
                      
                      <div className="text-xs text-gray-400 mt-2 text-right">
                        {new Date(review.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Search Modal */}
      {showUserSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowUserSearch(false)}>
           <div 
            className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl h-[70vh] flex flex-col ${
              displayMode === 'night' ? 'bg-[#2d1222]' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="p-4 shrink-0"
              style={{ backgroundColor: headerColor }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-black">Nayti polzovateley</h2>
                <button 
                  onClick={() => setShowUserSearch(false)}
                  className="p-1 rounded-full bg-white/20 hover:bg-white/40 text-black"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Imya ili telefon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl pl-10 pr-4 py-2 bg-white/80 backdrop-blur text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black/20"
                />
                <Search className="w-5 h-5 text-gray-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className={`text-center py-8 ${displayMode === 'night' ? 'text-gray-400' : 'text-gray-500'}`}>
                  <p>Polzovateli ne naydeni</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className={`p-3 rounded-xl flex items-center justify-between ${
                        displayMode === 'night' 
                          ? 'bg-[#08090D] border border-gray-700' 
                          : 'bg-gray-50 border border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                           <User className="w-6 h-6 text-gray-500" />
                        </div>
                        <div>
                          <div className={`font-medium text-sm ${displayMode === 'night' ? 'text-white' : 'text-black'}`}>
                            {user.first_name} {user.last_name}
                          </div>
                          <div className={`text-xs ${displayMode === 'night' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {user.phone_number}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleToggleSubscribe(user)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.isSubscribed
                            ? 'bg-gray-200 text-black hover:bg-gray-300'
                            : 'bg-[#C4A484] text-white hover:bg-[#b08d6d]'
                        }`}
                      >
                        {user.isSubscribed ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentPage="settings"
        onNavigate={(page) => {
          if (page === 'settings') return;
          if (onNavigateTo) onNavigateTo(page);
        }}
        displayMode={displayMode}
      />
    </div>
  );
}