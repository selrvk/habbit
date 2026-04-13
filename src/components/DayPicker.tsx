// src/components/DayPicker.tsx

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { DAY_LABELS } from '../constants';

const hapticLight = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

export const DayPicker = ({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) => {
  const isEveryDay = days.length === 0;

  const handleEveryDay = () => {
    hapticLight();
    onChange([]);
  };

  const toggleDay = (d: number) => {
    hapticLight();
    if (isEveryDay) {
      // Switching from Every day → tap a single day = start specific mode with just that day
      onChange([d]);
      return;
    }
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
    // All 7 ticked or none left → collapse back to Every day
    onChange(next.length === 0 || next.length === 7 ? [] : next);
  };

  return (
    <View style={{ gap: 8, marginTop: 8 }}>

      {/* Every day pill */}
      <TouchableOpacity onPress={handleEveryDay} activeOpacity={0.7}
        style={{ paddingVertical: 7, borderRadius: 8, alignItems: 'center',
          backgroundColor: isEveryDay ? 'rgba(212,149,106,0.25)' : 'rgba(212,149,106,0.05)',
          borderWidth: 1, borderColor: isEveryDay ? '#D4956A' : 'rgba(212,149,106,0.15)' }}>
        <Text style={{ fontFamily: 'Jua', fontSize: 12, color: isEveryDay ? '#D4956A' : 'rgba(232,213,192,0.3)' }}>
          Every day
        </Text>
      </TouchableOpacity>

      {/* Individual day pills */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {DAY_LABELS.map((label, i) => {
          const active = !isEveryDay && days.includes(i);
          return (
            <TouchableOpacity key={i} onPress={() => toggleDay(i)} activeOpacity={0.7}
              style={{ flex: 1, paddingVertical: 5, borderRadius: 6, alignItems: 'center',
                backgroundColor: active ? 'rgba(212,149,106,0.25)' : 'rgba(212,149,106,0.05)',
                borderWidth: 1, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.15)' }}>
              <Text style={{ fontFamily: 'Jua', fontSize: 10, color: active ? '#D4956A' : 'rgba(232,213,192,0.3)' }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

    </View>
  );
};