import express from "express";
import visitorsHandler from "./api/visitors.ts";
import operationsHandler from "./api/operations.ts";
import appContentHandler from "./api/app-content.ts";
import adminUsersHandler from "./api/admin-users.ts";
import adminDataHandler from "./api/admin-data.ts";
import ordersHandler from "./api/orders.ts";
import geminiHandler from "./api/gemini/[action].ts";
import catalogImagesHandler from "./api/catalog-images.ts";
import orderDeliveryHandler from "./api/order-delivery.ts";
import geideaCallbackHandler from "./api/geidea/callback.ts";
import notificationsHandler from "./api/notifications.ts";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use((_req, res, next) => { res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups"); next(); });
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/visitors", visitorsHandler);
  app.post("/api/visitors", visitorsHandler);
  app.post("/api/operations", operationsHandler);
  app.options("/api/operations", operationsHandler);
  app.get("/api/app-content", appContentHandler);
  app.post("/api/app-content", appContentHandler);
  app.options("/api/app-content", appContentHandler);
  app.post("/api/admin-users", adminUsersHandler);
  app.options("/api/admin-users", adminUsersHandler);
  app.post("/api/admin-data", adminDataHandler);
  app.options("/api/admin-data", adminDataHandler);
  app.post("/api/orders", ordersHandler);
  app.options("/api/orders", ordersHandler);
  app.post("/api/order-delivery", orderDeliveryHandler);
  app.options("/api/order-delivery", orderDeliveryHandler);
  app.post("/api/catalog-images", catalogImagesHandler);
  app.options("/api/catalog-images", catalogImagesHandler);
  app.post("/api/geidea/callback", geideaCallbackHandler);
  app.get("/api/geidea/callback", geideaCallbackHandler);
  app.options("/api/geidea/callback", geideaCallbackHandler);
  app.post("/api/notifications", notificationsHandler);
  app.get("/api/notifications", notificationsHandler);
  app.options("/api/notifications", notificationsHandler);

  app.post("/api/gemini/:action", geminiHandler);
  app.options("/api/gemini/:action", geminiHandler);

  app.all("/api/github/*", (_req, res) =>
    res
      .status(410)
      .json({ error: "النشر متاح فقط من GitHub وVercel، وليس من التطبيق." }),
  );

  if (process.env.NODE_ENV !== "production") {
    // Serve a WebSocket-free @vite/client shim so CSS injection works without HMR WebSocket errors
    app.get("/@vite/client", (_req, res) => {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${CSS.escape(id)}"]\`).forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
export class ErrorOverlay extends HTMLElement {
  close() { this.parentNode?.removeChild(this); }
}
`);
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
