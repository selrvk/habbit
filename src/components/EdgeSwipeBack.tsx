// src/components/EdgeSwipeBack.tsx
//
// The iPhone's "swipe from the left edge to go back" for screens shown in place of another
// (Settings, a Habbit's page, adding or editing a Habbit). A thin strip along the left edge
// picks up a drag to the right: the screen follows the finger, and past a third of the way
// (or with a flick) it slides off and `onBack` runs, the same as the screen's own back button.

import React, { useRef } from 'react';
import { Animated, Dimensions, PanResponder, View } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// About as wide as the system's own edge gesture. Screens keep 16pt of padding, so nothing
// tappable sits under it.
const EDGE = 16;

export const EdgeSwipeBack = ({ onBack, children }: { onBack: () => void; children: React.ReactNode }) => {
  const x = useRef(new Animated.Value(0)).current;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dx > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
    onPanResponderRelease: (_, g) => {
      const width = Dimensions.get('window').width;
      if (g.dx > width / 3 || (g.vx > 0.5 && g.dx > 30)) {
        ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
        Animated.timing(x, { toValue: width, duration: 160, useNativeDriver: true }).start(() => {
          onBackRef.current();
          x.setValue(0);
        });
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: true, tension: 120, friction: 12 }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  })).current;

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>
      {children}
      <View {...pan.panHandlers} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE }} />
    </Animated.View>
  );
};
