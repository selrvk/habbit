// src/components/WeeklyHabitChart.tsx

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { HabitChartDay } from '../types';

const CHART_H = 100;
const TOP_PAD = 18;

// Colour palette
// - past, fully done:    muted green
// - past, partial/none:  muted orange
// - today, all done:     bright green
// - today, in progress:  bright orange
// - today, ghost track:  very dim (shows max height before anything is done)
const COLORS = {
  pastDone:        'rgba(168,212,160,0.55)',
  pastPartial:     'rgba(212,149,106,0.30)',
  todayDone:       '#A8D4A0',
  todayInProgress: 'rgba(212,149,106,0.90)',
  todayGhost:      'rgba(212,149,106,0.10)',
  labelDone:       'rgba(168,212,160,0.80)',
  labelDefault:    'rgba(232,213,192,0.50)',
};

export const WeeklyHabitChart = ({
  days,
  onDayPress,
}: {
  days: HabitChartDay[];
  onDayPress?: (day: HabitChartDay) => void;
}) => {
  return (
    <View>
      <View style={{ height: TOP_PAD + CHART_H + 4, flexDirection: 'row', position: 'relative' }}>

        {/* "all done" baseline */}
        <View style={{
          position: 'absolute', left: 0, right: 0, top: TOP_PAD, height: 1,
          backgroundColor: 'rgba(212,149,106,0.3)',
        }} />
        <View style={{ position: 'absolute', left: 0, top: TOP_PAD - 9 }}>
          <Text style={{ fontFamily: 'Jua', fontSize: 9, color: 'rgba(212,149,106,0.55)' }}>
            all done
          </Text>
        </View>

        {days.map(day => {
          const ratio  = day.scheduled > 0 ? day.completed / day.scheduled : 0;
          const barH   = day.scheduled > 0 ? Math.max(ratio * CHART_H, day.completed > 0 ? 4 : 0) : 0;
          const allDone = day.scheduled > 0 && day.completed >= day.scheduled;

          // Pick fill colour
          let barColor: string;
          if (day.isToday) {
            barColor = allDone ? COLORS.todayDone : COLORS.todayInProgress;
          } else {
            barColor = allDone ? COLORS.pastDone : COLORS.pastPartial;
          }

          const valueInsideBar = barH >= 20;
          const label = day.scheduled > 0 ? `${day.completed}/${day.scheduled}` : '';
          const labelColor = allDone ? COLORS.labelDone : COLORS.labelDefault;

          return (
            <TouchableOpacity
              key={day.date}
              activeOpacity={day.scheduled > 0 ? 0.7 : 1}
              onPress={() => day.scheduled > 0 && onDayPress?.(day)}
              style={{
                flex: 1, alignItems: 'center', justifyContent: 'flex-end',
                height: TOP_PAD + CHART_H, paddingTop: TOP_PAD,
              }}
            >
              {/* Floating label above bar when bar is too short to fit it inside */}
              {day.completed > 0 && !valueInsideBar && (
                <Text style={{ fontSize: 8, marginBottom: 2, fontFamily: 'Jua', color: labelColor }}>
                  {label}
                </Text>
              )}

              {/* Ghost track — only shown for today, gives a sense of max height */}
              {day.isToday && day.scheduled > 0 && !allDone && (
                <View style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '65%',
                  height: CHART_H,
                  borderRadius: 4,
                  backgroundColor: COLORS.todayGhost,
                  borderWidth: 1,
                  borderColor: 'rgba(212,149,106,0.18)',
                }} />
              )}

              {/* Filled bar */}
              <View style={{
                width: '65%', height: barH, borderRadius: 4,
                backgroundColor: barColor,
                justifyContent: 'center', alignItems: 'center',
                overflow: 'hidden',
              }}>
                {day.completed > 0 && valueInsideBar && (
                  <Text style={{
                    fontSize: 8, fontFamily: 'Jua',
                    color: day.isToday ? 'rgba(255,255,255,0.90)' : 'rgba(232,213,192,0.75)',
                  }}>
                    {label}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Day labels row */}
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {days.map(day => (
          <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{
              fontFamily: 'Jua', fontSize: 10,
              color: day.isToday ? '#D4956A' : 'rgba(232,213,192,0.45)',
            }}>
              {day.isToday ? 'Today' : day.dayName}
            </Text>
            {/* Dot marker under today's label */}
            {day.isToday && (
              <View style={{
                width: 4, height: 4, borderRadius: 2,
                backgroundColor: '#D4956A',
                marginTop: 3, opacity: 0.7,
              }} />
            )}
          </View>
        ))}
      </View>
    </View>
  );  
};