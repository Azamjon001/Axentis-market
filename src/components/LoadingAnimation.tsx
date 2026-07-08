interface LoadingAnimationProps {
  text?: string;
}

export default function LoadingAnimation({ text = 'Загрузка...' }: LoadingAnimationProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center px-6">
      {/* Animated Spinner */}
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-pink-500 rounded-full border-t-transparent animate-spin"></div>
      </div>

      {/* Loading Text */}
      <p className="text-gray-700 text-lg font-medium text-center mb-2">
        {text}
      </p>

      {/* Animated Dots */}
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
}
