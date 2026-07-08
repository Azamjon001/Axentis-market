import { useState } from 'react';
import { Key, ArrowLeft } from 'lucide-react';

interface CompanyKeyVerificationProps {
  onVerify: (key: string) => boolean;
  onBack: () => void;
}

export default function CompanyKeyVerification({ onVerify, onBack }: CompanyKeyVerificationProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (key.length !== 30) {
      setError('Ключ должен содержать 30 символов');
      return;
    }

    const success = onVerify(key);
    if (!success) {
      setError('Неверный ключ доступа');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Назад
          </button>

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Key className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          
          <h1 className="text-center mb-2">Ключ доступа</h1>
          <p className="text-center text-gray-600 mb-6">
            Введите 30-значный ключ доступа компании
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Ключ (30 символов)</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.slice(0, 30))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Введите ключ доступа"
                maxLength={30}
              />
              <div className="mt-1 text-sm text-gray-500">
                {key.length}/30 символов
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Подтвердить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
