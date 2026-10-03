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
import { BREAK_LENGTHS, DEFAULT_FOCUS, FOCUS_LENGTHS, type FocusSettings } from '../focus';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
};

const MAX_TIMES = 10;
const TIMES_OPTIONS = Array.from({ length: MAX_TIMES }, (_, i) => i + 1);
// 7× a week is just every day, which the "Set days" mode already covers.
const PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6];

const SUGGESTIONS: { label: string; times: number; focus?: FocusSettings }[] = [
  { label: 'Drink water',  times: 8 },
  { label: 'Read',         times: 1 },
  { label: 'Study',        times: 4, focus: { minutes: 25, breakMinutes: 5 } },
  { label: 'Exercise',     times: 1 },
  { label: 'Meditate',     times: 1, focus: { minutes: 10, breakMinutes: 0 } },
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
  // "N× a week" instead of set days: done on any days, once a day.
  const [weekly, setWeekly]           = useState(!!initialValue?.perWeek);
  const [perWeek, setPerWeek]         = useState(initialValue?.perWeek ?? 3);
  const dailyTimes = weekly ? 1 : timesPerDay;
  // Once the user picks how many times a day, suggestions only fill in the name.
  const [timesChosen, setTimesChosen] = useState(isEdit);

  // Focus timer: blocks that each count as one check-off. Suggestions set it until it's touched.
  const [focusOn, setFocusOn]         = useState(!!initialValue?.focus);
  const [focus, setFocus]             = useState<FocusSettings>(initialValue?.focus ?? DEFAULT_FOCUS);
  const [focusChosen, setFocusChosen] = useState(isEdit);
  const chooseFocus = (change: () => void) => { haptic.light(); setFocusChosen(true); change(); };

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
  const saveEnabled  = canSave && !(reminderEnabled && dailyTimes > 1 && mode === 'split' && splitInvalid);

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
    if (!focusChosen) { setFocusOn(!!s.focus); if (s.focus) setFocus(s.focus); }
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
      if (dailyTimes === 1)    reminderTime = single;
      else if (mode === 'manual') reminderTimes = [...manualTimes].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
      else reminderSplit = { startHour: splitFrom.hour, startMinute: splitFrom.minute, endHour: splitTo.hour, endMinute: splitTo.minute };
    }

    onSave({
      label: label.trim(), days, perWeek: weekly ? perWeek : null, timesPerDay: dailyTimes, reminderTime, reminderTimes, reminderSplit,
      // A break only comes between blocks, so once-a-day habits have none.
      focus: focusOn ? { minutes: focus.minutes, breakMinutes: dailyTimes > 1 ? focus.breakMinutes : 0 } : null,
    });
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

        {/* ── How often: set days, or N× a week on any days ── */}
        <Label>How often?</Label>
        <Card>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(212,149,106,0.1)', borderRadius: 12, padding: 3, marginBottom: 14 }}>
            {([['Set days', false], ['Times a week', true]] as const).map(([text, value]) => (
              <TouchableOpacity key={text} onPress={() => { haptic.light(); setWeekly(value); }} activeOpacity={0.8}
                accessibilityRole="button" accessibilityState={{ selected: weekly === value }}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: weekly === value ? '#D4956A' : 'transparent' }}>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: weekly === value ? '#fff' : 'rgba(232,213,192,0.6)' }}>{text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {weekly ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PER_WEEK_OPTIONS.map(n => {
                  const active = n === perWeek;
                  return (
                    <TouchableOpacity key={n} onPress={() => { haptic.light(); setPerWeek(n); }} activeOpacity={0.7}
                      accessibilityLabel={`${n} times a week`} accessibilityState={{ selected: active }}
                      style={{
                        flex: 1, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
                        backgroundColor: active ? '#D4956A' : 'rgba(212,149,106,0.08)',
                        borderWidth: 1.5, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.2)',
                      }}>
                      <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: active ? '#fff' : 'rgba(232,213,192,0.6)' }}>{n}×</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[subText, { marginTop: 10 }]}>
                Any days you like, once a day. It shows on Home until you've done it {perWeek}× that week (Monday to Sunday).
              </Text>
            </>
          ) : (
            <DayPicker days={days} onChange={setDays} />
          )}
        </Card>

        {/* ── Times per day (weekly habits are once a day) ── */}
        {!weekly && <Label>How many times a day?</Label>}
        {!weekly && <Card>
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
        </Card>}

        {/* ── Focus timer ── */}
        <Label>Focus timer</Label>
        <Card>
          <Pressable
            onPress={() => chooseFocus(() => setFocusOn(v => !v))}
            accessibilityRole="switch" accessibilityState={{ checked: focusOn }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={rowText}>Time it in focus blocks</Text>
              {!focusOn && <Text style={[subText, { marginTop: 2 }]}>Great for studying, reading or meditating</Text>}
            </View>
            <Switch
              value={focusOn}
              onValueChange={v => chooseFocus(() => setFocusOn(v))}
              trackColor={{ false: 'rgba(212,149,106,0.2)', true: '#D4956A' }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(212,149,106,0.2)"
            />
          </Pressable>

          {focusOn && (
            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(212,149,106,0.12)' }}>
              <Text style={[subText, { marginBottom: 8 }]}>Each block</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {FOCUS_LENGTHS.map(m => {
                  const active = m === focus.minutes;
                  return (
                    <TouchableOpacity key={m} onPress={() => chooseFocus(() => setFocus(f => ({ ...f, minutes: m })))} activeOpacity={0.7}
                      accessibilityLabel={`${m} minute blocks`} accessibilityState={{ selected: active }}
                      style={{
                        flexBasis: '14%', flexGrow: 1, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
                        backgroundColor: active ? '#D4956A' : 'rgba(212,149,106,0.08)',
                        borderWidth: 1.5, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.2)',
                      }}>
                      <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: active ? '#fff' : 'rgba(232,213,192,0.6)' }}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {dailyTimes > 1 && (
                <>
                  <Text style={[subText, { marginTop: 14, marginBottom: 8 }]}>Break between blocks</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {BREAK_LENGTHS.map(m => {
                      const active = m === focus.breakMinutes;
                      return (
                        <TouchableOpacity key={m} onPress={() => chooseFocus(() => setFocus(f => ({ ...f, breakMinutes: m })))} activeOpacity={0.7}
                          accessibilityLabel={m === 0 ? 'No break' : `${m} minute break`} accessibilityState={{ selected: active }}
                          style={{
                            flex: 1, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
                            backgroundColor: active ? '#D4956A' : 'rgba(212,149,106,0.08)',
                            borderWidth: 1.5, borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.2)',
                          }}>
                          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: active ? '#fff' : 'rgba(232,213,192,0.6)' }}>{m === 0 ? 'None' : `${m} min`}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
              <Text style={[subText, { marginTop: 12 }]}>
                {dailyTimes > 1
                  ? `Tap ▶︎ on Home to start a ${focus.minutes}-minute block. Each one counts 1 of ${dailyTimes}${focus.breakMinutes > 0 ? `, with a ${focus.breakMinutes}-minute break between` : ''}.`
                  : `Tap ▶︎ on Home to start a ${focus.minutes}-minute block. Finishing it checks the habbit off.`}
                {' '}You can still tap it off without the timer.
              </Text>
            </View>
          )}
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
              {dailyTimes === 1 ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={rowText}>At</Text>
                    <TimeField hour={single.hour} minute={single.minute} onChange={(hour, minute) => setSingle({ hour, minute })} />
                  </View>
                  {weekly && (
                    <Text style={[subText, { marginTop: 10 }]}>Every day until you've done it {perWeek}× that week.</Text>
                  )}
                </>
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
          {weekly ? `${perWeek}× a week · any days` : `${daysLabel(days)} · ${timesPerDay === 1 ? 'once a day' : `${timesPerDay}× a day`}`}
          {focusOn ? ` · ${focus.minutes}-min focus` : ''}
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
