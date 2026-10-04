// src/components/WorkoutProgressSheet.tsx
//
// A workout habit's progress (Pro): each exercise's personal bests, and a bar for each time
// it was done (the heaviest set, or the most reps for bodyweight exercises).

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { parseDateKey } from '../helpers';
import { exerciseHistory, exerciseSummaries, weightText, type ExerciseSummary, type WeightUnit, type WorkoutLog } from '../workout';

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', muted: 'rgba(232,213,192,0.55)', border: 'rgba(212,149,106,0.18)' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BARS = 12;

const dayLabel = (key: string) => { const d = parseDateKey(key); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };

const ExerciseCard = ({ summary: s, log, unit }: { summary: ExerciseSummary; log: WorkoutLog[]; unit: WeightUnit }) => {
  const fs     = useFontSize();
  const points = exerciseHistory(log, s.name, unit).slice(-BARS);
  const value  = (p: typeof points[number]) => (s.weighted ? p.top.weight ?? 0 : p.reps);
  const max    = Math.max(...points.map(value), 1);
  const min    = s.weighted ? Math.min(...points.map(value)) * 0.8 : 0;
  const best   = s.weighted ? s.heaviest! : s.mostReps;
  const kg     = (w: number | null) => `${weightText(w)} ${unit}`;
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: C.cream, flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>{s.times} time{s.times === 1 ? '' : 's'}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        {[
          { title: s.weighted ? 'Heaviest' : 'Most reps', value: s.weighted ? `${kg(best.top.weight)} × ${best.top.reps}` : `${best.reps}`, when: best.date },
          ...(s.weighted && s.bestE1rm ? [{ title: 'Est. 1-rep max', value: kg(Math.round(s.bestE1rm.e1rm)), when: s.bestE1rm.date }] : []),
        ].map(b => (
          <View key={b.title} style={{ flex: 1, backgroundColor: 'rgba(42,26,24,0.45)', borderRadius: 12, padding: 10 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>🏆 {b.title}</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: C.cream, marginTop: 2 }}>{b.value}</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>{dayLabel(b.when)}</Text>
          </View>
        ))}
      </View>

      {points.length > 1 && (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 64 }}
            accessible accessibilityLabel={`${s.weighted ? 'Heaviest set' : 'Most reps'} each time: ${points.map(p => (s.weighted ? kg(p.top.weight) : `${p.reps}`)).join(', ')}`}>
            {/* Always 12 slots, newest on the right, so bars keep their size. */}
            {[...Array<null>(BARS - points.length).fill(null), ...points].map((p, i) => {
              if (!p) return <View key={i} style={{ flex: 1, height: '100%', backgroundColor: 'rgba(212,149,106,0.04)', borderRadius: 5 }} />;
              const share = (value(p) - min) / Math.max(max - min, 1);
              const top   = value(p) === value(best) && p.date === best.date;
              return (
                <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', backgroundColor: 'rgba(212,149,106,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                  <View style={{ height: `${Math.max(share * 100, 8)}%`, backgroundColor: top ? C.green : C.accent, opacity: i === BARS - 1 || top ? 1 : 0.55, borderRadius: 5 }} />
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>{dayLabel(points[0].date)}</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>
              Last: {s.weighted ? `${kg(s.last.top.weight)} × ${s.last.top.reps}` : `${s.last.reps} reps`} · {dayLabel(s.last.date)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export const WorkoutProgressSheet = ({ visible, habitId, label, unit, log, onClose }: {
  visible: boolean; habitId: string; label: string; unit: WeightUnit; log: WorkoutLog[]; onClose: () => void;
}) => {
  const fs        = useFontSize();
  const insets    = useSafeAreaInsets();
  const mine      = log.filter(w => w.habitId === habitId);
  const summaries = visible ? exerciseSummaries(log, habitId, unit) : [];
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 }}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, letterSpacing: 1 }}>{label.toUpperCase()}</Text>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(22), color: C.cream }}>Progress</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, marginTop: 2 }}>
            {mine.length} workout{mine.length === 1 ? '' : 's'} · personal bests in green
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}>
          {summaries.length === 0 ? (
            <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.muted, textAlign: 'center', marginTop: 60 }}>Finish a workout to see your progress here.</Text>
          ) : summaries.map(s => <ExerciseCard key={s.name} summary={s} log={mine} unit={unit} />)}
        </ScrollView>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bg }}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={{ backgroundColor: C.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: '#fff' }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
