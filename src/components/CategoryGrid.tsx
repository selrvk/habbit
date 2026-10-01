// src/components/CategoryGrid.tsx
//
// The spending categories as a 4-column grid of tappable tiles.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { CATEGORIES } from '../categories';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

/** Tapping the selected tile again clears it (onChange(undefined)). */
export const CategoryGrid = ({ value, onChange }: { value?: string; onChange: (key: string | undefined) => void }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
    {CATEGORIES.map(c => {
      const active = c.key === value;
      return (
        <TouchableOpacity key={c.key} onPress={() => { haptic(); onChange(active ? undefined : c.key); }} activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={c.label} accessibilityState={{ selected: active }}
          style={{
            width: '23%', paddingVertical: 8, borderRadius: 12, alignItems: 'center',
            backgroundColor: active ? '#D4956A' : 'rgba(212,149,106,0.1)',
            borderWidth: 1, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.2)',
          }}>
          <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: 10, marginTop: 2, color: active ? '#fff' : 'rgba(232,213,192,0.7)' }}>{c.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);
