"use client";

const GUEST_OWNER_KEY = "perch_options_guest_owner_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Stable key for storing practice option rows (auth user id or anonymous browser id). */
export function getOptionsOwnerKey(userId: string | undefined | null): string {
  if (userId && userId.length > 0) return userId;
  if (!isBrowser()) return "guest:pending";
  try {
    let id = localStorage.getItem(GUEST_OWNER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_OWNER_KEY, id);
    }
    return `guest:${id}`;
  } catch {
    return "guest:anonymous";
  }
}
