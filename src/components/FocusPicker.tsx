// src/components/FocusPicker.tsx
//
// The focus timer's settings as rows of chips: how many rounds, the minutes in each, the
// break between them and (past four rounds) a longer break after every fourth. Used by a
// habit's form and by quick focus.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFontSize } from '../hooks/useFontSize';
import { BREAK_LENGTHS, FOCUS_LENGTHS, LONG_BREAK_EVERY, LONG_BREAK_LENGTHS, MAX_ROUNDS, type FocusSettings } from '../focus';

const ROUNDS = Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1);

export const FocusPicker = ({ rounds, focus, onRounds, onFocus }: {
  rounds: number;
  focus: FocusSettings;
  onRounds: (rounds: number) => void;
  onFocus: (focus: FocusSettings) => void;
}) => {
  const fs = useFontSize();
  const heading = { fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.5)', marginBottom: 8 } as const;
  const chip = (active: boolean, height: number, radius: number) => ({
    height, borderRadius: radius, justifyContent: 'center', alignItems: 'center',
    backgroundColor: active ? '#D4956A' : 'rgba(212,149,106,0.08)',
    borderWidth: 1.5, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.2)',
  } as const);
  const chipText = (active: boolean) => ({ color: active ? '#fff' : 'rgba(232,213,192,0.6)' });

  /** A row of break lengths, with the first (0) named `none`. */
  const Breaks = ({ lengths, value, none, label, onPick }: {
    lengths: number[]; value: number; none: string; label: (m: number) => string; onPick: (m: number) => void;
  }) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {lengths.map(m => {
        const active = m === value;
        return (
          <TouchableOpacity key={m} onPress={() => onPick(m)} activeOpacity={0.7}
            accessibilityLabel={label(m)} accessibilityState={{ selected: active }}
            style={[chip(active, 40, 12), { flex: 1 }]}>
            <Text style={[{ fontFamily: 'Jua', fontSize: fs(13) }, chipText(active)]}>{m === 0 ? none : `${m} min`}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View>
      <Text style={heading}>Rounds</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {ROUNDS.map(n => {
          const active = n === rounds;
          return (
            <TouchableOpacity key={n} onPress={() => onRounds(n)} activeOpacity={0.7}
              accessibilityLabel={`${n} round${n === 1 ? '' : 's'}`} accessibilityState={{ selected: active }}
              style={[chip(active, 44, 14), { flexBasis: '17%', flexGrow: 1 }]}>
              <Text style={[{ fontFamily: 'DynaPuff', fontSize: fs(15) }, chipText(active)]}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={heading}>Minutes in each round</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FOCUS_LENGTHS.map(m => {
          const active = m === focus.minutes;
          return (
            <TouchableOpacity key={m} onPress={() => onFocus({ ...focus, minutes: m })} activeOpacity={0.7}
              accessibilityLabel={`${m} minute rounds`} accessibilityState={{ selected: active }}
              style={[chip(active, 44, 14), { flexBasis: '14%', flexGrow: 1 }]}>
              <Text style={[{ fontFamily: 'DynaPuff', fontSize: fs(14) }, chipText(active)]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {rounds > 1 && (
        <>
          <Text style={[heading, { marginTop: 14 }]}>Break between rounds</Text>
          <Breaks lengths={BREAK_LENGTHS} value={focus.breakMinutes} none="None"
            label={m => (m === 0 ? 'No break' : `${m} minute break`)}
            onPick={m => onFocus({ ...focus, breakMinutes: m })} />
        </>
      )}

      {rounds > LONG_BREAK_EVERY && (
        <>
          <Text style={[heading, { marginTop: 14 }]}>Longer break after every {LONG_BREAK_EVERY} rounds</Text>
          <Breaks lengths={LONG_BREAK_LENGTHS} value={focus.longBreakMinutes ?? 0} none="Off"
            label={m => (m === 0 ? 'No longer break' : `${m} minute long break`)}
            onPick={m => onFocus({ ...focus, longBreakMinutes: m })} />
        </>
      )}
    </View>
  );
};
