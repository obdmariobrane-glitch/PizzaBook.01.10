export const PRO_LIFETIME_PRODUCT_ID = 'pizzabook_pro_lifetime';

export type PlayPurchase = {
  productId: string;
  purchaseState: string;
  store: string;
  id?: string;
};

export function isConfirmedProPurchase(purchase: PlayPurchase): boolean {
  return purchase.productId === PRO_LIFETIME_PRODUCT_ID
    && purchase.purchaseState === 'purchased'
    && purchase.store === 'google';
}

export function isPurchaseCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code).toLowerCase() : '';
  return code === 'user-cancelled' || code === 'user_cancelled' || code === 'e_user_canceled';
}

export function isAlreadyOwnedError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return String(error.code).toLowerCase() === 'already-owned';
}

export async function acknowledgeAndGrantPro(
  purchase: PlayPurchase,
  acknowledge: (purchase: PlayPurchase) => Promise<void>,
  persistEntitlement: () => Promise<boolean>,
): Promise<boolean> {
  if (!isConfirmedProPurchase(purchase)) return false;
  await acknowledge(purchase);
  if (!await persistEntitlement()) {
    throw new Error('The confirmed purchase could not be saved on this device.');
  }
  return true;
}

export function createProPurchaseProcessor(
  acknowledge: (purchase: PlayPurchase) => Promise<void>,
  persistEntitlement: () => Promise<boolean>,
) {
  const completedIds = new Set<string>();
  const pendingById = new Map<string, Promise<boolean>>();

  return (purchase: PlayPurchase): Promise<boolean> => {
    if (!isConfirmedProPurchase(purchase)) return Promise.resolve(false);
    const id = purchase.id ?? purchase.productId;
    if (completedIds.has(id)) return Promise.resolve(true);
    const pending = pendingById.get(id);
    if (pending) return pending;

    const processing = acknowledgeAndGrantPro(purchase, acknowledge, persistEntitlement)
      .then((granted) => {
        if (granted) completedIds.add(id);
        return granted;
      })
      .finally(() => pendingById.delete(id));
    pendingById.set(id, processing);
    return processing;
  };
}

export async function restoreProEntitlement(
  purchases: PlayPurchase[],
  acknowledge: (purchase: PlayPurchase) => Promise<void>,
  persistEntitlement: () => Promise<boolean>,
  revokeEntitlement: () => Promise<boolean>,
): Promise<boolean> {
  const ownedPurchase = purchases.find(isConfirmedProPurchase);
  if (ownedPurchase) {
    return acknowledgeAndGrantPro(ownedPurchase, acknowledge, persistEntitlement);
  }
  if (!await revokeEntitlement()) {
    throw new Error('The previous purchase status could not be cleared.');
  }
  return false;
}

export function resolveExperienceLevel(
  storedLevel: 'beginner' | 'pro' | null | undefined,
  hasProEntitlement: boolean,
): 'beginner' | 'pro' | null | undefined {
  return storedLevel === 'pro' && !hasProEntitlement ? 'beginner' : storedLevel;
}
