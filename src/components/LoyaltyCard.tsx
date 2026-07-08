import { useState, useEffect } from 'react';
import { Sparkles, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import api from '../utils/api';

interface LoyaltyTx {
  id: number;
  points: number;
  type: 'earn' | 'redeem' | 'adjust';
  description: string;
  createdAt: string;
}

interface LoyaltyData {
  pointsBalance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: LoyaltyTx[];
}

interface LoyaltyCardProps {
  userPhone?: string;
}

/**
 * Shows the signed-in user's cashback points balance and recent history.
 * Backend: GET /api/loyalty/:phone.
 */
export default function LoyaltyCard({ userPhone }: LoyaltyCardProps) {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userPhone) return;
    let active = true;
    api.loyalty
      .get(userPhone)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => console.error('Load loyalty failed:', e));
    return () => {
      active = false;
    };
  }, [userPhone]);

  if (!userPhone) return null;

  const balance = data?.pointsBalance ?? 0;
  const txs = data?.transactions ?? [];

  return (
    <div
      className="w-full p-5 rounded-[1.5rem] shadow-sm text-white"
      style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <span className="font-medium">Мои баллы</span>
        </div>
        <span className="text-2xl font-bold">{balance.toLocaleString()}</span>
      </div>

      <div className="flex gap-4 mt-2 text-xs opacity-90">
        <span>Начислено: {(data?.totalEarned ?? 0).toLocaleString()}</span>
        <span>Потрачено: {(data?.totalSpent ?? 0).toLocaleString()}</span>
      </div>

      {txs.length > 0 && (
        <>
          <button
            onClick={() => setOpen(!open)}
            className="mt-3 text-xs underline opacity-90"
          >
            {open ? 'Скрыть историю' : 'История'}
          </button>
          {open && (
            <div className="mt-2 space-y-1.5">
              {txs.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm bg-white/15 rounded-lg px-2 py-1.5">
                  <span className="flex items-center gap-1.5">
                    {tx.type === 'redeem' ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                    {tx.description || (tx.type === 'redeem' ? 'Списание' : 'Начисление')}
                  </span>
                  <span className="font-medium">
                    {tx.type === 'redeem' ? '-' : '+'}
                    {tx.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
