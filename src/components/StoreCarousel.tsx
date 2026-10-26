import { ArrowLeft, Store as StoreIcon } from 'lucide-react';
import type { Store } from '../types';
import type { AppSelection } from './AppPromotionDialog';
import { useHorizontalRail } from '../utils/useHorizontalRail';
import { RailControls } from './RailControls';

export function StoreCarousel({ stores, onSelect }: { stores: Store[]; onSelect: (item: AppSelection) => void }) {
  const rail = useHorizontalRail(stores.length);
  return <div className="public-store-carousel" {...rail.interaction}>
    <div className="public-rail-heading"><span>{rail.bounds.overflow ? "اسحب لاكتشاف المتاجر" : "متاجر متاحة"}</span><RailControls rail={rail} name="المتاجر" /></div>
    <div ref={rail.track} className="public-store-list" aria-label="المتاجر المفتوحة" onScroll={rail.measure} onPointerDown={rail.stop}>
      {stores.map(store => <button key={store.id} onClick={() => onSelect({ id:store.id,title: store.name, kind: 'store' })}>
        <span className="public-store-logo"><StoreIcon size={23} />{store.logoUrl && <img src={store.logoUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />}</span>
        <span>{store.name}<small>مفتوح الآن</small></span><ArrowLeft size={14} />
      </button>)}
    </div>
  </div>;
}
