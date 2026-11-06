import { supabase } from '../lib/supabase';

export function subscribeCourierLocation(
  courierId: string,
  next: (value: any, fromCache?: boolean) => void,
  error: () => void,
) {
  let alive = true;
  let latestUpdate = 0;
  const emitRow = (row: any) => {
    if (!alive) return;
    const updatedAt = row?.updated_at ? Date.parse(row.updated_at) : 0;
    if (updatedAt && updatedAt < latestUpdate) return;
    latestUpdate = Math.max(latestUpdate, updatedAt);
    next(row ? {
      coordinates: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
      active: row.is_online === true,
      updatedAt,
    } : null, false);
  };
  const channel = supabase.channel(`courier-location:${courierId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'courier_locations', filter: `courier_id=eq.${courierId}`,
    }, payload => emitRow(payload.new && Object.keys(payload.new).length ? payload.new : null))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        void supabase.from('courier_locations').select('courier_id,latitude,longitude,is_online,updated_at')
          .eq('courier_id', courierId).maybeSingle()
          .then(({ data, error: readError }) => { if (!alive) return; if (readError) error(); else emitRow(data); });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') error();
    });
  return () => { alive = false; void supabase.removeChannel(channel); };
}
