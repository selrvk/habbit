// src/components/SwipeableTaskItem.tsx

import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, PanResponder, Pressable, Alert, TouchableOpacity } from 'react-native';
import { formatTime12, daysLabel } from '../helpers';
import type { Commission } from '../types';
import type { SkipAllowance } from '../habitStats';
import { useFontSize } from '../hooks/useFontSize';
import { clock, timeLeft, type FocusSession } from '../focus';

const SWIPE_THRESHOLD = 60;

/** "⏱ 18:42" (or "☕ 3:10" on a break) for the habit whose focus timer is running. */
const FocusCountdown = ({ session }: { session: FocusSession }) => {
  const fs = useFontSize();
  const [now, setNow] = useState(Date.now());
  const paused = session.pausedLeft !== undefined;
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused, session.id, session.phase]);
  const left = timeLeft(session, now);
  const text = session.phase === 'break'
    ? (left > 0 ? `☕ break ${clock(left)}` : '☕ break’s over')
    : paused ? `⏸ ${clock(left)}` : `⏱ ${clock(left)}`;
  return <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: session.phase === 'break' ? '#9de087' : '#D4956A', fontVariant: ['tabular-nums'] }}>{text}</Text>;
};

const haptic = {
  success: () => require('react-native-haptic-feedback').default.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  warning: () => require('react-native-haptic-feedback').default.trigger('notificationWarning', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  light:   () => require('react-native-haptic-feedback').default.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
};

export const SwipeableTaskItem = ({
  item,
  streak = 0,
  skips,
  week,
  onComplete,
  onUncomplete,
  onSkip,
  onUnskip,
  onSwipeStart,
  onSwipeEnd,
  focus,
}: {
  item: Commission;
  /** This habit's current streak; shown once it's running. */
  streak?: number;
  /** This week's skips for this habit. */
  skips?: SkipAllowance;
  /** "N× a week" habits: progress this week (today included). Streaks are in weeks. */
  week?: { done: number; target: number };
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onSkip?: (id: string) => void;
  onUnskip?: (id: string) => void;
  onSwipeStart: () => void;
  onSwipeEnd: () => void;
  /** Focus-timer habits: the running session for this habit (if any), and the ▶︎ button. */
  focus?: { running: FocusSession | null; onPress: (id: string) => void };
}) => {
  const fs          = useFontSize();
  const timesPerDay = item.timesPerDay ?? 1;
  const count       = item.completionCount ?? 0;
  const isMulti     = timesPerDay > 1;

  const isSkipped   = !!item.skipped;
  // Single: complete when not done, undo when done. Multi: +1 below target, -1 above 0.
  // A skipped habit does neither: tapping it un-skips it.
  const canComplete = !isSkipped && (isMulti ? count < timesPerDay : !item.completed);
  const canUndo     = !isSkipped && (isMulti ? count > 0           : item.completed);
  const canSkip     = !!onSkip && !isSkipped && !item.completed;
  const skipsLeft   = skips?.left ?? 1;

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
      const canR = !cur.skipped && (tpd > 1 ? cnt < tpd : !cur.completed);
      const canL = !cur.skipped && (tpd > 1 ? cnt > 0   : cur.completed);

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
      const canR = !cur.skipped && (tpd > 1 ? cnt < tpd : !cur.completed);
      const canL = !cur.skipped && (tpd > 1 ? cnt > 0   : cur.completed);

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

  const scale = useRef(new Animated.Value(1)).current;

  // Tap = check off one (a rep for multi-times habits); hold = undo one, or offer to skip
  // when there's nothing to undo. Tapping a skipped habit un-skips it.
  const handleTap = () => {
    if (isSkipped) { haptic.light(); onUnskip?.(item.id); return; }
    if (!canComplete) { haptic.light(); return; }
    haptic.success();
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    Animated.sequence([
      Animated.timing(rightProgress, { toValue: 1, duration: 90, useNativeDriver: false }),
      Animated.timing(rightProgress, { toValue: 0, duration: 380, useNativeDriver: false }),
    ]).start();
    onComplete(item.id);
  };

  const handleLongPress = () => {
    if (canUndo) {
      haptic.warning();
      onUncomplete(item.id);
    } else if (canSkip && skipsLeft === 0) {
      haptic.warning();
      Alert.alert('No skips left this week', `You’ve used this week’s ${skips?.limit === 1 ? 'skip' : 'skips'} for “${item.label}”. They reset on Monday.`);
    } else if (canSkip) {
      haptic.light();
      Alert.alert(
        `Skip “${item.label}” today?`,
        `Busy, sick or something came up? It won’t count for or against your streak, and its reminders stay quiet until tomorrow.` +
          (skips ? `\n\n${skips.limit === 1 ? 'This uses your one skip this week.' : skips.left === skips.limit ? 'This uses 1 of your 2 skips this week.' : 'This uses your last skip this week.'}` : ''),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Skip today', onPress: () => onSkip?.(item.id) },
        ],
      );
    }
  };

  const rightHintOpacity = rightProgress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0, 1] });
  const leftHintOpacity  = leftProgress.interpolate({  inputRange: [0, 0.15, 1], outputRange: [0, 0, 1] });

  const isDone     = item.completed;
  const weekMet    = !!week && week.done >= week.target;
  const isDim      = isDone || isSkipped || weekMet;
  const borderColor = isDim ? '#6B5040' : '#D4956A';

  // Reminder label for subtitle
  const reminderLabel = (() => {
    if (item.reminderTime) return `🔔 ${formatTime12(item.reminderTime.hour, item.reminderTime.minute)}`;
    if (item.reminderTimes && item.reminderTimes.length > 0) return `🔔 ×${item.reminderTimes.length}`;
    if (item.reminderSplit) return `🔔 split`;
    return null;
  })();

  const showMeta = (item.days && item.days.length > 0 && item.days.length < 7) || reminderLabel || streak > 0 || !!week || !!focus?.running;
  // ▶︎ starts a block; it stays while a session runs for this habit, to get back to it.
  const showPlay = !!focus && (!!focus.running || (canComplete && !weekMet));

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
          transform: [{ translateX }, { scale }],
          borderLeftWidth: 3, borderLeftColor: borderColor, borderRadius: 12,
          backgroundColor: '#5C3D2E',
          shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDim ? 0.08 : 0.18, shadowRadius: 4, elevation: isDim ? 1 : 3,
          opacity: isDim ? 0.55 : 1,
        }}
        {...panResponder.panHandlers}>
        <Pressable
          onPress={handleTap}
          onLongPress={handleLongPress}
          delayLongPress={450}
          accessibilityRole="button"
          accessibilityLabel={`${item.label}${isSkipped ? ', skipped today' : isMulti ? `, ${count} of ${timesPerDay}` : item.completed ? ', done' : ''}${week ? `, ${week.done} of ${week.target} this week` : ''}${streak > 0 ? `, ${streak} ${week ? 'week' : 'day'} streak` : ''}`}
          accessibilityHint={isSkipped ? 'Double tap to un-skip' : canComplete ? 'Double tap to check off' : undefined}
          accessibilityActions={[
            ...(canComplete || isSkipped ? [{ name: 'activate', label: isSkipped ? 'Un-skip' : 'Check off' }] : []),
            ...(canUndo ? [{ name: 'undo', label: 'Undo' }] : []),
            ...(canSkip && skipsLeft > 0 ? [{ name: 'skip', label: 'Skip today' }] : []),
          ]}
          onAccessibilityAction={e => {
            const action = e.nativeEvent.actionName;
            if (action === 'skip') onSkip?.(item.id);
            else if (action === 'undo') handleLongPress();
            else handleTap();
          }}
          style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: label + meta */}
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{
              fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(16),
              textDecorationLine: isDone && !isSkipped ? 'line-through' : 'none',
            }}>
              {item.label}
            </Text>
            {showMeta && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {focus?.running && <FocusCountdown session={focus.running} />}
                {streak > 0 && (
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#D4956A' }}>🔥 {streak}{week ? ' wk' : ''}</Text>
                )}
                {week && (
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.65)' }}>
                    {weekMet ? `Goal met · ${week.done}/${week.target} this week 🎉` : `${week.done} of ${week.target} this week`}
                  </Text>
                )}
                {item.days && item.days.length > 0 && item.days.length < 7 && (
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.65)' }}>
                    {daysLabel(item.days)}
                  </Text>
                )}
                {reminderLabel && (
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.65)' }}>
                    {reminderLabel}
                  </Text>
                )}
              </View>
            )}
          </View>

          {showPlay && (
            <TouchableOpacity onPress={() => { haptic.light(); focus?.onPress(item.id); }} activeOpacity={0.7} hitSlop={8}
              accessibilityRole="button" accessibilityLabel={focus?.running ? `Show the ${item.label} focus timer` : `Start a focus block for ${item.label}`}
              style={{
                width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 10,
                backgroundColor: focus?.running ? '#D4956A' : 'rgba(212,149,106,0.14)', borderWidth: 1.5, borderColor: '#D4956A',
              }}>
              <Text style={{ fontSize: 13, color: focus?.running ? '#fff' : '#D4956A', marginLeft: focus?.running ? 0 : 2 }}>{focus?.running ? '⏱' : '▶'}</Text>
            </TouchableOpacity>
          )}

          {/* Right: skipped tag, progress or done checkmark */}
          {isSkipped ? (
            <View style={{ borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(232,213,192,0.3)' }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.7)' }}>Skipped</Text>
            </View>
          ) : isMulti ? (
            <View style={{ alignItems: 'center', minWidth: 40 }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: isDone ? 'rgba(212,149,106,0.5)' : '#D4956A' }}>
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
            <View style={{
              width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
              borderWidth: 2, borderColor: isDone ? 'rgba(212,149,106,0.5)' : '#D4956A',
              backgroundColor: isDone ? 'rgba(212,149,106,0.35)' : 'transparent',
            }}>
              {isDone && <Text style={{ fontFamily: 'DynaPuff', fontSize: 14, color: '#e8d5c0' }}>✓</Text>}
            </View>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
};