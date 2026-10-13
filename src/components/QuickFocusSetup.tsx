// src/components/QuickFocusSetup.tsx
//
// Setting up a quick focus session, one without a Habbit: an optional name, then the rounds
// and their lengths, starting from what was used last time. Shown in the focus timer's
// sheet (FocusSheet.tsx), which carries straight on to the timer when it starts.

import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useFontSize } from '../hooks/useFontSize';
import { durationLabel, sessionLength, type QuickFocusSettings } from '../focus';
import { FocusPicker } from './FocusPicker';
import { Icon } from './Icon';

const C = { card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', muted: 'rgba(232,213,192,0.5)', border: 'rgba(212,149,106,0.18)' };

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
};

/** "3:40 PM". */
const timeOfDay = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const QuickFocusSetup = ({ initial, onStart }: {
  initial: QuickFocusSettings;
  onStart: (settings: QuickFocusSettings, label: string) => void;
}) => {
  const fs = useFontSize();
  const [q, setQ]         = useState(initial);
  const [label, setLabel] = useState('');
  const total = sessionLength(q.rounds, q);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <Icon name="stopwatch" size={fs(60)} />
          <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(24), color: C.cream, marginTop: 8 }}>Quick focus</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, textAlign: 'center', marginTop: 4 }}>
            A focus session without a Habbit. The time still counts in your week.
          </Text>
        </View>

        <TextInput
          value={label} onChangeText={setLabel} maxLength={30} returnKeyType="done"
          placeholder="What are you focusing on? (optional)" placeholderTextColor="rgba(232,213,192,0.3)"
          accessibilityLabel="What are you focusing on? Optional"
          style={{
            fontFamily: 'Jua', fontSize: fs(15), color: C.cream, backgroundColor: C.card, borderRadius: 16,
            paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12,
          }} />

        <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <FocusPicker rounds={q.rounds} focus={q}
            onRounds={rounds => { haptic.light(); setQ(prev => ({ ...prev, rounds })); }}
            onFocus={next => { haptic.light(); setQ(prev => ({ ...prev, ...next })); }} />
        </View>
      </ScrollView>

      <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center', marginTop: 10, marginBottom: 12 }}>
        {q.rounds > 1 ? 'It runs from round to round by itself. ' : ''}Done around {timeOfDay(Date.now() + total * 60_000)}.
      </Text>
      <TouchableOpacity onPress={() => { haptic.success(); onStart(q, label); }} activeOpacity={0.85}
        accessibilityLabel={`Start focusing, ${durationLabel(total)}`}
        style={{ backgroundColor: C.accent, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: '#fff' }}>Start · {durationLabel(total)}</Text>
      </TouchableOpacity>
    </View>
  );
};
