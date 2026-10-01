// src/utils/revenueCatIdentity.ts
//
// The coach backend verifies Pro by asking RevenueCat about the Supabase user id from the
// request's JWT. That only works if RevenueCat is logged in as that same id, so call this
// before anything that depends on it (launch, purchases, coach messages).

import Purchases from 'react-native-purchases';
import type { CustomerInfo } from 'react-native-purchases';
import { getUserId } from './supabaseAuth';

/**
 * Log RevenueCat into the current Supabase user id if it isn't already. RevenueCat carries
 * purchases over from the previous (anonymous) id. Returns fresh customer info when it
 * switched, or null when nothing changed.
 */
export const syncRevenueCatUser = async (): Promise<CustomerInfo | null> => {
  const userId = await getUserId();
  if ((await Purchases.getAppUserID()) === userId) return null;
  const { customerInfo } = await Purchases.logIn(userId);
  return customerInfo;
};
