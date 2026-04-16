// src/screens/AddHabbitScreen.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayPicker } from '../components/DayPicker';
import { TimePicker } from '../components/TimePicker';
import { SectionDivider } from '../components/SectionDivider';
import { daysLabel, formatTime12, computeSplitTimes } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { useFontSize } from '../hooks/useFontSize';
import type { Commission, HabbitFormData, ReminderTime } from '../types';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
};

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build an initial array of manual reminder times of a given length. */
const buildManualTimes = (count: number, existing: ReminderTime[]): ReminderTime[] => {
  const base = existing.length > 0 ? [...existing] : [];
  // Pad with sensible defaults spread across the day
  while (base.length < count) {
    const idx = base.length;
    base.push({ hour: 8 + Math.round((idx * 10) / Math.max(count - 1, 1)) % 24, minute: 0 });
  }
  return base.slice(0, count);
};

// ─── component ────────────────────────────────────────────────────────────────

export const AddHabbitScreen = ({
  initialValue,
  onSave,
  onClose,
}: {
  initialValue?: Commission;
  onSave: (data: HabbitFormData) => void;
  onClose: () => void;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();
  const inputRef = useRef<TextInput>(null);
  const isEdit = !!initialValue;
  const insets = useSafeAreaInsets();

  // ── label ──
  const [label, setLabel] = useState(initialValue?.label ?? '');

  // ── frequency ──
  const [timesPerDay, setTimesPerDay] = useState(initialValue?.timesPerDay ?? 1);

  // ── schedule ──
  const [days, setDays] = useState<number[]>(initialValue?.days ?? []);

  // ── reminder enabled ──
  const hasReminder = !!(
    initialValue?.reminderTime ||
    (initialValue?.reminderTimes && initialValue.reminderTimes.length > 0) ||
    initialValue?.reminderSplit
  );
  const [reminderEnabled, setReminderEnabled] = useState(hasReminder);

  // ── single (timesPerDay === 1) ──
  const [singleHour,   setSingleHour]   = useState(initialValue?.reminderTime?.hour   ?? 20);
  const [singleMinute, setSingleMinute] = useState(initialValue?.reminderTime?.minute ?? 0);

  // ── multi mode: 'manual' | 'split' ──
  const [reminderMode, setReminderMode] = useState<'manual' | 'split'>(
    initialValue?.reminderSplit ? 'split' : 'manual',
  );

  // ── manual: one picker per time ──
  const [manualTimes, setManualTimes] = useState<ReminderTime[]>(
    buildManualTimes(initialValue?.timesPerDay ?? 1, initialValue?.reminderTimes ?? []),
  );

  // ── split evenly ──
  const splitEndTouched = useRef(!!initialValue?.reminderSplit);
  const [splitStartH, setSplitStartH] = useState(initialValue?.reminderSplit?.startHour   ?? 7);
  const [splitStartM, setSplitStartM] = useState(initialValue?.reminderSplit?.startMinute ?? 0);
  const [splitEndH,   setSplitEndH]   = useState(
    initialValue?.reminderSplit?.endHour ?? Math.min(splitStartH + 12, 23)
  );
  const [splitEndM,   setSplitEndM]   = useState(initialValue?.reminderSplit?.endMinute   ?? 0);

  // Keep manualTimes in sync when timesPerDay changes
  useEffect(() => {
    setManualTimes(prev => buildManualTimes(timesPerDay, prev));
  }, [timesPerDay]);

  // ── derived ──
  const canSave = label.trim().length > 0;

  const splitPreview =
    reminderEnabled && timesPerDay > 1 && reminderMode === 'split'
      ? computeSplitTimes(splitStartH, splitStartM, splitEndH, splitEndM, timesPerDay)
      : [];

  // ── handlers ──
  const handleTimesChange = (delta: number) => {
    haptic.light();
    setTimesPerDay(prev => Math.max(1, Math.min(10, prev + delta)));
  };

  const handleSave = () => {
    if (!canSave) return;
    haptic.success();

    let reminderTime   = null as HabbitFormData['reminderTime'];
    let reminderTimes  = [] as HabbitFormData['reminderTimes'];
    let reminderSplit  = null as HabbitFormData['reminderSplit'];

    if (reminderEnabled) {
      if (timesPerDay === 1) {
        reminderTime = { hour: singleHour, minute: singleMinute };
      } else if (reminderMode === 'manual') {
        reminderTimes = manualTimes;
      } else {
        reminderSplit = { startHour: splitStartH, startMinute: splitStartM, endHour: splitEndH, endMinute: splitEndM };
      }
    }

    onSave({ label: label.trim(), days, timesPerDay, reminderTime, reminderTimes, reminderSplit });
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1 }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 12 }}>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={{ backgroundColor: '#5C3D2E', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)' }}>
            <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: fs(14) }}>← Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 12, opacity: 0.5 }}>
              {isEdit ? 'Editing' : 'Creating'}
            </Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 20 }}>
              {isEdit ? 'Edit Habbit' : 'New Habbit'}
            </Text>
          </View>
        </View>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Label ──────────────────────────────────────────────────────── */}
          <SectionDivider title="✦ Habbit Name ✦" />
          <View style={{
            backgroundColor: '#5C3D2E', borderRadius: 14, marginBottom: 16,
            borderWidth: 1.5, borderColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)',
            paddingHorizontal: 16, paddingVertical: 4,
          }}>
            <TextInput
              ref={inputRef}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Drink 8 glasses of water"
              placeholderTextColor="rgba(232,213,192,0.25)"
              returnKeyType="done"
              maxLength={60}
              autoFocus
              style={{ fontFamily: 'Jua', fontSize: fs(16), color: '#e8d5c0', paddingVertical: 14 }}
            />
          </View>

          {/* ── Frequency ──────────────────────────────────────────────────── */}
          <SectionDivider title="✦ Frequency ✦" />
          <View style={{
            backgroundColor: '#5C3D2E', borderRadius: 14, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(15) }}>
                  {timesPerDay === 1 ? 'Once a day' : `${timesPerDay} times a day`}
                </Text>
                <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.55)', fontSize: fs(12), marginTop: 2 }}>
                  {timesPerDay === 1 ? 'Swipe once to complete' : `Swipe ${timesPerDay}× to complete`}
                </Text>
              </View>

              {/* Stepper */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleTimesChange(-1)}
                  disabled={timesPerDay <= 1}
                  activeOpacity={0.7}
                  style={{
                    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
                    backgroundColor: timesPerDay <= 1 ? 'rgba(212,149,106,0.05)' : 'rgba(212,149,106,0.15)',
                    borderWidth: 1, borderColor: timesPerDay <= 1 ? 'rgba(212,149,106,0.1)' : 'rgba(212,149,106,0.35)',
                  }}>
                  <Text style={{ fontFamily: 'DynaPuff', color: timesPerDay <= 1 ? 'rgba(212,149,106,0.25)' : '#D4956A', fontSize: 20, lineHeight: 22 }}>−</Text>
                </TouchableOpacity>

                <View style={{ width: 46, height: 36, borderRadius: 10, backgroundColor: '#D4956A', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(15) }}>{timesPerDay}×</Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleTimesChange(1)}
                  disabled={timesPerDay >= 10}
                  activeOpacity={0.7}
                  style={{
                    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
                    backgroundColor: timesPerDay >= 10 ? 'rgba(212,149,106,0.05)' : 'rgba(212,149,106,0.15)',
                    borderWidth: 1, borderColor: timesPerDay >= 10 ? 'rgba(212,149,106,0.1)' : 'rgba(212,149,106,0.35)',
                  }}>
                  <Text style={{ fontFamily: 'DynaPuff', color: timesPerDay >= 10 ? 'rgba(212,149,106,0.25)' : '#D4956A', fontSize: 20, lineHeight: 22 }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Schedule ───────────────────────────────────────────────────── */}
          <SectionDivider title="✦ Schedule ✦" />
          <View style={{
            backgroundColor: '#5C3D2E', borderRadius: 14, padding: 14, marginBottom: 16,
            borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.45)', letterSpacing: 1 }}>DAYS</Text>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#D4956A' }}>{daysLabel(days)}</Text>
            </View>
            <DayPicker days={days} onChange={setDays} />
          </View>

          {/* ── Reminder ───────────────────────────────────────────────────── */}
          <SectionDivider title="✦ Reminder ✦" />

          {/* Toggle row */}
          <TouchableOpacity
            onPress={() => { haptic.light(); setReminderEnabled(v => !v); }}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#5C3D2E', borderRadius: 12,
              paddingHorizontal: 14, paddingVertical: 12,
              borderWidth: 1, borderColor: reminderEnabled ? 'rgba(212,149,106,0.35)' : 'rgba(212,149,106,0.15)',
              marginBottom: reminderEnabled ? 8 : 16,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
              <View>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: '#e8d5c0' }}>Reminder</Text>
                {reminderEnabled && (
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: 'rgba(212,149,106,0.7)', marginTop: 1 }}>
                    {timesPerDay === 1
                      ? `${formatTime12(singleHour, singleMinute)} · ${daysLabel(days)}`
                      : reminderMode === 'split'
                        ? `Split evenly · ${timesPerDay}× · ${daysLabel(days)}`
                        : `${timesPerDay} times manually set · ${daysLabel(days)}`}
                  </Text>
                )}
              </View>
            </View>
            {/* Toggle pill */}
            <View style={{
              width: 44, height: 26, borderRadius: 13,
              backgroundColor: reminderEnabled ? '#D4956A' : 'rgba(212,149,106,0.2)',
              justifyContent: 'center', paddingHorizontal: 3,
              alignItems: reminderEnabled ? 'flex-end' : 'flex-start',
            }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }} />
            </View>
          </TouchableOpacity>

          {/* Reminder body */}
          {reminderEnabled && (
            <View style={{
              backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 16,
              paddingVertical: 14, paddingHorizontal: 14,
              borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)',
            }}>
              {timesPerDay === 1 ? (
                /* ── Single time picker ── */
                <TimePicker
                  hour={singleHour}
                  minute={singleMinute}
                  onChange={(h, m) => { setSingleHour(h); setSingleMinute(m); }}
                />
              ) : (
                <>
                  {/* ── Mode tabs ── */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {(['manual', 'split'] as const).map(mode => (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => { haptic.light(); setReminderMode(mode); }}
                        activeOpacity={0.8}
                        style={{
                          flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                          backgroundColor: reminderMode === mode ? '#D4956A' : 'rgba(212,149,106,0.1)',
                          borderWidth: 1, borderColor: reminderMode === mode ? '#D4956A' : 'rgba(212,149,106,0.25)',
                        }}>
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: reminderMode === mode ? '#fff' : 'rgba(232,213,192,0.55)' }}>
                          {mode === 'manual' ? '⏰  Manual' : '↔  Split evenly'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {reminderMode === 'manual' ? (
                    /* ── Manual: one picker per time ── */
                    manualTimes.map((t, i) => (
                      <View key={i}>
                        {i > 0 && (
                          <View style={{ height: 1, backgroundColor: 'rgba(212,149,106,0.1)', marginVertical: 12 }} />
                        )}
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.55)', marginBottom: 8, letterSpacing: 0.5 }}>
                          REMINDER {i + 1}
                        </Text>
                        <TimePicker
                          hour={t.hour}
                          minute={t.minute}
                          onChange={(h, m) =>
                            setManualTimes(prev => prev.map((x, idx) => idx === i ? { hour: h, minute: m } : x))
                          }
                        />
                      </View>
                    ))
                  ) : (
                    /* ── Split evenly ── */
                    <>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.55)', marginBottom: 8, letterSpacing: 0.5 }}>FROM</Text>
                      <TimePicker
                        hour={splitStartH} minute={splitStartM}
                        onChange={(h, m) => {
                          setSplitStartH(h);
                          setSplitStartM(m);
                          if (!splitEndTouched.current) {           // 👈 only sync if user hasn't touched TO
                            setSplitEndH(Math.min(h + 12, 23));
                            setSplitEndM(m);
                          }
                        }}
                      />

                      <View style={{ height: 1, backgroundColor: 'rgba(212,149,106,0.1)', marginVertical: 12 }} />

                      <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.55)', marginBottom: 8, letterSpacing: 0.5 }}>TO</Text>
                      <TimePicker
                        hour={splitEndH} minute={splitEndM}
                        onChange={(h, m) => {
                          splitEndTouched.current = true;           // 👈 stop auto-syncing
                          setSplitEndH(h);
                          setSplitEndM(m);
                        }}
                      />

                      {/* Preview chips */}
                      {splitPreview.length > 0 && (
                        <View style={{ marginTop: 14 }}>
                          <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.55)', marginBottom: 8, letterSpacing: 0.5 }}>
                            WILL REMIND AT
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {splitPreview.map((t, i) => (
                              <View
                                key={i}
                                style={{
                                  flexDirection: 'row', alignItems: 'center', gap: 4,
                                  backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 99,
                                  paddingHorizontal: 10, paddingVertical: 4,
                                  borderWidth: 1, borderColor: 'rgba(212,149,106,0.28)',
                                }}>
                                <Text style={{ fontSize: 10 }}>🔔</Text>
                                <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.9)' }}>
                                  {formatTime12(t.hour, t.minute)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          )}

        </ScrollView>

        {/* ── Sticky Save button ──────────────────────────────────────────── */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 28,
          backgroundColor: '#2A1A18',
          borderTopWidth: 1, borderTopColor: 'rgba(212,149,106,0.08)',
        }}>
          <TouchableOpacity
            onPress={canSave ? handleSave : undefined}
            activeOpacity={canSave ? 0.8 : 1}
            style={{
              backgroundColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.18)',
              borderRadius: 16, paddingVertical: 15, alignItems: 'center',
              shadowColor: canSave ? '#D4956A' : 'transparent',
              shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
              elevation: canSave ? 6 : 0,
            }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: canSave ? '#fff' : 'rgba(255,255,255,0.25)' }}>
              {isEdit ? 'Save Changes' : '+ Add Habbit'}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
};