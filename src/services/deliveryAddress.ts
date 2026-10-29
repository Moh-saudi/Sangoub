export interface OsmPlace {
  place_id?: string | number;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
}

export function uniqueAddress(parts: (string | undefined)[]): string {
  const seen = new Set<string>();
  return parts.flatMap(part => (part || '').split(/[,،]/)).map(part => part.trim())
    .filter(part => part && !seen.has(part) && Boolean(seen.add(part))).join('، ');
}

export function placeAddress(place: OsmPlace): string {
  const a = place.address || {};
  return uniqueAddress([
    a.office || a.amenity || a.shop || a.building,
    a.house_number,
    a.road || a.pedestrian || a.street,
    a.neighbourhood || a.quarter,
    a.suburb || a.city_district,
    a.city || a.town || a.village || a.municipality,
    a.state || a.governorate,
  ]) || uniqueAddress([place.display_name]);
}

export function usableDeliveryAddress(address: string): boolean {
  const value = address.trim();
  return value.length >= 5 && value.length <= 500 &&
    !/^(موقع محدد على الخريطة|تعذر البحث|قم بتحريك الخريطة)/.test(value);
}

export const pendingDeliveryAddressKey = 'sangoub_pending_delivery_address';
export interface PendingDeliveryAddress { name: string; city?: string; details?: string; latitude?: number; longitude?: number }
export function readPendingDeliveryAddress(storage: Pick<Storage, 'getItem'>): PendingDeliveryAddress | null {
  try {
    const value = JSON.parse(storage.getItem(pendingDeliveryAddressKey) || 'null');
    if (!value || typeof value.name !== 'string' || !usableDeliveryAddress(value.name)) return null;
    const hasPoint = value.latitude !== undefined || value.longitude !== undefined;
    if (hasPoint && (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || Math.abs(value.latitude)>90 || Math.abs(value.longitude)>180)) return null;
    return { name:value.name, city:typeof value.city === 'string' ? value.city : '', details:typeof value.details === 'string' ? value.details : '',
      ...(hasPoint ? {latitude:value.latitude,longitude:value.longitude} : {}) };
  } catch { return null; }
}
