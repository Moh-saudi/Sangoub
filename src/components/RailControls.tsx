import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { useHorizontalRail } from '../utils/useHorizontalRail';

export function RailControls({ rail, name }: { rail: ReturnType<typeof useHorizontalRail>; name: string }) {
  if (!rail.bounds.overflow) return null;
  return <div className="public-rail-controls" aria-label={`تحريك شريط ${name}`}>
    <button aria-label={rail.auto ? `إيقاف حركة ${name}` : `تشغيل حركة ${name}`} aria-pressed={rail.auto} onClick={rail.toggle}>{rail.auto ? <Pause size={14} /> : <Play size={14} />}</button>
    <button aria-label={`${name} السابقة`} disabled={rail.bounds.start} onClick={() => rail.move(-1)}><ChevronRight size={17} /></button>
    <button aria-label={`${name} التالية`} disabled={rail.bounds.end} onClick={() => rail.move(1)}><ChevronLeft size={17} /></button>
  </div>;
}
