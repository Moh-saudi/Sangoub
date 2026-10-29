# Tracking rules: dependency reads and cost review

## Evidence and status

Static analysis of the unchanged rules: `firestore.rules:4-21`, tracking block `:115-124`. Contract tests: `tests/firestore.security.test.ts` (tracking contract and reassignment tests). Emulator execution is **NOT RUN / BLOCKED**: two startup attempts (T0 and T9) failed downloading the official Firestore jar before tests ran. No rule change or deploy was made; no test-discovered rule defect is claimed.

Required official references:
- https://firebase.google.com/docs/firestore/pricing#cloud_firestore_security_rules — dependent reads and listeners.
- https://firebase.google.com/docs/firestore/security/rules-conditions#access_calls_and_pricing — access calls/cache/charging.
- https://firebase.google.com/docs/firestore/query-data/listen#detach_a_listener — listener cleanup.

Reference retrieval from this execution environment returned HTTP403 for Firebase pricing and the Cloud documentation rules page. **NOT VERIFIED live documentation text or prices**; no quotation is fabricated. The table below is a count of distinct code-level document dependencies under the requested one-document-once counting model, not a measured bill or claim about undocumented cross-request caching. Review the current linked billing policy before budgeting.

## Successful request paths, distinct dependent documents

| Operation | Source document access | Distinct dependencies | Primary operation |
|---|---|---:|---|
| Assigned verified courier writes a location | `orders/{orderId}` in tracking allow clause; `accountAccess/{courierUid}` in verified; `staff/{courierUid}` via exists/staff | 3 | 1 tracking document write |
| Verified owning customer reads/listens | parent order; own accountAccess; profileId matches and short-circuits remaining ownerOrder branches | 2 | tracking document read/update delivery |
| Verified admin who is not customer reads/listens | parent order; own accountAccess; admins/{adminUid}; no staff lookup needed when admin branch succeeds | 3 | tracking document read/update delivery |
| Assigned courier reads (not admin/customer) | parent order; own accountAccess; admins lookup (false); staff lookup | 4 | tracking document read/update delivery |

`exists(accountAccess)` plus repeated get(accountAccess) is one distinct path, even when absent. `exists(staff)` plus get(staff) is one path. Repeated parent-order get in the write expression is one path. These counts are for the described successful branches; rejected/short-circuited requests may execute different accesses and can still incur dependent-read charges. The table does not claim that a missing dependency costs zero or that requests are free when denied.

## Listeners are not a one-time cost

The reference pricing model bills rule-dependent reads when rules must be evaluated for a request/query/listener, including updated listener results, reconnection and relevant rule/dependency changes. It is not safe to budget dependent lookups only on first subscribe. Deduplication within one evaluation is not a promise of free dependencies across many snapshots, requests or listeners. Exact reconnect/offline persistence behavior must be checked against the current pricing reference (retrieval blocked here).

Animation frames and local freshness timer ticks do not themselves request Firestore data. A heartbeat is a real new write and can update each authorized listener. Two orders share one browser location watch, but publish to two different tracking documents: this reduces device resources, not the number of per-order writes or security evaluations.

The new supervisor uses per-active-order document listeners, bounded at50, and preserves subscriptions for unchanged IDs. This avoids a blanket tracking collection query and its broad historical reads; each individual listener still has its own rule evaluations. Customer viewer stops at terminal states or unmount/auth change. D5: while with_courier, an inactive document remains observed to detect a real start/resume, but is never displayed as live. A blanket list can have additional dynamic parent dependencies and evaluation limits; no successful broad-query proof was executed here.

## Traffic formula, not invented currency estimates

For N simultaneous active orders: accepted motion writes + permitted stationary heartbeats + cleanup attempts, per order. Retry attempts and listener reconnection can add operations. A moving courier meeting filter thresholds may write at the10s minimum interval; stationary heartbeat interval is60s while the filter considers GPS usable (`src/services/locationTrackingFilter.ts:43-55`). Do not derive a fixed journeys-per-day allowance from this without measured trip duration, active-order count, retries, listeners and current Firebase plan.

Existing receipt status API still reads tracking separately (`server/handlers/orders.ts:63`), while its new map observes the document. This legacy duplicate server read is outside the permitted API scope and remains TODO; it must be included in measurements.

## Proposed cost reductions — NOT implemented

1. Move stable role checks into audited custom claims only after designing revocation semantics; do not trade away disabled/revoked account checks for fewer reads.
2. Dedicated tracking access projections/authorization documents could reduce parent dependencies, but need atomic maintenance, migration and threat tests.
3. Server-side assignment/terminal cleanup can avoid stale tracking flags after abrupt page termination. Do not add fields to the current tracking payload without a reviewed schema change.
4. Reuse subscriptions by active order, tune filter intervals with field measurements, remove the duplicate legacy status-API tracking read in a separately authorized change.
5. Verify usage/budget alerts on an isolated Staging project before any Blaze decision. No billing plan was changed.

## Known protocol limitations for review

- Existing rule allows active:false outside with_courier for assigned-courier cleanup. Tests explicitly cover this exception (D4); active:true is rejected outside that state.
- Three allowed fields cannot identify which courier produced an old existing tracking document after reassignment. Sender permission changes prevent the old courier from writing/reading again, but do not automatically clear an old point. Backend reassignment cleanup or a reviewed protocol change is a TODO; no additional order/tracking fields were invented.
- Firestore client offline writes/cleanup are best-effort and may await reconnection. Local three-minute watchdog releases GPS/Wake Lock; it does not prove a cleanup was delivered after logout, network loss, force-kill or operating-system suspension.
