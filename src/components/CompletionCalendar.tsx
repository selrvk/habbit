// src/components/CompletionCalendar.tsx  

import React from 'react';
import { View, Text } from 'react-native';
import { buildCalendarGrid } from '../helpers';
import { CAL_DAY_LABELS } from '../constants';
import type { CompletionRecord } from '../types';

export const CompletionCalendar = ({ records, todayKey }: { records: CompletionRecord[]; todayKey: string }) => {
  const grid        = buildCalendarGrid(records, todayKey, 6);
  const doneCount   = records.filter(r => r.completed).length;
  const missedCount = records.filter(r => !r.completed).length;
  const cellColor   = (state: string) => {
    switch (state) {
      case 'done':   return '#D4956A';
      case 'missed': return 'rgba(200,80,60,0.35)';
      case 'today':  return 'rgba(212,149,106,0.3)';
      case 'future': return 'transparent';
      default:       return 'rgba(212,149,106,0.08)';
    }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(212,149,106,0.1)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)' }}>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: 22, color: '#D4956A' }}>{doneCount}</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: 10, color: 'rgba(232,213,192,0.5)', marginTop: 1 }}>days completed</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(200,80,60,0.08)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(200,80,60,0.15)' }}>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: 22, color: 'rgba(240,144,144,0.8)' }}>{missedCount}</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: 10, color: 'rgba(232,213,192,0.5)', marginTop: 1 }}>days missed</Text>
        </View>
      </View>
      {Array.from({ length: 7 }, (_, dow) => (
        <View key={dow} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ fontFamily: 'Jua', width: 28, fontSize: 9, color: 'rgba(232,213,192,0.45)', marginRight: 4 }}>{CAL_DAY_LABELS[dow]}</Text>
          {grid.map((col, wi) => {
            const cell = col[dow];
            return (
              <View key={wi} style={{ flex: 1, aspectRatio: 1, marginHorizontal: 2 }}>
                <View style={{ flex: 1, borderRadius: 3, backgroundColor: cellColor(cell.state), borderWidth: cell.state === 'today' ? 1.5 : 0, borderColor: cell.state === 'today' ? '#D4956A' : 'transparent' }} />
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 10, justifyContent: 'center' }}>
        {[{ color: '#D4956A', label: 'Completed' }, { color: 'rgba(200,80,60,0.35)', label: 'Missed' }, { color: 'rgba(212,149,106,0.08)', label: 'No data' }].map(({ color, label }) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: color }} />
            <Text style={{ fontFamily: 'Jua', fontSize: 9, color: 'rgba(232,213,192,0.4)' }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};