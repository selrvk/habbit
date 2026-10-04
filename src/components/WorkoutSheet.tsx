// src/components/WorkoutSheet.tsx
//
// A workout in progress, full screen: each exercise's sets (weight × reps, filled in from
// last time) to tick off as they're done. Closing it keeps the workout going; finishing it
// logs it and checks the habit off (App.tsx, workout.ts).

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Alert, Keyboard } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { clock } from '../focus';
import {
  addSet, editSet, lastTime, MAX_SETS, removeSet, setsDone, setsLabel, toggleSet,
  type ActiveWorkout, type LiveExercise, type Routine, type WeightUnit, type WorkoutLog,
} from '../workout';

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', red: '#f09090', muted: 'rgba(232,213,192,0.5)', field: 'rgba(42,26,24,0.55)', border: 'rgba(212,149,106,0.2)' };

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS),
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
};

export type WorkoutDone = {
  label: string; routineName: string; minutes: number; sets: number; volume: number; unit: WeightUnit;
  /** Personal bests set: "Bench press · 62.5 kg × 5". */
  bests: { name: string; label: string }[];
};

/** "12:34" since the workout started. */
const Elapsed = ({ since }: { since: number }) => {
  const fs = useFontSize();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: C.cream, fontVariant: ['tabular-nums'] }}>{clock(Math.max(0, now - since))}</Text>;
};

const Field = ({ value, onChange, placeholder, decimal, label, done }: {
  value: string; onChange: (v: string) => void; placeholder: string; decimal: boolean; label: string; done: boolean;
}) => {
  const fs = useFontSize();
  return (
    <TextInput
      value={value}
      onChangeText={v => onChange(v.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '').slice(0, 6))}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
      placeholderTextColor="rgba(232,213,192,0.25)"
      selectTextOnFocus
      accessibilityLabel={label}
      style={{
        flex: 1, height: 40, borderRadius: 10, textAlign: 'center', paddingVertical: 0,
        backgroundColor: done ? 'rgba(157,224,135,0.12)' : C.field,
        fontFamily: 'DynaPuff', fontSize: fs(16), color: C.cream,
      }}
    />
  );
};

const ExerciseCard = ({ exercise, index, unit, log, workout, onChange }: {
  exercise: LiveExercise; index: number; unit: WeightUnit; log: WorkoutLog[]; workout: ActiveWorkout; onChange: (w: ActiveWorkout) => void;
}) => {
  const fs   = useFontSize();
  const last = lastTime(log, exercise.name);
  const head = { fontFamily: 'Jua', fontSize: fs(11), color: C.muted, letterSpacing: 1, textAlign: 'center' } as const;
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
      <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(17), color: C.cream }}>{exercise.name}</Text>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 2 }}>
        {last ? `Last time · ${setsLabel(last.sets, last.unit)}` : 'First time: pick a weight that feels right'}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4 }}>
        <Text style={[head, { width: 26 }]}>SET</Text>
        <Text style={[head, { flex: 1 }]}>{unit.toUpperCase()}</Text>
        <View style={{ width: 10 }} />
        <Text style={[head, { flex: 1 }]}>REPS</Text>
        <View style={{ width: 38 }} />
      </View>
      {exercise.sets.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: s.done ? C.green : C.muted, width: 26, textAlign: 'center' }}>{i + 1}</Text>
          <Field value={s.weight} decimal placeholder="—" done={s.done} label={`${exercise.name}, set ${i + 1}, weight in ${unit}`}
            onChange={v => onChange(editSet(workout, index, i, 'weight', v, Date.now()))} />
          <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.muted, width: 10, textAlign: 'center' }}>×</Text>
          <Field value={s.reps} decimal={false} placeholder="0" done={s.done} label={`${exercise.name}, set ${i + 1}, reps`}
            onChange={v => onChange(editSet(workout, index, i, 'reps', v, Date.now()))} />
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); (s.done ? haptic.light : haptic.medium)(); onChange(toggleSet(workout, index, i, Date.now())); }}
            hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: s.done }}
            accessibilityLabel={`Set ${i + 1} of ${exercise.name} done`}
            style={{
              width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
              backgroundColor: s.done ? C.green : 'transparent', borderWidth: 2, borderColor: s.done ? C.green : 'rgba(212,149,106,0.45)',
            }}>
            <Text style={{ fontSize: fs(16), color: s.done ? C.bg : 'rgba(212,149,106,0.6)', fontWeight: '700' }}>✓</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}>
        {exercise.sets.length < MAX_SETS && (
          <TouchableOpacity onPress={() => { haptic.light(); onChange(addSet(workout, index, Date.now())); }} hitSlop={8}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.accent }}>+ Add set</Text>
          </TouchableOpacity>
        )}
        {exercise.sets.length > 1 && (
          <TouchableOpacity onPress={() => { haptic.light(); onChange(removeSet(workout, index, Date.now())); }} hitSlop={8}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted }}>− Remove set</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const WorkoutSheet = ({ visible, workout, done, routines, log, onChange, onSwitchRoutine, onFinish, onDiscard, onClose }: {
  visible: boolean;
  workout: ActiveWorkout | null;
  /** Shown once the workout is finished. */
  done: WorkoutDone | null;
  /** The habit's routines, to switch between. */
  routines: Routine[];
  /** Past workouts, for "last time". */
  log: WorkoutLog[];
  onChange: (w: ActiveWorkout) => void;
  onSwitchRoutine: (routineId: string) => void;
  onFinish: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const ticked = workout ? setsDone(workout) : 0;

  // The chips stay put (no jump under your thumb); after the first set, switching asks first.
  const switchTo = (r: Routine) => {
    if (!workout || r.id === workout.routineId) return;
    haptic.light();
    if (ticked === 0) { onSwitchRoutine(r.id); return; }
    Alert.alert(`Switch to ${r.name}?`, `The ${ticked} set${ticked === 1 ? '' : 's'} you’ve ticked off in ${workout.routineName} will be cleared.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', style: 'destructive', onPress: () => onSwitchRoutine(r.id) },
    ]);
  };

  const confirmDiscard = () => {
    haptic.light();
    Alert.alert('Discard this workout?', ticked > 0 ? `The ${ticked} set${ticked === 1 ? '' : 's'} you’ve ticked off won’t be saved.` : 'Nothing’s been ticked off yet.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDiscard },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={() => { haptic.light(); onClose(); }} hitSlop={12}
            accessibilityLabel={workout ? 'Close. The workout keeps going' : 'Close'}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,149,106,0.12)' }}>
            <Text style={{ fontSize: fs(18), color: C.accent }}>⌄</Text>
          </TouchableOpacity>
          {workout && !done && <Elapsed since={workout.startedAt} />}
          {workout && !done ? (
            <TouchableOpacity onPress={confirmDiscard} hitSlop={10} style={{ minWidth: 38, alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.muted }}>Discard</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 38 }} />}
        </View>

        {done ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Text style={{ fontSize: fs(56) }}>💪</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), letterSpacing: 2, color: C.green, marginTop: 12 }}>WORKOUT DONE</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(26), color: C.cream, marginTop: 6, textAlign: 'center' }}>{done.routineName}</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.muted, marginTop: 8, textAlign: 'center' }}>
              {done.minutes} min · {done.sets} set{done.sets === 1 ? '' : 's'}{done.volume > 0 ? ` · ${done.volume.toLocaleString('en-US')} ${done.unit} lifted` : ''}
            </Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, marginTop: 4 }}>{done.label} is checked off 🥕</Text>
            {done.bests.length > 0 && (
              <View style={{ alignSelf: 'stretch', backgroundColor: 'rgba(157,224,135,0.1)', borderRadius: 16, padding: 14, marginTop: 24, borderWidth: 1, borderColor: 'rgba(157,224,135,0.3)' }}>
                <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: C.green, marginBottom: 4 }}>🏆 New personal best{done.bests.length === 1 ? '' : 's'}</Text>
                {done.bests.map(b => (
                  <Text key={b.name} style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream, marginTop: 4 }}>{b.name} · {b.label}</Text>
                ))}
              </View>
            )}
          </View>
        ) : workout ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }}
            keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), letterSpacing: 2, color: C.accent, marginTop: 14 }}>{workout.label.toUpperCase()}</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(28), color: C.cream }}>{workout.routineName}</Text>
            {routines.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {routines.map(r => {
                  const active = r.id === workout.routineId;
                  return (
                    <TouchableOpacity key={r.id} onPress={() => switchTo(r)} activeOpacity={0.7}
                      accessibilityRole="button" accessibilityState={{ selected: active }}
                      style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 99, backgroundColor: active ? C.accent : 'rgba(212,149,106,0.08)', borderWidth: 1, borderColor: active ? C.accent : 'rgba(212,149,106,0.22)' }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: active ? '#fff' : 'rgba(232,213,192,0.65)' }}>{r.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {workout.exercises.map((e, i) => (
              <ExerciseCard key={`${workout.routineId}-${i}`} exercise={e} index={i} unit={workout.unit} log={log} workout={workout} onChange={onChange} />
            ))}
          </ScrollView>
        ) : null}

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bg }}>
          {done ? (
            <TouchableOpacity onPress={() => { haptic.light(); onClose(); }} activeOpacity={0.8} style={{ backgroundColor: C.accent, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: '#fff' }}>Close</Text>
            </TouchableOpacity>
          ) : workout && (
            <TouchableOpacity onPress={() => { if (ticked > 0) { haptic.success(); onFinish(); } }} disabled={ticked === 0} activeOpacity={0.8}
              style={{ backgroundColor: ticked > 0 ? C.accent : 'rgba(212,149,106,0.18)', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: ticked > 0 ? '#fff' : 'rgba(255,255,255,0.35)' }}>
                {ticked > 0 ? `Finish workout · ${ticked} set${ticked === 1 ? '' : 's'}` : 'Tick off a set to finish'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};
