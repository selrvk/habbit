import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { DAY_LABELS } from '../constants';

const hapticLight = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

export const DayPicker = ({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) => {
  const toggle = (d: number) => {
    hapticLight();
    if (days.length === 0) { onChange([0,1,2,3,4,5,6].filter(x => x !== d)); return; }
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
    onChange(next.length === 7 ? [] : next);
  };
  const isActive = (d: number) => days.length === 0 || days.includes(d);
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
      {DAY_LABELS.map((label, i) => (
        <TouchableOpacity key={i} onPress={() => toggle(i)} activeOpacity={0.7}
          style={{ flex: 1, paddingVertical: 5, borderRadius: 6, alignItems: 'center',
            backgroundColor: isActive(i) ? 'rgba(212,149,106,0.25)' : 'rgba(212,149,106,0.05)',
            borderWidth: 1, borderColor: isActive(i) ? '#D4956A' : 'rgba(212,149,106,0.15)' }}>
          <Text style={{ fontFamily: 'Jua', fontSize: 10, color: isActive(i) ? '#D4956A' : 'rgba(232,213,192,0.3)' }}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};