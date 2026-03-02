import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, X, Send, Minimize2, Maximize2,
  Sparkles, ChevronRight, RefreshCw, MessageCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../api/axios';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  quickReplies?: string[];
  timestamp: Date;
}

interface AiResponse {
  text: string;
  quickReplies: string[];
  intent: string;
}

// Convert markdown bold **text** to styled text for rendering
function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    // Handle newlines
    return <span key={i}>{part.split('\n').map((line, j, arr) => (
      <span key={j}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ))}</span>;
  });
}

const INITIAL_QUICK_REPLIES: Record<string, string[]> = {
  ADMIN:   ['📊 Statistika', '👥 O\'quvchilar', '💰 To\'lovlar', '❓ Yordam'],
  TEACHER: ['📋 Davomat qilish', '⭐ Baho qo\'yish', '👥 Guruhlarim', '❓ Yordam'],
  STUDENT: ['📚 Baholarim', '📋 Davomatim', '💎 Coinlarim', '❓ Yordam'],
  PARENT:  ['📊 Farzandim bahosi', '📋 Davomat', '💰 To\'lov holati', '❓ Yordam'],
};

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('ADMIN');
  const [hasUnread, setHasUnread] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Pulse animation on first load (after 5 sec)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        setPulseCount(prev => prev + 1);
        setHasUnread(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Initialize: load greeting
  const initializeChat = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const res = await api.get('/ai-assistant/context');
      const { greeting, role } = res.data?.data || {};
      setUserRole(role || 'ADMIN');
      const welcomeMsg: Message = {
        id: 'welcome',
        role: 'assistant',
        text: greeting || 'Salom! Men AI yordamchisiman 🤖 Sizga qanday yordam bera olaman?',
        quickReplies: INITIAL_QUICK_REPLIES[role] || INITIAL_QUICK_REPLIES['ADMIN'],
        timestamp: new Date(),
      };
      setMessages([welcomeMsg]);
    } catch {
      const welcomeMsg: Message = {
        id: 'welcome',
        role: 'assistant',
        text: 'Salom! Men RoboticEdu AI yordamchisiman 🤖\nSizga tizimdan foydalanishda yordam bera olaman!',
        quickReplies: ['📋 Davomat', '⭐ Baholar', '❓ Yordam'],
        timestamp: new Date(),
      };
      setMessages([welcomeMsg]);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setHasUnread(false);
    initializeChat();
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai-assistant/chat', { message: text.trim() });
      const data: AiResponse = res.data?.data;

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: data.text,
        quickReplies: data.quickReplies || [],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Kechirasiz, xato yuz berdi. Iltimos qayta urinib ko\'ring.',
        quickReplies: ['❓ Yordam', '🔧 Tizim holati'],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickReply = (reply: string) => {
    sendMessage(reply);
  };

  const handleReset = () => {
    initialized.current = false;
    setMessages([]);
    initializeChat();
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className={clsx(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl',
          'flex items-center justify-center transition-all duration-300',
          'bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500',
          'hover:scale-110 active:scale-95',
          isOpen && 'rotate-0',
        )}
        title="AI Yordamchi"
        aria-label="AI Yordamchi"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="relative">
            <Bot className="w-7 h-7 text-white" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border border-white" />
            )}
          </div>
        )}
        {/* Pulse ring */}
        {!isOpen && pulseCount > 0 && pulseCount <= 3 && (
          <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-30" />
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div
          className={clsx(
            'fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200',
            'flex flex-col transition-all duration-300 origin-bottom-right',
            isMinimized
              ? 'bottom-24 right-6 w-72 h-14'
              : 'bottom-24 right-6 w-[360px] sm:w-[400px] h-[560px]',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-t-2xl flex-shrink-0">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">AI Yordamchi</h3>
              <p className="text-[11px] text-indigo-200">RoboticEdu · Har doim yordam beradi</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Tozalash"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                title={isMinimized ? 'Kattalashtirish' : 'Kichraytirish'}
              >
                {isMinimized
                  ? <Maximize2 className="w-3.5 h-3.5 text-white" />
                  : <Minimize2 className="w-3.5 h-3.5 text-white" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Yopish"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <Sparkles className="w-10 h-10 text-indigo-300 mb-3" />
                    <p className="text-sm text-gray-400">Yuklanmoqda...</p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={clsx(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={clsx(
                      'max-w-[80%] flex flex-col gap-2',
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    )}>
                      <div className={clsx(
                        'px-3 py-2.5 rounded-2xl text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-sm'
                          : 'bg-white text-gray-700 rounded-tl-sm shadow-sm border border-gray-100'
                      )}>
                        {renderMarkdown(msg.text)}
                      </div>

                      {/* Quick replies */}
                      {msg.role === 'assistant' && msg.quickReplies && msg.quickReplies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.quickReplies.map((reply, i) => (
                            <button
                              key={i}
                              onClick={() => handleQuickReply(reply)}
                              disabled={loading}
                              className={clsx(
                                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                                'border border-indigo-200 text-indigo-600 bg-indigo-50',
                                'hover:bg-indigo-100 hover:border-indigo-300 transition-colors',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                              )}
                            >
                              {reply}
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      )}

                      <span className="text-[10px] text-gray-400 px-1">
                        {msg.timestamp.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
                      <div className="flex gap-1 items-center h-4">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t border-gray-100 bg-white rounded-b-2xl">
                <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Savol yozing..."
                    disabled={loading}
                    className={clsx(
                      'flex-1 text-sm px-3 py-2.5 rounded-xl border border-gray-200',
                      'focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300',
                      'placeholder-gray-400 bg-gray-50',
                      'disabled:opacity-60',
                    )}
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                      'bg-gradient-to-br from-indigo-600 to-violet-600',
                      'hover:from-indigo-500 hover:to-violet-500',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      'active:scale-95',
                    )}
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </form>

                {/* Footer hint */}
                <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  AI yordamchi · RoboticEdu LMS
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default AIAssistant;
