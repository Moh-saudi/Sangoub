// Development servers disable PWA. Never delete production preview/offline caches.
if (
  import.meta.env.DEV &&
  "serviceWorker" in navigator &&
  (location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname.startsWith("ais-dev-"))
) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations.map((registration) => registration.unregister()),
      ),
    )
    .catch(() => {});
  if ("caches" in window)
    void caches
      .keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .catch(() => {});
}
