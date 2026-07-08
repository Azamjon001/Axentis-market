import { Home, ShoppingCart, User, Heart } from "lucide-react";

interface BottomNavigationProps {
  currentPage: "home" | "cart" | "likes" | "settings";
  onNavigate: (page: "home" | "cart" | "likes" | "settings") => void;
  cartItemsCount?: number;
  likesCount?: number;
  displayMode?: "day" | "night";
}

// Нижняя навигация — как таб-бар в приложении Homepage:
// тёмный/светлый фон, акцентный индиго у активной вкладки, подписи под иконками.
export default function BottomNavigation({
  currentPage,
  onNavigate,
  cartItemsCount = 0,
  likesCount = 0,
  displayMode = "day",
}: BottomNavigationProps) {
  const isNight = displayMode === "night";
  const hp = {
    tabBar: isNight ? "#0B1020" : "#FFFFFF",
    border: isNight ? "rgba(255,255,255,0.06)" : "rgba(11,14,22,0.08)",
    active: "#6D5DFB",
    inactive: isNight ? "#6B7280" : "#9AA1AE",
  };

  // Порядок как в Homepage: Главная · Корзина · Избранное · Профиль
  const tabs: Array<{
    key: BottomNavigationProps["currentPage"];
    label: string;
    Icon: typeof Home;
    badge?: number;
  }> = [
    { key: "home", label: "Главная", Icon: Home },
    { key: "cart", label: "Корзина", Icon: ShoppingCart, badge: cartItemsCount },
    { key: "likes", label: "Избранное", Icon: Heart, badge: likesCount },
    { key: "settings", label: "Профиль", Icon: User },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[70] transition-colors duration-300"
      style={{
        background: hp.tabBar,
        borderTop: `1px solid ${hp.border}`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-stretch justify-around w-full max-w-2xl mx-auto">
        {tabs.map(({ key, label, Icon, badge }) => {
          const active = currentPage === key;
          const color = active ? hp.active : hp.inactive;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className="flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 transition-transform active:scale-95"
            >
              <div className="relative">
                <Icon className="w-[23px] h-[23px]" style={{ color }} fill={active ? color : "transparent"} />
                {badge && badge > 0 ? (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                    style={{ background: "#EF4444" }}
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px]" style={{ color, fontWeight: active ? 700 : 500 }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
