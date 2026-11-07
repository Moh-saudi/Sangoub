import React, { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Search,
  Check,
  X,
  Navigation,
  Loader2,
  ExternalLink,
  Compass,
} from "lucide-react";
import { searchOsm } from "../services/osmClient";
import { placeAddress } from "../services/deliveryAddress";
import { OSM_CONFIG } from "../services/osmRouting";

export interface StoreLocationPickerModalProps {
  isOpen: boolean;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  onClose: () => void;
  onConfirm: (location: {
    lat: number;
    lng: number;
    address: string;
    city?: string;
  }) => void;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  address?: Record<string, string>;
}

export function StoreLocationPickerModal({
  isOpen,
  initialLat,
  initialLng,
  initialAddress = "",
  onClose,
  onConfirm,
}: StoreLocationPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Default coordinates centered on New Administrative Capital / Cairo
  const defaultLat = initialLat && !Number.isNaN(initialLat) ? initialLat : 30.013056;
  const defaultLng = initialLng && !Number.isNaN(initialLng) ? initialLng : 31.743056;

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });

  const [resolvedAddress, setResolvedAddress] = useState<string>(initialAddress);
  const [detectedCity, setDetectedCity] = useState<string>("");
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showResultsDropdown, setShowResultsDropdown] = useState<boolean>(false);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);

  const reverseRequest = useRef(0);
  const searchRequest = useRef(0);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reverseAbort = useRef<AbortController | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Reverse Geocoding Callback
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    const request = ++reverseRequest.current;
    clearTimeout(reverseTimer.current);
    reverseAbort.current?.abort();
    setIsResolving(true);
    setError("");

    reverseTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      reverseAbort.current = controller;
      try {
        const response = await searchOsm(
          { coordinates: { latitude: lat, longitude: lng } },
          { signal: controller.signal }
        );
        if (request !== reverseRequest.current) return;
        const place = response.results?.[0];
        const addr = place && placeAddress(place);
        if (addr) {
          setResolvedAddress(addr);
          setDetectedCity(
            place.address?.city || place.address?.town || place.address?.state || ""
          );
        }
      } catch (err: any) {
        if (request === reverseRequest.current) {
          setError(err?.message || "تعذر قراءة اسم الموقع من الخريطة؛ يمكنك كتابته يدويًا.");
        }
      } finally {
        if (request === reverseRequest.current) setIsResolving(false);
      }
    }, 700);
  }, []);

  // Reset state on open
  useEffect(() => {
    if (!isOpen) return;

    const lat = initialLat && !Number.isNaN(initialLat) ? initialLat : 30.013056;
    const lng = initialLng && !Number.isNaN(initialLng) ? initialLng : 31.743056;

    setCurrentCoords({ lat, lng });
    setResolvedAddress(initialAddress || "");
    setDetectedCity("");
    setError("");
    setSearchQuery("");
    setSearchResults([]);
    setShowResultsDropdown(false);

    return () => {
      reverseRequest.current++;
      searchRequest.current++;
      clearTimeout(reverseTimer.current);
      clearTimeout(searchTimeoutRef.current);
      reverseAbort.current?.abort();
      searchAbort.current?.abort();
      setIsResolving(false);
      setIsSearching(false);
    };
  }, [isOpen, initialLat, initialLng, initialAddress]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom: 16,
        zoomControl: false,
      });

      L.tileLayer(OSM_CONFIG.tileUrl, {
        attribution: OSM_CONFIG.attribution,
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      map.invalidateSize({ pan: false });
      setTimeout(() => map.invalidateSize({ pan: false }), 250);

      let lastCenter = { lat: currentCoords.lat, lng: currentCoords.lng };
      map.on("moveend", () => {
        const center = map.getCenter();
        if (
          Math.abs(center.lat - lastCenter.lat) < 0.000001 &&
          Math.abs(center.lng - lastCenter.lng) < 0.000001
        )
          return;
        lastCenter = { lat: center.lat, lng: center.lng };
        setCurrentCoords({ lat: center.lat, lng: center.lng });
        reverseGeocode(center.lat, center.lng);
      });

      map.on("click", (e: L.LeafletMouseEvent) => {
        map.panTo(e.latlng);
      });

      mapInstanceRef.current = map;

      // If no initial address was passed, run initial reverse geocode
      if (!initialAddress) {
        reverseGeocode(currentCoords.lat, currentCoords.lng);
      }
    }, 120);

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
    const request = ++searchRequest.current;
    clearTimeout(searchTimeoutRef.current);
    searchAbort.current?.abort();
    setSearchResults([]);
    setShowResultsDropdown(false);
    setIsSearching(false);
    if (value.trim().length < 3) return;

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbort.current = controller;
      try {
        const response = await searchOsm(
          { query: value.trim() },
          { signal: controller.signal }
        );
        if (request !== searchRequest.current) return;
        const data: SearchResult[] = response.results || [];
        setSearchResults(data);
        setShowResultsDropdown(data.length > 0);
        if (data.length === 0) {
          setError("لم يتم العثور على نتائج للبحث؛ يمكنك تحريك الخريطة مباشرة.");
        } else {
          setError("");
        }
      } catch (err: any) {
        if (request === searchRequest.current) {
          setError(err?.message || "تعذر إتمام البحث؛ استخدم الخريطة مباشرة.");
        }
      } finally {
        if (request === searchRequest.current) setIsSearching(false);
      }
    }, 600);
  };

  // Select Search Result
  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    setCurrentCoords({ lat, lng: lon });
    setShowResultsDropdown(false);
    setSearchQuery("");

    const addr = placeAddress(result);
    if (addr) setResolvedAddress(addr);
    setDetectedCity(result.address?.city || result.address?.town || result.address?.state || "");
    setError("");

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lon], 17, { duration: 1 });
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize({ pan: false });
      }, 400);
    }
  };

  // GPS Fly to Current Location
  const handleFlyToCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("متصفحك لا يدعم تحديد الموقع عبر GPS.");
      return;
    }
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const { latitude, longitude } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1 });
          setTimeout(() => {
            mapInstanceRef.current?.invalidateSize({ pan: false });
          }, 350);
        }
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setIsLocatingUser(false);
        setError("تعذر تحديد موقعك الحالي. يرجى تفعيل إذن الموقع أو تحريك الخريطة.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    onConfirm({
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      address: resolvedAddress.trim() || `موقع المتجر (${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)})`,
      city: detectedCity,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <header className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Compass size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">تحديد موقع المتجر على الخريطة</h3>
              <p className="text-[11px] text-slate-500">حرك الدبوس أو ابحث لتحديد الإحداثيات واسم العنوان بدقة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </header>

        {/* Search Bar */}
        <div className="p-3 bg-white border-b border-slate-100 relative z-30">
          <div className="relative">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="ابحث عن اسم الشارع، الحي، أو المعلم في العاصمة..."
              className="w-full pr-9 pl-8 py-2 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:border-orange-500 focus:bg-white focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 font-bold transition-all"
            />
            {isSearching && (
              <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-600 animate-spin" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showResultsDropdown && searchResults.length > 0 && (
            <div className="absolute top-full inset-x-3 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 max-h-52 overflow-y-auto divide-y divide-slate-100">
              {searchResults.map((res) => (
                <button
                  key={res.place_id}
                  type="button"
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full p-2.5 text-right text-xs hover:bg-orange-50 flex items-center gap-2 text-slate-800 transition-colors cursor-pointer"
                >
                  <MapPin size={14} className="text-orange-600 shrink-0" />
                  <span className="font-bold truncate">{res.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Canvas with Center Pin */}
        <div className="relative flex-1 w-full bg-slate-100 overflow-hidden min-h-[260px] sm:min-h-[300px]">
          <div
            ref={mapContainerRef}
            style={{ width: "100%", height: "100%", minHeight: "260px", zIndex: 10 }}
            className="w-full h-full"
          />

          {/* Center Pin Indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[400] flex flex-col items-center">
            <div className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1 border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
              <span>{isResolving ? "جارٍ قراءة العنوان..." : "📍 موقع المتجر"}</span>
            </div>

            <svg
              className="w-9 h-9 text-orange-600 drop-shadow-md"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
            </svg>
            <div className="w-2.5 h-1 bg-black/30 rounded-full blur-[1px] -mt-0.5" />
          </div>

          {/* GPS Fly-to Button */}
          <button
            type="button"
            onClick={handleFlyToCurrentLocation}
            disabled={isLocatingUser}
            className="absolute bottom-3 left-3 z-[400] p-2.5 rounded-xl bg-white shadow-md border border-slate-200 text-slate-700 hover:text-orange-600 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="الانتقال إلى موقعي الحالي"
          >
            <Navigation size={14} className={`text-orange-600 ${isLocatingUser ? "animate-spin" : ""}`} />
            <span className="text-[11px]">موقعي الحالي</span>
          </button>
        </div>

        {/* Bottom Details & Confirmation Card */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 shrink-0 space-y-3 z-20">
          <div className="bg-orange-50/60 border border-orange-200/80 rounded-2xl p-3 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <MapPin size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-orange-900">
                  العنوان المستخرج من الخريطة:
                </span>
                <span className="text-[9.5px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-orange-200 dir-ltr">
                  {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 mt-1 leading-snug">
                {isResolving ? (
                  <span className="text-slate-500 font-normal flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin text-orange-600" />
                    جارٍ قراءة الشارع والحي من الخريطة...
                  </span>
                ) : (
                  resolvedAddress || "قم بتحريك الخريطة لتحديد عنوان المتجر"
                )}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              تعديل أو تفصيل اسم الشارع والمنطقة:
            </label>
            <input
              type="text"
              value={resolvedAddress}
              onChange={(e) => setResolvedAddress(e.target.value)}
              placeholder="مثال: شارع مجلس النواب، الحي الحكومي، العاصمة الإدارية"
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={15} />
              <span>تأكيد واعتماد موقع المتجر ✓</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
