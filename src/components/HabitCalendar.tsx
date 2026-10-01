// src/components/HabitCalendar.tsx
//
// Month calendar of one habit's days: done, missed, skipped, rest (not scheduled) and today.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { DAY_LABELS } from '../constants';
import { parseDateKey, toDateKey } from '../helpers';
import { useFontSize } from '../hooks/useFontSize';
import type { HabitDay, HabitDayState } from '../habitStats';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATE_LABEL: Record<HabitDayState | 'outside', string> = {
  done: 'done', missed: 'missed', rest: 'rest day', skipped: 'skipped', pending: 'not done yet', outside: '',
};

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

/** `weekly`: an "N× a week" habit, whose days are only ever done or not (never missed). */
export const HabitCalendar = ({ days, todayKey, weekly = false }: { days: HabitDay[]; todayKey: string; weekly?: boolean }) => {
  const fs = useFontSize();
  const states = useMemo(() => new Map(days.map(d => [d.date, d.state])), [days]);

  const today = parseDateKey(todayKey);
  const first = parseDateKey(days[0]?.date ?? todayKey);
  // Months are counted as year * 12 + month so they compare easily.
  const firstMonth = first.getFullYear() * 12 + first.getMonth();
  const lastMonth  = today.getFullYear() * 12 + today.getMonth();
  const [month, setMonth] = useState(lastMonth);

  const year = Math.floor(month / 12), m = month % 12;
  const leading     = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const NavButton = ({ label, enabled, onPress }: { label: string; enabled: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={enabled ? () => { haptic(); onPress(); } : undefined}
      disabled={!enabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label === '‹' ? 'Previous month' : 'Next month'}
      style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,149,106,0.12)', opacity: enabled ? 1 : 0.3 }}>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(18), color: '#D4956A', lineHeight: fs(22) }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <NavButton label="‹" enabled={month > firstMonth} onPress={() => setMonth(month - 1)} />
        <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: '#e8d5c0' }}>{MONTHS[m]} {year}</Text>
        <NavButton label="›" enabled={month < lastMonth} onPress={() => setMonth(month + 1)} />
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(232,213,192,0.4)' }}>{d}</Text>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (day === null) return <View key={col} style={{ flex: 1, aspectRatio: 1 }} />;
            const key     = toDateKey(new Date(year, m, day));
            const state   = states.get(key) ?? 'outside';
            const isToday = key === todayKey;
            return (
              <View key={col} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                accessible accessibilityLabel={`${MONTHS[m]} ${day}${isToday ? ', today' : ''}${STATE_LABEL[state] ? `, ${STATE_LABEL[state]}` : ''}`}>
                <View style={{
                  width: '78%', aspectRatio: 1, borderRadius: 99, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: state === 'done' ? '#D4956A' : state === 'missed' ? 'rgba(200,80,60,0.3)' : state === 'skipped' ? 'rgba(232,213,192,0.14)' : 'transparent',
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: state === 'pending' ? '#D4956A' : '#e8d5c0',
                }}>
                  <Text style={{
                    fontFamily: 'Jua', fontSize: fs(13),
                    color: state === 'done'    ? '#fff'
                         : state === 'missed'  ? 'rgba(232,213,192,0.75)'
                         : state === 'pending' ? '#D4956A'
                         : state === 'skipped' ? 'rgba(232,213,192,0.6)'
                         : state === 'rest'    ? 'rgba(232,213,192,0.3)'
                         : 'rgba(232,213,192,0.12)',
                  }}>{day}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' }}>
        {(weekly
          ? [{ label: 'Done', dot: { backgroundColor: '#D4956A' } }]
          : [
              { label: 'Done',     dot: { backgroundColor: '#D4956A' } },
              { label: 'Missed',   dot: { backgroundColor: 'rgba(200,80,60,0.3)' } },
              { label: 'Skipped',  dot: { backgroundColor: 'rgba(232,213,192,0.14)' } },
              { label: 'Rest day', dot: { borderWidth: 1, borderColor: 'rgba(232,213,192,0.3)' } },
            ]
        ).map(({ label, dot }) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, ...dot }} />
            <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: 'rgba(232,213,192,0.45)' }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};
