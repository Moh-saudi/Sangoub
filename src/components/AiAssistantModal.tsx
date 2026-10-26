import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Bot,
  Send,
  Mic,
  Square,
  Loader2,
  MapPin,
  ExternalLink,
  Zap,
  Brain,
  MessageSquare,
  Navigation,
  ShoppingBag,
  Plus,
  Trash2,
  Compass,
} from 'lucide-react';
import type { Product, Profile, Store } from '../types/index.ts';
import {
  sendGeminiChatMessage,
  queryGoogleMapsGrounding,
  useVoiceRecorder,
  type ChatbotRole,
  type ChatTurn,
  type GeminiTaskMode,
  type MapsGroundingResult,
} from '../utils/geminiClient.ts';
import { formatEGP } from '../utils/orderCalculations.ts';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  products: Product[];
  stores: Store[];
  onAddToCart: (product: Product) => void;
  initialTab?: 'chat' | 'maps';
}

const QUICK_CHAT_PROMPTS: Record<ChatbotRole, string[]> = {
  concierge: [
    'رشح لي فطور ساخن وقهوة في حدود 100 جنيه',
    'نظم لي أوردر اجتماع لـ 8 موظفين بوزارة المالية',
    'ما هي أكواد الخصم المتاحة اليوم؟',
  ],
  courier_guide: [
    'ما هي خطوات تسليم الطلب بمباني الوزارات؟',
    'أقرب بوابة لتوصيل طلب من مبنى C2 إلى وزارة النقل',
    'كيف أسوي حساب المطعم وأحصل الدفع عبر إنستا باي؟',
  ],
  nutrition_planner: [
    'اقترح فطور صحي يمنح تركيز عالي لساعات العمل',
    'قائمة ضيافة خفيفة لاجتماع رسمي بالوزارة',
    'بدائل مشروبات بدون سكر متاحة في الفود كورت',
  ],
};

const QUICK_MAPS_QUERIES = [
  'الحي الحكومي بالعاصمة الإدارية الجديدة ومقر رئاسة مجلس الوزراء',
  'أقرب ماكينات الصراف الآلي والبنوك في الحي الحكومي بالعاصمة الإدارية',
  'محطة القطار الكهربائي الخفيف LRT والحي الحكومي بالعاصمة الإدارية',
  'المطاعم والكافيهات والخدمات القريبة من مجمع الوزارات بالعاصمة الإدارية',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  user,
  products,
  stores,
  onAddToCart,
  initialTab = 'chat',
}) => {
  const [activeView, setActiveView] = useState<'chat' | 'maps'>(initialTab);

  // Chat state
  const [taskMode, setTaskMode] = useState<GeminiTaskMode>('general');
  const [botRole, setBotRole] = useState<ChatbotRole>(() => {
    if (user.role === 'courier') return 'courier_guide';
    return 'concierge';
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: `مرحباً بك يا ${user.fullName} في مساعد سنجوب الذكي! يمكنني مساعدتك في ترشيح الوجبات، تنظيم طلبات الاجتماعات بمقر ${user.ministry || 'الوزارة'}، أو الإجابة عن أي استفسار صوتياً أو كتابياً.`,
      timestamp: 'الآن',
      modelUsed: 'gemini-3.8-flash',
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Maps Grounding state
  const [mapsQuery, setMapsQuery] = useState('');
  const [isSearchingMaps, setIsSearchingMaps] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsResult, setMapsResult] = useState<MapsGroundingResult | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locatingGps, setLocatingGps] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveView(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSendingChat]);

  // Voice Recorder for Chat
  const chatVoice = useVoiceRecorder((transcribedText) => {
    setInputMessage((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
  });

  // Voice Recorder for Maps
  const mapsVoice = useVoiceRecorder((transcribedText) => {
    setMapsQuery(transcribedText);
    handleSearchMaps(transcribedText);
  });

  if (!isOpen) return null;

  // Build concise catalog context for Gemini
  const catalogContext = stores
    .map((s) => {
      const storeItems = products
        .filter((p) => p.storeId === s.id && p.inStock)
        .map((p) => `${p.name} (${p.price} ج.م)`)
        .join('، ');
      return `- ${s.name} (${s.locationInDistrict}): ${storeItems}`;
    })
    .join('\n');

  const handleSendChat = async (overrideText?: string) => {
    const textToSend = (overrideText ?? inputMessage).trim();
    if (!textToSend || isSendingChat) return;

    const userTurn: ChatTurn = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const historyForApi = messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setMessages((prev) => [...prev, userTurn]);
    if (!overrideText) setInputMessage('');
    setChatError(null);
    setIsSendingChat(true);

    try {
      const result = await sendGeminiChatMessage({
        message: textToSend,
        history: historyForApi,
        taskMode,
        botRole,
        catalogContext,
      });

      const modelTurn: ChatTurn = {
        id: 'model-' + Date.now(),
        role: 'model',
        text: result.text,
        timestamp: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        modelUsed: result.modelUsed,
        notice: result.notice,
      };
      setMessages((prev) => [...prev, modelTurn]);
    } catch (err: unknown) {
      setChatError(
        err instanceof Error ? err.message : 'تعذر الحصول على رد من المساعد الذكي.'
      );
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setMapsError('المتصفح لا يدعم تحديد الموقع الجغرافي.');
      return;
    }
    setLocatingGps(true);
    setMapsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocatingGps(false);
      },
      () => {
        // Fallback to New Administrative Capital Government District coordinates
        setUserCoords({ latitude: 30.0131, longitude: 31.7381 });
        setLocatingGps(false);
      },
      { timeout: 6000 }
    );
  };

  const handleSearchMaps = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? mapsQuery).trim();
    if (!q || isSearchingMaps) return;

    setIsSearchingMaps(true);
    setMapsError(null);

    try {
      const res = await queryGoogleMapsGrounding({
        query: q,
        latitude: userCoords?.latitude ?? 30.0131,
        longitude: userCoords?.longitude ?? 31.7381,
      });
      setMapsResult(res);
    } catch (err: unknown) {
      setMapsError(
        err instanceof Error ? err.message : 'تعذر البحث في خرائط جوجل حالياً.'
      );
    } finally {
      setIsSearchingMaps(false);
    }
  };

  // Match products mentioned in the latest model message so user can add them to cart with 1 tap
  const getRecommendedProducts = (text: string): Product[] => {
    return products
      .filter((p) => p.inStock && text.includes(p.name.split(' ')[0]) && text.includes(p.name.split(' ').slice(0, 2).join(' ')))
      .slice(0, 3);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl h-[88vh] sm:h-[84vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                مساعد العاصمة الذكي ودليل خرائط جوجل
              </h2>
              <p className="text-[11px] text-slate-300">
                دعم المحادثة المتعددة، الطلب الصوتي، وبيانات Google Maps الحية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented View Switcher: Chat vs Google Maps Grounding */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('chat')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeView === 'chat'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>المحادثة الذكية والطلب الصوتي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('maps')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeView === 'maps'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4 text-orange-600" />
            <span>استكشاف الحي الحكومي بخرائط جوجل</span>
          </button>
        </div>

        {/* VIEW 1: MULTI-TURN GEMINI CHAT + AUDIO TRANSCRIPTION */}
        {activeView === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
            {/* Role & Model Complexity Controls */}
            <div className="p-3 bg-white border-b border-slate-200 space-y-2 shrink-0">
              {/* Model Speed / Intelligence Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-600">
                  مستوى المعالجة والنموذج:
                </span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTaskMode('fast')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap ${
                      taskMode === 'fast'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="gemini-3.1-flash-lite للمهام السريعة"
                  >
                    <Zap className="w-3 h-3" />
                    <span>سريع (Flash Lite)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskMode('general')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap ${
                      taskMode === 'general'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="gemini-3.8-flash للمهام العامة"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>عام (3.8 Flash)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskMode('complex')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap ${
                      taskMode === 'complex'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="gemini-4-argon للمهام المعقدة وتخطيط الاجتماعات"
                  >
                    <Brain className="w-3 h-3" />
                    <span>متقدم (4 Argon)</span>
                  </button>
                </div>
              </div>

              {/* Bot Role Selector (System Instruction) */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setBotRole('concierge')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                      botRole === 'concierge'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    منسق طلبات الموظفين
                  </button>
                  <button
                    type="button"
                    onClick={() => setBotRole('nutrition_planner')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                      botRole === 'nutrition_planner'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    تخطيط الاجتماعات والتغذية
                  </button>
                  <button
                    type="button"
                    onClick={() => setBotRole('courier_guide')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                      botRole === 'courier_guide'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    دليل المناديب والوزارات
                  </button>
                </div>

                {messages.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setMessages([
                        {
                          id: 'welcome-reset',
                          role: 'model',
                          text: 'تم بدء محادثة جديدة. كيف يمكنني مساعدتك اليوم؟',
                          timestamp: 'الآن',
                        },
                      ])
                    }
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                    title="مسح سجل المحادثة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Conversation Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const recommendedItems = !isUser ? getRecommendedProducts(msg.text) : [];

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-slate-900 text-white rounded-tr-xs'
                          : 'bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-tl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {/* Metadata footer */}
                      <div
                        className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${
                          isUser ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        <span>{msg.timestamp}</span>
                        {msg.modelUsed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{msg.modelUsed}</span>
                          </>
                        )}
                      </div>

                      {msg.notice && (
                        <p className="mt-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                          {msg.notice}
                        </p>
                      )}
                    </div>

                    {/* Direct Add-to-Cart Cards if products are mentioned */}
                    {recommendedItems.length > 0 && (
                      <div className="mt-2 w-full max-w-[88%] grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {recommendedItems.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {item.storeName} ·{' '}
                                <span className="font-mono font-bold text-emerald-700">
                                  {formatEGP(item.price)}
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onAddToCart(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>أضف للسلة</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isSendingChat && (
                <div className="flex items-end justify-end">
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-600 flex items-center gap-2 shadow-2xs">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>جاري كتابة الرد...</span>
                  </div>
                </div>
              )}

              {(chatError || chatVoice.voiceError) && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
                  <span>{chatError || chatVoice.voiceError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setChatError(null);
                      chatVoice.clearVoiceError();
                    }}
                    className="text-[11px] font-bold underline"
                  >
                    إغلاق
                  </button>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {QUICK_CHAT_PROMPTS[botRole].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSendChat(prompt)}
                  disabled={isSendingChat}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat Input Bar with Microphone Audio Transcription (gemini-3.5-transcribe) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={chatVoice.toggleRecording}
                disabled={chatVoice.isTranscribing}
                className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all shrink-0 ${
                  chatVoice.isRecording
                    ? 'bg-rose-600 text-white shadow-sm'
                    : chatVoice.isTranscribing
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title={
                  chatVoice.isRecording
                    ? 'إيقاف التسجيل وتحويل الصوت لنص'
                    : 'تحدث بالميكروفون (gemini-3.5-transcribe)'
                }
                aria-label="التحدث بالميكروفون"
              >
                {chatVoice.isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : chatVoice.isRecording ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  chatVoice.isRecording
                    ? 'جاري الاستماع... اضغط المربع الأحمر لإتمام النسخ الصوتي'
                    : chatVoice.isTranscribing
                    ? 'جاري تحويل صوتك إلى نص عبر gemini-3.5-transcribe...'
                    : 'اكتب سؤالك أو اضغط الميكروفون للتحدث صوتياً...'
                }
                className="flex-1 py-2.5 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 text-slate-900"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || isSendingChat}
                className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">إرسال</span>
              </button>
            </form>
          </div>
        )}

        {/* VIEW 2: GOOGLE MAPS GROUNDING (gemini-3.8-flash with googleMaps tool) */}
        {activeView === 'maps' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
            {/* Search & Location Bar */}
            <div className="p-4 bg-white border-b border-slate-200 space-y-3 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Compass className="w-4 h-4 text-orange-600" />
                  <span>
                    نطاق البحث الجغرافي:{' '}
                    <strong className="text-slate-900">
                      {userCoords
                        ? `إحداثياتك الحالية (${userCoords.latitude.toFixed(4)}, ${userCoords.longitude.toFixed(4)})`
                        : 'الحي الحكومي - العاصمة الإدارية الجديدة'}
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleDetectGps}
                  disabled={locatingGps}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                >
                  {locatingGps ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>تحديد موقعي الحالي</span>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchMaps();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={mapsVoice.toggleRecording}
                  disabled={mapsVoice.isTranscribing}
                  className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all shrink-0 ${
                    mapsVoice.isRecording
                      ? 'bg-rose-600 text-white'
                      : mapsVoice.isTranscribing
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="بحث صوتي في خرائط جوجل"
                >
                  {mapsVoice.isTranscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mapsVoice.isRecording ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>

                <input
                  type="text"
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  placeholder="ابحث في خرائط جوجل عن وزارة، بنك، صيدلية، محطة القطار، أو مطعم..."
                  className="flex-1 py-2.5 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-600 text-slate-900"
                />

                <button
                  type="submit"
                  disabled={!mapsQuery.trim() || isSearchingMaps}
                  className="min-h-[44px] px-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {isSearchingMaps ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span>بحث بالخرائط</span>
                </button>
              </form>

              {/* Quick Maps Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {QUICK_MAPS_QUERIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setMapsQuery(q);
                      handleSearchMaps(q);
                    }}
                    disabled={isSearchingMaps}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Maps Grounding Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(mapsError || mapsVoice.voiceError) && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {mapsError || mapsVoice.voiceError}
                </div>
              )}

              {isSearchingMaps && (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-orange-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    جاري جلب البيانات الحية والروابط من Google Maps عبر gemini-3.8-flash...
                  </p>
                </div>
              )}

              {!isSearchingMaps && !mapsResult && !mapsError && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    استكشف معالم ووزارات العاصمة الإدارية ببيانات Google Maps
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    اختر أحد الاستعلامات السريعة بالأعلى أو ابحث صوتياً وكتابياً عن أي وزارة، بوابة، ماكينة صراف آلي، أو مطعم للحصول على معلومات دقيقة وروابط مباشرة على خرائط جوجل.
                  </p>
                </div>
              )}

              {!isSearchingMaps && mapsResult && (
                <div className="space-y-4">
                  {/* Grounded Answer Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-100">
                      <span>إجابة موثقة عبر Google Maps Grounding</span>
                      <span className="font-mono">gemini-3.8-flash</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {mapsResult.text}
                    </div>
                  </div>

                  {/* Extracted Google Maps Links & Review Snippets */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      <span>الروابط والمواقع المستخرجة من خرائط جوجل ({mapsResult.places.length})</span>
                    </h4>

                    {mapsResult.places.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                        <span className="text-xs text-slate-600">
                          فتح البحث المباشر على خرائط جوجل للحي الحكومي
                        </span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            mapsQuery || 'الحي الحكومي العاصمة الإدارية الجديدة'
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-orange-700 transition-colors"
                        >
                          <span>فتح في Google Maps</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {mapsResult.places.map((place, idx) => (
                          <div
                            key={`${place.uri}-${idx}`}
                            className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-orange-300 transition-colors"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                                  {place.title}
                                </h5>
                                <MapPin className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                              </div>

                              {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-slate-100">
                                  {place.reviewSnippets.slice(0, 2).map((snippet, sIdx) => (
                                    <p
                                      key={sIdx}
                                      className="text-[11px] text-slate-600 italic line-clamp-2"
                                    >
                                      "{snippet}"
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>

                            <a
                              href={place.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <span>عرض الموقع على Google Maps</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
