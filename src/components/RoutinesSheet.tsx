// src/components/RoutinesSheet.tsx
//
// A workout habit's routines (workout.ts), from the habit editor: each routine's name and
// exercises with their sets × reps, kg or lb, and the rest between sets. Routines take
// turns in this order.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useFontSize } from '../hooks/useFontSize';
import { generateId } from '../helpers';
import { cleanPlan, DEFAULT_REST, EXERCISE_SUGGESTIONS, MAX_SETS, REST_LENGTHS, type ExercisePlan, type Routine, type WorkoutPlan } from '../workout';

/** "Off", "30s", "1 min", "1:30". */
const restLabel = (s: number) => (s === 0 ? 'Off' : s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', red: '#f09090', muted: 'rgba(232,213,192,0.5)', faint: 'rgba(212,149,106,0.12)', border: 'rgba(212,149,106,0.2)' };

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

/** [−] 3 [+] */
const Stepper = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) => {
  const fs = useFontSize();
  const Btn = ({ text, to, enabled }: { text: string; to: number; enabled: boolean }) => (
    <TouchableOpacity onPress={() => { if (enabled) { haptic(); onChange(to); } }} disabled={!enabled} hitSlop={6}
      accessibilityLabel={`${text === '−' ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
      style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.faint, opacity: enabled ? 1 : 0.35 }}>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(16), color: C.accent }}>{text}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, width: 34 }}>{label}</Text>
      <Btn text="−" to={value - 1} enabled={value > min} />
      <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: C.cream, minWidth: 26, textAlign: 'center' }} accessibilityLabel={`${value} ${label.toLowerCase()}`}>{value}</Text>
      <Btn text="+" to={value + 1} enabled={value < max} />
    </View>
  );
};

const ExerciseRow = ({ exercise, last, onChange, onRemove }: {
  exercise: ExercisePlan; last: boolean; onChange: (e: ExercisePlan) => void; onRemove: () => void;
}) => {
  const fs = useFontSize();
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: 'rgba(212,149,106,0.1)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={exercise.name}
          onChangeText={name => onChange({ ...exercise, name })}
          placeholder="Exercise"
          placeholderTextColor="rgba(232,213,192,0.25)"
          maxLength={40}
          returnKeyType="done"
          style={{ flex: 1, fontFamily: 'Jua', fontSize: fs(15), color: C.cream, paddingVertical: 4 }}
        />
        <TouchableOpacity onPress={() => { haptic(); onRemove(); }} hitSlop={10} accessibilityLabel={`Remove ${exercise.name || 'exercise'}`}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: C.muted }}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 }}>
        <Stepper label="Sets" value={exercise.sets} min={1} max={MAX_SETS} onChange={sets => onChange({ ...exercise, sets })} />
        <Stepper label="Reps" value={exercise.reps} min={1} max={100} onChange={reps => onChange({ ...exercise, reps })} />
      </View>
    </View>
  );
};

const RoutineCard = ({ routine, index, onChange, onRemove }: {
  routine: Routine; index: number; onChange: (r: Routine) => void; onRemove: () => void;
}) => {
  const fs = useFontSize();
  const have = new Set(routine.exercises.map(e => e.name.trim().toLowerCase()));
  const suggestions = EXERCISE_SUGGESTIONS.filter(s => !have.has(s.toLowerCase())).slice(0, 10);
  const add = (name: string) => { haptic(); onChange({ ...routine, exercises: [...routine.exercises, { id: generateId(), name, sets: 3, reps: 10 }] }); };
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>{index + 1}.</Text>
        <TextInput
          value={routine.name}
          onChangeText={name => onChange({ ...routine, name })}
          placeholder="Routine name, e.g. Push"
          placeholderTextColor="rgba(232,213,192,0.25)"
          maxLength={30}
          returnKeyType="done"
          style={{ flex: 1, fontFamily: 'DynaPuff', fontSize: fs(17), color: C.cream, paddingVertical: 4 }}
        />
        <TouchableOpacity onPress={onRemove} hitSlop={8}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.red }}>Remove</Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginTop: 6 }}>
        {routine.exercises.map((e, i) => (
          <ExerciseRow key={e.id} exercise={e} last={i === routine.exercises.length - 1}
            onChange={next => onChange({ ...routine, exercises: routine.exercises.map(x => (x.id === e.id ? next : x)) })}
            onRemove={() => onChange({ ...routine, exercises: routine.exercises.filter(x => x.id !== e.id) })} />
        ))}
      </View>
      <TouchableOpacity onPress={() => add('')} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 10 }}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.accent }}>+ Add exercise</Text>
      </TouchableOpacity>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {suggestions.map(s => (
          <TouchableOpacity key={s} onPress={() => add(s)} activeOpacity={0.7}
            style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.08)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.65)' }}>+ {s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export const RoutinesSheet = ({ visible, plan, onSave, onClose }: {
  visible: boolean;
  plan: WorkoutPlan;
  /** The routines kept (named, with exercises); none left means no workouts. */
  onSave: (plan: WorkoutPlan) => void;
  onClose: () => void;
}) => {
  const fs = useFontSize();
  const [draft, setDraft] = useState(plan);
  useEffect(() => { if (visible) setDraft(plan); }, [visible]);

  const setRoutine = (id: string, r: Routine) => setDraft(d => ({ ...d, routines: d.routines.map(x => (x.id === id ? r : x)) }));
  const removeRoutine = (r: Routine) => {
    haptic();
    const drop = () => setDraft(d => ({ ...d, routines: d.routines.filter(x => x.id !== r.id) }));
    if (r.exercises.length === 0) { drop(); return; }
    Alert.alert(`Remove ${r.name.trim() || 'this routine'}?`, 'Workouts you’ve done with it stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: drop },
    ]);
  };
  const addRoutine = () => {
    haptic();
    setDraft(d => ({ ...d, routines: [...d.routines, { id: generateId(), name: '', exercises: [] }] }));
  };
  const names = cleanPlan(draft).routines.map(r => r.name);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ minWidth: 60 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: 'rgba(232,213,192,0.6)' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }}>Routines</Text>
          <TouchableOpacity onPress={() => { haptic(); onSave(cleanPlan(draft)); }} hitSlop={12} style={{ minWidth: 60, alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: C.accent }}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, marginTop: 4, lineHeight: fs(19) }}>
            {names.length > 1
              ? `They take turns: ${names.join(', then ')}, then ${names[0]} again. You can pick another when you start.`
              : 'Add a routine for each kind of workout you do. They take turns, in this order.'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }}>Weights in</Text>
            <View style={{ flexDirection: 'row', backgroundColor: C.faint, borderRadius: 12, padding: 3 }}>
              {(['kg', 'lb'] as const).map(u => (
                <TouchableOpacity key={u} onPress={() => { haptic(); setDraft(d => ({ ...d, unit: u })); }} activeOpacity={0.8}
                  accessibilityRole="button" accessibilityState={{ selected: draft.unit === u }}
                  style={{ paddingVertical: 6, paddingHorizontal: 18, borderRadius: 10, backgroundColor: draft.unit === u ? C.accent : 'transparent' }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: draft.unit === u ? '#fff' : 'rgba(232,213,192,0.6)' }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream, marginTop: 16 }}>Rest between sets</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {REST_LENGTHS.map(sec => {
              const active = sec === (draft.restSeconds ?? DEFAULT_REST);
              return (
                <TouchableOpacity key={sec} onPress={() => { haptic(); setDraft(d => ({ ...d, restSeconds: sec })); }} activeOpacity={0.8}
                  accessibilityRole="button" accessibilityState={{ selected: active }}
                  accessibilityLabel={sec === 0 ? 'No rest timer' : `${restLabel(sec)} rest`}
                  style={{ flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? C.accent : C.faint }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: active ? '#fff' : 'rgba(232,213,192,0.6)' }}>{restLabel(sec)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 6 }}>
            {(draft.restSeconds ?? DEFAULT_REST) > 0 ? 'Starts when you tick a set off. You’ll get a nudge when it’s over.' : 'No timer between sets.'}
          </Text>

          {draft.routines.map((r, i) => (
            <RoutineCard key={r.id} routine={r} index={i} onChange={next => setRoutine(r.id, next)} onRemove={() => removeRoutine(r)} />
          ))}

          <TouchableOpacity onPress={addRoutine} activeOpacity={0.8}
            style={{ marginTop: 14, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: C.accent }}>+ Add a routine</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};
