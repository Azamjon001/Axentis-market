import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Image as ImageIcon, Mic, Square, MoreVertical, Edit2, Trash2, Ban, X, Check } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';
import { getCurrentLanguage, type Language } from '../utils/translations';

interface BMessage {
  id: number;
  senderType: 'admin' | 'company';
  senderCompanyId?: number;
  senderName: string;
  type: 'text' | 'image' | 'voice' | 'link';
  content: string;
  mediaUrl?: string;
  edited: boolean;
  deleted: boolean;
  createdAt: string;
}

interface BroadcastChatPanelProps {
  isAdmin?: boolean;
  companyId?: number;
}

// Общий чат-канал: админ — владелец, компании — участники.
export default function BroadcastChatPanel({ isAdmin = false, companyId }: BroadcastChatPanelProps) {
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const [messages, setMessages] = useState<BMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [banned, setBanned] = useState(false);
  const [banUntil, setBanUntil] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const uz = language === 'uz';

  useEffect(() => {
    const h = (e: Event) => setLanguage((e as CustomEvent).detail);
    window.addEventListener('languageChange', h as EventListener);
    return () => window.removeEventListener('languageChange', h as EventListener);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.broadcast.list(150);
      setMessages(res.messages || []);
      setBanned(!!res.myBanned);
      setBanUntil(res.myBanUntil || null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const isOwn = (m: BMessage) =>
    isAdmin ? m.senderType === 'admin' : (m.senderType === 'company' && m.senderCompanyId === companyId);
  const canModify = (m: BMessage) => isAdmin || isOwn(m);

  const sendText = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await api.broadcast.send({ type: 'text', content: t });
      setText('');
      await load();
    } catch (e: any) {
      if (String(e?.message || '').includes('banned')) setBanned(true);
    } finally { setSending(false); }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const up = await api.broadcast.upload(file, file.name);
      await api.broadcast.send({ type: 'image', mediaUrl: up.url });
      await load();
    } catch { /* ignore */ }
    if (fileRef.current) fileRef.current.value = '';
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const up = await api.broadcast.upload(blob, 'voice.webm');
          await api.broadcast.send({ type: 'voice', mediaUrl: up.url });
          await load();
        } catch { /* ignore */ }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch {
      alert(uz ? 'Mikrofonga ruxsat kerak' : 'Нужен доступ к микрофону');
    }
  };
  const stopRec = () => { recorderRef.current?.stop(); setRecording(false); };

  const saveEdit = async (id: number) => {
    const t = editText.trim();
    if (!t) return;
    try { await api.broadcast.edit(id, t); setEditingId(null); await load(); } catch { /* ignore */ }
  };
  const del = async (id: number) => {
    try { await api.broadcast.remove(id); setMenuId(null); await load(); } catch { /* ignore */ }
  };
  const ban = async (cidToBan: number, minutes: number) => {
    try { await api.broadcast.ban(cidToBan, minutes); setMenuId(null); await load(); } catch { /* ignore */ }
  };

  const renderText = (s: string) =>
    s.split(/(\s+)/).map((w, i) =>
      /^https?:\/\//.test(w)
        ? <a key={i} href={w} target="_blank" rel="noreferrer" style={{ color: '#9b8cff', textDecoration: 'underline', wordBreak: 'break-all' }}>{w}</a>
        : <span key={i}>{w}</span>,
    );

  const fmtTime = (s: string) => {
    try { return new Date(s).toLocaleTimeString(uz ? 'uz-UZ' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };
  const fmtUntil = (s: string | null) => {
    if (!s) return uz ? 'butunlay' : 'навсегда';
    try { return new Date(s).toLocaleString(uz ? 'uz-UZ' : 'ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const banOptions = [
    { m: 15, label: uz ? '15 daqiqa' : '15 минут' },
    { m: 60, label: uz ? '1 soat' : '1 час' },
    { m: 1440, label: uz ? '24 soat' : '24 часа' },
    { m: 0, label: uz ? 'Butunlay' : 'Навсегда' },
  ];

  const inputDisabled = !isAdmin && banned;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)', minHeight: 480, background: 'var(--ax-bg)', color: 'var(--ax-text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 rounded-t-xl" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold" style={{ background: 'linear-gradient(135deg,#6D5DFB,#5546E0)', color: '#fff' }}>A</div>
          <div>
            <div className="font-semibold text-sm">{uz ? 'Umumiy kanal' : 'Общий канал'}</div>
            <div className="text-xs" style={{ color: 'var(--ax-text-2)' }}>
              {isAdmin ? (uz ? 'Siz — kanal egasi' : 'Вы — владелец канала') : (uz ? 'Barcha kompaniyalar' : 'Все компании')}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ background: 'var(--ax-bg)', borderLeft: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        {messages.length === 0 && (
          <div className="text-center text-sm py-10" style={{ color: 'var(--ax-text-2)' }}>
            {uz ? 'Hali xabarlar yo‘q' : 'Сообщений пока нет'}
          </div>
        )}
        {messages.map((m) => {
          const own = isOwn(m);
          const admin = m.senderType === 'admin';
          const showMenu = !m.deleted && (canModify(m) || (isAdmin && m.senderType === 'company'));
          return (
            <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
              <div
                className="relative rounded-2xl px-3 py-2"
                style={{
                  maxWidth: '78%',
                  background: own ? 'linear-gradient(135deg,#6D5DFB,#5546E0)' : 'var(--ax-card)',
                  color: own ? '#fff' : 'var(--ax-text)',
                  border: own ? 'none' : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Sender name */}
                {!own && (
                  <div className="text-xs font-semibold mb-0.5" style={{ color: admin ? '#9b8cff' : '#5C9BFF' }}>
                    {admin ? 'Axentis' : m.senderName}{admin ? ' • ' + (uz ? 'admin' : 'админ') : ''}
                  </div>
                )}

                {m.deleted ? (
                  <div className="text-sm italic" style={{ opacity: 0.6 }}>{uz ? 'xabar o‘chirilgan' : 'сообщение удалено'}</div>
                ) : editingId === m.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(m.id)}
                      className="text-sm px-2 py-1 rounded outline-none"
                      style={{ background: 'rgba(0,0,0,0.25)', color: '#fff', minWidth: 160 }}
                    />
                    <button onClick={() => saveEdit(m.id)}><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)}><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    {(m.type === 'text' || m.type === 'link') && (
                      <div className="text-sm whitespace-pre-wrap break-words">{renderText(m.content)}</div>
                    )}
                    {m.type === 'image' && m.mediaUrl && (
                      <img src={getImageUrl(m.mediaUrl) || ''} alt="" className="rounded-lg" style={{ maxWidth: 240, maxHeight: 240, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(getImageUrl(m.mediaUrl) || '', '_blank')} />
                    )}
                    {m.type === 'voice' && m.mediaUrl && (
                      <audio controls src={getImageUrl(m.mediaUrl) || ''} style={{ height: 36 }} />
                    )}
                  </>
                )}

                {/* meta */}
                <div className="flex items-center gap-1 mt-0.5 text-[10px]" style={{ opacity: 0.7, justifyContent: own ? 'flex-end' : 'flex-start' }}>
                  {m.edited && !m.deleted && <span>{uz ? 'tahrirlangan' : 'изменено'}</span>}
                  <span>{fmtTime(m.createdAt)}</span>
                </div>

                {/* actions */}
                {showMenu && (
                  <button
                    onClick={() => setMenuId(menuId === m.id ? null : m.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--ax-text-2)' }}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                )}
                {menuId === m.id && (
                  <div className="absolute z-20 top-5 right-0 rounded-lg py-1 text-sm" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.12)', minWidth: 170, color: 'var(--ax-text)' }}>
                    {(m.type === 'text' || m.type === 'link') && canModify(m) && (
                      <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:opacity-80 text-left" onClick={() => { setEditingId(m.id); setEditText(m.content); setMenuId(null); }}>
                        <Edit2 className="w-3.5 h-3.5" /> {uz ? 'Tahrirlash' : 'Изменить'}
                      </button>
                    )}
                    {canModify(m) && (
                      <button className="flex items-center gap-2 w-full px-3 py-1.5 hover:opacity-80 text-left" style={{ color: '#EF4444' }} onClick={() => del(m.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> {uz ? 'O‘chirish' : 'Удалить'}
                      </button>
                    )}
                    {isAdmin && m.senderType === 'company' && m.senderCompanyId && (
                      <div className="border-t mt-1 pt-1" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                        <div className="px-3 py-1 text-[11px] flex items-center gap-1" style={{ color: 'var(--ax-text-2)' }}><Ban className="w-3 h-3" /> {uz ? 'Bloklash' : 'Заблокировать'}</div>
                        {banOptions.map((b) => (
                          <button key={b.m} className="w-full px-3 py-1.5 text-left hover:opacity-80 text-xs" onClick={() => ban(m.senderCompanyId as number, b.m)}>
                            {b.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Ban banner for company */}
      {!isAdmin && banned && (
        <div className="px-4 py-2 text-sm text-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', borderLeft: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          {uz ? 'Siz kanalda yozishdan bloklangansiz' : 'Вы заблокированы в канале'} — {fmtUntil(banUntil)}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-center gap-2 px-3 py-3 rounded-b-xl" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} disabled={inputDisabled} />
        <button onClick={() => fileRef.current?.click()} disabled={inputDisabled} className="p-2 rounded-lg disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--ax-text)' }} title={uz ? 'Rasm' : 'Фото'}>
          <ImageIcon className="w-5 h-5" />
        </button>
        {recording ? (
          <button onClick={stopRec} className="p-2 rounded-lg" style={{ background: '#EF4444', color: '#fff' }} title={uz ? 'To‘xtatish' : 'Стоп'}>
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={startRec} disabled={inputDisabled} className="p-2 rounded-lg disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--ax-text)' }} title={uz ? 'Ovozli' : 'Голосовое'}>
            <Mic className="w-5 h-5" />
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendText())}
          placeholder={inputDisabled ? (uz ? 'Bloklangansiz' : 'Вы заблокированы') : recording ? (uz ? 'Yozilmoqda…' : 'Идёт запись…') : (uz ? 'Xabar yozing…' : 'Напишите сообщение…')}
          disabled={inputDisabled || recording}
          className="flex-1 px-3 py-2 rounded-lg outline-none text-sm disabled:opacity-50"
          style={{ background: 'var(--ax-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ax-text)' }}
        />
        <button onClick={sendText} disabled={inputDisabled || sending || !text.trim()} className="p-2 rounded-lg disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#6D5DFB,#5546E0)', color: '#fff' }}>
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
