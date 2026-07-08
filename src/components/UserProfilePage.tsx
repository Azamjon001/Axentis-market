import { User, ArrowLeft, Heart, List, MessageCircle, Star, UserPlus, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../utils/api';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { getImageUrl } from '../utils/api';

// Wired to the existing backend (/api/users/:phone/*). These were referenced
// but never defined, which crashed the profile page at runtime.
const getUserStats = async (phone: string) => {
  try {
    const r: any = await api.users.getStats(phone);
    return { following: r?.following ?? 0, followers: r?.followers ?? 0, views: r?.views ?? 0 };
  } catch { return { following: 0, followers: 0, views: 0 }; }
};
const getUserReviews = async (phone: string) => {
  try { const r = await api.users.getReviews(phone); return Array.isArray(r) ? r : []; }
  catch { return []; }
};
const checkSubscription = async (from: string, to: string) => {
  try { const r: any = await api.users.subscriptionStatus(from, to); return r?.subscribed ?? false; }
  catch { return false; }
};
const toggleSubscription = async (from: string, to: string) => {
  try { const r: any = await api.users.toggleSubscription(from, to); return r?.subscribed ?? false; }
  catch { return false; }
};
const incrementProfileViews = async (phone: string) => {
  try { await api.users.incrementViews(phone); } catch { /* non-critical */ }
};

interface UserProfilePageProps {
  targetUserPhone: string;
  targetUserName?: string;
  currentUserPhone?: string;
  onBack: () => void;
  isNight: boolean;
}

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

export default function UserProfilePage({ 
  targetUserPhone, 
  targetUserName, 
  currentUserPhone, 
  onBack,
  isNight
}: UserProfilePageProps) {
  const [stats, setStats] = useState({ following: 0, followers: 0, views: 0 });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviews, setShowReviews] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Colors
  const headerColor = '#C4A484';
  const darkCardColor = '#A68A76';
  const lightCardColor = '#C4A484';
  const bgColor = isNight ? 'bg-[#08090D]' : 'bg-white';
  const textColor = isNight ? 'text-white' : 'text-black';

  useEffect(() => {
    loadData();
    // Increment view count
    incrementProfileViews(targetUserPhone);
  }, [targetUserPhone]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, reviewsData, profileData] = await Promise.all([
        getUserStats(targetUserPhone),
        getUserReviews(targetUserPhone),
        api.users.getProfile(targetUserPhone).catch(() => null),
      ]);

      setStats(statsData);
      setReviews(reviewsData);
      const profile = profileData as any;
      if (profile?.avatar_url) {
        setAvatarUrl(getImageUrl(profile.avatar_url));
      }

      if (currentUserPhone) {
        const subStatus = await checkSubscription(currentUserPhone, targetUserPhone);
        setIsSubscribed(subStatus);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!currentUserPhone) {
      alert('Voydite v sistemu chtobi podpisatsya');
      return;
    }
    
    // Optimistic update
    setIsSubscribed(!isSubscribed);
    setStats(prev => ({
      ...prev,
      followers: isSubscribed ? prev.followers - 1 : prev.followers + 1
    }));

    try {
      const newState = await toggleSubscription(currentUserPhone, targetUserPhone);
      setIsSubscribed(newState);
      // Reload real stats to be sure
      const newStats = await getUserStats(targetUserPhone);
      setStats(newStats);
    } catch (error) {
      console.error('Error toggling subscription:', error);
      // Revert
      setIsSubscribed(!isSubscribed);
    }
  };

  return (
    <div className={`min-h-screen relative pb-24 transition-colors duration-500 ${bgColor}`}>
      {/* Header */}
      <header 
        className="px-4 py-4 flex items-center shadow-sm sticky top-0 z-10"
        style={{ backgroundColor: headerColor, paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-black/10 transition-colors">
          <ArrowLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="text-lg font-bold text-black ml-4">Polzovatel</h1>
      </header>

      <div className="container mx-auto px-4 py-6">
        
        {/* Profile Card Section */}
        <div className="relative mt-8 mb-4">
          {/* Profile Photo */}
          <div className="absolute -top-12 left-8 z-20">
            <div className="w-24 h-24 rounded-full bg-gray-300 border-4 border-white overflow-hidden shadow-md flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={targetUserName || ''} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-500" />
              )}
            </div>
          </div>

          {/* Main Dark Card */}
          <div 
            className="rounded-[2rem] p-6 pt-16 shadow-md text-white relative z-10"
            style={{ backgroundColor: darkCardColor }}
          >
            {/* Stats Row */}
            <div className="flex justify-between mb-6 px-2">
              <div className="text-center">
                <div className="font-bold text-lg">{stats.following}</div>
                <div className="text-xs opacity-80">podpiski</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg">{stats.followers}</div>
                <div className="text-xs opacity-80">podpischiki</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg">{stats.views}</div>
                <div className="text-xs opacity-80">prosmotr</div>
              </div>
            </div>

            {/* Subscribe Button */}
            <button 
              onClick={handleSubscribe}
              className={`w-full backdrop-blur-sm active:scale-95 transition-all text-white font-medium py-2.5 rounded-xl mb-4 flex items-center justify-center gap-2 ${
                isSubscribed ? 'bg-green-500/50 hover:bg-green-500/60' : 'bg-white/30 hover:bg-white/40'
              }`}
            >
              {isSubscribed ? (
                <>
                  <UserCheck className="w-5 h-5" />
                  <span>Vi podpisani</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Podpisatsya</span>
                </>
              )}
            </button>

            {/* Action Buttons Row */}
            <div className="flex gap-3">
              <button 
                onClick={() => setShowReviews(true)}
                className="flex-1 bg-white/30 backdrop-blur-sm hover:bg-white/40 active:scale-95 transition-all text-white text-sm font-medium py-2 rounded-xl flex items-center justify-center gap-2"
              >
                <span>Otzivi ({reviews.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="space-y-3">
          {/* Name Card */}
          <div 
            className="w-full p-5 rounded-[1.5rem] flex items-center justify-center shadow-sm"
            style={{ backgroundColor: lightCardColor }}
          >
            <span className="text-black font-medium text-lg">
              {targetUserName || 'Imya Polzovatelya'}
            </span>
          </div>

          {/* Phone Card - Hiding phone for privacy or showing partially? Let's show it as requested */}
          <div 
            className="w-full p-5 rounded-[1.5rem] flex items-center justify-center shadow-sm"
            style={{ backgroundColor: lightCardColor }}
          >
             <span className="text-black font-medium text-lg">
              {targetUserPhone}
            </span>
          </div>
        </div>
      </div>

      {/* Reviews Modal */}
      {showReviews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowReviews(false)}>
          <div 
            className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col ${
              isNight ? 'bg-[#2d1222]' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="p-4 flex items-center justify-between shrink-0"
              style={{ backgroundColor: headerColor }}
            >
              <h2 className="text-lg font-bold text-black">Otzivi polzovatelya</h2>
              <button onClick={() => setShowReviews(false)} className="text-black">
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {reviews.length === 0 ? (
                <div className={`text-center py-8 ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Net otzivov</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div 
                      key={review.id} 
                      className={`p-3 rounded-xl border ${
                        isNight ? 'bg-[#08090D] border-gray-700' : 'bg-gray-50 border-gray-100'
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
                          <div className={`font-medium text-sm line-clamp-1 ${isNight ? 'text-white' : 'text-black'}`}>
                            {review.products.name}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`w-4 h-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                      <p className={`text-sm ${isNight ? 'text-gray-300' : 'text-gray-600'}`}>
                        {review.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}