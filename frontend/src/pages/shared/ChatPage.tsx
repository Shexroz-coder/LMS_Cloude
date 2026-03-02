import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import {
  Send, Paperclip, Mic, Image, X, Phone, Search,
  CheckCheck, Check, Download, Play, Pause, Plus,
  MessageCircle, Users, ChevronLeft, StopCircle, File as FileIcon,
  WifiOff,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import { connectSocket, getSocket } from '../../services/socket';

// ─── Types ──────────────────────────────────────────────
interface ChatUser {
  id: number;
  fullName: string;
  role: string;
  avatarUrl?: string;
}
interface ChatItem {
  id: number;
  type: 'DIRECT' | 'GROUP' | 'ANNOUNCEMENT';
  name?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  participants: { userId: number; user: ChatUser }[];
}
interface Message {
  id: number;
  chatId: number;
  senderId: number;
  content?: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  createdAt: string;
  sender: ChatUser;
  tempId?: string;
  pending?: boolean;
}
interface Contact {
  id: number;
  fullName: string;
  role: string;
  avatarUrl?: string;
}
interface GroupInfo {
  id: number;
  name: string;
  teacherName: string;
  chatId: number | null;
  memberCount: number;
}

// ─── Constants ───────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'bg-red-500', TEACHER: 'bg-blue-500',
  STUDENT: 'bg-emerald-500', PARENT: 'bg-purple-500',
};
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', TEACHER: 'Ustoz', STUDENT: "O'quvchi", PARENT: 'Ota-ona',
};

// ─── Avatar ──────────────────────────────────────────────
function Avatar({ user, size = 10 }: { user: Partial<ChatUser> & { fullName: string }; size?: number }) {
  const initials = user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const colorClass = ROLE_COLOR[user.role || ''] || 'bg-gray-400';
  const sizeClass = `w-${size} h-${size}`;
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt={user.fullName}
      className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />
  ) : (
    <div className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-semibold" style={{ fontSize: size <= 8 ? 10 : 12 }}>{initials}</span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d: string) {
  const date = new Date(d);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Bugun';
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (date.toDateString() === yest.toDateString()) return 'Kecha';
  return date.toLocaleDateString('uz', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtSize(b?: number) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// ─── Voice Player ─────────────────────────────────────────
function VoicePlayer({ url, duration, isMe }: { url: string; duration?: number; isMe: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cur, setCur] = useState(0);
  const ref = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    const a = ref.current; if (!a) return;
    playing ? a.pause() : a.play();
    setPlaying(!playing);
  };

  const barBg = isMe ? 'bg-blue-300' : 'bg-gray-300';
  const barFill = isMe ? 'bg-white' : 'bg-blue-500';

  return (
    <div className="flex items-center gap-2" style={{ minWidth: 200 }}>
      <audio ref={ref} src={url}
        onTimeUpdate={() => { const a = ref.current; if (a?.duration) { setProgress((a.currentTime / a.duration) * 100); setCur(a.currentTime); } }}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
      <button onClick={toggle}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-blue-100'}`}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="flex-1">
        <div className={`h-1.5 ${barBg} rounded-full overflow-hidden`}>
          <div className={`h-full ${barFill} rounded-full transition-all`} style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-xs opacity-70">{Math.floor(cur)}s/{duration || '?'}s</span>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────
function Bubble({ msg, isMe, showAvatar, showName }: {
  msg: Message; isMe: boolean; showAvatar: boolean; showName: boolean;
}) {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-0.5 items-end gap-1.5`}>
      {!isMe && (
        showAvatar
          ? <Avatar user={msg.sender} size={8} />
          : <div className="w-8 flex-shrink-0" />
      )}

      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`}>
        {showName && !isMe && (
          <span className="text-xs font-semibold px-1 mb-0.5 text-blue-600">{msg.sender.fullName}</span>
        )}

        <div className={`relative px-3 py-2 rounded-2xl shadow-sm
          ${isMe
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-white text-gray-800 rounded-bl-sm'}
          ${msg.pending ? 'opacity-60' : ''}`}>

          {msg.type === 'IMAGE' && msg.fileUrl && (
            <a href={msg.fileUrl} target="_blank" rel="noreferrer">
              <img src={msg.fileUrl} alt="rasm"
                className="rounded-xl max-w-[220px] max-h-[220px] object-cover cursor-pointer" />
            </a>
          )}
          {msg.type === 'VOICE' && msg.fileUrl && (
            <VoicePlayer url={msg.fileUrl} duration={msg.duration} isMe={isMe} />
          )}
          {msg.type === 'FILE' && msg.fileUrl && (
            <a href={msg.fileUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 hover:opacity-80">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-blue-50'}`}>
                <FileIcon size={20} className={isMe ? 'text-white' : 'text-blue-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate max-w-[140px]">{msg.fileName || 'Fayl'}</p>
                <p className="text-xs opacity-60">{fmtSize(msg.fileSize)}</p>
              </div>
              <Download size={15} className="opacity-60 flex-shrink-0" />
            </a>
          )}
          {msg.type === 'TEXT' && msg.content && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          )}
          {msg.content && msg.type !== 'TEXT' && (
            <p className="text-sm mt-1 whitespace-pre-wrap break-words">{msg.content}</p>
          )}

          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className={`text-[10px] ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>{fmtTime(msg.createdAt)}</span>
            {isMe && (
              msg.pending
                ? <Check size={10} className="text-blue-200" />
                : <CheckCheck size={10} className="text-blue-100" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Chat Modal ──────────────────────────────────────
const ROLE_ORDER: Record<string, number> = { ADMIN: 0, TEACHER: 1, STUDENT: 2, PARENT: 3 };

function NewChatModal({ contacts, onClose, onSelect }: {
  contacts: Contact[]; onClose: () => void; onSelect: (id: number) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = contacts
    .filter((c) => c.fullName.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));

  // Group by role
  const byRole: Record<string, Contact[]> = {};
  filtered.forEach((c) => {
    if (!byRole[c.role]) byRole[c.role] = [];
    byRole[c.role].push(c);
  });

  const sortedRoles = Object.keys(byRole).sort(
    (a, b) => (ROLE_ORDER[a] ?? 9) - (ROLE_ORDER[b] ?? 9)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-800">Yangi chat boshlash</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
            <Search size={15} className="text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Ism bo'yicha qidirish..." className="bg-transparent flex-1 text-sm outline-none" autoFocus />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Topilmadi</p>
          )}
          {sortedRoles.map((role) => (
            <div key={role}>
              <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 sticky top-0">
                {ROLE_LABEL[role] || role}
              </p>
              {byRole[role].map((c) => (
                <button key={c.id} onClick={() => onSelect(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition">
                  <Avatar user={c} size={10} />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{c.fullName}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABEL[c.role] || c.role}</p>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────
export default function ChatPage() {
  const { user, accessToken } = useAuthStore();
  const qc = useQueryClient();

  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<Set<number>>(new Set());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [socketConnected, setSocketConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'groups'>('chats');
  const [joiningGroupId, setJoiningGroupId] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const mediaRec = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval>>();
  const activeChatRef = useRef<number | null>(null);

  useEffect(() => { activeChatRef.current = activeChatId; }, [activeChatId]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Queries ──────────────────────────────────────────
  const { data: chats = [] } = useQuery<ChatItem[]>(
    'my-chats',
    () => api.get('/chats').then((r) => r.data?.data || []),
    { refetchInterval: 15000 }
  );
  const { data: contacts = [] } = useQuery<Contact[]>(
    'chat-contacts',
    () => api.get('/chats/contacts').then((r) => r.data?.data || [])
  );
  const { data: myGroups = [] } = useQuery<GroupInfo[]>(
    'my-groups',
    () => api.get('/chats/my-groups').then((r) => r.data?.data || []),
    { enabled: user?.role === 'STUDENT' || user?.role === 'TEACHER' }
  );

  // ── Socket setup ─────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    const socket = connectSocket();

    setSocketConnected(socket.connected);

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('new_message', (msg: Message) => {
      if (msg.chatId === activeChatRef.current) {
        setMessages((prev) => {
          // Temp xabarni almashtiramiz
          if (msg.tempId) {
            const idx = prev.findIndex((m) => m.tempId === msg.tempId);
            if (idx !== -1) {
              const copy = [...prev]; copy[idx] = { ...msg, pending: false }; return copy;
            }
          }
          // Duplicate'ni tekshiramiz
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // O'qildi deb belgilaymiz
        api.post(`/chats/${msg.chatId}/read`).catch(() => {});
      }
      qc.invalidateQueries('my-chats');
    });

    socket.on('user_typing', ({ userId, chatId }: { userId: number; chatId: number }) => {
      if (chatId === activeChatRef.current)
        setTypingUserIds((s) => new Set([...s, userId]));
    });
    socket.on('user_stop_typing', ({ userId }: { userId: number }) => {
      setTypingUserIds((s) => { const n = new Set(s); n.delete(userId); return n; });
    });
    socket.on('user_online', (uid: number) => setOnlineUserIds((s) => new Set([...s, uid])));
    socket.on('user_offline', (uid: number) => {
      setOnlineUserIds((s) => { const n = new Set(s); n.delete(uid); return n; });
    });
    socket.on('chat_updated', () => qc.invalidateQueries('my-chats'));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('chat_updated');
    };
  }, [accessToken, qc]);

  // ── Load messages ────────────────────────────────────
  useEffect(() => {
    if (!activeChatId) return;
    setMessages([]);
    setTypingUserIds(new Set());
    api.get(`/chats/${activeChatId}/messages`, { params: { limit: 60 } })
      .then((r) => setMessages(r.data?.data || []))
      .catch(() => {});
    api.post(`/chats/${activeChatId}/read`).catch(() => {});
    qc.invalidateQueries('my-chats');
  }, [activeChatId, qc]);

  // ── Auto scroll ──────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUserIds]);

  // ── Select chat ──────────────────────────────────────
  const selectChat = (id: number) => {
    setActiveChatId(id);
    if (isMobile) setMobileShowChat(true);
    const s = getSocket();
    if (s?.connected) s.emit('join_chat', id);
  };

  // ── Send text (REST → socket fallback) ───────────────
  const sendText = async () => {
    if (!inputText.trim() || !activeChatId || sending) return;
    const text = inputText.trim();
    const tempId = `tmp-${Date.now()}`;

    // Optimistic UI
    setMessages((p) => [...p, {
      id: -Date.now(), chatId: activeChatId, senderId: user!.id,
      content: text, type: 'TEXT',
      createdAt: new Date().toISOString(),
      sender: { id: user!.id, fullName: user!.fullName, role: user!.role },
      tempId, pending: true,
    }]);
    setInputText('');

    // Typing stop
    const s = getSocket();
    if (s?.connected) s.emit('stop_typing', { chatId: activeChatId });

    try {
      setSending(true);
      const res = await api.post(`/chats/${activeChatId}/messages`, {
        content: text, type: 'TEXT', tempId
      });
      const savedMsg: Message = res.data?.data;
      if (savedMsg) {
        // Replace optimistic message
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.tempId === tempId);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = { ...savedMsg, pending: false };
            return copy;
          }
          if (prev.some((m) => m.id === savedMsg.id)) return prev;
          return [...prev, { ...savedMsg, pending: false }];
        });
      }
    } catch {
      // Mark message as failed
      setMessages((prev) => prev.map((m) =>
        m.tempId === tempId ? { ...m, pending: false } : m
      ));
    } finally {
      setSending(false);
    }
    qc.invalidateQueries('my-chats');
  };

  // ── Upload & send ────────────────────────────────────
  const uploadAndSend = async (file: File, type: 'IMAGE' | 'FILE' | 'VOICE') => {
    if (!activeChatId) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await api.post('/chats/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { fileUrl, fileName, fileSize } = res.data?.data;
      const tempId = `tmp-${Date.now()}`;

      // Optimistic
      setMessages((p) => [...p, {
        id: -Date.now(), chatId: activeChatId, senderId: user!.id,
        type, fileUrl, fileName, fileSize,
        createdAt: new Date().toISOString(),
        sender: { id: user!.id, fullName: user!.fullName, role: user!.role },
        tempId, pending: true,
      }]);

      // Save via REST
      const msgRes = await api.post(`/chats/${activeChatId}/messages`, {
        type, fileUrl, fileName, fileSize, tempId
      });
      const savedMsg: Message = msgRes.data?.data;
      if (savedMsg) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.tempId === tempId);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = { ...savedMsg, pending: false };
            return copy;
          }
          return prev;
        });
      }
      qc.invalidateQueries('my-chats');
    } catch { alert('Fayl yuklashda xato'); }
  };

  // ── Typing ───────────────────────────────────────────
  const onInput = (v: string) => {
    setInputText(v);
    if (!activeChatId) return;
    const s = getSocket();
    if (s?.connected) {
      s.emit('typing', { chatId: activeChatId });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => s.emit('stop_typing', { chatId: activeChatId }), 2000);
    }
  };

  // ── Voice recording ──────────────────────────────────
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRec.current = mr; audioChunks.current = [];
      mr.ondataavailable = (e) => audioChunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        await uploadAndSend(new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }), 'VOICE');
      };
      mr.start(); setIsRecording(true); setRecTime(0);
      recTimer.current = setInterval(() => setRecTime((t) => t + 1), 1000);
    } catch { alert('Mikrofon ruxsati kerak'); }
  };
  const stopRec = () => {
    mediaRec.current?.stop(); clearInterval(recTimer.current);
    setIsRecording(false); setRecTime(0);
  };

  // ── Create direct chat ───────────────────────────────
  const createDirect = async (uid: number) => {
    try {
      const res = await api.post(`/chats/direct/${uid}`);
      setShowNewChat(false);
      await qc.invalidateQueries('my-chats');
      selectChat(res.data?.data?.id);
    } catch {}
  };

  // ── Join / open group chat ────────────────────────────
  const joinGroupChat = async (groupId: number, existingChatId: number | null) => {
    if (joiningGroupId) return;
    try {
      setJoiningGroupId(groupId);
      if (existingChatId) {
        // Chat allaqachon bor — bevosita ochish
        setSidebarTab('chats');
        selectChat(existingChatId);
      } else {
        // Yangi guruh chati yaratish
        const res = await api.post(`/chats/group/${groupId}`);
        await qc.invalidateQueries('my-chats');
        await qc.invalidateQueries('my-groups');
        setSidebarTab('chats');
        selectChat(res.data?.data?.id);
      }
    } catch {
      alert('Guruh chatiga kirishda xato yuz berdi');
    } finally {
      setJoiningGroupId(null);
    }
  };

  // ── Chat meta ────────────────────────────────────────
  const getChatName = useCallback((c: ChatItem) => {
    if (c.type === 'GROUP') return c.name || 'Guruh';
    const other = c.participants.find((p) => p.userId !== user?.id);
    return other?.user.fullName || 'Chat';
  }, [user]);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeOther = activeChat?.participants.find((p) => p.userId !== user?.id);
  const otherOnline = activeOther ? onlineUserIds.has(activeOther.userId) : false;

  const byDate: Record<string, Message[]> = {};
  messages.forEach((m) => {
    const k = new Date(m.createdAt).toDateString();
    if (!byDate[k]) byDate[k] = [];
    byDate[k].push(m);
  });

  // ─────────────────────────────────────────────────────
  return (
    <div className="flex rounded-xl overflow-hidden shadow-xl border border-gray-200"
      style={{ height: 'calc(100vh - 72px)' }}>

      {/* ── Chat list ─────────────────────────────────── */}
      <div className={`${isMobile && mobileShowChat ? 'hidden' : 'flex'} flex-col bg-white border-r border-gray-100 flex-shrink-0`}
        style={{ width: isMobile ? '100%' : 320 }}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 text-base">💬 Chatlar</span>
            {!socketConnected && (
              <span title="Socket ulanmagan — REST rejimi">
                <WifiOff size={13} className="text-orange-400" />
              </span>
            )}
          </div>
          <button onClick={() => setShowNewChat(true)}
            className="w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition">
            <Plus size={16} className="text-white" />
          </button>
        </div>

        {/* Tabs — only for STUDENT / TEACHER */}
        {(user?.role === 'STUDENT' || user?.role === 'TEACHER') && (
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setSidebarTab('chats')}
              className={`flex-1 py-2 text-xs font-semibold transition ${
                sidebarTab === 'chats'
                  ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              💬 Xabarlar
            </button>
            <button
              onClick={() => setSidebarTab('groups')}
              className={`flex-1 py-2 text-xs font-semibold transition ${
                sidebarTab === 'groups'
                  ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              👥 Guruhlar {myGroups.length > 0 && <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 rounded-full px-1.5">{myGroups.length}</span>}
            </button>
          </div>
        )}

        {/* Search — only in chats tab */}
        {sidebarTab === 'chats' && (
          <div className="px-3 py-2 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
              <Search size={14} className="text-gray-400" />
              <input placeholder="Qidirish..." className="bg-transparent text-sm flex-1 outline-none text-gray-700" />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* ── Groups tab ─────────────────────────────── */}
          {sidebarTab === 'groups' && (
            <div className="p-3 space-y-2">
              {myGroups.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Users size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Guruhlar topilmadi</p>
                </div>
              ) : (
                myGroups.map((g) => (
                  <div key={g.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-3 hover:border-blue-300 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <Users size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{g.name}</p>
                        <p className="text-xs text-gray-500">
                          👨‍🏫 {g.teacherName} · {g.memberCount} o'quvchi
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => joinGroupChat(g.id, g.chatId)}
                      disabled={joiningGroupId === g.id}
                      className="mt-2 w-full py-1.5 text-xs font-semibold rounded-lg transition
                        bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
                    >
                      {joiningGroupId === g.id
                        ? 'Kirmoqda...'
                        : g.chatId
                        ? '💬 Guruh chatini ochish'
                        : '🚀 Guruh chatini boshlash'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Chats tab ──────────────────────────────── */}
          {sidebarTab === 'chats' && (
            <>
              {chats.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2 pt-8">
                  <MessageCircle size={36} strokeWidth={1.5} />
                  <p className="text-sm">Hali chat yo'q</p>
                  <button onClick={() => setShowNewChat(true)} className="text-xs text-blue-500 hover:underline">
                    Yangi chat boshlash →
                  </button>
                </div>
              )}
              {chats.map((chat) => {
                const name = getChatName(chat);
                const isGroup = chat.type === 'GROUP';
                const isActive = chat.id === activeChatId;
                const other = chat.participants.find((p) => p.userId !== user?.id);
                const otherIsOnline = other ? onlineUserIds.has(other.userId) : false;

                return (
                  <button key={chat.id} onClick={() => selectChat(chat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-gray-50
                      ${isActive ? 'bg-blue-50 border-l-[3px] border-l-blue-500' : 'hover:bg-gray-50'}`}>

                    <div className="relative flex-shrink-0">
                      {isGroup
                        ? <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                            <Users size={18} className="text-white" />
                          </div>
                        : <div className="relative">
                            <Avatar user={other?.user || { fullName: name }} size={12} />
                            {otherIsOnline && (
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                            )}
                          </div>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <p className="font-semibold text-gray-800 text-sm truncate">{name}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
                          {chat.lastMessageAt ? fmtDate(chat.lastMessageAt) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-gray-500 truncate pr-2">
                          {chat.lastMessage || (isGroup ? `${chat.participants.length} kishi` : ROLE_LABEL[other?.user.role || ''] || '')}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center px-1">
                            {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Chat area ─────────────────────────────────── */}
      <div className={`${isMobile && !mobileShowChat ? 'hidden' : 'flex'} flex-1 flex-col`}
        style={{ background: '#efeae2' }}>

        {!activeChatId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-500">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow">
              <MessageCircle size={40} className="text-blue-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700 text-lg">Chat tanlang</p>
              <p className="text-sm text-gray-400 mt-1">Chap tomondagi chatni bosing yoki yangi chat boshlang</p>
            </div>
            <button onClick={() => setShowNewChat(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition">
              Yangi chat
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
              {isMobile && (
                <button onClick={() => { setMobileShowChat(false); setActiveChatId(null); }}>
                  <ChevronLeft size={22} className="text-gray-600" />
                </button>
              )}
              {activeChat?.type === 'GROUP'
                ? <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <Users size={18} className="text-white" />
                  </div>
                : <Avatar user={activeOther?.user || { fullName: '?' }} size={10} />
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">
                  {activeChat ? getChatName(activeChat) : ''}
                </p>
                <p className={`text-xs ${typingUserIds.size > 0 ? 'text-green-500' : otherOnline ? 'text-green-400' : 'text-gray-400'}`}>
                  {typingUserIds.size > 0
                    ? 'Yozmoqda...'
                    : activeChat?.type === 'GROUP'
                    ? `${activeChat.participants.length} ishtirokchi`
                    : otherOnline ? 'Online' : ROLE_LABEL[activeOther?.user.role || ''] || ''}
                </p>
              </div>
              <Phone size={18} className="text-gray-400 cursor-pointer" />
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {Object.entries(byDate).map(([day, msgs]) => (
                <div key={day}>
                  <div className="flex justify-center my-3">
                    <span className="bg-white/80 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                      {fmtDate(msgs[0].createdAt)}
                    </span>
                  </div>
                  {msgs.map((msg, i) => {
                    const isMe = msg.senderId === user?.id;
                    const prev = msgs[i - 1];
                    const next = msgs[i + 1];
                    const showAvatar = !isMe && (!next || next.senderId !== msg.senderId);
                    const showName = !isMe && activeChat?.type === 'GROUP' && (!prev || prev.senderId !== msg.senderId);
                    return (
                      <Bubble key={msg.tempId || msg.id} msg={msg} isMe={isMe}
                        showAvatar={showAvatar} showName={showName} />
                    );
                  })}
                </div>
              ))}

              {typingUserIds.size > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            <div className="px-3 py-2 bg-white border-t border-gray-100 flex-shrink-0">
              {isRecording ? (
                <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border border-red-200 rounded-2xl">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-600 text-sm font-medium flex-1">🎤 Yozilmoqda… {recTime}s</span>
                  <button onClick={stopRec}
                    className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition">
                    <StopCircle size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="flex gap-1 pb-1">
                    <button onClick={() => imgRef.current?.click()}
                      className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition">
                      <Image size={19} />
                    </button>
                    <button onClick={() => fileRef.current?.click()}
                      className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition">
                      <Paperclip size={19} />
                    </button>
                  </div>

                  <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2">
                    <textarea
                      value={inputText}
                      onChange={(e) => onInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                      placeholder="Xabar yozing..."
                      rows={1}
                      className="w-full bg-transparent text-sm text-gray-800 outline-none resize-none leading-relaxed"
                      style={{ maxHeight: 120, overflowY: 'auto' }}
                    />
                  </div>

                  {inputText.trim() ? (
                    <button onClick={sendText} disabled={sending}
                      className="w-10 h-10 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-full flex items-center justify-center text-white flex-shrink-0 transition shadow">
                      <Send size={17} />
                    </button>
                  ) : (
                    <button
                      onMouseDown={startRec}
                      onTouchStart={startRec}
                      className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 flex-shrink-0 transition">
                      <Mic size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <input ref={imgRef} type="file" className="hidden" accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAndSend(f, 'IMAGE'); e.target.value = ''; }} />
      <input ref={fileRef} type="file" className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.mp4,.webm"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAndSend(f, 'FILE'); e.target.value = ''; }} />

      {showNewChat && (
        <NewChatModal contacts={contacts} onClose={() => setShowNewChat(false)} onSelect={createDirect} />
      )}
    </div>
  );
}
