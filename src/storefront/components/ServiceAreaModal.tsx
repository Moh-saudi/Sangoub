import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, type ServiceArea } from '../context/StoreContext';
import { cleanDisplayAddress } from '../../utils/orderCalculations';
import { LAUNCH_CONFIG } from '../../config/launchConfig';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Search,
  Check,
  X,
  Navigation,
  Loader2,
  Building,
  Compass
} from 'lucide-react';

interface ServiceAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

export const ServiceAreaModal: React.FC<ServiceAreaModalProps> = ({ isOpen, onClose }) => {
  const { serviceArea, setServiceArea } = useStore();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Dynamic Location State
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: serviceArea.latitude || 30.0444,
    lng: serviceArea.longitude || 31.2357,
  });
  const [resolvedAddress, setResolvedAddress] = useState<string>(
    serviceArea.id !== 'default_map' ? serviceArea.name : ''
  );
  const [detectedCity, setDetectedCity] = useState<string>(serviceArea.city || '');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [extraBuildingDetails, setExtraBuildingDetails] = useState<string>('');

  // Live Map Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showResultsDropdown, setShowResultsDropdown] = useState<boolean>(false);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const searchTimeoutRef = useRef<any>(null);

  // Reverse Geocode: coordinates -> Arabic Street/City Name
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsResolving(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar`,
        {
          headers: {
            'Accept-Language': 'ar',
          },
        }
      );
      if (!response.ok) throw new Error('Geocoding failed');
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        const street =
          addr.road ||
          addr.pedestrian ||
          addr.suburb ||
          addr.neighbourhood ||
          addr.commercial ||
          '';
        const district = addr.city_district || addr.suburb || addr.quarter || '';
        const city = addr.city || addr.town || addr.governorate || addr.state || '';

        // Clean, readable Arabic street & area
        const parts = [street, district, city].filter(Boolean);
        const readableName = parts.length > 0 ? parts.join('، ') : data.display_name.split(',').slice(0, 3).join('، ');

        setResolvedAddress(readableName);
        setDetectedCity(city || 'مصر');
      } else if (data.display_name) {
        const cleanName = data.display_name.split(',').slice(0, 3).join('، ');
        setResolvedAddress(cleanName);
        setDetectedCity('');
      }
    } catch {
      if (!resolvedAddress) {
        setResolvedAddress('موقع محدد على الخريطة');
      }
    } finally {
      setIsResolving(false);
    }
  }, [resolvedAddress]);

  // Initialize Interactive Leaflet Map
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean up previous instance if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const initialLat = currentCoords.lat;
      const initialLng = currentCoords.lng;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add Zoom Control
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Force size invalidation so tiles render fully
      map.invalidateSize();
      setTimeout(() => map.invalidateSize(), 300);

      // Listen to map pan/drag end
      map.on('moveend', () => {
        const center = map.getCenter();
        setCurrentCoords({ lat: center.lat, lng: center.lng });
        reverseGeocode(center.lat, center.lng);
      });

      // Listen to direct map clicks
      map.on('click', (e: L.LeafletMouseEvent) => {
        map.panTo(e.latlng);
      });

      mapInstanceRef.current = map;

      // Initial reverse geocode if empty
      if (!resolvedAddress || serviceArea.id === 'default_map') {
        reverseGeocode(initialLat, initialLng);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Handle Search Input Change with Debounce
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowResultsDropdown(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
            value.trim()
          )}&countrycodes=eg&accept-language=ar&limit=5`
        );
        if (!res.ok) throw new Error('Search failed');
        const data: SearchResult[] = await res.json();
        setSearchResults(data);
        setShowResultsDropdown(data.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  // Select Search Result & Pan Map
  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    setCurrentCoords({ lat, lng: lon });
    setShowResultsDropdown(false);
    setSearchQuery('');

    const cleanName = result.display_name.split(',').slice(0, 3).join('، ');
    setResolvedAddress(cleanName);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lon], 16, { duration: 1.2 });
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 500);
    }
  };

  // Current GPS Location Finder (Direct Fly-to)
  const handleFlyToCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocatingUser(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const { latitude, longitude } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 16, { duration: 1 });
          setTimeout(() => {
            mapInstanceRef.current?.invalidateSize();
          }, 300);
        }
      },
      () => {
        setIsLocatingUser(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Confirm Location Submission
  const handleConfirmLocation = () => {
    const baseAddr = cleanDisplayAddress(resolvedAddress);
    const finalAddress = extraBuildingDetails.trim()
      ? `${baseAddr} (${extraBuildingDetails.trim()})`
      : baseAddr;

    const dynamicArea: ServiceArea = {
      id: `map_${Date.now()}`,
      name: finalAddress,
      deliveryTime: LAUNCH_CONFIG.showEta ? '20-30 دقيقة' : '',
      active: true,
      latitude: currentCoords.lat,
      longitude: currentCoords.lng,
      city: detectedCity,
    };

    setServiceArea(dynamicArea);
    localStorage.setItem('sangoub_location_confirmed', 'true');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs select-none"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#E7E9EE] relative animate-in fade-in zoom-in-95 duration-150 max-h-[94vh] flex flex-col font-['Cairo',sans-serif] overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex items-center justify-between bg-white shrink-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center shrink-0 shadow-xs">
              <Compass size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-[#111827]">
                حدد موقعك بدقة من الخريطة 🗺️
              </h3>
              <p className="text-[10px] text-[#6B7280]">
                حرك الخريطة أو ابحث عن أي مدينة أو شارع لتحديد نقطة انطلاق التوصيل
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Search Input Floating on Top */}
        <div className="p-3 bg-[#F9FAFB] border-b border-[#E5E7EB] relative z-30 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="ابحث عن اسم الشارع، الحي، أو المدينة..."
              className="w-full pr-9 pl-8 py-2 text-xs bg-white border border-[#D1D5DB] rounded-xl focus:border-[#FF5900] focus:ring-1 focus:ring-[#FF5900] outline-none text-[#111827] font-bold shadow-2xs"
            />
            {isSearching && (
              <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FF5900] animate-spin" />
            )}
          </div>

          {/* Search Autocomplete Dropdown */}
          {showResultsDropdown && searchResults.length > 0 && (
            <div className="absolute top-full inset-x-3 mt-1 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] overflow-hidden z-50 max-h-56 overflow-y-auto divide-y divide-[#F3F4F6]">
              {searchResults.map((res) => (
                <button
                  key={res.place_id}
                  type="button"
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full p-2.5 text-right text-xs hover:bg-[#FFF2EC] flex items-center gap-2 text-[#374151] transition-colors cursor-pointer"
                >
                  <MapPin size={14} className="text-[#FF5900] shrink-0" />
                  <span className="font-bold truncate">{res.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Map Canvas with Floating Center Pin */}
        <div className="relative flex-1 w-full bg-[#E5E7EB] overflow-hidden" style={{ minHeight: '300px' }}>
          
          {/* Explicitly Sized Map Container */}
          <div
            ref={mapContainerRef}
            id="sangoub-leaflet-map"
            style={{ width: '100%', height: '300px', zIndex: 10 }}
            className="w-full"
          />

          {/* Floating Center Pin */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[400] flex flex-col items-center">
            <div className="bg-[#111827] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1 border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5900] animate-ping" />
              <span>{isResolving ? 'جاري قراءة العنوان...' : 'نقطة توصيل طلبك'}</span>
            </div>

            <svg
              className="w-9 h-9 text-[#FF5900] drop-shadow-md"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
            </svg>
            <div className="w-2.5 h-1 bg-black/30 rounded-full blur-[1px] -mt-0.5" />
          </div>

          {/* Floating 'Fly to Current Location' Button */}
          <button
            type="button"
            onClick={handleFlyToCurrentLocation}
            disabled={isLocatingUser}
            className="absolute bottom-4 left-4 z-[400] p-2.5 rounded-2xl bg-white shadow-lg border border-[#E5E7EB] text-[#374151] hover:text-[#FF5900] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="الانتقال إلى موقعي الحالي"
          >
            <Navigation size={16} className={`text-[#FF5900] ${isLocatingUser ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">موقعي الحالي</span>
          </button>
        </div>

        {/* Resolved Address & Building Details Bottom Form */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-[#E5E7EB] shrink-0 space-y-2.5 z-20">
          
          {/* Resolved Dynamic Location Info */}
          <div className="bg-[#FFF8F5] border border-[#FFD4C2] rounded-2xl p-2.5 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[#FF5900] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <MapPin size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-[#9A3412]">
                  العنوان المستخرج ديناميكياً من الخريطة:
                </p>
                {detectedCity && (
                  <span className="text-[9px] bg-white text-[#FF5900] font-black px-1.5 py-0.5 rounded-md border border-[#FFD4C2]">
                    {detectedCity}
                  </span>
                )}
              </div>
              <p className="text-xs font-black text-[#111827] mt-0.5 line-clamp-2 leading-snug">
                {isResolving ? (
                  <span className="text-[#6B7280] font-normal flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin text-[#FF5900]" />
                    جاري قراءة الشارع والحي من الخريطة...
                  </span>
                ) : (
                  resolvedAddress || 'قم بتحريك الخريطة لتحديد عنوانك'
                )}
              </p>
            </div>
          </div>

          {/* Optional Extra Building Details Input */}
          <div className="relative">
            <Building size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={extraBuildingDetails}
              onChange={(e) => setExtraBuildingDetails(e.target.value)}
              placeholder="رقم المبنى / الدور / رقم الشقة أو المكتب (اختياري)..."
              className="w-full pr-8 pl-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:border-[#FF5900] focus:bg-white outline-none text-[#111827] font-bold"
            />
          </div>

          {/* Confirm Dynamic Location Button (Compact & Elegant) */}
          <button
            type="button"
            onClick={handleConfirmLocation}
            disabled={isResolving || !resolvedAddress}
            className="w-full h-11 bg-[#FF5900] hover:bg-[#E04E00] active:scale-98 disabled:opacity-50 text-white text-xs font-black rounded-xl sm:rounded-2xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check size={15} strokeWidth={2.5} />
            <span>تأكيد هذا العنوان واعتماده للتوصيل</span>
          </button>
        </div>

      </div>
    </div>
  );
};
