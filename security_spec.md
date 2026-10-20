# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Any path not explicitly matched (`/users/{userId}`, `/orders/{orderId}`, `/admins/{adminId}`) is strictly denied for both read and write.
2. **PII Isolation (`/users/{userId}`)**: User profiles contain PII (`email`, `phone`, `ministry`, `floorNumber`, `roomNumber`). Read access (`get`, `list`) is strictly restricted to the document owner (`request.auth.uid == userId`) or a verified Admin (`isAdmin()`).
3. **Self-Assigned Privilege Prevention**: When creating a profile in `/users/{userId}`, non-admin users MUST set `role == 'employee'` and `walletBalance == 350`. Users cannot escalate their `role` or `walletBalance` on update.
4. **Order Ownership & Integrity (`/orders/{orderId}`)**: An order can only be created if `incoming().profileId == request.auth.uid` and `exists(/databases/$(database)/documents/users/$(request.auth.uid))`.
5. **Terminal State Locking**: Once an order reaches `orderStatus == 'delivered'` or `orderStatus == 'cancelled'`, non-admin users cannot update it.
6. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time`. `createdAt` and `profileId` are immutable on update.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Profile Read**: `auth = null` attempting `get /users/user_1`.
2. **Cross-User PII Leak**: `auth.uid = 'user_2'` attempting `get /users/user_1`.
3. **Unverified Email Write**: `auth.token.email_verified = false` attempting `create /users/user_1`.
4. **Role Escalation on Create**: `auth.uid = 'user_1'` creating `/users/user_1` with `role: 'admin'`.
5. **Shadow Field Injection on Profile**: Creating `/users/user_1` with extra key `isSuperAdmin: true`.
6. **Wallet Balance Tampering on Update**: Updating `/users/user_1` with `walletBalance: 999999`.
7. **ID Poisoning Attack**: Creating `/orders/invalid$id!@#` with invalid characters.
8. **Order Spoofing (`profileId` mismatch)**: `auth.uid = 'user_1'` creating `/orders/ord_1` with `profileId: 'user_2'`.
9. **Orphaned Order Creation**: `auth.uid = 'user_no_profile'` creating `/orders/ord_1` when `/users/user_no_profile` does not exist.
10. **Client Timestamp Forgery**: Creating `/orders/ord_1` with past timestamp instead of `request.time`.
11. **Terminal State Mutation**: Updating `/orders/ord_delivered` when `existing().orderStatus == 'delivered'`.
12. **Blanket Order List Scraping**: `auth.uid = 'user_2'` listing `/orders` without filtering `resource.data.profileId == request.auth.uid`.
