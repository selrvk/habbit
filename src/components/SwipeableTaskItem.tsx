import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, PanResponder } from 'react-native';
import { formatTime12, daysLabel } from '../helpers';
import type { Commission } from '../types';

const SWIPE_THRESHOLD = 60;

const haptic = {
  success: () => require('react-native-haptic-feedback').default.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  warning: () => require('react-native-haptic-feedback').default.trigger('notificationWarning', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
};

export const SwipeableTaskItem = ({ item, onComplete, onUncomplete, onSwipeStart, onSwipeEnd }: {
  item: Commission; onComplete: (id: string) => void; onUncomplete: (id: string) => void;
  onSwipeStart: () => void; onSwipeEnd: () => void;
}) => {
  const translateX    = useRef(new Animated.Value(0)).current;
  const swipeProgress = useRef(new Animated.Value(0)).current;
  const itemRef           = useRef(item);
  const onCompleteRef     = useRef(onComplete);
  const onUncompleteRef   = useRef(onUncomplete);
  const onSwipeStartRef   = useRef(onSwipeStart);
  const onSwipeEndRef     = useRef(onSwipeEnd);
  useEffect(() => { itemRef.current = item; });
  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => { onUncompleteRef.current = onUncomplete; });
  useEffect(() => { onSwipeStartRef.current = onSwipeStart; });
  useEffect(() => { onSwipeEndRef.current = onSwipeEnd; });

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy * 2) && Math.abs(g.dx) > 8,
    onPanResponderGrant: () => { onSwipeStartRef.current(); },
    onPanResponderMove: (_, g) => {
      if (itemRef.current.completed) {
        if (g.dx < 0) { translateX.setValue(Math.max(g.dx, -SWIPE_THRESHOLD)); swipeProgress.setValue(Math.abs(Math.max(g.dx, -SWIPE_THRESHOLD)) / SWIPE_THRESHOLD); }
      } else {
        if (g.dx > 0) { translateX.setValue(Math.min(g.dx, SWIPE_THRESHOLD)); swipeProgress.setValue(Math.min(g.dx, SWIPE_THRESHOLD) / SWIPE_THRESHOLD); }
      }
    },
    onPanResponderRelease: (_, g) => {
      const cur = itemRef.current;
      if (!cur.completed && g.dx > SWIPE_THRESHOLD) {
        haptic.success();
        Animated.sequence([Animated.timing(translateX, { toValue: 120, duration: 150, useNativeDriver: true }), Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true })]).start(() => onCompleteRef.current(cur.id));
        Animated.timing(swipeProgress, { toValue: 0, duration: 350, useNativeDriver: false }).start();
      } else if (cur.completed && g.dx < -SWIPE_THRESHOLD) {
        haptic.warning();
        Animated.sequence([Animated.timing(translateX, { toValue: -120, duration: 150, useNativeDriver: true }), Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true })]).start(() => onUncompleteRef.current(cur.id));
        Animated.timing(swipeProgress, { toValue: 0, duration: 350, useNativeDriver: false }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }).start();
        Animated.timing(swipeProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      }
      onSwipeEndRef.current();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }).start();
      Animated.timing(swipeProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      onSwipeEndRef.current();
    },
  })).current;

  const hintOpacity = swipeProgress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0, 1] });

  return (
    <View style={{ marginBottom: 10 }}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: item.completed ? 'rgba(200,80,60,0.25)' : 'rgba(100,180,80,0.25)', opacity: hintOpacity }}>
        {item.completed
          ? <Text style={{ fontFamily: 'Jua', fontSize: 12, marginLeft: 'auto', color: '#f09090' }}>✕ undo</Text>
          : <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#9de087' }}>✓ done!</Text>}
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }], borderLeftWidth: 3, borderLeftColor: item.completed ? '#6B5040' : '#D4956A', borderRadius: 12, backgroundColor: '#5C3D2E', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: item.completed ? 0.08 : 0.18, shadowRadius: 4, elevation: item.completed ? 1 : 3, opacity: item.completed ? 0.55 : 1 }} {...panResponder.panHandlers}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 16, textDecorationLine: item.completed ? 'line-through' : 'none' }}>{item.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: item.days?.length > 0 || item.reminderTime ? 4 : 0 }}>
              {item.days && item.days.length > 0 && item.days.length < 7 && <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.65)' }}>{daysLabel(item.days)}</Text>}
              {item.reminderTime && <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.65)' }}>🔔 {formatTime12(item.reminderTime.hour, item.reminderTime.minute)}</Text>}
            </View>
          </View>
          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: item.completed ? '#D4956A' : 'rgba(212,149,106,0.5)', backgroundColor: item.completed ? '#D4956A' : 'transparent' }}>
            {item.completed && <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};