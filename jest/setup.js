/* eslint-env jest */
// Stand-ins for the native modules the app talks to, so it can render under Jest.

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('react-native-haptic-feedback', () => {
  const haptics = { trigger: jest.fn() };
  return { __esModule: true, default: haptics, ...haptics };
});

jest.mock('@notifee/react-native', () => {
  const notifee = {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 0 })),
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 0 })),
    createChannel: jest.fn(async () => 'default'),
    createTriggerNotification: jest.fn(async () => 'id'),
    displayNotification: jest.fn(async () => 'id'),
    cancelNotification: jest.fn(async () => {}),
    cancelTriggerNotification: jest.fn(async () => {}),
    cancelTriggerNotifications: jest.fn(async () => {}),
    cancelAllNotifications: jest.fn(async () => {}),
    getTriggerNotificationIds: jest.fn(async () => []),
    getTriggerNotifications: jest.fn(async () => []),
    getInitialNotification: jest.fn(async () => null),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
    setBadgeCount: jest.fn(async () => {}),
    setNotificationCategories: jest.fn(async () => {}),
  };
  return {
    __esModule: true,
    default: notifee,
    EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
    TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
    RepeatFrequency: { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 },
    AndroidImportance: { DEFAULT: 3, HIGH: 4 },
    AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  };
});

jest.mock('react-native-purchases', () => {
  const customerInfo = { entitlements: { active: {}, all: {} }, activeSubscriptions: [], originalAppUserId: 'test' };
  const Purchases = {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    logIn: jest.fn(async () => ({ customerInfo, created: false })),
    getAppUserID: jest.fn(async () => 'test'),
    getCustomerInfo: jest.fn(async () => customerInfo),
    getOfferings: jest.fn(async () => ({ current: null, all: {} })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(async () => customerInfo),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    showManageSubscriptions: jest.fn(async () => {}),
  };
  return { __esModule: true, default: Purchases, LOG_LEVEL: { DEBUG: 'DEBUG', ERROR: 'ERROR' }, PURCHASES_ERROR_CODE: {} };
});

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
  ACCESSIBLE: { AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock', AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly' },
}));

jest.mock('react-native-shared-group-preferences', () => ({
  __esModule: true,
  default: { setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null) },
}));
