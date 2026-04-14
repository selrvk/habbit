// src/components/BottomNav.tsx

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES, OVER, PILL_H, PEEK_IMAGES } from '../constants';
import type { TabKey } from '../types';

const hapticLight = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

const NAV_ITEMS: { image: any; label: string; key: TabKey }[] = [
  { image: IMAGES.home,    label: 'Home',    key: 'home'    },
  { image: IMAGES.tasks,   label: 'Habbits', key: 'tasks'   },
  { image: IMAGES.carrots, label: 'Finance', key: 'finance' },
  { image: IMAGES.chat,    label: 'Chat',    key: 'chat'    },
  { image: IMAGES.bunny,   label: 'Profile', key: 'profile' },
];

const BUNNY_W  = 52;   // bunny width
const BUNNY_H  = 52;   // bunny height
const PEEK_Y   = 0;    // fully visible (top of container)
const HIDE_Y   = BUNNY_H - 10; // fully hidden below pill top

export const BottomNav = ({ active, onPress, avatar }: { active: TabKey; onPress: (key: TabKey) => void; avatar: string; }) => {
  const peekImage = PEEK_IMAGES[avatar as keyof typeof PEEK_IMAGES] ?? PEEK_IMAGES.avatar_bunny;
  const { bottom: SAFE } = useSafeAreaInsets();
  const activeIndex = Math.max(NAV_ITEMS.findIndex(i => i.key === active), 0);

  const [pillWidth, setPillWidth] = useState(0);

  // Horizontal slide for bunny + highlight
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  // Vertical for peek animation
  const peekAnim  = useRef(new Animated.Value(PEEK_Y)).current;

  const tabW = pillWidth / 5;

  // On mount — just snap to position, no dip
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      slideAnim.setValue(activeIndex);
      return;
    }

    // 1. Dip down
    // 2. Slide horizontally at the same time
    // 3. Pop back up
    Animated.sequence([
      Animated.parallel([
        Animated.timing(peekAnim, {
          toValue: HIDE_Y,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: activeIndex,
          useNativeDriver: true,
          tension: 200,
          friction: 20,
        }),
      ]),
      Animated.spring(peekAnim, {
        toValue: PEEK_Y,
        useNativeDriver: true,
        tension: 180,
        friction: 10,
      }),
    ]).start();
  }, [activeIndex]);

  const bunnyX = slideAnim.interpolate({
    inputRange:  [0, 1, 2, 3, 4],
    outputRange: pillWidth > 0
      ? [0, 1, 2, 3, 4].map(i => tabW * i + tabW / 2 - BUNNY_W / 2)
      : [0, 0, 0, 0, 0],
  });

  const highlightX = slideAnim.interpolate({
    inputRange:  [0, 1, 2, 3, 4],
    outputRange: pillWidth > 0
      ? [0, 1, 2, 3, 4].map(i => tabW * i + (tabW / 2) - (BUNNY_W / 2 + 2))
      : [0, 0, 0, 0, 0],
  });

  
  return (

    
    <View
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: OVER + PILL_H + SAFE, paddingHorizontal: 16 }}
      pointerEvents="box-none"
    >
      {/* ── Peeking bunny ── */}
      {pillWidth > 0 && (
        <Animated.View style={{
          position: 'absolute',
          left: 16,
          width: BUNNY_W,
          bottom: SAFE + PILL_H - 4, 
          height: BUNNY_H,
          transform: [{ translateX: bunnyX }, { translateY: peekAnim }],
          zIndex: 5,
        }}>
          <Image
            source={peekImage} 
            style={{ width: BUNNY_W, height: BUNNY_H }}
            resizeMode="contain"
          />
        </Animated.View>
      )}

      {/* ── Pill ── */}
      <View
        onLayout={e => setPillWidth(e.nativeEvent.layout.width)}
        style={{
          position: 'absolute',
          bottom: SAFE, left: 16, right: 16,
          height: PILL_H,
          flexDirection: 'row',
          backgroundColor: '#3B2220',
          borderRadius: 26,
          borderWidth: 1.5,
          borderColor: 'rgba(212,149,106,0.3)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 18,
          elevation: 12,
          zIndex: 10,
          overflow: 'hidden',
        }}
      >
        {/* Active tab highlight strip */}
        {pillWidth > 0 && (
          <Animated.View style={{
            position: 'absolute',
            top: 8, bottom: 8,
            width: BUNNY_W,
            borderRadius: 16,
            backgroundColor: 'rgba(212,149,106,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(212,149,106,0.3)',
            transform: [{ translateX: highlightX }],
          }} />
        )}

        {NAV_ITEMS.map(({ image, label, key }) => {
          const isActive = active === key;
          return (
            <TouchableOpacity
              key={key}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
              onPress={() => { hapticLight(); onPress(key); }}
            >
              <View style={{ height: 22, justifyContent: 'center', alignItems: 'center' }}>
                {/* Always show icon, dim when inactive */}
                <Image
                  source={image}
                  style={{ width: 20, height: 20, opacity: isActive ? 1 : 0.4 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={{
                fontFamily: 'Jua',
                fontSize: 10,
                marginTop: 3,
                color: isActive ? '#D4956A' : 'rgba(232,213,192,0.4)',
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};