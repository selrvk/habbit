import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const hapticLight = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

export const TimePicker = ({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) => {
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const isAM = hour < 12;
  const incHour = () => { hapticLight(); onChange((hour + 1) % 24, minute); };
  const decHour = () => { hapticLight(); onChange((hour - 1 + 24) % 24, minute); };
  const incMin  = () => { hapticLight(); onChange(hour, (minute + 5) % 60); };
  const decMin  = () => { hapticLight(); onChange(hour, (minute - 5 + 60) % 60); };
  const toggleAMPM = () => { hapticLight(); onChange(hour < 12 ? hour + 12 : hour - 12, minute); };

  const SpinCol = ({ value, onInc, onDec }: { value: string; onInc: () => void; onDec: () => void }) => (
    <View style={{ width: 48, alignItems: 'center', gap: 4 }}>
      <TouchableOpacity onPress={onInc} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 8, width: 36, height: 28, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: 14 }}>▲</Text>
      </TouchableOpacity>
      <View style={{ backgroundColor: '#3B2220', borderRadius: 10, borderWidth: 1.5, borderColor: '#D4956A', width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'DynaPuff', fontSize: 20, color: '#e8d5c0' }}>{value}</Text>
      </View>
      <TouchableOpacity onPress={onDec} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 8, width: 36, height: 28, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: 14 }}>▼</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 }}>
      <SpinCol value={String(displayHour)} onInc={incHour} onDec={decHour} />
      <Text style={{ fontFamily: 'DynaPuff', fontSize: 24, color: 'rgba(212,149,106,0.6)', marginTop: 4 }}>:</Text>
      <SpinCol value={String(minute).padStart(2, '0')} onInc={incMin} onDec={decMin} />
      <View style={{ gap: 6, marginLeft: 4 }}>
        <TouchableOpacity onPress={() => !isAM && toggleAMPM()} activeOpacity={0.7}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: isAM ? '#D4956A' : 'rgba(212,149,106,0.12)', borderWidth: 1, borderColor: isAM ? '#D4956A' : 'rgba(212,149,106,0.25)' }}>
          <Text style={{ fontFamily: 'Jua', fontSize: 13, color: isAM ? '#fff' : 'rgba(232,213,192,0.4)' }}>AM</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => isAM && toggleAMPM()} activeOpacity={0.7}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: !isAM ? '#D4956A' : 'rgba(212,149,106,0.12)', borderWidth: 1, borderColor: !isAM ? '#D4956A' : 'rgba(212,149,106,0.25)' }}>
          <Text style={{ fontFamily: 'Jua', fontSize: 13, color: !isAM ? '#fff' : 'rgba(232,213,192,0.4)' }}>PM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};