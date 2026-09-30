import { useState } from 'react';
import { KeyRound, Copy, Check, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Modal from './Modal';

interface Props {
  userId: number;
  userName?: string;
  onClose: () => void;
}

/**
 * Super admin istalgan foydalanuvchi uchun YANGI parol o'rnatadi va ko'radi.
 * (Eski bcrypt parol qaytarilmaydi — bu yangi parol.)
 */
const SetPasswordModal = ({ userId, userName, onClose }: Props) => {
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(true);

  const submit = async () => {
    setLoading(true);
    try {
      const r = await api.patch('/auth/admin/reset-password', {
        userId,
        newPassword: pwd.trim() || undefined,
      });
      const p = r.data?.data?.password as string;
      setResult(p);
      toast.success('Yangi parol o\'rnatildi');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xato yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <Modal title={<span className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-indigo-500" /> Parol o'rnatish</span>} onClose={onClose} maxWidth="max-w-sm"
      footer={
        result ? (
          <button onClick={onClose} className="btn-primary w-full">Yopish</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">Bekor</button>
            <button onClick={submit} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saqlanmoqda...' : "O'rnatish"}
            </button>
          </div>
        )
      }>
      <div className="px-6 py-4 space-y-3">
        {userName && <p className="text-sm text-gray-500 dark:text-gray-400"><b className="text-gray-800 dark:text-gray-100">{userName}</b> uchun yangi parol</p>}

        {!result ? (
          <>
            <div>
              <label className="label">Yangi parol <span className="text-gray-400 text-xs">(bo'sh qoldirsangiz avtomatik yaratiladi)</span></label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  placeholder="Masalan: edu1234"
                  className="input pr-10"
                />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Eski parol ko'rsatib bo'lmaydi (xavfsiz shifrlangan). Bu yangi parol foydalanuvchining eski parolini almashtiradi.
            </p>
          </>
        ) : (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Yangi parol o'rnatildi. Foydalanuvchiga bering:</p>
            <div className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3">
              <code className="text-lg font-bold tracking-wider text-indigo-600 dark:text-indigo-400 select-all">{result}</code>
              <button onClick={copy} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">Bu parolни boshqa joyдан keyinroq ko'rib bo'lmaydi — hozir nusxa oling.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SetPasswordModal;
