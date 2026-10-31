import { storage } from './utils/storage';
import { FREE_LAUNCH_MODE } from './freeLaunch';

const PRO_ENTITLEMENT_KEY = 'pizzabookProLifetimeEntitlement';
let cachedEntitlement: boolean | undefined;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function hasProEntitlement(): boolean {
  return cachedEntitlement === true;
}

export function hasProAccess(): boolean {
  return FREE_LAUNCH_MODE || hasProEntitlement();
}

export function isProEntitlementLoaded(): boolean {
  return cachedEntitlement !== undefined;
}

export function subscribeProEntitlement(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadProEntitlement(): Promise<boolean> {
  const stored = await storage.secureGet<boolean>(PRO_ENTITLEMENT_KEY, false);
  cachedEntitlement = stored === true;
  notifyListeners();
  return cachedEntitlement;
}

export async function grantProEntitlement(): Promise<boolean> {
  const saved = await storage.secureSet(PRO_ENTITLEMENT_KEY, true);
  if (!saved) return false;
  cachedEntitlement = true;
  notifyListeners();
  return true;
}

export async function revokeProEntitlement(): Promise<boolean> {
  const removed = await storage.secureRemove(PRO_ENTITLEMENT_KEY);
  if (!removed) return false;
  cachedEntitlement = false;
  notifyListeners();
  return true;
}
