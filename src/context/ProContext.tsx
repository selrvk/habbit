// src/context/ProContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';
import { syncRevenueCatUser } from '../utils/revenueCatIdentity';

const PRO_ENTITLEMENT = 'Habbit: Habits & Finance Pro'; 

interface ProContextValue {
  isPro: boolean;
  isLoading: boolean;
  monthlyPrice: string | null;
  yearlyPrice: string | null;   // ← add
  restorePurchases: () => Promise<void>;
  purchasePro: (period: 'monthly' | 'yearly') => Promise<void>; 
}


const ProContext = createContext<ProContextValue>({
  isPro: false,
  isLoading: true,
  monthlyPrice: null,
  yearlyPrice: null,  // ← add
  restorePurchases: async () => {},
  purchasePro: async () => {},
});

export const ProProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [monthlyPrice, setMonthlyPrice] = useState<string | null>(null);
  const [yearlyPrice, setYearlyPrice]   = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkStatus = async (info?: CustomerInfo) => {
    const customerInfo = info ?? await Purchases.getCustomerInfo();
    setIsPro(customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined);
  };

  useEffect(() => {
    
    const apiKey = Platform.OS === 'ios'
      ? 'appl_kLbJHNICCtDtjbrmDlVliWUNwKX'
      : 'your_android_key';   

    Purchases.configure({
      apiKey
    });
    checkStatus().finally(() => setIsLoading(false));

    // Use the Supabase user id as the RevenueCat app user id, so the coach backend can
    // verify Pro for the signed-in user. RevenueCat carries existing purchases over from
    // the anonymous id. Offline? Skip; it retries on the next launch.
    syncRevenueCatUser()
      .then(info => { if (info) return checkStatus(info); })
      .catch(() => {});

      Purchases.getOfferings().then(offerings => {
        const packages = offerings.current?.availablePackages ?? [];
        packages.forEach(pkg => {
          // RevenueCat identifies these by packageType
          if (pkg.packageType === 'MONTHLY') setMonthlyPrice(pkg.product.priceString);
          if (pkg.packageType === 'ANNUAL')  setYearlyPrice(pkg.product.priceString);
        });
      }).catch(() => {});

    Purchases.addCustomerInfoUpdateListener(checkStatus);
    return () => { Purchases.removeCustomerInfoUpdateListener(checkStatus); };
  }, []);

  const restorePurchases = async () => {
    // Link first so restored purchases land on the account the coach checks. Let errors
    // surface: restoring onto the wrong customer would look like success but fix nothing.
    await syncRevenueCatUser();
    const customerInfo = await Purchases.restorePurchases();
    await checkStatus(customerInfo);
    };

    const purchasePro = async (period: 'monthly' | 'yearly') => {
      const offerings = await Purchases.getOfferings();
      const packages  = offerings.current?.availablePackages ?? [];
      const pkg = packages.find(p =>
        period === 'monthly' ? p.packageType === 'MONTHLY' : p.packageType === 'ANNUAL'
      );
      if (!pkg) throw new Error('Package not found');
      // Make sure the purchase lands on the customer the coach backend checks.
      await syncRevenueCatUser().catch(() => null);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      await checkStatus(customerInfo);
    };


  return (
    <ProContext.Provider value={{ isPro, isLoading, monthlyPrice, yearlyPrice, restorePurchases, purchasePro }}>
      {children}
    </ProContext.Provider>
  );
};

export const useProStatus = () => useContext(ProContext);