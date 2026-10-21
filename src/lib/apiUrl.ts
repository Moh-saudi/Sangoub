import { Capacitor } from "@capacitor/core";

// Bundled mobile assets have no API server on their localhost origin.
export function apiUrl(path: string): string {
  if (!path.startsWith("/api/")) throw new Error("Invalid API path");
  if (!Capacitor.isNativePlatform()) return path;
  const origin = new URL(
    import.meta.env.VITE_API_ORIGIN || "https://capital-talabat.vercel.app",
  );
  if (origin.protocol !== "https:" || origin.username || origin.password)
    throw new Error("خادم التطبيق يجب أن يستخدم عنوان HTTPS آمنًا.");
  return new URL(path, origin.origin).href;
}
