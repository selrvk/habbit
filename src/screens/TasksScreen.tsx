// src/screens/TasksScreen.tsx

import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Animated, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { reminderSummary, scheduleLabel, addDaysToKey, getDayName, isScheduledForDay, parseDateKey } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { WeeklyHabitChart } from '../components/WeeklyHabitChart';
import type { Commission, CompletionRecord, HabitChartDay } from '../types';
import type { HabitSummary } from '../habitStats';
import { useFontSize } from '../hooks/useFontSize';
import { Icon } from '../components/Icon';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light: () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS),
};

type DotState = 'done' | 'missed' | 'skipped' | 'pending' | 'none';

/** One habbit's status on one day of the last-7-days strip. */
const dayStateFor = (c: Commission, day: HabitChartDay, weekDone: boolean): DotState => {
  // "N× a week" habits are never missed on a day: each day is just done or not.
  if (c.perWeek) {
    if (day.isToday) return c.completed ? 'done' : weekDone ? 'none' : 'pending';
    return day.completedIds.includes(c.id) ? 'done' : 'none';
  }
  if (day.isToday) {
    if (!isScheduledForDay(c, parseDateKey(day.date).getDay())) return 'none';
    return c.completed ? 'done' : c.skipped ? 'skipped' : 'pending';
  }
  if (day.completedIds.includes(c.id)) return 'done';
  if (day.skippedIds?.includes(c.id)) return 'skipped';
  return day.scheduledIds?.includes(c.id) ? 'missed' : 'none';
};

export const TasksScreen = ({
  commissions,
  completionHistory,
  habitStats,
  todayKey,
  onNavigateAdd,
  onOpenHabit,
}: {
  commissions: Commission[];
  completionHistory: CompletionRecord[];
  habitStats: Record<string, HabitSummary>;
  todayKey: string;
  onNavigateAdd: () => void;
  onOpenHabit: (item: Commission) => void;
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
      // Skipped habits are left out of the day's count.
      const scheduledToday = commissions.filter(c => isScheduledForDay(c, todayDow) && !c.skipped);
      const completedToday = scheduledToday.filter(c => c.completed);
      return {
        date,
        dayName: getDayName(date),
        isToday: true,
        completed: completedToday.length,
        scheduled: scheduledToday.length,
        completedIds: completedToday.map(c => c.id),
        scheduledIds: scheduledToday.map(c => c.id),
        skippedIds: commissions.filter(c => isScheduledForDay(c, todayDow) && c.skipped).map(c => c.id),
      };
    }
    const record  = completionHistory.find(r => r.date === date);
    const skipped = record?.skippedIds ?? [];
    // The bars count the day's schedule only; weekly habits done that day aren't part of it.
    const counted = (record?.scheduledIds ?? []).filter(id => !skipped.includes(id));
    return {
      date,
      dayName: getDayName(date),
      isToday: false,
      completed: counted.filter(id => record?.completedIds.includes(id)).length,
      scheduled: counted.length,
      completedIds: record?.completedIds ?? [],
      scheduledIds: record?.scheduledIds ?? [],
      skippedIds: skipped,
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
  const todayScheduledForSheet: { id: string; label: string; completed: boolean; skipped: boolean }[] =
    selectedDay?.isToday
      ? commissions
          .filter(c => isScheduledForDay(c, todayDow))
          .map(c => ({ id: c.id, label: c.label, completed: c.completed, skipped: !!c.skipped }))
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
                          <Text style={{ fontFamily: 'Jua', fontSize: 10, color: 'rgba(212,149,106,0.5)' }}>{h.skipped ? 'skipped' : 'pending'}</Text>
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
              {commissions.length === 0 ? 'Nothing here yet' : `${commissions.length} habbit${commissions.length !== 1 ? 's' : ''} · tap one for its streak`}
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
          const stats    = habitStats[item.id];
          const meta     = [
            scheduleLabel(item),
            tpd > 1 ? `${tpd}× a day` : null,
            item.perWeek ? `${stats?.thisWeek ?? 0}/${item.perWeek} this week` : null,
          ].filter(Boolean).join(' · ');
          const reminder = reminderSummary(item);
          const streak   = stats?.current ?? 0;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => { haptic.light(); onOpenHabit(item); }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}. ${meta}${reminder ? `. Reminder ${reminder}` : ''}${streak > 0 ? `. ${streak} ${stats?.unit ?? 'day'} streak` : ''}`}
              accessibilityHint="Shows its streak and calendar"
              style={{ backgroundColor: '#5C3D2E', borderRadius: 16, marginBottom: 10, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.18)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(16) }} numberOfLines={1}>{item.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.8)', fontSize: fs(12), flexShrink: 1 }} numberOfLines={1}>
                      {meta}{reminder ? '  ·  ' : ''}
                    </Text>
                    {reminder && (
                      <>
                        <Icon name="bell" size={fs(15)} style={{ marginRight: 3 }} />
                        <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.8)', fontSize: fs(12) }} numberOfLines={1}>{reminder}</Text>
                      </>
                    )}
                  </View>
                </View>
                {streak > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(212,149,106,0.14)', borderRadius: 99, paddingVertical: 4, paddingHorizontal: 9, marginRight: 8 }}>
                    <Image source={require('./../../assets/emojis/Fire.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
                    <Text style={{ fontFamily: 'DynaPuff', color: '#D4956A', fontSize: fs(13) }}>{streak}{stats?.unit === 'week' ? ' wk' : ''}</Text>
                  </View>
                )}
                <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.35)', fontSize: fs(22) }}>›</Text>
              </View>

              {/* This habbit's last 7 days */}
              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                {habitChartDays.map(day => {
                  const state = dayStateFor(item, day, !!stats?.weekDone);
                  return (
                    <View key={day.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <View style={{
                        width: 16, height: 16, borderRadius: 8,
                        backgroundColor: state === 'done' ? '#9de087' : state === 'missed' ? 'rgba(240,144,144,0.4)' : state === 'skipped' ? 'rgba(232,213,192,0.2)' : 'transparent',
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