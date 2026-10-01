// src/components/DayPicker.tsx

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { DAY_LABELS } from '../constants';
import { useFontSize } from '../hooks/useFontSize';

const hapticLight = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

// `days: []` means every day (the stored convention).
const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: [] },
  { label: 'Weekdays',  days: [1, 2, 3, 4, 5] },
  { label: 'Weekends',  days: [0, 6] },
];

const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((d, i) => d === [...b].sort()[i]);

export const DayPicker = ({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) => {
  const fs = useFontSize();
  const isEveryDay = days.length === 0;

  const toggleDay = (d: number) => {
    hapticLight();
    const current = isEveryDay ? [0, 1, 2, 3, 4, 5, 6] : days;
    const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
    // Can't schedule on no days; all 7 is stored as "every day"
    if (next.length === 0) return;
    onChange(next.length === 7 ? [] : next);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {PRESETS.map(p => {
          const active = sameDays(days, p.days);
          return (
            <TouchableOpacity key={p.label} onPress={() => { hapticLight(); onChange(p.days); }} activeOpacity={0.7}
              style={{
                paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99,
                backgroundColor: active ? '#D4956A' : 'rgba(212,149,106,0.1)',
                borderWidth: 1, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.25)',
              }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: active ? '#fff' : 'rgba(232,213,192,0.6)' }}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {DAY_LABELS.map((label, i) => {
          const active = isEveryDay || days.includes(i);
          return (
            <TouchableOpacity key={i} onPress={() => toggleDay(i)} activeOpacity={0.7}
              accessibilityRole="checkbox" accessibilityState={{ checked: active }}
              accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
              style={{
                width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
                backgroundColor: active ? 'rgba(212,149,106,0.28)' : 'rgba(212,149,106,0.05)',
                borderWidth: 1.5, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.15)',
              }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: active ? '#e8d5c0' : 'rgba(232,213,192,0.3)' }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
