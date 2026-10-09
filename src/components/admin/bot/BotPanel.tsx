import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Users,
  HelpCircle,
  Send,
  RotateCcw,
  Bot,
  User,
  ShieldAlert,
  Loader2,
  Trash2,
  Plus,
  Edit2,
  Check,
  X,
  ExternalLink,
  Phone,
  RefreshCw
} from 'lucide-react';
import { getAdminAuthHeaders } from '../../../services/adminAuthService';

export interface BotPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestMessage {
  id: string;
  role: 'user' | 'assistant' | 'staff';
  content: string;
  toolsUsed?: string[];
  handedOff?: boolean;
  handoffReason?: string;
  timestamp: string;
}

interface ConversationItem {
  id: string;
  channel: 'test' | 'whatsapp' | 'tiktok';
  external_user_id: string;
  customer_name: string | null;
  status: 'bot' | 'human';
  handoff_reason: string | null;
  created_at: string;
  updated_at: string;
  lastMessage: string;
  lastMessageRole: string;
  lastMessageTime: string;
}

interface ConversationMessage {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'staff';
  content: string;
  tools_used: string[] | null;
  created_at: string;
}

interface FaqItem {
  id: string;
  topic: string;
  answer: string;
  sort_order: number;
  updated_at: string;
}

export const BotPanel: React.FC<BotPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'conversations' | 'faq'>('chat');

  // ------------------ Tab 1: Test Chat State ------------------
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return `test-session-${Date.now()}`;
    }
  });
  const [chatMessages, setChatMessages] = useState<TestMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Salam! Kosalar Auto virtual köməkçisiyəm. Sizə necə kömək edə bilərəm?',
      timestamp: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isHandedOff, setIsHandedOff] = useState(false);
  const [handoffReason, setHandoffReason] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // ------------------ Tab 2: Conversations State ------------------
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [selectedConvMessages, setSelectedConvMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ------------------ Tab 3: FAQ State ------------------
  const [faqList, setFaqList] = useState<FaqItem[]>([]);
  const [loadingFaq, setLoadingFaq] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [isCreatingFaq, setIsCreatingFaq] = useState(false);
  const [faqTopicInput, setFaqTopicInput] = useState('');
  const [faqAnswerInput, setFaqAnswerInput] = useState('');
  const [faqSortInput, setFaqSortInput] = useState<number>(0);
  const [isSavingFaq, setIsSavingFaq] = useState(false);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isSending, activeTab]);

  // Reset test chat
  const handleResetChat = () => {
    let nextId = `test-session-${Date.now()}`;
    try {
      nextId = crypto.randomUUID();
    } catch {}
    setSessionId(nextId);
    setChatMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Salam! Kosalar Auto virtual köməkçisiyəm. Sizə necə kömək edə bilərəm?',
        timestamp: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setIsHandedOff(false);
    setHandoffReason(null);
    setChatError(null);
  };

  // Send message in test chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed || isSending) return;

    const userMsg: TestMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setChatError(null);
    setIsSending(true);

    try {
      const res = await fetch('/api/admin/bot/test-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders()
        },
        body: JSON.stringify({
          sessionId,
          message: trimmed
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server xətası: HTTP ${res.status}`);
      }

      if (data.handedOff) {
        setIsHandedOff(true);
      }

      if (data.reply) {
        const assistantMsg: TestMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          toolsUsed: Array.isArray(data.toolsUsed) ? data.toolsUsed : [],
          timestamp: new Date().toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } else if (data.handedOff) {
        setIsHandedOff(true);
      }
    } catch (err: any) {
      setChatError(err.message || 'Xəta baş verdi');
    } finally {
      setIsSending(false);
    }
  };

  // Load conversations
  const fetchConversations = async () => {
    setLoadingConversations(true);
    setConvError(null);
    try {
      const res = await fetch('/api/admin/bot/conversations', {
        headers: getAdminAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Söhbətlər yüklənə bilmədi.');
      }
      setConversations(data.conversations || []);
    } catch (err: any) {
      setConvError(err.message || 'Xəta baş verdi');
    } finally {
      setLoadingConversations(false);
    }
  };

  // Load messages of selected conversation
  const handleSelectConversation = async (conv: ConversationItem) => {
    setSelectedConv(conv);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/bot/conversations/${conv.id}/messages`, {
        headers: getAdminAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Mesajlar oxuna bilmədi.');
      }
      setSelectedConvMessages(data.messages || []);
    } catch (err: any) {
      alert(`Mesajlar yüklənmədi: ${err.message}`);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Release conversation back to bot
  const handleReleaseConversation = async (convId: string) => {
    setReleasingId(convId);
    try {
      const res = await fetch(`/api/admin/bot/conversations/${convId}/release`, {
        method: 'POST',
        headers: getAdminAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Status dəyişdirilə bilmədi.');
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status: 'bot', handoff_reason: null } : c))
      );
      if (selectedConv?.id === convId) {
        setSelectedConv((prev) => (prev ? { ...prev, status: 'bot', handoff_reason: null } : null));
      }
    } catch (err: any) {
      alert(`Xəta: ${err.message}`);
    } finally {
      setReleasingId(null);
    }
  };

  // Delete test conversation
  const handleDeleteConversation = async (convId: string) => {
    if (!window.confirm('Bu test söhbətini silmək istədiyinizə əminsiniz?')) return;
    setDeletingId(convId);
    try {
      const res = await fetch(`/api/admin/bot/conversations/${convId}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Söhbət silinmədi.');
      }

      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
        setSelectedConvMessages([]);
      }
    } catch (err: any) {
      alert(`Xəta: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Load FAQ list
  const fetchFaq = async () => {
    setLoadingFaq(true);
    setFaqError(null);
    try {
      const res = await fetch('/api/admin/bot/faq', {
        headers: getAdminAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'FAQ yüklənə bilmədi.');
      }
      setFaqList(data.faq || []);
    } catch (err: any) {
      setFaqError(err.message || 'Xəta baş verdi');
    } finally {
      setLoadingFaq(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'conversations') {
      fetchConversations();
    } else if (activeTab === 'faq') {
      fetchFaq();
    }
  }, [isOpen, activeTab]);

  // Open Create FAQ form
  const handleOpenCreateFaq = () => {
    setEditingFaq(null);
    setFaqTopicInput('');
    setFaqAnswerInput('');
    setFaqSortInput((faqList.length + 1) * 10);
    setIsCreatingFaq(true);
  };

  // Open Edit FAQ form
  const handleOpenEditFaq = (item: FaqItem) => {
    setEditingFaq(item);
    setFaqTopicInput(item.topic);
    setFaqAnswerInput(item.answer);
    setFaqSortInput(item.sort_order);
    setIsCreatingFaq(true);
  };

  // Save FAQ (Create or Update)
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTopic = faqTopicInput.trim();
    const cleanAnswer = faqAnswerInput.trim();

    if (!cleanTopic || cleanTopic.length > 120) {
      alert('Mövzu 1 ilə 120 simvol arasında olmalıdır.');
      return;
    }
    if (!cleanAnswer || cleanAnswer.length > 2000) {
      alert('Cavab 1 ilə 2000 simvol arasında olmalıdır.');
      return;
    }

    setIsSavingFaq(true);
    try {
      const isEdit = Boolean(editingFaq);
      const url = isEdit ? `/api/admin/bot/faq/${editingFaq!.id}` : '/api/admin/bot/faq';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders()
        },
        body: JSON.stringify({
          topic: cleanTopic,
          answer: cleanAnswer,
          sort_order: Number(faqSortInput) || 0
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'FAQ saxlanıla bilmədi.');
      }

      setIsCreatingFaq(false);
      setEditingFaq(null);
      await fetchFaq();
    } catch (err: any) {
      alert(`Xəta: ${err.message}`);
    } finally {
      setIsSavingFaq(false);
    }
  };

  // Delete FAQ
  const handleDeleteFaq = async (id: string) => {
    if (!window.confirm('Bu FAQ qeydini silmək istədiyinizə əminsiniz?')) return;
    try {
      const res = await fetch(`/api/admin/bot/faq/${id}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'FAQ silinmədi.');
      }
      setFaqList((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      alert(`Xəta: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-900 border-0 sm:border border-slate-700 w-full h-full sm:h-[90vh] sm:max-w-5xl rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header Bar */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base tracking-tight">AI Satış Köməkçisi</h3>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Faza 1
                </span>
              </div>
              <p className="text-xs text-slate-400">Kosalar Auto avtosalonunun canlı AI beyini və test paneli</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700"
            title="Paneli bağla"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-950/60 px-4 sm:px-6 pt-2 border-b border-slate-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'chat'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Test Söhbət</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conversations')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'conversations'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Söhbətlər</span>
            {conversations.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {conversations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'faq'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>FAQ / Məlumat Bazası</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: TEST CHAT                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/50">
            {/* Top Toolbar */}
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Test sessiyası: <code className="text-slate-300 font-mono text-[11px]">{sessionId.slice(0, 8)}...</code></span>
              </div>
              <button
                type="button"
                onClick={handleResetChat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-bold transition-all text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Yeni söhbət</span>
              </button>
            </div>

            {/* Handoff Red Banner */}
            {isHandedOff && (
              <div className="bg-rose-950/80 border-b border-rose-800 px-4 py-2.5 text-xs text-rose-200 flex items-center gap-2.5 shrink-0 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="flex-1">
                  <strong className="font-bold text-white">Operatora ötürüldü:</strong> Müştəri canlı əməkdaşla əlaqələndirildi.
                </div>
              </div>
            )}

            {/* Error Banner */}
            {chatError && (
              <div className="bg-rose-950 border-b border-rose-800 px-4 py-2.5 text-xs text-rose-300 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span><strong>Xəta:</strong> {chatError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setChatError(null)}
                  className="text-rose-400 hover:text-white text-xs font-bold"
                >
                  Bağla
                </button>
              </div>
            )}

            {/* Chat Messages Scroll Container */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin"
            >
              {chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`max-w-[85%] sm:max-w-xl ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm shadow-md whitespace-pre-wrap break-words leading-relaxed ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-slate-800 text-slate-100 border border-slate-700/70 rounded-tl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Tools Used Badge (for debugging) */}
                      {!isUser && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400 font-mono">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Alətlər:</span>
                          {msg.toolsUsed.map((tool, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-700/60 text-purple-300"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}

                      <span className="text-[10px] text-slate-500 mt-1 px-1">
                        {msg.timestamp}
                      </span>
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center shrink-0 mt-1">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isSending && (
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-slate-800 border border-slate-700/70 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]"></span>
                    <span className="text-xs text-slate-400 ml-1">AI cavab hazırlayır...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Müştəri kimi sual yazın (məs. '2015-ci il Ford Transit var?', 'Kreditlə satırsız?')..."
                disabled={isSending}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 shrink-0"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Göndər</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CONVERSATIONS                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'conversations' && (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-900/30 overflow-hidden">
            {/* Conversations List Column */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col shrink-0 ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Son 50 Söhbət</span>
                <button
                  type="button"
                  onClick={fetchConversations}
                  disabled={loadingConversations}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                  title="Yenilə"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingConversations ? 'animate-spin text-purple-400' : ''}`} />
                </button>
              </div>

              {convError && (
                <div className="p-3 bg-rose-950/80 border-b border-rose-800 text-xs text-rose-300">
                  {convError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 scrollbar-thin">
                {loadingConversations ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    <span>Söhbətlər yüklənir...</span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Hələ heç bir söhbət qeydə alınmayıb.
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const isSelected = selectedConv?.id === conv.id;
                    const isHuman = conv.status === 'human';
                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        className={`p-3 cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-purple-950/40 border-l-4 border-purple-500'
                            : isHuman
                            ? 'bg-rose-950/20 hover:bg-rose-950/30 border-l-4 border-rose-500'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5">
                            {/* Channel badge */}
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                              {conv.channel}
                            </span>
                            <span className="font-bold text-white truncate max-w-[120px]">
                              {conv.customer_name || conv.external_user_id.slice(0, 10)}
                            </span>
                          </div>

                          {/* Status badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isHuman
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {isHuman ? 'Operator' : 'Bot'}
                          </span>
                        </div>

                        <p className="text-slate-400 line-clamp-2 text-[11px] mb-1.5">
                          {conv.lastMessage || 'Mesaj yoxdur'}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>
                            {new Date(conv.lastMessageTime || conv.updated_at).toLocaleTimeString('az-AZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </span>
                          {conv.channel === 'test' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConversation(conv.id);
                              }}
                              disabled={deletingId === conv.id}
                              className="text-rose-400 hover:text-rose-300 p-0.5"
                              title="Test söhbətini sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Conversation Messages Detail Column */}
            <div className={`flex-1 flex flex-col min-h-0 ${!selectedConv ? 'hidden md:flex' : 'flex'}`}>
              {!selectedConv ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <MessageSquare className="w-10 h-10 mb-2 text-slate-600" />
                  <span>Mesaj tarixçəsini görmək üçün soldan söhbət seçin</span>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Selected Conv Header */}
                  <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedConv(null)}
                        className="md:hidden p-1 rounded bg-slate-800 text-slate-300 mr-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs truncate">
                            {selectedConv.customer_name || selectedConv.external_user_id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              selectedConv.status === 'human'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {selectedConv.status === 'human' ? 'Operator' : 'Bot'}
                          </span>
                        </div>
                        {selectedConv.handoff_reason && (
                          <span className="text-[10px] text-rose-400">
                            Səbəb: {selectedConv.handoff_reason}
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedConv.status === 'human' && (
                      <button
                        type="button"
                        onClick={() => handleReleaseConversation(selectedConv.id)}
                        disabled={releasingId === selectedConv.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                      >
                        {releasingId === selectedConv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Bot className="w-3.5 h-3.5" />
                        )}
                        <span>Botu yenidən aktiv et</span>
                      </button>
                    )}
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                    {loadingMessages ? (
                      <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                        <span>Mesajlar yüklənir...</span>
                      </div>
                    ) : selectedConvMessages.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        Bu söhbətdə mesaj tapılmadı.
                      </div>
                    ) : (
                      selectedConvMessages.map((msg) => {
                        const isUser = msg.role === 'user';
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs ${
                              isUser
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                            }`}>
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              {msg.tools_used && msg.tools_used.length > 0 && (
                                <div className="mt-1 pt-1 border-t border-slate-700/50 flex flex-wrap gap-1 text-[10px] text-purple-300 font-mono">
                                  <span>Alətlər:</span>
                                  {msg.tools_used.map((t, idx) => (
                                    <span key={idx} className="bg-slate-900 px-1 rounded">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <span className="text-[10px] text-slate-400 block mt-1 text-right">
                                {new Date(msg.created_at).toLocaleTimeString('az-AZ', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: FAQ / KNOWLEDGE BASE                                              */}
        {/* ========================================================================= */}
        {activeTab === 'faq' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 overflow-y-auto scrollbar-thin">
            {/* Top Info Banner */}
            <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-3.5 text-xs text-purple-200 mb-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-white block">Bot Məlumat Bazası (Knowledge Base)</strong>
                  <p className="mt-0.5 text-purple-300">
                    Bot ünvan, iş saatları, kredit, barter, zəmanət kimi suallara yalnız buradakı məlumatla cavab verir. Burada olmayan mövzularda uydurmur, dərhal insan operatora yönləndirir.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateFaq}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow shrink-0 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni FAQ</span>
              </button>
            </div>

            {faqError && (
              <div className="bg-rose-950/80 border border-rose-800 rounded-xl p-3 text-xs text-rose-300 mb-4">
                {faqError}
              </div>
            )}

            {/* Create/Edit FAQ Form Modal/Box */}
            {isCreatingFaq && (
              <form
                onSubmit={handleSaveFaq}
                className="bg-slate-950 border border-purple-500/50 rounded-xl p-4 sm:p-5 mb-6 space-y-4 shadow-xl animate-in fade-in"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="font-bold text-white text-sm">
                    {editingFaq ? 'FAQ Redaktəsi' : 'Yeni FAQ Əlavə Et'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingFaq(false);
                      setEditingFaq(null);
                    }}
                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Mövzu / Sual (Topic) (maks. 120 simvol):
                  </label>
                  <input
                    type="text"
                    value={faqTopicInput}
                    onChange={(e) => setFaqTopicInput(e.target.value)}
                    placeholder="Məsələn: İş saatları və ünvan"
                    maxLength={120}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Dəqiq Cavab (Answer) (maks. 2000 simvol):
                  </label>
                  <textarea
                    value={faqAnswerInput}
                    onChange={(e) => setFaqAnswerInput(e.target.value)}
                    rows={4}
                    placeholder="Məsələn: Salonumuz hər gün saat 09:00-dan 19:00-dək xidmətinizdədir. Ünvan: Bakı şəhəri, Yeni Günəşli qəsəbəsi..."
                    maxLength={2000}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <div className="text-[11px] text-slate-500 text-right">
                    {faqAnswerInput.length}/2000
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="w-32">
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Sıralama (sort):
                    </label>
                    <input
                      type="number"
                      value={faqSortInput}
                      onChange={(e) => setFaqSortInput(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingFaq(false);
                        setEditingFaq(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                    >
                      Ləğv et
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingFaq}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                    >
                      {isSavingFaq ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Yadda saxla</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* FAQ List */}
            {loadingFaq ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span>FAQ məlumatları yüklənir...</span>
              </div>
            ) : faqList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                Hələ heç bir FAQ qeydi yoxdur. "Yeni FAQ" düyməsi ilə əlavə edin.
              </div>
            ) : (
              <div className="space-y-3">
                {faqList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          #{item.sort_order}
                        </span>
                        <h4 className="font-bold text-white text-sm">{item.topic}</h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditFaq(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          title="Redaktə et"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFaq(item.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default BotPanel;
