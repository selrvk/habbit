// src/screens/TasksScreen.tsx

import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Modal, Animated, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { daysLabel, formatTime12, getLast7DayKeys, getDayName } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { SectionDivider } from '../components/SectionDivider';
import { WeeklyHabitChart } from '../components/WeeklyHabitChart';
import type { Commission, CompletionRecord, HabitChartDay } from '../types';
import { useFontSize } from '../hooks/useFontSize';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTIONS),
};

export const TasksScreen = ({
  commissions,
  completionHistory,
  todayKey,
  onNavigateAdd,
  onNavigateEdit,
  onDelete,
}: {
  commissions: Commission[];
  completionHistory: CompletionRecord[];
  todayKey: string;
  onNavigateAdd: () => void;
  onNavigateEdit: (item: Commission) => void;
  onDelete: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();

  const [selectedDay, setSelectedDay] = useState<HabitChartDay | null>(null);

  const handleDelete = (item: Commission) => {
    haptic.warning();
    Alert.alert('Remove Habbit', `Remove "${item.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { haptic.error(); onDelete(item.id); } },
    ]);
  };

  const handleDayPress = (day: HabitChartDay) => {
    haptic.light();
    setSelectedDay(day);
  };

  // ── Bottom sheet pan responder (mirrors FinanceScreen) ────────────────────
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

  // ── Derive chart data ─────────────────────────────────────────────────────
  const habitChartDays: HabitChartDay[] = getLast7DayKeys().map(date => {
    const record = completionHistory.find(r => r.date === date);
    return {
      date,
      dayName: getDayName(date),
      isToday: date === todayKey,
      completed: record?.completedIds?.length ?? 0,
      scheduled: record?.scheduledIds?.length ?? 0,
      completedIds: record?.completedIds ?? [],
    };
  });

  const hasAnyData = habitChartDays.some(d => d.scheduled > 0);

  // ── Resolve completed habit labels for the selected day ───────────────────
  const selectedLabels: string[] = selectedDay
    ? selectedDay.completedIds
        .map(id => commissions.find(c => c.id === id)?.label)
        .filter((l): l is string => !!l)
    : [];

  // IDs that were completed but the habit has since been deleted
  const deletedCount = selectedDay
    ? selectedDay.completedIds.length - selectedLabels.length
    : 0;

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
              {selectedDay?.completed === 0 ? (
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
                  {/* Deleted habits placeholder */}
                  {deletedCount > 0 && (
                    <Text style={{
                      fontFamily: 'Jua', fontSize: fs(11),
                      color: 'rgba(232,213,192,0.25)', textAlign: 'center', marginTop: 4,
                    }}>
                      +{deletedCount} removed habbit{deletedCount > 1 ? 's' : ''}
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: navHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.7 }}>Manage your</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 24 }}>Habbits</Text>
          </View>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}>
            <Image source={IMAGES.tasks} style={{ width: 28, height: 28 }} resizeMode="contain" />
          </View>
        </View>

        <SectionDivider title="✦ Your Habbits ✦" />

        {/* ── Weekly habit chart ── */}
        <View style={{
          backgroundColor: '#3B2220', borderRadius: 16, padding: 16, marginBottom: 16,
          borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)',
        }}>
          <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.5)', fontSize: 11, marginBottom: 10 }}>
            Last 7 days
          </Text>
          {hasAnyData
            ? <>
                <WeeklyHabitChart days={habitChartDays} onDayPress={handleDayPress} />
                <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(212,149,106,0.4)', textAlign: 'center', marginTop: 10 }}>
                  Tap a bar to see details
                </Text>
              </>
            : <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.25)', fontSize: 12, textAlign: 'center', paddingVertical: 18 }}>
                available after your first day 🐰
              </Text>
          }
        </View>

        <SectionDivider title={`✦ ${commissions.length} Habbit${commissions.length !== 1 ? 's' : ''} ✦`} />

        {/* ── Add button ── */}
        <TouchableOpacity
          onPress={onNavigateAdd}
          activeOpacity={0.8}
          style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginBottom: 16, shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}>
          <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(16) }}>+ Add Habbit</Text>
        </TouchableOpacity>

        {/* ── Empty state ── */}
        {commissions.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Image source={IMAGES.bunny} style={{ width: 52, height: 52, marginBottom: 10, opacity: 0.6 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(18), marginBottom: 8 }}>No Habbits yet!</Text>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(14), opacity: 0.5, textAlign: 'center' }}>
              Tap the button above to add{'\n'}your first daily Habbit.
            </Text>
          </View>
        )}

        {/* ── Habbit list ── */}
        {commissions.map(item => {
          const timesPerDay = item.timesPerDay ?? 1;
          const isMulti = timesPerDay > 1;

          const reminderChips: { key: string; label: string }[] = [];
          if (item.reminderTime) {
            reminderChips.push({ key: 'single', label: `🔔 ${formatTime12(item.reminderTime.hour, item.reminderTime.minute)}` });
          }
          if (item.reminderTimes && item.reminderTimes.length > 0) {
            reminderChips.push({ key: 'manual', label: `🔔 ×${item.reminderTimes.length} manual` });
          }
          if (item.reminderSplit) {
            reminderChips.push({
              key: 'split',
              label: `🔔 ${formatTime12(item.reminderSplit.startHour, item.reminderSplit.startMinute)} – ${formatTime12(item.reminderSplit.endHour, item.reminderSplit.endMinute)}`,
            });
          }

          return (
            <View
              key={item.id}
              style={{ backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderLeftWidth: 3, borderLeftColor: item.completed ? '#A8D4A0' : '#D4956A', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 16, opacity: 0.3 }}>
                  <Text style={{ color: '#D4956A', fontSize: fs(14) }}>☰</Text>
                </View>
                <View style={{ flex: 1, paddingVertical: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(16) }} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.completed && (
                      <View style={{
                        backgroundColor: 'rgba(168,212,160,0.15)',
                        borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
                        borderWidth: 1, borderColor: 'rgba(168,212,160,0.4)',
                      }}>
                        <Text style={{ fontFamily: 'Jua', fontSize: 10, color: '#A8D4A0' }}>✓ done</Text>
                      </View>
                    )}

                    {isMulti && !item.completed && (item.completionCount ?? 0) > 0 && (
                      <View style={{
                        backgroundColor: 'rgba(212,149,106,0.12)',
                        borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
                        borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)',
                      }}>
                        <Text style={{ fontFamily: 'Jua', fontSize: 10, color: 'rgba(212,149,106,0.8)' }}>
                          {item.completionCount}/{item.timesPerDay}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: 'rgba(212,149,106,0.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.9)' }}>
                        {daysLabel(item.days ?? [])}
                      </Text>
                    </View>
                    {reminderChips.map(chip => (
                      <View key={chip.key} style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,149,106,0.28)' }}>
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.8)' }}>{chip.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 4 }}>
                  <TouchableOpacity
                    onPress={() => onNavigateEdit(item)}
                    activeOpacity={0.7}
                    style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)' }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#D4956A' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    activeOpacity={0.7}
                    style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(200,80,60,0.25)' }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#f09090' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
};