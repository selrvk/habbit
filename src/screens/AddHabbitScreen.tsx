// src/screens/AddHabbitScreen.tsx

import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView, Switch, Pressable, Alert,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayPicker } from '../components/DayPicker';
import { TimeField } from '../components/TimePicker';
import { daysLabel, formatTime12, computeSplitTimes } from '../helpers';
import { useFontSize } from '../hooks/useFontSize';
import type { Commission, HabbitFormData, ReminderTime } from '../types';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
};

const MAX_TIMES = 10;
const TIMES_OPTIONS = Array.from({ length: MAX_TIMES }, (_, i) => i + 1);

const SUGGESTIONS = [
  { label: 'Drink water',  times: 8 },
  { label: 'Read',         times: 1 },
  { label: 'Exercise',     times: 1 },
  { label: 'Meditate',     times: 1 },
  { label: 'Take vitamins', times: 1 },
  { label: 'Stretch',      times: 2 },
];

/** Resize a list of reminder times, padding with +1h after the last one. */
const resizeTimes = (count: number, existing: ReminderTime[]): ReminderTime[] => {
  const base = existing.slice(0, count);
  while (base.length < count) {
    const last = base[base.length - 1] ?? { hour: 7, minute: 0 };
    base.push({ hour: Math.min(last.hour + 1, 23), minute: last.minute });
  }
  return base;
};

const ordinal = (n: number) => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`;

// ─── building blocks ──────────────────────────────────────────────────────────

const Label = ({ children }: { children: React.ReactNode }) => {
  const fs = useFontSize();
  return (
    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.75)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 20, marginLeft: 4 }}>
      {children}
    </Text>
  );
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>
    {children}
  </View>
);

const LinkButton = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const fs = useFontSize();
  return (
    <TouchableOpacity onPress={() => { haptic.light(); onPress(); }} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 14 }}>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: '#D4956A', textDecorationLine: 'underline' }}>{label}</Text>
    </TouchableOpacity>
  );
};

// ─── screen ───────────────────────────────────────────────────────────────────

export const AddHabbitScreen = ({
  initialValue,
  onSave,
  onClose,
  onDelete,
}: {
  initialValue?: Commission;
  onSave: (data: HabbitFormData) => void;
  onClose: () => void;
  onDelete?: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const isEdit = !!initialValue;

  const [label, setLabel]             = useState(initialValue?.label ?? '');
  const [days, setDays]               = useState<number[]>(initialValue?.days ?? []);
  const [timesPerDay, setTimesPerDay] = useState(initialValue?.timesPerDay ?? 1);
  // Once the user picks how many times a day, suggestions only fill in the name.
  const [timesChosen, setTimesChosen] = useState(isEdit);

  const [reminderEnabled, setReminderEnabled] = useState(!!(
    initialValue?.reminderTime || initialValue?.reminderTimes?.length || initialValue?.reminderSplit
  ));

  // Once a day
  const [single, setSingle] = useState<ReminderTime>(initialValue?.reminderTime ?? { hour: 20, minute: 0 });

  // Several times a day: spread evenly across a window (default) or pick each time
  const [mode, setMode] = useState<'split' | 'manual'>(initialValue?.reminderTimes?.length ? 'manual' : 'split');
  const [splitFrom, setSplitFrom] = useState<ReminderTime>(
    initialValue?.reminderSplit ? { hour: initialValue.reminderSplit.startHour, minute: initialValue.reminderSplit.startMinute } : { hour: 8, minute: 0 },
  );
  const [splitTo, setSplitTo] = useState<ReminderTime>(
    initialValue?.reminderSplit ? { hour: initialValue.reminderSplit.endHour, minute: initialValue.reminderSplit.endMinute } : { hour: 20, minute: 0 },
  );
  const [manualTimes, setManualTimes] = useState<ReminderTime[]>(
    resizeTimes(initialValue?.timesPerDay ?? 1, initialValue?.reminderTimes ?? []),
  );

  const canSave     = label.trim().length > 0;
  const splitTimes  = computeSplitTimes(splitFrom.hour, splitFrom.minute, splitTo.hour, splitTo.minute, timesPerDay);
  const splitInvalid = splitTo.hour * 60 + splitTo.minute <= splitFrom.hour * 60 + splitFrom.minute;
  const saveEnabled  = canSave && !(reminderEnabled && timesPerDay > 1 && mode === 'split' && splitInvalid);

  const chooseTimes = (n: number) => {
    haptic.light();
    setTimesChosen(true);
    setTimesPerDay(n);
    setManualTimes(prev => resizeTimes(n, prev));
  };

  const switchToManual = () => {
    // Start from the evenly spread times so the user only adjusts what they want
    setManualTimes(splitInvalid ? resizeTimes(timesPerDay, [splitFrom]) : splitTimes);
    setMode('manual');
  };

  const pickSuggestion = (s: typeof SUGGESTIONS[number]) => {
    haptic.light();
    setLabel(s.label);
    if (timesChosen) return;
    setTimesPerDay(s.times);
    setManualTimes(prev => resizeTimes(s.times, prev));
  };

  const handleSave = () => {
    if (!saveEnabled) return;
    haptic.success();

    let reminderTime:  HabbitFormData['reminderTime']  = null;
    let reminderTimes: HabbitFormData['reminderTimes'] = [];
    let reminderSplit: HabbitFormData['reminderSplit'] = null;

    if (reminderEnabled) {
      if (timesPerDay === 1)   reminderTime = single;
      else if (mode === 'manual') reminderTimes = [...manualTimes].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
      else reminderSplit = { startHour: splitFrom.hour, startMinute: splitFrom.minute, endHour: splitTo.hour, endMinute: splitTo.minute };
    }

    onSave({ label: label.trim(), days, timesPerDay, reminderTime, reminderTimes, reminderSplit });
  };

  const rowText = { fontFamily: 'Jua', fontSize: fs(15), color: '#e8d5c0' } as const;
  const subText = { fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.5)' } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={{ minWidth: 60 }}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: 'rgba(232,213,192,0.6)' }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(18) }}>{isEdit ? 'Edit Habbit' : 'New Habbit'}</Text>
        <View style={{ minWidth: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ── Name ── */}
        <Label>What's the habbit?</Label>
        <View style={{
          backgroundColor: '#5C3D2E', borderRadius: 16, paddingHorizontal: 16,
          borderWidth: 1.5, borderColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)',
        }}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Drink water"
            placeholderTextColor="rgba(232,213,192,0.25)"
            returnKeyType="done"
            maxLength={60}
            autoFocus={!isEdit}
            style={{ fontFamily: 'Jua', fontSize: fs(18), color: '#e8d5c0', paddingVertical: 16 }}
          />
        </View>
        {!isEdit && label.trim() === '' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s.label} onPress={() => pickSuggestion(s)} activeOpacity={0.7}
                style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.08)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)' }}>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.65)' }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Days ── */}
        <Label>Which days?</Label>
        <Card>
          <DayPicker days={days} onChange={setDays} />
        </Card>

        {/* ── Times per day ── */}
        <Label>How many times a day?</Label>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TIMES_OPTIONS.map(n => {
              const active = n === timesPerDay;
              return (
                <TouchableOpacity key={n} onPress={() => chooseTimes(n)} activeOpacity={0.7}
                  accessibilityLabel={`${n} times a day`} accessibilityState={{ selected: active }}
                  style={{
                    flexBasis: '17%', flexGrow: 1, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
                    backgroundColor: active ? '#D4956A' : 'rgba(212,149,106,0.08)',
                    borderWidth: 1.5, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.2)',
                  }}>
                  <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: active ? '#fff' : 'rgba(232,213,192,0.6)' }}>{n}×</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[subText, { marginTop: 10 }]}>
            {timesPerDay === 1 ? 'Tap it once on Home to check it off.' : `Tap it on Home each time you do it — ${timesPerDay} taps completes it.`}
          </Text>
        </Card>

        {/* ── Reminder ── */}
        <Label>Reminder</Label>
        <Card>
          <Pressable
            onPress={() => { haptic.light(); setReminderEnabled(v => !v); }}
            accessibilityRole="switch" accessibilityState={{ checked: reminderEnabled }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={rowText}>Remind me</Text>
              {!reminderEnabled && <Text style={[subText, { marginTop: 2 }]}>Get a nudge so you don't forget</Text>}
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={v => { haptic.light(); setReminderEnabled(v); }}
              trackColor={{ false: 'rgba(212,149,106,0.2)', true: '#D4956A' }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(212,149,106,0.2)"
            />
          </Pressable>

          {reminderEnabled && (
            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(212,149,106,0.12)' }}>
              {timesPerDay === 1 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={rowText}>At</Text>
                  <TimeField hour={single.hour} minute={single.minute} onChange={(hour, minute) => setSingle({ hour, minute })} />
                </View>
              ) : mode === 'split' ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Text style={rowText}>{timesPerDay} times between</Text>
                    <TimeField title="From" hour={splitFrom.hour} minute={splitFrom.minute} onChange={(hour, minute) => setSplitFrom({ hour, minute })} />
                    <Text style={rowText}>and</Text>
                    <TimeField title="Until" hour={splitTo.hour} minute={splitTo.minute} onChange={(hour, minute) => setSplitTo({ hour, minute })} />
                  </View>
                  <Text style={[subText, { marginTop: 10, color: splitInvalid ? '#f09090' : subText.color }]}>
                    {splitInvalid
                      ? 'The end time needs to be after the start time.'
                      : `Reminds at ${splitTimes.map(t => formatTime12(t.hour, t.minute)).join(', ')}`}
                  </Text>
                  <LinkButton label="Pick each time myself" onPress={switchToManual} />
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {manualTimes.map((t, i) => (
                      <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: 'rgba(232,213,192,0.4)' }}>{ordinal(i + 1)}</Text>
                        <TimeField
                          title={`${ordinal(i + 1)} reminder`} hour={t.hour} minute={t.minute}
                          onChange={(hour, minute) => setManualTimes(prev => prev.map((x, idx) => (idx === i ? { hour, minute } : x)))}
                        />
                      </View>
                    ))}
                  </View>
                  <LinkButton label="Spread them evenly instead" onPress={() => setMode('split')} />
                </>
              )}
            </View>
          )}
        </Card>

        <Text style={[subText, { textAlign: 'center', marginTop: 18 }]}>
          {daysLabel(days)} · {timesPerDay === 1 ? 'once a day' : `${timesPerDay}× a day`}
          {reminderEnabled ? ' · with reminders' : ''}
        </Text>

        {isEdit && onDelete && (
          <TouchableOpacity
            onPress={() => {
              haptic.light();
              Alert.alert('Delete Habbit', `Delete "${initialValue?.label}"? Its past history stays in your charts.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
              ]);
            }}
            activeOpacity={0.7}
            style={{ alignSelf: 'center', marginTop: 28, paddingVertical: 10, paddingHorizontal: 20 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: '#f09090' }}>Delete Habbit</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Sticky Save ── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12,
        backgroundColor: '#2A1A18', borderTopWidth: 1, borderTopColor: 'rgba(212,149,106,0.08)',
      }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!saveEnabled}
          activeOpacity={0.8}
          style={{
            backgroundColor: saveEnabled ? '#D4956A' : 'rgba(212,149,106,0.18)',
            borderRadius: 16, paddingVertical: 15, alignItems: 'center',
          }}>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: saveEnabled ? '#fff' : 'rgba(255,255,255,0.3)' }}>
            {isEdit ? 'Save Changes' : 'Add Habbit'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
