// src/screens/HabitDetailScreen.tsx
//
// One habit's page: its streak, best streak, completion rate and a month calendar.
// Opened by tapping a habit in the Habbits list.

import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { parseDateKey, reminderSummary, scheduleLabel } from '../helpers';
import { habitDays, skipAllowance, statsFromDays } from '../habitStats';
import { HabitCalendar } from '../components/HabitCalendar';
import { useFontSize } from '../hooks/useFontSize';
import type { Commission, CompletionRecord } from '../types';
import { addDaysToKey } from '../helpers';
import { durationLabel, focusMinutes, type FocusLogEntry } from '../focus';

const C = {
  bg:     '#2A1A18',
  card:   '#5C3D2E',
  accent: '#D4956A',
  cream:  '#e8d5c0',
  muted:  'rgba(232,213,192,0.55)',
  border: 'rgba(212,149,106,0.18)',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

export const HabitDetailScreen = ({ habit, history, todayKey, onBack, onEdit, onSkip, onUnskip, focusLog, focusRunning, onStartFocus }: {
  habit: Commission;
  history: CompletionRecord[];
  todayKey: string;
  onBack: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  /** Focus-timer habits: time focused, whether its timer is running, and starting it. */
  focusLog: FocusLogEntry[];
  focusRunning: boolean;
  onStartFocus: () => void;
}) => {
  const fs = useFontSize();
  const days  = useMemo(() => habitDays(habit, history, todayKey), [habit, history, todayKey]);
  const stats = useMemo(() => statsFromDays(habit, days, todayKey), [habit, days, todayKey]);
  const skips = useMemo(() => skipAllowance(habit, history, todayKey), [habit, history, todayKey]);

  const tpd      = habit.timesPerDay ?? 1;
  const reminder = reminderSummary(habit);
  const meta     = [scheduleLabel(habit), tpd > 1 ? `${tpd}× a day` : null, reminder ? `🔔 ${reminder}` : null].filter(Boolean).join('  ·  ');

  const since    = parseDateKey(stats.since);
  const sinceStr = `${MONTHS[since.getMonth()]} ${since.getDate()}${since.getFullYear() !== parseDateKey(todayKey).getFullYear() ? `, ${since.getFullYear()}` : ''}`;
  const tracked  = stats.done + stats.missed;
  const today    = days[days.length - 1]?.state;
  const unit     = (n: number) => `${stats.unit}${n === 1 ? '' : 's'}`;
  const perWeek  = habit.perWeek ?? 0;
  const weekLeft = Math.max(perWeek - stats.thisWeek, 0);

  const Tile = ({ image, value, suffix, label, highlight = false }: { image: any; value: string; suffix?: string; label: string; highlight?: boolean }) => (
    <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: highlight ? 'rgba(212,149,106,0.45)' : C.border }}>
      <Image source={image} style={{ width: 34, height: 34, marginBottom: 4 }} resizeMode="contain" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(24), color: highlight ? C.accent : C.cream, lineHeight: fs(28) }}>{value}</Text>
        {suffix && <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, marginBottom: 3 }}>{suffix}</Text>}
      </View>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );

  const weeklyHint =
    weekLeft === 0     ? `Goal met this week — ${stats.thisWeek} of ${perWeek}! 🎉` :
    today === 'done'   ? `Done today · ${weekLeft} more this week` :
    stats.current > 0  ? `${weekLeft} more this week to make it ${stats.current + 1} weeks 🔥` :
                         `${weekLeft} more this week to start a streak 🔥`;

  const hint = perWeek ? weeklyHint :
    today === 'pending' && stats.current > 0 ? `Check it off today to make it ${stats.current + 1} 🔥` :
    today === 'pending'                      ? 'Check it off today to start a streak 🔥' :
    today === 'done'                         ? 'Done for today — nice one! 🐰' :
    today === 'skipped'                      ? 'Skipped today. Your streak is safe.' :
                                               'Rest day today. Your streak is safe.';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Header ── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 4 : 12, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(212,149,106,0.2)',
      }}>
        <TouchableOpacity
          onPress={() => { haptic(); onBack(); }}
          activeOpacity={0.7}
          hitSlop={12}
          accessibilityLabel="Back"
          style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(212,149,106,0.12)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
          <Text style={{ fontSize: 16, color: C.accent }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, letterSpacing: 1 }}>HABBIT</Text>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(20), color: C.cream, lineHeight: fs(26) }} numberOfLines={2}>{habit.label}</Text>
        </View>
        <TouchableOpacity
          onPress={() => { haptic(); onEdit(); }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${habit.label}`}
          style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 99, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.accent }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: 'rgba(212,149,106,0.85)', marginBottom: 16 }}>{meta}</Text>

        {/* ── Stats ── */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile image={require('./../../assets/emojis/Fire.png')} value={String(stats.current)} suffix={unit(stats.current)} label="Current streak" highlight={stats.current > 0} />
          <Tile image={require('./../../assets/emojis/Star.png')} value={String(stats.best)} suffix={unit(stats.best)} label="Best streak" />
          <Tile image={IMAGES.carrots} value={stats.rate === null ? '—' : `${Math.round(stats.rate * 100)}%`} label="Done" />
        </View>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center', marginTop: 10 }}>
          {stats.unit === 'week'
            ? `${tracked > 0 ? `Goal met ${stats.done} of ${tracked} weeks · ` : ''}Done ${stats.sessions} time${stats.sessions === 1 ? '' : 's'} since ${sinceStr}`
            : tracked === 0
              ? `Tracking since ${sinceStr}`
              : `Done ${stats.done} of ${tracked} scheduled day${tracked === 1 ? '' : 's'} since ${sinceStr}`}
        </Text>

        {/* ── Focus timer ── */}
        {habit.focus && (() => {
          const monday = addDaysToKey(todayKey, -((parseDateKey(todayKey).getDay() + 6) % 7));
          const todayMin = focusMinutes(focusLog, todayKey, todayKey, habit.id);
          const weekMin  = focusMinutes(focusLog, monday, todayKey, habit.id);
          const allMin   = focusMinutes(focusLog, '0000-00-00', todayKey, habit.id);
          const canStart = focusRunning || today === 'pending';
          return (
            <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, marginTop: 20, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: C.cream }}>⏱ Focus</Text>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>
                  {habit.focus.minutes}-min blocks{habit.focus.breakMinutes > 0 ? ` · ${habit.focus.breakMinutes}-min breaks` : ''}
                </Text>
              </View>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: allMin > 0 ? C.cream : C.muted, marginTop: 8 }}>
                {allMin === 0
                  ? 'No focus time yet. Finished blocks add up here.'
                  : `Today ${durationLabel(todayMin)}  ·  This week ${durationLabel(weekMin)}  ·  All time ${durationLabel(allMin)}`}
              </Text>
              {canStart && (
                <TouchableOpacity onPress={() => { haptic(); onStartFocus(); }} activeOpacity={0.8}
                  accessibilityRole="button"
                  style={{ marginTop: 12, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: '#fff' }}>
                    {focusRunning ? '⏱ Back to the timer' : `▶︎ Start a ${habit.focus.minutes}-minute block`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* ── Calendar ── */}
        <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, marginTop: 20, borderWidth: 1, borderColor: C.border }}>
          <HabitCalendar days={days} todayKey={todayKey} weekly={!!habit.perWeek} />
        </View>

        <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, textAlign: 'center', marginTop: 16 }}>{hint}</Text>
        {(today === 'skipped' || (today === 'pending' && skips.left > 0)) && (
          <TouchableOpacity
            onPress={() => { haptic(); (today === 'pending' ? onSkip : onUnskip)(); }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityHint={today === 'pending' ? 'Takes it out of today without breaking the streak, and quiets its reminders' : undefined}
            style={{ alignSelf: 'center', marginTop: 12, borderRadius: 99, paddingVertical: 9, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(232,213,192,0.25)' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.cream }}>{today === 'pending' ? 'Skip today' : 'Undo skip'}</Text>
          </TouchableOpacity>
        )}
        {skips.limit > 0 && (
          <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(232,213,192,0.35)', textAlign: 'center', marginTop: 8 }}>
            {skips.left === 0
              ? `No skips left this week · ${skips.limit === 1 ? 'it resets' : 'they reset'} on Monday`
              : `${skips.left} of ${skips.limit} skip${skips.limit === 1 ? '' : 's'} left this week`}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};
