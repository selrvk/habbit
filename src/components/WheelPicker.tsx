// src/components/WheelPicker.tsx
//
// iOS-style scroll wheel built on ScrollView snapping, so no extra native dependency.

import React, { useRef } from 'react';
import { View, Text, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const ITEM_H  = 44;
const VISIBLE = 5; // odd, so one row sits in the middle

const tick = () => ReactNativeHapticFeedback.trigger('selection', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });

export const WheelPicker = ({ items, index, onChange, width = 72 }: {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  width?: number;
}) => {
  const lastIndex = useRef(index);

  const indexAt = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = indexAt(e);
    if (i !== lastIndex.current) { lastIndex.current = i; tick(); }
  };

  const handleSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => onChange(indexAt(e));

  return (
    <View style={{ width, height: ITEM_H * VISIBLE }}>
      {/* Selection band */}
      <View pointerEvents="none" style={{
        position: 'absolute', left: 0, right: 0, top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H,
        borderRadius: 12, backgroundColor: 'rgba(212,149,106,0.14)',
      }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ITEM_H }}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={e => { if (!e.nativeEvent.velocity?.y) handleSettle(e); }}
      >
        {items.map((label, i) => (
          <View key={label + i} style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: 22, color: '#e8d5c0' }}>{label}</Text>
          </View>
        ))}
      </ScrollView>
      {/* Dim the rows above and below the selection */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * Math.floor(VISIBLE / 2), backgroundColor: 'rgba(59,34,32,0.65)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * Math.floor(VISIBLE / 2), backgroundColor: 'rgba(59,34,32,0.65)' }} />
    </View>
  );
};
