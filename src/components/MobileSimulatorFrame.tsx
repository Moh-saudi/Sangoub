import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Maximize2,
  RotateCw,
  Sparkles,
  Wifi,
  Battery,
  Layers,
  HelpCircle,
  BellRing,
  Volume2,
} from 'lucide-react';

interface MobileSimulatorFrameProps {
  children: React.ReactNode;
  isSimulatorActive: boolean;
  onToggleSimulator: () => void;
  onReplayOnboarding: () => void;
  onSimulatePushNotification?: () => void;
}

export const MobileSimulatorFrame: React.FC<MobileSimulatorFrameProps> = ({
  children,
  isSimulatorActive,
  onToggleSimulator,
  onReplayOnboarding,
  onSimulatePushNotification,
}) => {
  const [deviceModel, setDeviceModel] = useState<'iphone' | 'android'>('iphone');
  const [currentTime, setCurrentTime] = useState('10:30');
  const [zoomScale, setZoomScale] = useState<number>(100);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!isSimulatorActive) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-900/95 py-4 sm:py-8 px-2 flex flex-col items-center justify-center">
      {/* Top Simulator Control Bar */}
      <div className="w-full max-w-2xl mb-4 bg-slate-800/90 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-slate-700/80 shadow-xl flex flex-wrap items-center justify-between gap-2.5 text-white text-xs">
        {/* Device Info */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <span>محاكي تطبيق طلبات العاصمة</span>
              <span className="px-1.5 py-0.5 rounded bg-orange-500/30 text-orange-300 text-[10px] font-mono">
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              تجربة حية لهواتف موظفي وزارات العاصمة الإدارية
            </p>
          </div>
        </div>

        {/* Quick Simulator Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Model Switcher */}
          <div className="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-700">
            <button
              onClick={() => setDeviceModel('iphone')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                deviceModel === 'iphone'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              iPhone 16 Pro
            </button>
            <button
              onClick={() => setDeviceModel('android')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                deviceModel === 'android'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Galaxy S24
            </button>
          </div>

          {/* Replay Onboarding */}
          <button
            onClick={onReplayOnboarding}
            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-xl text-[11px] font-semibold flex items-center gap-1 text-slate-200 transition-colors"
            title="إعادة عرض شاشات الـ Onboarding الأربعة"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>عرض الـ Onboarding</span>
          </button>

          {/* Exit Simulator / Fullscreen */}
          <button
            onClick={onToggleSimulator}
            className="px-2.5 py-1 bg-slate-700 hover:bg-orange-600 rounded-xl text-[11px] font-semibold flex items-center gap-1 text-white transition-colors"
            title="العودة لوضع ملء الشاشة العادي"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>ملء الشاشة</span>
          </button>
        </div>
      </div>

      {/* Smartphone Chassis Shell */}
      <div
        className={`relative transition-all duration-300 w-full max-w-[420px] rounded-[50px] p-[10px] sm:p-[12px] bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.15)] ring-1 ring-slate-700`}
        style={{
          boxShadow:
            '0 25px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 0 0 2px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Hardware side buttons decoration */}
        <div className="absolute -left-[3px] top-[100px] w-[3px] h-[32px] bg-slate-600 rounded-l-sm" />
        <div className="absolute -left-[3px] top-[145px] w-[3px] h-[55px] bg-slate-600 rounded-l-sm" />
        <div className="absolute -left-[3px] top-[210px] w-[3px] h-[55px] bg-slate-600 rounded-l-sm" />
        <div className="absolute -right-[3px] top-[130px] w-[3px] h-[75px] bg-slate-600 rounded-r-sm" />

        {/* Screen Bezel Frame */}
        <div className="relative bg-white rounded-[40px] overflow-hidden flex flex-col h-[820px] max-h-[88vh] border border-slate-950/20 shadow-inner">
          {/* Native Phone Status Bar */}
          <div className="bg-slate-900 text-white px-6 pt-3 pb-2 flex items-center justify-between text-[11px] font-medium shrink-0 z-30 select-none">
            {/* Clock */}
            <span className="font-mono font-bold tracking-tight">{currentTime}</span>

            {/* Dynamic Island or Camera Punch */}
            {deviceModel === 'iphone' ? (
              <div className="h-6 w-28 bg-black rounded-full flex items-center justify-between px-2.5 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            ) : (
              <div className="w-3.5 h-3.5 bg-black rounded-full shadow-sm" />
            )}

            {/* Icons: 5G, Wifi, Battery */}
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="text-[9px] font-bold">5G</span>
              <Wifi className="w-3 h-3 text-white" />
              <div className="flex items-center">
                <div className="w-5 h-2.5 border border-white rounded-xs p-0.5 flex items-center">
                  <div className="w-3.5 h-1.5 bg-white rounded-2xs" />
                </div>
                <div className="w-0.5 h-1 bg-white rounded-r-xs" />
              </div>
            </div>
          </div>

          {/* Inner App Container with Independent Scroll */}
          <div className="flex-1 overflow-y-auto overscroll-contain relative bg-slate-50 flex flex-col" id="simulator-scroll-container">
            {children}
          </div>

          {/* Native Phone Bottom Home Indicator */}
          <div className="bg-white/95 backdrop-blur-md pt-1 pb-2 flex items-center justify-center shrink-0 border-t border-slate-100 z-30 select-none">
            <div className="w-32 h-1 bg-slate-300 rounded-full hover:bg-slate-400 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
};
