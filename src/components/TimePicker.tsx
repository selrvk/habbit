// src/components/TimePicker.tsx
//
// TimeField: a tappable time pill. Tapping opens a bottom sheet with hour / minute / AM-PM wheels.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { WheelPicker } from './WheelPicker';
import { formatTime12 } from '../helpers';
import { useFontSize } from '../hooks/useFontSize';

const hapticLight = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1));             // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')); // 00..59
const PERIODS = ['AM', 'PM'];

const TimeSheet = ({ visible, title, hour, minute, onDone, onClose }: {
  visible: boolean; title: string; hour: number; minute: number;
  onDone: (h: number, m: number) => void; onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const [h12, setH12]       = useState(hour % 12 === 0 ? 12 : hour % 12);
  const [min, setMin]       = useState(minute);
  const [isPM, setIsPM]     = useState(hour >= 12);

  const done = () => {
    hapticLight();
    onDone((h12 % 12) + (isPM ? 12 : 0), min);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.6)' }} onPress={onClose} />
      <View style={{
        backgroundColor: '#3B2220', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 16,
        borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(212,149,106,0.35)',
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(212,149,106,0.3)', alignSelf: 'center', marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ fontFamily: 'Jua', fontSize: 15, color: 'rgba(232,213,192,0.5)' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: 16, color: '#e8d5c0' }}>{title}</Text>
          <TouchableOpacity onPress={done} hitSlop={12}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: 15, color: '#D4956A' }}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <WheelPicker items={HOURS} index={h12 - 1} onChange={i => setH12(i + 1)} />
          <Text style={{ fontFamily: 'DynaPuff', fontSize: 22, color: 'rgba(212,149,106,0.6)' }}>:</Text>
          <WheelPicker items={MINUTES} index={min} onChange={setMin} />
          <WheelPicker items={PERIODS} index={isPM ? 1 : 0} onChange={i => setIsPM(i === 1)} />
        </View>
      </View>
    </Modal>
  );
};

/** A time pill; tapping it opens the wheel sheet. */
export const TimeField = ({ hour, minute, onChange, title = 'Reminder time' }: {
  hour: number; minute: number; onChange: (h: number, m: number) => void; title?: string;
}) => {
  const fs = useFontSize();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => { hapticLight(); Keyboard.dismiss(); setOpen(true); }}
        activeOpacity={0.75}
        style={{
          backgroundColor: 'rgba(212,149,106,0.16)', borderRadius: 12,
          paddingVertical: 8, paddingHorizontal: 14,
          borderWidth: 1, borderColor: 'rgba(212,149,106,0.4)',
        }}>
        <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: '#D4956A' }}>{formatTime12(hour, minute)}</Text>
      </TouchableOpacity>
      {/* Mounted only while open so the wheels start from the current value */}
      {open && (
        <TimeSheet
          visible title={title} hour={hour} minute={minute}
          onClose={() => setOpen(false)}
          onDone={(h, m) => { onChange(h, m); setOpen(false); }}
        />
      )}
    </>
  );
};
