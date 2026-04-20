import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.com.selrvk.habbit';

export const syncWidgetData = async (data: {
  name: string;
  completedCount: number;
  totalCount: number;
  spentToday: number;
  allocatedPerDay: number;
  currency: string;
  streak: number;
}) => {
  try {
    await SharedGroupPreferences.setItem(
      'widgetData',
      JSON.stringify(data),
      APP_GROUP
    );
  } catch {}
};