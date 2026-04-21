import { NativeModules } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.com.selrvk.habbit';

export type WidgetData = {
  name: string;
  completedCount: number;
  totalCount: number;
  spentToday: number;
  allocatedPerDay: number;
  currency: string;
  streak: number;
  upcomingHabbit?: string;
};

export const syncWidgetData = async (data: WidgetData) => {
  const payload = { upcomingHabbit: '', ...data };
  if (NativeModules.WidgetReloader?.setData) {
    NativeModules.WidgetReloader.setData(payload);
    return;
  }
  try {
    await SharedGroupPreferences.setItem(
      'widgetData',
      JSON.stringify(payload),
      APP_GROUP
    );
    NativeModules.WidgetReloader?.reloadAll?.();
  } catch {}
};
