import { Capacitor } from '@capacitor/core';

export function supabaseAuthRedirectUrl(): string {
  return Capacitor.isNativePlatform()
    ? 'com.el7lm.sangoub://auth/callback'
    : window.location.origin;
}
