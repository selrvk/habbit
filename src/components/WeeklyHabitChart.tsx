// src/components/WeeklyHabitChart.tsx

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { HabitChartDay } from '../types';

const CHART_H = 100;
const TOP_PAD = 18;

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
          const ratio   = day.scheduled > 0 ? day.completed / day.scheduled : 0;
          const barH    = day.scheduled > 0 ? Math.max(ratio * CHART_H, day.completed > 0 ? 4 : 0) : 0;
          const allDone = day.scheduled > 0 && day.completed >= day.scheduled;

          const barColor = day.isToday
            ? (allDone ? '#A8D4A0' : 'rgba(212,149,106,0.85)')
            : (allDone ? 'rgba(168,212,160,0.55)' : 'rgba(212,149,106,0.3)');

          const valueInsideBar = barH >= 20;
          const label = day.scheduled > 0 ? `${day.completed}/${day.scheduled}` : '';

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
              {day.completed > 0 && !valueInsideBar && (
                <Text style={{
                  fontSize: 8, marginBottom: 2, fontFamily: 'Jua',
                  color: allDone ? 'rgba(168,212,160,0.8)' : 'rgba(232,213,192,0.5)',
                }}>
                  {label}
                </Text>
              )}
              <View style={{
                width: '65%', height: barH, borderRadius: 4,
                backgroundColor: barColor, justifyContent: 'center',
                alignItems: 'center', overflow: 'hidden',
              }}>
                {day.completed > 0 && valueInsideBar && (
                  <Text style={{
                    fontSize: 8, fontFamily: 'Jua',
                    color: day.isToday ? 'rgba(255,255,255,0.85)' : 'rgba(232,213,192,0.7)',
                  }}>
                    {label}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {days.map(day => (
          <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{
              fontFamily: 'Jua', fontSize: 10,
              color: day.isToday ? '#D4956A' : 'rgba(232,213,192,0.45)',
            }}>
              {day.isToday ? 'Today' : day.dayName}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};