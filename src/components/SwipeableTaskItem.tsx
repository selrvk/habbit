// src/components/SwipeableTaskItem.tsx

import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, PanResponder } from 'react-native';
import { formatTime12, daysLabel } from '../helpers';
import type { Commission } from '../types';

const SWIPE_THRESHOLD = 60;

const haptic = {
  success: () => require('react-native-haptic-feedback').default.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  warning: () => require('react-native-haptic-feedback').default.trigger('notificationWarning', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
};

export const SwipeableTaskItem = ({
  item,
  onComplete,
  onUncomplete,
  onSwipeStart,
  onSwipeEnd,
}: {
  item: Commission;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onSwipeStart: () => void;
  onSwipeEnd: () => void;
}) => {
  const timesPerDay = item.timesPerDay ?? 1;
  const count       = item.completionCount ?? 0;
  const isMulti     = timesPerDay > 1;

  // Swipe direction availability
  // Single: right = not completed | left = completed
  // Multi:  right = count < target | left = count > 0
  const canSwipeRight = isMulti ? count < timesPerDay : !item.completed;
  const canSwipeLeft  = isMulti ? count > 0           : item.completed;

  const translateX    = useRef(new Animated.Value(0)).current;
  const rightProgress = useRef(new Animated.Value(0)).current; // drives green hint
  const leftProgress  = useRef(new Animated.Value(0)).current; // drives red hint

  // Stable refs for callbacks
  const itemRef         = useRef(item);
  const onCompleteRef   = useRef(onComplete);
  const onUncompleteRef = useRef(onUncomplete);
  const onStartRef      = useRef(onSwipeStart);
  const onEndRef        = useRef(onSwipeEnd);
  useEffect(() => { itemRef.current         = item;         });
  useEffect(() => { onCompleteRef.current   = onComplete;   });
  useEffect(() => { onUncompleteRef.current = onUncomplete; });
  useEffect(() => { onStartRef.current      = onSwipeStart; });
  useEffect(() => { onEndRef.current        = onSwipeEnd;   });

  const resetAnims = () => {
    Animated.spring(translateX,    { toValue: 0, useNativeDriver: true,  tension: 80, friction: 8 }).start();
    Animated.timing(rightProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    Animated.timing(leftProgress,  { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > Math.abs(g.dy * 2) && Math.abs(g.dx) > 8,

    onPanResponderGrant: () => { onStartRef.current(); },

    onPanResponderMove: (_, g) => {
      const cur = itemRef.current;
      const tpd = cur.timesPerDay     ?? 1;
      const cnt = cur.completionCount ?? 0;
      const canR = tpd > 1 ? cnt < tpd    : !cur.completed;
      const canL = tpd > 1 ? cnt > 0      : cur.completed;

      if (g.dx > 0 && canR) {
        const clamped = Math.min(g.dx, SWIPE_THRESHOLD);
        translateX.setValue(clamped);
        rightProgress.setValue(clamped / SWIPE_THRESHOLD);
        leftProgress.setValue(0);
      } else if (g.dx < 0 && canL) {
        const clamped = Math.max(g.dx, -SWIPE_THRESHOLD);
        translateX.setValue(clamped);
        leftProgress.setValue(Math.abs(clamped) / SWIPE_THRESHOLD);
        rightProgress.setValue(0);
      }
    },

    onPanResponderRelease: (_, g) => {
      const cur = itemRef.current;
      const tpd = cur.timesPerDay     ?? 1;
      const cnt = cur.completionCount ?? 0;
      const canR = tpd > 1 ? cnt < tpd : !cur.completed;
      const canL = tpd > 1 ? cnt > 0   : cur.completed;

      if (canR && g.dx > SWIPE_THRESHOLD) {
        haptic.success();
        Animated.sequence([
          Animated.timing(translateX, { toValue: 120, duration: 150, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0,   duration: 200, useNativeDriver: true }),
        ]).start(() => onCompleteRef.current(cur.id));
        Animated.timing(rightProgress, { toValue: 0, duration: 350, useNativeDriver: false }).start();
        Animated.timing(leftProgress,  { toValue: 0, duration: 350, useNativeDriver: false }).start();
      } else if (canL && g.dx < -SWIPE_THRESHOLD) {
        haptic.warning();
        Animated.sequence([
          Animated.timing(translateX, { toValue: -120, duration: 150, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0,    duration: 200, useNativeDriver: true }),
        ]).start(() => onUncompleteRef.current(cur.id));
        Animated.timing(rightProgress, { toValue: 0, duration: 350, useNativeDriver: false }).start();
        Animated.timing(leftProgress,  { toValue: 0, duration: 350, useNativeDriver: false }).start();
      } else {
        resetAnims();
      }
      onEndRef.current();
    },

    onPanResponderTerminate: () => {
      resetAnims();
      onEndRef.current();
    },
  })).current;

  const rightHintOpacity = rightProgress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0, 1] });
  const leftHintOpacity  = leftProgress.interpolate({  inputRange: [0, 0.15, 1], outputRange: [0, 0, 1] });

  const isDone     = item.completed;
  const borderColor = isDone ? '#6B5040' : '#D4956A';

  // Reminder label for subtitle
  const reminderLabel = (() => {
    if (item.reminderTime) return `🔔 ${formatTime12(item.reminderTime.hour, item.reminderTime.minute)}`;
    if (item.reminderTimes && item.reminderTimes.length > 0) return `🔔 ×${item.reminderTimes.length}`;
    if (item.reminderSplit) return `🔔 split`;
    return null;
  })();

  const showMeta = (item.days && item.days.length > 0 && item.days.length < 7) || reminderLabel;

  return (
    <View style={{ marginBottom: 10 }}>
      {/* ── Green (complete / increment) hint ── */}
      <Animated.View style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        backgroundColor: 'rgba(100,180,80,0.25)', opacity: rightHintOpacity,
      }}>
        <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#9de087' }}>
          {isMulti ? `✓  ${count + 1} / ${timesPerDay}` : '✓  done!'}
        </Text>
      </Animated.View>

      {/* ── Red (undo / decrement) hint ── */}
      <Animated.View style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        justifyContent: 'flex-end', backgroundColor: 'rgba(200,80,60,0.25)', opacity: leftHintOpacity,
      }}>
        <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#f09090' }}>
          {isMulti ? `↩  ${Math.max(count - 1, 0)} / ${timesPerDay}` : '✕  undo'}
        </Text>
      </Animated.View>

      {/* ── Card ── */}
      <Animated.View
        style={{
          transform: [{ translateX }],
          borderLeftWidth: 3, borderLeftColor: borderColor, borderRadius: 12,
          backgroundColor: '#5C3D2E',
          shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDone ? 0.08 : 0.18, shadowRadius: 4, elevation: isDone ? 1 : 3,
          opacity: isDone ? 0.55 : 1,
        }}
        {...panResponder.panHandlers}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: label + meta */}
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{
              fontFamily: 'Jua', color: '#e8d5c0', fontSize: 16,
              textDecorationLine: isDone ? 'line-through' : 'none',
            }}>
              {item.label}
            </Text>
            {showMeta && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {item.days && item.days.length > 0 && item.days.length < 7 && (
                  <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.65)' }}>
                    {daysLabel(item.days)}
                  </Text>
                )}
                {reminderLabel && (
                  <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.65)' }}>
                    {reminderLabel}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Right: progress or done checkmark */}
          {isMulti ? (
            <View style={{ alignItems: 'center', minWidth: 40 }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: 13, color: isDone ? 'rgba(212,149,106,0.5)' : '#D4956A' }}>
                {count}/{timesPerDay}
              </Text>
              {/* Mini progress bar */}
              <View style={{ width: 36, height: 4, backgroundColor: 'rgba(212,149,106,0.18)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                <View style={{
                  width: (count / timesPerDay) * 36,
                  height: '100%',
                  backgroundColor: isDone ? 'rgba(212,149,106,0.45)' : '#D4956A',
                  borderRadius: 2,
                }} />
              </View>
            </View>
          ) : (
            isDone && (
              <Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(212,149,106,0.55)' }}>✓</Text>
            )
          )}
        </View>
      </Animated.View>
    </View>
  );
};