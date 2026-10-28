# T0 — Tracking audit (baseline 79deabe)

## Verified baseline

- Branch feature/osm-tracking, parent main 4b5bfe4. Full `git show 4b5bfe4` was read, including all five files: contract, API projection, integration seam, CourierApp placement and assertion. Seed 79deabe contains **five** files (two services, two tests, MIGRATION), not four total: `git show --stat 79deabe`.
- The integration is inside each active order card: `src/CourierApp.tsx:210` (locate exact current occurrence with `rg CourierTracking`). It must stay there. `src/components/CourierTracking.tsx:3` picks id/orderStatus/courierId/profileId/coordinates; it currently returns null (`:9`).
- Courier API explicitly returns courierId, profileId and coordinates without converting shape: `server/portalOrders.ts:37-47`; tests preserve the four fields: `tests/portal-orders.test.ts:139-146`.
- **DEVIATION D1:** pickupPoints have storeId, name, address **only**, no coordinates (`server/portalOrders.ts:100-110`). Do not change this API. The courier map cannot invent or plot a pickup location. Record absent-store-marker state.

## Writers, readers and actual entrypoints

- Legacy `OrderMap` watches tracking (`src/components/OrderMap.tsx:23-30`) and attempts to publish via saveRecord (`:38-41`, `:48-51`, `:76`). Its own watchPosition exists (`:62`) and stops permanently on write error (`:77-80`). It is used in the old CourierPortal (`src/components/CourierPortal.tsx:463`).
- **DEVIATION D2:** saveRecord does **not** add updatedAt client-side: `src/lib/firebase.ts:149-150` sends an audited admin-data mutation. That endpoint only supports its allowlisted collections (`server/handlers/admin-data.ts:12-17`), not tracking, and requires admin. A courier cannot use it for GPS. Implement a tracking-scoped setDoc helper with serverTimestamp; leave saveRecord and admin/accounts code unchanged.
- Supervisor currently subscribes to the entire tracking collection (`src/components/CouriersLiveMap.tsx:60-85`); redesign its tracking subscription to active order documents only, retaining admin authorization.
- Legacy storefront tracking is a demo: initial with_courier/progress .65 and synthetic store coordinates (`src/storefront/components/OrderTrackingModal.tsx:62-86`), with hidden attribution (`:97`) and hardcoded tiles (`:102`).
- **DEVIATION D3:** TrackableOrder lacks canonical orderStatus/courierId/profileId/coordinates (`src/storefront/components/OrderTrackingModal.tsx:27-47`). StorefrontApp initializes activeOrder=null (`src/storefront/StorefrontApp.tsx:43`); the actual checkout receipt displays the tracking map through RealMap (`src/shop/ShopFront.tsx:1132-1144`) after an authenticated API status read (`server/handlers/orders.ts:58-64`). T6 must preserve legacy type compatibility, remove simulation, and adapt the real receipt's GPS-only view to the shared viewer. No payment/cart/account logic will change.
- RealMap is an OSM embed iframe, not L.tileLayer (`src/components/LocationModal.tsx:11-33`). ServiceAreaModal uses Leaflet and direct public Nominatim (`src/storefront/components/ServiceAreaModal.tsx:58-67`, `:126`, `:181`). Existing LocationModal account/address form is outside GPS change; only its map renderer may change if needed.
- CourierApp has no location publisher yet (`src/components/CourierTracking.tsx:8-9`). Main routes /courier lazily (`src/App.tsx:19`), customer commerce to ShopFront (`:20`).

## Actual states and mutation boundaries

Canonical states: received → preparing → ready → with_courier → delivered, with cancelled terminal. Server transitions are in `server/handlers/operations.ts` (prepare/pickup/depart/cancel), `server/portalOrders.ts` (legacy pickup/depart), audited admin handler, and `server/handlers/order-delivery.ts` (OTP completion). No tracking change will mutate these fields. Tracking starts only with_courier plus assigned authenticated UID. Ending a subscription must attempt active:false with the last accepted courier point, not destination coordinates.

## Current rules (literal)

```
    match /tracking/{orderId} {
      allow read: if ownerOrder(get(/databases/$(database)/documents/orders/$(orderId)).data);
      allow create, update: if assignedCourier(get(/databases/$(database)/documents/orders/$(orderId)).data) &&
        (get(/databases/$(database)/documents/orders/$(orderId)).data.orderStatus == 'with_courier' ||
         request.resource.data.active == false) &&
        request.resource.data.keys().hasOnly(['coordinates', 'active', 'updatedAt']) &&
        validCoordinates(request.resource.data.coordinates) && request.resource.data.active is bool &&
        request.resource.data.updatedAt == request.time;
      allow delete: if false;
    }
```

- verified/accountAccess and ownerOrder/assignedCourier helpers: `firestore.rules:4-21`. Tracking writer is the assigned verified courier; owner/admin/assigned courier can read. Parent order looked up by ID. Payload only coordinates, active, updatedAt with request.time. **DEVIATION D4:** rules intentionally permit active:false cleanup outside with_courier. T9 interprets “only during with_courier” as **active:true publishing**, preserving the explicit stop requirement instead of changing rules without an executed failing test.
- No tracking rules deployment. Existing tests require Java and demo emulators; official jar download currently fails, before the test process starts (literal logs in WORKLOG).

## APIs and authentication

- Vercel filesystem API entries wrap serverEntry: `api/operations.ts:1-2`; serverEntry validates POST/Bearer before loading a handler (`server/serverEntry.js:3-18`). It does not authenticate arbitrary tokens itself; handlers verify Firebase ID tokens server-side. `server/operations.ts:13-24` verifies revoked tokens and current account access. New OSM endpoint follows the same wrapper/Bearer pattern, with token verification and injected unit dependencies.
- Local Express explicitly registers methods/routes (`server.ts:31-58`), then SPA fallback (`:149`). Vercel rewrites protect existing SPA routes, API files are native functions (`vercel.json`). New OSM route is one dynamic function to avoid two additional functions; deployment plan/function-count availability is NOT VERIFIED.
- No Vercel or Firebase settings have been inspected. Production identifiers are known from source; no production SDK was invoked. Node v24.19.0 and Java21 available; Node22 not installed. Seed routing tests were not in npm test (`package.json`); add them in T1. No network-backed test will remain.

## Baseline evidence and deviations

`npm ci` succeeded (1271 packages); lint/test/build succeeded. Baseline Workbox size: see exact precache line below. Rules suite NOT RUN (emulator download failure). The initial `git switch --track` failed because remote fetch refspec only tracks main, and left the seed tree staged without changing HEAD. Corrected using `git switch --no-track -c feature/osm-tracking origin/feature/osm-tracking`; the branch is at 79deabe with only new WORKLOG untracked. No commit or push to main.

Seed MIGRATION includes claims not implemented (IndexedDB queue, fixed cost/trip counts, completed UI integration). T10 will replace those with evidence and explicit NOT IMPLEMENTED/decisions, not preserve invented implementation statements.

Previews inherit project defaults unless isolated: cannot verify dashboard values here. Draft PR publication remains gated on preventing automatic Vercel deployment. Vercel schema retrieval was blocked by HTTP403; do not assume remote preview isolation from branch name alone.
precache  29 entries (2663.31 KiB)

## T1 configuration decision

`VITE_TILE_URL` is public browser configuration, with visible OSM attribution. Public OSM defaults are for development; no commercial-production SLA or suitability is claimed. Server routing/search URLs and identifiable User-Agent remain server-only. Existing iframe map is not L.tileLayer; it will be replaced by the shared viewer as GPS views are implemented. T1 also removes the seed test's live network dependency ahead of T3 so adding it to npm test is deterministic. Filter source is unchanged.
