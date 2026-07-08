import { useState } from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react';

interface SmsVerificationProps {
  phone: string;
  onVerify: (code: string) => void;
  onBack: () => void;
}

export default function SmsVerification({ phone, onVerify, onBack }: SmsVerificationProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 5) {
      setError('Код должен содержать 5 цифр');
      return;
    }

    onVerify(code);
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
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <h1 className="text-center mb-2">Подтверждение</h1>
          <p className="text-center text-gray-600 mb-6">
            Введите 5-значный код, отправленный на номер<br />
            <span className="font-medium">{phone}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Код подтверждения</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="00000"
                maxLength={5}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              Подтвердить
            </button>
          </form>

          <div className="mt-6 text-center">
            <button className="text-blue-600 hover:text-blue-700 transition-colors">
              Отправить код повторно
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
