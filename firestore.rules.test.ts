/**
 * Firestore Security Rules Test Suite (Dirty Dozen Verification)
 * Verifies all 12 adversarial payloads in security_spec.md are rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Profile Read',
    operation: 'get',
    path: '/users/user_1',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-User PII Leak',
    operation: 'get',
    path: '/users/user_1',
    auth: { uid: 'user_2', email: 'u2@gov.eg', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/user_1',
    auth: { uid: 'user_1', email: 'u1@gov.eg', email_verified: false },
    payload: { uid: 'user_1', role: 'employee' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Role Escalation on Create',
    operation: 'create',
    path: '/users/user_1',
    auth: { uid: 'user_1', email: 'u1@gov.eg', email_verified: true },
    payload: { uid: 'user_1', role: 'admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection on Profile',
    operation: 'create',
    path: '/users/user_1',
    auth: { uid: 'user_1', email: 'u1@gov.eg', email_verified: true },
    payload: { uid: 'user_1', role: 'employee', isSuperAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Wallet Balance Tampering on Update',
    operation: 'update',
    path: '/users/user_1',
    auth: { uid: 'user_1', email: 'u1@gov.eg', email_verified: true },
    payload: { walletBalance: 999999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'ID Poisoning Attack',
    operation: 'create',
    path: '/orders/invalid$id!@#',
    auth: { uid: 'user_1', email: 'u1@gov.eg', email_verified: true },
    payload: { profileId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Order Spoofing (profileId mismatch)',
    operation: 'create',
    path: '/orders/ord_1',
    auth: { uid: 'user_1', email: 'u1@gov.eg', email_verified: true },
    payload: { profileId: 'user_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned Order Creation without User Profile',
    operation: 'create',
    path: '/orders/ord_1',
    auth: { uid: 'user_no_profile', email: 'u@gov.eg', email_verified: true },
    payload: { profileId: 'user_no_profile' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/orders/ord_1',
    auth: { uid: 'user_1', email: 'u1@gov.eg', email_verified: true },
    payload: { profileId: 'user_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Mutation on Delivered Order',
    operation: 'update',
    path: '/orders/ord_delivered',
    auth: { uid: 'user_1', email: 'u1@gov.eg', email_verified: true },
    payload: { orderStatus: 'preparing' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket Order List Scraping',
    operation: 'list',
    path: '/orders',
    auth: { uid: 'user_2', email: 'u2@gov.eg', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
