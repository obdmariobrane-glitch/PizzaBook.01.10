import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { FREE_LAUNCH_MODE } from '../freeLaunch';
import {
  finishTransaction,
  getAvailablePurchases,
  isUserCancelledError,
  restorePurchases as restoreStorePurchases,
  useIAP,
  type Product,
  type Purchase,
} from 'expo-iap';

import { setExperienceLevel } from '../experienceLevel';
import {
  grantProEntitlement,
  hasProEntitlement,
  revokeProEntitlement,
  subscribeProEntitlement,
} from '../proEntitlement';
import {
  createProPurchaseProcessor,
  isAlreadyOwnedError,
  isConfirmedProPurchase,
  isPurchaseCancelled,
  PRO_LIFETIME_PRODUCT_ID,
  restoreProEntitlement,
  type PlayPurchase,
} from '../proBillingCore';

type BillingStatus = 'idle' | 'pending' | 'error' | 'restored' | 'not-owned' | 'already-owned';
type BillingContextValue = {
  connected: boolean;
  product: Product | null;
  status: BillingStatus;
  entitled: boolean;
  busy: boolean;
  refreshStore: () => Promise<void>;
  purchasePro: () => Promise<void>;
  restorePro: () => Promise<void>;
  clearStatus: () => void;
};

const unavailableValue: BillingContextValue = {
  connected: false,
  product: null,
  status: 'idle',
  entitled: false,
  busy: false,
  refreshStore: async () => {},
  purchasePro: async () => {},
  restorePro: async () => {},
  clearStatus: () => {},
};
const freeLaunchValue: BillingContextValue = {
  ...unavailableValue,
  entitled: true,
};
const BillingContext = createContext<BillingContextValue>(unavailableValue);

export function ProBillingProvider({ children }: { children: React.ReactNode }) {
  if (FREE_LAUNCH_MODE) {
    return <BillingContext.Provider value={freeLaunchValue}>{children}</BillingContext.Provider>;
  }
  if (Platform.OS !== 'android') {
    return <BillingContext.Provider value={unavailableValue}>{children}</BillingContext.Provider>;
  }
  return <AndroidProBillingProvider>{children}</AndroidProBillingProvider>;
}

function AndroidProBillingProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BillingStatus>('idle');
  const [busy, setBusy] = useState(false);
  const entitled = useSyncExternalStore(subscribeProEntitlement, hasProEntitlement, hasProEntitlement);
  const startupQueryStarted = useRef(false);
  const processPurchase = useMemo(() => createProPurchaseProcessor(
    async (purchase) => {
      await finishTransaction({ purchase: purchase as Purchase, isConsumable: false });
    },
    grantProEntitlement,
  ), []);

  const handleConfirmedPurchase = useCallback(async (purchase: Purchase) => {
    if (!isConfirmedProPurchase(purchase as PlayPurchase)) return false;
    setBusy(true);
    try {
      const granted = await processPurchase(purchase as PlayPurchase);
      if (granted) {
        setStatus('idle');
        await setExperienceLevel('pro');
      }
      return granted;
    } finally {
      setBusy(false);
    }
  }, [processPurchase]);

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    reconnect,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      if (purchase.purchaseState !== 'purchased') {
        setStatus('pending');
        return;
      }
      void handleConfirmedPurchase(purchase).catch((error: unknown) => {
        console.error('Unable to acknowledge the Google Play purchase:', error);
        setStatus('error');
      });
    },
    onPurchaseError: (error) => {
      if (isUserCancelledError(error) || isPurchaseCancelled(error)) {
        setStatus('idle');
        setBusy(false);
        return;
      }
      console.error('Google Play purchase failed:', error);
      setStatus(isAlreadyOwnedError(error) ? 'already-owned' : 'error');
      setBusy(false);
    },
    onError: (error) => {
      console.error('Google Play Billing operation failed:', error);
      setStatus('error');
    },
  });

  const reconcilePurchases = useCallback(async (purchases: Purchase[], showResult = true) => {
    const restored = await restoreProEntitlement(
      purchases as PlayPurchase[],
      async (purchase) => {
        await finishTransaction({ purchase: purchase as Purchase, isConsumable: false });
      },
      grantProEntitlement,
      revokeProEntitlement,
    );
    if (restored) {
      if (showResult) setStatus('restored');
      await setExperienceLevel('pro');
    } else {
      if (showResult) setStatus('not-owned');
      await setExperienceLevel('beginner');
    }
    return restored;
  }, []);

  useEffect(() => {
    if (!connected) return;
    void fetchProducts({ skus: [PRO_LIFETIME_PRODUCT_ID], type: 'in-app' }).catch((error: unknown) => {
      console.error('Unable to load the Google Play PRO product:', error);
      setStatus('error');
    });
  }, [connected, fetchProducts]);

  useEffect(() => {
    if (!connected || startupQueryStarted.current) return;
    startupQueryStarted.current = true;
    void getAvailablePurchases()
      .then((purchases) => reconcilePurchases(purchases, false))
      .catch((error: unknown) => {
        startupQueryStarted.current = false;
        console.error('Unable to check Google Play ownership; retaining the saved offline entitlement:', error);
        setStatus('error');
      });
  }, [connected, reconcilePurchases]);

  const refreshStore = useCallback(async () => {
    setStatus('idle');
    try {
      if (!connected) {
        const reconnected = await reconnect();
        if (!reconnected) {
          setStatus('error');
          return;
        }
      }
      await fetchProducts({ skus: [PRO_LIFETIME_PRODUCT_ID], type: 'in-app' });
    } catch (error) {
      console.error('Unable to refresh the Google Play PRO product:', error);
      setStatus('error');
    }
  }, [connected, fetchProducts, reconnect]);

  const purchasePro = useCallback(async () => {
    setStatus('idle');
    setBusy(true);
    try {
      if (!connected) {
        const reconnected = await reconnect();
        if (!reconnected) throw new Error('Google Play Billing is unavailable.');
      }
      await requestPurchase({
        request: {
          apple: { sku: PRO_LIFETIME_PRODUCT_ID },
          google: { skus: [PRO_LIFETIME_PRODUCT_ID] },
        },
        type: 'in-app',
      });
    } catch (error) {
      if (isUserCancelledError(error) || isPurchaseCancelled(error)) {
        setStatus('idle');
      } else if (isAlreadyOwnedError(error)) {
        setStatus('already-owned');
      } else {
        console.error('Unable to start the Google Play purchase:', error);
        setStatus('error');
      }
      setBusy(false);
    }
  }, [connected, reconnect, requestPurchase]);

  const restorePro = useCallback(async () => {
    setBusy(true);
    setStatus('idle');
    try {
      if (!connected) {
        const reconnected = await reconnect();
        if (!reconnected) throw new Error('Google Play Billing is unavailable.');
      }
      await restoreStorePurchases();
      const purchases = await getAvailablePurchases();
      await reconcilePurchases(purchases);
    } catch (error) {
      console.error('Unable to restore Google Play purchases:', error);
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }, [connected, reconnect, reconcilePurchases]);

  const value = useMemo<BillingContextValue>(() => ({
    connected,
    product: products.find((item) => item.id === PRO_LIFETIME_PRODUCT_ID) ?? null,
    status,
    entitled,
    busy,
    refreshStore,
    purchasePro,
    restorePro,
    clearStatus: () => setStatus('idle'),
  }), [connected, products, status, entitled, busy, refreshStore, purchasePro, restorePro]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useProBilling(): BillingContextValue {
  return useContext(BillingContext);
}
