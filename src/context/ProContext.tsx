// src/context/ProContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';

const PRO_ENTITLEMENT = 'pro_access'; 

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

      Purchases.getOfferings().then(offerings => {
        const packages = offerings.current?.availablePackages ?? [];
        console.log('Current offering:', offerings.current?.identifier);
          packages.forEach(pkg => {
            console.log('Package:', pkg.identifier, '| Type:', pkg.packageType, '| Price:', pkg.product.priceString);
          });
        packages.forEach(pkg => {
          // RevenueCat identifies these by packageType
          if (pkg.packageType === 'MONTHLY') setMonthlyPrice(pkg.product.priceString);
          if (pkg.packageType === 'ANNUAL')  setYearlyPrice(pkg.product.priceString);
        });
      }).catch(() => {});

    Purchases.addCustomerInfoUpdateListener(checkStatus);
  }, []);

  const restorePurchases = async () => {
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