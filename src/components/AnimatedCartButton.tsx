import { useState, useEffect } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AnimatedCartButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isAdded?: boolean;
  text?: string;
  addedText?: string;
  compact?: boolean;
  className?: string;
}

export default function AnimatedCartButton({
  onClick,
  disabled = false,
  isAdded = false,
  text = 'В корзину',
  addedText = 'Добавлено',
  compact = false,
  className = '',
}: AnimatedCartButtonProps) {
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (isAdded) {
      setShowCheck(true);
      const timer = setTimeout(() => setShowCheck(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isAdded]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`relative overflow-hidden transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-medium rounded-xl
        ${disabled 
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
          : isAdded
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
        }
        ${compact ? 'py-2 text-sm w-full' : 'py-3 px-6 text-base w-full'}
        ${className}
      `}
    >
      <AnimatePresence mode="wait">
        {showCheck ? (
          <motion.div
            key="check"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="flex items-center gap-1.5"
          >
            <Check className={compact ? "w-4 h-4" : "w-5 h-5"} />
            <span>{addedText}</span>
          </motion.div>
        ) : (
          <motion.div
            key="cart"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="flex items-center gap-1.5"
          >
            <ShoppingCart className={compact ? "w-4 h-4" : "w-5 h-5"} />
            <span>{text}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Ripple effect could be added here if needed */}
    </button>
  );
}
