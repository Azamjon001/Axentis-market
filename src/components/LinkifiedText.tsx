/**
 * 🔗 Компонент для отображения текста с автоматическим превращением ссылок в кликабельные элементы
 */

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

export function LinkifiedText({ text, className = '', linkClassName = 'text-blue-600 hover:underline' }: LinkifiedTextProps) {
  // Регулярное выражение для поиска ссылок
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;

  // Разбиваем текст на части (текст и ссылки)
  const parts = text.split(urlRegex).filter(Boolean);

  return (
    <div className={className}>
      {parts.map((part, index) => {
        // Проверяем, является ли часть ссылкой
        if (part && (part.startsWith('http://') || part.startsWith('https://') || part.startsWith('www.'))) {
          const url = part.startsWith('www.') ? `https://${part}` : part;
          return (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
              onClick={(e) => e.stopPropagation()} // Предотвращаем всплытие клика
            >
              {part}
            </a>
          );
        }
        
        // Обычный текст
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}
