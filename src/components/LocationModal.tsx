import { customerMessage } from "../utils/customerMessage";
import React, { useState, useEffect } from "react";
import { X, MapPin, Loader2 } from "lucide-react";
import { MINISTRIES_LIST } from "../data/seedData.ts";
import type { Profile, Coordinates } from "../types/index.ts";
export const mapsLink = (coordinates?: Coordinates, address = "") =>
  coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + " الحي الحكومي العاصمة الإدارية الجديدة")}`;
export function RealMap({
  coordinates,
  title = "موقع التوصيل",
}: {
  coordinates: Coordinates;
  title?: string;
}) {
  const { latitude: lat, longitude: lng } = coordinates;
  return (
    <iframe
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="w-full h-56 border-0 rounded-xl"
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008},${lat - 0.005},${lng + 0.008},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`}
    />
  );
}
interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  onSaveLocation: (
    ministry: string,
    floor: string,
    room: string,
    coordinates?: Coordinates,
  ) => Promise<void>;
}
export const LocationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  user,
  onSaveLocation,
}) => {
  const [ministry, setMinistry] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setMinistry(
        MINISTRIES_LIST.includes(user.ministry as any) ? user.ministry! : "",
      );
      setFloor(user.floorNumber || "");
      setRoom(user.roomNumber || "");
      setCoordinates(user.coordinates);
      setError("");
    }
  }, [isOpen]);
  if (!isOpen) return null;
  const locate = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("المتصفح لا يدعم تحديد الموقع.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setCoordinates({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        });
        setBusy(false);
      },
      () => {
        setError(
          "تعذر تحديد الموقع. اسمح بالوصول للموقع أو أدخل الإحداثيات يدويًا.",
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
      dir="rtl"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="موقع التوصيل"
        className="w-full max-w-lg bg-white text-slate-900 p-5 rounded-3xl space-y-3 max-h-[90vh] overflow-y-auto"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (
              coordinates &&
              (!Number.isFinite(coordinates.latitude) ||
                !Number.isFinite(coordinates.longitude) ||
                Math.abs(coordinates.latitude) > 90 ||
                Math.abs(coordinates.longitude) > 180)
            )
              throw new Error("إحداثيات غير صالحة.");
            await onSaveLocation(ministry, floor, room, coordinates);
            onClose();
          } catch (e) {
            setError(customerMessage(e, "تعذر حفظ العنوان."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex justify-between">
          <h2 className="font-bold">موقع التوصيل الحقيقي</h2>
          <button type="button" aria-label="إغلاق" onClick={onClose}>
            <X />
          </button>
        </div>
        <label className="block text-sm">
          الوزارة
          <select
            required
            value={ministry}
            onChange={(e) => setMinistry(e.target.value)}
            className="w-full border p-2 rounded-xl"
          >
            <option value="">اختر الوزارة</option>
            {MINISTRIES_LIST.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            الدور
            <input
              required
              maxLength={60}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full border p-2 rounded-xl"
            />
          </label>
          <label className="text-sm">
            المكتب
            <input
              required
              maxLength={80}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="w-full border p-2 rounded-xl"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={locate}
          className="bg-orange-50 text-orange-800 p-3 rounded-xl flex gap-2 items-center"
        >
          {busy ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <MapPin size={18} />
          )}
          استخدم موقعي الحالي GPS
        </button>
        <p className="text-xs text-slate-500">
          استخدم GPS وأنت في مقر التوصيل. أو انسخ إحداثيات المكان من خرائط
          Google. لا يحدد GPS رقم الدور أو المكتب.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["latitude", "longitude"] as const).map((axis, index) => (
            <label key={axis} className="text-xs">
              {index === 0 ? "خط العرض" : "خط الطول"}
              <input
                type="number"
                step="any"
                min={index === 0 ? -90 : -180}
                max={index === 0 ? 90 : 180}
                value={coordinates?.[axis] ?? ""}
                onChange={(e) =>
                  setCoordinates((prev) => ({
                    ...prev,
                    latitude: prev?.latitude ?? 0,
                    longitude: prev?.longitude ?? 0,
                    [axis]: Number(e.target.value),
                  }))
                }
                className="w-full border p-2 rounded-xl"
              />
            </label>
          ))}
        </div>
        {coordinates && (
          <>
            <RealMap coordinates={coordinates} />
            <button
              type="button"
              className="text-xs text-red-700"
              onClick={() => setCoordinates(undefined)}
            >
              حذف الإحداثيات
            </button>
          </>
        )}
        <a
          href={mapsLink(coordinates, ministry)}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-blue-700 text-sm"
        >
          فتح الموقع في خرائط Google ↗
        </a>
        {error && (
          <p role="alert" className="text-red-700 text-sm">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full bg-slate-900 text-white p-3 rounded-xl"
        >
          حفظ عنوان التوصيل
        </button>
      </form>
    </div>
  );
};
