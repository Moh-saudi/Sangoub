import { OSM_CONFIG } from '../services/osmRouting';
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Bike,
  Store as StoreIcon,
  Building2,
  MapPin,
  Phone,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Navigation,
  CheckCircle2,
  Clock,
  Layers,
  Compass,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Order, Store, Coordinates } from "../types";
import { formatEGP } from "../utils/orderCalculations";

declare const L: any;

interface CourierLiveLocation {
  orderId: string;
  coordinates: Coordinates;
  active: boolean;
  updatedAt?: any;
}

export function CouriersLiveMap({
  orders,
  stores,
  couriers,
  connected,
}: {
  orders: Order[];
  stores: Store[];
  couriers: Array<{ id: string; name: string; phone: string }>;
  connected: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const polylineLayerRef = useRef<any>(null);

  const [liveTracking, setLiveTracking] = useState<Record<string, CourierLiveLocation>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<"all" | "with_courier" | "ready" | "preparing">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Center Coordinates: New Administrative Capital / Shorouk zone
  const DEFAULT_CENTER: [number, number] = [30.0131, 31.7346]; // New Administrative Capital
  const SHOROUK_CENTER: [number, number] = [30.1287, 31.6083]; // Shorouk City

  // 1. Subscribe to Firestore 'tracking' collection for real-time courier GPS coordinates
  useEffect(() => {
    try {
      const q = query(collection(db, "tracking"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const trackingMap: Record<string, CourierLiveLocation> = {};
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.coordinates && typeof data.coordinates.latitude === "number") {
              trackingMap[docSnap.id] = {
                orderId: docSnap.id,
                coordinates: data.coordinates,
                active: data.active !== false,
                updatedAt: data.updatedAt,
              };
            }
          });
          setLiveTracking(trackingMap);
        },
        (error) => {
          console.warn("Could not stream live tracking from Firestore:", error);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Tracking listener init error:", e);
    }
  }, []);

  // 2. Filter active orders needing dispatch / courier attention
  const activeOrders = useMemo(() => {
    return orders.filter((o) => {
      const isOngoing = ["received", "preparing", "ready", "with_courier"].includes(o.orderStatus);
      if (!isOngoing) return false;

      if (filterStage !== "all" && o.orderStatus !== filterStage) return false;

      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesOrder = String(o.orderNumber || "").includes(queryLower);
        const matchesCourier = (o.courierName || "").toLowerCase().includes(queryLower);
        const matchesCustomer = (o.profileName || "").toLowerCase().includes(queryLower);
        const matchesMinistry = (o.ministry || "").toLowerCase().includes(queryLower);
        if (!matchesOrder && !matchesCourier && !matchesCustomer && !matchesMinistry) return false;
      }
      return true;
    });
  }, [orders, filterStage, searchQuery]);

  // Orders currently on the road with couriers
  const tripsWithCourier = useMemo(() => {
    return orders.filter((o) => o.orderStatus === "with_courier");
  }, [orders]);

  // 3. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || typeof L === "undefined") return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomleft" }).addTo(map);

      // OpenStreetMap Tile Layer
      L.tileLayer(OSM_CONFIG.tileUrl, {
        attribution: OSM_CONFIG.attribution,
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      const polylineGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = markersGroup;
      polylineLayerRef.current = polylineGroup;
    }

    return () => {
      // Keep map alive during tab switches or cleanup on unmount
    };
  }, []);

  // 4. Update markers & polylines whenever active orders, tracking, or selection change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !polylineLayerRef.current || typeof L === "undefined") {
      return;
    }

    const markersGroup = markersLayerRef.current;
    const polylineGroup = polylineLayerRef.current;
    markersGroup.clearLayers();
    polylineGroup.clearLayers();

    const boundsLatLngs: [number, number][] = [];

    // Helper: default fallback coordinates for ministry/district if specific customer lat/lng not stored
    const getOrderCustomerCoords = (o: Order): [number, number] => {
      if (o.coordinates?.latitude && o.coordinates?.longitude) {
        return [o.coordinates.latitude, o.coordinates.longitude];
      }
      // New Capital government district fallback
      return [30.015 + ((parseInt(o.orderNumber || "1") % 10) * 0.003), 31.735 + ((parseInt(o.orderNumber || "1") % 7) * 0.003)];
    };

    // Helper: store coordinates
    const getStoreCoords = (storeName?: string): [number, number] => {
      const foundStore = stores.find((s) => s.name === storeName || s.nameEn === storeName);
      if (foundStore?.locationInDistrict?.includes("شروق")) {
        return [30.1287, 31.6083];
      }
      return [30.0102, 31.7321]; // New Capital Food Court
    };

    // Render active orders on map
    activeOrders.forEach((order) => {
      const isSelected = selectedOrderId === order.id;
      const customerCoords = getOrderCustomerCoords(order);
      const storeCoords = getStoreCoords(order.items?.[0]?.product?.storeName);

      // Courier coords from live GPS tracking or order
      const trackingRecord = liveTracking[order.id];
      const courierCoords: [number, number] | null = trackingRecord?.coordinates
        ? [trackingRecord.coordinates.latitude, trackingRecord.coordinates.longitude]
        : order.orderStatus === "with_courier"
        ? [
            (storeCoords[0] + customerCoords[0]) / 2 + 0.001,
            (storeCoords[1] + customerCoords[1]) / 2 + 0.001,
          ]
        : null;

      // Add to bounds
      boundsLatLngs.push(customerCoords);
      boundsLatLngs.push(storeCoords);
      if (courierCoords) boundsLatLngs.push(courierCoords);

      // 1. Destination Marker (Customer Building)
      const customerIcon = L.divIcon({
        className: "custom-map-icon",
        html: `
          <div class="relative flex flex-col items-center">
            <div class="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg border-2 border-white text-base ${
              isSelected ? "ring-4 ring-amber-300 scale-110" : ""
            } transition-transform">
              🏢
            </div>
            <span class="mt-1 px-2 py-0.5 rounded-full bg-slate-900/90 text-white text-[10px] font-bold shadow whitespace-nowrap">
              #${order.orderNumber} ${order.ministry || "العميل"}
            </span>
          </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 48],
      });

      const customerMarker = L.marker(customerCoords, { icon: customerIcon });
      customerMarker.bindPopup(`
        <div style="font-family: Cairo, sans-serif; direction: rtl; text-align: right; min-width: 180px;">
          <strong style="font-size: 14px; color: #1e293b;">طلب #${order.orderNumber}</strong>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            <div>👤 العميل: <b>${order.profileName || "عميل العاصمة"}</b></div>
            <div>🏢 الوجهة: <b>${order.ministry || "الحي الحكومي"}</b></div>
            <div>💰 القيمة: <b>${formatEGP(order.total)}</b></div>
            <div>📦 الحالة: <b>${order.orderStatus}</b></div>
          </div>
        </div>
      `);
      customerMarker.on("click", () => setSelectedOrderId(order.id));
      markersGroup.addLayer(customerMarker);

      // 2. Store Marker
      const storeIcon = L.divIcon({
        className: "custom-map-icon",
        html: `
          <div class="relative flex flex-col items-center">
            <div class="w-8 h-8 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-sm">
              🍽️
            </div>
            <span class="mt-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-900 text-[9px] font-bold shadow whitespace-nowrap">
              ${order.items?.[0]?.product?.storeName || "المتجر"}
            </span>
          </div>
        `,
        iconSize: [36, 44],
        iconAnchor: [18, 42],
      });
      const storeMarker = L.marker(storeCoords, { icon: storeIcon });
      storeMarker.bindPopup(`
        <div style="font-family: Cairo, sans-serif; direction: rtl; text-align: right;">
          <strong style="color: #ea580c;">🏪 ${order.items?.[0]?.product?.storeName || "متجر التحضير"}</strong>
          <p style="font-size: 11px; margin: 4px 0 0; color: #64748b;">تجهيز طلب #${order.orderNumber}</p>
        </div>
      `);
      markersGroup.addLayer(storeMarker);

      // 3. Courier Marker (if on the road)
      if (courierCoords && order.orderStatus === "with_courier") {
        const isLive = Boolean(trackingRecord?.active);
        const courierIcon = L.divIcon({
          className: "custom-map-icon",
          html: `
            <div class="relative flex flex-col items-center">
              ${
                isLive
                  ? `<div class="absolute -inset-2 bg-emerald-400 rounded-full animate-ping opacity-60"></div>`
                  : ""
              }
              <div class="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xl border-2 border-white text-lg relative z-10 ${
                isSelected ? "ring-4 ring-emerald-300 scale-125" : ""
              } transition-transform">
                🛵
              </div>
              <span class="mt-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-200 text-[10px] font-extrabold shadow whitespace-nowrap flex items-center gap-1 z-10">
                <span class="w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400"}"></span>
                ${order.courierName || "المندوب"}
              </span>
            </div>
          `,
          iconSize: [44, 52],
          iconAnchor: [22, 50],
        });

        const courierMarker = L.marker(courierCoords, { icon: courierIcon });
        courierMarker.bindPopup(`
          <div style="font-family: Cairo, sans-serif; direction: rtl; text-align: right; min-width: 190px;">
            <strong style="font-size: 14px; color: #047857;">🛵 ${order.courierName || "مندوب التوصيل"}</strong>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              <div>📦 طلب: <b>#${order.orderNumber}</b></div>
              <div>🏢 إلى: <b>${order.ministry || "الحي الحكومي"}</b></div>
              ${order.courierPhone ? `<div>📞 هاتف: <a href="tel:${order.courierPhone}" style="color: #0284c7; font-weight: bold;">${order.courierPhone}</a></div>` : ""}
              <div style="margin-top: 6px; padding: 4px 6px; background: #ecfdf5; border-radius: 6px; color: #065f46;">
                ● حالة الـ GPS: <b>${isLive ? "إشارة حية ومباشرة" : "آخر موقع مسجل"}</b>
              </div>
            </div>
          </div>
        `);
        courierMarker.on("click", () => setSelectedOrderId(order.id));
        markersGroup.addLayer(courierMarker);

        // Draw Route Polyline when selected or with courier
        if (isSelected) {
          const polyline = L.polyline([storeCoords, courierCoords, customerCoords], {
            color: "#059669",
            weight: 4,
            opacity: 0.85,
            dashArray: "6, 8",
          });
          polylineGroup.addLayer(polyline);
        }
      }
    });

    // Auto-fit bounds if we have points and no specific order is locked
    if (boundsLatLngs.length > 0 && !selectedOrderId) {
      try {
        mapInstanceRef.current.fitBounds(boundsLatLngs, {
          padding: [50, 50],
          maxZoom: 15,
        });
      } catch (e) {
        // bounds fit silently ignored if invalid
      }
    }
  }, [activeOrders, liveTracking, selectedOrderId, stores]);

  // Recenter actions
  const focusOnOrder = (order: Order) => {
    setSelectedOrderId(order.id);
    if (!mapInstanceRef.current) return;

    const trackingRecord = liveTracking[order.id];
    let targetLat = order.coordinates?.latitude || 30.015;
    let targetLng = order.coordinates?.longitude || 31.735;

    if (trackingRecord?.coordinates) {
      targetLat = trackingRecord.coordinates.latitude;
      targetLng = trackingRecord.coordinates.longitude;
    }

    mapInstanceRef.current.flyTo([targetLat, targetLng], 15, { duration: 1.2 });
  };

  const centerOnNewCapital = () => {
    setSelectedOrderId(null);
    mapInstanceRef.current?.flyTo(DEFAULT_CENTER, 14, { duration: 1.2 });
  };

  const centerOnShorouk = () => {
    setSelectedOrderId(null);
    mapInstanceRef.current?.flyTo(SHOROUK_CENTER, 14, { duration: 1.2 });
  };

  const resetAllBounds = () => {
    setSelectedOrderId(null);
    mapInstanceRef.current?.flyTo(DEFAULT_CENTER, 12, { duration: 1.2 });
  };

  return (
    <section
      dir="rtl"
      className={`couriers-live-map-section bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 transition-all ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-0" : "my-4"
      }`}
      aria-label="خريطة تتبع المناديب الحية"
    >
      {/* Top Controls Bar */}
      <header className="bg-white px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
            <Bike size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 m-0">
                خريطة المناديب والرحلات الحية
              </h2>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                تتبع مباشر
              </span>
            </div>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              مراقبة خطوط سير مناديب التوصيل في العاصمة الإدارية والشروق لحظياً
            </p>
          </div>
        </div>

        {/* Quick Location Shortcuts & Fullscreen */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={centerOnNewCapital}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Compass size={14} className="text-orange-600" />
            الحي الحكومي
          </button>
          <button
            onClick={centerOnShorouk}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <MapPin size={14} className="text-emerald-600" />
            مدينة الشروق
          </button>
          <button
            onClick={resetAllBounds}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
            title="إعادة ضبط الرؤية"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl border border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
            title={isFullscreen ? "تصغير الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>

      {/* Main Grid: Left Map + Right Trips Dispatch Sidebar */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 min-h-[580px] ${isFullscreen ? "h-[calc(100vh-65px)]" : "h-[640px]"}`}>
        {/* Map View Container */}
        <div className="lg:col-span-8 xl:col-span-9 relative bg-slate-200 h-full">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Metrics Badge over Map */}
          <div className="absolute top-4 right-4 z-10 flex flex-wrap gap-2 pointer-events-none">
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold m-0">رحلات جارية</p>
                <p className="text-sm font-black text-slate-900 m-0">
                  {tripsWithCourier.length} في الطريق
                </p>
              </div>
            </div>
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-2.5">
              <Bike size={16} className="text-orange-600" />
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold m-0">مناديب على القوة</p>
                <p className="text-sm font-black text-slate-900 m-0">
                  {couriers.length} مندوب
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dispatch Orders & Couriers Sidebar */}
        <aside className="lg:col-span-4 xl:col-span-3 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
          {/* Search & Stage Filter */}
          <div className="p-3.5 border-b border-slate-100 space-y-2.5">
            <div className="relative">
              <Search size={15} className="absolute right-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث برقم الطلب، المندوب، الوزارة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Stage Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setFilterStage("all")}
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-colors ${
                  filterStage === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                الكل ({activeOrders.length})
              </button>
              <button
                onClick={() => setFilterStage("with_courier")}
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-colors ${
                  filterStage === "with_courier"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                في الطريق ({tripsWithCourier.length})
              </button>
              <button
                onClick={() => setFilterStage("ready")}
                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-colors ${
                  filterStage === "ready"
                    ? "bg-purple-600 text-white"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                }`}
              >
                جاهز للاستلام
              </button>
            </div>
          </div>

          {/* Trips List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {activeOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Bike size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">لا توجد رحلات مطابقة حالياً</p>
                <p className="text-[11px] text-slate-400">ستظهر الطلبات فور تفعيلها من المطبخ أو المندوب</p>
              </div>
            ) : (
              activeOrders.map((order) => {
                const isSelected = selectedOrderId === order.id;
                const isWithCourier = order.orderStatus === "with_courier";
                const isTrackingLive = Boolean(liveTracking[order.id]?.active);

                return (
                  <div
                    key={order.id}
                    onClick={() => focusOnOrder(order)}
                    className={`p-3 rounded-2xl border text-right cursor-pointer transition-all ${
                      isSelected
                        ? "bg-emerald-50/70 border-emerald-500 shadow-sm ring-1 ring-emerald-400"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        #{order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isWithCourier
                            ? "bg-emerald-100 text-emerald-800"
                            : order.orderStatus === "ready"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {isWithCourier
                          ? "🛵 في الطريق"
                          : order.orderStatus === "ready"
                          ? "✓ جاهز للاستلام"
                          : "🍳 قيد التحضير"}
                      </span>
                    </div>

                    {/* Customer & Ministry Info */}
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{order.ministry || "الحي الحكومي"}</span>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>العميل: {order.profileName || "عميل"}</span>
                      <span className="font-bold text-slate-700">{formatEGP(order.total)}</span>
                    </div>

                    {/* Courier Tag & Contact */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isTrackingLive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}></span>
                        <span className="font-bold text-slate-700">
                          {order.courierName || "لم يُعيّن مندوب"}
                        </span>
                      </div>

                      {order.courierPhone && (
                        <a
                          href={`tel:${order.courierPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-bold"
                          title="اتصال بالمندوب"
                        >
                          <Phone size={12} />
                          اتصال
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
