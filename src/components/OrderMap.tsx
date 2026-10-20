import React, { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, saveRecord } from "../lib/firebase.ts";
import { RealMap, mapsLink } from "./LocationModal.tsx";
import type { Order, Coordinates } from "../types/index.ts";
export function OrderMap({
  order,
  canShare = false,
}: {
  order: Order;
  canShare?: boolean;
}) {
  const [tracking, setTracking] = useState<{
    coordinates: Coordinates;
    active: boolean;
    updatedAt: any;
  } | null>(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const watch = useRef<number | undefined>(undefined);
  const lastSent = useRef(0);
  const lastCoordinates = useRef<Coordinates | undefined>(undefined);
  useEffect(
    () =>
      onSnapshot(
        doc(db, "tracking", order.id),
        (snap) => setTracking(snap.exists() ? (snap.data() as any) : null),
        () => setError("تعذر تحميل موقع المندوب."),
      ),
    [order.id],
  );
  const stop = () => {
    if (watch.current !== undefined)
      navigator.geolocation.clearWatch(watch.current);
    watch.current = undefined;
    setSharing(false);
    if (lastCoordinates.current)
      saveRecord("tracking", order.id, {
        coordinates: lastCoordinates.current,
        active: false,
      }).catch(() => {});
  };
  useEffect(
    () => () => {
      if (watch.current !== undefined)
        navigator.geolocation.clearWatch(watch.current);
      if (lastCoordinates.current)
        saveRecord("tracking", order.id, {
          coordinates: lastCoordinates.current,
          active: false,
        }).catch(() => {});
    },
    [order.id],
  );
  useEffect(() => {
    if (order.orderStatus !== "with_courier") stop();
  }, [order.orderStatus]);
  const start = () => {
    if (!navigator.geolocation) {
      setError("المتصفح لا يدعم GPS.");
      return;
    }
    setError("");
    setSharing(true);
    watch.current = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        if (now - lastSent.current < 10000) return;
        lastSent.current = now;
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        lastCoordinates.current = coordinates;
        try {
          await saveRecord("tracking", order.id, { coordinates, active: true });
        } catch {
          setError("تعذر مشاركة الموقع.");
          stop();
        }
      },
      () => {
        setError("اسمح بالوصول إلى الموقع لتفعيل التتبع.");
        stop();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  };
  const timestamp = tracking?.updatedAt?.toDate?.();
  return (
    <div
      className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs text-slate-700"
      dir="rtl"
    >
      <strong>الخريطة وموقع التوصيل</strong>
      {order.coordinates ? (
        <>
          <RealMap coordinates={order.coordinates} />
          <a
            className="block text-blue-700"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&destination=${order.coordinates.latitude},${order.coordinates.longitude}`}
          >
            افتح اتجاهات Google إلى العميل ↗
          </a>
        </>
      ) : (
        <a
          className="block text-blue-700"
          target="_blank"
          rel="noopener noreferrer"
          href={mapsLink(undefined, order.ministry)}
        >
          ابحث عن الوزارة في Google Maps ↗
        </a>
      )}
      {tracking && (
        <>
          <p>
            آخر موقع شاركه المندوب
            {timestamp ? ` — ${timestamp.toLocaleString("ar-EG")}` : ""}
            {!tracking.active ? " (المشاركة متوقفة)" : ""}
          </p>
          <p>قد يكون الموقع قديمًا؛ راجع وقت آخر تحديث.</p>
          <a
            className="block text-blue-700"
            target="_blank"
            rel="noopener noreferrer"
            href={mapsLink(tracking.coordinates)}
          >
            افتح آخر موقع للمندوب ↗
          </a>
        </>
      )}
      {canShare && order.orderStatus === "with_courier" && (
        <>
          <button
            className="bg-slate-900 text-white rounded-xl p-2"
            onClick={sharing ? stop : start}
          >
            {sharing ? "إيقاف مشاركة موقعي" : "مشاركة موقعي مع صاحب الطلب"}
          </button>
          <p>
            المشاركة أثناء فتح الصفحة فقط، وبعد موافقتك على GPS. تتوقف عند إغلاق
            الصفحة أو تسليم الطلب.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
