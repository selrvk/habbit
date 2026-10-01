import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { getFormattedDate, isScheduledForDay, avatarImage, currencyStr } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { NumpadModal } from '../components/NumpadModal';
import { SwipeableTaskItem } from '../components/SwipeableTaskItem';
import type { Commission } from '../types';
import type { HabitSummary } from '../habitStats';
import { LeftoverBanner, type Jar } from '../components/SavingsJar';
import { useFontSize } from '../hooks/useFontSize';
import { CurrencyAmount } from '../components/CurrencyAmount';
import { PERIOD_LABELS, type BudgetState } from '../budget';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:  () => ReactNativeHapticFeedback.trigger('impactLight',  HAPTIC_OPTIONS),
  medium: () => ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS),
};

const C = {
  cream:  '#e8d5c0',
  accent: '#D4956A',
  card:   '#5C3D2E',
  green:  '#9de087',
  red:    '#f09090',
  muted:  'rgba(232,213,192,0.55)',
  border: 'rgba(212,149,106,0.18)',
};

const money = (n: number, decimals = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

/** 0..1 progress for a habit, counting partial reps of multi-times habits. */
const habitProgress = (c: Commission) => {
  const tpd = c.timesPerDay ?? 1;
  if (c.completed) return 1;
  return tpd > 1 ? Math.min((c.completionCount ?? 0) / tpd, 1) : 0;
};

const ProgressBar = ({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) => (
  <View style={{ height, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.14)', overflow: 'hidden' }}>
    <View style={{ height: '100%', width: `${Math.max(0, Math.min(pct, 1)) * 100}%`, borderRadius: 99, backgroundColor: color }} />
  </View>
);

export const HomeScreen = ({
  commissions, habitStats, spentToday, allocatedPerDay, budget, currency, name, avatar, streak,
  onAddHabit, onGoToFinance, onAddSpending, onCommissionComplete, onCommissionUncomplete,
  onSkip, onUnskip, onSkipMany, jar,
}: {
  commissions: Commission[];
  /** Each habit's streak and weekly skips, by id. */
  habitStats: Record<string, HabitSummary>;
  spentToday: number;
  allocatedPerDay: number; budget: BudgetState; currency: string; name: string; avatar: string; streak: number;
  onAddHabit: () => void; onGoToFinance: () => void;
  onAddSpending: (amount: string, note?: string, category?: string) => void;
  onCommissionComplete: (id: string) => void; onCommissionUncomplete: (id: string) => void;
  onSkip: (id: string) => void; onUnskip: (id: string) => void; onSkipMany: (ids: string[]) => void;
  jar: Jar;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingAmount, setAddingAmount]   = useState('');
  const [modalVisible, setModalVisible]   = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const today = getFormattedDate();

  const todays         = commissions.filter(c => isScheduledForDay(c, today.dow));
  // "N× a week" habits: any day, so they get their own section. Still to do first.
  const weeklyRank     = (c: Commission) => (habitStats[c.id]?.weekDone ? 2 : c.completed ? 1 : 0);
  const weekly         = commissions.filter(c => c.perWeek).sort((a, b) => weeklyRank(a) - weeklyRank(b));
  const weeklyToDo     = weekly.filter(c => weeklyRank(c) === 0);
  // Skipped habits are taken out of today's count.
  const skippedTasks   = todays.filter(c => c.skipped);
  const counted        = todays.filter(c => !c.skipped);
  const activeTasks    = counted.filter(c => !c.completed);
  const completedTasks = counted.filter(c => c.completed);
  const totalCount     = counted.length;
  const allDone        = totalCount > 0 && completedTasks.length === totalCount;
  const habitPct       = totalCount > 0 ? counted.reduce((s, c) => s + habitProgress(c), 0) / totalCount : 0;

  // Habits out of skips this week stay on the list.
  const confirmSkipRest = () => {
    haptic.light();
    const canSkip = activeTasks.filter(c => (habitStats[c.id]?.skips.left ?? 1) > 0);
    const noSkips = activeTasks.filter(c => !canSkip.includes(c));
    const names   = noSkips.map(c => `“${c.label}”`).join(', ');
    if (canSkip.length === 0) {
      Alert.alert('No skips left this week', `${names} ${noSkips.length === 1 ? 'has' : 'have'} used this week’s skips. They reset on Monday.`);
      return;
    }
    const n = canSkip.length;
    Alert.alert(
      'Skip the rest of today?',
      `${n} Habbit${n === 1 ? '' : 's'} will be skipped and stay quiet until tomorrow. Skips don’t count for or against your streaks.` +
        (noSkips.length > 0 ? `\n\n${names} ${noSkips.length === 1 ? 'has' : 'have'} no skips left this week, so ${noSkips.length === 1 ? 'it stays' : 'they stay'} on.` : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: () => onSkipMany(canSkip.map(c => c.id)) },
      ],
    );
  };

  // The budget's own figures: bills are set aside up front (or, on daily budgets, only tracked).
  const remaining    = budget.leftToday;
  const isOverBudget = remaining < 0;
  const budgetPct    = allocatedPerDay > 0 ? budget.spentToday / allocatedPerDay : 0;

  const handleConfirm = (note?: string, category?: string) => {
    onAddSpending(addingAmount, note, category);
    setAddingAmount(''); setModalVisible(false);
  };

  const handleSwipeStart = useCallback(() => setScrollEnabled(false), []);
  const handleSwipeEnd   = useCallback(() => setScrollEnabled(true),  []);

  const renderItem = (item: Commission) => (
    <SwipeableTaskItem key={item.id} item={item} streak={habitStats[item.id]?.current ?? 0} skips={habitStats[item.id]?.skips}
      week={item.perWeek ? { done: habitStats[item.id]?.thisWeek ?? 0, target: item.perWeek } : undefined}
      onComplete={onCommissionComplete} onUncomplete={onCommissionUncomplete}
      onSkip={item.perWeek ? undefined : onSkip} onUnskip={onUnskip}
      onSwipeStart={handleSwipeStart} onSwipeEnd={handleSwipeEnd} />
  );

  const tile = { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border } as const;
  const tileLabel = { fontFamily: 'Jua', fontSize: fs(12), color: C.muted } as const;

  return (
    <>
      <NumpadModal visible={modalVisible} title="Add to Spent Today" confirmLabel="Add" amount={addingAmount} currency={currency} onChangeAmount={setAddingAmount} onConfirm={handleConfirm} onClose={() => { setModalVisible(false); setAddingAmount(''); }} withNote withCategory notePlaceholder="Add a note (optional)" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: navHeight }} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>

        {/* ── Header: greeting + streak ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.accent }}>
            <Image source={avatarImage(avatar)} style={{ width: 34, height: 34 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(20) }} numberOfLines={1}>{greeting()}, {name}</Text>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13) }}>{today.dayName}, {today.month} {today.date}</Text>
          </View>
          {streak > 0 && (
            <View accessibilityLabel={`${streak} day streak`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
              <Image source={require('../../assets/emojis/Fire.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', color: C.accent, fontSize: fs(15) }}>{streak}</Text>
            </View>
          )}
        </View>

        {/* ── Today at a glance ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <View style={tile}>
            <Text style={tileLabel}>Habbits</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(22), color: allDone ? C.green : C.cream, marginVertical: 4 }}>
              {totalCount === 0 ? '—' : `${completedTasks.length}/${totalCount}`}
            </Text>
            <ProgressBar pct={habitPct} color={allDone ? C.green : C.accent} />
            <Text style={[tileLabel, { marginTop: 6 }]}>
              {commissions.length === 0 ? 'None yet' : totalCount === 0 ? 'Rest day' : allDone ? 'All done! 🎉' : `${activeTasks.length} to go`}
            </Text>
          </View>

          <TouchableOpacity style={tile} activeOpacity={0.8} onPress={() => { haptic.light(); onGoToFinance(); }}
            accessibilityLabel={`${isOverBudget ? 'Over budget' : 'Left today'}. Opens Finance`}>
            <Text style={tileLabel}>{isOverBudget ? 'Over budget' : 'Left today'}</Text>
            <CurrencyAmount currency={currency} amount={money(Math.abs(remaining), 2)}
              imageSize={fs(20)}
              textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(22), color: isOverBudget ? C.red : C.cream, marginVertical: 4 }} />
            <ProgressBar pct={budgetPct} color={isOverBudget ? C.red : budgetPct > 0.8 ? '#f5c26b' : C.accent} />
            <Text style={[tileLabel, { marginTop: 6 }]} numberOfLines={1}>
              {budget.period === 'daily'
                ? `of ${currencyStr(currency, money(allocatedPerDay))}`
                : `${currencyStr(currency, money(Math.max(budget.periodLeft, 0)))} left this ${PERIOD_LABELS[budget.period].noun}`}
            </Text>
            {/* Add spending — always above the fold */}
            <TouchableOpacity
              onPress={() => { haptic.medium(); setModalVisible(true); }}
              activeOpacity={0.8} hitSlop={8}
              accessibilityLabel="Add spending"
              style={{ position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 20, lineHeight: 24 }}>+</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <LeftoverBanner jar={jar} currency={currency} />

        {/* ── Today's habbits ── */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17) }}>Today's Habbits</Text>
          {totalCount > 0 && !allDone && (
            <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.7)', fontSize: fs(12) }}>Tap to check off · hold to skip</Text>
          )}
        </View>

        {commissions.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border }}>
            <Image source={IMAGES.bunny} style={{ width: 52, height: 52, marginBottom: 10 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(16), marginBottom: 6 }}>No Habbits yet</Text>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13), textAlign: 'center', marginBottom: 16 }}>Start with something small you want to do every day.</Text>
            <TouchableOpacity onPress={() => { haptic.light(); onAddHabit(); }} activeOpacity={0.8}
              style={{ backgroundColor: C.accent, borderRadius: 99, paddingVertical: 11, paddingHorizontal: 24 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(14) }}>+ Add your first Habbit</Text>
            </TouchableOpacity>
          </View>
        ) : todays.length === 0 && weeklyToDo.length > 0 ? (
          <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13), marginBottom: 4 }}>
            Nothing set for {today.dayName}. Fancy one from this week? 👇
          </Text>
        ) : todays.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 28, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontSize: fs(40), marginBottom: 8 }}>😴</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(16), marginBottom: 4 }}>Rest day!</Text>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13), textAlign: 'center' }}>Nothing scheduled for {today.dayName}. Your streak is safe 🐰</Text>
          </View>
        ) : (
          <>
            {totalCount === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, marginBottom: 12 }}>
                <Text style={{ fontSize: fs(36), marginBottom: 6 }}>😴</Text>
                <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(16), marginBottom: 4 }}>Taking it easy today</Text>
                <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13), textAlign: 'center' }}>Everything's skipped, so your streaks are safe. Feel better 🐰</Text>
              </View>
            )}
            {allDone && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(100,160,90,0.14)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(157,224,135,0.3)' }}>
                <Image source={IMAGES.carrots} style={{ width: 32, height: 32 }} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(15) }}>All done for today!</Text>
                  <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12) }}>
                    {streak > 1 ? `${streak} days in a row — keep it hopping.` : 'Come back tomorrow to build your streak.'}
                  </Text>
                </View>
              </View>
            )}
            {activeTasks.map(renderItem)}
            {activeTasks.length > 0 && (
              <TouchableOpacity onPress={confirmSkipRest} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 }}>
                <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.4)', fontSize: fs(12) }}>
                  Need a break? <Text style={{ textDecorationLine: 'underline' }}>Skip the rest of today</Text>
                </Text>
              </TouchableOpacity>
            )}
            {skippedTasks.length > 0 && (
              <>
                <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.8)', fontSize: fs(13), textAlign: 'center', paddingVertical: 8 }}>
                  Skipped today · tap one to undo
                </Text>
                {skippedTasks.map(renderItem)}
              </>
            )}
            {completedTasks.length > 0 && (
              <>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 }}
                  onPress={() => { haptic.light(); setShowCompleted(v => !v); }}
                  accessibilityRole="button" accessibilityState={{ expanded: showCompleted }}>
                  <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.8)', fontSize: fs(13) }}>
                    {showCompleted ? 'Hide' : 'Show'} completed ({completedTasks.length})
                  </Text>
                </TouchableOpacity>
                {showCompleted && (
                  <>
                    {completedTasks.map(renderItem)}
                    <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.35)', fontSize: fs(11), textAlign: 'center', marginTop: 2 }}>
                      Swipe left or hold to undo
                    </Text>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── This week: "N× a week" habits, any day ── */}
        {weekly.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17) }}>This week</Text>
              <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.7)', fontSize: fs(12) }}>Any days you like</Text>
            </View>
            {weekly.map(renderItem)}
          </>
        )}
      </ScrollView>
    </>
  );
};
