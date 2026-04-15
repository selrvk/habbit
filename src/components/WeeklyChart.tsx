// src/components/WeeklyChart.tsx

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { ChartDay } from '../types';

const CHART_H    = 100;
const TOP_PAD    = 18; // breathing room above bars for floating value labels

export const WeeklyChart = ({ days, allocatedPerDay, currency, onDayPress }: {
  days: ChartDay[]; allocatedPerDay: number; currency: string;
  onDayPress?: (day: ChartDay) => void;
}) => {
  const maxVal  = Math.max(allocatedPerDay, ...days.map(d => d.total), 1);
  const budgetY = CHART_H - (allocatedPerDay / maxVal) * CHART_H; // 0 = top of chart area

  // Clamp so the label never hides above the container
  const budgetLabelTop = Math.max(budgetY - 11, 2);

  return (
    <View>
      {/*
        Total height = TOP_PAD (label float area) + CHART_H (bar area) + 4 (bottom gap)
        The budget line sits inside the CHART_H zone, offset by TOP_PAD.
        Bar value labels that overflow upward land in TOP_PAD instead of clipping.
      */}
      <View style={{ height: TOP_PAD + CHART_H + 4, flexDirection: 'row', position: 'relative' }}>

        {/* Budget dashed line — rendered in the padded coordinate space */}
        <View style={{
          position: 'absolute',
          left: 0, right: 0,
          top: TOP_PAD + budgetY,
          height: 1,
          backgroundColor: 'rgba(212,149,106,0.3)',
        }} />

        {/* Budget label — LEFT side so it never collides with the rightmost (Today) bar */}
        <View style={{
          position: 'absolute',
          left: 0,
          top: TOP_PAD + budgetLabelTop,
        }}>
          <Text style={{ fontFamily: 'Jua', fontSize: 9, color: 'rgba(212,149,106,0.55)' }}>
            budget
          </Text>
        </View>

        {/* Bars */}
        {days.map(day => {
          const barH   = day.total > 0 ? Math.max((day.total / maxVal) * CHART_H, 4) : 0;
          const over   = day.total > allocatedPerDay;
          const barColor = day.isToday
            ? (over ? '#f09090' : '#D4956A')
            : (over ? 'rgba(240,144,144,0.45)' : 'rgba(212,149,106,0.35)');

          // Show value inside the bar when it's tall enough, outside (above) when short
          const valueInsideBar = barH >= 20;
          const valueLabel = day.total >= 1_000_000
            ? `${(Math.floor((day.total / 1_000_000) * 10) / 10).toFixed(1)}M`
            : day.total >= 1000
              ? `${(day.total / 1000).toFixed(1)}k`
              : day.total.toFixed(0);

          return (
            <TouchableOpacity
              key={day.date}
              activeOpacity={day.total > 0 ? 0.7 : 1}
              onPress={() => day.total > 0 && onDayPress?.(day)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: TOP_PAD + CHART_H,
                paddingTop: TOP_PAD,
              }}
            >
              {/* Value label above bar (only when bar is too short to hold it inside) */}
              {day.total > 0 && !valueInsideBar && (
                <Text style={{
                  fontSize: 8,
                  marginBottom: 2,
                  color: over ? '#f09090' : 'rgba(232,213,192,0.5)',
                  fontFamily: 'Jua',
                }}>
                  {valueLabel}
                </Text>
              )}

              {/* Bar */}
              <View style={{
                width: '65%',
                height: barH,
                borderRadius: 4,
                backgroundColor: barColor,
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}>
                {/* Value label inside bar (when tall enough) */}
                {day.total > 0 && valueInsideBar && (
                  <Text style={{
                    fontSize: 8,
                    color: day.isToday ? 'rgba(255,255,255,0.85)' : 'rgba(232,213,192,0.7)',
                    fontFamily: 'Jua',
                  }}>
                    {valueLabel}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Day labels */}
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {days.map(day => (
          <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{
              fontFamily: 'Jua',
              fontSize: 10,
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