import React from 'react';
import { View, Text } from 'react-native';
import type { ChartDay } from '../types';

export const WeeklyChart = ({ days, allocatedPerDay, currency }: { days: ChartDay[]; allocatedPerDay: number; currency: string }) => {
  const CHART_H = 100;
  const maxVal  = Math.max(allocatedPerDay, ...days.map(d => d.total), 1);
  const budgetY = CHART_H - (allocatedPerDay / maxVal) * CHART_H;
  return (
    <View>
      <View style={{ height: CHART_H + 4, flexDirection: 'row', alignItems: 'flex-end', position: 'relative' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: budgetY, height: 1, backgroundColor: 'rgba(212,149,106,0.3)' }} />
        <View style={{ position: 'absolute', right: 0, top: budgetY - 10 }}>
          <Text style={{ fontFamily: 'Jua', fontSize: 9, color: 'rgba(212,149,106,0.5)' }}>budget</Text>
        </View>
        {days.map(day => {
          const barH = day.total > 0 ? Math.max((day.total / maxVal) * CHART_H, 4) : 0;
          const over  = day.total > allocatedPerDay;
          return (
            <View key={day.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_H }}>
              {day.total > 0 && <Text style={{ fontSize: 8, marginBottom: 2, color: over ? '#f09090' : 'rgba(232,213,192,0.5)', fontFamily: 'Jua' }}>{day.total >= 1000 ? `${(day.total/1000).toFixed(1)}k` : day.total.toFixed(0)}</Text>}
              <View style={{ width: '65%', height: barH, borderRadius: 4, backgroundColor: day.isToday ? (over ? '#f09090' : '#D4956A') : (over ? 'rgba(240,144,144,0.45)' : 'rgba(212,149,106,0.35)') }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {days.map(day => (
          <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: 10, color: day.isToday ? '#D4956A' : 'rgba(232,213,192,0.45)' }}>{day.isToday ? 'Today' : day.dayName}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};