import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Modal, Animated, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { getLast7Days } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { SectionDivider } from '../components/SectionDivider';
import { NumpadModal } from '../components/NumpadModal';
import { WeeklyChart } from '../components/WeeklyChart';
import type { SpendingEntry, DailyTotal, ChartDay } from '../types';
import { useFontSize } from '../hooks/useFontSize';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium',        HAPTIC_OPTIONS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTIONS),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS),
};

// ─── Number formatter ─────────────────────────────────────────────────────────
const fmt = (n: number): string => {
  if (n >= 1_000_000) {
    const stepped = Math.floor((n / 1_000_000) * 10) / 10;
    return `${stepped.toFixed(1)}M`;
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Progress bar colour ──────────────────────────────────────────────────────
const barColor = (pct: number, over: boolean): string => {
  if (over)      return '#f09090';
  if (pct > 80)  return '#f5c26b';
  return '#D4956A';
};

// ─── Days-under-budget streak ─────────────────────────────────────────────────
const calcStreak = (dailyTotals: DailyTotal[], allocatedPerDay: number): number => {
  const sorted = [...dailyTotals].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const d of sorted) {
    if (d.total > 0 && d.total <= allocatedPerDay) streak++;
    else break;
  }
  return streak;
};

export const FinanceScreen = ({
  spentToday, todayHistory, dailyTotals, allocatedPerDay, currency,
  onSetAllocated, onAddSpending, onUndoEntry,
}: {
  spentToday: number;
  todayHistory: SpendingEntry[];
  dailyTotals: DailyTotal[];
  allocatedPerDay: number;
  currency: string;
  onSetAllocated: (v: number) => void;
  onAddSpending: (amount: string, note?: string) => void;
  onUndoEntry: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();

  // ── modal states ──────────────────────────────────────────────────────────
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [spendModal,  setSpendModal]  = useState(false);
  const [spendInput,  setSpendInput]  = useState('');
  const [selectedDay, setSelectedDay] = useState<ChartDay | null>(null);

  // ── derived values ────────────────────────────────────────────────────────
  const isOverBudget  = spentToday > allocatedPerDay;
  const remaining     = Math.max(allocatedPerDay - spentToday, 0);
  const overage       = Math.max(spentToday - allocatedPerDay, 0);
  const budgetPct     = Math.min((spentToday / allocatedPerDay) * 100, 100);
  const chartDays     = getLast7Days(dailyTotals, spentToday);
  const completedDays = dailyTotals.filter(d => d.total > 0);
  const avgSpend      = completedDays.length > 0
    ? completedDays.reduce((s, d) => s + d.total, 0) / completedDays.length
    : null;
  const streak = calcStreak(dailyTotals, allocatedPerDay);

  const selectedEntries: SpendingEntry[] = selectedDay
    ? selectedDay.isToday
      ? todayHistory
      : (dailyTotals.find(d => d.date === selectedDay.date)?.entries ?? [])
    : [];

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleDayPress = (day: ChartDay) => {
    haptic.light();
    setSelectedDay(day);
  };

  const handleUndoConfirm = (entry: SpendingEntry) => {
    haptic.warning();
    Alert.alert(
      'Undo Entry',
      `Remove ${currency}${fmt(entry.amount)} added at ${entry.time}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', style: 'destructive', onPress: () => { haptic.error(); onUndoEntry(entry.id); } },
      ],
    );
  };

  const handleAddSpend = (note?: string) => {
    onAddSpending(spendInput, note);
    setSpendInput('');
    setSpendModal(false);
  };

  // ── bottom sheet pan responder ────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Budget numpad ── */}
      <NumpadModal
        visible={budgetModal}
        title="Set Daily Budget"
        hint={`Current budget: ${currency}${fmt(allocatedPerDay)}`}
        confirmLabel="Set Budget to"
        amount={budgetInput}
        currency={currency}
        onChangeAmount={setBudgetInput}
        onConfirm={() => { onSetAllocated(parseFloat(budgetInput || '0')); setBudgetInput(''); setBudgetModal(false); }}
        onClose={() => { setBudgetModal(false); setBudgetInput(''); }}
      />

      {/* ── Add spending numpad — withNote mirrors HomeScreen behaviour ── */}
      <NumpadModal
        visible={spendModal}
        title="Add to Spent Today"
        hint={`Remaining: ${currency}${fmt(remaining)}`}
        confirmLabel="Add"
        amount={spendInput}
        currency={currency}
        onChangeAmount={setSpendInput}
        onConfirm={handleAddSpend}
        onClose={() => { setSpendModal(false); setSpendInput(''); }}
        withNote
      />

      {/* ── Day history bottom sheet ── */}
      <Modal visible={selectedDay !== null} transparent animationType="fade" onRequestClose={() => setSelectedDay(null)}>
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
            borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(212,149,106,0.35)', maxHeight: '75%',
          }}>
            <View {...sheetPanResponder.panHandlers} style={{ paddingBottom: 12, marginTop: -10, alignItems: 'center' }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(212,149,106,0.3)', alignSelf: 'center', marginBottom: 18 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(16) }}>
                  {selectedDay?.isToday ? 'Today' : selectedDay?.dayName}
                </Text>
                <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.7)', fontSize: fs(12), marginTop: 2 }}>
                  {currency}{fmt(selectedDay?.total ?? 0)} spent
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDay(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: fs(18) }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {selectedEntries.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(14), opacity: 0.4 }}>No entry details recorded.</Text>
                </View>
              ) : (
                [...selectedEntries].reverse().map(entry => (
                  <View key={entry.id} style={{
                    backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 8,
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
                    borderLeftWidth: 3, borderLeftColor: '#D4956A',
                  }}>
                    <Image source={IMAGES.carrot} style={{ width: 18, height: 18, marginRight: 10 }} resizeMode="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(15) }}>{currency}{fmt(entry.amount)}</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: 11, color: '#e8d5c0', opacity: 0.45, marginTop: 1 }}>{entry.time}</Text>
                      {entry.note ? <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.75)', marginTop: 3 }}>{entry.note}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: navHeight }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.7 }}>Track your</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 24 }}>Finance</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {streak > 0 && (
              <View style={{
                backgroundColor: 'rgba(157,224,135,0.15)', borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: 'rgba(157,224,135,0.35)',
              }}>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: '#9de087' }}>🔥 {streak}d streak</Text>
              </View>
            )}
            <View style={{
              width: 48, height: 48, borderRadius: 24, backgroundColor: '#5C3D2E',
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 2, borderColor: '#D4956A',
              shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
            }}>
              <Image source={IMAGES.carrots} style={{ width: 28, height: 28 }} resizeMode="contain" />
            </View>
          </View>
        </View>

        <SectionDivider title="✦ Today ✦" />

        {/* ── Budget card ── */}
        <TouchableOpacity
          onPress={() => { haptic.medium(); setBudgetModal(true); }}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)',
            shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
          }}
        >
          <View>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.6, marginBottom: 4 }}>Daily Budget</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image source={IMAGES.carrots} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(20) }}>{currency}{fmt(allocatedPerDay)}</Text>
            </View>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: 'rgba(212,149,106,0.4)', marginTop: 4 }}>Resets at midnight</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#D4956A' }}>Edit</Text>
          </View>
        </TouchableOpacity>

        {/* ── Spent / Remaining ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View style={{
            flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 14,
            borderWidth: 1, borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)',
          }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.6, marginBottom: 6 }}>Spent Today</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Image source={IMAGES.carrot} style={{ width: 20, height: 20 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(18), color: isOverBudget ? '#f09090' : '#e8d5c0' }}>
                {currency}{fmt(spentToday)}
              </Text>
            </View>
          </View>
          <View style={{
            flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 14,
            borderWidth: 1, borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)',
          }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.6, marginBottom: 6 }}>
              {isOverBudget ? 'Over Budget' : 'Remaining'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Image source={isOverBudget ? IMAGES.carrot : IMAGES.carrots} style={{ width: 20, height: 20 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(18), color: isOverBudget ? '#f09090' : '#9de087' }}>
                {isOverBudget ? `-${currency}${fmt(overage)}` : `${currency}${fmt(remaining)}`}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Progress bar ── */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.55)' }}>Budget used today</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: isOverBudget ? '#f09090' : budgetPct > 80 ? '#f5c26b' : 'rgba(212,149,106,0.8)' }}>
              {budgetPct.toFixed(0)}%{isOverBudget ? ' — over!' : budgetPct > 80 ? ' — almost!' : ' of daily'}
            </Text>
          </View>
          <View style={{
            width: '100%', height: 14, backgroundColor: 'rgba(212,149,106,0.12)',
            borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)',
          }}>
            <View style={{
              height: '100%', borderRadius: 8, width: `${budgetPct}%`,
              backgroundColor: barColor(budgetPct, isOverBudget),
            }} />
          </View>
        </View>

        {/* ── Add spending button ── */}
        <TouchableOpacity
          onPress={() => { haptic.medium(); setSpendModal(true); }}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#D4956A', borderRadius: 16, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginBottom: 24,
            shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
          }}
        >
          <Image source={IMAGES.carrot} style={{ width: 22, height: 22 }} resizeMode="contain" />
          <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(16) }}>Add to Spent Today</Text>
        </TouchableOpacity>

        <SectionDivider title="✦ This Week ✦" />

        <View style={{
          backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, marginBottom: 12,
          borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)',
        }}>
          <WeeklyChart
            days={chartDays}
            allocatedPerDay={allocatedPerDay}
            currency={currency}
            onDayPress={handleDayPress}
          />
          <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.4)', textAlign: 'center', marginTop: 10 }}>
            Tap a bar to see details
          </Text>
        </View>

        {/* ── Avg spend + weekly total ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <View style={{
            flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16,
            paddingHorizontal: 16, paddingVertical: 14,
            borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)',
          }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.6, marginBottom: 4 }}>Avg daily spend</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(18) }}>
              {avgSpend !== null ? `${currency}${fmt(avgSpend)}` : '—'}
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16,
            paddingHorizontal: 16, paddingVertical: 14,
            borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)',
          }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.6, marginBottom: 4 }}>Weekly total</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(18) }}>
              {currency}{fmt(chartDays.reduce((s, d) => s + d.total, 0))}
            </Text>
          </View>
        </View>

        <SectionDivider title="✦ Today's History ✦" />

        {todayHistory.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Image source={IMAGES.carrot} style={{ width: 40, height: 40, marginBottom: 8, opacity: 0.4 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(14), opacity: 0.35, textAlign: 'center' }}>Nothing spent yet!</Text>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.25, textAlign: 'center', marginTop: 4 }}>
              Tap "Add to Spent Today" to log an expense.
            </Text>
          </View>
        ) : (
          [...todayHistory].reverse().map(entry => (
            <View key={entry.id} style={{
              backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 8,
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
              borderLeftWidth: 3, borderLeftColor: '#D4956A',
            }}>
              <Image source={IMAGES.carrot} style={{ width: 20, height: 20, marginRight: 10 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(16) }}>{currency}{fmt(entry.amount)}</Text>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#e8d5c0', opacity: 0.45 }}>{entry.time}</Text>
                {entry.note ? <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.75)', marginTop: 2 }}>{entry.note}</Text> : null}
              </View>
              <TouchableOpacity
                onPress={() => handleUndoConfirm(entry)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 8,
                  paddingVertical: 5, paddingHorizontal: 10,
                  borderWidth: 1, borderColor: 'rgba(200,80,60,0.25)',
                }}
              >
                <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#f09090' }}>Undo</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
};