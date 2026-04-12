import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES, OVER, PILL_H } from '../constants';
import type { TabKey } from '../types';

const hapticLight = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

const NAV_ITEMS: { image: any; label: string; key: TabKey }[] = [
  { image: IMAGES.home,    label: 'Home',    key: 'home'    },
  { image: IMAGES.tasks,   label: 'Habbits', key: 'tasks'   },
  { image: IMAGES.carrots, label: 'Finance', key: 'finance' },
  { image: IMAGES.bunny,   label: 'Profile', key: 'profile' },
];

export const BottomNav = ({ active, onPress }: { active: TabKey; onPress: (key: TabKey) => void }) => {
  const { bottom: SAFE } = useSafeAreaInsets();
  const activeIndex = NAV_ITEMS.findIndex(i => i.key === active);
  const slideAnim   = useRef(new Animated.Value(activeIndex)).current;
  const [pillWidth, setPillWidth] = useState(0);
  const BUBBLE = 48;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: activeIndex, useNativeDriver: true, tension: 180, friction: 20 }).start();
  }, [activeIndex]);

  const tabW   = pillWidth / 4;
  const bubbleX = slideAnim.interpolate({
    inputRange:  [0, 1, 2, 3],
    outputRange: pillWidth > 0 ? [0,1,2,3].map(i => tabW * i + tabW / 2 - BUBBLE / 2) : [0,0,0,0],
  });

  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: OVER + PILL_H + SAFE, paddingHorizontal: 16 }} pointerEvents="box-none">
      {pillWidth > 0 && (
        <Animated.View style={{ position: 'absolute', top: 0, left: 16, width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, backgroundColor: '#D4956A', justifyContent: 'center', alignItems: 'center', transform: [{ translateX: bubbleX }], shadowColor: '#D4956A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.55, shadowRadius: 12, elevation: 10, zIndex: 10 }}>
          <Image source={NAV_ITEMS[activeIndex].image} style={{ width: 26, height: 26 }} resizeMode="contain" />
        </Animated.View>
      )}
      <View
        onLayout={e => setPillWidth(e.nativeEvent.layout.width)}
        style={{ position: 'absolute', bottom: SAFE, left: 16, right: 16, height: PILL_H, flexDirection: 'row', backgroundColor: '#3B2220', borderRadius: 26, borderWidth: 1.5, borderColor: 'rgba(212,149,106,0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 12 }}>
        {NAV_ITEMS.map(({ image, label, key }) => {
          const isActive = active === key;
          return (
            <TouchableOpacity key={key} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7} onPress={() => { hapticLight(); onPress(key); }}>
              <View style={{ height: 22, justifyContent: 'center', alignItems: 'center' }}>
                {!isActive && <Image source={image} style={{ width: 20, height: 20, opacity: 0.4 }} resizeMode="contain" />}
              </View>
              <Text style={{ fontFamily: 'Jua', fontSize: 10, marginTop: 3, color: isActive ? '#D4956A' : 'rgba(232,213,192,0.4)' }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};