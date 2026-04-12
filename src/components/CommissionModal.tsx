import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Animated, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { DayPicker } from './DayPicker';
import { TimePicker } from './TimePicker';
import { daysLabel, formatTime12 } from '../helpers';
import type { ReminderTime } from '../types';

const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium',        { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
};

export const CommissionModal = ({ visible, initialValue, initialDays, initialReminderTime, onSave, onClose }: {
  visible: boolean; initialValue: string; initialDays: number[];
  initialReminderTime: ReminderTime | null;
  onSave: (label: string, days: number[], reminderTime: ReminderTime | null) => void;
  onClose: () => void;
}) => {
  const [text, setText]                       = useState(initialValue);
  const [days, setDays]                       = useState<number[]>(initialDays);
  const [reminderEnabled, setReminderEnabled] = useState(initialReminderTime !== null);
  const [reminderHour, setReminderHour]       = useState(initialReminderTime?.hour ?? 20);
  const [reminderMinute, setReminderMinute]   = useState(initialReminderTime?.minute ?? 0);
  const inputRef    = useRef<TextInput>(null);
  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const isEdit = initialValue !== '';

  useEffect(() => {
    if (visible) {
      setText(initialValue); setDays(initialDays);
      setReminderEnabled(initialReminderTime !== null);
      setReminderHour(initialReminderTime?.hour ?? 20);
      setReminderMinute(initialReminderTime?.minute ?? 0);
      haptic.medium();
      scaleAnim.setValue(0.88); opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 0.88, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const canSave = text.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    haptic.success();
    onSave(text.trim(), days, reminderEnabled ? { hour: reminderHour, minute: reminderMinute } : null);
    setText(''); setDays([]); setReminderEnabled(false);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'center', alignItems: 'center', opacity: opacityAnim }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '90%', backgroundColor: '#3B2220', borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: 'rgba(212,149,106,0.35)', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: 12, opacity: 0.7, letterSpacing: 2, textTransform: 'uppercase' }}>{isEdit ? 'Edit Habbit' : 'New Habbit'}</Text>
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ backgroundColor: '#5C3D2E', borderRadius: 14, borderWidth: 1.5, borderColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 16, paddingVertical: 4, marginBottom: 18 }}>
                  <TextInput ref={inputRef} value={text} onChangeText={setText} placeholder="e.g. Drink 8 glasses of water" placeholderTextColor="rgba(232,213,192,0.25)" returnKeyType="done" onSubmitEditing={handleSave} maxLength={60}
                    style={{ fontFamily: 'Jua', fontSize: 16, color: '#e8d5c0', paddingVertical: 14 }} />
                </View>
                <View style={{ marginBottom: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(232,213,192,0.5)' }}>SCHEDULE</Text>
                    <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#D4956A', opacity: 0.9 }}>{daysLabel(days)}</Text>
                  </View>
                  <DayPicker days={days} onChange={setDays} />
                </View>
                <View style={{ marginBottom: 20 }}>
                  <TouchableOpacity onPress={() => { haptic.light(); setReminderEnabled(v => !v); }} activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#5C3D2E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: reminderEnabled ? 'rgba(212,149,106,0.35)' : 'rgba(212,149,106,0.15)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 16 }}>🔔</Text>
                      <View>
                        <Text style={{ fontFamily: 'Jua', fontSize: 13, color: '#e8d5c0' }}>Reminder</Text>
                        {reminderEnabled && <Text style={{ fontFamily: 'Jua', fontSize: 10, color: 'rgba(212,149,106,0.7)', marginTop: 1 }}>{formatTime12(reminderHour, reminderMinute)} · {daysLabel(days)}</Text>}
                      </View>
                    </View>
                    <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: reminderEnabled ? '#D4956A' : 'rgba(212,149,106,0.2)', justifyContent: 'center', paddingHorizontal: 3, alignItems: reminderEnabled ? 'flex-end' : 'flex-start' }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }} />
                    </View>
                  </TouchableOpacity>
                  {reminderEnabled && (
                    <View style={{ backgroundColor: '#5C3D2E', borderRadius: 12, marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)' }}>
                      <TimePicker hour={reminderHour} minute={reminderMinute} onChange={(h, m) => { setReminderHour(h); setReminderMinute(m); }} />
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7}
                    style={{ flex: 1, backgroundColor: 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: 14, color: 'rgba(232,213,192,0.55)' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={canSave ? handleSave : undefined} activeOpacity={canSave ? 0.8 : 1}
                    style={{ flex: 2, backgroundColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: canSave ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: canSave ? 6 : 0 }}>
                    <Text style={{ fontFamily: 'DynaPuff', color: canSave ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15 }}>{isEdit ? 'Save Changes' : 'Add Habbit'}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};