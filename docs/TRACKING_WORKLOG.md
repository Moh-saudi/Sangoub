# Tracking implementation worklog

Baseline branch: feature/osm-tracking at 79deabe. Work restricted to GPS/web scope. No main push, merge, deployment or production Firebase connection authorized. Start: 2026-10-28 (Africa/Cairo). No other agent is working on this branch.

This log records literal command tails after each task's gates. Git metadata for a task is recorded immediately after its implementation commit, in the next bookkeeping change: a commit cannot contain its own SHA. The final log update will be a separate documentation commit. Secrets and environment values are excluded.

## Environment and external prerequisites

Node v24.19.0; Java OpenJDK 21.0.12.1. Node 22 requested but not installed in this workspace; Node 24 is within the allowed test:rules range. Vercel Preview environment isolation, its production Git trigger, Staging project creation and private SDK-file placement outside tools' workspace cannot be verified from this environment. No secrets have been read. Preview deployment must be disabled or isolated before pushing this branch; a branch push may trigger the user's external deployment integration. No remote branch push will be made until that prerequisite is established; draft PR creation will be attempted using the existing remote branch only if safe and callable.

## T0 — IN PROGRESS

Audit and npm ci/lint/test/build, with demo-only emulator tests where possible.

## T0 — PASS

npm ci/lint/test/build PASS; test:rules NOT RUN: emulator startup failed before tests. Node24/Java21; no production access. Detailed D1–D4 in AUDIT.

### Command
```sh
npm ci --cache /workspace/.npm-cache --prefer-offline --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000
```
```text
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated json-ptr@3.1.1: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated uuid@7.0.3: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
npm warn deprecated glob@11.1.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated uuid@9.0.1: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
npm warn deprecated uuid@9.0.1: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
npm warn deprecated uuid@9.0.1: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).

added 1271 packages in 2m
```

### Command
```sh
npm run lint
```
```text

> react-example@0.0.0 lint
> tsc --noEmit

```

### Command
```sh
npm test
```
```text
[truncated]
✔ discount allocations never become negative and do not lose cents across stores (0.773917ms)
✔ tax is not invented and configured VAT requires a registration number (0.672387ms)
✔ R2 uploads use a generated catalog key with correct extension (1.533231ms)
✔ rejects unsupported types, oversize files and arbitrary object paths (0.482295ms)
✔ image signing requires authentication before accessing cloud services (0.604212ms)
✔ checkout acknowledgment cannot erase quantities or new lines added during the request (3.060285ms)
✔ mixed breakfast retains sandwiches and meals in the WhatsApp request with exact quantities (3.386034ms)
✔ InstaPay is a requested payment method and never a paid confirmation (0.362412ms)
✔ incomplete customer details, invalid quantities and unknown menu items cannot produce a sendable request (0.763901ms)
✔ Arabic and Persian quantity digits are accepted while fractional quantities are rejected (0.44441ms)
✔ supermarket request combines packs from every section without breakfast items or payment claims (0.555404ms)
✔ campaign scheduling uses Cairo rather than the execution host timezone (35.276885ms)
✔ catalog monitoring counts delivered snapshots and excludes cancelled orders (2.999793ms)
✔ editing archived items cannot silently make them available (32.016217ms)
✔ catalog editor rejects invalid discounts, unsafe URLs and nonnumeric prices (1.811833ms)
✔ calculateCartSubtotal correctly sums prices with quantities and options (1.783099ms)
✔ applyCouponDiscount handles minOrder thresholds and discount calculation (0.412741ms)
✔ calculateOrderTotal applies discount, delivery fee, and tip properly (0.160544ms)
✔ getNextOrderStatus advances status correctly (0.121318ms)
✔ validateEmployeeProfile validates name, Egyptian phone, ministry and floor (0.411556ms)
✔ updateCourierMilestone updates checklist and advances to delivered when completed (0.188736ms)
✔ currency formatting preserves cents charged by the payment gateway (15.927317ms)
✔ calculateMerchantAccountingSummary accurately aggregates sales, payments, and platform commission (0.402966ms)
✔ generateMerchantJournalEntries creates balanced double-entry accounting records (0.723717ms)
✔ calculateTopSellingProducts ranks products correctly by volume and share (0.639607ms)
✔ calculateDistanceKm and rankCouriersForStore find closest courier and highlight fastest (0.526491ms)
✔ Flutter summary records preserve totals and normalize Firestore timestamps (2.961455ms)
✔ one kitchen cannot mark a multi-store order globally ready (0.674884ms)
✔ daily metrics use Cairo date and actual delivery time across midnight (27.200679ms)
✔ offers exclude invalid discounts, archived stock, and closed or missing stores (2.872416ms)
✔ price and store availability changes immediately update offer eligibility (0.290055ms)
✔ campaign tags and referrer domains classify sources without accepting spoofed hosts or collecting raw values (1.184675ms)
ℹ tests 47
ℹ suites 0
ℹ pass 47
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 877.007663
```

### Command
```sh
npm run build
```
```text
[truncated]
dist/assets/index-D9vuyBnO.css            267.74 kB │ gzip:  46.62 kB
dist/assets/operationsApi-CzZJkVOs.js       0.09 kB │ gzip:   0.10 kB
dist/assets/orderDelivery-Cb6ET3E9.js       0.49 kB │ gzip:   0.40 kB
dist/assets/rolldown-runtime-WkwZ5CU-.js    0.59 kB │ gzip:   0.36 kB
dist/assets/loader-circle-BB_a9ApL.js       1.50 kB │ gzip:   0.86 kB
dist/assets/DataStates-CJBxYAsJ.js          3.35 kB │ gzip:   1.65 kB
dist/assets/react-dom-fuSZiae7.js           3.90 kB │ gzip:   1.42 kB
dist/assets/CourierApp-Bo1r15t5.js         11.85 kB │ gzip:   4.24 kB
dist/assets/KitchenDisplay-Dt8T1Ouz.js     12.11 kB │ gzip:   4.50 kB
dist/assets/LocationModal-xLsXyCAC.js      13.98 kB │ gzip:   4.33 kB
dist/assets/ShopFront-5mg_Mmdl.js          39.34 kB │ gzip:  11.20 kB
dist/assets/MerchantApp-P7H9JjKl.js        77.84 kB │ gzip:  19.49 kB
dist/assets/AdminApp-Yowacc0b.js          283.49 kB │ gzip:  67.91 kB
dist/assets/index-CBYNEXhx.js             529.20 kB │ gzip: 150.58 kB
dist/assets/jsx-runtime-B8K-vAZj.js       605.87 kB │ gzip: 184.29 kB

[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/authenticatedApi.ts is dynamically imported by src/lib/firebase.ts but also statically imported by src/components/NotificationCenter.tsx, src/lib/adminApi.ts, src/lib/operationsApi.ts, src/shop/ShopFront.tsx, src/storefront/components/SangoubAuthModal.tsx, dynamic import will not move module into another chunk.

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.52s

PWA v2.0.0
mode      generateSW
precache  29 entries (2663.31 KiB)
files generated
  dist/sw.js
  dist/workbox-95677aec.js
[33m[PLUGIN_TIMINGS] [0mJavaScript callbacks ran for 5.1s. The build took 3.5s. Callbacks such as `closeBundle` run after the build ends, so callback time can be more than build time.
The slowest callbacks, timed inside each callback (the wait before a callback starts is excluded, the time it awaits is included):
  - plugin vite-plugin-pwa:build closeBundle (55%, 1.9s, 1 call)
Additional callback time came from the callbacks below and from callbacks under 1s.
2 callbacks are listed without a time. Their calls overlapped, so the time inside one call includes work from other calls. To find their cost, profile the build with `node --cpu-prof`:
  - plugin vite:css transform (10 calls)
  - plugin @tailwindcss/vite:generate:build transform (9 calls)
See https://rolldown.rs/reference/InputOptions.checks#bundlertimings for more details.

```

### Command
```sh
env -u FIREBASE_CLIENT_EMAIL -u FIREBASE_PRIVATE_KEY -u GOOGLE_APPLICATION_CREDENTIALS XDG_CONFIG_HOME=/workspace/.config CI=1 FIREBASE_PROJECT_ID=demo-capital-talabat npm run test:rules
```
```text

> react-example@0.0.0 test:rules
> firebase emulators:exec --config firebase.emulators.json --only firestore,auth --project demo-capital-talabat "node --import tsx --test --test-concurrency=1 tests/firestore.security.test.ts tests/order-api.integration.test.ts tests/admin-api.integration.test.ts"

i  emulators: Starting emulators: auth, firestore
i  emulators: Detected demo project ID "demo-capital-talabat", emulated services will use a demo configuration and attempts to access non-emulated services for this project will fail.
⚠  It appears you are running in a CI environment. You can avoid downloading the Firestore Emulator repeatedly by caching the /home/agent/.cache/firebase/emulators directory.
i  firestore: downloading cloud-firestore-emulator-v1.22.0.jar...
i  emulators: Shutting down emulators.
i  firestore: Stopping Firestore Emulator
i  hub: Stopping emulator hub

Error: Failed to make request to https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar
```

### T0 commit
SHA: 88b100db0447d952720964aba2ba63396c991dcc

```text
commit 88b100db0447d952720964aba2ba63396c991dcc
Author: Ahmed <tnestgpt01@gmail.com>
Date:   Wed Oct 28 20:00:47 2026 +0000

    docs(tracking): audit baseline and record T0 verification

 docs/TRACKING_AUDIT.md   |  55 ++++++++++++++++
 docs/TRACKING_WORKLOG.md | 161 +++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 216 insertions(+)
```

## T1 — PASS

Central tile config and visible attribution. Seed network test made offline before adding to npm test (preparatory T3 deviation). First lint failed on duplicate attribution keys; fixed before second attempt. Filter source unchanged. Public OSM defaults development-only.

### Command
```sh
npm run lint (attempt 1)
```
```text

> react-example@0.0.0 lint
> tsc --noEmit

src/components/CouriersLiveMap.tsx(134,9): error TS1117: An object literal cannot have multiple properties with the same name.
src/storefront/components/ServiceAreaModal.tsx(129,9): error TS1117: An object literal cannot have multiple properties with the same name.
```

### Command
```sh
npm run lint
```
```text

> react-example@0.0.0 lint
> tsc --noEmit

```

### Command
```sh
npm test
```
```text
[truncated]
✔ haversineDistanceMeters accurately measures known distance in Cairo / NAC (1.498312ms)
✔ estimateFallbackRoute applies 30% curvature factor and generates reasonable duration (0.988795ms)
✔ hasDeviatedFromRoute accurately detects deviation threshold (0.359136ms)
✔ calculateOsmRoute falls back gracefully when network fails or times out (1.128015ms)
✔ OSM_CONFIG exposes valid tileUrl and attribution (0.18599ms)
✔ checkout acknowledgment cannot erase quantities or new lines added during the request (1.481287ms)
✔ mixed breakfast retains sandwiches and meals in the WhatsApp request with exact quantities (3.712646ms)
✔ InstaPay is a requested payment method and never a paid confirmation (0.467764ms)
✔ incomplete customer details, invalid quantities and unknown menu items cannot produce a sendable request (1.194894ms)
✔ Arabic and Persian quantity digits are accepted while fractional quantities are rejected (0.686617ms)
✔ supermarket request combines packs from every section without breakfast items or payment claims (1.025711ms)
✔ campaign scheduling uses Cairo rather than the execution host timezone (20.59499ms)
✔ catalog monitoring counts delivered snapshots and excludes cancelled orders (1.887482ms)
✔ editing archived items cannot silently make them available (47.179622ms)
✔ catalog editor rejects invalid discounts, unsafe URLs and nonnumeric prices (0.895998ms)
✔ calculateCartSubtotal correctly sums prices with quantities and options (1.632819ms)
✔ applyCouponDiscount handles minOrder thresholds and discount calculation (0.508081ms)
✔ calculateOrderTotal applies discount, delivery fee, and tip properly (0.294156ms)
✔ getNextOrderStatus advances status correctly (0.623119ms)
✔ validateEmployeeProfile validates name, Egyptian phone, ministry and floor (0.610579ms)
✔ updateCourierMilestone updates checklist and advances to delivered when completed (0.345594ms)
✔ currency formatting preserves cents charged by the payment gateway (25.62576ms)
✔ calculateMerchantAccountingSummary accurately aggregates sales, payments, and platform commission (0.497273ms)
✔ generateMerchantJournalEntries creates balanced double-entry accounting records (1.292442ms)
✔ calculateTopSellingProducts ranks products correctly by volume and share (1.694002ms)
✔ calculateDistanceKm and rankCouriersForStore find closest courier and highlight fastest (1.385284ms)
✔ Flutter summary records preserve totals and normalize Firestore timestamps (2.577283ms)
✔ one kitchen cannot mark a multi-store order globally ready (0.427051ms)
✔ daily metrics use Cairo date and actual delivery time across midnight (20.1186ms)
✔ offers exclude invalid discounts, archived stock, and closed or missing stores (2.12202ms)
✔ price and store availability changes immediately update offer eligibility (0.468332ms)
✔ campaign tags and referrer domains classify sources without accepting spoofed hosts or collecting raw values (1.705232ms)
ℹ tests 64
ℹ suites 0
ℹ pass 64
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1085.745255
```

### Command
```sh
npm run build
```
```text
[truncated]
computing gzip size...
dist/build-info.json                        0.08 kB │ gzip:   0.09 kB
dist/registerSW.js                          0.13 kB
dist/manifest.webmanifest                   0.50 kB
dist/index.html                             3.25 kB │ gzip:   1.15 kB
dist/assets/CourierApp-objfHoLw.css         2.49 kB │ gzip:   0.85 kB
dist/assets/MerchantApp-BTOjdwri.css       10.25 kB │ gzip:   2.57 kB
dist/assets/ShopFront-RYKMbjBy.css         10.40 kB │ gzip:   2.60 kB
dist/assets/AdminApp-EWhne2zZ.css          49.46 kB │ gzip:   9.88 kB
dist/assets/index-D9vuyBnO.css            267.74 kB │ gzip:  46.62 kB
dist/assets/operationsApi-CzZJkVOs.js       0.09 kB │ gzip:   0.10 kB
dist/assets/orderDelivery-Cb6ET3E9.js       0.49 kB │ gzip:   0.40 kB
dist/assets/rolldown-runtime-WkwZ5CU-.js    0.59 kB │ gzip:   0.36 kB
dist/assets/loader-circle-BB_a9ApL.js       1.50 kB │ gzip:   0.86 kB
dist/assets/DataStates-CJBxYAsJ.js          3.35 kB │ gzip:   1.65 kB
dist/assets/react-dom-fuSZiae7.js           3.90 kB │ gzip:   1.42 kB
dist/assets/CourierApp-Chj-6xLc.js         11.85 kB │ gzip:   4.24 kB
dist/assets/KitchenDisplay-J3Oiohy_.js     12.11 kB │ gzip:   4.50 kB
dist/assets/LocationModal-xLsXyCAC.js      13.98 kB │ gzip:   4.33 kB
dist/assets/ShopFront-s0tMeIVM.js          39.34 kB │ gzip:  11.21 kB
dist/assets/MerchantApp-gcnH9ecY.js        77.84 kB │ gzip:  19.49 kB
dist/assets/AdminApp-DUuJuHNd.js          283.42 kB │ gzip:  67.87 kB
dist/assets/index-iBWRP2LT.js             529.42 kB │ gzip: 150.68 kB
dist/assets/jsx-runtime-B8K-vAZj.js       605.87 kB │ gzip: 184.29 kB

[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/authenticatedApi.ts is dynamically imported by src/lib/firebase.ts but also statically imported by src/components/NotificationCenter.tsx, src/lib/adminApi.ts, src/lib/operationsApi.ts, src/shop/ShopFront.tsx, src/storefront/components/SangoubAuthModal.tsx, dynamic import will not move module into another chunk.

✓ built in 2.96s
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

PWA v2.0.0
mode      generateSW
precache  29 entries (2663.46 KiB)
files generated
  dist/sw.js
  dist/workbox-95677aec.js
```

### T1 commit
SHA: 72c9d71a8ab3386abd7f3b74eec947b1b7a660b6

```text
commit 72c9d71a8ab3386abd7f3b74eec947b1b7a660b6
Author: Ahmed <tnestgpt01@gmail.com>
Date:   Wed Oct 28 20:02:54 2026 +0000

    feat(maps): centralize development tiles and enable service tests

 .env.example                                     |  10 ++
 docs/TRACKING_AUDIT.md                           |   4 +
 docs/TRACKING_WORKLOG.md                         | 139 +++++++++++++++++++++++
 package.json                                     |   2 +-
 src/components/CouriersLiveMap.tsx               |   5 +-
 src/services/osmRouting.test.ts                  |   5 +-
 src/storefront/components/OrderTrackingModal.tsx |   6 +-
 src/storefront/components/ServiceAreaModal.tsx   |   5 +-
 8 files changed, 168 insertions(+), 8 deletions(-)
```

## T2 — PASS

One dynamic authenticated OSM API; numeric bounded geography, 4s abort, bounded cache/per-user budgets and instance-global Nominatim 1/s. Five unit tests use fake fetch; no Firebase calls. Limits are per warm instance only, not distributed on Vercel. Production upstreams/User-Agent require explicit configuration. Vercel schema lookup HTTP403 and npm schemas lookup HTTP404: Preview isolation remains NOT VERIFIED; do not push yet.

### Command
```sh
npm run lint
```
```text

> react-example@0.0.0 lint
> tsc --noEmit

```

### Command
```sh
npm test
```
```text
[truncated]
✔ haversineDistanceMeters accurately measures known distance in Cairo / NAC (0.863148ms)
✔ estimateFallbackRoute applies 30% curvature factor and generates reasonable duration (0.305894ms)
✔ hasDeviatedFromRoute accurately detects deviation threshold (0.249275ms)
✔ calculateOsmRoute falls back gracefully when network fails or times out (1.151017ms)
✔ OSM_CONFIG exposes valid tileUrl and attribution (1.088352ms)
✔ checkout acknowledgment cannot erase quantities or new lines added during the request (1.708339ms)
✔ mixed breakfast retains sandwiches and meals in the WhatsApp request with exact quantities (1.726211ms)
✔ InstaPay is a requested payment method and never a paid confirmation (0.698938ms)
✔ incomplete customer details, invalid quantities and unknown menu items cannot produce a sendable request (0.770473ms)
✔ Arabic and Persian quantity digits are accepted while fractional quantities are rejected (0.630294ms)
✔ supermarket request combines packs from every section without breakfast items or payment claims (0.445474ms)
✔ campaign scheduling uses Cairo rather than the execution host timezone (34.732704ms)
✔ catalog monitoring counts delivered snapshots and excludes cancelled orders (2.718491ms)
✔ editing archived items cannot silently make them available (33.799978ms)
✔ catalog editor rejects invalid discounts, unsafe URLs and nonnumeric prices (1.028556ms)
✔ calculateCartSubtotal correctly sums prices with quantities and options (1.693528ms)
✔ applyCouponDiscount handles minOrder thresholds and discount calculation (0.326497ms)
✔ calculateOrderTotal applies discount, delivery fee, and tip properly (0.310516ms)
✔ getNextOrderStatus advances status correctly (0.160217ms)
✔ validateEmployeeProfile validates name, Egyptian phone, ministry and floor (0.369453ms)
✔ updateCourierMilestone updates checklist and advances to delivered when completed (0.195251ms)
✔ currency formatting preserves cents charged by the payment gateway (14.697118ms)
✔ calculateMerchantAccountingSummary accurately aggregates sales, payments, and platform commission (0.615864ms)
✔ generateMerchantJournalEntries creates balanced double-entry accounting records (1.193483ms)
✔ calculateTopSellingProducts ranks products correctly by volume and share (0.703503ms)
✔ calculateDistanceKm and rankCouriersForStore find closest courier and highlight fastest (0.404269ms)
✔ Flutter summary records preserve totals and normalize Firestore timestamps (3.138498ms)
✔ one kitchen cannot mark a multi-store order globally ready (0.70083ms)
✔ daily metrics use Cairo date and actual delivery time across midnight (20.976535ms)
✔ offers exclude invalid discounts, archived stock, and closed or missing stores (3.229377ms)
✔ price and store availability changes immediately update offer eligibility (0.395453ms)
✔ campaign tags and referrer domains classify sources without accepting spoofed hosts or collecting raw values (2.4906ms)
ℹ tests 69
ℹ suites 0
ℹ pass 69
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1061.195734
```

### Command
```sh
npm run build
```
```text
[truncated]
computing gzip size...
dist/build-info.json                        0.08 kB │ gzip:   0.09 kB
dist/registerSW.js                          0.13 kB
dist/manifest.webmanifest                   0.50 kB
dist/index.html                             3.25 kB │ gzip:   1.15 kB
dist/assets/CourierApp-objfHoLw.css         2.49 kB │ gzip:   0.85 kB
dist/assets/MerchantApp-BTOjdwri.css       10.25 kB │ gzip:   2.57 kB
dist/assets/ShopFront-RYKMbjBy.css         10.40 kB │ gzip:   2.60 kB
dist/assets/AdminApp-EWhne2zZ.css          49.46 kB │ gzip:   9.88 kB
dist/assets/index-D9vuyBnO.css            267.74 kB │ gzip:  46.62 kB
dist/assets/operationsApi-CzZJkVOs.js       0.09 kB │ gzip:   0.10 kB
dist/assets/orderDelivery-Cb6ET3E9.js       0.49 kB │ gzip:   0.40 kB
dist/assets/rolldown-runtime-WkwZ5CU-.js    0.59 kB │ gzip:   0.36 kB
dist/assets/loader-circle-BB_a9ApL.js       1.50 kB │ gzip:   0.86 kB
dist/assets/DataStates-CJBxYAsJ.js          3.35 kB │ gzip:   1.65 kB
dist/assets/react-dom-fuSZiae7.js           3.90 kB │ gzip:   1.42 kB
dist/assets/CourierApp-yZYhzg3v.js         11.85 kB │ gzip:   4.24 kB
dist/assets/KitchenDisplay-C6u_QUo8.js     12.11 kB │ gzip:   4.50 kB
dist/assets/LocationModal-xLsXyCAC.js      13.98 kB │ gzip:   4.33 kB
dist/assets/ShopFront-CQEQzHBW.js          39.34 kB │ gzip:  11.21 kB
dist/assets/MerchantApp-nwmuMoJo.js        77.84 kB │ gzip:  19.49 kB
dist/assets/AdminApp-CsWoqRGJ.js          283.42 kB │ gzip:  67.87 kB
dist/assets/index-B41PCAR_.js             529.42 kB │ gzip: 150.68 kB
dist/assets/jsx-runtime-B8K-vAZj.js       605.87 kB │ gzip: 184.29 kB

[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/authenticatedApi.ts is dynamically imported by src/lib/firebase.ts but also statically imported by src/components/NotificationCenter.tsx, src/lib/adminApi.ts, src/lib/operationsApi.ts, src/shop/ShopFront.tsx, src/storefront/components/SangoubAuthModal.tsx, dynamic import will not move module into another chunk.

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.92s

PWA v2.0.0
mode      generateSW
precache  29 entries (2663.46 KiB)
files generated
  dist/sw.js
  dist/workbox-95677aec.js
```

### T2 commit
SHA: c7b463a6d16f3dbbbee4ce15f1853d38fcf67e9e

```text
commit c7b463a6d16f3dbbbee4ce15f1853d38fcf67e9e
Author: Ahmed <tnestgpt01@gmail.com>
Date:   Wed Oct 28 20:05:33 2026 +0000

    feat(osm): add authenticated bounded routing and search gateway

 api/osm/[action].ts      |   2 +
 docs/TRACKING_WORKLOG.md | 132 +++++++++++++++++++++++++++++++++++++++++++++++
 package.json             |   2 +-
 server.ts                |   4 ++
 server/handlers/osm.ts   |   7 +++
 server/osmProxy.test.ts  |   9 ++++
 server/osmProxy.ts       |  58 +++++++++++++++++++++
 7 files changed, 213 insertions(+), 1 deletion(-)
```

## T3 — PASS

Browser uses same-origin authenticated proxy, cancellation/fallback and bounded route cache. Fixed sparse-vertex deviation by measuring line segments; planner reroutes only departure/destination change or >50m deviation (10s anti-storm guard). ETA remaining ratio needs no repeated request. ServiceArea search now uses authenticated search; unsigned guests get an explicit unavailable/sign-in message. All fetch tests mocked, including real AbortController under fake timers; no Firebase initialized by tests.

### Command
```sh
npm run lint
```
```text

> react-example@0.0.0 lint
> tsc --noEmit

```

### Command
```sh
npm test
```
```text
[truncated]
✔ deviation measures segments: midpoint of sparse route is not a 700m false deviation (0.37814ms)
✔ route uses authenticated same-origin proxy and cache; no provider receives token (33.319815ms)
✔ real AbortController timeout is deterministic with a fake clock and stalled fake fetch (1.889418ms)
✔ network errors and malformed responses fall back without any Firebase initialization (0.979138ms)
✔ planner recalculates on departure and >50m deviation only; ETA decreases without new requests (1.138358ms)
✔ checkout acknowledgment cannot erase quantities or new lines added during the request (3.39243ms)
✔ mixed breakfast retains sandwiches and meals in the WhatsApp request with exact quantities (3.619163ms)
✔ InstaPay is a requested payment method and never a paid confirmation (0.268043ms)
✔ incomplete customer details, invalid quantities and unknown menu items cannot produce a sendable request (0.637146ms)
✔ Arabic and Persian quantity digits are accepted while fractional quantities are rejected (0.532349ms)
✔ supermarket request combines packs from every section without breakfast items or payment claims (0.498409ms)
✔ campaign scheduling uses Cairo rather than the execution host timezone (23.019213ms)
✔ catalog monitoring counts delivered snapshots and excludes cancelled orders (2.476032ms)
✔ editing archived items cannot silently make them available (31.219636ms)
✔ catalog editor rejects invalid discounts, unsafe URLs and nonnumeric prices (0.505496ms)
✔ calculateCartSubtotal correctly sums prices with quantities and options (1.76473ms)
✔ applyCouponDiscount handles minOrder thresholds and discount calculation (0.881292ms)
✔ calculateOrderTotal applies discount, delivery fee, and tip properly (0.576672ms)
✔ getNextOrderStatus advances status correctly (0.676002ms)
✔ validateEmployeeProfile validates name, Egyptian phone, ministry and floor (1.070439ms)
✔ updateCourierMilestone updates checklist and advances to delivered when completed (0.749226ms)
✔ currency formatting preserves cents charged by the payment gateway (24.120582ms)
✔ calculateMerchantAccountingSummary accurately aggregates sales, payments, and platform commission (0.9365ms)
✔ generateMerchantJournalEntries creates balanced double-entry accounting records (1.198631ms)
✔ calculateTopSellingProducts ranks products correctly by volume and share (1.173919ms)
✔ calculateDistanceKm and rankCouriersForStore find closest courier and highlight fastest (0.835744ms)
✔ Flutter summary records preserve totals and normalize Firestore timestamps (2.551735ms)
✔ one kitchen cannot mark a multi-store order globally ready (0.677155ms)
✔ daily metrics use Cairo date and actual delivery time across midnight (30.347994ms)
✔ offers exclude invalid discounts, archived stock, and closed or missing stores (1.690466ms)
✔ price and store availability changes immediately update offer eligibility (0.174349ms)
✔ campaign tags and referrer domains classify sources without accepting spoofed hosts or collecting raw values (1.583748ms)
ℹ tests 70
ℹ suites 0
ℹ pass 70
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1175.367138
```

### Command
```sh
npm run build
```
```text
[truncated]
rendering chunks...
computing gzip size...
dist/build-info.json                        0.08 kB │ gzip:   0.09 kB
dist/registerSW.js                          0.13 kB
dist/manifest.webmanifest                   0.50 kB
dist/index.html                             3.00 kB │ gzip:   1.09 kB
dist/assets/CourierApp-objfHoLw.css         2.49 kB │ gzip:   0.85 kB
dist/assets/MerchantApp-BTOjdwri.css       10.25 kB │ gzip:   2.57 kB
dist/assets/ShopFront-RYKMbjBy.css         10.40 kB │ gzip:   2.60 kB
dist/assets/AdminApp-EWhne2zZ.css          49.46 kB │ gzip:   9.88 kB
dist/assets/index-D9vuyBnO.css            267.74 kB │ gzip:  46.62 kB
dist/assets/operationsApi-DDPp_At5.js       0.08 kB │ gzip:   0.10 kB
dist/assets/orderDelivery-B7U2_fRO.js       0.49 kB │ gzip:   0.39 kB
dist/assets/DataStates-NquZb3F7.js          3.30 kB │ gzip:   1.63 kB
dist/assets/jsx-runtime-CU1iNrZ4.js         9.13 kB │ gzip:   3.53 kB
dist/assets/CourierApp-zWdjk_J7.js         11.81 kB │ gzip:   4.22 kB
dist/assets/KitchenDisplay-Dj3K6r3a.js     12.03 kB │ gzip:   4.46 kB
dist/assets/LocationModal-6njZkj1D.js      13.94 kB │ gzip:   4.30 kB
dist/assets/ShopFront-s1kRtPQy.js          39.32 kB │ gzip:  11.19 kB
dist/assets/MerchantApp-DdF23UDM.js        77.77 kB │ gzip:  19.48 kB
dist/assets/AdminApp-DHoQTW_y.js          283.34 kB │ gzip:  67.88 kB
dist/assets/index-DXWI1xJJ.js           1,133.80 kB │ gzip: 332.98 kB

[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/authenticatedApi.ts is dynamically imported by src/lib/firebase.ts but also statically imported by src/components/NotificationCenter.tsx, src/lib/adminApi.ts, src/lib/operationsApi.ts, src/shop/ShopFront.tsx, src/storefront/components/SangoubAuthModal.tsx, dynamic import will not move module into another chunk.

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/firebase.ts is dynamically imported by src/services/osmClient.ts but also statically imported by src/AdminApp.tsx, src/CourierApp.tsx, src/MerchantApp.tsx, src/components/AdminDashboard.tsx, src/components/CatalogManager.tsx, ..., dynamic import will not move module into another chunk.

✓ built in 2.63s

PWA v2.0.0
mode      generateSW
precache  26 entries (2664.66 KiB)
files generated
  dist/sw.js
  dist/workbox-95677aec.js
```

### T3 commit
SHA: 53c17c4863c3c4e26ea77d5df7214675543a1a33

```text
commit 53c17c4863c3c4e26ea77d5df7214675543a1a33
Author: Ahmed <tnestgpt01@gmail.com>
Date:   Wed Oct 28 20:08:39 2026 +0000

    feat(routing): use authenticated proxy and deviation-only planning

 docs/TRACKING_WORKLOG.md                       | 131 +++++++++++++++++++++++++
 src/services/osmClient.ts                      |  13 +++
 src/services/osmRouting.test.ts                |  86 ++++------------
 src/services/osmRouting.ts                     |  84 ++++++++--------
 src/storefront/components/ServiceAreaModal.tsx |  25 ++---
 5 files changed, 210 insertions(+), 129 deletions(-)
```

## T4 — PASS

CourierTracking is the only publishing seam. Shared source owns one foreground GPS watch/Wake Lock with reference count, each order owns unchanged filter, 10s heartbeat timer and scoped write. Tests cover two orders, independent stop, 2/5/10s retry, 3min rejection deadline and unacknowledged-write watchdog, visibility pause/reacquisition. D2 resolved by tracking-only setDoc with serverTimestamp; saveRecord unchanged. Cleanup active:false is best-effort; offline SDK writes may await reconnection and cannot guarantee delivery after logout/browser termination. No beforeunload or background claim.

### Command
```sh
npm run lint
```
```text

> react-example@0.0.0 lint
> tsc --noEmit

```

### Command
```sh
npm test
```
```text
[truncated]
✔ eligibility requires both authenticated assigned UID and with_courier (0.986505ms)
✔ two orders share one GPS and one Wake Lock but each filters/writes its own heartbeat and stops independently (4.541639ms)
✔ retry uses 2s/5s/10s backoff, survives transient failure, stops after three continuous failure minutes (4.224077ms)
✔ visibility stops foreground publishing and reacquires one watch/lock; no stale point republished before a fresh fix (1.859089ms)
✔ unacknowledged offline write cannot keep GPS or Wake Lock alive indefinitely (5.32041ms)
✔ checkout acknowledgment cannot erase quantities or new lines added during the request (2.690121ms)
✔ mixed breakfast retains sandwiches and meals in the WhatsApp request with exact quantities (2.217416ms)
✔ InstaPay is a requested payment method and never a paid confirmation (0.296512ms)
✔ incomplete customer details, invalid quantities and unknown menu items cannot produce a sendable request (0.928845ms)
✔ Arabic and Persian quantity digits are accepted while fractional quantities are rejected (0.525728ms)
✔ supermarket request combines packs from every section without breakfast items or payment claims (0.768302ms)
✔ campaign scheduling uses Cairo rather than the execution host timezone (20.220375ms)
✔ catalog monitoring counts delivered snapshots and excludes cancelled orders (1.707194ms)
✔ editing archived items cannot silently make them available (30.299312ms)
✔ catalog editor rejects invalid discounts, unsafe URLs and nonnumeric prices (1.171671ms)
✔ calculateCartSubtotal correctly sums prices with quantities and options (1.704596ms)
✔ applyCouponDiscount handles minOrder thresholds and discount calculation (0.368021ms)
✔ calculateOrderTotal applies discount, delivery fee, and tip properly (0.176783ms)
✔ getNextOrderStatus advances status correctly (0.288211ms)
✔ validateEmployeeProfile validates name, Egyptian phone, ministry and floor (0.473555ms)
✔ updateCourierMilestone updates checklist and advances to delivered when completed (0.554139ms)
✔ currency formatting preserves cents charged by the payment gateway (15.145497ms)
✔ calculateMerchantAccountingSummary accurately aggregates sales, payments, and platform commission (0.367454ms)
✔ generateMerchantJournalEntries creates balanced double-entry accounting records (0.880773ms)
✔ calculateTopSellingProducts ranks products correctly by volume and share (0.742415ms)
✔ calculateDistanceKm and rankCouriersForStore find closest courier and highlight fastest (0.97761ms)
✔ Flutter summary records preserve totals and normalize Firestore timestamps (4.728927ms)
✔ one kitchen cannot mark a multi-store order globally ready (0.785212ms)
✔ daily metrics use Cairo date and actual delivery time across midnight (27.561835ms)
✔ offers exclude invalid discounts, archived stock, and closed or missing stores (1.76312ms)
✔ price and store availability changes immediately update offer eligibility (0.319646ms)
✔ campaign tags and referrer domains classify sources without accepting spoofed hosts or collecting raw values (1.239873ms)
ℹ tests 75
ℹ suites 0
ℹ pass 75
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1111.914039
```

### Command
```sh
npm run build
```
```text
[truncated]
rendering chunks...
computing gzip size...
dist/build-info.json                        0.08 kB │ gzip:   0.09 kB
dist/registerSW.js                          0.13 kB
dist/manifest.webmanifest                   0.50 kB
dist/index.html                             3.00 kB │ gzip:   1.09 kB
dist/assets/CourierApp-objfHoLw.css         2.49 kB │ gzip:   0.85 kB
dist/assets/MerchantApp-BTOjdwri.css       10.25 kB │ gzip:   2.57 kB
dist/assets/ShopFront-RYKMbjBy.css         10.40 kB │ gzip:   2.60 kB
dist/assets/AdminApp-EWhne2zZ.css          49.46 kB │ gzip:   9.88 kB
dist/assets/index-D9vuyBnO.css            267.74 kB │ gzip:  46.62 kB
dist/assets/operationsApi-C3ySHP08.js       0.08 kB │ gzip:   0.10 kB
dist/assets/orderDelivery-BshlMgY8.js       0.49 kB │ gzip:   0.39 kB
dist/assets/DataStates-CsDeyFYb.js          3.30 kB │ gzip:   1.63 kB
dist/assets/jsx-runtime-CU1iNrZ4.js         9.13 kB │ gzip:   3.53 kB
dist/assets/KitchenDisplay-C6kO1zYy.js     12.03 kB │ gzip:   4.46 kB
dist/assets/LocationModal-6njZkj1D.js      13.94 kB │ gzip:   4.30 kB
dist/assets/CourierApp-DriMXmku.js         19.56 kB │ gzip:   6.99 kB
dist/assets/ShopFront-BYe1wWtU.js          39.32 kB │ gzip:  11.20 kB
dist/assets/MerchantApp-DYFCIMXG.js        77.77 kB │ gzip:  19.47 kB
dist/assets/AdminApp-Dgng8iFH.js          283.34 kB │ gzip:  67.88 kB
dist/assets/index-BaxGKTx9.js           1,140.88 kB │ gzip: 334.90 kB

[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/authenticatedApi.ts is dynamically imported by src/lib/firebase.ts but also statically imported by src/components/NotificationCenter.tsx, src/lib/adminApi.ts, src/lib/operationsApi.ts, src/shop/ShopFront.tsx, src/storefront/components/SangoubAuthModal.tsx, dynamic import will not move module into another chunk.

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/firebase.ts is dynamically imported by src/services/osmClient.ts but also statically imported by src/AdminApp.tsx, src/CourierApp.tsx, src/MerchantApp.tsx, src/components/AdminDashboard.tsx, src/components/CatalogManager.tsx, ..., dynamic import will not move module into another chunk.

✓ built in 2.97s

PWA v2.0.0
mode      generateSW
precache  26 entries (2679.14 KiB)
files generated
  dist/sw.js
  dist/workbox-95677aec.js
```

### T4 commit
SHA: f02ce4d9a9f39995a8c142d32805554a02bfa003

```text
commit f02ce4d9a9f39995a8c142d32805554a02bfa003
Author: Ahmed <tnestgpt01@gmail.com>
Date:   Wed Oct 28 20:14:09 2026 +0000

    feat(tracking): share foreground GPS across assigned courier orders

 docs/TRACKING_WORKLOG.md             | 129 +++++++++++++++++++++++++++++++++++
 package.json                         |   2 +-
 src/components/CourierTracking.tsx   |   7 +-
 src/services/sharedLocationSource.ts |  39 +++++++++++
 src/services/trackingSession.test.ts |  16 +++++
 src/services/trackingSession.ts      |  42 ++++++++++++
 src/services/useCourierTracking.ts   |  22 ++++++
 7 files changed, 254 insertions(+), 3 deletions(-)
```

## T5 — PASS

Read-only Leaflet map, collapsible inside existing CourierTracking seam; point updates animate without map rebuild, attribution visible, route ETA via T3, external Google link warns foreground tracking pauses. D1: no store coordinates in API, so no fabricated store marker. No Order props expansion. Isolated browser fixture at 320/390/1366 intercepts ALL external traffic; fixture imports no Firebase.

### Command
```sh
npm run lint
```
```text

> react-example@0.0.0 lint
> tsc --noEmit

```

### Command
```sh
npm test
```
```text
[truncated]
✔ eligibility requires both authenticated assigned UID and with_courier (1.599201ms)
✔ two orders share one GPS and one Wake Lock but each filters/writes its own heartbeat and stops independently (6.286042ms)
✔ retry uses 2s/5s/10s backoff, survives transient failure, stops after three continuous failure minutes (4.405788ms)
✔ visibility stops foreground publishing and reacquires one watch/lock; no stale point republished before a fresh fix (0.9257ms)
✔ unacknowledged offline write cannot keep GPS or Wake Lock alive indefinitely (0.944837ms)
✔ checkout acknowledgment cannot erase quantities or new lines added during the request (2.222861ms)
✔ mixed breakfast retains sandwiches and meals in the WhatsApp request with exact quantities (2.468093ms)
✔ InstaPay is a requested payment method and never a paid confirmation (0.310705ms)
✔ incomplete customer details, invalid quantities and unknown menu items cannot produce a sendable request (1.165029ms)
✔ Arabic and Persian quantity digits are accepted while fractional quantities are rejected (0.622561ms)
✔ supermarket request combines packs from every section without breakfast items or payment claims (0.584992ms)
✔ campaign scheduling uses Cairo rather than the execution host timezone (20.742374ms)
✔ catalog monitoring counts delivered snapshots and excludes cancelled orders (2.359132ms)
✔ editing archived items cannot silently make them available (31.754614ms)
✔ catalog editor rejects invalid discounts, unsafe URLs and nonnumeric prices (0.656112ms)
✔ calculateCartSubtotal correctly sums prices with quantities and options (1.100132ms)
✔ applyCouponDiscount handles minOrder thresholds and discount calculation (0.310789ms)
✔ calculateOrderTotal applies discount, delivery fee, and tip properly (0.294205ms)
✔ getNextOrderStatus advances status correctly (0.172909ms)
✔ validateEmployeeProfile validates name, Egyptian phone, ministry and floor (0.414783ms)
✔ updateCourierMilestone updates checklist and advances to delivered when completed (0.374559ms)
✔ currency formatting preserves cents charged by the payment gateway (23.234027ms)
✔ calculateMerchantAccountingSummary accurately aggregates sales, payments, and platform commission (0.842728ms)
✔ generateMerchantJournalEntries creates balanced double-entry accounting records (0.940167ms)
✔ calculateTopSellingProducts ranks products correctly by volume and share (0.914437ms)
✔ calculateDistanceKm and rankCouriersForStore find closest courier and highlight fastest (0.57963ms)
✔ Flutter summary records preserve totals and normalize Firestore timestamps (3.182308ms)
✔ one kitchen cannot mark a multi-store order globally ready (0.442633ms)
✔ daily metrics use Cairo date and actual delivery time across midnight (27.296766ms)
✔ offers exclude invalid discounts, archived stock, and closed or missing stores (2.604461ms)
✔ price and store availability changes immediately update offer eligibility (0.541644ms)
✔ campaign tags and referrer domains classify sources without accepting spoofed hosts or collecting raw values (1.056365ms)
ℹ tests 75
ℹ suites 0
ℹ pass 75
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1132.639115
```

### Command
```sh
npm run build
```
```text
[truncated]
rendering chunks...
computing gzip size...
dist/build-info.json                        0.08 kB │ gzip:   0.09 kB
dist/registerSW.js                          0.13 kB
dist/manifest.webmanifest                   0.50 kB
dist/index.html                             3.00 kB │ gzip:   1.09 kB
dist/assets/CourierApp-objfHoLw.css         2.49 kB │ gzip:   0.85 kB
dist/assets/MerchantApp-BTOjdwri.css       10.25 kB │ gzip:   2.57 kB
dist/assets/ShopFront-RYKMbjBy.css         10.40 kB │ gzip:   2.60 kB
dist/assets/AdminApp-EWhne2zZ.css          49.46 kB │ gzip:   9.88 kB
dist/assets/index-D9vuyBnO.css            267.74 kB │ gzip:  46.62 kB
dist/assets/operationsApi-0dfOpeB6.js       0.08 kB │ gzip:   0.10 kB
dist/assets/orderDelivery-BgpS2eXj.js       0.49 kB │ gzip:   0.39 kB
dist/assets/DataStates-BTg7AJSb.js          3.30 kB │ gzip:   1.62 kB
dist/assets/jsx-runtime-CU1iNrZ4.js         9.13 kB │ gzip:   3.53 kB
dist/assets/KitchenDisplay-BW47ovVS.js     12.03 kB │ gzip:   4.46 kB
dist/assets/LocationModal-6njZkj1D.js      13.94 kB │ gzip:   4.30 kB
dist/assets/CourierApp-HRkKRQ16.js         23.84 kB │ gzip:   8.65 kB
dist/assets/ShopFront-DJqTTlGd.js          39.32 kB │ gzip:  11.18 kB
dist/assets/MerchantApp-opJHxQVA.js        77.78 kB │ gzip:  19.48 kB
dist/assets/AdminApp-CptVnS6_.js          283.33 kB │ gzip:  67.88 kB
dist/assets/index-BRu4xsfG.js           1,144.48 kB │ gzip: 336.08 kB

[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/authenticatedApi.ts is dynamically imported by src/lib/firebase.ts but also statically imported by src/components/NotificationCenter.tsx, src/lib/adminApi.ts, src/lib/operationsApi.ts, src/shop/ShopFront.tsx, src/storefront/components/SangoubAuthModal.tsx, dynamic import will not move module into another chunk.

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/firebase.ts is dynamically imported by src/services/osmClient.ts but also statically imported by src/AdminApp.tsx, src/CourierApp.tsx, src/MerchantApp.tsx, src/components/AdminDashboard.tsx, src/components/CatalogManager.tsx, ..., dynamic import will not move module into another chunk.

✓ built in 2.63s

PWA v2.0.0
mode      generateSW
precache  26 entries (2686.84 KiB)
files generated
  dist/sw.js
  dist/workbox-95677aec.js
```

### Command
```sh
npm run test:tracking-map
```
```text

> react-example@0.0.0 test:tracking-map
> node tests/tracking-map.browser.mjs

PASS: isolated Leaflet fixture at 320/390/1366px; smooth marker update preserves map DOM, attribution visible, no horizontal overflow. External requests intercepted; no Firebase imported or contacted.
```

### T5 commit
SHA: 924b4e31ec86c2eed65fb82ef5c2b681f8305639

```text
commit 924b4e31ec86c2eed65fb82ef5c2b681f8305639
Author: Ahmed <tnestgpt01@gmail.com>
Date:   Wed Oct 28 20:18:08 2026 +0000

    feat(tracking): add compact courier route map and isolated map regression

 docs/TRACKING_WORKLOG.md           | 143 +++++++++++++++++++++++++++++++++++++
 package.json                       |   3 +-
 src/components/CourierTracking.tsx |  16 ++++-
 src/components/TrackingMap.tsx     |  30 ++++++++
 src/services/useOsmRoute.ts        |  10 +++
 tests/fixtures/tracking-map.html   |   1 +
 tests/fixtures/tracking-map.tsx    |   3 +
 tests/tracking-map.browser.mjs     |   9 +++
 8 files changed, 212 insertions(+), 3 deletions(-)
```

## T6 — PASS

Removed demo motion/fake store pin from legacy modal. Shared read-only viewer subscribes one document only while open/signed-in/with_courier, tears down on final states; smooth markers and T3 route/ETA. Tracks freshness by local arrival, not remote timestamp arithmetic; same revision metadata cannot reset freshness. D3 resolved with GPS-only receipt adapter, no payment/cart changes. D5: listener must observe inactive-to-active restart while with_courier; inactive is never presented as live. D6: legacy server status polling tracking read remains outside changed scope. Multi-store delivery geometry remains TODO.

### Command
```sh
npm run lint
```
```text

> react-example@0.0.0 lint
> tsc --noEmit

```

### Command
```sh
npm test
```
```text
[truncated]
✔ eligibility requires both authenticated assigned UID and with_courier (1.036896ms)
✔ two orders share one GPS and one Wake Lock but each filters/writes its own heartbeat and stops independently (7.266773ms)
✔ retry uses 2s/5s/10s backoff, survives transient failure, stops after three continuous failure minutes (5.44819ms)
✔ visibility stops foreground publishing and reacquires one watch/lock; no stale point republished before a fresh fix (0.94212ms)
✔ unacknowledged offline write cannot keep GPS or Wake Lock alive indefinitely (0.79995ms)
✔ checkout acknowledgment cannot erase quantities or new lines added during the request (2.107189ms)
✔ mixed breakfast retains sandwiches and meals in the WhatsApp request with exact quantities (1.725997ms)
✔ InstaPay is a requested payment method and never a paid confirmation (0.29299ms)
✔ incomplete customer details, invalid quantities and unknown menu items cannot produce a sendable request (0.817753ms)
✔ Arabic and Persian quantity digits are accepted while fractional quantities are rejected (0.519216ms)
✔ supermarket request combines packs from every section without breakfast items or payment claims (0.633958ms)
✔ campaign scheduling uses Cairo rather than the execution host timezone (19.707899ms)
✔ catalog monitoring counts delivered snapshots and excludes cancelled orders (1.536339ms)
✔ editing archived items cannot silently make them available (32.040976ms)
✔ catalog editor rejects invalid discounts, unsafe URLs and nonnumeric prices (0.579058ms)
✔ calculateCartSubtotal correctly sums prices with quantities and options (1.67258ms)
✔ applyCouponDiscount handles minOrder thresholds and discount calculation (0.673627ms)
✔ calculateOrderTotal applies discount, delivery fee, and tip properly (0.212465ms)
✔ getNextOrderStatus advances status correctly (0.191409ms)
✔ validateEmployeeProfile validates name, Egyptian phone, ministry and floor (0.52872ms)
✔ updateCourierMilestone updates checklist and advances to delivered when completed (0.439684ms)
✔ currency formatting preserves cents charged by the payment gateway (23.69113ms)
✔ calculateMerchantAccountingSummary accurately aggregates sales, payments, and platform commission (0.857508ms)
✔ generateMerchantJournalEntries creates balanced double-entry accounting records (1.099244ms)
✔ calculateTopSellingProducts ranks products correctly by volume and share (0.824043ms)
✔ calculateDistanceKm and rankCouriersForStore find closest courier and highlight fastest (0.570849ms)
✔ Flutter summary records preserve totals and normalize Firestore timestamps (1.997612ms)
✔ one kitchen cannot mark a multi-store order globally ready (0.577288ms)
✔ daily metrics use Cairo date and actual delivery time across midnight (15.757903ms)
✔ offers exclude invalid discounts, archived stock, and closed or missing stores (2.448611ms)
✔ price and store availability changes immediately update offer eligibility (0.511909ms)
✔ campaign tags and referrer domains classify sources without accepting spoofed hosts or collecting raw values (1.15881ms)
ℹ tests 77
ℹ suites 0
ℹ pass 77
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1157.312973
```

### Command
```sh
npm run build
```
```text
[truncated]
computing gzip size...
dist/build-info.json                         0.08 kB │ gzip:   0.09 kB
dist/registerSW.js                           0.13 kB
dist/manifest.webmanifest                    0.50 kB
dist/index.html                              3.24 kB │ gzip:   1.14 kB
dist/assets/CourierApp-objfHoLw.css          2.49 kB │ gzip:   0.85 kB
dist/assets/MerchantApp-BTOjdwri.css        10.25 kB │ gzip:   2.57 kB
dist/assets/ShopFront-RYKMbjBy.css          10.40 kB │ gzip:   2.60 kB
dist/assets/useOsmRoute-vh-t_kPv.css        15.09 kB │ gzip:   6.36 kB
dist/assets/AdminApp-EWhne2zZ.css           49.46 kB │ gzip:   9.88 kB
dist/assets/index-M54opMIk.css             252.64 kB │ gzip:  40.15 kB
dist/assets/operationsApi-BpSHorJf.js        0.09 kB │ gzip:   0.10 kB
dist/assets/adminPresentation-Bc0jKY_r.js    0.19 kB │ gzip:   0.17 kB
dist/assets/orderDelivery-B4ncxmW0.js        0.49 kB │ gzip:   0.39 kB
dist/assets/DataStates-BFfAd13a.js           3.33 kB │ gzip:   1.64 kB
dist/assets/jsx-runtime-CU1iNrZ4.js          9.13 kB │ gzip:   3.53 kB
dist/assets/KitchenDisplay-MsK58yJL.js      12.41 kB │ gzip:   4.62 kB
dist/assets/CourierApp-C60vcWPf.js          20.77 kB │ gzip:   7.48 kB
dist/assets/ShopFront-Bacp0U_D.js           38.51 kB │ gzip:  11.01 kB
dist/assets/MerchantApp-DiRZmv4U.js         77.94 kB │ gzip:  19.52 kB
dist/assets/useOsmRoute--PCjb_5C.js        158.17 kB │ gzip:  47.31 kB
dist/assets/AdminApp-Czk6H8I7.js           293.76 kB │ gzip:  71.19 kB
dist/assets/index-BU7Qkbur.js              370.63 kB │ gzip: 104.82 kB
dist/assets/firebase-CMsVUNFQ.js           604.78 kB │ gzip: 182.98 kB

[33m[INEFFECTIVE_DYNAMIC_IMPORT] [0msrc/lib/authenticatedApi.ts is dynamically imported by src/lib/firebase.ts but also statically imported by src/components/NotificationCenter.tsx, src/lib/adminApi.ts, src/lib/operationsApi.ts, src/shop/ShopFront.tsx, src/storefront/components/SangoubAuthModal.tsx, dynamic import will not move module into another chunk.

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.63s

PWA v2.0.0
mode      generateSW
precache  29 entries (2669.74 KiB)
files generated
  dist/sw.js
  dist/workbox-95677aec.js
```

### Command
```sh
npm run test:tracking-map
```
```text

> react-example@0.0.0 test:tracking-map
> node tests/tracking-map.browser.mjs

PASS: isolated Leaflet fixture at 320/390/1366px; smooth marker update preserves map DOM, attribution visible, no horizontal overflow. External requests intercepted; no Firebase imported or contacted.
```
