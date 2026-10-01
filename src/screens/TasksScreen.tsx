// src/screens/TasksScreen.tsx

import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Animated, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { daysLabel, formatTime12, addDaysToKey, getDayName, isScheduledForDay, parseDateKey } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { WeeklyHabitChart } from '../components/WeeklyHabitChart';
import type { Commission, CompletionRecord, HabitChartDay } from '../types';
import { useFontSize } from '../hooks/useFontSize';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light: () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS),
};

/** Short reminder description, e.g. "8:00 PM", "6:00 AM – 8:00 PM", "3 times". */
const reminderSummary = (c: Commission): string | null => {
  if ((c.timesPerDay ?? 1) === 1) return c.reminderTime ? formatTime12(c.reminderTime.hour, c.reminderTime.minute) : null;
  if (c.reminderSplit) {
    const r = c.reminderSplit;
    return `${formatTime12(r.startHour, r.startMinute)} – ${formatTime12(r.endHour, r.endMinute)}`;
  }
  return c.reminderTimes?.length ? `${c.reminderTimes.length} times` : null;
};

type DotState = 'done' | 'missed' | 'pending' | 'none';

/** One habbit's status on one day of the last-7-days strip. */
const dayStateFor = (c: Commission, day: HabitChartDay): DotState => {
  if (day.isToday) {
    if (!isScheduledForDay(c, parseDateKey(day.date).getDay())) return 'none';
    return c.completed ? 'done' : 'pending';
  }
  if (day.completedIds.includes(c.id)) return 'done';
  return day.scheduledIds?.includes(c.id) ? 'missed' : 'none';
};

export const TasksScreen = ({
  commissions,
  completionHistory,
  todayKey,
  onNavigateAdd,
  onNavigateEdit,
}: {
  commissions: Commission[];
  completionHistory: CompletionRecord[];
  todayKey: string;
  onNavigateAdd: () => void;
  onNavigateEdit: (item: Commission) => void;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();

  const [selectedDay, setSelectedDay] = useState<HabitChartDay | null>(null);

  const handleDayPress = (day: HabitChartDay) => {
    haptic.light();
    setSelectedDay(day);
  };

  // ── Bottom sheet pan responder ─────────────────────────────────────────────
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) sheetTranslateY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) {
        Animated.timing(sheetTranslateY, { toValue: 600, duration: 220, useNativeDriver: true })
          .start(() => { setSelectedDay(null); sheetTranslateY.setValue(0); });
      } else {
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
      }
    },
    onPanResponderTerminate: () =>
      Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start(),
  })).current;

  // ── Derive chart data ──────────────────────────────────────────────────────
  // Today uses live commission state so the bar reflects real-time completions
  // and correctly reverts when a habit is un-checked.
  // Past days still come from completionHistory (persisted records).
  const todayDow = parseDateKey(todayKey).getDay();

  // Local-date keys ending at todayKey (toISOString would give UTC dates).
  const habitChartDays: HabitChartDay[] = Array.from({ length: 7 }, (_, i) => addDaysToKey(todayKey, i - 6)).map(date => {
    if (date === todayKey) {
      const scheduledToday = commissions.filter(c => isScheduledForDay(c, todayDow));
      const completedToday = scheduledToday.filter(c => c.completed);
      return {
        date,
        dayName: getDayName(date),
        isToday: true,
        completed: completedToday.length,
        scheduled: scheduledToday.length,
        completedIds: completedToday.map(c => c.id),
        scheduledIds: scheduledToday.map(c => c.id),
      };
    }
    const record = completionHistory.find(r => r.date === date);
    return {
      date,
      dayName: getDayName(date),
      isToday: false,
      completed: record?.completedIds?.length ?? 0,
      scheduled: record?.scheduledIds?.length ?? 0,
      completedIds: record?.completedIds ?? [],
      scheduledIds: record?.scheduledIds ?? [],
    };
  });

  const hasAnyData = habitChartDays.some(d => d.scheduled > 0);

  // ── Resolve completed habit labels for the selected day ───────────────────
  const selectedLabels: string[] = selectedDay
    ? selectedDay.completedIds
        .map(id => commissions.find(c => c.id === id)?.label)
        .filter((l): l is string => !!l)
    : [];

  const deletedCount = selectedDay
    ? selectedDay.completedIds.length - selectedLabels.length
    : 0;

  // For today's sheet, show all scheduled habits with their live status
  const todayScheduledForSheet: { id: string; label: string; completed: boolean }[] =
    selectedDay?.isToday
      ? commissions
          .filter(c => isScheduledForDay(c, todayDow))
          .map(c => ({ id: c.id, label: c.label, completed: c.completed }))
      : [];

  return (
    <>
      {/* ── Day detail bottom sheet ── */}
      <Modal
        visible={selectedDay !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDay(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setSelectedDay(null)}
          />
          <Animated.View style={{
            transform: [{ translateY: sheetTranslateY }],
            backgroundColor: '#3B2220', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingTop: 24, paddingHorizontal: 24, paddingBottom: 32,
            borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(212,149,106,0.35)',
            maxHeight: '75%',
          }}>
            {/* Drag handle */}
            <View {...sheetPanResponder.panHandlers} style={{ paddingBottom: 12, marginTop: -10, alignItems: 'center' }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(212,149,106,0.3)', alignSelf: 'center', marginBottom: 18 }} />
            </View>

            {/* Sheet header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(16) }}>
                  {selectedDay?.isToday ? 'Today' : selectedDay?.dayName}
                </Text>
                <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.7)', fontSize: fs(12), marginTop: 2 }}>
                  {selectedDay?.completed ?? 0} of {selectedDay?.scheduled ?? 0} habbits done
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedDay(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: fs(18) }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {/* Today: show all scheduled habits with live done/pending state */}
              {selectedDay?.isToday ? (
                todayScheduledForSheet.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(14), opacity: 0.4 }}>
                      No habbits scheduled today.
                    </Text>
                  </View>
                ) : (
                  todayScheduledForSheet.map(h => (
                    <View key={h.id} style={{
                      backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 8,
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 14,
                      borderLeftWidth: 3,
                      borderLeftColor: h.completed ? '#A8D4A0' : 'rgba(212,149,106,0.35)',
                    }}>
                      <Text style={{ fontSize: 16, marginRight: 10, opacity: h.completed ? 1 : 0.25 }}>✓</Text>
                      <Text style={{
                        fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(15), flex: 1,
                        opacity: h.completed ? 1 : 0.5,
                      }}>
                        {h.label}
                      </Text>
                      {!h.completed && (
                        <View style={{
                          backgroundColor: 'rgba(212,149,106,0.1)', borderRadius: 99,
                          paddingHorizontal: 8, paddingVertical: 2,
                          borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)',
                        }}>
                          <Text style={{ fontFamily: 'Jua', fontSize: 10, color: 'rgba(212,149,106,0.5)' }}>pending</Text>
                        </View>
                      )}
                    </View>
                  ))
                )
              ) : (
                /* Past days: completed-only list (same as before) */
                selectedDay?.completed === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(14), opacity: 0.4 }}>
                      No habbits completed this day.
                    </Text>
                  </View>
                ) : (
                  <>
                    {selectedLabels.map((label, i) => (
                      <View key={i} style={{
                        backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 8,
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 16, paddingVertical: 14,
                        borderLeftWidth: 3, borderLeftColor: '#A8D4A0',
                      }}>
                        <Text style={{ fontSize: 16, marginRight: 10 }}>✓</Text>
                        <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(15), flex: 1 }}>
                          {label}
                        </Text>
                      </View>
                    ))}
                    {deletedCount > 0 && (
                      <Text style={{
                        fontFamily: 'Jua', fontSize: fs(11),
                        color: 'rgba(232,213,192,0.25)', textAlign: 'center', marginTop: 4,
                      }}>
                        +{deletedCount} removed habbit{deletedCount > 1 ? 's' : ''}
                      </Text>
                    )}
                  </>
                )
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: navHeight }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(24) }}>Habbits</Text>
            <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.55)', fontSize: fs(13) }}>
              {commissions.length === 0 ? 'Nothing here yet' : `${commissions.length} habbit${commissions.length !== 1 ? 's' : ''} · tap one to edit`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { haptic.light(); onNavigateAdd(); }}
            activeOpacity={0.8}
            accessibilityLabel="Add habbit"
            style={{ backgroundColor: '#D4956A', borderRadius: 99, paddingVertical: 9, paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(14) }}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* ── Empty state ── */}
        {commissions.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, backgroundColor: '#5C3D2E', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(212,149,106,0.18)', marginBottom: 16 }}>
            <Image source={IMAGES.bunny} style={{ width: 52, height: 52, marginBottom: 10 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(16), marginBottom: 6 }}>No Habbits yet</Text>
            <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.55)', fontSize: fs(13), textAlign: 'center', marginBottom: 16 }}>
              Pick one small thing you want to do regularly.
            </Text>
            <TouchableOpacity onPress={() => { haptic.light(); onNavigateAdd(); }} activeOpacity={0.8}
              style={{ backgroundColor: '#D4956A', borderRadius: 99, paddingVertical: 11, paddingHorizontal: 24 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(14) }}>+ Add your first Habbit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Habbit list ── */}
        {commissions.map(item => {
          const tpd      = item.timesPerDay ?? 1;
          const meta     = [daysLabel(item.days ?? []), tpd > 1 ? `${tpd}× a day` : null].filter(Boolean).join(' · ');
          const reminder = reminderSummary(item);
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => { haptic.light(); onNavigateEdit(item); }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}. ${meta}${reminder ? `. Reminder ${reminder}` : ''}`}
              accessibilityHint="Opens the editor"
              style={{ backgroundColor: '#5C3D2E', borderRadius: 16, marginBottom: 10, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.18)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(16) }} numberOfLines={1}>{item.label}</Text>
                  <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.8)', fontSize: fs(12), marginTop: 3 }} numberOfLines={1}>
                    {meta}{reminder ? `  ·  🔔 ${reminder}` : ''}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.35)', fontSize: fs(22) }}>›</Text>
              </View>

              {/* This habbit's last 7 days */}
              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                {habitChartDays.map(day => {
                  const state = dayStateFor(item, day);
                  return (
                    <View key={day.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <View style={{
                        width: 16, height: 16, borderRadius: 8,
                        backgroundColor: state === 'done' ? '#9de087' : state === 'missed' ? 'rgba(240,144,144,0.4)' : 'transparent',
                        borderWidth: state === 'pending' || state === 'none' ? 1.5 : 0,
                        borderColor: state === 'pending' ? '#D4956A' : 'rgba(212,149,106,0.18)',
                      }} />
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: day.isToday ? '#D4956A' : 'rgba(232,213,192,0.35)' }}>
                        {day.isToday ? 'Today' : day.dayName.charAt(0)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Weekly overview (hidden until there's something to show) ── */}
        {hasAnyData && (
          <>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(17), marginTop: 14, marginBottom: 10 }}>This week</Text>
            <View style={{ backgroundColor: '#3B2220', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>
              <WeeklyHabitChart days={habitChartDays} onDayPress={handleDayPress} />
              <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.5)', textAlign: 'center', marginTop: 10 }}>
                Tap a bar to see that day
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
};