export function getDemoVerificationStorageKey(userId: string) {
  return `genie-demo-verified:${userId}`;
}

export function isDemoVerified(userId: string | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false;
  return window.localStorage.getItem(getDemoVerificationStorageKey(userId)) === '1';
}

export function setDemoVerified(userId: string | undefined, value: boolean): void {
  if (!userId || typeof window === 'undefined') return;
  const key = getDemoVerificationStorageKey(userId);
  if (value) {
    window.localStorage.setItem(key, '1');
  } else {
    window.localStorage.removeItem(key);
  }
}
