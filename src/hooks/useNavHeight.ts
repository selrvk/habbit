import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OVER, PILL_H, NAV_BUFFER } from '../constants';

export const useNavHeight = () => {
  const insets = useSafeAreaInsets();
  return OVER + PILL_H + insets.bottom + NAV_BUFFER;
};