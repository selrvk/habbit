// src/components/AchievementToast.tsx
//
// "Achievement unlocked" banner: drops in from the top with the user's avatar, stays a few
// seconds, then leaves. Tapping it opens the achievements list.

import React, { useEffect, useRef } from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { avatarImage } from '../helpers';
import { Icon } from './Icon';
import type { IconName } from '../icons';

export type ToastItem = { key: string; icon: IconName; title: string; subtitle: string; plural?: boolean };

const SHOW_MS = 3800;

export const AchievementToast = ({ item, avatar, onPress, onDone }: {
  item: ToastItem; avatar: string; onPress: () => void; onDone: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const slide  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slide.setValue(0);
    const anim = Animated.sequence([
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, tension: 90, friction: 10 }),
      Animated.delay(SHOW_MS),
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => { if (finished) onDone(); });
    return () => anim.stop();
  }, [item.key]);

  return (
    <Animated.View pointerEvents="box-none" style={{
      position: 'absolute', left: 12, right: 12, top: insets.top + 6, zIndex: 100,
      opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }],
    }}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => { onPress(); onDone(); }}
        accessibilityRole="button" accessibilityLabel={`${item.plural ? 'Achievements' : 'Achievement'} unlocked: ${item.title}. ${item.subtitle}`}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#5C3D2E', borderRadius: 18, padding: 12,
          borderWidth: 1.5, borderColor: '#D4956A', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(212,149,106,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={avatarImage(avatar)} style={{ width: 34, height: 34 }} resizeMode="contain" />
          <Icon name={item.icon} size={fs(24)} style={{ position: 'absolute', right: -8, bottom: -8 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: '#D4956A', letterSpacing: 1 }}>{item.plural ? 'ACHIEVEMENTS UNLOCKED' : 'ACHIEVEMENT UNLOCKED'}</Text>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: '#e8d5c0' }} numberOfLines={1}>{item.title}</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.6)' }} numberOfLines={1}>{item.subtitle}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
