import React, { useState } from 'react';
import {
  X,
  MapPin,
  Building,
  Check,
  Search,
  Mic,
  Square,
  Loader2,
  ExternalLink,
  Compass,
} from 'lucide-react';
import { MINISTRIES_LIST } from '../data/seedData.ts';
import type { Profile } from '../types/index.ts';
import {
  queryGoogleMapsGrounding,
  useVoiceRecorder,
  type MapsGroundingResult,
} from '../utils/geminiClient.ts';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  onSaveLocation: (ministry: string, floorNumber: string, roomNumber: string) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState<string>(
    user.ministry || 'وزارة النقل'
  );
  const [floorNumber, setFloorNumber] = useState<string>(
    user.floorNumber || 'الدور الخامس'
  );
  const [roomNumber, setRoomNumber] = useState<string>(user.roomNumber || 'مكتب 504');

  // Google Maps Grounding state for selected ministry
  const [mapsInfo, setMapsInfo] = useState<MapsGroundingResult | null>(null);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const voiceRecorder = useVoiceRecorder((text) => {
    setSearchQuery(text);
  });

  if (!isOpen) return null;

  const filteredMinistries = MINISTRIES_LIST.filter((m) =>
    m.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleSave = () => {
    onSaveLocation(selectedMinistry, floorNumber, roomNumber);
    onClose();
  };

  const handleVerifyOnGoogleMaps = async () => {
    setIsLoadingMaps(true);
    setMapsError(null);
    try {
      const result = await queryGoogleMapsGrounding({
        query: `موقع ومعالم ${selectedMinistry} في الحي الحكومي بالعاصمة الإدارية الجديدة وأقرب البوابات والخدمات المحيطة`,
        latitude: 30.0131,
        longitude: 31.7381,
      });
      setMapsInfo(result);
    } catch (err: unknown) {
      setMapsError(
        err instanceof Error ? err.message : 'تعذر جلب بيانات خرائط جوجل حالياً.'
      );
    } finally {
      setIsLoadingMaps(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                تحديد مقر العمل وموقع التوصيل
              </h3>
              <p className="text-[11px] text-slate-500">
                اختر من بين 34 وزارة وهيئة بالحي الحكومي مع دعم خرائط جوجل
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-300 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 text-xs">
          {/* Floor & Office Inputs */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div>
              <label className="text-slate-700 font-bold block mb-1">رقم الدور</label>
              <input
                type="text"
                value={floorNumber}
                onChange={(e) => setFloorNumber(e.target.value)}
                placeholder="مثال: الدور الخامس"
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-slate-700 font-bold block mb-1">
                رقم المكتب / الإدارة
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="مثال: مكتب 504"
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Search Ministry with Voice Input */}
          <div>
            <label className="text-slate-700 font-bold block mb-1.5">
              اختر الوزارة أو الهيئة التابع لها:
            </label>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو تحدث بالصوت: مالية، نقل، إسكان..."
                  className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-3.5 right-2.5" />
              </div>

              <button
                type="button"
                onClick={voiceRecorder.toggleRecording}
                disabled={voiceRecorder.isTranscribing}
                className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  voiceRecorder.isRecording
                    ? 'bg-rose-600 text-white'
                    : voiceRecorder.isTranscribing
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title="نطق اسم الوزارة بالميكروفون"
              >
                {voiceRecorder.isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : voiceRecorder.isRecording ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </div>

            {voiceRecorder.voiceError && (
              <p className="text-[11px] text-rose-600 mb-2">{voiceRecorder.voiceError}</p>
            )}

            {/* List */}
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
              {filteredMinistries.map((m) => {
                const isSelected = selectedMinistry === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSelectedMinistry(m);
                      setMapsInfo(null);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-right flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building
                        className={`w-3.5 h-3.5 ${
                          isSelected ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      />
                      <span>{m}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Google Maps Grounding Verification for Selected Ministry */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="font-bold text-slate-900">
                  بيانات خرائط جوجل لـ {selectedMinistry}
                </span>
              </div>

              <button
                type="button"
                onClick={handleVerifyOnGoogleMaps}
                disabled={isLoadingMaps}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors shrink-0"
              >
                {isLoadingMaps ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-orange-400" />
                )}
                <span>استعلام Google Maps</span>
              </button>
            </div>

            {mapsError && <p className="text-[11px] text-rose-600">{mapsError}</p>}

            {mapsInfo && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {mapsInfo.text}
                </p>

                {mapsInfo.places.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 block">
                      روابط Google Maps المباشرة:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {mapsInfo.places.map((pl, i) => (
                        <a
                          key={i}
                          href={pl.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <span>{pl.title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <button
            onClick={handleSave}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
          >
            تأكيد موقع التوصيل
          </button>
        </div>
      </div>
    </div>
  );
};
